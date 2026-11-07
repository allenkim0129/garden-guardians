import test from "node:test";
import assert from "node:assert/strict";
import { createGame, plantAt, snapshot, validSnapshot, STAGES } from "../src/engine.js";
import { freshSave, readSave, writeSave, validateSave, updateProgress } from "../src/storage.js";
const memory = () => {
  let value = null;
  return { getItem: () => value, setItem: (key, data) => { value = data; } };
};
test("첫 방문, 저장, 재접속, 효과음과 안내 설정 복원", () => {
  const storage = memory();
  const data = readSave(storage).data;
  assert.deepEqual(data, freshSave());
  const game = createGame(1); plantAt(game, "pea", 1, 1);
  data.sound = true; data.tutorialSeen = true;
  updateProgress(data, game);
  assert.equal(writeSave(storage, data), null);
  assert.deepEqual(readSave(storage).data, data);
});
test("v19의 별 10칸은 보존 확장하고 10단계 클리어 기록이 있어야 11단계 해금", () => {
  for (const stars of [0, 1, 3]) {
    const legacy = { ...freshSave(), unlocked: 10, stars: Array(10).fill(2), language: "en", sound: true, volume: 87, current: createGame(7) };
    legacy.stars[9] = stars;
    plantAt(legacy.current, "pea", 2, 0);
    legacy.current.effects = [];
    const original = structuredClone(legacy);
    const result = readSave({ getItem: () => JSON.stringify(legacy) });
    const expected = { ...legacy, unlocked: stars > 0 ? 11 : 10, stars: [...legacy.stars, ...Array(10).fill(0)] };
    assert.equal(result.error, null);
    assert.deepEqual(result.data, expected);
    assert.ok(validateSave(result.data));
    assert.deepEqual(readSave({ getItem: () => JSON.stringify(result.data) }).data, expected);
    assert.deepEqual(legacy, original);
  }
  const early = { ...freshSave(), unlocked: 3, stars: [3, 2, ...Array(8).fill(0)] };
  assert.equal(readSave({ getItem: () => JSON.stringify(early) }).data.unlocked, 3);
});
test("20단계 저장의 정상 경계·리셋 기본값·오염된 별 길이와 해금 거부", () => {
  assert.equal(freshSave().stars.length, 20);
  assert.ok(freshSave().stars.every(stars => stars === 0));
  const data = { ...freshSave(), unlocked: 20, current: createGame(20) };
  assert.ok(validateSave(data));
  for (const length of [0, 9, 11, 19, 21]) assert.equal(validateSave({ ...data, stars: Array(length).fill(0) }), false);
  assert.equal(validateSave({ ...data, stars: Array(10).fill(0) }), false);
  assert.equal(validateSave({ ...data, unlocked: 21 }), false);
  assert.equal(validateSave({ ...data, current: { ...data.current, stage: 21 } }), false);
  const result = readSave({ getItem: () => JSON.stringify(data) });
  assert.deepEqual(result.data, data);
});
test("음량 없는 이전 저장은 기존 출력 유지, 0~100 음량 저장과 잘못된 값 거부", () => {
  const legacy = { ...freshSave(), sound: true, unlocked: 10, language: "en", stars: freshSave().stars.fill(3), current: createGame(10) };
  delete legacy.volume;
  const restored = readSave({ getItem: () => JSON.stringify(legacy) });
  assert.equal(restored.error, null);
  assert.deepEqual(restored.data, { ...legacy, volume: 45 });
  for (const volume of [0, 25, 100]) {
    const data = { ...restored.data, volume };
    assert.deepEqual(readSave({ getItem: () => JSON.stringify(data) }).data, data);
  }
  for (const volume of [-1, 101, .5, null, "50"]) assert.equal(validateSave({ ...restored.data, volume }), false);
});
test("승리 시 별은 최고 기록 보존, 마지막 단계 경계, 패배 시 이어하기 제거", () => {
  const data = freshSave();
  const game = createGame(1);
  game.status = "won"; updateProgress(data, game);
  assert.equal(data.unlocked, 2);
  assert.equal(data.stars[0], 3);
  game.lives = 1; updateProgress(data, game);
  assert.equal(data.stars[0], 3);
  game.stage = 10; updateProgress(data, game);
  assert.equal(data.unlocked, 11);
  game.stage = STAGES.length; updateProgress(data, game);
  assert.equal(data.unlocked, STAGES.length);
  game.status = "lost"; updateProgress(data, game);
  assert.equal(data.current, null);
});
test("손상된 저장, 누락 필드, 저장 차단을 명시적으로 알림", () => {
  for (const value of ["{", "null", "[]", JSON.stringify({ ...freshSave(), stars: [99] })]) {
    const result = readSave({ getItem: () => value });
    assert.ok(result.error);
    assert.deepEqual(result.data, freshSave());
  }
  const storage = { getItem: () => { throw new Error("차단"); }, setItem: () => { throw new Error("용량 초과"); } };
  assert.match(readSave(storage).error, /차단/);
  assert.match(writeSave(storage, freshSave()), /용량 초과/);
});
test("잘못된 중간 게임은 실행 전에 검증", () => {
  const base = snapshot(createGame(1));
  const corruptions = [
    g => { g.stage = STAGES.length + 1; }, g => { g.enemies = [null]; },
    g => { g.cooldowns = null; }, g => { g.sun = -1; },
    g => { g.nextSpawn = 99; }, g => { g.suns = [null]; },
    g => { g.stats = {}; }, g => { g.status = "won"; },
    g => { g.lives = 0; }, g => { g.shots = [{}]; },
  ];
  for (const corrupt of corruptions) {
    const value = structuredClone(base); corrupt(value);
    assert.equal(validSnapshot(value), false);
  }
  const g = createGame(1); plantAt(g, "pea", 0, 0);
  g.plants.push({ ...g.plants[0], id: g.nextId++ });
  assert.equal(validSnapshot(g), false);
  assert.equal(validateSave({ ...freshSave(), current: createGame(2) }), false);
});

test("이전 저장의 별·진행·잠긴 식물은 유지하고 발사체를 새 밸런스로 이관", () => {
  const old = createGame(1);
  delete old.rulesVersion;
  old.plants.push({ id: old.nextId++, type: "sun", row: 0, col: 0, hp: 100, age: 12, timer: 2 });
  old.plants.push({ id: old.nextId++, type: "wall", row: 0, col: 1, hp: 650, age: 12, timer: 0 });
  old.shots.push({ id: old.nextId++, row: 0, x: 200, damage: 22, frost: false });
  const data = { ...freshSave(), current: old, unlocked: 7, stars: [3, 2, 3, 3, 2, 1, 0, 0, 0, 0] };
  const storage = memory();
  writeSave(storage, data);
  const result = readSave(storage);
  assert.equal(result.error, null);
  assert.match(result.notice, /이전/);
  assert.equal(result.data.unlocked, 7);
  assert.deepEqual(result.data.stars, [...data.stars, ...Array(10).fill(0)]);
  assert.equal(result.data.current.rulesVersion, 5);
  assert.deepEqual(result.data.current.plants, old.plants);
  assert.equal(result.data.current.shots[0].damage, 18);
  assert.equal(plantAt(result.data.current, "sun", 1, 0).ok, true);
  assert.equal(plantAt(result.data.current, "wall", 1, 1).ok, false);
  writeSave(storage, result.data);
  assert.equal(readSave(storage).notice, null);
  assert.ok(validateSave(readSave(storage).data));
});

test("v16 저장은 불꽃봉오리 쿨다운만 추가하고 팀·25초 시간표·설정을 보존", () => {
  const game = createGame(10, ["sun", "pea", "wall", "frost", "bomb", "twin"]);
  game.rulesVersion = 3; game.pacingVersion = 4;
  delete game.cooldowns.ember;
  plantAt(game, "pea", 2, 0);
  const data = { ...freshSave(), current: game, unlocked: 10, language: "en", volume: 65, sound: true, stars: freshSave().stars.fill(3) };
  assert.ok(validateSave(data));
  const result = readSave({ getItem: () => JSON.stringify(data) });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    ...data, current: { ...game, rulesVersion: 5, effects: [], cooldowns: { ...game.cooldowns, ember: 0 } },
  });
  assert.ok(validateSave(result.data));
  const current = createGame(10);
  delete current.cooldowns.ember;
  assert.equal(validSnapshot(current), false);
});

test("v17의 긴 대기도 저장을 거부하지 않고 새 상한으로 한 번만 줄임", () => {
  const old = createGame(10, ["sun", "pea", "lantern", "ember"]);
  old.rulesVersion = 4;
  old.cooldowns = { sun: 5, pea: 6, wall: 8, frost: 5, bomb: 16, twin: 9, thorn: 9, pumpkin: 10, lantern: 10, iron: 14, ember: 10 };
  old.skyTimer = 6;
  old.time = 20;
  for (const [type, timer, hp, col] of [["sun", 7.5, 100, 0], ["lantern", 9.5, 140, 1], ["pea", 1.2, 120, 2]]) {
    old.plants.push({ id: old.nextId++, type, row: 0, col, hp, timer, age: 12 });
  }
  const data = { ...freshSave(), current: old, unlocked: 10, stars: freshSave().stars.fill(3), sound: true, volume: 65, language: "en" };
  assert.ok(validateSave(data));
  const expected = {
    ...data, current: { ...old, rulesVersion: 5, skyTimer: 5,
      cooldowns: { sun: 4, pea: 5, wall: 7, frost: 4, bomb: 14, twin: 8, thorn: 8, pumpkin: 9, lantern: 9, iron: 12, ember: 9 },
      plants: old.plants.map(p => ({ ...p, timer: p.type === "sun" ? 6 : p.type === "lantern" ? 8 : p.timer })),
    },
  };
  const result = readSave({ getItem: () => JSON.stringify(data) });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, expected);
  assert.ok(validateSave(result.data));
  assert.deepEqual(readSave({ getItem: () => JSON.stringify(result.data) }).data, expected);
  const short = structuredClone(data);
  short.current.cooldowns.bomb = .2; short.current.skyTimer = .1; short.current.plants[0].timer = .3;
  const kept = readSave({ getItem: () => JSON.stringify(short) }).data.current;
  assert.equal(kept.cooldowns.bomb, .2);
  assert.equal(kept.skyTimer, .1);
  assert.equal(kept.plants[0].timer, .3);
  old.cooldowns.bomb = 16.1;
  assert.equal(validateSave(data), false);
  const corrupt = structuredClone(expected);
  corrupt.current.cooldowns.bomb = 14.1;
  assert.equal(validateSave(corrupt), false);
  corrupt.current.cooldowns.bomb = 14; corrupt.current.skyTimer = 5.1;
  assert.equal(validateSave(corrupt), false);
});

test("기존 1단계 저장도 진행 손실 없이 햇살봉·콩별이를 바로 배치 가능", () => {
  for (const unlocked of [1, 10]) {
    const game = createGame(1);
    game.time = 7; game.skyTimer = 2;
    const data = { ...freshSave(), unlocked, stars: freshSave().stars.fill(unlocked === 10 ? 3 : 0), current: snapshot(game) };
    const storage = memory();
    assert.equal(writeSave(storage, data), null);
    const restored = readSave(storage);
    assert.equal(restored.error, null);
    assert.equal(restored.notice, null);
    assert.deepEqual(restored.data, data);
    assert.equal(plantAt(restored.data.current, "sun", 0, 0).ok, true);
    assert.equal(plantAt(restored.data.current, "pea", 2, 1).ok, true);
    assert.equal(restored.data.current.sun, 75);
    updateProgress(restored.data, restored.data.current);
    assert.equal(writeSave(storage, restored.data), null);
    assert.deepEqual(readSave(storage).data, restored.data);
  }
});

test("기존 2~4단계 저장은 별·진행·자원을 유지하고 앞당긴 해금 즉시 적용", () => {
  for (const [stage, type] of [[2, "wall"], [3, "frost"], [4, "bomb"]]) {
    const game = createGame(stage);
    game.time = 7; game.skyTimer = 2;
    const data = { ...freshSave(), unlocked: 10, stars: freshSave().stars.fill(3), current: snapshot(game) };
    const storage = memory();
    assert.equal(writeSave(storage, data), null);
    const restored = readSave(storage);
    assert.equal(restored.error, null);
    assert.deepEqual(restored.data, data);
    assert.equal(plantAt(restored.data.current, type, 2, 2).ok, true);
    assert.equal(restored.data.current.stage, stage);
    assert.equal(restored.data.current.time, 7);
    assert.deepEqual(restored.data.stars, data.stars);
  }
});
