import type { Ctx } from './draw';

export type PKind = 'dot' | 'ring' | 'spark' | 'text' | 'flame' | 'shard' | 'coin' | 'star' | 'smoke';

export interface Particle {
  active: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  grav: number;
  text: string;
  rot: number;
}

/** Fixed-capacity particle pool. Cosmetic only; never affects the simulation. */
export class Particles {
  pool: Particle[] = [];
  cap = 300;
  private cursor = 0;

  setCap(cap: number) {
    this.cap = cap;
    while (this.pool.length < cap) this.pool.push(this.blank());
  }

  private blank(): Particle {
    return { active: false, kind: 'dot', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, grow: 0, color: '#fff', grav: 0, text: '', rot: 0 };
  }

  spawn(kind: PKind, x: number, y: number, o: Partial<Particle> = {}): Particle | null {
    // find a free slot (ring buffer); if none, overwrite the oldest-ish
    for (let n = 0; n < this.cap; n++) {
      const i = (this.cursor + n) % this.cap;
      const p = this.pool[i];
      if (!p.active || n === this.cap - 1) {
        this.cursor = (i + 1) % this.cap;
        if (p.active && (kind === 'dot' || kind === 'spark' || kind === 'smoke')) return null; // full: drop low-value particles
        Object.assign(p, this.blank(), { active: true, kind, x, y, max: 0.6, life: 0.6 }, o);
        p.life = o.life ?? o.max ?? p.max;
        p.max = o.max ?? p.life;
        return p;
      }
    }
    return null;
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += dt * 4;
    }
  }

  draw(c: Ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.max;
      c.globalAlpha = Math.min(1, t * 1.6);
      switch (p.kind) {
        case 'dot':
        case 'smoke':
          c.fillStyle = p.color;
          c.beginPath();
          c.arc(p.x, p.y, Math.max(0.3, p.size), 0, Math.PI * 2);
          c.fill();
          break;
        case 'spark':
          c.strokeStyle = p.color;
          c.lineWidth = p.size;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          c.stroke();
          break;
        case 'ring':
          c.strokeStyle = p.color;
          c.lineWidth = Math.max(1, 4 * t);
          c.beginPath();
          c.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
          c.stroke();
          break;
        case 'flame': {
          const s = p.size * (0.5 + t * 0.5);
          c.fillStyle = t > 0.5 ? '#ffd24a' : '#ff7a2a';
          c.beginPath();
          c.moveTo(p.x, p.y - s * 1.8);
          c.quadraticCurveTo(p.x + s, p.y, p.x, p.y + s * 0.6);
          c.quadraticCurveTo(p.x - s, p.y, p.x, p.y - s * 1.8);
          c.fill();
          break;
        }
        case 'shard':
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.fillStyle = p.color;
          c.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
          c.restore();
          break;
        case 'star': {
          c.fillStyle = p.color;
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 ? p.size * 0.4 : p.size;
            const a = (i * Math.PI) / 4;
            if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          c.closePath();
          c.fill();
          c.restore();
          break;
        }
        case 'coin':
          c.fillStyle = '#ffd34a';
          c.strokeStyle = '#a06a10';
          c.lineWidth = 1.2;
          c.beginPath();
          c.ellipse(p.x, p.y, p.size * Math.abs(Math.cos(p.rot)), p.size, 0, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          break;
        case 'text':
          c.font = `700 ${p.size}px Fredoka, system-ui, sans-serif`;
          c.textAlign = 'center';
          c.lineWidth = 3;
          c.strokeStyle = 'rgba(40,20,60,0.85)';
          c.strokeText(p.text, p.x, p.y);
          c.fillStyle = p.color;
          c.fillText(p.text, p.x, p.y);
          break;
      }
    }
    c.globalAlpha = 1;
  }
}
