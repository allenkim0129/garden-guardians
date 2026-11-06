import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(process.env.GAME_URL ?? "http://127.0.0.1:4173");
  const icons = await page.evaluate(async () => {
    const { loadSprites } = await import("./src/sprites.js");
    await loadSprites();
    const { drawAppIcon } = await import("./src/art.js");
    return [192, 512, 180].map(size => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      drawAppIcon(canvas);
      return { size, data: canvas.toDataURL("image/png").split(",")[1] };
    });
  });
  await mkdir(new URL("../icons/", import.meta.url), { recursive: true });
  for (const { size, data } of icons) {
    const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
    await writeFile(new URL(`../icons/${name}`, import.meta.url), Buffer.from(data, "base64"));
    if (size === 512) await writeFile(new URL("../icons/maskable-512.png", import.meta.url), Buffer.from(data, "base64"));
  }
  console.log("게임 아트로 앱 아이콘 4개 생성 완료");
} finally { await browser.close(); }
