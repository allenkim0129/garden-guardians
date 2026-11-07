import { test, expect } from "@playwright/test";
import { createGame, plantAt, ENEMIES, STAGES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { confirmTeam } from "../helpers/browser.mjs";
import { isolatedServer } from "../helpers/server.mjs";

async function seed(page, game, extra = {}, url = "/") {
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), unlocked: game.stage, tutorialSeen: true, current: game, ...extra },
  });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText(/오프라인 준비 완료|Offline ready/);
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);

test("v24 역할별 공격 설명은 양언어 카드에 반영되고 호박포 실제 비용은 300", async ({ page }) => {
  const game = createGame(20, ["sun", "pea", "wall", "frost", "twin", "thorn", "pumpkin", "ember"]);
  await seed(page, game, { language: "en" });
  await page.locator("#resume-button").tap();
  for (const [type, label] of [
    ["pea", /12-damage pea every 1.6s/], ["frost", /6 damage every 1.6s.*slows zombies for 3s/],
        ["twin", /two 22-damage peas/], ["pumpkin", /300.*64 splash damage.*4.5s/], ["ember", /10 damage.*4 burn damage/],
  ]) await expect(page.locator(`.seed-card[data-type="${type}"]`)).toHaveAttribute("aria-label", label);
  await page.locator('.seed-card[data-type="pumpkin"]').tap();
  await page.locator('.plot[data-row="2"][data-col="0"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("50");
  await page.locator("#pause-button").tap();
  const data = await stored(page);
  expect(data.current.plants[0].type).toBe("pumpkin");
  expect(data.current.cooldowns.pumpkin).toBeGreaterThan(0);
  await page.locator("#modal [data-language]").tap();
  await expect(page.locator('.seed-card[data-type="pumpkin"]')).toHaveAttribute("aria-label", /300.*4.5초.*64 피해/);
  await expect(page.locator('.seed-card[data-type="frost"]')).toHaveAttribute("aria-label", /6 피해와 3초 둔화/);
});

test("냉기는 모든 좀비의 몸만 파랗게 물들이고 투명도·우산 탈락·원본 복원을 보존", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { drawSprite, SPRITE_CELL } = await import("./src/sprites.js");
    const { ENEMIES, createGame, tick } = await import("./src/engine.js");
    const { drawEnemy } = await import("./src/art.js");
    const canvas = document.createElement("canvas");
    canvas.width = SPRITE_CELL.width; canvas.height = SPRITE_CELL.height;
    const c = canvas.getContext("2d", { willReadFrequently: true });
    const results = [];
    for (const type of Object.keys(ENEMIES)) for (const dropped of type === "umbrella" ? [false, true] : [false]) {
      const pixels = frozen => {
        c.clearRect(0, 0, canvas.width, canvas.height);
        const scale = 1 / SPRITE_CELL.scale;
        // Compare native alpha, independent of image/canvas downsampling filters.
        drawSprite(c, type, { row: 0, col: 1 }, SPRITE_CELL.anchorX, SPRITE_CELL.anchorY - 34 * scale, scale, dropped, frozen);
        return c.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const normal = pixels(false), frozen = pixels(true), restored = pixels(false);
      let normalBlue = 0, frozenBlue = 0, count = 0, alphaDifference = 0;
      for (let i = 0; i < normal.length; i += 4) {
        alphaDifference = Math.max(alphaDifference, Math.abs(normal[i + 3] - frozen[i + 3]));
        if (normal[i + 3] > 200) {
          normalBlue += normal[i + 2] - normal[i];
          frozenBlue += frozen[i + 2] - frozen[i];
          count++;
        }
      }
      results.push({ type, dropped, blueGain: (frozenBlue - normalBlue) / count, alphaDifference, restored: normal.every((value, i) => value === restored[i]) });
    }
    const game = createGame(1);
    const enemy = { id: game.nextId++, type: "sleepy", row: 2, x: 700, hp: 100, slow: .05, age: 0, eating: false };
    game.enemies.push(enemy);
    const rendered = () => {
      c.clearRect(0, 0, canvas.width, canvas.height);
      drawEnemy(c, enemy.type, 80, 90, 1, 0, enemy.slow > 0);
      return canvas.toDataURL();
    };
    const frozen = rendered();
    tick(game, .1);
    const thawed = rendered();
    enemy.slow = 0;
    return { results, thawed: thawed === rendered() && thawed !== frozen };
  });
  expect(report.thawed).toBe(true);
  for (const entry of report.results) {
    expect(entry.blueGain, entry.type).toBeGreaterThan(55);
    expect(entry.alphaDifference, entry.type).toBeLessThanOrEqual(1);
    expect(entry.restored, entry.type).toBe(true);
  }
});

test("9단계 첫 보상·10단계 8종 중 불꽃 선택·비용·번역", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const game = createGame(9);
  game.nextSpawn = STAGES[8].count;
  await seed(page, game);
  await page.locator("#resume-button").tap();
  await expect(page.locator(".unlock-card")).toContainText("불꽃봉오리");
  await page.locator("#modal [data-language]").tap();
  await expect(page.locator(".unlock-card")).toContainText("Emberbloom");
  await expect(page.locator(".unlock-card")).toContainText("4 burn damage");
  await page.getByRole("button", { name: "Next garden", exact: true }).tap();
  await expect(page.locator('.loadout-choice[data-type="ember"]')).toBeDisabled();
  await page.locator('.loadout-choice[data-type="thorn"]').tap();
  await page.locator('.loadout-choice[data-type="ember"]').tap();
  await expect(page.locator("#loadout-count")).toHaveText("Selected plants: 8 / 8");
  await confirmTeam(page);
  const card = page.locator('.seed-card[data-type="ember"]');
  await expect(card).toContainText("Emberbloom");
  await card.tap();
  await page.locator('.plot[data-row="2"][data-col="0"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("150");
  await expect(page.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "Row 3, column 1, Emberbloom");
  await page.locator("#game").screenshot({ path: testInfo.outputPath("ember-team.png") });
  await page.locator("#pause-button").tap();
  const data = await stored(page);
  expect(data.current.loadout).toContain("ember");
  expect(data.current.loadout).toHaveLength(8);
  expect(data.stars[8]).toBe(3);
  expect(data.unlocked).toBe(10);
  expect(data.current.cooldowns.ember).toBeGreaterThan(0);
});

test("실제 냉기·범위 화상·일시 정지와 서버 종료 후 불꽃 아트·진행 복구", async ({ page, context, browserName }, testInfo) => {
  const server = await isolatedServer("/garden-guardians/");
  try {
    const game = createGame(10, ["sun", "pea", "frost", "ember"]);
    plantAt(game, "ember", 2, 0);
    plantAt(game, "frost", 1, 0);
    for (const row of [1, 2, 3, 4]) game.enemies.push({
      id: game.nextId++, type: "jelly", row, x: row === 4 ? 730 : 400, hp: ENEMIES.jelly.hp, age: 0, slow: 0, eating: false,
    });
    await seed(page, game, { language: "en", volume: 65 }, server.url);
    await page.locator("#resume-button").tap();
    await expect.poll(async () => (await stored(page)).current.enemies.filter(e => e.burn > 0).length).toBe(3);
    await page.locator("#game").screenshot({ path: testInfo.outputPath("ice-and-fire.png") });
    await page.locator("#pause-button").tap();
    const before = await stored(page);
    expect(before.current.enemies.find(e => e.row === 1).slow).toBeGreaterThan(0);
    expect(before.current.enemies.find(e => e.row === 4).hp).toBe(340);
    const frozen = await page.locator("#game-art").evaluate(canvas => canvas.toDataURL());
    await page.waitForTimeout(300);
    expect(await page.locator("#game-art").evaluate(canvas => canvas.toDataURL())).toBe(frozen);
    expect(await stored(page)).toEqual(before);
    await server.stop();
    if (browserName === "chromium") await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
    expect(await stored(page)).toEqual(before);
    await page.locator("#resume-button").tap();
    await expect(page.locator('.seed-card[data-type="ember"] img')).toBeVisible();
    await page.locator("#pause-button").tap();
    const after = await stored(page);
    expect(after.current.loadout).toEqual(before.current.loadout);
    expect(after.current.enemies.find(e => e.row === 2).hp).toBeLessThan(before.current.enemies.find(e => e.row === 2).hp);
    expect(after.volume).toBe(65);
  } finally { await server.stop(); }
});
