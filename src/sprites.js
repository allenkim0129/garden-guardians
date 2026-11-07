import { PLANTS, ENEMIES, TWIN_GAP, plantActionRemaining, sprinklerTargets } from "./engine.js";

export const SPRITE_CELL = Object.freeze({ width: 320, height: 224, anchorX: 192, anchorY: 210, scale: .48 });
// Red orb centers measured in the approved, aligned cactus atlas.
export const CACTUS_MUZZLES = Object.freeze([
  [194.47, 30.42], [197.54, 30.70], [213.25, 32.52], [194.68, 30.42],
  [195.01, 37.50], [212.33, 38.51], [228.69, 40.93], [196.35, 29.95],
  [191.83, 30.25], [163.91, 40.54], [178.61, 29.95], [194.90, 30.39],
]);
export const SHURIKEN_HANDS = Object.freeze([
  [259.13, 103.67], [257.17, 103.67], [258.15, 103.67], [257.17, 103.67],
  [166.03, 96.32], [275.30, 102.20], [271.87, 102.20], [168.48, 97.30],
  [247.37, 108.57], [250.80, 109.55], [258.64, 112], [261.58, 112],
]);
export const SHURIKEN_SIZE = 54;
// Watering-row nozzle tips: upper-left, upper-right, lower-left, lower-right.
export const SPRINKLER_NOZZLES = Object.freeze([
  [[145, 45.74], [187.16, 29.48], [161.86, 63.68], [205.15, 45.18]],
  [[157.95, 34.95], [203.24, 31.03], [155.72, 60.12], [218.34, 47.25]],
  [[158.8, 35.15], [203.6, 32.35], [158.24, 60.84], [220.96, 55.26]],
  [[159.22, 40.99], [206.12, 32.6], [165.92, 61.14], [222.31, 55.54]],
]);
export const PROJECTILE_URLS = Object.freeze({
  "shuriken-projectile": new URL("../assets/sprites/shuriken-projectile.png", import.meta.url).href,
});
export const SPRITE_URLS = Object.freeze(Object.fromEntries(
  [...Object.keys(PLANTS), ...Object.keys(ENEMIES)].map(type => [type, new URL(`../assets/sprites/${type}.png`, import.meta.url).href])
));
export const GEAR_URLS = Object.freeze(Object.fromEntries(
  ["barrel-bare", "courier-bare", "desert-gear"].map(type => [type, new URL(`../assets/sprites/${type}.png`, import.meta.url).href])
));
export { FALL_DURATION, BURST_DURATION } from "./engine.js";
const images = new Map();
const frozenImages = new Map();
let loading;

export function loadSprites() {
  if (loading) return loading;
  loading = Promise.all(Object.entries({ ...SPRITE_URLS, ...GEAR_URLS, ...PROJECTILE_URLS }).map(([type, url]) => new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error(`${type} 그림을 불러오는 시간이 초과됐어요.`)), 15000);
    image.onload = () => {
      clearTimeout(timer);
      const columns = type === "desert-gear" ? 2 : 4, rows = type === "desert-gear" ? 1 : 3;
      const expected = type === "shuriken-projectile" ? [128, 128] : [SPRITE_CELL.width * columns, SPRITE_CELL.height * rows];
      if (image.naturalWidth !== expected[0] || image.naturalHeight !== expected[1]) {
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
  if (plant.type === "sprinkler") {
    const hurt = game.time - (plant.hurtAt ?? -100);
    if (hurt >= 0 && hurt < .48) return { state: "hurt", row: 2, col: Math.min(3, Math.floor(hurt / .12)) };
    const phase = plant.age % 1.6;
    if (game.status === "playing" && phase < .8 && sprinklerTargets(game, plant).length) {
      return { state: "watering", row: 1, col: Math.min(3, Math.floor(phase / .2)) };
    }
    return { state: "idle", row: 0, col: Math.floor(plant.age * 4) % 4 };
  }
  if (plant.type === "shuriken") {
    const flight = game.shots?.find(s => s.kind === "shuriken" && s.plantId === plant.id);
    if (flight && flight.age < .12) return { state: "fire", row: 1, col: 1 };
    if (flight?.leg === "back" && flight.x - (plant.col * 100 + 50) < 40) return { state: "catch", row: 1, col: 2 };
    if (game.time - (plant.caughtAt ?? -100) < .24) return { state: "catch", row: 1, col: 3 };
    if (!flight && game.enemies.some(e => e.hp > 0 && e.row === plant.row && e.x > plant.col * 100 + 50)) return { state: "fire", row: 1, col: 0 };
  }
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
  } else if ((PLANTS[plant.type].damage && plant.type !== "shuriken") || plant.type === "cactus") {
    const targetAhead = game.enemies.some(enemy => enemy.hp > 0 && enemy.row === plant.row
      && (plant.type === "cactus" ? enemy.x > plant.col * 100 + 50 : enemy.x >= plant.col * 100 + 40));
    const frame = actionFrame(game.time, plant.shotAt, targetAhead ? plantActionRemaining(game, plant) : 0, "fire");
    if (frame) return frame;
  } else if (plant.type === "sun" || plant.type === "lantern") {
    const frame = actionFrame(game.time, plant.producedAt, plantActionRemaining(game, plant), "produce");
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
  const speed = enemy.type === "roller" || enemy.type === "courier" ? 8 : enemy.type === "jelly" || enemy.type === "barrel" ? 4 : 6;
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
  const imageKey = equipmentDropped && (type === "barrel" || type === "courier") ? `${type}-bare` : type;
  let image = images.get(imageKey);
  if (!image) throw new Error(`${type} 그림을 먼저 불러와야 합니다.`);
  if (frozen && Object.hasOwn(ENEMIES, type)) {
    if (!frozenImages.has(imageKey)) {
      const tinted = document.createElement("canvas");
      tinted.width = image.width; tinted.height = image.height;
      const brush = tinted.getContext("2d");
      brush.drawImage(image, 0, 0);
      brush.globalCompositeOperation = "source-atop";
      brush.fillStyle = "rgba(60, 135, 255, .6)";
      brush.fillRect(0, 0, tinted.width, tinted.height);
      frozenImages.set(imageKey, tinted);
    }
    image = frozenImages.get(imageKey);
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

export function drawGearSprite(context, type) {
  const image = images.get("desert-gear");
  if (!image) throw new Error("장비 그림을 먼저 불러와야 합니다.");
  context.drawImage(image, type === "barrel" ? 0 : 320, 0, 320, 224, -160 * .48, -112 * .48, 320 * .48, 224 * .48);
}

export function drawShuriken(context, x, y, angle = 0, size = SHURIKEN_SIZE) {
  const image = images.get("shuriken-projectile");
  if (!image) throw new Error("shuriken-projectile 그림을 먼저 불러와야 합니다.");
  context.save(); context.translate(x, y); context.rotate(angle);
  context.drawImage(image, -size / 2, -size / 2, size, size);
  context.restore();
}
