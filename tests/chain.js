// QA v3 BLOCKER: the board must never show an earlier level's walls. Chains levels in ONE page (Next, Home, Play,
// Continue, reload + restore) and compares the board pixels with a fresh render of each level in its own new page.
// Run: node tests/chain.js [url]
const { chromium } = require('playwright-core'), path = require('path'), assert = require('assert');
const base = process.argv[2] || 'file://' + path.join(__dirname, '../site/index.html');
const VP = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// draw the board with no tanks, shots or effects at t = 0, then shrink it to 104 x 104 (4 samples per half tile)
const grab = page => page.evaluate(() => {
  const g = TK.UI.game(); TK.Render.setReduce(true);
  TK.Render.frame(Object.assign({}, g, { t: 0, enemies: [], players: [], bullets: [], power: null, freezeT: 0, birdHitT: 0 }), 0, true);
  const c = document.getElementById('cv'), s = document.createElement('canvas'); s.width = s.height = 104; const x = s.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(c, 0, 0, 104, 104);
  return { level: g.level, px: Array.from(x.getImageData(0, 0, 104, 104).data) };
});
// share of 4x4 sample blocks (one per half tile) whose colour differs clearly
function diff(a, b) { let bad = 0; for (let ty = 0; ty < 26; ty++) for (let tx = 0; tx < 26; tx++) { let d = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const i = ((ty * 4 + y) * 104 + tx * 4 + x) * 4; d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); } if (d / 16 > 60) bad++; } return bad / 676; }
let n = 0; const ok = m => { n++; console.log('ok ' + m); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ref = {};
  const fresh = async L => { if (ref[L]) return ref[L]; const ctx = await b.newContext(VP), p = await ctx.newPage(); await p.goto(base); await p.waitForTimeout(300);
    await p.evaluate(L => TK.UI.start(L, null, false, 'easy', 0), L); await p.waitForTimeout(150); ref[L] = (await grab(p)).px; await ctx.close(); return ref[L]; };
  const ctx = await b.newContext(VP), page = await ctx.newPage(); await page.goto(base); await page.waitForTimeout(400);
  const tap = async sel => { await page.tap(sel); await page.waitForTimeout(400); };
  const check = async (L, how) => { const r = await grab(page); assert.strictEqual(r.level, L, how + ': on level ' + (r.level + 1)); const d = diff(r.px, await fresh(L));
    let other = 1; for (const k of Object.keys(ref).map(Number)) if (k !== L) other = Math.min(other, diff(r.px, ref[k]));
    assert(d < 0.04, how + ': L' + (L + 1) + ' board differs from a fresh render in ' + (d * 100).toFixed(1) + '% of cells'); ok(how + ': L' + (L + 1) + ' board matches a fresh render (' + (d * 100).toFixed(1) + '% cells differ; vs other levels ' + (other === 1 ? 'n/a' : (other * 100).toFixed(0) + '%') + ')'); };
  const clear = async () => { await page.evaluate(() => { const g = TK.UI.game(); g.spawned = g.queue.length; g.enemies = []; g.players.forEach(p => p.shieldT = 9); }); await page.waitForTimeout(2600); assert.strictEqual(await page.textContent('#ovTitle'), 'Level Clear!'); await tap('#ov [data-act=next]'); };
  const home = async () => { await tap('#hud [data-act=pause]'); await tap('#ov [data-act=home]'); };
  await tap('#btnPlay'); await check(0, 'Play');
  await clear(); await check(1, 'L1 clear, Next');
  await clear(); await check(2, 'L2 clear, Next');
  await clear(); await check(3, 'L3 clear, Next');
  await clear(); await check(4, 'L4 clear, Next');
  await home(); await tap('#btnContinue'); await check(4, 'Home, Continue');
  await home(); await tap('#btnPlay'); await check(0, 'Continue L5, Home, Play (QA repro 1)');
  await clear(); await check(1, 'L1 clear, Next again (QA repro 2)');
  await home(); await page.reload(); await page.waitForTimeout(400); await tap('#btnContinue'); await check(1, 'reload, Continue (restore)');
  await clear(); await check(2, 'restored L2 clear, Next');
  await home(); await tap('#btnPlay'); await check(0, 'Home, Play after restore');
  // board changes inside a level still redraw: break a brick and see it go
  const before = await grab(page); await page.evaluate(() => { const g = TK.UI.game(); for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) if (g.map[y][x] === TK.Engine.BRICK && y < 20) g.map[y][x] = 0; g.mapVer++; });
  const after = await grab(page); assert(diff(before.px, after.px) > 0.05, 'removing bricks did not redraw'); ok('removing bricks mid-level redraws the board');
  await b.close(); console.log(n + ' level-chain checks passed' + (base.startsWith('file:') && base.includes('tank-test') ? ' (single file copy)' : ''));
})().catch(e => { console.error(e.message); process.exit(1); });
