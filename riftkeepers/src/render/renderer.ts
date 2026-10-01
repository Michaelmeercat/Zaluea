import type { UnitType } from '../core/types';
import { COLOSSUS, ENEMIES } from '../data/enemies';
import { HERO } from '../data/hero';
import { WORLD_H, WORLD_W, activeRoutes } from '../data/maps';
import { TOWERS } from '../data/towers';
import type { Enemy, SimEvent, Tower } from '../sim/entities';
import { checkPlacement, CELL } from '../sim/mapRuntime';
import type { Sim } from '../sim/sim';
import { makeCanvas } from './draw';
import { drawMapBackground, drawObstacle } from './mapArt';
import { Particles } from './particles';
import { ENEMY_FRAMES, SpriteCache } from './spriteCache';

export interface Quality {
  level: 'low' | 'medium' | 'high';
  reducedEffects: boolean;
  dprCap: number;
}

export interface PlacingState {
  type: UnitType;
  x: number;
  y: number;
  valid: boolean;
  visible: boolean;
}

export interface RenderUi {
  selectedId: number;
  placing: PlacingState | null;
  hoverObstacle: string | null;
  goldTrim: boolean;
  lyraOutfit: string;
  prismatic: boolean;
  showRoutes: boolean;
}

interface Beam {
  x1: number; y1: number; x2: number; y2: number; t: number; max: number; color: string; w: number; pts?: number[];
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  scale = 1;
  ox = 0;
  oy = 0;
  dpr = 1;
  cssW = 0;
  cssH = 0;
  bg: HTMLCanvasElement | null = null;
  bgKey = '';
  mask: HTMLCanvasElement | null = null;
  maskKey = '';
  sprites = new SpriteCache();
  particles = new Particles();
  beams: Beam[] = [];
  quality: Quality = { level: 'high', reducedEffects: false, dprCap: 2 };
  shake = 0;
  private flamesAcc = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.particles.setCap(300);
  }

  setQuality(q: Quality) {
    this.quality = q;
    const cap = q.reducedEffects ? 80 : q.level === 'low' ? 120 : q.level === 'medium' ? 250 : 450;
    this.particles.setCap(cap);
    this.particles.cap = cap;
    this.bgKey = '';
  }

  resize(cssW: number, cssH: number) {
    const dprCap = this.quality.level === 'low' ? 1 : this.quality.dprCap;
    this.dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    this.cssW = cssW;
    this.cssH = cssH;
    this.canvas.width = Math.max(1, Math.round(cssW * this.dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * this.dpr));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.scale = Math.min(cssW / WORLD_W, cssH / WORLD_H);
    this.ox = (cssW - WORLD_W * this.scale) / 2;
    this.oy = (cssH - WORLD_H * this.scale) / 2;
    this.sprites.setScale(this.scale * this.dpr);
    this.bgKey = '';
  }

  screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.ox) / this.scale, y: (sy - this.oy) / this.scale };
  }
  worldToScreen(wx: number, wy: number) {
    return { x: wx * this.scale + this.ox, y: wy * this.scale + this.oy };
  }

  private ensureBg(sim: Sim) {
    const key = `${sim.map.def.id}|${this.canvas.width}|${this.canvas.height}|${this.quality.level}`;
    if (key === this.bgKey && this.bg) return;
    const px = this.scale * this.dpr;
    const cv = makeCanvas(WORLD_W * px, WORLD_H * px);
    const c = cv.getContext('2d')!;
    c.scale(px, px);
    drawMapBackground(c, sim.map);
    this.bg = cv;
    this.bgKey = key;
  }

  /** Red overlay of every spot where a footprint of radius r cannot be placed (ignores towers). */
  private ensureMask(sim: Sim, r: number) {
    const key = `${sim.map.def.id}|${r}|${[...sim.removedObstacles].join(',')}`;
    if (key === this.maskKey && this.mask) return;
    const cols = Math.ceil(WORLD_W / CELL), rows = Math.ceil(WORLD_H / CELL);
    const cv = makeCanvas(cols, rows);
    const c = cv.getContext('2d')!;
    const img = c.createImageData(cols, rows);
    for (let gy = 0; gy < rows; gy++)
      for (let gx = 0; gx < cols; gx++) {
        const ok = checkPlacement(sim.map, { x: gx * CELL + CELL / 2, y: gy * CELL + CELL / 2, r, towers: [], removedObstacles: sim.removedObstacles }).ok;
        const i = (gy * cols + gx) * 4;
        if (!ok) {
          img.data[i] = 220; img.data[i + 1] = 40; img.data[i + 2] = 60; img.data[i + 3] = 70;
        } else {
          img.data[i] = 80; img.data[i + 1] = 230; img.data[i + 2] = 120; img.data[i + 3] = 26;
        }
      }
    c.putImageData(img, 0, 0);
    this.mask = cv;
    this.maskKey = key;
  }

  // ------------------------------------------------------------ events -> cosmetic effects
  consume(events: SimEvent[], prismatic: boolean) {
    const fx = !this.quality.reducedEffects;
    const P = this.particles;
    for (const e of events) {
      switch (e.t) {
        case 'hit':
          if (fx) for (let i = 0; i < 2; i++) P.spawn('spark', e.x, e.y, { vx: rand(-90, 90), vy: rand(-90, 40), color: e.kind === 'shard' ? '#d8f6ff' : e.kind === 'spark' || e.kind === 'bolt' ? '#d8c0ff' : '#fff2c0', size: 1.6, life: 0.22 });
          break;
        case 'boom': {
          const col = e.kind === 'acid' ? '#9af05a' : e.kind === 'frost' ? '#bff0ff' : e.kind === 'secondary' ? '#ffcf6a' : '#ff9a3a';
          P.spawn('ring', e.x, e.y, { size: e.r * 0.3, grow: e.r * 2.6, color: col, life: 0.28 });
          P.spawn('dot', e.x, e.y, { size: e.r * 0.55, grow: e.r * 0.8, color: hexAlpha(col, 0.35), life: 0.18 });
          if (fx) for (let i = 0; i < 5; i++) P.spawn('spark', e.x, e.y, { vx: rand(-160, 160), vy: rand(-160, 80), color: col, size: 2, life: 0.3 });
          if (e.kind !== 'secondary' && fx) for (let i = 0; i < 2; i++) P.spawn('smoke', e.x + rand(-8, 8), e.y + rand(-6, 6), { vy: -20, size: 6, grow: 12, color: 'rgba(80,60,70,0.25)', life: 0.6 });
          if (e.r > 120) this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'chain':
          this.beams.push({ x1: 0, y1: 0, x2: 0, y2: 0, t: 0.22, max: 0.22, color: '#c8b8ff', w: 3, pts: jag(e.pts) });
          break;
        case 'shot':
          if (e.kind === 'rail') this.beams.push({ x1: e.x, y1: e.y, x2: e.tx, y2: e.ty, t: 0.3, max: 0.3, color: prismatic ? '#ff9af0' : '#ffe680', w: (e.w ?? 10) * 0.9 });
          else if (e.kind === 'zap') this.beams.push({ x1: e.x, y1: e.y, x2: e.tx, y2: e.ty, t: 0.1, max: 0.1, color: '#7af0d0', w: 2 });
          break;
        case 'kill': {
          const col = KILL_COLORS[e.type] ?? '#fff';
          const n = e.big ? 14 : fx ? 6 : 3;
          for (let i = 0; i < n; i++) P.spawn('dot', e.x, e.y, { vx: rand(-110, 110), vy: rand(-140, 30), grav: 280, color: col, size: rand(1.8, 3.4), life: 0.45 });
          P.spawn('ring', e.x, e.y, { size: 6, grow: 70, color: hexAlpha(col, 0.8), life: 0.2 });
          if (e.reward >= 1 && fx) P.spawn('coin', e.x, e.y - 8, { vy: -60, size: 4, life: 0.5 });
          if (e.big) this.shake = Math.max(this.shake, e.type === 'colossus' ? 10 : 3);
          break;
        }
        case 'leak':
          P.spawn('text', e.x, e.y - 30, { text: `-${e.lives}`, color: '#ff6a6a', size: 20, vy: -30, life: 1.1 });
          P.spawn('ring', e.x, e.y, { size: 10, grow: 120, color: '#ff4a6a', life: 0.4 });
          this.shake = Math.max(this.shake, 3);
          break;
        case 'nova':
          P.spawn('ring', e.x, e.y, { size: e.r * 0.4, grow: e.r * 1.8, color: '#dff8ff', life: 0.35 });
          if (fx) for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            P.spawn('shard', e.x + Math.cos(a) * e.r * 0.5, e.y + Math.sin(a) * e.r * 0.5, { vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, color: '#e8fbff', size: 3, life: 0.4 });
          }
          break;
        case 'pulse':
          P.spawn('ring', e.x, e.y, { size: 10, grow: e.r * 3, color: '#ff8ae0', life: 0.35 });
          P.spawn('ring', e.x, e.y, { size: 5, grow: e.r * 2.2, color: '#c08aff', life: 0.45 });
          this.shake = Math.max(this.shake, 4);
          break;
        case 'heal':
          P.spawn('ring', e.x, e.y, { size: e.r * 0.2, grow: e.r * 2.2, color: 'rgba(120,255,160,0.8)', life: 0.35 });
          if (fx) for (let i = 0; i < 3; i++) P.spawn('text', e.x + rand(-20, 20), e.y + rand(-10, 10), { text: '+', color: '#7aff9a', size: 14, vy: -40, life: 0.6 });
          break;
        case 'gold':
          P.spawn('text', e.x, e.y, { text: `+${e.amount}`, color: '#ffd34a', size: 18, vy: -34, life: 1.2 });
          break;
        case 'collect':
          P.spawn('text', e.x, e.y - 10, { text: `+${e.amount}`, color: '#ffd34a', size: 18, vy: -40, life: 1 });
          for (let i = 0; i < 5; i++) P.spawn('coin', e.x, e.y, { vx: rand(-60, 60), vy: rand(-120, -40), grav: 200, size: 4, life: 0.6 });
          break;
        case 'place':
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            P.spawn('smoke', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 9, { vx: Math.cos(a) * 40, vy: Math.sin(a) * 20 - 10, size: 4, grow: 6, color: 'rgba(240,230,210,0.7)', life: 0.45 });
          }
          break;
        case 'upgrade':
          P.spawn('ring', e.x, e.y - 10, { size: 10, grow: 80, color: '#ffe680', life: 0.4 });
          for (let i = 0; i < 10; i++) P.spawn('star', e.x + rand(-18, 18), e.y + rand(-20, 4), { vy: rand(-90, -40), color: '#ffe680', size: 3.5, life: 0.7 });
          break;
        case 'sell':
          for (let i = 0; i < 8; i++) P.spawn('coin', e.x, e.y - 10, { vx: rand(-80, 80), vy: rand(-160, -60), grav: 300, size: 4, life: 0.7 });
          break;
        case 'ability':
          P.spawn('ring', e.x, e.y - 10, { size: 14, grow: 220, color: '#fff2a0', life: 0.5 });
          break;
        case 'levelUp':
          P.spawn('text', e.x, e.y - 50, { text: `Level ${e.level}!`, color: '#e8c8ff', size: 18, vy: -24, life: 1.6 });
          for (let i = 0; i < 12; i++) P.spawn('star', e.x + rand(-20, 20), e.y + rand(-30, 0), { vy: rand(-100, -40), color: '#e8c8ff', size: 4, life: 0.9 });
          break;
        case 'bossPhase':
          P.spawn('ring', e.x, e.y - 20, { size: 20, grow: 300, color: e.phase === 3 ? '#ff4a4a' : '#ffb040', life: 0.6 });
          this.shake = Math.max(this.shake, 6);
          break;
        case 'shieldUp':
          P.spawn('ring', e.x, e.y - 20, { size: 60, grow: -40, color: '#ffe680', life: 0.4 });
          break;
        case 'summon':
          for (let i = 0; i < 10; i++) P.spawn('dot', e.x, e.y, { vx: rand(-120, 120), vy: rand(-120, 60), color: '#ff7ad9', size: 3, life: 0.5 });
          break;
        case 'drop':
          for (let i = 0; i < 6; i++) P.spawn('star', e.x + rand(-20, 20), e.y + rand(-30, 0), { vy: -30, color: '#ff9af0', size: 3, life: 0.6 });
          break;
      }
    }
  }

  // ------------------------------------------------------------ frame
  render(sim: Sim, ui: RenderUi, dt: number, time: number) {
    const c = this.ctx;
    this.ensureBg(sim);
    this.particles.update(dt);
    for (const b of this.beams) b.t -= dt;
    this.beams = this.beams.filter((b) => b.t > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2a2350';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = this.quality.reducedEffects ? 0 : (Math.random() - 0.5) * this.shake;
    const sy = this.quality.reducedEffects ? 0 : (Math.random() - 0.5) * this.shake;
    c.setTransform(this.dpr, 0, 0, this.dpr, (this.ox + sx) * this.dpr, (this.oy + sy) * this.dpr);
    c.drawImage(this.bg!, 0, 0, WORLD_W * this.scale, WORLD_H * this.scale);
    c.scale(this.scale, this.scale);

    // placement overlay
    if (ui.placing) {
      const r = ui.placing.type === 'lyra' ? HERO.radius : TOWERS[ui.placing.type].radius;
      this.ensureMask(sim, r);
      c.drawImage(this.mask!, 0, 0, WORLD_W, WORLD_H);
      // blocker outlines
      c.save();
      c.setLineDash([6, 5]);
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      for (const b of sim.map.def.blockers) strokeShape(c, b.shape);
      c.restore();
    }

    this.drawObstacles(sim, ui);
    this.drawZones(sim, time);
    this.drawRifts(sim, ui, time);

    // range of selected
    const sel = ui.selectedId ? sim.towerById(ui.selectedId) : undefined;
    if (sel) this.drawRange(sim, sel, time);

    // entities sorted by y
    const list: { y: number; t?: Tower; e?: Enemy }[] = [];
    for (const t of sim.towers) list.push({ y: t.y, t });
    for (const e of sim.enemies) list.push({ y: e.y + 2, e });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.t) this.drawTower(sim, it.t, ui, time);
      else this.drawEnemy(sim, it.e!, time, dt);
    }
    this.drawDrones(sim, time);
    this.drawDrops(sim, time);
    this.drawProjectiles(sim, ui, time);
    this.drawBeams(c);
    this.particles.draw(c);
    this.drawBars(sim);
    if (ui.placing && ui.placing.visible) this.drawPlacement(sim, ui.placing, time);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawObstacles(sim: Sim, ui: RenderUi) {
    const c = this.ctx;
    for (const o of sim.map.def.obstacles ?? []) {
      if (sim.removedObstacles.has(o.id)) continue;
      drawObstacle(c, o);
      if (ui.placing || ui.hoverObstacle === o.id) {
        c.save();
        c.setLineDash([5, 4]);
        c.strokeStyle = ui.hoverObstacle === o.id ? '#ffe680' : 'rgba(255,255,255,0.85)';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(o.x, o.y, o.r + 4, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      // price tag
      c.font = '600 12px Fredoka, system-ui, sans-serif';
      c.textAlign = 'center';
      const label = `${o.cost}`;
      const w = c.measureText(label).width + 20;
      c.fillStyle = 'rgba(43,33,64,0.85)';
      roundRectPath(c, o.x - w / 2, o.y + o.r + 2, w, 16, 8);
      c.fill();
      c.fillStyle = '#ffd34a';
      c.beginPath();
      c.arc(o.x - w / 2 + 9, o.y + o.r + 10, 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff';
      c.fillText(label, o.x + 4, o.y + o.r + 14);
    }
  }

  private drawZones(sim: Sim, time: number) {
    const c = this.ctx;
    for (const z of sim.zones) {
      const a = Math.min(1, z.t / 0.6) * 0.75;
      const g = c.createRadialGradient(z.x, z.y, 2, z.x, z.y, z.r);
      g.addColorStop(0, `rgba(255,220,90,${a})`);
      g.addColorStop(0.6, `rgba(255,110,40,${a * 0.7})`);
      g.addColorStop(1, 'rgba(255,80,30,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(z.x, z.y, z.r, z.r * 0.7, 0, 0, Math.PI * 2);
      c.fill();
      if (!this.quality.reducedEffects && Math.random() < 0.25) {
        const ang = Math.random() * Math.PI * 2, rr = Math.random() * z.r * 0.8;
        this.particles.spawn('flame', z.x + Math.cos(ang) * rr, z.y + Math.sin(ang) * rr * 0.7, { vy: -30, size: 4, life: 0.5 });
      }
    }
    void time;
  }

  private drawRifts(sim: Sim, ui: RenderUi, time: number) {
    const c = this.ctx;
    const def = sim.map.def;
    const current = sim.waveActive ? activeRoutes(def, sim.wave) : sim.nextRoutes();
    const multi = !!def.routes;
    const seen = new Set<string>();
    sim.map.paths.forEach((p, i) => {
      const key = `${Math.round(p.xs[0])},${Math.round(p.ys[0])}`;
      if (seen.has(key)) return;
      seen.add(key);
      const x = p.xs[0], y = p.ys[0];
      const active = !multi || current.includes(i);
      const pulse = 1 + Math.sin(time * 3 + i) * 0.06;
      c.save();
      c.translate(x, y);
      c.globalAlpha = active ? 1 : 0.35;
      const g = c.createRadialGradient(0, 0, 2, 0, 0, 30 * pulse);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, active ? '#ff9af0' : '#b0a8c0');
      g.addColorStop(0.7, active ? 'rgba(140,60,220,0.8)' : 'rgba(90,80,110,0.6)');
      g.addColorStop(1, 'rgba(60,20,120,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, 26 * pulse, 30 * pulse, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = active ? 'rgba(255,200,250,0.9)' : 'rgba(200,200,220,0.6)';
      c.lineWidth = 2.2;
      for (let k = 0; k < 3; k++) {
        const a0 = time * (active ? 2.4 : 0.6) + (k * Math.PI * 2) / 3;
        c.beginPath();
        c.ellipse(0, 0, 18 - k * 4, 22 - k * 5, 0, a0, a0 + 2.2);
        c.stroke();
      }
      c.restore();
      if (multi && ui.showRoutes && !sim.waveActive) {
        const name = def.routeNames?.[i] ?? '';
        const lx = Math.min(Math.max(x, 70), WORLD_W - 70), ly = Math.min(Math.max(y + (y > 600 ? -48 : 46), 20), WORLD_H - 20);
        c.font = '600 14px Fredoka, system-ui, sans-serif';
        c.textAlign = 'center';
        const txt = active ? `${name}: NEXT` : `${name}: dormant`;
        const w = c.measureText(txt).width + 16;
        c.fillStyle = active ? 'rgba(255,90,200,0.9)' : 'rgba(40,30,60,0.75)';
        roundRectPath(c, lx - w / 2, ly - 12, w, 20, 10);
        c.fill();
        c.fillStyle = '#fff';
        c.fillText(txt, lx, ly + 3);
      }
    });
  }

  private drawRange(sim: Sim, t: Tower, time: number) {
    const c = this.ctx;
    const r = t.type === 'beacon' ? t.base.supportRange : sim.effRange(t);
    if (r <= 0) return;
    c.save();
    c.beginPath();
    c.arc(t.x, t.y, r, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fill();
    c.setLineDash([8, 6]);
    c.lineDashOffset = -time * 20;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  }

  private drawTower(sim: Sim, t: Tower, ui: RenderUi, time: number) {
    const c = this.ctx;
    const ext = SpriteCache.towerExtent;
    const look = {
      levels: t.levels, goldTrim: ui.goldTrim, lyraOutfit: ui.lyraOutfit,
      heroLevel: t.type === 'lyra' ? sim.heroLevel : undefined, mode: t.base.modes ? t.mode : undefined,
    };
    const spr = this.sprites.tower(t.type, look);
    const age = sim.time - t.placedAt;
    const pop = age < 0.35 ? easeOutBack(Math.max(0, age) / 0.35) : 1;
    // shadow
    c.fillStyle = 'rgba(30,20,50,0.28)';
    c.beginPath();
    c.ellipse(t.x, t.y + 6, t.radius * 1.05, t.radius * 0.5, 0, 0, Math.PI * 2);
    c.fill();
    if (ui.selectedId === t.id) {
      c.strokeStyle = '#ffe680';
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(t.x, t.y + 2, t.radius + 5, (t.radius + 5) * 0.55, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.save();
    c.translate(t.x, t.y);
    c.scale(pop, pop);
    c.drawImage(spr.base, -ext, -ext, ext * 2, ext * 2);
    // figure: idle bob, attack squash, facing
    const bob = Math.sin(time * 2.2 + t.id) * 0.9;
    const atk = t.attackAnim > 0 ? t.attackAnim / 0.18 : 0;
    const face = t.type === 'beacon' || t.type === 'orchard' ? 1 : Math.cos(t.angle) < 0 ? -1 : 1;
    c.translate(0, bob);
    c.scale(face * (1 + atk * 0.06), 1 - atk * 0.08);
    c.drawImage(spr.fig, -ext, -ext, ext * 2, ext * 2);
    c.restore();
    // beacon rays / support glow
    if (t.type === 'beacon') {
      const lv = Math.max(...t.levels);
      c.save();
      c.translate(t.x, t.y - 46 * pop);
      c.rotate(time * 0.8);
      c.strokeStyle = `rgba(255,230,120,${0.35 + lv * 0.08})`;
      c.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        c.rotate(Math.PI / 4);
        c.beginPath();
        c.moveTo(10, 0);
        c.lineTo(16 + lv * 1.5, 0);
        c.stroke();
      }
      c.restore();
    }
    if (t.abilityT > 0) {
      c.strokeStyle = 'rgba(255,230,120,0.9)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(t.x, t.y - 16, 26 + Math.sin(time * 10) * 2, 0, Math.PI * 2);
      c.stroke();
    }
    if (t.type === 'lyra') {
      // level badge
      c.fillStyle = '#7a4ad0';
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(t.x + 15, t.y + 8, 8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#fff';
      c.font = '700 10px Fredoka, system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(String(sim.heroLevel), t.x + 15, t.y + 11.5);
    }
    if (t.type === 'orchard' && t.bank >= 1) {
      c.font = '600 11px Fredoka, system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = 'rgba(43,33,64,0.8)';
      const txt = `${Math.floor(t.bank)}`;
      const w = c.measureText(txt).width + 12;
      roundRectPath(c, t.x - w / 2, t.y + 14, w, 14, 7);
      c.fill();
      c.fillStyle = '#ffd34a';
      c.fillText(txt, t.x, t.y + 25);
    }
  }

  private drawEnemy(sim: Sim, e: Enemy, time: number, dt: number) {
    const c = this.ctx;
    const def = e.def;
    const frame = Math.floor(((e.anim % 1) + 1) % 1 * ENEMY_FRAMES) % ENEMY_FRAMES;
    const flash = e.flashT > 0 && !this.quality.reducedEffects;
    const phase = e.boss ? e.boss.phase : 1;
    const spr = this.sprites.enemy(e.type, e.freezeT > 0 || e.stunT > 0 ? 0 : frame, flash, phase);
    const ext = spr.width / this.sprites.pxScale / 2;
    const flip = Math.cos(e.angle) < -0.1;
    const r = def.radius;
    // shadow
    c.fillStyle = 'rgba(30,20,50,0.25)';
    c.beginPath();
    c.ellipse(e.x, e.y + r * 0.75, r * 0.95, r * 0.38, 0, 0, Math.PI * 2);
    c.fill();
    const slowed = sim.slowFactor(e) < 0.99 && e.freezeT <= 0 && e.stunT <= 0;
    if (slowed) {
      c.strokeStyle = 'rgba(140,210,255,0.9)';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(e.x, e.y + r * 0.75, r * 0.9, r * 0.36, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.save();
    c.translate(e.x, e.y);
    if (flip) c.scale(-1, 1);
    if (e.concealed) c.globalAlpha = e.exposedT > 0 ? 0.75 : 0.42 + Math.sin(time * 5 + e.id) * 0.08;
    if (e.boss && e.boss.telegraph) {
      const k = 1 + Math.sin(time * 30) * 0.03;
      c.scale(k, k);
    }
    c.drawImage(spr, -ext, -ext, ext * 2, ext * 2);
    c.restore();
    c.globalAlpha = 1;
    if (e.concealed) {
      c.save();
      c.setLineDash([3, 3]);
      c.strokeStyle = e.exposedT > 0 ? 'rgba(255,240,120,0.9)' : 'rgba(200,255,250,0.6)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(e.x, e.y, r + 3, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    // status overlays
    if (e.freezeT > 0) {
      c.fillStyle = 'rgba(200,240,255,0.55)';
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1.5;
      roundRectPath(c, e.x - r - 2, e.y - r - 4, (r + 2) * 2, (r + 2) * 2, 4);
      c.fill();
      c.stroke();
    }
    if (e.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        c.fillStyle = '#ffe680';
        c.beginPath();
        c.arc(e.x + Math.cos(a) * r * 0.8, e.y - r - 4 + Math.sin(a) * 3, 2.2, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (e.burnT > 0 && !this.quality.reducedEffects) {
      this.flamesAcc += dt;
      if (Math.random() < 0.35) this.particles.spawn('flame', e.x + rand(-r * 0.6, r * 0.6), e.y + rand(-r * 0.4, r * 0.4), { vy: -40, size: 3.5, life: 0.35 });
    }
    if (e.burnT > 0) {
      c.fillStyle = 'rgba(255,120,40,0.25)';
      c.beginPath();
      c.arc(e.x, e.y, r, 0, Math.PI * 2);
      c.fill();
    }
    if (e.corrodeT > 0) {
      c.fillStyle = 'rgba(140,240,80,0.28)';
      c.beginPath();
      c.arc(e.x, e.y, r * 0.95, 0, Math.PI * 2);
      c.fill();
      if (Math.random() < 0.15 && !this.quality.reducedEffects) this.particles.spawn('dot', e.x + rand(-r, r), e.y, { vy: -30, size: 2, color: '#9af05a', life: 0.4 });
    }
    if (e.shield > 0) {
      const a = 0.25 + 0.5 * (e.shield / Math.max(1, e.maxShield));
      c.strokeStyle = `rgba(140,220,255,${a + 0.2})`;
      c.fillStyle = `rgba(160,220,255,${a * 0.35})`;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(e.x, e.y - 2, r + 6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(e.x, e.y - 2, r + 2, -2.4, -1.6);
      c.stroke();
    }
    if (e.boss) {
      const b = e.boss;
      if (b.tempShield > 0) {
        c.strokeStyle = '#ffe680';
        c.fillStyle = 'rgba(255,230,120,0.18)';
        c.lineWidth = 3;
        hexPath(c, e.x, e.y - 14, r + 22);
        c.fill();
        c.stroke();
      }
      if (b.hardenT > 0) {
        c.strokeStyle = 'rgba(255,60,60,0.9)';
        c.lineWidth = 4;
        c.beginPath();
        c.arc(e.x, e.y - 12, r + 12 + Math.sin(time * 12) * 2, 0, Math.PI * 2);
        c.stroke();
      }
      if (b.telegraph) {
        const col = b.telegraph === 'shield' ? '#ffe680' : b.telegraph === 'summon' ? '#ff7ad9' : '#ff4a4a';
        c.strokeStyle = col;
        c.lineWidth = 3;
        c.setLineDash([10, 8]);
        c.beginPath();
        c.arc(e.x, e.y - 12, r + 30 - b.telegraphT * 14, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        c.font = '700 14px Fredoka, system-ui, sans-serif';
        c.textAlign = 'center';
        c.fillStyle = col;
        c.strokeStyle = 'rgba(40,20,60,0.9)';
        c.lineWidth = 3;
        const label = b.telegraph === 'shield' ? 'SHIELD!' : b.telegraph === 'summon' ? 'SUMMONING!' : 'HARDENING!';
        c.strokeText(label, e.x, e.y - r - 40);
        c.fillText(label, e.x, e.y - r - 40);
      }
    }
    if (e.markT > 0) {
      c.strokeStyle = 'rgba(255,70,70,0.9)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(e.x, e.y - 2, r * 0.7, 0, Math.PI * 2);
      c.moveTo(e.x - r, e.y - 2); c.lineTo(e.x - r * 0.4, e.y - 2);
      c.moveTo(e.x + r * 0.4, e.y - 2); c.lineTo(e.x + r, e.y - 2);
      c.stroke();
    }
  }

  private drawBars(sim: Sim) {
    const c = this.ctx;
    for (const e of sim.enemies) {
      const def = e.def;
      const r = def.radius;
      const durable = e.maxHp >= 20 || def.boss || def.big;
      const damaged = e.hp < e.maxHp - 0.01 || (e.maxShield > 0 && e.shield < e.maxShield);
      const by = e.y - r - (def.boss ? 62 : def.big ? 32 : 12);
      // badges for armor / regen
      let bx = e.x - r;
      if (e.armor > 0) {
        badge(c, bx - 6, by - 1, '#8a9ab8', 'A');
        bx += 0;
      }
      if (e.regen) badge(c, e.x + r + 6, by - 1, '#4ac06a', '+');
      if (def.boss || !durable || !damaged) continue;
      const w = Math.max(22, r * 1.6);
      c.fillStyle = 'rgba(30,20,50,0.75)';
      c.fillRect(e.x - w / 2 - 1, by - 3, w + 2, 6);
      c.fillStyle = e.hp / e.maxHp > 0.5 ? '#6ae06a' : e.hp / e.maxHp > 0.25 ? '#ffd34a' : '#ff5a5a';
      c.fillRect(e.x - w / 2, by - 2, w * Math.max(0, e.hp / e.maxHp), 4);
      if (e.shield > 0) {
        c.fillStyle = '#9ad8ff';
        c.fillRect(e.x - w / 2, by - 4, w * (e.shield / e.maxShield), 2);
      }
    }
  }

  private drawDrones(sim: Sim, time: number) {
    const c = this.ctx;
    for (const d of sim.drones) {
      const y = d.y - 26 + Math.sin(time * 6 + d.id) * 2;
      c.fillStyle = 'rgba(30,20,50,0.22)';
      c.beginPath();
      c.ellipse(d.x, d.y + 4, 7, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#50d0b0';
      c.strokeStyle = '#2b2140';
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(d.x, y, 8, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#e0fff8';
      c.beginPath();
      c.arc(d.x + 2, y - 1, 2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1.2;
      const a = time * 40;
      c.beginPath();
      c.moveTo(d.x - 10 * Math.cos(a), y - 6);
      c.lineTo(d.x + 10 * Math.cos(a), y - 6);
      c.stroke();
    }
  }

  private drawDrops(sim: Sim, time: number) {
    const c = this.ctx;
    for (const d of sim.drops) {
      const y = d.y - 10 + Math.sin(time * 3 + d.id) * 3;
      const g = c.createRadialGradient(d.x, y, 1, d.x, y, 18);
      g.addColorStop(0, 'rgba(255,200,255,0.7)');
      g.addColorStop(1, 'rgba(255,200,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(d.x, y, 18, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ff8ae0';
      c.strokeStyle = '#2b2140';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(d.x, y - 10); c.lineTo(d.x + 6, y); c.lineTo(d.x, y + 10); c.lineTo(d.x - 6, y);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.moveTo(d.x - 2, y - 6); c.lineTo(d.x + 1, y - 2); c.lineTo(d.x - 2, y + 2);
      c.fill();
      c.font = '700 11px Fredoka, system-ui, sans-serif';
      c.textAlign = 'center';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(40,20,60,0.9)';
      c.strokeText(String(d.value), d.x, y + 22);
      c.fillStyle = '#ffd34a';
      c.fillText(String(d.value), d.x, y + 22);
    }
  }

  private drawProjectiles(sim: Sim, ui: RenderUi, time: number) {
    const c = this.ctx;
    for (const p of sim.projectiles) {
      const ang = Math.atan2(p.vy, p.vx);
      const hue = ui.prismatic ? `hsl(${(time * 300 + p.id * 40) % 360},90%,70%)` : null;
      switch (p.kind) {
        case 'arrow': {
          const L = 12 * p.size;
          c.strokeStyle = hue ?? 'rgba(255,255,255,0.35)';
          c.lineWidth = 2 * p.size;
          c.beginPath();
          c.moveTo(p.x - Math.cos(ang) * L * 2, p.y - Math.sin(ang) * L * 2);
          c.lineTo(p.x, p.y);
          c.stroke();
          c.save();
          c.translate(p.x, p.y);
          c.rotate(ang);
          c.strokeStyle = '#6a4422';
          c.lineWidth = 2 * Math.max(1, p.size * 0.8);
          c.beginPath();
          c.moveTo(-L, 0);
          c.lineTo(0, 0);
          c.stroke();
          c.fillStyle = p.armorPierce >= 99 ? '#ffd34a' : '#d8d8e0';
          c.beginPath();
          c.moveTo(4 * p.size, 0); c.lineTo(-2, -3 * p.size); c.lineTo(-2, 3 * p.size);
          c.closePath();
          c.fill();
          c.fillStyle = '#7ad04a';
          c.fillRect(-L - 1, -2, 4, 4);
          c.restore();
          break;
        }
        case 'flask': {
          const t = Math.min(1, p.flight / p.flightTotal);
          const h = Math.sin(t * Math.PI) * 46;
          c.fillStyle = 'rgba(30,20,50,0.25)';
          c.beginPath();
          c.ellipse(p.x, p.y, 5, 2.5, 0, 0, Math.PI * 2);
          c.fill();
          const col = p.dmgType === 'acid' ? '#8ae05a' : '#ff8a3a';
          c.save();
          c.translate(p.x, p.y - h);
          c.rotate(time * 10);
          c.fillStyle = col;
          c.strokeStyle = '#2b2140';
          c.lineWidth = 1.5;
          const s = 5 * p.size;
          c.beginPath();
          c.arc(0, 0, s, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          c.fillStyle = '#d8eef8';
          c.fillRect(-1.5, -s - 4, 3, 4);
          c.restore();
          if (!this.quality.reducedEffects && Math.random() < 0.4) this.particles.spawn('dot', p.x, p.y - h, { size: 2, color: hexAlpha(col, 0.6), life: 0.25 });
          break;
        }
        case 'shard': {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(ang);
          const s = 1.2 * p.size;
          c.fillStyle = hue ?? 'rgba(200,240,255,0.35)';
          c.beginPath();
          c.moveTo(-22 * s, 0); c.lineTo(0, -3 * s); c.lineTo(0, 3 * s);
          c.fill();
          c.fillStyle = '#e8fbff';
          c.strokeStyle = '#4a8ad0';
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(8 * s, 0); c.lineTo(0, -4 * s); c.lineTo(-8 * s, 0); c.lineTo(0, 4 * s);
          c.closePath();
          c.fill();
          c.stroke();
          c.restore();
          break;
        }
        case 'spark':
        case 'bolt': {
          const col = p.kind === 'bolt' ? '#ff8ae0' : '#b0a0ff';
          c.strokeStyle = hue ?? hexAlpha(col, 0.5);
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          c.lineTo(p.x, p.y);
          c.stroke();
          const g = c.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, 8);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.4, col);
          g.addColorStop(1, 'rgba(160,120,255,0)');
          c.fillStyle = g;
          c.beginPath();
          c.arc(p.x, p.y, 8, 0, Math.PI * 2);
          c.fill();
          break;
        }
      }
    }
  }

  private drawBeams(c: CanvasRenderingContext2D) {
    for (const b of this.beams) {
      const a = b.t / b.max;
      c.globalAlpha = a;
      c.strokeStyle = b.color;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      if (b.pts) {
        c.lineWidth = b.w + 3;
        c.strokeStyle = 'rgba(160,140,255,0.5)';
        polyline(c, b.pts);
        c.lineWidth = b.w;
        c.strokeStyle = '#ffffff';
        polyline(c, b.pts);
      } else {
        c.lineWidth = b.w * a + 1;
        c.beginPath();
        c.moveTo(b.x1, b.y1);
        c.lineTo(b.x2, b.y2);
        c.stroke();
        c.lineWidth = Math.max(1, b.w * 0.3 * a);
        c.strokeStyle = '#ffffff';
        c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  private drawPlacement(sim: Sim, pl: PlacingState, time: number) {
    const c = this.ctx;
    const type = pl.type;
    const range = type === 'lyra' ? 140 : type === 'beacon' ? TOWERS.beacon.base.range! : type === 'orchard' ? 0 : TOWERS[type].base.range!;
    const r = type === 'lyra' ? HERO.radius : TOWERS[type].radius;
    c.save();
    if (range > 0) {
      c.beginPath();
      c.arc(pl.x, pl.y, range, 0, Math.PI * 2);
      c.fillStyle = pl.valid ? 'rgba(90,230,130,0.16)' : 'rgba(255,70,90,0.16)';
      c.fill();
      c.setLineDash([8, 6]);
      c.lineDashOffset = -time * 20;
      c.strokeStyle = pl.valid ? 'rgba(120,255,160,0.95)' : 'rgba(255,90,110,0.95)';
      c.lineWidth = 2.5;
      c.stroke();
      c.setLineDash([]);
    }
    // other towers' footprints
    for (const t of sim.towers) {
      c.strokeStyle = 'rgba(255,90,110,0.6)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.arc(pl.x, pl.y, r, 0, Math.PI * 2);
    c.fillStyle = pl.valid ? 'rgba(90,230,130,0.45)' : 'rgba(255,70,90,0.5)';
    c.fill();
    c.strokeStyle = pl.valid ? '#7aff9a' : '#ff5a6a';
    c.lineWidth = 2.5;
    c.stroke();
    const spr = this.sprites.tower(type, { levels: [0, 0, 0], heroLevel: 1 });
    const ext = SpriteCache.towerExtent;
    c.globalAlpha = 0.85;
    c.drawImage(spr.base, pl.x - ext, pl.y - ext, ext * 2, ext * 2);
    c.drawImage(spr.fig, pl.x - ext, pl.y - ext, ext * 2, ext * 2);
    c.restore();
  }
}

const KILL_COLORS: Record<string, string> = {
  sproutling: '#8fe05a', skitter: '#b07aff', bulwark: '#a8b4c8', wisp: '#9ff0e6', emberkin: '#ff8a3a', frostling: '#bff0ff',
  broodpod: '#ff8ad0', mender: '#6ae0b0', brute: '#a88ae0', colossus: '#ff6fd8',
};

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function easeOutBack(t: number) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
export function hexAlpha(col: string, a: number) {
  if (!col.startsWith('#')) return col;
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function roundRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function hexPath(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
function badge(c: CanvasRenderingContext2D, x: number, y: number, col: string, ch: string) {
  c.fillStyle = col;
  c.strokeStyle = '#2b2140';
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(x, y, 5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#fff';
  c.font = '700 8px Fredoka, system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText(ch, x, y + 3);
}
function polyline(c: CanvasRenderingContext2D, pts: number[]) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
}
function jag(pts: number[]): number[] {
  const out: number[] = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      out.push(x0 + (x1 - x0) * t + rand(-6, 6), y0 + (y1 - y0) * t + rand(-6, 6));
    }
    out.push(x1, y1);
  }
  return out;
}
function strokeShape(c: CanvasRenderingContext2D, s: import('../data/maps').Shape) {
  c.beginPath();
  if (s.kind === 'circle') c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  else if (s.kind === 'rect') c.rect(s.x, s.y, s.w, s.h);
  else {
    c.moveTo(s.pts[0].x, s.pts[0].y);
    for (const p of s.pts.slice(1)) c.lineTo(p.x, p.y);
    c.closePath();
  }
  c.stroke();
}

export { ENEMIES, COLOSSUS };
