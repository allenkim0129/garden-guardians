import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createGame, PLANTS, ENEMIES, STAGES, plantAt, removePlant, collectSun, tick, scheduleFor, snapshot, validSnapshot } from "../src/engine.js";
import { freshSave, readSave, updateProgress } from "../src/storage.js";
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

test("식물 13종, 좀비 6종, 증가하는 30개의 유효한 스테이지", () => {
  assert.equal(Object.keys(PLANTS).length, 13);
  assert.equal(Object.keys(ENEMIES).length, 6);
  assert.equal(STAGES.length, 30);
  for (const stage of STAGES) {
    const plan = scheduleFor(stage.id);
    assert.equal(plan.length, stage.count);
    assert.equal(new Set(plan.map(p => p.wave)).size, 3);
    assert.ok(plan.every((p, i) => p.row >= 0 && p.row < 5 && ENEMIES[p.type] && (i === 0 || p.at > plan[i - 1].at)));
  }
});
test("달빛 온실은 10개 단계·5줄·초반 3명·더 빠른 중후반과 더 큰 무리", () => {
  const baseline = scheduleFor(10);
  const health = plan => plan.reduce((sum, spawn) => sum + ENEMIES[spawn.type].hp, 0);
  assert.ok(STAGES.slice(0, 10).every(stage => stage.theme === "garden"));
  for (const stage of STAGES.slice(10, 20)) {
    const plan = scheduleFor(stage.id);
    assert.equal(stage.theme, "moon");
    assert.equal(plan.length, 70 + (stage.id - 11) * 6);
    assert.deepEqual(plan.slice(0, 3).map(s => [s.at, s.type]), [[10, "sleepy"], [24, "sleepy"], [36, "roller"]]);
    assert.equal(new Set(plan.map(s => s.row)).size, 5);
    assert.ok(health(plan) > health(baseline) * 1.1, `${stage.id}단계의 무리 체력 합계`);
    const regular = plan.slice(3);
    assert.deepEqual(regular.map(s => s.type), regular.map((_, i) => stage.types[(i + 3) % stage.types.length]));
    const middle = plan.filter(s => s.wave === 2), final = plan.filter(s => s.wave === 3);
    assert.ok(middle[0].at < 55);
    assert.ok(middle[1].at - middle[0].at < 3);
    assert.ok(final[1].at - final[0].at < .75);
    assert.ok(final.length > plan.length * .6);
    assert.equal(stage.startSun, STAGES[9].startSun);
    assert.equal(engine.loadoutLimit(stage.id), 8);
    assert.deepEqual(engine.introducedPlants(stage.id), stage.id === 19 ? ["storm"] : []);
  }
});

test("달빛 온실 모든 단계의 실제 전투 저장·타이머·웨이브 바를 동일하게 복구", () => {
  for (let stage = 11; stage <= 20; stage++) {
    const game = createGame(stage, ["sun", "pea", "frost", "bomb", "twin", "pumpkin", "lantern", "iron"]);
    plantAt(game, "sun", 0, 0); plantAt(game, "pea", 2, 1);
    advance(game, 45);
    assert.ok(validSnapshot(snapshot(game)), `${stage}`);
    const restored = snapshot(game);
    game.effects = [];
    assert.deepEqual(engine.waveProgress(restored), engine.waveProgress(game));
    advance(game, 2); advance(restored, 2);
    assert.deepEqual(restored, game);
    assert.ok(engine.waveProgress(game).markers[0].percent < engine.waveProgress(game).markers[1].percent);
  }
});

test("실제 8종 조합으로 11~20단계 연속 통과하며 후반은 단일 공격 전략보다 어려움", t => {
  const progress = freshSave(); progress.unlocked = 11; progress.stars.fill(3, 0, 10);
  const peaks = [];
  for (let stage = 10; stage <= 20; stage++) {
    const team = ["sun", "pea", "frost", "bomb", "twin", [15, 18, 19, 20].includes(stage) ? "thorn" : "pumpkin", "lantern", "wall"];
    let peak = 0;
    const api = { ...engine, createGame: n => createGame(n, team), tick: (game, dt) => {
      tick(game, dt);
      peak = Math.max(peak, game.enemies.reduce((sum, e) => sum + e.hp, 0));
    } };
    const result = playStrategy(api, stage, "expanded", stage === 20 ? "twin" : "pea");
    assert.equal(result.game.status, "won", `${stage}단계`);
    assert.ok(result.actions.every(action => team.includes(action.type)));
    assert.ok(result.game.time < 240);
    updateProgress(progress, result.game);
    assert.ok(progress.unlocked >= Math.min(20, stage + 1));
    peaks.push(peak);
    t.diagnostic(`${stage}단계: ${result.game.time.toFixed(1)}초, 하트 ${result.game.lives}, 최대 생존 적 체력 ${Math.round(peak)}`);
  }
  assert.equal(progress.unlocked, 21);
  assert.ok(progress.stars.slice(0, 20).every(stars => stars > 0));
  assert.ok(progress.stars.slice(20).every(stars => stars === 0));
  assert.ok(peaks.at(-1) > peaks[0] * 3);
  assert.equal(playStrategy(engine, 19, "pea").game.status, "lost");
  assert.equal(playStrategy(engine, 20, "pea").game.status, "lost");
});

test("비용, 빈 칸, 대기 시간, 경계와 잘못된 입력을 검사", () => {
  const game = createGame(2);
  assert.equal(plantAt(game, "sun", 2, 0).ok, true);
  assert.equal(game.sun, 200);
  assert.equal(plantAt(game, "pea", 2, 0).ok, false);
  assert.equal(plantAt(game, "sun", 1, 0).ok, false);
  for (const [type, row, col] of [["unknown", 0, 0], ["pea", -1, 0], ["pea", 0, engine.COLS], ["pea", .5, 0], ["__proto__", 0, 0]]) {
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
  assert.equal(target.hp, 26);
  advance(game, 5);
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
  assert.ok(Math.abs((700 - normal.x) - 17 * .48 * engine.boardWidth(game) / 900) < .01);
  assert.ok(Math.abs((700 - umbrella.x) - 18 * .8 * engine.boardWidth(game) / 900) < .01);
  const frostGame = createGame(4);
  plantAt(frostGame, "frost", 0, 1);
  const target = enemy(frostGame, "jelly", 0, 450);
  advance(frostGame, 1.5);
  assert.ok(target.slow > 0);
  assert.equal(target.hp, ENEMIES.jelly.hp - 6);
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
  assert.ok(Math.abs(x - target.x - ENEMIES.sleepy.speed * .1 * engine.boardWidth(game) / 900) < 1e-8);
  target.slow = 3;
  const slowedX = target.x;
  hit(1);
  assert.ok(Math.abs(slowedX - target.x - ENEMIES.sleepy.speed * .48 * .1 * engine.boardWidth(game) / 900) < 1e-8);
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
    for (const type of Object.keys(ENEMIES)) enemy(game, type, 2, 500).hp = 100;
    if (kind === "bomb") {
      plantAt(game, "bomb", 2, 4);
      game.plants[0].age = 1;
    } else {
      for (let i = 0; i < Object.keys(ENEMIES).length; i++) game.shots.push({
        id: game.nextId++, row: 2, x: 470, damage: 340, frost: false,
        ...(kind === "thorn" ? { kind, hitIds: [] } : {}),
        ...(kind === "pumpkin" ? { kind, originX: 470, targetX: 500, duration: .45, age: .44 } : {}),
      });
    }
    tick(game, .1);
    assert.equal(game.stats.defeated, Object.keys(ENEMIES).length, kind);
    assert.equal(game.effects.filter(e => e.kind === "gear").length, Object.keys(ENEMIES).length, kind);
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
  const tough = enemy(game, "jelly", 2, 600);
  enemy(game, "sleepy", 1, 600);
  const far = enemy(game, "sleepy", 4, 800);
  advance(game, .9);
  assert.equal(game.plants.length, 1);
  advance(game, .2);
  assert.equal(game.plants.length, 0);
  assert.equal(game.stats.defeated, 1);
  assert.equal(tough.hp, 40);
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
  for (const stage of STAGES.slice(0, 10)) {
    const plan = scheduleFor(stage.id, 2);
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
test("v15는 55초 전 1~2명만 천천히, 중반 증가, 최종 무리에 절반 이상 집중", () => {
  for (const stage of STAGES.slice(0, 10)) {
    const plan = scheduleFor(stage.id, 4);
    const waves = [1, 2, 3].map(wave => plan.filter(spawn => spawn.wave === wave));
    assert.equal(plan[0].at, 25);
    assert.equal(waves[0].length, stage.id === 1 ? 1 : 2);
    assert.ok(waves[0].every(spawn => spawn.type === "sleepy"));
    if (waves[0].length === 2) assert.equal(waves[0][1].at - waves[0][0].at, 14);
    assert.equal(plan.filter(spawn => spawn.at < 55).length, waves[0].length);
    assert.equal(waves[1][0].at, 55);
    assert.ok(waves[1].length > waves[0].length);
    assert.ok(waves[2][0].at >= 90);
    assert.ok(waves[2].length > waves[1].length);
    assert.ok(waves[2].length > plan.length / 2);
    assert.ok(waves[1][1].at - waves[1][0].at > waves[2][1].at - waves[2][0].at);
    assert.equal(plan.length, stage.count);
    assert.ok(plan.every((spawn, index) => !index || spawn.at > plan[index - 1].at));
    const game = createGame(stage.id);
    game.pacingVersion = 4;
    game.time = 24.9; tick(game, .1);
    assert.equal(game.nextSpawn, 1);
    assert.equal(game.enemies[0].type, "sleepy");
  }
});
test("진행 바는 저장 버전의 시간표를 따르고 마지막 등장 이후 남은 적과 승리를 구분", () => {
  for (const pacingVersion of [1, 2, 3, 4, 5, 6]) {
    const game = createGame(10); game.pacingVersion = pacingVersion;
    const plan = scheduleFor(10, pacingVersion);
    assert.ok(validSnapshot(game));
    assert.equal(engine.waveProgress(game).percent, 0);
    for (const wave of [2, 3]) {
      game.time = plan.find(spawn => spawn.wave === wave).at;
      const progress = engine.waveProgress(game);
      assert.equal(progress.percent, progress.markers.find(marker => marker.wave === wave).percent);
    }
    game.time = plan.at(-1).at; game.nextSpawn = plan.length;
    enemy(game, "sleepy", 2, 700);
    assert.equal(engine.waveProgress(game).percent, 100);
    assert.equal(engine.waveProgress(game).remaining, 1);
    const restored = snapshot(game);
    assert.deepEqual(engine.waveProgress(restored), engine.waveProgress(game));
    game.enemies = []; tick(game, .1);
    assert.equal(game.status, "won");
    assert.equal(engine.waveProgress(game).remaining, 0);
  }
});
test("v10 진행 중 판은 저장·재접속 후에도 기존 등장 시점·남은 수를 유지", () => {
  for (const stage of STAGES.slice(0, 10)) {
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
test("v26은 30단계 모두 중간 출현 뒤 30초 정비하고 최종 무리의 구성·간격은 보존", () => {
  for (const stage of STAGES) {
    const old = scheduleFor(stage.id, 5), plan = scheduleFor(stage.id);
    const finalIndex = plan.findIndex(spawn => spawn.wave === 3);
    assert.equal(createGame(stage.id).pacingVersion, 6);
    assert.equal(plan.length, old.length);
    assert.deepEqual(plan.slice(0, finalIndex), old.slice(0, finalIndex));
    assert.ok(Math.abs(plan[finalIndex].at - plan[finalIndex - 1].at - 30) < 1e-8);
    const delay = plan[finalIndex].at - old[finalIndex].at;
    assert.ok(delay > 0);
    for (let i = finalIndex; i < plan.length; i++) {
      assert.equal(plan[i].wave, old[i].wave);
      assert.equal(plan[i].row, old[i].row);
      assert.equal(plan[i].type, old[i].type);
      assert.ok(Math.abs(plan[i].at - old[i].at - delay) < 1e-8);
    }
  }
});
test("이전 5종 시간표는 모든 30단계에서 v25와 바이트 단위로 동일", () => {
  const hashes = [
    "502519504f38ef8ef9be8284e9b3d18949c56d36675e70b516623e4989be8305",
    "beb1606ccb6dccb80e2dc554df4f2c9e81c72a0634ef643599e248b5dad08248",
    "854371239061fb06aced3f90a51f12f928dc39574cb6f2ad153ede2a84e58635",
    "70608bfac67348c74405920e7a6a3d1a164a7cf657903844d0952243d6f5fc29",
    "da1eb158c6067a6e89c21b0e9055693734295a7b4c8d95bca439e8b47c672cc4",
  ];
  hashes.forEach((hash, index) => {
    assert.equal(createHash("sha256").update(JSON.stringify(STAGES.map(stage => scheduleFor(stage.id, index + 1)))).digest("hex"), hash);
  });
});
test("정비 중 출현·조기 승리 없이 전투와 생산은 계속되고 정지·복구 뒤 최종 첫 적은 한 번만 등장", () => {
  for (const stage of [1, 10, 19, 22, 30]) {
    const game = createGame(stage, ["sun"]);
    const plan = scheduleFor(stage), finalIndex = plan.findIndex(spawn => spawn.wave === 3);
    plantAt(game, "sun", 0, 0);
    game.time = plan[finalIndex - 1].at - .05;
    game.nextSpawn = finalIndex - 1; game.wave = 2;
    assert.equal(engine.waveProgress(game).regroupRemaining, 0);
    tick(game, .1);
    assert.equal(game.nextSpawn, finalIndex);
    assert.ok(Math.abs(engine.waveProgress(game).regroupRemaining - 29.95) < 1e-8);
    const last = game.enemies[0], x = last.x, sun = game.sun;
    advance(game, 15);
    assert.ok(last.x < x);
    assert.ok(game.sun > sun);
    assert.equal(game.cooldowns.sun, 0);
    assert.equal(game.nextSpawn, finalIndex);
    game.enemies = []; game.effects = [];
    tick(game, .1);
    assert.equal(game.status, "playing");
    const before = snapshot(game);
    tick(game, 0);
    assert.deepEqual(snapshot(game), before);
    const loaded = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: stage, current: before }) });
    assert.equal(loaded.error, null);
    assert.deepEqual(loaded.data.current, before);
    advance(game, 2); advance(loaded.data.current, 2);
    assert.deepEqual(loaded.data.current, game);
    assert.equal(game.nextSpawn, finalIndex);
    game.time = plan[finalIndex].at - .15;
    tick(game, .1);
    assert.equal(game.nextSpawn, finalIndex);
    assert.ok(engine.waveProgress(game).regroupRemaining > 0);
    tick(game, .1);
    assert.equal(game.nextSpawn, finalIndex + 1);
    assert.equal(game.wave, 3);
    assert.equal(engine.waveProgress(game).regroupRemaining, 0);
    assert.ok(validSnapshot(snapshot(game)));
    const old = createGame(stage); old.pacingVersion = 5;
    old.time = plan[finalIndex - 1].at; old.nextSpawn = finalIndex; old.wave = 2;
    assert.equal(engine.waveProgress(old).regroupRemaining, 0);
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
  assert.equal(progress.unlocked, 11);
  assert.ok(progress.stars.slice(0, 10).every(stars => stars >= 2));
  assert.ok(progress.stars.slice(10).every(stars => stars === 0));
  assert.equal(progress.current, null);
});

test("콩별이·햇살봉은 기본 해금하고 2~10 정원에 한 종씩 추가, 재도전도 동일", () => {
  const unlocks = { sun: 1, pea: 1, wall: 2, frost: 3, bomb: 4, twin: 5, thorn: 6, pumpkin: 7, lantern: 8, iron: 9, ember: 10 };
  const introductions = [["sun", "pea"], ["wall"], ["frost"], ["bomb"], ["twin"], ["thorn"], ["pumpkin"], ["lantern"], ["iron"], ["ember"]];
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
test("기존 9칸·새 10칸 후반은 강화된 혼합 조합으로 통과하고 기본·보조만으로는 어려움", t => {
  assert.equal(PLANTS.pea.cost, 125);
  assert.equal(PLANTS.pea.recharge, 5);
  assert.equal(PLANTS.pea.damage / PLANTS.pea.interval, 7.5);
  assert.ok(PLANTS.pea.damage / PLANTS.pea.interval < (22 / 1.25) * .65);
  for (const columns of [9, 10]) for (const stage of [19, 20]) {
    const pacingVersion = columns === 9 ? 5 : 6;
    for (const attacker of ["pea", "frost", "ember"]) {
      const team = ["sun", attacker];
      const solo = playStrategy({ ...engine, createGame: n => ({ ...createGame(n, team), columns, pacingVersion }) }, stage, "pea", attacker);
      assert.equal(solo.game.status, "lost", `${stage}단계 ${attacker} 도배`);
      assert.ok(solo.actions.every(action => team.includes(action.type)));
    }
    const attack = columns === 9 && stage === 20 ? "pumpkin" : "thorn";
    const defender = "wall";
    const team = ["sun", "pea", "frost", "bomb", "twin", attack, "lantern", defender];
    const mixed = playStrategy({ ...engine, createGame: n => ({ ...createGame(n, team), columns, pacingVersion }) }, stage, "expanded", "twin");
    assert.equal(mixed.game.status, "won", `${columns}칸 ${stage}단계 혼합 조합`);
    assert.ok(mixed.actions.every(action => team.includes(action.type)));
    for (const type of ["twin", "bomb", "frost", defender, "lantern"]) assert.ok(mixed.actions.some(action => action.type === type));
    t.diagnostic(`${columns}칸 ${stage}단계: 기본·보조 3종 단독 패배, 혼합 하트 ${mixed.game.lives}`);
  }
});

test("v17은 첫 10초 한 명만 앞당기고 두 번째 39초·55초 중반·최종 무리는 보존", () => {
  for (const stage of STAGES.slice(0, 10)) {
    const plan = scheduleFor(stage.id, 5);
    assert.equal(plan[0].at, 10);
    assert.equal(plan[0].type, "sleepy");
    assert.deepEqual(plan.slice(1), scheduleFor(stage.id, 4).slice(1));
    const game = createGame(stage.id);
    game.time = 9.8;
    tick(game, .1);
    assert.equal(game.nextSpawn, 0);
    tick(game, .1);
    assert.equal(game.nextSpawn, 1);
    game.time = 38.9; tick(game, .1);
    assert.equal(game.nextSpawn, stage.id === 1 ? 1 : 2);
  }
});

function emberHit(game, target) {
  game.shots.push({ id: game.nextId++, kind: "ember", row: target.row, x: target.x - 30, damage: PLANTS.ember.damage, frost: false });
  tick(game, .1);
}
test("불꽃봉오리의 비용·쿨다운·발사 간격·같은 줄 앞쪽 타깃과 10단계 해금", () => {
  assert.equal(plantAt(createGame(9), "ember", 0, 0).ok, false);
  const game = createGame(10, ["sun", "ember"]);
  assert.ok(plantAt(game, "ember", 2, 0).ok);
  assert.equal(game.sun, 150);
  assert.equal(game.cooldowns.ember, 9);
  assert.equal(game.plants[0].hp, 110);
  assert.equal(plantAt(game, "ember", 3, 0).ok, false);
  enemy(game, "jelly", 1, 750);
  enemy(game, "jelly", 2, 20);
  advance(game, .2);
  assert.equal(game.shots.length, 0);
  enemy(game, "jelly", 2, 750);
  tick(game, .1);
  assert.equal(game.shots.length, 1);
  assert.equal(game.shots[0].kind, "ember");
  assert.equal(game.shots[0].damage, 15);
  assert.equal(game.plants[0].timer, 3.2);
  assert.ok(validSnapshot(snapshot(game)));
});
test("불씨는 명중점 반경 105 안의 같은 줄·인접 줄에 한 번만 피해와 화상", () => {
  const game = createGame(10);
  const target = enemy(game, "jelly", 2, 500);
  const inside = [target, enemy(game, "jelly", 2, 605), enemy(game, "jelly", 2, 400), enemy(game, "jelly", 1, 500)];
  const outside = [enemy(game, "jelly", 2, 605.01), enemy(game, "jelly", 3, 533), enemy(game, "jelly", 4, 500)];
  emberHit(game, target);
  for (const e of inside) {
    assert.equal(e.hp, 325);
    assert.equal(e.burn, 3);
  }
  for (const e of outside) {
    assert.equal(e.hp, 340);
    assert.equal(e.burn, undefined);
  }
  assert.equal(game.shots.length, 0);
  assert.equal(game.effects.filter(e => e.kind === "flame").length, 1);
  advance(game, 3.1);
  for (const e of inside) {
    assert.ok(Math.abs(e.hp - 313) < 1e-8);
    assert.equal(e.burn, 0);
  }
  assert.ok(outside.every(e => e.hp === 340));
});
test("화상 재명중은 시간만 갱신하고 중첩·전염되지 않으며 냉기를 취소하지 않음", () => {
  const game = createGame(10);
  const target = enemy(game, "jelly", 2, 500);
  target.slow = 3;
  emberHit(game, target);
  assert.ok(target.slow > 0);
  advance(game, 1);
  const hp = target.hp;
  emberHit(game, target);
  assert.ok(Math.abs(target.hp - hp + 15 + .4) < 1e-8);
  assert.equal(target.burn, 3);
  const nearby = enemy(game, "jelly", 2, target.x + 10);
  const after = target.hp;
  advance(game, 3.1);
  assert.ok(Math.abs(after - target.hp - 12) < 1e-8);
  assert.equal(nearby.hp, 340);
  assert.equal(nearby.burn, undefined);
});
test("화상 사망도 탈락·처치를 한 번만 처리하며 죽은 적의 물기·탈출을 막음", () => {
  for (const x of [185, -24.9]) {
    const game = createGame(10);
    plantAt(game, "wall", 2, 1);
    const target = enemy(game, "sleepy", 2, x);
    target.hp = .3; target.burn = .1;
    game.nextSpawn = STAGES[9].count;
    tick(game, .1);
    assert.equal(game.status, "won");
    assert.equal(game.plants[0].hp, 650);
    assert.equal(game.lives, 3);
    assert.equal(game.stats.defeated, 1);
    assert.equal(game.effects.filter(e => e.kind === "fall").length, 1);
    assert.equal(game.effects.filter(e => e.kind === "gear").length, 1);
    assert.equal(game.effects.filter(e => e.kind === "hit").length, 0);
    tick(game, .1);
    assert.equal(game.stats.defeated, 1);
  }
});
test("불씨·화상·냉기는 저장 복구와 정지 뒤 동일하게 이어지고 잘못된 상태 거부", () => {
  const game = createGame(10, ["ember", "frost"]);
  plantAt(game, "ember", 2, 0);
  const target = enemy(game, "jelly", 2, 700);
  target.burn = 2; target.slow = 2.5;
  advance(game, .3);
  const restored = snapshot(game);
  assert.ok(validSnapshot(restored));
  assert.equal(restored.shots[0].kind, "ember");
  tick(game, 0);
  assert.deepEqual(snapshot(game), restored);
  game.effects = [];
  advance(game, 4); advance(restored, 4);
  assert.deepEqual(restored, game);
  for (const value of [-1, 3.01, "3", null, Infinity]) {
    const bad = snapshot(game); bad.enemies[0].burn = value;
    assert.equal(validSnapshot(bad), false);
  }
  const bad = snapshot(game);
  bad.shots = [{ id: bad.nextId++, row: 2, x: 200, kind: "ember", damage: 24, frost: true }];
  assert.equal(validSnapshot(bad), false);
  bad.shots[0].frost = false; bad.shots[0].damage = 340;
  assert.equal(validSnapshot(bad), false);
  delete bad.cooldowns.ember;
  assert.equal(validSnapshot(bad), false);
});

test("화상 소수 피해의 오차가 체력 0인 좀비와 유효하지 않은 저장을 남기지 않음", () => {
  const game = createGame(10);
  const target = enemy(game, "sleepy", 2, 700);
  target.hp = 12; target.burn = 3;
  for (let i = 0; i < 30; i++) {
    tick(game, .1);
    assert.ok(validSnapshot(snapshot(game)));
  }
  assert.equal(game.enemies.length, 0);
  assert.equal(game.stats.defeated, 1);
});

test("v18 모든 식물의 배치 대기가 1~2초 줄고 실제 재배치 경계도 일치", () => {
  const expected = { sun: 4, pea: 5, wall: 7, frost: 4, bomb: 14, twin: 8, thorn: 8, pumpkin: 9, lantern: 9, iron: 12, ember: 9 };
  assert.deepEqual(Object.keys(expected), Object.keys(PLANTS).filter(type => PLANTS[type].unlockStage <= 10));
  for (const [type, recharge] of Object.entries(expected)) {
    const game = createGame(10);
    game.sun = 10000;
    assert.ok(plantAt(game, type, 0, 0).ok);
    assert.equal(game.cooldowns[type], recharge);
    advance(game, recharge - .1);
    assert.equal(plantAt(game, type, 0, 1).ok, false, type);
    advance(game, .2);
    assert.ok(plantAt(game, type, 0, 1).ok, type);
    assert.ok(validSnapshot(snapshot(game)), type);
  }
});
test("v21 햇살봉은 첫 5초·이후 8초, 하늘 햇빛은 첫 4초·이후 7초", () => {
  const game = createGame(1);
  plantAt(game, "sun", 0, 0);
  const own = () => game.suns.filter(s => s.x === 72 && s.y === 50);
  advance(game, 3.9);
  assert.equal(game.suns.length, 0);
  advance(game, .2);
  assert.equal(game.suns.length, 1);
  assert.equal(own().length, 0);
  advance(game, .8);
  assert.equal(own().length, 0);
  advance(game, .2);
  assert.equal(own().length, 1);
  const first = own()[0];
  assert.equal(collectSun(game, first.id), true);
  advance(game, 5.8);
  assert.equal(game.suns.length, 1);
  advance(game, .2);
  assert.equal(game.suns.length, 2);
  advance(game, 1.8);
  assert.equal(own().length, 0);
  advance(game, .2);
  assert.equal(own().length, 1);
  assert.equal(own()[0].value, 25);
});

test("v21 첫 1분 생산량은 햇살봉 175·해등나무 300·하늘 225로 총 700", () => {
  const game = createGame(10);
  plantAt(game, "sun", 0, 0); plantAt(game, "lantern", 1, 0);
  const production = { sun: 0, lantern: 0, sky: 0 };
  for (let i = 0; i < 601; i++) {
    tick(game, .1);
    for (const sun of [...game.suns]) {
      const source = sun.value === 50 ? "lantern" : sun.x === 72 && sun.y === 50 ? "sun" : "sky";
      production[source] += sun.value;
      collectSun(game, sun.id);
    }
  }
  assert.equal(game.status, "playing");
  assert.deepEqual(production, { sun: 175, lantern: 300, sky: 225 });
  assert.equal(game.stats.collected, 700);
  assert.ok(validSnapshot(snapshot(game)));
});
