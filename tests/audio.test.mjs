import test from "node:test";
import assert from "node:assert/strict";
import { GardenAudio, AUDIO_LIMITS } from "../src/audio.js";
import { createGame, ENEMIES, snapshot } from "../src/engine.js";

function fixture() {
  const game = createGame(10);
  for (const [row, type] of Object.keys(ENEMIES).entries()) {
    game.enemies.push({ id: game.nextId++, type, row, x: 700, hp: ENEMIES[type].hp, slow: 0, age: 0, eating: false });
  }
  const audio = new GardenAudio(message => assert.fail(message));
  audio.enabled = audio.active = true;
  audio.reset(game);
  const calls = [];
  audio.play = (kind, type) => { if (audio.enabled && audio.active) calls.push({ kind, type, at: game.time }); };
  return { audio, game, calls };
}
test("피격·장비·폭발 이벤트는 프레임 사이 한 번만 소리로 전달하고 게임을 변경하지 않음", () => {
  const { audio, game, calls } = fixture();
  for (const kind of ["hit", "ice", "gear", "burst", "splash"]) {
    game.effects.push({ id: game.nextId++, kind, type: "jelly", age: 0, x: 500, y: 50 });
  }
  const before = structuredClone(game);
  audio.update(game); audio.update(game);
  assert.deepEqual(calls.map(call => call.kind), ["hit", "ice", "gear", "burst", "splash"]);
  assert.deepEqual(game, before);
  audio.reset(snapshot(game));
  audio.update(audio.game);
  assert.equal(calls.length, 5);
});
test("좀비가 많아도 보행음은 전역 간격과 종류별 간격을 지키고 네 종류 모두 들림", () => {
  const { audio, game, calls } = fixture();
  for (let i = 0; i < 50; i++) game.enemies.push({ ...game.enemies[i % 4], id: game.nextId++ });
  for (let step = 0; step < 300; step++) {
    game.time = step / 10;
    audio.update(game);
  }
  const ambient = calls.filter(call => call.kind === "ambient");
  assert.deepEqual(new Set(ambient.map(call => call.type)), new Set(Object.keys(ENEMIES)));
  assert.ok(ambient.length <= Math.ceil(30 / AUDIO_LIMITS.ambientGap));
  for (let i = 1; i < ambient.length; i++) assert.ok(ambient[i].at - ambient[i - 1].at >= AUDIO_LIMITS.ambientGap - 1e-8);
  for (const type of Object.keys(ENEMIES)) {
    const own = ambient.filter(call => call.type === type);
    for (let i = 1; i < own.length; i++) assert.ok(own[i].at - own[i - 1].at >= (type === "roller" ? 3.4 : 6) - 1e-8);
  }
  game.enemies.forEach(enemy => { enemy.eating = true; });
  const count = calls.length;
  game.time += 10; audio.update(game);
  assert.equal(calls.length, count);
});
test("음소거 중 피격을 나중에 몰아 재생하지 않고 재시작에는 예약을 초기화", () => {
  const { audio, game, calls } = fixture();
  audio.enabled = false;
  game.effects.push({ id: game.nextId++, kind: "hit", type: "sleepy", age: 0 });
  audio.update(game);
  audio.enabled = true;
  audio.update(game);
  assert.equal(calls.length, 0);
  game.plants.push({ id: game.nextId++, hurtAt: 0 });
  audio.update(game); audio.update(game);
  assert.equal(calls.filter(call => call.kind === "bite").length, 1);
  const next = createGame(1);
  audio.update(next);
  assert.equal(audio.lastEffectId, 0);
  assert.equal(audio.hurtTimes.size, 0);
  assert.equal(audio.ambientDue.size, 0);
});
test("진행 종료 뒤 보행음을 만들지 않음", () => {
  const { audio, game, calls } = fixture();
  audio.update(game);
  game.time = 10; game.status = "won";
  audio.update(game);
  assert.equal(calls.length, 0);
});
