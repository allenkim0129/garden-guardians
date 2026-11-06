import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../src/engine.js";
import { freshSave, readSave } from "../src/storage.js";
import { plantFrame } from "../src/sprites.js";
import { projectilePosition } from "../src/art.js";
import { playStrategy } from "./helpers/strategy.mjs";

const { createGame, plantAt, removePlant, tick, snapshot, validSnapshot, PLANTS, ENEMIES, TWIN_GAP, PUMPKIN_RADIUS, THORN_HITS } = engine;
const advance = (game, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) tick(game, 1 / 30); };
function enemy(game, row, x) {
  const result = { id: game.nextId++, type: "jelly", row, x, hp: ENEMIES.jelly.hp, slow: 0, age: 0, eating: false };
  game.enemies.push(result); return result;
}
function duel(type) {
  const game = createGame(10);
  assert.ok(plantAt(game, type, 2, 0).ok);
  enemy(game, 2, 750);
  return game;
}
test("쌍콩이는 시간차 두 발과 위·아래 프레임/발사 원점을 사용", () => {
  const game = duel("twin");
  tick(game, .1); tick(game, .1);
  assert.equal(game.shots.length, 1);
  assert.equal(game.shots[0].muzzle, 0);
  assert.equal(plantFrame(game.plants[0], game).col, 0);
  const firstAt = game.time;
  tick(game, .1);
  assert.equal(game.shots.length, 1);
  assert.equal(plantFrame(game.plants[0], game).col, 1);
  tick(game, .1);
  assert.equal(game.shots.length, 2);
  assert.equal(game.shots[1].muzzle, 1);
  assert.equal(plantFrame(game.plants[0], game).col, 2);
  assert.ok(Math.abs(game.time - firstAt - TWIN_GAP) < 1e-8);
  assert.ok(game.shots[0].x > game.shots[1].x);
  assert.ok(projectilePosition(game.shots[0]).y < projectilePosition(game.shots[1]).y);
  assert.ok(game.shots.every(s => s.damage === 18));
  assert.equal(game.plants[0].pendingShotAt, undefined);
  tick(game, .1);
  assert.equal(plantFrame(game.plants[0], game).col, 3);
  assert.equal(game.shots.length, 2);
});
test("첫 발 뒤 저장·정지·복구해도 두 번째 발은 한 번만 발생", () => {
  const game = duel("twin");
  tick(game, .1); tick(game, .1);
  const frozen = snapshot(game);
  assert.ok(validSnapshot(frozen));
  const saved = { ...freshSave(), unlocked: 10, language: "en", current: frozen };
  const restored = readSave({ getItem: () => JSON.stringify(saved) });
  assert.equal(restored.error, null);
  assert.deepEqual(restored.data.current, frozen);
  assert.equal(restored.data.language, "en");
  tick(game, 0); tick(game, NaN);
  assert.deepEqual(snapshot(game), frozen);
  game.effects = [];
  advance(game, .5); advance(restored.data.current, .5);
  assert.deepEqual(game, restored.data.current);
  assert.equal(game.shots.length, 2);
});
for (const removed of ["dig", "dead"]) test(`쌍콩이 ${removed} 뒤 예약 발사는 사라짐`, () => {
  const game = duel("twin");
  tick(game, .1); tick(game, .1);
  if (removed === "dig") removePlant(game, 2, 0);
  else game.plants[0].hp = 0;
  advance(game, .5);
  assert.equal(game.plants.length, 0);
  assert.equal(game.shots.length, 1);
  assert.equal(game.shots[0].muzzle, 0);
});
test("관통은 같은 줄 세 명까지, 겹친 적도 각 한 번씩만 피해", () => {
  const game = createGame(10);
  const targets = [0, 1, 2, 3].map(() => enemy(game, 2, 300));
  const other = enemy(game, 1, 300);
  game.shots.push({ id: game.nextId++, row: 2, x: 270, kind: "thorn", hitIds: [], damage: 26, frost: false });
  tick(game, .1);
  assert.deepEqual(targets.map(e => e.hp), [314, 314, 314, 340]);
  assert.equal(other.hp, 340);
  assert.equal(game.shots.length, 0);
  assert.equal(THORN_HITS, 3);
});
test("관통탄의 이미 맞은 적 목록은 저장 후에도 유지", () => {
  const game = createGame(10);
  const target = enemy(game, 2, 300);
  game.shots.push({ id: game.nextId++, row: 2, x: 270, kind: "thorn", hitIds: [], damage: 26, frost: false });
  tick(game, .01);
  // First reach the leading collision edge, then remain inside the target.
  tick(game, .01);
  assert.equal(target.hp, 314);
  const restored = snapshot(game);
  assert.ok(validSnapshot(restored));
  assert.deepEqual(restored.shots[0].hitIds, [target.id]);
  game.effects = [];
  for (let i = 0; i < 6; i++) { tick(game, .01); tick(restored, .01); }
  assert.equal(target.hp, 314);
  assert.deepEqual(restored, game);
});
test("호박탄은 고정 착지점으로 날아가며 비행 중 피해가 없고 반경 경계를 지킴", () => {
  const game = duel("pumpkin");
  tick(game, .1); tick(game, .1);
  const shot = game.shots[0];
  const landing = shot.targetX;
  const origin = shot.originX;
  assert.equal(game.enemies[0].hp, 340);
  game.enemies[0].x = landing + PUMPKIN_RADIUS + 1;
  const edge = enemy(game, 2, landing - PUMPKIN_RADIUS);
  const adjacent = enemy(game, 1, landing);
  const diagonal = enemy(game, 3, landing - 70);
  const far = enemy(game, 4, landing);
  shot.age = shot.duration - .01;
  shot.x = origin + (landing - origin) * shot.age / shot.duration;
  assert.ok(validSnapshot(snapshot(game)));
  tick(game, .02);
  assert.equal(edge.hp, 285);
  assert.equal(adjacent.hp, 285);
  assert.equal(diagonal.hp, 340);
  assert.equal(far.hp, 340);
  assert.equal(game.enemies[0].hp, 340);
  assert.equal(game.shots.length, 0);
  assert.equal(game.effects.filter(e => e.kind === "splash").length, 1);
  assert.equal(game.effects.find(e => e.kind === "splash").x, landing);
  advance(game, .5);
  assert.equal(edge.hp, 285);
});
test("포물선 비행·착지 피해는 저장 복구 후 동일하고 그리기는 상태를 바꾸지 않음", () => {
  const game = duel("pumpkin");
  advance(game, .5);
  const saved = snapshot(game);
  assert.ok(validSnapshot(saved));
  const shot = saved.shots[0];
  const before = structuredClone(shot);
  const middle = projectilePosition({ ...shot, age: shot.duration / 2 });
  assert.ok(middle.y < shot.row * 100);
  assert.deepEqual(shot, before);
  game.effects = [];
  advance(game, 2); advance(saved, 2);
  assert.deepEqual(saved, game);
});
test("해등나무는 첫 8초와 이후 8초마다 50, 수집은 한 번·자동수집 8초", () => {
  const game = createGame(8);
  plantAt(game, "lantern", 0, 0);
  const plant = game.plants[0];
  const ownSuns = () => game.suns.filter(s => s.value === 50);
  advance(game, 7.9);
  assert.equal(ownSuns().length, 0);
  advance(game, .2);
  assert.equal(ownSuns().length, 1);
  assert.equal(plantFrame(plant, game).state, "produce");
  const token = ownSuns()[0];
  assert.equal(engine.collectSun(game, token.id), true);
  assert.equal(engine.collectSun(game, token.id), false);
  advance(game, 7.8);
  assert.equal(ownSuns().length, 0);
  advance(game, .2);
  const second = ownSuns()[0];
  assert.ok(second);
  assert.ok(validSnapshot(snapshot(game)));
  const collected = game.stats.collected;
  advance(game, 8.1);
  assert.ok(!game.suns.some(s => s.id === second.id));
  assert.ok(game.stats.collected >= collected + 50);
});
test("철잎보루 내구도·준비시간·손상 프레임, 새 공격 없음", () => {
  const game = duel("iron");
  assert.equal(game.plants[0].hp, 1500);
  assert.equal(game.cooldowns.iron, 12);
  game.enemies[0].x = 85;
  advance(game, 1);
  assert.ok(Math.abs(game.plants[0].hp - 1475) < 1e-7);
  assert.equal(game.enemies[0].x, 85);
  assert.equal(game.shots.length, 0);
  assert.equal(plantFrame(game.plants[0], game).state, "guard");
  game.plants[0].hp = 525;
  assert.equal(plantFrame(game.plants[0], game).state, "cracked");
});
test("v9 이전의 다섯 쿨다운 저장은 별·언어·현재 판을 보존하며 새 키만 추가", () => {
  for (const stage of [1, 5, 6, 7, 8, 9, 10]) {
    const old = createGame(stage); old.rulesVersion = 2;
    for (const type of ["twin", "thorn", "pumpkin", "lantern", "iron"]) delete old.cooldowns[type];
    plantAt(old, "pea", 0, 0);
    const save = { ...freshSave(), unlocked: 10, stars: Array(10).fill(3), language: "en", current: snapshot(old) };
    const result = readSave({ getItem: () => JSON.stringify(save) });
    assert.equal(result.error, null);
    assert.deepEqual(result.data.stars, save.stars);
    assert.equal(result.data.language, "en");
    assert.equal(result.data.current.sun, old.sun);
    assert.deepEqual(result.data.current.plants, old.plants);
    assert.equal(result.data.current.cooldowns.pea, old.cooldowns.pea);
    for (const type of ["twin", "thorn", "pumpkin", "lantern", "iron"]) assert.equal(result.data.current.cooldowns[type], 0);
    assert.ok(validSnapshot(result.data.current));
  }
});
test("새 예약·관통·포물선·햇빛의 잘못된 저장은 실행 전에 거부", () => {
  for (const [type, corrupt] of [
    ["twin", g => { g.plants[0].pendingShotAt += 1; }],
    ["twin", g => { g.shots[0].muzzle = 2; }],
    ["thorn", g => { g.shots[0].hitIds = [1, 1]; }],
    ["thorn", g => { g.shots[0].hitIds = [1, 2, 3]; }],
    ["pumpkin", g => { g.shots[0].duration = 0; }],
    ["pumpkin", g => { g.shots[0].targetX = NaN; }],
    ["pumpkin", g => { g.shots[0].x += 50; }],
  ]) {
    const game = duel(type); tick(game, .1); tick(game, .1);
    assert.ok(validSnapshot(snapshot(game)));
    corrupt(game);
    assert.equal(validSnapshot(snapshot(game)), false);
  }
  const game = createGame(10);
  delete game.cooldowns.twin;
  assert.equal(validSnapshot(game), false);
});
test("새 공격의 단일 적 비용 효율과 자원·방어의 대기시간은 기존 역할을 보존", () => {
  const peaDpsPerCost = PLANTS.pea.damage / PLANTS.pea.interval / PLANTS.pea.cost;
  assert.ok(PLANTS.twin.damage * 2 / PLANTS.twin.interval / PLANTS.twin.cost < peaDpsPerCost);
  assert.ok(PLANTS.thorn.damage / PLANTS.thorn.interval < PLANTS.pea.damage / PLANTS.pea.interval);
  assert.ok(PLANTS.pumpkin.damage / PLANTS.pumpkin.interval / PLANTS.pumpkin.cost < peaDpsPerCost);
  assert.ok(PLANTS.lantern.cost > PLANTS.sun.cost * 2);
  assert.ok(PLANTS.iron.recharge > PLANTS.wall.recharge);
});
test("새 식물을 포함한 혼합 전략도 실제 자원·쿨다운으로 10단계 진행", t => {
  const used = new Set();
  for (let stage = 1; stage <= 10; stage++) {
    const result = playStrategy(engine, stage, "expanded");
    const baseline = playStrategy(engine, stage);
    assert.equal(result.game.status, "won", `${stage}단계 ${result.game.status}`);
    assert.ok(result.actions.every(a => engine.isPlantUnlocked(a.type, stage)));
    result.actions.forEach(a => used.add(a.type));
    t.diagnostic(`${stage}단계 기존/확장: ${baseline.game.time.toFixed(1)}/${result.game.time.toFixed(1)}초, 하트 ${baseline.game.lives}/${result.game.lives}, 손실 ${baseline.lostPlants}/${result.lostPlants}`);
  }
  for (const type of ["twin", "thorn", "pumpkin", "lantern", "iron"]) assert.ok(used.has(type), `${type} 실제 전략 사용`);
});
