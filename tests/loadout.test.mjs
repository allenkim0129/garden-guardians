import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../src/engine.js";
import { freshSave, readSave } from "../src/storage.js";
import { playStrategy } from "./helpers/strategy.mjs";

test("1단계 새 판은 5줄에 골고루 등장하고 v10~v13의 진행 중 판은 원래 줄 유지", () => {
  assert.deepEqual(new Set(engine.scheduleFor(1).map(spawn => spawn.row)), new Set([0, 1, 2, 3, 4]));
  for (const version of [1, 2]) {
    assert.deepEqual(new Set(engine.scheduleFor(1, version).map(spawn => spawn.row)), new Set([1, 2, 3]));
    const game = engine.createGame(1); game.pacingVersion = version;
    assert.ok(engine.validSnapshot(game));
  }
  assert.deepEqual(engine.scheduleFor(1).map(s => s.at), engine.scheduleFor(1, 2).map(s => s.at));
});
test("식물 선택은 1~6종·중복 없음·정원 해금 규칙을 지키고 선택 밖 배치를 거부", () => {
  for (const invalid of [[], ["pea", "pea"], ["iron"], ["__proto__"], "pea"]) {
    assert.throws(() => engine.createGame(1, invalid), RangeError);
  }
  assert.throws(() => engine.createGame(10, Object.keys(engine.PLANTS).slice(0, 7)), RangeError);
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
