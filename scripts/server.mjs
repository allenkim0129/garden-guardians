import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(arg("--port", process.env.PORT ?? "4173"));
const host = arg("--host", "127.0.0.1");
const basePath = arg("--base", "/");
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const allowed = new Set(["index.html", "styles.css", "sw.js", "manifest.webmanifest", "src/app.js", "src/engine.js", "src/art.js", "src/storage.js", "src/audio.js", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"]);
allowed.add("src/sprites.js");
for (const type of ["pea", "sun", "wall", "frost", "bomb", "sleepy", "jelly", "roller", "umbrella"]) allowed.add(`assets/sprites/${type}.png`);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(basePath)) { res.writeHead(404); res.end(); return; }
    let relative = decodeURIComponent(url.pathname.slice(basePath.length)).replace(/^\/+/, "");
    if (relative === "") relative = "index.html";
    if (!allowed.has(relative)) { res.writeHead(404); res.end("찾을 수 없는 파일입니다."); return; }
    const file = path.join(root, ...relative.split("/"));
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": body.length,
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch (error) {
    res.writeHead(error.code === "ENOENT" || error instanceof URIError ? 404 : 500);
    res.end("파일을 읽지 못했습니다.");
    if (error.code !== "ENOENT" && !(error instanceof URIError)) console.error(error);
  }
});
server.listen(port, host, () => console.log(`정원 수비대: http://${host}:${server.address().port}${basePath}`));
server.on("error", error => { console.error(`서버 시작 실패: ${error.message}`); process.exitCode = 1; });
