// Versioned save. Wrong version, broken JSON or bad fields are ignored safely.
(function (root) {
  var KEY = 'tank_save', VERSION = 4, DIFFS = ['easy', 'medium', 'hard'];
  function fresh() { return { v: VERSION, run: null, best: 0, settings: { muted: false, difficulty: 'hard' } }; }
  function int(v, lo, hi) { if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) throw 0; return Math.max(lo, Math.min(hi, v)); }
  function cleanRun(r, nLevels) {
    try {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
      if (typeof r.level !== 'number' || Math.floor(r.level) !== r.level || r.level < 0 || r.level >= (nLevels || 99)) return null;
      if (DIFFS.indexOf(r.difficulty) < 0 || typeof r.twoP !== 'boolean' || !Array.isArray(r.carry) || r.carry.length !== (r.twoP ? 2 : 1)) return null;
      var carry = r.carry.map(function (c) { if (!c || typeof c !== 'object') throw 0; return { lives: int(c.lives, 1, 9), tier: int(c.tier, 0, 3), score: int(c.score, 0, 99999999) }; });
      var entry = null;
      if (Array.isArray(r.entry) && r.entry.length === carry.length) {
        entry = r.entry.map(function (c) { if (!c || typeof c !== 'object') throw 0; return { lives: int(c.lives, 1, 9), tier: int(c.tier, 0, 3), score: int(c.score, 0, 99999999) }; });
      } else {
        // Pre-v7 saves: treat the stored carry as the level-entry checkpoint once (stops further restart farming after upgrade).
        entry = carry.map(function (c) { return { lives: c.lives, tier: c.tier, score: c.score }; });
      }
      return { level: r.level, difficulty: r.difficulty, twoP: r.twoP, attempt: typeof r.attempt === 'number' && isFinite(r.attempt) ? Math.abs(Math.floor(r.attempt)) % 1e6 : 0,
        snap: r.snap && typeof r.snap === 'object' && !Array.isArray(r.snap) ? r.snap : null,
        carry: carry, entry: entry };
    } catch (e) { return null; }
  }
  function read(st, nLevels) {
    var d = fresh();
    try { var raw = st.getItem(KEY); if (!raw) return d; var o = JSON.parse(raw); if (!o || typeof o !== 'object' || (o.v !== VERSION && o.v !== 1 && o.v !== 2 && o.v !== 3)) return d; // older saves keep their difficulty; only brand-new installs default to Hard
      if (o.settings && typeof o.settings === 'object') { d.settings.muted = o.settings.muted === true; if (DIFFS.indexOf(o.settings.difficulty) >= 0) d.settings.difficulty = o.settings.difficulty; }
      d.best = typeof o.best === 'number' && isFinite(o.best) ? Math.max(0, Math.floor(o.best)) : 0;
      d.run = cleanRun(o.run, nLevels);
    } catch (e) { }
    return d;
  }
  function write(st, d) { try { st.setItem(KEY, JSON.stringify({ v: VERSION, run: d.run || null, best: d.best || 0, settings: d.settings || fresh().settings })); return true; } catch (e) { return false; } }
  var api = { KEY: KEY, VERSION: VERSION, read: read, write: write, cleanRun: cleanRun, fresh: fresh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else { root.TK = root.TK || {}; root.TK.Save = api; }
})(this);
