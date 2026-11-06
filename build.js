// Label commit = last commit that changed src/ or build.js (so docs and screenshot commits do not change it).
// Build: concatenates src/ into site/index.html (PWA) with sw.js, version.json, manifest, icons.
// TK_SINGLE=<file> also writes a single-file test copy (no service worker).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execSync } = require('child_process');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const VERSION = 8, DATE = 'Nov 6';
let commit = process.env.COMMIT || ''; if (!commit) { try { commit = execSync('git log -1 --format=%H -- src build.js', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { commit = 'local00'; } }
const LABEL = 'v' + VERSION + ' - ' + DATE + ' - ' + commit.slice(0, 7);
const scripts = ['levels.js', 'engine.js', 'save.js', 'audio.js', 'render.js', 'ui/ui.js'];
const id = crypto.createHash('sha1').update(scripts.map(r).join('') + r('ui/style.css') + r('ui/body.html') + LABEL).digest('hex').slice(0, 8);
const js = single => `<script>var TK_BUILD = { label: ${JSON.stringify(LABEL)}, id: "${id}" };${single ? ' window.TK_SINGLE = true;' : ''}</script>\n` + scripts.map(f => `<script data-src="${f}">\n${r(f)}</script>`).join('\n');
const reg = `<script>
(function () {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || window.TK_SINGLE) return;
  var had = !!navigator.serviceWorker.controller, reloading = false;
  function reloadNow() { if (reloading) return; var s = TK.UI && TK.UI.state(); if (s && s.inGame) { setTimeout(reloadNow, 3000); return; } /* wait until Home: never reload during play or pause */ reloading = true; try { TK.UI.save(); } catch (e) { } location.reload(); }
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (!had) { had = true; return; } reloadNow(); });
  function check(reg) {
    if (reg) reg.update().catch(function () { });
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || v.id === TK_BUILD.id) return; var k = 'tk_reload_' + v.id; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); setTimeout(reloadNow, 1500);
    }).catch(function () { });
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      check(reg); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(reg); });
      setInterval(function () { check(reg); }, 20 * 60 * 1000);
    }).catch(function () { });
  });
})();
</script>`;
const page = single => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#1c2219"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Tank"><meta name="description" content="Tank: guard the golden bird from enemy tanks. Works offline.">
${single ? '' : '<link rel="manifest" href="manifest.webmanifest"><link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png"><link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">'}
<title>Tank</title>
<style>
${r('ui/style.css')}</style></head>
<body>
${r('ui/body.html')}
${js(single)}${single ? '' : reg}
</body></html>
`;
const OUT = process.env.TK_OUT ? path.resolve(process.env.TK_OUT) : path.join(__dirname, 'site'), S = p => path.join(OUT, p);
const icons = ['icon-192', 'icon-512', 'maskable-192', 'maskable-512', 'apple-touch-icon'];
fs.mkdirSync(S('icons'), { recursive: true }); icons.forEach(n => { const f = path.join(__dirname, 'src/icons', n + '.png'); if (fs.existsSync(f)) fs.copyFileSync(f, S('icons/' + n + '.png')); });
const html = page(false); fs.writeFileSync(S('index.html'), html); fs.writeFileSync(S('.nojekyll'), '');
fs.writeFileSync(S('manifest.webmanifest'), JSON.stringify({ name: 'Tank', short_name: 'Tank', start_url: './index.html', scope: './', display: 'standalone', orientation: 'any', background_color: '#1c2219', theme_color: '#1c2219',
  icons: [['icon-192', '192x192', 'any'], ['icon-512', '512x512', 'any'], ['maskable-192', '192x192', 'maskable'], ['maskable-512', '512x512', 'maskable']].map(([n, s, p]) => ({ src: 'icons/' + n + '.png', sizes: s, type: 'image/png', purpose: p })) }, null, 1));
const assets = ['./', 'index.html', 'manifest.webmanifest'].concat(icons.map(n => 'icons/' + n + '.png'));
const cache = 'tk-' + crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(S('version.json'), JSON.stringify({ label: LABEL, id, cache }));
fs.writeFileSync(S('sw.js'), `// Service worker (${LABEL}). Page and version.json are NETWORK-FIRST so new versions show right away; cache is the offline fallback.
const CACHE = '${cache}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const page = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html') || url.pathname.endsWith('version.json');
  if (page) { e.respondWith(fetch(req, { cache: 'no-store' }).then(res => { if (res.ok && !url.pathname.endsWith('version.json')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); } return res; }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
});
`);
if (process.env.TK_SINGLE) fs.writeFileSync(process.env.TK_SINGLE, page(true));
console.log('Built', LABEL, id);
