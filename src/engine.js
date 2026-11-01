// Tank rules engine. Pure logic, no DOM. Fixed steps, seeded RNG, runs the same in the browser and in Node.
(function (root) {
  var LV = (typeof module !== 'undefined' && module.exports) ? require('./levels.js') : root.TK.Levels;
  var N = 13, H = 26; // tiles, half tiles
  var EMPTY = 0, BRICK = 1, STEEL = 2, WATER = 3, TREES = 4, ICE = 5, BASE = 6;
  var CH = { '.': EMPTY, '#': BRICK, '@': STEEL, '~': WATER, '%': TREES, '-': ICE };
  var HALF = { '[': [1, 0, 1, 0], ']': [0, 1, 0, 1], '^': [1, 1, 0, 0], '_': [0, 0, 1, 1] };
  var DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }, DLIST = ['u', 'd', 'l', 'r'];
  var GATES = [[0, 0], [6, 0], [12, 0]], PSPAWN = [[4, 12], [8, 12]], BASEPOS = [6, 12];
  var FORT = []; // a two layer brick wall around the bird
  (function () { for (var y = 22; y <= 25; y++) for (var x = 10; x <= 15; x++) if (y < 24 || x < 12 || x > 13) FORT.push([x, y]); })();
  var TYPES = {
    b: { name: 'Basic', speed: 2.2, hp: 1, fire: 1.7, bullet: 8, maxB: 1, score: 100 },
    f: { name: 'Fast', speed: 3.9, hp: 1, fire: 1.9, bullet: 9, maxB: 1, score: 200 },
    r: { name: 'Rapid-fire', speed: 2.4, hp: 1, fire: 0.75, bullet: 13, maxB: 2, score: 300 },
    a: { name: 'Armored', speed: 1.9, hp: 4, fire: 1.5, bullet: 9, maxB: 1, score: 400 }
  };
  var DIFF = {
    easy: { count: 15, lives: 5, speed: 0.85, fire: 1.8, max: 3, chase: 0.12, spawn: 3.4, aim: 0.15, aimBird: false, fortStart: 25 },
    medium: { count: 20, lives: 3, speed: 1, fire: 1.45, max: 4, chase: 0.18, spawn: 3.0, aim: 0.3, aimBird: false },
    hard: { count: 20, lives: 3, speed: 1.1, fire: 1.0, max: 4, chase: 0.3, spawn: 2.3, aim: 0.5, aimBird: true }
  };
  var POWERS = ['star', 'shield', 'shovel', 'bomb', 'clock', 'tank'];
  var BONUS_AT = [3, 10, 17];
  var PLAYER_SPEED = 3.3, EPS = 1e-6;

  function rng(g) { var t = g.seed = (g.seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function pick(g, a) { return a[Math.floor(rng(g) * a.length)]; }

  function buildMap(lv) {
    var m = [], x, y;
    for (y = 0; y < H; y++) { m.push([]); for (x = 0; x < H; x++) m[y].push(EMPTY); }
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var c = lv.map[y][x], hf = HALF[c];
      for (var k = 0; k < 4; k++) m[y * 2 + (k >> 1)][x * 2 + (k & 1)] = hf ? (hf[k] ? BRICK : EMPTY) : (CH[c] || EMPTY);
    }
    function clearTile(tx, ty) { for (var k = 0; k < 4; k++) m[ty * 2 + (k >> 1)][tx * 2 + (k & 1)] = EMPTY; }
    GATES.concat(PSPAWN).forEach(function (p) { clearTile(p[0], p[1]); });
    for (y = 11; y <= 12; y++) for (x = 5; x <= 7; x++) clearTile(x, y);
    FORT.forEach(function (c) { m[c[1]][c[0]] = BRICK; });
    for (y = 24; y <= 25; y++) for (x = 12; x <= 13; x++) m[y][x] = BASE;
    return m;
  }

  function newGame(o) {
    o = o || {};
    var lvIdx = Math.max(0, Math.min(LV.LEVELS.length - 1, o.level | 0)), lv = LV.LEVELS[lvIdx], dname = DIFF[o.difficulty] ? o.difficulty : 'medium', D = DIFF[dname];
    var g = { level: lvIdx, name: lv.name, diff: dname, D: D, seed: (o.seed == null ? 12345 : o.seed) | 0, t: 0, map: buildMap(lv), mapVer: 1,
      players: [], enemies: [], bullets: [], power: null, events: [], status: 'play', endT: 0, freezeT: 0, shovelT: 0, spawnT: 1, gate: 0,
      queue: [], spawned: 0, killed: 0, birdAlive: true, nextId: 1, twoP: !!o.twoP };
    // enemy queue: scale counts to the difficulty total, then shuffle with the seed
    var e = lv.enemies, total = e.b + e.f + e.r + e.a, keys = ['b', 'f', 'r', 'a'], q = [];
    keys.forEach(function (k) { var n = Math.round(e[k] * D.count / total); for (var i = 0; i < n; i++) q.push(k); });
    while (q.length > D.count) q.splice(q.indexOf('b') >= 0 ? q.indexOf('b') : q.indexOf('f') >= 0 ? q.indexOf('f') : 0, 1);
    while (q.length < D.count) q.push('b');
    for (var i = q.length - 1; i > 0; i--) { var j = Math.floor(rng(g) * (i + 1)), t = q[i]; q[i] = q[j]; q[j] = t; }
    // armored tanks lean toward the back of the line so the level ramps up
    q.sort(function (a, b) { return (a === 'a') - (b === 'a'); }); for (i = 0; i < q.length - 1; i++) if (rng(g) < 0.35) { t = q[i]; q[i] = q[i + 1]; q[i + 1] = t; }
    g.queue = q;
    var carry = o.carry || [];
    for (var p = 0; p < (g.twoP ? 2 : 1); p++) {
      var c = carry[p] || {};
      g.players.push({ id: p, kind: 'player', x: PSPAWN[p][0], y: PSPAWN[p][1], dir: 'u', lives: c.lives > 0 ? c.lives : D.lives, tier: c.tier | 0, score: c.score | 0, alive: true, out: false,
        shieldT: 3, respawnT: 0, cool: 0, slide: 0, moving: false, tread: 0, kills: 0 });
    }
    if (D.fortStart) { g.shovelT = D.fortStart; setFort(g, STEEL); }
    return g;
  }

  function cellsOf(x, y, w, h) { return { x0: Math.max(0, Math.floor(x * 2 + EPS)), x1: Math.min(H - 1, Math.ceil((x + w) * 2 - EPS) - 1), y0: Math.max(0, Math.floor(y * 2 + EPS)), y1: Math.min(H - 1, Math.ceil((y + h) * 2 - EPS) - 1) }; }
  function blocksTank(v) { return v === BRICK || v === STEEL || v === WATER || v === BASE; }
  function overlap(ax, ay, bx, by) { return ax < bx + 1 - EPS && ax + 1 > bx + EPS && ay < by + 1 - EPS && ay + 1 > by + EPS; }
  function tanks(g) { var a = []; g.players.forEach(function (p) { if (p.alive) a.push(p); }); g.enemies.forEach(function (e) { if (e.alive) a.push(e); }); return a; }
  function free(g, self, x, y) {
    if (x < -EPS || y < -EPS || x > N - 1 + EPS || y > N - 1 + EPS) return false;
    var c = cellsOf(x, y, 1, 1);
    for (var cy = c.y0; cy <= c.y1; cy++) for (var cx = c.x0; cx <= c.x1; cx++) if (blocksTank(g.map[cy][cx])) return false;
    var all = tanks(g);
    for (var i = 0; i < all.length; i++) { var t = all[i]; if (t === self || t.spawning) continue; if (overlap(x, y, t.x, t.y) && !overlap(self.x, self.y, t.x, t.y)) return false; }
    return true;
  }
  // Move along dir by d. Stops flush against walls (on the half-tile grid). Returns distance moved.
  function move(g, t, dir, d) {
    var v = DIRS[dir], nx = t.x + v[0] * d, ny = t.y + v[1] * d;
    if (free(g, t, nx, ny)) { t.x = nx; t.y = ny; return d; }
    // flush to the next half-tile line in the way
    var bx = v[0] > 0 ? Math.floor(nx * 2 + EPS) / 2 : v[0] < 0 ? Math.ceil(nx * 2 - EPS) / 2 : t.x;
    var by = v[1] > 0 ? Math.floor(ny * 2 + EPS) / 2 : v[1] < 0 ? Math.ceil(ny * 2 - EPS) / 2 : t.y;
    var moved = Math.abs(bx - t.x) + Math.abs(by - t.y);
    if (moved > EPS && moved < d && free(g, t, bx, by)) { t.x = bx; t.y = by; return moved; }
    return 0;
  }
  // Gentle grid alignment when turning: snap the cross axis to the nearest half tile, only if close and the spot is free.
  function turn(g, t, dir) {
    if (t.dir === dir) return;
    var horizNow = DIRS[dir][0] !== 0;
    if (horizNow) { var sy = Math.round(t.y * 2) / 2; if (Math.abs(sy - t.y) <= 0.3 && free(g, t, t.x, sy)) t.y = sy; }
    else { var sx = Math.round(t.x * 2) / 2; if (Math.abs(sx - t.x) <= 0.3 && free(g, t, sx, t.y)) t.x = sx; }
    t.dir = dir;
  }
  function onIce(g, t) { var cx = Math.floor((t.x + 0.5) * 2), cy = Math.floor((t.y + 0.5) * 2); return g.map[cy] && (g.map[cy][cx] === ICE || g.map[cy][Math.max(0, cx - 1)] === ICE); }

  function fire(g, t, speed, power, maxB) {
    if (g.bullets.filter(function (b) { return b.owner === t; }).length >= maxB) return false;
    var v = DIRS[t.dir], bx = t.x + 0.5 + v[0] * 0.55, by = t.y + 0.5 + v[1] * 0.55;
    g.bullets.push({ x: bx, y: by, dir: t.dir, speed: speed, power: power, owner: t, side: t.kind === 'player' ? 'p' : 'e', alive: true });
    g.events.push({ t: 'shoot', x: bx, y: by, dir: t.dir, side: t.kind });
    return true;
  }
  function playerGun(p) { return [{ s: 9, m: 1, pw: false }, { s: 14, m: 1, pw: false }, { s: 14, m: 2, pw: false }, { s: 14, m: 2, pw: true }][Math.min(3, p.tier)]; }

  function hitMap(g, b) {
    var v = DIRS[b.dir], sz = 0.12, fx = b.x + v[0] * sz, fy = b.y + v[1] * sz;
    var cx = Math.floor(fx * 2), cy = Math.floor(fy * 2);
    if (fx < 0 || fy < 0 || fx >= N || fy >= N) { g.events.push({ t: 'spark', x: b.x, y: b.y }); return true; }
    // cells touched by the bullet body across its width
    var horiz = v[0] !== 0, hitCells = [];
    for (var o = -1; o <= 1; o += 2) {
      var px = horiz ? fx : b.x + o * 0.1, py = horiz ? b.y + o * 0.1 : fy, qx = Math.floor(px * 2), qy = Math.floor(py * 2);
      if (qx >= 0 && qy >= 0 && qx < H && qy < H) { var val = g.map[qy][qx]; if (val === BRICK || val === STEEL || val === BASE) hitCells.push([qx, qy, val]); }
    }
    if (!hitCells.length) return false;
    if (hitCells.some(function (c) { return c[2] === BASE; })) { if (b.side === 'e') killBird(g, b.side); else g.events.push({ t: 'clank', x: b.x, y: b.y, side: b.side }); return true; }
    // impact strip one tile wide, centered on the bullet; power shots go two rows deep and break steel
    var rows = b.power ? 2 : 1, broke = false, steel = false;
    for (var r = 0; r < rows; r++) {
      var a0, a1;
      if (horiz) { a0 = Math.floor((b.y - 0.5) * 2 + EPS); a1 = Math.ceil((b.y + 0.5) * 2 - EPS) - 1; }
      else { a0 = Math.floor((b.x - 0.5) * 2 + EPS); a1 = Math.ceil((b.x + 0.5) * 2 - EPS) - 1; }
      var line = horiz ? cx + v[0] * r : cy + v[1] * r;
      for (var a = a0; a <= a1; a++) {
        var X = horiz ? line : a, Y = horiz ? a : line;
        if (X < 0 || Y < 0 || X >= H || Y >= H) continue; var c = g.map[Y][X];
        if (c === BRICK || (c === STEEL && b.power)) { g.map[Y][X] = EMPTY; broke = true; g.events.push({ t: c === BRICK ? 'brick' : 'steelbreak', x: (X + 0.5) / 2, y: (Y + 0.5) / 2 }); }
        else if (c === STEEL) steel = true;
      }
    }
    if (broke) g.mapVer++;
    if (steel && !broke) g.events.push({ t: 'clank', x: b.x, y: b.y, side: b.side });
    return true;
  }
  function killBird(g, side) { g.birdBy = side; if (!g.birdAlive) return; g.birdAlive = false; g.events.push({ t: 'bird', x: 6.5, y: 12.5 }); g.events.push({ t: 'boom', x: 6.5, y: 12.5, big: true }); if (g.status === 'play') { g.status = 'lost'; g.reason = 'bird'; g.endT = 0; } }
  function inBox(b, t) { return b.x > t.x - 0.08 && b.x < t.x + 1.08 && b.y > t.y - 0.08 && b.y < t.y + 1.08; }

  function dropPower(g) {
    var spots = [];
    for (var y = 0; y <= 11; y++) for (var x = 0; x <= 12; x++) { if (y >= 10 && x >= 5 && x <= 7) continue; spots.push([x, y]); }
    var s = pick(g, spots); g.power = { kind: pick(g, POWERS), x: s[0], y: s[1], t: 18 };
    g.events.push({ t: 'powerdrop', x: s[0] + 0.5, y: s[1] + 0.5 });
  }
  function killEnemy(g, e, by, silent) {
    e.alive = false; g.killed++; g.events.push({ t: 'boom', x: e.x + 0.5, y: e.y + 0.5, big: true, kind: e.type });
    if (by && !silent) { by.score += TYPES[e.type].score; by.kills++; g.events.push({ t: 'score', x: e.x + 0.5, y: e.y + 0.5, v: TYPES[e.type].score }); }
  }
  function killPlayer(g, p) {
    p.alive = false; p.lives--; p.tier = 0; g.events.push({ t: 'boom', x: p.x + 0.5, y: p.y + 0.5, big: true, kind: 'player' }); g.events.push({ t: 'pdie', id: p.id });
    if (p.lives > 0) p.respawnT = 1.4; else p.out = true;
  }
  // Never rebuild a fort piece under a tank, so nothing gets stuck inside a wall.
  function setFort(g, v) { var all = tanks(g); FORT.forEach(function (c) { var hx = c[0] / 2, hy = c[1] / 2; if (all.some(function (t) { return t.x < hx + 0.5 - EPS && t.x + 1 > hx + EPS && t.y < hy + 0.5 - EPS && t.y + 1 > hy + EPS; })) return; g.map[c[1]][c[0]] = v; }); g.mapVer++; }
  function applyPower(g, p, k) {
    p.score += 500; g.events.push({ t: 'pickup', kind: k, x: p.x + 0.5, y: p.y + 0.5, id: p.id });
    if (k === 'star') p.tier = Math.min(3, p.tier + 1);
    else if (k === 'shield') p.shieldT = Math.max(p.shieldT, 10);
    else if (k === 'shovel') { g.shovelT = 16; setFort(g, STEEL); }
    else if (k === 'bomb') g.enemies.forEach(function (e) { if (e.alive && !e.spawning) killEnemy(g, e, p); });
    else if (k === 'clock') g.freezeT = 9;
    else if (k === 'tank') p.lives = Math.min(9, p.lives + 1);
  }

  function spawnEnemy(g) {
    for (var k = 0; k < 3; k++) {
      var gi = (g.gate + k) % 3, s = GATES[gi], x = s[0], y = s[1], probe = { x: -9, y: -9 };
      if (!free(g, probe, x, y)) continue;
      var type = g.queue[g.spawned], T = TYPES[type];
      g.enemies.push({ id: g.nextId++, kind: 'enemy', type: type, x: x, y: y, dir: 'd', hp: T.hp, maxHp: T.hp, alive: true, spawning: 1.0, bonus: BONUS_AT.indexOf(g.spawned) >= 0,
        think: 0.5, cool: 0.8 + rng(g) * T.fire, stuckT: 0, lx: x, ly: y, tread: 0, moving: false, hitT: 0 });
      g.spawned++; g.gate = (gi + 1) % 3; g.events.push({ t: 'spawn', x: x + 0.5, y: y + 0.5 });
      return true;
    }
    return false;
  }
  function chooseDir(g, e, avoid) {
    var D = g.D, r = rng(g), opts = DLIST.filter(function (d) { return d !== avoid; }), dir;
    if (r < D.chase) { // head toward the bird
      var dx = BASEPOS[0] - e.x, dy = BASEPOS[1] - e.y;
      var a = Math.abs(dx) > 0.3 ? (dx > 0 ? 'r' : 'l') : null, b = Math.abs(dy) > 0.3 ? (dy > 0 ? 'd' : 'u') : null;
      dir = a && b ? (rng(g) < 0.5 ? a : b) : (a || b || 'd');
      if (dir === avoid) dir = pick(g, opts);
    } else if (r < D.chase + 0.12 && g.players.some(function (p) { return p.alive; })) { // sometimes toward a player
      var p = g.players.filter(function (q) { return q.alive; })[0], px = p.x - e.x, py = p.y - e.y;
      dir = Math.abs(px) > Math.abs(py) ? (px > 0 ? 'r' : 'l') : (py > 0 ? 'd' : 'u'); if (dir === avoid) dir = pick(g, opts);
    } else { var w = opts.concat(opts.indexOf('d') >= 0 ? ['d'] : []); dir = pick(g, w); }
    return dir;
  }
  function enemyAI(g, e, dt) {
    var T = TYPES[e.type], D = g.D;
    if (g.freezeT > 0) { e.moving = false; return; }
    e.think -= dt; e.cool -= dt;
    var moved = move(g, e, e.dir, T.speed * D.speed * dt); e.moving = moved > 0; if (moved) e.tread += moved;
    if (Math.abs(e.x - e.lx) + Math.abs(e.y - e.ly) > 0.05) { e.stuckT = 0; e.lx = e.x; e.ly = e.y; } else e.stuckT += dt;
    var aligned = Math.abs(e.x * 2 - Math.round(e.x * 2)) < 0.03 && Math.abs(e.y * 2 - Math.round(e.y * 2)) < 0.03 && Math.abs(e.x - Math.round(e.x)) < 0.03 && Math.abs(e.y - Math.round(e.y)) < 0.03;
    if (!moved) {
      if (e.cool < T.fire * 0.5 && rng(g) < 0.04) e.cool = 0; // shoot what is in the way sometimes
      if (e.think <= 0 || e.stuckT > 0.35) {
        var nd = chooseDir(g, e, e.stuckT > 1 ? e.dir : null);
        if (e.stuckT > 1.2) { var open = DLIST.filter(function (d) { var v = DIRS[d]; return free(g, e, e.x + v[0] * 0.1, e.y + v[1] * 0.1); }); if (open.length) nd = pick(g, open); }
        turn(g, e, nd); e.think = 0.3 + rng(g) * 0.6;
      }
    } else if (e.think <= 0 || (aligned && rng(g) < 0.02)) { turn(g, e, chooseDir(g, e, null)); e.think = 1 + rng(g) * 2.2; }
    // aim: on Hard they turn to face a player or the bird when lined up
    if (aligned && rng(g) < D.aim * 0.05) {
      var targets = (D.aimBird ? [{ x: BASEPOS[0], y: BASEPOS[1] }] : []).concat(g.players.filter(function (p) { return p.alive; }));
      targets.forEach(function (t) { if (Math.abs(t.x - e.x) < 0.4) turn(g, e, t.y > e.y ? 'd' : 'u'); else if (Math.abs(t.y - e.y) < 0.4) turn(g, e, t.x > e.x ? 'r' : 'l'); });
    }
    if (e.cool <= 0 && e.spawnSafe <= 0) { fire(g, e, T.bullet, false, T.maxB); e.cool = T.fire * D.fire * (0.6 + rng(g) * 0.8); }
  }

  // inputs: [{ dir: 'u'|'d'|'l'|'r'|null, fire: bool }, ...]
  function step(g, inputs, dt) {
    g.events = []; dt = dt || 1 / 60; inputs = inputs || [];
    if (g.status !== 'play') { g.endT += dt; stepBullets(g, dt); return g; }
    g.t += dt;
    if (g.freezeT > 0) g.freezeT = Math.max(0, g.freezeT - dt);
    if (g.shovelT > 0) { g.shovelT -= dt; if (g.shovelT <= 0) { g.shovelT = 0; setFort(g, BRICK); } }
    if (g.power) { g.power.t -= dt; if (g.power.t <= 0) g.power = null; }
    // players
    g.players.forEach(function (p, i) {
      var inp = inputs[i] || {};
      if (!p.alive) {
        if (!p.out) { p.respawnT -= dt; if (p.respawnT <= 0) { var sx = PSPAWN[i][0], sy = PSPAWN[i][1]; p.x = sx; p.y = sy; p.dir = 'u'; p.alive = true; p.shieldT = 3; p.slide = 0; g.events.push({ t: 'spawn', x: sx + 0.5, y: sy + 0.5 }); } }
        return;
      }
      if (p.shieldT > 0) p.shieldT = Math.max(0, p.shieldT - dt);
      p.cool -= dt; p.moving = false;
      if (inp.dir && DIRS[inp.dir]) {
        turn(g, p, inp.dir); var m = move(g, p, p.dir, PLAYER_SPEED * dt); p.moving = m > 0; p.tread += m; p.slide = onIce(g, p) ? 0.6 : 0;
      } else if (p.slide > 0) { var s = move(g, p, p.dir, PLAYER_SPEED * 0.8 * dt); p.slide = s > 0 && onIce(g, p) ? p.slide - s : 0; p.tread += s; g.sliding = true; }
      if (inp.fire && p.cool <= 0) { var gun = playerGun(p); if (fire(g, p, gun.s, gun.pw, gun.m)) p.cool = 0.12; }
      if (g.power && overlap(p.x, p.y, g.power.x, g.power.y)) { var k = g.power.kind; g.power = null; applyPower(g, p, k); }
    });
    // enemies
    var alive = g.enemies.filter(function (e) { return e.alive; });
    g.spawnT -= dt;
    if (g.spawnT <= 0 && g.spawned < g.queue.length && alive.length < g.D.max) { if (spawnEnemy(g)) g.spawnT = g.D.spawn; else g.spawnT = 0.3; }
    g.enemies.forEach(function (e) {
      if (!e.alive) return; if (e.hitT > 0) e.hitT -= dt;
      if (e.spawning > 0) { e.spawning -= dt; if (e.spawning <= 0) { e.spawning = 0; e.spawnSafe = 0.6; } return; }
      if (e.spawnSafe > 0) e.spawnSafe -= dt;
      enemyAI(g, e, dt);
    });
    stepBullets(g, dt);
    g.enemies = g.enemies.filter(function (e) { return e.alive; });
    if (g.status === 'play' && g.players.every(function (p) { return p.out; })) { g.status = 'lost'; g.reason = 'lives'; g.endT = 0; }
    if (g.status === 'play' && g.spawned >= g.queue.length && g.enemies.length === 0) { g.status = 'won'; g.endT = 0; g.events.push({ t: 'win' }); }
    return g;
  }
  function stepBullets(g, dt) {
    g.bullets.forEach(function (b) {
      if (!b.alive) return; var v = DIRS[b.dir], dist = b.speed * dt, n = Math.ceil(dist / 0.1), sd = dist / n;
      for (var s = 0; s < n && b.alive; s++) {
        b.x += v[0] * sd; b.y += v[1] * sd;
        if (hitMap(g, b)) { b.alive = false; g.events.push({ t: 'hit', x: b.x, y: b.y, dir: b.dir }); break; }
        // bullets cancel each other
        for (var i = 0; i < g.bullets.length; i++) { var o = g.bullets[i]; if (o !== b && o.alive && o.side !== b.side && Math.abs(o.x - b.x) < 0.25 && Math.abs(o.y - b.y) < 0.25) { o.alive = b.alive = false; g.events.push({ t: 'spark', x: b.x, y: b.y }); break; } }
        if (!b.alive || g.status !== 'play') continue;
        if (b.side === 'p') {
          for (i = 0; i < g.enemies.length; i++) { var e = g.enemies[i]; if (!e.alive || e.spawning || !inBox(b, e)) continue;
            b.alive = false;
            if (e.bonus) { e.bonus = false; dropPower(g); }
            e.hp--; e.hitT = 0.15;
            if (e.hp <= 0) killEnemy(g, e, b.owner); else g.events.push({ t: 'armor', x: b.x, y: b.y });
            break; }
        } else {
          for (i = 0; i < g.players.length; i++) { var p = g.players[i]; if (!p.alive || !inBox(b, p)) continue; b.alive = false;
            if (p.shieldT > 0) g.events.push({ t: 'deflect', x: b.x, y: b.y }); else killPlayer(g, p); break; }
        }
      }
    });
    g.bullets = g.bullets.filter(function (b) { return b.alive; });
  }
  function carry(g) { return g.players.map(function (p) { return { lives: Math.max(1, p.lives), tier: p.tier, score: p.score }; }); }
  function remaining(g) { return g.queue.length - g.spawned + g.enemies.filter(function (e) { return e.alive; }).length; }

  var api = { N: N, H: H, EMPTY: EMPTY, BRICK: BRICK, STEEL: STEEL, WATER: WATER, TREES: TREES, ICE: ICE, BASE: BASE, TYPES: TYPES, DIFF: DIFF, POWERS: POWERS, DIRS: DIRS,
    GATES: GATES, PSPAWN: PSPAWN, FORT: FORT, LEVELS: LV.LEVELS, newGame: newGame, step: step, carry: carry, remaining: remaining, free: free, move: move, turn: turn,
    applyPower: applyPower, killEnemy: killEnemy, fire: fire, buildMap: buildMap, rng: rng, spawnEnemy: spawnEnemy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.TK = root.TK || {}; root.TK.Engine = api; }
})(this);
