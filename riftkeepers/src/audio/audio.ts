/**
 * Fully synthesized audio (no asset downloads). WebAudio is created lazily on the first user gesture,
 * which satisfies browser autoplay rules and avoids console errors.
 */
export type Sfx =
  | 'click' | 'error' | 'place' | 'upgrade' | 'sell' | 'arrow' | 'flask' | 'shard' | 'spark' | 'rail' | 'bolt' | 'zap'
  | 'boom' | 'kill' | 'bigkill' | 'leak' | 'ability' | 'pulse' | 'freeze' | 'bossWarn' | 'victory' | 'defeat' | 'coin'
  | 'levelup' | 'waveStart' | 'waveEnd' | 'shield' | 'summon';

type Track = 'menu' | 'game' | 'boss' | null;

const THROTTLE: Partial<Record<Sfx, number>> = {
  arrow: 70, flask: 90, shard: 80, spark: 80, bolt: 90, zap: 90, boom: 90, kill: 45, rail: 120, coin: 60, freeze: 200, leak: 150,
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  private last = new Map<Sfx, number>();
  private voices = 0;
  private maxVoices = 14;
  private noiseBuf: AudioBuffer | null = null;
  private track: Track = null;
  private wantTrack: Track = null;
  private seqTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  musicVol = 0.5;
  sfxVol = 0.75;
  muted = false;
  suspended = false;

  /** Call from a user gesture handler. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.suspended) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(this.master);
    this.musicGain = c.createGain();
    this.sfxGain = c.createGain();
    this.musicGain.connect(comp);
    this.sfxGain.connect(comp);
    const len = c.sampleRate * 0.5;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.apply();
    if (this.wantTrack) this.playMusic(this.wantTrack);
  }

  setVolumes(music: number, sfx: number, muted: boolean) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.muted = muted;
    this.apply();
  }

  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    this.musicGain.gain.setTargetAtTime(this.musicVol * 0.32, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxVol * 0.55, t, 0.02);
  }

  /** Pause all audio (page hidden). */
  suspend(on: boolean) {
    this.suspended = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  private canPlay(name: Sfx): boolean {
    if (!this.ctx || this.muted || this.sfxVol <= 0 || this.ctx.state !== 'running') return false;
    const now = performance.now();
    const th = THROTTLE[name] ?? 30;
    if ((this.last.get(name) ?? 0) + th > now) return false;
    if (this.voices >= this.maxVoices) return false;
    this.last.set(name, now);
    return true;
  }

  private voice(dur: number) {
    this.voices++;
    window.setTimeout(() => this.voices--, dur * 1000 + 50);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, dest?: AudioNode) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, when = 0, q = 1, freqTo?: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  play(name: Sfx, pitch = 1) {
    if (!this.canPlay(name)) return;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (name) {
      case 'click': this.tone(660, 0.06, 'triangle', 0.25); this.voice(0.06); break;
      case 'error': this.tone(220, 0.12, 'square', 0.12); this.tone(180, 0.14, 'square', 0.1, 0.08); this.voice(0.22); break;
      case 'place':
        this.noise(0.12, 0.4, 'lowpass', 600);
        this.tone(220, 0.15, 'sine', 0.4, 0, 110);
        this.tone(880, 0.18, 'triangle', 0.18, 0.06);
        this.voice(0.25);
        break;
      case 'upgrade':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.2, i * 0.06));
        this.voice(0.4);
        break;
      case 'sell':
      case 'coin':
        this.tone(1318 * pitch, 0.08, 'square', 0.08);
        this.tone(1760 * pitch, 0.16, 'square', 0.08, 0.06);
        this.voice(0.22);
        break;
      case 'arrow': this.noise(0.08, 0.18, 'bandpass', r(2500, 3500), 0, 2, 900); this.voice(0.08); break;
      case 'flask': this.tone(r(300, 360), 0.1, 'sine', 0.2, 0, 160); this.voice(0.1); break;
      case 'shard': this.tone(r(1800, 2200), 0.12, 'sine', 0.12, 0, 2600); this.tone(r(2600, 3000), 0.08, 'triangle', 0.06, 0.02); this.voice(0.14); break;
      case 'spark': this.noise(0.09, 0.2, 'highpass', 3000); this.tone(r(900, 1200), 0.07, 'sawtooth', 0.06, 0, 400); this.voice(0.1); break;
      case 'bolt': this.tone(r(700, 800), 0.12, 'triangle', 0.14, 0, 1400); this.voice(0.12); break;
      case 'zap': this.tone(r(1500, 1800), 0.05, 'square', 0.04, 0, 800); this.voice(0.05); break;
      case 'rail': this.tone(1600, 0.35, 'sawtooth', 0.12, 0, 120); this.noise(0.3, 0.2, 'bandpass', 2000, 0, 1, 300); this.voice(0.35); break;
      case 'boom': this.noise(0.35, 0.45, 'lowpass', 900, 0, 1, 120); this.tone(120, 0.3, 'sine', 0.35, 0, 50); this.voice(0.35); break;
      case 'kill': this.tone(r(500, 700) * pitch, 0.08, 'triangle', 0.14, 0, r(900, 1200) * pitch); this.voice(0.08); break;
      case 'bigkill': this.noise(0.5, 0.5, 'lowpass', 1200, 0, 1, 100); this.tone(90, 0.5, 'sine', 0.5, 0, 40); this.voice(0.5); break;
      case 'leak': this.tone(160, 0.25, 'sawtooth', 0.18, 0, 90); this.voice(0.25); break;
      case 'ability':
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.16, i * 0.04));
        this.noise(0.4, 0.12, 'highpass', 4000);
        this.voice(0.5);
        break;
      case 'pulse': this.tone(200, 0.45, 'sine', 0.4, 0, 60); this.noise(0.4, 0.25, 'bandpass', 800, 0, 1, 200); this.voice(0.45); break;
      case 'freeze': this.noise(0.4, 0.2, 'highpass', 5000, 0, 1, 2000); this.tone(2400, 0.3, 'sine', 0.06, 0, 1600); this.voice(0.4); break;
      case 'shield': this.tone(440, 0.35, 'triangle', 0.18, 0, 880); this.voice(0.35); break;
      case 'summon': this.tone(300, 0.4, 'sawtooth', 0.12, 0, 600); this.voice(0.4); break;
      case 'bossWarn':
        this.tone(110, 0.6, 'sawtooth', 0.3);
        this.tone(116, 0.6, 'sawtooth', 0.25);
        this.tone(110, 0.8, 'sawtooth', 0.3, 0.7);
        this.tone(98, 0.8, 'sawtooth', 0.3, 0.7);
        this.voice(1.5);
        break;
      case 'waveStart': this.tone(330, 0.15, 'triangle', 0.2); this.tone(494, 0.25, 'triangle', 0.2, 0.12); this.voice(0.4); break;
      case 'waveEnd': [659, 784, 988].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.14, i * 0.08)); this.voice(0.45); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, 'square', 0.07, i * 0.07)); this.voice(0.6); break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.22, i * 0.14));
        this.voice(1.4);
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.22, i * 0.25));
        this.voice(1.4);
        break;
    }
  }

  // ------------------------------------------------------------------ music
  playMusic(track: Track) {
    this.wantTrack = track;
    if (!this.ctx) return;
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    if (this.seqTimer !== null) window.clearTimeout(this.seqTimer);
    this.seqTimer = null;
    if (track) this.schedule();
  }

  stopMusic() {
    this.playMusic(null);
  }

  private schedule = () => {
    if (!this.ctx || !this.track) return;
    const spb = this.track === 'menu' ? 60 / 84 / 2 : this.track === 'boss' ? 60 / 128 / 2 : 60 / 112 / 2; // eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      if (this.ctx.state === 'running' && !this.muted && this.musicVol > 0) this.musicStep(this.step, this.nextNoteTime - this.ctx.currentTime);
      this.step++;
      this.nextNoteTime += spb;
    }
    this.seqTimer = window.setTimeout(this.schedule, 90);
  };

  private musicStep(step: number, when: number) {
    const d = this.musicGain;
    const n = (semi: number) => 220 * Math.pow(2, semi / 12);
    if (this.track === 'menu') {
      // gentle I–vi–IV–V in C with arpeggios
      const chords = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
      const bar = Math.floor(step / 8) % 4;
      const ch = chords[bar];
      if (step % 8 === 0) for (const s of ch) this.pad(n(s + 3), 2.6, when, d, 0.05);
      const arp = [0, 1, 2, 1, 2, 0, 2, 1];
      this.tone(n(ch[arp[step % 8]] + 15), 0.35, 'triangle', 0.06, when, undefined, d);
      if (step % 16 === 6) this.tone(n(ch[2] + 27), 0.6, 'sine', 0.03, when, undefined, d);
    } else {
      const boss = this.track === 'boss';
      const chords = boss ? [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]] : [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [-5, -1, 2]];
      const bar = Math.floor(step / 8) % 4;
      const ch = chords[bar];
      // bass
      if (step % 2 === 0) this.tone(n(ch[0] - 12 + (step % 4 === 2 ? 7 : 0)), 0.22, boss ? 'sawtooth' : 'triangle', boss ? 0.08 : 0.12, when, undefined, d);
      // percussion
      if (step % 4 === 0) this.kick(when);
      if (step % 4 === 2) this.hat(when, 0.05);
      if (step % 2 === 1) this.hat(when, 0.025);
      // chords stabs
      if (step % 8 === 0 || step % 8 === 3) for (const s of ch) this.tone(n(s + 12), 0.18, 'square', 0.018, when, undefined, d);
      // melody
      const mel = boss ? [7, 5, 3, 5, 7, 10, 7, 3] : [12, 11, 7, 9, 12, 14, 16, 14];
      const phrase = Math.floor(step / 32) % 2;
      if (step % 2 === 0 && (step + phrase * 3) % 6 !== 5) this.tone(n(ch[0] + mel[(step / 2) % 8] + 12), 0.25, 'triangle', 0.05, when, undefined, d);
    }
  }

  private pad(freq: number, dur: number, when: number, dest: AudioNode, vol: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    for (const det of [-6, 6]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(dest);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  private kick(when: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.16);
  }

  private hat(when: number, vol: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    s.start(t);
    s.stop(t + 0.06);
  }
}

export const audio = new AudioEngine();
