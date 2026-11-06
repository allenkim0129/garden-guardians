export const ROWS = 5;
export const COLS = 9;
export const WIDTH = 900;
export const HEIGHT = 500;
export const FALL_DURATION = .88;
export const BURST_DURATION = .75;
export const GEAR_DURATION = 1.1;
export const LOADOUT_LIMIT = 6;
export const TWIN_GAP = .2;
export const THORN_HITS = 3;
export const PUMPKIN_RADIUS = 115;
export const PLANTS = Object.freeze({
  sun: { name: "햇살봉", unlockStage: 1, cost: 50, hp: 100, recharge: 5, interval: 8, description: "8초마다 햇빛 25를 만들어요." },
  pea: { name: "콩별이", unlockStage: 1, cost: 125, hp: 120, recharge: 6, interval: 1.6, damage: 18, description: "앞으로 초록 완두콩을 톡톡 쏘아요." },
  wall: { name: "도토리벽", unlockStage: 2, cost: 75, hp: 650, recharge: 8, description: "튼튼한 몸으로 좀비를 막아요." },
  frost: { name: "서리초", unlockStage: 3, cost: 125, hp: 100, recharge: 5, interval: 1.6, damage: 15, description: "얼음 결정을 쏴 좀비를 3초 동안 느리게 해요." },
  bomb: { name: "방울폭탄", unlockStage: 4, cost: 125, hp: 150, recharge: 16, description: "1초 뒤 주변 좀비에게 큰 피해!" },
  twin: { name: "쌍콩이", unlockStage: 5, cost: 225, hp: 120, recharge: 9, interval: 2, damage: 18, description: "2초마다 위아래 꼬투리에서 콩을 0.2초 간격으로 두 번 쏴요." },
  thorn: { name: "가시풀", unlockStage: 6, cost: 200, hp: 100, recharge: 9, interval: 2.8, damage: 26, description: "2.8초마다 같은 줄의 좀비를 최대 3명 관통하는 가시를 쏴요." },
  pumpkin: { name: "호박포", unlockStage: 7, cost: 225, hp: 130, recharge: 10, interval: 3.8, damage: 55, description: "3.8초마다 호박탄을 던져 착지점 반경 약 한 칸에 피해를 줘요." },
  lantern: { name: "해등나무", unlockStage: 8, cost: 125, hp: 140, recharge: 10, interval: 10, description: "10초마다 햇빛 50을 만들어요. 첫 햇빛도 10초 뒤에 나와요." },
  iron: { name: "철잎보루", unlockStage: 9, cost: 150, hp: 1500, recharge: 14, description: "체력 1500의 철잎으로 막아요. 튼튼하지만 다시 심기까지 14초!" },
});
export const ENEMIES = Object.freeze({
  sleepy: { name: "잠옷좀비", hp: 110, speed: 17, bite: 22, description: "졸려도 정원 산책은 좋아해요." },
  jelly: { name: "젤리좀비", hp: 340, speed: 13, bite: 25, description: "느리지만 아주 튼튼해요." },
  roller: { name: "롤러좀비", hp: 95, speed: 31, bite: 18, description: "롤러스케이트로 빠르게 와요." },
  umbrella: { name: "우산좀비", hp: 175, speed: 18, bite: 23, description: "65 피해를 받으면 우산을 놓치고 보통 걸음과 추위 저항으로 바뀌어요." },
});
export const STAGES = [
  { name: "첫 번째 새싹", count: 8, gap: 6.5, types: ["sleepy"], rows: [2, 1, 3, 0, 4], startSun: 250, tip: "햇살봉으로 햇빛을 모으고, 좀비가 오는 줄에 콩별이를 심어요." },
  { name: "아침 산책", count: 12, gap: 5.2, types: ["sleepy"], rows: [0, 4, 2, 1, 3], startSun: 250, tip: "새 친구 도토리벽! 콩별이 앞에 심어 좀비를 붙잡아요." },
  { name: "말랑말랑 손님", count: 14, gap: 4.8, types: ["sleepy", "sleepy", "jelly"], startSun: 275, tip: "새 친구 서리초! 얼음 결정으로 좀비를 느리게 해요." },
  { name: "씽씽 정원길", count: 17, gap: 4.3, types: ["sleepy", "roller", "sleepy"], startSun: 275, tip: "새 친구 방울폭탄! 좀비가 모인 곳에서 한 번에 펑!" },
  { name: "우산 쓴 소풍", count: 20, gap: 4, types: ["sleepy", "umbrella", "roller"], startSun: 300, tip: "새 친구 쌍콩이! 두 번 쏘지만 비싸요. 콩별이와 함께 줄을 지켜요." },
  { name: "점심시간 소동", count: 23, gap: 3.7, types: ["sleepy", "jelly", "roller", "umbrella"], startSun: 300, tip: "새 친구 가시풀! 같은 줄에 모인 좀비를 최대 세 명 관통해요." },
  { name: "반짝이는 연못", count: 26, gap: 3.4, types: ["umbrella", "roller", "sleepy", "jelly"], startSun: 325, tip: "새 친구 호박포! 도토리벽으로 붙잡으면 착지점에 모인 좀비를 맞히기 좋아요." },
  { name: "꼬불꼬불 덩굴", count: 30, gap: 3.1, types: ["roller", "jelly", "sleepy", "umbrella"], startSun: 325, tip: "새 친구 해등나무! 더 많은 햇빛을 만들지만 첫 수확까지 기다려야 해요." },
  { name: "노을빛 파티", count: 34, gap: 2.8, types: ["jelly", "umbrella", "roller", "sleepy"], startSun: 350, tip: "새 친구 철잎보루! 오래 버티지만 비용과 다시 심는 시간을 생각해요." },
  { name: "우리들의 정원", count: 40, gap: 2.5, types: ["jelly", "roller", "umbrella", "sleepy", "jelly"], startSun: 350, tip: "마지막 소풍이에요. 함께할 여덟 친구를 골라 정원을 지켜요!" },
].map((stage, i) => Object.freeze({ ...stage, legacyRows: i === 0 ? [2, 1, 3] : stage.rows, legacyCount: stage.count, count: Math.ceil(stage.count * 1.4), id: i + 1 }));

export function isPlantUnlocked(type, stage) {
  return Object.hasOwn(PLANTS, type) && Number.isInteger(stage) && stage >= PLANTS[type].unlockStage && stage <= STAGES.length;
}
export function introducedPlants(stage) {
  return Object.entries(PLANTS).filter(([, plant]) => plant.unlockStage === stage).map(([type]) => type);
}

export function scheduleFor(stageNumber, pacingVersion = 4) {
  const stage = STAGES[stageNumber - 1];
  if (!stage) throw new RangeError("없는 스테이지입니다.");
  const rows = (pacingVersion < 3 ? stage.legacyRows : stage.rows) ?? [2, 0, 4, 1, 3];
  if (pacingVersion === 1) {
    return Array.from({ length: stage.legacyCount }, (_, i) => ({
      at: 12 + i * stage.gap + Math.floor(i / Math.ceil(stage.legacyCount / 3)) * 7,
      row: rows[i % rows.length],
      type: stage.types[i % stage.types.length],
      wave: Math.min(3, Math.floor(i / Math.ceil(stage.legacyCount / 3)) + 1),
    }));
  }
  if (pacingVersion >= 4) {
    const first = stageNumber === 1 ? 1 : 2;
    const second = Math.ceil(stage.count * .25);
    const middleGap = Math.max(3, stage.gap * .9);
    const finalAt = Math.max(90, 55 + (second - 1) * middleGap + 12);
    return Array.from({ length: stage.count }, (_, i) => {
      const wave = i < first ? 1 : i < first + second ? 2 : 3;
      const at = wave === 1 ? 25 + i * 14
        : wave === 2 ? 55 + (i - first) * middleGap
          : finalAt + (i - first - second) * stage.gap * .3;
      return { at, row: rows[i % rows.length], type: wave === 1 ? "sleepy" : stage.types[i % stage.types.length], wave };
    });
  }
  const first = Math.ceil(stage.legacyCount * .2);
  const second = Math.ceil(stage.legacyCount * .3);
  let at = 18;
  return Array.from({ length: stage.count }, (_, i) => {
    const wave = i < first ? 1 : i < first + second ? 2 : 3;
    if (i > 0) at += stage.gap * [1.2, .75, .3][wave - 1] + (i === first || i === first + second ? 7 : 0);
    return { at, row: rows[i % rows.length], type: stage.types[i % stage.types.length], wave };
  });
}

export function waveProgress(game) {
  const schedule = scheduleFor(game.stage, game.pacingVersion ?? 1);
  const end = schedule.at(-1).at;
  return {
    percent: game.status === "won" ? 100 : Math.min(100, game.time / end * 100),
    total: schedule.length,
    remaining: schedule.length - game.nextSpawn + game.enemies.length,
    markers: [2, 3].map(wave => ({ wave, percent: schedule.find(spawn => spawn.wave === wave).at / end * 100 })),
  };
}

export function loadoutLimit(stage) {
  return stage >= 10 ? 8 : LOADOUT_LIMIT;
}
export function validLoadout(loadout, stage) {
  return Array.isArray(loadout) && loadout.length >= 1 && loadout.length <= loadoutLimit(stage)
    && new Set(loadout).size === loadout.length && loadout.every(type => isPlantUnlocked(type, stage));
}
export function isPlantAvailable(game, type) {
  return isPlantUnlocked(type, game.stage) && (game.loadout === undefined || game.loadout.includes(type));
}
export function createGame(stageNumber, loadout) {
  const stage = STAGES[stageNumber - 1];
  if (!stage) throw new RangeError("없는 스테이지입니다.");
  if (loadout !== undefined && !validLoadout(loadout, stageNumber)) throw new RangeError(`함께할 식물을 1~${loadoutLimit(stageNumber)}종 골라 주세요.`);
  return {
    version: 1, rulesVersion: 3, pacingVersion: 4, stage: stageNumber, status: "playing", time: 0, sun: stage.startSun,
    ...(loadout === undefined ? {} : { loadout: [...loadout] }),
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
  if (!isPlantAvailable(game, type)) return { ok: false, reason: "이번 정원에 고른 식물이 아니에요." };
  if (game.plants.some(p => p.row === row && p.col === col)) return { ok: false, reason: "이미 친구가 있어요. 다른 땅을 골라 주세요." };
  if (game.sun < info.cost) return { ok: false, reason: "햇빛이 부족해요. 반짝이는 햇빛을 모아 주세요." };
  if (game.cooldowns[type] > 0) return { ok: false, reason: "친구가 준비 중이에요. 조금만 기다려 주세요." };
  game.sun -= info.cost;
  game.cooldowns[type] = info.recharge;
  game.plants.push({ id: id(game), type, row, col, hp: info.hp, timer: type === "sun" ? 6 : type === "lantern" ? 10 : .2, age: 0 });
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

function dropSun(game, x, y, value = 25) {
  game.suns.push({ id: id(game), x: Math.max(50, Math.min(850, x)), y: Math.max(50, Math.min(450, y)), age: 0, value });
}
function fireShot(game, plant, target, muzzle = 0) {
  const info = PLANTS[plant.type];
  const shot = { id: id(game), row: plant.row, x: cellX(plant.col) + 28, damage: info.damage, frost: plant.type === "frost" };
  if (plant.type === "twin") Object.assign(shot, { kind: "twin", muzzle });
  if (plant.type === "thorn") Object.assign(shot, { kind: "thorn", hitIds: [] });
  if (plant.type === "pumpkin") Object.assign(shot, {
    kind: "pumpkin", originX: shot.x, targetX: target.x, age: 0,
    duration: Math.max(.45, Math.min(1.6, Math.abs(target.x - shot.x) / 260)),
  });
  game.shots.push(shot);
}
export function collectSun(game, sunId) {
  const index = game.suns.findIndex(sun => sun.id === sunId);
  if (index < 0 || game.status !== "playing") return false;
  const [sun] = game.suns.splice(index, 1);
  game.sun += sun.value;
  game.stats.collected += sun.value;
  return true;
}

export function sunsAlongPath(game, from, to, radius) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  return game.suns.filter(sun => {
    const fraction = length ? Math.max(0, Math.min(1, ((sun.x - from.x) * dx + (sun.y - from.y) * dy) / length)) : 0;
    return Math.hypot(sun.x - from.x - dx * fraction, sun.y - from.y - dy * fraction) <= radius;
  }).map(sun => sun.id);
}

export function equipmentThreshold(type) {
  return type === "umbrella" ? ENEMIES.umbrella.hp - 65 : ENEMIES[type].hp * .5;
}
function damageEnemy(game, enemy, damage, frost = false) {
  if (enemy.hp <= 0) return;
  enemy.hp -= damage;
  enemy.hurtAt = game.time;
  if (frost) enemy.slow = 3;
  game.effects.push({ id: id(game), kind: frost ? "ice" : "hit", type: enemy.type, x: enemy.x, y: cellY(enemy.row), age: 0 });
  if (!enemy.equipmentDropped && enemy.hp <= equipmentThreshold(enemy.type)) {
    enemy.equipmentDropped = true;
    game.effects.push({ id: id(game), kind: "gear", type: enemy.type, x: enemy.x, y: cellY(enemy.row), age: 0 });
  }
}

export function tick(game, dt) {
  if (game.status !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
  // Large wall-clock gaps must never make enemies jump past a plant.
  dt = Math.min(dt, .1);
  game.time += dt;
  for (const type of Object.keys(PLANTS)) game.cooldowns[type] = Math.max(0, game.cooldowns[type] - dt);
  const schedule = scheduleFor(game.stage, game.pacingVersion ?? 1);
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
    if ((plant.type === "sun" || plant.type === "lantern") && plant.timer <= 0) {
      dropSun(game, cellX(plant.col) + 22, cellY(plant.row) - 12, plant.type === "lantern" ? 50 : 25);
      plant.producedAt = game.time;
      plant.timer += info.interval;
    }
    if (plant.type === "bomb" && plant.age >= 1) {
      for (const enemy of game.enemies) {
        if (Math.hypot(enemy.x - cellX(plant.col), cellY(enemy.row) - cellY(plant.row)) <= 175) damageEnemy(game, enemy, 340);
      }
      game.effects.push({ id: id(game), kind: "burst", x: cellX(plant.col), y: cellY(plant.row), age: 0 });
      plant.hp = 0;
    }
    if (plant.pendingShotAt !== undefined && game.time + 1e-9 >= plant.pendingShotAt) {
      fireShot(game, plant, null, 1);
      delete plant.pendingShotAt;
    }
    if (info.damage && plant.timer <= 0) {
      const target = game.enemies.filter(e => e.hp > 0 && e.row === plant.row && e.x >= cellX(plant.col) - 10)
        .sort((a, b) => a.x - b.x)[0];
      if (target) {
        fireShot(game, plant, target);
        if (plant.type === "twin") plant.pendingShotAt = game.time + TWIN_GAP;
        plant.shotAt = game.time;
        plant.timer = info.interval;
      } else {
        plant.timer = 0;
      }
    }
  }
  for (const shot of game.shots) {
    if (shot.kind === "pumpkin") {
      shot.age += dt;
      shot.x = shot.originX + (shot.targetX - shot.originX) * Math.min(1, shot.age / shot.duration);
      if (shot.age >= shot.duration) {
        for (const enemy of game.enemies) {
          if (Math.hypot(enemy.x - shot.targetX, (enemy.row - shot.row) * 100) <= PUMPKIN_RADIUS) damageEnemy(game, enemy, shot.damage);
        }
        game.effects.push({ id: id(game), kind: "splash", x: shot.targetX, y: cellY(shot.row), age: 0 });
        shot.x = 1100;
      }
      continue;
    }
    const previousX = shot.x;
    shot.x += 330 * dt;
    const targets = game.enemies
      .filter(e => e.hp > 0 && e.row === shot.row && e.x + 25 >= previousX && e.x - 25 <= shot.x && (shot.kind !== "thorn" || !shot.hitIds.includes(e.id)))
      .sort((a, b) => a.x - b.x);
    for (const target of targets) {
      damageEnemy(game, target, shot.damage, shot.frost);
      if (shot.kind === "thorn") shot.hitIds.push(target.id);
      if (shot.kind !== "thorn" || shot.hitIds.length >= THORN_HITS) { shot.x = 1100; break; }
    }
  }
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) {
      game.stats.defeated++;
      game.effects.push({ id: id(game), kind: "fall", type: enemy.type, equipmentDropped: enemy.equipmentDropped, x: enemy.x, y: cellY(enemy.row), age: 0 });
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
      const bareUmbrella = enemy.type === "umbrella" && enemy.equipmentDropped;
      const speed = enemy.slow > 0 ? (enemy.type === "umbrella" && !bareUmbrella ? .8 : .48) : 1;
      enemy.x -= (bareUmbrella ? ENEMIES.sleepy.speed : info.speed) * speed * dt;
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
  game.effects = game.effects.filter(e => e.age < (e.kind === "gear" ? GEAR_DURATION : e.kind === "fall" ? FALL_DURATION : e.kind === "burst" ? BURST_DURATION : .5));
}

const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const list = (value, max, check) => Array.isArray(value) && value.length <= max && value.every(check);
const position = p => integer(p.row, 0, 4) && integer(p.col, 0, 8);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
export function validSnapshot(g) {
  if (!object(g) || g.version !== 1 || !integer(g.stage, 1, 10) || g.status !== "playing") return false;
  if (g.rulesVersion !== undefined && ![2, 3].includes(g.rulesVersion)) return false;
  if (g.pacingVersion !== undefined && ![1, 2, 3, 4].includes(g.pacingVersion)) return false;
  if (g.loadout !== undefined && !validLoadout(g.loadout, g.stage)) return false;
  if (!finite(g.time, 0, 100000) || !integer(g.sun, 0, 1000000) || !integer(g.lives, 1, 3) || !integer(g.nextId, 1, 10000000)) return false;
  if (!integer(g.nextSpawn, 0, scheduleFor(g.stage, g.pacingVersion ?? 1).length) || !finite(g.skyTimer, -1, 6) || !integer(g.wave, 0, 3)) return false;
  if (!object(g.cooldowns) || !Object.keys(PLANTS).every(t => finite(g.cooldowns[t], 0, PLANTS[t].recharge)
    || (g.rulesVersion !== 3 && PLANTS[t].unlockStage >= 5 && g.cooldowns[t] === undefined))) return false;
  if (!object(g.stats) || !["planted", "defeated", "collected"].every(k => integer(g.stats[k], 0, 1000000))) return false;
  const hasId = p => object(p) && integer(p.id, 1, g.nextId - 1);
  const eventTime = value => value === undefined || finite(value, 0, g.time);
  if (!list(g.plants, 45, p => hasId(p) && Object.hasOwn(PLANTS, p.type) && position(p) && finite(p.hp, .000001, PLANTS[p.type].hp) && finite(p.timer, -100000, 10) && finite(p.age, 0, 100000))) return false;
  if (new Set(g.plants.map(p => `${p.row}:${p.col}`)).size !== g.plants.length) return false;
  if (!g.plants.every(p => eventTime(p.shotAt) && eventTime(p.hurtAt) && eventTime(p.producedAt))) return false;
  if (!g.plants.every(p => p.pendingShotAt === undefined || (p.type === "twin" && finite(p.shotAt, 0, g.time)
    && finite(p.pendingShotAt, g.time, g.time + TWIN_GAP) && Math.abs(p.pendingShotAt - p.shotAt - TWIN_GAP) < 1e-8))) return false;
  if (!list(g.enemies, STAGES[g.stage - 1].count, e => hasId(e) && Object.hasOwn(ENEMIES, e.type) && integer(e.row, 0, 4) && finite(e.x, -25, 1000) && finite(e.hp, .000001, ENEMIES[e.type].hp) && finite(e.slow, 0, 3) && finite(e.age, 0, 100000) && typeof e.eating === "boolean")) return false;
  if (!g.enemies.every(e => eventTime(e.motionAt) && eventTime(e.hurtAt)
    && (e.equipmentDropped === undefined || (typeof e.equipmentDropped === "boolean"
      && (!e.equipmentDropped || e.hp <= equipmentThreshold(e.type)))))) return false;
  if (!list(g.shots, 500, s => {
    if (!hasId(s) || !integer(s.row, 0, 4) || !finite(s.x, 0, 1000) || typeof s.frost !== "boolean") return false;
    if (s.kind === undefined) return [15, 18, 22].includes(s.damage);
    if (s.frost) return false;
    if (s.kind === "twin") return s.damage === PLANTS.twin.damage && integer(s.muzzle, 0, 1);
    if (s.kind === "thorn") return s.damage === PLANTS.thorn.damage && list(s.hitIds, THORN_HITS - 1, n => integer(n, 1, g.nextId - 1) && n !== s.id)
      && new Set(s.hitIds).size === s.hitIds.length;
    return s.kind === "pumpkin" && s.damage === PLANTS.pumpkin.damage && finite(s.originX, 78, 878)
      && finite(s.targetX, 0, 1000) && finite(s.duration, .45, 1.6) && finite(s.age, 0, s.duration)
      && Math.abs(s.x - (s.originX + (s.targetX - s.originX) * s.age / s.duration)) < 1e-7;
  })) return false;
  if (!list(g.suns, 100, s => hasId(s) && finite(s.x, 50, 850) && finite(s.y, 50, 450) && finite(s.age, 0, 8) && [25, 50].includes(s.value))) return false;
  const ids = [...g.plants, ...g.enemies, ...g.shots, ...g.suns].map(p => p.id);
  return new Set(ids).size === ids.length;
}

export function snapshot(game) {
  return structuredClone({ ...game, effects: [] });
}
