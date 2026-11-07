import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../src/engine.js";
import { freshSave, readSave, validateSave, updateProgress } from "../src/storage.js";
import { playStrategy } from "./helpers/strategy.mjs";

const { PLANTS, ENEMIES, createGame, plantAt, tick, snapshot, validSnapshot } = engine;
function enemy(game, type, row, x) {
  const target = { id: game.nextId++, type, row, x, hp: ENEMIES[type].hp, slow: 0, age: 0, eating: false };
  game.enemies.push(target);
  return target;
}
const advance = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 10); i++) tick(game, .1); };

test("v27 상위 공격은 50%·번개는 두 배 강화하고 기본 공격과 해금은 유지", () => {
  for (const [type, before, after] of [["twin", 22, 33], ["thorn", 24, 36], ["pumpkin", 64, 96], ["ember", 10, 15], ["storm", 32, 64]]) {
    assert.equal(PLANTS[type].damage, after);
    assert.equal(after / before, type === "storm" ? 2 : 1.5);
  }
  assert.equal(PLANTS.pea.damage, 12);
  assert.equal(PLANTS.frost.damage, 6);
  assert.equal(engine.BOMB_DAMAGE, 300);
  assert.equal(engine.BURN_DAMAGE, 4);
  assert.equal(PLANTS.storm.cost, 275);
  assert.ok(PLANTS.storm.damage * engine.CHAIN_HITS / PLANTS.storm.interval > PLANTS.thorn.damage * engine.THORN_HITS / PLANTS.thorn.interval * 1.3);
  assert.deepEqual(engine.introducedPlants(21), []);
  assert.deepEqual(engine.introducedPlants(19), ["storm"]);
  assert.deepEqual(engine.introducedPlants(25), []);
  assert.equal(plantAt(createGame(18), "storm", 0, 0).ok, false);
  assert.ok(engine.validLoadout(["twin", "thorn", "storm"], 19));
  assert.equal(engine.loadoutLimit(30), 8);
});

test("번개가시는 가까운 옆줄로 연결·최대5명·중복 없음·거리 경계·사망 연결", () => {
  for (const distance of [155, 155.01]) {
    const game = createGame(25, ["storm"]);
    const first = enemy(game, "barrel", 2, 500);
    const next = enemy(game, "barrel", 2, 500 + distance);
    const third = enemy(game, "barrel", 3, next.x);
    const fourth = enemy(game, "barrel", 3, next.x + 10);
    const fifth = enemy(game, "barrel", 4, next.x + 10);
    const sixth = enemy(game, "barrel", 4, next.x + 20);
    game.shots.push({ id: game.nextId++, kind: "storm", row: 2, x: 470, damage: PLANTS.storm.damage, frost: false });
    const saved = snapshot(game);
    assert.ok(validSnapshot(saved));
    tick(game, .1); tick(saved, .1);
    assert.deepEqual(game, saved);
    assert.equal(first.hp, 336);
    assert.equal(next.hp, 400);
    assert.equal(game.shots.length, 1);
    advance(game, .5);
    assert.equal(game.shots.length, 0);
    const damage = distance === 155 ? 64 : 0;
    assert.equal(next.hp, ENEMIES.barrel.hp - damage);
    assert.equal(third.hp, ENEMIES.barrel.hp - damage);
    assert.equal(fourth.hp, ENEMIES.barrel.hp - damage);
    assert.equal(fifth.hp, ENEMIES.barrel.hp - damage);
    assert.equal(sixth.hp, ENEMIES.barrel.hp);
    assert.equal(game.effects.filter(e => e.kind === "chain").length, damage ? 4 : 0);
  }
});

test("v27 실제 번개 공격은 최대 5명에게 각각 64 피해이며 정지·복구해도 중복 없음", () => {
  const game = createGame(19, ["storm"]);
  plantAt(game, "storm", 2, 0);
  const targets = Array.from({ length: 6 }, (_, index) => enemy(game, "barrel", 2, 450 + index * 35));
  advance(game, .2);
  assert.deepEqual(targets.map(e => e.hp), [336, 400, 400, 400, 400, 400]);
  const saved = snapshot(game);
  tick(game, 0);
  assert.deepEqual(snapshot(game), saved);
  const restored = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: 19, current: saved }) });
  assert.equal(restored.error, null);
  game.effects = [];
  advance(game, .6); advance(restored.data.current, .6);
  assert.deepEqual(restored.data.current, game);
  assert.deepEqual(targets.map(e => e.hp), [336, 336, 336, 336, 336, 400]);
});

test("신규 좀비 체력·속도·장비 탈락 경계와 냉기·화상·복구", () => {
  for (const [type, beforeSpeed, afterSpeed] of [["barrel", 12, 18], ["courier", 34, 22]]) {
    const game = createGame(25);
    const target = enemy(game, type, 2, 900);
    tick(game, .1);
    assert.ok(Math.abs((900 - target.x) - beforeSpeed * .1 * engine.boardWidth(game) / 900) < 1e-8);
    target.hp = ENEMIES[type].hp / 2 + 1;
    game.shots.push({ id: game.nextId++, row: 2, x: target.x - 30, damage: 1, frost: false });
    tick(game, .1);
    assert.equal(target.equipmentDropped, true);
    assert.equal(target.hp, ENEMIES[type].hp / 2);
    assert.equal(game.effects.filter(e => e.kind === "gear").length, 1);
    const x = target.x;
    target.slow = 3; target.burn = 1;
    game.effects = [];
    const saved = snapshot(game);
    tick(game, .1); tick(saved, .1);
    assert.deepEqual(saved, game);
    assert.ok(Math.abs((x - target.x) - afterSpeed * .48 * .1 * engine.boardWidth(game) / 900) < 1e-8);
    assert.equal(game.effects.filter(e => e.kind === "gear").length, 0);
    assert.ok(validSnapshot(game));
  }
});

test("연쇄의 같은 거리 후보는 ID 순서로 결정하고 죽은 적·두 줄 밖 적은 건너뜀", () => {
  const game = createGame(25, ["storm"]);
  const first = enemy(game, "barrel", 2, 500);
  const lowerId = enemy(game, "barrel", 1, 500);
  const higherId = enemy(game, "barrel", 3, 500);
  const dead = enemy(game, "barrel", 2, 510); dead.hp = 0;
  const far = enemy(game, "barrel", 0, 650);
  game.enemies.reverse();
  game.shots.push({ id: game.nextId++, kind: "storm", row: 2, x: 470, damage: 32, frost: false });
  advance(game, .4);
  assert.equal(first.hp, 368);
  assert.equal(lowerId.hp, 368);
  assert.equal(higherId.hp, 400);
  assert.equal(far.hp, 400);
  assert.equal(game.effects.filter(e => e.kind === "chain").length, 1);
});

test("순차 연쇄는 매 시점 정지·저장복구 가능하고 이미 죽은 적과 중복 ID를 건너뜀", () => {
  const game = createGame(25, ["storm"]);
  const targets = Array.from({ length: 6 }, (_, index) => enemy(game, "barrel", 2, 500 + index * 35));
  targets[0].hp = 10;
  game.shots.push({ id: game.nextId++, kind: "storm", row: 2, x: 470, damage: 32, frost: false });
  tick(game, .1);
  assert.equal(game.stats.defeated, 1);
  assert.equal(targets[1].hp, 400);
  targets[1].hp = 0;
  tick(game, .1);
  assert.ok(validSnapshot(snapshot(game)));
  const original = snapshot(game);
  for (const change of [
    s => s.hitIds.push(s.hitIds[0]), s => s.hitIds = [], s => s.hitIds.push(s.id),
    s => s.chainAt = game.time - 1, s => s.chainAt += 1, s => delete s.chainAt,
  ]) {
    const bad = snapshot(game); change(bad.shots[0]);
    assert.equal(validSnapshot(bad), false);
  }
  tick(game, 0);
  assert.deepEqual(snapshot(game), original);
  const hitCounts = [];
  for (let step = 0; step < 5; step++) {
    const restored = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: 25, current: snapshot(game) }) });
    assert.equal(restored.error, null);
    game.effects = [];
    tick(game, .1); tick(restored.data.current, .1);
    assert.deepEqual(game, restored.data.current);
    if (game.status === "playing") assert.ok(validSnapshot(snapshot(game)));
    hitCounts.push(targets.filter(e => e.hp === 368).length);
  }
  assert.deepEqual(hitCounts, [1, 2, 3, 4, 4]);
  assert.equal(game.shots.length, 0);
  assert.ok(targets.slice(2).every(e => e.hp === 368));
});

test("연쇄는 적이 범위 밖으로 나가면 끊기고 발사 후 식물 제거에도 한 번만 진행", () => {
  for (const remove of ["shovel", "dead"]) {
    const game = createGame(25, ["storm"]);
    plantAt(game, "storm", 2, 0);
    const first = enemy(game, "barrel", 2, 150);
    const second = enemy(game, "barrel", 3, 150);
    advance(game, .2);
    assert.equal(game.plants[0].shotAt, game.time);
    assert.equal(first.hp, 336);
    assert.equal(second.hp, 400);
    if (remove === "shovel") engine.removePlant(game, 2, 0);
    else game.plants[0].hp = 0;
    second.x = 900;
    advance(game, .5);
    assert.equal(first.hp, 336);
    assert.equal(second.hp, 400);
    assert.equal(game.shots.length, 0);
    assert.equal(game.plants.length, 0);
  }
});

test("선인장은 400햇빛·16초 재배치·22해금이며 첫3초와 매3초 가장 가까운 한 마리만 즉사", () => {
  assert.deepEqual(engine.introducedPlants(22), ["cactus"]);
  assert.deepEqual(engine.introducedPlants(28), []);
  assert.equal(plantAt(createGame(21), "cactus", 2, 5).ok, false);
  const game = createGame(22, ["cactus"]);
  game.nextSpawn = engine.STAGES[21].count;
  game.sun = 1000;
  assert.ok(plantAt(game, "cactus", 2, 5).ok);
  assert.equal(game.sun, 600);
  assert.equal(game.cooldowns.cactus, 16);
  assert.equal(game.plants[0].hp, 160);
  assert.equal(plantAt(game, "cactus", 1, 5).ok, false);
  const front = enemy(game, "barrel", 2, 950);
  const farther = enemy(game, "barrel", 2, 990);
  const behind = enemy(game, "barrel", 2, 400);
  const otherLane = enemy(game, "barrel", 1, 950);
  advance(game, 2.9);
  assert.equal(front.hp, 400);
  const samePosition = enemy(game, "barrel", 2, 550);
  tick(game, .1);
  assert.equal(front.hp, 0);
  assert.ok(Math.abs(game.cooldowns.cactus - 13) < 1e-8);
  assert.equal(farther.hp, 400);
  assert.equal(game.plants[0].laserTargetX, front.x);
  assert.equal(behind.hp, 400);
  assert.equal(otherLane.hp, 400);
  assert.equal(samePosition.hp, 400);
  assert.ok(game.plants[0].hp > 0);
  assert.equal(game.shots.length, 0);
  assert.equal(game.effects.filter(e => e.kind === "laser").length, 1);
  game.enemies = game.enemies.filter(e => e.id !== samePosition.id);
  const next = farther;
  advance(game, 2.9);
  assert.equal(next.hp, 400);
  tick(game, .1);
  assert.equal(next.hp, 0);
  assert.equal(game.stats.defeated, 2);
  assert.ok(game.plants.some(p => p.type === "cactus"));
});

test("선인장은 16초마다 다섯 개 이상 설치 가능하며 대기 중 실패는 자원·쿨다운 불변", () => {
  const game = createGame(22, ["cactus"]);
  game.sun = 5000;
  assert.equal(PLANTS.cactus.maxCount, undefined);
  assert.ok(plantAt(game, "cactus", 0, 0).ok);
  for (let row = 1; row < 5; row++) {
    advance(game, 15.9);
    const before = snapshot(game);
    assert.equal(plantAt(game, "cactus", row, 0).ok, false);
    assert.deepEqual(snapshot(game), before);
    tick(game, .1);
    const sun = game.sun;
    assert.ok(plantAt(game, "cactus", row, 0).ok);
    assert.equal(game.sun, sun - 400);
    assert.equal(game.plants.filter(p => p.type === "cactus").length, row + 1);
    assert.equal(game.cooldowns.cactus, 16);
    assert.ok(validSnapshot(snapshot(game)));
  }
  engine.removePlant(game, 0, 0);
  assert.equal(game.cooldowns.cactus, 16);
  assert.equal(plantAt(game, "cactus", 0, 0).ok, false);
});

test("같은 줄 선인장 세 개도 각각 최근접 한 마리만 처치하고 네 번째 적은 생존", () => {
  const game = createGame(22, ["cactus"]); game.sun = 1200;
  for (let col = 0; col < 3; col++) {
    game.cooldowns.cactus = 0;
    assert.ok(plantAt(game, "cactus", 2, col).ok);
  }
  const targets = [600, 700, 800, 900].map(x => enemy(game, "barrel", 2, x));
  advance(game, 3);
  assert.deepEqual(targets.map(e => e.hp), [0, 0, 0, 400]);
  assert.equal(game.stats.defeated, 3);
  assert.equal(game.effects.filter(e => e.kind === "laser").length, 3);
  assert.deepEqual(game.plants.map(p => p.laserTargetX), targets.slice(0, 3).map(e => e.x));
  assert.ok(validSnapshot(snapshot(game)));
});

test("기존 선인장3개와 남은6초를 보존하고 대기 후 네 번째를 바로 추가", () => {
  const game = createGame(28, ["cactus"]);
  game.rulesVersion = 7; game.pacingVersion = 6; game.sun = 2000;
  for (let row = 0; row < 3; row++) game.plants.push({
    id: game.nextId++, type: "cactus", row, col: 0, hp: 160, timer: 6, age: 0,
  });
  game.cooldowns.cactus = 6;
  const data = { ...freshSave(), unlocked: 28, current: snapshot(game) };
  const loaded = readSave({ getItem: () => JSON.stringify(data) });
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.data, { ...data, current: { ...data.current, rulesVersion: 10,
    plants: data.current.plants.map(p => ({ ...p, timer: 3 })) } });
  const restored = loaded.data.current;
  advance(restored, 6);
  assert.equal(restored.cooldowns.cactus, 0);
  assert.equal(restored.plants.length, 3);
  assert.ok(plantAt(restored, "cactus", 3, 0).ok);
  assert.equal(restored.plants.length, 4);
  assert.equal(restored.cooldowns.cactus, 16);
  const before = snapshot(restored);
  tick(restored, 0);
  assert.deepEqual(snapshot(restored), before);
  const roundTrip = readSave({ getItem: () => JSON.stringify({ ...data, current: before }) });
  assert.equal(roundTrip.error, null);
  assert.deepEqual(roundTrip.data.current, before);
});

test("선인장 충전은 정지·복구에 보존되고 첫 공격 전에 제거하거나 죽으면 취소", () => {
  for (const remove of [null, "shovel", "dead"]) {
    const game = createGame(28, ["cactus"]);
    game.sun = 400; plantAt(game, "cactus", 2, 0);
    const target = enemy(game, "barrel", 2, 950);
    advance(game, 1.5);
    const data = { ...freshSave(), unlocked: 28, current: snapshot(game) };
    const loaded = readSave({ getItem: () => JSON.stringify(data) });
    assert.equal(loaded.error, null);
    const unchanged = snapshot(game);
    tick(game, 0); assert.deepEqual(snapshot(game), unchanged);
    if (remove === "shovel") engine.removePlant(game, 2, 0);
    if (remove === "dead") game.plants[0].hp = 0;
    game.effects = [];
    advance(game, 1.5); advance(loaded.data.current, 1.5);
    if (remove) {
      assert.equal(target.hp, 400);
      assert.equal(game.plants.length, 0);
    } else {
      assert.equal(target.hp, 0);
      assert.deepEqual(game, loaded.data.current);
    }
  }
});

test("선인장은 동률 ID 순으로 한 마리만 선택하며 빈 줄과 죽은 적에 유령 공격 없음", () => {
  const game = createGame(22, ["cactus"]); game.sun = 1000;
  plantAt(game, "cactus", 2, 1);
  advance(game, 3.5);
  assert.equal(game.plants[0].shotAt, undefined);
  assert.equal(game.plants[0].timer, 0);
  assert.equal(game.effects.filter(e => e.kind === "laser").length, 0);
  const dead = enemy(game, "barrel", 2, 200); dead.hp = 0;
  const low = enemy(game, "barrel", 2, 600);
  const high = enemy(game, "barrel", 2, 600);
  const other = enemy(game, "barrel", 1, 200);
  const behind = enemy(game, "barrel", 2, 100);
  game.enemies.reverse();
  tick(game, .1);
  assert.equal(low.hp, 0);
  assert.equal(high.hp, 400);
  assert.equal(other.hp, 400);
  assert.equal(behind.hp, 400);
  assert.equal(game.plants[0].laserTargetX, 600);
  assert.equal(game.effects.filter(e => e.kind === "laser").length, 1);
  advance(game, .4);
  assert.equal(high.hp, 400);
  assert.equal(game.effects.filter(e => e.kind === "laser").length, 0);
});

test("v31 공격 타이머는 최대3초로 한 번만 이관하고 초과 선인장·진행·설정을 보존", () => {
  const game = createGame(28, ["cactus", "shuriken"]); game.rulesVersion = 7; game.pacingVersion = 6;
  game.cooldowns.cactus = 17;
  for (const [row, timer] of [6, 4, 1.2, 0].entries()) game.plants.push({
    id: game.nextId++, type: "cactus", row, col: 0, hp: 160, timer, age: 0,
  });
  const data = { ...freshSave(), unlocked: 28, stars: freshSave().stars.fill(3), language: "en", volume: 67,
    teamSlots: ["cactus", null, "shuriken", null, null, null, null, null], current: snapshot(game) };
  const loaded = readSave({ getItem: () => JSON.stringify(data) });
  assert.equal(loaded.error, null);
  const expected = structuredClone(data); expected.current.rulesVersion = 10;
  expected.current.cooldowns.cactus = 16;
  expected.current.plants[0].timer = 3; expected.current.plants[1].timer = 3;
  assert.deepEqual(loaded.data, expected);
  const again = readSave({ getItem: () => JSON.stringify(loaded.data) });
  assert.deepEqual(again.data, expected);
  assert.ok(validSnapshot(again.data.current));
});

test("선인장 목표 좌표 저장을 검증하고 승리 연출은 추가 처치 없이 끝남", () => {
  const game = createGame(22, ["cactus"]); game.sun = 400;
  plantAt(game, "cactus", 2, 0);
  enemy(game, "barrel", 2, 600);
  advance(game, 3);
  const before = snapshot(game);
  const loaded = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: 22, current: before }) });
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.data.current, before);
  for (const x of [NaN, -1, 50, 1101, "600"]) {
    const bad = snapshot(game); bad.plants[0].laserTargetX = x;
    assert.equal(validSnapshot(bad), false);
  }
  game.nextSpawn = engine.scheduleFor(22).length;
  tick(game, .01);
  assert.equal(game.status, "won");
  const time = game.time, defeated = game.stats.defeated;
  for (let i = 0; i < 10; i++) { tick(game, .1); engine.advanceEffects(game, .1); }
  assert.equal(game.time, time);
  assert.equal(game.stats.defeated, defeated);
  assert.equal(game.effects.filter(e => e.kind === "laser").length, 0);
});

test("v33 이전 재배치20초는 검증 후16초로만 줄이고 공격·생산·다른 식물은 보존", () => {
  for (const rulesVersion of [6, 7, 8]) for (const remaining of [0, .1, 6, 16, 17, 20]) {
    const game = createGame(22, ["cactus", "shuriken"]); game.sun = 1000;
    plantAt(game, "cactus", 2, 0); plantAt(game, "shuriken", 0, 0);
    enemy(game, "barrel", 0, 800); tick(game, .1);
    game.rulesVersion = rulesVersion; game.cooldowns.cactus = remaining;
    const data = { ...freshSave(), unlocked: 22, stars: freshSave().stars.fill(3), language: "en", volume: 67,
      teamSlots: ["cactus", null, "shuriken", null, null, null, null, null], current: snapshot(game) };
    const loaded = readSave({ getItem: () => JSON.stringify(data) });
    assert.equal(loaded.error, null);
    const expected = structuredClone(data); expected.current.rulesVersion = 10;
    expected.current.cooldowns.cactus = Math.min(remaining, 16);
    assert.deepEqual(loaded.data, expected);
    assert.deepEqual(readSave({ getItem: () => JSON.stringify(loaded.data) }).data, expected);
    assert.ok(validSnapshot(loaded.data.current));
  }
  for (const [rulesVersion, cooldown] of [[8, 20.01], [9, 16.01]]) {
    const game = createGame(22); game.rulesVersion = rulesVersion; game.cooldowns.cactus = cooldown;
    assert.equal(validSnapshot(game), false);
  }
  assert.equal(engine.SKY_SUN_INTERVAL, 7);
  assert.equal(PLANTS.sun.interval, 8);
  assert.equal(PLANTS.lantern.interval, 10);
  assert.deepEqual(Object.fromEntries(Object.entries(PLANTS).map(([type, plant]) => [type, plant.recharge])), {
    sun: 4, pea: 5, wall: 7, frost: 4, bomb: 14, twin: 8, thorn: 8, pumpkin: 9,
    lantern: 9, iron: 12, ember: 9, storm: 10, cactus: 16, shuriken: 10, sprinkler: 12,
  });
});

test("v25에서 기존 19·22단계 진행과 팀은 보존하고 새 선택에 해금을 적용", () => {
  for (const [type, stage] of [["storm", 19], ["cactus", 22]]) {
    const data = { ...freshSave(), unlocked: stage, stars: [...Array(stage - 1).fill(3), ...Array(31 - stage).fill(0)],
      language: "en", volume: 67, teamSlots: ["sun", null, "twin", null, null, null, null, null],
      current: createGame(stage, ["sun", "twin"]) };
    const loaded = readSave({ getItem: () => JSON.stringify(data) });
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.data, data);
    assert.equal(engine.validLoadout([type], stage - 1), false);
    assert.equal(engine.validLoadout([type], stage), true);
    const game = createGame(stage, [type]);
    game.sun = PLANTS[type].cost;
    assert.ok(plantAt(game, type, 0, 0).ok);
    assert.ok(validSnapshot(snapshot(game)));
  }
});

test("v23 별20칸·팀빈칸·진행·발사체 보존, 마지막 클리어 때만 21단계 개방", () => {
  for (const cleared of [false, true]) {
    const game = createGame(20, ["sun", "pea", "twin"]);
    plantAt(game, "twin", 2, 0); enemy(game, "jelly", 2, 900); advance(game, .2);
    game.rulesVersion = 5; delete game.cooldowns.storm; delete game.cooldowns.cactus;
    game.shots[0].damage = 24;
    const old = { ...freshSave(), unlocked: 20, stars: [...Array(19).fill(3), cleared ? 2 : 0],
      language: "en", volume: 67, teamSlots: ["sun", null, "pea", "twin", null, null, null, null], current: snapshot(game) };
    const restored = readSave({ getItem: () => JSON.stringify(old) });
    assert.equal(restored.error, null);
    assert.deepEqual(restored.data, { ...old, unlocked: cleared ? 21 : 20, stars: [...old.stars, ...Array(10).fill(0)],
      current: { ...old.current, rulesVersion: 10, cooldowns: { ...old.current.cooldowns, storm: 0, cactus: 0 } } });
    assert.equal(restored.data.current.shots[0].damage, 24);
    advance(restored.data.current, .2);
    assert.equal(restored.data.current.shots[1].damage, 33);
    assert.ok(validateSave(restored.data));
  }
});

test("21~30은 테마 시작 물량 리셋·36~90명·모든 줄·세 무리, 기존 테마에 새 좀비를 섞지 않음", () => {
  assert.deepEqual(engine.THEMES.map(theme => theme.id), ["garden", "moon", "desert"]);
  assert.equal(engine.STAGES.length, 30);
  assert.ok(engine.STAGES.slice(0, 10).every(stage => stage.theme === "garden"));
  assert.ok(engine.STAGES.slice(10, 20).every(stage => stage.theme === "moon"));
  assert.ok(engine.scheduleFor(21).length < engine.scheduleFor(20).length);
  assert.ok(engine.STAGES.slice(0, 20).every(stage => engine.scheduleFor(stage.id).every(e => !["barrel", "courier"].includes(e.type))));
  for (const stage of engine.STAGES.slice(20)) {
    const plan = engine.scheduleFor(stage.id);
    assert.equal(stage.theme, "desert");
    assert.equal(plan.length, 36 + (stage.id - 21) * 6);
    assert.equal(stage.hpMultiplier, 1.6);
    assert.deepEqual(plan.slice(0, 3).map(e => e.at), [10, 24, 36]);
    assert.equal(new Set(plan.map(e => e.row)).size, 5);
    assert.ok(plan.filter(e => e.wave === 3).length > plan.length * .6);
  }
});

test("모래 사막 전 단계를 실제 8종·비용·쿨다운·초당 1회 행동으로 통과", t => {
  const progress = { ...freshSave(), unlocked: 21 };
  for (let stage = 21; stage <= 30; stage++) {
    const attacker = "twin";
    const team = ["sun", "lantern", "bomb", "wall", "pea", "twin", "pumpkin", stage < 25 ? "thorn" : "storm"];
    const result = playStrategy({ ...engine, createGame: n => createGame(n, team) }, stage, "expanded", attacker);
    assert.equal(result.game.status, "won", `${stage}단계`);
    assert.ok(result.game.time < 260);
    assert.ok(result.actions.every((a, i) => team.includes(a.type) && (!i || a.time - result.actions[i - 1].time >= .999)));
    assert.ok(result.actions.some(a => a.type === "twin"));
    if (stage >= 25) assert.ok(result.actions.some(a => a.type === "storm"));
    updateProgress(progress, result.game);
    assert.equal(progress.unlocked, Math.min(30, stage + 1));
    t.diagnostic(`${stage}: ${result.game.time.toFixed(1)}초, 하트 ${result.game.lives}, 손실 ${result.lostPlants}`);
  }
  for (const attacker of ["pea", "twin", "storm", "pumpkin"]) {
    const result = playStrategy({ ...engine, createGame: n => createGame(n, ["sun", attacker]) }, 30, "pea", attacker);
    assert.equal(result.game.status, attacker === "pea" ? "lost" : "won", `${attacker} v30 단일공격 비교`);
  }
});
