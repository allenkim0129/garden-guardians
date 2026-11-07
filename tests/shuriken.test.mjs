import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../src/engine.js";
import { freshSave, readSave } from "../src/storage.js";
import { plantFrame } from "../src/sprites.js";

const { createGame, plantAt, tick, snapshot, validSnapshot, PLANTS, boardWidth, SHURIKEN_SPEED } = engine;
function setup(col = 0, columns = 10) {
  const game = createGame(15, ["shuriken"]); game.columns = columns; game.sun = 1000;
  assert.ok(plantAt(game, "shuriken", 2, col).ok);
  return game;
}
function target(game, x, row = 2, hp = 400) {
  const enemy = { id: game.nextId++, type: "barrel", row, x, hp, age: 0, slow: 0, eating: false };
  game.enemies.push(enemy); return enemy;
}
function advance(game, duration, dt = .1, stationary = false) {
  for (let left = duration; left > 1e-9; left -= dt) {
    const positions = game.enemies.map(e => [e, e.x]);
    tick(game, Math.min(left, dt));
    if (stationary) for (const [e, x] of positions) e.x = x;
  }
}

test("표창잎은 15해금·편도36·속도360·가격300이며 적 없을 때는 보유", () => {
  assert.deepEqual(engine.introducedPlants(15), ["shuriken"]);
  assert.equal(plantAt(createGame(14), "shuriken", 2, 0).ok, false);
  assert.equal(PLANTS.shuriken.damage, 36);
  assert.equal(PLANTS.storm.damage, 64);
  assert.equal(SHURIKEN_SPEED, 180 * 2);
  assert.equal(PLANTS.shuriken.cost, 300);
  const game = setup();
  advance(game, .5);
  assert.equal(game.shots.length, 0);
  target(game, 20); target(game, 700, 1);
  tick(game, .1);
  assert.equal(game.shots.length, 0);
  target(game, 700);
  tick(game, .01);
  assert.equal(game.shots.length, 1);
  assert.equal(plantFrame(game.plants[0], game).col, 1);
});

test("표창은 같은 줄 전방 적마다 편도1회·복귀1회, 끝을 넘어가지 않고 즉시 재투척", () => {
  for (const columns of [9, 10]) {
    const game = setup(2, columns), width = boardWidth(game);
    const foes = [380, 500, width].map(x => target(game, x));
    const behind = target(game, 100), other = target(game, 500, 3);
    const halfTrip = (width - 250) / SHURIKEN_SPEED;
    advance(game, halfTrip, .1, true);
    assert.equal(game.shots.length, 1);
    assert.equal(game.shots[0].x, width);
    assert.equal(game.shots[0].leg, "back");
    assert.deepEqual(foes.map(e => e.hp), [364, 364, 364]);
    const firstId = game.shots[0].id;
    advance(game, halfTrip, .1, true);
    assert.deepEqual(foes.map(e => e.hp), [328, 328, 328]);
    assert.equal(behind.hp, 400); assert.equal(other.hp, 400);
    assert.equal(game.shots.length, 1);
    assert.ok(game.shots[0].id > firstId);
    assert.equal(game.shots[0].leg, "out");
    assert.ok(Math.abs(game.plants[0].shotAt - halfTrip * 2) < 1e-8);
    assert.ok(Math.abs(game.shots[0].x - 250) < 1e-8);
    assert.ok(validSnapshot(snapshot(game)));
  }
});

test("맵끝 반전의 남은 시간은 복귀에 사용하고 짧은 왕복도 dt 분할과 일치", () => {
  const initial = setup(9);
  target(initial, 1000);
  const coarse = snapshot(initial), fine = snapshot(initial);
  advance(coarse, .15, .1, true); advance(fine, .15, .01, true);
  assert.equal(coarse.shots[0].leg, "back");
  assert.ok(Math.abs(coarse.shots[0].x - 996) < 1e-8);
  assert.ok(Math.abs(coarse.shots[0].x - fine.shots[0].x) < 1e-8);
  assert.deepEqual(coarse.shots[0].outHits, fine.shots[0].outHits);
  assert.deepEqual(coarse.shots[0].backHits, fine.shots[0].backHits);
  assert.equal(coarse.enemies[0].hp, 328);
  advance(coarse, .15, .1, true); advance(fine, .15, .01, true);
  assert.equal(coarse.shots.length, 1);
  assert.equal(coarse.shots[0].leg, "out");
  assert.ok(Math.abs(coarse.shots[0].x - 958) < 1e-8);
  assert.ok(Math.abs(coarse.shots[0].x - fine.shots[0].x) < 1e-8);
  assert.ok(Math.abs(coarse.plants[0].shotAt - 100 / 360) < 1e-8);
  const clamped = snapshot(initial), single = snapshot(initial);
  tick(clamped, 10); tick(single, .1);
  assert.deepEqual(clamped, single);
});

test("표창의 준비·발사·받기·되감기와 피격 네 프레임은 추가 공격 대기 없이 선택", () => {
  const game = setup(), plant = game.plants[0];
  target(game, 700);
  assert.equal(plantFrame(plant, game).col, 0);
  tick(game, .01);
  assert.equal(plantFrame(plant, game).col, 1);
  Object.assign(game.shots[0], { age: 3, leg: "back", x: 80 });
  assert.equal(plantFrame(plant, game).col, 2);
  game.shots = []; game.enemies = []; plant.caughtAt = game.time;
  assert.equal(plantFrame(plant, game).col, 3);
  delete plant.caughtAt; plant.hurtAt = 0;
  for (let frame = 0; frame < 4; frame++) {
    game.time = frame * .12;
    assert.deepEqual(plantFrame(plant, game), { state: "hurt", row: 2, col: frame });
  }
});

test("왕복 각 구간 저장·정지·복구는 피해와 순서를 보존하며 잘못된 소유자·중복표창 거부", () => {
  for (const elapsed of [.2, 2, 3]) {
    const game = setup(7); target(game, 900);
    advance(game, elapsed, .1, true);
    const before = snapshot(game);
    tick(game, 0); assert.deepEqual(snapshot(game), before);
    const loaded = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: 15, current: before }) });
    assert.equal(loaded.error, null);
    game.effects = [];
    advance(game, .4); advance(loaded.data.current, .4);
    assert.deepEqual(loaded.data.current, game);
    for (const corrupt of [
      g => g.shots[0].plantId = 9999,
      g => g.shots[0].row = 0,
      g => g.shots[0].x = 1001,
      g => g.shots[0].outHits = [2, 2],
      g => g.shots[0].damage = 64,
      g => g.shots.push({ ...g.shots[0], id: g.nextId++ }),
    ]) {
      const bad = snapshot(game); corrupt(bad);
      assert.equal(validSnapshot(bad), false);
    }
  }
});

test("발사자 삽 제거·사망·재식재와 승리 뒤 표창은 유령피해를 만들지 않음", () => {
  for (const removal of ["shovel", "death"]) {
    const game = setup(); const foe = target(game, 300);
    tick(game, .1); const owner = game.plants[0].id;
    if (removal === "shovel") engine.removePlant(game, 2, 0);
    else game.plants[0].hp = 0;
    tick(game, .1);
    assert.equal(game.shots.length, 0);
    assert.equal(foe.hp, 400);
    game.cooldowns.shuriken = 0;
    assert.ok(plantAt(game, "shuriken", 2, 0).ok);
    tick(game, .1);
    assert.notEqual(game.shots[0].plantId, owner);
    assert.equal(game.shots[0].plantId, game.plants[0].id);
  }
  const won = setup(9); won.nextSpawn = engine.scheduleFor(15).length;
  target(won, 980, 2, 1);
  tick(won, .1);
  assert.equal(won.status, "won"); assert.equal(won.shots.length, 0);
});

test("v30 저장은 팀·별·자원·기존 쿨다운을 유지하고 표창 쿨다운만 추가", () => {
  const old = createGame(20, ["sun", "storm"]); old.rulesVersion = 6;
  delete old.cooldowns.shuriken;
  const data = { ...freshSave(), unlocked: 20, current: old, teamSlots: ["sun", "storm", null, null, null, null, null, null] };
  const loaded = readSave({ getItem: () => JSON.stringify(data) });
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.data, { ...data, current: { ...old, rulesVersion: 8, cooldowns: { ...old.cooldowns, shuriken: 0 } } });
  const missing = createGame(20); delete missing.cooldowns.shuriken;
  assert.equal(validSnapshot(missing), false);
});

test("표창 가격 측정: 후열·중간·최전열 왕복 시간과 단일/다수 적 피해", t => {
  for (const [col, count] of [[0, 1], [4, 1], [8, 1], [9, 1], [0, 5]]) {
    const game = setup(col), origin = col * 100 + 50;
    const targets = Array.from({ length: count }, (_, i) => target(game, origin + (1000 - origin) * (i + 1) / count));
    const trip = (1000 - origin) * 2 / SHURIKEN_SPEED;
    advance(game, trip, .01, true);
    const damage = targets.reduce((sum, e) => sum + 400 - e.hp, 0);
    assert.equal(damage, 72 * count);
    assert.ok(Math.abs(game.plants[0].shotAt - trip) < 1e-8);
    t.diagnostic(`col${col + 1}, ${count} stationary foes: ${trip.toFixed(3)}s/trip, ${damage} damage, ${(damage / trip).toFixed(2)} DPS`);
  }
});

test("v31 비행 중 표창은 32 피해·방향·명중 기록을 보존하고 다음 투척부터 36", () => {
  for (const leg of ["out", "back"]) {
    const game = setup(9);
    target(game, 1000);
    tick(game, .01);
    Object.assign(game.shots[0], { damage: 32, leg, x: leg === "out" ? 960 : 990 });
    if (leg === "back") game.shots[0].outHits = [game.enemies[0].id];
    game.rulesVersion = 7;
    const before = snapshot(game);
    const loaded = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: 15, current: before }) });
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.data.current, { ...before, rulesVersion: 8 });
    const restored = loaded.data.current, firstId = restored.shots[0].id;
    advance(restored, .3, .01, true);
    assert.equal(restored.shots.length, 1);
    assert.ok(restored.shots[0].id > firstId);
    assert.equal(restored.shots[0].damage, 36);
    assert.ok(validSnapshot(snapshot(restored)));
  }
});

test("고속 표창은 한 틱 안에서 지나친 적도 각 방향 한 번만 맞힘", () => {
  const game = setup(9), foe = target(game, 990), other = target(game, 990, 1);
  tick(game, .1);
  assert.equal(game.shots[0].x, 986);
  assert.equal(foe.hp, 364);
  tick(game, .1);
  assert.equal(game.shots[0].leg, "back");
  assert.ok(Math.abs(game.shots[0].x - 978) < 1e-8);
  assert.equal(foe.hp, 328);
  assert.equal(other.hp, 400);
});
