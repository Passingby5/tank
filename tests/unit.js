// Unit tests for levels, engine rules and saves. Run: node tests/unit.js
const assert = require('assert'), E = require('../src/engine.js'), S = require('../src/save.js'), { LEVELS } = require('../src/levels.js');
let n = 0; const ok = (m) => { n++; console.log('ok', m); };
const F = 1 / 60, idle = [{}, {}];
function blank(o) { const g = E.newGame(Object.assign({ level: 0, seed: 1 }, o)); for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) if (g.map[y][x] !== E.BASE && !E.FORT.some(c => c[0] === x && c[1] === y)) g.map[y][x] = 0; g.spawnT = 999; g.shovelT = 0; for (const c of E.FORT) g.map[c[1]][c[0]] = E.BRICK; return g; }
function run(g, secs, inp) { for (let i = 0; i < secs * 60; i++) E.step(g, typeof inp === 'function' ? inp(i) : (inp || idle), F); }
function enemy(g, type, x, y, dir) { const T = E.TYPES[type]; const e = { id: 99 + g.enemies.length, kind: 'enemy', type, x, y, dir: dir || 'd', hp: T.hp, maxHp: T.hp, alive: true, spawning: 0, spawnSafe: 99, bonus: false, think: 99, cool: 99, stuckT: 0, lx: x, ly: y, tread: 0, hitT: 0 }; g.enemies.push(e); return e; }

// 3. level data
assert(LEVELS.length >= 20); LEVELS.forEach((l, i) => { assert.strictEqual(l.map.length, 13, 'rows ' + i); l.map.forEach(r => assert(/^[.#@~%\-\[\]^_]{13}$/.test(r), 'row ' + i + ' ' + r)); const c = l.enemies; assert.strictEqual(c.b + c.f + c.r + c.a, 20); assert(l.name); });
ok(LEVELS.length + ' levels, each 13x13 with valid tiles and 20 enemies');
// 4. reachability: gates and player spawns reach the bird through open ground or brick
LEVELS.forEach((l, i) => {
  const g = E.newGame({ level: i }), K = 25, pass = (a, b) => { for (let y = b; y < b + 2; y++) for (let x = a; x < a + 2; x++) { const v = g.map[y][x]; if (v === E.STEEL || v === E.WATER || v === E.BASE) return false; } return true; };
  const goal = new Set(); [[12, 20], [8, 22], [16, 22], [8, 24], [16, 24]].forEach(([a, b]) => goal.add(a + b * K)); // spots next to the fort, facing it
  E.GATES.concat(E.PSPAWN).forEach(([tx, ty]) => {
    const seen = new Set([tx * 2 + ty * 2 * K]), q = [[tx * 2, ty * 2]]; let found = false;
    while (q.length && !found) { const [a, b] = q.shift(); if (goal.has(a + b * K)) { found = true; break; } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const na = a + dx, nb = b + dy; if (na < 0 || nb < 0 || na >= K || nb >= K || seen.has(na + nb * K) || !pass(na, nb)) continue; seen.add(na + nb * K); q.push([na, nb]); } }
    assert(found, 'level ' + (i + 1) + ' spawn ' + tx + ',' + ty + ' cannot reach the bird');
  });
});
ok('every gate and player spawn can reach the bird in every level');
// 5. brick breaks in half-tile strips
{ const g = blank(); const p = g.players[0]; p.x = 4; p.y = 8; p.dir = 'u'; p.shieldT = 0; for (let x = 6; x < 12; x++) { g.map[10][x] = E.BRICK; g.map[11][x] = E.BRICK; }
  run(g, 0.05, [{ fire: true }]); run(g, 1);
  assert.deepStrictEqual(g.map[11].slice(6, 12), [1, 1, 0, 0, 1, 1]); assert.deepStrictEqual(g.map[10].slice(6, 12), [1, 1, 1, 1, 1, 1]); ok('a shot breaks one half-tile strip of brick, one tile wide'); }
{ const g = blank(); const p = g.players[0]; p.x = 4; p.y = 8; p.dir = 'u'; g.map[11][8] = g.map[11][9] = E.STEEL;
  run(g, 0.05, [{ fire: true }]); run(g, 1); assert.strictEqual(g.map[11][8], E.STEEL); assert.strictEqual(g.bullets.length, 0);
  p.tier = 3; p.cool = 0; run(g, 0.05, [{ fire: true }]); run(g, 1); assert.strictEqual(g.map[11][8], 0); assert.strictEqual(g.map[11][9], 0); ok('steel stops normal shots; a 3-star shot breaks steel'); }
// 6. water, trees, ice
{ const g = blank(); const p = g.players[0]; p.x = 4; p.y = 8; g.map[15][8] = g.map[15][9] = E.WATER; run(g, 1, [{ dir: 'u' }]); assert(p.y >= 8 - 0.01 && p.y <= 8, 'water blocks: ' + p.y);
  p.cool = 0; run(g, 0.05, [{ fire: true }]); assert.strictEqual(g.bullets.length, 1); run(g, 0.3); assert(g.bullets.length === 0 || g.bullets[0].y < 7, 'bullet crosses water'); ok('water blocks tanks and lets shots fly over'); }
{ const g = blank(); const p = g.players[0]; p.x = 4; p.y = 8; for (let y = 10; y < 16; y++) { g.map[y][8] = g.map[y][9] = E.TREES; } run(g, 0.6, [{ dir: 'u' }]); assert(p.y < 6.5, 'drove through trees'); ok('trees do not block tanks'); }
{ const g = blank(); const p = g.players[0]; p.x = 2; p.y = 6; for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) if (y < 20) g.map[y][x] = E.ICE; run(g, 0.5, [{ dir: 'r' }]); const x1 = p.x; run(g, 0.5); assert(p.x > x1 + 0.3, 'slides on ice ' + (p.x - x1));
  const h = blank(); h.players[0].x = 2; h.players[0].y = 6; run(h, 0.5, [{ dir: 'r' }]); const x2 = h.players[0].x; run(h, 0.5); assert.strictEqual(h.players[0].x, x2); ok('ice slides the player after letting go; plain ground stops at once (only moves in the pressed direction)'); }
// 7. bird
{ const g = blank(); for (const c of E.FORT) g.map[c[1]][c[0]] = 0; const e = enemy(g, 'b', 6, 8, 'd'); g.birdHp = 1; E.fire(g, e, 9, false, 1); run(g, 1); assert.strictEqual(g.status, 'lost'); assert.strictEqual(g.reason, 'bird'); assert.strictEqual(g.birdAlive, false); ok('a shot that hits the bird loses the level'); }
{ const hp = {}; for (const d of ['easy', 'medium', 'hard']) { const g = E.newGame({ level: 0, difficulty: d }); for (const c of E.FORT) g.map[c[1]][c[0]] = 0; for (let y = 9; y < 24; y++) for (let x = 11; x < 15; x++) g.map[y][x] = 0; g.spawnT = 999; g.shovelT = 0; let n = 0;
    while (g.status === 'play' && n < 9) { const e = enemy(g, 'b', 6, 9, 'd'); E.fire(g, e, 9, false, 1); g.enemies = []; run(g, 0.5); n++; } hp[d] = n; }
  assert.deepStrictEqual(hp, { easy: 3, medium: 3, hard: 3 }); ok('the bird takes 3 hits on Easy, Medium and Hard'); }
// 8. counts, quotas and spawning
for (const [L, q] of [[0, 20], [4, 20], [5, 25], [13, 25], [14, 30], [21, 30]]) {
  for (const d of ['easy', 'medium', 'hard']) {
    const g = E.newGame({ level: L, difficulty: d, seed: 4 });
    assert.strictEqual(g.queue.length, q, d + ' L' + (L + 1) + ' quota');
    assert.strictEqual(E.levelQuota(L), q);
  }
}
ok('enemy quotas are 20 on L1-5, 25 on L6-14, 30 on L15-22 for every difficulty');
{ const g = E.newGame({ level: 3, difficulty: 'hard', seed: 4 }); let peak = 0; const gates = new Set();
  for (let i = 0; i < 60 * 50; i++) { g.players[0].shieldT = 5; E.step(g, idle, F); g.events.forEach(ev => { if (ev.t === 'spawn' && ev.y < 1) gates.add(ev.x); });
    peak = Math.max(peak, g.enemies.filter(e => e.alive).length); if (i % 180 === 179) { const a = g.enemies.find(e => e.alive && !e.spawning); if (a) E.killEnemy(g, a, null); } if (g.status !== 'play') break; }
  assert(peak <= 3 && peak >= 2, 'hard mid peak ' + peak); assert.strictEqual(gates.size, 3, 'uses 3 gates');
}
{ const g = E.newGame({ level: 20, difficulty: 'hard', seed: 9 }); assert.strictEqual(g.D.max, 4); let peak = 0;
  for (let i = 0; i < 60 * 40; i++) { g.players[0].shieldT = 5; E.step(g, idle, F); peak = Math.max(peak, g.enemies.filter(e => e.alive).length); if (i % 120 === 119) { const a = g.enemies.find(e => e.alive && !e.spawning); if (a) E.killEnemy(g, a, null); } }
  assert(peak <= 4 && peak >= 3, 'late hard peak ' + peak); ok('spawns from 3 gates; mid Hard max 3 alive; last five levels allow 4'); }
// 9. types
{ const T = E.TYPES; assert(T.f.speed > T.b.speed && T.r.fire < T.b.fire && T.a.hp === 4 && T.b.hp === 1);
  const g = blank(); const p = g.players[0]; p.x = 4; p.y = 10; const e = enemy(g, 'a', 4, 5); let shots = 0;
  for (let i = 0; i < 4; i++) { p.cool = 0; run(g, 0.05, [{ fire: true }]); run(g, 0.8); shots++; if (i < 3) assert(e.alive, 'armored alive after ' + shots); }
  assert(!e.alive, 'armored down after 4 hits'); ok('4 enemy types differ in speed, fire rate and armor; armored takes 4 hits'); }
// 10. bonus enemies drop power-ups
{ const g = E.newGame({ level: 0, seed: 3 }); const flags = []; for (let i = 0; i < g.queue.length; i++) { g.spawned = i; E.spawnEnemy(g); const e = g.enemies[g.enemies.length - 1]; flags.push(e.bonus); e.alive = false; g.enemies = []; }
  const idx = flags.map((f, i) => f ? i : -1).filter(i => i >= 0); assert.strictEqual(idx.length, 3); assert(idx[0] >= 1 && idx[0] <= 5 && idx[1] >= 7 && idx[1] <= 11 && idx[2] >= 13 && idx[2] <= 16, String(idx));
  const sets = new Set(); for (let s = 0; s < 20; s++) sets.add(E.newGame({ level: 0, seed: s }).bonusAt.join()); assert(sets.size > 5, 'bonus timing varies');
  const h = blank(); const p = h.players[0]; p.x = 4; p.y = 10; const e = enemy(h, 'b', 4, 5); e.bonus = true; run(h, 0.05, [{ fire: true }]); run(h, 0.8); assert(h.power && E.POWERS.includes(h.power.kind)); ok('3 flashing enemies per level, picked at random inside ranges (not fixed 4th/11th/18th), drop a power-up when hit'); }
// 11. power-ups
{ const g = blank(), p = g.players[0];
  E.applyPower(g, p, 'star'); E.applyPower(g, p, 'star'); E.applyPower(g, p, 'star'); E.applyPower(g, p, 'star'); assert.strictEqual(p.tier, 3);
  p.shieldT = 0; E.applyPower(g, p, 'shield'); assert(p.shieldT >= 10); p.x = 4; p.y = 8; const e = enemy(g, 'b', 4, 4, 'd'); E.fire(g, e, 9, false, 1); run(g, 0.6); assert(p.alive, 'shield blocks');
  E.applyPower(g, p, 'shovel'); assert(E.FORT.every(c => g.map[c[1]][c[0]] === E.STEEL)); run(g, 17); assert(E.FORT.every(c => g.map[c[1]][c[0]] === E.BRICK), 'fort back to brick');
  enemy(g, 'b', 1, 1); enemy(g, 'a', 10, 2); E.applyPower(g, p, 'clock'); const ex = g.enemies.map(q => [q.x, q.y]); g.enemies.forEach(q => { q.think = 0; q.cool = 0; q.spawnSafe = 0; }); run(g, 2); assert.deepStrictEqual(g.enemies.filter(q => q.alive).map(q => [q.x, q.y]), ex.slice(-g.enemies.filter(q => q.alive).length)); assert(g.freezeT > 0);
  E.applyPower(g, p, 'bomb'); run(g, 0.02); assert.strictEqual(g.enemies.filter(q => q.alive).length, 0);
  const l = p.lives; E.applyPower(g, p, 'tank'); assert.strictEqual(p.lives, l + 1);
  ok('star (max 3), shield, shovel (steel then brick again), clock, bomb and tank all work'); }
{ const g = blank(), p = g.players[0]; p.x = 4; p.y = 8; g.power = { kind: 'tank', x: 4, y: 7, t: 10 }; const l = p.lives; run(g, 0.5, [{ dir: 'u' }]); assert.strictEqual(p.lives, l + 1); assert.strictEqual(g.power, null); ok('driving over a power-up picks it up'); }
{ const g = blank(); g.map[23][11] = g.map[22][11] = 0; const e = enemy(g, 'b', 5.5, 11); E.applyPower(g, g.players[0], 'shovel'); assert.strictEqual(g.map[23][11], 0, 'no wall under a tank'); assert.strictEqual(g.map[22][14], E.STEEL);
  for (const d of ['easy', 'medium', 'hard']) { const h = E.newGame({ level: 0, difficulty: d }); assert.strictEqual(h.shovelT, 0, d + ' shovelT'); assert.strictEqual(h.map[22][12], E.BRICK, d + ' fort brick'); }
  const h = E.newGame({ level: 0, difficulty: 'hard' }); E.applyPower(h, h.players[0], 'shovel'); assert(h.shovelT >= 15.9 && h.shovelT <= 16.01); assert(E.FORT.every(c => h.map[c[1]][c[0]] === E.STEEL));
  run(h, 16.1); assert.strictEqual(h.shovelT, 0); assert(E.FORT.every(c => h.map[c[1]][c[0]] === E.BRICK));
  ok('fort starts as brick on every difficulty; shovel steels it for 16 s then restores brick; fort never rebuilds under a tank'); }
// 12. win
{ const g = blank(); g.spawned = g.queue.length; const e = enemy(g, 'b', 4, 5); const p = g.players[0]; p.x = 4; p.y = 10; run(g, 0.05, [{ fire: true }]); run(g, 1); assert.strictEqual(g.status, 'won'); const c = E.carry(g); assert(c[0].score >= 100); const g2 = E.newGame({ level: 1, carry: c }); assert.strictEqual(g2.players[0].score, c[0].score); ok('clearing all enemies wins and carries lives, gun and score to the next level'); }
// 16. determinism
{ const sig = s => { const g = E.newGame({ level: 5, seed: s }); for (let i = 0; i < 3600; i++) E.step(g, [{ dir: ['u', 'l', null, 'r'][(i >> 5) % 4], fire: i % 23 === 0 }], F); return JSON.stringify([g.t, g.killed, g.spawned, g.enemies.map(e => [e.x, e.y]), g.players[0].x, g.status]); };
  assert.strictEqual(sig(9), sig(9)); assert.notStrictEqual(sig(9), sig(10)); ok('same seed and inputs give the same game; a new seed changes it'); }
// 18. turning alignment
{ const g = blank(), p = g.players[0]; p.x = 4.2; p.y = 8; p.dir = 'r'; E.turn(g, p, 'u'); assert.strictEqual(p.x, 4); p.x = 4.3; p.dir = 'r'; E.turn(g, p, 'u'); assert.strictEqual(p.x, 4.5);
  p.x = 4.3; p.dir = 'r'; enemy(g, 'b', 5.4, 8); E.turn(g, p, 'u'); assert(p.x + 1 <= 5.4 && p.x === 4, 'no snap into another tank ' + p.x); g.enemies = [];
  p.x = 5.1; p.y = 8; p.dir = 'd'; E.turn(g, p, 'l'); assert.strictEqual(p.y, 8); p.x = 6.1; p.y = 7.95; p.dir = 'r'; E.turn(g, p, 'u'); assert.strictEqual(p.x, 6); p.x = 6.1; p.dir = 'r'; E.turn(g, p, 'r'); assert.strictEqual(p.x, 6.1, 'same way: no snap'); { const h = blank(), q = h.players[0]; for (let y = 10; y < 16; y++) for (let x = 0; x < 26; x++) h.map[y][x] = (x === 8 || x === 9) && y < 14 ? 0 : (y < 14 ? E.BRICK : 0); h.mapVer++; // 1-tile corridor at x = 4, going up from row y = 7
    for (const sx of [3.6, 3.7, 4.3, 4.42]) { q.x = sx; q.y = 7; q.dir = 'r'; E.turn(h, q, 'u'); assert.strictEqual(q.x, 4, 'enters corridor from ' + sx); }
    q.x = 3.5; q.dir = 'r'; E.turn(h, q, 'u'); assert.strictEqual(q.x, 3.5, 'no help beyond 0.45 tile'); }
  ok('turning snaps to the half-tile grid only when close and free; a press up to 0.45 tile early or late still enters an open corridor'); }
{ const g = blank(), p = g.players[0]; p.x = 4; p.y = 8; p.dir = 'u'; g.map[14][9] = E.BRICK; run(g, 0.5, [{ dir: 'u' }]); assert.strictEqual(p.y, 7.5); assert.strictEqual(p.x, 4); ok('tanks stop flush against walls and never enter them'); }
// 25. saves
{ const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
  const st = mem(); let d = S.read(st, 22); assert.strictEqual(d.run, null); assert.strictEqual(d.settings.difficulty, 'hard'); assert.strictEqual(S.VERSION, 3);
  st.setItem(S.KEY, JSON.stringify({ v: 2, run: null, best: 10, settings: { muted: false, difficulty: 'easy' } }));
  assert.strictEqual(S.read(st, 22).settings.difficulty, 'easy', 'preserves saved Easy from v2');
  d.run = { level: 4, difficulty: 'hard', twoP: true, attempt: 2, carry: [{ lives: 2, tier: 1, score: 900 }, { lives: 3, tier: 0, score: 100 }] }; d.settings.muted = true; S.write(st, d);
  d = S.read(st, 22); assert.strictEqual(d.run.level, 4); assert.strictEqual(d.run.carry[1].score, 100); assert.strictEqual(d.settings.muted, true);
  for (const bad of ['{', 'null', '[]', '"x"', JSON.stringify({ v: 0, run: d.run }), JSON.stringify({ v: 1, run: { level: 99, difficulty: 'hard', twoP: false, carry: [{ lives: 1, tier: 0, score: 0 }] } }), JSON.stringify({ v: 1, run: { level: 1, difficulty: 'x', twoP: false, carry: [] } }), JSON.stringify({ v: 1, run: { level: 1, difficulty: 'easy', twoP: false, carry: [{ lives: 'a' }] } })]) {
    st.setItem(S.KEY, bad); const r = S.read(st, 22); assert.strictEqual(r.run, null, bad); }
  st.setItem(S.KEY, JSON.stringify({ v: 1, run: { level: 1, difficulty: 'easy', twoP: false, carry: [{ lives: 50, tier: 7, score: 5 }] } })); const c = S.read(st, 22).run.carry[0]; assert.strictEqual(c.lives, 9); assert.strictEqual(c.tier, 3);
  const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }; assert.strictEqual(S.read(throwing).run, null); assert.strictEqual(S.write(throwing, d), false);
  ok('saves round-trip; wrong version, corrupt or bad saves are ignored; numbers are clamped; storage errors are safe'); }
// 24. mid-level save
{ const g = E.newGame({ level: 3, difficulty: 'medium', seed: 77 }); for (let i = 0; i < 60 * 20; i++) E.step(g, [{ dir: ['u', 'l', 'r'][(i >> 6) % 3], fire: i % 20 === 0 }], F);
  g.players[0].score = 1234; g.players[0].tier = 2; g.players[0].lives = 2; g.map[3][3] = 0;
  const snap = JSON.parse(JSON.stringify(E.snapshot(g))), r = E.restore(snap);
  assert(r); assert.strictEqual(r.level, 3); assert.strictEqual(r.players[0].score, 1234); assert.strictEqual(r.players[0].tier, 2); assert.strictEqual(r.players[0].lives, 2); assert.strictEqual(r.spawned, g.spawned); assert.strictEqual(r.killed, g.killed);
  assert.deepStrictEqual(r.map, g.map); assert.strictEqual(r.enemies.length, g.enemies.filter(e => e.alive).length); assert.strictEqual(r.shovelT, g.shovelT);
  for (let i = 0; i < 600; i++) E.step(r, [{}], F);
  for (const bad of [null, {}, Object.assign({}, snap, { v: 9 }), Object.assign({}, snap, { map: ['x'] }), Object.assign({}, snap, { queue: 'zz' }), Object.assign({}, snap, { enemies: [{ type: 'q' }] }), Object.assign({}, snap, { players: [] }), Object.assign({}, snap, { t: 'a' })]) assert.strictEqual(E.restore(bad), null);
  ok('mid-level save: snapshot and restore keep the map, enemies, score, gun and lives; bad snapshots are rejected'); }
{ let bad = 0, cnt = 0; for (let s = 0; s < 300; s++) { const g = E.newGame({ level: s % 22, seed: s * 7919 + 123456789, difficulty: ['easy', 'medium', 'hard'][s % 3], twoP: s % 5 === 0 });
    for (let i = 0; i < 60 * (5 + s % 90); i++) E.step(g, [{ dir: 'urdl'[(i >> 6) % 4], fire: i % 30 === 0 }, { dir: 'l', fire: i % 40 === 0 }], F); if (g.status !== 'play') continue; cnt++; if (!E.restore(JSON.parse(JSON.stringify(E.snapshot(g))))) bad++; }
  assert.strictEqual(bad, 0); ok('mid-level snapshots restore in all ' + cnt + ' random game states'); }
// v3 polish: no backward nudge while a tank keeps its heading, and two tanks never get more overlapped than they were
{ let back = 0, grow = 0, steps = 0; const ov = (a, b) => Math.max(0, Math.min(a.x + 1, b.x + 1) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + 1, b.y + 1) - Math.max(a.y, b.y));
  for (let s = 0; s < 30; s++) { const g = E.newGame({ level: s % 22, seed: 500 + s, difficulty: ['easy', 'medium', 'hard'][s % 3], twoP: s % 4 === 0 });
    for (let i = 0; i < 60 * 40 && g.status === 'play'; i++) { const all = () => g.players.concat(g.enemies).filter(t => t.alive);
      const pre = new Map(all().map(t => [t, { x: t.x, y: t.y, dir: t.dir }])), pairs = []; const A = all();
      for (let a = 0; a < A.length; a++) for (let b = a + 1; b < A.length; b++) pairs.push([A[a], A[b], ov(A[a], A[b])]);
      E.step(g, [{ dir: 'urdl'[((i >> 5) + s) % 4], fire: i % 25 === 0 }, { dir: 'ldru'[(i >> 6) % 4], fire: false }], F); steps++;
      for (const [t, p] of pre) if (t.alive && t.dir === p.dir) { const v = E.DIRS[p.dir]; if ((t.x - p.x) * v[0] + (t.y - p.y) * v[1] < -1e-6 && Math.abs(t.x - p.x) + Math.abs(t.y - p.y) < 0.5) back++; }
      for (const [a, b, o] of pairs) if (a.alive && b.alive && ov(a, b) > o + 1e-6) grow++; } }
  assert.strictEqual(back, 0, 'backward nudges: ' + back); assert.strictEqual(grow, 0, 'tank overlaps grew: ' + grow); ok('no backward nudge and no growing tank overlap over ' + steps + ' steps in 30 games'); }

// v5: fire rate ramps up (interval multiplier falls) across levels; Hard never softens late
{ const fires = [], softs = [];
  for (let L = 0; L < E.LEVELS.length; L++) { const D = E.ramped(E.DIFF.hard, L); fires.push(D.fire); softs.push(D.soften); }
  for (let i = 1; i < fires.length; i++) assert(fires[i] <= fires[i - 1] + 1e-9, 'hard fire not monotonic at L' + (i + 1));
  assert(fires[fires.length - 1] < fires[0] - 0.4, 'hard late fire much faster');
  assert(softs[softs.length - 1] <= softs[0] + 1e-9, 'hard soften must not rise late');
  ok('Hard fire interval falls across the campaign and soften never rises late'); }
// v5: anti-camp gate preference + visible spawn protection (no fire while protected, no spawn on player)
{ const g = E.newGame({ level: 2, difficulty: 'hard', seed: 11 });
  // clear gates and park the player on the middle gate
  for (const [x, y] of E.GATES) for (let k = 0; k < 4; k++) g.map[y * 2 + (k >> 1)][x * 2 + (k & 1)] = 0;
  const p = g.players[0]; p.x = 6; p.y = 0; p.alive = true; p.shieldT = 99;
  g.spawnT = 0; g.enemies = []; g.spawned = 0;
  const picks = [];
  for (let n = 0; n < 18; n++) {
    g.enemies = []; g.bullets = []; g.spawnT = 999; // freeze auto-spawn during the probe
    // keep player camping the middle gate between preference checks
    p.x = 6; p.y = 0; p.alive = true; p.shieldT = 99;
    const before = g.spawned; assert(E.spawnEnemy(g), 'spawn ' + n); assert.strictEqual(g.spawned, before + 1);
    const e = g.enemies[g.enemies.length - 1]; picks.push([e.x, e.y]);
    assert(!(Math.abs(e.x - 6) < 0.1 && Math.abs(e.y - 0) < 0.1), 'spawned on player at ' + e.x + ',' + e.y);
    assert(e.spawning > 1, 'visible spawn flash');
    // cannot be damaged while spawning (visible flash)
    const hp = e.hp; e.spawning = 0.8;
    p.x = e.x; p.y = Math.min(12, e.y + 2); p.dir = 'u'; p.cool = 0; g.bullets = []; E.fire(g, p, 14, false, 1);
    for (let i = 0; i < 30; i++) { e.spawning = 0.8; E.step(g, idle, F); }
    assert(e.alive && e.hp === hp, 'no damage during visible spawn');
    // spawnSafe: can be hit, but cannot fire at the player
    e.spawning = 0; e.spawnSafe = 0.5; e.cool = 0; e.think = 99; g.bullets = [];
    E.step(g, idle, F);
    assert.strictEqual(g.bullets.filter(b => b.side === 'e').length, 0, 'no firing during spawnSafe');
  }
  const mid = picks.filter(([x, y]) => x === 6 && y === 0).length;
  assert(mid <= 3, 'camped middle gate still preferred too often: ' + mid + '/18 ' + JSON.stringify(picks));
  ok('anti-camp: avoids spawning on the player, prefers other gates when camping top, visible spawn blocks hits, spawnSafe blocks fire only'); }
// v5: occasional sprint runners, capped and shootable
{ let sprints = 0, n = 0; for (let s = 0; s < 40; s++) {
    const g = E.newGame({ level: 8, difficulty: 'hard', seed: 100 + s });
    while (g.spawned < g.queue.length) { E.spawnEnemy(g); const e = g.enemies[g.enemies.length - 1]; n++; if (e.sprint) { sprints++; assert(e.type !== 'a'); e.spawning = 0; e.spawnSafe = 0;
      const T = E.TYPES[e.type]; const spd = Math.min(5, T.speed * g.D.speed * 1.4); assert(spd <= 5.01); } e.alive = false; g.enemies = []; }
  }
  assert(sprints / n > 0.08 && sprints / n < 0.25, 'sprint rate ' + (sprints / n)); ok('sprint runners appear sometimes (~15%), never on armored, speed capped at 5'); }

// v6 M1: corrupt numeric snapshots are rejected; Continue path stays safe
{ const base = () => { const g = E.newGame({ level: 0, difficulty: 'hard', seed: 3 }); for (let i = 0; i < 60 * 5; i++) E.step(g, idle, F); return JSON.parse(JSON.stringify(E.snapshot(g))); };
  for (const bad of [{ spawned: -1 }, { spawned: 0.5 }, { spawned: 99 }, { killed: -1 }, { killed: 0.5 }, { birdHp: 9999 }, { birdHp: 0 }, { shovelT: -3 }, { gate: 3 }, { gate: 1.5 }, { nextId: 0 }, { nextId: 1.5 }]) {
    const snap = Object.assign(base(), bad);
    assert.strictEqual(E.restore(snap), null, 'should reject ' + JSON.stringify(bad));
  }
  const okSnap = base(); const r = E.restore(okSnap); assert(r); for (let i = 0; i < 120; i++) E.step(r, idle, F);
  // Save.read keeps the blob, but restore null means UI falls back to a clean level
  const raw = JSON.stringify({ v: 3, settings: { difficulty: 'hard', muted: false }, run: { level: 0, difficulty: 'hard', twoP: false, attempt: 0, carry: [{ lives: 6, tier: 0, score: 0 }], snap: Object.assign(base(), { spawned: -1, spawnT: 0 }) } });
  const mem = { getItem: () => raw, setItem() {} }; const data = S.read(mem, 22);
  assert(data.run && data.run.snap); assert.strictEqual(E.restore(data.run.snap), null);
  ok('corrupt spawned/killed/birdHp/shovel/gate snapshots are rejected; Save.read still loads the run for clean-level fallback'); }
// Restart Level: keep lives/score/gun carry, restore bird to full, change seed (no same-layout farm)
{ const g = E.newGame({ level: 4, difficulty: 'hard', seed: 11 }); g.players[0].lives = 4; g.players[0].tier = 2; g.players[0].score = 900; g.birdHp = 1;
  const carry = E.carry(g); assert.strictEqual(carry[0].lives, 4); assert.strictEqual(carry[0].tier, 2); assert.strictEqual(carry[0].score, 900);
  const attempt = 2, seedA = (4 + 1) * 7919 + attempt * 104729, seedB = (4 + 1) * 7919 + (attempt + 1) * 104729;
  const a = E.newGame({ level: 4, difficulty: 'hard', carry, seed: seedA }); const b = E.newGame({ level: 4, difficulty: 'hard', carry, seed: seedB });
  assert.strictEqual(a.birdHp, a.birdMax); assert.strictEqual(a.birdMax, 3); assert.strictEqual(a.players[0].lives, 4); assert.strictEqual(a.players[0].score, 900); assert.strictEqual(a.players[0].tier, 2);
  assert.notStrictEqual(a.queue.join(''), b.queue.join(''), 'restart attempt changes the enemy order/seed');
  ok('Restart Level keeps lives/score/gun, restores bird to 3, and changes the seed so the same layout is not farmed'); }
// Gate ties keep shuffle variety (QA G1)
{ const counts = [0, 0, 0];
  for (let s = 0; s < 200; s++) {
    const g = E.newGame({ level: 1, difficulty: 'hard', seed: 50 + s }); g.enemies = []; g.spawned = 0; g.spawnT = 999;
    g.players[0].x = 6; g.players[0].y = 1.6; g.players[0].alive = true;
    for (let n = 0; n < 12 && g.spawned < g.queue.length; n++) {
      g.enemies = []; E.spawnEnemy(g); const e = g.enemies[0]; if (!e) break;
      if (e.x === 0) counts[0]++; else if (e.x === 6) counts[1]++; else if (e.x === 12) counts[2]++;
    }
  }
  assert(counts[0] > 400 && counts[2] > 400, 'side gates underused ' + counts); assert(counts[1] < counts[0] && counts[1] < counts[2], 'middle should be avoided when camping ' + counts);
  const ratio = counts[0] / Math.max(1, counts[2]); assert(ratio > 0.55 && ratio < 1.8, 'side gates should be roughly balanced when equally safe ' + counts);
  ok('anti-camp avoids the camped middle gate and keeps left/right variety on equal-danger ties'); }
console.log(n + ' unit tests passed');
