import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGame, ENEMIES, STAGES, PLANTS } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { isolatedServer } from "../helpers/server.mjs";

async function homeReady(page, url = "/") {
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료", { timeout: 25000 });
}
async function start(page) {
  await page.locator("#play-button").tap();
  await expect(page.locator(".stage-button").first()).toContainText("기본 · 햇살봉");
  await expect(page.locator(".stage-button").first()).toContainText("기본 · 콩별이");
  await expect(page.locator(".stage-button").nth(1).locator(".stage-reward")).toHaveText("사용 · 도토리벽");
  await page.getByRole("button", { name: "1. 첫 번째 새싹, 별 0개", exact: true }).tap();
  await expect(page.locator("#modal-body")).toContainText("햇살봉 · 처음부터 사용 가능");
  await expect(page.locator("#modal-body")).toContainText("콩별이 · 처음부터 사용 가능");
  await expect(page.locator("#modal-body")).toContainText("도토리벽 · 2번째 정원 해금");
  await page.getByRole("button", { name: "알겠어요, 출발!" }).tap();
  await expect(page.locator("#game")).toBeVisible();
  await expect(page.locator('.seed-card[data-type="sun"]')).toBeEnabled();
  await expect(page.locator('.seed-card[data-type="pea"]')).toBeEnabled();
}
async function loadFixture(page, game, extra = {}) {
  const save = { ...freshSave(), tutorialSeen: true, unlocked: game.stage, current: game, ...extra };
  // Leave the app before seeding: its pagehide handler correctly saves on reload.
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: SAVE_KEY, save });
  await page.goto("/");
  await page.locator("#resume-button").tap();
}
const readStored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);

test("실제 터치: 심기, 비용, 햇빛, 삽, 정지, 재접속 복원", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await homeReady(page); await start(page);
  await page.locator('.seed-card[data-type="sun"]').tap();
  await page.locator('.plot[data-row="2"][data-col="0"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("200");
  await expect(page.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "3줄 1칸, 햇살봉");
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator('.plot[data-row="2"][data-col="1"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("75");
  await page.locator("#shovel-button").tap();
  await page.locator('.plot[data-row="2"][data-col="1"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("137");
  await page.locator(".sun-drop").first().tap({ timeout: 12000 });
  await expect(page.locator("#sun-count")).toHaveText("162");
  await page.locator("#pause-button").tap();
  const saved = await readStored(page);
  await page.waitForTimeout(500);
  await page.reload();
  await page.locator("#resume-button").tap();
  await expect(page.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "3줄 1칸, 햇살봉");
  await page.locator("#pause-button").tap();
  const restored = await readStored(page);
  expect(restored.current.time - saved.current.time).toBeLessThan(2);
  expect(restored.current.sun).toBe(saved.current.sun);
  await page.getByRole("button", { name: "다시 시작", exact: true }).tap();
  await page.getByRole("button", { name: "다시 시작", exact: true }).tap();
  await expect(page.locator("#sun-count")).toHaveText("250");
  await expect(page.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "3줄 1칸, 빈 땅");
  await expect(page.locator('.seed-card[data-type="sun"]')).toBeEnabled();
  await expect(page.locator('.seed-card[data-type="pea"]')).toBeEnabled();
  expect(errors).toEqual([]);
});

test("승리·다음 정원·패배·재도전과 최고 별 저장", async ({ page }) => {
  await homeReady(page);
  const win = createGame(1); win.nextSpawn = 8; win.time = 80;
  await loadFixture(page, win);
  await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
  await expect(page.locator("#modal-body")).toContainText("새 식물 해금: 도토리벽");
  let saved = await readStored(page);
  expect(saved.unlocked).toBe(2); expect(saved.stars[0]).toBe(3); expect(saved.current).toBeNull();
  await page.getByRole("button", { name: "다음 정원", exact: true }).tap();
  await expect(page.locator("#stage-title")).toContainText("2. 아침 산책");
  await expect(page.locator("#selection-hint")).not.toContainText("새 친구 햇살봉");
  const secondWin = createGame(2); secondWin.nextSpawn = STAGES[1].count; secondWin.time = 90;
  await loadFixture(page, secondWin, { stars: [3, ...Array(9).fill(0)] });
  await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
  await expect(page.locator("#modal-body")).toContainText("새 식물 해금: 서리초");
  await page.getByRole("button", { name: "다음 정원", exact: true }).tap();
  const lost = createGame(2); lost.lives = 1; lost.time = 80;
  lost.nextSpawn = STAGES[1].count;
  lost.enemies.push({ id: lost.nextId++, type: "roller", row: 0, x: -24.9, hp: ENEMIES.roller.hp, slow: 0, age: 20, eating: false });
  await page.locator("#pause-button").tap();
  await page.getByRole("button", { name: "저장하고 나가기" }).tap();
  await loadFixture(page, lost, { stars: [3, ...Array(9).fill(0)] });
  await expect(page.locator("#modal-title")).toHaveText("괜찮아요, 한 번 더!");
  saved = await readStored(page);
  expect(saved.current).toBeNull(); expect(saved.unlocked).toBe(2); expect(saved.stars[0]).toBe(3);
  await page.getByRole("button", { name: "다시 도전", exact: true }).tap();
  await expect(page.locator("#hearts")).toHaveAttribute("aria-label", "남은 하트 3개");
  await expect(page.locator("#stage-title")).toContainText("2. 아침 산책");
});

test("마지막 정원 완료 후 11단계 없이 재도전·정원 선택", async ({ page }) => {
  await homeReady(page);
  const game = createGame(10); game.nextSpawn = 40; game.time = 150;
  await loadFixture(page, game, { stars: [...Array(9).fill(3), 0] });
  await expect(page.locator("#modal-title")).toHaveText("모든 정원을 지켰어요!");
  expect((await readStored(page)).unlocked).toBe(10);
  await page.getByRole("button", { name: "정원 선택", exact: true }).tap();
  await expect(page.locator(".stage-button")).toHaveCount(10);
  await expect(page.locator(".stage-button:disabled")).toHaveCount(0);
});

test("세로 회전과 백그라운드 전환은 자동 정지, 명시적으로 재개", async ({ page }) => {
  await homeReady(page); await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".rotate-notice")).toBeVisible();
  const before = await readStored(page);
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#modal-title")).toHaveText("잠깐 쉬는 중");
  await page.getByRole("button", { name: "계속하기", exact: true }).tap();
  // A synthetic visibility transition exercises the actual lifecycle listener.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#modal-title")).toHaveText("잠깐 쉬는 중");
  expect((await readStored(page)).current.time - before.current.time).toBeLessThan(2);
  await page.evaluate(() => { delete document.hidden; });
  await page.getByRole("button", { name: "계속하기", exact: true }).tap();
  await expect(page.locator("#modal")).not.toBeVisible();
});

test("작은 아이폰부터 아이패드까지 터치 타깃 44px와 화면 범위", async ({ page }) => {
  await homeReady(page); await start(page);
  for (const [width, height] of [[568, 320], [667, 320], [667, 375], [844, 390], [1024, 768], [1180, 820]]) {
    await page.setViewportSize({ width, height });
    const geometry = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll(".plot, .game-header button")];
      return nodes.map(node => {
        const r = node.getBoundingClientRect();
        return { label: node.getAttribute("aria-label") ?? node.textContent, width: r.width, height: r.height, x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      });
    });
    for (const r of geometry) {
      expect(r.width, `${width}x${height}: ${r.label} 너비`).toBeGreaterThanOrEqual(44);
      expect(r.height, `${width}x${height}: ${r.label} 높이`).toBeGreaterThanOrEqual(44);
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(width + .1); expect(r.bottom).toBeLessThanOrEqual(height + .1);
    }
    for (const card of await page.locator(".seed-card").all()) {
      await card.scrollIntoViewIfNeeded();
      const bounds = await card.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    }
  }
});

test("서버 종료 후 하위 경로에서 오프라인 새로고침·새 창·저장 복원", async ({ page, context, browserName }) => {
  const server = await isolatedServer("/little-club/garden/");
  const external = [];
  page.on("request", request => { if (!request.url().startsWith(server.url) && !request.url().startsWith("data:")) external.push(request.url()); });
  try {
    await homeReady(page, server.url); await start(page);
    await page.locator('.seed-card[data-type="pea"]').tap();
    await page.locator('.plot[data-row="2"][data-col="0"]').tap();
    await page.locator("#pause-button").tap();
    await server.stop();
    // Windows WebKit's offline emulation fails before its service worker runs.
    // Stopping the source server verifies real network unavailability in both engines.
    if (browserName === "chromium") await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    await page.locator("#resume-button").tap();
    await expect(page.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "3줄 1칸, 콩별이");
    await expect(page.locator('.seed-card[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('.seed-card[data-type="sun"]')).toBeEnabled();
    await expect(page.locator('.seed-card[data-type="wall"]')).toBeDisabled();
    await page.locator('.seed-card[data-type="sun"]').tap();
    await page.locator('.plot[data-row="0"][data-col="0"]').tap();
    await expect(page.locator('.plot[data-row="0"][data-col="0"]')).toHaveAttribute("aria-label", "1줄 1칸, 햇살봉");
    await page.locator("#pause-button").tap();
    await page.locator("#modal [data-language]").tap();
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(server.url);
    await expect(reopened.locator("#offline-status")).toContainText("Offline ready");
    await expect(reopened.locator("html")).toHaveAttribute("lang", "en");
    await reopened.locator("#resume-button").tap();
    await expect(reopened.locator("#game")).toBeVisible();
    await expect(reopened.locator('.plot[data-row="0"][data-col="0"]')).toHaveAttribute("aria-label", "Row 1, column 1, Sunbell");
    expect(external).toEqual([]);
  } finally { await server.stop(); }
});

test("캐시 일부 삭제 시 준비 완료를 표시하지 않고 온라인 복구 가능", async ({ page }) => {
  await homeReady(page);
  await page.evaluate(async () => {
    const key = (await caches.keys()).find(key => key.startsWith("garden-guardians-"));
    const cache = await caches.open(key);
    await cache.delete(new URL("./icons/icon-192.png", location.href).href);
    window.dispatchEvent(new Event("online"));
  });
  await expect(page.locator("#offline-status")).toContainText("오프라인 준비 미완료");
  await page.locator("#cache-retry").tap();
  await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
});

test("손상된 저장 및 저장 차단은 알리고 게임은 실행 가능", async ({ page }) => {
  await homeReady(page);
  await page.goto("/manifest.webmanifest");
  await page.evaluate(key => localStorage.setItem(key, "{bad json"), SAVE_KEY);
  await page.goto("/");
  await expect(page.locator("#toast")).toContainText("저장을 불러오지 못했어요");
  await expect(page.locator("#resume-button")).not.toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("저장 차단 테스트"); }; });
  await start(page);
  await expect(page.locator("#toast")).toContainText("기기에 저장하지 못했어요");
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator('.plot[data-row="2"][data-col="0"]').tap();
  await expect(page.locator("#sun-count")).toHaveText("125");
});

test("효과음은 사용자 탭 뒤 켜지고 설정이 저장됨", async ({ page }) => {
  await homeReady(page);
  await page.locator("#sound-button").tap();
  await expect(page.locator("#sound-button")).toHaveAttribute("aria-pressed", "true");
  expect((await readStored(page)).sound).toBe(true);
  await page.reload();
  await expect(page.locator("#sound-button")).toHaveText("소리 켜짐");
  await page.locator("#sound-button").tap();
  expect((await readStored(page)).sound).toBe(false);
});

test("브라우저 프로세스 종료 후에도 오프라인 재실행", async ({ browserName }) => {
  test.skip(browserName === "webkit", "Windows Playwright WebKit 영구 프로필은 CacheStorage 쓰기 결과가 비어 있음. WebKit은 서버 종료 후 새로고침·새 창으로 검증하며, 프로세스 재시작은 Chromium으로 검증.");
  const server = await isolatedServer();
  const directory = await mkdtemp(path.join(tmpdir(), "garden-guardians-e2e-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(directory, { viewport: { width: 844, height: 390 }, hasTouch: true });
    let page = context.pages()[0];
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    await start(page);
    await page.locator('.seed-card[data-type="pea"]').tap();
    await page.locator('.plot[data-row="2"][data-col="0"]').tap();
    await page.locator("#pause-button").tap();
    await context.close(); context = null;
    await server.stop();
    context = await chromium.launchPersistentContext(directory, { viewport: { width: 844, height: 390 }, offline: true, hasTouch: true });
    page = context.pages()[0];
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
    await page.locator("#resume-button").tap();
    await expect(page.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "3줄 1칸, 콩별이");
  } finally {
    await context?.close();
    await server.stop();
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});

test("선택 없음·카드 재탭·배치 성공 후 해제·실패 후 선택 유지", async ({ page }) => {
  await homeReady(page); await start(page);
  const pea = page.locator('.seed-card[data-type="pea"]');
  const first = page.locator('.plot[data-row="2"][data-col="0"]');
  const second = page.locator('.plot[data-row="2"][data-col="1"]');
  await expect(page.locator('.seed-card[aria-pressed="true"]')).toHaveCount(0);
  await first.tap();
  await expect(first).toHaveAttribute("aria-label", "3줄 1칸, 빈 땅");
  await pea.tap(); await expect(pea).toHaveAttribute("aria-pressed", "true");
  await pea.tap(); await expect(pea).toHaveAttribute("aria-pressed", "false");
  await first.tap();
  await expect(page.locator("#sun-count")).toHaveText("250");
  await pea.tap(); await first.tap();
  await expect(pea).toHaveAttribute("aria-pressed", "false");
  await expect(first).toHaveAttribute("aria-label", "3줄 1칸, 콩별이");
  await second.tap();
  await expect(second).toHaveAttribute("aria-label", "3줄 2칸, 빈 땅");
  await pea.tap(); await first.tap();
  await expect(page.locator("#toast")).toContainText("이미 친구가 있어요");
  await expect(pea).toHaveAttribute("aria-pressed", "true");
  await pea.tap();
  await expect(first).toHaveAttribute("aria-label", "3줄 1칸, 콩별이");
  await page.locator("#shovel-button").tap(); await page.locator("#shovel-button").tap();
  await second.tap();
  await expect(second).toHaveAttribute("aria-label", "3줄 2칸, 빈 땅");
  await page.locator("#pause-button").tap();
  expect((await readStored(page)).current.stats.planted).toBe(1);
});

test("선택 중 햇빛 탭은 수집만 수행하고 자동 수집 중 포인터도 오배치하지 않음", async ({ page }) => {
  await homeReady(page);
  const fixture = createGame(5);
  fixture.suns.push({ id: fixture.nextId++, x: 450, y: 250, value: 25, age: 0 });
  await loadFixture(page, fixture);
  const pea = page.locator('.seed-card[data-type="pea"]');
  const plot = page.locator('.plot[data-row="2"][data-col="4"]');
  await pea.tap();
  await page.locator(".sun-drop").tap();
  await expect(page.locator("#sun-count")).toHaveText("325");
  await expect(plot).toHaveAttribute("aria-label", "3줄 5칸, 빈 땅");
  await expect(pea).toHaveAttribute("aria-pressed", "true");
  await page.locator("#pause-button").tap();
  expect((await readStored(page)).current.stats.planted).toBe(0);
  await page.getByRole("button", { name: "저장하고 나가기" }).tap();
  fixture.suns[0].age = 6;
  await loadFixture(page, fixture);
  await pea.tap();
  const sun = page.locator(".sun-drop");
  const box = await sun.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(sun).toHaveCount(0);
  await page.mouse.up();
  await expect(plot).toHaveAttribute("aria-label", "3줄 5칸, 빈 땅");
  await page.locator("#pause-button").tap();
  expect((await readStored(page)).current.stats.planted).toBe(0);
});

test("1~10 정원의 잠금·해금, 이전 정원 선택·재시작·저장 복구 일관성", async ({ page }) => {
  await homeReady(page);
  for (let stage = 1; stage <= 10; stage++) {
    await loadFixture(page, createGame(stage), { unlocked: 10 });
    for (const [type, plant] of Object.entries(PLANTS)) {
      const card = page.locator(`.seed-card[data-type="${type}"]`);
      if (stage < plant.unlockStage) {
        await expect(card).toBeDisabled();
        await expect(card).toContainText(`${plant.unlockStage}정원 해금`);
      } else await expect(card).toBeEnabled();
    }
    await expect(page.locator('.seed-card[aria-pressed="true"]')).toHaveCount(0);
    await page.locator("#pause-button").tap();
    await page.getByRole("button", { name: "저장하고 나가기" }).tap();
  }
  await page.locator("#play-button").tap();
  await page.locator(".stage-button").first().tap();
  await page.getByRole("button", { name: "새로 시작", exact: true }).tap();
  await expect(page.locator(".seed-card:disabled")).toHaveCount(8);
  await expect(page.locator('.seed-card[data-type="sun"]')).toBeEnabled();
  await expect(page.locator('.seed-card[data-type="pea"]')).toBeEnabled();
  await page.locator("#pause-button").tap();
  await page.getByRole("button", { name: "다시 시작", exact: true }).tap();
  await page.getByRole("button", { name: "다시 시작", exact: true }).tap();
  await expect(page.locator(".seed-card:disabled")).toHaveCount(8);
  await page.reload(); await page.locator("#resume-button").tap();
  await expect(page.locator(".seed-card:disabled")).toHaveCount(8);
  await page.locator('.seed-card[data-type="sun"]').tap();
  await page.locator('.plot[data-row="0"][data-col="0"]').tap();
  await page.locator('.seed-card[data-type="pea"]').tap();
  await page.locator('.plot[data-row="2"][data-col="1"]').tap();
  await expect(page.locator('.plot[data-row="0"][data-col="0"]')).toHaveAttribute("aria-label", "1줄 1칸, 햇살봉");
  await expect(page.locator('.plot[data-row="2"][data-col="1"]')).toHaveAttribute("aria-label", "3줄 2칸, 콩별이");
  await expect(page.locator('.seed-card[aria-pressed="true"]')).toHaveCount(0);
});

test("구버전 진행 중 식물은 보존하고 새 배치는 해금 규칙을 적용", async ({ page }) => {
  await homeReady(page);
  const legacy = createGame(1); delete legacy.rulesVersion;
  legacy.plants.push({ id: legacy.nextId++, type: "sun", row: 2, col: 0, hp: 100, age: 1, timer: 6 });
  legacy.plants.push({ id: legacy.nextId++, type: "wall", row: 2, col: 4, hp: 650, age: 1, timer: 0 });
  await loadFixture(page, legacy, { unlocked: 7 });
  await expect(page.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "3줄 1칸, 햇살봉");
  await expect(page.locator('.plot[data-row="2"][data-col="4"]')).toHaveAttribute("aria-label", "3줄 5칸, 도토리벽");
  await expect(page.locator('.seed-card[data-type="sun"]')).toBeEnabled();
  await expect(page.locator('.seed-card[data-type="wall"]')).toBeDisabled();
  await expect(page.locator("#toast")).toContainText("이전 저장에 있던 식물은 유지");
  await page.locator('.seed-card[data-type="sun"]').tap();
  await page.locator('.plot[data-row="1"][data-col="0"]').tap();
  await expect(page.locator('.plot[data-row="1"][data-col="0"]')).toHaveAttribute("aria-label", "2줄 1칸, 햇살봉");
  await page.locator("#pause-button").tap();
  const saved = await readStored(page);
  expect(saved.unlocked).toBe(7);
  expect(saved.current.rulesVersion).toBe(3);
  expect(saved.current.plants[0].type).toBe("sun");
});

test("새 오프라인 캐시 v10이 이전 v5를 정리하고 기본 해금과 14종 프레임 저장", async ({ page }) => {
  await page.goto("/manifest.webmanifest");
  await page.evaluate(async () => {
    const old = await caches.open("garden-guardians-%2F-v5");
    await old.put(new URL("./styles.css", location.href), new Response("/* 이전 버전 */"));
  });
  await homeReady(page);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const active = await caches.open("garden-guardians-%2F-v10");
    const sprites = await Promise.all(["pea", "sun", "wall", "frost", "bomb", "twin", "thorn", "pumpkin", "lantern", "iron", "sleepy", "jelly", "roller", "umbrella"].map(async type => {
      const response = await active.match(new URL(`./assets/sprites/${type}.png`, location.href));
      return response?.ok && (await response.blob()).size > 10000;
    }));
    return { keys, sprites, app: await (await active.match(new URL("./src/app.js", location.href))).text(),
      engine: await (await active.match(new URL("./src/engine.js", location.href))).text() };
  });
  expect(cached.keys).toContain("garden-guardians-%2F-v10");
  expect(cached.keys).not.toContain("garden-guardians-%2F-v5");
  expect(cached.sprites).toEqual(Array(14).fill(true));
  expect(cached.app).toContain("let selected = null");
  expect(cached.app).toContain("isPlantUnlocked");
  expect(cached.engine).toContain('sun: { name: "햇살봉", unlockStage: 1');
});

test("햇빛 광채는 게임 시간으로 재생·정지하고 하늘/식물 토큰 모두 수집만 수행", async ({ page }) => {
  await homeReady(page);
  const game = createGame(1); game.skyTimer = .2;
  game.plants.push({ id: game.nextId++, type: "sun", row: 2, col: 1, hp: 100, age: 0, timer: .2 });
  await loadFixture(page, game);
  await expect(page.locator(".sun-drop canvas")).toHaveCount(2);
  const token = page.locator(".sun-drop").first();
  const art = token.locator("canvas");
  const box = await token.boundingBox();
  expect(box.width).toBe(48); expect(box.height).toBe(48);
  const first = await art.evaluate(c => c.toDataURL());
  await expect.poll(() => art.evaluate(c => c.toDataURL())).not.toBe(first);
  await page.locator("#pause-button").tap();
  const paused = await art.evaluate(c => c.toDataURL());
  await page.waitForTimeout(300);
  expect(await art.evaluate(c => c.toDataURL())).toBe(paused);
  await page.getByRole("button", { name: "계속하기", exact: true }).tap();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const background = await art.evaluate(c => c.toDataURL());
  await page.waitForTimeout(300);
  expect(await art.evaluate(c => c.toDataURL())).toBe(background);
  await page.evaluate(() => { delete document.hidden; });
  await page.getByRole("button", { name: "계속하기", exact: true }).tap();
  await expect.poll(() => art.evaluate(c => c.toDataURL())).not.toBe(background);
  await page.locator('.seed-card[data-type="pea"]').tap();
  await token.tap();
  await expect(page.locator("#sun-count")).toHaveText("275");
  await page.locator(".sun-drop").tap();
  await expect(page.locator("#sun-count")).toHaveText("300");
  await page.locator("#pause-button").tap();
  const stored = await readStored(page);
  expect(stored.current.plants).toHaveLength(1);
  expect(stored.current.stats.collected).toBe(50);
});

test("최초 해금은 그림·능력·비용을 표시하고 재도전·저장 복구에는 중복 안내하지 않음", async ({ page }) => {
  await homeReady(page);
  for (const [completed, type, width, height] of [[1, "wall", 568, 320], [2, "frost", 667, 375], [3, "bomb", 844, 390]]) {
    await page.setViewportSize({ width, height });
    const game = createGame(completed); game.nextSpawn = STAGES[completed - 1].count; game.time = 100;
    await loadFixture(page, game);
    await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
    const reward = page.locator(`.unlock-card[data-type="${type}"]`);
    await reward.scrollIntoViewIfNeeded();
    await expect(reward).toContainText(PLANTS[type].name);
    await expect(reward).toContainText(PLANTS[type].description);
    await expect(reward).toContainText(`햇빛 ${PLANTS[type].cost}`);
    expect(await reward.locator("img").evaluate(img => img.complete && img.naturalWidth === 120)).toBe(true);
    expect(await reward.locator("img").getAttribute("src")).toBe(await page.locator(`.seed-card[data-type="${type}"] img`).getAttribute("src"));
    for (const selector of ["img", "p", "span"]) {
      expect(await reward.locator(selector).evaluate(node => {
        const r = node.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.bottom - 1);
        return r.top >= 0 && r.bottom <= innerHeight && (top === node || node.contains(top));
      })).toBe(true);
    }
    const next = page.getByRole("button", { name: "다음 정원", exact: true });
    await next.scrollIntoViewIfNeeded();
    const bounds = await next.boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    const earned = await readStored(page);
    expect(earned.unlocked).toBe(completed + 1);
    await next.tap();
    await expect(page.locator(`.seed-card[data-type="${type}"]`)).toBeEnabled();
    await page.reload(); await page.locator("#resume-button").tap();
    await expect(page.locator(".plant-unlocks")).toHaveCount(0);
    await expect(page.locator(`.seed-card[data-type="${type}"]`)).toBeEnabled();
    await loadFixture(page, game, { unlocked: earned.unlocked, stars: earned.stars });
    await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
    await expect(page.locator(".plant-unlocks")).toHaveCount(0);
    await expect(page.locator("#modal-body")).not.toContainText("새 식물 해금");
  }
});
