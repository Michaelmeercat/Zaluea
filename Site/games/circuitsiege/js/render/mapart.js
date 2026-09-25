/* CIRCUIT SIEGE — themed map backgrounds (painted once, cached) + ambient animation data */
(function () {
  'use strict';
  const CS = window.CS;
  const U = CS.U;
  const sh = U.shade;
  const { poly, ngon, rrect, circle, fillStroke, lin, rad } = CS.Spr.h;
  const OUT = '#0b0e14';

  const MA = {};

  function freeSpot(built, def, x, y, clear) {
    if (x < 8 || y < 8 || x > CS.WORLD_W - 8 || y > CS.WORLD_H - 8) return false;
    if (CS.pathDistAt(built, x, y) < clear) return false;
    for (const c of built.cores) if (U.dist2(x, y, c.x, c.y) < 70 * 70) return false;
    return true;
  }

  function tree(x, px, py, s, pal) {
    x.fillStyle = 'rgba(0,0,0,0.28)';
    x.beginPath(); x.ellipse(px + 4, py + 6, 14 * s, 8 * s, 0, 0, Math.PI * 2); x.fill();
    const blobs = [[0, 0, 11], [-7, 3, 8], [7, 3, 8], [0, -6, 8]];
    for (const [bx, by, br] of blobs) { circle(x, px + bx * s, py + by * s, br * s); x.fillStyle = pal[0]; x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.2; x.stroke(); }
    for (const [bx, by, br] of blobs) { circle(x, px + bx * s - 2 * s, py + by * s - 2 * s, br * s * 0.55); x.fillStyle = pal[1]; x.fill(); }
  }
  function rock(x, px, py, s, col) {
    const r = U.rng(px * 7 + py * 13);
    const pts = [];
    const n = 6;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rr = s * (0.7 + r() * 0.4); pts.push(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.75); }
    poly(x, pts); fillStroke(x, lin(x, px, py - s, px, py + s, sh(col, 0.25), sh(col, -0.3)), OUT, 1.2);
  }

  function drawPath(x, built, th) {
    const W = CS.PATH_W;
    for (const pass of [0, 1, 2]) {
      for (const p of built.paths) {
        x.beginPath();
        x.moveTo(p.pts[0][0], p.pts[0][1]);
        for (let i = 1; i < p.pts.length; i++) x.lineTo(p.pts[i][0], p.pts[i][1]);
        if (pass === 0) { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = W + 16; x.stroke(); }
        if (pass === 1) { x.strokeStyle = th.pathEdge; x.lineWidth = W + 8; x.stroke(); }
        if (pass === 2) { x.strokeStyle = th.path; x.lineWidth = W; x.stroke(); }
      }
    }
    // texture on path
    const r = U.rng(99);
    for (const p of built.paths) {
      for (let k = 0; k < p.n; k += 6) {
        if (r() < 0.5) continue;
        const a = p.angs[k] + Math.PI / 2, off = (r() - 0.5) * (W - 8);
        x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
        x.fillRect(p.xs[k] + Math.cos(a) * off - 2, p.ys[k] + Math.sin(a) * off - 2, 3 + r() * 5, 2 + r() * 3);
      }
    }
    // trace edges
    for (const side of [-1, 1]) {
      for (const p of built.paths) {
        x.beginPath();
        for (let k = 0; k < p.n; k += 2) {
          const a = p.angs[k] + Math.PI / 2;
          const px = p.xs[k] + Math.cos(a) * side * (W / 2 - 3), py = p.ys[k] + Math.sin(a) * side * (W / 2 - 3);
          k ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.strokeStyle = U.rgba(th.pathLine, 0.35); x.lineWidth = 1.2; x.stroke();
      }
    }
    // centre dashes
    x.setLineDash([10, 14]);
    for (const p of built.paths) {
      x.beginPath(); x.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i++) x.lineTo(p.pts[i][0], p.pts[i][1]);
      x.strokeStyle = U.rgba(th.pathLine, 0.16); x.lineWidth = 2; x.stroke();
    }
    x.setLineDash([]);
  }

  function groundTexture(x, th, seed) {
    x.fillStyle = th.ground; x.fillRect(0, 0, CS.WORLD_W, CS.WORLD_H);
    const r = U.rng(seed);
    for (let i = 0; i < 520; i++) {
      const px = r() * CS.WORLD_W, py = r() * CS.WORLD_H, s = 6 + r() * 34;
      x.globalAlpha = 0.18 + r() * 0.25;
      x.fillStyle = r() < 0.5 ? th.ground2 : th.ground3;
      x.beginPath(); x.ellipse(px, py, s, s * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    // subtle digital grid
    x.strokeStyle = 'rgba(255,255,255,0.035)'; x.lineWidth = 1;
    x.beginPath();
    for (let gx = 0; gx <= CS.WORLD_W; gx += 40) { x.moveTo(gx, 0); x.lineTo(gx, CS.WORLD_H); }
    for (let gy = 0; gy <= CS.WORLD_H; gy += 40) { x.moveTo(0, gy); x.lineTo(CS.WORLD_W, gy); }
    x.stroke();
  }

  function scatter(built, def, seed, n, clear, fn) {
    const r = U.rng(seed);
    let placed = 0;
    for (let i = 0; i < n * 8 && placed < n; i++) {
      const px = r() * CS.WORLD_W, py = r() * CS.WORLD_H;
      if (!freeSpot(built, def, px, py, clear)) continue;
      if (CS.pointBlocked(def, px, py, 6) && !fn.onBlocked) continue;
      fn(px, py, r);
      placed++;
    }
  }

  // ── Theme decorators: each returns ambient animation data
  const DECOR = {};
  DECOR.forest = function (x, def, built, th) {
    const amb = { motes: [], water: [] };
    for (const w of def.water || []) {
      circle(x, w.x, w.y, w.r + 6); x.fillStyle = '#3d5a3a'; x.fill();
      circle(x, w.x, w.y, w.r); x.fillStyle = rad(x, w.r, '#4fb8e6', '#1c5a82'); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.5; x.stroke();
      amb.water.push(w);
    }
    const isWater = (b) => (def.water || []).some((w) => w.x === b.x && w.y === b.y);
    for (const b of def.blocked || []) if (!isWater(b)) { for (let i = 0; i < 5; i++) rock(x, b.x + Math.cos(i * 1.3) * b.r * 0.55, b.y + Math.sin(i * 1.3) * b.r * 0.5, 12 + (i % 3) * 5, '#7a8290'); }
    scatter(built, def, 11, 90, 44, (px, py, r) => { x.fillStyle = r() < 0.5 ? '#ffd84d' : r() < 0.5 ? '#ff8fc8' : '#e8f8ff'; circle(x, px, py, 1.6); x.fill(); });
    scatter(built, def, 12, 14, 50, (px, py, r) => rock(x, px, py, 6 + r() * 6, '#6b7280'));
    scatter(built, def, 13, 34, 62, (px, py, r) => tree(x, px, py, 0.8 + r() * 0.5, r() < 0.5 ? ['#2f7a45', '#4fae62'] : ['#2a6b4a', '#3f9c6c']));
    // data pylons
    scatter(built, def, 14, 6, 60, (px, py) => { rrect(x, px - 3, py - 10, 6, 14, 2); fillStroke(x, '#2b3342', OUT, 1); amb.motes.push({ x: px, y: py - 10, kind: 'light', c: '#39d0ff' }); });
    for (let i = 0; i < 18; i++) amb.motes.push({ x: Math.random() * 1280, y: Math.random() * 720, kind: 'mote', c: '#c9ffda', p: Math.random() * 6 });
    return amb;
  };
  DECOR.farmland = function (x, def, built, th) {
    const amb = { mills: [], motes: [] };
    // crop fields
    scatter(built, def, 21, 8, 80, (px, py, r) => {
      const w = 60 + r() * 50, h = 40 + r() * 30;
      x.save(); x.translate(px, py); x.rotate((r() - 0.5) * 0.2);
      rrect(x, -w / 2, -h / 2, w, h, 4); fillStroke(x, r() < 0.5 ? '#5a4a2a' : '#4a5a2a', OUT, 1);
      x.strokeStyle = 'rgba(160,210,110,0.5)'; x.lineWidth = 2;
      for (let i = -h / 2 + 5; i < h / 2; i += 6) { x.beginPath(); x.moveTo(-w / 2 + 4, i); x.lineTo(w / 2 - 4, i); x.stroke(); }
      x.restore();
    });
    // barns / relay huts
    scatter(built, def, 22, 4, 70, (px, py, r) => {
      rrect(x, px - 16, py - 12, 32, 24, 2); fillStroke(x, '#8a3a2a', OUT, 1.4);
      poly(x, [px - 18, py - 12, px, py - 22, px + 18, py - 12]); fillStroke(x, '#5a2a1a', OUT, 1.4);
      x.fillStyle = '#ffd27a'; x.fillRect(px - 4, py - 2, 8, 14);
      amb.mills.push({ x: px + 24, y: py - 18 });
      rrect(x, px + 22, py - 18, 4, 30, 1); fillStroke(x, '#6b6b6b', OUT, 1);
    });
    for (const b of def.blocked || []) { if (b.w) { rrect(x, b.x, b.y, b.w, b.h, 6); fillStroke(x, '#2b5a7a', OUT, 1.5); x.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 8; i++) x.fillRect(b.x + 10 + i * 22, b.y + 12 + (i % 2) * 20, 14, 2); } }
    scatter(built, def, 23, 26, 60, (px, py, r) => tree(x, px, py, 0.7 + r() * 0.4, ['#4a7a2a', '#6aa23a']));
    scatter(built, def, 24, 30, 45, (px, py, r) => { x.fillStyle = '#e8d27a'; rrect(x, px - 4, py - 3, 8, 6, 2); x.fill(); x.strokeStyle = OUT; x.lineWidth = 0.8; x.stroke(); });
    return amb;
  };
  DECOR.ice = function (x, def, built, th) {
    const amb = { snow: [], lights: [] };
    // cracks
    x.strokeStyle = 'rgba(80,120,150,0.35)'; x.lineWidth = 1;
    scatter(built, def, 31, 30, 30, (px, py, r) => { x.beginPath(); x.moveTo(px, py); let cx = px, cy = py; for (let i = 0; i < 4; i++) { cx += (r() - 0.5) * 40; cy += (r() - 0.5) * 40; x.lineTo(cx, cy); } x.stroke(); });
    // server racks on blocked
    for (const b of def.blocked || []) {
      if (!b.w) continue;
      rrect(x, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 4); fillStroke(x, '#5a6d80', OUT, 1.5);
      const cols = Math.max(1, Math.floor((b.w - 10) / 26)), rows = Math.max(1, Math.floor((b.h - 10) / 40));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const rx = b.x + 8 + i * ((b.w - 16) / cols), ry = b.y + 8 + j * ((b.h - 16) / rows);
        const rw = (b.w - 16) / cols - 4, rh = (b.h - 16) / rows - 4;
        rrect(x, rx, ry, rw, rh, 2); fillStroke(x, lin(x, rx, ry, rx, ry + rh, '#2e3a48', '#1a222c'), OUT, 1);
        x.fillStyle = 'rgba(220,245,255,0.55)'; x.fillRect(rx, ry, rw, 3);
        amb.lights.push({ x: rx + 4, y: ry + 8, p: Math.random() * 6 }, { x: rx + rw - 5, y: ry + rh - 6, p: Math.random() * 6 });
      }
    }
    // ice crystals
    scatter(built, def, 32, 24, 50, (px, py, r) => {
      const s = 6 + r() * 8;
      poly(x, [px, py - s * 1.6, px + s * 0.5, py, px, py + s * 0.4, px - s * 0.5, py]); fillStroke(x, lin(x, px, py - s, px, py, '#ffffff', '#8fd3f0'), '#2b4a60', 1);
      poly(x, [px + s * 0.6, py - s, px + s, py + 1, px + s * 0.4, py + 1]); fillStroke(x, '#cdefff', '#2b4a60', 1);
    });
    // pipes along the top
    x.strokeStyle = '#7890a5'; x.lineWidth = 7; x.beginPath(); x.moveTo(0, 690); x.lineTo(130, 690); x.lineTo(130, 660); x.stroke();
    x.strokeStyle = '#a9c0d4'; x.lineWidth = 2; x.stroke();
    for (let i = 0; i < 60; i++) amb.snow.push({ x: Math.random() * 1280, y: Math.random() * 720, s: 0.6 + Math.random() * 1.6, v: 12 + Math.random() * 20 });
    return amb;
  };
  DECOR.ruins = function (x, def, built, th) {
    const amb = { hazard: [], smoke: [] };
    // concrete slabs
    scatter(built, def, 41, 40, 34, (px, py, r) => { const w = 20 + r() * 40, h = 20 + r() * 40; x.save(); x.translate(px, py); x.rotate((r() - 0.5) * 0.5); rrect(x, -w / 2, -h / 2, w, h, 2); fillStroke(x, r() < 0.5 ? '#55535a' : '#4a484e', 'rgba(0,0,0,0.5)', 1); x.strokeStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.moveTo(-w / 2, 0); x.lineTo(w / 3, h / 4); x.stroke(); x.restore(); });
    // building blocks on blocked
    for (const b of def.blocked || []) {
      if (!b.w) continue;
      rrect(x, b.x, b.y, b.w, b.h, 3); fillStroke(x, lin(x, b.x, b.y, b.x + b.w, b.y + b.h, '#6a6570', '#34313a'), OUT, 1.6);
      for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(255,200,100,0.35)'; x.fillRect(b.x + 8 + i * (b.w - 16) / 3, b.y + 8, (b.w - 16) / 3 - 4, 6); }
      amb.hazard.push({ x: b.x + b.w / 2, y: b.y + b.h - 8, p: Math.random() * 6 });
    }
    // wrecked cars
    scatter(built, def, 42, 9, 54, (px, py, r) => { x.save(); x.translate(px, py); x.rotate(r() * 6); rrect(x, -12, -6, 24, 12, 3); fillStroke(x, r() < 0.5 ? '#6a3a2a' : '#3a4a5a', OUT, 1.2); x.fillStyle = 'rgba(20,20,20,0.7)'; x.fillRect(-5, -5, 10, 10); x.restore(); amb.smoke.push({ x: px, y: py, p: Math.random() * 6 }); });
    scatter(built, def, 43, 30, 40, (px, py, r) => rock(x, px, py, 3 + r() * 5, '#77737a'));
    scatter(built, def, 44, 10, 55, (px, py, r) => tree(x, px, py, 0.6 + r() * 0.3, ['#4a5a3a', '#5f6f45']));
    return amb;
  };
  DECOR.corrupt = function (x, def, built, th) {
    const amb = { pits: [], glitch: [] };
    // glowing cracks
    x.lineWidth = 1.6;
    scatter(built, def, 51, 30, 30, (px, py, r) => { x.strokeStyle = U.rgba(r() < 0.5 ? '#ff3dd6' : '#b04dff', 0.35); x.beginPath(); x.moveTo(px, py); let cx = px, cy = py; for (let i = 0; i < 5; i++) { cx += (r() - 0.5) * 50; cy += (r() - 0.5) * 50; x.lineTo(cx, cy); } x.stroke(); });
    // pits
    scatter(built, def, 52, 8, 60, (px, py, r) => { const s = 14 + r() * 12; x.beginPath(); x.ellipse(px, py, s, s * 0.6, 0, 0, Math.PI * 2); x.fillStyle = rad(x, s, '#ff3dd6', '#1a0620'); x.fill(); x.strokeStyle = OUT; x.lineWidth = 1.5; x.stroke(); amb.pits.push({ x: px, y: py, s }); });
    // glitch crystals
    scatter(built, def, 53, 26, 50, (px, py, r) => {
      const s = 8 + r() * 12;
      poly(x, [px - s * 0.4, py + s * 0.3, px - s * 0.1, py - s * 1.3, px + s * 0.25, py + s * 0.3]); fillStroke(x, lin(x, px, py - s, px, py, '#f3b6ff', '#5a1a7a'), OUT, 1.2);
      poly(x, [px + s * 0.1, py + s * 0.3, px + s * 0.5, py - s * 0.7, px + s * 0.7, py + s * 0.3]); fillStroke(x, lin(x, px, py - s, px, py, '#ff9ae8', '#4a0a5a'), OUT, 1.2);
    });
    scatter(built, def, 54, 12, 55, (px, py, r) => tree(x, px, py, 0.6 + r() * 0.3, ['#3a1a4a', '#5a2a6a']));
    for (let i = 0; i < 8; i++) amb.glitch.push({ x: Math.random() * 1200, y: Math.random() * 700, p: Math.random() * 10 });
    return amb;
  };
  DECOR.pcb = function (x, def, built, th) {
    const amb = { traces: [] };
    // gold traces
    const r = U.rng(61);
    for (let i = 0; i < 70; i++) {
      let px = Math.round(r() * 64) * 20, py = Math.round(r() * 36) * 20;
      const pts = [[px, py]];
      for (let k = 0; k < 4; k++) {
        if (r() < 0.5) px += (r() < 0.5 ? -1 : 1) * (20 + Math.round(r() * 4) * 20); else py += (r() < 0.5 ? -1 : 1) * (20 + Math.round(r() * 4) * 20);
        pts.push([px, py]);
      }
      let ok = true;
      for (const [qx, qy] of pts) if (!freeSpot(built, def, qx, qy, 36)) ok = false;
      if (!ok) continue;
      x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const [qx, qy] of pts) x.lineTo(qx, qy);
      x.strokeStyle = 'rgba(217,168,74,0.55)'; x.lineWidth = 2; x.stroke();
      for (const [qx, qy] of [pts[0], pts[pts.length - 1]]) { circle(x, qx, qy, 3); x.fillStyle = '#d9a84a'; x.fill(); circle(x, qx, qy, 1.2); x.fillStyle = '#0d2c21'; x.fill(); }
      amb.traces.push(pts);
    }
    // chips
    scatter(built, def, 62, 10, 60, (px, py, r) => {
      const w = 26 + r() * 20, h = 20 + r() * 16;
      for (let i = 0; i < w; i += 5) { x.fillStyle = '#c9c9c9'; x.fillRect(px - w / 2 + i + 1, py - h / 2 - 3, 2, 3); x.fillRect(px - w / 2 + i + 1, py + h / 2, 2, 3); }
      rrect(x, px - w / 2, py - h / 2, w, h, 2); fillStroke(x, lin(x, px, py - h, px, py + h, '#2a2d33', '#101114'), OUT, 1.2);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(px - w / 2 + 3, py - h / 2 + 3, 6, 2);
    });
    // capacitors
    scatter(built, def, 63, 22, 44, (px, py, r) => { circle(x, px, py, 5 + r() * 3); fillStroke(x, lin(x, px - 6, py, px + 6, py, '#8aa0b8', '#3a4a5a'), OUT, 1); circle(x, px, py, 2); x.fillStyle = '#c9d4e0'; x.fill(); });
    // central socket under core
    rrect(x, 640 - 70, 360 - 70, 140, 140, 10); fillStroke(x, 'rgba(10,20,15,0.8)', '#d9a84a', 2);
    return amb;
  };
  DECOR.desert = function (x, def, built, th) {
    const amb = { dust: [] };
    const r = U.rng(71);
    x.strokeStyle = 'rgba(255,240,200,0.25)'; x.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const px = r() * 1280, py = r() * 720; x.beginPath(); x.moveTo(px - 30, py); x.quadraticCurveTo(px, py - 10, px + 30, py); x.stroke(); }
    for (const b of def.blocked || []) { if (b.r) { for (let i = 0; i < 4; i++) rock(x, b.x + Math.cos(i * 1.7) * b.r * 0.45, b.y + Math.sin(i * 1.7) * b.r * 0.45, 14 + (i % 2) * 8, '#9a6a44'); } }
    scatter(built, def, 72, 14, 56, (px, py, r2) => { // cacti
      x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(px + 4, py + 10, 8, 4, 0, 0, 6.3); x.fill();
      rrect(x, px - 3, py - 14, 6, 26, 3); fillStroke(x, '#3f8a45', OUT, 1.2);
      rrect(x, px - 10, py - 6, 5, 11, 2.5); fillStroke(x, '#3f8a45', OUT, 1.1);
      rrect(x, px + 5, py - 10, 5, 10, 2.5); fillStroke(x, '#3f8a45', OUT, 1.1);
    });
    scatter(built, def, 73, 7, 60, (px, py) => { // solar panels
      for (let i = 0; i < 3; i++) { rrect(x, px - 22 + i * 15, py - 8, 13, 16, 1.5); fillStroke(x, lin(x, 0, py - 8, 0, py + 8, '#3a5a8a', '#1a2a4a'), OUT, 1); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(px - 20 + i * 15, py - 6, 9, 2); }
    });
    scatter(built, def, 74, 26, 40, (px, py, r2) => rock(x, px, py, 3 + r2() * 6, '#a07850'));
    for (let i = 0; i < 26; i++) amb.dust.push({ x: Math.random() * 1280, y: Math.random() * 720, v: 30 + Math.random() * 40, s: 1 + Math.random() * 2 });
    return amb;
  };

  function drawSpawnGates(x, built, th) {
    for (const s of built.spawns) {
      const px = U.clamp(s.x, 14, CS.WORLD_W - 14), py = U.clamp(s.y, 14, CS.WORLD_H - 14);
      x.save(); x.translate(px, py); x.rotate(s.a);
      rrect(x, -10, -CS.PATH_W / 2 - 10, 20, CS.PATH_W + 20, 4); fillStroke(x, '#1a1f28', OUT, 1.5);
      x.fillStyle = '#ff4d6d'; x.fillRect(-3, -CS.PATH_W / 2 - 6, 6, 5); x.fillRect(-3, CS.PATH_W / 2 + 1, 6, 5);
      x.restore();
    }
  }

  function drawRestricted(x, def, th) {
    void th;
  }

  // Paint whole map into ctx (already scaled to world units). Returns ambient data.
  MA.paint = function (x, def, built) {
    const th = CS.THEMES[def.theme];
    x.save();
    groundTexture(x, th, CS.U.hashStr(def.id));
    let amb = {};
    const deco = DECOR[th.decor];
    // decorations under path first where appropriate
    if (deco) amb = deco(x, def, built, th) || {};
    drawRestricted(x, def, th);
    // corruption zone markers (static rune circles)
    if (def.corruption) {
      for (const z of def.corruption) {
        circle(x, z.x, z.y, z.r); x.setLineDash([6, 8]); x.strokeStyle = 'rgba(255,61,214,0.28)'; x.lineWidth = 2; x.stroke(); x.setLineDash([]);
      }
    }
    drawPath(x, built, th);
    // tunnels: floor markings
    for (const tn of built.tunnels) {
      const p = built.paths[tn.path];
      x.beginPath();
      for (let d = tn.from; d <= tn.to; d += 4) { const k = Math.min(p.n - 1, Math.floor(d / 2)); d === tn.from ? x.moveTo(p.xs[k], p.ys[k]) : x.lineTo(p.xs[k], p.ys[k]); }
      x.strokeStyle = 'rgba(143,232,255,0.25)'; x.lineWidth = CS.PATH_W - 6; x.stroke();
    }
    drawSpawnGates(x, built, th);
    // vignette
    const g = x.createRadialGradient(640, 360, 300, 640, 360, 820);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = g; x.fillRect(0, 0, CS.WORLD_W, CS.WORLD_H);
    x.restore();
    return amb;
  };

  // Tunnel roofs drawn above enemies
  MA.paintOverlay = function (x, def, built) {
    if (!built.tunnels.length) return false;
    for (const tn of built.tunnels) {
      const p = built.paths[tn.path];
      const pts = [];
      for (let d = tn.from; d <= tn.to; d += 4) { const k = Math.min(p.n - 1, Math.floor(d / 2)); pts.push([p.xs[k], p.ys[k], p.angs[k]]); }
      x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      x.strokeStyle = 'rgba(20,30,45,0.95)'; x.lineWidth = CS.PATH_W + 16; x.stroke();
      x.strokeStyle = '#5f7a93'; x.lineWidth = CS.PATH_W + 10; x.stroke();
      x.strokeStyle = '#8fb3cf'; x.lineWidth = CS.PATH_W - 4; x.stroke();
      // ribs
      for (let i = 0; i < pts.length; i += 5) {
        const [px, py, a] = pts[i];
        const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
        x.beginPath(); x.moveTo(px - nx * (CS.PATH_W / 2 + 5), py - ny * (CS.PATH_W / 2 + 5)); x.lineTo(px + nx * (CS.PATH_W / 2 + 5), py + ny * (CS.PATH_W / 2 + 5));
        x.strokeStyle = '#3d5368'; x.lineWidth = 3; x.stroke();
      }
      // frost
      x.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 2; i < pts.length; i += 7) { const [px, py] = pts[i]; x.fillRect(px - 3, py - 3, 6, 2); }
    }
    return true;
  };

  // Render a small preview image (for map cards)
  MA.thumbnail = function (def, w, h) {
    const built = CS.buildMap(def, false);
    const c = CS.Spr.mk(w, h);
    const x = c.getContext('2d');
    x.scale(w / CS.WORLD_W, h / CS.WORLD_H);
    MA.paint(x, def, built);
    MA.paintOverlay(x, def, built);
    // core
    for (const co of built.cores) {
      circle(x, co.x, co.y, 26); x.fillStyle = '#39d0ff'; x.fill(); x.strokeStyle = OUT; x.lineWidth = 4; x.stroke();
    }
    return c;
  };

  CS.MapArt = MA;
})();
