import type { EnemyType } from '../core/types';
import { OUTLINE, circle, ellipse, eyes, line, linear, poly, radial, star, type Ctx } from './draw';

/**
 * Enemy illustrations. Each draws centred on (0,0), facing right, in world units.
 * `f` is the walk-cycle phase in [0,1). `phase` is used by the boss.
 */
export function drawEnemy(c: Ctx, type: EnemyType, f: number, phase = 1) {
  switch (type) {
    case 'sproutling': return sproutling(c, f);
    case 'skitter': return skitter(c, f);
    case 'bulwark': return bulwark(c, f);
    case 'wisp': return wisp(c, f);
    case 'emberkin': return emberkin(c, f);
    case 'frostling': return frostling(c, f);
    case 'broodpod': return broodpod(c, f);
    case 'mender': return mender(c, f);
    case 'brute': return brute(c, f);
    case 'colossus': return colossus(c, f, phase);
  }
}

const TAU = Math.PI * 2;

function feet(c: Ctx, f: number, y: number, gap: number, r: number, col: string) {
  const s = Math.sin(f * TAU);
  ellipse(c, -gap + s * 2.5, y - Math.max(0, s) * 2, r * 1.2, r * 0.8, col, true, 1.6);
  ellipse(c, gap - s * 2.5, y - Math.max(0, -s) * 2, r * 1.2, r * 0.8, col, true, 1.6);
}

function sproutling(c: Ctx, f: number) {
  const bob = Math.abs(Math.sin(f * TAU)) * 2.2;
  feet(c, f, 9, 5, 3, '#3f8a3a');
  c.save();
  c.translate(0, -bob);
  // leaf sprout
  const sway = Math.sin(f * TAU) * 0.25;
  c.save();
  c.translate(0, -10);
  c.rotate(sway);
  line(c, 0, 0, 0, -6, '#3d7a2f', 2);
  ellipse(c, -4, -7, 5, 2.6, '#7fe05a', true, 1.4);
  ellipse(c, 4, -8, 5, 2.6, '#9cf070', true, 1.4);
  c.restore();
  ellipse(c, 0, 0, 12, 11, radial(c, 0, 0, 12, '#c9f58a', '#5cbf45'));
  ellipse(c, -4, -5, 3, 2, 'rgba(255,255,255,0.45)', false);
  eyes(c, 3, -1, 3.6, 2.6, 0.5);
  ellipse(c, 4.5, 5, 2.4, 1.2, '#2e5d2a', false);
  c.restore();
}

function skitter(c: Ctx, f: number) {
  const s = Math.sin(f * TAU * 2);
  for (let i = -1; i <= 1; i++) {
    const k = i % 2 === 0 ? s : -s;
    line(c, i * 5, 2, i * 5 - 3 + k * 2, 9, OUTLINE, 2.2);
    line(c, i * 5, 2, i * 5 - 3 + k * 2, 9, '#5a3f8a', 1.2);
  }
  ellipse(c, -3, 0, 10, 6.5, radial(c, -3, 0, 10, '#d7a6ff', '#7a4ccc'));
  ellipse(c, 7, -1, 5.5, 5, radial(c, 7, -1, 5.5, '#e7c6ff', '#8a5ad8'));
  // stripes
  line(c, -6, -5, -6, 5, 'rgba(70,30,120,0.5)', 1.6);
  line(c, -1, -6, -1, 5, 'rgba(70,30,120,0.5)', 1.6);
  // antennae
  line(c, 10, -5, 15, -10 + s, OUTLINE, 1.4);
  circle(c, 15, -10 + s, 1.6, '#ffd36a', true, 1);
  circle(c, 9, -2, 1.8, '#fff', true, 1);
  circle(c, 9.5, -1.8, 0.9, OUTLINE, false);
}

function bulwark(c: Ctx, f: number) {
  const s = Math.sin(f * TAU);
  for (const x of [-9, -2, 6]) {
    line(c, x, 6, x + s * 2, 13, OUTLINE, 3.2);
    line(c, x, 6, x + s * 2, 13, '#56607a', 1.8);
  }
  // head
  ellipse(c, 13, 3, 6, 5.5, radial(c, 13, 3, 6, '#a8b4c8', '#5f6b86'));
  circle(c, 15, 1.5, 1.6, '#ffe07a', true, 1);
  // shell
  c.beginPath();
  c.moveTo(-16, 7);
  c.quadraticCurveTo(-17, -14, 0, -15);
  c.quadraticCurveTo(16, -14, 15, 7);
  c.closePath();
  c.fillStyle = linear(c, 0, -15, 0, 7, [[0, '#b9c6dc'], [0.5, '#7d8aa8'], [1, '#4c5672']]);
  c.fill();
  c.lineWidth = 2.2;
  c.strokeStyle = OUTLINE;
  c.stroke();
  // plates
  c.strokeStyle = 'rgba(40,40,70,0.55)';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-6, -13); c.lineTo(-7, 6);
  c.moveTo(5, -13); c.lineTo(5, 6);
  c.moveTo(-15, -3); c.quadraticCurveTo(0, -7, 15, -3);
  c.stroke();
  for (const [x, y] of [[-11, 1], [0, -10], [10, 1], [0, 2]]) circle(c, x, y, 1.4, '#e8edf6', true, 0.8);
  ellipse(c, -6, -9, 4, 2, 'rgba(255,255,255,0.4)', false);
}

function wisp(c: Ctx, f: number) {
  const s = Math.sin(f * TAU);
  c.beginPath();
  c.moveTo(-14 + s * 2, 8);
  c.quadraticCurveTo(-6, 2, -10 + s * 3, -2);
  c.quadraticCurveTo(-12, -14, 0, -14);
  c.quadraticCurveTo(12, -12, 10, 2);
  c.quadraticCurveTo(8, 10, -2, 10);
  c.quadraticCurveTo(-8, 12, -14 + s * 2, 8);
  c.closePath();
  c.fillStyle = radial(c, 2, -4, 14, '#e8fffb', '#4fd6c6');
  c.fill();
  c.lineWidth = 1.8;
  c.strokeStyle = 'rgba(20,80,90,0.9)';
  c.stroke();
  ellipse(c, 1, -2, 6, 6, 'rgba(255,255,255,0.35)', false);
  eyes(c, 3, -3, 3, 2.2, 0.6, '#1a4c55');
  // trailing sparks
  circle(c, -16 + s * 3, 2, 1.6, 'rgba(160,255,240,0.8)', false);
  circle(c, -19, -3 - s * 2, 1.1, 'rgba(160,255,240,0.6)', false);
}

function emberkin(c: Ctx, f: number) {
  const s = Math.sin(f * TAU);
  feet(c, f, 10, 4.5, 2.6, '#8a2e1a');
  // flame hair
  for (let i = 0; i < 3; i++) {
    const x = -5 + i * 5, h = 9 + Math.sin(f * TAU * 2 + i) * 2.5;
    poly(c, [x - 4, -6, x + Math.sin(f * TAU + i) * 2, -6 - h, x + 4, -6], i === 1 ? '#ffd24a' : '#ff8a2a', true, 1.4);
  }
  ellipse(c, 0, 1, 11, 10, radial(c, 0, 1, 11, '#ffb070', '#d4442a'));
  // horns
  poly(c, [-7, -6, -10, -12, -4, -8], '#5a2a20', true, 1.2);
  poly(c, [7, -6, 10, -12, 4, -8], '#5a2a20', true, 1.2);
  eyes(c, 3, 0, 3.4, 2.4, 0.5, '#5a1a0a');
  poly(c, [1, 5, 5, 7, 8, 4], '#5a1a0a', false);
  ellipse(c, -5, -3, 2.5, 1.6, 'rgba(255,255,255,0.35)', false);
  void s;
}

function frostling(c: Ctx, f: number) {
  const bob = Math.abs(Math.sin(f * TAU)) * 1.8;
  c.save();
  c.translate(0, -bob);
  // spikes
  for (const [x, h, w] of [[-7, 11, 4], [0, 14, 4.5], [7, 10, 4]] as const) poly(c, [x - w, -5, x, -5 - h, x + w, -5], '#cff2ff', true, 1.4);
  c.beginPath();
  c.moveTo(-12, 8);
  c.quadraticCurveTo(-14, -8, 0, -8);
  c.quadraticCurveTo(14, -8, 12, 8);
  c.quadraticCurveTo(0, 13, -12, 8);
  c.fillStyle = radial(c, 0, 0, 13, '#e6fbff', '#5fb7e6');
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = OUTLINE;
  c.stroke();
  eyes(c, 3, 0, 3.4, 2.3, 0.5, '#1e3a6a');
  ellipse(c, -6, -3, 2.6, 1.6, 'rgba(255,255,255,0.7)', false);
  star(c, -8, 6, 2.2, 4, 0.35, '#fff', false);
  c.restore();
}

function broodpod(c: Ctx, f: number) {
  const w = Math.sin(f * TAU) * 1.2;
  for (const x of [-9, -3, 3, 9]) line(c, x, 9, x + Math.sin(f * TAU + x) * 2, 15, OUTLINE, 2);
  ellipse(c, 0, 0, 16 + w, 14 - w, radial(c, 0, 0, 16, '#ffb3e6', '#c03a9a'));
  for (const [x, y, r] of [[-7, -4, 3.4], [4, -8, 2.6], [8, 3, 3], [-2, 6, 2.2], [-10, 5, 2]] as const)
    circle(c, x, y, r, 'rgba(255,230,250,0.75)', true, 1.1);
  eyes(c, 5, -1, 3.2, 2.2, 0.5, '#4a0a3a');
  ellipse(c, -8, -8, 3.4, 2, 'rgba(255,255,255,0.45)', false);
}

function mender(c: Ctx, f: number) {
  const bob = Math.sin(f * TAU) * 1.5;
  feet(c, f, 11, 4, 2.4, '#5b4a7a');
  // body
  ellipse(c, 0, 4, 7, 8, radial(c, 0, 4, 8, '#fff2d6', '#d8b98a'));
  eyes(c, 2, 4, 2.6, 1.9, 0.5);
  // staff
  line(c, 9, 12, 12, -10, '#6a4a2a', 2.6);
  circle(c, 12, -12 + bob, 3.4, radial(c, 12, -12, 3.4, '#eaffd0', '#5ce07a'), true, 1.3);
  // cap
  c.save();
  c.translate(0, -4 + bob * 0.3);
  c.beginPath();
  c.moveTo(-15, 2);
  c.quadraticCurveTo(-14, -14, 0, -14);
  c.quadraticCurveTo(14, -14, 15, 2);
  c.quadraticCurveTo(0, 5, -15, 2);
  c.fillStyle = radial(c, 0, -6, 15, '#9ff0d0', '#2a9a7a');
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = OUTLINE;
  c.stroke();
  for (const [x, y, r] of [[-7, -6, 2.6], [3, -10, 2.2], [8, -3, 2]] as const) circle(c, x, y, r, '#f6fff8', false);
  // green cross
  c.fillStyle = '#ffffff';
  c.fillRect(-1.2, -8, 2.4, 7);
  c.fillRect(-3.5, -5.7, 7, 2.4);
  c.restore();
}

function brute(c: Ctx, f: number) {
  const s = Math.sin(f * TAU);
  // legs
  ellipse(c, -9 + s * 3, 20, 7, 5, '#3c2a5c', true, 2);
  ellipse(c, 9 - s * 3, 20, 7, 5, '#3c2a5c', true, 2);
  // arms
  ellipse(c, -21, 4 - s * 2, 7, 10, radial(c, -21, 4, 10, '#a88ae0', '#5a3c9a'));
  ellipse(c, 21, 4 + s * 2, 7, 10, radial(c, 21, 4, 10, '#a88ae0', '#5a3c9a'));
  // body
  ellipse(c, 0, 0, 20, 21, radial(c, 0, 0, 22, '#b89af0', '#4f3290'));
  // belly cracks glowing
  c.strokeStyle = '#ff7ad9';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-6, 4); c.lineTo(-2, 9); c.lineTo(-5, 14);
  c.moveTo(6, 2); c.lineTo(3, 8); c.lineTo(7, 12);
  c.stroke();
  // horns
  poly(c, [-12, -14, -20, -30, -6, -18], '#f5e6c8', true, 1.8);
  poly(c, [12, -14, 20, -30, 6, -18], '#f5e6c8', true, 1.8);
  // face
  ellipse(c, 6, -6, 9, 6, 'rgba(60,30,110,0.35)', false);
  eyes(c, 6, -7, 4.4, 2.8, 0.5, '#3a0a3a');
  poly(c, [2, 1, 13, 1, 11, 4, 4, 4], '#fff', true, 1.2);
  ellipse(c, -9, -10, 4.5, 2.6, 'rgba(255,255,255,0.35)', false);
}

function colossus(c: Ctx, f: number, phase: number) {
  const s = Math.sin(f * TAU);
  const core = phase === 1 ? ['#ffe0ff', '#ff6fd8'] : phase === 2 ? ['#fff0c0', '#ff9a3a'] : ['#fff0e0', '#ff3a3a'];
  // legs
  poly(c, [-22, 22, -10, 22, -8 + s * 3, 40, -26 + s * 3, 40], '#4a3a6a', true, 2.4);
  poly(c, [10, 22, 22, 22, 26 - s * 3, 40, 8 - s * 3, 40], '#4a3a6a', true, 2.4);
  // arms
  poly(c, [-30, -14, -44, -4 - s * 3, -42, 22 - s * 3, -30, 18], '#5a4a80', true, 2.4);
  poly(c, [30, -14, 44, -4 + s * 3, 42, 22 + s * 3, 30, 18], '#5a4a80', true, 2.4);
  // body
  poly(c, [-32, -18, -18, -36, 18, -36, 32, -18, 30, 24, -30, 24], linear(c, 0, -36, 0, 24, [[0, '#8a7ab8'], [1, '#3a2c5c']]), true, 2.6);
  // crystal shards on shoulders/back
  const shard = phase === 3 ? '#ff7a7a' : phase === 2 ? '#ffc070' : '#ff8ae0';
  poly(c, [-26, -22, -34, -50, -16, -30], shard, true, 2);
  poly(c, [-8, -34, -2, -62, 6, -34], shard, true, 2);
  poly(c, [16, -30, 32, -52, 26, -22], shard, true, 2);
  // core
  circle(c, 0, -2, 12, radial(c, 0, -2, 12, core[0], core[1], -0.2, -0.2), true, 2.4);
  if (phase >= 2) {
    c.strokeStyle = core[1];
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-14, -26); c.lineTo(-8, -16); c.lineTo(-18, -8);
    c.moveTo(16, -26); c.lineTo(10, -14); c.lineTo(20, -4);
    c.moveTo(-10, 12); c.lineTo(-2, 22);
    c.stroke();
  }
  // eyes
  ellipse(c, -9, -22, 4, 2.6, core[0], true, 1.4);
  ellipse(c, 9, -22, 4, 2.6, core[0], true, 1.4);
}

/** Radius used for sprite cache canvas sizing per enemy. */
export function enemyArtExtent(type: EnemyType): number {
  switch (type) {
    case 'colossus': return 70;
    case 'brute': return 36;
    case 'broodpod': return 22;
    default: return 22;
  }
}
