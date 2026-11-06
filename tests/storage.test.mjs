import test from "node:test";
import assert from "node:assert/strict";
import { createGame, plantAt, snapshot, validSnapshot } from "../src/engine.js";
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
test("승리 시 별은 최고 기록 보존, 마지막 단계 경계, 패배 시 이어하기 제거", () => {
  const data = freshSave();
  const game = createGame(1);
  game.status = "won"; updateProgress(data, game);
  assert.equal(data.unlocked, 2);
  assert.equal(data.stars[0], 3);
  game.lives = 1; updateProgress(data, game);
  assert.equal(data.stars[0], 3);
  game.stage = 10; updateProgress(data, game);
  assert.equal(data.unlocked, 10);
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
    g => { g.stage = 11; }, g => { g.enemies = [null]; },
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
  assert.deepEqual(result.data.stars, data.stars);
  assert.equal(result.data.current.rulesVersion, 2);
  assert.deepEqual(result.data.current.plants, old.plants);
  assert.equal(result.data.current.shots[0].damage, 18);
  assert.equal(plantAt(result.data.current, "sun", 1, 0).ok, true);
  assert.equal(plantAt(result.data.current, "wall", 1, 1).ok, false);
  writeSave(storage, result.data);
  assert.equal(readSave(storage).notice, null);
  assert.ok(validateSave(readSave(storage).data));
});

test("기존 1단계 저장도 진행 손실 없이 햇살봉·콩별이를 바로 배치 가능", () => {
  for (const unlocked of [1, 10]) {
    const game = createGame(1);
    game.time = 7; game.skyTimer = 2;
    const data = { ...freshSave(), unlocked, stars: unlocked === 10 ? Array(10).fill(3) : Array(10).fill(0), current: snapshot(game) };
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
    const data = { ...freshSave(), unlocked: 10, stars: Array(10).fill(3), current: snapshot(game) };
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
