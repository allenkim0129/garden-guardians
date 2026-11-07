import test from "node:test";
import assert from "node:assert/strict";
import { createGame, plantAt, tick, snapshot, validSnapshot, advanceEffects, PLANTS, ENEMIES, STAGES, boardWidth } from "../src/engine.js";
import { plantFrame, enemyFrame, fallFrame, burstFrame, FALL_DURATION, BURST_DURATION } from "../src/sprites.js";
import { projectilePosition } from "../src/art.js";

function addEnemy(game, row, x, hp = ENEMIES.sleepy.hp) {
  const enemy = { id: game.nextId++, type: "sleepy", row, x, hp, slow: 0, age: 0, eating: false };
  game.enemies.push(enemy);
  return enemy;
}

for (const type of ["pea", "frost", "ember"]) test(`${type} 발사 준비 두 프레임 뒤 실제 투사체 생성 시점에 세 번째 프레임`, () => {
  const game = createGame(type === "ember" ? 10 : 4);
  plantAt(game, type, 2, 1);
  addEnemy(game, 2, 750);
  const plant = game.plants[0];
  assert.deepEqual(plantFrame(plant, game), { state: "fire", row: 1, col: 0 });
  tick(game, .1);
  assert.equal(plantFrame(plant, game).col, 1);
  assert.equal(game.shots.length, 0);
  tick(game, .1);
  assert.equal(game.shots.length, 1);
  assert.equal(game.shots[0].damage, PLANTS[type].damage);
  assert.equal(plant.shotAt, game.time);
  assert.deepEqual(plantFrame(plant, game), { state: "fire", row: 1, col: 2 });
  assert.equal(plant.timer, PLANTS[type].interval);
  tick(game, .1); tick(game, .05);
  assert.equal(plantFrame(plant, game).col, 3);
  tick(game, .1);
  assert.equal(plantFrame(plant, game).state, "idle");
});
test("타깃이 갑자기 나타나도 애니메이션 때문에 발사를 늦추지 않음", () => {
  const game = createGame(1);
  plantAt(game, "pea", 0, 0);
  tick(game, .1); tick(game, .1);
  assert.equal(game.plants[0].timer, 0);
  assert.equal(plantFrame(game.plants[0], game).state, "idle");
  addEnemy(game, 0, 650);
  tick(game, .1);
  assert.equal(game.shots.length, 1);
  assert.equal(plantFrame(game.plants[0], game).col, 2);
});
for (const type of ["pea", "sun", "frost", "wall"]) test(`${type} 피격 프레임은 연속 물기에도 매 틱 처음으로 되감기지 않음`, () => {
  const game = createGame(5);
  plantAt(game, type, 0, 1);
  const plant = game.plants[0];
  plant.timer = 1.6;
  const enemy = addEnemy(game, 0, 185);
  const frames = new Set();
  for (let i = 0; i < 13; i++) {
    tick(game, 1 / 30);
    frames.add(plantFrame(plant, game).col);
    assert.equal(plantFrame(plant, game).state, type === "wall" ? "guard" : "hurt");
  }
  assert.equal(frames.size, 4);
  assert.equal(enemy.eating, true);
  assert.equal(enemy.x, 185);
  assert.ok(Math.abs(plant.hp - (PLANTS[type].hp - 22 * 13 / 30)) < 1e-8);
});
test("걷기·공격은 네 프레임을 사용하고 상태 전환 때 처음부터 재생", () => {
  const game = createGame(3);
  plantAt(game, "wall", 1, 4);
  const enemy = addEnemy(game, 1, 500);
  assert.deepEqual([0, .17, .34, .51].map(time => enemyFrame({ ...enemy, age: time }, time).col), [0, 1, 2, 3]);
  const start = enemy.x;
  tick(game, .1);
  assert.ok(Math.abs(enemy.x - (start - 17 * .1 * boardWidth(game) / 900)) < 1e-8);
  enemy.x = 490;
  tick(game, .1);
  assert.deepEqual(enemyFrame(enemy, game.time), { state: "attack", row: 1, col: 0 });
  for (let i = 0; i < 5; i++) tick(game, .1);
  assert.equal(enemyFrame(enemy, game.time).col, 2);
  assert.equal(enemy.x, 490);
  game.plants = [];
  tick(game, .1);
  assert.deepEqual(enemyFrame(enemy, game.time), { state: "walk", row: 0, col: 0 });
});
for (const type of Object.keys(ENEMIES)) test(`${type} 사망은 즉시 전투에서 제거하고 승리와 독립적으로 쓰러짐 재생`, () => {
  const game = createGame(1);
  game.nextSpawn = STAGES[0].count;
  plantAt(game, "pea", 0, 1);
  const plant = game.plants[0];
  plant.timer = 1.6;
  addEnemy(game, 0, 185, 0).type = type;
  tick(game, .1);
  assert.equal(game.status, "won");
  assert.equal(game.enemies.length, 0);
  assert.equal(game.stats.defeated, 1);
  assert.equal(plant.hp, 120);
  assert.equal(game.effects.filter(e => e.kind === "fall").length, 1);
  assert.equal(game.effects.find(e => e.kind === "fall").type, type);
  assert.deepEqual([0, .17, .34, .51, .8].map(age => fallFrame(age).col), [0, 1, 2, 3, 3]);
  const time = game.time;
  for (let i = 0; i < 10; i++) advanceEffects(game, .1);
  assert.equal(game.time, time);
  assert.equal(game.status, "won");
  assert.equal(game.stats.defeated, 1);
  assert.equal(game.effects.length, 0);
  assert.ok(FALL_DURATION < 1);
});
test("발사·피격·공격 중 저장 복구는 같은 프레임과 전투 상태를 유지", () => {
  const game = createGame(1);
  plantAt(game, "pea", 0, 0);
  addEnemy(game, 0, 85);
  for (let i = 0; i < 8; i++) tick(game, 1 / 30);
  const restored = snapshot(game);
  assert.equal(validSnapshot(restored), true);
  assert.deepEqual(plantFrame(restored.plants[0], restored), plantFrame(game.plants[0], game));
  assert.deepEqual(enemyFrame(restored.enemies[0], restored.time), enemyFrame(game.enemies[0], game.time));
  game.effects = [];
  for (let i = 0; i < 12; i++) { tick(game, 1 / 30); tick(restored, 1 / 30); }
  assert.deepEqual(restored, game);
  const bad = snapshot(game); bad.plants[0].shotAt = game.time + 10;
  assert.equal(validSnapshot(bad), false);
  delete bad.plants[0].shotAt; delete bad.plants[0].hurtAt;
  delete bad.enemies[0].motionAt;
  assert.equal(validSnapshot(bad), true);
});

test("햇살봉 생성 프레임은 실제 햇빛 생성과 일치하고 타임스탬프 저장 복원", () => {
  const game = createGame(1);
  plantAt(game, "sun", 0, 0);
  const sun = game.plants[0];
  assert.equal(sun.timer, 5);
  sun.timer = .2;
  assert.deepEqual(plantFrame(sun, game), { state: "produce", row: 1, col: 0 });
  tick(game, .1);
  assert.equal(plantFrame(sun, game).col, 1);
  assert.equal(game.suns.length, 0);
  tick(game, .1);
  assert.equal(game.suns.length, 1);
  assert.equal(game.suns[0].value, 25);
  assert.equal(sun.timer, 8);
  assert.equal(sun.producedAt, game.time);
  assert.deepEqual(plantFrame(sun, game), { state: "produce", row: 1, col: 2 });
  tick(game, .1); tick(game, .05);
  assert.equal(plantFrame(sun, game).col, 3);
  const saved = snapshot(game);
  assert.ok(validSnapshot(saved));
  assert.deepEqual(plantFrame(saved.plants[0], saved), plantFrame(sun, game));
  game.effects = [];
  tick(game, .1); tick(saved, .1);
  assert.deepEqual(saved, game);
  saved.plants[0].producedAt = saved.time + 1;
  assert.equal(validSnapshot(saved), false);
  delete saved.plants[0].producedAt;
  assert.ok(validSnapshot(saved));
});

test("도토리벽은 실제 체력 35% 이하에서 균열을 유지하며 공격을 추가하지 않음", () => {
  const game = createGame(3);
  plantAt(game, "wall", 0, 0);
  const wall = game.plants[0];
  wall.hp = PLANTS.wall.hp * .35 + 1;
  assert.equal(plantFrame(wall, game).state, "idle");
  wall.hp = PLANTS.wall.hp * .35;
  wall.hurtAt = 0;
  assert.deepEqual([0, .25, .5, .75].map(age => plantFrame({ ...wall, age }, game).col), [0, 1, 2, 3]);
  assert.equal(plantFrame(wall, game).state, "cracked");
  addEnemy(game, 0, 85);
  tick(game, .1);
  assert.ok(Math.abs(wall.hp - (PLANTS.wall.hp * .35 - 2.2)) < 1e-8);
  assert.equal(game.shots.length, 0);
});

test("방울폭탄 대기·준비·폭발 네 프레임과 1초/300피해를 분리", () => {
  const game = createGame(5);
  plantAt(game, "bomb", 2, 5);
  const bomb = game.plants[0];
  const target = addEnemy(game, 2, 590, 340); target.type = "jelly";
  const far = addEnemy(game, 4, 800);
  const frames = { idle: new Set(), prime: new Set() };
  while (game.plants.length && game.time < 1.1) {
    const frame = plantFrame(bomb, game);
    frames[frame.state].add(frame.col);
    if (game.time < 1) assert.equal(target.hp, 340);
    tick(game, 1 / 30);
  }
  assert.deepEqual([...frames.idle], [0, 1, 2, 3]);
  assert.deepEqual([...frames.prime], [0, 1, 2, 3]);
  assert.equal(game.plants.length, 0);
  assert.equal(target.hp, 40);
  assert.equal(far.hp, ENEMIES.sleepy.hp);
  assert.equal(game.stats.defeated, 0);
  assert.equal(game.effects.filter(e => e.kind === "burst").length, 1);
  assert.deepEqual([0, .17, .34, .51].map(age => burstFrame(age).col), [0, 1, 2, 3]);
  assert.equal(BURST_DURATION, .75);
  const state = snapshot(game);
  for (let i = 0; i < 12; i++) advanceEffects(game, .1);
  assert.deepEqual(snapshot(game), state);
  assert.equal(game.effects.length, 0);
});

test("완두콩·얼음 결정의 시각 원점만 보정하고 속도·충돌·저장 형태 유지", () => {
  for (const type of ["pea", "frost"]) {
    const game = createGame(4);
    plantAt(game, type, 0, 1);
    const target = addEnemy(game, 0, 750);
    tick(game, .1); tick(game, .1);
    const shot = game.shots[0];
    const distance = 330 * boardWidth(game) / 900 * .1;
    assert.equal(shot.x, 150 + 28 + distance);
    const savedShot = structuredClone(shot);
    assert.deepEqual(projectilePosition(shot), { x: shot.x + (shot.frost ? 7 : 0), y: shot.frost ? 26 : 42 });
    assert.deepEqual(shot, savedShot);
    assert.ok(validSnapshot(snapshot(game)));
    tick(game, .1);
    assert.ok(Math.abs(shot.x - savedShot.x - distance) < 1e-8);
    target.x = shot.x + 35;
    tick(game, .1);
    assert.equal(game.shots.length, 0);
    assert.equal(target.hp, ENEMIES.sleepy.hp - PLANTS[type].damage);
    assert.equal(target.slow > 0, type === "frost");
  }
});
