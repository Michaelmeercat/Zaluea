/* CIRCUIT SIEGE — pooled visual effects (particles, rings, beams, bolts, floating text) */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;
  const U = CS.U;

  const QUALITY = {
    low: { particles: 120, numbers: 14, beams: 60, shake: 0.5, glow: false, shadows: false, partMul: 0.35, decor: false },
    medium: { particles: 350, numbers: 24, beams: 140, shake: 0.8, glow: true, shadows: true, partMul: 0.7, decor: true },
    high: { particles: 800, numbers: 32, beams: 260, shake: 1, glow: true, shadows: true, partMul: 1, decor: true },
  };
  CS.QUALITY = QUALITY;

  class FX {
    constructor() {
      this.parts = new U.Pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', kind: 0, drag: 0.9, grav: 0 }), 400);
      this.rings = new U.Pool(() => ({ x: 0, y: 0, r0: 0, r1: 0, life: 0, max: 1, color: '#fff', width: 2 }), 60);
      this.beams = new U.Pool(() => ({ x1: 0, y1: 0, x2: 0, y2: 0, life: 0, max: 1, color: '#fff', width: 2, kind: 0, pts: null }), 150);
      this.texts = new U.Pool(() => ({ x: 0, y: 0, vy: 0, life: 0, max: 1, str: '', color: '#fff', size: 12 }), 50);
      this.flashes = new U.Pool(() => ({ x: 0, y: 0, r: 0, life: 0, max: 1, color: '#fff' }), 40);
      this.shakeAmt = 0;
      this.setQuality('high');
      this.dmgNumbers = true;
      this.shakeOn = true;
      this.load = 0; // 0..1 how busy the battlefield is; lowers particle spawn
    }
    setQuality(q) {
      this.qname = q;
      this.q = QUALITY[q] || QUALITY.high;
    }
    budget() {
      return this.parts.count < this.q.particles;
    }
    spark(x, y, color, n, speed, life, size) {
      n = Math.round(n * this.q.partMul * (1 - this.load * 0.6));
      for (let i = 0; i < n; i++) {
        if (!this.budget()) return;
        const p = this.parts.get();
        const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
        p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        p.max = p.life = life * (0.6 + Math.random() * 0.5);
        p.size = size || 2; p.color = color; p.kind = 0; p.drag = 0.9; p.grav = 0;
      }
    }
    shards(x, y, color, n, speed) {
      n = Math.round(n * this.q.partMul * (1 - this.load * 0.5));
      for (let i = 0; i < n; i++) {
        if (!this.budget()) return;
        const p = this.parts.get();
        const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
        p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 30;
        p.max = p.life = 0.5 + Math.random() * 0.35;
        p.size = 2 + Math.random() * 3; p.color = color; p.kind = 1; p.drag = 0.92; p.grav = 160;
      }
    }
    smoke(x, y, n, color) {
      if (this.qname === 'low') return;
      n = Math.round(n * this.q.partMul * (1 - this.load * 0.7));
      for (let i = 0; i < n; i++) {
        if (!this.budget()) return;
        const p = this.parts.get();
        const a = Math.random() * Math.PI * 2, s = 10 + Math.random() * 25;
        p.x = x + Math.cos(a) * 6; p.y = y + Math.sin(a) * 6; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 12;
        p.max = p.life = 0.6 + Math.random() * 0.5;
        p.size = 6 + Math.random() * 6; p.color = color || '#6b7280'; p.kind = 2; p.drag = 0.95; p.grav = 0;
      }
    }
    ring(x, y, r0, r1, color, life, width) {
      if (this.rings.count > 50) return;
      const g = this.rings.get();
      g.x = x; g.y = y; g.r0 = r0; g.r1 = r1; g.color = color; g.max = g.life = life; g.width = width || 2;
    }
    flash(x, y, r, color, life) {
      if (!this.q.glow || this.flashes.count > 30) return;
      const f = this.flashes.get();
      f.x = x; f.y = y; f.r = r; f.color = color; f.max = f.life = life || 0.18;
    }
    beam(x1, y1, x2, y2, color, width, life, kind) {
      if (this.beams.count >= this.q.beams) return null;
      const b = this.beams.get();
      b.x1 = x1; b.y1 = y1; b.x2 = x2; b.y2 = y2; b.color = color; b.width = width; b.max = b.life = life; b.kind = kind || 0; b.pts = null;
      return b;
    }
    bolt(x1, y1, x2, y2, color, width, life) {
      const b = this.beam(x1, y1, x2, y2, color, width, life, 1);
      if (!b) return;
      const n = Math.max(3, Math.min(9, Math.round(Math.hypot(x2 - x1, y2 - y1) / 16)));
      const pts = [x1, y1];
      const nx = -(y2 - y1), ny = x2 - x1, L = Math.hypot(nx, ny) || 1;
      for (let i = 1; i < n; i++) {
        const t = i / n, off = (Math.random() - 0.5) * 16;
        pts.push(x1 + (x2 - x1) * t + (nx / L) * off, y1 + (y2 - y1) * t + (ny / L) * off);
      }
      pts.push(x2, y2);
      b.pts = pts;
    }
    text(x, y, str, color, size, life) {
      if (!this.dmgNumbers && size < 15) return;
      if (this.texts.count >= this.q.numbers) return;
      const t = this.texts.get();
      t.x = x + (Math.random() - 0.5) * 10; t.y = y; t.vy = -38; t.str = str; t.color = color; t.size = size || 12; t.max = t.life = life || 0.8;
    }
    shake(v) {
      if (!this.shakeOn) return;
      this.shakeAmt = Math.min(7, Math.max(this.shakeAmt, v * this.q.shake));
    }
    update(dt) {
      const P = this.parts.items;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) { this.parts.release(p); continue; }
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d; p.vy = p.vy * d + p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      const tick = (pool) => {
        const it = pool.items;
        for (let i = 0; i < it.length; i++) { const o = it[i]; if (o.active) { o.life -= dt; if (o.life <= 0) pool.release(o); } }
      };
      tick(this.rings); tick(this.beams); tick(this.flashes);
      const T = this.texts.items;
      for (let i = 0; i < T.length; i++) {
        const t = T[i];
        if (!t.active) continue;
        t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.9, dt * 60);
        if (t.life <= 0) this.texts.release(t);
      }
      this.shakeAmt *= Math.pow(0.02, dt);
      if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    }
    clear() {
      this.parts.clear(); this.rings.clear(); this.beams.clear(); this.texts.clear(); this.flashes.clear();
      this.shakeAmt = 0;
    }
  }
  CS.FX = FX;
})();
