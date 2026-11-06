import { test, expect } from "@playwright/test";
import { createGame } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { confirmTeam } from "../helpers/browser.mjs";
import { isolatedServer } from "../helpers/server.mjs";

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function seed(page, extra = {}, url = "/") {
  const data = {
    ...freshSave(), unlocked: 10, stars: Array(10).fill(3), tutorialSeen: true,
    sound: true, volume: 65, current: createGame(10, ["sun", "pea", "ember"]), ...extra,
  };
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText(data.language === "en" ? "Offline ready" : "오프라인 준비 완료");
  return data;
}

test("작은 회전 화면의 설정 리셋: 취소·언어 전환·기록 초기화·오프라인 1단계 시작", async ({ page, context, browserName }) => {
  const server = await isolatedServer();
  try {
    await page.setViewportSize({ width: 320, height: 568 });
    const before = await seed(page, {}, server.url);
    await page.locator("#home").getByRole("button", { name: "설정", exact: true }).tap();
    await page.locator("#reset-progress").tap();
    await expect(page.locator("#modal-body")).toContainText("되돌릴 수 없어요");
    expect(await stored(page)).toEqual(before);
    await page.getByRole("button", { name: "돌아가기", exact: true }).tap();
    await expect(page.locator("#modal-title")).toHaveText("설정");
    await page.locator("#reset-progress").tap();
    await page.locator("#modal-close").tap();
    await expect(page.locator("#modal-title")).toHaveText("설정");
    expect(await stored(page)).toEqual(before);
    await page.locator("#reset-progress").tap();
    await page.locator("#modal [data-language]").tap();
    await expect(page.locator("#modal-title")).toHaveText("Start over from stage 1?");
    await expect(page.locator("#modal-body")).toContainText("Plant unlocks also start over");
    const confirm = page.getByRole("button", { name: "Reset and start over", exact: true });
    await confirm.scrollIntoViewIfNeeded();
    const box = await confirm.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await confirm.tap();
    const expected = { ...before, language: "en", unlocked: 1, stars: Array(10).fill(0), current: null };
    expect(await stored(page)).toEqual(expected);
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#resume-button")).toBeHidden();
    await expect(page.locator("#toast")).toContainText("Stages reset");
    await server.stop();
    if (browserName === "chromium") await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    expect(await stored(page)).toEqual(expected);
    await page.locator("#play-button").tap();
    await expect(page.locator(".stage-button:enabled")).toHaveCount(1);
    await expect(page.locator(".stage-button:disabled")).toHaveCount(9);
    await page.locator(".stage-button").first().tap();
    await expect(page.locator(".loadout-choice:enabled")).toHaveCount(2);
    await expect(page.locator(".loadout-choice:disabled")).toHaveCount(9);
    await confirmTeam(page);
    await expect(page.locator(".seed-card:visible")).toHaveCount(2);
    await page.locator("#pause-button").tap();
    expect((await stored(page)).current.stage).toBe(1);
    expect((await stored(page)).stars).toEqual(expected.stars);
  } finally { await server.stop(); }
});

test("게임 중 리셋 취소는 정지 상태 보존, 확정 후 이전 판이 다시 저장되지 않음", async ({ page }) => {
  await seed(page, { language: "en", sound: false, volume: 0 });
  await page.locator("#resume-button").tap();
  await page.locator("#game").getByRole("button", { name: "Settings", exact: true }).tap();
  const before = await stored(page);
  await page.locator("#reset-progress").tap();
  await page.waitForTimeout(300);
  expect(await stored(page)).toEqual(before);
  await page.keyboard.press("Escape");
  await expect(page.locator("#modal-title")).toHaveText("Settings");
  await page.getByRole("button", { name: "Done", exact: true }).tap();
  await expect(page.locator("#modal-title")).toHaveText("Paused");
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "Continue", exact: true }).tap();
  await page.waitForTimeout(150);
  await page.locator("#game [data-sound-settings]").tap();
  expect((await stored(page)).current.time).toBeGreaterThan(before.current.time);
  await page.locator("#reset-progress").tap();
  await page.getByRole("button", { name: "Reset and start over", exact: true }).tap();
  const expected = { ...before, unlocked: 1, stars: Array(10).fill(0), current: null };
  expect(await stored(page)).toEqual(expected);
  await expect(page.locator("#game")).toBeHidden();
  await page.waitForTimeout(3200);
  await page.reload();
  await expect(page.locator("#resume-button")).toBeHidden();
  expect(await stored(page)).toEqual(expected);
  await page.locator("#home [data-sound-settings]").tap();
  await expect(page.locator("#sound-volume")).toHaveValue("0");
  await expect(page.locator("#sound-toggle")).toHaveText("Turn sound on");
});

for (const inGame of [false, true]) {
  test(`${inGame ? "게임" : "홈"} 리셋 저장 실패는 알리고 메모리·기기 기록 모두 보존`, async ({ page }) => {
    await seed(page, { language: "en" });
    if (inGame) await page.locator("#resume-button").tap();
    await page.locator(`${inGame ? "#game" : "#home"} [data-sound-settings]`).tap();
    const before = await stored(page);
    await page.locator("#reset-progress").tap();
    await page.evaluate(() => {
      window.originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error("Reset write blocked"); };
    });
    await page.getByRole("button", { name: "Reset and start over", exact: true }).tap();
    await expect(page.locator("#toast")).toContainText("Could not save");
    await expect(page.locator("#modal-title")).toHaveText("Start over from stage 1?");
    expect(await stored(page)).toEqual(before);
    await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
    await page.locator("#modal-close").tap();
    await page.getByRole("button", { name: "Done", exact: true }).tap();
    if (inGame) await page.getByRole("button", { name: "Continue", exact: true }).tap();
    else await page.locator("#resume-button").tap();
    await page.locator("#pause-button").tap();
    const after = await stored(page);
    expect(after.current.stage).toBe(10);
    expect(after.current.loadout).toEqual(before.current.loadout);
    expect(after.unlocked).toBe(10);
    expect(after.stars).toEqual(before.stars);
    expect(after.volume).toBe(65);
  });
}
