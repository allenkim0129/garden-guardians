import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createGame, plantAt, tick, ENEMIES } from "../../src/engine.js";
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
    stop: () => new Promise(resolve => server.close(resolve)),
  };
}
async function seed(page, url) {
  const game = createGame(2);
  plantAt(game, "pea", 2, 0);
  const save = { ...freshSave(), unlocked: 4, stars: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0], tutorialSeen: true, current: game };
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

test("두 번째 콩 예약·불씨·화상·냉기도 업데이트 후 동일하게 이어짐", async ({ page }) => {
  const server = await releaseServer();
  try {
    const game = createGame(10, ["sun", "pea", "wall", "frost", "twin", "ember", "lantern", "iron"]);
    plantAt(game, "twin", 2, 0);
    game.enemies.push({ id: game.nextId++, type: "jelly", row: 2, x: 900, hp: ENEMIES.jelly.hp, age: 0, slow: 0, eating: false });
    game.enemies.push({ id: game.nextId++, type: "umbrella", row: 4, x: 800, hp: 100, age: 1, slow: 2, burn: 2, eating: false, equipmentDropped: true });
    tick(game, .1); tick(game, .1);
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
    expect(restored.current.shots.filter(s => s.kind === "ember")).toHaveLength(1);
    expect(restored.current.enemies[1].burn).toBeLessThan(game.enemies[1].burn);
    expect(restored.current.enemies[1].slow).toBeLessThan(game.enemies[1].slow);
    expect(restored.current.enemies[1].hp).toBeLessThan(game.enemies[1].hp);
    expect(restored.current.plants[0].shotAt).toBe(game.plants[0].shotAt);
    expect(restored.language).toBe("en");
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
