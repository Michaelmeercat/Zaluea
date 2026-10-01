/** Shared vector drawing primitives for the procedural art style. All coordinates in world units. */
export const OUTLINE = '#2b2140';

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, stroke = true, lw = 2) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = OUTLINE;
    c.stroke();
  }
}

export function circle(c: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient, stroke = true, lw = 2) {
  ellipse(c, x, y, r, r, fill, stroke, lw);
}

export function poly(c: Ctx, pts: number[], fill: string | CanvasGradient, stroke = true, lw = 2) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.lineJoin = 'round';
    c.strokeStyle = OUTLINE;
    c.stroke();
  }
}

export function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke = true, lw = 2) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = OUTLINE;
    c.stroke();
  }
}

export function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw: number, cap: CanvasLineCap = 'round') {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.lineCap = cap;
  c.stroke();
}

export function radial(c: Ctx, x: number, y: number, r: number, inner: string, outer: string, ox = -0.35, oy = -0.4) {
  const g = c.createRadialGradient(x + r * ox, y + r * oy, r * 0.1, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  return g;
}

export function linear(c: Ctx, x1: number, y1: number, x2: number, y2: number, stops: [number, string][]) {
  const g = c.createLinearGradient(x1, y1, x2, y2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

export function shadow(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.28) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = `rgba(30,20,50,${a})`;
  c.fill();
}

export function eyes(c: Ctx, x: number, y: number, gap: number, r: number, look = 0.3, pupil = OUTLINE) {
  for (const s of [-1, 1]) {
    circle(c, x + s * gap, y, r, '#fff', true, Math.max(1, r * 0.35));
    circle(c, x + s * gap + look * r * 0.6, y + r * 0.1, r * 0.55, pupil, false);
    circle(c, x + s * gap + look * r * 0.6 - r * 0.2, y - r * 0.2, r * 0.18, '#fff', false);
  }
}

export function star(c: Ctx, x: number, y: number, r: number, points: number, inner: number, fill: string, stroke = true, lw = 1.5, rot = -Math.PI / 2) {
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / points;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  poly(c, pts, fill, stroke, lw);
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  return cv;
}
