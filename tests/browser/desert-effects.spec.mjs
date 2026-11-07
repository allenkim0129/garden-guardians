import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("v30 실제 출현 좀비의 체력 막대는 테마별 최대 체력을 기준으로 표시", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { drawBoard } = await import("./src/art.js");
    const { createGame, tick, snapshot } = await import("./src/engine.js");
    const canvas = document.createElement("canvas");
    canvas.width = 1000; canvas.height = 500;
    const c = canvas.getContext("2d");
    const roundRect = c.roundRect.bind(c), fill = c.fill.bind(c);
    let width, bars = [];
    c.roundRect = function(x, y, w, ...args) { width = w; return roundRect(x, y, w, ...args); };
    c.fill = function(...args) {
      if (this.fillStyle === "#b97c68") bars.push(width);
      return fill(...args);
    };
    return [1, 11, 21].map(stage => {
      const game = createGame(stage); game.time = 9.95; tick(game, .1);
      const enemy = game.enemies[0]; enemy.x = 500;
      bars = []; drawBoard(c, game, null, false);
      const full = [...bars];
      enemy.hp /= 2;
      const before = snapshot(game);
      bars = []; drawBoard(c, game, null, false);
      return { maxHp: enemy.maxHp, full, half: [...bars], unchanged: JSON.stringify(before) === JSON.stringify(snapshot(game)) };
    });
  });
  expect(report.map(r => r.maxHp)).toEqual([110, 143, 176]);
  for (const result of report) {
    expect(result.full).toEqual([]);
    expect(result.half).toEqual([22]);
    expect(result.unchanged).toBe(true);
  }
});

test("v28 노란 번개는 여러 꺾임·짧은 가지·굵기를 갖고 축소·정지·연출 종료에도 피해를 추가하지 않음", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-sprites-ready", "true");
  const report = await page.evaluate(async () => {
    const { drawBoard } = await import("./src/art.js");
    const { createGame, plantAt, tick, snapshot } = await import("./src/engine.js");
    const game = createGame(22);
    const canvas = document.createElement("canvas");
    canvas.width = 1000; canvas.height = 500;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const strokes = [], stroke = context.stroke.bind(context);
    let points = [];
    for (const method of ["beginPath", "moveTo", "lineTo"]) {
      const original = context[method].bind(context);
      context[method] = (...args) => {
        if (method === "beginPath") points = [];
        else points.push(args);
        return original(...args);
      };
    }
    context.stroke = function(...args) {
      if (["#ad7109", "#ffe234", "#fff5ae", "#ffd43b"].includes(this.strokeStyle)) strokes.push({ color: this.strokeStyle, width: this.lineWidth, points: [...points] });
      return stroke(...args);
    };
    game.effects = [{ id: game.nextId++, kind: "chain", x: 200, y: 250, toX: 700, toY: 250, age: 0 }];
    const before = JSON.stringify(game);
    drawBoard(context, game);
    const image = canvas.toDataURL();
    drawBoard(context, game);
    const unchanged = image === canvas.toDataURL() && before === JSON.stringify(game);
    const small = document.createElement("canvas"); small.width = 400; small.height = 200;
    const brush = small.getContext("2d");
    brush.drawImage(canvas, 0, 0, 400, 200);
    const yellow = pixels => {
      let count = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 220 && pixels[i + 1] > 195 && pixels[i + 2] < 185) count++;
      return count;
    };
    const fullWidth = yellow(context.getImageData(300, 210, 1, 80).data);
    const smallWidth = yellow(brush.getImageData(120, 84, 1, 32).data);
    const main = strokes.find(s => s.color === "#ffe234" && s.width === 8);
    const branches = strokes.filter(s => s.color === "#ffe234" && s.width === 3).slice(0, 2);
    game.effects[0].age = .5;
    drawBoard(context, game);
    const faded = canvas.toDataURL();
    game.effects = [];
    drawBoard(context, game);
    const ended = faded === canvas.toDataURL();
    const directions = [];
    for (const [toX, toY] of [[200, 400], [300, 350], [201, 250], [200, 250]]) {
      game.effects = [{ id: 11, kind: "chain", x: 200, y: 250, toX, toY, age: 0 }];
      strokes.length = 0; drawBoard(context, game);
      directions.push({ to: [toX, toY], points: strokes.find(s => s.color === "#ffe234" && s.width === 8).points });
    }
    const battle = createGame(22, ["storm"]);
    plantAt(battle, "storm", 2, 0);
    for (const [row, x] of [[2, 400], [2, 500], [3, 500], [3, 600], [4, 650], [4, 740]]) {
      battle.enemies.push({ id: battle.nextId++, type: "barrel", row, x, hp: 400, age: 0, slow: 0, eating: false });
    }
    for (let i = 0; i < 5; i++) tick(battle, .1);
    const state = snapshot(battle);
    drawBoard(context, battle);
    const combatImage = canvas.toDataURL();
    const pure = JSON.stringify(state) === JSON.stringify(snapshot(battle));
    tick(battle, .1); tick(battle, .1);
    return { main, branches, directions, fullWidth, smallWidth, unchanged, ended,
      hp: battle.enemies.map(e => e.hp), pure, combatImage };
  });
  expect(report.main.points.length).toBeGreaterThanOrEqual(7);
  expect(report.main.points[0]).toEqual([200, 250]);
  expect(report.main.points.at(-1)).toEqual([700, 250]);
  const bends = report.main.points.slice(1, -1).map(point => point[1] - 250);
  expect(bends.every((value, i) => !i || value * bends[i - 1] < 0)).toBe(true);
  expect(new Set(bends.map(Math.abs)).size).toBeGreaterThan(3);
  expect(report.branches).toHaveLength(2);
  for (const branch of report.branches) {
    expect(report.main.points).toContainEqual(branch.points[0]);
    expect(branch.points).toHaveLength(4);
    expect(Math.hypot(branch.points.at(-1)[0] - branch.points[0][0], branch.points.at(-1)[1] - branch.points[0][1])).toBeLessThan(35);
  }
  for (const direction of report.directions) {
    expect(direction.points[0]).toEqual([200, 250]);
    expect(direction.points.at(-1)).toEqual(direction.to);
    expect(direction.points.flat().every(Number.isFinite)).toBe(true);
  }
  expect(report.fullWidth).toBeGreaterThanOrEqual(8);
  expect(report.smallWidth).toBeGreaterThanOrEqual(3);
  expect(report.unchanged).toBe(true);
  expect(report.ended).toBe(true);
  expect(report.hp).toEqual([336, 336, 336, 336, 336, 400]);
  expect(report.pure).toBe(true);
  await writeFile(testInfo.outputPath("yellow-lightning.png"), Buffer.from(report.combatImage.split(",")[1], "base64"));
});

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
