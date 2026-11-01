// Draws the app icons in a headless browser with the game's own renderer (no outside art). Run: node tools/icons.js
const { chromium } = require('playwright-core'), fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }), p = await b.newPage();
  const src = ['levels.js', 'engine.js', 'render.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
  await p.setContent('<canvas id=c></canvas><script>' + src + '</script>');
  for (const [n, s, pad] of [['icon-192', 192, 0.08], ['icon-512', 512, 0.08], ['maskable-192', 192, 0.2], ['maskable-512', 512, 0.2], ['apple-touch-icon', 180, 0.1]]) {
    const url = await p.evaluate(([s, pad]) => { const c = document.getElementById('c'); c.width = c.height = s; const x = c.getContext('2d'); const g = x.createRadialGradient(s / 2, s * 0.3, 0, s / 2, s / 2, s * 0.75); g.addColorStop(0, '#4d5e3c'); g.addColorStop(1, '#151a12'); x.fillStyle = g; x.fillRect(0, 0, s, s);
      const k = s * (1 - pad * 2); TK.Render.drawTank(x, s * pad, s * pad, k, 'u', 'p0', 0); return c.toDataURL('image/png'); }, [s, pad]);
    fs.writeFileSync(path.join(__dirname, '../src/icons', n + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('icons done');
})();
