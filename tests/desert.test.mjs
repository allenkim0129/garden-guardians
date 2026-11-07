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

test("v24 기본 공격은 8~17% 감소하고 새 식물은 별도 해금되는 비싼 상위형", () => {
  for (const [type, before, after] of [["pea", 14, 12], ["frost", 7, 6], ["twin", 24, 22],
    ["thorn", 26, 24], ["pumpkin", 70, 64], ["ember", 12, 10]]) {
    assert.equal(PLANTS[type].damage, after);
    assert.ok(after / before >= .83 && after / before <= .93);
  }
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
    assert.equal(first.hp, 368);
    assert.equal(next.hp, 400);
    assert.equal(game.shots.length, 1);
    advance(game, .5);
    assert.equal(game.shots.length, 0);
    const damage = distance === 155 ? 32 : 0;
    assert.equal(next.hp, ENEMIES.barrel.hp - damage);
    assert.equal(third.hp, ENEMIES.barrel.hp - damage);
    assert.equal(fourth.hp, ENEMIES.barrel.hp - damage);
    assert.equal(fifth.hp, ENEMIES.barrel.hp - damage);
    assert.equal(sixth.hp, ENEMIES.barrel.hp);
    assert.equal(game.effects.filter(e => e.kind === "chain").length, damage ? 4 : 0);
  }
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
    assert.equal(first.hp, 368);
    assert.equal(second.hp, 400);
    if (remove === "shovel") engine.removePlant(game, 2, 0);
    else game.plants[0].hp = 0;
    second.x = 900;
    advance(game, .5);
    assert.equal(first.hp, 368);
    assert.equal(second.hp, 400);
    assert.equal(game.shots.length, 0);
    assert.equal(game.plants.length, 0);
  }
});

test("선인장은 400햇빛·6초 재배치·22해금이며 첫6초와 매6초 전방 같은 줄만 즉사", () => {
  assert.deepEqual(engine.introducedPlants(22), ["cactus"]);
  assert.deepEqual(engine.introducedPlants(28), []);
  assert.equal(plantAt(createGame(21), "cactus", 2, 5).ok, false);
  const game = createGame(22, ["cactus"]);
  game.nextSpawn = engine.STAGES[21].count;
  game.sun = 1000;
  assert.ok(plantAt(game, "cactus", 2, 5).ok);
  assert.equal(game.sun, 600);
  assert.equal(game.cooldowns.cactus, 6);
  assert.equal(game.plants[0].hp, 160);
  assert.equal(plantAt(game, "cactus", 1, 5).ok, false);
  const front = enemy(game, "barrel", 2, 950);
  const behind = enemy(game, "barrel", 2, 400);
  const otherLane = enemy(game, "barrel", 1, 950);
  advance(game, 5.9);
  assert.equal(front.hp, 400);
  const samePosition = enemy(game, "barrel", 2, 550);
  tick(game, .1);
  assert.equal(front.hp, 0);
  assert.equal(game.cooldowns.cactus, 0);
  assert.equal(behind.hp, 400);
  assert.equal(otherLane.hp, 400);
  assert.equal(samePosition.hp, 400);
  assert.ok(game.plants[0].hp > 0);
  assert.equal(game.shots.length, 0);
  assert.equal(game.effects.filter(e => e.kind === "laser").length, 1);
  game.enemies = game.enemies.filter(e => e.id !== samePosition.id);
  const next = enemy(game, "barrel", 2, 950);
  advance(game, 5.9);
  assert.equal(next.hp, 400);
  tick(game, .1);
  assert.equal(next.hp, 0);
  assert.equal(game.stats.defeated, 2);
  assert.ok(game.plants.some(p => p.type === "cactus"));
});

test("선인장 충전은 정지·복구에 보존되고 첫 공격 전에 제거하거나 죽으면 취소", () => {
  for (const remove of [null, "shovel", "dead"]) {
    const game = createGame(28, ["cactus"]);
    game.sun = 400; plantAt(game, "cactus", 2, 0);
    const target = enemy(game, "barrel", 2, 950);
    advance(game, 3);
    const data = { ...freshSave(), unlocked: 28, current: snapshot(game) };
    const loaded = readSave({ getItem: () => JSON.stringify(data) });
    assert.equal(loaded.error, null);
    const unchanged = snapshot(game);
    tick(game, 0); assert.deepEqual(snapshot(game), unchanged);
    if (remove === "shovel") engine.removePlant(game, 2, 0);
    if (remove === "dead") game.plants[0].hp = 0;
    game.effects = [];
    advance(game, 3); advance(loaded.data.current, 3);
    if (remove) {
      assert.equal(target.hp, 400);
      assert.equal(game.plants.length, 0);
    } else {
      assert.equal(target.hp, 0);
      assert.deepEqual(game, loaded.data.current);
    }
  }
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
      current: { ...old.current, rulesVersion: 6, cooldowns: { ...old.current.cooldowns, storm: 0, cactus: 0 } } });
    assert.equal(restored.data.current.shots[0].damage, 24);
    advance(restored.data.current, .2);
    assert.equal(restored.data.current.shots[1].damage, 22);
    assert.ok(validateSave(restored.data));
  }
});

test("21~30은 더 큰 총 체력·모든 줄·세 무리, 기존 테마에 새 좀비를 섞지 않음", () => {
  assert.deepEqual(engine.THEMES.map(theme => theme.id), ["garden", "moon", "desert"]);
  assert.equal(engine.STAGES.length, 30);
  assert.ok(engine.STAGES.slice(0, 10).every(stage => stage.theme === "garden"));
  assert.ok(engine.STAGES.slice(10, 20).every(stage => stage.theme === "moon"));
  const hp = plan => plan.reduce((sum, e) => sum + ENEMIES[e.type].hp, 0);
  assert.ok(engine.STAGES.slice(0, 20).every(stage => engine.scheduleFor(stage.id).every(e => !["barrel", "courier"].includes(e.type))));
  for (const stage of engine.STAGES.slice(20)) {
    const plan = engine.scheduleFor(stage.id);
    assert.equal(stage.theme, "desert");
    assert.equal(plan.length, 126 + (stage.id - 21) * 6);
    assert.ok(hp(plan) > hp(engine.scheduleFor(20)));
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
    assert.equal(result.game.status, "lost", `${attacker} 단일공격 도배`);
  }
});
