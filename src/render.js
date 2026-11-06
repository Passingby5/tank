// Tank renderer. Everything is drawn in code at devicePixelRatio for crisp, detailed art. All art is original.
(function (root) {
  var E = root.TK.Engine, N = 13;
  var maxDpr = 3, sprites = {}, vign = null, treeRects = [], cv, cx, W = 0, T = 0, dpr = 1, terr = null, terrVer = -1, terrMap = null, trees = null, treeVer = -1, treeMap = null, parts = [], floats = [], shake = 0, flashes = [], frames = 0, lastG = null, reduce = false;
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function lg(c, x0, y0, x1, y1, stops) { var g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(function (s, i) { g.addColorStop(s[0], s[1]); }); return g; }

  // ---------- sprite cache (performance): tanks, bird, power-ups and glows are drawn once per size and reused ----------
  function sprite(key, size, draw) { var sp = sprites[key]; if (sp) return sp; sp = document.createElement('canvas'); sp.width = sp.height = Math.ceil(size); draw(sp.getContext('2d'), sp.width); sprites[key] = sp; return sp; }
  function glow(rgb, a0) { return sprite('glow' + rgb + a0, 64, function (c, w) { var g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(' + rgb + ',' + a0 + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); }); }
  var FIRE = null, FLASH = null;
  function resetSprites() { sprites = {}; FIRE = FLASH = null; vign = null; }
  function fireSprite() { return FIRE || (FIRE = sprite('fire', 64, function (c, w) { var g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(0.5, 'rgba(255,120,30,0.8)'); g.addColorStop(1, 'rgba(200,40,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); })); }
  function flashSprite() { return FLASH || (FLASH = sprite('flash', 128, function (c, w) { var g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.35, 'rgba(255,190,60,0.9)'); g.addColorStop(0.7, 'rgba(230,70,20,0.6)'); g.addColorStop(1, 'rgba(120,20,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, w); })); }
  function tankSprite(kind, dir, tread, opt) {
    var ph = Math.floor(((tread * 0.9 / 0.11) % 1 + 1) % 1 * 4), key = 't' + kind + dir + ph + (opt.bonus ? 'b' : '') + (opt.sprint ? 's' : '') + (kind === 'a' ? opt.hp : '');
    return sprite(key, T * 1.3, function (c, w) { drawTank(c, T * 0.15, T * 0.15, T, dir, kind, ph * 0.11 / 0.9 / 4, opt); });
  }
  function setup(canvas) { cv = canvas; cx = cv.getContext('2d'); }
  function resize(css) {
    dpr = Math.min(maxDpr, root.devicePixelRatio || 1); var px = Math.max(26, Math.floor(css * dpr / 26) * 26); // round DOWN so the board never overflows
    if (px !== W) { W = px; T = W / N; cv.width = cv.height = W; invalidate(); resetSprites(); }
    cv.style.width = cv.style.height = (W / dpr) + 'px'; return W / dpr;
  }

  // ---------- terrain ----------
  function drawGround(c, w) {
    var g = c.createRadialGradient(w / 2, w * 0.45, w * 0.1, w / 2, w / 2, w * 0.75); g.addColorStop(0, '#2b3036'); g.addColorStop(1, '#16191e'); c.fillStyle = g; c.fillRect(0, 0, w, w);
    var h = T / 2;
    for (var y = 0; y < 26; y++) for (var x = 0; x < 26; x++) { var r = hash(x, y); c.fillStyle = 'rgba(255,255,255,' + (0.012 + r * 0.025) + ')'; c.fillRect(x * h, y * h, h, h); if (r > 0.8) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(x * h + h * hash(y, x), y * h + h * r, h * 0.08, 0, 7); c.fill(); } }
    c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = Math.max(1, dpr * 0.5);
    for (var i = 0; i <= N; i++) { c.beginPath(); c.moveTo(i * T, 0); c.lineTo(i * T, w); c.moveTo(0, i * T); c.lineTo(w, i * T); c.stroke(); }
  }
  function drawBrick(c, X, Y) {
    var h = T / 2, x = X * h, y = Y * h, rows = 2, rh = h / rows, m = Math.max(1, h * 0.06);
    c.fillStyle = '#3a2219'; c.fillRect(x, y, h, h);
    for (var r = 0; r < rows; r++) {
      var off = ((Y * rows + r) % 2) ? -h / 2 : 0;
      for (var k = -1; k < 2; k++) {
        var bx = x + off + k * h, bw = h, bx0 = Math.max(x, bx + m / 2), bx1 = Math.min(x + h, bx + bw - m / 2); if (bx1 - bx0 < 1) continue;
        var by = y + r * rh + m / 2, bh = rh - m, shade = 0.85 + hash(X * 3 + k, Y * 2 + r) * 0.3;
        c.fillStyle = lg(c, 0, by, 0, by + bh, [[0, 'rgb(' + (226 * shade | 0) + ',' + (120 * shade | 0) + ',' + (78 * shade | 0) + ')'], [0.55, 'rgb(' + (184 * shade | 0) + ',' + (84 * shade | 0) + ',' + (52 * shade | 0) + ')'], [1, 'rgb(' + (128 * shade | 0) + ',' + (54 * shade | 0) + ',' + (34 * shade | 0) + ')']]);
        c.fillRect(bx0, by, bx1 - bx0, bh);
        c.fillStyle = 'rgba(255,220,180,0.35)'; c.fillRect(bx0, by, bx1 - bx0, Math.max(1, bh * 0.14));
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(bx0, by + bh - Math.max(1, bh * 0.12), bx1 - bx0, Math.max(1, bh * 0.12));
        if (hash(X + k * 7, Y + r * 5) > 0.7) { c.fillStyle = 'rgba(60,20,10,0.35)'; c.fillRect(bx0 + (bx1 - bx0) * 0.3, by + bh * 0.4, Math.max(1, h * 0.06), Math.max(1, h * 0.06)); }
      }
    }
  }
  function drawSteel(c, X, Y) {
    var h = T / 2, x = X * h, y = Y * h, b = Math.max(1, h * 0.12);
    c.fillStyle = lg(c, x, y, x + h, y + h, [[0, '#f2f6fa'], [0.5, '#a9b3bf'], [1, '#5b6470']]); c.fillRect(x, y, h, h);
    c.fillStyle = lg(c, x, y, x + h, y + h, [[0, '#cfd6de'], [1, '#7c8794']]); c.fillRect(x + b, y + b, h - 2 * b, h - 2 * b);
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.moveTo(x + b, y + b); c.lineTo(x + h * 0.55, y + b); c.lineTo(x + b, y + h * 0.55); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,36,44,0.55)'; c.lineWidth = Math.max(1, h * 0.03); c.strokeRect(x + 0.5, y + 0.5, h - 1, h - 1);
    var r = h * 0.09; [[0.5, 0.5]].forEach(function (p) { var px = x + h * p[0], py = y + h * p[1]; c.fillStyle = '#4b535e'; c.beginPath(); c.arc(px + r * 0.3, py + r * 0.3, r, 0, 7); c.fill(); c.fillStyle = lg(c, px - r, py - r, px + r, py + r, [[0, '#ffffff'], [1, '#8994a0']]); c.beginPath(); c.arc(px, py, r, 0, 7); c.fill(); });
  }
  function drawIce(c, X, Y) {
    var h = T / 2, x = X * h, y = Y * h;
    c.fillStyle = lg(c, x, y, x + h, y + h, [[0, '#e6f6ff'], [0.5, '#b8def5'], [1, '#8cc3e6']]); c.fillRect(x, y, h, h);
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(1, h * 0.04); c.beginPath();
    var o = hash(X, Y); c.moveTo(x + h * (0.1 + o * 0.3), y + h * 0.9); c.lineTo(x + h * (0.6 + o * 0.3), y + h * 0.15); c.moveTo(x + h * 0.15, y + h * (0.45 + o * 0.2)); c.lineTo(x + h * 0.4, y + h * 0.2); c.stroke();
    c.strokeStyle = 'rgba(70,130,170,0.25)'; c.strokeRect(x + 0.5, y + 0.5, h - 1, h - 1);
  }
  function drawTreeCell(c, X, Y) {
    var h = T / 2, x = X * h, y = Y * h;
    for (var i = 0; i < 4; i++) {
      var px = x + h * (0.25 + 0.5 * (i & 1)) + (hash(X * 4 + i, Y) - 0.5) * h * 0.2, py = y + h * (0.25 + 0.5 * (i >> 1)) + (hash(X, Y * 4 + i) - 0.5) * h * 0.2, r = h * (0.36 + hash(X + i, Y - i) * 0.12);
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(px + r * 0.2, py + r * 0.25, r, 0, 7); c.fill();
      var g = c.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r); g.addColorStop(0, '#9be36a'); g.addColorStop(0.5, '#3f9a3a'); g.addColorStop(1, '#1d5a26'); c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
      c.fillStyle = 'rgba(220,255,180,0.35)'; c.beginPath(); c.arc(px - r * 0.3, py - r * 0.35, r * 0.22, 0, 7); c.fill();
    }
  }
  function drawBird(c, x, y, s, alive, t) {
    // plate
    c.fillStyle = lg(c, x, y, x, y + s, [[0, '#3b3f4a'], [1, '#1d2028']]); rr(c, x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.12); c.fill();
    c.strokeStyle = 'rgba(255,215,120,0.5)'; c.lineWidth = Math.max(1, s * 0.025); c.stroke();
    if (!alive) {
      for (var i = 0; i < 9; i++) { c.fillStyle = ['#4a4a4a', '#2f2f2f', '#6b5a3a'][i % 3]; c.beginPath(); c.arc(x + s * (0.2 + hash(i, 3) * 0.6), y + s * (0.3 + hash(3, i) * 0.5), s * (0.07 + hash(i, i) * 0.08), 0, 7); c.fill(); }
      return;
    }
    var cxp = x + s * 0.5, cyp = y + s * 0.55, gold = lg(c, x, y + s * 0.2, x, y + s * 0.9, [[0, '#fff3b0'], [0.45, '#ffc93c'], [1, '#c77a12']]), bob = Math.sin(t * 3) * s * 0.012;
    c.save(); c.translate(0, bob);
    c.fillStyle = 'rgba(255,200,80,0.18)'; c.beginPath(); c.arc(cxp, cyp - s * 0.05, s * 0.42, 0, 7); c.fill();
    // tail fan
    c.fillStyle = '#d98b1c'; c.beginPath(); c.moveTo(cxp - s * 0.1, cyp + s * 0.05); c.lineTo(cxp - s * 0.38, cyp + s * 0.2); c.lineTo(cxp - s * 0.34, cyp + s * 0.3); c.lineTo(cxp - s * 0.06, cyp + s * 0.16); c.closePath(); c.fill();
    // body
    c.fillStyle = gold; c.beginPath(); c.ellipse(cxp, cyp + s * 0.08, s * 0.24, s * 0.15, -0.15, 0, 7); c.fill();
    // raised wings with feathers
    [[-1, 0.9], [1, 1]].forEach(function (wv) {
      c.fillStyle = wv[0] < 0 ? '#e0a02a' : gold; c.beginPath(); c.moveTo(cxp - s * 0.05, cyp); c.quadraticCurveTo(cxp - s * 0.1 + wv[0] * s * 0.05, cyp - s * 0.42, cxp - s * 0.36 + wv[0] * s * 0.04, cyp - s * 0.36);
      c.quadraticCurveTo(cxp - s * 0.2, cyp - s * 0.12, cxp + s * 0.08, cyp + s * 0.02); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(140,80,10,0.55)'; c.lineWidth = Math.max(1, s * 0.012); for (var f = 0; f < 4; f++) { c.beginPath(); c.moveTo(cxp - s * (0.06 + f * 0.04), cyp - s * 0.02); c.lineTo(cxp - s * (0.14 + f * 0.06), cyp - s * (0.22 + f * 0.03)); c.stroke(); }
    });
    // head, beak, eye
    c.fillStyle = gold; c.beginPath(); c.arc(cxp + s * 0.22, cyp - s * 0.06, s * 0.1, 0, 7); c.fill();
    c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(cxp + s * 0.31, cyp - s * 0.08); c.lineTo(cxp + s * 0.42, cyp - s * 0.04); c.lineTo(cxp + s * 0.31, cyp - s * 0.01); c.closePath(); c.fill();
    c.fillStyle = '#1b1b1b'; c.beginPath(); c.arc(cxp + s * 0.25, cyp - s * 0.08, s * 0.022, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cxp + s * 0.257, cyp - s * 0.088, s * 0.008, 0, 7); c.fill();
    c.restore();
  }
  function buildTerrain(g) {
    if (!terr) terr = document.createElement('canvas'); if (terr.width !== W) terr.width = terr.height = W;
    var c = terr.getContext('2d'); drawGround(c, W);
    var wg = lg(c, 0, 0, 0, T / 2, [[0, '#2a7fd6'], [1, '#14509e']]);
    for (var y = 0; y < 26; y++) for (var x = 0; x < 26; x++) { var v = g.map[y][x]; if (v === E.BRICK) drawBrick(c, x, y); else if (v === E.STEEL) drawSteel(c, x, y); else if (v === E.ICE) drawIce(c, x, y); else if (v === E.WATER) { c.save(); c.translate(0, y * T / 2); c.fillStyle = wg; c.fillRect(x * T / 2, 0, T / 2 + 0.5, T / 2 + 0.5); c.restore(); } }
    var vg = c.createRadialGradient(W / 2, W / 2, W * 0.45, W / 2, W / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = vg; c.fillRect(0, 0, W, W);
    // gate marks
    E.GATES.forEach(function (p) { c.strokeStyle = 'rgba(255,90,70,0.25)'; c.lineWidth = Math.max(1, T * 0.03); c.setLineDash([T * 0.1, T * 0.08]); c.strokeRect(p[0] * T + T * 0.08, p[1] * T + T * 0.08, T * 0.84, T * 0.84); c.setLineDash([]); });
    terrVer = g.mapVer; terrMap = g.map;
  }
  // terrain and tree caches are keyed to the map object itself AND its version: a new game or level has a new map
  function invalidate() { terrVer = treeVer = -1; terrMap = treeMap = null; }
  function buildTrees(g) {
    if (!trees) trees = document.createElement('canvas'); if (trees.width !== W) trees.width = trees.height = W;
    var c = trees.getContext('2d'); c.clearRect(0, 0, W, W);
    for (var y = 0; y < 26; y++) for (var x = 0; x < 26; x++) if (g.map[y][x] === E.TREES) drawTreeCell(c, x, y);
    treeRects = []; for (var ty = 0; ty < N; ty++) for (var tx = 0; tx < N; tx++) { var any = false; for (var k = 0; k < 4; k++) if (g.map[ty * 2 + (k >> 1)][tx * 2 + (k & 1)] === E.TREES) any = true; if (any) treeRects.push(tx, ty); }
    treeVer = g.mapVer; treeMap = g.map;
  }
  function drawWater(c, g, t) {
    var h = T / 2; c.strokeStyle = 'rgba(190,235,255,0.55)'; c.lineWidth = Math.max(1, h * 0.06); c.beginPath(); var dots = [];
    for (var y = 0; y < 26; y++) for (var x = 0; x < 26; x++) {
      if (g.map[y][x] !== E.WATER) continue; var px = x * h, py = y * h;
      for (var k = 0; k < 2; k++) { var wy = py + h * (0.3 + k * 0.42), ph = t * 2.2 + x * 0.9 + y * 0.6 + k * 2; c.moveTo(px, wy + Math.sin(ph) * h * 0.06); c.quadraticCurveTo(px + h * 0.5, wy + Math.sin(ph + 1.5) * h * 0.14, px + h, wy + Math.sin(ph + 3) * h * 0.06); }
      if (((x * 7 + y * 3 + Math.floor(t * 2)) % 11) === 0) dots.push(px + h * 0.6, py + h * 0.5);
    }
    c.stroke(); c.fillStyle = 'rgba(255,255,255,0.6)'; for (var i = 0; i < dots.length; i += 2) c.fillRect(dots[i] - h * 0.05, dots[i + 1] - h * 0.05, h * 0.1, h * 0.1);
  }

  // ---------- tanks ----------
  var PAL = {
    p0: ['#fff0a6', '#f2b92c', '#a86a0c', '#5a3a06'], p1: ['#c8ffd0', '#3fcf6c', '#1c7d3c', '#0b3f1d'],
    b: ['#e6ebf2', '#9aa6b6', '#5b6676', '#2d3440'], f: ['#ffd5cf', '#e0614f', '#9c2e22', '#4f130d'],
    r: ['#e6d5ff', '#9a6be0', '#5c3699', '#2b1550'], a: ['#d9f0c8', '#7f9c64', '#4c6638', '#24331a'],
    bonus: ['#ffe0e0', '#ff4a4a', '#b01818', '#5a0808'],
    sprint: ['#fff4b8', '#ffb020', '#c46a00', '#6a3200']
  };
  var ANG = { u: 0, r: Math.PI / 2, d: Math.PI, l: -Math.PI / 2 };
  function drawTank(c, x, y, s, dir, kind, tread, opt) {
    opt = opt || {}; var P = PAL[kind] || PAL.b; if (opt.bonus) P = PAL.bonus; else if (opt.sprint) P = PAL.sprint;
    c.save(); c.translate(x + s / 2, y + s / 2); c.rotate(ANG[dir] || 0);
    var hw = s / 2, slim = kind === 'f', big = kind === 'a';
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.35)'; rr(c, -hw * 0.86 + s * 0.05, -hw * 0.9 + s * 0.07, s * 0.86, s * 0.9, s * 0.1); c.fill();
    // treads
    var tw = s * (big ? 0.24 : 0.21), th = s * 0.92, tx = hw * 0.94 - tw;
    [-1, 1].forEach(function (sd) {
      var x0 = sd < 0 ? -hw * 0.94 : tx;
      c.fillStyle = lg(c, x0, 0, x0 + tw, 0, [[0, '#1a1c20'], [0.5, '#3d4249'], [1, '#14161a']]); rr(c, x0, -th / 2, tw, th, s * 0.06); c.fill();
      c.save(); rr(c, x0, -th / 2, tw, th, s * 0.06); c.clip();
      var step = s * 0.11, ph = ((tread * s * 0.9) % step + step) % step;
      c.fillStyle = 'rgba(150,158,168,0.55)'; for (var k = -th / 2 - step + ph; k < th / 2; k += step) c.fillRect(x0 + tw * 0.08, k, tw * 0.84, Math.max(1, step * 0.32));
      c.fillStyle = 'rgba(0,0,0,0.35)'; for (k = -th / 2 - step + ph + step * 0.5; k < th / 2; k += step) c.fillRect(x0, k, tw, Math.max(1, step * 0.12));
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = Math.max(1, s * 0.015); rr(c, x0, -th / 2, tw, th, s * 0.06); c.stroke();
    });
    // hull
    var hwid = s * (slim ? 0.5 : big ? 0.62 : 0.56), hh = s * (slim ? 0.8 : big ? 0.8 : 0.74);
    c.fillStyle = lg(c, -hwid / 2, -hh / 2, hwid / 2, hh / 2, [[0, P[0]], [0.35, P[1]], [1, P[2]]]); rr(c, -hwid / 2, -hh / 2, hwid, hh, s * 0.08); c.fill();
    c.strokeStyle = P[3]; c.lineWidth = Math.max(1, s * 0.022); c.stroke();
    // panel lines and details
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = Math.max(1, s * 0.012); c.beginPath(); c.moveTo(-hwid / 2 + s * 0.05, hh * 0.28); c.lineTo(hwid / 2 - s * 0.05, hh * 0.28); c.moveTo(-hwid / 2 + s * 0.05, -hh * 0.3); c.lineTo(hwid / 2 - s * 0.05, -hh * 0.3); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; rr(c, -hwid / 2 + s * 0.04, -hh / 2 + s * 0.03, hwid - s * 0.08, s * 0.04, s * 0.02); c.fill();
    if (slim) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(-s * 0.035, hh * 0.05, s * 0.07, hh * 0.38); }
    if (big) { // armor plates show remaining hit points
      for (var a = 0; a < 4; a++) { var on = a < (opt.hp == null ? 4 : opt.hp); c.fillStyle = on ? 'rgba(220,240,200,0.85)' : 'rgba(0,0,0,0.4)'; rr(c, -hwid / 2 + s * 0.05 + a * (hwid - s * 0.1) / 4 + s * 0.01, hh * 0.32, (hwid - s * 0.1) / 4 - s * 0.02, s * 0.06, s * 0.015); c.fill(); }
      c.fillStyle = P[3]; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) { c.beginPath(); c.arc(q[0] * hwid * 0.38, q[1] * hh * 0.4, s * 0.022, 0, 7); c.fill(); });
    }
    var ry = -hh * 0.38; c.fillStyle = 'rgba(0,0,0,0.35)'; [-1, 1].forEach(function (q) { c.beginPath(); c.arc(q * hwid * 0.33, hh * 0.42, s * 0.018, 0, 7); c.fill(); });
    // barrel(s)
    var bl = s * (slim ? 0.5 : 0.58), bw = s * (big ? 0.12 : 0.09);
    var barrels = kind === 'r' ? [-s * 0.06, s * 0.06] : [0];
    barrels.forEach(function (ox) {
      var w = kind === 'r' ? s * 0.06 : bw;
      c.fillStyle = lg(c, ox - w / 2, 0, ox + w / 2, 0, [[0, '#2a2e35'], [0.45, '#c9d0d8'], [1, '#3a3f47']]); c.fillRect(ox - w / 2, -bl, w, bl);
      c.fillStyle = '#1b1e23'; c.fillRect(ox - w * 0.7, -bl, w * 1.4, s * 0.06);
    });
    // turret
    var tr = s * (big ? 0.22 : slim ? 0.16 : 0.19), tgr = c.createRadialGradient(-tr * 0.35, -tr * 0.45, tr * 0.1, 0, 0, tr * 1.05); tgr.addColorStop(0, P[0]); tgr.addColorStop(0.55, P[1]); tgr.addColorStop(1, P[2]);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(s * 0.02, s * 0.03, tr, 0, 7); c.fill();
    c.fillStyle = tgr; c.beginPath(); if (big) { rr(c, -tr, -tr, tr * 2, tr * 2, tr * 0.35); } else c.arc(0, 0, tr, 0, 7); c.fill();
    c.strokeStyle = P[3]; c.lineWidth = Math.max(1, s * 0.018); c.stroke();
    c.fillStyle = P[2]; c.beginPath(); c.arc(tr * 0.25, tr * 0.25, tr * 0.36, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(tr * 0.15, tr * 0.12, tr * 0.12, 0, 7); c.fill();
    if (opt.hit) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,0.55)'; rr(c, -hw * 0.94, -th / 2, hw * 1.88, th, s * 0.08); c.fill(); c.globalCompositeOperation = 'source-over'; }
    if (opt.frozen) { c.fillStyle = 'rgba(140,210,255,0.35)'; rr(c, -hw * 0.94, -th / 2, hw * 1.88, th, s * 0.08); c.fill(); }
    c.restore();
  }
  // ---------- power-up icons ----------
  function drawPower(c, x, y, s, kind, t) {
    var pulse = 1 + Math.sin(t * 6) * 0.04; c.save(); c.translate(x + s / 2, y + s / 2); c.scale(pulse, pulse);
    var r = s * 0.44;
    c.shadowColor = 'rgba(255,210,90,0.8)'; c.shadowBlur = s * 0.25;
    c.fillStyle = lg(c, 0, -r, 0, r, [[0, '#3c4a8c'], [1, '#141a3a']]); rr(c, -r, -r, r * 2, r * 2, s * 0.14); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = lg(c, 0, -r, 0, r, [[0, '#fff1a8'], [1, '#d58f16']]); c.lineWidth = Math.max(1.5, s * 0.06); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.18)'; rr(c, -r * 0.85, -r * 0.85, r * 1.7, r * 0.7, s * 0.1); c.fill();
    var k = s * 0.3; c.lineJoin = 'round'; c.lineCap = 'round';
    if (kind === 'star') { c.fillStyle = lg(c, 0, -k, 0, k, [[0, '#fff7c2'], [1, '#ffb11a']]); c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? k * 0.42 : k; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); c.fill(); c.strokeStyle = '#9a5a00'; c.lineWidth = Math.max(1, s * 0.025); c.stroke(); }
    else if (kind === 'shield') { c.fillStyle = lg(c, 0, -k, 0, k, [[0, '#c8f4ff'], [1, '#2f8fe0']]); c.beginPath(); c.moveTo(0, -k); c.lineTo(k * 0.85, -k * 0.6); c.quadraticCurveTo(k * 0.8, k * 0.5, 0, k); c.quadraticCurveTo(-k * 0.8, k * 0.5, -k * 0.85, -k * 0.6); c.closePath(); c.fill(); c.strokeStyle = '#0d3f78'; c.lineWidth = Math.max(1, s * 0.025); c.stroke(); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(0, -k * 0.55); c.lineTo(0, k * 0.55); c.moveTo(-k * 0.4, -k * 0.15); c.lineTo(k * 0.4, -k * 0.15); c.stroke(); }
    else if (kind === 'shovel') { c.strokeStyle = '#c58b4a'; c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(-k * 0.6, -k * 0.75); c.lineTo(k * 0.2, k * 0.05); c.stroke(); c.fillStyle = lg(c, 0, 0, k, k, [[0, '#f1f5f8'], [1, '#7f8a96']]); c.save(); c.translate(k * 0.35, k * 0.35); c.rotate(-Math.PI / 4); rr(c, -k * 0.32, -k * 0.2, k * 0.64, k * 0.7, k * 0.25); c.fill(); c.restore(); c.strokeStyle = '#ffd36a'; c.lineWidth = s * 0.06; c.beginPath(); c.moveTo(-k * 0.85, -k * 0.55); c.lineTo(-k * 0.4, -k * 1); c.stroke(); }
    else if (kind === 'bomb') { var bg = c.createRadialGradient(-k * 0.3, -k * 0.2, k * 0.05, 0, k * 0.1, k * 0.8); bg.addColorStop(0, '#8a93b8'); bg.addColorStop(1, '#10131f'); c.fillStyle = bg; c.beginPath(); c.arc(0, k * 0.15, k * 0.68, 0, 7); c.fill(); c.strokeStyle = '#d9b27a'; c.lineWidth = s * 0.04; c.beginPath(); c.moveTo(k * 0.35, -k * 0.4); c.quadraticCurveTo(k * 0.6, -k * 0.9, k * 0.85, -k * 0.75); c.stroke(); c.fillStyle = (Math.floor(t * 8) % 2) ? '#fff6a0' : '#ff8a1a'; c.beginPath(); c.arc(k * 0.88, -k * 0.8, k * 0.16, 0, 7); c.fill(); }
    else if (kind === 'clock') { c.fillStyle = lg(c, 0, -k, 0, k, [[0, '#ffffff'], [1, '#c9d6e6']]); c.beginPath(); c.arc(0, 0, k * 0.85, 0, 7); c.fill(); c.strokeStyle = '#2a63b8'; c.lineWidth = s * 0.05; c.stroke(); c.strokeStyle = '#1b2440'; c.lineWidth = s * 0.04; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -k * 0.55); c.moveTo(0, 0); c.lineTo(k * 0.4, k * 0.1); c.stroke(); for (var j = 0; j < 12; j++) { var aa = j * Math.PI / 6; c.fillStyle = '#1b2440'; c.beginPath(); c.arc(Math.cos(aa) * k * 0.7, Math.sin(aa) * k * 0.7, s * 0.012, 0, 7); c.fill(); } }
    else if (kind === 'tank') { c.restore(); c.save(); c.translate(x + s / 2, y + s / 2); c.scale(pulse, pulse); drawTank(c, -k * 1.05, -k * 1.05, k * 2.1, 'u', 'p0', t * 0.5); c.fillStyle = '#fff'; c.font = '900 ' + Math.round(s * 0.26) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.strokeStyle = '#1b2440'; c.lineWidth = s * 0.05; c.strokeText('+1', k * 0.75, k * 0.95); c.fillText('+1', k * 0.75, k * 0.95); }
    c.restore();
  }
  // ---------- particles ----------
  function add(p) { if (reduce && (p.k === 'spark' || p.k === 'chip') && Math.random() < 0.6) return; if (parts.length < (reduce ? 150 : 400)) parts.push(p); }
  function boom(x, y, big) {
    var s = big ? 1 : 0.45, i;
    flashes.push({ x: x, y: y, t: 0, max: big ? 0.55 : 0.2, r: big ? 1.5 : 0.45 });
    if (big && !reduce) shake = Math.max(shake, 0.12);
    for (i = 0; i < (big ? 26 : 10); i++) { var a = Math.random() * 6.283, sp = (1.5 + Math.random() * 5) * s; add({ k: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 0, m: 0.3 + Math.random() * 0.35, w: 0.05 }); }
    for (i = 0; i < (big ? 12 : 4); i++) { a = Math.random() * 6.283; sp = Math.random() * 1.2 * s; add({ k: 'smoke', x: x + Math.cos(a) * 0.2 * s, y: y + Math.sin(a) * 0.2 * s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.3, l: 0, m: 0.8 + Math.random() * 0.8, r: (0.25 + Math.random() * 0.3) * s }); }
    for (i = 0; i < (big ? 16 : 3); i++) { a = Math.random() * 6.283; sp = (1 + Math.random() * 3) * s; add({ k: 'fire', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 0, m: 0.3 + Math.random() * 0.4, r: (0.25 + Math.random() * 0.35) * s }); }
    if (big) add({ k: 'ring', x: x, y: y, l: 0, m: 0.45, r: 1.4 });
  }
  function debris(x, y, col) { for (var i = 0; i < 5; i++) { var a = Math.random() * 6.283, sp = 1 + Math.random() * 2.5; add({ k: 'chip', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 0, m: 0.4 + Math.random() * 0.3, r: 0.05 + Math.random() * 0.05, c: col, rot: Math.random() * 6 }); } add({ k: 'smoke', x: x, y: y, vx: 0, vy: -0.2, l: 0, m: 0.5, r: 0.18 }); }
  function addFloat(f) { floats.forEach(function (o) { if (o.l < 0.6 && Math.abs(o.x - f.x) < 1.2 && Math.abs(o.y - f.l * 0.8 - f.y) < 0.5) f.y -= 0.5; }); floats.push(f); }
  function onEvents(g) {
    lastG = g;
    g.events.forEach(function (e) {
      switch (e.t) {
        case 'shoot': var v = E.DIRS[e.dir]; add({ k: 'muzzle', x: e.x + v[0] * 0.05, y: e.y + v[1] * 0.05, dir: e.dir, l: 0, m: 0.09 }); for (var i = 0; i < 4; i++) add({ k: 'spark', x: e.x, y: e.y, vx: v[0] * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2, vy: v[1] * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2, l: 0, m: 0.12, w: 0.035 }); break;
        case 'boom': boom(e.x, e.y, e.big); break;
        case 'brick': debris(e.x, e.y, '#c8653a'); break;
        case 'steelbreak': debris(e.x, e.y, '#c9d1da'); break;
        case 'hit': case 'spark': case 'clank': case 'armor': case 'deflect': boom(e.x, e.y, false); break;
        case 'score': addFloat({ x: e.x, y: e.y, s: String(e.v), l: 0 }); break;
        case 'pickup': addFloat({ x: e.x, y: e.y, s: { star: 'Star!', shield: 'Shield!', shovel: 'Steel fort!', bomb: 'Boom!', clock: 'Freeze!', tank: '+1 life' }[e.kind], l: 0, big: true }); add({ k: 'ring', x: e.x, y: e.y, l: 0, m: 0.5, r: 1.2, c: '255,230,120' }); if (e.kind === 'bomb' && !reduce) shake = 0.25; break;
        case 'bird': boom(e.x, e.y, true); boom(e.x - 0.3, e.y - 0.2, true); if (!reduce) shake = 0.35; break;
        case 'birdhit': boom(e.x, e.y - 0.3, false); floats.push({ x: e.x, y: e.y - 0.4, s: 'Bird hit!', l: 0, big: true }); break;
      }
    });
  }
  function drawParts(c, dt) {
    var s = T;
    flashes = flashes.filter(function (f) { f.t += dt; if (f.t > f.max) return false; var k = f.t / f.max, r = f.r * s * (0.5 + k * 0.8);
      c.globalAlpha = 1 - k; c.drawImage(flashSprite(), f.x * s - r, f.y * s - r, r * 2, r * 2); c.globalAlpha = 1; return true; });
    var sparkB = [[], [], []];
    parts = parts.filter(function (p) {
      p.l += dt; if (p.l >= p.m) return false; var k = p.l / p.m;
      if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; }
      if (p.k === 'spark') { var bk = sparkB[Math.min(2, k * 3 | 0)]; bk.push(p.x * s, p.y * s, (p.x - p.vx * 0.03) * s, (p.y - p.vy * 0.03) * s); }
      else if (p.k === 'smoke') { var sr = p.r * s * (1 + k) * 1.3; c.globalAlpha = 0.6 * (1 - k); c.drawImage(glow('70,70,76', 0.9), p.x * s - sr, p.y * s - sr, sr * 2, sr * 2); c.globalAlpha = 1; }
      else if (p.k === 'fire') { c.globalAlpha = 1 - k; c.drawImage(fireSprite(), (p.x - p.r) * s, (p.y - p.r) * s, p.r * 2 * s, p.r * 2 * s); c.globalAlpha = 1; }
      else if (p.k === 'ring') { c.strokeStyle = 'rgba(' + (p.c || '255,210,150') + ',' + (0.7 * (1 - k)) + ')'; c.lineWidth = s * 0.08 * (1 - k); c.beginPath(); c.arc(p.x * s, p.y * s, p.r * s * k, 0, 7); c.stroke(); }
      else if (p.k === 'chip') { c.fillStyle = p.c; c.globalAlpha = 1 - k; var cr = p.r * s * (0.7 + 0.3 * Math.abs(Math.cos(p.rot + k * 6))); c.fillRect(p.x * s - cr, p.y * s - cr, cr * 2, cr * 2); c.globalAlpha = 1; }
      else if (p.k === 'muzzle') { c.save(); c.translate(p.x * s, p.y * s); c.rotate(ANG[p.dir]); c.globalAlpha = 1 - k; c.fillStyle = 'rgba(255,214,90,0.95)';
        c.beginPath(); c.moveTo(0, s * 0.05); c.lineTo(s * 0.18, -s * 0.05); c.lineTo(0, -s * 0.42); c.lineTo(-s * 0.18, -s * 0.05); c.closePath(); c.fill(); c.beginPath(); c.arc(0, 0, s * 0.16, 0, 7); c.fill(); c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(0, -s * 0.05, s * 0.08, 0, 7); c.fill(); c.globalAlpha = 1; c.restore(); }
      return true;
    });
    c.lineCap = 'round'; c.lineWidth = s * 0.045;
    [['255,220,120', 1], ['255,180,80', 0.66], ['255,120,40', 0.33]].forEach(function (st, bi) { var a = sparkB[bi]; if (!a.length) return; c.strokeStyle = 'rgba(' + st[0] + ',' + st[1] + ')'; c.beginPath(); for (var q = 0; q < a.length; q += 4) { c.moveTo(a[q], a[q + 1]); c.lineTo(a[q + 2], a[q + 3]); } c.stroke(); });
  }

  // ---------- frame ----------
  function frame(g, dt, paused) {
    frames++; var c = cx, t = g.t, s = T; if (!W) return;
    if (terrVer !== g.mapVer || terrMap !== g.map || !terr) buildTerrain(g);
    if (treeVer !== g.mapVer || treeMap !== g.map || !trees) buildTrees(g);
    c.save();
    if (reduce) shake = 0;
    if (shake > 0 && !paused) { shake = Math.max(0, shake - dt); var m = shake * s * 0.5; c.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m); }
    c.drawImage(terr, 0, 0); drawWater(c, g, t);
    // fort glow when steel
    if (g.shovelT > 0) { c.fillStyle = 'rgba(160,220,255,' + (0.15 + 0.1 * Math.sin(t * 6)) + ')'; c.fillRect(5.5 * s, 11.5 * s, 2 * s, 1.5 * s); }
    c.drawImage(sprite('bird' + g.birdAlive, s, function (q) { drawBird(q, 0, 0, s, g.birdAlive, 0); }), 6 * s, 12 * s + (g.birdAlive && !reduce ? Math.round(Math.sin(t * 3) * s * 0.012) : 0));
    if (g.birdHitT > 0) { c.fillStyle = 'rgba(255,60,40,' + (g.birdHitT * 0.8) + ')'; rr(c, 6 * s + s * 0.04, 12 * s + s * 0.04, s * 0.92, s * 0.92, s * 0.12); c.fill(); }
    // power-up
    if (g.power && (g.power.t > 4 || Math.floor(g.power.t * 6) % 2)) { var pk = g.power.kind, sc = reduce ? 1 : 1 + Math.sin(t * 6) * 0.04, pp = sprite('pw' + pk, s * 1.3, function (q) { drawPower(q, s * 0.15, s * 0.15, s, pk, 0.3); }); c.drawImage(pp, (g.power.x + 0.5) * s - pp.width * sc / 2, (g.power.y + 0.5) * s - pp.height * sc / 2, pp.width * sc, pp.height * sc); }
    // enemies spawning
    g.enemies.forEach(function (e) {
      if (e.spawning > 0) { var k = 1 - e.spawning; c.save(); c.translate((e.x + 0.5) * s, (e.y + 0.5) * s); c.rotate(t * 6); c.fillStyle = 'rgba(255,255,255,0.9)'; var r = s * (0.25 + 0.25 * Math.abs(Math.sin(k * 9)));
        c.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, rad = i % 2 ? r * 0.3 : r; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.closePath(); c.fill(); c.restore(); return; }
      var sp = tankSprite(e.type, e.dir, e.tread, { bonus: e.bonus && Math.floor(t * 5) % 2 === 0, sprint: !!e.sprint && !(e.bonus && Math.floor(t * 5) % 2 === 0), hp: e.hp }); c.drawImage(sp, e.x * s - s * 0.15, e.y * s - s * 0.15);
      if (e.hitT > 0 || g.freezeT > 0) { c.fillStyle = e.hitT > 0 ? 'rgba(255,255,255,0.45)' : 'rgba(140,210,255,0.35)'; rr(c, e.x * s + s * 0.04, e.y * s + s * 0.04, s * 0.92, s * 0.92, s * 0.1); c.fill(); }
    });
    g.players.forEach(function (p) {
      if (!p.alive) return; c.drawImage(tankSprite('p' + p.id, p.dir, p.tread, {}), p.x * s - s * 0.15, p.y * s - s * 0.15);
      for (var i = 0; i < p.tier; i++) { c.fillStyle = '#ffe36a'; c.beginPath(); var sx = p.x * s + s * (0.2 + i * 0.12), sy = p.y * s + s * 0.08; for (var j = 0; j < 10; j++) { var a = -Math.PI / 2 + j * Math.PI / 5, rad = j % 2 ? s * 0.02 : s * 0.05; c.lineTo(sx + Math.cos(a) * rad, sy + Math.sin(a) * rad); } c.fill(); }
      if (p.shieldT > 0) { c.save(); c.translate((p.x + 0.5) * s, (p.y + 0.5) * s); c.rotate(t * 3); c.strokeStyle = 'rgba(120,230,255,' + (p.shieldT < 1.5 && Math.floor(t * 8) % 2 ? 0.3 : 0.85) + ')'; c.lineWidth = s * 0.05; c.setLineDash([s * 0.18, s * 0.1]); c.beginPath(); c.arc(0, 0, s * 0.62, 0, 7); c.stroke(); c.restore(); }
    });
    // bullets
    g.bullets.forEach(function (b) {
      var v = E.DIRS[b.dir], x = b.x * s, y = b.y * s, col = b.side === 'p' ? '255,220,90' : '255,110,90';
      c.drawImage(glow(col, 0.9), x - s * 0.22, y - s * 0.22, s * 0.44, s * 0.44);
      c.strokeStyle = 'rgba(' + col + ',0.5)'; c.lineWidth = s * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - v[0] * s * 0.4, y - v[1] * s * 0.4); c.stroke();
      c.fillStyle = '#fff6d0'; if (v[0]) c.fillRect(x - s * 0.1, y - s * 0.05, s * 0.2, s * 0.1); else c.fillRect(x - s * 0.05, y - s * 0.1, s * 0.1, s * 0.2);
    });
    drawParts(c, paused ? 0 : dt);
    for (var ti = 0; ti < treeRects.length; ti += 2) { var rx = Math.max(0, treeRects[ti] * s - s * 0.2), ry = Math.max(0, treeRects[ti + 1] * s - s * 0.2), rw = Math.min(W - rx, s * 1.4), rh = Math.min(W - ry, s * 1.4); c.drawImage(trees, rx, ry, rw, rh, rx, ry, rw, rh); }
    // floating text
    floats = floats.filter(function (f) { f.l += paused ? 0 : dt; if (f.l > 1.1) return false; c.globalAlpha = 1 - f.l / 1.1; c.font = '800 ' + Math.round(s * (f.big ? 0.42 : 0.32)) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.lineWidth = s * 0.07; c.strokeStyle = '#1a1206'; var y = (f.y - f.l * 0.8) * s; c.strokeText(f.s, f.x * s, y); c.fillStyle = f.big ? '#ffe36a' : '#fff'; c.fillText(f.s, f.x * s, y); c.globalAlpha = 1; return true; });
    if (g.freezeT > 0) { c.fillStyle = 'rgba(120,200,255,' + (0.08 + 0.04 * Math.sin(t * 5)) + ')'; c.fillRect(0, 0, W, W); }
    // vignette
    
    c.restore();
  }
  function drawIcon(canvas, kind, css) {
    var d = Math.min(3, root.devicePixelRatio || 1), px = Math.round(css * d); canvas.width = canvas.height = px; canvas.style.width = canvas.style.height = css + 'px';
    var c = canvas.getContext('2d');
    if (E.POWERS.indexOf(kind) >= 0) drawPower(c, 0, 0, px, kind, 0.3);
    else if (kind === 'bird') drawBird(c, 0, 0, px, true, 0);
    else drawTank(c, px * 0.04, px * 0.04, px * 0.92, kind === 'p1' ? 'u' : kind === 'p0' ? 'u' : 'd', kind, 0, kind === 'a' ? { hp: 4 } : {});
  }
  function setMaxDpr(v) { maxDpr = v; }
  function setReduce(v) { reduce = !!v; }
  function stats() { return { w: W, dpr: dpr, frames: frames, parts: parts.length + flashes.length, reduce: reduce, maxDpr: maxDpr, sprites: Object.keys(sprites).length }; }
  root.TK.Render = { setup: setup, resize: resize, frame: frame, onEvents: onEvents, drawIcon: drawIcon, drawTank: drawTank, drawPower: drawPower, drawBird: drawBird, stats: stats, setReduce: setReduce, setMaxDpr: setMaxDpr, boom: boom, invalidate: invalidate };
})(this);
