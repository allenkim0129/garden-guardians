import { test, expect } from "@playwright/test";
import { createGame, plantAt, tick, snapshot, STAGES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { confirmTeam } from "../helpers/browser.mjs";
import { isolatedServer } from "../helpers/server.mjs";

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function seed(page, data, url = "/") {
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText(/오프라인 준비 완료|Offline ready/);
}

test("v19 클리어 여부로 11단계만 해금하고 두 테마 선택·8종 출전·기존 별 보존", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 568, height: 320 });
  const legacy = { ...freshSave(), stars: [...Array(9).fill(3), 0], unlocked: 10, tutorialSeen: true, language: "en", volume: 65 };
  await seed(page, legacy);
  await page.locator("#play-button").tap();
  await expect(page.locator(".theme-tab")).toHaveText(["1–10 · Sunlit Garden", "11–20 · Moonlit Greenhouse · Challenge", "21–30 · Sandy Desert · Expert"]);
  await expect(page.locator(".stage-button")).toHaveCount(30);
  await expect(page.locator(".stage-button:visible")).toHaveCount(10);
  await expect(page.locator('.stage-button[data-stage="11"]')).toBeDisabled();
  legacy.stars[9] = 2;
  await seed(page, legacy);
  await page.locator("#play-button").tap();
  await expect(page.locator('.stage-button[data-stage="11"]')).toBeEnabled();
  await expect(page.locator('.stage-button[data-stage="12"]')).toBeDisabled();
  await page.locator('.stage-button[data-stage="11"]').tap();
  await expect(page.locator("#loadout-count")).toHaveText("Selected plants: 8 / 8");
  await confirmTeam(page, "ember");
  await expect(page.locator("#game")).toHaveAttribute("data-theme", "moon");
  await expect(page.locator("#stage-title")).toHaveText("11. Moonlit Gate");
  await expect(page.locator(".seed-card:visible")).toHaveCount(8);
  await page.locator("#pause-button").tap();
  const saved = await stored(page);
  expect(saved.unlocked).toBe(11);
  expect(saved.stars).toEqual([...legacy.stars, ...Array(20).fill(0)]);
  expect(saved.current.loadout).toContain("ember");
  expect(saved.volume).toBe(65);
  await page.getByRole("button", { name: "Continue", exact: true }).tap();
  for (const [width, height] of [[568, 320], [320, 568]]) {
    await page.setViewportSize({ width, height });
    const boxes = await page.locator(".plot, .game-header button").evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (const box of boxes) {
      expect(box.width).toBeGreaterThanOrEqual(43.99);
      expect(box.height).toBeGreaterThanOrEqual(43.99);
      expect(box.x).toBeGreaterThanOrEqual(-.1); expect(box.y).toBeGreaterThanOrEqual(-.1);
      expect(box.x + box.width).toBeLessThanOrEqual(width + .1);
      expect(box.y + box.height).toBeLessThanOrEqual(height + .1);
    }
    await page.screenshot({ path: testInfo.outputPath(`moon-${width}.png`) });
  }
});

test("10단계 승리는 달빛 온실로 이어지고 11단계는 12단계만 해금", async ({ page }) => {
  for (const stage of [10, 11]) {
    const game = createGame(stage); game.nextSpawn = STAGES[stage - 1].count; game.time = 200;
    await seed(page, { ...freshSave(), unlocked: stage, tutorialSeen: true, current: game });
    await page.locator("#resume-button").tap();
    await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
    if (stage === 10) await expect(page.locator("#modal-body")).toContainText("달빛 온실이 열렸어요");
    await expect(page.locator(".plant-unlocks")).toHaveCount(0);
    const data = await stored(page);
    expect(data.unlocked).toBe(stage + 1);
    expect(data.stars[stage - 1]).toBe(3);
    await page.getByRole("button", { name: "다음 정원", exact: true }).tap();
    await confirmTeam(page);
    await expect(page.locator("#game")).toHaveAttribute("data-theme", "moon");
    expect((await stored(page)).current.stage).toBe(stage + 1);
  }
});

test("20단계 실제 전투·8종·배치·웨이브를 서버 종료 후 영어로 복구", async ({ page }) => {
  const server = await isolatedServer();
  try {
    const game = createGame(20, ["sun", "pea", "wall", "frost", "bomb", "ember", "lantern", "iron"]);
    plantAt(game, "sun", 0, 0); plantAt(game, "pea", 2, 1);
    for (let i = 0; i < 270; i++) tick(game, .1);
    await seed(page, { ...freshSave(), unlocked: 20, tutorialSeen: true, language: "en", volume: 70, current: snapshot(game) }, server.url);
    await page.locator("#resume-button").tap();
    await expect(page.locator("#game")).toHaveAttribute("data-theme", "moon");
    await page.locator('.seed-card[data-type="ember"]').tap();
    await page.locator('.plot[data-row="1"][data-col="0"]').tap();
    await expect(page.locator('.plot[data-row="1"][data-col="0"]')).toHaveAttribute("aria-label", "Row 2, column 1, Emberbloom");
    await page.locator("#pause-button").tap();
    const before = await stored(page);
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await page.locator("#resume-button").tap();
    await expect(page.locator("#game")).toHaveAttribute("data-theme", "moon");
    await expect(page.locator("#stage-title")).toHaveText("20. The Last Greenhouse Night");
    await page.locator("#pause-button").tap();
    const after = await stored(page);
    expect(after.current.stage).toBe(20);
    expect(after.current.loadout).toEqual(before.current.loadout);
    expect(after.current.plants.map(p => p.type)).toEqual(before.current.plants.map(p => p.type));
    expect(after.current.nextSpawn).toBe(before.current.nextSpawn);
    expect(after.current.time - before.current.time).toBeLessThan(1);
    expect(after.volume).toBe(70);
    expect(after.language).toBe("en");
  } finally { await server.stop(); }
});

test("낮과 밤 테마는 배경만 바꾸고 옛 정원을 다시 열면 원래 색으로 복원", async ({ page }) => {
  const colors = [];
  for (const stage of [1, 11, 1]) {
    await seed(page, { ...freshSave(), unlocked: 11, tutorialSeen: true, current: createGame(stage, ["sun", "pea"]) });
    await page.locator("#resume-button").tap();
    await expect(page.locator("#game")).toHaveAttribute("data-theme", stage === 11 ? "moon" : "garden");
    await page.locator("#pause-button").tap();
    colors.push(await page.locator("#game-art").evaluate(canvas => Array.from(canvas.getContext("2d").getImageData(40, 40, 1, 1).data)));
    const data = await stored(page);
    expect(data.current.sun).toBe(STAGES[stage - 1].startSun);
    expect(data.current.skyTimer).toBeGreaterThan(3);
  }
  expect(colors[0]).toEqual(colors[2]);
  expect(colors[1]).not.toEqual(colors[0]);
  expect(colors[1][2]).toBeGreaterThan(colors[1][0]);
});
