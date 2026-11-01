// Playwright click-through at 390x844, 844x390, 360x640 and 320x568 (touch), plus desktop keyboard, offline and save checks.
// Run: node tests/browser.js [url]   SHOTS=dir saves JPG screenshots.
const { chromium } = require('playwright-core'), http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert');
const SITE0 = path.join(__dirname, '../site'), TYPES = { html: 'text/html', js: 'text/javascript', json: 'application/json', png: 'image/png', webmanifest: 'application/manifest+json' };
const serve = (SITE = SITE0) => new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(SITE, p); if (!f.startsWith(SITE) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, () => res(s)); });
let passed = 0; const ok = m => { passed++; console.log('ok', m); };
(async () => {
  let base = process.argv[2], server; if (!base) { server = await serve(); base = 'http://127.0.0.1:' + server.address().port + '/'; }
  const single = base.startsWith('file:');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const shotDir = process.env.SHOTS; if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
  const allErrors = [];
  for (const vp of [{ width: 390, height: 844, name: 'portrait' }, { width: 844, height: 390, name: 'landscape' }, { width: 360, height: 640, name: 'small360' }, { width: 320, height: 568, name: 'small320' }, { width: 568, height: 320, name: 'land568' }]) {
    const full = vp.name === 'portrait' || vp.name === 'landscape';
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(), errors = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
    const S = () => page.evaluate(() => TK.UI.state());
    const tap = async sel => { await page.tap(sel); await page.waitForTimeout(400); };
    const shot = async n => { if (shotDir) await page.screenshot({ path: path.join(shotDir, n), type: 'jpeg', quality: 92 }); };
    const layout = async where => {
      const r = await page.evaluate(() => {
        const vis = e => e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
        const box = e => e.getBoundingClientRect(), inter = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        const over = document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1;
        const btns = [...document.querySelectorAll('button')].filter(vis), small = btns.map(e => [e.textContent.slice(0, 20), box(e).width, box(e).height]).filter(b => b[1] < 44 || b[2] < 44);
        const offscreen = btns.filter(e => { const b = box(e); return b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1; }).map(e => e.textContent);
        let clash = [];
        for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) if (inter(box(btns[i]), box(btns[j]))) clash.push(btns[i].textContent + '/' + btns[j].textContent);
        const play = !document.getElementById('play').classList.contains('hidden') && document.getElementById('ov').classList.contains('hidden');
        if (play) { const parts = ['#hud', '#cv', '#dpad0', '#fire0', '#dpad1', '#fire1'].map(s => document.querySelector(s)).filter(vis);
          for (let i = 0; i < parts.length; i++) { const b = box(parts[i]); if (b.left < -1 || b.top < -1 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1) offscreen.push(parts[i].id); for (let j = i + 1; j < parts.length; j++) if (inter(b, box(parts[j]))) clash.push(parts[i].id + '/' + parts[j].id); }
          [...document.querySelectorAll('.dpad .arm')].filter(vis).forEach(a => { const b = box(a); if (b.width < 56 || b.height < 56) small.push(['arm', b.width, b.height]); }); }
        return { over, small, clash, offscreen };
      });
      assert(!r.over, vp.name + ' page scrolls at ' + where); assert.deepStrictEqual(r.small, [], vp.name + ' small targets at ' + where); assert.deepStrictEqual(r.clash, [], vp.name + ' overlaps at ' + where); assert.deepStrictEqual(r.offscreen, [], vp.name + ' off screen at ' + where);
    };
    await page.goto(base, { waitUntil: 'load' }); await page.waitForTimeout(400);
    const label = await page.textContent('#ver'); assert(/^v2 - Oct 31 - \w{7}$/.test(label), 'label ' + label);
    if (!single && full) { const v = await (await page.request.get(base + 'version.json?t=' + Date.now())).json(); assert.strictEqual(label, v.label);
      const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; }); assert(sw); ok(vp.name + ' version label "' + label + '" matches version.json; service worker active'); }
    else ok(vp.name + ' version label "' + label + '"');
    await layout('home'); assert.strictEqual(await page.isVisible('#btnContinue'), false); if (vp.name === 'portrait') await shot('1-home.jpg'); ok(vp.name + ' home: no overlaps, no scrolling, targets >= 44 px, no Continue on first visit');
    if (full) {
      await tap('#home .muteBtn'); assert.strictEqual((await S()).muted, true); assert(/Off/.test(await page.textContent('#home .muteBtn'))); await page.reload(); await page.waitForTimeout(300); assert.strictEqual((await S()).muted, true); await tap('#home .muteBtn'); assert.strictEqual((await S()).muted, false); ok(vp.name + ' mute toggle saved across reload');
      await tap('[data-act=help]'); assert.strictEqual(await page.locator('#powerList canvas').count(), 6); assert.strictEqual(await page.locator('#foeList canvas').count(), 4); await layout('help'); await tap('#help [data-act=home]'); ok(vp.name + ' How to Play shows 6 power-ups and 4 enemy types');
      await tap('[data-act=diff][data-v=hard]'); assert.strictEqual((await S()).save.settings.difficulty, 'hard'); await tap('[data-act=diff][data-v=medium]'); ok(vp.name + ' difficulty select');
    }
    // double tap only starts one game
    await page.dblclick('#btnPlay'); await page.waitForTimeout(600); let s = await S(); assert.strictEqual(s.screen, 'play'); assert.strictEqual(s.level, 0); assert.strictEqual(s.save.run.level, 0); ok(vp.name + ' Play starts once on a double tap');
    await layout('play'); assert(await page.isVisible('#dpad0') && await page.isVisible('#fire0'));
    const cw = await page.evaluate(() => document.getElementById('cv').getBoundingClientRect().width); assert.strictEqual(s.render.dpr, 3); assert(Math.abs(s.render.w - cw * 3) < 2, 'canvas at dpr'); ok(vp.name + ' play: D-pad and fire button shown, no overlaps; canvas ' + s.render.w + ' px at dpr 3');
    // D-pad: hold Right moves only right
    await page.evaluate(() => { const g = TK.UI.game(); g.spawnT = 999; g.enemies = []; const p = g.players[0]; p.x = 1; p.y = 6; p.dir = 'u'; p.shieldT = 99; for (let y = 10; y < 16; y++) for (let x = 0; x < 26; x++) g.map[y][x] = 0; g.mapVer++; });
    const arm = async d => { const b = await page.locator('#dpad0 .arm[data-d=' + d + ']').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
    const R = await arm('r'), U = await arm('u');
    await page.dispatchEvent('#dpad0 .arm[data-d=r]', 'pointerdown', { pointerId: 5, clientX: R.x, clientY: R.y, isPrimary: true });
    assert.strictEqual(await page.locator('#dpad0 .arm.on').count(), 1); await page.waitForTimeout(500);
    await page.dispatchEvent('#dpad0', 'pointerup', { pointerId: 5 }); s = await S(); assert(s.player.x > 1.8 && s.player.y === 6 && s.player.dir === 'r', 'moved right only ' + JSON.stringify(s.player));
    await page.waitForTimeout(250); const x1 = (await S()).player.x; await page.waitForTimeout(250); assert.strictEqual((await S()).player.x, x1, 'stops after release'); assert.strictEqual(await page.locator('#dpad0 .arm.on').count(), 0);
    ok(vp.name + ' D-pad: hold Right drives right only, stops on release, press feedback clears');
    // quick tap (20 ms) still turns and nudges thanks to the tap buffer
    await page.dispatchEvent('#dpad0 .arm[data-d=u]', 'pointerdown', { pointerId: 6, clientX: U.x, clientY: U.y, isPrimary: true }); await page.waitForTimeout(20); await page.dispatchEvent('#dpad0', 'pointerup', { pointerId: 6 }); await page.waitForTimeout(300);
    s = await S(); assert.strictEqual(s.player.dir, 'u'); assert(s.player.y < 6 && s.player.y > 5.3, 'tap nudge ' + s.player.y); ok(vp.name + ' a quick tap on Up turns the tank and nudges it (tap buffer)');
    // hit area is the visible button: the center gap does nothing
    const pb = await page.locator('#dpad0').boundingBox(); const y0 = (await S()).player.y;
    await page.dispatchEvent('#dpad0', 'pointerdown', { pointerId: 7, clientX: pb.x + pb.width / 2, clientY: pb.y + pb.height / 2, isPrimary: true }); await page.waitForTimeout(300);
    assert.strictEqual((await S()).player.y, y0); await page.dispatchEvent('#dpad0', 'pointerup', { pointerId: 7 });
    const hit = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest('.arm') ? 'arm' : 'none'; }, [pb.x + 2, pb.y + 2]); assert.strictEqual(hit, 'none', 'corner gap is not a button');
    ok(vp.name + ' D-pad center and corners do nothing (hit area = visible arms)');
    // real touch: slide from Right to Down without lifting switches direction
    { const cdp = await ctx.newCDPSession(page), D = await arm('d');
      await page.evaluate(() => { const p = TK.UI.game().players[0]; p.x = 4; p.y = 5; p.dir = 'u'; const g = TK.UI.game(); for (let y = 10; y < 20; y++) for (let x = 0; x < 26; x++) g.map[y][x] = 0; g.mapVer++; });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: R.x, y: R.y, id: 1 }] }); await page.waitForTimeout(200); let a = await S(); assert.strictEqual(a.player.dir, 'r');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: D.x, y: D.y, id: 1 }] }); await page.waitForTimeout(250); a = await S(); assert.strictEqual(a.player.dir, 'd'); assert(a.player.y > 5);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200); ok(vp.name + ' real touch: sliding from Right to Down switches direction'); }
    // fire button fires; holding fires more
    { const fb = await page.locator('#fire0').boundingBox(); await page.evaluate(() => { const g = TK.UI.game(); g.bullets = []; const p = g.players[0]; p.cool = 0; });
      let n = 0; await page.exposeFunction('countShot', () => n++).catch(() => {});
      await page.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.waitForTimeout(50); const b = await page.evaluate(() => TK.UI.game().bullets.length + TK.UI.game().players[0].cool); assert(b > 0, 'fired');
      await page.evaluate(() => { TK.UI.game().players[0].tier = 2; }); ok(vp.name + ' FIRE button shoots'); }
    if (vp.name === 'portrait' || vp.name === 'small320' || vp.name === 'landscape') {
      // staged scene for the screenshots: explosion, enemies, power-up
      await page.evaluate(() => { const g = TK.UI.game(), E = TK.Engine; g.spawnT = 999;
        const mk = (type, x, y, dir, extra) => { const T = E.TYPES[type]; g.enemies.push(Object.assign({ id: 900 + g.enemies.length, kind: 'enemy', type, x, y, dir, hp: T.hp, maxHp: T.hp, alive: true, spawning: 0, spawnSafe: 99, bonus: false, think: 99, cool: 99, stuckT: 0, lx: x, ly: y, tread: 0, hitT: 0 }, extra || {})); };
        g.spawned = Math.min(g.queue.length, g.spawned + 4); mk('b', 2, 1, 'd'); mk('f', 9, 3, 'l'); mk('a', 11, 6, 'd', { hp: 3 }); mk('r', 6, 4, 'd', { bonus: true });
        const p = g.players[0]; p.x = 6; p.y = 9; p.dir = 'u'; p.tier = 2; p.shieldT = 4; g.power = { kind: 'star', x: 3, y: 9, t: 15 };
        E.fire(g, p, 14, false, 2); E.fire(g, g.enemies[1], 9, false, 1); TK.Render.boom(9.5, 6.5, true); TK.Render.boom(2.5, 2.5, true); TK.Render.onEvents(g); g.events = []; });
      await page.waitForTimeout(110);
      if (vp.name === 'portrait') { await shot('2-gameplay-explosion.jpg'); }
      if (vp.name === 'landscape') await shot('4-landscape.jpg');
      if (vp.name === 'small320') await shot('5-small-phone-320.jpg');
      if (vp.name === 'portrait') { await page.evaluate(() => { const g = TK.UI.game(), p = g.players[0]; g.bullets = []; g.power = { kind: 'clock', x: 2, y: 7, t: 15 }; p.x = 6; p.y = 9; g.events = []; TK.Engine.applyPower(g, p, 'shovel'); TK.Render.onEvents(g); g.events = []; });
        await page.waitForTimeout(350); await shot('3-power-up.jpg'); assert.strictEqual(await page.evaluate(() => TK.UI.game().map[22][12]), 2); }
    }
    // pause saves the exact spot; reload + Continue resumes it
    const before = await page.evaluate(() => { const g = TK.UI.game(); g.players[0].score = 2500; g.players[0].tier = 2; g.killed = 7; return { score: 2500, killed: 7, spawned: g.spawned, x: g.players[0].x }; });
    await tap('#hud [data-act=pause]'); s = await S(); assert.strictEqual(s.paused, true); assert.strictEqual(await page.textContent('#ovTitle'), 'Paused'); assert(/Saved right here/.test(await page.textContent('#ovText'))); await layout('pause');
    await tap('#ov [data-act=home]'); assert(await page.isVisible('#btnContinue')); await page.reload(); await page.waitForTimeout(300); assert(await page.isVisible('#btnContinue'));
    await tap('#btnContinue'); s = await S(); assert.strictEqual(s.screen, 'play'); assert.strictEqual(s.level, 0);
    const after = await page.evaluate(() => { const g = TK.UI.game(); return { score: g.players[0].score, killed: g.killed, spawned: g.spawned, tier: g.players[0].tier }; });
    assert.strictEqual(after.score, 2500); assert.strictEqual(after.killed, 7); assert.strictEqual(after.spawned, before.spawned); assert.strictEqual(after.tier, 2);
    ok(vp.name + ' pause saves mid-level; Continue after reload resumes the same spot (score, kills, gun, enemies left)');
    if (full) { await page.evaluate(() => history.back()); await page.waitForTimeout(500); s = await S(); assert.strictEqual(s.paused, true); assert(page.url().startsWith(base.split('#')[0].slice(0, 10)));
      await tap('#ov [data-act=resume]'); s = await S(); assert.strictEqual(s.paused, false); ok(vp.name + ' Back button pauses the game instead of leaving'); }
    // win a level -> next level
    await page.evaluate(() => { const g = TK.UI.game(); g.spawned = g.queue.length; g.enemies = []; }); await page.waitForTimeout(2300); assert.strictEqual(await page.textContent('#ovTitle'), 'Level Clear!'); await layout('level clear');
    await tap('#ov [data-act=next]'); s = await S(); assert.strictEqual(s.level, 1); assert.strictEqual(s.save.run.level, 1); ok(vp.name + ' clearing all enemies shows Level Clear and Next Level goes to level 2');
    // bird hit -> game over, Try Again
    await page.evaluate(() => { const g = TK.UI.game(), E = TK.Engine; E.FORT.forEach(c => g.map[c[1]][c[0]] = 0); g.mapVer++; g.spawnT = 999; const T = E.TYPES.b; g.birdHp = 1; g.enemies = [{ id: 77, kind: 'enemy', type: 'b', x: 6, y: 10.6, dir: 'd', hp: 1, maxHp: 1, alive: true, spawning: 0, spawnSafe: 99, bonus: false, think: 99, cool: 99, stuckT: 0, lx: 6, ly: 10.6, tread: 0, hitT: 0 }]; g.players[0].x = 1; g.players[0].y = 1; E.fire(g, g.enemies[0], 9, false, 1); });
    await page.waitForTimeout(2600); assert.strictEqual(await page.textContent('#ovTitle'), 'The bird was hit!'); await layout('game over'); await tap('#ov [data-act=retry]'); s = await S(); assert.strictEqual(s.level, 1); assert.strictEqual(s.status, 'play'); ok(vp.name + ' bird hit ends the level; Try Again restarts it');
    if (vp.name === 'landscape' || vp.name === 'land568') { // 2 players with a split touch pad
      await tap('#hud [data-act=pause]'); await tap('#ov [data-act=home]'); await tap('#btnTwo'); s = await S(); assert.strictEqual(s.twoP, true); assert(await page.isVisible('#dpad1') && await page.isVisible('#fire1')); await layout('2 players');
      await page.evaluate(() => { const g = TK.UI.game(); g.spawnT = 999; g.players[1].x = 10; g.players[1].y = 8; for (let y = 14; y < 20; y++) for (let x = 0; x < 26; x++) g.map[y][x] = 0; g.mapVer++; });
      const L2 = await page.locator('#dpad1 .arm[data-d=l]').boundingBox(); await page.dispatchEvent('#dpad1 .arm[data-d=l]', 'pointerdown', { pointerId: 9, clientX: L2.x + L2.width / 2, clientY: L2.y + L2.height / 2, isPrimary: true }); await page.waitForTimeout(400); await page.dispatchEvent('#dpad1', 'pointerup', { pointerId: 9 });
      s = await page.evaluate(() => TK.UI.game().players.map(p => [p.x, p.dir])); assert(s[1][0] < 9.5 && s[1][1] === 'l' && s[0][0] === 4, JSON.stringify(s)); ok(vp.name + ' 2 players: split touch pad with 56 px arms, right pad drives player 2 only');
      if (shotDir && vp.name === 'landscape') { await page.evaluate(() => { TK.Render.boom(6.5, 5.5, true); TK.Render.onEvents(TK.UI.game()); }); await page.waitForTimeout(100); await shot('6-landscape-2-players.jpg'); }
    }
    if (vp.name === 'portrait') {
      await tap('#hud [data-act=pause]'); await tap('#ov [data-act=home]'); await tap('#btnTwo'); await page.waitForTimeout(300); s = await S(); assert.strictEqual(s.blocked, true); assert(await page.isVisible('#rotate'));
      const t0 = await page.evaluate(() => TK.UI.game().t); await page.waitForTimeout(600); assert.strictEqual(await page.evaluate(() => TK.UI.game().t), t0, 'game waits'); assert.strictEqual(await page.isVisible('#dpad1'), false); await layout('2P portrait');
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(400); s = await S(); assert.strictEqual(s.blocked, false); await page.waitForTimeout(300); assert(await page.evaluate(() => TK.UI.game().t) > t0); await layout('2P turned');
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); ok('2 players in portrait waits behind the turn-your-phone message, and plays once turned');
      await tap('#hud [data-act=pause]'); await tap('#ov [data-act=home]'); }
    assert.deepStrictEqual(errors, [], vp.name + ' console errors'); ok(vp.name + ' 0 console errors or warnings'); allErrors.push(...errors);
    await ctx.close();
  }
  // board fits at 1024x600; canvas snapped to device pixels at fractional DPR; reduced motion honored
  for (const [w, h, dsf, touch] of [[1024, 600, 1, false], [412, 915, 2.625, true], [1440, 900, 1.25, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' }), page = await ctx.newPage();
    await page.goto(base); await page.waitForTimeout(300); await page.click('#btnPlay'); await page.waitForTimeout(400);
    const r = await page.evaluate(() => { const b = document.getElementById('cv').getBoundingClientRect(), d = devicePixelRatio; return { bottom: b.bottom, right: b.right, h: innerHeight, w: innerWidth, l: b.left * d, t: b.top * d, reduce: TK.Render.stats().reduce }; });
    assert(r.bottom <= r.h && r.right <= r.w, w + 'x' + h + ' board cut off'); assert(Math.abs(r.l - Math.round(r.l)) < 0.05 && Math.abs(r.t - Math.round(r.t)) < 0.05, 'pixel snap (within 1/64 css layout unit) ' + JSON.stringify(r)); assert.strictEqual(r.reduce, true);
    ok(w + 'x' + h + ' @' + dsf + ': board fully on screen, canvas on whole device pixels, reduced motion honored'); await ctx.close(); }
  // service worker update waits during play AND pause, and applies at Home
  if (!single) { const tmp = fs.mkdtempSync('/tmp/tk-sw-'); fs.cpSync(SITE0, tmp, { recursive: true }); const srv = await serve(tmp), u = 'http://127.0.0.1:' + srv.address().port + '/';
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(); await page.goto(u); await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await page.waitForTimeout(500);
    await page.click('#btnPlay'); await page.waitForTimeout(300); await page.keyboard.press('KeyP'); await page.evaluate(() => { window.__marker = 1; });
    const v = JSON.parse(fs.readFileSync(tmp + '/version.json')); v.id = 'newbuild'; fs.writeFileSync(tmp + '/version.json', JSON.stringify(v)); fs.appendFileSync(tmp + '/sw.js', '\n// new');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(6000);
    assert.strictEqual(await page.evaluate(() => window.__marker), 1, 'reloaded while paused'); assert.strictEqual(await page.evaluate(() => TK.UI.state().paused), true);
    await page.click('#ov [data-act=home]'); await page.waitForTimeout(5000); assert.strictEqual(await page.evaluate(() => window.__marker), undefined, 'update applied at Home');
    ok('service worker update waits while paused (6 s) and applies once back at Home'); await ctx.close(); srv.close(); }
  // desktop keyboard, 2 players, corrupt save, offline
  { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), page = await ctx.newPage(), errors = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('tank_save', '{"v":1,"run":{"level":"bad"'); } });
    await page.goto(base); await page.waitForTimeout(300); assert.strictEqual(await page.isVisible('#btnContinue'), false); assert.strictEqual(await page.isVisible('#dpad0'), false); ok('desktop: corrupt save ignored without errors; no touch pad on desktop');
    await page.click('#btnTwo'); await page.waitForTimeout(400);
    await page.evaluate(() => { const g = TK.UI.game(); g.spawnT = 999; for (let y = 14; y < 26; y++) for (let x = 0; x < 26; x++) if (g.map[y][x] !== 6 && !TK.Engine.FORT.some(c => c[0] === x && c[1] === y)) g.map[y][x] = 0; g.mapVer++; });
    await page.keyboard.down('KeyW'); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('KeyW'); await page.keyboard.up('ArrowUp');
    let p = await page.evaluate(() => TK.UI.game().players.map(q => [q.x, q.y, q.dir])); assert(p[0][1] < 12 && p[0][2] === 'u' && p[1][1] < 12 && p[1][2] === 'u' && p[0][0] === 4 && p[1][0] === 8, JSON.stringify(p));
    await page.evaluate(() => { TK.UI.game().players.forEach(q => q.cool = 0); }); await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await page.waitForTimeout(30); const nb = await page.evaluate(() => TK.UI.game().bullets.filter(b => b.side === 'p').map(b => b.owner.id).sort().join()); assert.strictEqual(nb, '0,1');
    await page.keyboard.press('KeyP'); assert.strictEqual((await page.evaluate(() => TK.UI.state())).paused, true); await page.keyboard.press('Escape'); assert.strictEqual((await page.evaluate(() => TK.UI.state())).paused, false);
    ok('desktop keyboard: W A S D + Space for player 1, arrows + Enter for player 2, P and Escape pause and resume');
    if (!single) { await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(500); assert(/^v2/.test(await page.textContent('#ver'))); await page.click('#btnPlay'); await page.waitForTimeout(400); assert.strictEqual((await page.evaluate(() => TK.UI.state())).screen, 'play'); await ctx.setOffline(false); ok('offline: page reloads from the service worker cache and plays');
      const man = await (await page.request.get(base + 'manifest.webmanifest')).json(); assert(man.icons.length >= 4 && man.display === 'standalone'); const sw = await (await page.request.get(base + 'sw.js')).text(); assert(/NETWORK-FIRST/.test(sw) && /skipWaiting/.test(sw)); ok('manifest with icons; network-first, self-updating service worker'); }
    assert.deepStrictEqual(errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)), []); ok('desktop 0 console errors'); await ctx.close(); }
  await browser.close(); if (server) server.close();
  console.log(passed + ' browser checks passed' + (single ? ' (single file copy)' : ''));
})().catch(e => { console.error(e); process.exit(1); });
