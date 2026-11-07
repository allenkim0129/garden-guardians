import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createGame, plantAt, tick, scheduleFor, ENEMIES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";

// The old shell reproduces v5/v6's register/ready policy without an update UI.
const legacyHtml = `<!doctype html><html lang="ko"><meta charset="utf-8">
<h1>구버전 화면</h1><p id="offline-status"></p><script>
navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(registration => {
  const channel = new MessageChannel();
  channel.port1.onmessage = event => {
    document.querySelector('#offline-status').textContent = event.data.ready ? '오프라인 준비 완료' : '저장 실패';
    channel.port1.close();
  };
  registration.active.postMessage({type:'CHECK_CACHE'}, [channel.port2]);
});
</script></html>`;
const legacyWorker = `
const CACHE = 'garden-guardians-%2F-v5';
const FILES = ['./', './index.html', './manifest.webmanifest'].map(p => new URL(p, self.location).href);
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith((async () => {
  const cache = await caches.open(CACHE);
  return await cache.match(e.request, {ignoreSearch:true}) ||
    (e.request.mode === 'navigate' ? await cache.match(FILES[0]) : null) || fetch(e.request);
})()));
self.addEventListener('message', e => {
  if (e.data.type !== 'CHECK_CACHE') return;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const found = await Promise.all(FILES.map(url => cache.match(url)));
    e.ports[0].postMessage({ready:found.every(Boolean), version:CACHE});
  })());
});`;

test("표창 왕복의 방향·피격 목록·발사자와 선인장 대기를 업데이트·오프라인에서 보존", async ({ page }) => {
  for (const elapsed of [.15, .5]) {
    const server = await releaseServer();
    try {
      const game = createGame(22, ["shuriken", "cactus"]); game.sun = 1000;
      plantAt(game, "shuriken", 2, 8); plantAt(game, "cactus", 0, 0);
      game.enemies.push({ id: game.nextId++, type: "barrel", row: 2, x: 900, hp: 400, age: 0, slow: 0, eating: false });
      for (let i = 0; i < Math.round(elapsed * 10); i++) tick(game, .1);
      game.effects = [];
      const data = { ...freshSave(), unlocked: 22, language: "en", tutorialSeen: true, current: game };
      await page.goto(`${server.url}manifest.webmanifest`);
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
      await page.goto(server.url);
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      await installNext(page, server);
      await page.locator("#update-button").tap();
      await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
      expect(await saved(page)).toEqual(data);
      await server.stop();
      await page.reload();
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      expect(await saved(page)).toEqual(data);
      await page.locator("#resume-button").tap();
      await page.locator("#pause-button").tap();
      const after = (await saved(page)).current;
      expect(after.shots).toHaveLength(1);
      expect(after.shots[0].plantId).toBe(game.plants[0].id);
      expect(after.shots[0].outHits).toEqual(game.shots[0].outHits);
      expect(after.shots[0].id).toBe(game.shots[0].id);
      expect(after.cooldowns.cactus).toBeLessThanOrEqual(game.cooldowns.cactus);
      expect(after.cooldowns.cactus).toBeGreaterThan(game.cooldowns.cactus - 1);
      expect([game.enemies[0].hp, game.enemies[0].hp - 36]).toContain(after.enemies[0].hp);
    } finally { await server.stop(); }
  }
});

async function releaseServer(legacy = false) {
  const files = new Map();
  for (const name of ["index.html", "styles.css", "sw.js", "manifest.webmanifest"]) {
    files.set(`/${name}`, await readFile(name));
  }
  for (const directory of ["src", "icons", path.join("assets", "sprites")]) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(js|png)$/.test(entry.name)) continue;
      const file = path.join(directory, entry.name);
      files.set(`/${file.split(path.sep).join("/")}`, await readFile(file));
    }
  }
  const current = files.get("/sw.js").toString().match(/CACHE_PREFIX\}(v\d+)/)[1];
  const next = `v${Number(current.slice(1)) + 1}`;
  let version = legacy ? "v5" : current;
  let broken = false;
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const name = pathname === "/" ? "/index.html" : pathname;
    if (broken && name === "/assets/sprites/umbrella.png") { response.writeHead(503); response.end(); return; }
    let body = files.get(name);
    if (!body) { response.writeHead(404); response.end(); return; }
    if (name === "/sw.js") body = legacy && version === "v5" ? legacyWorker :
      body.toString().replace(`CACHE_PREFIX}${current}`, `CACHE_PREFIX}${version}`);
    if (name === "/index.html") body = legacy && version === "v5" ? legacyHtml :
      body.toString().replace(`화면 ${current}`, `화면 ${version}`);
    const mime = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".png": "image/png" };
    response.writeHead(200, { "Content-Type": mime[path.extname(name)] ?? "application/json", "Cache-Control": "no-store" });
    response.end(body);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`, current, next,
    deploy: (failAsset = false) => { version = legacy ? current : next; broken = failAsset; },
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    },
  };
}
test("v31 공격 저장은 명시적 업데이트·오프라인 뒤 rules9로 한 번만 안전 이관", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(22, ["shuriken", "cactus"]); game.sun = 2000;
    plantAt(game, "shuriken", 2, 4);
    game.enemies.push({ id: game.nextId++, type: "barrel", row: 2, x: 900, hp: 400, age: 0, slow: 0, eating: false });
    tick(game, .1);
    game.rulesVersion = 7; game.pacingVersion = 6; game.shots[0].damage = 32; game.effects = [];
    for (const [row, timer] of [[0, 5], [1, 1.5], [4, 0]]) game.plants.push({
      id: game.nextId++, type: "cactus", row, col: 0, hp: 160, timer, age: 0,
    });
    game.cooldowns.cactus = 17;
    const data = { ...freshSave(), unlocked: 22, stars: freshSave().stars.fill(3), tutorialSeen: true,
      language: "en", volume: 67, teamSlots: ["shuriken", null, "cactus", null, null, null, null, null], current: game };
    const expected = structuredClone(data); expected.current.rulesVersion = 9; expected.current.plants[1].timer = 3;
    expected.current.cooldowns.cactus = 16;
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await page.locator("#resume-button").tap();
    expect(await saved(page)).toEqual(expected);
    await page.locator("#pause-button").tap();
    const paused = await saved(page);
    expect(paused.current.plants).toHaveLength(4);
    expect(paused.current.shots[0].damage).toBe(32);
    expect(paused.current.shots[0].outHits).toEqual(game.shots[0].outHits);
    expect(paused.current.cooldowns.cactus).toBeGreaterThan(15);
    expect(paused.current.cooldowns.cactus).toBeLessThanOrEqual(16);
    await page.reload();
    expect(await saved(page)).toEqual(paused);
  } finally { await server.stop(); }
});
async function seed(page, url) {
  const game = createGame(2);
  plantAt(game, "pea", 2, 0);
  const save = { ...freshSave(), unlocked: 4, stars: [3, 2, 1, ...freshSave().stars.slice(3)], tutorialSeen: true, current: game };
  await page.goto(`${url}manifest.webmanifest`);
  await page.evaluate(({ key, save }) => localStorage.setItem(key, JSON.stringify(save)), { key: SAVE_KEY, save });
  await page.goto(url);
  await expect(page.locator("#offline-status")).toContainText("오프라인 준비 완료");
  return save;
}
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function installNext(page, server) {
  server.deploy();
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
}

test("v26·v30 업데이트는 기존 시간표와 새 정비 구간의 남은 시간을 각각 보존", async ({ page }) => {
  for (const pacingVersion of [5, 6, 7]) {
    const server = await releaseServer();
    try {
      const game = createGame(22, ["sun", "cactus"]);
      game.pacingVersion = pacingVersion;
      const plan = scheduleFor(22, pacingVersion);
      game.nextSpawn = plan.findIndex(spawn => spawn.wave === 3);
      game.time = plan[game.nextSpawn - 1].at + 3; game.wave = 2;
      const data = { ...freshSave(), unlocked: 22, tutorialSeen: true, language: "en", current: game };
      await page.goto(`${server.url}manifest.webmanifest`);
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
      await page.goto(server.url);
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      await installNext(page, server);
      await page.locator("#update-button").tap();
      await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
      expect(await saved(page)).toEqual(data);
      await server.stop();
      await page.reload();
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      await page.locator("#resume-button").tap();
      await expect(page.locator("#wave-status")).toHaveText(pacingVersion >= 6 ? /Regroup · 2[67]s/ : "Wave 2 / 3");
      await page.locator("#pause-button").tap();
      const restored = await saved(page);
      expect(restored.current.nextSpawn).toBe(game.nextSpawn);
      expect(restored.current.pacingVersion).toBe(pacingVersion);
      expect(restored.current.time - game.time).toBeLessThan(1);
    } finally { await server.stop(); }
  }
});

test("v30 테마 체력과 구버전 체력은 업데이트·오프라인·재개 뒤 각각 보존", async ({ page }) => {
  for (const pacingVersion of [6, 7]) {
    const server = await releaseServer();
    try {
      const game = createGame(22, ["sun", "cactus"]);
      game.pacingVersion = pacingVersion;
      game.time = 35.95; game.nextSpawn = 2;
      tick(game, .1);
      expect(game.enemies[0].type).toBe("barrel");
      expect(game.enemies[0].hp).toBe(pacingVersion === 7 ? 640 : 400);
      game.enemies[0].hp -= 32;
      const data = { ...freshSave(), unlocked: 22, tutorialSeen: true, language: "en", current: game };
      await page.goto(`${server.url}manifest.webmanifest`);
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
      await page.goto(server.url);
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      await page.locator("#help-button").tap();
      await expect(page.locator("#modal-body")).toContainText("Moonlit Greenhouse uses 1.3x health");
      await page.locator("#modal-actions .primary").tap();
      await installNext(page, server);
      await page.locator("#update-button").tap();
      await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
      expect(await saved(page)).toEqual(data);
      await server.stop();
      await page.reload();
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      await page.locator("#resume-button").tap();
      await expect(page.locator("#enemy-count")).toHaveText(`Stopped 0 / ${pacingVersion === 7 ? 42 : 132}`);
      await page.locator("#pause-button").tap();
      const after = await saved(page);
      expect(after.current.enemies[0].hp).toBe(data.current.enemies[0].hp);
      expect(after.current.enemies[0].maxHp).toBe(pacingVersion === 7 ? 640 : undefined);
      expect(after.current.pacingVersion).toBe(pacingVersion);
      expect(after.current.nextSpawn).toBe(3);
    } finally { await server.stop(); }
  }
});

test("선인장 세 개와 기존6초·20초 대기는 업데이트·오프라인에서 안전 이관", async ({ page }) => {
  for (const cooldown of [6, 20]) {
    const server = await releaseServer();
    try {
      const game = createGame(28, ["cactus"]);
      game.rulesVersion = 7; game.pacingVersion = 6; game.cooldowns.cactus = cooldown;
      for (let row = 0; row < 3; row++) game.plants.push({
        id: game.nextId++, type: "cactus", row, col: 0, hp: 160, timer: 4, age: 2,
      });
      const data = { ...freshSave(), unlocked: 28, tutorialSeen: true, language: "en", current: game };
      await page.goto(`${server.url}manifest.webmanifest`);
      await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
      await page.goto(server.url);
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      await installNext(page, server);
      await page.locator("#update-button").tap();
      await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
      expect(await saved(page)).toEqual(data);
      await server.stop();
      await page.reload();
      await expect(page.locator("#offline-status")).toContainText("Offline ready");
      expect(await saved(page)).toEqual(data);
      await page.locator("#resume-button").tap();
      await expect(page.locator('.seed-card[data-type="cactus"]')).toHaveAttribute("aria-disabled", "false");
      await expect(page.locator('.seed-card[data-type="cactus"] .plant-limit')).toHaveCount(0);
      await page.locator("#pause-button").tap();
      const after = await saved(page);
      expect(after.current.plants).toHaveLength(3);
      expect(after.current.cooldowns.cactus).toBeLessThanOrEqual(Math.min(cooldown, 16));
      expect(after.current.cooldowns.cactus).toBeGreaterThan(Math.min(cooldown, 16) - 1);
      expect(after.current.sun).toBe(data.current.sun);
      expect(after.current.rulesVersion).toBe(9);
      expect(after.current.plants[0].timer).toBeLessThanOrEqual(3);
      expect(after.current.plants[0].timer).toBeGreaterThan(2);
    } finally { await server.stop(); }
  }
});

test("v32 선인장 두 개 저장도 명시적 업데이트·오프라인에서 세 번째 설치 가능", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(22, ["cactus"]); game.rulesVersion = 8; game.sun = 1600;
    plantAt(game, "cactus", 0, 0); game.cooldowns.cactus = 0;
    plantAt(game, "cactus", 1, 0); game.cooldowns.cactus = 0; game.effects = [];
    const data = { ...freshSave(), unlocked: 22, language: "en", tutorialSeen: true, current: game };
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await page.locator("#resume-button").tap();
    const card = page.locator('.seed-card[data-type="cactus"]');
    await expect(card).toHaveAttribute("aria-disabled", "false");
    await card.tap();
    await page.locator('.plot[data-row="2"][data-col="0"]').tap();
    await expect(card.locator(".cooldown")).toHaveText("16s");
    await page.locator("#pause-button").tap();
    const after = await saved(page);
    expect(after.current.plants).toHaveLength(3);
    expect(after.current.sun).toBe(400);
    expect(after.current.cooldowns.cactus).toBeGreaterThan(15);
    expect(after.current.cooldowns.cactus).toBeLessThanOrEqual(16);
    expect(after.current.rulesVersion).toBe(9);
    await page.reload();
    expect(await saved(page)).toEqual(after);
  } finally { await server.stop(); }
});

test("기존 쌍콩이 예약과 사막 저장은 명시적 업데이트·오프라인 뒤 한 번씩 이어짐", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(25, ["sun", "twin", "storm"]);
    plantAt(game, "twin", 2, 0);
    game.enemies.push({ id: game.nextId++, type: "barrel", row: 2, x: 900, hp: ENEMIES.barrel.hp, age: 0, slow: 0, eating: false });
    tick(game, .1); tick(game, .1);
    game.effects = [];
    const data = { ...freshSave(), unlocked: 25, tutorialSeen: true, language: "en", volume: 67,
      teamSlots: ["sun", null, "twin", "storm", null, null, null, null], current: game };
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await server.stop();
    await page.reload();
    await page.locator("#resume-button").tap();
    await page.waitForTimeout(500);
    await page.locator("#pause-button").tap();
    const after = await saved(page);
    expect(after.current.shots.map(s => s.muzzle)).toEqual([0, 1]);
    expect(after.current.shots.map(s => s.damage)).toEqual([33, 33]);
    expect(after.current.plants[0].pendingShotAt).toBeUndefined();
    expect(after.current.plants[0].shotAt).toBe(game.plants[0].shotAt);
    expect(after.teamSlots).toEqual(data.teamSlots);
    expect(after.volume).toBe(67);
    expect(after.language).toBe("en");
  } finally { await server.stop(); }
});

test("순차 번개·선인장 충전은 업데이트와 서버 종료 후 중복 없이 이어짐", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(28, ["cactus", "storm"]);
    game.sun = 1000;
    plantAt(game, "cactus", 1, 0);
    for (let step = 0; step < 24; step++) tick(game, .1);
    const chainedIds = [];
    for (let index = 0; index < 6; index++) {
      const id = game.nextId++;
      chainedIds.push(id);
      game.enemies.push({ id, type: "barrel", row: 2, x: 500 + index * 35, hp: 400, age: 0, slow: 0, eating: false });
    }
    game.enemies.push({ id: game.nextId++, type: "barrel", row: 1, x: 900, hp: 400, age: 0, slow: 0, eating: false });
    game.shots.push({ id: game.nextId++, kind: "storm", row: 2, x: 470, damage: 32, frost: false });
    tick(game, .1);
    game.effects = [];
    const data = { ...freshSave(), unlocked: 28, tutorialSeen: true, language: "en", current: game };
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await server.stop();
    await page.reload();
    await page.locator("#resume-button").tap();
    await page.waitForTimeout(1000);
    await page.locator("#pause-button").tap();
    const after = (await saved(page)).current;
    expect(after.shots).toEqual([]);
    expect(chainedIds.map(id => after.enemies.find(e => e.id === id)?.hp)).toEqual([368, 368, 368, 368, 368, 400]);
    expect(after.enemies.filter(e => e.row === 1)).toEqual([]);
    expect(after.plants[0].shotAt).toBeGreaterThanOrEqual(3 - 1e-8);
    expect(after.plants[0].hp).toBe(160);
    expect(after.stats.defeated).toBe(1);
  } finally { await server.stop(); }
});

test("v21의 첫 콩·불씨 피해와 예약·화상·냉기를 보존하고 두 번째 콩부터 v24 피해 적용", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(10, ["sun", "pea", "wall", "frost", "twin", "ember", "lantern", "iron"]);
    plantAt(game, "twin", 2, 0);
    game.enemies.push({ id: game.nextId++, type: "jelly", row: 2, x: 900, hp: ENEMIES.jelly.hp, age: 0, slow: 0, eating: false });
    game.enemies.push({ id: game.nextId++, type: "umbrella", row: 4, x: 800, hp: 100, age: 1, slow: 2, burn: 2, eating: false, equipmentDropped: true });
    tick(game, .1); tick(game, .1);
    game.shots[0].damage = 18;
    game.shots.push({ id: game.nextId++, kind: "ember", row: 1, x: 300, damage: 24, frost: false });
    game.effects = [];
    const data = { ...freshSave(), unlocked: 10, language: "en", volume: 80, tutorialSeen: true, current: game };
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await page.locator("#resume-button").tap();
    await page.waitForTimeout(300);
    await page.locator("#pause-button").tap();
    const restored = await saved(page);
    expect(restored.current.plants[0].pendingShotAt).toBeUndefined();
    expect(restored.current.shots.filter(s => s.kind === "twin").map(s => s.muzzle)).toEqual([0, 1]);
    expect(restored.current.shots.filter(s => s.kind === "twin").map(s => s.damage)).toEqual([18, 33]);
    expect(restored.current.shots.filter(s => s.kind === "ember")).toHaveLength(1);
    expect(restored.current.shots.find(s => s.kind === "ember").damage).toBe(24);
    expect(restored.current.enemies[1].burn).toBeLessThan(game.enemies[1].burn);
    expect(restored.current.enemies[1].slow).toBeLessThan(game.enemies[1].slow);
    expect(restored.current.enemies[1].hp).toBeLessThan(game.enemies[1].hp);
    expect(restored.current.plants[0].shotAt).toBe(game.plants[0].shotAt);
    expect(restored.language).toBe("en");
  } finally { await server.stop(); }
});

test("v17의 긴 배치·생산 대기를 보존 이관하고 업데이트·오프라인에서 v18 대기로 재배치", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(10, ["sun", "pea", "lantern", "ember"]);
    game.rulesVersion = 4;
    game.cooldowns = { sun: 5, pea: 6, wall: 8, frost: 5, bomb: 16, twin: 9, thorn: 9, pumpkin: 10, lantern: 10, iron: 14, ember: 10 };
    game.skyTimer = 6;
    game.time = 20;
    game.plants.push({ id: game.nextId++, type: "sun", row: 0, col: 0, hp: 100, timer: 7.5, age: 12 });
    game.plants.push({ id: game.nextId++, type: "lantern", row: 0, col: 1, hp: 140, timer: 9.5, age: 12 });
    const data = { ...freshSave(), unlocked: 10, stars: freshSave().stars.fill(3), language: "en", volume: 65, tutorialSeen: true, current: game };
    const expected = structuredClone(data);
    expected.current.rulesVersion = 9;
    expected.current.cooldowns = { sun: 4, pea: 5, wall: 7, frost: 4, bomb: 14, twin: 8, thorn: 8, pumpkin: 9, lantern: 9, iron: 12, ember: 9, storm: 0, cactus: 0, shuriken: 0 };
    expected.current.skyTimer = 5;
    expected.current.plants[0].timer = 6;
    expected.current.plants[1].timer = 8;
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await expect(page.locator("#resume-button")).toBeVisible();
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await server.stop();
    await page.reload();
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    expect(await saved(page)).toEqual(data);
    await page.locator("#resume-button").tap();
    expect(await saved(page)).toEqual(expected);
    const sun = page.locator('.seed-card[data-type="sun"]');
    await expect(sun).toHaveAttribute("aria-label", /First harvest after 5s, then 25 sunlight every 8s/);
    await expect(page.locator('.seed-card[data-type="lantern"]')).toHaveAttribute("aria-label", /First harvest after 8s, then 50 sunlight every 10s/);
    await expect(sun.locator(".cooldown")).toHaveText("4s");
    await expect(sun.locator(".cooldown")).toBeHidden({ timeout: 6000 });
    await sun.tap();
    await page.locator('.plot[data-row="1"][data-col="0"]').tap();
    await expect(sun.locator(".cooldown")).toHaveText("4s");
    await page.locator("#pause-button").tap();
    const after = await saved(page);
    expect(after.current.rulesVersion).toBe(9);
    expect(after.current.cooldowns.sun).toBeGreaterThan(0);
    expect(after.current.cooldowns.sun).toBeLessThanOrEqual(4);
    expect(after.current.plants.at(-1).timer).toBeLessThanOrEqual(5);
    expect(after.stars).toEqual(data.stars);
    expect(after.volume).toBe(65);
  } finally { await server.stop(); }
});

test("10칸 별 저장은 명시적 업데이트 뒤 현재 판을 유지하며 11단계 해금", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(10, ["sun", "pea", "ember"]);
    plantAt(game, "pea", 2, 0); game.effects = [];
    const data = { ...freshSave(), unlocked: 10, stars: Array(10).fill(3), current: game, language: "en", tutorialSeen: true, volume: 65 };
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await server.stop();
    await page.reload();
    await page.locator("#resume-button").tap();
    expect(await saved(page)).toEqual({ ...data, unlocked: 11, stars: [...data.stars, ...Array(20).fill(0)] });
    await expect(page.locator("#game")).toHaveAttribute("data-theme", "garden");
  } finally { await server.stop(); }
});

test("v10의 진행 중 판은 업데이트 후에도 이전 웨이브로 이어짐", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(1);
    delete game.pacingVersion;
    game.time = 11;
    const data = { ...freshSave(), language: "en", tutorialSeen: true, current: game };
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: SAVE_KEY, data });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await installNext(page, server);
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(page)).toEqual(data);
    await page.locator("#resume-button").tap();
    await page.waitForTimeout(1400);
    await page.locator("#pause-button").tap();
    const restored = await saved(page);
    expect(restored.current.nextSpawn).toBe(1);
    expect(restored.current.pacingVersion).toBeUndefined();
    expect(restored.language).toBe("en");
  } finally { await server.stop(); }
});

test("기존 v5 탭은 새로고침해도 구버전: 모든 탭 종료 후 저장 보존하여 최신 전환", async ({ page, context }) => {
  const server = await releaseServer(true);
  try {
    const before = await seed(page, server.url);
    const second = await context.newPage();
    await second.goto(server.url);
    await installNext(page, server);
    await page.reload();
    await expect(page.getByRole("heading")).toHaveText("구버전 화면");
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
    await page.close();
    await expect(second.getByRole("heading")).toHaveText("구버전 화면");
    await second.close();
    const reopened = await context.newPage();
    await reopened.goto(server.url);
    await expect(reopened.locator("#app-version")).toHaveText(`화면 ${server.current}`);
    await expect(reopened.locator("#offline-status")).toContainText("오프라인 준비 완료");
    expect(await saved(reopened)).toEqual(before);
    await reopened.locator("#resume-button").tap();
    await expect(reopened.locator('.plot[data-row="2"][data-col="0"]')).toHaveAttribute("aria-label", "3줄 1칸, 콩별이");
    await expect(reopened.locator('.seed-card[data-type="wall"]')).toBeEnabled();
    expect(await reopened.evaluate(() => caches.keys())).not.toContain("garden-guardians-%2F-v5");
  } finally { await server.stop(); }
});

test("진행 중 새 버전은 기다리고 저장 후 명시적 적용: 다른 탭·오프라인·현재 판 보존", async ({ page, context }) => {
  const server = await releaseServer();
  try {
    await seed(page, server.url);
    const second = await context.newPage();
    await second.setViewportSize({ width: 568, height: 320 });
    await second.goto(server.url);
    await expect(second.locator("#offline-status")).toContainText("오프라인 준비 완료");
    await page.locator("#resume-button").tap();
    await page.locator('.seed-card[data-type="sun"]').tap();
    await page.locator('.plot[data-row="0"][data-col="0"]').tap();
    await page.locator("#pause-button").tap();
    await page.locator("#modal [data-language]").tap();
    await installNext(page, server);
    await expect(second.locator("#update-button")).toBeVisible();
    await second.locator("#update-button").scrollIntoViewIfNeeded();
    const buttonBounds = await second.locator("#update-button").boundingBox();
    expect(buttonBounds.y).toBeGreaterThanOrEqual(0);
    expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(320);
    const before = await saved(page);
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.current}`);
    await expect(page.getByRole("button", { name: "Save and update", exact: true })).toBeVisible();
    await server.stop();
    await page.getByRole("button", { name: "Save and update", exact: true }).tap();
    await expect(page.locator("#app-version")).toHaveText(`Version ${server.next}`);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    expect(await saved(page)).toEqual(before);
    // An idle older tab must neither reload itself nor overwrite the newer saved game.
    await expect(second.locator("#app-version")).toHaveText(`화면 ${server.current}`);
    await expect(second.locator("#update-button")).toBeVisible();
    await second.locator("#update-button").tap();
    await expect(second.locator("#app-version")).toHaveText(`Version ${server.next}`);
    expect(await saved(second)).toEqual(before);
    await page.locator("#resume-button").tap();
    await expect(page.locator('.plot[data-row="0"][data-col="0"]')).toHaveAttribute("aria-label", "Row 1, column 1, Sunbell");
  } finally { await server.stop(); }
});

test("새 자산 저장 실패는 알리고 기존 버전을 유지하며 재시도 가능", async ({ page }) => {
  const server = await releaseServer();
  try {
    const before = await seed(page, server.url);
    server.deploy(true);
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await expect(page.locator("#toast")).toContainText("새 버전을 저장하지 못했어요");
    await expect(page.locator("#update-button")).toBeHidden();
    await expect(page.locator("#app-version")).toHaveText(`화면 ${server.current}`);
    expect(await saved(page)).toEqual(before);
    await installNext(page, server);
    await expect(page.locator("#update-button")).toBeVisible();
    await page.locator("#update-button").tap();
    await expect(page.locator("#app-version")).toHaveText(`화면 ${server.next}`);
    expect(await saved(page)).toEqual(before);
  } finally { await server.stop(); }
});

test("대기 업데이트는 재접속에도 표시하고 저장 실패 시 적용을 중단", async ({ page }) => {
  const server = await releaseServer();
  try {
    const before = await seed(page, server.url);
    await installNext(page, server);
    await page.reload();
    await expect(page.locator("#update-button")).toBeVisible();
    await expect(page.locator("#app-version")).toHaveText(`화면 ${server.current}`);
    await page.locator("#resume-button").tap();
    await page.locator("#pause-button").tap();
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("저장 차단 테스트"); }; });
    await page.getByRole("button", { name: "저장하고 업데이트", exact: true }).tap();
    await expect(page.locator("#modal-body")).toContainText("진행을 저장하지 못해");
    await expect(page.locator("#app-version")).toHaveText(`화면 ${server.current}`);
    expect((await saved(page)).stars).toEqual(before.stars);
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
  } finally { await server.stop(); }
});
