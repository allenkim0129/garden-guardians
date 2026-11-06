import { test, expect } from "@playwright/test";
import { createGame } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";

const profiles = [
  { name: "portrait-notch", width: 390, height: 844, top: 59, right: 0, bottom: 34, left: 0 },
  { name: "portrait-status", width: 320, height: 568, top: 20, right: 0, bottom: 0, left: 0 },
  { name: "landscape-notch", width: 844, height: 390, top: 0, right: 0, bottom: 21, left: 59 },
  { name: "landscape-other-side", width: 844, height: 390, top: 0, right: 59, bottom: 21, left: 0 },
];

for (const profile of profiles) test(`상태 표시줄 여백·모달·44px·회전 좌표 (${profile.name})`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: profile.width, height: profile.height });
  await page.addInitScript(profile => {
    document.addEventListener("DOMContentLoaded", () => {
      for (const edge of ["top", "right", "bottom", "left"]) {
        document.documentElement.style.setProperty(`--device-${edge}`, `${profile[edge]}px`);
      }
    });
  }, profile);
  const game = createGame(10, ["sun", "pea", "wall", "frost", "bomb", "twin", "thorn", "iron"]);
  game.suns.push({ id: game.nextId++, x: 450, y: 250, value: 50, age: 0 });
  const data = { ...freshSave(), current: game, unlocked: 10, stars: Array(10).fill(3), tutorialSeen: true, language: "en", volume: 65 };
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
  await page.goto("/");
  await expect(page.locator("#offline-status")).toContainText("Offline ready");
  const portrait = profile.height > profile.width;
  const minX = profile.left + (portrait ? 0 : Math.min(24, profile.left));
  const minY = profile.top + (portrait ? Math.min(24, profile.top) : 0);
  async function inside(selector, touch = false) {
    const boxes = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }));
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.x, selector).toBeGreaterThanOrEqual(minX - .1);
      expect(box.y, selector).toBeGreaterThanOrEqual(minY - .1);
      expect(box.right, selector).toBeLessThanOrEqual(profile.width - profile.right + .1);
      expect(box.bottom, selector).toBeLessThanOrEqual(profile.height - profile.bottom + .1);
      if (touch) {
        expect(box.width, selector).toBeGreaterThanOrEqual(43.99);
        expect(box.height, selector).toBeGreaterThanOrEqual(43.99);
      }
    }
  }
  await inside(".home-header, .hero, .home-footer");
  await page.locator("#home [data-language]").tap();
  await inside(".home-header, .hero, .home-footer");
  await page.locator("#home [data-language]").tap();
  await page.screenshot({ path: testInfo.outputPath("safe-home.png") });
  await page.locator("#home [data-sound-settings]").tap();
  await inside("#modal");
  await page.getByLabel("Effects volume").fill("65");
  await inside("#sound-volume", true);
  await page.getByRole("button", { name: "Done", exact: true }).tap();
  await page.locator("#resume-button").tap();
  await inside(".plot, .game-header button", true);
  await inside(".wave-progress");
  for (const card of await page.locator(".seed-card:visible").all()) {
    await card.scrollIntoViewIfNeeded();
    const r = await card.boundingBox();
    expect(r.width).toBeGreaterThanOrEqual(44); expect(r.height).toBeGreaterThanOrEqual(44);
    expect(r.x).toBeGreaterThanOrEqual(minX); expect(r.y).toBeGreaterThanOrEqual(minY);
    expect(r.x + r.width).toBeLessThanOrEqual(profile.width - profile.right);
    expect(r.y + r.height).toBeLessThanOrEqual(profile.height - profile.bottom);
  }
  await page.locator("#pause-button").tap();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Restart", exact: true }).tap();
  await inside("#modal");
  await page.locator(".loadout-slots").scrollIntoViewIfNeeded();
  await inside(".loadout-slot", true);
  await page.locator("#modal").screenshot({ path: testInfo.outputPath("safe-loadout.png") });
  await page.locator("#modal-close").tap();
  await page.getByRole("button", { name: "Continue", exact: true }).tap();
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator('.plot[data-row="0"][data-col="0"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("225");
  await page.getByRole("button", { name: "Collect 50 sunlight", exact: true }).tap();
  await expect(page.locator("#sun-count")).toHaveText("275");
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator('.plot[data-row="0"][data-col="0"]').tap();
  await inside("#toast");
  expect(await page.evaluate(() => [scrollX, scrollY])).toEqual([0, 0]);
  await page.screenshot({ path: testInfo.outputPath("safe-game.png") });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(saved.stars).toEqual(data.stars);
  expect(saved.unlocked).toBe(10);
  expect(saved.language).toBe("en");
  expect(saved.volume).toBe(65);
});
