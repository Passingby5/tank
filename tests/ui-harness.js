// Non-browser VM harness for UI state transitions (entry/carry/retry/restart).
const fs = require('fs'), vm = require('vm'), path = require('path');
const SITE = path.join(__dirname, '../site/index.html');
function boot(raw, label) {
  const els = {}, listeners = {}, rl = {}; let clock = 1000, raf, mem = { tank_save: raw };
  function el(id) {
    if (els[id]) return els[id];
    return els[id] = { id, dataset: {}, children: [], style: {}, textContent: '', innerHTML: '', classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } }, setAttribute() {}, addEventListener() {}, appendChild(e) { this.children.push(e); }, getContext() { return {}; } };
  }
  for (let i = 0; i < 2; i++) el('dpad' + i).children = 'ulrd'.split('').map(d => ({ dataset: { d }, style: {} }));
  const document = { body: { classList: { toggle() {} } }, getElementById: el, querySelectorAll() { return []; }, addEventListener(k, f) { listeners[k] = f; }, createElement() { return el('new' + Math.random()); }, createTextNode(s) { return s; } };
  const R = new Proxy({ resize: n => n, stats: () => ({ maxDpr: 3 }) }, { get: (o, k) => o[k] || (() => {}) });
  const A = new Proxy({}, { get: () => () => {} });
  const c = { document, navigator: { maxTouchPoints: 0 }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    localStorage: { getItem: k => mem[k] || null, setItem: (k, v) => mem[k] = v, removeItem: k => delete mem[k] },
    TK_BUILD: { label: label || 'v8-test' }, performance: { now: () => clock }, Date: { now: () => clock },
    requestAnimationFrame: f => { raf = f; }, setTimeout() {}, addEventListener: (k, f) => rl[k] = f, history: { pushState() {} }, console };
  c.window = c; vm.createContext(c);
  const html = fs.readFileSync(SITE, 'utf8');
  const scripts = [...html.matchAll(/<script data-src="([^"]+)">\n([\s\S]*?)<\/script>/g)];
  for (const name of ['levels.js', 'engine.js', 'save.js']) {
    const code = scripts.find(m => m[1] === name)[2]; vm.runInContext(code, c);
  }
  c.TK.Render = R; c.TK.Audio = A;
  vm.runInContext(scripts.find(m => m[1] === 'ui/ui.js')[2], c);
  return {
    mem, click: (act, v) => { clock += 1000; listeners.click({ target: { closest: () => ({ dataset: { act, v } }) } }); },
    frame: () => { clock += 100; raf(clock); }, state: () => c.TK.UI.state(), g: () => c.TK.UI.game(), E: c.TK.Engine
  };
}
module.exports = { boot };
