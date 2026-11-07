import { test, expect } from "@playwright/test";
import { createGame, plantAt, enemyHealth, snapshot } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";

test.use({ video: "on" });

test("v31 대비 표창 가로·세로 2배, 몸체 유지, 실제 이동 360/s 실측", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { drawPlant, drawProjectile } = await import("./src/art.js");
    const { drawShuriken } = await import("./src/sprites.js");
    const { createGame, plantAt, tick } = await import("./src/engine.js");
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 500;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    const calls = [], original = c.drawImage.bind(c);
    c.drawImage = (image, ...args) => {
      calls.push({ type: image.src.split("/").at(-1), size: args.slice(-2) });
      return original(image, ...args);
    };
    const sizes = [];
    for (const [row, col] of [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 2]]) {
      calls.length = 0;
      drawPlant(c, "shuriken", 450, 253, .9, 0, { row, col });
      sizes.push([...calls]);
    }
    const game = createGame(15, ["shuriken"]); plantAt(game, "shuriken", 2, 4);
    game.enemies.push({ id: game.nextId++, type: "barrel", row: 2, x: 900, hp: 400, age: 0, slow: 0, eating: false });
    tick(game, .05);
    const firstX = game.shots[0].x;
    tick(game, .05);
    const speed = (game.shots[0].x - firstX) / .05;
    for (const [leg, x] of [["out", 450], ["out", 700], ["back", 450]]) {
      calls.length = 0;
      Object.assign(game.shots[0], { leg, x });
      drawProjectile(c, game.shots[0], game);
      sizes.push([...calls]);
    }
    const pixels = size => {
      c.clearRect(0, 0, 1000, 500);
      drawShuriken(c, 500, 250, 0, size);
      const rgba = c.getImageData(0, 0, 1000, 500).data;
      let left = 1000, right = 0, top = 500, bottom = 0;
      for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 12) {
        const x = (i - 3) / 4 % 1000, y = Math.floor((i - 3) / 4000);
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return [right - left + 1, bottom - top + 1];
    };
    return { sizes, speed, oldPixels: pixels(27 * .9), newPixels: pixels(54 * .9) };
  });
  expect(report.speed).toBeCloseTo(360, 8);
  for (const calls of report.sizes) {
    expect(calls.find(c => c.type === "shuriken-projectile.png").size).toEqual([48.6, 48.6]);
    const body = calls.find(c => c.type === "shuriken.png");
    if (body) expect(body.size).toEqual([320 * .48 * .9, 224 * .48 * .9]);
  }
  for (let axis = 0; axis < 2; axis++) {
    expect(Math.abs(report.newPixels[axis] - report.oldPixels[axis] * 2)).toBeLessThanOrEqual(2);
  }
  console.log("v32 shuriken measurements", JSON.stringify(report));
});

test("단일 표적 레이저는 실제 구슬에서 목표까지만 굵게 표시하며 렌더는 피해 없음", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { drawBoard, cactusLaserOrigin } = await import("./src/art.js");
    const { createGame, plantAt, tick } = await import("./src/engine.js");
    const game = createGame(22, ["cactus"]); game.sun = 400;
    plantAt(game, "cactus", 2, 0);
    for (const x of [600, 800]) game.enemies.push({
      id: game.nextId++, type: "barrel", row: 2, x, hp: 400, age: 0, slow: 0, eating: false,
    });
    for (let i = 0; i < 30; i++) tick(game, .1);
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 500;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    const strokes = [], stroke = c.stroke.bind(c), move = c.moveTo.bind(c), to = c.lineTo.bind(c);
    let points;
    c.moveTo = (...args) => { points = [args]; return move(...args); };
    c.lineTo = (...args) => { points?.push(args); return to(...args); };
    c.stroke = () => {
      if (["#ff3030", "#e62332", "#fff0df"].includes(c.strokeStyle)) {
        strokes.push({ color: c.strokeStyle, width: c.lineWidth, points: [...points] });
      }
      return stroke();
    };
    const before = JSON.stringify(game);
    drawBoard(c, game);
    const full = c.getImageData(0, 0, 1000, 500).data;
    const small = document.createElement("canvas"); small.width = 400; small.height = 200;
    const brush = small.getContext("2d", { willReadFrequently: true });
    brush.drawImage(canvas, 0, 0, 400, 200);
    const smallFull = brush.getImageData(0, 0, 400, 200).data;
    const noLaser = structuredClone(game); delete noLaser.plants[0].laserTargetX;
    drawBoard(c, noLaser);
    const base = c.getImageData(0, 0, 1000, 500).data;
    brush.drawImage(canvas, 0, 0, 400, 200);
    const smallBase = brush.getImageData(0, 0, 400, 200).data;
    const changed = (a, b, offset) => a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2];
    let beyond = 0, thickness = 0, smallThickness = 0;
    const end = game.plants[0].laserTargetX;
    for (let y = 0; y < 500; y++) {
      if (changed(full, base, (y * 1000 + 300) * 4)) thickness++;
      for (let x = Math.ceil(end); x < 1000; x++) if (changed(full, base, (y * 1000 + x) * 4)) beyond++;
    }
    for (let y = 0; y < 200; y++) if (changed(smallFull, smallBase, (y * 400 + 120) * 4)) smallThickness++;
    const close = createGame(22, ["cactus"]); close.sun = 400;
    plantAt(close, "cactus", 2, 0); close.plants[0].timer = 0;
    close.enemies.push({ id: close.nextId++, type: "barrel", row: 2, x: 51, hp: 400, age: 0, slow: 0, eating: false });
    tick(close, .01);
    const closeOrigin = cactusLaserOrigin(close.plants[0], close);
    const mainStrokes = [...strokes]; strokes.length = 0;
    drawBoard(c, close);
    const nearBeam = c.getImageData(0, 0, 1000, 500).data;
    delete close.plants[0].laserTargetX; drawBoard(c, close);
    const nearBase = c.getImageData(0, 0, 1000, 500).data;
    let nearPixels = 0, nearBeyond = 0;
    for (let y = 200; y < 300; y++) for (let x = 0; x < 1000; x++) {
      if (!changed(nearBeam, nearBase, (y * 1000 + x) * 4)) continue;
      nearPixels++;
      if (x < 51 || x >= Math.ceil(closeOrigin.x)) nearBeyond++;
    }
    return { strokes: mainStrokes, origin: cactusLaserOrigin(game.plants[0], game), end, beyond, thickness, smallThickness,
      nearPixels, nearBeyond,
      pure: before === JSON.stringify(game), hp: game.enemies.map(e => e.hp), defeated: game.stats.defeated };
  });
  expect(report.strokes.map(s => s.width)).toEqual([20, 13, 8, 3]);
  for (const stroke of report.strokes) {
    expect(stroke.points).toEqual([[report.origin.x, report.origin.y], [report.end, report.origin.y]]);
  }
  expect(report.beyond).toBe(0);
  // The orb sits near the lane edge, which clips the top of the 20px glow.
  expect(report.thickness).toBeGreaterThanOrEqual(16);
  expect(report.smallThickness).toBeGreaterThanOrEqual(6);
  expect(report.pure).toBe(true);
  expect(report.hp).toEqual([400]);
  expect(report.defeated).toBe(1);
  expect(report.nearPixels).toBeGreaterThan(20);
  expect(report.nearBeyond).toBe(0);
});

test.describe("v32 실제 전투 재현 fixture", () => {
  test("표창·선인장 전투와 백그라운드 정지·저장복구", async ({ page }) => {
    const game = createGame(22, ["shuriken", "cactus"]); game.sun = 1200;
    plantAt(game, "shuriken", 2, 4); plantAt(game, "cactus", 1, 0);
    for (const row of [1, 2]) for (const x of [720, 840, 960]) {
      const maxHp = enemyHealth("barrel", 22, game.pacingVersion);
      game.enemies.push({ id: game.nextId++, type: "barrel", row, x, hp: maxHp, maxHp, age: 0, slow: 0, eating: false });
    }
    const data = { ...freshSave(), unlocked: 22, tutorialSeen: true, current: snapshot(game) };
    await page.goto("/manifest.webmanifest");
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto("/");
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    await page.locator("#resume-button").tap();
    await expect(page.locator("#enemy-count")).toHaveText("막아낸 좀비 2 / 42", { timeout: 15000 });
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    const paused = await stored();
    expect(paused.current.stats.defeated).toBe(2);
    expect(paused.current.enemies.filter(e => e.row === 1)).toHaveLength(1);
    expect(paused.current.enemies.filter(e => e.row === 2).every(e => e.hp < 640)).toBe(true);
    expect(paused.current.time).toBeGreaterThanOrEqual(6 - 1e-8);
    expect(paused.current.plants[0].caughtAt).toBeGreaterThan(3);
    const image = await page.locator("#game-art").evaluate(c => c.toDataURL());
    await page.waitForTimeout(300);
    expect(await stored()).toEqual(paused);
    expect(await page.locator("#game-art").evaluate(c => c.toDataURL())).toBe(image);
    await page.evaluate(() => { delete document.hidden; });
    await page.reload();
    expect(await stored()).toEqual(paused);
    await page.locator("#resume-button").tap();
    await page.locator("#pause-button").tap();
    const restored = await stored();
    expect(restored.current.stats.defeated).toBe(2);
    expect(restored.current.plants.find(p => p.type === "cactus").laserTargetX)
      .toBe(paused.current.plants.find(p => p.type === "cactus").laserTargetX);
  });
});
