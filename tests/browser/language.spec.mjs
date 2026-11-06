import { test, expect } from "@playwright/test";
import { confirmTeam } from "../helpers/browser.mjs";
import { createGame, plantAt, STAGES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";

async function englishReady(page) {
  await page.goto("/");
  await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
  await page.locator("#home [data-language]").tap();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}
async function noKoreanUI(page) {
  const remaining = await page.evaluate(() => {
    const result = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const parent = n.parentElement;
      if (parent.closest("script,style,[data-language],noscript") || !parent.checkVisibility()) continue;
      if (/[가-힣]/.test(n.textContent)) result.push(n.textContent.trim());
    }
    for (const node of document.querySelectorAll("[aria-label], [alt]")) {
      if (node.hasAttribute("data-language") || !node.checkVisibility()) continue;
      for (const attribute of ["aria-label", "alt"]) {
        if (/[가-힣]/.test(node.getAttribute(attribute) ?? "")) result.push(node.getAttribute(attribute));
      }
    }
    return [...new Set(result)];
  });
  expect(remaining).toEqual([]);
}
async function fixture(page, game, extra = {}) {
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), language: "en", tutorialSeen: true, unlocked: game.stage, current: game, ...extra },
  });
  await page.goto("/");
  await page.locator("#resume-button").tap();
}

test("언어 전환은 메뉴·도움말·설치·모달을 번역하고 새로고침 후 유지", async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await englishReady(page);
  await expect(page).toHaveTitle("Garden Guardians");
  await noKoreanUI(page);
  await page.locator("#help-button").tap();
  await page.locator("details summary").tap();
  await noKoreanUI(page);
  await page.locator("#modal [data-language]").tap();
  await expect(page.locator("#modal-title")).toHaveText("정원 수비대 놀이 안내");
  await page.locator("#modal [data-language]").tap();
  await expect(page.locator("#modal-title")).toHaveText("How to play Garden Guardians");
  await page.locator("#modal-close").tap();
  await page.locator("#install-button").tap();
  await noKoreanUI(page);
  await page.locator("#modal-close").tap();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("#play-button").tap();
  await noKoreanUI(page);
  await page.locator(".stage-button").first().tap();
  await noKoreanUI(page);
  await page.getByRole("button", { name: "Got it, let's go!" }).tap();
  await noKoreanUI(page);
  await confirmTeam(page);
  await noKoreanUI(page);
});

test("진행 중 언어 전환은 판·선택·자원을 유지하고 정지·저장 오류도 번역", async ({ page }) => {
  const game = createGame(4);
  plantAt(game, "sun", 2, 1);
  await fixture(page, game);
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator("#game [data-language]").tap();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator('.seed-card[data-type="pea"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#game [data-language]").tap();
  await page.locator("#pause-button").tap();
  await noKoreanUI(page);
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  await page.locator("#modal [data-language]").tap();
  await page.locator("#modal [data-language]").tap();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(after.current).toEqual(before.current);
  expect(after.language).toBe("en");
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); }; });
  await page.locator("#modal [data-language]").tap();
  await page.locator("#modal [data-language]").tap();
  await expect(page.locator("#toast")).toContainText("Could not save");
  await noKoreanUI(page);
});

test("영어 획득·승패·잠금·HUD는 작은 가로 화면에서 번역되고 조작 가능", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 568, height: 320 });
  for (const stage of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const game = createGame(stage);
    game.nextSpawn = STAGES[stage - 1].count;
    await fixture(page, game);
    await expect(page.locator(".unlock-card")).toBeVisible();
    await noKoreanUI(page);
    for (const selector of [".unlock-card img", ".unlock-card p", ".unlock-card span", "#modal-actions .primary"]) {
      const node = page.locator(selector);
      await node.scrollIntoViewIfNeeded();
      expect(await node.evaluate(n => {
        const r = n.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.bottom - 1);
        return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && (top === n || n.contains(top));
      })).toBe(true);
    }
    await page.getByRole("button", { name: "Next garden", exact: true }).tap();
    await noKoreanUI(page);
    for (const card of await page.locator(".seed-card").all()) {
      expect(await card.locator("strong").evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
      expect(await card.locator(".cost").evaluate(n => n.getBoundingClientRect().bottom <= n.closest("button").getBoundingClientRect().bottom - 1)).toBe(true);
    }
  }
  const lost = createGame(4); lost.lives = 1;
  lost.enemies.push({ id: lost.nextId++, type: "sleepy", row: 0, x: -24.9, hp: 100, slow: 0, age: 0, eating: false });
  await fixture(page, lost);
  await expect(page.locator("#modal-title")).toHaveText("Let's try again!");
  await noKoreanUI(page);
});

test("영어 설정의 이미지 로딩 실패와 다시 불러오기 안내", async ({ page }) => {
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), language: "en" },
  });
  await page.route("**/assets/sprites/sun.png", route => route.abort());
  await page.goto("/");
  await expect(page.locator("#offline-status")).toContainText("Character art failed to load");
  await expect(page.locator("#play-button")).toHaveText("Retry loading art");
  await noKoreanUI(page);
});
