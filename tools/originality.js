// Compares every level with the 35 Battle City stages (QA's reference file, kept OUTSIDE this repo) using QA's metrics:
// tile match (same tile type, empty counts) and wall Jaccard, best over all stages and mirror images. Gate for Level 1: both < 0.30.
// Run: node tools/originality.js [path to bc_levels_ref.js]  (or BC_REF=path)
// The reference is never copied into this repo (it is Battle City data and the repo will be public).
// Set BC_REF to point at it, or SKIP_ORIGINALITY=1 to skip on purpose. A missing file fails loudly.
const fs = require('fs'), REF = process.argv[2] || process.env.BC_REF || '/workspace/qa/tank-v1/scripts/bc_levels_ref.js';
if (process.env.SKIP_ORIGINALITY === '1') { console.log('SKIPPED on purpose (SKIP_ORIGINALITY=1): Level 1 originality was NOT checked'); process.exit(0); }
if (!fs.existsSync(REF)) { console.error('FAIL: Battle City reference not found at ' + REF + '\nSet BC_REF=/path/to/bc_levels_ref.js, or SKIP_ORIGINALITY=1 to skip this check on purpose.'); process.exit(1); }
const BC = eval(fs.readFileSync(REF, 'utf8') + ';LEVEL_MAPS'), L = require('../src/levels.js').LEVELS;
const cb = v => v <= 4 ? 'B' : v <= 9 ? 'S' : v == 10 ? 'W' : v == 11 ? 'F' : v == 12 ? 'I' : '.', ct = c => '#[]^_'.includes(c) ? 'B' : c == '@' ? 'S' : c == '~' ? 'W' : c == '%' ? 'F' : c == '-' ? 'I' : '.';
const skip = (x, y) => (y == 0 && (x == 0 || x == 6 || x == 12)) || (y == 12 && (x == 4 || x == 8)) || (y >= 11 && x >= 5 && x <= 7), bc = BC.map(m => m.map(r => r.map(cb)));
function sim(a, b, mir) { let same = 0, nb = 0, ne = 0; for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) { if (skip(x, y)) continue; const p = a[y][x], q = b[y][mir ? 12 - x : x]; if (p == q) same++; if (p != '.' || q != '.') { ne++; if (p == q) nb++; } } return { tile: same / 158, jac: nb / ne }; }
let fail = false;
L.forEach((l, i) => { const a = l.map.map(r => [...r].map(ct)); let t = 0, j = 0, st = 0; bc.forEach((b, k) => [0, 1].forEach(m => { const s = sim(a, b, m); if (s.tile > t) { t = s.tile; st = k + 1; } j = Math.max(j, s.jac); }));
  console.log('L' + (i + 1) + ' ' + l.name + ': max tile match ' + t.toFixed(2) + ' (BC ' + st + '), max wall Jaccard ' + j.toFixed(2)); if (i === 0 && (t >= 0.3 || j >= 0.3)) fail = true; });
if (fail) { console.error('Level 1 is too close to a Battle City stage'); process.exit(1); } console.log('ok Level 1 overlaps less than 30% with every Battle City stage');
