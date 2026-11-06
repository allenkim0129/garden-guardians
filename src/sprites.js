import { PLANTS, ENEMIES, TWIN_GAP } from "./engine.js";

export const SPRITE_CELL = Object.freeze({ width: 320, height: 224, anchorX: 192, anchorY: 210, scale: .48 });
export const SPRITE_URLS = Object.freeze(Object.fromEntries(
  [...Object.keys(PLANTS), ...Object.keys(ENEMIES)].map(type => [type, new URL(`../assets/sprites/${type}.png`, import.meta.url).href])
));
export { FALL_DURATION, BURST_DURATION } from "./engine.js";
const images = new Map();
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

export function drawSprite(context, type, frame, x, y, scale = 1) {
  const image = images.get(type);
  if (!image) throw new Error(`${type} 그림을 먼저 불러와야 합니다.`);
  const { width, height, anchorX, anchorY } = SPRITE_CELL;
  const size = SPRITE_CELL.scale * scale;
  context.drawImage(image, frame.col * width, frame.row * height, width, height,
    x - anchorX * size, y + (Object.hasOwn(PLANTS, type) ? 31 : 34) * scale - anchorY * size, width * size, height * size);
}
