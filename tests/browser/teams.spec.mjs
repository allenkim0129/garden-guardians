import { test, expect } from "@playwright/test";
import { createGame, STAGES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { confirmTeam, selectStage } from "../helpers/browser.mjs";
import { isolatedServer } from "../helpers/server.mjs";

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
const slots = page => page.locator(".loadout-slot").evaluateAll(nodes => nodes.map(node => node.dataset.type ?? null));
async function seed(page, url, current = null) {
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), unlocked: 20, tutorialSeen: true, language: "en", current },
  });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText("Offline ready");
}
async function choose(page, stage) {
  await page.locator("#play-button").tap();
  await selectStage(page, stage);
  if (await page.locator("#modal-title").textContent() === "Start a new game?") await page.locator("#modal-actions .primary").tap();
  await expect(page.locator("#modal-title")).toHaveText("Choose your team");
}
async function leave(page) {
  await page.locator("#home-button").tap();
  await page.locator("#modal-actions .primary").tap();
}

for (const portrait of [false, true]) test(`팀의 빈칸 유지·앞 빈칸 채우기·확정 기억·취소·오프라인 (${portrait ? "세로" : "가로"})`, async ({ page }, testInfo) => {
  const server = await isolatedServer("/garden-guardians/");
  try {
    await page.setViewportSize(portrait ? { width: 320, height: 568 } : { width: 568, height: 320 });
    await seed(page, server.url);
    await choose(page, 10);
    const initial = ["sun", "pea", "wall", "frost", "bomb", "twin", "thorn", "pumpkin"];
    expect(await slots(page)).toEqual(initial);
    await page.locator('.loadout-slot[data-index="1"]').tap();
    await page.locator('.loadout-choice[data-type="twin"]').tap();
    expect(await slots(page)).toEqual(["sun", null, "wall", "frost", "bomb", null, "thorn", "pumpkin"]);
    await page.locator(".loadout-slots").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("team-empty-slots.png") });
    await expect(page.locator('.loadout-slot[data-index="1"]')).toHaveAttribute("aria-label", "Team slot 2: empty");
    await page.locator('.loadout-choice[data-type="ember"]').tap();
    expect((await slots(page))[1]).toBe("ember");
    await page.locator('.loadout-choice[data-type="iron"]').tap();
    expect((await slots(page))[5]).toBe("iron");
    await page.locator('.loadout-slot[data-index="2"]').tap();
    const expected = ["sun", "ember", null, "frost", "bomb", "iron", "thorn", "pumpkin"];
    await confirmTeam(page);
    expect((await stored(page)).teamSlots).toEqual(expected);
    expect((await stored(page)).current.loadout).toEqual(expected.filter(Boolean));
    await leave(page);
    await choose(page, 11);
    expect(await slots(page)).toEqual(expected);
    await page.locator('.loadout-choice[data-type="wall"]').tap();
    await page.locator("#modal-close").tap();
    expect((await stored(page)).teamSlots).toEqual(expected);
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await choose(page, 11);
    expect(await slots(page)).toEqual(expected);
    await confirmTeam(page);
    await leave(page);
    await choose(page, 2);
    expect(await slots(page)).toEqual(["sun", null, null, null, null, null]);
    await expect(page.locator('.loadout-choice[data-type="ember"]')).toBeDisabled();
    await page.locator('.loadout-choice[data-type="pea"]').tap();
    expect(await slots(page)).toEqual(["sun", "pea", null, null, null, null]);
    await confirmTeam(page);
    expect((await stored(page)).teamSlots).toEqual(["sun", "pea", null, null, null, null]);
  } finally { await server.stop(); }
});

test("기존 판의 팀은 클리어 후 기억하고 6칸에서 8칸으로 갈 때 끝에 빈칸만 추가", async ({ page }) => {
  const game = createGame(9, ["sun", "pea", "frost", "bomb"]);
  delete game.columns;
  game.nextSpawn = STAGES[8].count;
  await seed(page, "/");
  await page.evaluate(({ key, game }) => {
    const data = JSON.parse(localStorage.getItem(key)); data.current = game;
    localStorage.setItem(key, JSON.stringify(data));
  }, { key: SAVE_KEY, game });
  await page.reload();
  await page.locator("#resume-button").tap();
  await page.getByRole("button", { name: "Next garden", exact: true }).tap();
  expect(await slots(page)).toEqual(["sun", "pea", "frost", "bomb", null, null, null, null]);
  expect((await stored(page)).teamSlots).toEqual(["sun", "pea", "frost", "bomb", null, null]);
});
