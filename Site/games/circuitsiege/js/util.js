/* CIRCUIT SIEGE — shared utilities */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CS = (root.CS = root.CS || {});

  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  U.dist = (ax, ay, bx, by) => Math.sqrt(U.dist2(ax, ay, bx, by));
  U.angleLerp = (a, b, t) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Small deterministic RNG (mulberry32) so daily challenges & map decor are stable.
  U.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    return f;
  };
  U.hashStr = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  U.fmt = function (n) {
    n = Math.floor(n);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e5) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString('en-US');
  };
  U.fmtTime = function (sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  };
  U.todayKey = function (d) {
    d = d || new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  };

  // Color helpers — hex <-> rgb + shade
  U.hexToRgb = function (hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  U.shade = function (hex, amt) {
    // amt -1..1 : darken or lighten
    const [r, g, b] = U.hexToRgb(hex);
    if (amt >= 0) return U.rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return U.rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  };
  U.rgba = function (hex, a) {
    const [r, g, b] = U.hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  };

  // Generic object pool. Objects are plain objects created by factory; `active` flag marks usage.
  class Pool {
    constructor(factory, size) {
      this.items = [];
      this.factory = factory;
      this.free = [];
      for (let i = 0; i < size; i++) { const o = factory(); o.active = false; this.items.push(o); this.free.push(o); }
      this.count = 0;
    }
    get() {
      let o = this.free.pop();
      if (!o) { o = this.factory(); this.items.push(o); }
      o.active = true;
      this.count++;
      return o;
    }
    release(o) {
      if (!o.active) return;
      o.active = false;
      this.count--;
      this.free.push(o);
    }
    forEachActive(fn) {
      const it = this.items;
      for (let i = 0; i < it.length; i++) if (it[i].active) fn(it[i]);
    }
    clear() {
      this.free.length = 0;
      for (const o of this.items) { o.active = false; this.free.push(o); }
      this.count = 0;
    }
  }
  U.Pool = Pool;

  // Uniform spatial grid rebuilt each simulation step for fast neighbour queries.
  class Grid {
    constructor(w, h, cell) {
      this.cell = cell;
      this.cols = Math.ceil(w / cell) + 1;
      this.rows = Math.ceil(h / cell) + 1;
      this.buckets = new Array(this.cols * this.rows);
      for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
      this.used = [];
    }
    clear() {
      for (const i of this.used) this.buckets[i].length = 0;
      this.used.length = 0;
    }
    insert(o, x, y) {
      let cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
      if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
      if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
      const i = cy * this.cols + cx;
      const b = this.buckets[i];
      if (b.length === 0) this.used.push(i);
      b.push(o);
    }
    // calls fn(o) for objects in cells overlapping circle (x,y,r). fn returning true stops.
    query(x, y, r, fn) {
      const c = this.cell;
      let x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      let y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
      if (x1 >= this.cols) x1 = this.cols - 1; if (y1 >= this.rows) y1 = this.rows - 1;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const b = this.buckets[cy * this.cols + cx];
          for (let k = 0; k < b.length; k++) if (fn(b[k])) return;
        }
      }
    }
  }
  U.Grid = Grid;

  // Distance from point to segment squared
  U.segDist2 = function (px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py;
    return qx * qx + qy * qy;
  };

  U.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  U.esc = function (s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  CS.U = U;
})();
