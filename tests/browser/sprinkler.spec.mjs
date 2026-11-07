import { test, expect } from "@playwright/test";
import { createGame, plantAt, enemyHealth, snapshot } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { isolatedServer } from "../helpers/server.mjs";

test.use({ video: "on" });
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function seed(page, data, url = "/") {
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
  await page.goto(url);
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
}

for (const language of ["ko", "en"]) test(`물뿌리 카드·배치·지원 설명·도감 (${language})`, async ({ page }) => {
  const game = createGame(12, ["sprinkler", "sun", "pea"]); game.sun = 1000;
  await seed(page, { ...freshSave(), unlocked: 12, language, tutorialSeen: true, current: game });
  await page.locator("#help-button").tap();
  await expect(page.locator(".plant-guide")).toContainText(language === "ko" ? "물뿌리 · 12번째 정원 해금" : "Sprinkler");
  await expect(page.locator("#modal")).toContainText(language === "ko" ? "중첩되지" : "do not stack");
  await page.getByRole("button", { name: language === "ko" ? "닫기" : "Close", exact: true }).tap();
  await page.locator("#resume-button").tap();
  const card = page.locator('.seed-card[data-type="sprinkler"]');
  await expect(card).toHaveAttribute("aria-label", language === "ko" ? /물뿌리.*200.*8칸.*0.5초.*1.5배/ : /Sprinkler.*200.*8 neighboring.*0.5s.*1.5x/);
  await expect(card.locator(".compact-damage")).toHaveText(language === "ko" ? "가속" : "Boost");
  await card.tap();
  await page.locator('.plot[data-row="2"][data-col="2"]').tap();
  await page.locator("#pause-button").tap();
  const data = await stored(page);
  expect(data.current.plants.map(p => p.type)).toEqual(["sprinkler"]);
  expect(data.current.sun).toBe(800);
  expect(data.current.cooldowns.sprinkler).toBeGreaterThan(10);
  expect(data.current.cooldowns.sprinkler).toBeLessThanOrEqual(12);
});

test("8칸 분사·실제 분사구·비중첩 시각표시·정지·승리 렌더는 전투 상태를 바꾸지 않음", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { createGame, plantAt, snapshot, tick, shurikenSpeed } = await import("./src/engine.js");
    const { drawBoard, sprinklerWaterPaths } = await import("./src/art.js");
    const { SPRINKLER_NOZZLES, SPRITE_URLS } = await import("./src/sprites.js");
    const game = createGame(22); game.sun = 10000;
    plantAt(game, "sprinkler", 2, 4);
    for (let row = 1; row <= 3; row++) for (let col = 3; col <= 5; col++) {
      if (row === 2 && col === 4) continue;
      game.cooldowns.sun = 0; plantAt(game, "sun", row, col);
    }
    game.effects = [];
    const c = document.createElement("canvas"); c.width = 1000; c.height = 500;
    c.id = "sprinkler-check"; c.style = "position:fixed;inset:0;z-index:9999;width:100vw;height:100vh";
    document.body.append(c);
    const brush = c.getContext("2d");
    const frames = [];
    for (let i = 0; i < 4; i++) {
      game.time = game.plants[0].age = i * .2 + .01;
      const before = JSON.stringify(game);
      drawBoard(brush, game);
      const once = c.toDataURL(); drawBoard(brush, game);
      frames.push({ paths: sprinklerWaterPaths(game.plants[0], game), pure: before === JSON.stringify(game), frozen: once === c.toDataURL() });
    }
    const image = new Image(); image.src = SPRITE_URLS.sprinkler; await image.decode();
    const pixel = document.createElement("canvas"); pixel.width = 1280; pixel.height = 672;
    const sample = pixel.getContext("2d", { willReadFrequently: true }); sample.drawImage(image, 0, 0);
    const alphas = SPRINKLER_NOZZLES.flatMap((points, col) => points.map(([x, y]) =>
      sample.getImageData(col * 320 + Math.round(x), 224 + Math.round(y), 1, 1).data[3]));
    const speedGame = createGame(22); speedGame.sun = 2000;
    plantAt(speedGame, "sprinkler", 1, 1); plantAt(speedGame, "shuriken", 2, 2);
    speedGame.enemies.push({ id: speedGame.nextId++, type: "barrel", row: 2, x: 900, hp: 400, age: 0, slow: 0, eating: false });
    tick(speedGame, .05); const x = speedGame.shots[0].x; tick(speedGame, .05);
    const speed = (speedGame.shots[0].x - x) / .05;
    game.status = "won";
    const ended = sprinklerWaterPaths(game.plants[0], game).length;
    game.status = "playing"; game.time = game.plants[0].age = .41; drawBoard(brush, game);
    return { frames, alphas, speed, expectedSpeed: shurikenSpeed(speedGame, speedGame.plants[1]), ended,
      validState: snapshot(game).plants.length };
  });
  expect(report.validState).toBe(9);
  expect(report.alphas).toHaveLength(16);
  for (const alpha of report.alphas) expect(alpha).toBeGreaterThan(128);
  for (const frame of report.frames) {
    expect(frame.paths).toHaveLength(8);
    expect(new Set(frame.paths.map(path => path.targetId)).size).toBe(8);
    expect(frame.pure).toBe(true); expect(frame.frozen).toBe(true);
  }
  expect(report.speed).toBeCloseTo(540, 8); expect(report.expectedSpeed).toBe(540);
  expect(report.ended).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("sprinkler-eight-neighbors.png") });
});

test("실제 엔진 전투 fixture: 햇빛·가속·분사·백그라운드·저장·서버 종료 오프라인", async ({ page }, testInfo) => {
  const server = await isolatedServer();
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  try {
    const game = createGame(22, ["sprinkler", "sun", "lantern", "pea", "shuriken", "cactus", "wall"]); game.sun = 10000;
    for (const [type, row, col] of [["sprinkler", 2, 2], ["sun", 1, 1], ["lantern", 1, 2], ["shuriken", 1, 3],
      ["pea", 2, 3], ["cactus", 3, 3], ["wall", 3, 1]]) plantAt(game, type, row, col);
    for (const row of [1, 2, 3]) for (const x of [770, 930]) {
      const maxHp = enemyHealth("barrel", 22, game.pacingVersion);
      game.enemies.push({ id: game.nextId++, type: "barrel", row, x, hp: maxHp, maxHp, age: 0, slow: 0, eating: false });
    }
    await seed(page, { ...freshSave(), unlocked: 22, tutorialSeen: true, current: snapshot(game) }, server.url);
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    const cached = await page.evaluate(async () => {
      const cache = await caches.open((await caches.keys()).find(key => key.endsWith("-v34")));
      return (await cache.match(new URL("assets/sprites/sprinkler.png", location.href)))?.ok;
    });
    expect(cached).toBe(true);
    await page.locator("#resume-button").tap();
    await expect(page.locator(".sun-drop").first()).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: testInfo.outputPath("sprinkler-combat.png") });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const paused = await stored(page);
    expect(paused.current.plants.find(p => p.type === "sun").producedAt).toBeGreaterThanOrEqual(3 - 1e-8);
    expect(paused.current.plants.find(p => p.type === "sun").producedAt).toBeLessThan(3.12);
    expect(paused.current.stats.defeated).toBeGreaterThanOrEqual(2);
    const canvas = await page.locator("#game-art").evaluate(c => c.toDataURL());
    await page.waitForTimeout(300);
    expect(await page.locator("#game-art").evaluate(c => c.toDataURL())).toBe(canvas);
    expect(await stored(page)).toEqual(paused);
    await page.evaluate(() => { delete document.hidden; });
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    expect(await stored(page)).toEqual(paused);
    await page.locator("#resume-button").tap();
    await page.locator("#pause-button").tap();
    const resumed = await stored(page);
    expect(resumed.current.rulesVersion).toBe(10);
    expect(resumed.current.plants.map(p => p.id)).toEqual(paused.current.plants.map(p => p.id));
    const sun = resumed.current.plants.find(p => p.type === "sun");
    const previous = paused.current.plants.find(p => p.id === sun.id);
    const elapsed = resumed.current.time - paused.current.time;
    expect(sun.timer).toBeCloseTo(previous.timer - elapsed * 8 / 6, 6);
    expect(errors).toEqual([]);
  } finally { await server.stop(); }
});
