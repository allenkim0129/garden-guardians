const BASE = new URL("./", self.location.href);
const CACHE_PREFIX = `garden-guardians-${encodeURIComponent(BASE.pathname)}-`;
const CACHE = `${CACHE_PREFIX}v32`;
const FILES = [
  "./", "./index.html", "./styles.css", "./src/app.js", "./src/engine.js",
  "./src/art.js", "./src/audio.js", "./src/storage.js", "./src/sprites.js", "./src/i18n.js", "./manifest.webmanifest",
  "./assets/sprites/pea.png", "./assets/sprites/sleepy.png",
  "./assets/sprites/sun.png", "./assets/sprites/wall.png", "./assets/sprites/frost.png", "./assets/sprites/bomb.png",
  "./assets/sprites/jelly.png", "./assets/sprites/roller.png", "./assets/sprites/umbrella.png",
  "./assets/sprites/twin.png", "./assets/sprites/thorn.png", "./assets/sprites/pumpkin.png", "./assets/sprites/lantern.png", "./assets/sprites/iron.png",
  "./assets/sprites/ember.png",
  "./assets/sprites/shuriken.png", "./assets/sprites/shuriken-projectile.png",
  "./assets/sprites/storm.png", "./assets/sprites/cactus.png", "./assets/sprites/barrel.png", "./assets/sprites/courier.png",
  "./assets/sprites/barrel-bare.png", "./assets/sprites/courier-bare.png", "./assets/sprites/desert-gear.png",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png",
].map(path => new URL(path, BASE).href);

async function cacheFiles() {
  const cache = await caches.open(CACHE);
  // addAll is atomic: a failed resource must not be reported as offline-ready.
  await cache.addAll(FILES.map(url => new Request(url, { cache: "reload" })));
}
self.addEventListener("install", event => { event.waitUntil(cacheFiles()); });
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    if (event.request.mode === "navigate") return (await cache.match(new URL("./", BASE).href)) || fetch(event.request);
    return fetch(event.request);
  })());
});
self.addEventListener("message", event => {
  const port = event.ports[0];
  if (!port || !["CHECK_CACHE", "REPAIR_CACHE", "APPLY_UPDATE"].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === "APPLY_UPDATE") {
        await self.skipWaiting();
        port.postMessage({ accepted: true });
        return;
      }
      if (event.data.type === "REPAIR_CACHE") await cacheFiles();
      const cache = await caches.open(CACHE);
      const found = await Promise.all(FILES.map(url => cache.match(url)));
      port.postMessage({ ready: found.every(Boolean), version: CACHE });
    } catch (error) {
      port.postMessage({ ready: false, error: error.message });
    }
  })());
});
