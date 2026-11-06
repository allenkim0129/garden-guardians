import test from "node:test";
import assert from "node:assert/strict";
import { createGame, PLANTS, ENEMIES, STAGES, plantAt, removePlant, collectSun, tick, scheduleFor, snapshot, validSnapshot } from "../src/engine.js";
import { freshSave, updateProgress } from "../src/storage.js";
import * as engine from "../src/engine.js";
import { playStrategy } from "./helpers/strategy.mjs";

function advance(game, seconds) {
  for (let i = 0; i < Math.round(seconds * 30); i++) tick(game, 1 / 30);
}
function enemy(game, type, row, x) {
  const e = { id: game.nextId++, type, row, x, hp: ENEMIES[type].hp, slow: 0, age: 0, eating: false };
  game.enemies.push(e);
  return e;
}

test("식물 10종, 좀비 4종, 증가하는 10개의 유효한 스테이지", () => {
  assert.equal(Object.keys(PLANTS).length, 10);
  assert.equal(Object.keys(ENEMIES).length, 4);
  assert.equal(STAGES.length, 10);
  for (const stage of STAGES) {
    const plan = scheduleFor(stage.id);
    assert.equal(plan.length, stage.count);
    assert.equal(new Set(plan.map(p => p.wave)).size, 3);
    assert.ok(plan.every((p, i) => p.row >= 0 && p.row < 5 && ENEMIES[p.type] && (i === 0 || p.at > plan[i - 1].at)));
  }
});
test("비용, 빈 칸, 대기 시간, 경계와 잘못된 입력을 검사", () => {
  const game = createGame(2);
  assert.equal(plantAt(game, "sun", 2, 0).ok, true);
  assert.equal(game.sun, 200);
  assert.equal(plantAt(game, "pea", 2, 0).ok, false);
  assert.equal(plantAt(game, "sun", 1, 0).ok, false);
  for (const [type, row, col] of [["unknown", 0, 0], ["pea", -1, 0], ["pea", 0, 9], ["pea", .5, 0], ["__proto__", 0, 0]]) {
    assert.equal(plantAt(game, type, row, col).ok, false);
  }
  game.sun = 20;
  assert.equal(plantAt(game, "pea", 0, 0).ok, false);
  advance(game, 5.1); game.sun = 50;
  assert.equal(plantAt(game, "sun", 1, 0).ok, true);
});
test("삽은 비용 절반을 돌려주고 빈 땅에는 쓸 수 없음", () => {
  const game = createGame(4);
  plantAt(game, "frost", 0, 0);
  assert.equal(removePlant(game, 0, 0).refund, 62);
  assert.equal(game.sun, 212);
  assert.equal(removePlant(game, 0, 0).ok, false);
});
test("햇빛은 탭으로 한 번만 수집되고 놓친 햇빛은 자동 수집됨", () => {
  const game = createGame(2);
  plantAt(game, "sun", 0, 0);
  advance(game, 6.1);
  assert.equal(game.suns.length, 2);
  const sunId = game.suns[0].id;
  assert.equal(collectSun(game, sunId), true);
  assert.equal(collectSun(game, sunId), false);
  const initial = game.sun;
  advance(game, 8.1);
  assert.ok(game.sun > initial);
  assert.ok(game.stats.collected >= 50);
});
test("공격은 같은 줄 앞쪽만 맞히고 좀비 제거를 한 번만 계산", () => {
  const game = createGame(1);
  plantAt(game, "pea", 2, 1);
  const target = enemy(game, "sleepy", 2, 460);
  const other = enemy(game, "jelly", 3, 460);
  advance(game, 11);
  assert.ok(!game.enemies.includes(target));
  assert.equal(other.hp, ENEMIES.jelly.hp);
  assert.equal(game.stats.defeated, 1);
});
test("서리 효과와 우산의 추위 저항", () => {
  const game = createGame(1);
  const normal = enemy(game, "sleepy", 0, 700);
  const umbrella = enemy(game, "umbrella", 1, 700);
  normal.slow = umbrella.slow = 3;
  advance(game, 1);
  assert.ok(Math.abs((700 - normal.x) - 17 * .48) < .01);
  assert.ok(Math.abs((700 - umbrella.x) - 18 * .8) < .01);
  const frostGame = createGame(4);
  plantAt(frostGame, "frost", 0, 1);
  const target = enemy(frostGame, "jelly", 0, 450);
  advance(frostGame, 1.5);
  assert.ok(target.slow > 0);
  assert.ok(target.hp < ENEMIES.jelly.hp);
});
test("우산은 누적 65 피해에서 한 번만 탈락하고 보통 속도·추위 저항으로 전환", () => {
  const game = createGame(5);
  const target = enemy(game, "umbrella", 2, 500);
  const hit = damage => {
    game.shots.push({ id: game.nextId++, row: 2, x: target.x - 30, damage, frost: false });
    tick(game, .1);
  };
  hit(64);
  assert.equal(target.hp, 111);
  assert.equal(target.equipmentDropped, undefined);
  hit(1);
  assert.equal(target.hp, 110);
  assert.equal(target.equipmentDropped, true);
  assert.equal(target.type, "umbrella");
  assert.equal(game.effects.filter(e => e.kind === "gear").length, 1);
  const x = target.x;
  tick(game, .1);
  assert.ok(Math.abs(x - target.x - ENEMIES.sleepy.speed * .1) < 1e-8);
  target.slow = 3;
  const slowedX = target.x;
  hit(1);
  assert.ok(Math.abs(slowedX - target.x - ENEMIES.sleepy.speed * .48 * .1) < 1e-8);
  assert.equal(game.effects.filter(e => e.kind === "gear").length, 1);
  const restored = snapshot(game);
  assert.ok(validSnapshot(restored));
  assert.equal(restored.enemies[0].equipmentDropped, true);
  assert.deepEqual(restored.effects, []);
  game.effects = [];
  advance(game, .5); advance(restored, .5);
  assert.deepEqual(restored, game);
});
test("모든 좀비의 탈락 효과는 범위·관통·폭탄 피해에도 한 번, 즉사에도 남음", () => {
  for (const kind of ["pea", "thorn", "pumpkin", "bomb"]) {
    const game = createGame(10);
    for (const type of Object.keys(ENEMIES)) enemy(game, type, 2, 500);
    if (kind === "bomb") {
      plantAt(game, "bomb", 2, 4);
      game.plants[0].age = 1;
    } else {
      for (let i = 0; i < 4; i++) game.shots.push({
        id: game.nextId++, row: 2, x: 470, damage: 340, frost: false,
        ...(kind === "thorn" ? { kind, hitIds: [] } : {}),
        ...(kind === "pumpkin" ? { kind, originX: 470, targetX: 500, duration: .45, age: .44 } : {}),
      });
    }
    tick(game, .1);
    assert.equal(game.stats.defeated, 4, kind);
    assert.equal(game.effects.filter(e => e.kind === "gear").length, 4, kind);
    assert.ok(game.effects.filter(e => e.kind === "fall").every(e => e.equipmentDropped));
    const effects = structuredClone(game.effects);
    tick(game, 0);
    assert.deepEqual(game.effects, effects);
    for (let i = 0; i < 12; i++) engine.advanceEffects(game, .1);
    assert.equal(game.effects.filter(e => e.kind === "gear").length, 0);
  }
});
test("장비 상태 없는 이전 저장 허용, 잘못된 장비 상태·미래 피격 시간 거부", () => {
  const game = createGame(5);
  const target = enemy(game, "umbrella", 2, 500);
  assert.ok(validSnapshot(game));
  target.equipmentDropped = "yes";
  assert.equal(validSnapshot(game), false);
  target.equipmentDropped = true;
  assert.equal(validSnapshot(game), false);
  target.hp = 100;
  assert.ok(validSnapshot(game));
  target.hurtAt = 1;
  assert.equal(validSnapshot(game), false);
});
test("방울폭탄은 1초 뒤 가까운 줄에도 피해를 주고 사라짐", () => {
  const game = createGame(5);
  plantAt(game, "bomb", 2, 5);
  enemy(game, "jelly", 2, 600);
  enemy(game, "sleepy", 1, 600);
  const far = enemy(game, "sleepy", 4, 800);
  advance(game, .9);
  assert.equal(game.plants.length, 1);
  advance(game, .2);
  assert.equal(game.plants.length, 0);
  assert.equal(game.stats.defeated, 2);
  assert.equal(far.hp, ENEMIES.sleepy.hp);
});
test("도토리벽은 이동을 막으며 먹힌 뒤에는 좀비가 다시 이동", () => {
  const game = createGame(3);
  plantAt(game, "wall", 1, 4);
  const target = enemy(game, "jelly", 1, 490);
  advance(game, 2);
  assert.equal(target.x, 490);
  assert.ok(game.plants[0].hp < 650);
  game.plants[0].hp = .1;
  advance(game, .2);
  assert.ok(target.x < 490);
});
test("하트가 0이면 패배, 모든 무리를 막으면 승리; 종료 후 상태 불변", () => {
  const game = createGame(1);
  game.nextSpawn = STAGES[0].count;
  game.lives = 1;
  enemy(game, "roller", 1, -24.9);
  tick(game, .1);
  assert.equal(game.status, "lost");
  assert.equal(game.lives, 0);
  const end = structuredClone(game);
  tick(game, .1);
  assert.deepEqual(game, end);
  const win = createGame(1); win.nextSpawn = STAGES[0].count; tick(win, .1);
  assert.equal(win.status, "won");
});
test("v11은 준비 18초·적은 첫 무리·점진 가속·증가한 마지막 무리를 제공", () => {
  for (const stage of STAGES) {
    const plan = scheduleFor(stage.id);
    const old = scheduleFor(stage.id, 1);
    const waves = [1, 2, 3].map(wave => plan.filter(p => p.wave === wave));
    assert.equal(plan[0].at, 18);
    assert.ok(waves[0].length < old.filter(p => p.wave === 1).length);
    assert.ok(waves[2].length > old.filter(p => p.wave === 3).length);
    assert.ok(waves[2].length >= plan.length / 2);
    const gaps = waves.map(wave => wave[1].at - wave[0].at);
    assert.ok(gaps[0] > gaps[1] && gaps[1] > gaps[2]);
    assert.equal(plan.length, Math.ceil(old.length * 1.4));
  }
});
test("v10 진행 중 판은 저장·재접속 후에도 기존 등장 시점·남은 수를 유지", () => {
  for (const stage of STAGES) {
    const game = createGame(stage.id);
    delete game.pacingVersion;
    game.time = 60;
    const plan = scheduleFor(stage.id, 1);
    game.nextSpawn = plan.filter(p => p.at <= game.time).length;
    game.wave = plan[game.nextSpawn - 1].wave;
    const restored = snapshot(game);
    assert.ok(validSnapshot(restored));
    tick(game, .1); tick(restored, .1);
    assert.deepEqual(restored, game);
    game.time = plan.at(-1).at;
    tick(game, .1);
    assert.equal(game.nextSpawn, stage.legacyCount);
    game.enemies = [];
    tick(game, .1);
    assert.equal(game.status, "won");
  }
});
test("저장 복구는 타이머·공격·햇빛·무리를 동일하게 이어 감", () => {
  const game = createGame(5);
  plantAt(game, "sun", 0, 0); plantAt(game, "pea", 2, 2);
  advance(game, 20);
  const restored = snapshot(game);
  assert.ok(validSnapshot(restored));
  game.effects = [];
  advance(game, 5); advance(restored, 5);
  assert.deepEqual(restored, game);
});
test("비정상 시간 간격은 무시하거나 제한하여 배경 복귀 순간 이동 방지", () => {
  const game = createGame(1);
  tick(game, NaN); tick(game, -1); tick(game, Infinity);
  assert.equal(game.time, 0);
  tick(game, 500);
  assert.equal(game.time, .1);
});

test("자원·대기 시간 보정 없이 해금된 식물의 혼합 전략으로 1~10단계 연속 승리", t => {
  const progress = freshSave();
  for (let stage = 1; stage <= 10; stage++) {
    assert.ok(progress.unlocked >= stage);
    const { game, actions, lostPlants } = playStrategy(engine, stage);
    assert.ok(actions.every(a => engine.isPlantUnlocked(a.type, stage)));
    assert.equal(game.status, "won", `${stage}단계: ${game.status}, ${game.time.toFixed(1)}초, 하트 ${game.lives}`);
    assert.ok(game.lives >= 2, `${stage}단계가 지나치게 어려움`);
    updateProgress(progress, game);
    t.diagnostic(`${stage}단계: ${game.time.toFixed(1)}초, 하트 ${game.lives}, 식물 손실 ${lostPlants}, 좀비 ${game.stats.defeated}명`);
  }
  assert.equal(progress.unlocked, 10);
  assert.ok(progress.stars.every(stars => stars >= 2));
  assert.equal(progress.current, null);
});

test("콩별이·햇살봉은 기본 해금하고 2~9 정원에 한 종씩 추가, 재도전도 동일", () => {
  const unlocks = { sun: 1, pea: 1, wall: 2, frost: 3, bomb: 4, twin: 5, thorn: 6, pumpkin: 7, lantern: 8, iron: 9 };
  const introductions = [["sun", "pea"], ["wall"], ["frost"], ["bomb"], ["twin"], ["thorn"], ["pumpkin"], ["lantern"], ["iron"]];
  for (let stage = 1; stage <= 10; stage++) {
    assert.deepEqual(engine.introducedPlants(stage), introductions[stage - 1] ?? []);
    for (const [type, unlockStage] of Object.entries(unlocks)) {
      const game = createGame(stage);
      assert.equal(PLANTS[type].unlockStage, unlockStage);
      assert.equal(engine.isPlantUnlocked(type, stage), unlockStage <= stage);
      assert.equal(plantAt(game, type, 0, 0).ok, unlockStage <= stage);
      if (unlockStage > stage) assert.equal(game.sun, STAGES[stage - 1].startSun);
    }
  }
  const game = createGame(1);
  assert.equal(plantAt(game, "sun", 0, 0).ok, true);
  assert.equal(plantAt(game, "pea", 2, 1).ok, true);
  assert.equal(game.sun, 75);
  advance(game, 6.1);
  assert.ok(game.suns.some(sun => sun.x === 72 && sun.y === 50));
});
test("콩별이 발사 성능·비용·쿨다운을 낮추고 후반 단일 공격 전략의 우세를 줄임", t => {
  assert.equal(PLANTS.pea.cost, 125);
  assert.equal(PLANTS.pea.recharge, 6);
  assert.equal(PLANTS.pea.damage / PLANTS.pea.interval, 11.25);
  assert.ok(PLANTS.pea.damage / PLANTS.pea.interval < (22 / 1.25) * .65);
  let soloHearts = 0, mixedHearts = 0;
  for (const stage of [8, 9, 10]) {
    const solo = playStrategy(engine, stage, "pea");
    const mixed = playStrategy(engine, stage, "mixed");
    soloHearts += solo.game.lives; mixedHearts += mixed.game.lives;
    assert.equal(mixed.game.status, "won");
    t.diagnostic(`${stage}단계: 콩별이 중심 ${solo.game.status}/하트${solo.game.lives}, 혼합 ${mixed.game.status}/하트${mixed.game.lives}`);
  }
  assert.ok(mixedHearts >= soloHearts + 3);
  assert.equal(playStrategy(engine, 10, "pea").game.status, "lost");
});
