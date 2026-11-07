import { test, expect } from "@playwright/test";
import { createGame, STAGES, boardWidth } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { confirmTeam } from "../helpers/browser.mjs";

const team = ["sun", "pea", "wall", "frost", "bomb", "twin"];
async function seed(page, game, extra = {}) {
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), unlocked: 10, tutorialSeen: true, current: game, ...extra },
  });
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function swipe(page, context, browserName, from, to) {
  if (browserName === "chromium") {
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    // Zero-duration CDP gestures leave Chromium's native tap recognizer suppressing the next tap.
    await page.waitForTimeout(100);
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [to] });
    await page.waitForTimeout(100);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y); await page.mouse.up();
  }
}

for (const portrait of [false, true]) test(`더블탭은 홈·설정·출전 선택·카드·정원을 확대하지 않음 (${portrait ? "세로" : "가로"})`, async ({ page }) => {
  await page.setViewportSize(portrait ? { width: 320, height: 568 } : { width: 568, height: 320 });
  await seed(page, null);
  const viewport = () => page.evaluate(() => ({
    scale: visualViewport.scale, width: visualViewport.width, height: visualViewport.height,
    left: visualViewport.offsetLeft, top: visualViewport.offsetTop, x: scrollX, y: scrollY,
  }));
  async function doubleTap(selector) {
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeInViewport();
    await target.evaluate(node => {
      node.dataset.tapCheck = "0";
      node.addEventListener("click", () => { node.dataset.tapCheck = String(Number(node.dataset.tapCheck) + 1); });
    });
    const box = await target.boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const before = await viewport();
    expect(before.scale).toBe(1);
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(300);
    await expect(target).toHaveAttribute("data-tap-check", "2");
    expect(await viewport()).toEqual(before);
  }
  await doubleTap(".hero h1");
  await page.locator("#home [data-sound-settings]").tap();
  await doubleTap("#modal-title");
  await expect(page.locator("#modal")).toHaveCSS("touch-action", "manipulation");
  await page.locator("#modal-close").tap();
  await page.locator("#play-button").tap();
  await page.locator('.stage-button[data-stage="10"]').tap();
  await doubleTap('.loadout-choice[data-type="sun"]');
  await expect(page.locator('.loadout-choice[data-type="sun"]')).toHaveAttribute("aria-pressed", "true");
  await confirmTeam(page);
  const board = await page.locator("#board").boundingBox();
  await doubleTap(".stage-heading");
  await doubleTap('.seed-card[data-type="sun"]');
  await expect(page.locator('.seed-card[data-type="sun"]')).toHaveAttribute("aria-pressed", "false");
  await doubleTap('.plot[data-row="2"][data-col="4"]');
  expect(await page.locator("#board").boundingBox()).toEqual(board);
  expect((await stored(page)).current.plants).toEqual([]);
  await expect(page.locator("body")).toHaveCSS("touch-action", "manipulation");
  if (portrait) await expect(page.locator("#seed-cards")).toHaveCSS("touch-action", "manipulation");
  const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(meta).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
});

test("최대 6종 사전 선택·큰 카드·언어 전환·재접속·최소 화면", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await seed(page, null);
  await page.locator("#play-button").tap();
  await page.locator('.stage-button[data-stage="10"]').tap();
  await expect(page.locator('.loadout-choice[aria-pressed="true"]')).toHaveCount(8);
  await expect(page.locator('.loadout-choice[data-type="iron"]')).toBeDisabled();
  await page.locator('.loadout-choice[data-type="wall"]').tap();
  await page.locator('.loadout-choice[data-type="iron"]').tap();
  await page.locator('.loadout-choice[data-type="thorn"]').tap();
  await page.locator('.loadout-choice[data-type="pumpkin"]').tap();
  await page.locator("#modal [data-language]").tap();
  await expect(page.locator("#modal-title")).toHaveText("Choose your team");
  await expect(page.locator("#loadout-count")).toHaveText("Selected plants: 6 / 8");
  await page.locator("#modal").screenshot({ path: testInfo.outputPath("choose-team.png") });
  await confirmTeam(page);
  await expect(page.locator(".seed-card:visible")).toHaveCount(6);
  await expect(page.locator('.seed-card[data-type="iron"]')).toBeVisible();
  await expect(page.locator('.seed-card[data-type="wall"]')).toBeHidden();
  const before = await stored(page);
  for (const selector of [".seed-card:visible", ".plot:visible"]) {
    const sizes = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    for (const box of sizes) {
      expect(box.width).toBeGreaterThanOrEqual(44 - .01); expect(box.height).toBeGreaterThanOrEqual(44 - .01);
      if (selector === ".plot:visible") expect(box.y + box.height).toBeLessThanOrEqual(320);
    }
  }
  expect(await page.locator(".seed-card:visible img").first().evaluate(img => img.getBoundingClientRect().width)).toBeGreaterThanOrEqual(56);
  expect(await page.locator("#seed-cards").evaluate(node => node.scrollHeight - node.clientHeight)).toBeGreaterThan(20);
  await page.locator("#game").screenshot({ path: testInfo.outputPath("large-cards.png") });
  for (const [width, height] of [[1024, 650], [1024, 768], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    for (const card of await page.locator(".seed-card:visible").all()) {
      const bounds = await card.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    }
    expect(await page.locator("#seed-cards").evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1);
  }
  await page.reload(); await page.locator("#resume-button").tap();
  expect((await stored(page)).current.loadout).toEqual(before.current.loadout);
  expect((await stored(page)).language).toBe("en");
});

for (const portrait of [false, true]) test(`10단계 8종 선택·큰 카드 목록 스크롤·저장 (${portrait ? "세로" : "가로"})`, async ({ page, context, browserName }) => {
  await page.setViewportSize(portrait ? { width: 320, height: 568 } : { width: 568, height: 320 });
  await seed(page, null, { language: "en" });
  await page.locator("#play-button").tap();
  await page.locator('.stage-button[data-stage="10"]').tap();
  await expect(page.locator("#loadout-count")).toHaveText("Selected plants: 8 / 8");
  await expect(page.locator(".loadout-slot")).toHaveCount(8);
  await expect(page.locator('.loadout-choice[data-type="iron"]')).toBeDisabled();
  await page.locator('.loadout-choice[data-type="bomb"]').tap();
  await page.locator('.loadout-choice[data-type="iron"]').tap();
  await confirmTeam(page);
  await expect(page.locator(".seed-card:visible")).toHaveCount(8);
  await expect(page.locator("#seed-cards")).toHaveClass(/extended/);
  const board = await page.locator("#board").boundingBox();
  const bank = await page.locator("#seed-cards").boundingBox();
  if (browserName === "chromium") {
    const from = portrait ? { x: bank.x + 20, y: bank.y + bank.height / 2 } : { x: bank.x + bank.width / 2, y: bank.y + bank.height - 20 };
    const to = portrait ? { x: bank.x + bank.width - 20, y: from.y } : { x: from.x, y: bank.y + 20 };
    await swipe(page, context, browserName, from, to);
    await expect.poll(() => page.locator("#seed-cards").evaluate(node => node.scrollTop)).toBeGreaterThan(20);
  } else await page.locator("#seed-cards").evaluate(node => node.scrollTop = node.scrollHeight);
  await expect(page.locator('.seed-card[aria-pressed="true"]')).toHaveCount(0);
  const iron = page.locator('.seed-card[data-type="iron"]');
  await iron.tap();
  await expect(iron).toHaveAttribute("aria-pressed", "true");
  await expect(iron).toBeInViewport();
  expect(await iron.locator("img").evaluate(node => node.getBoundingClientRect().width)).toBe(56);
  expect(await page.locator("#board").boundingBox()).toEqual(board);
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  await page.locator("#pause-button").tap();
  const before = (await stored(page)).current.loadout;
  expect(before).toHaveLength(8);
  await page.reload(); await page.locator("#resume-button").tap();
  expect((await stored(page)).current.loadout).toEqual(before);
  await expect(page.locator(".seed-card:visible")).toHaveCount(8);
});

test("안전 여백으로 좁아진 화면의 6종 카드 스크롤·44px·방향 전환", async ({ page, context, browserName }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, createGame(10, team), { language: "en" });
  await page.evaluate(() => document.documentElement.style.setProperty("--device-top", "20px"));
  await page.locator("#resume-button").tap();
  await expect(page.locator(".seed-scroll-hint")).toBeVisible();
  expect(await page.locator("#seed-cards").evaluate(node => node.className)).toBe("seed-cards");
  const board = await page.locator("#board").boundingBox();
  const bank = await page.locator("#seed-cards").boundingBox();
  if (browserName === "chromium") {
    await swipe(page, context, browserName,
      { x: bank.x + 20, y: bank.y + bank.height / 2 },
      { x: bank.x + bank.width - 20, y: bank.y + bank.height / 2 });
  } else await page.locator("#seed-cards").evaluate(node => node.scrollTop = node.scrollHeight);
  await expect.poll(() => page.locator("#seed-cards").evaluate(node => node.scrollTop)).toBeGreaterThan(20);
  await expect(page.locator('.seed-card[aria-pressed="true"]')).toHaveCount(0);
  const card = page.locator('.seed-card[data-type="twin"]');
  await expect(card).toBeInViewport();
  await card.tap();
  expect(await card.locator("img").evaluate(node => node.getBoundingClientRect().width)).toBe(56);
  await page.locator('.plot[data-row="0"][data-col="0"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("125");
  expect(await page.locator("#board").boundingBox()).toEqual(board);
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  expect(board.width / 5).toBeGreaterThanOrEqual(44);
  expect(board.height / 10).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 568, height: 320 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--device-top", "0px");
    document.documentElement.style.setProperty("--device-left", "20px");
  });
  const rotated = await page.locator("#board").boundingBox();
  expect(rotated.x).toBeGreaterThanOrEqual(40);
  expect(rotated.x + rotated.width).toBeLessThanOrEqual(568);
  expect(rotated.y + rotated.height).toBeLessThanOrEqual(320);
  expect(rotated.width / 10).toBeGreaterThanOrEqual(44);
  expect(rotated.height / 5).toBeGreaterThanOrEqual(44);
  await page.locator("#pause-button").tap();
  const saved = (await stored(page)).current;
  expect(saved.loadout).toEqual(team);
  expect(saved.plants).toHaveLength(1);
  expect(saved.plants[0]).toMatchObject({ type: "twin", row: 0, col: 0 });
});

for (const portrait of [false, true]) test(`빠른 햇빛 쓸기·오배치 방지·화면 고정 (${portrait ? "세로 기기의 가로형 화면" : "가로"})`, async ({ page, context, browserName }) => {
  await page.setViewportSize(portrait ? { width: 320, height: 568 } : { width: 568, height: 320 });
  const game = createGame(10, team);
  game.skyTimer = 5;
  for (const [x, value] of [[200, 25], [400, 50], [600, 25]]) game.suns.push({ id: game.nextId++, x, y: 250, value, age: 0 });
  await seed(page, game);
  await page.locator("#resume-button").tap();
  await page.locator('.seed-card[data-type="pea"]').tap();
  const rect = await page.locator("#board").boundingBox();
  const point = x => portrait ? { x: rect.x + rect.width / 2, y: rect.y + rect.height * x / boardWidth(game) }
    : { x: rect.x + rect.width * x / boardWidth(game), y: rect.y + rect.height / 2 };
  const from = point(70), to = point(800);
  await swipe(page, context, browserName, from, to);
  await expect(page.locator("#sun-count")).toHaveText("450");
  await expect(page.locator(".sun-drop")).toHaveCount(0);
  expect((await stored(page)).current.plants).toEqual([]);
  await expect(page.locator('.seed-card[data-type="pea"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  expect(await page.locator("#board").boundingBox()).toEqual(rect);
  await page.locator('.plot[data-row="0"][data-col="0"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("325");
  await page.locator("#pause-button").tap();
  await expect(page.locator("#modal-title")).toHaveText("잠깐 쉬는 중");
  const modal = await page.locator("#modal").boundingBox();
  expect(modal.x).toBeGreaterThanOrEqual(-1); expect(modal.y).toBeGreaterThanOrEqual(-1);
  expect(modal.x + modal.width).toBeLessThanOrEqual(portrait ? 320 : 568);
  expect(modal.y + modal.height).toBeLessThanOrEqual(portrait ? 568 : 320);
});

test("승리 결과는 즉시 저장하되 안내 문구 없이 3초, 백그라운드 시간은 제외", async ({ page }) => {
  const game = createGame(1, ["sun", "pea"]);
  game.nextSpawn = STAGES[0].count; game.time = 100;
  game.enemies.push({ id: game.nextId++, type: "sleepy", row: 2, x: 500, hp: 18, slow: 0, age: 0, eating: false });
  game.shots.push({ id: game.nextId++, row: 2, x: 470, damage: 18, frost: false });
  await seed(page, game, { unlocked: 1 });
  await page.locator("#resume-button").tap();
  await expect.poll(async () => (await stored(page)).stars[0]).toBe(3);
  await expect(page.locator("#board-banner")).toHaveText("");
  expect((await stored(page)).stars[0]).toBe(3);
  expect((await stored(page)).current).toBeNull();
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(2000);
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.evaluate(() => { delete document.hidden; });
  await page.waitForTimeout(1700);
  await expect(page.locator("#modal")).not.toBeVisible();
  await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
  await expect(page.locator(".unlock-card")).toHaveAttribute("data-type", "wall");
});

test("세로에서 홈·식물 선택·전투·회전을 막힘 없이 조작", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, null);
  await page.locator("#play-button").tap();
  await page.locator(".stage-button").first().tap();
  await confirmTeam(page);
  await expect(page.locator(".seed-card:visible")).toHaveCount(2);
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator('.plot[data-row="4"][data-col="0"]').tap();
  await expect(page.locator('.plot[data-row="4"][data-col="0"]')).toHaveAttribute("aria-label", "5줄 1칸, 콩별이");
  await page.screenshot({ path: testInfo.outputPath("portrait-landscape.png") });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#modal")).not.toBeVisible();
  await expect(page.locator('.plot[data-row="4"][data-col="0"]')).toHaveAttribute("aria-label", "5줄 1칸, 콩별이");
});

test("선택은 최소 1종, 잠긴 식물 금지, 재시작 선택 취소는 기존 판 보존", async ({ page }) => {
  const game = createGame(1, ["sun", "pea"]);
  await seed(page, game);
  await page.locator("#resume-button").tap();
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator('.plot[data-row="1"][data-col="1"]').tap();
  await page.locator("#pause-button").tap();
  const before = (await stored(page)).current;
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "다시 시작", exact: true }).tap();
  await expect(page.locator('.loadout-choice[data-type="wall"]')).toBeDisabled();
  await page.locator('.loadout-choice[data-type="sun"]').tap();
  await page.locator('.loadout-choice[data-type="pea"]').tap();
  await expect(page.locator("#modal-actions .primary")).toBeDisabled();
  await page.locator("#modal-close").tap();
  await expect(page.locator("#modal-title")).toHaveText("잠깐 쉬는 중");
  expect((await stored(page)).current).toEqual(before);
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "다시 시작", exact: true }).tap();
  await page.locator('.loadout-choice[data-type="sun"]').tap();
  await confirmTeam(page);
  expect((await stored(page)).current.loadout).toEqual(["pea"]);
  await expect(page.locator(".seed-card:visible")).toHaveCount(1);
});

test("햇빛 위에서 시작한 쓸기·키보드 수집·취소와 다중 포인터는 오배치하지 않음", async ({ page, context, browserName }) => {
  const game = createGame(10, team);
  game.skyTimer = 5;
  for (const x of [200, 400, 700]) game.suns.push({ id: game.nextId++, x, y: 250, value: 25, age: 0 });
  await seed(page, game);
  await page.locator("#resume-button").tap();
  await page.locator('.seed-card[data-type="pea"]').tap();
  const rect = await page.locator("#board").boundingBox();
  const from = { x: rect.x + rect.width * 200 / boardWidth(game), y: rect.y + rect.height / 2 };
  const to = { ...from, x: rect.x + rect.width * 400 / boardWidth(game) };
  await swipe(page, context, browserName, from, to);
  await expect(page.locator("#sun-count")).toHaveText("400");
  await page.locator(".sun-drop").focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#sun-count")).toHaveText("425");
  const plot = page.locator('.plot[data-row="0"][data-col="0"]');
  for (const type of ["pointerdown", "pointercancel"]) await plot.dispatchEvent(type, { pointerId: 90, isPrimary: true });
  await plot.dispatchEvent("click", { detail: 1 });
  await plot.dispatchEvent("pointerdown", { pointerId: 91, isPrimary: true });
  await plot.dispatchEvent("pointerdown", { pointerId: 92, isPrimary: false });
  for (const pointerId of [91, 92]) await plot.dispatchEvent("pointerup", { pointerId });
  await plot.dispatchEvent("click", { detail: 1 });
  expect((await stored(page)).current.plants).toEqual([]);
  await plot.focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#sun-count")).toHaveText("300");
});
