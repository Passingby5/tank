// Headless sims of many games. Run: node tests/sim.js
const assert = require('assert'), E = require('../src/engine.js'), { makeBot } = require('./bot.js');
const F = 1 / 60, ok2 = m => console.log('ok', m); let maxStuck = 0, games = 0, t0 = Date.now();
function watchStuck(g, mem) {
  for (const e of g.enemies) { if (!e.alive || e.spawning) continue; const m = mem.get(e.id) || { x: e.x, y: e.y, t: 0 }; if (g.freezeT > 0 || Math.abs(m.x - e.x) + Math.abs(m.y - e.y) > 0.05) { m.x = e.x; m.y = e.y; m.t = 0; } else m.t += F; mem.set(e.id, m); if (m.t > maxStuck) maxStuck = m.t; }
}
function play(level, diff, seed, mode) {
  const g = E.newGame({ level, difficulty: diff, seed }), bot = mode === 'idle' ? null : makeBot(), mem = new Map(), aids = mode === 'aided';
  for (let i = 0; i < 60 * 400 && g.status === 'play'; i++) {
    if (mode === 'idle' || mode === 'shield') g.players[0].shieldT = 5;
    if (aids) { g.players[0].shieldT = 5; if (g.shovelT < 1) E.applyPower(g, g.players[0], 'shovel'); }
    E.step(g, [bot ? bot(g) : {}], F); watchStuck(g, mem);
  }
  games++; return g;
}
// 14. every level can be finished; the steel fort keeps the bird safe
for (const diff of ['easy', 'medium', 'hard']) for (let L = 0; L < E.LEVELS.length; L++) {
  const g = play(L, diff, 1000 + L * 31 + diff.length, 'aided');
  assert.strictEqual(g.status, 'won', diff + ' level ' + (L + 1) + ' not cleared (' + g.status + ', ' + g.killed + '/' + g.queue.length + ')'); assert(g.birdAlive);
}
console.log('ok autoplay bot (shield + steel fort aids) clears all ' + E.LEVELS.length + ' levels on Easy, Medium and Hard; the bird stayed safe in all ' + games + ' games');
// 15. enemies go for the bird when nobody defends it
let birdLost = 0, idleGames = 0;
for (let L = 0; L < E.LEVELS.length; L++) for (let s = 0; s < 3; s++) { const g = play(L, 'medium', L * 97 + s, 'idle'); idleGames++; if (g.reason === 'bird') birdLost++; }
assert(birdLost / idleGames >= 0.8, 'bird attacked in only ' + birdLost + '/' + idleGames);
console.log('ok with the player parked (shielded) and nobody defending, enemies reached and hit the bird in ' + birdLost + '/' + idleGames + ' games');
// Difficulty gates (QA v1 MAJ-1). Kid = slow, sloppy player model; Pro = dodging player model. No test aids.
const { winRate } = require('./players.js'), L5 = [0, 1, 2, 3, 4], ALL = E.LEVELS.map((_, i) => i);
const ek = winRate(L5, 'easy', 'kid', 20), ea = winRate(ALL, 'easy', 'kid', 3), mk = winRate(L5, 'medium', 'kid', 10), mp = winRate(ALL, 'medium', 'pro', 3), hp5 = winRate(L5, 'hard', 'pro', 10), hp = winRate(ALL, 'hard', 'pro', 3);
const pc = r => (r.win * 100).toFixed(0) + '% (' + r.n + ' games, bird lost ' + (r.bird * 100).toFixed(0) + '%)';
console.log('info: Easy all levels kid ' + pc(ea));
assert(ek.win >= 0.5, 'Kid must win at least 50% of Easy L1-5'); ok2('Kid player model wins ' + pc(ek) + ' of Easy L1-5 (gate 50%)');
assert(mk.win >= 0.25 && mp.win >= 0.08, 'Medium must be beatable'); ok2('Medium is beatable: kid ' + pc(mk) + ' on L1-5, pro ' + pc(mp) + ' on all levels');
// Per-level gate (QA v2 MAJ-2): the kid model wins at least 30% of every Medium level, and Easy is never harder than Medium.
{ const mrow = [], erow = []; let eSum = 0, mSum = 0;
  for (const L of ALL) { const m = winRate([L], 'medium', 'kid', 24).win, e = winRate([L], 'easy', 'kid', 24).win; mrow.push(Math.round(m * 100)); erow.push(Math.round(e * 100)); eSum += e; mSum += m;
    assert(m >= 0.3, 'Medium level ' + (L + 1) + ': kid wins only ' + pc({ win: m })); assert(e >= 0.5, 'Easy level ' + (L + 1) + ': kid wins only ' + pc({ win: e })); }
  assert(eSum > mSum, 'Easy must be kinder than Medium overall');
  console.log('info: Medium kid per level % ' + mrow.join(' ')); console.log('info: Easy kid per level % ' + erow.join(' '));
  ok2('Kid wins at least 30% of every Medium level (lowest ' + Math.min(...mrow) + '%) and at least 50% of every Easy level (lowest ' + Math.min(...erow) + '%)'); }
// QA v3: Hard ramps too. The pro model wins at least 20% of every Hard level, and Hard stays clearly the hardest.
{ const hrow = [], mrow = [], krow = [], mkrow = []; for (const L of ALL) { hrow.push(winRate([L], 'hard', 'pro', 16).win); mrow.push(winRate([L], 'medium', 'pro', 16).win); krow.push(winRate([L], 'hard', 'kid', 16).win); mkrow.push(winRate([L], 'medium', 'kid', 16).win); }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length, P = a => a.map(v => Math.round(v * 100)).join(' ');
  console.log('info: Hard pro per level % ' + P(hrow)); console.log('info: Medium pro per level % ' + P(mrow)); console.log('info: Hard kid per level % ' + P(krow));
  hrow.forEach((v, L) => assert(v >= 0.2, 'Hard level ' + (L + 1) + ': pro wins only ' + Math.round(v * 100) + '%'));
  assert(avg(hrow) <= avg(mrow) - 0.1, 'Hard must be clearly harder than Medium for the pro model'); assert(avg(krow) <= avg(mkrow) - 0.2, 'Hard must be clearly harder than Medium for the kid model');
  ok2('Hard: pro wins at least 20% of every level (lowest ' + Math.round(Math.min(...hrow) * 100) + '%), averages pro ' + Math.round(avg(hrow) * 100) + '% vs Medium ' + Math.round(avg(mrow) * 100) + '%, kid ' + Math.round(avg(krow) * 100) + '% vs Medium ' + Math.round(avg(mkrow) * 100) + '%'); }
// the bird must not fall faster than a level can possibly end (undefended, player parked with a shield)
for (const d of ['easy', 'medium', 'hard']) { const D = E.DIFF[d], minLevel = (D.count - D.max) * D.spawn; let worst = 1e9;
  for (let L = 0; L < E.LEVELS.length; L++) for (let s = 0; s < 3; s++) { const g = E.newGame({ level: L, difficulty: d, seed: L * 9 + s }); for (let i = 0; i < 60 * 600 && g.status === 'play'; i++) { g.players[0].shieldT = 5; E.step(g, [{}], F); } worst = Math.min(worst, g.status === 'play' ? 600 : g.t); }
  assert(worst >= minLevel, d + ': bird fell at ' + worst.toFixed(0) + ' s, a level needs ' + minLevel.toFixed(0) + ' s'); ok2(d + ': even undefended, the bird lasts at least ' + worst.toFixed(0) + ' s; the fastest possible level takes ' + minLevel.toFixed(0) + ' s'); }
// 13. no stuck enemies
assert(maxStuck < 6, 'an enemy stayed stuck for ' + maxStuck.toFixed(1) + ' s');
console.log('ok no enemy stuck in place for 6 s or more across ' + games + ' games (longest stop ' + maxStuck.toFixed(2) + ' s)');
console.log('sims passed: ' + games + ' games in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
