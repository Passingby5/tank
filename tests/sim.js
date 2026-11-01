// Headless sims of many games. Run: node tests/sim.js
const assert = require('assert'), E = require('../src/engine.js'), { makeBot } = require('./bot.js');
const F = 1 / 60; let maxStuck = 0, games = 0, t0 = Date.now();
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
// bot without aids, for information on fairness
let wins = { easy: 0, medium: 0, hard: 0 }, tries = 0;
for (const diff of ['easy', 'medium', 'hard']) for (let L = 0; L < E.LEVELS.length; L += 3) { const g = play(L, diff, 7 + L, 'bot'); if (diff === 'easy') tries++; if (g.status === 'won') wins[diff]++; }
console.log('info: plain bot (no aids) wins ' + wins.easy + '/' + tries + ' Easy, ' + wins.medium + '/' + tries + ' Medium, ' + wins.hard + '/' + tries + ' Hard sample levels');
const med = d => { const ts = []; for (let L = 0; L < E.LEVELS.length; L++) { const g = play(L, d, 300 + L, 'idle'); ts.push(g.status === 'play' ? 400 : g.t); } ts.sort((a, b) => a - b); return ts[ts.length >> 1]; };
const sw = {}; for (const d of ['easy', 'medium', 'hard']) { sw[d] = 0; for (let L = 0; L < E.LEVELS.length; L++) if (play(L, d, 50 + L, 'shield').status === 'won') sw[d]++; }
assert(sw.easy >= 12 && sw.easy > sw.medium && sw.medium >= sw.hard, 'bird defense ' + JSON.stringify(sw));
console.log('ok bird defense: a bot with only a shield (the bird is NOT protected) defends and wins ' + sw.easy + '/22 Easy, ' + sw.medium + '/22 Medium, ' + sw.hard + '/22 Hard');
const md = { easy: med('easy'), medium: med('medium'), hard: med('hard') };
assert(md.easy > md.medium && md.medium > md.hard, 'difficulty order ' + JSON.stringify(md));
console.log('ok difficulty order: an undefended bird lasts ' + md.easy.toFixed(0) + ' s on Easy, ' + md.medium.toFixed(0) + ' s on Medium, ' + md.hard.toFixed(0) + ' s on Hard (median)');
// 13. no stuck enemies
assert(maxStuck < 6, 'an enemy stayed stuck for ' + maxStuck.toFixed(1) + ' s');
console.log('ok no enemy stuck in place for 6 s or more across ' + games + ' games (longest stop ' + maxStuck.toFixed(2) + ' s)');
console.log('sims passed: ' + games + ' games in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
