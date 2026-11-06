export function playStrategy(api, stage, mode = "mixed") {
  const { createGame, plantAt, collectSun, tick } = api;
  const game = createGame(stage);
  const available = type => !api.isPlantUnlocked || api.isPlantUnlocked(type, stage);
  const has = (type, row, col) => game.plants.some(p => p.type === type && p.row === row && (col === undefined || p.col === col));
  const actions = [];
  let lostPlants = 0;
  function attempt(type, row, col) {
    if (!available(type) || !plantAt(game, type, row, col).ok) return false;
    actions.push({ time: game.time, type, row, col });
    return true;
  }
  const rows = api.STAGES[stage - 1].rows ?? [2, 0, 4, 1, 3];
  for (let step = 0; step < 4000 && game.status === "playing"; step++) {
    if (step % 10 === 0) {
      for (const sun of [...game.suns]) collectSun(game, sun.id);
      let acted = false;
      const threats = game.enemies.filter(e => e.x < 930).sort((a, b) => a.x - b.x);
      const priorityRows = [...new Set([...threats.map(e => e.row), ...rows])];
      for (const enemy of threats) {
        if (!has("pea", enemy.row) && attempt("pea", enemy.row, 2)) { acted = true; break; }
      }
      if (!acted && mode === "mixed") {
        for (const enemy of threats) {
          const nearby = threats.filter(e => Math.hypot(e.x - enemy.x, (e.row - enemy.row) * 100) < 150);
          if ((nearby.reduce((sum, e) => sum + e.hp, 0) >= 450 || enemy.x < 330)
            && attempt("bomb", enemy.row, Math.max(0, Math.min(8, Math.floor(enemy.x / 100))))) { acted = true; break; }
        }
      }
      if (!acted && mode === "mixed") {
        for (const enemy of threats) {
          if (enemy.x > 550 && enemy.x < 750 && !has("wall", enemy.row, 5) && attempt("wall", enemy.row, 5)) { acted = true; break; }
        }
      }
      if (!acted) {
        for (const row of [2, 1, 3, 0, 4]) if (!has("sun", row, 0) && attempt("sun", row, 0)) { acted = true; break; }
      }
      if (!acted) {
        for (const row of rows) if (!has("pea", row, 2) && attempt("pea", row, 2)) { acted = true; break; }
      }
      if (!acted && mode === "mixed") {
        for (const row of priorityRows) if (!has("frost", row, 3) && attempt("frost", row, 3)) { acted = true; break; }
      }
      if (!acted) {
        for (const col of (mode === "pea" ? [3, 4, 1] : [1, 4, 3])) {
          for (const row of rows) {
            if (!game.plants.some(p => p.row === row && p.col === col) && attempt("pea", row, col)) { acted = true; break; }
          }
          if (acted) break;
        }
      }
    }
    const before = game.plants.filter(p => p.type !== "bomb");
    tick(game, .1);
    lostPlants += before.filter(p => !game.plants.some(current => current.id === p.id)).length;
  }
  return { game, actions, lostPlants };
}
