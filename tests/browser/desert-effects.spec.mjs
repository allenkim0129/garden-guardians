import { test, expect } from "@playwright/test";

test("선인장 빨간 레이저는 실제 구슬에서 같은 줄 안으로 발사되고 정지·복구·승리 때 일관됨", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { createGame, plantAt, tick, snapshot, advanceEffects } = await import("./src/engine.js");
    const { drawBoard, cactusLaserOrigin } = await import("./src/art.js");
    const { freshSave, readSave } = await import("./src/storage.js");
    const { SPRITE_URLS, CACTUS_MUZZLES } = await import("./src/sprites.js");
    const image = new Image(); image.src = SPRITE_URLS.cactus; await image.decode();
    const source = document.createElement("canvas"); source.width = 1280; source.height = 672;
    const brush = source.getContext("2d"); brush.drawImage(image, 0, 0);
    const orbs = CACTUS_MUZZLES.map(([x, y], index) => {
      const pixels = brush.getImageData(Math.round(x) + index % 4 * 320 - 8, Math.round(y) + Math.floor(index / 4) * 224 - 8, 17, 17).data;
      let red = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 128 && pixels[i] > 130 && pixels[i] > pixels[i + 1] * 1.8 && pixels[i] > pixels[i + 2] * 1.8) red++;
      return red;
    });
    const game = createGame(28, ["cactus"]); game.sun = 400;
    plantAt(game, "cactus", 2, 0);
    game.enemies.push({ id: game.nextId++, type: "barrel", row: 2, x: 900, hp: 400, age: 0, slow: 0, eating: false });
    for (let step = 0; step < 60; step++) tick(game, .1);
    const canvas = document.createElement("canvas"); canvas.width = 1100; canvas.height = 500;
    const c = canvas.getContext("2d");
    const draw = data => { c.clearRect(0, 0, 1100, 500); drawBoard(c, data, null, false); };
    const strip = () => Array.from(c.getImageData(300, 201, 400, 15).data).join(",");
    draw(game);
    const origin = cactusLaserOrigin(game.plants[0], game);
    const full = canvas.toDataURL(), beam = strip();
    const color = Array.from(c.getImageData(500, Math.round(origin.y), 1, 1).data);
    const outside = Array.from(c.getImageData(1001, Math.round(origin.y), 1, 1).data);
    const withBeam = c.getImageData(200, 0, 800, 500).data;
    tick(game, 0); draw(game);
    const paused = full === canvas.toDataURL();
    const restored = readSave({ getItem: () => JSON.stringify({ ...freshSave(), unlocked: 28, current: snapshot(game) }) });
    if (restored.error) throw new Error(restored.error);
    draw(restored.data.current);
    const restoredBeam = beam === strip();
    const noLaser = snapshot(game); delete noLaser.plants[0].shotAt;
    draw(noLaser);
    const withoutBeam = c.getImageData(200, 0, 800, 500).data;
    let otherLaneChanges = 0;
    for (let y = 0; y < 500; y++) if (y < 200 || y >= 300) for (let x = 0; x < 800; x++) {
      const offset = (y * 800 + x) * 4;
      if (withBeam[offset] !== withoutBeam[offset] || withBeam[offset + 1] !== withoutBeam[offset + 1]) otherLaneChanges++;
    }
    game.status = "won";
    for (let step = 0; step < 3; step++) advanceEffects(game, .1);
    draw(game);
    return { orbs, origin, color, outside, paused, restoredBeam, otherLaneChanges, ended: beam !== strip(), defeated: game.stats.defeated };
  });
  expect(report.orbs.every(count => count > 5)).toBe(true);
  expect(report.origin.x).toBeGreaterThan(50);
  expect(report.origin.y).toBeGreaterThan(201);
  expect(report.origin.y).toBeLessThan(215);
  expect(report.color[0]).toBeGreaterThan(report.color[1] * 1.8);
  expect(report.color[0]).toBeGreaterThan(report.color[2] * 1.8);
  expect(report.outside[3]).toBe(0);
  expect(report.paused).toBe(true);
  expect(report.restoredBeam).toBe(true);
  expect(report.otherLaneChanges).toBe(0);
  expect(report.ended).toBe(true);
  expect(report.defeated).toBe(1);
});

test("사막 장비 탈락·연쇄선 실제 렌더링과 새 효과음 파형", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { GardenAudio } = await import("./src/audio.js");
    const { createGame, ENEMIES, tick } = await import("./src/engine.js");
    const { drawEnemy, drawDroppedGear, drawBoard } = await import("./src/art.js");
    const canvas = document.createElement("canvas");
    canvas.width = 1000; canvas.height = 500;
    const c = canvas.getContext("2d");
    const gear = [];
    for (const type of ["barrel", "courier"]) {
      c.clearRect(0, 0, 1000, 500);
      drawEnemy(c, type, 250, 250);
      const equipped = canvas.toDataURL();
      c.clearRect(0, 0, 1000, 500);
      drawEnemy(c, type, 250, 250, 1, 0, false, false, { row: 0, col: 0 }, true);
      const bare = canvas.toDataURL();
      drawDroppedGear(c, { type, x: 250, y: 250, age: .4 });
      gear.push({ different: equipped !== bare, falling: canvas.toDataURL() !== bare });
    }
    const game = createGame(25);
    for (const [type, row] of [["barrel", 2], ["courier", 3], ["barrel", 4]]) {
      game.enemies.push({ id: game.nextId++, type, row, x: 500, hp: ENEMIES[type].hp / 2 + 1, slow: 0, age: 0, eating: false });
    }
    game.shots.push({ id: game.nextId++, kind: "storm", row: 2, x: 470, damage: 32, frost: false });
    for (let step = 0; step < 4; step++) tick(game, .1);
    drawBoard(c, game, null, false);
    const withChain = canvas.toDataURL();
    const chain = game.effects.filter(e => e.kind === "chain");
    game.effects = game.effects.filter(e => e.kind !== "chain");
    drawBoard(c, game, null, false);
    const sounds = [];
    for (const [kind, type] of [["ambient", "barrel"], ["hit", "barrel"], ["ambient", "courier"], ["hit", "courier"], ["chain", "storm"], ["laser", "cactus"]]) {
      const context = new OfflineAudioContext(1, 32000, 24000);
      Object.defineProperty(context, "state", { value: "running" });
      const audio = new GardenAudio(message => { throw new Error(message); });
      audio.context = context; audio.enabled = true;
      await audio.unlock(); audio.play(kind, type);
      const data = (await context.startRendering()).getChannelData(0);
      sounds.push({ kind, type, peak: Math.max(...data.map(Math.abs)),
        rms: Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length) });
    }
    return { gear, chains: chain.length, differentChain: withChain !== canvas.toDataURL(),
      dropped: game.enemies.every(e => e.equipmentDropped), sounds };
  });
  expect(report.gear).toEqual([{ different: true, falling: true }, { different: true, falling: true }]);
  expect(report.chains).toBe(2);
  expect(report.differentChain).toBe(true);
  expect(report.dropped).toBe(true);
  for (const sound of report.sounds) {
    expect(sound.rms, `${sound.kind}/${sound.type}`).toBeGreaterThan(.0001);
    expect(sound.peak).toBeLessThan(.1);
  }
});
