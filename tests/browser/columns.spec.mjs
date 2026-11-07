import { test, expect } from "@playwright/test";
import { createGame, boardWidth } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { isolatedServer } from "../helpers/server.mjs";
import { confirmTeam } from "../helpers/browser.mjs";

for (const columns of [9, 10]) test(`${columns}칸의 마지막 칸·햇빛·44px·회전·오프라인·새 판 전환`, async ({ page }, testInfo) => {
  const server = await isolatedServer("/garden-guardians/");
  try {
    const game = createGame(10, ["sun", "pea"]);
    if (columns === 9) delete game.columns;
    game.suns.push({ id: game.nextId++, x: boardWidth(game) - 50, y: 450, value: 25, age: 0 });
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key: SAVE_KEY, data: { ...freshSave(), unlocked: 20, tutorialSeen: true, language: "en", current: game },
    });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await page.locator("#resume-button").tap();
    await expect(page.locator(".plot:visible")).toHaveCount(columns * 5);
    await expect(page.locator("#board-grid")).toHaveAttribute("aria-label", `Garden with 5 rows and ${columns} columns`);
    await expect(page.locator("#game-art")).toHaveAttribute("width", `${columns * 100}`);
    await page.locator(".sun-drop").tap();
    await expect(page.locator("#sun-count")).toHaveText("375");
    await page.locator('.seed-card[data-type="pea"]').tap();
    const last = page.locator(`.plot[data-row="4"][data-col="${columns - 1}"]`);
    await last.tap();
    await expect(last).toHaveAttribute("aria-label", `Row 5, column ${columns}, Peabud`);
    for (const [width, height] of [[568, 320], [320, 568], [844, 390], [1024, 768]]) {
      await page.setViewportSize({ width, height });
      const bounds = await page.locator(".plot:visible").evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      for (const r of bounds) {
        expect(r.width).toBeGreaterThanOrEqual(43.99); expect(r.height).toBeGreaterThanOrEqual(43.99);
        expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(width + .01);
        expect(r.y + r.height).toBeLessThanOrEqual(height + .01);
      }
      expect(await page.evaluate(() => [scrollX, scrollY, visualViewport.scale])).toEqual([0, 0, 1]);
      await page.screenshot({ path: testInfo.outputPath(`${columns}-columns-${width}-${height}.png`) });
    }
    expect(await page.locator("#game-art").evaluate(canvas => canvas.getContext("2d").getImageData(canvas.width - 5, 250, 1, 1).data[3])).toBe(255);
    await page.locator("#pause-button").tap();
    const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    await page.screenshot({ path: testInfo.outputPath(`${columns}-columns.png`) });
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(before);
    await page.locator("#resume-button").tap();
    await expect(last).toHaveAttribute("aria-label", `Row 5, column ${columns}, Peabud`);
    await page.locator("#pause-button").tap();
    await page.getByRole("button", { name: "Restart", exact: true }).tap();
    await page.locator("#modal-actions .primary").tap();
    await confirmTeam(page);
    await expect(page.locator(".plot:visible")).toHaveCount(50);
    await expect(page.locator("#game-art")).toHaveAttribute("width", "1000");
    expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).current.columns).toBe(10);
  } finally { await server.stop(); }
});
