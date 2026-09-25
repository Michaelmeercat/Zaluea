/* CIRCUIT SIEGE — maps & path geometry
 * World space is 1280 x 720. Paths are orthogonal polylines that get rounded corners.
 */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;
  const U = CS.U;

  CS.WORLD_W = 1280;
  CS.WORLD_H = 720;
  CS.PATH_W = 38; // visual & collision width of the enemy path

  const THEMES = {
    green: { ground: '#24452f', ground2: '#2c5638', ground3: '#1d3a27', path: '#3a3f4a', pathEdge: '#1b1f27', pathLine: '#39d0ff', accent: '#6dffb0', decor: 'forest', sky: '#0d1a14' },
    crossing: { ground: '#34462a', ground2: '#3f5431', ground3: '#2a3a22', path: '#4a4238', pathEdge: '#241f1a', pathLine: '#ffb547', accent: '#ffd27a', decor: 'farmland', sky: '#12160d' },
    cooling: { ground: '#b9d3e3', ground2: '#cfe3ef', ground3: '#9fbdd1', path: '#4f6275', pathEdge: '#2b3847', pathLine: '#8fe8ff', accent: '#e8f8ff', decor: 'ice', sky: '#0e1a24' },
    highway: { ground: '#3b3a3f', ground2: '#46444a', ground3: '#2f2e33', path: '#26272c', pathEdge: '#131417', pathLine: '#ffd84d', accent: '#ff9a3d', decor: 'ruins', sky: '#141316' },
    corruption: { ground: '#221633', ground2: '#2b1c40', ground3: '#170f24', path: '#3a2440', pathEdge: '#0e0814', pathLine: '#ff3dd6', accent: '#b04dff', decor: 'corrupt', sky: '#0b0612' },
    processor: { ground: '#123a2c', ground2: '#164634', ground3: '#0d2c21', path: '#1d2530', pathEdge: '#0a0e13', pathLine: '#ffcf4d', accent: '#d9a84a', decor: 'pcb', sky: '#07130e' },
    desert: { ground: '#c9a064', ground2: '#d6b075', ground3: '#b58c52', path: '#6b5037', pathEdge: '#3f2d1d', pathLine: '#ff7b3d', accent: '#fff0c9', decor: 'desert', sky: '#2a1d10' },
  };
  CS.THEMES = THEMES;

  CS.MAPS = [
    {
      id: 'green', name: 'Green Circuit', diff: 'Beginner', stars: 1, unlockLevel: 1, theme: 'green', chips: 30,
      desc: 'A calm digital meadow with a single winding trace. Plenty of room to build.',
      paths: [[[-40, 130], [240, 130], [240, 430], [500, 430], [500, 190], [780, 190], [780, 560], [1060, 560], [1060, 320], [1190, 320]]],
      blocked: [{ x: 640, y: 380, r: 42 }, { x: 150, y: 600, r: 50 }],
      water: [{ x: 640, y: 380, r: 42 }],
    },
    {
      id: 'crossing', name: 'Data Crossing', diff: 'Easy', stars: 2, unlockLevel: 2, theme: 'crossing', chips: 40,
      desc: 'Two data streams merge into one. Enemies arrive from two directions.',
      paths: [
        [[200, -40], [200, 220], [480, 220], [480, 360], [700, 360], [700, 150], [980, 150], [980, 480], [1180, 480]],
        [[-40, 610], [330, 610], [330, 500], [480, 500], [480, 360], [700, 360], [700, 150], [980, 150], [980, 480], [1180, 480]],
      ],
      blocked: [{ x: 1080, y: 640, w: 200, h: 80 }],
    },
    {
      id: 'cooling', name: 'Cooling Facility', diff: 'Medium', stars: 3, unlockLevel: 4, theme: 'cooling', chips: 55,
      desc: 'A frozen server vault spiralling to a central Core. Cooling tunnels make enemies surge forward.',
      paths: [[[640, -40], [640, 100], [170, 100], [170, 620], [1110, 620], [1110, 240], [400, 240], [400, 470], [880, 470], [880, 360], [640, 360]]],
      tunnels: [{ path: 0, from: 0.24, to: 0.34 }, { path: 0, from: 0.47, to: 0.56 }, { path: 0, from: 0.66, to: 0.74 }],
      blocked: [{ x: 1180, y: 60, w: 100, h: 500 }, { x: 0, y: 150, w: 110, h: 180 }, { x: 250, y: 300, w: 90, h: 100 }, { x: 760, y: 0, w: 380, h: 60 }],
      racks: true,
    },
    {
      id: 'highway', name: 'Broken Highway', diff: 'Medium', stars: 3, unlockLevel: 6, theme: 'highway', chips: 65,
      desc: 'A ruined data highway. The road splits into two lanes and reconnects — twice.',
      paths: [
        [[-40, 370], [170, 370], [170, 150], [470, 150], [470, 370], [700, 370], [700, 120], [1000, 120], [1000, 370], [1210, 370]],
        [[-40, 370], [170, 370], [170, 590], [470, 590], [470, 370], [700, 370], [700, 610], [1000, 610], [1000, 370], [1210, 370]],
      ],
      blocked: [{ x: 560, y: 230, w: 60, h: 80 }, { x: 830, y: 420, w: 80, h: 110 }],
    },
    {
      id: 'corruption', name: 'Corruption Pit', diff: 'Hard', stars: 4, unlockLevel: 9, theme: 'corruption', chips: 80,
      desc: 'Corrupted wasteland. Glitch zones periodically erupt, shutting down towers inside them.',
      paths: [[[-40, 90], [330, 90], [520, 300], [240, 520], [520, 650], [820, 650], [1000, 470], [760, 260], [980, 90], [1200, 90], [1200, 420]]],
      corruption: [{ x: 640, y: 450, r: 72 }, { x: 130, y: 300, r: 70 }, { x: 1080, y: 290, r: 72 }, { x: 1080, y: 620, r: 66 }, { x: 660, y: 130, r: 70 }, { x: 330, y: 360, r: 60 }],
      blocked: [],
    },
    {
      id: 'processor', name: 'Central Processor', diff: 'Expert', stars: 5, unlockLevel: 11, theme: 'processor', chips: 110, cashBonus: 200,
      desc: 'Four data buses converge on the central Core. Every quadrant needs a defense.',
      paths: [
        [[-40, 50], [500, 50], [500, 140], [100, 140], [100, 250], [420, 250], [420, 360], [640, 360]],
        [[1320, 50], [780, 50], [780, 140], [1180, 140], [1180, 250], [640, 250], [640, 360]],
        [[1320, 670], [780, 670], [780, 580], [1180, 580], [1180, 470], [860, 470], [860, 360], [640, 360]],
        [[-40, 670], [500, 670], [500, 580], [100, 580], [100, 470], [640, 470], [640, 360]],
      ],
      blocked: [],
    },
    {
      id: 'dunes', name: 'Solar Dunes', diff: 'Medium', stars: 3, unlockLevel: 13, theme: 'desert', chips: 70,
      desc: 'A sun-baked relay field. Periodic sandstorms reduce every tower\'s range.',
      paths: [[[-40, 600], [300, 600], [300, 380], [140, 380], [140, 140], [560, 140], [560, 560], [860, 560], [860, 220], [1120, 220], [1120, 600], [1210, 600]]],
      blocked: [{ x: 960, y: 380, r: 50 }, { x: 400, y: 440, r: 45 }],
      sandstorm: true,
    },
  ];

  CS.MAP_BY_ID = {};
  for (const m of CS.MAPS) CS.MAP_BY_ID[m.id] = m;

  // ── Geometry: turn a corner polyline into a smooth sampled path with lookup tables.
  function roundPolyline(pts, radius) {
    const out = [pts[0].slice()];
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
      const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
      const r = Math.min(radius, l1 / 2, l2 / 2);
      const ax = cx - ((cx - px) / l1) * r, ay = cy - ((cy - py) / l1) * r;
      const bx = cx + ((nx - cx) / l2) * r, by = cy + ((ny - cy) / l2) * r;
      out.push([ax, ay]);
      const steps = 8;
      for (let s = 1; s < steps; s++) {
        const t = s / steps, it = 1 - t;
        out.push([it * it * ax + 2 * it * t * cx + t * t * bx, it * it * ay + 2 * it * t * cy + t * t * by]);
      }
      out.push([bx, by]);
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  const STEP = 2; // lookup resolution in px along path
  function buildPath(rawPts) {
    const pts = roundPolyline(rawPts, 34);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[cum.length - 1];
    const n = Math.ceil(len / STEP) + 1;
    const xs = new Float32Array(n), ys = new Float32Array(n), angs = new Float32Array(n);
    let seg = 1;
    for (let k = 0; k < n; k++) {
      const d = Math.min(len, k * STEP);
      while (seg < pts.length - 1 && cum[seg] < d) seg++;
      const d0 = cum[seg - 1], d1 = cum[seg];
      const t = d1 > d0 ? (d - d0) / (d1 - d0) : 0;
      const [ax, ay] = pts[seg - 1], [bx, by] = pts[seg];
      xs[k] = ax + (bx - ax) * t;
      ys[k] = ay + (by - ay) * t;
      angs[k] = Math.atan2(by - ay, bx - ax);
    }
    return { pts, len, xs, ys, angs, n };
  }

  CS.pathPos = function (path, d, out) {
    let k = (d / STEP) | 0;
    if (k < 0) k = 0; else if (k >= path.n) k = path.n - 1;
    out.x = path.xs[k]; out.y = path.ys[k]; out.a = path.angs[k];
    return out;
  };

  // Build a runtime map instance. reverse = Reverse Routing mode.
  CS.buildMap = function (def, reverse) {
    const paths = def.paths.map((p) => {
      const raw = reverse ? p.slice().reverse() : p;
      return buildPath(raw);
    });
    // Distance field (8px) to nearest path centre line
    const cell = 8, cols = Math.ceil(CS.WORLD_W / cell), rows = Math.ceil(CS.WORLD_H / cell);
    const field = new Float32Array(cols * rows).fill(1e9);
    for (const p of paths) {
      const pts = p.pts;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const minx = Math.max(0, Math.floor((Math.min(ax, bx) - 90) / cell)), maxx = Math.min(cols - 1, Math.ceil((Math.max(ax, bx) + 90) / cell));
        const miny = Math.max(0, Math.floor((Math.min(ay, by) - 90) / cell)), maxy = Math.min(rows - 1, Math.ceil((Math.max(ay, by) + 90) / cell));
        for (let cy = miny; cy <= maxy; cy++) {
          for (let cx = minx; cx <= maxx; cx++) {
            const d = Math.sqrt(U.segDist2(cx * cell + cell / 2, cy * cell + cell / 2, ax, ay, bx, by));
            const idx = cy * cols + cx;
            if (d < field[idx]) field[idx] = d;
          }
        }
      }
    }
    // Tunnels in distance units
    const tunnels = (def.tunnels || []).map((t) => {
      const p = paths[t.path];
      let from = t.from * p.len, to = t.to * p.len;
      if (reverse) { const f2 = p.len - to, t2 = p.len - from; from = f2; to = t2; }
      return { path: t.path, from, to };
    });
    // Unique core positions (end of each path)
    const cores = [];
    for (const p of paths) {
      const ex = p.xs[p.n - 1], ey = p.ys[p.n - 1];
      if (!cores.some((c) => U.dist2(c.x, c.y, ex, ey) < 400)) cores.push({ x: ex, y: ey, a: p.angs[p.n - 1] });
    }
    const spawns = [];
    for (const p of paths) {
      const sx = p.xs[0], sy = p.ys[0];
      if (!spawns.some((c) => U.dist2(c.x, c.y, sx, sy) < 400)) spawns.push({ x: sx, y: sy, a: p.angs[0] });
    }
    return { def, paths, field, fieldCell: cell, fieldCols: cols, fieldRows: rows, tunnels, cores, spawns, reverse: !!reverse };
  };

  CS.pathDistAt = function (map, x, y) {
    const c = map.fieldCell;
    const cx = Math.floor(x / c), cy = Math.floor(y / c);
    if (cx < 0 || cy < 0 || cx >= map.fieldCols || cy >= map.fieldRows) return 1e9;
    return map.field[cy * map.fieldCols + cx];
  };

  CS.pointBlocked = function (def, x, y, r) {
    for (const b of def.blocked || []) {
      if (b.r !== undefined) {
        if (U.dist2(x, y, b.x, b.y) < (b.r + r) * (b.r + r)) return true;
      } else {
        const nx = U.clamp(x, b.x, b.x + b.w), ny = U.clamp(y, b.y, b.y + b.h);
        if (U.dist2(x, y, nx, ny) < r * r) return true;
      }
    }
    return false;
  };
})();
