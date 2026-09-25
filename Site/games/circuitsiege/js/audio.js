/* CIRCUIT SIEGE — synthesized audio: sound effects + procedural music (Web Audio, no assets) */
(function () {
  'use strict';
  const CS = window.CS;

  const A = { ctx: null, ready: false, vol: { master: 0.8, music: 0.5, sfx: 0.7 }, track: null, last: {}, voices: 0 };

  A.init = function () {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    A.comp = ctx.createDynamicsCompressor();
    A.comp.threshold.value = -14; A.comp.ratio.value = 6;
    A.master = ctx.createGain();
    A.sfxG = ctx.createGain();
    A.musG = ctx.createGain();
    A.sfxG.connect(A.comp); A.musG.connect(A.comp);
    A.comp.connect(A.master); A.master.connect(ctx.destination);
    // noise buffer
    const n = ctx.sampleRate;
    A.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = A.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    A.applyVolumes();
    A.ready = true;
  };
  A.unlock = function () {
    A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };
  A.setVolumes = function (v) { Object.assign(A.vol, v); A.applyVolumes(); };
  A.applyVolumes = function () {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime(A.vol.master, t, 0.05);
    A.sfxG.gain.setTargetAtTime(A.vol.sfx * 0.9, t, 0.05);
    A.musG.gain.setTargetAtTime(A.vol.music * 0.55, t, 0.05);
  };

  // ── primitives
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(dest, type, f0, f1, t, dur, peak, a) {
    const c = A.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, a || 0.005, peak, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    A.voices++; o.onended = () => A.voices--;
    return o;
  }
  function noise(dest, t, dur, peak, ftype, f0, f1, q) {
    const c = A.ctx;
    const s = c.createBufferSource(); s.buffer = A.noise;
    const f = c.createBiquadFilter(); f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(f0 || 2000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1;
    const g = c.createGain(); env(g, t, 0.004, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    A.voices++; s.onended = () => A.voices--;
  }

  const MIN_GAP = { shoot_pulse: 0.045, kill: 0.035, zap: 0.06, explode: 0.06, missile: 0.07, glob: 0.06, shoot_sniper: 0.05, rail: 0.06, coin: 0.08, shield_break: 0.08, freeze: 0.2, hover: 0.04, quantum: 0.1, transform: 0.1 };

  const SFX = {
    shoot_pulse: (d, t, v) => tone(d, 'square', 1250, 520, t, 0.05, 0.05 * v),
    shoot_sniper: (d, t, v) => { noise(d, t, 0.12, 0.18 * v, 'highpass', 1800); tone(d, 'sine', 180, 60, t, 0.12, 0.2 * v); },
    zap: (d, t, v) => { tone(d, 'sawtooth', 900 + Math.random() * 600, 200, t, 0.09, 0.06 * v); noise(d, t, 0.07, 0.07 * v, 'highpass', 3000); },
    missile: (d, t, v) => noise(d, t, 0.25, 0.08 * v, 'bandpass', 600, 2400, 2),
    explode: (d, t, v) => { noise(d, t, 0.35, 0.25 * v, 'lowpass', 1600, 120); tone(d, 'sine', 110, 40, t, 0.3, 0.25 * v); },
    rail: (d, t, v) => { tone(d, 'sine', 2600, 180, t, 0.2, 0.12 * v); noise(d, t, 0.1, 0.1 * v, 'highpass', 4000); },
    glob: (d, t, v) => tone(d, 'sine', 420, 140, t, 0.09, 0.12 * v),
    quantum: (d, t, v) => { tone(d, 'sine', 70, 40, t, 0.6, 0.35 * v); tone(d, 'sawtooth', 1800, 90, t, 0.4, 0.08 * v); noise(d, t, 0.4, 0.14 * v, 'lowpass', 3000, 200); },
    storm: (d, t, v) => { noise(d, t, 0.5, 0.25 * v, 'lowpass', 5000, 300); tone(d, 'sawtooth', 200, 60, t, 0.4, 0.1 * v); },
    implode: (d, t, v) => { tone(d, 'sine', 60, 200, t, 0.35, 0.25 * v); noise(d, t, 0.3, 0.1 * v, 'bandpass', 200, 1200, 3); },
    kill: (d, t, v) => tone(d, 'triangle', 620 + Math.random() * 200, 1100, t, 0.045, 0.04 * v),
    boss_kill: (d, t, v) => { noise(d, t, 1.2, 0.4 * v, 'lowpass', 2500, 60); tone(d, 'sine', 90, 30, t, 1, 0.4 * v); [523, 659, 784, 1046].forEach((f, i) => tone(d, 'triangle', f, f, t + 0.15 + i * 0.09, 0.4, 0.12 * v)); },
    leak: (d, t, v) => { tone(d, 'square', 140, 90, t, 0.25, 0.12 * v); tone(d, 'square', 147, 95, t, 0.25, 0.08 * v); },
    place: (d, t, v) => { tone(d, 'triangle', 440, 440, t, 0.07, 0.12 * v); tone(d, 'triangle', 660, 660, t + 0.06, 0.1, 0.12 * v); noise(d, t, 0.08, 0.08 * v, 'lowpass', 900); },
    upgrade: (d, t, v) => [523, 659, 988].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.05, 0.16, 0.12 * v)),
    upgrade5: (d, t, v) => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.06, 0.3, 0.13 * v)); noise(d, t + 0.25, 0.6, 0.06 * v, 'highpass', 6000); },
    sell: (d, t, v) => [988, 740, 587].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.05, 0.1, 0.1 * v)),
    coin: (d, t, v) => { tone(d, 'square', 1318, 1318, t, 0.05, 0.04 * v); tone(d, 'square', 1760, 1760, t + 0.05, 0.08, 0.04 * v); },
    cash: (d, t, v) => [1046, 1318, 1568, 2093].forEach((f, i) => tone(d, 'square', f, f, t + i * 0.05, 0.08, 0.05 * v)),
    wave: (d, t, v) => [392, 523, 659].forEach((f, i) => tone(d, 'sine', f, f, t + i * 0.08, 0.3, 0.14 * v)),
    wave_end: (d, t, v) => [659, 784].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.08, 0.25, 0.1 * v)),
    boss: (d, t, v) => { for (let i = 0; i < 3; i++) { tone(d, 'sawtooth', 440, 440, t + i * 0.5, 0.24, 0.1 * v); tone(d, 'sawtooth', 330, 330, t + i * 0.5 + 0.25, 0.24, 0.1 * v); } tone(d, 'sine', 55, 40, t, 1.4, 0.3 * v); },
    shockwave: (d, t, v) => { tone(d, 'sine', 80, 25, t, 0.7, 0.45 * v); noise(d, t, 0.6, 0.2 * v, 'lowpass', 800, 60); },
    ability: (d, t, v) => { noise(d, t, 0.4, 0.12 * v, 'bandpass', 400, 4000, 2); [392, 587, 784].forEach((f) => tone(d, 'sawtooth', f, f * 1.01, t + 0.05, 0.45, 0.05 * v)); },
    orbital: (d, t, v) => { noise(d, t, 1.4, 0.5 * v, 'lowpass', 3000, 50); tone(d, 'sine', 70, 20, t, 1.2, 0.5 * v); },
    shield_break: (d, t, v) => { noise(d, t, 0.12, 0.1 * v, 'highpass', 5000); tone(d, 'sine', 2400, 1200, t, 0.08, 0.04 * v); },
    shield_up: (d, t, v) => tone(d, 'sine', 300, 1200, t, 0.5, 0.15 * v),
    freeze: (d, t, v) => { noise(d, t, 0.4, 0.06 * v, 'highpass', 7000); tone(d, 'sine', 2000, 3000, t, 0.25, 0.04 * v); },
    transform: (d, t, v) => { tone(d, 'sawtooth', 200, 600, t, 0.2, 0.08 * v); noise(d, t, 0.15, 0.08 * v, 'bandpass', 1000); },
    blackout: (d, t, v) => { tone(d, 'sine', 400, 50, t, 0.8, 0.2 * v); },
    corrupt: (d, t, v) => { for (let i = 0; i < 6; i++) tone(d, 'square', 200 + Math.random() * 800, 100, t + i * 0.04, 0.05, 0.05 * v); },
    victory: (d, t, v) => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.11, 0.35, 0.13 * v)); },
    defeat: (d, t, v) => { [392, 349, 311, 262].forEach((f, i) => tone(d, 'sawtooth', f, f * 0.98, t + i * 0.22, 0.4, 0.07 * v)); tone(d, 'sine', 60, 30, t + 0.9, 1, 0.3 * v); },
    click: (d, t, v) => tone(d, 'triangle', 900, 1200, t, 0.035, 0.07 * v),
    hover: (d, t, v) => tone(d, 'sine', 1400, 1500, t, 0.02, 0.02 * v),
    error: (d, t, v) => { tone(d, 'square', 180, 180, t, 0.08, 0.06 * v); tone(d, 'square', 150, 150, t + 0.1, 0.1, 0.06 * v); },
    levelup: (d, t, v) => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(d, 'triangle', f, f, t + i * 0.07, 0.35, 0.12 * v)),
    achievement: (d, t, v) => [784, 988, 1175, 1568].forEach((f, i) => tone(d, 'sine', f, f, t + i * 0.08, 0.4, 0.12 * v)),
  };

  A.play = function (name, vol) {
    if (!A.ready || A.vol.sfx <= 0 || A.vol.master <= 0) return;
    if (A.ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = A.ctx.currentTime;
    const gap = MIN_GAP[name] || 0.03;
    if (A.last[name] && now - A.last[name] < gap) return;
    if (A.voices > 40 && gap < 0.1) return;
    A.last[name] = now;
    fn(A.sfxG, now + 0.005, vol === undefined ? 1 : vol);
  };
  CS.sfx = A.play;

  // ───────────────────────── Music sequencer
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    menu: { bpm: 84, bars: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [45, 41, 36, 43], arp: 'slow', drums: 0, pad: true },
    game: { bpm: 112, bars: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], bass: [45, 41, 43, 40], arp: 'eighth', drums: 1 },
    late: { bpm: 126, bars: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], bass: [38, 34, 36, 33], arp: 'sixteenth', drums: 2 },
    boss: { bpm: 140, bars: [[52, 55, 58], [52, 55, 58], [53, 56, 59], [51, 54, 57]], bass: [40, 40, 41, 39], arp: 'boss', drums: 3 },
  };

  let seq = null;
  A.music = function (name) {
    if (A.track === name) return;
    A.track = name;
    if (!A.ready) return;
    A.startSeq();
  };
  A.startSeq = function () {
    if (seq) { clearInterval(seq.timer); seq = null; }
    const tr = TRACKS[A.track];
    if (!tr || !A.ctx) return;
    // quick fade-in
    const t0 = A.ctx.currentTime;
    A.musG.gain.cancelScheduledValues(t0);
    A.musG.gain.setValueAtTime(0.0001, t0);
    A.musG.gain.linearRampToValueAtTime(A.vol.music * 0.55, t0 + 1.2);
    seq = { tr, step: 0, next: t0 + 0.1 };
    seq.timer = setInterval(schedule, 30);
  };
  function schedule() {
    if (!seq || !A.ctx || A.ctx.state !== 'running') return;
    const tr = seq.tr;
    const stepDur = 60 / tr.bpm / 4; // sixteenth
    while (seq.next < A.ctx.currentTime + 0.15) {
      playStep(tr, seq.step, seq.next, stepDur);
      seq.step++;
      seq.next += stepDur;
    }
  }
  function playStep(tr, step, t, sd) {
    if (A.vol.music <= 0) return;
    const d = A.musG;
    const bar = Math.floor(step / 16) % tr.bars.length;
    const s = step % 16;
    const chord = tr.bars[bar];
    // Pad on bar start
    if (s === 0 && (tr.pad || tr.drums >= 1)) {
      for (const n of chord) {
        const o = A.ctx.createOscillator(), g = A.ctx.createGain(), f = A.ctx.createBiquadFilter();
        o.type = tr.pad ? 'triangle' : 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = (Math.random() - 0.5) * 12;
        f.type = 'lowpass'; f.frequency.value = tr.pad ? 1200 : 700;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(tr.pad ? 0.05 : 0.025, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + sd * 16);
        o.connect(f); f.connect(g); g.connect(d); o.start(t); o.stop(t + sd * 16 + 0.1);
      }
    }
    // Bass
    const bn = tr.bass[bar];
    if (tr.drums === 0) { if (s === 0 || s === 8) tone(d, 'sine', NOTE(bn), NOTE(bn), t, sd * 7, 0.12); }
    else if (tr.drums === 3) { if (s % 2 === 0) tone(d, 'sawtooth', NOTE(bn - 12 + (s === 14 ? 1 : 0)), NOTE(bn - 12), t, sd * 1.6, 0.07); }
    else if (s % 4 === 0 || s === 6 || s === 14) tone(d, 'triangle', NOTE(bn), NOTE(bn), t, sd * 2.5, 0.13);
    // Arp
    const ar = tr.arp;
    const arpNotes = chord.concat([chord[0] + 12, chord[1] + 12]);
    if (ar === 'slow' && s % 4 === 2) tone(d, 'sine', NOTE(arpNotes[(step / 4) % arpNotes.length | 0] + 12), 0, t, sd * 6, 0.035);
    if (ar === 'eighth' && s % 2 === 0) tone(d, 'square', NOTE(arpNotes[(s / 2) % arpNotes.length] + 12), 0, t, sd * 1.4, 0.018);
    if (ar === 'sixteenth') tone(d, 'square', NOTE(arpNotes[s % arpNotes.length] + 12), 0, t, sd * 0.9, 0.016);
    if (ar === 'boss' && (s % 3 === 0)) tone(d, 'sawtooth', NOTE(chord[(s / 3) % 3 | 0] + 12), 0, t, sd * 1.2, 0.022);
    // Drums
    if (tr.drums >= 1) {
      if (s % 4 === 0 || (tr.drums >= 3 && s % 4 === 2 && s !== 2)) tone(d, 'sine', 120, 40, t, 0.14, tr.drums >= 3 ? 0.35 : 0.25);
      if (s % 2 === 1 || tr.drums >= 2) noise(d, t, 0.03, tr.drums >= 2 ? 0.035 : 0.025, 'highpass', 8000);
      if (tr.drums >= 2 && (s === 4 || s === 12)) noise(d, t, 0.14, 0.09, 'bandpass', 1800, 900, 1);
    }
  }

  CS.Audio = A;
})();
