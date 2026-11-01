// Original WebAudio sound effects and a short looping tune. Everything is synthesized, no files.
(function (root) {
  var ctx = null, master = null, sfxBus = null, musBus = null, muted = false, musicOn = false, musT = 0, musStep = 0, timer = null, noiseBuf = null;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () { }); return; }
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0.16; musBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = noiseBuf.getChannelData(0), s = 7; for (var i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
  }
  function tone(f, t0, len, type, vol, f2, bus) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + len);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g); g.connect(bus || sfxBus); o.start(t0); o.stop(t0 + len + 0.02);
  }
  function noise(t0, len, vol, freq, q, freq2) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t0); if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t0 + len); f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.4, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t0); s.stop(t0 + len + 0.02);
  }
  var last = {};
  function sfx(name) {
    if (!ctx || muted) return; var t = ctx.currentTime; if (last[name] && t - last[name] < 0.04) return; last[name] = t;
    switch (name) {
      case 'shoot': tone(520, t, 0.09, 'square', 0.16, 180); noise(t, 0.06, 0.2, 3000); break;
      case 'eshoot': tone(300, t, 0.08, 'square', 0.08, 120); break;
      case 'brick': noise(t, 0.12, 0.3, 1800, 1, 400); break;
      case 'clank': tone(1400, t, 0.08, 'triangle', 0.15, 900); tone(2100, t, 0.05, 'sine', 0.08); break;
      case 'armor': tone(900, t, 0.06, 'square', 0.12, 700); break;
      case 'boom': noise(t, 0.6, 0.7, 900, 1, 80); tone(110, t, 0.4, 'sine', 0.5, 40); break;
      case 'bird': noise(t, 1.0, 0.7, 700, 1, 60); tone(400, t, 0.9, 'sawtooth', 0.2, 60); break;
      case 'spawn': tone(660, t, 0.07, 'sine', 0.07); tone(990, t + 0.06, 0.07, 'sine', 0.06); break;
      case 'powerdrop': [660, 880, 1100].forEach(function (f, i) { tone(f, t + i * 0.06, 0.1, 'triangle', 0.12); }); break;
      case 'pickup': [523, 659, 784, 1046].forEach(function (f, i) { tone(f, t + i * 0.055, 0.12, 'square', 0.1); }); break;
      case 'deflect': tone(1800, t, 0.06, 'sine', 0.1, 2400); break;
      case 'pdie': tone(440, t, 0.6, 'sawtooth', 0.15, 70); break;
      case 'win': [523, 659, 784, 659, 784, 1046].forEach(function (f, i) { tone(f, t + i * 0.12, 0.18, 'triangle', 0.16); }); break;
      case 'lose': [392, 330, 262, 196].forEach(function (f, i) { tone(f, t + i * 0.2, 0.3, 'triangle', 0.16); }); break;
      case 'tap': tone(880, t, 0.04, 'sine', 0.06); break;
      case 'start': [392, 523, 659, 784].forEach(function (f, i) { tone(f, t + i * 0.09, 0.14, 'square', 0.09); }); break;
    }
  }
  // Original march loop: bass on the beat, a light melody on top.
  var BASS = [110, 0, 110, 0, 131, 0, 98, 0, 110, 0, 110, 0, 147, 0, 131, 0], MEL = [440, 0, 523, 587, 659, 0, 587, 523, 440, 0, 392, 440, 494, 0, 440, 0, 440, 0, 523, 587, 659, 0, 784, 659, 587, 0, 523, 494, 440, 0, 0, 0];
  function tick() {
    if (!ctx || !musicOn) return; var now = ctx.currentTime; if (musT < now) musT = now + 0.05;
    while (musT < now + 0.3) {
      if (!muted) { var b = BASS[musStep % 16], m = MEL[musStep % 32]; if (b) tone(b, musT, 0.16, 'triangle', 0.5, 0, musBus); if (m) tone(m, musT, 0.12, 'square', 0.13, 0, musBus); if (musStep % 4 === 2) { var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = noiseBuf; g.gain.setValueAtTime(0.12, musT); g.gain.exponentialRampToValueAtTime(0.0001, musT + 0.05); s.connect(g); g.connect(musBus); s.start(musT); s.stop(musT + 0.06); } }
      musT += 0.15; musStep++;
    }
  }
  function music(on) { musicOn = on; if (on && !timer) timer = setInterval(tick, 100); if (!on && timer) { clearInterval(timer); timer = null; } }
  function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : 0.8; }
  var api = { init: init, sfx: sfx, music: music, setMuted: setMuted, state: function () { return { ctx: !!ctx, muted: muted, music: musicOn }; } };
  root.TK = root.TK || {}; root.TK.Audio = api;
})(this);
