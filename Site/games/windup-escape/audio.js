/*
 * Wind-Up Escape — every sound is synthesised with WebAudio, so the game ships
 * with no audio files. Includes a small music-box tune.
 */
(function (root) {
  'use strict';
  var ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  var soundOn = true, musicOn = true;
  var musicTimer = null, musicNext = 0, musicStep = 0;

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch (e) { return false; }
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 1 : 0; sfxBus.connect(comp);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') {
      var r = ctx.resume();
      if (r && r.catch) r.catch(function () { /* stays silent until the next gesture */ });
    }
    return true;
  }

  function now() { return ctx.currentTime; }

  // A single enveloped oscillator.
  function tone(o) {
    if (!ctx || (!soundOn && !o.music)) return;
    var t = now() + (o.t || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) {
      if (o.lin) osc.frequency.linearRampToValueAtTime(o.f2, t + o.d);
      else osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    }
    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib; lg.gain.value = o.vibAmt || 20;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t); lfo.stop(t + o.d + 0.05);
    }
    var v = o.v || 0.2, a = o.a || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    osc.connect(g);
    g.connect(o.music ? musicBus : sfxBus);
    osc.start(t);
    osc.stop(t + o.d + 0.05);
  }

  function noise(o) {
    if (!ctx || !soundOn) return;
    var t = now() + (o.t || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    f.Q.value = o.q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(o.v || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.d + 0.05);
  }

  function click(t, f, v) {
    noise({ t: t, d: 0.03, f: f || 3000, q: 2, v: v || 0.25, filter: 'bandpass' });
  }

  var tickFlip = false;
  var sfx = {
    step: function (urgent) {
      tickFlip = !tickFlip;
      click(0, tickFlip ? 3400 : 2300, urgent ? 0.3 : 0.12);
      if (urgent) tone({ f: tickFlip ? 1760 : 1320, d: 0.06, v: 0.06, type: 'square' });
    },
    turn: function (n) {
      click(0, 5000, 0.2);
      tone({ f: 620 + n * 140, f2: 980 + n * 140, d: 0.07, v: 0.12, type: 'square' });
    },
    queue: function () {
      tone({ f: 900, f2: 1300, d: 0.05, v: 0.08, type: 'triangle' });
      click(0, 6000, 0.12);
    },
    bonk: function () {
      noise({ d: 0.09, f: 420, q: 1.5, v: 0.5, filter: 'lowpass' });
      tone({ f: 330, f2: 110, d: 0.28, v: 0.35, type: 'triangle', vib: 18, vibAmt: 40 });
    },
    key: function () {
      [1046, 1318, 1568, 2093].forEach(function (f, i) {
        tone({ f: f, d: 0.22, v: 0.16, type: 'triangle', t: i * 0.06 });
        tone({ f: f * 2, d: 0.12, v: 0.04, t: i * 0.06 });
      });
      noise({ d: 0.3, f: 7000, q: 1, v: 0.05, filter: 'highpass' });
    },
    winder: function () {
      for (var i = 0; i < 9; i++) click(i * 0.035 * (1 - i * 0.05), 2500 + i * 250, 0.25);
      tone({ f: 300, f2: 1100, d: 0.4, v: 0.12, type: 'square', lin: true });
      tone({ f: 1568, d: 0.3, v: 0.12, type: 'triangle', t: 0.35 });
    },
    windup: function () {
      for (var i = 0; i < 12; i++) click(i * 0.045 - i * i * 0.0012, 2000 + i * 200, 0.28);
      tone({ f: 200, f2: 800, d: 0.5, v: 0.08, type: 'sawtooth', lin: true });
    },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ f: f, d: 0.18, v: 0.16, type: 'square', t: i * 0.09 });
      });
      [1046, 1318, 1568].forEach(function (f) {
        tone({ f: f, d: 0.8, v: 0.1, type: 'triangle', t: 0.38 });
      });
    },
    star: function (n) {
      var f = [880, 1108, 1318][n] || 1318;
      tone({ f: f, d: 0.6, v: 0.2, type: 'sine' });
      tone({ f: f * 2.01, d: 0.35, v: 0.07, type: 'sine' });
      tone({ f: f * 3, d: 0.2, v: 0.03, type: 'triangle' });
    },
    nostar: function () {
      tone({ f: 220, d: 0.15, v: 0.08, type: 'triangle' });
    },
    fall: function () {
      tone({ f: 1200, f2: 140, d: 0.75, v: 0.18, type: 'sine' });
      noise({ t: 0.7, d: 0.2, f: 200, q: 1, v: 0.35, filter: 'lowpass' });
    },
    crash: function () {
      noise({ d: 0.25, f: 1800, f2: 300, q: 0.8, v: 0.5 });
      tone({ f: 440, f2: 70, d: 0.4, v: 0.3, type: 'square' });
      tone({ f: 620, f2: 300, d: 0.6, v: 0.12, type: 'triangle', t: 0.12, vib: 9, vibAmt: 60 });
    },
    winddown: function () {
      for (var i = 0; i < 7; i++) click(i * (0.08 + i * 0.03), 2400 - i * 180, 0.22);
      tone({ f: 500, f2: 90, d: 1.1, v: 0.16, type: 'triangle', vib: 6, vibAmt: 30 });
    },
    warp: function () {
      tone({ f: 260, f2: 1400, d: 0.3, v: 0.15, type: 'sine', vib: 30, vibAmt: 80 });
      tone({ f: 520, f2: 2400, d: 0.25, v: 0.05, type: 'triangle', t: 0.05 });
    },
    crumble: function () {
      noise({ d: 0.22, f: 900, f2: 300, q: 0.7, v: 0.3 });
      noise({ t: 0.05, d: 0.15, f: 2600, q: 1.2, v: 0.12 });
    },
    piston: function () {
      tone({ f: 170, f2: 90, d: 0.09, v: 0.12, type: 'sine' });
      click(0, 1200, 0.06);
    },
    ui: function () {
      tone({ f: 660, f2: 990, d: 0.08, v: 0.12, type: 'triangle' });
    },
    back: function () {
      tone({ f: 700, f2: 450, d: 0.09, v: 0.12, type: 'triangle' });
    },
    locked: function () {
      tone({ f: 180, d: 0.12, v: 0.15, type: 'square' });
      tone({ f: 150, d: 0.14, v: 0.12, type: 'square', t: 0.09 });
    },
    alarm: function () {
      tone({ f: 1760, d: 0.08, v: 0.08, type: 'square' });
    }
  };
  // Sound must never stop the game: swallow any audio error.
  Object.keys(sfx).forEach(function (k) {
    var play = sfx[k];
    sfx[k] = function (a) { try { play(a); } catch (e) { /* no audio */ } };
  });

  // ---- Music box ----------------------------------------------------------
  // 120 bpm, eighth-note grid. 0 = rest. Two 8-bar phrases.
  var N = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  var MEL = [
    72, 76, 79, 76, 81, 79, 76, 72,   74, 77, 81, 77, 79, 77, 74, 71,
    72, 76, 79, 84, 83, 79, 81, 79,   77, 76, 74, 67, 72, 0, 0, 0,
    76, 0, 76, 79, 77, 0, 74, 0,      72, 74, 76, 72, 71, 0, 67, 0,
    69, 72, 76, 81, 79, 76, 74, 72,   74, 71, 67, 71, 72, 0, 0, 0
  ];
  var BASS = [
    48, 55, 48, 55,  50, 57, 43, 55,  48, 55, 45, 52,  41, 43, 48, 0,
    45, 52, 45, 52,  41, 48, 43, 50,  45, 52, 48, 52,  43, 47, 48, 0
  ];
  function scheduleMusic() {
    if (!ctx) return;
    var ahead = ctx.currentTime + 0.25;
    if (!musicOn || ctx.state !== 'running') { musicNext = Math.max(musicNext, ahead); return; }
    var eighth = 0.25;
    while (musicNext < ahead) {
      var t = musicNext - ctx.currentTime;
      var m = MEL[musicStep % MEL.length];
      if (m) {
        tone({ f: N(m + 12), d: 0.55, v: 0.07, type: 'sine', t: t, music: true, a: 0.004 });
        tone({ f: N(m + 24), d: 0.18, v: 0.018, type: 'sine', t: t, music: true, a: 0.002 });
      }
      if (musicStep % 2 === 0) {
        var b = BASS[(musicStep / 2) % BASS.length];
        if (b) tone({ f: N(b), d: 0.4, v: 0.06, type: 'triangle', t: t, music: true, a: 0.01 });
      }
      musicStep++;
      musicNext += eighth;
    }
  }
  function startMusic() {
    if (!ctx || musicTimer) return;
    musicNext = ctx.currentTime + 0.1;
    musicTimer = setInterval(scheduleMusic, 60);
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(musicOn ? 1 : 0, ctx.currentTime, 0.3);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  function duck(on) {
    if (!ctx || !musicBus) return;
    musicBus.gain.setTargetAtTime(musicOn ? (on ? 0.35 : 1) : 0, ctx.currentTime, 0.15);
  }

  root.WAudio = {
    unlock: function () { try { if (ensure()) startMusic(); } catch (e) { /* no audio */ } },
    sfx: sfx,
    duck: duck,
    get soundOn() { return soundOn; },
    get musicOn() { return musicOn; },
    setSound: function (on) {
      soundOn = !!on;
      if (sfxBus) sfxBus.gain.setTargetAtTime(soundOn ? 1 : 0, ctx.currentTime, 0.02);
    },
    setMusic: function (on) {
      musicOn = !!on;
      if (musicBus) musicBus.gain.setTargetAtTime(musicOn ? 1 : 0, ctx.currentTime, 0.2);
    },
    suspend: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    stopMusic: stopMusic
  };
})(this);
