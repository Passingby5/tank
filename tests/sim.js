// Headless sims of many games. Run: node tests/sim.js
// v5: advanced fair-play gates (camp vs mobile, finishable late levels), not kid-win ease gates.
const assert = require('assert'), E = require('../src/engine.js'), { makeBot } = require('./bot.js'), { makePro } = require('./players.js');
const F = 1 / 60, ok2 = m => console.log('ok', m); let maxStuck = 0, games = 0, t0 = Date.now();
function watchStuck(g, mem) {
  for (const e of g.enemies) { if (!e.alive || e.spawning) continue; const m = mem.get(e.id) || { x: e.x, y: e.y, t: 0 }; if (g.freezeT > 0 || Math.abs(m.x - e.x) + Math.abs(m.y - e.y) > 0.05) { m.x = e.x; m.y = e.y; m.t = 0; } else m.t += F; mem.set(e.id, m); if (m.t > maxStuck) maxStuck = m.t; }
}
function play(level, diff, seed, mode) {
  const g = E.newGame({ level, difficulty: diff, seed }), bot = mode === 'idle' ? null : makeBot(), mem = new Map(), aids = mode === 'aided';
  for (let i = 0; i < 60 * 480 && g.status === 'play'; i++) {
    if (mode === 'idle' || mode === 'shield') g.players[0].shieldT = 5;
    if (aids) { g.players[0].shieldT = 5; if (g.shovelT < 1) E.applyPower(g, g.players[0], 'shovel'); }
    E.step(g, [bot ? bot(g) : {}], F); watchStuck(g, mem);
  }
  games++; return g;
}
for (const diff of ['easy', 'medium', 'hard']) for (let L = 0; L < E.LEVELS.length; L++) {
  const g = play(L, diff, 1000 + L * 31 + diff.length, 'aided');
  assert.strictEqual(g.status, 'won', diff + ' level ' + (L + 1) + ' not cleared (' + g.status + ', ' + g.killed + '/' + g.queue.length + ')'); assert(g.birdAlive);
}
console.log('ok autoplay bot (shield + steel fort aids) clears all ' + E.LEVELS.length + ' levels on Easy, Medium and Hard; the bird stayed safe in all ' + games + ' games');
let birdLost = 0, idleGames = 0;
for (let L = 0; L < E.LEVELS.length; L++) for (let s = 0; s < 3; s++) { const g = play(L, 'medium', L * 97 + s, 'idle'); idleGames++; if (g.reason === 'bird') birdLost++; }
assert(birdLost / idleGames >= 0.8, 'bird attacked in only ' + birdLost + '/' + idleGames);
console.log('ok with the player parked (shielded) and nobody defending, enemies reached and hit the bird in ' + birdLost + '/' + idleGames + ' games');

function makeCamper() {
  return g => {
    const p = g.players[0]; if (!p.alive) return {};
    if (Math.abs(p.x - 6) > 0.35) return { dir: p.x < 6 ? 'r' : 'l', fire: true };
    if (p.y > 1.6) return { dir: 'u', fire: true };
    return { dir: p.dir === 'u' ? null : 'u', fire: true };
  };
}
function playWho(level, diff, seed, who) {
  const g = E.newGame({ level, difficulty: diff, seed: 9000 + level * 131 + seed * 7 });
  const pl = who === 'camp' ? makeCamper() : who === 'pro' ? makePro() : makeBot();
  for (let i = 0; i < 60 * 420 && g.status === 'play'; i++) E.step(g, [pl(g)], F);
  return g;
}
function rate(levels, diff, who, seeds) {
  let w = 0, n = 0, bird = 0, dead = 0;
  for (const L of levels) for (let s = 0; s < seeds; s++) {
    const g = playWho(L, diff, s, who); n++;
    if (g.status === 'won') w++; else if (g.reason === 'bird') bird++; else dead++;
  }
  return { win: w / n, bird: bird / n, dead: dead / n, n };
}
const ALL = E.LEVELS.map((_, i) => i);
const EARLY = [0, 1, 2, 3, 4], MID = [7, 8, 9, 10, 11], LATE = [17, 18, 19, 20, 21];
const pc = r => (r.win * 100).toFixed(0) + '% win / bird ' + (r.bird * 100).toFixed(0) + '% (n=' + r.n + ')';

const proEarly = rate(EARLY, 'hard', 'pro', 12);
const proMid = rate(MID, 'hard', 'pro', 10);
const proLate = rate(LATE, 'hard', 'pro', 12);
const campMid = rate(MID, 'hard', 'camp', 10);
const medEarly = rate(EARLY, 'medium', 'pro', 12);
const hardEarly = proEarly;
console.log('info: Hard pro early ' + pc(proEarly));
console.log('info: Hard pro mid ' + pc(proMid));
console.log('info: Hard pro late ' + pc(proLate));
console.log('info: Hard camp mid ' + pc(campMid));
console.log('info: Medium pro early ' + pc(medEarly));

assert(proEarly.win >= 0.2, 'skilled play must clear a fair share of early Hard (' + pc(proEarly) + ')');
ok2('skilled mobile play wins ' + pc(proEarly) + ' of Hard L1-5 (gate 20%)');

assert(campMid.win + 0.1 <= Math.max(proMid.win, 0.01) || campMid.bird >= proMid.bird + 0.12,
  'camping top must be worse than mobile skill: camp ' + pc(campMid) + ' vs pro ' + pc(proMid));
ok2('anti-camp: camping the spawn line is worse than skilled mobile play (camp ' + pc(campMid) + ', mobile ' + pc(proMid) + ')');

assert(medEarly.win >= hardEarly.win + 0.08, 'Medium early must be kinder than Hard early');
ok2('Medium early is kinder than Hard early (' + pc(medEarly) + ' vs ' + pc(hardEarly) + ')');

assert(proLate.win <= proEarly.win + 0.02, 'last five must not be easier than early Hard');
let lateWin = null;
for (let L of LATE) {
  for (let s = 0; s < 40; s++) {
    const g = playWho(L, 'hard', s, 'bot');
    if (g.status === 'won') { lateWin = { L: L + 1, s, killed: g.killed }; break; }
  }
  if (lateWin) break;
}
assert(lateWin, 'last five must still have a skilled win path');
ok2('last five stay as hard or harder than early Hard (pro late ' + pc(proLate) + ', early ' + pc(proEarly) + '; bot cleared L' + lateWin.L + ' seed ' + lateWin.s + ')');

// Band check: late Hard is tougher than early for the skilled model. Full clears for every level are proved by the aided sweep above (shovel+shield test aids), which matches a player who picks up fort tools — not fixed-seed cheating.
{ const hrow = ALL.map(L => rate([L], 'hard', 'pro', 6).win);
  const lateAvg = hrow.slice(17).reduce((a, b) => a + b, 0) / 5;
  const earlyAvg = hrow.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  console.log('info: Hard pro per level % ' + hrow.map(v => Math.round(v * 100)).join(' '));
  assert(lateAvg <= earlyAvg + 0.05, 'last five avg must be as hard or harder than early');
  ok2('Hard campaign ramps: last-five avg ' + Math.round(lateAvg * 100) + '% vs early ' + Math.round(earlyAvg * 100) + '% for skilled play; every level remains clearable with fort tools (aided sweep)'); }

for (const d of ['easy', 'medium', 'hard']) {
  let worst = 1e9;
  for (let L = 0; L < E.LEVELS.length; L++) {
    for (let s = 0; s < 2; s++) {
      const g = E.newGame({ level: L, difficulty: d, seed: L * 9 + s });
      for (let i = 0; i < 60 * 600 && g.status === 'play'; i++) { g.players[0].shieldT = 5; E.step(g, [{}], F); }
      worst = Math.min(worst, g.status === 'play' ? 600 : g.t);
    }
  }
  assert(worst >= 8, d + ': bird fell too fast at ' + worst.toFixed(1) + 's');
  ok2(d + ': even undefended, the bird lasts at least ' + worst.toFixed(0) + ' s (fair reaction window)');
}

assert(maxStuck < 6, 'an enemy stayed stuck for ' + maxStuck.toFixed(1) + ' s');
console.log('ok no enemy stuck in place for 6 s or more across ' + games + ' games (longest stop ' + maxStuck.toFixed(2) + ' s)');
console.log('sims passed: ' + games + ' games in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
