import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../src/engine.js";
import { freshSave, readSave, validateSave, updateProgress } from "../src/storage.js";
import { playStrategy } from "./helpers/strategy.mjs";

test("1단계 새 판은 5줄에 골고루 등장하고 v10~v13의 진행 중 판은 원래 줄 유지", () => {
  assert.deepEqual(new Set(engine.scheduleFor(1).map(spawn => spawn.row)), new Set([0, 1, 2, 3, 4]));
  for (const version of [1, 2]) {
    assert.deepEqual(new Set(engine.scheduleFor(1, version).map(spawn => spawn.row)), new Set([1, 2, 3]));
    const game = engine.createGame(1); game.pacingVersion = version;
    assert.ok(engine.validSnapshot(game));
  }
  assert.deepEqual(engine.scheduleFor(1, 3).map(s => s.at), engine.scheduleFor(1, 2).map(s => s.at));
});
test("식물 선택은 1~6종·10단계 8종·중복 없음·해금 규칙을 지키고 선택 밖 배치를 거부", () => {
  for (const invalid of [[], ["pea", "pea"], ["iron"], ["__proto__"], "pea"]) {
    assert.throws(() => engine.createGame(1, invalid), RangeError);
  }
  assert.throws(() => engine.createGame(9, Object.keys(engine.PLANTS).slice(0, 7)), RangeError);
  assert.throws(() => engine.createGame(10, Object.keys(engine.PLANTS).slice(0, 9)), RangeError);
  for (let stage = 1; stage <= 9; stage++) assert.equal(engine.loadoutLimit(stage), 6);
  assert.equal(engine.loadoutLimit(10), 8);
  const eight = engine.createGame(10, Object.keys(engine.PLANTS).slice(0, 8));
  assert.ok(engine.validSnapshot(eight));
  assert.deepEqual(engine.snapshot(eight).loadout, eight.loadout);
  const eightSave = { ...freshSave(), unlocked: 10, current: eight };
  assert.deepEqual(readSave({ getItem: () => JSON.stringify(eightSave) }).data, eightSave);
  const team = ["sun", "pea"];
  const game = engine.createGame(10, team);
  team.push("wall");
  assert.deepEqual(game.loadout, ["sun", "pea"]);
  assert.equal(engine.plantAt(game, "wall", 0, 0).ok, false);
  assert.equal(engine.plantAt(game, "pea", 0, 0).ok, true);
  const data = { ...freshSave(), unlocked: 10, language: "en", current: engine.snapshot(game) };
  const restored = readSave({ getItem: () => JSON.stringify(data) });
  assert.equal(restored.error, null);
  assert.deepEqual(restored.data, data);
  const legacy = engine.createGame(10);
  assert.ok(engine.validSnapshot(legacy));
  assert.ok(engine.isPlantAvailable(legacy, "iron"));
  legacy.loadout = ["unknown"];
  assert.equal(engine.validSnapshot(legacy), false);
});
test("햇빛 쓸기 경로는 빠른 이동·겹침·정지점·경계에서 한 번씩만 수집", () => {
  const game = engine.createGame(1);
  for (const [x, y, value] of [[100, 100, 25], [300, 100, 50], [500, 100, 25], [300, 151, 25]]) {
    game.suns.push({ id: game.nextId++, x, y, value, age: 0 });
  }
  const hits = engine.sunsAlongPath(game, { x: 50, y: 100 }, { x: 600, y: 100 }, 50);
  assert.equal(hits.length, 3);
  for (const id of hits) assert.ok(engine.collectSun(game, id));
  assert.equal(game.sun, 350);
  assert.deepEqual(engine.sunsAlongPath(game, { x: 50, y: 100 }, { x: 600, y: 100 }, 50), []);
  assert.equal(engine.sunsAlongPath(game, { x: 300, y: 151 }, { x: 300, y: 151 }, 1).length, 1);
});
test("6종 이하의 실제 출전 식물로 열 정원 통과", t => {
  for (let stage = 1; stage <= 10; stage++) {
    const team = ["sun", "pea", "wall", "frost", "bomb"].filter(type => engine.isPlantUnlocked(type, stage));
    const api = { ...engine, createGame: number => engine.createGame(number, team) };
    const result = playStrategy(api, stage);
    assert.equal(result.game.status, "won", `${stage}단계`);
    assert.ok(result.game.lives >= 2);
    assert.ok(result.actions.every(action => team.includes(action.type)));
    t.diagnostic(`${stage}단계: ${team.length}종, 하트 ${result.game.lives}`);
  }
});

test("확정한 팀은 빈칸·순서 그대로 저장하고 승패 후에도 유지", () => {
  const teamSlots = ["sun", null, "twin", null, "frost", "pumpkin", "lantern", "wall"];
  const data = { ...freshSave(), unlocked: 20, teamSlots };
  assert.deepEqual(readSave({ getItem: () => JSON.stringify(data) }).data, data);
  for (const status of ["won", "lost"]) {
    const game = engine.createGame(20, teamSlots.filter(type => type !== null));
    game.status = status;
    updateProgress(data, game);
    assert.deepEqual(data.teamSlots, teamSlots);
  }
  const legacy = freshSave();
  const game = engine.createGame(9, ["sun", "pea", "frost"]);
  game.status = "won";
  updateProgress(legacy, game);
  assert.deepEqual(legacy.teamSlots, ["sun", "pea", "frost", null, null, null]);
  assert.ok(validateSave(legacy));
  assert.equal(freshSave().teamSlots, undefined);
  for (const invalid of [null, [], Array(8).fill(null), ["sun"], ["sun", "sun", null, null, null, null],
    ["sun", "__proto__", null, null, null, null], ["sun", 42, null, null, null, null]]) {
    assert.equal(validateSave({ ...freshSave(), teamSlots: invalid }), false);
  }
});

test("새 정원은 50칸, 이전 저장은 45칸·기존 좌표를 그대로 유지", () => {
  for (const columns of [9, 10]) {
    const game = engine.createGame(20);
    if (columns === 9) delete game.columns;
    assert.equal(engine.boardColumns(game), columns);
    assert.equal(engine.boardWidth(game), columns * 100);
    assert.equal(engine.plantAt(game, "pea", 4, columns - 1).ok, true);
    assert.equal(engine.plantAt(game, "wall", 4, columns).ok, false);
    const data = { ...freshSave(), unlocked: 20, current: engine.snapshot(game) };
    assert.deepEqual(readSave({ getItem: () => JSON.stringify(data) }).data, data);
    assert.equal(engine.removePlant(game, 4, columns - 1).ok, true);
    game.plants = Array.from({ length: columns * engine.ROWS }, (_, index) => ({
      id: game.nextId++, type: "sun", row: Math.floor(index / columns), col: index % columns, hp: 100, age: 0, timer: 5,
    }));
    assert.ok(engine.validSnapshot(engine.snapshot(game)));
    game.plants[0].col = columns;
    assert.equal(engine.validSnapshot(engine.snapshot(game)), false);
  }
  for (const columns of [0, 8, 11, 9.5, "10", null]) assert.equal(engine.validSnapshot({ ...engine.createGame(1), columns }), false);
});

test("9·10칸 모두 오른쪽 바깥에서 등장하고 정원 폭 대비 이동 속도는 동일", () => {
  for (const columns of [9, 10]) {
    const game = engine.createGame(1); game.columns = columns; game.time = 9.9;
    engine.tick(game, .1);
    const width = engine.boardWidth(game);
    assert.equal(game.nextSpawn, 1);
    assert.ok(game.enemies[0].x > width);
    assert.ok(Math.abs((width + 36 - game.enemies[0].x) / width - engine.ENEMIES.sleepy.speed * .1 / 900) < 1e-8);
    assert.ok(engine.validSnapshot(engine.snapshot(game)));
  }
});

test("새 마지막 칸에서 모든 공격·생산·발사체 경계와 저장 복원이 동작", () => {
  for (const type of ["pea", "frost", "twin", "thorn", "pumpkin", "ember", "sun", "lantern"]) {
    const game = engine.createGame(20, [type]);
    assert.ok(engine.plantAt(game, type, 2, 9).ok);
    game.enemies.push({ id: game.nextId++, type: "jelly", row: 2, x: 1090, hp: 340, slow: 0, age: 0, eating: false });
    for (let i = 0; i < 10; i++) {
      engine.tick(game, .1);
      assert.ok(engine.validSnapshot(engine.snapshot(game)), type);
    }
    if (engine.PLANTS[type].damage) assert.ok(game.enemies[0].hp < 340 || game.shots.length > 0, type);
    else {
      game.plants[0].timer = .1;
      engine.tick(game, .1);
      assert.equal(game.suns.at(-1).x, 950);
    }
    const saved = engine.snapshot(game);
    assert.ok(engine.validSnapshot(saved), type);
    const restored = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: 20, current: saved }) }).data.current;
    game.effects = [];
    engine.tick(game, .1); engine.tick(restored, .1);
    assert.deepEqual(restored, game, type);
  }
});
