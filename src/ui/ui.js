// Screens, layout, touch and keyboard controls, the game loop, save and resume.
(function (root) {
  var TK = root.TK, E = TK.Engine, R = TK.Render, A = TK.Audio, S = TK.Save;
  var $ = function (id) { return document.getElementById(id); };
  var store = (function () { try { var k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { var m = {}; return { getItem: function (k) { return m[k] || null; }, setItem: function (k, v) { m[k] = String(v); } }; } })();
  var data = S.read(store, E.LEVELS.length);
  var st = { screen: 'home', g: null, paused: false, frames: 0, handled: false, twoP: false };
  var touch = (root.matchMedia && root.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in root) || navigator.maxTouchPoints > 0;
  document.body.classList.toggle('touch', touch);
  function save() { S.write(store, data); }
  function show(id) { ['home', 'help', 'play', 'ov'].forEach(function (s) { $(s).classList.toggle('hidden', !(s === id || (id === 'ov' && s === 'play'))); }); st.screen = id; if (id === 'home') refreshHome(); if (id === 'play' || id === 'ov') layout(); A.music(id === 'play' && !st.paused); }
  function refreshHome() {
    $('btnContinue').classList.toggle('hidden', !data.run);
    if (data.run) $('btnContinue').textContent = 'Continue: Level ' + (data.run.level + 1) + (data.run.twoP ? ' (2P)' : '');
    [].forEach.call(document.querySelectorAll('[data-act=diff]'), function (b) { b.classList.toggle('on', b.dataset.v === data.settings.difficulty); });
    $('best').textContent = data.best ? 'Best score: ' + data.best : '';
    refreshMute();
  }
  function refreshMute() { A.setMuted(data.settings.muted); [].forEach.call(document.querySelectorAll('.muteBtn'), function (b) { if (b.classList.contains('icon')) { b.style.opacity = data.settings.muted ? 0.45 : 1; b.setAttribute('aria-pressed', String(data.settings.muted)); } else b.textContent = 'Sound: ' + (data.settings.muted ? 'Off' : 'On'); }); }

  // ---------- layout: everything placed by measured boxes so nothing overlaps ----------
  var lay = {};
  function place(el, x, y, w, h) { el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px'; el.style.width = Math.round(w) + 'px'; el.style.height = Math.round(h) + 'px'; }
  function placePad(id, x, y, s) { var p = $(id), a = s / 3; place(p, x, y, s, s); var g = a * 0.03, pos = { u: [a, 0], l: [0, a], r: [2 * a, a], d: [a, 2 * a] }; [].forEach.call(p.children, function (arm) { var q = pos[arm.dataset.d]; place(arm, q[0] + g, q[1] + g, a - 2 * g, a - 2 * g); }); }
  var PAD_MIN = 180, GAP = 16; // GAP: free space between FIRE and the D-pad (QA v2 MAJ-1) // D-pad arms stay at least 56 px at every size (arm = 0.94 x pad / 3)
  function layout() {
    var vw = root.innerWidth, vh = root.innerHeight, hud = 52, two = st.twoP, land = vw > vh, dpr = Math.min(3, root.devicePixelRatio || 1);
    st.blocked = !!(two && touch && !land); // 2 players on a phone needs landscape: the game waits behind the message
    document.body.classList.toggle('two', two && touch); document.body.classList.toggle('landscape', land); document.body.classList.toggle('blocked', st.blocked);
    $('rotate').classList.toggle('hidden', !st.blocked);
    var top = hud + 6, availH = vh - top - 6, board, bx, by;
    if (!touch || st.blocked) { board = Math.min(vw - 16, availH); bx = (vw - board) / 2; by = top; }
    else if (land) {
      var side = PAD_MIN + 14; board = Math.max(120, Math.min(availH, vw - 2 * side)); bx = (vw - board) / 2; by = top + (availH - board) / 2;
      var sw = bx - 8, sh = availH;
      if (!two) { var ds = Math.max(PAD_MIN, Math.min(sw - 12, sh - 12, 210)), fs = Math.min(sw * 0.72, sh * 0.5, 140); placePad('dpad0', 6 + (sw - ds) / 2, top + (sh - ds) / 2, ds); place($('fire0'), vw - 6 - sw + (sw - fs) / 2, top + (sh - fs) / 2, fs, fs); }
      else { var d2 = Math.max(PAD_MIN, Math.min(sw - 12, sh - 70, 186)), f2 = Math.max(54, Math.min(sh - d2 - GAP - 6, sw * 0.5, 96)), gy = top + (sh - d2 - f2 - GAP) / 2;
        placePad('dpad0', 6 + (sw - d2) / 2, gy, d2); place($('fire0'), 6 + (sw - f2) / 2, gy + d2 + GAP, f2, f2);
        placePad('dpad1', vw - 6 - sw + (sw - d2) / 2, gy, d2); place($('fire1'), vw - 6 - sw + (sw - f2) / 2, gy + d2 + GAP, f2, f2); }
    } else {
      board = Math.min(vw - 8, availH - PAD_MIN - 22); bx = (vw - board) / 2; by = top;
      var cy = by + board + 10, ch = vh - cy - 8;
      var px = Math.max(8, vw * 0.04), fr = vw - Math.max(10, vw * 0.05), ps = Math.max(PAD_MIN, Math.min(ch - 8, vw * 0.54, 210)), fb = Math.min(ch * 0.75, fr - px - ps - GAP, 136);
      placePad('dpad0', px, cy + (ch - ps) / 2, ps); place($('fire0'), fr - fb, cy + (ch - fb) / 2, fb, fb);
    }
    var css = R.resize(board), c = $('cv');
    // snap the canvas to whole device pixels so fractional DPR screens stay crisp
    c.style.left = Math.round((bx + (board - css) / 2) * dpr) / dpr + 'px'; c.style.top = Math.round((by + (board - css) / 2) * dpr) / dpr + 'px';
    lay = { board: css, land: land, blocked: st.blocked };
  }
  root.addEventListener('resize', function () { if (st.screen === 'play' || st.screen === 'ov') layout(); });

  // ---------- input ----------
  var keys = [[], []], keyFire = [false, false], fireQ = [false, false], touchFire = [false, false];
  var KMAP = { KeyW: [0, 'u'], KeyS: [0, 'd'], KeyA: [0, 'l'], KeyD: [0, 'r'], ArrowUp: [1, 'u'], ArrowDown: [1, 'd'], ArrowLeft: [1, 'l'], ArrowRight: [1, 'r'] };
  function who(code) { var m = KMAP[code]; if (!m) return null; return [st.twoP ? m[0] : 0, m[1]]; }
  function fireWho(code) { return st.twoP && (code === 'Enter' || code === 'NumpadEnter') ? 1 : 0; }
  root.addEventListener('keydown', function (e) {
    A.init();
    if (e.code === 'KeyP' || e.code === 'Escape') { if (st.screen === 'play' && !st.paused) pause(); else if (st.paused && st.g) resume(); return; }
    var m = who(e.code); if (m) { e.preventDefault(); var a = keys[m[0]]; if (a.indexOf(m[1]) < 0) a.push(m[1]); return; }
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { if (st.screen !== 'play' || st.paused) return; e.preventDefault(); var i = fireWho(e.code); if (!e.repeat) fireQ[i] = true; keyFire[i] = true; }
  });
  root.addEventListener('keyup', function (e) { var m = who(e.code); if (m) { var a = keys[m[0]], i = a.indexOf(m[1]); if (i >= 0) a.splice(i, 1); } if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') keyFire[fireWho(e.code)] = false; });
  root.addEventListener('blur', function () { keys = [[], []]; keyFire = [false, false]; if (st.screen === 'play') pause(); });
  // D-pad (lessons from Blast Maze v8):
  //  - only the arm you press drives the tank, and the tank only moves in that direction;
  //  - the hit area is the visible arm button (gaps and the middle do nothing); sliding onto another arm switches to it;
  //  - a short tap buffer: a quick tap is held for at least TAP seconds so a tap always turns the tank and nudges it;
  //  - the newest finger wins; letting go stops the tank (after the tap buffer).
  // Grid alignment on turns lives in the engine (E.turn): it only snaps when close and the spot is free.
  var TAP = 0.12, pads = [{ pts: {}, seq: 0, dir: null, hold: null, holdUntil: 0 }, { pts: {}, seq: 0, dir: null, hold: null, holdUntil: 0 }];
  function now() { return performance.now() / 1000; }
  function setupPad(i) {
    var el = $('dpad' + i), P = pads[i];
    function armAt(x, y) { var t = document.elementFromPoint(x, y); var a = t && t.closest ? t.closest('.arm') : null; return a && a.parentNode === el ? a.dataset.d : null; }
    function refresh() { var best = null; for (var k in P.pts) if (P.pts[k].d && (!best || P.pts[k].s > best.s)) best = P.pts[k]; P.dir = best ? best.d : null; [].forEach.call(el.children, function (a) { a.classList.toggle('on', a.dataset.d === (P.dir || (P.holdUntil > now() ? P.hold : null))); }); }
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); var d = e.target.closest && e.target.closest('.arm') ? e.target.closest('.arm').dataset.d : null; if (!d) return; A.init();
      try { el.setPointerCapture(e.pointerId); } catch (x) { }
      P.pts[e.pointerId] = { d: d, s: ++P.seq, t0: now() }; P.hold = d; P.holdUntil = now() + TAP; refresh(); if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { }
    });
    el.addEventListener('pointermove', function (e) { var p = P.pts[e.pointerId]; if (!p) return; var d = armAt(e.clientX, e.clientY); if (d && d !== p.d) { p.d = d; p.s = ++P.seq; P.hold = d; P.holdUntil = now() + TAP; refresh(); } e.preventDefault(); });
    function up(e) { if (!P.pts[e.pointerId]) return; delete P.pts[e.pointerId]; refresh(); setTimeout(refresh, TAP * 1000 + 20); }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var f = $('fire' + i), held = {};
    f.addEventListener('pointerdown', function (e) {
      e.preventDefault(); var b = f.getBoundingClientRect(), rx = e.clientX - (b.left + b.width / 2), ry = e.clientY - (b.top + b.height / 2);
      if ((e.clientX || e.clientY) && rx * rx + ry * ry > (b.width / 2) * (b.width / 2)) return; // round button: only the visible circle
      A.init(); try { f.setPointerCapture(e.pointerId); } catch (x) { } held[e.pointerId] = 1; fireQ[i] = true; touchFire[i] = true; f.classList.add('on'); if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) { }
    });
    function fup(e) { delete held[e.pointerId]; if (!Object.keys(held).length) { touchFire[i] = false; f.classList.remove('on'); } }
    f.addEventListener('pointerup', fup); f.addEventListener('pointercancel', fup); f.addEventListener('lostpointercapture', fup); f.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  setupPad(0); setupPad(1);
  function padDir(i) { var P = pads[i]; if (P.dir) return P.dir; if (P.hold && P.holdUntil > now()) return P.hold; return null; }
  function inputs() {
    return [0, 1].map(function (i) { var a = keys[i], d = padDir(i) || (a.length ? a[a.length - 1] : null); var o = { dir: d, fire: fireQ[i] || keyFire[i] || touchFire[i] }; fireQ[i] = false; return o; });
  }
  TK.UI_DEBUG = { pads: pads, padDir: padDir };

  // Back button (Android / browser): during a game it pauses instead of leaving.
  var hist = false;
  function guardBack() { if (!hist && root.history && history.pushState) { try { history.pushState({ tk: 1 }, ''); hist = true; } catch (e) { } } }
  root.addEventListener('popstate', function () { hist = false; if (st.g && st.paused) { act('home'); return; } // second Back on the pause screen goes Home (the run is already saved)
    if (st.g && (st.screen === 'play' || st.screen === 'ov')) { if (st.screen === 'play' && !st.paused) pause(); guardBack(); } });
  // ---------- buttons (debounced) ----------
  var lastTap = 0;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-act]'); if (!b) return; var t = Date.now(); if (t - lastTap < 350) return; lastTap = t;
    A.init(); A.sfx('tap'); act(b.dataset.act, b.dataset.v);
  });
  function act(a, v) {
    switch (a) {
      case 'play': var two = v === '2'; startLevel(0, null, two, data.settings.difficulty, 0); break;
      case 'continue': if (data.run) { data.settings.difficulty = data.run.difficulty; var rg = data.run.snap ? E.restore(data.run.snap) : null; if (rg && rg.level === data.run.level) { st.twoP = rg.twoP; st.g = rg; R.invalidate(); st.paused = false; st.handled = false; keys = [[], []]; guardBack(); show('play'); A.sfx('start'); } else { if (data.run.snap) { data.run.snap = null; save(); } startLevel(data.run.level, data.run.carry, data.run.twoP, data.run.difficulty, data.run.attempt); } } break;
      case 'diff': data.settings.difficulty = v; save(); refreshHome(); break;
      case 'mute': data.settings.muted = !data.settings.muted; save(); refreshMute(); break;
      case 'help': show('help'); break;
      case 'home': st.g = null; R.invalidate(); st.paused = false; show('home'); break;
      case 'pause': pause(); break;
      case 'resume': resume(); break;
      case 'restart': var r = data.run; if (r) startLevel(r.level, entryClone(r), r.twoP, r.difficulty, r.attempt + 1); break;
      case 'next': if (data.run) startLevel(data.run.level, data.run.carry, data.run.twoP, data.run.difficulty, 0); break;
      case 'retry': var q = data.run; if (q) startLevel(q.level, retryClone(q), q.twoP, q.difficulty, q.attempt + 1); break;
    }
  }
  // Immutable level-entry checkpoint: score/lives/gun at the moment this level began.
  // Restart restores entry as-is. Try Again / post-loss Continue without snap use entry score with full lives and tier 0.
  // Mid-level pause updates carry (+snap) only; entry never ratchets upward from kills in the current attempt.
  function cloneRes(c) { return { lives: c.lives, tier: c.tier, score: c.score }; }
  function entryClone(run) { return (run.entry || run.carry).map(cloneRes); }
  function retryClone(run) {
    return (run.entry || run.carry).map(function (c) { return { lives: E.DIFF[run.difficulty].lives, tier: 0, score: c.score }; });
  }
  function startLevel(level, carry, twoP, diff, attempt) {
    st.twoP = twoP; attempt = attempt || 0;
    var seed = (level + 1) * 7919 + attempt * 104729 + (twoP ? 13 : 0);
    st.g = E.newGame({ level: level, difficulty: diff, twoP: twoP, carry: carry, seed: seed }); R.invalidate();
    var started = E.carry(st.g).map(cloneRes);
    data.run = { level: level, difficulty: st.g.diff, twoP: twoP, attempt: attempt, carry: started.map(cloneRes), entry: started, snap: null }; save();
    st.paused = false; st.handled = false; keys = [[], []]; guardBack(); show('play'); A.sfx('start');
  }
  function overlay(title, text, btns) {
    $('ovTitle').textContent = title; $('ovText').textContent = text; var box = $('ovBtns'); box.innerHTML = '';
    btns.forEach(function (b) { var el = document.createElement('button'); el.textContent = b[0]; el.dataset.act = b[1]; if (b[2]) el.className = b[2]; box.appendChild(el); });
    show('ov');
  }
  function pause() {
    if (!st.g || st.g.status !== 'play' || st.paused) return; st.paused = true; A.music(false);
    // save progress: the level you are on with the lives, gun and score you started it with
    saveHere();
    overlay('Paused', 'Saved right here. Level ' + (st.g.level + 1) + ': ' + st.g.name + '.', [['Resume', 'resume', 'big'], ['Restart Level', 'restart'], ['Home', 'home', 'back']]);
  }
  function saveHere() { if (st.g && st.g.status === 'play' && data.run) { data.run.snap = E.snapshot(st.g); data.run.carry = E.carry(st.g); /* keep data.run.entry = level-start checkpoint */ } save(); }
  root.addEventListener('pagehide', function () { if (st.g) saveHere(); });
  function resume() { if (!st.g) { st.paused = false; show('home'); return; } st.paused = false; show('play'); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && st.screen === 'play') pause(); });
  function outcome() {
    var g = st.g; if (st.handled || g.status === 'play' || g.endT < 1.6) return; st.handled = true; A.music(false);
    var score = g.players.reduce(function (s, p) { return s + p.score; }, 0); if (score > data.best) data.best = score;
    if (g.status === 'won') {
      A.sfx('win');
      if (g.level + 1 >= E.LEVELS.length) { data.run = null; save(); overlay('You won!', 'You cleared all ' + E.LEVELS.length + ' levels and kept the bird safe. Score: ' + score + '. Great teamwork!', [['Play Again', 'play', 'big'], ['Home', 'home', 'back']]); return; }
      var nx = E.carry(g).map(cloneRes); data.run = { level: g.level + 1, difficulty: g.diff, twoP: g.twoP, attempt: 0, carry: nx.map(cloneRes), entry: nx, snap: null }; save();
      overlay('Level Clear!', g.name + ' is safe. Score: ' + score + '.', [['Next Level', 'next', 'big'], ['Home', 'home', 'back']]);
    } else {
      A.sfx('lose');
      if (data.run) {
        data.run.snap = null;
        // Drop mid-attempt carry so Home → Continue after a loss cannot bank replayed points (same baseline as Try Again).
        data.run.carry = retryClone(data.run);
      }
      save();
      overlay(g.reason === 'bird' ? 'The bird was hit!' : 'Out of tanks!', 'Nice try! Try level ' + (g.level + 1) + ' again with full lives.', [['Try Again', 'retry', 'big'], ['Home', 'home', 'back']]);
    }
  }
  var SFX = { shoot: 1, brick: 1, clank: 1, armor: 1, boom: 1, bird: 1, spawn: 1, powerdrop: 1, pickup: 1, deflect: 1, pdie: 1 };
  function sounds(g) { g.events.forEach(function (e) { if (e.t === 'shoot') A.sfx(e.side === 'player' ? 'shoot' : 'eshoot'); else if (SFX[e.t]) A.sfx(e.t); }); }
  function updateHud() {
    var g = st.g; if (!g) return;
    var l = 'L' + (g.level + 1), m = '<span class="chip" title="Enemies left">&#9632; ' + E.remaining(g) + '</span>';
    g.players.forEach(function (p, i) { m += '<span class="chip p' + i + '">' + (g.twoP ? 'P' + (i + 1) + ' ' : '') + '&#9829;' + Math.max(0, p.lives) + (p.tier ? ' &#9733;' + p.tier : '') + '</span>'; });
    var sc = g.players.reduce(function (s, p) { return s + p.score; }, 0);
    if (g.birdMax > 1) m += '<span class="chip bird" title="Bird">Bird ' + g.birdHp + '</span>';
    m += '<span class="chip">' + sc + '</span>';
    if (l !== lastHud[0]) { $('hudL').innerHTML = '<span class="chip">' + l + '</span>'; lastHud[0] = l; }
    if (m !== lastHud[1]) { $('hudM').innerHTML = m; lastHud[1] = m; }
  }
  var lastHud = ['', ''];
  // ---------- loop ----------
  var lastT = 0, acc = 0, STEP = 1 / 60, slow = 0;
  function loop(t) {
    requestAnimationFrame(loop); var dt = Math.min(0.1, (t - (lastT || t)) / 1000); lastT = t; st.frames++;
    var g = st.g; if (!g || (st.screen !== 'play' && st.screen !== 'ov')) return;
    if (!st.paused && !st.blocked) { acc += dt; var n = 0; while (acc >= STEP && n++ < 6) { E.step(g, inputs(), STEP); R.onEvents(g); sounds(g); acc -= STEP; } if (acc > STEP) acc = 0; }
    R.frame(g, st.paused || st.blocked ? 0 : dt, st.paused || st.blocked);
    // Slow device guard: if frames stay slow for about 2 s, draw at 2x instead of 3x (still sharp), then at 1.5x.
    if (!st.paused && dt > 0) { slow = slow * 0.97 + (dt > 0.024 ? 0.03 : 0); if (slow > 0.6 && R.stats().maxDpr > 1.5) { R.setMaxDpr(R.stats().maxDpr > 2 ? 2 : 1.5); slow = 0; layout(); } } updateHud(); outcome();
  }
  // ---------- init ----------
  $('ver').textContent = TK_BUILD.label;
  R.setup($('cv'));
  if (root.matchMedia) { var rm = root.matchMedia('(prefers-reduced-motion: reduce)'); R.setReduce(rm.matches); if (rm.addEventListener) rm.addEventListener('change', function () { R.setReduce(rm.matches); }); }
  (function logo() { var c = $('logoArt'), d = Math.min(3, root.devicePixelRatio || 1), s = 132; c.width = c.height = s * d; c.style.width = c.style.height = s + 'px'; var x = c.getContext('2d');
    R.drawBird(x, s * d * 0.3, s * d * 0.5, s * d * 0.4, true, 0); R.drawTank(x, s * d * 0.02, s * d * 0.06, s * d * 0.46, 'r', 'p0', 0); R.drawTank(x, s * d * 0.54, s * d * 0.04, s * d * 0.44, 'l', 'p1', 0); })();
  var names = { star: 'Star: better gun', shield: 'Shield', shovel: 'Shovel: steel fort', bomb: 'Bomb: clears enemies', clock: 'Clock: freeze', tank: 'Tank: extra life' };
  E.POWERS.forEach(function (k) { var d = document.createElement('div'), c = document.createElement('canvas'); R.drawIcon(c, k, 30); d.appendChild(c); d.appendChild(document.createTextNode(names[k])); $('powerList').appendChild(d); });
  ['b', 'f', 'r', 'a'].forEach(function (k) { var d = document.createElement('div'), c = document.createElement('canvas'); R.drawIcon(c, k, 30); d.appendChild(c); d.appendChild(document.createTextNode(E.TYPES[k].name + (k === 'a' ? ' (4 hits)' : ''))); $('foeList').appendChild(d); });
  show('home'); requestAnimationFrame(loop);
  TK.UI = { state: function () { var g = st.g; return { inGame: !!g && (st.screen === 'play' || st.screen === 'ov'), blocked: !!st.blocked, screen: st.screen, paused: st.paused, frames: st.frames, save: data, status: g && g.status, level: g && g.level, twoP: st.twoP,
      player: g && { x: g.players[0].x, y: g.players[0].y, dir: g.players[0].dir, alive: g.players[0].alive, tier: g.players[0].tier, lives: g.players[0].lives }, render: R.stats(), muted: data.settings.muted, layout: lay, audio: A.state() }; },
    game: function () { return st.g; }, save: save, start: startLevel };
})(this);
