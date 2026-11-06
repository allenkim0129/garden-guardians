export const ROWS = 5;
export const COLS = 9;
export const WIDTH = 900;
export const HEIGHT = 500;
export const FALL_DURATION = .88;
export const BURST_DURATION = .75;
export const PLANTS = Object.freeze({
  sun: { name: "햇살봉", unlockStage: 1, cost: 50, hp: 100, recharge: 5, interval: 8, description: "8초마다 햇빛 25를 만들어요." },
  pea: { name: "콩별이", unlockStage: 1, cost: 125, hp: 120, recharge: 6, interval: 1.6, damage: 18, description: "앞으로 초록 완두콩을 톡톡 쏘아요." },
  wall: { name: "도토리벽", unlockStage: 2, cost: 75, hp: 650, recharge: 8, description: "튼튼한 몸으로 좀비를 막아요." },
  frost: { name: "서리초", unlockStage: 3, cost: 125, hp: 100, recharge: 5, interval: 1.6, damage: 15, description: "얼음 결정을 쏴 좀비를 3초 동안 느리게 해요." },
  bomb: { name: "방울폭탄", unlockStage: 4, cost: 125, hp: 150, recharge: 16, description: "1초 뒤 주변 좀비에게 큰 피해!" },
});
export const ENEMIES = Object.freeze({
  sleepy: { name: "잠옷좀비", hp: 110, speed: 17, bite: 22, description: "졸려도 정원 산책은 좋아해요." },
  jelly: { name: "젤리좀비", hp: 340, speed: 13, bite: 25, description: "느리지만 아주 튼튼해요." },
  roller: { name: "롤러좀비", hp: 95, speed: 31, bite: 18, description: "롤러스케이트로 빠르게 와요." },
  umbrella: { name: "우산좀비", hp: 175, speed: 18, bite: 23, description: "우산 덕에 추위에 덜 느려져요." },
});
export const STAGES = [
  { name: "첫 번째 새싹", count: 8, gap: 6.5, types: ["sleepy"], rows: [2, 1, 3], startSun: 250, tip: "햇살봉으로 햇빛을 모으고, 좀비가 오는 줄에 콩별이를 심어요." },
  { name: "아침 산책", count: 12, gap: 5.2, types: ["sleepy"], rows: [0, 4, 2, 1, 3], startSun: 250, tip: "새 친구 도토리벽! 콩별이 앞에 심어 좀비를 붙잡아요." },
  { name: "말랑말랑 손님", count: 14, gap: 4.8, types: ["sleepy", "sleepy", "jelly"], startSun: 275, tip: "새 친구 서리초! 얼음 결정으로 좀비를 느리게 해요." },
  { name: "씽씽 정원길", count: 17, gap: 4.3, types: ["sleepy", "roller", "sleepy"], startSun: 275, tip: "새 친구 방울폭탄! 좀비가 모인 곳에서 한 번에 펑!" },
  { name: "우산 쓴 소풍", count: 20, gap: 4, types: ["sleepy", "umbrella", "roller"], startSun: 300, tip: "우산좀비는 추위에 강해요. 콩별이의 완두콩 공격을 더해요." },
  { name: "점심시간 소동", count: 23, gap: 3.7, types: ["sleepy", "jelly", "roller", "umbrella"], startSun: 300, tip: "햇살봉을 넉넉히 심으면 정원이 든든해져요." },
  { name: "반짝이는 연못", count: 26, gap: 3.4, types: ["umbrella", "roller", "sleepy", "jelly"], startSun: 325, tip: "도토리벽 뒤에 서리초와 콩별이를 함께 심어 봐요." },
  { name: "꼬불꼬불 덩굴", count: 30, gap: 3.1, types: ["roller", "jelly", "sleepy", "umbrella"], startSun: 325, tip: "좀비가 모였을 때 방울폭탄을 심으면 시원하게 펑!" },
  { name: "노을빛 파티", count: 34, gap: 2.8, types: ["jelly", "umbrella", "roller", "sleepy"], startSun: 350, tip: "삽으로 식물을 옮길 자리를 만들어요. 비용 절반을 돌려줘요." },
  { name: "우리들의 정원", count: 40, gap: 2.5, types: ["jelly", "roller", "umbrella", "sleepy", "jelly"], startSun: 350, tip: "마지막 소풍이에요. 다섯 친구와 함께 정원을 지켜요!" },
].map((stage, i) => Object.freeze({ ...stage, id: i + 1 }));

export function isPlantUnlocked(type, stage) {
  return Object.hasOwn(PLANTS, type) && Number.isInteger(stage) && stage >= PLANTS[type].unlockStage && stage <= STAGES.length;
}
export function introducedPlants(stage) {
  return Object.entries(PLANTS).filter(([, plant]) => plant.unlockStage === stage).map(([type]) => type);
}

export function scheduleFor(stageNumber) {
  const stage = STAGES[stageNumber - 1];
  if (!stage) throw new RangeError("없는 스테이지입니다.");
  const rows = stage.rows ?? [2, 0, 4, 1, 3];
  return Array.from({ length: stage.count }, (_, i) => ({
    at: 12 + i * stage.gap + Math.floor(i / Math.ceil(stage.count / 3)) * 7,
    row: rows[i % rows.length],
    type: stage.types[i % stage.types.length],
    wave: Math.min(3, Math.floor(i / Math.ceil(stage.count / 3)) + 1),
  }));
}

export function createGame(stageNumber) {
  const stage = STAGES[stageNumber - 1];
  if (!stage) throw new RangeError("없는 스테이지입니다.");
  return {
    version: 1, rulesVersion: 2, stage: stageNumber, status: "playing", time: 0, sun: stage.startSun,
    lives: 3, nextId: 1, nextSpawn: 0, skyTimer: 4, wave: 0,
    plants: [], enemies: [], shots: [], suns: [], effects: [],
    cooldowns: Object.fromEntries(Object.keys(PLANTS).map(type => [type, 0])),
    stats: { planted: 0, defeated: 0, collected: 0 },
  };
}
const id = game => game.nextId++;
const cellX = col => col * 100 + 50;
const cellY = row => row * 100 + 50;

export function plantAt(game, type, row, col) {
  if (game.status !== "playing") return { ok: false, reason: "지금은 심을 수 없어요." };
  if (!Object.hasOwn(PLANTS, type) || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return { ok: false, reason: "정원 안의 빈 땅을 골라 주세요." };
  }
  const info = PLANTS[type];
  if (!isPlantUnlocked(type, game.stage)) return { ok: false, reason: `${info.name}은 ${info.unlockStage}번째 정원부터 함께해요.` };
  if (game.plants.some(p => p.row === row && p.col === col)) return { ok: false, reason: "이미 친구가 있어요. 다른 땅을 골라 주세요." };
  if (game.sun < info.cost) return { ok: false, reason: "햇빛이 부족해요. 반짝이는 햇빛을 모아 주세요." };
  if (game.cooldowns[type] > 0) return { ok: false, reason: "친구가 준비 중이에요. 조금만 기다려 주세요." };
  game.sun -= info.cost;
  game.cooldowns[type] = info.recharge;
  game.plants.push({ id: id(game), type, row, col, hp: info.hp, timer: type === "sun" ? 6 : .2, age: 0 });
  game.stats.planted++;
  game.effects.push({ id: id(game), kind: "plant", x: cellX(col), y: cellY(row), age: 0 });
  return { ok: true };
}

export function removePlant(game, row, col) {
  if (game.status !== "playing") return { ok: false, reason: "지금은 삽을 쓸 수 없어요." };
  const index = game.plants.findIndex(p => p.row === row && p.col === col);
  if (index < 0) return { ok: false, reason: "삽으로 뽑을 식물을 골라 주세요." };
  const [plant] = game.plants.splice(index, 1);
  const refund = Math.floor(PLANTS[plant.type].cost / 2);
  game.sun += refund;
  return { ok: true, refund };
}

function dropSun(game, x, y) {
  game.suns.push({ id: id(game), x: Math.max(50, Math.min(850, x)), y: Math.max(50, Math.min(450, y)), age: 0, value: 25 });
}
export function collectSun(game, sunId) {
  const index = game.suns.findIndex(sun => sun.id === sunId);
  if (index < 0 || game.status !== "playing") return false;
  const [sun] = game.suns.splice(index, 1);
  game.sun += sun.value;
  game.stats.collected += sun.value;
  return true;
}

export function tick(game, dt) {
  if (game.status !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
  // Large wall-clock gaps must never make enemies jump past a plant.
  dt = Math.min(dt, .1);
  game.time += dt;
  for (const type of Object.keys(PLANTS)) game.cooldowns[type] = Math.max(0, game.cooldowns[type] - dt);
  const schedule = scheduleFor(game.stage);
  while (game.nextSpawn < schedule.length && game.time >= schedule[game.nextSpawn].at) {
    const spawn = schedule[game.nextSpawn++];
    const info = ENEMIES[spawn.type];
    game.enemies.push({ id: id(game), type: spawn.type, row: spawn.row, x: 936, hp: info.hp, slow: 0, age: 0, eating: false, motionAt: game.time });
    game.wave = spawn.wave;
  }
  game.skyTimer -= dt;
  if (game.skyTimer <= 0) {
    const n = Math.floor(game.time / 6);
    dropSun(game, 90 + ((n * 173) % 720), 60 + ((n * 97) % 380));
    game.skyTimer += 6;
  }
  for (const sun of [...game.suns]) {
    sun.age += dt;
    if (sun.age >= 8) collectSun(game, sun.id);
  }
  for (const plant of game.plants) {
    if (plant.hp <= 0) continue;
    const info = PLANTS[plant.type];
    plant.age += dt;
    plant.timer -= dt;
    if (plant.type === "sun" && plant.timer <= 0) {
      dropSun(game, cellX(plant.col) + 22, cellY(plant.row) - 12);
      plant.producedAt = game.time;
      plant.timer += info.interval;
    }
    if (plant.type === "bomb" && plant.age >= 1) {
      for (const enemy of game.enemies) {
        if (Math.hypot(enemy.x - cellX(plant.col), cellY(enemy.row) - cellY(plant.row)) <= 175) enemy.hp -= 340;
      }
      game.effects.push({ id: id(game), kind: "burst", x: cellX(plant.col), y: cellY(plant.row), age: 0 });
      plant.hp = 0;
    }
    if ((plant.type === "pea" || plant.type === "frost") && plant.timer <= 0) {
      const target = game.enemies.some(e => e.hp > 0 && e.row === plant.row && e.x >= cellX(plant.col) - 10);
      if (target) {
        game.shots.push({ id: id(game), row: plant.row, x: cellX(plant.col) + 28, damage: info.damage, frost: plant.type === "frost" });
        plant.shotAt = game.time;
        plant.timer = info.interval;
      } else {
        plant.timer = 0;
      }
    }
  }
  for (const shot of game.shots) {
    const previousX = shot.x;
    shot.x += 330 * dt;
    const target = game.enemies
      .filter(e => e.hp > 0 && e.row === shot.row && e.x + 25 >= previousX && e.x - 25 <= shot.x)
      .sort((a, b) => a.x - b.x)[0];
    if (target) {
      target.hp -= shot.damage;
      if (shot.frost) target.slow = 3;
      shot.x = 1100;
      game.effects.push({ id: id(game), kind: shot.frost ? "ice" : "hit", x: target.x, y: cellY(target.row), age: 0 });
    }
  }
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) {
      game.stats.defeated++;
      game.effects.push({ id: id(game), kind: "fall", type: enemy.type, x: enemy.x, y: cellY(enemy.row), age: 0 });
      continue;
    }
    const info = ENEMIES[enemy.type];
    enemy.age += dt;
    enemy.slow = Math.max(0, enemy.slow - dt);
    const meal = game.plants
      .filter(p => p.hp > 0 && p.row === enemy.row && Math.abs(enemy.x - cellX(p.col)) < 46)
      .sort((a, b) => b.col - a.col)[0];
    if (enemy.eating !== Boolean(meal)) enemy.motionAt = game.time;
    enemy.eating = Boolean(meal);
    if (meal) {
      meal.hp -= info.bite * dt;
      if (meal.hurtAt === undefined || game.time - meal.hurtAt >= .48) meal.hurtAt = game.time;
    } else {
      const speed = enemy.slow > 0 ? (enemy.type === "umbrella" ? .8 : .48) : 1;
      enemy.x -= info.speed * speed * dt;
    }
    if (enemy.x < -25) {
      game.lives = Math.max(0, game.lives - 1);
      enemy.escaped = true;
      game.effects.push({ id: id(game), kind: "heart", x: 30, y: cellY(enemy.row), age: 0 });
    }
  }
  game.plants = game.plants.filter(p => p.hp > 0);
  game.enemies = game.enemies.filter(e => e.hp > 0 && !e.escaped);
  game.shots = game.shots.filter(s => s.x < 1000);
  advanceEffects(game, dt);
  if (game.lives <= 0) game.status = "lost";
  else if (game.nextSpawn === schedule.length && game.enemies.length === 0) game.status = "won";
}

// Visual-only effects can finish after a terminal result without ticking combat.
export function advanceEffects(game, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  for (const effect of game.effects) effect.age += Math.min(dt, .1);
  game.effects = game.effects.filter(e => e.age < (e.kind === "fall" ? FALL_DURATION : e.kind === "burst" ? BURST_DURATION : .5));
}

const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const list = (value, max, check) => Array.isArray(value) && value.length <= max && value.every(check);
const position = p => integer(p.row, 0, 4) && integer(p.col, 0, 8);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
export function validSnapshot(g) {
  if (!object(g) || g.version !== 1 || !integer(g.stage, 1, 10) || g.status !== "playing") return false;
  if (g.rulesVersion !== undefined && g.rulesVersion !== 2) return false;
  if (!finite(g.time, 0, 100000) || !integer(g.sun, 0, 1000000) || !integer(g.lives, 1, 3) || !integer(g.nextId, 1, 10000000)) return false;
  if (!integer(g.nextSpawn, 0, STAGES[g.stage - 1].count) || !finite(g.skyTimer, -1, 6) || !integer(g.wave, 0, 3)) return false;
  if (!object(g.cooldowns) || !Object.keys(PLANTS).every(t => finite(g.cooldowns[t], 0, PLANTS[t].recharge))) return false;
  if (!object(g.stats) || !["planted", "defeated", "collected"].every(k => integer(g.stats[k], 0, 1000000))) return false;
  const hasId = p => object(p) && integer(p.id, 1, g.nextId - 1);
  const eventTime = value => value === undefined || finite(value, 0, g.time);
  if (!list(g.plants, 45, p => hasId(p) && Object.hasOwn(PLANTS, p.type) && position(p) && finite(p.hp, .000001, PLANTS[p.type].hp) && finite(p.timer, -100000, 10) && finite(p.age, 0, 100000))) return false;
  if (new Set(g.plants.map(p => `${p.row}:${p.col}`)).size !== g.plants.length) return false;
  if (!g.plants.every(p => eventTime(p.shotAt) && eventTime(p.hurtAt) && eventTime(p.producedAt))) return false;
  if (!list(g.enemies, 40, e => hasId(e) && Object.hasOwn(ENEMIES, e.type) && integer(e.row, 0, 4) && finite(e.x, -25, 1000) && finite(e.hp, .000001, ENEMIES[e.type].hp) && finite(e.slow, 0, 3) && finite(e.age, 0, 100000) && typeof e.eating === "boolean")) return false;
  if (!g.enemies.every(e => eventTime(e.motionAt))) return false;
  if (!list(g.shots, 500, s => hasId(s) && integer(s.row, 0, 4) && finite(s.x, 0, 1000) && [15, 18, 22].includes(s.damage) && typeof s.frost === "boolean")) return false;
  if (!list(g.suns, 100, s => hasId(s) && finite(s.x, 50, 850) && finite(s.y, 50, 450) && finite(s.age, 0, 8) && s.value === 25)) return false;
  const ids = [...g.plants, ...g.enemies, ...g.shots, ...g.suns].map(p => p.id);
  return new Set(ids).size === ids.length;
}

export function snapshot(game) {
  return structuredClone({ ...game, effects: [] });
}
