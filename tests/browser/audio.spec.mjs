import { test, expect } from "@playwright/test";
import { createGame, PLANTS, ENEMIES } from "../../src/engine.js";
import { freshSave, SAVE_KEY } from "../../src/storage.js";
import { isolatedServer } from "../helpers/server.mjs";

test("실제 Web Audio 합성: 네 종류별 울음·슉슉·피격 파형과 낮은 최대 음량", async ({ page }) => {
  await page.goto("/");
  const report = await page.evaluate(async () => {
    const { GardenAudio, AUDIO_LIMITS } = await import("./src/audio.js");
    const results = [];
    for (const kind of ["ambient", "hit", "ice", "bite", "burst", "gear", "flame"]) {
      for (const type of (["ambient", "hit"].includes(kind) ? ["sleepy", "jelly", "roller", "umbrella"] : ["sleepy"])) {
        const context = new OfflineAudioContext(1, 32000, 24000);
        Object.defineProperty(context, "state", { value: "running" });
        const errors = [];
        const audio = new GardenAudio(message => errors.push(message));
        audio.context = context; audio.enabled = true;
        await audio.unlock();
        const played = audio.play(kind, type);
        const output = (await context.startRendering()).getChannelData(0);
        let peak = 0, sum = 0, roughness = 0;
        for (let i = 0; i < output.length; i++) {
          peak = Math.max(peak, Math.abs(output[i])); sum += output[i] ** 2;
          if (i) roughness += (output[i] - output[i - 1]) ** 2;
        }
        results.push({ kind, type, played, errors, peak, rms: Math.sqrt(sum / output.length), roughness: roughness / sum });
      }
    }
    const context = new OfflineAudioContext(1, 32000, 24000);
    Object.defineProperty(context, "state", { value: "running" });
    const audio = new GardenAudio(message => { throw new Error(message); });
    audio.context = context; audio.enabled = true; await audio.unlock();
    for (const kind of ["sun", "plant", "win", "lose", "burst", "hit"]) audio.play(kind);
    const count = audio.voices.size;
    const output = (await context.startRendering()).getChannelData(0);
    return { results, count, limit: AUDIO_LIMITS.voices, peak: Math.max(...output.map(Math.abs)) };
  });
  expect(report.count).toBe(report.limit);
  expect(report.peak).toBeLessThan(.2);
  for (const sound of report.results) {
    expect(sound.played).toBe(true);
    expect(sound.errors).toEqual([]);
    expect(sound.rms, `${sound.kind}/${sound.type}`).toBeGreaterThan(.0001);
    expect(sound.peak).toBeLessThan(.1);
  }
  const ambient = report.results.filter(sound => sound.kind === "ambient");
  expect(new Set(ambient.map(sound => sound.rms.toFixed(5))).size).toBe(4);
  expect(ambient.find(sound => sound.type === "roller").roughness).toBeGreaterThan(
    ambient.find(sound => sound.type === "sleepy").roughness * 2);
});

test("음량 0·25·45·100%는 실제 파형 출력에 적용되고 최대 출력도 제한", async ({ page }) => {
  await page.goto("/");
  const samples = await page.evaluate(async () => {
    const { GardenAudio } = await import("./src/audio.js");
    const results = [];
    for (const volume of [0, .25, .45, 1]) {
      const context = new OfflineAudioContext(1, 12000, 24000);
      Object.defineProperty(context, "state", { value: "running" });
      const audio = new GardenAudio(message => { throw new Error(message); });
      audio.context = context; audio.enabled = true; audio.setVolume(volume);
      await audio.unlock(); audio.play("sun");
      const output = (await context.startRendering()).getChannelData(0);
      results.push({ rms: Math.sqrt(output.reduce((sum, value) => sum + value * value, 0) / output.length), peak: Math.max(...output.map(Math.abs)) });
    }
    return results;
  });
  expect(samples[0].peak).toBe(0);
  expect(samples[1].rms).toBeGreaterThan(.001);
  expect(samples[2].rms).toBeGreaterThan(samples[1].rms);
  expect(samples[3].rms).toBeGreaterThan(samples[2].rms * 1.8);
  expect(samples[3].peak).toBeLessThan(.2);
});

test("게임 중 소리 설정에서 켜기·볼륨·미리 듣기·음소거·저장 및 재개", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), current: createGame(1, ["sun", "pea"]), tutorialSeen: true },
  });
  await page.goto("/");
  await page.locator("#resume-button").tap();
  await page.evaluate(async () => {
    const { GardenAudio } = await import("./src/audio.js");
    const unlock = GardenAudio.prototype.unlock, play = GardenAudio.prototype.play;
    window.previews = 0;
    GardenAudio.prototype.unlock = function(...args) { window.volumeAudio = this; return unlock.apply(this, args); };
    GardenAudio.prototype.play = function(...args) { const result = play.apply(this, args); if (result) window.previews++; return result; };
  });
  await page.locator("#game [data-sound-settings]").tap();
  await expect(page.locator("#sound-toggle")).toHaveText("소리 켜기");
  await expect(page.locator("#sound-preview")).toBeDisabled();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).current, SAVE_KEY);
  await page.locator("#sound-volume").fill("80");
  await page.locator("#sound-preview").tap();
  await expect.poll(() => page.evaluate(() => window.previews)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.volumeAudio.master.gain.value)).toBeCloseTo(.8);
  await page.waitForTimeout(300);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).current, SAVE_KEY)).toEqual(before);
  await page.locator("#sound-volume").fill("0");
  await expect.poll(() => page.evaluate(() => window.volumeAudio.context.state)).toBe("suspended");
  expect(await page.evaluate(() => window.volumeAudio.voices.size)).toBe(0);
  await expect(page.locator("#sound-preview")).toBeDisabled();
  await page.locator("#sound-volume").fill("65");
  await page.locator("#modal [data-language]").tap();
  await expect(page.locator("#modal-title")).toHaveText("Sound settings");
  await expect(page.getByLabel("Effects volume")).toHaveValue("65");
  await page.getByRole("button", { name: "Done", exact: true }).tap();
  await expect(page.locator("#modal-title")).toHaveText("Paused");
  await page.getByRole("button", { name: "Continue", exact: true }).tap();
  await expect.poll(() => page.evaluate(() => window.volumeAudio.context.state)).toBe("running");
  expect(await page.evaluate(() => window.volumeAudio.master.gain.value)).toBeCloseTo(.65);
  await page.reload();
  await page.locator("#home [data-sound-settings]").tap();
  await expect(page.getByLabel("Effects volume")).toHaveValue("65");
  await expect(page.locator("#sound-toggle")).toHaveText("Turn sound off");
});

test("실제 전투 소리·정지·회전·음소거·재접속 및 음원 중첩 제한", async ({ page }) => {
  const game = createGame(10);
  for (const [row, type] of Object.keys(ENEMIES).entries()) {
    game.plants.push({ id: game.nextId++, type: "pea", row, col: 0, hp: PLANTS.pea.hp, timer: .1, age: 0 });
    game.enemies.push({ id: game.nextId++, type, row, x: 750, hp: ENEMIES[type].hp, slow: 0, age: 0, eating: false });
  }
  await page.goto("/manifest.webmanifest");
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: SAVE_KEY, data: { ...freshSave(), unlocked: 10, tutorialSeen: true, current: game },
  });
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  await page.evaluate(async () => {
    const { GardenAudio } = await import("./src/audio.js");
    const play = GardenAudio.prototype.play;
    window.soundEvents = [];
    GardenAudio.prototype.play = function(kind, type) {
      window.testAudio = this;
      const result = play.call(this, kind, type);
      if (result) window.soundEvents.push({ kind, type, voices: this.voices.size });
      return result;
    };
  });
  await page.locator("#sound-button").tap();
  await page.locator("#resume-button").tap();
  await expect.poll(() => page.evaluate(() => new Set(window.soundEvents.filter(e => e.kind === "ambient").map(e => e.type)).size), { timeout: 15000 }).toBe(4);
  expect(await page.evaluate(() => window.soundEvents.some(e => e.kind === "hit"))).toBe(true);
  expect(await page.evaluate(() => Math.max(...window.soundEvents.map(e => e.voices)))).toBeLessThanOrEqual(6);
  await page.locator("#pause-button").tap();
  await expect.poll(() => page.evaluate(() => window.testAudio.context.state)).toBe("suspended");
  expect(await page.evaluate(() => window.testAudio.voices.size)).toBe(0);
  const count = await page.evaluate(() => window.soundEvents.length);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.soundEvents.length)).toBe(count);
  await page.getByRole("button", { name: "계속하기", exact: true }).tap();
  await expect.poll(() => page.evaluate(() => window.testAudio.context.state)).toBe("running");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => window.testAudio.context.state)).toBe("suspended");
  expect(await page.evaluate(() => window.testAudio.voices.size)).toBe(0);
  await page.evaluate(() => { delete document.hidden; });
  await page.getByRole("button", { name: "계속하기", exact: true }).tap();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => window.testAudio.context.state)).toBe("running");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("#pause-button").tap();
  await page.getByRole("button", { name: "저장하고 나가기", exact: true }).tap();
  await page.locator("#sound-button").tap();
  expect(await page.evaluate(() => window.testAudio.voices.size)).toBe(0);
  await page.reload();
  await expect(page.locator("#sound-button")).toHaveText("소리 꺼짐");
});

test("소리 활성화가 늦게 끝나도 정지·음소거 뒤 다시 켜지지 않음", async ({ page }) => {
  await page.goto("/");
  const report = await page.evaluate(async () => {
    const { GardenAudio } = await import("./src/audio.js");
    const context = new AudioContext();
    await context.suspend();
    let finish;
    context.resume = () => new Promise(resolve => { finish = resolve; });
    const errors = [];
    const audio = new GardenAudio(message => errors.push(message));
    audio.context = context; audio.enabled = true;
    const pending = audio.unlock();
    audio.enabled = false; audio.suspend();
    finish(); await pending;
    const result = { active: audio.active, voices: audio.voices.size, volume: audio.master.gain.value, errors };
    await context.close();
    return result;
  });
  expect(report).toEqual({ active: false, voices: 0, volume: 0, errors: [] });
});

test("서버 종료 후 오프라인 재접속에서도 소리·언어·장비 상태 유지", async ({ page }) => {
  const server = await isolatedServer("/garden-guardians/");
  try {
    const game = createGame(5);
    game.enemies.push({ id: game.nextId++, type: "umbrella", row: 2, x: 700, hp: 100, slow: 0, age: 1, eating: false, equipmentDropped: true });
    await page.goto(`${server.url}manifest.webmanifest`);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key: SAVE_KEY, data: { ...freshSave(), unlocked: 5, sound: true, volume: 73, language: "en", tutorialSeen: true, current: game },
    });
    await page.goto(server.url);
    await expect(page.locator("#offline-status")).toContainText("Offline ready");
    await server.stop();
    await page.reload();
    await expect(page.locator("#sound-button")).toHaveText("Sound on");
    await page.evaluate(async () => {
      const { GardenAudio } = await import("./src/audio.js");
      const emit = GardenAudio.prototype.emit;
      window.offlineSounds = 0;
      GardenAudio.prototype.emit = function(...args) { window.offlineSounds++; return emit.apply(this, args); };
    });
    await page.locator("#resume-button").tap();
    await expect.poll(() => page.evaluate(() => window.offlineSounds)).toBeGreaterThan(0);
    await page.locator("#pause-button").tap();
    const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(data.sound).toBe(true);
    expect(data.volume).toBe(73);
    expect(data.language).toBe("en");
    expect(data.current.enemies[0].equipmentDropped).toBe(true);
  } finally { await server.stop(); }
});
