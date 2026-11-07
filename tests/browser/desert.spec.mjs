import { test, expect } from "@playwright/test";
import { createGame, plantAt, tick, snapshot, STAGES, enemyHealth, enemyMaxHp } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { confirmTeam, selectStage } from "../helpers/browser.mjs";
import { isolatedServer } from "../helpers/server.mjs";

const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function seed(page, data, url = "/") {
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText(/오프라인 준비 완료|Offline ready/);
}
function enemy(game, type, row, x) {
  const maxHp = enemyHealth(type, game.stage, game.pacingVersion);
  game.enemies.push({ id: game.nextId++, type, row, x, hp: maxHp, maxHp, slow: 0, age: 0, eating: false });
}

test("선인장 세 개 저장에서 양언어로 네 번째 배치·16초 대기·삽·복구", async ({ page }, testInfo) => {
  for (const language of ["ko", "en"]) {
    await page.setViewportSize(language === "ko" ? { width: 568, height: 320 } : { width: 320, height: 568 });
    const game = createGame(28, ["cactus"]);
    game.rulesVersion = 7; game.pacingVersion = 6; game.sun = 1200;
    for (let row = 0; row < 3; row++) game.plants.push({
      id: game.nextId++, type: "cactus", row, col: 0, hp: 160, timer: 6, age: 0,
    });
    await seed(page, { ...freshSave(), unlocked: 28, tutorialSeen: true, language, current: game });
    await page.locator("#resume-button").tap();
    const card = page.locator('.seed-card[data-type="cactus"]');
    await expect(card).toHaveAttribute("aria-disabled", "false");
    await expect(card).toHaveAttribute("aria-label", language === "ko" ? /16초.*설치 개수 제한은 없어요/ : /16s.*No planting count limit/);
    await expect(card.locator(".plant-limit")).toHaveCount(0);
    const box = await card.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#sun-count")).toHaveText("1200");
    await page.locator('.plot[data-row="3"][data-col="0"]').tap();
    await expect(card.locator(".cooldown")).toHaveText(language === "ko" ? "16초" : "16s");
    await expect(page.locator("#sun-count")).toHaveText("800");
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await expect(card).toHaveAttribute("aria-disabled", "false");
    await page.locator("#shovel-button").tap();
    await page.locator('.plot[data-row="0"][data-col="0"]').tap();
    await expect(page.locator("#sun-count")).toHaveText("1000");
    await card.tap();
    await page.locator('.plot[data-row="4"][data-col="0"]').tap();
    await expect(page.locator("#sun-count")).toHaveText("1000");
    await page.locator("#pause-button").tap();
    const after = await stored(page);
    expect(after.current.plants.map(p => p.row)).toEqual([1, 2, 3]);
    expect(after.current.plants[2].id).toBeGreaterThan(3);
    expect(after.current.sun).toBe(1000);
    expect(after.current.cooldowns.cactus).toBeGreaterThan(12);
    expect(after.current.cooldowns.cactus).toBeLessThanOrEqual(16);
    expect(after.current.rulesVersion).toBe(9);
    await page.reload();
    expect(await stored(page)).toEqual(after);
    await page.locator("#resume-button").tap();
    await expect(card).toHaveAttribute("aria-disabled", "false");
    await page.screenshot({ path: testInfo.outputPath(`cactus-unlimited-${language}.png`) });
  }
});

test("테마 탭은 10단계씩 표시·키보드·언어·44px·회전·탐색 중 저장 불변", async ({ page }, testInfo) => {
  const data = { ...freshSave(), unlocked: 30, tutorialSeen: true, language: "en" };
  await seed(page, data);
  await page.locator("#play-button").tap();
  for (const [width, height] of [[568, 320], [320, 568], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("tab")).toHaveCount(3);
    for (const theme of ["garden", "moon", "desert"]) {
      const tab = page.locator(`.theme-tab[data-theme="${theme}"]`);
      await tab.tap();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel")).toHaveCount(1);
      await expect(page.locator(".stage-button:visible")).toHaveCount(10);
      await expect(page.getByRole("tabpanel")).toHaveAttribute("data-theme", theme);
      const bounds = await tab.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + .1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + .1);
    }
    await page.screenshot({ path: testInfo.outputPath(`desert-tabs-${width}.png`) });
  }
  const last = page.locator('.theme-tab[data-theme="desert"]');
  await last.press("Home");
  await expect(page.locator('.theme-tab[data-theme="garden"]')).toBeFocused();
  await page.locator('.theme-tab[data-theme="garden"]').press("ArrowLeft");
  await expect(last).toBeFocused();
  await last.press("ArrowRight");
  await page.locator('.theme-tab[data-theme="garden"]').press("End");
  await expect(last).toBeFocused();
  expect(await stored(page)).toEqual(data);
  await page.locator("#modal [data-language]").tap();
  await expect(last).toContainText("모래 사막");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("data-theme", "desert");
});

test("v23의 20단계 클리어만 사막21을 열고 별·언어·음량·팀 빈칸 유지", async ({ page }) => {
  for (const cleared of [false, true]) {
    const data = { ...freshSave(), stars: [...Array(19).fill(3), cleared ? 2 : 0], unlocked: 20,
      tutorialSeen: true, volume: 67, teamSlots: ["sun", null, "twin", "thorn", null, "lantern", null, null] };
    await seed(page, data);
    await page.locator("#play-button").tap();
    await page.locator('.theme-tab[data-theme="desert"]').tap();
    await expect(page.locator('.stage-button[data-stage="21"]')).toBeEnabled({ enabled: cleared });
    await expect(page.locator('.stage-button[data-stage="22"]')).toBeDisabled();
    if (!cleared) continue;
    await selectStage(page, 21);
    await expect(page.locator('.loadout-choice[data-type="pea"]')).toBeEnabled();
    await confirmTeam(page, "pea");
    await expect(page.locator("#game")).toHaveAttribute("data-theme", "desert");
    await page.locator("#pause-button").tap();
    const after = await stored(page);
    expect(after.stars).toEqual([...data.stars, ...Array(10).fill(0)]);
    expect(after.volume).toBe(67);
    expect(after.unlocked).toBe(21);
    expect(after.teamSlots).toEqual(["sun", "pea", "twin", "thorn", null, "lantern", null, null]);
    expect(after.current.loadout).toEqual(["sun", "pea", "twin", "thorn", "lantern"]);
  }
});

test("사막 배경은 모래색이고 기존 햇살·달빛 정원의 색과 진행을 바꾸지 않음", async ({ page }) => {
  const colors = [];
  for (const [stage, theme] of [[1, "garden"], [11, "moon"], [21, "desert"], [30, "desert"], [1, "garden"]]) {
    await seed(page, { ...freshSave(), unlocked: 30, tutorialSeen: true, current: createGame(stage, ["sun", "pea"]) });
    await page.locator("#resume-button").tap();
    await expect(page.locator("#game")).toHaveAttribute("data-theme", theme);
    await page.locator("#pause-button").tap();
    colors.push(await page.locator("#game-art").evaluate(canvas => Array.from(canvas.getContext("2d").getImageData(40, 40, 1, 1).data)));
    expect((await stored(page)).current.sun).toBe(STAGES[stage - 1].startSun);
    expect((await stored(page)).current.stage).toBe(stage);
  }
  expect(colors[0]).toEqual(colors[4]);
  expect(colors[2]).toEqual(colors[3]);
  expect(colors[2]).not.toEqual(colors[0]);
  expect(colors[2]).not.toEqual(colors[1]);
  expect(colors[2][0]).toBeGreaterThan(colors[2][1]);
  expect(colors[2][1]).toBeGreaterThan(colors[2][2]);
});

test("14·18·21 첫 클리어만 새 식물 획득, 재도전 중복 없음", async ({ page }) => {
  for (const [stage, type, name] of [[14, "shuriken", "표창잎"], [18, "storm", "번개가시"], [21, "cactus", "선인장"]]) {
    for (const replay of [false, true]) {
      const game = createGame(stage); game.nextSpawn = STAGES[stage - 1].count; game.time = 210;
      const stars = freshSave().stars;
      if (replay) stars[stage - 1] = 3;
      await seed(page, { ...freshSave(), stars, unlocked: stage + Number(replay), tutorialSeen: true, current: game });
      await page.locator("#resume-button").tap();
      await expect(page.locator("#modal-title")).toHaveText("정원을 지켰어요!");
      await expect(page.locator(".plant-unlocks")).toHaveCount(replay ? 0 : 1);
      if (!replay) await expect(page.locator(".plant-unlocks")).toContainText(name);
      expect((await stored(page)).unlocked).toBe(stage + 1);
      await page.getByRole("button", { name: "다음 정원", exact: true }).tap();
      await page.locator('.loadout-choice[aria-pressed="true"]').last().tap();
      await expect(page.locator(`.loadout-choice[data-type="${type}"]`)).toBeEnabled();
      await confirmTeam(page, type);
      await expect(page.locator(`.seed-card[data-type="${type}"]`)).toHaveCount(1);
    }
  }
});

for (const language of ["ko", "en"]) {
  test(`v25 해금 19·22는 기존 진행에 즉시 적용하고 이전 단계 재도전은 잠금 (${language})`, async ({ page }) => {
    for (const [type, unlock] of [["storm", 19], ["cactus", 22], ["shuriken", 15]]) {
      for (const stage of [unlock - 1, unlock]) {
        const data = { ...freshSave(), unlocked: unlock, language, tutorialSeen: true,
          teamSlots: ["sun", null, null, null, null, null, null, null] };
        await seed(page, data);
        if (type === "storm" && stage === unlock - 1) {
          await page.locator("#help-button").tap();
          await expect(page.locator(".plant-guide")).toContainText(language === "ko" ? "번개가시 · 19번째 정원 해금" : "Stormthorn · Garden 19");
          await expect(page.locator(".plant-guide")).toContainText(language === "ko" ? "선인장 · 22번째 정원 해금" : "Cactus · Garden 22");
          await expect(page.locator("#modal-body")).toContainText(language === "ko" ? "19단계의 번개가시" : "Stormthorn at stage 19");
          await expect(page.locator("#modal-body")).toContainText(language === "ko" ? "22단계의 선인장" : "Cactus at stage 22");
          await page.locator("#modal-actions .primary").tap();
        }
        await page.locator("#play-button").tap();
        await expect(page.locator(`.stage-button[data-stage="${unlock}"] .stage-reward`)).toContainText(type === "storm" ? /번개가시|Stormthorn/ : type === "cactus" ? /선인장|Cactus/ : /표창잎|Shuriken Leaf/);
        for (const oldUnlock of [25, 28]) await expect(page.locator(`.stage-button[data-stage="${oldUnlock}"] .stage-reward`)).toHaveCount(0);
        await selectStage(page, stage);
        await expect(page.locator(`.loadout-choice[data-type="${type}"]`)).toBeEnabled({ enabled: stage === unlock });
        expect(await stored(page)).toEqual(data);
        if (stage !== unlock) continue;
        await confirmTeam(page, type);
        await expect(page.locator(`.seed-card[data-type="${type}"]`)).toHaveCount(1);
        await page.locator("#pause-button").tap();
        const after = await stored(page);
        expect(after.current.loadout).toEqual(["sun", type]);
        expect(after.unlocked).toBe(unlock);
        expect(after.stars).toEqual(data.stars);
        expect(after.language).toBe(language);
      }
    }
  });
}

test("사막 새 캐릭터·장비·기존 쌍콩이 예약·연쇄 그림·소리·실제 서버 종료 후 복원", async ({ page }, testInfo) => {
  const server = await isolatedServer();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      window.drawnCharacters = [];
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        if (this.canvas.id === "game-art" && image.src?.includes("/assets/sprites/")) {
          const type = new URL(image.src).pathname.split("/").pop().replace(".png", "");
          if (!window.drawnCharacters.includes(type)) window.drawnCharacters.push(type);
        }
        return original.call(this, image, ...args);
      };
    });
    const game = createGame(28, ["sun", "cactus", "storm", "wall", "bomb", "twin", "lantern", "frost"]);
    game.sun = 1000;
    plantAt(game, "twin", 2, 0); plantAt(game, "storm", 3, 0);
    plantAt(game, "cactus", 1, 0);
    enemy(game, "barrel", 1, 850);
    enemy(game, "barrel", 2, 850); enemy(game, "courier", 3, 840); enemy(game, "barrel", 4, 850);
    tick(game, .1); tick(game, .1);
    const data = { ...freshSave(), unlocked: 28, tutorialSeen: true, language: "en", sound: true, volume: 65,
      current: snapshot(game), teamSlots: [...game.loadout] };
    await seed(page, data, server.url);
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys(), found = [];
      for (const key of keys) for (const request of await (await caches.open(key)).keys()) found.push(request.url);
      return found;
    });
    for (const type of ["storm", "cactus", "barrel", "courier", "barrel-bare", "courier-bare", "desert-gear"]) expect(cached.some(url => url.endsWith(`/${type}.png`))).toBe(true);
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    expect(await stored(page)).toEqual(data);
    await page.locator("#resume-button").tap();
    await expect(page.locator("#game")).toHaveAttribute("data-theme", "desert");
    await page.waitForTimeout(500);
    await page.locator("#pause-button").tap();
    const after = await stored(page);
    expect(after.current.shots.filter(s => s.kind === "twin").map(s => s.muzzle)).toEqual([0, 1]);
    expect(after.current.plants[0].pendingShotAt).toBeUndefined();
    expect(after.current.loadout).toEqual(data.current.loadout);
    expect(after.teamSlots).toEqual(data.teamSlots);
    expect(after.volume).toBe(65);
    expect(await page.evaluate(() => window.drawnCharacters)).toEqual(expect.arrayContaining(["twin", "storm", "cactus", "barrel", "courier"]));
    await page.getByRole("button", { name: "Continue", exact: true }).tap();
    await page.waitForTimeout(6000);
    await page.locator("#pause-button").tap();
    const battle = await stored(page);
    expect(battle.current.enemies.some(e => e.hp < enemyMaxHp(e))).toBe(true);
    expect(battle.current.enemies.find(e => e.type === "courier")).toMatchObject({ maxHp: 192, equipmentDropped: true });
    expect(battle.current.enemies.filter(e => e.row === 1)).toHaveLength(0);
    expect(battle.current.plants.find(p => p.type === "cactus").shotAt).toBeGreaterThanOrEqual(3 - 1e-8);
    await page.getByRole("button", { name: "Continue", exact: true }).tap();
    await page.screenshot({ path: testInfo.outputPath("desert-combat.png") });
    expect(errors).toEqual([]);
  } finally { await server.stop(); }
});
