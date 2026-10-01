import { distToPolyEdge, pointInPoly, clamp } from '../core/math';
import type { MapDef, Shape } from '../data/maps';
import { EDGE_MARGIN, PATH_HALF_WIDTH, WORLD_H, WORLD_W } from '../data/maps';
import { buildPath, distToPath, type PathData } from './path';

export interface RuntimeMap {
  def: MapDef;
  paths: PathData[];
  /** Coarse precomputed distance-to-nearest-path grid (cell = 8 units). */
  pathDist: Float32Array;
  gridCols: number;
  gridRows: number;
}

export const CELL = 8;

export function buildRuntimeMap(def: MapDef): RuntimeMap {
  const paths = def.paths.map((wp, i) => buildPath(i, wp));
  const gridCols = Math.ceil(WORLD_W / CELL);
  const gridRows = Math.ceil(WORLD_H / CELL);
  const pathDist = new Float32Array(gridCols * gridRows);
  for (let gy = 0; gy < gridRows; gy++)
    for (let gx = 0; gx < gridCols; gx++) {
      const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
      let d = Infinity;
      for (const p of paths) d = Math.min(d, distToPath(p, x, y));
      pathDist[gy * gridCols + gx] = d;
    }
  return { def, paths, pathDist, gridCols, gridRows };
}

/** Signed-ish distance: how far the circle (x,y,r) is outside the shape (negative = overlapping). */
export function shapeClearance(s: Shape, x: number, y: number, r: number): number {
  switch (s.kind) {
    case 'circle':
      return Math.hypot(x - s.x, y - s.y) - s.r - r;
    case 'rect': {
      const cx = clamp(x, s.x, s.x + s.w), cy = clamp(y, s.y, s.y + s.h);
      const inside = x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
      if (inside) return -r - Math.min(x - s.x, s.x + s.w - x, y - s.y, s.y + s.h - y);
      return Math.hypot(x - cx, y - cy) - r;
    }
    case 'poly': {
      const d = distToPolyEdge(x, y, s.pts);
      return pointInPoly(x, y, s.pts) ? -d - r : d - r;
    }
  }
}

export function pointInShape(s: Shape, x: number, y: number): boolean {
  return shapeClearance(s, x, y, 0) < 0 || (s.kind === 'rect' && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

/** Whether the circle lies inside the shape (centre inside and at least most of the footprint inside). */
function circleInsideShape(s: Shape, x: number, y: number, r: number): boolean {
  switch (s.kind) {
    case 'circle':
      return Math.hypot(x - s.x, y - s.y) <= Math.max(s.r - r * 0.4, 0.001) || Math.hypot(x - s.x, y - s.y) <= s.r * 0.35;
    case 'rect':
      return x >= s.x + r * 0.6 && x <= s.x + s.w - r * 0.6 && y >= s.y + r * 0.6 && y <= s.y + s.h - r * 0.6;
    case 'poly':
      return pointInPoly(x, y, s.pts) && distToPolyEdge(x, y, s.pts) >= r * 0.6;
  }
}

export function pathDistanceAt(rm: RuntimeMap, x: number, y: number): number {
  // exact check near the path, grid lookup far from it
  const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
  if (gx >= 0 && gy >= 0 && gx < rm.gridCols && gy < rm.gridRows) {
    const d = rm.pathDist[gy * rm.gridCols + gx];
    if (d > 80) return d;
  }
  let d = Infinity;
  for (const p of rm.paths) d = Math.min(d, distToPath(p, x, y));
  return d;
}

export interface PlacementQuery {
  x: number;
  y: number;
  r: number;
  towers: readonly { x: number; y: number; radius: number; id?: number }[];
  removedObstacles: ReadonlySet<string>;
}

export type PlacementResult = { ok: true } | { ok: false; reason: string };

export function checkPlacement(rm: RuntimeMap, q: PlacementQuery): PlacementResult {
  const { x, y, r } = q;
  if (x < EDGE_MARGIN + r * 0.5 || y < EDGE_MARGIN + r * 0.5 || x > WORLD_W - EDGE_MARGIN - r * 0.5 || y > WORLD_H - EDGE_MARGIN - r * 0.5)
    return { ok: false, reason: 'Too close to the island edge' };
  if (pathDistanceAt(rm, x, y) < PATH_HALF_WIDTH + r - 2) return { ok: false, reason: 'Cannot build on the road' };
  for (const p of rm.paths) {
    const ex = p.xs[0], ey = p.ys[0];
    if (Math.hypot(x - ex, y - ey) < 46 + r) return { ok: false, reason: 'Too close to a rift entrance' };
    const lx = p.xs[p.xs.length - 1], ly = p.ys[p.ys.length - 1];
    if (Math.hypot(x - lx, y - ly) < 46 + r) return { ok: false, reason: 'Too close to the village gate' };
  }
  for (const b of rm.def.blockers) {
    if (shapeClearance(b.shape, x, y, r) < 0) return { ok: false, reason: `Blocked by ${b.label.toLowerCase()}` };
  }
  for (const o of rm.def.obstacles ?? []) {
    if (q.removedObstacles.has(o.id)) continue;
    if (Math.hypot(x - o.x, y - o.y) < o.r + r) return { ok: false, reason: `${o.label} in the way — tap them to clear (${o.cost} gold)` };
  }
  if (rm.def.buildZones && !rm.def.buildZones.some((z) => circleInsideShape(z, x, y, r)))
    return { ok: false, reason: 'Only buildable on the marked ledges' };
  for (const t of q.towers) {
    if (Math.hypot(x - t.x, y - t.y) < t.radius + r) return { ok: false, reason: 'Overlaps another guardian' };
  }
  return { ok: true };
}
