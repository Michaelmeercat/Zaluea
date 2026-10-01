import { Rng } from '../core/rng';
import type { Blocker, MapDef, Obstacle, Prop, Shape } from '../data/maps';
import { PATH_HALF_WIDTH, WORLD_H, WORLD_W } from '../data/maps';
import type { RuntimeMap } from '../sim/mapRuntime';
import { OUTLINE, circle, ellipse, line, linear, poly, radial, roundRect, shade, star, type Ctx } from './draw';

function shapePath(c: Ctx, s: Shape, grow = 0) {
  c.beginPath();
  if (s.kind === 'circle') c.arc(s.x, s.y, s.r + grow, 0, Math.PI * 2);
  else if (s.kind === 'rect') {
    const r = Math.min(14, s.w / 3, s.h / 3);
    const x = s.x - grow, y = s.y - grow, w = s.w + grow * 2, h = s.h + grow * 2;
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  } else {
    c.moveTo(s.pts[0].x, s.pts[0].y);
    for (const p of s.pts.slice(1)) c.lineTo(p.x, p.y);
    c.closePath();
  }
}

function strokePath(c: Ctx, rm: RuntimeMap, idx: number) {
  const p = rm.paths[idx];
  c.beginPath();
  c.moveTo(p.xs[0], p.ys[0]);
  for (let i = 1; i < p.xs.length; i++) c.lineTo(p.xs[i], p.ys[i]);
}

/** Draw the full static background for a map in world coordinates. */
export function drawMapBackground(c: Ctx, rm: RuntimeMap) {
  const def = rm.def;
  const th = def.theme;
  const rng = new Rng(def.seed);
  // sky
  c.fillStyle = linear(c, 0, 0, 0, WORLD_H, [[0, th.sky], [1, shade(th.sky, -0.15)]]);
  c.fillRect(0, 0, WORLD_W, WORLD_H);
  // island underside cliff
  c.save();
  c.beginPath();
  c.moveTo(10, 700);
  for (let x = 10; x <= 1270; x += 40) c.lineTo(x, 712 + Math.sin(x * 0.07) * 4 + 4);
  c.lineTo(1270, 700);
  c.closePath();
  c.fillStyle = linear(c, 0, 690, 0, 720, [[0, '#8a6a4a'], [1, '#5a4030']]);
  c.fill();
  c.restore();
  // island surface
  c.save();
  roundRect(c, 3, 3, WORLD_W - 6, WORLD_H - 14, 26, linear(c, 0, 0, WORLD_W, WORLD_H, [[0, th.ground[0]], [1, th.ground[1]]]), false);
  c.clip();
  // terrain patches
  for (let i = 0; i < 70; i++) {
    const x = rng.next() * WORLD_W, y = rng.next() * WORLD_H, r = 30 + rng.next() * 90;
    c.fillStyle = i % 2 ? hexA(th.ground2, 0.35) : hexA(shade(th.ground[1], -0.12), 0.18);
    c.beginPath();
    c.ellipse(x, y, r, r * (0.5 + rng.next() * 0.4), rng.next() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
  // speckles
  for (let i = 0; i < 900; i++) {
    const x = rng.next() * WORLD_W, y = rng.next() * WORLD_H;
    c.fillStyle = rng.next() < 0.5 ? hexA(shade(th.ground[0], 0.25), 0.5) : hexA(shade(th.ground[1], -0.2), 0.35);
    c.fillRect(x, y, 2, 2);
  }
  // buildable-zone presentation
  if (def.buildZones) {
    // outside the zones: rough, unbuildable terrain
    c.save();
    c.fillStyle = def.id === 'frostglass' ? 'rgba(80,110,150,0.32)' : 'rgba(30,20,60,0.42)';
    c.beginPath();
    c.rect(0, 0, WORLD_W, WORLD_H);
    for (const z of def.buildZones) {
      shapePathRev(c, z);
    }
    c.fill('evenodd');
    // cracks / scree texture
    for (let i = 0; i < 160; i++) {
      const x = rng.next() * WORLD_W, y = rng.next() * WORLD_H;
      if (def.buildZones.some((z) => inShape(z, x, y, 6))) continue;
      c.strokeStyle = def.id === 'frostglass' ? 'rgba(255,255,255,0.35)' : 'rgba(255,120,220,0.25)';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + rng.range(-14, 14), y + rng.range(-8, 8));
      c.lineTo(x + rng.range(-14, 14), y + rng.range(-8, 8));
      c.stroke();
    }
    c.restore();
    for (const z of def.buildZones) drawZone(c, def, z);
  }
  // blockers
  for (const b of def.blockers) drawBlocker(c, def, b, rng);
  // roads: all edges first, then fills so merges blend
  c.lineJoin = 'round';
  c.lineCap = 'round';
  for (let i = 0; i < rm.paths.length; i++) {
    strokePath(c, rm, i);
    c.strokeStyle = 'rgba(30,20,50,0.18)';
    c.lineWidth = PATH_HALF_WIDTH * 2 + 14;
    c.stroke();
  }
  for (let i = 0; i < rm.paths.length; i++) {
    strokePath(c, rm, i);
    c.strokeStyle = th.pathEdge;
    c.lineWidth = PATH_HALF_WIDTH * 2 + 6;
    c.stroke();
  }
  for (let i = 0; i < rm.paths.length; i++) {
    strokePath(c, rm, i);
    c.strokeStyle = th.path;
    c.lineWidth = PATH_HALF_WIDTH * 2 - 2;
    c.stroke();
  }
  for (let i = 0; i < rm.paths.length; i++) {
    strokePath(c, rm, i);
    c.strokeStyle = hexA(shade(th.path, 0.25), 0.55);
    c.lineWidth = PATH_HALF_WIDTH * 0.8;
    c.stroke();
  }
  // road texture: stones / ruts
  for (const p of rm.paths) {
    for (let i = 0; i < p.xs.length; i += 4) {
      if (rng.next() < 0.5) continue;
      const a = Math.atan2(p.ys[Math.min(i + 1, p.ys.length - 1)] - p.ys[i], p.xs[Math.min(i + 1, p.xs.length - 1)] - p.xs[i]);
      const off = rng.range(-PATH_HALF_WIDTH + 6, PATH_HALF_WIDTH - 6);
      const x = p.xs[i] - Math.sin(a) * off, y = p.ys[i] + Math.cos(a) * off;
      c.fillStyle = hexA(th.pathDetail, 0.9);
      c.beginPath();
      c.ellipse(x, y, rng.range(2, 4.5), rng.range(1.5, 3), a, 0, Math.PI * 2);
      c.fill();
    }
  }
  // direction chevrons (subtle) near each entrance
  for (const p of rm.paths) {
    for (const d of [70, 110]) {
      const i = p.cum.findIndex((v) => v >= d);
      if (i < 1) continue;
      const a = Math.atan2(p.ys[i] - p.ys[i - 1], p.xs[i] - p.xs[i - 1]);
      c.save();
      c.translate(p.xs[i], p.ys[i]);
      c.rotate(a);
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-6, -9); c.lineTo(4, 0); c.lineTo(-6, 9);
      c.stroke();
      c.restore();
    }
  }
  // rift scorch at entrances
  for (const p of rm.paths) {
    const x = p.xs[0], y = p.ys[0];
    c.fillStyle = radial(c, x, y, 50, 'rgba(60,20,90,0.55)', 'rgba(60,20,90,0)', 0, 0);
    c.beginPath();
    c.arc(x, y, 50, 0, Math.PI * 2);
    c.fill();
  }
  // props
  const props = [...def.props].sort((a, b) => a.y - b.y);
  for (const pr of props) drawProp(c, def, pr);
  // village gates
  const exits = new Map<string, { x: number; y: number; a: number }>();
  for (const p of rm.paths) {
    const n = p.xs.length - 1;
    const key = `${Math.round(p.xs[n])},${Math.round(p.ys[n])}`;
    exits.set(key, { x: p.xs[n], y: p.ys[n], a: Math.atan2(p.ys[n] - p.ys[n - 3], p.xs[n] - p.xs[n - 3]) });
  }
  for (const e of exits.values()) drawGate(c, e.x, e.y, e.a, th.accent);
  c.restore();
  // soft vignette
  const vg = c.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.45, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,10,40,0.22)');
  c.fillStyle = vg;
  c.fillRect(0, 0, WORLD_W, WORLD_H);
}

function shapePathRev(c: Ctx, s: Shape) {
  if (s.kind === 'circle') {
    c.moveTo(s.x + s.r, s.y);
    c.arc(s.x, s.y, s.r, 0, Math.PI * 2, true);
  } else if (s.kind === 'rect') {
    c.moveTo(s.x, s.y);
    c.lineTo(s.x, s.y + s.h);
    c.lineTo(s.x + s.w, s.y + s.h);
    c.lineTo(s.x + s.w, s.y);
    c.closePath();
  } else {
    const pts = [...s.pts].reverse();
    c.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) c.lineTo(p.x, p.y);
    c.closePath();
  }
}

function inShape(s: Shape, x: number, y: number, pad: number) {
  if (s.kind === 'circle') return Math.hypot(x - s.x, y - s.y) < s.r + pad;
  if (s.kind === 'rect') return x > s.x - pad && x < s.x + s.w + pad && y > s.y - pad && y < s.y + s.h + pad;
  return false;
}

function drawZone(c: Ctx, def: MapDef, z: Shape) {
  c.save();
  if (def.id === 'frostglass') {
    shapePath(c, z, 2);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fill();
    c.strokeStyle = 'rgba(90,130,170,0.8)';
    c.lineWidth = 2.5;
    c.setLineDash([8, 6]);
    c.stroke();
  } else {
    shapePath(c, z, 3);
    c.fillStyle = linear(c, 0, 0, 0, WORLD_H, [[0, '#9a94c4'], [1, '#7d77aa']]);
    c.fill();
    c.strokeStyle = '#c9b8e0';
    c.lineWidth = 3;
    c.stroke();
    // paving lines
    c.clip();
    c.strokeStyle = 'rgba(60,40,100,0.25)';
    c.lineWidth = 1.2;
    for (let x = 0; x < WORLD_W; x += 28) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, WORLD_H); c.stroke(); }
    for (let y = 0; y < WORLD_H; y += 28) { c.beginPath(); c.moveTo(0, y); c.lineTo(WORLD_W, y); c.stroke(); }
  }
  c.restore();
}

function drawBlocker(c: Ctx, def: MapDef, b: Blocker, rng: Rng) {
  const s = b.shape;
  switch (b.style) {
    case 'water': {
      c.save();
      shapePath(c, s, 4);
      c.fillStyle = shade(def.theme.water ?? '#5cb8e8', -0.25);
      c.fill();
      shapePath(c, s);
      c.fillStyle = radialFor(c, s, shade(def.theme.water ?? '#5cb8e8', 0.25), def.theme.water ?? '#5cb8e8');
      c.fill();
      c.clip();
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = 2;
      const bb = bbox(s);
      for (let i = 0; i < 10; i++) {
        const x = bb.x + rng.next() * bb.w, y = bb.y + rng.next() * bb.h;
        c.beginPath();
        c.arc(x, y, 6 + rng.next() * 8, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
      c.restore();
      shapePath(c, s, 1);
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 2;
      c.stroke();
      break;
    }
    case 'wall': {
      if (s.kind !== 'rect') break;
      c.save();
      const rows = Math.ceil(s.h / 14);
      for (let r = 0; r < rows; r++) {
        const y = s.y + r * 14;
        const off = r % 2 ? 0 : 10;
        for (let x = s.x - off; x < s.x + s.w; x += 20) {
          const x0 = Math.max(s.x, x), x1 = Math.min(s.x + s.w, x + 20);
          if (x1 - x0 < 3) continue;
          roundRect(c, x0, y, x1 - x0, Math.min(14, s.y + s.h - y), 2, r % 2 ? '#bfb59a' : '#cfc6ab', true, 1.4);
        }
      }
      // moss
      ellipse(c, s.x + s.w * 0.3, s.y + 4, 8, 4, 'rgba(110,170,80,0.85)', false);
      ellipse(c, s.x + s.w * 0.7, s.y + s.h - 6, 7, 3, 'rgba(110,170,80,0.85)', false);
      c.restore();
      break;
    }
    case 'ice': {
      if (s.kind !== 'circle') break;
      ellipse(c, s.x, s.y + 6, s.r, s.r * 0.5, 'rgba(60,100,150,0.25)', false);
      poly(c, [s.x - s.r * 0.8, s.y + 6, s.x - s.r * 0.3, s.y - s.r * 1.4, s.x + s.r * 0.1, s.y + 4], radial(c, s.x, s.y, s.r, '#ffffff', '#8fd0f0'), true, 1.6);
      poly(c, [s.x - s.r * 0.1, s.y + 8, s.x + s.r * 0.4, s.y - s.r * 0.9, s.x + s.r * 0.9, s.y + 8], radial(c, s.x, s.y, s.r, '#ffffff', '#6fb6e0'), true, 1.6);
      break;
    }
    case 'rock': {
      if (s.kind !== 'circle') break;
      ellipse(c, s.x, s.y + 4, s.r, s.r * 0.75, radial(c, s.x, s.y, s.r, '#c8c4cc', '#7a7484'), true, 2);
      ellipse(c, s.x - s.r * 0.3, s.y - s.r * 0.25, s.r * 0.35, s.r * 0.2, 'rgba(255,255,255,0.4)', false);
      ellipse(c, s.x + s.r * 0.4, s.y - s.r * 0.4, s.r * 0.35, s.r * 0.2, 'rgba(110,170,80,0.7)', false);
      break;
    }
    case 'tree': {
      if (s.kind !== 'circle') break;
      const r = s.r;
      ellipse(c, s.x, s.y + r * 0.5, r, r * 0.4, 'rgba(30,20,50,0.25)', false);
      poly(c, [s.x - r * 0.18, s.y + r * 0.5, s.x - r * 0.12, s.y - r * 0.2, s.x + r * 0.12, s.y - r * 0.2, s.x + r * 0.18, s.y + r * 0.5], '#8a5a3a', true, 2);
      const col = def.id === 'twinroot' ? ['#ffd0ea', '#e080b8'] : ['#a8e88a', '#3f9a44'];
      for (const [dx, dy, rr] of [[-0.45, -0.45, 0.55], [0.45, -0.45, 0.55], [0, -0.85, 0.6], [0, -0.3, 0.55]] as const)
        circle(c, s.x + dx * r, s.y + dy * r, rr * r, radial(c, s.x + dx * r, s.y + dy * r, rr * r, col[0], col[1]), true, 2);
      break;
    }
    case 'pillar': {
      if (s.kind !== 'circle') break;
      ellipse(c, s.x, s.y + 8, s.r, s.r * 0.45, '#9a927a', true, 1.6);
      roundRect(c, s.x - s.r * 0.55, s.y - s.r * 0.9, s.r * 1.1, s.r * 1.4, 3, linear(c, s.x - s.r, 0, s.x + s.r, 0, [[0, '#e0d8c0'], [1, '#a8a088']]), true, 1.8);
      poly(c, [s.x - s.r * 0.55, s.y - s.r * 0.9, s.x - s.r * 0.1, s.y - s.r * 1.2, s.x + s.r * 0.2, s.y - s.r * 0.95, s.x + s.r * 0.55, s.y - s.r * 1.1, s.x + s.r * 0.55, s.y - s.r * 0.9], '#cfc6ab', true, 1.4);
      break;
    }
    case 'fountain': {
      if (s.kind !== 'circle') break;
      circle(c, s.x, s.y, s.r, '#c8b8a0', true, 2);
      circle(c, s.x, s.y, s.r - 5, radial(c, s.x, s.y, s.r, '#bfe8ff', '#5fb6d6'), true, 1.4);
      roundRect(c, s.x - 4, s.y - 22, 8, 22, 2, '#a89070', true, 1.4);
      circle(c, s.x, s.y - 26, 8, '#f0c050', true, 1.6);
      line(c, s.x, s.y - 26, s.x, s.y - 31, OUTLINE, 1.4);
      line(c, s.x, s.y - 26, s.x + 4, s.y - 26, OUTLINE, 1.4);
      break;
    }
    case 'stall': {
      if (s.kind !== 'rect') break;
      roundRect(c, s.x + 6, s.y + 18, s.w - 12, s.h - 18, 3, '#a0704a', true, 1.8);
      const stripes = 6;
      for (let i = 0; i < stripes; i++) {
        const w = s.w / stripes;
        poly(c, [s.x + i * w, s.y + 4, s.x + (i + 1) * w, s.y + 4, s.x + (i + 1) * w, s.y + 22, s.x + i * w, s.y + 22], i % 2 ? '#fff4e0' : '#e05a4a', true, 1.2);
      }
      for (let i = 0; i < 4; i++) circle(c, s.x + 20 + i * 24, s.y + 32, 6, ['#ffb040', '#80d060', '#e06080', '#60a0e0'][i], true, 1.2);
      break;
    }
    case 'crystal': {
      if (s.kind !== 'circle') break;
      riftCrystal(c, s.x, s.y, s.r / 22);
      break;
    }
    case 'chasm':
      break;
  }
}

function riftCrystal(c: Ctx, x: number, y: number, k: number) {
  ellipse(c, x, y + 10 * k, 20 * k, 8 * k, 'rgba(255,100,220,0.25)', false);
  poly(c, [x - 12 * k, y + 8 * k, x - 6 * k, y - 22 * k, x, y + 6 * k], radial(c, x, y, 22 * k, '#ffe0ff', '#c04ad0'), true, 1.6);
  poly(c, [x - 4 * k, y + 10 * k, x + 3 * k, y - 32 * k, x + 10 * k, y + 8 * k], radial(c, x, y, 26 * k, '#ffffff', '#ff6fd8'), true, 1.6);
  poly(c, [x + 6 * k, y + 8 * k, x + 14 * k, y - 14 * k, x + 18 * k, y + 8 * k], radial(c, x, y, 18 * k, '#ffe0ff', '#a040d0'), true, 1.6);
}

function radialFor(c: Ctx, s: Shape, a: string, b: string) {
  const bb = bbox(s);
  return radial(c, bb.x + bb.w / 2, bb.y + bb.h / 2, Math.max(bb.w, bb.h) * 0.6, a, b, -0.2, -0.3);
}

function bbox(s: Shape) {
  if (s.kind === 'circle') return { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
  if (s.kind === 'rect') return { x: s.x, y: s.y, w: s.w, h: s.h };
  const xs = s.pts.map((p) => p.x), ys = s.pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function hexA(col: string, a: number): string {
  if (col.startsWith('rgb(')) return col.replace('rgb(', 'rgba(').replace(')', `,${a})`);
  const n = parseInt(col.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawProp(c: Ctx, def: MapDef, p: Prop) {
  const s = p.s ?? 1;
  const { x, y } = p;
  switch (p.kind) {
    case 'tree':
    case 'pinkTree': {
      const col = p.kind === 'pinkTree' ? ['#ffe0f0', '#e07ab8'] : ['#b8f090', '#3f9a44'];
      ellipse(c, x, y + 14 * s, 22 * s, 8 * s, 'rgba(30,20,50,0.22)', false);
      poly(c, [x - 4 * s, y + 14 * s, x - 3 * s, y - 6 * s, x + 3 * s, y - 6 * s, x + 4 * s, y + 14 * s], '#8a5a3a', true, 1.6);
      for (const [dx, dy, r] of [[-10, -10, 13], [10, -10, 13], [0, -22, 14], [0, -8, 12]] as const)
        circle(c, x + dx * s, y + dy * s, r * s, radial(c, x + dx * s, y + dy * s, r * s, col[0], col[1]), true, 1.8);
      break;
    }
    case 'pine': {
      ellipse(c, x, y + 12 * s, 16 * s, 6 * s, 'rgba(30,40,80,0.2)', false);
      for (let i = 0; i < 3; i++) poly(c, [x - (16 - i * 4) * s, y + (6 - i * 12) * s, x, y - (18 + i * 12) * s, x + (16 - i * 4) * s, y + (6 - i * 12) * s], i === 2 ? '#e8f4ff' : radial(c, x, y, 20 * s, '#5a9a7a', '#2a5a4a'), true, 1.6);
      break;
    }
    case 'bush':
      for (const [dx, r] of [[-7, 8], [7, 8], [0, 10]] as const) circle(c, x + dx * s, y - (r - 4) * s, r * s, radial(c, x + dx * s, y - 4 * s, r * s, '#a8e88a', '#4a9a44'), true, 1.6);
      break;
    case 'flower':
      for (const [dx, dy, col] of [[0, 0, '#ff8ac0'], [8, 4, '#ffd34a'], [-7, 5, '#ffffff'], [4, -6, '#b08aff']] as const) {
        line(c, x + dx, y + dy + 4, x + dx, y + dy, '#3f8a3a', 1.2);
        star(c, x + dx, y + dy, 3.2, 5, 0.45, col, true, 0.8);
      }
      break;
    case 'grass':
      for (let i = -2; i <= 2; i++) line(c, x + i * 3, y, x + i * 4.5, y - 8 - Math.abs(i) * -1.5, shade(def.theme.ground[1], -0.25), 1.6);
      break;
    case 'mushroom':
      for (const [dx, r] of [[0, 6], [9, 4]] as const) {
        roundRect(c, x + dx - 2, y - r, 4, r + 2, 1, '#f5ecd8', true, 1);
        ellipse(c, x + dx, y - r, r * 1.2, r * 0.7, '#e0503a', true, 1.2);
        circle(c, x + dx - r * 0.4, y - r * 1.1, 1.2, '#fff', false);
      }
      break;
    case 'rock':
      ellipse(c, x, y, 12 * s, 8 * s, radial(c, x, y, 12 * s, '#d0ccd8', '#8a8494'), true, 1.6);
      break;
    case 'snowrock':
      ellipse(c, x, y, 16 * s, 10 * s, radial(c, x, y, 16 * s, '#c8d4e0', '#7a8aa0'), true, 1.6);
      ellipse(c, x - 2, y - 6 * s, 12 * s, 4 * s, '#ffffff', false);
      break;
    case 'icicle':
      for (const dx of [-8, 0, 8]) poly(c, [x + dx - 4, y, x + dx, y - 16 - Math.abs(dx), x + dx + 4, y], '#d8f4ff', true, 1.2);
      break;
    case 'ruin':
      roundRect(c, x - 18, y - 10, 36, 14, 3, '#cfc6ab', true, 1.6);
      roundRect(c, x - 12, y - 30, 12, 22, 2, '#bfb59a', true, 1.6);
      ellipse(c, x + 10, y - 12, 8, 4, 'rgba(110,170,80,0.8)', false);
      break;
    case 'lily':
      ellipse(c, x, y, 8, 5, '#5aa848', true, 1.2);
      star(c, x + 2, y - 2, 3, 6, 0.5, '#ffd0e8', true, 0.8);
      break;
    case 'reed':
      for (let i = -2; i <= 2; i++) {
        line(c, x + i * 3, y, x + i * 4, y - 22, '#5a8a3a', 1.6);
        ellipse(c, x + i * 4, y - 22, 1.8, 4, '#8a5a3a', false);
      }
      break;
    case 'stump':
      ellipse(c, x, y + 2, 12, 6, '#8a5a3a', true, 1.6);
      ellipse(c, x, y - 2, 11, 5, '#d8b080', true, 1.4);
      break;
    case 'lamp':
      line(c, x, y, x, y - 30, '#3a3040', 3);
      circle(c, x, y - 34, 6, radial(c, x, y - 34, 6, '#fffbe0', '#f0b040'), true, 1.6);
      break;
    case 'gear':
      star(c, x, y, 18 * s, 10, 0.75, '#c8a050', true, 1.6);
      circle(c, x, y, 7 * s, '#8a6a30', true, 1.4);
      break;
    case 'banner':
      line(c, x, y + 10, x, y - 30, '#5a4030', 3);
      poly(c, [x, y - 30, x + 24, y - 26, x + 18, y - 16, x + 24, y - 6, x, y - 10], def.theme.accent, true, 1.6);
      break;
    case 'crystal':
      riftCrystal(c, x, y, s);
      break;
    case 'brazier':
      roundRect(c, x - 9, y - 10, 18, 12, 3, '#5a4a6a', true, 1.6);
      poly(c, [x - 7, y - 10, x - 2, y - 26, x + 1, y - 16, x + 4, y - 24, x + 7, y - 10], '#ff8ad8', true, 1.2);
      break;
  }
}

export function drawGate(c: Ctx, x: number, y: number, a: number, accent: string) {
  c.save();
  c.translate(x, y);
  const facingRight = Math.cos(a) >= 0;
  // little houses behind
  const back = facingRight ? 1 : -1;
  for (const [dx, dy, col] of [[20, -40, '#f0d8b0'], [18, 40, '#e8c8a0']] as const) {
    const hx = dx * back, hy = dy;
    roundRect(c, hx - 12, hy - 8, 24, 18, 2, col, true, 1.6);
    poly(c, [hx - 15, hy - 8, hx, hy - 22, hx + 15, hy - 8], '#c05a3a', true, 1.6);
    roundRect(c, hx - 3, hy + 1, 6, 9, 1, '#6a4a2a', false);
  }
  // arch
  roundRect(c, -30, -46, 14, 60, 3, linear(c, 0, -46, 0, 14, [[0, '#e8e0cc'], [1, '#a89c80']]), true, 2);
  roundRect(c, 16, -46, 14, 60, 3, linear(c, 0, -46, 0, 14, [[0, '#e8e0cc'], [1, '#a89c80']]), true, 2);
  c.beginPath();
  c.moveTo(-30, -40);
  c.quadraticCurveTo(0, -70, 30, -40);
  c.lineTo(30, -30);
  c.quadraticCurveTo(0, -56, -30, -30);
  c.closePath();
  c.fillStyle = '#d8ceb4';
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = OUTLINE;
  c.stroke();
  // gate doors
  roundRect(c, -16, -30, 32, 42, 2, linear(c, -16, 0, 16, 0, [[0, '#a0703a'], [1, '#6a4422']]), true, 1.8);
  line(c, 0, -30, 0, 12, OUTLINE, 1.4);
  line(c, -16, -14, 16, -14, 'rgba(40,20,10,0.6)', 2);
  // banner
  poly(c, [-6, -62, 6, -62, 6, -46, 0, -50, -6, -46], accent, true, 1.4);
  star(c, 0, -56, 3.2, 5, 0.45, '#fff', false);
  c.restore();
}

/** Removable obstacle art (drawn live so it can disappear). */
export function drawObstacle(c: Ctx, o: Obstacle) {
  const { x, y } = o;
  ellipse(c, x, y + 10, o.r, o.r * 0.4, 'rgba(30,20,50,0.25)', false);
  if (o.style === 'crates') {
    for (const [dx, dy] of [[-10, 0], [10, 2], [0, -14]] as const) {
      roundRect(c, x + dx - 9, y + dy - 9, 18, 18, 2, linear(c, 0, y + dy - 9, 0, y + dy + 9, [[0, '#e0b070'], [1, '#a0703a']]), true, 1.6);
      line(c, x + dx - 9, y + dy - 9, x + dx + 9, y + dy + 9, 'rgba(90,50,20,0.6)', 1.4);
    }
  } else if (o.style === 'barrels') {
    for (const dx of [-9, 9]) {
      roundRect(c, x + dx - 8, y - 12, 16, 22, 5, linear(c, x + dx - 8, 0, x + dx + 8, 0, [[0, '#7a4a2a'], [1, '#b07a40']]), true, 1.6);
      line(c, x + dx - 8, y - 5, x + dx + 8, y - 5, '#3a3040', 1.6);
      line(c, x + dx - 8, y + 4, x + dx + 8, y + 4, '#3a3040', 1.6);
    }
  } else {
    roundRect(c, x - 18, y - 12, 36, 18, 3, linear(c, 0, y - 12, 0, y + 6, [[0, '#e05a4a'], [1, '#a03a2a']]), true, 1.8);
    for (const dx of [-11, 11]) {
      circle(c, x + dx, y + 8, 6, '#6a4a2a', true, 1.6);
      circle(c, x + dx, y + 8, 2, '#f0c050', false);
    }
    circle(c, x, y - 18, 7, '#f0c050', true, 1.4);
  }
}
