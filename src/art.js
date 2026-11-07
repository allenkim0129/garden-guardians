import { PLANTS, ENEMIES, STAGES, PUMPKIN_RADIUS, FIRE_RADIUS, GEAR_DURATION, boardColumns, boardWidth } from "./engine.js";
import { drawSprite, plantFrame, enemyFrame, fallFrame, burstFrame, FALL_DURATION, BURST_DURATION } from "./sprites.js";

const ink = "#304b3d";
function ellipse(c, x, y, rx, ry, fill, stroke = null, width = 3) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
}
function rounded(c, x, y, w, h, r, fill, stroke = null) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 3; c.stroke(); }
}
function line(c, points, color = ink, width = 3) {
  c.beginPath(); c.moveTo(...points[0]); points.slice(1).forEach(p => c.lineTo(...p));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round"; c.lineJoin = "round"; c.stroke();
}
function star(c, x, y, outer, inner, color, points = 5) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = i * Math.PI / points - Math.PI / 2;
    if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath(); c.fillStyle = color; c.fill();
}
const paths = new Map();
function shape(c, data, fill, stroke = ink, width = 2) {
  if (!paths.has(data)) paths.set(data, new Path2D(data));
  const path = paths.get(data);
  if (fill) { c.fillStyle = fill; c.fill(path); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = "round"; c.stroke(path); }
}
function volume(c, x, y, radius, light, middle, dark) {
  const gradient = c.createRadialGradient(x - radius * .35, y - radius * .4, 1, x, y, radius);
  gradient.addColorStop(0, light); gradient.addColorStop(.52, middle); gradient.addColorStop(1, dark);
  return gradient;
}
function groundShadow(c, width = 34) {
  ellipse(c, 9, 34, width + 10, 11, volume(c, 9, 34, width + 10, "#263c3749", "#263c3728", "#263c3700"));
  ellipse(c, 0, 30, width * .55, 5, "#243f3d48");
}

export function drawPlant(c, type, x, y, scale = 1, time = 0, frame = { row: 0, col: 0 }) {
  c.save(); c.translate(x, y); c.scale(scale, scale); groundShadow(c, type === "pea" ? 27 : 32); c.restore();
  drawSprite(c, type, frame, x, y, scale);
}
export function drawEnemy(c, type, x, y, scale = 1, age = 0, slow = false, eating = false, frame = { row: 0, col: 0 }, equipmentDropped = false) {
  c.save(); c.translate(x, y); c.scale(scale, scale); groundShadow(c, type === "sleepy" ? 25 : 32); c.restore();
  drawSprite(c, type, frame, x, y, scale, equipmentDropped, slow);
  if (slow) {
    star(c, x + 23 * scale, y - 35 * scale, 7 * scale, 2 * scale, "#d8f8ff", 6);
    if (type !== "sleepy") star(c, x - 29 * scale, y + 14 * scale, 9 * scale, 3 * scale, "#d8f8ff", 6);
  }
}

export function drawDroppedGear(c, effect) {
  const progress = Math.min(1, effect.age / GEAR_DURATION);
  c.save();
  c.globalAlpha *= Math.min(1, (1 - progress) * 4);
  c.translate(effect.x + (effect.type === "umbrella" ? -34 : 4) + progress * 35,
    effect.y - 20 - Math.sin(progress * Math.PI) * 32 + progress * 48);
  c.rotate(progress * (effect.type === "umbrella" ? -2.4 : 4));
  if (effect.type === "umbrella") {
    line(c, [[0, -17], [0, 20], [5, 24], [9, 20]], "#715749", 3);
    shape(c, "M-27 0 Q-23 -25 0 -29 Q23 -25 27 0 Q14 -8 0 0 Q-14 -8 -27 0Z", "#865586", "#392e3c", 2);
    line(c, [[0, -29], [-10, -13], [-13, -4]], "#b889ac", 1.5);
    line(c, [[0, -29], [10, -13], [13, -4]], "#523651", 1.5);
    shape(c, "M10 -16 L18 -12 L15 -5 L8 -9Z", "#ba9b83", "#524551", 1);
  } else {
    const colors = { sleepy: ["#398da1", "#85c7cd"], jelly: ["#7161d7", "#bcb2ff"], roller: ["#973d60", "#e7a7b9"] };
    const [base, light] = colors[effect.type];
    for (let i = 0; i < 3; i++) {
      c.save(); c.translate((i - 1) * (12 + progress * 13), i % 2 * 10);
      c.rotate(i + progress);
      shape(c, "M-8 -8 L0 -5 L7 -9 L5 0 L9 6 L-1 4 L-6 8 L-4 -1Z", base, "#35433b", 1.5);
      line(c, [[-3, -4], [2, -2], [0, 2]], light, 1.5);
      c.restore();
    }
  }
  c.restore();
}

function drawFlame(c, x, y, scale, time) {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  c.rotate(Math.sin(time * 9) * .1);
  shape(c, "M0 10 C-17 8 -18 -3 -12 -15 L-5 -7 Q3 -20 0 -29 Q21 -14 15 0 Q12 11 0 10Z", "#f67b32", "#a74727", 1.5);
  shape(c, "M0 7 Q-9 5 -5 -7 L0 -2 L5 -15 Q14 3 0 7Z", "#ffe795", null);
  c.restore();
}

// Visual muzzle alignment only; the engine's shot coordinates and collision rules stay unchanged.
export function projectilePosition(shot) {
  if (shot.kind === "pumpkin") {
    const progress = Math.min(1, shot.age / shot.duration);
    return { x: shot.x, y: shot.row * 100 + 50 - (1 - progress) * 35 - Math.sin(progress * Math.PI) * 70 };
  }
  if (shot.kind === "twin") return { x: shot.x + 2, y: shot.row * 100 + (shot.muzzle === 0 ? 22 : 41) };
  if (shot.kind === "thorn") return { x: shot.x + 12, y: shot.row * 100 + 34 };
  if (shot.kind === "ember") return { x: shot.x, y: shot.row * 100 + 44 };
  return { x: shot.x + (shot.frost ? 7 : 0), y: shot.row * 100 + (shot.frost ? 26 : 42) };
}
export function drawProjectile(c, shot) {
  const { x, y } = projectilePosition(shot);
  c.save(); c.translate(x, y);
  if (shot.kind === "ember") {
    c.rotate(Math.PI / 2);
    drawFlame(c, 0, 0, .65, shot.x / 100);
  } else if (shot.kind === "pumpkin") {
    c.rotate(shot.age * 3);
    ellipse(c, 0, 0, 12, 10, volume(c, 0, 0, 14, "#ffe8a6", "#ed9e39", "#ac5528"), "#704d2a", 1.6);
    line(c, [[-3, -8], [-5, 0], [-3, 8]], "#c87a31", 1.4);
    line(c, [[3, -8], [5, 0], [3, 8]], "#c87a31", 1.4);
    shape(c, "M-1 -8 Q-1 -14 5 -12 L3 -7Z", "#719743", "#435c2e", 1.2);
    shape(c, "M-7 -4 Q-5 -7 -2 -5", null, "#fff0b8", 1.8);
  } else if (shot.kind === "thorn") {
    shape(c, "M-15 -4 L-6 -5 L16 0 L-7 5 L-15 3 L-9 0Z", "#955878", "#4b304c", 1.5);
    shape(c, "M-9 -3 L14 0 L-6 0Z", "#e5aec7", null);
    shape(c, "M-15 -4 L-7 0 L-15 3 L-11 0Z", "#80984c", null);
  } else if (shot.frost) {
    shape(c, "M-11 -1 L-4 -5 L-1 -9 L5 -4 L12 0 L5 4 L0 8 L-4 3Z", "#a9e3ee", "#397e96", 1.5);
    shape(c, "M-11 -1 L-1 -9 L2 -1 L12 0 L0 1Z", "#edffff", null);
    shape(c, "M0 1 L5 4 L0 8 L-4 3Z", "#69b2d2", null);
    line(c, [[-7, 0], [1, -1], [7, 0]], "#ffffff", 1.2);
  } else {
    shape(c, "M-8 -1 C-8 -7 2 -9 7 -5 C13 0 6 8 0 7 C-5 7 -10 4 -8 -1Z",
      volume(c, 0, 0, 10, "#dcf795", "#88bf43", "#3e722c"), "#345d27", 1.6);
    shape(c, "M-4 -3 Q-1 -6 3 -4", null, "#edffbd", 2);
    shape(c, "M4 3 Q2 5 -1 4", null, "#527d2d", 1);
  }
  c.restore();
}

let sunLayers;
export function drawSunToken(c, time) {
  if (!sunLayers) {
    sunLayers = ["glow", "rays", "core"].map(layer => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (layer === "glow") {
        const glow = ctx.createRadialGradient(48, 48, 22, 48, 48, 48);
        glow.addColorStop(0, "#ffe3939a"); glow.addColorStop(1, "#ffcb4900");
        ellipse(ctx, 48, 48, 48, 48, glow);
      } else if (layer === "rays") {
        star(ctx, 48, 48, 42, 27, volume(ctx, 48, 48, 43, "#fff3a2", "#f4c252", "#c67d25"), 10);
        ctx.strokeStyle = "#b97c2e"; ctx.lineWidth = 1.8; ctx.stroke();
        star(ctx, 48, 48, 35, 25, "#ffdc70", 10);
      } else {
        ellipse(ctx, 48, 49, 23, 23, "#a4672b75");
        ellipse(ctx, 47, 46, 22, 22, volume(ctx, 47, 46, 26, "#fffce1", "#ffda69", "#cd8c2c"), "#b97c2e", 2);
        ellipse(ctx, 41, 38, 8, 4, "#fffcebbf");
        shape(ctx, "M31 46 Q28 35 38 29", null, "#fff9c9", 2.5);
        shape(ctx, "M51 62 Q61 58 63 50", null, "#d99930", 2);
      }
      return canvas;
    });
  }
  c.clearRect(0, 0, 96, 96);
  c.save();
  c.globalAlpha = .5 + Math.sin(time * 1.4) * .12;
  c.drawImage(sunLayers[0], 0, 0);
  c.globalAlpha = 1;
  c.save(); c.translate(48, 48); c.rotate(time * .13);
  c.drawImage(sunLayers[1], -48, -48); c.restore();
  c.drawImage(sunLayers[2], 0, 0);
  c.globalAlpha = .45 + Math.sin(time * 1.4 + .7) * .2;
  star(c, 76, 22, 6, 1.8, "#fffce1", 4);
  star(c, 19, 70, 4, 1.2, "#fff7bb", 4);
  c.restore();
}

function grass(c, x, y, color) {
  line(c, [[x - 3, y], [x - 5, y - 4]], color, 1.6);
  line(c, [[x, y], [x + 1, y - 6]], color, 1.6);
  line(c, [[x + 3, y], [x + 5, y - 3]], color, 1.6);
}
export function drawBoard(c, game, selected, shovel) {
  const columns = boardColumns(game);
  c.clearRect(0, 0, boardWidth(game), 500);
  const moon = STAGES[game.stage - 1].theme === "moon";
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < columns; col++) {
      c.fillStyle = moon ? ((row + col) % 2 ? "#728b9b" : "#819eaa") : ((row + col) % 2 ? "#bcd496" : "#c5dda0");
      c.fillRect(col * 100, row * 100, 100, 100);
      grass(c, col * 100 + 17 + (row * 7) % 15, row * 100 + 86, moon ? "#b9c9e880" : "#89ac6a70");
      grass(c, col * 100 + 76, row * 100 + 19, moon ? "#c7e4dc80" : "#97b77670");
      if (moon) {
        line(c, [[col * 100 + 2, row * 100 + 98], [col * 100 + 98, row * 100 + 98]], "#3e556a55", 2);
        line(c, [[col * 100 + 5, row * 100 + 20], [col * 100 + 20, row * 100 + 5]], "#d8efff55", 3);
        if ((row + col) % 3 === 0) {
          c.save(); c.globalAlpha = .45 + Math.sin(game.time * 1.2 + col + row) * .15;
          star(c, col * 100 + 85, row * 100 + 18, 4, 1.5, "#f7eeb5", 4);
          c.restore();
        }
      }
      if ((row * columns + col) % 11 === 0) {
        ellipse(c, col * 100 + 82, row * 100 + 76, 3, 3, moon ? "#e1c5ff" : "#f7f1be");
        ellipse(c, col * 100 + 86, row * 100 + 79, 3, 3, moon ? "#e1c5ff" : "#f7f1be");
        ellipse(c, col * 100 + 82, row * 100 + 81, 3, 3, moon ? "#e1c5ff" : "#f7f1be");
        ellipse(c, col * 100 + 83, row * 100 + 79, 1.5, 1.5, "#e2bd5e");
      }
    }
  }
  c.fillStyle = moon ? "#b4b1f555" : "#6f9d5a35"; c.fillRect(0, 0, 8, 500);
  for (let row = 0; row < 5; row++) {
    for (const plant of game.plants.filter(p => p.row === row)) {
      drawPlant(c, plant.type, plant.col * 100 + 50, row * 100 + 53, .9, game.time, plantFrame(plant, game));
      if (plant.hp < PLANTS[plant.type].hp * .95) healthBar(c, plant.col * 100 + 50, row * 100 + 91, plant.hp / PLANTS[plant.type].hp, "#4e8753");
      if (shovel) { c.strokeStyle = "#a27342"; c.lineWidth = 2; c.strokeRect(plant.col * 100 + 5, row * 100 + 5, 90, 90); }
    }
    for (const enemy of game.enemies.filter(e => e.row === row).sort((a, b) => b.x - a.x)) {
      drawEnemy(c, enemy.type, enemy.x, row * 100 + 54, .87, enemy.age, enemy.slow > 0, enemy.eating, enemyFrame(enemy, game.time), enemy.equipmentDropped);
      if (enemy.burn > 0) {
        for (let i = 0; i < 3; i++) drawFlame(c, enemy.x + (i - 1) * 18, row * 100 + 65 + i % 2 * 6, .65 + Math.sin(game.time * 8 + i) * .1, game.time + i);
      }
      if (enemy.hp < ENEMIES[enemy.type].hp) healthBar(c, enemy.x, row * 100 + 91, enemy.hp / ENEMIES[enemy.type].hp, "#b97c68");
    }
  }
  for (const shot of game.shots) drawProjectile(c, shot);
  for (const effect of game.effects) {
    c.save(); c.globalAlpha = Math.max(0, 1 - effect.age * (effect.kind === "burst" ? 1.3 : 2));
    if (effect.kind === "gear") {
      c.globalAlpha = 1;
      drawDroppedGear(c, effect);
    } else if (effect.kind === "fall") {
      c.globalAlpha = Math.min(1, Math.max(0, (FALL_DURATION - effect.age) / .24));
      drawEnemy(c, effect.type ?? "sleepy", effect.x, effect.y + 4, .87, 0, false, false, fallFrame(effect.age), effect.equipmentDropped);
    } else if (effect.kind === "burst") {
      c.globalAlpha = Math.max(0, 1 - effect.age / .4) * .35;
      ellipse(c, effect.x, effect.y, Math.min(175, effect.age * 500), Math.min(175, effect.age * 500), "#ffba5124", "#e79a42", 2);
      c.globalAlpha = Math.min(1, Math.max(0, (BURST_DURATION - effect.age) / .2));
      drawSprite(c, "bomb", burstFrame(effect.age), effect.x, effect.y + 3, .9);
    } else if (effect.kind === "splash" || effect.kind === "flame") {
      const fire = effect.kind === "flame";
      const radius = (fire ? FIRE_RADIUS : PUMPKIN_RADIUS) * Math.min(1, effect.age * 7);
      ellipse(c, effect.x, effect.y, radius, radius, "#f5b65230", "#d08a38", 2);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const x = effect.x + Math.cos(angle) * radius * .7, y = effect.y + Math.sin(angle) * radius * .7;
        if (fire) drawFlame(c, x, y, .5, effect.age + i);
        else ellipse(c, x, y, 5, 3, i % 2 ? "#839843" : "#ffd79a");
      }
    } else if (effect.kind === "heart") {
      c.fillStyle = "#ce7067"; c.font = "40px sans-serif"; c.fillText("♥", effect.x - 15, effect.y - effect.age * 40);
    } else {
      star(c, effect.x, effect.y - effect.age * 20, 10 + effect.age * 18, 4, effect.kind === "ice" ? "#efffff" : "#fff3b1", 6);
    }
    c.restore();
  }
}
function healthBar(c, x, y, fraction, color) {
  rounded(c, x - 22, y, 44, 5, 3, "#536a4d30");
  rounded(c, x - 22, y, 44 * Math.max(0, fraction), 5, 3, color);
}
export function plantIcon(type) {
  const canvas = document.createElement("canvas");
  canvas.width = 120; canvas.height = 120;
  drawPlant(canvas.getContext("2d"), type, 60, 72, 1.05);
  return canvas.toDataURL("image/png");
}

export function drawTitle(canvas) {
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 1000, 760);
  c.save(); c.translate(500, 370); c.rotate(-.035);
  rounded(c, -440, -300, 880, 610, 190, "#e6ebd4");
  ellipse(c, 280, -200, 57, 57, "#f9d987");
  for (const [x, y] of [[-280, -194], [100, -238], [310, -65]]) {
    ellipse(c, x, y, 50, 16, "#faf9eb"); ellipse(c, x - 18, y - 12, 24, 23, "#faf9eb"); ellipse(c, x + 17, y - 8, 30, 25, "#faf9eb");
  }
  ellipse(c, 0, 180, 424, 112, "#cad8ae");
  for (let i = 0; i < 14; i++) rounded(c, -385 + i * 58, -45, 18, 150, 7, "#faf5de", "#dfd9bb");
  rounded(c, -400, -14, 800, 17, 5, "#eee7ca");
  rounded(c, -400, 60, 800, 17, 5, "#eee7ca");
  c.save(); c.translate(-15, 151); c.rotate(-.04);
  rounded(c, -354, -70, 708, 215, 30, "#829658");
  rounded(c, -354, -86, 708, 215, 30, "#acc67f");
  c.save(); c.beginPath(); c.roundRect(-354, -86, 708, 215, 30); c.clip();
  for (let row = 0; row < 3; row++) for (let col = 0; col < 8; col++) {
    c.fillStyle = (row + col) % 2 ? "#b6cc8b" : "#c1d598";
    c.fillRect(-354 + col * 89, -86 + row * 72, 89, 72);
    grass(c, -322 + col * 89, -35 + row * 72, "#8ea66b");
  }
  c.restore(); c.restore();
  drawPlant(c, "sun", -247, 66, 2.18);
  drawPlant(c, "pea", -78, 159, 2.35);
  drawPlant(c, "wall", -251, 218, 1.8);
  drawPlant(c, "frost", 100, 226, 1.7);
  drawEnemy(c, "sleepy", 109, 57, 2);
  drawEnemy(c, "roller", 286, 163, 1.72);
  star(c, -90, -127, 17, 6, "#deb95b");
  star(c, 357, 16, 12, 4, "#d4ac51");
  star(c, -358, 138, 12, 4, "#ffefd0");
  c.restore();
}

export function drawAppIcon(canvas) {
  const c = canvas.getContext("2d");
  c.scale(canvas.width / 512, canvas.height / 512);
  c.fillStyle = "#214f3b"; c.fillRect(0, 0, 512, 512);
  ellipse(c, 256, 265, 190, 190, "#d5dfa3");
  ellipse(c, 256, 370, 140, 32, "#adc482");
  drawPlant(c, "pea", 253, 279, 3.65);
  star(c, 383, 135, 23, 9, "#ffe098");
  star(c, 121, 177, 14, 5, "#fff1bd");
}
