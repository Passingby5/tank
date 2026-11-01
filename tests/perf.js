// Frame times under 4x CPU throttle at 390x844 DPR 3, using QA's v1 scenario (real game, a big explosion about once a second).
// Run: node tests/perf.js [url]. Gate: at least 50 fps and at most 10% of frames over 33 ms.
const { chromium } = require('playwright-core'), path = require('path'), assert = require('assert');
// Shared CI boxes can stall for a moment, so the scenario runs 3 times and the MEDIAN run is gated (same target).
async function once() {
  const url = process.argv[2] || 'file://' + path.join(__dirname, '../site/index.html');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(url); await page.waitForTimeout(300); await page.tap('#btnPlay'); await page.waitForTimeout(500);
  await page.evaluate(() => { window.__ft = []; let l = 0; const f = t => { if (l) window.__ft.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
    setInterval(() => { const g = TK.UI.game(); if (!g) return; g.players[0].shieldT = 5; if (Math.random() < 0.3) TK.Render.boom(Math.random() * 13, Math.random() * 13, true); }, 300); });
  await page.waitForTimeout(15000);
  const r = await page.evaluate(() => { const a = window.__ft.slice().sort((x, y) => x - y); return { n: a.length, fps: 1000 / (a.reduce((x, y) => x + y, 0) / a.length), p95: a[Math.floor(a.length * 0.95)], over: a.filter(x => x > 33).length / a.length, scale: TK.Render.stats().maxDpr }; });
  await b.close(); return r;
}
const line = r => r.fps.toFixed(1) + ' fps, p95 ' + r.p95.toFixed(1) + ' ms, frames over 33 ms ' + (r.over * 100).toFixed(1) + '%, render scale ' + r.scale + 'x';
(async () => {
  const runs = []; for (let i = 0; i < 3; i++) { const r = await once(); runs.push(r); console.log('run ' + (i + 1) + ': ' + line(r)); }
  const med = k => runs.map(r => r[k]).sort((x, y) => x - y)[1], m = { fps: med('fps'), p95: med('p95'), over: med('over'), scale: runs[0].scale };
  console.log('4x throttle, median of 3: ' + line(m));
  assert(m.fps >= 50 && m.over <= 0.1, 'too slow under 4x throttle (median of 3 runs)');
})().catch(e => { console.error(e.message); process.exit(1); });
