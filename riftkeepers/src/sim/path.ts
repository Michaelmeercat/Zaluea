import type { Vec } from '../core/math';

export interface PathData {
  index: number;
  xs: Float32Array;
  ys: Float32Array;
  cum: Float32Array;
  length: number;
  waypoints: Vec[];
}

/** Sample a Catmull-Rom spline through waypoints at roughly `spacing` world units. */
export function buildPath(index: number, waypoints: Vec[], spacing = 5): PathData {
  const pts: Vec[] = [];
  const n = waypoints.length;
  const get = (i: number) => waypoints[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(2, Math.ceil(segLen / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t, t3 = t2 * t;
      // centripetal-ish tension 0.5 (standard Catmull-Rom), clamped to avoid overshoot on tight turns
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      pts.push({ x, y });
    }
  }
  pts.push({ ...waypoints[n - 1] });
  const xs = new Float32Array(pts.length), ys = new Float32Array(pts.length), cum = new Float32Array(pts.length);
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    xs[i] = pts[i].x;
    ys[i] = pts[i].y;
    if (i > 0) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum[i] = acc;
  }
  return { index, xs, ys, cum, length: acc, waypoints };
}

export interface PathPos {
  x: number;
  y: number;
  angle: number;
}

const tmp: PathPos = { x: 0, y: 0, angle: 0 };

/** Position along a path at distance d. Returns a shared object unless `out` is provided. */
export function posAt(p: PathData, d: number, out: PathPos = tmp): PathPos {
  const { cum, xs, ys } = p;
  if (d <= 0) {
    out.x = xs[0]; out.y = ys[0];
    out.angle = Math.atan2(ys[1] - ys[0], xs[1] - xs[0]);
    return out;
  }
  const last = cum.length - 1;
  if (d >= p.length) {
    out.x = xs[last]; out.y = ys[last];
    out.angle = Math.atan2(ys[last] - ys[last - 1], xs[last] - xs[last - 1]);
    return out;
  }
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  out.x = xs[lo] + (xs[hi] - xs[lo]) * t;
  out.y = ys[lo] + (ys[hi] - ys[lo]) * t;
  out.angle = Math.atan2(ys[hi] - ys[lo], xs[hi] - xs[lo]);
  return out;
}

/** Minimum distance from a point to a sampled path. */
export function distToPath(p: PathData, x: number, y: number): number {
  let best = Infinity;
  const { xs, ys } = p;
  for (let i = 0; i < xs.length - 1; i++) {
    const ax = xs[i], ay = ys[i], bx = xs[i + 1], by = ys[i + 1];
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * dx - x, ey = ay + t * dy - y;
    const d2 = ex * ex + ey * ey;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}
