// Player models for fairness sims, adapted from QA's v1 scripts (fair.js kid mode and probot.js).
// kid: the planner bot with 0.25 s reactions, 30% random moves and sloppy firing. pro: the bot plus dodging and counter-fire.
const E = require('../src/engine.js'), { makeBot } = require('./bot.js'), F = 1 / 60;
function makeKid(seed) {
  const b = makeBot(); let hold = {}, t = 0, s = (seed >>> 0) || 1; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  return g => { const o = b(g); t -= F; if (t <= 0) { t = 0.25; hold = r() < 0.3 ? { dir: ['u', 'd', 'l', 'r', null][Math.floor(r() * 5)], fire: r() < 0.3 } : { dir: o.dir, fire: o.fire && r() < 0.6 }; } return hold; };
}
function makePro() {
  const b = makeBot();
  return g => { const p = g.players[0]; if (!p.alive) return {}; const cx = p.x + 0.5, cy = p.y + 0.5;
    for (const s of g.bullets) { if (s.side !== 'e' || !s.alive) continue; const v = E.DIRS[s.dir];
      const lateral = v[0] ? Math.abs(s.y - cy) : Math.abs(s.x - cx), along = v[0] ? (cx - s.x) * v[0] : (cy - s.y) * v[1];
      if (lateral < 0.6 && along > 0 && along < 4) { const face = { u: 'd', d: 'u', l: 'r', r: 'l' }[s.dir];
        if (p.dir === face && p.cool <= 0) return { dir: null, fire: true }; if (along > 1.5) return { dir: face, fire: false };
        for (const o of (v[0] ? ['u', 'd'] : ['l', 'r'])) { const w = E.DIRS[o]; if (E.free(g, p, p.x + w[0] * 0.3, p.y + w[1] * 0.3)) return { dir: o, fire: false }; }
        return { dir: face, fire: true }; } }
    return b(g); };
}
// play one game with no test aids; returns the finished game
function playOne(level, diff, seed, who) {
  const g = E.newGame({ level, difficulty: diff, seed: 9000 + level * 131 + seed * 7 }), pl = who === 'kid' ? makeKid(9000 + seed) : who === 'pro' ? makePro() : makeBot();
  for (let i = 0; i < 60 * 480 && g.status === 'play'; i++) E.step(g, [pl(g)], F);
  return g;
}
function winRate(levels, diff, who, seeds) { let w = 0, n = 0, bird = 0; for (const L of levels) for (let s = 0; s < seeds; s++) { const g = playOne(L, diff, s, who); n++; if (g.status === 'won') w++; else if (g.reason === 'bird') bird++; } return { win: w / n, bird: bird / n, n }; }
module.exports = { makeKid, makePro, playOne, winRate };
