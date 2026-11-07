export const ROWS = 5;
export const COLS = 10;
export const WIDTH = COLS * 100;
export const HEIGHT = 500;
export const FALL_DURATION = .88;
export const BURST_DURATION = .75;
export const GEAR_DURATION = 1.1;
export const LOADOUT_LIMIT = 6;
export const TWIN_GAP = .2;
export const THORN_HITS = 3;
export const PUMPKIN_RADIUS = 115;
export const FIRE_RADIUS = 105;
export const BURN_DURATION = 3;
export const BURN_DAMAGE = 4;
export const BOMB_DAMAGE = 300;
export const CHAIN_RANGE = 155;
export const CHAIN_HITS = 5;
export const CHAIN_GAP = .12;
export const LASER_DURATION = .24;
export const SKY_SUN_INTERVAL = 7;
export const REGROUP_DURATION = 30;
export const SHURIKEN_SPEED = 360;
export const PLANTS = Object.freeze({
  sun: { name: "햇살봉", unlockStage: 1, cost: 50, hp: 100, recharge: 4, firstHarvest: 5, interval: 8, description: "첫 햇빛은 5초 뒤, 이후 8초마다 햇빛 25를 만들어요." },
  pea: { name: "콩별이", unlockStage: 1, cost: 125, hp: 120, recharge: 5, interval: 1.6, damage: 12, description: "1.6초마다 12 피해의 콩을 쏘는 기본 공격 식물이에요." },
  wall: { name: "도토리벽", unlockStage: 2, cost: 75, hp: 650, recharge: 7, description: "튼튼한 몸으로 좀비를 막아요." },
  frost: { name: "서리초", unlockStage: 3, cost: 125, hp: 100, recharge: 4, interval: 1.6, damage: 6, description: "1.6초마다 6 피해와 3초 둔화! 강한 공격 식물과 함께 심어요." },
  bomb: { name: "방울폭탄", unlockStage: 4, cost: 125, hp: 150, recharge: 14, description: "1초 뒤 주변 좀비에게 큰 피해!" },
  twin: { name: "쌍콩이", unlockStage: 5, cost: 225, hp: 120, recharge: 8, interval: 2, damage: 33, description: "2초마다 33 피해의 콩 두 발을 0.2초 간격으로 쏘는 주력 공격 식물이에요." },
  thorn: { name: "가시풀", unlockStage: 6, cost: 200, hp: 100, recharge: 8, interval: 2.8, damage: 36, description: "2.8초마다 같은 줄의 좀비를 최대 3명 관통하며 각각 36 피해를 주는 가시를 쏴요." },
  pumpkin: { name: "호박포", unlockStage: 7, cost: 300, hp: 130, recharge: 9, interval: 4.5, damage: 96, description: "4.5초마다 반경 약 한 칸에 96 피해! 비싸고 발사가 느리니 방어·둔화 식물로 지켜 주세요." },
  lantern: { name: "해등나무", unlockStage: 8, cost: 125, hp: 140, recharge: 9, firstHarvest: 8, interval: 10, description: "첫 햇빛은 8초 뒤, 이후 10초마다 햇빛 50을 만들어요." },
  iron: { name: "철잎보루", unlockStage: 9, cost: 150, hp: 1500, recharge: 12, description: "체력 1500의 철잎으로 막아요. 튼튼하지만 다시 심기까지 12초!" },
  ember: { name: "불꽃봉오리", unlockStage: 10, cost: 200, hp: 110, recharge: 9, interval: 3.2, damage: 15, description: "3.2초마다 불씨를 쏴 반경 약 한 칸에 15 피해, 3초 동안 초당 4 화상 피해로 공격을 도와요. 화상은 중첩되지 않아요." },
  storm: { name: "번개가시", unlockStage: 19, cost: 275, hp: 110, recharge: 10, interval: 4.2, damage: 64, description: "가시풀의 상위형! 4.2초마다 노란 번개가 가까운 좀비를 타고 옆줄까지 이어져요. 적 사이 1.55칸 안에서 최대 5명에게 각각 한 번씩 64 피해!" },
  cactus: { name: "선인장", unlockStage: 22, cost: 400, hp: 160, recharge: 20, maxCount: 2, firstAttack: 3, interval: 3, description: "심고 3초 뒤부터 3초마다 머리 위 빨간 구슬에서 레이저를 쏴 앞쪽 같은 줄의 가장 가까운 좀비 한 마리만 즉사시켜요. 뒤쪽과 다른 줄은 공격하지 않아요. 다시 심기까지 20초, 정원에 동시에 최대 2개!" },
  shuriken: { name: "표창잎", unlockStage: 15, cost: 300, hp: 110, recharge: 10, damage: 36, description: "손의 표창이 같은 줄 오른쪽 끝까지 날아갔다 돌아와요. 갈 때와 올 때 적마다 한 번씩 36 피해! 한 개만 날리며 회수 즉시 다시 던져요. 가까이 심으면 빨리 돌아오지만 좀비에게 물리기 쉬워요." },
});
const LEGACY_RECHARGES = Object.freeze({ sun: 5, pea: 6, wall: 8, frost: 5, bomb: 16, twin: 9, thorn: 9, pumpkin: 10, lantern: 10, iron: 14, ember: 10 });
export const ENEMIES = Object.freeze({
  sleepy: { name: "잠옷좀비", hp: 110, speed: 17, bite: 22, description: "졸려도 정원 산책은 좋아해요." },
  jelly: { name: "젤리좀비", hp: 340, speed: 13, bite: 25, description: "느리지만 아주 튼튼해요." },
  roller: { name: "롤러좀비", hp: 95, speed: 31, bite: 18, description: "롤러스케이트로 빠르게 와요." },
  umbrella: { name: "우산좀비", hp: 175, speed: 18, bite: 23, description: "65 피해를 받으면 우산을 놓치고 보통 걸음과 추위 저항으로 바뀌어요." },
  barrel: { name: "통나무좀비", hp: 400, speed: 12, bite: 32, description: "튼튼한 나무통을 입었어요. 체력이 절반이 되면 통이 깨져 걸음이 18로 빨라져요." },
  courier: { name: "배달좀비", hp: 120, speed: 34, bite: 20, description: "오아시스의 물통 상자를 들고 달려와요. 체력이 절반이 되면 상자를 떨어뜨리고 속도가 22로 줄어요." },
});
export const THEMES = Object.freeze([
  { id: "garden", title: "1~10 · 햇살 정원" },
  { id: "moon", title: "11~20 · 달빛 온실 · 도전" },
  { id: "desert", title: "21~30 · 모래 사막 · 격전" },
]);
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
  { name: "우리들의 정원", count: 40, gap: 2.5, types: ["jelly", "roller", "umbrella", "sleepy", "jelly"], startSun: 350, tip: "새 친구 불꽃봉오리! 모인 좀비에게 불씨를 쏴요. 함께할 여덟 친구를 골라 정원을 지켜요!" },
].concat([
  { name: "달빛 온실 입구", count: 70, gap: 2.4, types: ["sleepy", "jelly", "umbrella", "roller", "jelly", "umbrella"], tip: "달빛 온실에 오신 걸 환영해요! 햇빛은 그대로 모이고, 세 번째 손님은 빠른 롤러좀비예요." },
  { name: "반딧불 오솔길", count: 76, gap: 2.3, types: ["roller", "sleepy", "umbrella", "jelly", "roller", "jelly"], tip: "빠른 손님이 여러 줄로 와요. 서리초와 앞줄의 방어 식물을 함께 준비해요." },
  { name: "은빛 유리 지붕", count: 82, gap: 2.2, types: ["umbrella", "jelly", "umbrella", "roller", "sleepy", "jelly"], tip: "우산이 냉기를 막아요. 콩과 불씨로 우산을 먼저 떨어뜨려요." },
  { name: "보랏빛 수련", count: 88, gap: 2.1, types: ["jelly", "roller", "jelly", "umbrella", "jelly", "sleepy"], tip: "젤리좀비가 오래 버텨요. 한 줄 공격과 주변을 맞히는 공격을 섞어 봐요." },
  { name: "별빛 교차로", count: 94, gap: 2.0, types: ["roller", "umbrella", "jelly", "roller", "jelly", "umbrella"], tip: "다섯 줄을 골고루 지켜요. 빈 줄은 빠른 좀비가 먼저 찾아와요." },
  { name: "이슬 맺힌 회랑", count: 100, gap: 1.9, types: ["umbrella", "jelly", "jelly", "roller", "umbrella", "roller"], tip: "중간 무리부터 간격이 좁아져요. 해등나무로 햇빛을 확보하고 방어선을 보강해요." },
  { name: "푸른 덩굴 미로", count: 106, gap: 1.8, types: ["jelly", "umbrella", "roller", "jelly", "umbrella", "jelly"], tip: "튼튼한 손님 뒤에 빠른 손님이 따라와요. 가시풀로 뒤쪽 적까지 맞혀요." },
  { name: "한밤의 분수", count: 112, gap: 1.75, types: ["roller", "jelly", "umbrella", "jelly", "roller", "umbrella"], tip: "몰려오는 무리를 철잎보루로 붙잡고 호박포와 불꽃봉오리로 함께 맞혀요." },
  { name: "새벽 전의 그림자", count: 118, gap: 1.7, types: ["jelly", "umbrella", "jelly", "roller", "jelly", "umbrella"], tip: "마지막 무리가 아주 커요. 방울폭탄을 쓸 햇빛과 빈 칸을 남겨 두세요." },
  { name: "온실의 마지막 밤", count: 124, gap: 1.65, types: ["jelly", "roller", "umbrella", "jelly", "umbrella", "roller", "jelly"], tip: "달빛 온실의 마지막 도전! 여덟 친구의 역할을 나누고 무너진 줄을 바로 보강해요." },
].map(stage => ({ ...stage, theme: "moon", startSun: 350 }))).concat([
  { name: "사막의 문", count: 126, gap: 1.6, types: ["barrel", "sleepy", "umbrella", "jelly", "roller"], tip: "모래 사막에 오신 걸 환영해요! 통나무좀비를 집중 공격하고 통이 깨진 뒤 빨라진 걸음에 대비해요." },
  { name: "오아시스 배달길", count: 132, gap: 1.56, types: ["courier", "barrel", "roller", "jelly", "umbrella"], tip: "오아시스에서 배달좀비가 달려와요! 서리초로 늦추고 방어 식물 뒤에서 물통 상자를 떨어뜨려요." },
  { name: "사암 협곡", count: 138, gap: 1.52, types: ["barrel", "jelly", "umbrella", "courier", "barrel"], tip: "나무통 무리가 길을 막아요. 쌍콩이로 집중 공격하고 가시풀로 뒤쪽 적까지 맞혀요." },
  { name: "모래 소용돌이", count: 144, gap: 1.48, types: ["courier", "roller", "barrel", "umbrella", "jelly"], tip: "빠른 적과 느린 적이 섞여 와요. 방어선을 세우고 방울폭탄을 준비해요." },
  { name: "번개가시 언덕", count: 150, gap: 1.44, types: ["barrel", "courier", "jelly", "umbrella", "courier"], tip: "가시풀의 상위형 번개가시! 붙어 있는 옆줄의 좀비까지 번개를 이어 보내요." },
  { name: "모래바람 다리", count: 156, gap: 1.4, types: ["courier", "barrel", "jelly", "barrel", "roller"], tip: "앞줄은 방어, 뒷줄은 집중 공격! 번개가시는 모인 적을 상대하게 해요." },
  { name: "붉은 바위 미로", count: 162, gap: 1.36, types: ["barrel", "umbrella", "courier", "jelly", "barrel"], tip: "통이 깨지면 적이 빨라져요. 빈 방어 칸을 바로 채워 주세요." },
  { name: "신기루 오아시스", count: 168, gap: 1.32, types: ["courier", "roller", "barrel", "courier", "umbrella"], tip: "선인장은 3초마다 앞쪽 같은 줄의 가장 가까운 좀비 한 마리만 즉사시켜요. 첫 공격도 3초! 다른 줄과 뒤쪽은 친구들로 지켜요." },
  { name: "마지막 모래언덕", count: 174, gap: 1.28, types: ["barrel", "jelly", "courier", "barrel", "umbrella"], tip: "튼튼한 무리 뒤에 빠른 적이 숨어 있어요. 집중 공격과 범위 공격을 함께 써요." },
  { name: "사막의 수호자", count: 180, gap: 1.24, types: ["barrel", "courier", "jelly", "umbrella", "barrel", "courier"], tip: "사막의 마지막 도전! 여덟 친구를 조합하고 비상용 햇빛을 남겨 두세요." },
].map(stage => ({ ...stage, theme: "desert", startSun: 350 })))
  .map((stage, i) => Object.freeze({ ...stage, theme: stage.theme ?? "garden", legacyRows: i === 0 ? [2, 1, 3] : stage.rows,
    legacyCount: stage.count, previousCount: stage.theme ? stage.count : Math.ceil(stage.count * 1.4),
    count: stage.theme === "moon" ? 28 + (i - 10) * 4 : stage.theme === "desert" ? 36 + (i - 20) * 6 : Math.ceil(stage.count * 1.4),
    hpMultiplier: stage.theme === "moon" ? 1.3 : stage.theme === "desert" ? 1.6 : 1, id: i + 1 }));

export const boardColumns = game => game.columns ?? 9;
export const boardWidth = game => boardColumns(game) * 100;

export function isPlantUnlocked(type, stage) {
  return Object.hasOwn(PLANTS, type) && Number.isInteger(stage) && stage >= PLANTS[type].unlockStage && stage <= STAGES.length;
}
export function introducedPlants(stage) {
  return Object.entries(PLANTS).filter(([, plant]) => plant.unlockStage === stage).map(([type]) => type);
}

export function plantDamageLabel(type, compact = false) {
  const plant = PLANTS[type];
  if (compact) {
    if (type === "shuriken") return `${plant.damage}↔${plant.damage}`;
    if (type === "cactus") return "즉사";
    if (type === "bomb") return String(BOMB_DAMAGE);
    if (type === "twin") return `${plant.damage}×2`;
    if (type === "ember") return `${plant.damage}+${BURN_DAMAGE}/s`;
    return plant.damage ? String(plant.damage) : "—";
  }
  if (type === "shuriken") return `편도 ${plant.damage} · 왕복 ${plant.damage * 2}`;
  if (type === "cactus") return "전방 1마리 즉사 · 3초";
  if (type === "bomb") return `범위 피해 ${BOMB_DAMAGE}`;
  if (type === "twin") return `피해 ${plant.damage} × 2`;
  if (type === "ember") return `피해 ${plant.damage} + 화상 ${BURN_DAMAGE}/초`;
  if (type === "pumpkin") return `범위 피해 ${plant.damage}`;
  if (type === "thorn" || type === "storm") return `적당 피해 ${plant.damage}`;
  return plant.damage ? `피해 ${plant.damage}` : "공격 없음";
}

export function scheduleFor(stageNumber, pacingVersion = 7) {
  const stage = STAGES[stageNumber - 1];
  if (!stage) throw new RangeError("없는 스테이지입니다.");
  const count = pacingVersion >= 7 ? stage.count : stage.previousCount;
  const rows = (pacingVersion < 3 ? stage.legacyRows : stage.rows) ?? [2, 0, 4, 1, 3];
  if (stage.theme === "moon" || stage.theme === "desert") {
    const desert = stage.theme === "desert";
    const offset = stageNumber - (desert ? 21 : 11);
    const first = 3;
    const second = Math.ceil(count * .28);
    const middleAt = pacingVersion >= 7 ? 55 : (desert ? 54 : 48) - offset * 2 / 3;
    const middleGap = pacingVersion >= 7 ? 3.6 - offset * .1 : stage.gap;
    const finalAt = middleAt + (second - 1) * middleGap + (pacingVersion >= 6 ? REGROUP_DURATION : 10);
    const finalGap = pacingVersion >= 7 ? 1.2 - offset * .04 : desert ? .36 - offset * .01 : .65 - offset * .03;
    return Array.from({ length: count }, (_, i) => {
      const wave = i < first ? 1 : i < first + second ? 2 : 3;
      return {
        at: wave === 1 ? [10, 24, 36][i] : wave === 2 ? middleAt + (i - first) * middleGap : finalAt + (i - first - second) * finalGap,
        row: rows[(i + Math.floor(i / rows.length)) % rows.length],
        type: wave === 1 ? (i === 2 ? (desert ? "barrel" : "roller") : "sleepy") : stage.types[i % stage.types.length],
        wave,
      };
    });
  }
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
    const second = Math.ceil(count * .25);
    const middleGap = Math.max(3, stage.gap * .9);
    const finalAt = Math.max(90, 55 + (second - 1) * middleGap + (pacingVersion >= 6 ? REGROUP_DURATION : 12));
    return Array.from({ length: count }, (_, i) => {
      const wave = i < first ? 1 : i < first + second ? 2 : 3;
      const at = wave === 1 ? (i === 0 && pacingVersion >= 5 ? 10 : 25 + i * 14)
        : wave === 2 ? 55 + (i - first) * middleGap
          : finalAt + (i - first - second) * stage.gap * .3;
      return { at, row: rows[i % rows.length], type: wave === 1 ? "sleepy" : stage.types[i % stage.types.length], wave };
    });
  }
  const first = Math.ceil(stage.legacyCount * .2);
  const second = Math.ceil(stage.legacyCount * .3);
  let at = 18;
  return Array.from({ length: count }, (_, i) => {
    const wave = i < first ? 1 : i < first + second ? 2 : 3;
    if (i > 0) at += stage.gap * [1.2, .75, .3][wave - 1] + (i === first || i === first + second ? 7 : 0);
    return { at, row: rows[i % rows.length], type: stage.types[i % stage.types.length], wave };
  });
}

export function waveProgress(game) {
  const schedule = scheduleFor(game.stage, game.pacingVersion ?? 1);
  const end = schedule.at(-1).at;
  const finalIndex = schedule.findIndex(spawn => spawn.wave === 3);
  const regroupRemaining = (game.pacingVersion ?? 1) >= 6 && game.status === "playing"
    && game.nextSpawn === finalIndex && game.time >= schedule[finalIndex - 1].at
    ? Math.max(0, schedule[finalIndex].at - game.time) : 0;
  return {
    regroupRemaining,
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
export function plantLimitReached(game, type) {
  const limit = PLANTS[type]?.maxCount;
  return limit !== undefined && game.plants.filter(p => p.type === type && p.hp > 0).length >= limit;
}
export function createGame(stageNumber, loadout) {
  const stage = STAGES[stageNumber - 1];
  if (!stage) throw new RangeError("없는 스테이지입니다.");
  if (loadout !== undefined && !validLoadout(loadout, stageNumber)) throw new RangeError(`함께할 식물을 1~${loadoutLimit(stageNumber)}종 골라 주세요.`);
  return {
    version: 1, rulesVersion: 8, pacingVersion: 7, columns: COLS, stage: stageNumber, status: "playing", time: 0, sun: stage.startSun,
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
  if (!Object.hasOwn(PLANTS, type) || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= ROWS || col < 0 || col >= boardColumns(game)) {
    return { ok: false, reason: "정원 안의 빈 땅을 골라 주세요." };
  }
  const info = PLANTS[type];
  if (!isPlantUnlocked(type, game.stage)) return { ok: false, reason: `${info.name}은 ${info.unlockStage}번째 정원부터 함께해요.` };
  if (!isPlantAvailable(game, type)) return { ok: false, reason: "이번 정원에 고른 식물이 아니에요." };
  if (plantLimitReached(game, type)) return { ok: false, reason: "선인장은 정원에 동시에 최대 2개까지만 심을 수 있어요." };
  if (game.plants.some(p => p.row === row && p.col === col)) return { ok: false, reason: "이미 친구가 있어요. 다른 땅을 골라 주세요." };
  if (game.sun < info.cost) return { ok: false, reason: "햇빛이 부족해요. 반짝이는 햇빛을 모아 주세요." };
  if (game.cooldowns[type] > 0) return { ok: false, reason: "친구가 준비 중이에요. 조금만 기다려 주세요." };
  game.sun -= info.cost;
  game.cooldowns[type] = info.recharge;
  game.plants.push({ id: id(game), type, row, col, hp: info.hp, timer: info.firstHarvest ?? info.firstAttack ?? .2, age: 0 });
  game.stats.planted++;
  game.effects.push({ id: id(game), kind: "plant", x: cellX(col), y: cellY(row), age: 0 });
  return { ok: true };
}

export function removePlant(game, row, col) {
  if (game.status !== "playing") return { ok: false, reason: "지금은 삽을 쓸 수 없어요." };
  const index = game.plants.findIndex(p => p.row === row && p.col === col);
  if (index < 0) return { ok: false, reason: "삽으로 뽑을 식물을 골라 주세요." };
  const [plant] = game.plants.splice(index, 1);
  game.shots = game.shots.filter(shot => shot.kind !== "shuriken" || shot.plantId !== plant.id);
  const refund = Math.floor(PLANTS[plant.type].cost / 2);
  game.sun += refund;
  return { ok: true, refund };
}

function dropSun(game, x, y, value = 25) {
  game.suns.push({ id: id(game), x: Math.max(50, Math.min(boardWidth(game) - 50, x)), y: Math.max(50, Math.min(450, y)), age: 0, value });
}
function fireShot(game, plant, target, muzzle = 0) {
  const info = PLANTS[plant.type];
  const shot = { id: id(game), row: plant.row, x: cellX(plant.col) + 28, damage: info.damage, frost: plant.type === "frost" };
  if (plant.type === "twin") Object.assign(shot, { kind: "twin", muzzle });
  if (plant.type === "thorn") Object.assign(shot, { kind: "thorn", hitIds: [] });
  if (plant.type === "ember") shot.kind = "ember";
  if (plant.type === "storm") {
    damageEnemy(game, target, info.damage);
    game.effects.push({ id: id(game), kind: "chain", x: shot.x, y: cellY(plant.row), toX: target.x, toY: cellY(target.row), age: 0 });
    Object.assign(shot, { kind: "storm", hitIds: [target.id], chainAt: game.time + CHAIN_GAP, x: target.x, row: target.row });
  }
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

export function enemyHealth(type, stageNumber, pacingVersion = 7) {
  return Math.round(ENEMIES[type].hp * (pacingVersion >= 7 ? STAGES[stageNumber - 1].hpMultiplier : 1));
}
export const enemyMaxHp = enemy => enemy.maxHp ?? ENEMIES[enemy.type].hp;
export function equipmentThreshold(type, maxHp = ENEMIES[type].hp) {
  return type === "umbrella" ? maxHp - 65 : maxHp * .5;
}
function damageEnemy(game, enemy, damage, frost = false, impact = true) {
  if (enemy.hp <= 0) return;
  enemy.hp -= damage;
  if (enemy.hp > 0 && enemy.hp < 1e-8) enemy.hp = 0;
  if (impact) enemy.hurtAt = game.time;
  if (frost) enemy.slow = 3;
  if (impact) game.effects.push({ id: id(game), kind: frost ? "ice" : "hit", type: enemy.type, x: enemy.x, y: cellY(enemy.row), age: 0 });
  if (!enemy.equipmentDropped && enemy.hp <= equipmentThreshold(enemy.type, enemyMaxHp(enemy))) {
    enemy.equipmentDropped = true;
    game.effects.push({ id: id(game), kind: "gear", type: enemy.type, x: enemy.x, y: cellY(enemy.row), age: 0 });
  }
}

function advanceChain(game, shot) {
  if (game.time + 1e-9 < shot.chainAt) return;
  const origin = game.enemies.find(e => e.id === shot.hitIds.at(-1) && e.hp > 0) ?? shot;
  const distance = enemy => Math.hypot(enemy.x - origin.x, (enemy.row - origin.row) * 100);
  const target = game.enemies.filter(e => e.hp > 0 && !shot.hitIds.includes(e.id) && distance(e) <= CHAIN_RANGE + 1e-8)
    .sort((a, b) => distance(a) - distance(b) || a.id - b.id)[0];
  if (!target) { shot.x = boardWidth(game) + 200; return; }
  game.effects.push({ id: id(game), kind: "chain", x: origin.x, y: cellY(origin.row), toX: target.x, toY: cellY(target.row), age: 0 });
  damageEnemy(game, target, shot.damage);
  shot.hitIds.push(target.id);
  shot.x = shot.hitIds.length === CHAIN_HITS ? boardWidth(game) + 200 : target.x;
  shot.row = target.row;
  shot.chainAt += CHAIN_GAP;
}

function advanceShuriken(game, plant, dt) {
  const originX = cellX(plant.col), endX = boardWidth(game);
  const hasTarget = () => game.enemies.some(e => e.hp > 0 && e.row === plant.row && e.x > originX);
  const launch = at => {
    if (!hasTarget()) return null;
    const shot = { id: id(game), kind: "shuriken", plantId: plant.id, row: plant.row, x: originX,
      damage: PLANTS.shuriken.damage, frost: false, leg: "out", outHits: [], backHits: [], age: 0 };
    game.shots.push(shot);
    plant.shotAt = at;
    return shot;
  };
  let shot = game.shots.find(s => s.kind === "shuriken" && s.plantId === plant.id) ?? launch(game.time - dt);
  let remaining = dt;
  while (shot && remaining > 1e-10) {
    const outward = shot.leg === "out", destination = outward ? endX : originX;
    const duration = Math.min(remaining, Math.abs(destination - shot.x) / SHURIKEN_SPEED);
    const nextX = shot.x + (outward ? 1 : -1) * SHURIKEN_SPEED * duration;
    const hits = outward ? shot.outHits : shot.backHits;
    const targets = game.enemies.filter(e => e.hp > 0 && e.row === plant.row && e.x > originX
      && e.x + 25 >= Math.min(shot.x, nextX) && e.x - 25 <= Math.max(shot.x, nextX) && !hits.includes(e.id))
      .sort((a, b) => outward ? a.x - b.x : b.x - a.x);
    for (const target of targets) { damageEnemy(game, target, shot.damage); hits.push(target.id); }
    shot.x = nextX;
    shot.age += duration;
    remaining = Math.max(0, remaining - duration);
    if (Math.abs(shot.x - destination) < 1e-8) {
      shot.x = destination;
      if (outward) shot.leg = "back";
      else {
        game.shots.splice(game.shots.indexOf(shot), 1);
        plant.caughtAt = game.time - remaining;
        shot = launch(plant.caughtAt);
      }
    }
  }
}

export function tick(game, dt) {
  if (game.status !== "playing" || !Number.isFinite(dt) || dt <= 0) return;
  // Large wall-clock gaps must never make enemies jump past a plant.
  dt = Math.min(dt, .1);
  const width = boardWidth(game);
  // Keep traversal pace stable; old nine-column saves retain their exact speed.
  const movementScale = width / 900;
  game.time += dt;
  for (const type of Object.keys(PLANTS)) {
    const remaining = Math.max(0, game.cooldowns[type] - dt);
    game.cooldowns[type] = type === "cactus" && remaining < 1e-9 ? 0 : remaining;
  }
  const schedule = scheduleFor(game.stage, game.pacingVersion ?? 1);
  while (game.nextSpawn < schedule.length && game.time >= schedule[game.nextSpawn].at) {
    const spawn = schedule[game.nextSpawn++];
    const hp = enemyHealth(spawn.type, game.stage, game.pacingVersion ?? 1);
    game.enemies.push({ id: id(game), type: spawn.type, row: spawn.row, x: width + 36, hp,
      ...((game.pacingVersion ?? 1) >= 7 ? { maxHp: hp } : {}), slow: 0, age: 0, eating: false, motionAt: game.time });
    game.wave = spawn.wave;
  }
  game.skyTimer -= dt;
  if (game.skyTimer <= 0) {
    const n = Math.floor(game.time / SKY_SUN_INTERVAL);
    dropSun(game, 90 + ((n * 173) % (width - 180)), 60 + ((n * 97) % 380));
    game.skyTimer += SKY_SUN_INTERVAL;
  }
  for (const sun of [...game.suns]) {
    sun.age += dt;
    if (sun.age >= 8) collectSun(game, sun.id);
  }
  for (const enemy of game.enemies) {
    if (enemy.hp > 0 && enemy.burn > 0) {
      damageEnemy(game, enemy, BURN_DAMAGE * Math.min(dt, enemy.burn), false, false);
      enemy.burn = Math.max(0, enemy.burn - dt);
    }
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
        if (Math.hypot(enemy.x - cellX(plant.col), cellY(enemy.row) - cellY(plant.row)) <= 175) damageEnemy(game, enemy, BOMB_DAMAGE);
      }
      game.effects.push({ id: id(game), kind: "burst", x: cellX(plant.col), y: cellY(plant.row), age: 0 });
      plant.hp = 0;
    }
    if (plant.pendingShotAt !== undefined && game.time + 1e-9 >= plant.pendingShotAt) {
      fireShot(game, plant, null, 1);
      delete plant.pendingShotAt;
    }
    if (plant.type === "shuriken") { plant.timer = 0; continue; }
    if ((info.damage || plant.type === "cactus") && plant.timer <= (plant.type === "cactus" ? 1e-9 : 0)) {
      const target = game.enemies.filter(e => e.hp > 0 && e.row === plant.row
        && (plant.type === "cactus" ? e.x > cellX(plant.col) : e.x >= cellX(plant.col) - 10))
        .sort((a, b) => a.x - b.x || (plant.type === "cactus" ? a.id - b.id : 0))[0];
      if (target) {
        if (plant.type === "cactus") {
          damageEnemy(game, target, target.hp);
          plant.laserTargetX = target.x;
          game.effects.push({ id: id(game), kind: "laser", plantId: plant.id, x: cellX(plant.col), y: cellY(plant.row), age: 0 });
        } else fireShot(game, plant, target);
        if (plant.type === "twin") plant.pendingShotAt = game.time + TWIN_GAP;
        plant.shotAt = game.time;
        plant.timer = info.interval;
      } else {
        plant.timer = 0;
      }
    }
  }
  for (const shot of game.shots) {
    if (shot.kind === "shuriken") continue;
    if (shot.kind === "storm" && shot.hitIds) {
      advanceChain(game, shot);
      continue;
    }
    if (shot.kind === "pumpkin") {
      shot.age += dt;
      shot.x = shot.originX + (shot.targetX - shot.originX) * Math.min(1, shot.age / shot.duration);
      if (shot.age >= shot.duration) {
        for (const enemy of game.enemies) {
          if (Math.hypot(enemy.x - shot.targetX, (enemy.row - shot.row) * 100) <= PUMPKIN_RADIUS) damageEnemy(game, enemy, shot.damage);
        }
        game.effects.push({ id: id(game), kind: "splash", x: shot.targetX, y: cellY(shot.row), age: 0 });
        shot.x = width + 200;
      }
      continue;
    }
    const previousX = shot.x;
    shot.x += 330 * movementScale * dt;
    const targets = game.enemies
      .filter(e => e.hp > 0 && e.row === shot.row && e.x + 25 >= previousX && e.x - 25 <= shot.x && (shot.kind !== "thorn" || !shot.hitIds.includes(e.id)))
      .sort((a, b) => a.x - b.x);
    for (const target of targets) {
      if (shot.kind === "ember") {
        for (const enemy of game.enemies) {
          if (enemy.hp > 0 && Math.hypot(enemy.x - target.x, (enemy.row - target.row) * 100) <= FIRE_RADIUS) {
            damageEnemy(game, enemy, shot.damage);
            if (enemy.hp > 0) enemy.burn = BURN_DURATION;
          }
        }
        game.effects.push({ id: id(game), kind: "flame", x: target.x, y: cellY(target.row), age: 0 });
      } else if (shot.kind === "storm") {
        damageEnemy(game, target, shot.damage);
        Object.assign(shot, { hitIds: [target.id], chainAt: game.time + CHAIN_GAP, x: target.x, row: target.row });
        break;
      } else damageEnemy(game, target, shot.damage, shot.frost);
      if (shot.kind === "thorn") shot.hitIds.push(target.id);
      if (shot.kind !== "thorn" || shot.hitIds.length >= THORN_HITS) { shot.x = width + 200; break; }
    }
  }
  for (const plant of game.plants) if (plant.type === "shuriken" && plant.hp > 0) advanceShuriken(game, plant, dt);
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
      const baseSpeed = bareUmbrella ? ENEMIES.sleepy.speed
        : enemy.equipmentDropped && enemy.type === "barrel" ? 18
          : enemy.equipmentDropped && enemy.type === "courier" ? 22 : info.speed;
      const speed = enemy.slow > 0 ? (enemy.type === "umbrella" && !bareUmbrella ? .8 : .48) : 1;
      enemy.x -= baseSpeed * movementScale * speed * dt;
    }
    if (enemy.x < -25) {
      game.lives = Math.max(0, game.lives - 1);
      enemy.escaped = true;
      game.effects.push({ id: id(game), kind: "heart", x: 30, y: cellY(enemy.row), age: 0 });
    }
  }
  game.plants = game.plants.filter(p => p.hp > 0);
  game.enemies = game.enemies.filter(e => e.hp > 0 && !e.escaped);
  game.shots = game.shots.filter(s => s.x < width + 100 && (s.kind !== "shuriken" || game.plants.some(p => p.id === s.plantId)));
  advanceEffects(game, dt);
  if (game.lives <= 0) game.status = "lost";
  else if (game.nextSpawn === schedule.length && game.enemies.length === 0) game.status = "won";
  if (game.status !== "playing") game.shots = game.shots.filter(s => s.kind !== "shuriken");
}

// Visual-only effects can finish after a terminal result without ticking combat.
export function advanceEffects(game, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  for (const effect of game.effects) effect.age += Math.min(dt, .1);
  game.effects = game.effects.filter(e => e.age < (e.kind === "laser" ? LASER_DURATION : e.kind === "gear" ? GEAR_DURATION : e.kind === "fall" ? FALL_DURATION : e.kind === "burst" ? BURST_DURATION : .5));
}

const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const list = (value, max, check) => Array.isArray(value) && value.length <= max && value.every(check);
const position = (p, columns) => integer(p.row, 0, ROWS - 1) && integer(p.col, 0, columns - 1);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
export function validSnapshot(g) {
  if (!object(g) || g.version !== 1 || !integer(g.stage, 1, STAGES.length) || g.status !== "playing") return false;
  if (g.columns !== undefined && ![9, COLS].includes(g.columns)) return false;
  const columns = boardColumns(g), width = boardWidth(g);
  if (g.rulesVersion !== undefined && ![2, 3, 4, 5, 6, 7, 8].includes(g.rulesVersion)) return false;
  if (g.pacingVersion !== undefined && ![1, 2, 3, 4, 5, 6, 7].includes(g.pacingVersion)) return false;
  const schedule = scheduleFor(g.stage, g.pacingVersion ?? 1);
  if (g.loadout !== undefined && !validLoadout(g.loadout, g.stage)) return false;
  if (!finite(g.time, 0, 100000) || !integer(g.sun, 0, 1000000) || !integer(g.lives, 1, 3) || !integer(g.nextId, 1, 10000000)) return false;
  if (!integer(g.nextSpawn, 0, schedule.length) || !finite(g.skyTimer, -1, (g.rulesVersion ?? 1) < 5 ? 6 : SKY_SUN_INTERVAL) || !integer(g.wave, 0, 3)) return false;
  if (!object(g.cooldowns) || !Object.keys(PLANTS).every(t => finite(g.cooldowns[t], 0, (g.rulesVersion ?? 1) < 5 ? LEGACY_RECHARGES[t] ?? PLANTS[t].recharge : PLANTS[t].recharge)
    || ((g.rulesVersion ?? 1) < (t === "shuriken" ? 7 : ["storm", "cactus"].includes(t) ? 6 : t === "ember" ? 4 : PLANTS[t].unlockStage >= 5 ? 3 : 1) && g.cooldowns[t] === undefined))) return false;
  if (!object(g.stats) || !["planted", "defeated", "collected"].every(k => integer(g.stats[k], 0, 1000000))) return false;
  const hasId = p => object(p) && integer(p.id, 1, g.nextId - 1);
  const eventTime = value => value === undefined || finite(value, 0, g.time);
  if (!list(g.plants, ROWS * columns, p => hasId(p) && Object.hasOwn(PLANTS, p.type) && position(p, columns) && finite(p.hp, .000001, PLANTS[p.type].hp) && finite(p.timer, -100000, 10) && finite(p.age, 0, 100000))) return false;
  if (new Set(g.plants.map(p => `${p.row}:${p.col}`)).size !== g.plants.length) return false;
  if (!g.plants.every(p => eventTime(p.shotAt) && eventTime(p.hurtAt) && eventTime(p.producedAt)
    && (p.caughtAt === undefined || (p.type === "shuriken" && eventTime(p.caughtAt))))) return false;
  if (!g.plants.every(p => p.laserTargetX === undefined || (p.type === "cactus" && p.shotAt !== undefined
    && finite(p.laserTargetX, cellX(p.col), width + 100) && p.laserTargetX > cellX(p.col)))) return false;
  if (!g.plants.every(p => p.pendingShotAt === undefined || (p.type === "twin" && finite(p.shotAt, 0, g.time)
    && finite(p.pendingShotAt, g.time, g.time + TWIN_GAP) && Math.abs(p.pendingShotAt - p.shotAt - TWIN_GAP) < 1e-8))) return false;
  if (!list(g.enemies, schedule.length, e => hasId(e) && Object.hasOwn(ENEMIES, e.type) && integer(e.row, 0, 4)
    && (e.maxHp === undefined || ((g.pacingVersion ?? 1) >= 7 && e.maxHp === enemyHealth(e.type, g.stage, g.pacingVersion)))
    && finite(e.x, -25, width + 100) && finite(e.hp, .000001, enemyMaxHp(e)) && finite(e.slow, 0, 3) && finite(e.age, 0, 100000) && typeof e.eating === "boolean")) return false;
  if (!g.enemies.every(e => eventTime(e.motionAt) && eventTime(e.hurtAt) && (e.burn === undefined || finite(e.burn, 0, BURN_DURATION))
    && (e.equipmentDropped === undefined || (typeof e.equipmentDropped === "boolean"
      && (!e.equipmentDropped || e.hp <= equipmentThreshold(e.type, enemyMaxHp(e))))))) return false;
  if (!list(g.shots, 500, s => {
    if (!hasId(s) || !integer(s.row, 0, 4) || !finite(s.x, s.kind === "storm" && s.hitIds ? -25 : 0, width + 100) || typeof s.frost !== "boolean") return false;
    // Already-fired projectiles retain their damage across balance updates.
    if (s.kind === undefined) return [PLANTS.pea.damage, PLANTS.frost.damage, 7, 14, 15, 18, 22].includes(s.damage);
    if (s.frost) return false;
    if (s.kind === "shuriken") {
      const owner = g.plants.find(p => p.id === s.plantId && p.type === "shuriken" && p.row === s.row);
      return owner !== undefined && [32, PLANTS.shuriken.damage].includes(s.damage) && ["out", "back"].includes(s.leg)
        && finite(s.x, cellX(owner.col), width) && finite(s.age, 0, 100000)
        && [s.outHits, s.backHits].every(hits => list(hits, schedule.length, n => integer(n, 1, g.nextId - 1) && n !== s.id && n !== owner.id)
          && new Set(hits).size === hits.length)
        && (s.leg !== "out" || s.backHits.length === 0);
    }
    if (s.kind === "storm") return [32, PLANTS.storm.damage].includes(s.damage) && (s.hitIds === undefined ? s.chainAt === undefined
      : list(s.hitIds, CHAIN_HITS - 1, n => integer(n, 1, g.nextId - 1) && n !== s.id) && s.hitIds.length > 0
        && new Set(s.hitIds).size === s.hitIds.length && finite(s.chainAt, g.time - 1e-9, g.time + CHAIN_GAP + 1e-9));
    if (s.kind === "ember") return [10, 12, 24, PLANTS.ember.damage].includes(s.damage);
    if (s.kind === "twin") return [18, 22, 24, PLANTS.twin.damage].includes(s.damage) && integer(s.muzzle, 0, 1);
    if (s.kind === "thorn") return [24, 26, PLANTS.thorn.damage].includes(s.damage) && list(s.hitIds, THORN_HITS - 1, n => integer(n, 1, g.nextId - 1) && n !== s.id)
      && new Set(s.hitIds).size === s.hitIds.length;
    return s.kind === "pumpkin" && [55, 64, 70, PLANTS.pumpkin.damage].includes(s.damage) && finite(s.originX, 78, width - 22)
      && finite(s.targetX, 0, width + 100) && finite(s.duration, .45, 1.6) && finite(s.age, 0, s.duration)
      && Math.abs(s.x - (s.originX + (s.targetX - s.originX) * s.age / s.duration)) < 1e-7;
  })) return false;
  const returning = g.shots.filter(s => s.kind === "shuriken");
  if (new Set(returning.map(s => s.plantId)).size !== returning.length) return false;
  if (!list(g.suns, 100, s => hasId(s) && finite(s.x, 50, width - 50) && finite(s.y, 50, 450) && finite(s.age, 0, 8) && [25, 50].includes(s.value))) return false;
  const ids = [...g.plants, ...g.enemies, ...g.shots, ...g.suns].map(p => p.id);
  return new Set(ids).size === ids.length;
}

export function snapshot(game) {
  return structuredClone({ ...game, effects: [] });
}
