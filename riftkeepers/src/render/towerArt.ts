import type { UnitType } from '../core/types';
import { TOWERS } from '../data/towers';
import { OUTLINE, circle, ellipse, eyes, line, linear, poly, radial, roundRect, shade, star, type Ctx } from './draw';

export interface TowerLook {
  levels: readonly number[];
  goldTrim?: boolean;
  lyraOutfit?: string;
  heroLevel?: number;
  mode?: 'fire' | 'acid';
}

const PATH_COLORS: Record<UnitType, string[]> = {
  archer: TOWERS.archer.paths.map((p) => p.color),
  alchemist: TOWERS.alchemist.paths.map((p) => p.color),
  warden: TOWERS.warden.paths.map((p) => p.color),
  storm: TOWERS.storm.paths.map((p) => p.color),
  beacon: TOWERS.beacon.paths.map((p) => p.color),
  orchard: TOWERS.orchard.paths.map((p) => p.color),
  lyra: ['#c08aff', '#c08aff', '#c08aff'],
};

function dominant(levels: readonly number[]): { path: number; tier: number } {
  let path = -1, tier = 0;
  levels.forEach((l, i) => {
    if (l > tier) { tier = l; path = i; }
  });
  return { path, tier };
}

/** Platform/base of a tower, centred at (0,0) = footprint centre. */
export function drawTowerBase(c: Ctx, type: UnitType, look: TowerLook) {
  const lv = look.levels;
  const trim = look.goldTrim ? '#f5c542' : null;
  switch (type) {
    case 'archer': {
      ellipse(c, 0, 4, 20, 11, linear(c, 0, -6, 0, 15, [[0, '#a5743f'], [1, '#6b4422']]));
      ellipse(c, 0, 0, 19, 9.5, radial(c, 0, 0, 19, '#e9c58f', '#b98a52', 0, 0));
      c.strokeStyle = 'rgba(120,80,40,0.6)';
      c.lineWidth = 1.2;
      for (const r of [5, 10, 15]) { c.beginPath(); c.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2); c.stroke(); }
      ellipse(c, -12, -2, 6, 3, '#6fbf4a', true, 1.2);
      ellipse(c, 13, 3, 5, 2.6, '#86d05a', true, 1.2);
      break;
    }
    case 'alchemist': {
      ellipse(c, 0, 4, 21, 11, linear(c, 0, -6, 0, 15, [[0, '#9a97a8'], [1, '#5c5870']]));
      ellipse(c, 0, 0, 20, 9.5, '#b9b5c6');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ellipse(c, Math.cos(a) * 16, Math.sin(a) * 7.5, 4.2, 2.6, i % 2 ? '#a8a4b8' : '#c8c4d4', true, 1);
      }
      break;
    }
    case 'warden': {
      poly(c, [-20, 2, -12, -6, 12, -6, 20, 2, 12, 12, -12, 12], linear(c, 0, -6, 0, 12, [[0, '#d8f4ff'], [1, '#6fb6e0']]));
      poly(c, [-12, -6, 12, -6, 6, 2, -6, 2], 'rgba(255,255,255,0.55)', false);
      poly(c, [-18, 0, -24, -10, -15, -4], '#bfeaff', true, 1.2);
      poly(c, [18, 0, 24, -12, 14, -4], '#bfeaff', true, 1.2);
      break;
    }
    case 'storm': {
      poly(c, [-20, 0, -14, -8, 14, -8, 20, 0, 14, 10, -14, 10], linear(c, 0, -8, 0, 10, [[0, '#e8c070'], [1, '#9a6a2a']]));
      for (const x of [-12, 0, 12]) circle(c, x, 3, 2, '#5a3a1a', false);
      // gear
      star(c, -17, 6, 6, 8, 0.7, '#c89a4a', true, 1.2);
      circle(c, -17, 6, 2, '#6a4a1a', false);
      break;
    }
    case 'beacon': {
      ellipse(c, 0, 4, 20, 10, linear(c, 0, -6, 0, 14, [[0, '#f2ead8'], [1, '#b0a080']]));
      ellipse(c, 0, 0, 18, 8.5, '#fbf6e8');
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        circle(c, Math.cos(a) * 14, Math.sin(a) * 6.5, 2.2, '#f5c542', true, 1);
      }
      break;
    }
    case 'orchard': {
      ellipse(c, 0, 4, 24, 12, linear(c, 0, -6, 0, 16, [[0, '#8a5a3a'], [1, '#5a3a22']]));
      ellipse(c, 0, 0, 23, 10.5, radial(c, 0, 0, 23, '#7ad06a', '#4a9a44', 0, 0));
      for (const [x, y] of [[-15, -2], [15, 1], [-6, 6], [8, -5]]) {
        line(c, x, y, x - 1.5, y - 4, '#2f7a2a', 1.4);
        line(c, x, y, x + 1.5, y - 4, '#2f7a2a', 1.4);
      }
      if (lv[1] > 0) {
        roundRect(c, 8, -4, 14, 10, 2, linear(c, 0, -4, 0, 6, [[0, '#d8a040'], [1, '#8a5a1a']]), true, 1.4);
        line(c, 8, 0, 22, 0, '#5a3a10', 1.2);
        circle(c, 15, 1, 1.4, '#ffe080', true, 0.8);
      }
      if (lv[2] > 0) {
        ellipse(c, -14, 4, 8, 5, '#c8a060', true, 1.4);
        circle(c, -16, 0, 2.4, '#d48aff', true, 1);
        circle(c, -12, 1, 2.2, '#8ae0ff', true, 1);
      }
      break;
    }
    case 'lyra': {
      // floating rune disc
      ellipse(c, 0, 3, 17, 8, 'rgba(120,80,200,0.35)', false);
      ellipse(c, 0, 0, 15, 7, radial(c, 0, 0, 15, '#e8d8ff', '#8a6ad8', 0, 0), true, 1.6);
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, 0, 10, 4.5, 0, 0, Math.PI * 2);
      c.stroke();
      break;
    }
  }
  if (trim && type !== 'lyra') {
    c.strokeStyle = trim;
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(0, 1, 19, 9.5, 0, 0.1 * Math.PI, 0.9 * Math.PI);
    c.stroke();
  }
  // upgrade pips along the front rim
  if (type !== 'lyra') {
    const cols = PATH_COLORS[type];
    let x = -((lv[0] + lv[1] + lv[2]) - 1) * 3.3;
    for (let p = 0; p < 3; p++)
      for (let t = 0; t < lv[p]; t++) {
        circle(c, x, 11.5, 2.2, cols[p], true, 0.9);
        x += 6.6;
      }
  }
}

/** The guardian standing on the base. Drawn facing right; origin = base centre. */
export function drawTowerFigure(c: Ctx, type: UnitType, look: TowerLook) {
  const lv = look.levels;
  const dom = dominant(lv);
  switch (type) {
    case 'archer': return archer(c, lv, dom);
    case 'alchemist': return alchemist(c, lv, dom, look.mode);
    case 'warden': return warden(c, lv, dom);
    case 'storm': return storm(c, lv, dom);
    case 'beacon': return beacon(c, lv, dom);
    case 'orchard': return orchard(c, lv, dom);
    case 'lyra': return lyra(c, look.heroLevel ?? 1, look.lyraOutfit ?? 'violet');
  }
}

type Dom = { path: number; tier: number };

function aura(c: Ctx, color: string, r: number, y = -14) {
  const g = c.createRadialGradient(0, y, 2, 0, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, y, r, 0, Math.PI * 2);
  c.fill();
}

function body(c: Ctx, cloak: string, y = 0, w = 10, h = 16) {
  c.beginPath();
  c.moveTo(-w, y);
  c.quadraticCurveTo(-w + 1, y - h, 0, y - h - 2);
  c.quadraticCurveTo(w - 1, y - h, w, y);
  c.quadraticCurveTo(0, y + 3, -w, y);
  c.fillStyle = linear(c, 0, y - h, 0, y, [[0, shade(cloak, 0.2)], [1, shade(cloak, -0.25)]]);
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = OUTLINE;
  c.stroke();
}

function head(c: Ctx, y: number, skin = '#ffd9b3', r = 7.5) {
  circle(c, 1, y, r, radial(c, 1, y, r, '#fff0e0', skin));
  eyes(c, 3, y, 2.6, 1.6, 0.6);
  ellipse(c, -2, y + 3, 1.6, 1, 'rgba(255,120,120,0.5)', false);
  ellipse(c, 7, y + 3, 1.6, 1, 'rgba(255,120,120,0.5)', false);
}

function archer(c: Ctx, lv: readonly number[], dom: Dom) {
  if (dom.tier === 5) aura(c, ['rgba(255,210,90,0.55)', 'rgba(255,110,80,0.5)', 'rgba(90,180,255,0.5)'][dom.path], 30);
  // quiver
  const quiverFull = lv[1] >= 3;
  roundRect(c, -12, -24, 6, 16, 2, '#8a5a2a', true, 1.5);
  for (let i = 0; i < (quiverFull ? 4 : 2); i++) {
    line(c, -11 + i * 1.6, -24, -12 + i * 1.6, -30, '#f5e6c8', 1.2);
    poly(c, [-13 + i * 1.6, -30, -11 + i * 1.6, -30, -12 + i * 1.6, -33], '#e05a4a', false);
  }
  const cloak = lv[1] >= 3 ? '#4f9a3a' : lv[2] >= 3 ? '#3f8a6a' : '#4f9a3a';
  body(c, cloak, -2, 10, 16);
  // belt
  line(c, -8, -8, 8, -8, '#6a4422', 2.4);
  if (lv[1] >= 3) {
    // red scarf
    poly(c, [-7, -17, 7, -17, 6, -13, -6, -13], '#e0503a', true, 1.4);
    poly(c, [-6, -14, -14, -8, -10, -13], '#e0503a', true, 1.2);
  }
  head(c, -24);
  // hood
  c.beginPath();
  c.moveTo(-8, -20);
  c.quadraticCurveTo(-10, -34, 1, -34);
  c.quadraticCurveTo(10, -33, 9, -25);
  c.quadraticCurveTo(4, -31, -3, -29);
  c.quadraticCurveTo(-6, -26, -8, -20);
  c.fillStyle = shade(cloak, 0.05);
  c.fill();
  c.lineWidth = 1.8;
  c.strokeStyle = OUTLINE;
  c.stroke();
  if (lv[2] >= 3) {
    // feather
    c.save();
    c.translate(-6, -32);
    c.rotate(-0.6);
    ellipse(c, 0, -6, 2.4, 7, '#5ab0ff', true, 1.2);
    c.restore();
  }
  if (lv[2] >= 5) {
    // falcon companion
    ellipse(c, -13, -32, 5, 3.6, '#8a6a4a', true, 1.4);
    poly(c, [-17, -34, -24, -40, -15, -31], '#6a4a2a', true, 1.2);
    circle(c, -10, -34, 2.4, '#a8885a', true, 1);
    poly(c, [-8, -34, -6, -33, -8, -32], '#f0c040', false);
  }
  if (lv[0] >= 5) star(c, 1, -38, 4, 5, 0.45, '#ffd34a', true, 1.2);
  // bow
  const bowCol = lv[0] >= 3 ? '#e8b04a' : '#8a5a2a';
  const big = lv[0] >= 2 ? 1.25 : 1;
  c.beginPath();
  c.arc(8, -14, 12 * big, -1.2, 1.2);
  c.strokeStyle = OUTLINE;
  c.lineWidth = 4;
  c.stroke();
  c.strokeStyle = bowCol;
  c.lineWidth = 2.4;
  c.stroke();
  const ex = 8 + Math.cos(1.2) * 12 * big, ey = Math.sin(1.2) * 12 * big;
  line(c, ex, -14 - ey, ex, -14 + ey, 'rgba(255,255,255,0.9)', 1);
  if (lv[1] >= 2) line(c, 5, -16, 19, -16, '#f5e6c8', 1.4);
  line(c, 5, -13, 19, -13, '#f5e6c8', 1.4);
  poly(c, [19, -15, 23, -13, 19, -11], lv[0] >= 3 ? '#ffd34a' : '#c0c0c0', true, 0.8);
}

function alchemist(c: Ctx, lv: readonly number[], dom: Dom, mode?: 'fire' | 'acid') {
  if (dom.tier === 5) aura(c, ['rgba(255,190,60,0.55)', 'rgba(255,90,40,0.55)', 'rgba(120,230,80,0.5)'][dom.path], 32);
  const acid = lv[2] >= 3 && mode !== 'fire';
  // cauldron in front-left
  ellipse(c, -9, -4, 9, 7, linear(c, 0, -10, 0, 3, [[0, '#4a4a5a'], [1, '#22222e']]));
  ellipse(c, -9, -9, 8, 2.6, acid ? '#8ae05a' : '#ff9a3a', true, 1.2);
  circle(c, -11, -11, 1.6, acid ? '#c8ff9a' : '#ffd07a', false);
  circle(c, -6, -12, 1.2, acid ? '#c8ff9a' : '#ffd07a', false);
  if (lv[1] >= 3) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      poly(c, [Math.cos(a) * 18 - 3, Math.sin(a) * 8 + 4, Math.cos(a) * 18, Math.sin(a) * 8 - 6, Math.cos(a) * 18 + 3, Math.sin(a) * 8 + 4], i % 2 ? '#ffb43a' : '#ff6a2a', true, 1);
    }
  }
  body(c, '#e0773a', -2, 10, 17);
  // apron
  poly(c, [-5, -15, 5, -15, 7, -3, -7, -3], '#f5e6c8', true, 1.4);
  if (lv[2] >= 3) {
    for (const x of [-4, 0, 4]) roundRect(c, x - 1.4, -12, 2.8, 5, 1, '#8ae05a', true, 0.8);
  }
  head(c, -25);
  // goggles
  line(c, -6, -28, 9, -28, '#5a3a1a', 2.2);
  circle(c, 2, -28, 3, '#9ae0ff', true, 1.3);
  circle(c, 8, -28, 3, '#9ae0ff', true, 1.3);
  // hair tuft
  poly(c, [-6, -31, -2, -36, 1, -32, 5, -36, 7, -31], '#a04a2a', true, 1.2);
  if (lv[1] >= 5) for (let i = 0; i < 3; i++) poly(c, [-5 + i * 5, -33, -3 + i * 5, -42, -1 + i * 5, -33], '#ffb43a', true, 1);
  // flask in raised hand
  const fl = lv[0] >= 5 ? 1.6 : lv[0] >= 3 ? 1.25 : 1;
  const fcol = acid ? '#7ae04a' : '#ff8a3a';
  line(c, 7, -14, 13, -22, '#ffd9b3', 3);
  c.save();
  c.translate(14, -26);
  c.scale(fl, fl);
  circle(c, 0, 0, 5, radial(c, 0, 0, 5, '#fff', fcol));
  roundRect(c, -1.6, -9, 3.2, 5, 1, '#d8eef8', true, 1.1);
  if (lv[0] >= 3) line(c, 0, -9, 2, -13, '#5a3a1a', 1.2);
  c.restore();
  if (lv[0] >= 4) {
    // bomb belt
    for (const x of [-6, -1, 4]) circle(c, x, -8, 2.2, '#3a3a4a', true, 1);
  }
}

function warden(c: Ctx, lv: readonly number[], dom: Dom) {
  if (dom.tier === 5) aura(c, ['rgba(160,230,255,0.6)', 'rgba(90,160,240,0.55)', 'rgba(200,160,255,0.5)'][dom.path], 32);
  if (lv[2] >= 3) {
    c.strokeStyle = 'rgba(220,240,255,0.85)';
    c.lineWidth = 2;
    c.setLineDash([3, 4]);
    c.beginPath();
    c.ellipse(0, -2, 22, 9, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }
  const cloak = lv[2] >= 5 ? '#9a7ae0' : '#4a8ad0';
  body(c, cloak, -2, 11, 17);
  // fur trim
  ellipse(c, 0, -17, 9, 3, '#f4f8ff', true, 1.4);
  head(c, -25, '#ffe2c8');
  // beard
  poly(c, [-3, -22, 7, -22, 4, -15, 1, -13, -1, -16], '#f4f8ff', true, 1.2);
  // hat / crown
  if (lv[0] >= 3) {
    poly(c, [-6, -30, -5, -38, -2, -33, 1, -40, 4, -33, 7, -38, 8, -30], '#bff0ff', true, 1.3);
  } else {
    poly(c, [-7, -30, 1, -44, 9, -30], cloak, true, 1.6);
    circle(c, 1, -44, 2.2, '#f4f8ff', true, 1);
  }
  if (lv[0] >= 5) star(c, 1, -46, 6, 6, 0.4, '#e8fbff', true, 1.2);
  // staff
  line(c, 12, 2, 12, -34, '#6a4a2a', 2.8);
  const big = lv[1] >= 5 ? 1.8 : lv[1] >= 3 ? 1.3 : 1;
  c.save();
  c.translate(12, -38);
  c.scale(big, big);
  poly(c, [0, -8, 4, 0, 0, 7, -4, 0], radial(c, 0, 0, 8, '#ffffff', '#6cc6f0'), true, 1.3);
  c.restore();
  if (lv[1] >= 3) {
    for (const [x, y] of [[-16, -26], [18, -20], [-18, -10]]) poly(c, [x, y - 5, x + 2.5, y, x, y + 5, x - 2.5, y], '#d8f6ff', true, 1);
  }
}

function storm(c: Ctx, lv: readonly number[], dom: Dom) {
  if (dom.tier === 5) aura(c, ['rgba(180,160,255,0.6)', 'rgba(255,220,90,0.5)', 'rgba(90,220,180,0.5)'][dom.path], 32);
  // tesla coil behind
  const coils = lv[0] >= 3 ? 2 : 1;
  for (let k = 0; k < coils; k++) {
    const x = -12 + k * 6;
    line(c, x, -2, x, -34, '#8a6a3a', 3);
    for (let i = 0; i < 4; i++) ellipse(c, x, -10 - i * 6, 4, 1.6, '#e0a050', true, 1);
    circle(c, x, -38, lv[0] >= 5 ? 6 : 4, radial(c, x, -38, 6, '#ffffff', '#9a8aff'), true, 1.3);
  }
  body(c, '#6a5ab0', -2, 10, 16);
  // overalls straps
  line(c, -4, -16, -3, -4, '#3a2a6a', 2);
  line(c, 5, -16, 4, -4, '#3a2a6a', 2);
  head(c, -24);
  // goggles + hair
  poly(c, [-6, -28, -3, -34, 2, -31, 6, -35, 9, -28], '#3a3a4a', true, 1.2);
  line(c, -6, -26, 9, -26, '#3a2a1a', 2);
  circle(c, 3, -26, 2.8, '#ffe07a', true, 1.2);
  circle(c, 8.5, -26, 2.8, '#ffe07a', true, 1.2);
  if (lv[1] >= 3) {
    // rail rifle
    const len = lv[1] >= 5 ? 26 : 18;
    roundRect(c, 2, -16, len, 5, 2, linear(c, 0, -16, 0, -11, [[0, '#f0e0a0'], [1, '#a08a40']]), true, 1.4);
    circle(c, 2 + len, -13.5, 2.2, '#9ae0ff', true, 1);
  } else {
    // wrench / spark gun
    roundRect(c, 4, -15, 12, 4, 1.5, '#b0b0c0', true, 1.3);
    circle(c, 17, -13, 2.4, '#b0a0ff', true, 1);
  }
  if (lv[2] >= 3) {
    // antenna dish on back
    line(c, -8, -18, -14, -28, '#5a5a6a', 1.6);
    ellipse(c, -15, -30, 5, 3, '#c0c0d0', true, 1.2);
  }
}

function beacon(c: Ctx, lv: readonly number[], dom: Dom) {
  const orbCol = dom.path === 0 ? '#ffa040' : dom.path === 1 ? '#fff6c0' : dom.path === 2 ? '#ffd040' : '#ffe07a';
  if (dom.tier >= 3) aura(c, 'rgba(255,230,120,0.55)', 26 + dom.tier * 2, -40);
  // obelisk
  poly(c, [-8, 2, -6, -34, 0, -40, 6, -34, 8, 2], linear(c, -8, 0, 8, 0, [[0, '#fffaf0'], [1, '#c8bca0']]), true, 2);
  line(c, -6.5, -12, 6.5, -12, '#f5c542', 2);
  line(c, -7, -4, 7, -4, '#f5c542', 2);
  // glyph
  if (dom.path === 1) {
    ellipse(c, 0, -22, 4, 2.4, '#fff', true, 1);
    circle(c, 0, -22, 1.3, '#6a4a2a', false);
  } else if (dom.path === 2) {
    circle(c, 0, -22, 3, '#f5c542', true, 1);
  } else {
    star(c, 0, -22, 3.6, 4, 0.4, '#f5c542', true, 0.8);
  }
  // orb
  circle(c, 0, -46, 7 + (dom.tier >= 5 ? 2 : 0), radial(c, 0, -46, 9, '#ffffff', orbCol), true, 1.6);
  if (dom.path === 2 && dom.tier >= 3) {
    for (const [x, y] of [[-14, 4], [-10, 8], [12, 6]]) ellipse(c, x, y, 4, 2.4, '#f5c542', true, 1);
  }
  void lv;
}

function orchard(c: Ctx, lv: readonly number[], dom: Dom) {
  const g = lv[0];
  if (dom.tier === 5) aura(c, ['rgba(140,255,140,0.55)', 'rgba(255,220,90,0.55)', 'rgba(200,140,255,0.55)'][dom.path], 36, -26);
  // trunk
  poly(c, [-4, 2, -3, -18, -8, -26, -2, -22, 0, -28, 3, -22, 8, -26, 3, -18, 4, 2], '#8a5a3a', true, 1.8);
  // canopy
  const s = 1 + g * 0.08;
  c.save();
  c.translate(0, -32);
  c.scale(s, s);
  for (const [x, y, r] of [[-10, 0, 10], [10, 0, 10], [0, -8, 12], [0, 4, 10]] as const) circle(c, x, y, r, radial(c, x, y, r, '#a8f08a', '#3f9a44'), true, 1.8);
  // crystals
  const n = 3 + g + (lv[2] > 0 ? 1 : 0);
  const spots = [[-9, 2], [8, -2], [0, -10], [-3, 6], [11, 6], [-12, -6], [5, 8], [-6, -12], [12, -8]];
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const [x, y] = spots[i];
    const col = i % 2 ? '#8ae0ff' : '#ff8ae0';
    poly(c, [x, y - 4.5, x + 2.6, y, x, y + 4.5, x - 2.6, y], radial(c, x, y, 4.5, '#ffffff', col), true, 1);
  }
  c.restore();
}

const OUTFITS: Record<string, [string, string, string]> = {
  violet: ['#7a4ad0', '#c8a0ff', '#5a2a8a'],
  ember: ['#c0402a', '#ffb070', '#7a1a1a'],
  verdant: ['#2a8a5a', '#a0f0c0', '#14503a'],
  starlight: ['#2a3a8a', '#fff0a0', '#141a50'],
};

function lyra(c: Ctx, level: number, outfit: string) {
  const [cloak, glow, dark] = OUTFITS[outfit] ?? OUTFITS.violet;
  if (level >= 10) {
    // wings of light
    c.save();
    c.globalAlpha = 0.75;
    poly(c, [-6, -20, -26, -34, -22, -14, -10, -10], glow, true, 1.2);
    poly(c, [6, -20, 26, -34, 22, -14, 10, -10], glow, true, 1.2);
    c.restore();
  }
  if (level >= 8) {
    c.strokeStyle = glow;
    c.lineWidth = 1.4;
    c.beginPath();
    c.ellipse(0, -18, 17, 6, 0, 0, Math.PI * 2);
    c.stroke();
  }
  // cape
  poly(c, [-9, -18, -13, 0, 11, 0, 9, -18], dark, true, 1.8);
  body(c, cloak, -1, 9, 15);
  // scarf
  poly(c, [-6, -16, 7, -16, 6, -12, -6, -12], glow, true, 1.3);
  poly(c, [-6, -14, -15, -10, -12, -15], glow, true, 1.1);
  head(c, -23, '#ffe0c8', 7);
  // hair
  c.beginPath();
  c.moveTo(-7, -21);
  c.quadraticCurveTo(-9, -34, 2, -33);
  c.quadraticCurveTo(10, -32, 8, -24);
  c.quadraticCurveTo(3, -29, -2, -27);
  c.quadraticCurveTo(-4, -24, -7, -16);
  c.closePath();
  c.fillStyle = '#e8d0ff';
  c.fill();
  c.lineWidth = 1.6;
  c.strokeStyle = OUTLINE;
  c.stroke();
  // circlet gem
  circle(c, 2, -30, 1.8, level >= 5 ? '#ff6fd8' : glow, true, 0.9);
  // staff with rift crystal
  line(c, 12, 2, 13, -32, '#5a3a2a', 2.6);
  poly(c, [13, -44, 17, -36, 13, -30, 9, -36], radial(c, 13, -37, 7, '#ffffff', '#ff6fd8'), true, 1.3);
}

/** Visual height above base centre for UI anchoring. */
export const FIGURE_TOP = 50;
