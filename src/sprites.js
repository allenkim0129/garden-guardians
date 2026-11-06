import { PLANTS, ENEMIES, TWIN_GAP } from "./engine.js";

export const SPRITE_CELL = Object.freeze({ width: 320, height: 224, anchorX: 192, anchorY: 210, scale: .48 });
export const SPRITE_URLS = Object.freeze(Object.fromEntries(
  [...Object.keys(PLANTS), ...Object.keys(ENEMIES)].map(type => [type, new URL(`../assets/sprites/${type}.png`, import.meta.url).href])
));
export { FALL_DURATION, BURST_DURATION } from "./engine.js";
const images = new Map();
const frozenImages = new Map();
let loading;

export function loadSprites() {
  if (loading) return loading;
  loading = Promise.all(Object.entries(SPRITE_URLS).map(([type, url]) => new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error(`${type} 그림을 불러오는 시간이 초과됐어요.`)), 15000);
    image.onload = () => {
      clearTimeout(timer);
      if (image.naturalWidth !== SPRITE_CELL.width * 4 || image.naturalHeight !== SPRITE_CELL.height * 3) {
        reject(new Error(`${type} 프레임 시트의 크기가 맞지 않아요.`));
      } else resolve([type, image]);
    };
    image.onerror = () => { clearTimeout(timer); reject(new Error(`${type} 프레임 그림을 불러오지 못했어요.`)); };
    image.src = url;
  }))).then(entries => { for (const [type, image] of entries) images.set(type, image); })
    .catch(error => { loading = null; throw error; });
  return loading;
}

function actionFrame(time, happenedAt, timer, state) {
  const elapsed = time - (happenedAt ?? -100);
  if (elapsed >= 0 && elapsed < .24) return { state, row: 1, col: elapsed < .12 ? 2 : 3 };
  if (timer > 0 && timer <= .2) return { state, row: 1, col: timer > .1 ? 0 : 1 };
  return null;
}
export function plantFrame(plant, game) {
  if (plant.type === "bomb") {
    return plant.age < .4
      ? { state: "idle", row: 0, col: Math.min(3, Math.floor(plant.age * 10)) }
      : { state: "prime", row: 1, col: Math.min(3, Math.floor((plant.age - .4) / .15)) };
  }
  const defender = plant.type === "wall" || plant.type === "iron";
  if (defender && plant.hp <= PLANTS[plant.type].hp * .35) {
    return { state: "cracked", row: 2, col: Math.floor(plant.age * 4) % 4 };
  }
  if (plant.type === "twin") {
    const elapsed = game.time - (plant.shotAt ?? -100);
    if (elapsed >= 0 && elapsed < TWIN_GAP * 2) return { state: "fire", row: 1, col: Math.min(3, Math.floor((elapsed + 1e-9) / (TWIN_GAP / 2))) };
  } else if (PLANTS[plant.type].damage) {
    const targetAhead = game.enemies.some(enemy => enemy.hp > 0 && enemy.row === plant.row && enemy.x >= plant.col * 100 + 40);
    const frame = actionFrame(game.time, plant.shotAt, targetAhead ? plant.timer : 0, "fire");
    if (frame) return frame;
  } else if (plant.type === "sun" || plant.type === "lantern") {
    const frame = actionFrame(game.time, plant.producedAt, plant.timer, "produce");
    if (frame) return frame;
  }
  const sinceHurt = game.time - (plant.hurtAt ?? -100);
  if (sinceHurt >= 0 && sinceHurt < .48) {
    return { state: defender ? "guard" : "hurt", row: defender ? 1 : 2, col: Math.min(3, Math.floor(sinceHurt / .12)) };
  }
  return { state: "idle", row: 0, col: Math.floor(plant.age * 4) % 4 };
}

export function enemyFrame(enemy, time) {
  const age = Math.max(0, time - (enemy.motionAt ?? time - enemy.age));
  const speed = enemy.type === "roller" ? 8 : enemy.type === "jelly" ? 4 : 6;
  return enemy.eating
    ? { state: "attack", row: 1, col: Math.floor(age * 5) % 4 }
    : { state: "walk", row: 0, col: Math.floor(age * speed * (enemy.slow > 0 ? 3.5 / 6 : 1)) % 4 };
}
export function fallFrame(age) {
  return { state: "fall", row: 2, col: Math.min(3, Math.floor(Math.max(0, age) / .16)) };
}
export function burstFrame(age) {
  return { state: "burst", row: 2, col: Math.min(3, Math.floor(Math.max(0, age) / .16)) };
}

// Canopy outlines in the original frames; keep the coat, face and walking poses.
const umbrellaMasks = [
  [[55, 53], [111, 53], [110, 82], [116, 113], [124, 125], [111, 165], [53, 165]],
  [[62, 54], [113, 54], [112, 82], [119, 114], [126, 128], [112, 168], [60, 168]],
  [[61, 58], [114, 58], [113, 86], [120, 115], [127, 131], [113, 171], [58, 171]],
  [[58, 59], [112, 59], [111, 85], [119, 115], [126, 130], [112, 169], [55, 169]],
  [[61, 48], [101, 48], [116, 78], [120, 110], [130, 141], [115, 172], [60, 172]],
  [[15, 49], [59, 49], [70, 80], [77, 117], [82, 137], [66, 166], [13, 166]],
  [[52, 48], [107, 48], [108, 86], [114, 119], [123, 140], [105, 171], [50, 171]],
  [[56, 53], [110, 53], [113, 88], [121, 119], [130, 142], [113, 174], [53, 174]],
  [[48, 60], [87, 60], [109, 96], [113, 127], [122, 147], [123, 181], [47, 181]],
  [[105, 40], [146, 40], [163, 75], [169, 110], [177, 139], [156, 166], [104, 166]],
  [[152, 181], [183, 174], [229, 182], [234, 224], [135, 224], [135, 207]],
  [[131, 192], [165, 181], [227, 188], [237, 224], [126, 224]],
];

export function drawSprite(context, type, frame, x, y, scale = 1, equipmentDropped = false, frozen = false) {
  let image = images.get(type);
  if (!image) throw new Error(`${type} 그림을 먼저 불러와야 합니다.`);
  if (frozen && Object.hasOwn(ENEMIES, type)) {
    if (!frozenImages.has(type)) {
      const tinted = document.createElement("canvas");
      tinted.width = image.width; tinted.height = image.height;
      const brush = tinted.getContext("2d");
      brush.drawImage(image, 0, 0);
      brush.globalCompositeOperation = "source-atop";
      brush.fillStyle = "rgba(60, 135, 255, .6)";
      brush.fillRect(0, 0, tinted.width, tinted.height);
      frozenImages.set(type, tinted);
    }
    image = frozenImages.get(type);
  }
  const { width, height, anchorX, anchorY } = SPRITE_CELL;
  const size = SPRITE_CELL.scale * scale;
  context.save();
  if (type === "umbrella" && equipmentDropped) {
    const left = x - anchorX * size;
    const top = y + 34 * scale - anchorY * size;
    context.beginPath();
    context.rect(left - 1, top - 1, width * size + 2, height * size + 2);
    const mask = umbrellaMasks[frame.row * 4 + frame.col];
    mask.forEach(([px, py], i) => {
      if (i === 0) context.moveTo(left + px * size, top + py * size);
      else context.lineTo(left + px * size, top + py * size);
    });
    context.closePath();
    context.clip("evenodd");
  }
  context.drawImage(image, frame.col * width, frame.row * height, width, height,
    x - anchorX * size, y + (Object.hasOwn(PLANTS, type) ? 31 : 34) * scale - anchorY * size, width * size, height * size);
  context.restore();
}
