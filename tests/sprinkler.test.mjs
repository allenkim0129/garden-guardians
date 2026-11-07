import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PLANTS, createGame, plantAt, removePlant, tick, snapshot, validSnapshot, introducedPlants,
  isWatered, sprinklerTargets, plantActionRate, plantActionRemaining, shurikenSpeed, scheduleFor,
} from "../src/engine.js";
import { freshSave, readSave } from "../src/storage.js";
import { plantFrame, SPRINKLER_NOZZLES } from "../src/sprites.js";
import { sprinklerWaterPaths } from "../src/art.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function garden() { const game = createGame(22); game.sun = 100000; return game; }
function place(game, type, row, col) {
  game.cooldowns[type] = 0;
  assert.ok(plantAt(game, type, row, col).ok);
  return game.plants.at(-1);
}
function enemy(game, row = 2, x = 800) {
  const enemy = { id: game.nextId++, type: "barrel", row, x, hp: 400, age: 0, slow: 0, eating: false };
  game.enemies.push(enemy); return enemy;
}
function advance(game, seconds) {
  for (let remaining = seconds; remaining > 1e-9; remaining -= .05) tick(game, Math.min(.05, remaining));
}
function restore(game) {
  const data = { ...freshSave(), unlocked: 22, stars: freshSave().stars.fill(2), language: "en",
    volume: 67, teamSlots: ["sun", "sprinkler", null, "shuriken", null, null, null, null], current: snapshot(game) };
  const result = readSave({ getItem: () => JSON.stringify(data) });
  assert.equal(result.error, null);
  return { data, loaded: result.data };
}

test("물뿌리 승인 가격200·해금12 및 기본 HP100·재배치12", () => {
  assert.deepEqual(introducedPlants(12), ["sprinkler"]);
  const { cost, hp, recharge, unlockStage } = PLANTS.sprinkler;
  assert.deepEqual({ cost, hp, recharge, unlockStage }, { cost: 200, hp: 100, recharge: 12, unlockStage: 12 });
  assert.equal(plantAt(createGame(11), "sprinkler", 0, 0).ok, false);
  const game = createGame(12, ["sun"]);
  assert.equal(plantAt(game, "sprinkler", 0, 0).ok, false);
  const allowed = createGame(12, ["sprinkler"]);
  assert.ok(plantAt(allowed, "sprinkler", 0, 0).ok);
  assert.equal(allowed.cooldowns.sprinkler, 12);
});

test("주변 8칸·대각선·모서리·9/10열 범위와 중복 비중첩", () => {
  for (const columns of [9, 10]) for (const [row, col] of [[0, 0], [4, columns - 1], [2, 4]]) {
    const game = garden(); game.columns = columns;
    const source = place(game, "sprinkler", row, col);
    for (let r = 0; r < 5; r++) for (let c = 0; c < columns; c++) {
      if (r === row && c === col) continue;
      const plant = place(game, "sun", r, c);
      assert.equal(isWatered(game, plant), Math.max(Math.abs(r - row), Math.abs(c - col)) === 1);
    }
    assert.equal(sprinklerTargets(game, source).length, row === 2 ? 8 : 3);
    assert.equal(isWatered(game, source), false);
    source.hp = 0;
    assert.equal(sprinklerTargets(game, source).length, 0);
    assert.ok(game.plants.every(p => !isWatered(game, p)));
  }
  const game = garden(), plant = place(game, "pea", 2, 4);
  plant.age = 1; plant.shotAt = 0; plant.timer = 1.6;
  const a = place(game, "sprinkler", 1, 3), b = place(game, "sprinkler", 3, 5);
  near(plantActionRemaining(game, plant), .5);
  a.hp = 0; near(plantActionRemaining(game, plant), .5);
  b.hp = 0; near(plantActionRemaining(game, plant), 1.6);
});

for (const [type, first, interval] of [
  ["sun", 3, 6], ["lantern", 6, 8], ["cactus", 1, 1],
  ["pea", .2, .5], ["frost", .2, .5], ["twin", .2, .5], ["thorn", .2, .8],
  ["pumpkin", .2, 2.5], ["ember", .2, 1.2], ["storm", .2, 2.2],
]) test(`${type}: 첫 행동 ${first}초, 반복 ${interval}초 실측`, () => {
  const game = garden(), plant = place(game, type, 2, 1);
  place(game, "sprinkler", 1, 0); place(game, "sprinkler", 3, 2);
  enemy(game);
  const event = () => plant.producedAt ?? plant.shotAt;
  advance(game, first - .01); assert.equal(event(), undefined);
  tick(game, .01); near(event(), first);
  if (type === "cactus") enemy(game);
  advance(game, interval - .01); near(event(), first);
  tick(game, .01); near(event(), first + interval);
  assert.ok(validSnapshot(snapshot(game)));
  if (type === "twin") {
    near(plant.pendingShotAt - plant.shotAt, .2);
    advance(game, .2);
    assert.equal(plant.pendingShotAt, undefined);
  }
});

test("설치·중복 설치·삽·사망은 타이머를 재설정하지 않고 남은 기본 작업량 보존", () => {
  const game = garden(), sun = place(game, "sun", 1, 3);
  game.time = sun.age = 4; sun.producedAt = 0; sun.timer = 4;
  near(plantActionRemaining(game, sun), 4);
  const a = place(game, "sprinkler", 2, 3);
  near(sun.timer, 4); near(plantActionRemaining(game, sun), 3);
  const b = place(game, "sprinkler", 0, 3);
  near(plantActionRemaining(game, sun), 3);
  removePlant(game, b.row, b.col);
  near(plantActionRemaining(game, sun), 3);
  advance(game, .75);
  near(sun.timer, 3); near(plantActionRemaining(game, sun), 2.25);
  a.hp = 1; enemy(game, 2, 350); tick(game, .1);
  assert.ok(!game.plants.includes(a));
  near(sun.timer, 3 - .1 * 8 / 6);
  near(plantActionRemaining(game, sun), sun.timer);
  const before = sun.timer; tick(game, .1); near(sun.timer, before - .1);
  const c = place(game, "sprinkler", 2, 3);
  const remaining = sun.timer;
  assert.ok(removePlant(game, c.row, c.col).ok);
  near(sun.timer, remaining); near(plantActionRemaining(game, sun), remaining);
});

test("첫 생산 도중 설치·제거도 진행률 유지, 방어·폭탄·지원·카드·하늘은 불변", () => {
  const game = garden(), sun = place(game, "sun", 2, 1);
  advance(game, 2.5); near(sun.timer, 2.5);
  const source = place(game, "sprinkler", 1, 1);
  near(plantActionRemaining(game, sun), 1.5);
  advance(game, .6); near(sun.timer, 1.5);
  removePlant(game, source.row, source.col);
  near(plantActionRemaining(game, sun), 1.5);
  advance(game, 1.5); near(sun.producedAt, 4.6);
  for (const type of ["wall", "iron", "bomb", "sprinkler"]) {
    const fixture = garden(), plant = place(fixture, type, 1, 1);
    place(fixture, "sprinkler", 2, 2);
    assert.equal(isWatered(fixture, plant), false);
    assert.equal(plantActionRate(fixture, plant), 1);
    advance(fixture, .5);
    near(fixture.cooldowns[type], PLANTS[type].recharge - .5);
    near(fixture.skyTimer, 3.5);
    if (type === "bomb") {
      assert.ok(fixture.plants.includes(plant));
      advance(fixture, .55); assert.ok(!fixture.plants.includes(plant));
    }
  }
});

test("표창 소유자 주변에서 왕복540/s, 비행 중 설치·제거·중복 시 좌표/방향/기록 유지", () => {
  const game = garden(), plant = place(game, "shuriken", 2, 2);
  enemy(game, 2, 900); tick(game, .05);
  const shot = game.shots[0], x = shot.x;
  const source = place(game, "sprinkler", 1, 1);
  assert.equal(shurikenSpeed(game, plant), 540);
  const before = structuredClone(shot);
  place(game, "sprinkler", 3, 3);
  assert.deepEqual(shot, before);
  tick(game, .05); near(shot.x - x, 540 * .05);
  Object.assign(shot, { x: 700, leg: "back", outHits: [game.enemies[0].id] });
  tick(game, .05); near(shot.x, 673);
  const copy = structuredClone(shot);
  removePlant(game, source.row, source.col);
  assert.deepEqual(shot, copy); assert.equal(shurikenSpeed(game, plant), 540);
  removePlant(game, 3, 3);
  assert.deepEqual(shot, copy); assert.equal(shurikenSpeed(game, plant), 360);
  tick(game, .05); near(shot.x, 655);
  assert.equal(shot.damage, 36); assert.deepEqual(shot.outHits, copy.outHits);
  place(game, "sprinkler", 2, 7);
  assert.equal(isWatered(game, plant), false, "비행체 주변이 아닌 소유 식물 주변 판정");
});

test("가속 표창 최우측 swept 충돌·반전 잔여시간·즉시 재투척·소유자 교체", () => {
  const game = garden(), plant = place(game, "shuriken", 2, 9);
  place(game, "sprinkler", 1, 8);
  const target = enemy(game, 2, 975), other = enemy(game, 3, 975);
  tick(game, .1);
  assert.equal(target.hp, 400 - 72); assert.equal(other.hp, 400);
  assert.equal(game.shots.length, 1); assert.equal(game.shots[0].leg, "back");
  near(game.shots[0].x, 996);
  tick(game, .1);
  assert.equal(game.shots.length, 1); assert.equal(game.shots[0].leg, "out");
  near(game.shots[0].x, 958);
  assert.ok(removePlant(game, 2, 9).ok); assert.equal(game.shots.length, 0);
  const replacement = place(game, "shuriken", 2, 9);
  assert.notEqual(replacement.id, plant.id);
  tick(game, .01); assert.equal(game.shots[0].plantId, replacement.id);
});

test("가속 중 저장 복원 반복은 진행률·비행·언어·팀·별을 그대로 유지", () => {
  const game = garden();
  place(game, "sun", 2, 2); place(game, "sprinkler", 1, 1); place(game, "shuriken", 2, 0);
  enemy(game); advance(game, .3);
  const { data, loaded } = restore(game);
  assert.deepEqual(loaded, data);
  game.effects = [];
  for (let i = 0; i < 80; i++) { tick(game, .05); tick(loaded.current, .05); }
  assert.deepEqual(loaded.current, game);
  assert.deepEqual(restore(loaded.current).loaded.current, snapshot(game));
  const before = snapshot(game);
  tick(game, 0); tick(game, NaN);
  assert.deepEqual(snapshot(game), before);
  game.status = "won"; const terminal = structuredClone(game);
  tick(game, .1); assert.deepEqual(game, terminal);
  assert.equal(sprinklerWaterPaths(game.plants.find(p => p.type === "sprinkler"), game).length, 0);
});

test("v33 저장은 새 쿨다운만 추가하며 기존 타이머·일정·투사체를 보존", () => {
  const game = garden(); place(game, "sun", 1, 1); place(game, "shuriken", 2, 0); enemy(game);
  advance(game, .3); game.rulesVersion = 9; delete game.cooldowns.sprinkler;
  const result = restore(game);
  assert.deepEqual(result.loaded, { ...result.data, current: { ...result.data.current, rulesVersion: 10,
    cooldowns: { ...result.data.current.cooldowns, sprinkler: 0 } } });
  assert.equal(validSnapshot({ ...snapshot(game), rulesVersion: 10 }), false);
});

test("12프레임 정렬·분사구 일치와 실제 대상만 향하는 순수 시각효과", () => {
  const frames = JSON.parse(readFileSync(new URL("../assets/sprites/alignment.json", import.meta.url))).sheets.sprinkler;
  assert.equal(frames.length, 12);
  assert.deepEqual(frames.slice(4, 8).map(frame => frame.nozzles), SPRINKLER_NOZZLES);
  assert.deepEqual([...new Set(frames.map(frame => frame.scale))], [.56]);
  assert.ok(frames.every(frame => frame.alignedBounds[3] === 210 && frame.alignedBounds[1] > 3));
  const game = garden(), source = place(game, "sprinkler", 2, 2);
  const target = place(game, "sun", 1, 1);
  place(game, "wall", 1, 2); place(game, "sun", 0, 0);
  for (let col = 0; col < 4; col++) {
    source.age = col * .2 + .01;
    assert.deepEqual(plantFrame(source, game), { state: "watering", row: 1, col });
    const before = structuredClone(game), paths = sprinklerWaterPaths(source, game);
    assert.deepEqual(game, before);
    assert.deepEqual(paths.map(p => p.targetId), [target.id]);
    near(paths[0].x, 250 + (SPRINKLER_NOZZLES[col][0][0] - 192) * .48 * .9);
    assert.deepEqual([paths[0].toX, paths[0].toY], [150, 165]);
  }
  source.age = .9; assert.equal(plantFrame(source, game).state, "idle");
  game.time = 1; source.hurtAt = .8;
  assert.equal(plantFrame(source, game).state, "hurt");
  assert.equal(sprinklerWaterPaths(source, game).length, 0);
});

test("가속 대기 중 적이 없어도 유령 공격·공격 횟수 축적 없이 다음 한 마리만 처치", () => {
  const game = garden(), cactus = place(game, "cactus", 2, 4);
  place(game, "sprinkler", 1, 3);
  const behind = enemy(game, 2, 100), otherRow = enemy(game, 3, 800);
  advance(game, 3);
  assert.equal(cactus.timer, 0); assert.equal(cactus.shotAt, undefined);
  assert.equal(behind.hp, 400); assert.equal(otherRow.hp, 400);
  const first = enemy(game, 2, 800), tied = enemy(game, 2, 800);
  tick(game, .01);
  assert.equal(first.hp, 0); assert.equal(tied.hp, 400);
  near(cactus.timer, 3); near(plantActionRemaining(game, cactus), 1);
});

test("물뿌리는 다른 투사체 비행·화상·번개 전이 간격을 가속하지 않음", () => {
  const game = garden();
  place(game, "ember", 2, 1); place(game, "sprinkler", 1, 0);
  const target = enemy(game); target.burn = 3;
  game.shots.push({ id: game.nextId++, row: 4, x: 100, damage: 12, frost: false });
  tick(game, .1);
  near(target.hp, 399.6); near(target.burn, 2.9);
  near(game.shots[0].x, 100 + 330 * 10 / 9 * .1);
  const chain = garden(), storm = place(chain, "storm", 2, 1);
  place(chain, "sprinkler", 1, 0);
  enemy(chain, 2, 800); const second = enemy(chain, 2, 850);
  advance(chain, .2);
  near(chain.shots[0].chainAt - storm.shotAt, .12);
  advance(chain, .1); assert.equal(second.hp, 400);
  tick(chain, .02); assert.equal(second.hp, 336);
});

test("가속 표창의 마지막 처치로 승리하면 비행과 분사를 종료", () => {
  const game = garden();
  place(game, "shuriken", 2, 9); const source = place(game, "sprinkler", 1, 8);
  game.nextSpawn = scheduleFor(game.stage, game.pacingVersion).length;
  enemy(game, 2, 975).hp = 36;
  tick(game, .1);
  assert.equal(game.status, "won"); assert.equal(game.shots.length, 0);
  assert.equal(game.stats.defeated, 1); assert.equal(sprinklerWaterPaths(source, game).length, 0);
  const before = snapshot(game); tick(game, .1);
  assert.deepEqual(snapshot(game), before);
});
