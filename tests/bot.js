// Simple autoplay bot for headless sims. Plans on the half-tile grid, shoots bricks in the way, lines up with enemies and fires.
const E = require('../src/engine.js');
const K = 25; // positions 0..12 in steps of 0.5
function solid(g, i, j, steelOk) {
  for (let y = j; y < j + 2; y++) for (let x = i; x < i + 2; x++) { const v = g.map[y][x]; if (v === E.WATER || v === E.BASE || (v === E.STEEL && !steelOk)) return true; }
  return false;
}
function clearLine(g, x0, y0, x1, y1) { // tile-center points, half-tile cells, steel or base blocks
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
  for (let s = 1; s < n; s++) { const x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n; const v = g.map[Math.floor(y * 2)][Math.floor(x * 2)]; if (v === E.STEEL || v === E.BASE) return false; }
  return true;
}
function makeBot(idx = 0, defend = true) {
  let plan = null, planT = 0, fireT = 0;
  return function (g) {
    const p = g.players[idx]; if (!p.alive) return { dir: null, fire: false };
    const foes = g.enemies.filter(e => e.alive && !e.spawning);
    const cx = p.x + 0.5, cy = p.y + 0.5;
    // 1) lined up with a foe and the line is clear: face and fire
    for (const e of foes) {
      const ex = e.x + 0.5, ey = e.y + 0.5;
      let d = null;
      if (Math.abs(ex - cx) < 0.35) d = ey < cy ? 'u' : 'd'; else if (Math.abs(ey - cy) < 0.35) d = ex < cx ? 'l' : 'r';
      if (d && clearLine(g, cx, cy, ex, ey)) { if (p.dir !== d) return { dir: d, fire: false }; return { dir: null, fire: true }; }
    }
    if (!foes.length) return { dir: null, fire: false };
    // 2) plan a path to a spot lined up with the nearest foe
    planT -= 1 / 60;
    if (!plan || planT <= 0) {
      planT = 0.3; plan = null;
      const si = Math.round(p.x * 2), sj = Math.round(p.y * 2);
      const search = list => { const prev = new Int32Array(K * K).fill(-2), q = [si + sj * K]; prev[si + sj * K] = -1;
        const goal = (i, j) => list.some(e => { const ex = e.x + 0.5, ey = e.y + 0.5, x = i / 2 + 0.5, y = j / 2 + 0.5; return (Math.abs(ex - x) < 0.3 || Math.abs(ey - y) < 0.3) && clearLine(g, x, y, ex, ey); });
        for (let h = 0; h < q.length && h < 4000; h++) {
          const c = q[h], i = c % K, j = (c / K) | 0; if (goal(i, j)) { const path = []; for (let k = c; k >= 0; k = prev[k]) path.unshift(k); return path; }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + dx, nj = j + dy; if (ni < 0 || nj < 0 || ni >= K || nj >= K) continue; const n = ni + nj * K; if (prev[n] !== -2 || solid(g, ni, nj, p.tier >= 3)) continue; prev[n] = c; q.push(n); }
        } return null; };
      const near = foes.slice().sort((a, b) => (Math.abs(a.x - 6) + Math.abs(a.y - 12)) - (Math.abs(b.x - 6) + Math.abs(b.y - 12)));
      plan = (defend && search(near.slice(0, 1))) || search(near);
    }
    if (!plan) return { dir: p.dir === 'u' ? null : 'u', fire: p.dir === 'u' };
    // drop reached waypoints
    while (plan.length > 1 && Math.abs(plan[0] % K / 2 - p.x) < 0.06 && Math.abs(((plan[0] / K) | 0) / 2 - p.y) < 0.06 && Math.abs(plan[1] % K / 2 - p.x) + Math.abs(((plan[1] / K) | 0) / 2 - p.y) < 0.6) plan.shift();
    const w = plan[1] != null ? plan[1] : plan[0], tx = w % K / 2, ty = ((w / K) | 0) / 2;
    if (plan.length < 2 && Math.abs(tx - p.x) + Math.abs(ty - p.y) < 0.02) return { dir: p.dir === 'u' ? null : 'u', fire: p.dir === 'u' };
    let dir = Math.abs(tx - p.x) > Math.abs(ty - p.y) ? (tx > p.x ? 'r' : 'l') : (ty > p.y ? 'd' : 'u');
    // brick in front: shoot it
    const v = E.DIRS[dir], blocked = !E.free(g, p, p.x + v[0] * 0.06, p.y + v[1] * 0.06);
    fireT -= 1 / 60; const f = blocked && p.dir === dir && fireT <= 0; if (f) fireT = 0.2;
    if (blocked) planT = Math.min(planT, 0.1);
    return { dir, fire: f };
  };
}
module.exports = { makeBot };
