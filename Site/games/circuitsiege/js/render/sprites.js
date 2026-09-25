/* CIRCUIT SIEGE — procedural sprite art, cached to offscreen canvases */
(function () {
  'use strict';
  const CS = window.CS;
  const U = CS.U;
  const sh = U.shade;

  const Spr = { cache: new Map(), S: 2 };

  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  Spr.mk = mk;

  // Returns cached {c, size} where c is drawn centered, world size = size.
  Spr.get = function (key, size, draw) {
    const k = key + '@' + Spr.S;
    let e = Spr.cache.get(k);
    if (e) return e;
    const S = Spr.S;
    const c = mk(size * S, size * S);
    const x = c.getContext('2d');
    x.setTransform(S, 0, 0, S, (size * S) / 2, (size * S) / 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    draw(x);
    e = { c, size };
    if (Spr.cache.size > 900) Spr.cache.clear();
    Spr.cache.set(k, e);
    return e;
  };
  Spr.setScale = function (s) {
    s = Math.max(1, Math.min(3, Math.round(s * 4) / 4));
    if (s !== Spr.S) { Spr.S = s; Spr.cache.clear(); }
  };
  Spr.draw = function (ctx, spr, x, y, rot, scale) {
    const w = spr.size * (scale || 1);
    if (rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(spr.c, -w / 2, -w / 2, w, w);
      ctx.restore();
    } else ctx.drawImage(spr.c, x - w / 2, y - w / 2, w, w);
  };

  // Glow sprite (radial gradient) for additive blending
  Spr.glow = function (color) {
    return Spr.get('glow:' + color, 64, (x) => {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, U.rgba(color, 0.9));
      g.addColorStop(0.3, U.rgba(color, 0.35));
      g.addColorStop(1, U.rgba(color, 0));
      x.fillStyle = g; x.fillRect(-32, -32, 64, 64);
    });
  };

  // ── drawing helpers
  function poly(x, pts) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); }
  function ngon(x, n, r, rot) { x.beginPath(); for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); }
  function rrect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function circle(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); }
  function fillStroke(x, fill, stroke, lw) { x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 1.5; x.stroke(); } }
  function lin(x, x0, y0, x1, y1, c0, c1) { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  function rad(x, r, c0, c1, ox, oy) { const g = x.createRadialGradient(ox || 0, oy || 0, 0, 0, 0, r); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
  Spr.h = { poly, ngon, rrect, circle, fillStroke, lin, rad };

  const OUT = '#0b0e14';

  // ───────────────────────────── TOWER BASES
  function skinOf(id) { return CS.PROG.SKINS[id] || CS.PROG.SKINS.default; }

  function basePlate(x, def, tiers, skin, r) {
    const sk = skinOf(skin);
    const maxT = Math.max(tiers[0], tiers[1], tiers[2]);
    const total = tiers[0] + tiers[1] + tiers[2];
    // shadow
    x.fillStyle = 'rgba(0,0,0,0.35)';
    circle(x, 2, 4, r + 2); x.fill();
    // plate
    const sides = maxT >= 3 ? 8 : 6;
    ngon(x, sides, r, Math.PI / sides);
    x.fillStyle = lin(x, 0, -r, 0, r, sk.plate, sk.plate2); x.fill();
    x.strokeStyle = OUT; x.lineWidth = 2; x.stroke();
    // trim
    ngon(x, sides, r - 3, Math.PI / sides);
    x.strokeStyle = sk.prism ? lin(x, -r, -r, r, r, '#ff7bf2', '#8af5ff') : sk.trim; x.lineWidth = 1.5; x.stroke();
    // bolts
    x.fillStyle = sh(sk.trim, 0.2);
    for (let i = 0; i < sides; i++) { const a = Math.PI / sides + (i / sides) * Math.PI * 2; circle(x, Math.cos(a) * (r - 6), Math.sin(a) * (r - 6), 1.1); x.fill(); }
    // tier pips (colored by path)
    const cols = ['#ff6a5a', '#ffd84d', '#5ad7ff'];
    let k = 0;
    for (let p = 0; p < 3; p++) for (let i = 0; i < tiers[p]; i++) {
      const a = Math.PI / 2 + (k - (total - 1) / 2) * 0.28;
      circle(x, Math.cos(a) * (r - 1.5), Math.sin(a) * (r - 1.5), 1.8);
      x.fillStyle = cols[p]; x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke();
      k++;
    }
    // tier-5 halo plate
    if (maxT >= 5) {
      ngon(x, sides, r + 3, Math.PI / sides);
      x.strokeStyle = U.rgba('#ffd84d', 0.8); x.lineWidth = 1.5; x.stroke();
    }
  }

  // Head drawers: draw facing +X (angle 0). Size roughly within r*1.6
  const HEADS = {};
  const BASES = {};

  HEADS.pulse = function (x, t, c) {
    const [A, B, C] = t;
    const bodyR = 9 + (A >= 3 ? 1.5 : 0) + (B >= 5 ? 1 : 0);
    // barrels
    const barrels = B >= 5 ? 4 : B >= 3 ? 2 : 1;
    const len = 16 + A * 2.2;
    const bw = A >= 5 ? 7 : A >= 3 ? 5 : 3.6;
    for (let i = 0; i < barrels; i++) {
      const off = barrels === 1 ? 0 : (i - (barrels - 1) / 2) * (barrels === 4 ? 3.2 : 5);
      rrect(x, 2, off - bw / 2, len, bw, 1.2);
      fillStroke(x, lin(x, 0, off - bw / 2, 0, off + bw / 2, '#c9d4e3', '#5a6576'), OUT, 1.2);
      if (A >= 3) { rrect(x, len - 3, off - bw / 2 - 1, 5, bw + 2, 1); fillStroke(x, '#3b4454', OUT, 1); }
    }
    if (B >= 5) { circle(x, 10, 0, 7); x.strokeStyle = sh(c, 0.3); x.lineWidth = 2; x.stroke(); }
    if (A >= 4) { // plasma coils
      for (let i = 0; i < 3; i++) { rrect(x, 6 + i * 4, -bw / 2 - 2, 2, bw + 4, 0.8); fillStroke(x, A >= 5 ? '#ff7bf2' : '#c77dff', OUT, 0.8); }
    }
    // body
    circle(x, 0, 0, bodyR);
    fillStroke(x, rad(x, bodyR, sh(c, 0.35), sh(c, -0.45), -3, -3), OUT, 1.8);
    circle(x, -1, 0, bodyR * 0.45);
    x.fillStyle = A >= 5 ? '#ffd1fa' : sh(c, 0.7); x.fill();
    if (C >= 1) { rrect(x, -6, -bodyR - 2, 8, 3, 1); fillStroke(x, '#2a3140', OUT, 1); circle(x, 1, -bodyR - 0.5, 1.6); x.fillStyle = '#ff5a5a'; x.fill(); }
    if (C >= 3) { circle(x, -7, 6, 4); fillStroke(x, '#3a4455', OUT, 1); circle(x, -7, 6, 2); x.fillStyle = '#9fffc9'; x.fill(); }
    if (C >= 5) { x.strokeStyle = '#ffd84d'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-4, 0); x.lineTo(-14, 0); x.stroke(); circle(x, -14, 0, 2.5); x.fillStyle = '#ffd84d'; x.fill(); }
  };

  HEADS.sniper = function (x, t, c) {
    const [A, B, C] = t;
    const len = 26 + A * 2.5;
    const bw = 2.8 + (A >= 3 ? 1 : 0) + (A >= 5 ? 1.2 : 0);
    rrect(x, 0, -bw / 2, len, bw, 1);
    fillStroke(x, lin(x, 0, -bw, 0, bw, '#d8e6c8', '#56634c'), OUT, 1.1);
    rrect(x, len - 4, -bw / 2 - 1.2, 5, bw + 2.4, 1); fillStroke(x, '#394433', OUT, 1);
    if (B >= 1) { rrect(x, 2, 2, 7 + B, 5, 1); fillStroke(x, '#4d5a44', OUT, 1); }
    // body
    rrect(x, -10, -7, 18, 14, 4);
    fillStroke(x, lin(x, 0, -7, 0, 7, sh(c, 0.2), sh(c, -0.5)), OUT, 1.6);
    // scope
    rrect(x, -4, -12, 14, 5, 2); fillStroke(x, '#2b3327', OUT, 1.1);
    circle(x, 10, -9.5, 2.2); x.fillStyle = C >= 1 ? '#ff5a5a' : '#9fffb0'; x.fill();
    if (C >= 3) { circle(x, -8, 9, 4.5); fillStroke(x, '#394433', OUT, 1); x.strokeStyle = '#9fffb0'; x.lineWidth = 1; x.beginPath(); x.arc(-8, 9, 2.5, -1, 1.5); x.stroke(); }
    if (A >= 5) { circle(x, len - 2, 0, 3.5); x.fillStyle = '#ff4d6d'; x.fill(); }
    if (C >= 5) { circle(x, -12, -6, 5); fillStroke(x, '#ffd84d', OUT, 1); }
  };

  HEADS.missile = function (x, t, c) {
    const [A, B, C] = t;
    const grid = B >= 4 ? 3 : B >= 2 ? 2 : 1;
    const w = 12 + grid * 5, h = 12 + grid * 5;
    rrect(x, -w / 2, -h / 2, w, h, 3);
    fillStroke(x, lin(x, 0, -h / 2, 0, h / 2, sh(c, 0.1), sh(c, -0.55)), OUT, 1.8);
    const cell = (w - 6) / grid;
    for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
      const cx = -w / 2 + 3 + cell * (i + 0.5), cy = -h / 2 + 3 + cell * (j + 0.5);
      circle(x, cx, cy, cell * 0.36); x.fillStyle = '#1a1d24'; x.fill();
      circle(x, cx + 0.6, cy, cell * 0.22); x.fillStyle = A >= 4 ? '#ffd84d' : A >= 1 ? '#ff5a3d' : '#d9dde5'; x.fill();
    }
    if (C >= 1) { rrect(x, -w / 2 - 5, -3, 5, 6, 1); fillStroke(x, '#3a3f4a', OUT, 1); }
    if (C >= 5) { circle(x, -w / 2 - 6, 0, 5); fillStroke(x, '#ffd84d', OUT, 1); x.strokeStyle = OUT; x.beginPath(); x.moveTo(-w / 2 - 9, 0); x.lineTo(-w / 2 - 3, 0); x.stroke(); }
    if (A >= 5) { rrect(x, w / 2 - 2, -h / 2 + 2, 4, h - 4, 1); fillStroke(x, '#ffd84d', OUT, 1); }
  };

  HEADS.rail = function (x, t, c) {
    const [A, B, C] = t;
    const len = 30 + A * 2.5;
    const rails = B >= 2 ? 2 : 1;
    for (let r = 0; r < rails; r++) {
      const oy = rails === 1 ? 0 : (r - 0.5) * 9;
      rrect(x, -2, oy - 4.5, len, 2.4, 1); fillStroke(x, '#bfe9f2', OUT, 1);
      rrect(x, -2, oy + 2.1, len, 2.4, 1); fillStroke(x, '#bfe9f2', OUT, 1);
      x.fillStyle = A >= 5 ? '#ffffff' : c;
      x.globalAlpha = 0.8; x.fillRect(2, oy - 1.2, len - 6, 2.4); x.globalAlpha = 1;
      for (let i = 0; i < 3 + A; i++) { rrect(x, 4 + i * ((len - 8) / (3 + A)), oy - 5.5, 2.2, 11, 0.8); fillStroke(x, '#394b5a', OUT, 0.8); }
    }
    rrect(x, -12, -8, 14, 16, 4);
    fillStroke(x, lin(x, 0, -8, 0, 8, sh(c, 0.2), sh(c, -0.6)), OUT, 1.6);
    circle(x, -5, 0, 3.5); x.fillStyle = sh(c, 0.6); x.fill();
    if (C >= 1) { rrect(x, -8, -13, 12, 4, 1.5); fillStroke(x, '#2a3845', OUT, 1); }
    if (C >= 5) { circle(x, -12, 8, 4); fillStroke(x, '#ffd84d', OUT, 1); }
    if (B >= 5) { circle(x, -5, 0, 7); x.strokeStyle = '#ffd84d'; x.lineWidth = 1.5; x.stroke(); }
  };

  HEADS.virus = function (x, t, c) {
    const [A, B, C] = t;
    // nozzle
    rrect(x, 2, -3.5, 16 + A, 7, 2.5); fillStroke(x, lin(x, 0, -4, 0, 4, '#b9f5b0', '#3d6a37'), OUT, 1.2);
    circle(x, 18 + A, 0, 3.5); x.fillStyle = '#7dff6a'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
    // tank
    circle(x, -2, 0, 10);
    fillStroke(x, rad(x, 10, '#d2ffc9', sh(c, -0.5), -3, -3), OUT, 1.7);
    circle(x, -2, 0, 6); x.fillStyle = A >= 5 ? '#e6ff4d' : '#57d14a'; x.fill();
    circle(x, -4, -2, 1.8); x.fillStyle = '#eaffea'; x.fill();
    if (B >= 3) { for (let i = 0; i < 3; i++) { const a = 2 + i * 0.9; circle(x, Math.cos(a) * 12, Math.sin(a) * 12, 3.2); fillStroke(x, '#57d14a', OUT, 1); } }
    if (C >= 5) { circle(x, -10, 0, 4); fillStroke(x, '#1d2b1a', '#7dff6a', 1.5); }
  };

  HEADS.quantum = function (x, t, c) {
    const [A, B, C] = t;
    const len = 30 + A * 2;
    const bw = 10 + (A >= 3 ? 2 : 0);
    rrect(x, 0, -bw / 2, len, bw, 3);
    fillStroke(x, lin(x, 0, -bw / 2, 0, bw / 2, '#efe3ff', '#5c4a7a'), OUT, 1.5);
    for (let i = 0; i < 3 + Math.floor(B / 2); i++) { rrect(x, 6 + i * 6, -bw / 2 - 2, 3, bw + 4, 1); fillStroke(x, '#3d3150', OUT, 1); }
    circle(x, len, 0, bw / 2 + 1); fillStroke(x, '#2a2238', OUT, 1.2);
    circle(x, len, 0, bw / 2 - 2); x.fillStyle = A >= 5 ? '#ffffff' : '#e0a3ff'; x.fill();
    // body
    ngon(x, 6, 15, 0);
    fillStroke(x, lin(x, 0, -15, 0, 15, sh(c, 0.25), sh(c, -0.6)), OUT, 2);
    circle(x, 0, 0, 7); x.fillStyle = rad(x, 7, '#ffffff', '#b06bff'); x.fill();
    if (B >= 3) { circle(x, 0, 0, 11); x.strokeStyle = '#f3dcff'; x.lineWidth = 1.2; x.stroke(); }
    if (C >= 3) { circle(x, -12, 10, 4); fillStroke(x, '#3d3150', '#e0a3ff', 1.2); circle(x, -12, -10, 4); fillStroke(x, '#3d3150', '#e0a3ff', 1.2); }
  };

  // Static (non-rotating) towers draw their "head" into the base sprite.
  BASES.firewall = function (x, t, c) {
    const [A, B, C] = t;
    const col = B > A && B >= C ? '#8fe8ff' : C > A && C > B ? '#b7ffcf' : '#ff8a3d';
    // pylons
    const n = 4 + (Math.max(A, B, C) >= 3 ? 2 : 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(a) * 11, py = Math.sin(a) * 11;
      rrect(x, px - 2.5, py - 2.5, 5, 5, 1.2); fillStroke(x, '#3a3f4a', OUT, 1);
      circle(x, px, py, 1.4); x.fillStyle = col; x.fill();
    }
    // core crystal
    const cr = 6 + Math.max(A, B, C) * 0.8;
    poly(x, [0, -cr - 2, cr * 0.8, 0, 0, cr + 2, -cr * 0.8, 0]);
    fillStroke(x, lin(x, 0, -cr, 0, cr, sh(col, 0.6), sh(col, -0.35)), OUT, 1.4);
    poly(x, [0, -cr + 1, cr * 0.35, 0, 0, cr - 2, -cr * 0.35, 0]);
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.fill();
  };
  BASES.arc = function (x, t, c) {
    const [A, B, C] = t;
    const rings = 3 + Math.floor((A + B) / 2);
    for (let i = rings; i >= 1; i--) {
      circle(x, 0, 0, 3 + i * 2.1);
      x.fillStyle = i % 2 ? '#b87333' : '#8a5426'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.9; x.stroke();
    }
    circle(x, 0, 0, 5 + A * 0.4);
    x.fillStyle = rad(x, 6, '#ffffff', '#6b8dff'); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
    if (C >= 5) {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.strokeStyle = '#cfd9ff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); x.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); x.stroke(); }
    }
    if (B >= 3) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; circle(x, Math.cos(a) * 13, Math.sin(a) * 13, 2.2); fillStroke(x, '#8ab4ff', OUT, 1); }
  };
  BASES.drone = function (x, t, c) {
    const [A, B, C] = t;
    circle(x, 0, 0, 12); fillStroke(x, '#232a33', OUT, 1.4);
    x.strokeStyle = '#d7ff8a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-4, -5); x.lineTo(-4, 5); x.moveTo(4, -5); x.lineTo(4, 5); x.moveTo(-4, 0); x.lineTo(4, 0); x.stroke();
    const lights = 6 + B;
    for (let i = 0; i < lights; i++) { const a = (i / lights) * Math.PI * 2; circle(x, Math.cos(a) * 10, Math.sin(a) * 10, 1); x.fillStyle = i % 2 ? '#d7ff8a' : '#ffb547'; x.fill(); }
    if (A >= 4) { rrect(x, -18, -4, 5, 8, 1); fillStroke(x, '#4a5a2a', OUT, 1); rrect(x, 13, -4, 5, 8, 1); fillStroke(x, '#4a5a2a', OUT, 1); }
    if (C >= 3) { circle(x, 12, -12, 4); fillStroke(x, '#3a4455', OUT, 1); circle(x, 12, -12, 1.8); x.fillStyle = '#b7ff5a'; x.fill(); }
  };
  BASES.farm = function (x, t, c) {
    const [A, B, C] = t;
    const racks = 2 + Math.min(3, Math.floor(A / 2) + (A >= 5 ? 1 : 0));
    const w = 7;
    const tot = racks * (w + 1.5);
    for (let i = 0; i < racks; i++) {
      const px = -tot / 2 + i * (w + 1.5);
      rrect(x, px, -11, w, 22, 1.5); fillStroke(x, lin(x, px, 0, px + w, 0, '#3b4252', '#1d222c'), OUT, 1.1);
      for (let j = 0; j < 5; j++) { x.fillStyle = (i + j) % 3 === 0 ? '#ffd84d' : '#6dffb0'; x.fillRect(px + 1.5, -9 + j * 4, 2, 1.4); }
    }
    if (B >= 1) { circle(x, 0, 14, 4.2); fillStroke(x, '#ffd84d', OUT, 1.2); x.fillStyle = OUT; x.font = 'bold 6px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('¢', 0, 14.3); }
    if (C >= 1) { rrect(x, 11, -15, 7, 5, 1); fillStroke(x, '#5a4a2a', OUT, 1); }
    if (A >= 5) { circle(x, 0, -15, 5); fillStroke(x, '#e8f8ff', OUT, 1); }
  };
  BASES.amp = function (x, t, c) {
    const [A, B, C] = t;
    circle(x, 0, 0, 11); fillStroke(x, lin(x, 0, -11, 0, 11, '#4a2a44', '#1f1220'), OUT, 1.5);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 - Math.PI / 2; rrect(x, Math.cos(a) * 8 - 2.5, Math.sin(a) * 8 - 2.5, 5, 5, 1); fillStroke(x, A >= B ? '#ff6a5a' : '#ffd84d', OUT, 1); }
    circle(x, 0, 0, 5 + Math.max(A, B, C) * 0.4); x.fillStyle = rad(x, 7, '#ffffff', c); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1; x.stroke();
    if (C >= 5) { circle(x, 0, 0, 15); x.strokeStyle = '#ffd84d'; x.lineWidth = 1.2; x.stroke(); }
  };
  BASES.gravity = function (x, t, c) {
    const [A, B, C] = t;
    circle(x, 0, 0, 12); fillStroke(x, rad(x, 12, '#3a2a55', '#120b1f'), OUT, 1.5);
    const cr = 6 + A * 0.5;
    circle(x, 0, 0, cr); x.fillStyle = '#05030a'; x.fill();
    x.strokeStyle = '#c77dff'; x.lineWidth = 1.4; circle(x, 0, 0, cr + 1); x.stroke();
    if (C >= 5 || A >= 5) { circle(x, 0, 0, cr + 4); x.strokeStyle = '#ffd84d'; x.lineWidth = 1; x.stroke(); }
  };

  function towerBaseRadius(def, tiers) {
    const total = tiers[0] + tiers[1] + tiers[2];
    return def.r + (total >= 5 ? 2 : total >= 3 ? 1 : 0);
  }

  Spr.towerBase = function (type, tiers, skin) {
    const def = CS.TOWERS[type];
    const key = 'tb:' + type + ':' + tiers.join('') + ':' + skin;
    const r = towerBaseRadius(def, tiers);
    return Spr.get(key, (r + 8) * 2, (x) => {
      basePlate(x, def, tiers, skin, r);
      if (BASES[type]) BASES[type](x, tiers, def.color);
    });
  };
  Spr.towerHead = function (type, tiers, skin) {
    if (!HEADS[type]) return null;
    const def = CS.TOWERS[type];
    const key = 'th:' + type + ':' + tiers.join('') + ':' + skin;
    return Spr.get(key, 84, (x) => {
      const sk = skinOf(skin);
      const col = skin === 'default' ? def.color : sk.prism ? '#b98cff' : sh(sk.trim, 0.1);
      // soft drop shadow
      x.save(); x.translate(2, 3); x.globalAlpha = 0.25; x.filter = 'none';
      HEADS[type](x, tiers, '#000000');
      x.restore();
      HEADS[type](x, tiers, col);
    });
  };
  Spr.hasHead = (type) => !!HEADS[type];

  // Icon for menus / shop (data URL cached)
  const iconCache = {};
  Spr.towerIcon = function (type, tiers, skin, px) {
    tiers = tiers || [0, 0, 0]; skin = skin || 'default'; px = px || 64;
    const key = type + tiers.join('') + skin + px;
    if (iconCache[key]) return iconCache[key];
    const c = mk(px, px);
    const x = c.getContext('2d');
    const def = CS.TOWERS[type];
    const s = px / ((def.r + 12) * 2);
    x.setTransform(s, 0, 0, s, px / 2, px / 2);
    x.lineJoin = 'round'; x.lineCap = 'round';
    basePlate(x, def, tiers, skin, towerBaseRadius(def, tiers));
    if (BASES[type]) BASES[type](x, tiers, def.color);
    if (HEADS[type]) { x.rotate(-Math.PI / 4); HEADS[type](x, tiers, def.color); }
    iconCache[key] = c.toDataURL();
    return iconCache[key];
  };

  // ───────────────────────────── ENEMIES
  const EN = {};
  EN.frag = function (x, c, r) { // isometric data cube
    const s = r * 0.95;
    poly(x, [0, -s, s, -s / 2, 0, 0, -s, -s / 2]); fillStroke(x, sh(c, 0.35), OUT, 1.4);
    poly(x, [-s, -s / 2, 0, 0, 0, s, -s, s / 2]); fillStroke(x, sh(c, -0.15), OUT, 1.4);
    poly(x, [s, -s / 2, 0, 0, 0, s, s, s / 2]); fillStroke(x, sh(c, -0.45), OUT, 1.4);
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(-2, -s * 0.62, 4, 2);
  };
  EN.mini = function (x, c, r) {
    poly(x, [0, -r, r * 0.9, r * 0.6, -r * 0.9, r * 0.6]); fillStroke(x, lin(x, 0, -r, 0, r, sh(c, 0.3), sh(c, -0.4)), OUT, 1.2);
  };
  EN.zip = function (x, c, r) { // speedy folder facing +x
    rrect(x, -r * 1.2, -r * 0.75, r * 2.2, r * 1.5, 2.5); fillStroke(x, lin(x, 0, -r, 0, r, sh(c, 0.3), sh(c, -0.35)), OUT, 1.3);
    rrect(x, -r * 1.2, -r * 0.95, r * 0.9, r * 0.5, 1.5); fillStroke(x, sh(c, 0.1), OUT, 1);
    x.strokeStyle = '#3a3320'; x.lineWidth = 1.4; x.beginPath();
    for (let i = 0; i < 4; i++) { x.moveTo(-r * 0.2 + i * 3, -r * 0.6); x.lineTo(-r * 0.2 + i * 3, r * 0.6); }
    x.stroke();
    x.strokeStyle = U.rgba(c, 0.6); x.lineWidth = 1.6; x.beginPath(); x.moveTo(-r * 1.6, -3); x.lineTo(-r * 2.4, -3); x.moveTo(-r * 1.6, 3); x.lineTo(-r * 2.6, 3); x.stroke();
  };
  EN.breaker = function (x, c, r) { // armored hex tank facing +x
    ngon(x, 6, r, 0); fillStroke(x, lin(x, 0, -r, 0, r, '#c3ccd8', '#4b5563'), OUT, 2);
    ngon(x, 6, r * 0.66, 0); fillStroke(x, lin(x, 0, -r, 0, r, '#8a94a3', '#39414d'), OUT, 1.3);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; circle(x, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, 1.3); x.fillStyle = '#e2e8f0'; x.fill(); }
    rrect(x, r * 0.25, -r * 0.3, r * 0.55, r * 0.6, 2); fillStroke(x, '#ff4d4d', OUT, 1);
  };
  EN.shield = function (x, c, r) {
    ngon(x, 4, r * 0.95, Math.PI / 4); fillStroke(x, lin(x, 0, -r, 0, r, sh(c, 0.4), sh(c, -0.4)), OUT, 1.5);
    circle(x, 0, 0, r * 0.4); x.fillStyle = '#e6f3ff'; x.fill();
  };
  EN.ghost = function (x, c, r) {
    x.beginPath(); x.arc(0, -r * 0.1, r, Math.PI, 0);
    x.lineTo(r, r * 0.9);
    for (let i = 0; i < 4; i++) { const px = r - (i + 0.5) * (r * 2 / 4); x.quadraticCurveTo(px + r / 4, r * 0.55, px, r * 0.9); x.quadraticCurveTo(px - r / 4, r * 1.2, px - r / 4, r * 0.9); }
    x.closePath();
    fillStroke(x, lin(x, 0, -r, 0, r, '#ffffff', sh(c, -0.25)), OUT, 1.3);
    circle(x, -r * 0.35, -r * 0.2, r * 0.18); x.fillStyle = '#3a2266'; x.fill();
    circle(x, r * 0.35, -r * 0.2, r * 0.18); x.fill();
  };
  EN.splitter = function (x, c, r) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      x.save(); x.translate(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42); x.rotate(a + Math.PI / 2);
      poly(x, [0, -r * 0.6, r * 0.55, r * 0.4, -r * 0.55, r * 0.4]); fillStroke(x, lin(x, 0, -r, 0, r, sh(c, 0.35), sh(c, -0.35)), OUT, 1.2);
      x.restore();
    }
    circle(x, 0, 0, r * 0.25); x.fillStyle = '#fff1d6'; x.fill();
  };
  EN.healer = function (x, c, r) {
    circle(x, 0, 0, r); fillStroke(x, rad(x, r, '#ffffff', sh(c, -0.25), -3, -3), OUT, 1.5);
    x.fillStyle = '#ff3d8f';
    x.fillRect(-r * 0.15, -r * 0.55, r * 0.3, r * 1.1); x.fillRect(-r * 0.55, -r * 0.15, r * 1.1, r * 0.3);
  };
  EN.overclocker = function (x, c, r) {
    const n = 8;
    x.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.78 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    x.closePath(); fillStroke(x, lin(x, 0, -r, 0, r, sh(c, 0.35), sh(c, -0.4)), OUT, 1.4);
    circle(x, 0, 0, r * 0.4); x.fillStyle = '#2a0a10'; x.fill();
    x.strokeStyle = '#ffd84d'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-2, -4); x.lineTo(2, 0); x.lineTo(-1, 0); x.lineTo(2, 4); x.stroke();
  };
  EN.trojan = function (x, c, r) {
    EN.frag(x, c, r);
    x.fillStyle = '#ff3d6e'; circle(x, r * 0.55, r * 0.35, 1.6); x.fill();
  };
  EN.trojanx = function (x, c, r) {
    x.beginPath();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, rr = i % 2 ? r * 0.65 : r; i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    x.closePath(); fillStroke(x, lin(x, 0, -r, 0, r, '#ff7b9a', '#7a0f2a'), OUT, 1.6);
    circle(x, r * 0.2, 0, r * 0.32); x.fillStyle = '#ffe04d'; x.fill();
    circle(x, r * 0.28, 0, r * 0.14); x.fillStyle = OUT; x.fill();
  };
  EN.cache = function (x, c, r) {
    rrect(x, -r, -r * 0.75, r * 2, r * 1.5, 3); fillStroke(x, lin(x, 0, -r, 0, r, '#fff0a8', '#b8860b'), OUT, 1.6);
    x.fillStyle = '#7a5a10'; x.fillRect(-r, -r * 0.1, r * 2, r * 0.2);
    rrect(x, -r * 0.25, -r * 0.3, r * 0.5, r * 0.55, 1); fillStroke(x, '#fff7d6', OUT, 1);
  };
  EN.wormseg = function (x, c, r) {
    circle(x, 0, 0, r); fillStroke(x, rad(x, r, sh(c, 0.4), sh(c, -0.5), -3, -3), OUT, 1.8);
    x.strokeStyle = U.rgba('#0b0e14', 0.5); x.lineWidth = 1.4;
    x.beginPath(); x.arc(0, 0, r * 0.6, -1.2, 1.2); x.stroke();
    for (let i = -1; i <= 1; i += 2) { rrect(x, -3, i * r - 2, 6, 4, 1); fillStroke(x, '#3a5a2a', OUT, 1); }
  };
  EN.worm = function (x, c, r) {
    circle(x, 0, 0, r); fillStroke(x, rad(x, r, sh(c, 0.4), sh(c, -0.55), -4, -4), OUT, 2.2);
    // mandibles facing +x
    for (let i = -1; i <= 1; i += 2) { x.beginPath(); x.moveTo(r * 0.5, i * r * 0.5); x.quadraticCurveTo(r * 1.5, i * r * 0.6, r * 1.3, i * r * 0.05); x.lineTo(r * 0.8, i * r * 0.2); x.closePath(); fillStroke(x, '#e8ffd0', OUT, 1.5); }
    circle(x, r * 0.35, -r * 0.35, r * 0.16); x.fillStyle = '#ff3d3d'; x.fill();
    circle(x, r * 0.35, r * 0.35, r * 0.16); x.fill();
  };
  EN.ram = function (x, c, r) { // memory stick crusher facing +x
    rrect(x, -r * 1.2, -r * 0.7, r * 2.4, r * 1.4, 4); fillStroke(x, lin(x, 0, -r, 0, r, '#2e7d4f', '#123824'), OUT, 2.5);
    for (let i = 0; i < 4; i++) { rrect(x, -r * 1.0 + i * r * 0.55, -r * 0.45, r * 0.42, r * 0.9, 2); fillStroke(x, lin(x, 0, -r, 0, r, '#39414d', '#15181e'), OUT, 1.4); x.fillStyle = '#9fb3c8'; x.fillRect(-r * 0.95 + i * r * 0.55, -r * 0.38, r * 0.32, 2); }
    for (let i = 0; i < 10; i++) { x.fillStyle = '#e6c15a'; x.fillRect(-r * 1.1 + i * r * 0.24, r * 0.55, r * 0.14, r * 0.14); }
    rrect(x, r * 1.1, -r * 0.55, r * 0.3, r * 1.1, 2); fillStroke(x, '#5aa0ff', OUT, 1.5);
  };
  EN.blackout = function (x, c, r) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      x.beginPath(); x.moveTo(Math.cos(a - 0.2) * r * 0.8, Math.sin(a - 0.2) * r * 0.8); x.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25); x.lineTo(Math.cos(a + 0.2) * r * 0.8, Math.sin(a + 0.2) * r * 0.8); x.closePath();
      x.fillStyle = '#4a2a8a'; x.fill();
    }
    circle(x, 0, 0, r); fillStroke(x, rad(x, r, '#2a1a4a', '#050308'), OUT, 2);
    circle(x, 0, 0, r * 0.45); x.fillStyle = rad(x, r * 0.45, '#e2d2ff', '#8a5cff'); x.fill();
    circle(x, 0, 0, r * 0.18); x.fillStyle = '#050308'; x.fill();
  };
  EN.root = function (x, c, r) {
    ngon(x, 8, r, Math.PI / 8); fillStroke(x, lin(x, 0, -r, 0, r, '#5a1022', '#1a0409'), OUT, 2.5);
    ngon(x, 8, r * 0.78, Math.PI / 8); x.strokeStyle = '#ff3d6e'; x.lineWidth = 2; x.stroke();
    // crown spikes
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.4; x.beginPath(); x.moveTo(Math.cos(a - 0.12) * r * 0.9, Math.sin(a - 0.12) * r * 0.9); x.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); x.lineTo(Math.cos(a + 0.12) * r * 0.9, Math.sin(a + 0.12) * r * 0.9); x.closePath(); fillStroke(x, '#ffd84d', OUT, 1.2); }
    circle(x, 0, 0, r * 0.42); x.fillStyle = rad(x, r * 0.42, '#ffffff', '#ff3d6e'); x.fill();
    circle(x, 0, 0, r * 0.16); x.fillStyle = OUT; x.fill();
  };
  EN.sentinel = function (x, c, r) {
    ngon(x, 6, r, Math.PI / 6); fillStroke(x, lin(x, 0, -r, 0, r, '#bfefff', '#1f5a73'), OUT, 2);
    circle(x, 0, 0, r * 0.45); x.fillStyle = rad(x, r * 0.45, '#ffffff', '#39d0ff'); x.fill();
  };
  EN.zombie = function (x, c, r) {
    circle(x, 0, 0, r); fillStroke(x, rad(x, r, '#d2ffc9', '#2f8a25'), OUT, 1.3);
    circle(x, 3, -2, 1.8); x.fillStyle = OUT; x.fill(); circle(x, 3, 3, 1.8); x.fill();
  };

  Spr.enemy = function (type, flash) {
    const def = CS.ENEMIES[type];
    const r = def.r;
    const key = 'en:' + type + (flash ? ':f' : '');
    const size = r * 3.2 + 8;
    return Spr.get(key, size, (x) => {
      if (!def.boss) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(1, r * 0.75, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); x.fill(); }
      (EN[type] || EN.frag)(x, def.color, r);
      if (flash) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(-size, -size, size * 2, size * 2); }
    });
  };
  Spr.ROTATING = { zip: true, breaker: true, worm: true, ram: true, trojanx: true, cache: false };

  Spr.enemyIcon = function (type, px) {
    px = px || 48;
    const key = 'ei' + type + px;
    if (iconCache[key]) return iconCache[key];
    const def = CS.ENEMIES[type];
    const c = mk(px, px);
    const x = c.getContext('2d');
    const s = px / (def.r * 3);
    x.setTransform(s, 0, 0, s, px / 2, px / 2);
    x.lineJoin = 'round';
    (EN[type] || EN.frag)(x, def.color, def.r);
    iconCache[key] = c.toDataURL();
    return iconCache[key];
  };

  // Drone sprite
  Spr.drone = function (gun) {
    return Spr.get('drone' + (gun ? 'g' : ''), gun ? 30 : 20, (x) => {
      const s = gun ? 1.6 : 1;
      x.scale(s, s);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; circle(x, Math.cos(a) * 5, Math.sin(a) * 5, 2.6); x.fillStyle = 'rgba(200,255,150,0.25)'; x.fill(); x.strokeStyle = '#1a2010'; x.lineWidth = 0.8; x.stroke(); }
      poly(x, [6, 0, -3, -3.5, -1.5, 0, -3, 3.5]); fillStroke(x, gun ? '#e6ff9a' : '#b7ff5a', OUT, 1);
    });
  };

  CS.Spr = Spr;
})();
