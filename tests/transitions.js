// State-transition matrix: Pause/Resume/lose/Try Again, Restart, Home/Continue/reload, Next, mixed.
// Verifies no replayed score/Best farming; legitimate previous-level points preserved.
const assert = require('assert'), { boot } = require('./ui-harness.js'), { makePro } = require('./players.js');
const clone = o => JSON.parse(JSON.stringify(o));
let n = 0; const ok = m => { n++; console.log('ok', m); };

function resources(g) { return g.players.map(p => ({ lives: p.lives, tier: p.tier, score: p.score })); }
function same(a, b, msg) { assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg); }
function forceLose(b) {
  const g = b.g(), E = b.E;
  E.FORT.forEach(c => g.map[c[1]][c[0]] = 0); g.mapVer++; g.birdHp = 1; g.spawnT = 999;
  g.enemies = [{ id: 77, kind: 'enemy', type: 'b', x: 6, y: 10.6, dir: 'd', hp: 1, maxHp: 1, alive: true, spawning: 0, spawnSafe: 99, bonus: false, think: 99, cool: 99, stuckT: 0, lx: 6, ly: 10.6, tread: 0, hitT: 0 }];
  g.players[0].x = 1; g.players[0].y = 1;
  E.fire(g, g.enemies[0], 9, false, 1);
  for (let i = 0; i < 60 * 5 && g.status === 'play'; i++) E.step(g, [{}], 1 / 60);
  assert.strictEqual(g.status, 'lost');
  g.endT = 2; b.frame(); b.frame();
}

// --- R7-1: Pause → Resume → lose → Try Again must NOT bank mid score into entry ---
{
  const b = boot(); b.click('diff', 'hard'); b.click('play');
  const entry0 = clone(b.state().save.run.entry);
  assert.strictEqual(entry0[0].score, 0);
  const g = b.g(); g.players[0].score = 1200; g.players[0].lives = 4; g.players[0].tier = 2;
  b.click('pause');
  assert.strictEqual(b.state().save.run.carry[0].score, 1200);
  same(b.state().save.run.entry, entry0, 'pause must not mutate entry');
  b.click('resume');
  forceLose(b);
  assert.strictEqual(b.state().save.run.snap, null);
  assert.strictEqual(b.state().save.run.carry[0].score, 0, 'loss resets carry score to entry');
  assert.strictEqual(b.state().save.run.carry[0].lives, 6);
  assert.strictEqual(b.state().save.run.carry[0].tier, 0);
  same(b.state().save.run.entry, entry0, 'loss must not mutate entry');
  const bestAfterLoss = b.state().save.best;
  b.click('retry');
  assert.strictEqual(b.g().players[0].score, 0);
  assert.strictEqual(b.g().players[0].lives, 6);
  assert.strictEqual(b.g().players[0].tier, 0);
  assert.strictEqual(b.state().save.run.entry[0].score, 0);
  assert.strictEqual(b.state().save.best, bestAfterLoss);
  ok('Pause→Resume→lose→Try Again keeps entry score 0 (no mid-carry bank)');
}

// --- Repeated loss/retry with pause mixed (20 cycles) ---
{
  const b = boot(); b.click('diff', 'hard'); b.click('play');
  const ceiling = b.g().queue.reduce((n, t) => n + b.E.TYPES[t].score, 0) + 1500;
  for (let i = 0; i < 20; i++) {
    const g = b.g();
    g.players[0].score = b.state().save.run.entry[0].score + 100 + i; // mid earn
    b.click('pause'); b.click('resume');
    forceLose(b);
    b.click('retry');
    assert.strictEqual(b.g().players[0].score, 0, 'cycle ' + i);
    assert.strictEqual(b.state().save.run.entry[0].score, 0);
  }
  assert.ok(b.state().save.best <= ceiling, 'best ' + b.state().save.best + ' <= ' + ceiling);
  ok('20 pause/lose/retry cycles never raise entry; Best ≤ L1 ceiling ' + ceiling);
}

// --- Home→Continue after loss uses retry baseline, not mid carry ---
{
  const b = boot(); b.click('play');
  b.g().players[0].score = 800;
  b.click('pause'); b.click('resume');
  forceLose(b);
  b.click('home');
  b.click('continue');
  assert.strictEqual(b.g().players[0].score, 0);
  assert.strictEqual(b.g().players[0].lives, 6);
  assert.strictEqual(b.state().save.run.entry[0].score, 0);
  ok('Home→Continue after loss starts from entry score with full lives');
}

// --- Restart still rolls to entry (lives/tier/score) ---
{
  const b = boot(); b.click('play');
  const entry = clone(b.state().save.run.entry);
  b.g().players[0].score = 900; b.g().players[0].lives = 3; b.g().players[0].tier = 2;
  b.click('pause'); b.click('restart');
  same(resources(b.g()), entry);
  ok('Restart Level restores immutable entry resources');
}

// --- Legitimate previous-level points preserved across Next and later retry ---
{
  const b = boot(); b.click('diff', 'hard'); b.click('play');
  // Natural-ish L1 clear via emptying enemies
  const g = b.g(); g.spawned = g.queue.length; g.enemies = []; g.players[0].score = 2400; g.players[0].lives = 5;
  for (let i = 0; i < 5 && g.status === 'play'; i++) b.E.step(g, [{}], 1 / 60);
  assert.strictEqual(g.status, 'won'); g.endT = 2; b.frame(); b.frame();
  assert.strictEqual(b.state().save.run.level, 1);
  assert.strictEqual(b.state().save.run.entry[0].score, 2400);
  b.click('next');
  assert.strictEqual(b.g().level, 1);
  assert.strictEqual(b.g().players[0].score, 2400);
  assert.strictEqual(b.state().save.run.entry[0].score, 2400);
  // Mid L2 earn, pause, lose, retry — must keep 2400
  b.g().players[0].score = 2400 + 700;
  b.click('pause'); b.click('resume');
  forceLose(b);
  b.click('retry');
  assert.strictEqual(b.g().players[0].score, 2400);
  assert.strictEqual(b.g().players[0].lives, 6);
  assert.strictEqual(b.state().save.run.entry[0].score, 2400);
  ok('Next carries legitimate L1 score; L2 lose/retry preserves 2400 entry');
}

// --- Continue mid-pause still resumes mid progress (legitimate) ---
{
  const b = boot(); b.click('play');
  b.g().players[0].score = 500; b.g().killed = 2; b.g().spawned = Math.max(b.g().spawned, 3);
  b.click('pause');
  const mid = resources(b.g());
  const entry = clone(b.state().save.run.entry);
  b.click('home'); b.click('continue');
  same(resources(b.g()), mid);
  same(b.state().save.run.entry, entry);
  ok('Pause→Home→Continue resumes mid-level without changing entry');
}

// --- Reload preserves entry vs carry ---
{
  const b = boot(); b.click('play');
  b.g().players[0].score = 400;
  b.click('pause');
  const raw = b.mem.tank_save;
  const entry = clone(b.state().save.run.entry);
  const mid = clone(b.state().save.run.carry);
  const r = boot(raw);
  r.click('continue');
  same(r.state().save.run.entry, entry);
  same(resources(r.g()), mid);
  ok('reload+Continue keeps entry checkpoint and mid snap resources');
}

// --- New Game clears farmed state ---
{
  const b = boot(); b.click('play');
  b.g().players[0].score = 999; b.click('pause'); b.click('home');
  b.click('play');
  assert.strictEqual(b.g().players[0].score, 0);
  assert.strictEqual(b.state().save.run.entry[0].score, 0);
  ok('Play (new game) starts fresh entry at 0');
}

console.log(n + ' transition tests passed');
