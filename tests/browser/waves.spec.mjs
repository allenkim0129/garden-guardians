import { test, expect } from "@playwright/test";
import { createGame, scheduleFor, waveProgress } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { confirmTeam } from "../helpers/browser.mjs";
import { isolatedServer } from "../helpers/server.mjs";

async function seed(page, game, extra = {}, url = "/") {
  const data = { ...freshSave(), unlocked: 10, tutorialSeen: true, current: game, ...extra };
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText(/오프라인 준비 완료|Offline ready/);
  return data;
}
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);

test("시간표 진행 바·중간/최종 표시·정지·저장 복구는 새 판과 이전 판에 일치", async ({ page }) => {
  for (const version of [3, 4, 5, 6]) {
    const game = createGame(10, ["sun", "pea"]); game.pacingVersion = version;
    const plan = scheduleFor(10, version);
    game.time = plan.find(spawn => spawn.wave === 2).at;
    game.nextSpawn = plan.filter(spawn => spawn.at <= game.time).length;
    game.wave = 2;
    await seed(page, game);
    await page.locator("#resume-button").tap();
    await expect(page.locator("#wave-marker-2")).toHaveClass(/reached/);
    await expect(page.locator("#wave-marker-3")).not.toHaveClass(/reached/);
    await expect(page.locator("#wave-status")).toHaveText("2 / 3번째 무리");
    const percent = Number(await page.locator("#wave-track").getAttribute("aria-valuenow"));
    expect(percent).toBeCloseTo(Math.round(waveProgress(game).percent), 0);
    await page.locator("#pause-button").tap();
    const width = await page.locator("#wave-fill").evaluate(node => node.style.width);
    await page.waitForTimeout(300);
    expect(await page.locator("#wave-fill").evaluate(node => node.style.width)).toBe(width);
    await page.reload(); await page.locator("#resume-button").tap();
    expect(Number(await page.locator("#wave-track").getAttribute("aria-valuenow")) - percent).toBeLessThan(2);
    expect((await stored(page)).current.pacingVersion).toBe(version);
  }
});

test("등장 완료와 처치 완료를 구분하고 영어 진행 문구도 갱신", async ({ page }) => {
  const game = createGame(1, ["sun", "pea"]);
  const plan = scheduleFor(1);
  game.time = plan.at(-1).at; game.nextSpawn = plan.length; game.wave = 3;
  game.enemies.push({ id: game.nextId++, type: "sleepy", row: 2, x: 700, hp: 110, age: 0, slow: 0, eating: false });
  await seed(page, game, { language: "en" });
  await page.locator("#resume-button").tap();
  await expect(page.locator("#wave-track")).toHaveAttribute("aria-valuenow", "100");
  await expect(page.locator("#wave-track")).toHaveAttribute("aria-valuetext", "Spawning 100% · Zombies left: 1");
  await expect(page.locator("#wave-status")).toHaveText("All spawned · Stop the remaining zombies!");
  await expect(page.locator("#modal")).not.toBeVisible();
  await page.locator("#game [data-language]").tap();
  await expect(page.locator("#wave-remaining")).toHaveText("남은 좀비 1명");
  game.enemies = [];
  await seed(page, game);
  await page.locator("#resume-button").tap();
  await expect(page.locator("#wave-status")).toHaveText("정원을 지켰어요!");
  await expect(page.locator("#wave-remaining")).toHaveText("남은 좀비 0명");
});

for (const stage of [1, 19, 22]) {
  test(`${stage}단계 정비 표시는 양언어·정지·백그라운드·회전·오프라인 복구 뒤 최종 무리로 연결`, async ({ page }, testInfo) => {
    const server = await isolatedServer();
    try {
      const game = createGame(stage, ["sun", "pea"]);
      const plan = scheduleFor(stage), finalIndex = plan.findIndex(spawn => spawn.wave === 3);
      game.time = plan[finalIndex].at - 5; game.nextSpawn = finalIndex; game.wave = 2;
      await page.setViewportSize({ width: 568, height: 320 });
      await seed(page, game, { unlocked: stage }, server.url);
      await page.locator("#resume-button").tap();
      await expect(page.locator("#wave-status")).toHaveText(/정비 시간 · [1-5]초/);
      await expect(page.locator("#wave-label")).toHaveText(/정비 시간/);
      await expect(page.locator("#wave-track")).toHaveAttribute("aria-valuetext", /정비 시간/);
      await expect(page.locator("#wave-marker-3")).not.toHaveClass(/reached/);
      await page.locator("#game [data-language]").tap();
      await expect(page.locator("#wave-status")).toHaveText(/Regroup · [1-5]s/);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.locator("#modal")).toBeVisible();
      const before = await stored(page);
      const label = await page.locator("#wave-status").textContent();
      await page.waitForTimeout(500);
      expect(await page.locator("#wave-status").textContent()).toBe(label);
      expect(before.current.nextSpawn).toBe(finalIndex);
      for (const [width, height] of [[568, 320], [320, 568]]) {
        await page.setViewportSize({ width, height });
        for (const selector of ["#wave-status", "#wave-label"]) {
          const bounds = await page.locator(selector).boundingBox();
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.y).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + .1);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + .1);
        }
      }
      await page.evaluate(() => { delete document.hidden; });
      await server.stop();
      await page.reload();
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      expect(await stored(page)).toEqual(before);
      await page.locator("#resume-button").tap();
      await expect(page.locator("#wave-status")).toContainText("Regroup");
      await page.locator("#pause-button").tap();
      const restored = await stored(page);
      expect(restored.current.nextSpawn).toBe(finalIndex);
      expect(restored.current.pacingVersion).toBe(6);
      expect(restored.current.time - before.current.time).toBeLessThan(1);
      await page.screenshot({ path: testInfo.outputPath("regroup-paused.png") });
      await page.getByRole("button", { name: "Continue", exact: true }).tap();
      await expect(page.locator("#wave-status")).toHaveText("Wave 3 / 3", { timeout: 8000 });
      await expect(page.locator("#wave-marker-3")).toHaveClass(/reached/);
      await page.locator("#pause-button").tap();
      expect((await stored(page)).current.nextSpawn).toBeGreaterThan(finalIndex);
    } finally { await server.stop(); }
  });
}

test("완료 정원 다시하기는 확인 후 판만 초기화하고 별·해금·설정을 보존", async ({ page }) => {
  const game = createGame(7, ["sun", "pea"]); game.time = 10; game.sun = 75;
  const before = await seed(page, game, { stars: [3, 2, 1, 3, 3, 2, ...freshSave().stars.slice(6)], language: "en", sound: true });
  await expect(page.locator("#play-button")).toContainText("Choose / replay");
  await page.locator("#play-button").tap();
  await expect(page.locator(".stage-button").first().locator(".stage-replay")).toHaveText("Replay");
  await page.locator(".stage-button").first().tap();
  await page.getByRole("button", { name: "Back", exact: true }).tap();
  expect((await stored(page)).current).toEqual(before.current);
  await page.locator(".stage-button").first().tap();
  await page.getByRole("button", { name: "Start new", exact: true }).tap();
  expect((await stored(page)).current).toEqual(before.current);
  await confirmTeam(page);
  const after = await stored(page);
  for (const key of ["stars", "unlocked", "language", "sound", "tutorialSeen"]) expect(after[key]).toEqual(before[key]);
  expect(after.current.stage).toBe(1);
  expect(after.current.time).toBeLessThan(1);
  expect(after.current.sun).toBe(250);
  expect(after.current.nextSpawn).toBe(0);
  expect(after.current.pacingVersion).toBe(6);
});

test("진행 바와 모든 조작은 작은 가로·회전 화면·태블릿 안에 표시", async ({ page }, testInfo) => {
  await seed(page, createGame(10, ["sun", "pea", "wall", "frost", "bomb", "twin"]));
  await page.locator("#resume-button").tap();
  for (const [width, height] of [[568, 320], [667, 320], [844, 390], [320, 568], [390, 844], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    for (const card of await page.locator(".seed-card:visible").all()) {
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(43.99); expect(box.height).toBeGreaterThanOrEqual(43.99);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    for (const selector of [".plot", ".game-header button", ".wave-progress", ".wave-marker"]) {
      const bounds = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
      }));
      for (const box of bounds) {
        expect(box.x).toBeGreaterThanOrEqual(-.1); expect(box.y).toBeGreaterThanOrEqual(-.1);
        expect(box.x + box.width).toBeLessThanOrEqual(width + .1);
        expect(box.y + box.height).toBeLessThanOrEqual(height + .1);
        if (!selector.startsWith(".wave")) {
          expect(box.width).toBeGreaterThanOrEqual(44 - .01); expect(box.height).toBeGreaterThanOrEqual(44 - .01);
        }
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`waves-${width}-${height}.png`) });
  }
});
