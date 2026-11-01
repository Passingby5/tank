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
{ const hp = {}; for (const d of ['easy', 'medium', 'hard']) { const g = E.newGame({ level: 0, difficulty: d }); for (const c of E.FORT) g.map[c[1]][c[0]] = 0; g.spawnT = 999; g.shovelT = 0; let n = 0;
    while (g.status === 'play' && n < 9) { const e = enemy(g, 'b', 6, 9, 'd'); E.fire(g, e, 9, false, 1); g.enemies = []; run(g, 0.5); n++; } hp[d] = n; }
  assert.deepStrictEqual(hp, { easy: 3, medium: 2, hard: 2 }); ok('the bird takes 3 hits on Easy, 2 on Medium and Hard'); }
// 8. counts and spawning
for (const [d, cnt, max] of [['easy', 15, 2], ['medium', 18, 3], ['hard', 20, 4]]) {
  const g = E.newGame({ level: 3, difficulty: d, seed: 4 }); assert.strictEqual(g.queue.length, cnt); let peak = 0; const gates = new Set();
  for (let i = 0; i < 60 * 60; i++) { g.players[0].shieldT = 5; E.step(g, idle, F); g.events.forEach(ev => { if (ev.t === 'spawn' && ev.y < 1) gates.add(ev.x); }); peak = Math.max(peak, g.enemies.filter(e => e.alive).length); if (i % 300 === 299) { const a = g.enemies.find(e => e.alive && !e.spawning); if (a) E.killEnemy(g, a, null); } if (g.status !== 'play') break; }
  assert(peak <= max && peak >= Math.min(max, 2), d + ' peak ' + peak); assert.strictEqual(gates.size, 3, 'uses 3 gates');
}
ok('enemy count is 15 / 18 / 20 by difficulty, at most 2 / 3 / 4 alive, spawned from 3 gates');
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
  const h = E.newGame({ level: 0, difficulty: 'easy' }); assert(h.shovelT >= 89 && h.map[22][12] === E.STEEL); E.applyPower(h, h.players[0], 'shovel'); assert(h.shovelT >= 89, 'shovel does not shorten the Easy fort'); assert(E.newGame({ level: 0, difficulty: 'hard' }).shovelT >= 41); ok('fort pieces are never rebuilt under a tank; the fort starts as steel (Easy 90 s, Medium 45 s, Hard 42 s) and a shovel never shortens it'); }
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
  const st = mem(); let d = S.read(st, 22); assert.strictEqual(d.run, null);
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
console.log(n + ' unit tests passed');
