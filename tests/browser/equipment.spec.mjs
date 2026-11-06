import { test, expect } from "@playwright/test";
import { createGame } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";

test("우산 탈락 12프레임과 옷 조각: 몸 보존·정지·저장 복구", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { drawEnemy, drawDroppedGear } = await import("./src/art.js");
    const canvas = document.createElement("canvas");
    canvas.id = "gear-preview"; canvas.width = 1200; canvas.height = 600;
    canvas.style.cssText = "position:fixed;inset:0;z-index:9999;background:#c5dda0;width:100vw;height:auto";
    document.body.append(canvas);
    const c = canvas.getContext("2d");
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      for (const dropped of [false, true]) drawEnemy(c, "umbrella", 100 + col * 300 + Number(dropped) * 125,
        110 + row * 150, 1.15, 0, false, false, { row, col }, dropped);
    }
    for (const [i, type] of ["sleepy", "jelly", "roller", "umbrella"].entries()) {
      drawDroppedGear(c, { type, x: 180 + i * 270, y: 545, age: .4 });
    }
    const frames = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const sample = document.createElement("canvas"); sample.width = 320; sample.height = 224;
      const ctx = sample.getContext("2d");
      drawEnemy(ctx, "umbrella", 160, 130, 1.5, 0, false, false, { row, col });
      const before = ctx.getImageData(0, 0, 320, 224).data;
      ctx.clearRect(0, 0, 320, 224);
      drawEnemy(ctx, "umbrella", 160, 130, 1.5, 0, false, false, { row, col }, true);
      const after = ctx.getImageData(0, 0, 320, 224).data;
      let removed = 0, kept = 0, yellowBefore = 0, yellowAfter = 0;
      for (let i = 0; i < before.length; i += 4) {
        if (before[i + 3] > 128 && after[i + 3] === 0) removed++;
        if (after[i + 3] > 128) kept++;
        if (before[i] > 170 && before[i] > before[i + 1] * 1.1 && before[i + 2] < before[i + 1] * .6) yellowBefore++;
        if (after[i] > 170 && after[i] > after[i + 1] * 1.1 && after[i + 2] < after[i + 1] * .6) yellowAfter++;
      }
      frames.push({ row, col, removed, kept, yellowBefore, yellowAfter });
    }
    return frames;
  });
  await page.locator("#gear-preview").screenshot({ path: testInfo.outputPath("equipment.png") });
  for (const frame of report) {
    expect(frame.removed, JSON.stringify(frame)).toBeGreaterThan(100);
    expect(frame.kept).toBeGreaterThan(frame.removed);
    expect(frame.yellowAfter, JSON.stringify(frame)).toBeGreaterThan(frame.yellowBefore * .97);
  }
  await page.locator("#gear-preview").evaluate(node => node.remove());
  const game = createGame(5);
  game.enemies.push({ id: game.nextId++, type: "umbrella", row: 2, x: 650, hp: 100, slow: 2, age: 1, eating: false, equipmentDropped: true });
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), unlocked: 5, tutorialSeen: true, current: game },
  });
  await page.reload(); await page.locator("#resume-button").tap(); await page.locator("#pause-button").tap();
  const stopped = await page.locator("#game-art").evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator("#game-art").evaluate(canvas => canvas.toDataURL())).toBe(stopped);
  await page.reload(); await page.locator("#resume-button").tap(); await page.locator("#pause-button").tap();
  const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(data.current.enemies[0].equipmentDropped).toBe(true);
});
