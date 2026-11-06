import { test, expect } from "@playwright/test";
import { createGame, plantAt, PLANTS, ENEMIES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";

async function fixture(page, game = null) {
  if (!game) {
    game = createGame(1);
    plantAt(game, "pea", 2, 2);
    game.enemies.push({ id: game.nextId++, type: "sleepy", row: 2, x: 550, hp: ENEMIES.sleepy.hp, slow: 0, age: 0, eating: false });
  }
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data: { ...freshSave(), unlocked: game.stage, tutorialSeen: true, current: game } });
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  await page.locator("#resume-button").tap();
}

test("14종 168개 프레임의 픽셀 차이·투명 테두리·접지·모든 카드 일치", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { SPRITE_URLS, SPRITE_CELL, loadSprites } = await import("./src/sprites.js");
    const { plantIcon, drawPlant } = await import("./src/art.js");
    await loadSprites();
    const results = [];
    for (const [type, url] of Object.entries(SPRITE_URLS)) {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 224;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const frames = [];
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
        ctx.clearRect(0, 0, 320, 224);
        ctx.drawImage(img, col * 320, row * 224, 320, 224, 0, 0, 320, 224);
        const pixels = ctx.getImageData(0, 0, 320, 224).data;
        let minX = 320, minY = 224, maxX = -1, maxY = -1, translucent = 0, painted = 0;
        for (let y = 0; y < 224; y++) for (let x = 0; x < 320; x++) {
          const a = pixels[(y * 320 + x) * 4 + 3];
          if (a > 0) { painted++; if (a < 245) translucent++; }
          if (a > 32) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
        }
        const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels))].join(",");
        let strayAlpha = 0;
        for (let y = 0; y < 224; y++) for (let x = 0; x < 320; x++) {
          const a = pixels[(y * 320 + x) * 4 + 3];
          if (a <= 8 || a >= 128) continue;
          let nearArtwork = false;
          for (let dy = -3; dy <= 3 && !nearArtwork; dy++) for (let dx = -3; dx <= 3; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && xx < 320 && yy >= 0 && yy < 224 && pixels[(yy * 320 + xx) * 4 + 3] >= 128) { nearArtwork = true; break; }
          }
          if (!nearArtwork) strayAlpha++;
        }
        frames.push({ row, hash, minX, minY, maxX, maxY, translucent: translucent / painted, strayAlpha });
      }
      results.push({ type, width: img.width, height: img.height, frames });
    }
    const { PLANTS } = await import("./src/engine.js");
    const cards = Object.keys(PLANTS).map(type => {
      const iconCanvas = document.createElement("canvas");
      iconCanvas.width = iconCanvas.height = 120;
      drawPlant(iconCanvas.getContext("2d"), type, 60, 72, 1.05);
      return { sameIcon: plantIcon(type) === iconCanvas.toDataURL(), card: document.querySelector(`[data-type="${type}"] img`).src === plantIcon(type) };
    });
    return { results, anchorY: SPRITE_CELL.anchorY, cards };
  });
  expect(report.results).toHaveLength(14);
  for (const card of report.cards) {
    expect(card.sameIcon).toBe(true);
    expect(card.card).toBe(true);
  }
  for (const sheet of report.results) {
    expect([sheet.width, sheet.height]).toEqual([1280, 672]);
    expect(new Set(sheet.frames.map(f => f.hash)).size).toBe(12);
    for (const frame of sheet.frames) {
      expect(frame.minX).toBeGreaterThan(2); expect(frame.minY).toBeGreaterThan(2);
      expect(frame.maxX).toBeLessThan(317);
      expect(Math.abs(frame.maxY + 1 - report.anchorY)).toBeLessThanOrEqual(1);
      // Explosion light and scattered leaves have intentionally more soft edge pixels.
      if (sheet.type === "bomb" && frame.row === 2) expect(frame.strayAlpha).toBe(0);
      else expect(frame.translucent).toBeLessThan(.2);
    }
  }
});

async function recordDraws(page) {
  await page.addInitScript(() => {
    window.spriteDraws = [];
    const seen = new Set();
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      if (this.canvas.id === "game-art" && image.src?.includes("/assets/sprites/")) {
        const type = new URL(image.src).pathname.split("/").pop().replace(".png", "");
        const key = `${type}:${args[1]}:${args[0]}`;
        if (!seen.has(key)) {
          window.spriteDraws.push({ type, row: args[1] / 224, col: args[0] / 320 });
          seen.add(key);
        }
      }
      return draw.call(this, image, ...args);
    };
  });
}
test("실제 게임의 프레임 재생·일시 정지·복귀·저장 및 오프라인 복원", async ({ page, context, browserName }) => {
  await recordDraws(page);
  await fixture(page);
  await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
  await expect.poll(() => page.evaluate(() => new Set(window.spriteDraws.filter(d => d.type === "sleepy").map(d => d.col)).size)).toBe(4);
  await expect.poll(() => page.evaluate(() => window.spriteDraws.some(d => d.type === "pea" && d.row === 1 && d.col === 2))).toBe(true);
  await page.locator("#pause-button").tap();
  const stopped = await page.locator("#game-art").evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(500);
  expect(await page.locator("#game-art").evaluate(canvas => canvas.toDataURL())).toBe(stopped);
  await page.getByRole("button", { name: "계속하기", exact: true }).tap();
  await expect.poll(() => page.locator("#game-art").evaluate(canvas => canvas.toDataURL())).not.toBe(stopped);
  await page.setViewportSize({ width: 390, height: 844 });
  const portrait = await page.locator("#game-art").evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator("#game-art").evaluate(canvas => canvas.toDataURL())).not.toBe(portrait);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#pause-button").tap();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(saved.current.plants[0].shotAt).toBeGreaterThan(0);
  if (browserName === "chromium") await context.setOffline(true);
  await page.reload(); await page.locator("#resume-button").tap();
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  await expect(page.locator("#game")).toBeVisible();
  await page.locator("#pause-button").tap();
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(restored.current.time - saved.current.time).toBeLessThan(1.6);
  expect(restored.current.plants[0].type).toBe("pea");
});

test("실제 전투 Canvas가 피격·공격·쓰러짐의 모든 프레임을 사용", async ({ page }) => {
  await recordDraws(page);
  const game = createGame(1);
  game.plants.push({ id: game.nextId++, type: "pea", row: 0, col: 2, hp: 120, timer: 1.5, age: 0 });
  game.plants.push({ id: game.nextId++, type: "pea", row: 2, col: 2, hp: 120, timer: .2, age: 0 });
  for (const [row, x, hp] of [[0, 285, 110], [2, 390, 18], [4, 850, 110]]) {
    game.enemies.push({ id: game.nextId++, type: "sleepy", row, x, hp, slow: 0, age: 0, eating: false });
  }
  await fixture(page, game);
  await expect.poll(() => page.evaluate(() => new Set(window.spriteDraws.filter(d => d.type === "pea" && d.row === 2).map(d => d.col)).size)).toBe(4);
  await expect.poll(() => page.evaluate(() => new Set(window.spriteDraws.filter(d => d.type === "sleepy" && d.row === 1).map(d => d.col)).size)).toBe(4);
  await expect.poll(() => page.evaluate(() => new Set(window.spriteDraws.filter(d => d.type === "sleepy" && d.row === 2).map(d => d.col)).size)).toBe(4);
  await page.locator("#pause-button").tap();
  const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(data.current.stats.defeated).toBe(1);
  expect(data.current.enemies.some(enemy => enemy.row === 2)).toBe(false);
  expect(data.current.enemies.some(enemy => enemy.row === 0 && enemy.eating)).toBe(true);
});

test("그림 누락은 구형 도형으로 숨기지 않고 실패 안내와 재시도 제공", async ({ page }) => {
  await page.route("**/assets/sprites/umbrella.png", route => route.abort());
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#offline-status")).toContainText("캐릭터 그림 준비 실패");
  await expect(page.getByRole("button", { name: "그림 다시 불러오기" })).toBeVisible();
  await expect(page.locator("#resume-button")).not.toBeVisible();
  expect(errors.some(message => message.includes("프레임 그림"))).toBe(true);
  await page.unroute("**/assets/sprites/umbrella.png");
  await page.getByRole("button", { name: "그림 다시 불러오기" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
});

test("실제 전투에서 나머지 7종의 생성·방어·균열·발사·폭발·이동·공격·사망 연결", async ({ page }) => {
  await recordDraws(page);
  const game = createGame(5);
  for (const [type, row, col, hp, timer] of [
    ["sun", 0, 1, 100, .2], ["pea", 1, 1, 120, 1.6], ["wall", 2, 1, 650, 0],
    ["wall", 2, 0, 200, 0], ["frost", 3, 1, 100, .2], ["bomb", 4, 5, 150, .2],
  ]) game.plants.push({ id: game.nextId++, type, row, col, hp, timer, age: 0 });
  for (const [row, type] of Object.keys(ENEMIES).entries()) {
    for (const [lane, x] of [[row, 185], [4, 620]]) {
      game.enemies.push({ id: game.nextId++, type, row: lane, x, hp: ENEMIES[type].hp, slow: 0, age: 0, eating: false });
    }
  }
  await fixture(page, game);
  const needed = [
    ...["sun", "frost", "wall"].flatMap(type => [1, 2].map(row => ({ type, row }))),
    ...[0, 1, 2].map(row => ({ type: "bomb", row })),
    ...Object.keys(ENEMIES).flatMap(type => [0, 1, 2].map(row => ({ type, row }))),
  ];
  await expect.poll(() => page.evaluate(needed => needed.filter(({ type, row }) =>
    new Set(window.spriteDraws.filter(d => d.type === type && d.row === row).map(d => d.col)).size !== 4
  ), needed)).toEqual([]);
  await expect(page.locator(".sun-drop")).toHaveCount(1);
  await page.locator("#pause-button").tap();
  const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(data.current.stats.defeated).toBe(4);
  expect(data.current.plants.some(p => p.type === "bomb")).toBe(false);
  expect(data.current.plants.find(p => p.type === "sun").producedAt).toBeGreaterThan(0);
  expect(data.current.plants.find(p => p.type === "frost").shotAt).toBeGreaterThan(0);
  expect(data.current.plants.find(p => p.type === "wall" && p.col === 1).hp).toBeLessThan(PLANTS.wall.hp);
});

test("완두콩과 얼음 결정은 서로 다른 색·형태이며 렌더링이 발사체를 수정하지 않음", async ({ page }) => {
  await page.goto("/");
  const report = await page.evaluate(async () => {
    const { drawProjectile } = await import("./src/art.js");
    const frames = [];
    for (const frost of [false, true]) {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 100;
      const c = canvas.getContext("2d", { willReadFrequently: true });
      const shot = { row: 0, x: 40, frost, damage: frost ? 15 : 18 };
      const before = JSON.stringify(shot);
      drawProjectile(c, shot);
      const pixels = c.getImageData(0, 0, 100, 100).data;
      let green = 0, blue = 0, painted = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b, a] = pixels.slice(i, i + 4);
        if (a < 128) continue;
        painted++;
        if (g > r && g > b * 1.3) green++;
        if (b > r && b > g) blue++;
      }
      frames.push({ green, blue, painted, unchanged: before === JSON.stringify(shot), image: canvas.toDataURL() });
    }
    return frames;
  });
  expect(report[0].green).toBeGreaterThan(70);
  expect(report[1].blue).toBeGreaterThan(70);
  for (const frame of report) { expect(frame.painted).toBeGreaterThan(150); expect(frame.unchanged).toBe(true); }
  expect(report[0].image).not.toBe(report[1].image);
});
