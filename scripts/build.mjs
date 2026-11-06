import { copyFile, mkdir, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = [
  "index.html", "styles.css", "manifest.webmanifest", "sw.js",
  "src/app.js", "src/engine.js", "src/art.js", "src/audio.js", "src/storage.js", "src/sprites.js", "src/i18n.js",
  "assets/sprites/pea.png", "assets/sprites/sleepy.png",
  "assets/sprites/sun.png", "assets/sprites/wall.png", "assets/sprites/frost.png", "assets/sprites/bomb.png",
  "assets/sprites/jelly.png", "assets/sprites/roller.png", "assets/sprites/umbrella.png",
  "assets/sprites/twin.png", "assets/sprites/thorn.png", "assets/sprites/pumpkin.png", "assets/sprites/lantern.png", "assets/sprites/iron.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png",
];
let bytes = 0;
for (const file of files) {
  const source = new URL(file, root);
  const destination = new URL(`dist/${file}`, root);
  await mkdir(new URL("./", destination), { recursive: true });
  await copyFile(source, destination);
  bytes += (await stat(destination)).size;
}
console.log(`정적 배포 파일 ${files.length}개 준비 완료: dist (${(bytes / 1024).toFixed(1)} KiB)`);
