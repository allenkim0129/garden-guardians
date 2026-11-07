import { test, expect } from "@playwright/test";
import { confirmTeam } from "../helpers/browser.mjs";
import { createGame, PLANTS, ENEMIES, STAGES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { isolatedServer } from "../helpers/server.mjs";

const types = ["twin", "thorn", "pumpkin", "lantern", "iron"];
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function fixture(page, game, extra = {}, url = "/") {
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), tutorialSeen: true, unlocked: game.stage, current: game, ...extra },
  });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText(/오프라인 준비 완료|Offline ready/);
  await page.locator("#resume-button").tap();
}

test("새 5종이 실제 전투에서 대기·능력·피격·손상 프레임을 사용하고 50 햇빛을 수집", async ({ page }) => {
  await page.addInitScript(() => {
    window.newFrames = {};
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      if (this.canvas.id === "game-art" && image.src?.includes("/assets/sprites/")) {
        const type = new URL(image.src).pathname.split("/").pop().replace(".png", "");
        (window.newFrames[`${type}:${args[1] / 224}`] ??= {})[args[0] / 320] = true;
      }
      return draw.call(this, image, ...args);
    };
  });
  const game = createGame(10);
  for (const [row, type] of types.entries()) {
    for (const col of [0, 1]) game.plants.push({
      id: game.nextId++, type, row, col, hp: PLANTS[type].hp, timer: col === 0 ? 8 : .2, age: 0,
    });
    game.enemies.push({ id: game.nextId++, type: "jelly", row, x: 185, hp: ENEMIES.jelly.hp, age: 0, slow: 0, eating: false });
  }
  game.plants.push({ id: game.nextId++, type: "iron", row: 4, col: 3, hp: 500, timer: 0, age: 0 });
  await fixture(page, game);
  const needed = types.flatMap(type => [0, 1, 2].map(row => `${type}:${row}`));
  await expect.poll(() => page.evaluate(needed => needed.filter(key => Object.keys(window.newFrames[key] ?? {}).length !== 4), needed)).toEqual([]);
  await expect(page.getByRole("button", { name: "햇빛 50 모으기", exact: true })).toBeVisible();
  await page.locator('.seed-card[data-type="twin"]').tap();
  const plotsBefore = await page.locator(".plot").evaluateAll(nodes => nodes.map(n => n.getAttribute("aria-label")));
  const before = Number(await page.locator("#sun-count").textContent());
  await page.getByRole("button", { name: "햇빛 50 모으기", exact: true }).tap();
  expect(Number(await page.locator("#sun-count").textContent())).toBe(before + 50);
  expect(await page.locator(".plot").evaluateAll(nodes => nodes.map(n => n.getAttribute("aria-label")))).toEqual(plotsBefore);
  await page.locator("#pause-button").tap();
  const stopped = await page.locator("#game-art").evaluate(n => n.toDataURL());
  const saved = await stored(page);
  expect(saved.current.plants.find(p => p.type === "lantern" && p.col === 1).producedAt).toBeGreaterThan(0);
  expect(saved.current.plants.find(p => p.type === "iron" && p.col === 1).hp).toBeLessThan(1500);
  await page.waitForTimeout(300);
  expect(await page.locator("#game-art").evaluate(n => n.toDataURL())).toBe(stopped);
  await page.locator("#modal [data-language]").tap();
  expect((await stored(page)).current).toEqual(saved.current);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("#resume-button").tap();
  await expect(page.locator('.plot[data-row="0"][data-col="1"]')).toHaveAttribute("aria-label", "Row 1, column 2, Twinpod");
});

test("작은 화면의 카드 스크롤·드래그는 선택/배치/수집을 일으키지 않음", async ({ page, context, browserName }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const game = createGame(10);
  game.suns.push({ id: game.nextId++, x: 450, y: 250, age: 0, value: 50 });
  await fixture(page, game, { language: "en" });
  await page.locator('.seed-card[data-type="pea"]').tap();
  const bank = await page.locator("#seed-cards").boundingBox();
  if (browserName === "chromium") {
    const session = await context.newCDPSession(page);
    const x = bank.x + bank.width / 2, y = bank.y + bank.height - 20;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 22 }] });
      await page.waitForTimeout(20);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.locator("#seed-cards").evaluate(n => n.scrollTop)).toBeGreaterThan(30);
    await session.detach();
  } else {
    const card = page.locator('.seed-card[data-type="pea"]');
    await card.dispatchEvent("pointerdown", { clientX: 40, clientY: 100 });
    await card.dispatchEvent("pointermove", { clientX: 40, clientY: 150 });
    await card.dispatchEvent("click", { detail: 1 });
    await page.locator("#seed-cards").evaluate(n => n.scrollTop = n.scrollHeight);
  }
  await expect(page.locator('.seed-card[data-type="pea"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#sun-count")).toHaveText("350");
  await expect(page.locator(".sun-drop")).toHaveCount(1);
  await expect(page.locator(".plot[aria-label$='Empty plot']")).toHaveCount(50);
  for (const type of types) {
    const card = page.locator(`.seed-card[data-type="${type}"]`);
    await card.tap();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    const box = await card.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(320);
  }
  await page.locator('.plot[data-row="0"][data-col="0"]').tap();
  await expect(page.locator('.plot[data-row="0"][data-col="0"]')).toHaveAttribute("aria-label", "Row 1, column 1, Ironleaf Fort");
  await expect(page.locator('.seed-card[aria-pressed="true"]')).toHaveCount(0);
});

test("새 보상은 4~8단계 최초 클리어에만 표시하고 다음 정원에서 바로 사용", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 568, height: 320 });
  for (const [index, type] of types.entries()) {
    const stage = index + 4;
    const game = createGame(stage); game.nextSpawn = STAGES[stage - 1].count;
    await fixture(page, game);
    await expect(page.locator(".unlock-card")).toHaveAttribute("data-type", type);
    await expect(page.locator(".unlock-card p")).toHaveText(PLANTS[type].description);
    await expect(page.locator(".unlock-card span")).toContainText(`햇빛 ${PLANTS[type].cost}`);
    await page.getByRole("button", { name: "다음 정원", exact: true }).tap();
    await confirmTeam(page, type);
    await expect(page.locator(`.seed-card[data-type="${type}"]`)).toBeEnabled();
    await fixture(page, game, { unlocked: stage + 1, stars: freshSave().stars.fill(3) });
    await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
    await expect(page.locator(".unlock-card")).toHaveCount(0);
  }
});

test("이전 다섯 쿨다운 저장 복원 뒤 새 5종 캐시와 영어 오프라인 재실행", async ({ page, context, browserName }) => {
  const server = await isolatedServer();
  try {
    const game = createGame(9); game.rulesVersion = 2;
    for (const type of types) delete game.cooldowns[type];
    await fixture(page, game, { language: "en", stars: freshSave().stars.fill(2) }, server.url);
    await page.locator('.seed-card[data-type="twin"]').tap();
    await page.locator('.plot[data-row="2"][data-col="0"]').tap();
    await page.locator("#pause-button").tap();
    const before = await stored(page);
    expect(before.current.rulesVersion).toBe(8);
    for (const type of types) expect(before.current.cooldowns[type]).toBeGreaterThanOrEqual(0);
    const cached = await page.evaluate(async () => {
      const key = (await caches.keys()).find(k => k.startsWith("garden-guardians-"));
      return (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname);
    });
    for (const type of types) expect(cached).toContain(`/assets/sprites/${type}.png`);
    await server.stop();
    if (browserName === "chromium") await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.locator("#resume-button").tap();
    await page.locator("#pause-button").tap();
    const after = await stored(page);
    expect(after.stars).toEqual(before.stars);
    expect(after.current.sun).toBe(before.current.sun);
    expect(after.current.plants[0].type).toBe("twin");
  } finally { await server.stop(); }
});
