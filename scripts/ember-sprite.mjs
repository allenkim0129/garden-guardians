import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Original vector artwork: fixed roots, four poses each for idle, firing and hurt.
function frame(row, col) {
  const phase = [0, 1, 0, -1][col];
  const tilt = row === 1 ? [-3, -6, 4, 1][col] : row === 2 ? [-8, -4, 3, 0][col] : phase * 2;
  const recoil = row === 1 ? [-2, -5, 3, 0][col] : row === 2 ? -4 + col : phase;
  const mouth = row === 1 ? [4, 5, 10, 6][col] : 4;
  const eyes = row === 2 || row === 0 && col === 2
    ? '<path d="M-5 -3 L4 0 L-5 3 M22 -4 L31 -1 L22 2" fill="none"/>'
    : '<ellipse cx="0" cy="-2" rx="6" ry="10" fill="#fff5c8"/><ellipse cx="26" cy="-4" rx="6" ry="10" fill="#fff5c8"/><ellipse cx="2" cy="0" rx="2.5" ry="5" fill="#304333" stroke="none"/><ellipse cx="28" cy="-2" rx="2.5" ry="5" fill="#304333" stroke="none"/>';
  return `<g transform="translate(${col * 320} ${row * 224})" stroke="#304333" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M191 202 Q167 184 174 151 L194 145 Q187 177 204 201Z" fill="#547d38"/>
    <path d="M192 202 Q164 170 130 197 Q147 209 192 205Z" fill="#88a846"/>
    <path d="M194 202 Q217 169 247 195 Q236 208 194 205Z" fill="#69963e"/>
    <path d="M140 196 L181 201 M206 199 L237 193" fill="none" stroke="#b5ca65" stroke-width="3"/>
    <ellipse cx="192" cy="203" rx="17" ry="5" fill="#507332" stroke-width="3"/>
    <g transform="translate(${192 + recoil} 126) rotate(${tilt})">
      <path d="M-40 -28 Q-58 -65 -35 -88 Q-30 -69 -14 -61 Q4 ${-99 - col * 2} 11 -99 Q9 -75 29 -60 Q46 -78 48 -50 L45 -19Z" fill="#e57c2c"/>
      <path d="M-29 -29 Q-38 -60 -27 -70 L-10 -50 Q4 -72 7 -78 Q4 -57 28 -43 L32 -21Z" fill="#ffcd57" stroke="none"/>
      <path d="M-57 14 Q-68 -23 -34 -53 Q-22 -62 -7 -54 Q9 -64 36 -48 Q66 -25 58 11 Q45 43 5 41 Q-40 44 -57 14Z" fill="#e58631"/>
      <path d="M-50 -19 Q-32 -54 -10 -46 Q-1 -35 -8 -21 Q-39 -25 -41 3Z" fill="#ffd26a" stroke="none"/>
      <path d="M-49 14 Q-14 40 22 22 Q45 9 52 -17 Q65 7 41 29 Q13 48 -19 35Z" fill="#ad4e27" stroke="none"/>
      <path d="M-54 21 L-37 18 L-24 34 L-7 26 L9 39 L29 23 L46 24 Q22 55 -12 47 Q-40 44 -54 21Z" fill="#6d963c"/>
      <path d="M-49 -7 Q-36 -14 -24 -10 M-43 7 Q-30 3 -20 9" fill="none" stroke="#b45a2b" stroke-width="3"/>
      <g transform="translate(7 -5)" stroke-width="3">
        ${eyes}
        <path d="M-9 -16 L6 -12 M19 -16 L34 -20" fill="none"/>
        <ellipse cx="48" cy="7" rx="${mouth}" ry="${mouth + 2}" fill="#683d2a"/>
        ${row === 1 && col === 2 ? '<path d="M57 5 L74 -2 L70 6 L81 10 L65 16 L57 12Z" fill="#ffdc6b" stroke="#b96627" stroke-width="2"/>' : ""}
      </g>
      ${row === 2 ? '<path d="M-24 -36 L-18 -26 L-28 -22 M32 15 L26 21" fill="none" stroke="#753f2b" stroke-width="3"/>' : ""}
    </g>
  </g>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="672" viewBox="0 0 1280 672">
  ${Array.from({ length: 12 }, (_, i) => frame(Math.floor(i / 4), i % 4)).join("")}
</svg>`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const png = await page.evaluate(async svg => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  }, svg);
  const output = new URL("../assets/sprites/ember.png", import.meta.url);
  await mkdir(new URL("./", output), { recursive: true });
  await writeFile(output, Buffer.from(png, "base64"));
  console.log("Created assets/sprites/ember.png: 12 original poses, 1280x672");
} finally {
  await browser.close();
}
