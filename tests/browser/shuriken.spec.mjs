import { test, expect } from "@playwright/test";
import { createGame, plantAt, tick, enemyHealth } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { isolatedServer } from "../helpers/server.mjs";

test.use({ video: "on" });
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);

test("표창 실제 왕복·빈손·선인장 제한 해제·정지·회전·서버 종료 후 복원", async ({ page }, testInfo) => {
  const server = await isolatedServer();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  try {
    const game = createGame(22, ["shuriken", "cactus"]); game.sun = 2000;
    plantAt(game, "shuriken", 2, 4);
    plantAt(game, "cactus", 0, 0); game.cooldowns.cactus = 0;
    plantAt(game, "cactus", 4, 0);
    for (const x of [870, 980]) {
      const maxHp = enemyHealth("barrel", 22, game.pacingVersion);
      game.enemies.push({ id: game.nextId++, type: "barrel", row: 2, x, hp: maxHp, maxHp, age: 0, slow: 0, eating: false });
    }
    tick(game, .1);
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key: SAVE_KEY, data: { ...freshSave(), unlocked: 22, tutorialSeen: true, current: game },
    });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    const cached = await page.evaluate(async () => {
      const cache = await caches.open((await caches.keys()).find(k => k.endsWith("-v34")));
      return Promise.all(["shuriken", "shuriken-projectile"].map(async name => Boolean(await cache.match(new URL(`assets/sprites/${name}.png`, location.href).href))));
    });
    expect(cached).toEqual([true, true]);
    await page.locator("#resume-button").tap();
    await expect(page.locator('.seed-card[data-type="shuriken"]')).toHaveAttribute("aria-label", /표창잎.*300.*36/);
    await expect(page.locator('.seed-card[data-type="shuriken"] .compact-damage')).toHaveText("36↔36");
    await expect(page.locator('.seed-card[data-type="cactus"] .plant-limit')).toHaveCount(0);
    await expect(page.locator('.seed-card[data-type="cactus"]')).toHaveAttribute("aria-disabled", "false");
    await page.waitForTimeout(2100);
    await page.screenshot({ path: testInfo.outputPath("return-flight.png") });
    await page.waitForTimeout(1100);
    await page.locator("#pause-button").tap();
    const paused = await stored(page);
    expect(paused.current.plants[0].caughtAt).toBeGreaterThan(3);
    expect(paused.current.shots).toHaveLength(1);
    expect(paused.current.shots[0].outHits).toEqual([]);
    expect(paused.current.enemies.map(e => e.hp)).toEqual(game.enemies.map(e => e.hp - 72));
    const canvas = await page.locator("#game-art").evaluate(c => c.toDataURL());
    await page.waitForTimeout(300);
    expect(await page.locator("#game-art").evaluate(c => c.toDataURL())).toBe(canvas);
    await page.setViewportSize({ width: 320, height: 568 });
    expect(await stored(page)).toEqual(paused);
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    expect(await stored(page)).toEqual(paused);
    await page.locator("#resume-button").tap();
    await page.waitForTimeout(200);
    await page.locator("#pause-button").tap();
    const restored = await stored(page);
    const expected = structuredClone(paused.current);
    const steps = Math.round((restored.current.time - expected.time) * 30);
    for (let i = 0; i < steps; i++) tick(expected, 1 / 30);
    expect(restored.current.shots).toHaveLength(1);
    expect(restored.current.shots).toEqual(expected.shots);
    expect(restored.current.enemies).toEqual(expected.enemies);
    expect(restored.current.loadout).toEqual(["shuriken", "cactus"]);
    expect(errors).toEqual([]);
  } finally { await server.stop(); }
});

test("승인 몸체 12프레임의 손·접지와 별도 표창 회전·빈손 렌더", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
  const report = await page.evaluate(async () => {
    const { drawPlant, drawProjectile } = await import("./src/art.js");
    const { createGame, plantAt, tick } = await import("./src/engine.js");
    const { plantFrame } = await import("./src/sprites.js");
    const c = document.createElement("canvas"); c.width = 1000; c.height = 660;
    c.id = "art-check"; c.style = "position:fixed;inset:0;z-index:9999;width:100vw;height:100vh;background:#ecdfb0";
    document.body.append(c);
    const brush = c.getContext("2d");
    let props = 0;
    const original = brush.drawImage;
    brush.drawImage = function(image, ...args) {
      if (image.src?.endsWith("shuriken-projectile.png")) props++;
      return original.call(this, image, ...args);
    };
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const x = 70 + col * 250, y = 110 + row * 215;
      brush.fillStyle = "#705c36"; brush.fillRect(x - 40, y + 31, 180, 1);
      drawPlant(brush, "shuriken", x, y, 1, 0, { row, col });
      drawPlant(brush, "shuriken", x + 120, y, 1, 0, { row, col }, false);
      brush.fillText(`${row}:${col} held / empty`, x - 40, y + 65);
    }
    const heldCount = props;
    const isolated = document.createElement("canvas"); isolated.width = 1000; isolated.height = 500;
    const detail = isolated.getContext("2d");
    let flightCount = 0;
    const draw = detail.drawImage;
    detail.drawImage = function(image, ...args) {
      if (image.src?.endsWith("shuriken-projectile.png")) flightCount++;
      return draw.call(this, image, ...args);
    };
    const game = createGame(15, ["shuriken"]); plantAt(game, "shuriken", 2, 4);
    game.enemies.push({ id: game.nextId++, type: "barrel", row: 2, x: 800, hp: 400, age: 0, slow: 0, eating: false });
    tick(game, .01);
    drawPlant(detail, "shuriken", 450, 253, .9, game.time, plantFrame(game.plants[0], game), false);
    const emptyCount = flightCount;
    drawProjectile(detail, game.shots[0], game);
    const firstFlightCount = flightCount, frame = plantFrame(game.plants[0], game);
    const bounds = [];
    for (const [leg, x] of [["out", 450], ["out", 700], ["out", 1000], ["back", 1000], ["back", 700], ["back", 450]]) {
      detail.clearRect(0, 0, 1000, 500);
      Object.assign(game.shots[0], { leg, x, age: 1 });
      drawProjectile(detail, game.shots[0], game);
      const pixels = detail.getImageData(0, 0, 1000, 500).data;
      const box = { minX: 1000, maxX: 0, minY: 500, maxY: 0, count: 0 };
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 12) {
        const x = ((i - 3) / 4) % 1000, y = Math.floor((i - 3) / 4000);
        box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
        box.minY = Math.min(box.minY, y); box.maxY = Math.max(box.maxY, y); box.count++;
      }
      bounds.push(box);
    }
    return { heldCount, emptyCount, flightCount: firstFlightCount, frame, bounds };
  });
  expect(report.heldCount).toBe(12);
  expect(report.emptyCount).toBe(0);
  expect(report.flightCount).toBe(1);
  expect(report.frame).toEqual({ state: "fire", row: 1, col: 1 });
  for (const bounds of report.bounds) {
    expect(bounds.count).toBeGreaterThan(60);
    expect(bounds.minY).toBeGreaterThanOrEqual(200);
    expect(bounds.maxY).toBeLessThan(300);
    expect(bounds.maxX).toBeLessThan(1000);
  }
  expect(report.bounds[0].minX).toBeGreaterThan(460);
  expect(report.bounds[1].minX).toBeGreaterThan(report.bounds[0].maxX);
  expect(report.bounds[2].maxX).toBe(999);
  expect(report.bounds[5].minX).toBeLessThan(report.bounds[4].minX);
  await page.screenshot({ path: testInfo.outputPath("shuriken-hands.png") });
});

for (const name of ["shuriken", "shuriken-projectile", "sprinkler"]) {
  test(`필수 ${name} 이미지 실패는 재시도 안내를 표시`, async ({ page }) => {
    await page.route(`**/assets/sprites/${name}.png`, route => route.abort());
    await page.goto("/");
    await expect(page.locator("#offline-status")).toContainText("캐릭터 그림 준비 실패");
    await expect(page.locator("#play-button")).toHaveText("그림 다시 불러오기");
    await expect(page.locator("#play-button")).toBeEnabled();
  });
}
