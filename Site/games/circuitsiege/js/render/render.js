/* CIRCUIT SIEGE — battlefield renderer */
(function () {
  'use strict';
  const CS = window.CS;
  const U = CS.U;
  const Spr = CS.Spr;
  const TAU = Math.PI * 2;
  const tmp = { x: 0, y: 0, a: 0 };

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.k = 1;
      this.bg = null; this.overlay = null; this.amb = {};
      this.match = null;
      this.quality = 'high';
      this.coreSkin = CS.PROG.CORE_SKINS.standard;
      this.skinFor = () => 'default';
    }

    setQuality(q) { this.quality = q; Spr.setShadows((CS.QUALITY[q] || CS.QUALITY.high).shadows); }
    get Q() { return CS.QUALITY[this.quality] || CS.QUALITY.high; }

    resize(cssW, cssH, dprCap) {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap || 2);
      const s = Math.min(cssW / CS.WORLD_W, cssH / CS.WORLD_H);
      const w = Math.floor(CS.WORLD_W * s), h = Math.floor(CS.WORLD_H * s);
      this.cv.style.width = w + 'px';
      this.cv.style.height = h + 'px';
      this.cv.width = Math.floor(w * dpr);
      this.cv.height = Math.floor(h * dpr);
      this.cssScale = s;
      this.k = this.cv.width / CS.WORLD_W;
      Spr.setScale(this.k);
      if (this.match) this.paintBackground();
    }

    setMatch(m) {
      this.match = m;
      this.paintBackground();
      // path chevrons
      this.chev = [];
      for (const p of m.map.paths) this.chev.push({ p, n: Math.floor(p.len / 70) });
    }

    paintBackground() {
      const m = this.match;
      const c = Spr.mk(this.cv.width, this.cv.height);
      const x = c.getContext('2d');
      x.scale(this.k, this.k);
      x.lineJoin = 'round'; x.lineCap = 'round';
      this.amb = CS.MapArt.paint(x, m.def, m.map) || {};
      this.bg = c;
      const o = Spr.mk(this.cv.width, this.cv.height);
      const ox = o.getContext('2d');
      ox.scale(this.k, this.k);
      ox.lineJoin = 'round'; ox.lineCap = 'round';
      this.overlay = CS.MapArt.paintOverlay(ox, m.def, m.map) ? o : null;
      // Placement mask: everything a tower cannot be built on
      const pm = Spr.mk(this.cv.width, this.cv.height);
      const px = pm.getContext('2d');
      px.scale(this.k, this.k);
      px.lineJoin = 'round'; px.lineCap = 'round';
      px.strokeStyle = '#ff3355'; px.fillStyle = '#ff3355';
      const tr = 17;
      for (const p of m.map.paths) {
        px.beginPath(); px.moveTo(p.pts[0][0], p.pts[0][1]);
        for (let i = 1; i < p.pts.length; i++) px.lineTo(p.pts[i][0], p.pts[i][1]);
        px.lineWidth = CS.PATH_W + tr * 2 - 8; px.stroke();
      }
      for (const b of m.def.blocked || []) {
        if (b.r !== undefined) { px.beginPath(); px.arc(b.x, b.y, b.r + tr - 4, 0, Math.PI * 2); px.fill(); }
        else { px.beginPath(); px.roundRect ? px.roundRect(b.x - tr + 4, b.y - tr + 4, b.w + tr * 2 - 8, b.h + tr * 2 - 8, tr) : px.rect(b.x - tr + 4, b.y - tr + 4, b.w + tr * 2 - 8, b.h + tr * 2 - 8); px.fill(); }
      }
      for (const c of m.map.cores) { px.beginPath(); px.arc(c.x, c.y, tr + 34, 0, Math.PI * 2); px.fill(); }
      this.placeMask = pm;
    }

    toWorld(clientX, clientY) {
      const r = this.cv.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * CS.WORLD_W, y: ((clientY - r.top) / r.height) * CS.WORLD_H };
    }

    // ───────────────────────── frame
    render(ui, t) {
      const m = this.match;
      if (!m) return;
      const x = this.ctx;
      const Q = this.Q;
      let sx = 0, sy = 0;
      if (m.fx.shakeAmt > 0) {
        sx = (Math.random() - 0.5) * m.fx.shakeAmt * 2; sy = (Math.random() - 0.5) * m.fx.shakeAmt * 2;
        x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#05070a'; x.fillRect(0, 0, this.cv.width, this.cv.height);
      }
      x.setTransform(this.k, 0, 0, this.k, sx * this.k, sy * this.k);
      x.drawImage(this.bg, 0, 0, CS.WORLD_W, CS.WORLD_H);
      x.lineJoin = 'round'; x.lineCap = 'round';

      this.drawAmbient(x, t, Q);
      if (Q.decor) this.drawChevrons(x, t);
      this.drawMapZones(x, t);
      this.drawGroundZones(x, t);
      this.drawAuras(x, t, ui);
      this.drawCores(x, t);
      this.drawTowerBases(x, t, ui);
      this.drawZombies(x);
      this.drawEnemies(x, t, ui);
      if (this.overlay) { x.save(); x.setTransform(1, 0, 0, 1, sx * this.k, sy * this.k); x.globalAlpha = 0.72; x.drawImage(this.overlay, 0, 0); x.restore(); }
      this.drawTowerHeads(x, t, ui);
      this.drawProjectiles(x, Q);
      this.drawFx(x, Q);
      this.drawDarkness(x, t);
      this.drawOverlays(x, t, ui);
      this.drawPlacement(x, t, ui);
      this.drawTexts(x);
    }

    drawAmbient(x, t, Q) {
      const a = this.amb;
      if (!Q.decor) return;
      if (a.water) for (const w of a.water) {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.4 + i / 3) % 1;
          x.strokeStyle = U.rgba('#bfe9ff', 0.35 * (1 - ph)); x.lineWidth = 1.2;
          x.beginPath(); x.ellipse(w.x, w.y, w.r * ph, w.r * ph * 0.6, 0, 0, TAU); x.stroke();
        }
      }
      if (a.motes) for (const m of a.motes) {
        if (m.kind === 'light') { const on = Math.sin(t * 3 + m.x) > 0; x.fillStyle = on ? m.c : '#15303a'; x.fillRect(m.x - 1.5, m.y - 1.5, 3, 3); }
        else { const px = m.x + Math.sin(t * 0.5 + m.p) * 20, py = m.y + Math.cos(t * 0.37 + m.p) * 14; x.fillStyle = U.rgba(m.c, 0.35 + 0.35 * Math.sin(t * 2 + m.p)); x.fillRect(px, py, 2, 2); }
      }
      if (a.mills) for (const mi of a.mills) {
        x.save(); x.translate(mi.x, mi.y); x.rotate(t * 1.5);
        x.strokeStyle = '#e8e8e8'; x.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) { x.rotate(TAU / 4); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 13); x.stroke(); }
        x.restore();
      }
      if (a.snow) { x.fillStyle = 'rgba(255,255,255,0.8)'; for (const s of a.snow) { const py = (s.y + t * s.v) % 730, px = s.x + Math.sin(t + s.y) * 8; x.fillRect(px, py, s.s, s.s); } }
      if (a.lights) for (const l of a.lights) { const on = Math.sin(t * 4 + l.p * 3) > 0.2; x.fillStyle = on ? '#6dffb0' : '#1a3a2a'; x.fillRect(l.x, l.y, 2.5, 2.5); }
      if (a.hazard) for (const h of a.hazard) { const on = Math.sin(t * 5 + h.p) > 0; x.fillStyle = on ? '#ffb547' : '#4a3a20'; x.beginPath(); x.arc(h.x, h.y, 2.5, 0, TAU); x.fill(); }
      if (a.smoke) for (const s of a.smoke) { for (let i = 0; i < 2; i++) { const ph = (t * 0.25 + s.p + i * 0.5) % 1; x.fillStyle = `rgba(90,90,95,${0.25 * (1 - ph)})`; x.beginPath(); x.arc(s.x + ph * 10, s.y - ph * 40, 4 + ph * 10, 0, TAU); x.fill(); } }
      if (a.pits) for (const p of a.pits) { for (let i = 0; i < 2; i++) { const ph = (t * 0.6 + p.x * 0.01 + i * 0.5) % 1; x.fillStyle = `rgba(255,61,214,${0.5 * (1 - ph)})`; x.beginPath(); x.arc(p.x + Math.sin(ph * 6 + i) * p.s * 0.4, p.y - ph * 22, 2 + ph * 3, 0, TAU); x.fill(); } }
      if (a.glitch) for (const g of a.glitch) { if (Math.sin(t * 7 + g.p * 5) > 0.93) { x.fillStyle = 'rgba(255,61,214,0.35)'; x.fillRect(g.x, g.y, 40 + g.p * 5, 4); x.fillStyle = 'rgba(61,230,255,0.3)'; x.fillRect(g.x + 6, g.y + 5, 30, 3); } }
      if (a.traces) {
        for (let i = 0; i < a.traces.length; i += 2) {
          const tr = a.traces[i];
          const ph = (t * 0.35 + i * 0.137) % 1;
          const seg = Math.floor(ph * (tr.length - 1)), f = ph * (tr.length - 1) - seg;
          const p0 = tr[seg], p1 = tr[seg + 1];
          const px = p0[0] + (p1[0] - p0[0]) * f, py = p0[1] + (p1[1] - p0[1]) * f;
          x.fillStyle = '#ffe9a0'; x.fillRect(px - 1.5, py - 1.5, 3, 3);
        }
      }
      if (a.dust) { x.fillStyle = 'rgba(255,240,210,0.45)'; for (const d of a.dust) { const px = (d.x + t * d.v) % 1300 - 10; x.fillRect(px, d.y + Math.sin(t + d.x) * 6, d.s * 2, d.s * 0.7); } }
    }

    drawChevrons(x, t) {
      const th = CS.THEMES[this.match.def.theme];
      x.strokeStyle = U.rgba(th.pathLine, 0.22); x.lineWidth = 2;
      x.beginPath();
      for (const c of this.chev) {
        const p = c.p;
        const off = (t * 26) % 70;
        for (let i = 0; i < c.n; i++) {
          const d = i * 70 + off;
          if (d > p.len - 40) continue;
          CS.pathPos(p, d, tmp);
          const ca = Math.cos(tmp.a), sa = Math.sin(tmp.a);
          const nx = -sa, ny = ca;
          x.moveTo(tmp.x - ca * 4 + nx * 6, tmp.y - sa * 4 + ny * 6);
          x.lineTo(tmp.x + ca * 3, tmp.y + sa * 3);
          x.lineTo(tmp.x - ca * 4 - nx * 6, tmp.y - sa * 4 - ny * 6);
        }
      }
      x.stroke();
    }

    drawMapZones(x, t) {
      const m = this.match;
      if (m.corrupt) {
        const c = m.corrupt;
        const zs = m.def.corruption;
        if (c.warn >= 0) {
          const z = zs[c.warn];
          const pulse = 0.5 + 0.5 * Math.sin(t * 12);
          x.fillStyle = `rgba(255,120,60,${0.1 + 0.12 * pulse})`; x.beginPath(); x.arc(z.x, z.y, z.r, 0, TAU); x.fill();
          x.setLineDash([8, 6]); x.strokeStyle = `rgba(255,170,80,${0.6 + 0.4 * pulse})`; x.lineWidth = 3; x.stroke(); x.setLineDash([]);
          this.warnIcon(x, z.x, z.y, t);
        }
        if (c.active >= 0) this.drawCorruptBlob(x, zs[c.active], t);
      }
    }

    warnIcon(x, px, py, t) {
      x.save(); x.translate(px, py); x.scale(1 + 0.1 * Math.sin(t * 10), 1 + 0.1 * Math.sin(t * 10));
      x.beginPath(); x.moveTo(0, -14); x.lineTo(13, 10); x.lineTo(-13, 10); x.closePath();
      x.fillStyle = '#ffb547'; x.fill(); x.strokeStyle = '#1a0e05'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#1a0e05'; x.font = 'bold 14px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 0, 3);
      x.restore();
    }

    drawCorruptBlob(x, z, t) {
      x.save();
      x.beginPath();
      const n = 28;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const rr = z.r * (0.92 + 0.08 * Math.sin(a * 5 + t * 4) + (Math.sin(t * 13 + i) > 0.9 ? 0.06 : 0));
        i ? x.lineTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr) : x.moveTo(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr);
      }
      x.closePath();
      x.fillStyle = 'rgba(80,0,70,0.45)'; x.fill();
      x.strokeStyle = 'rgba(255,61,214,0.9)'; x.lineWidth = 2.5; x.stroke();
      x.clip();
      for (let i = 0; i < 6; i++) {
        const yy = z.y - z.r + ((t * 60 + i * 30) % (z.r * 2));
        x.fillStyle = i % 2 ? 'rgba(255,61,214,0.25)' : 'rgba(61,230,255,0.18)';
        x.fillRect(z.x - z.r, yy, z.r * 2, 3);
      }
      x.restore();
    }

    drawGroundZones(x, t) {
      const m = this.match;
      for (const z of m.zones) {
        const life = 1 - z.t / z.dur;
        if (z.kind === 'cloud') {
          x.fillStyle = `rgba(125,255,106,${0.16 * Math.min(1, life * 3)})`;
          for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(z.x + Math.sin(t * 2 + i * 2) * 10, z.y + Math.cos(t * 1.7 + i * 2) * 8, z.r * (0.6 + i * 0.15), 0, TAU); x.fill(); }
        } else if (z.kind === 'field') {
          x.fillStyle = `rgba(224,163,255,${0.18 * life})`; x.beginPath(); x.arc(z.x, z.y, z.r, 0, TAU); x.fill();
          x.strokeStyle = `rgba(243,220,255,${0.6 * life})`; x.lineWidth = 1.5;
          x.beginPath(); x.arc(z.x, z.y, z.r * (0.5 + 0.5 * ((t * 2) % 1)), 0, TAU); x.stroke();
        } else if (z.kind === 'trail') {
          x.strokeStyle = `rgba(102,240,255,${0.35 * life})`; x.lineWidth = 10 * life + 2;
          x.beginPath(); x.moveTo(z.x, z.y); x.lineTo(z.x2, z.y2); x.stroke();
        } else if (z.kind === 'corrupt') {
          this.drawCorruptBlob(x, z, t);
        } else if (z.kind === 'hole') {
          x.fillStyle = 'rgba(10,0,20,0.75)'; x.beginPath(); x.arc(z.x, z.y, z.r * 0.5 * Math.min(1, z.t * 4), 0, TAU); x.fill();
          x.strokeStyle = '#e0a3ff'; x.lineWidth = 3;
          for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(z.x, z.y, z.r * ((t * 1.5 + i / 3) % 1), 0, TAU); x.stroke(); }
        } else if (z.kind === 'orbital') {
          const k = Math.min(1, z.t / 0.75);
          x.strokeStyle = `rgba(255,106,61,${0.8})`; x.lineWidth = 2;
          x.beginPath(); x.arc(z.x, z.y, z.r * (1.4 - k * 0.4), 0, TAU); x.stroke();
          x.beginPath(); x.arc(z.x, z.y, 10, 0, TAU); x.stroke();
          if (!z.fired) {
            x.fillStyle = `rgba(255,200,140,${0.15 + k * 0.3})`; x.fillRect(z.x - 6 * k, 0, 12 * k, z.y);
          } else {
            const f = 1 - (z.t - 0.75) / 0.15;
            if (f > 0) { x.fillStyle = `rgba(255,240,200,${f})`; x.fillRect(z.x - 30, 0, 60, z.y); }
          }
        }
      }
    }

    drawAuras(x, t, ui) {
      const m = this.match;
      for (const tw of m.towers) {
        if (tw.def.kind !== 'aura') continue;
        const s = tw.s;
        const r = tw.rangeNow || s.range;
        const [A, B, C] = tw.tiers;
        let col = tw.type === 'gravity' ? '#c77dff' : B > A && B >= C ? '#8fe8ff' : C > A && C > B ? '#b7ffcf' : '#ff8a3d';
        const alpha = tw.offline ? 0.04 : 0.1;
        x.fillStyle = U.rgba(col, alpha);
        x.beginPath(); x.arc(tw.x, tw.y, r, 0, TAU); x.fill();
        x.strokeStyle = U.rgba(col, tw.offline ? 0.15 : 0.45); x.lineWidth = 1.5;
        x.setLineDash([6, 6]); x.lineDashOffset = -t * 20; x.stroke(); x.setLineDash([]);
        if (!tw.offline && this.Q.decor) {
          if (tw.type === 'gravity') {
            x.strokeStyle = U.rgba(col, 0.35); x.lineWidth = 2;
            for (let i = 0; i < 3; i++) { const ph = (1 - ((t * 0.5 + i / 3) % 1)); x.beginPath(); x.arc(tw.x, tw.y, r * ph, t * 2 + i, t * 2 + i + 2.2); x.stroke(); }
          } else {
            const ph = (t * 0.6) % 1;
            x.strokeStyle = U.rgba(col, 0.35 * (1 - ph)); x.lineWidth = 2;
            x.beginPath(); x.arc(tw.x, tw.y, r * ph, 0, TAU); x.stroke();
          }
        }
      }
    }

    drawCores(x, t) {
      const m = this.match;
      const sk = this.coreSkin;
      const frac = m.coreHp / m.coreMax;
      for (const c of m.map.cores) {
        const danger = frac < 0.3;
        x.save(); x.translate(c.x, c.y);
        // base
        x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.arc(3, 5, 34, 0, TAU); x.fill();
        CS.Spr.h.ngon(x, 8, 32, Math.PI / 8); x.fillStyle = '#1a1f28'; x.fill(); x.strokeStyle = '#0b0e14'; x.lineWidth = 2.5; x.stroke();
        CS.Spr.h.ngon(x, 8, 27, Math.PI / 8); x.strokeStyle = U.rgba(sk.c1, 0.7); x.lineWidth = 1.5; x.stroke();
        // rotating rings
        x.rotate(t * 0.8);
        x.strokeStyle = sk.c1; x.lineWidth = 3;
        for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(0, 0, 21, i * 2.1, i * 2.1 + 1.3); x.stroke(); }
        x.rotate(-t * 2);
        x.strokeStyle = U.rgba(sk.c2, 0.8); x.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(0, 0, 15, i * 1.57, i * 1.57 + 0.9); x.stroke(); }
        x.restore();
        // glow core
        const pulse = 0.85 + 0.15 * Math.sin(t * (danger ? 10 : 3));
        const g = x.createRadialGradient(c.x, c.y, 0, c.x, c.y, 11 * pulse);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, danger ? '#ff4d6d' : sk.c2); g.addColorStop(1, danger ? '#ff4d6d' : sk.c1);
        x.fillStyle = g; x.beginPath(); x.arc(c.x, c.y, 10 * pulse, 0, TAU); x.fill();
        if (this.Q.glow) {
          x.globalCompositeOperation = 'lighter';
          Spr.draw(x, Spr.glow(danger ? '#ff4d6d' : sk.c1), c.x, c.y, 0, 1.6 * pulse);
          x.globalCompositeOperation = 'source-over';
        }
        if (frac < 0.6) {
          x.strokeStyle = 'rgba(20,0,0,0.7)'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(c.x - 20, c.y - 8); x.lineTo(c.x - 8, c.y - 2); x.lineTo(c.x - 12, c.y + 10); x.stroke();
          if (frac < 0.3) { x.beginPath(); x.moveTo(c.x + 18, c.y + 12); x.lineTo(c.x + 6, c.y + 4); x.lineTo(c.x + 10, c.y - 12); x.stroke(); }
        }
      }
      // spawn portals
      for (const s of m.map.spawns) {
        const px = U.clamp(s.x, 6, CS.WORLD_W - 6), py = U.clamp(s.y, 6, CS.WORLD_H - 6);
        const pulse = 0.6 + 0.4 * Math.sin(t * 4);
        x.fillStyle = `rgba(255,77,109,${0.18 * pulse})`;
        x.beginPath(); x.arc(px, py, 28, 0, TAU); x.fill();
      }
    }

    drawTowerBases(x, t, ui) {
      const m = this.match;
      const Q = this.Q;
      for (const tw of m.towers) {
        const skin = this.skinFor(tw.type);
        const sc = tw.placeT < 0.25 ? 0.7 + 0.3 * (tw.placeT / 0.25) + Math.sin(tw.placeT / 0.25 * Math.PI) * 0.15 : 1;
        const maxT = Math.max(tw.tiers[0], tw.tiers[1], tw.tiers[2]);
        if (maxT >= 5 && Q.glow) {
          x.globalCompositeOperation = 'lighter';
          x.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + tw.id);
          Spr.draw(x, Spr.glow(tw.def.color), tw.x, tw.y, 0, CS.Save && CS.Save.masteryBonus(tw.type).glow ? 2.1 : 1.6);
          x.globalAlpha = 1;
          x.globalCompositeOperation = 'source-over';
        }
        Spr.draw(x, Spr.towerBase(tw.type, tw.tiers, skin), tw.x, tw.y, 0, sc);
        if (maxT >= 5 && !tw.offline) {
          const col = tw.def.color;
          x.strokeStyle = U.rgba(col, 0.55); x.lineWidth = 1.5;
          const rr = tw.def.r + 7;
          for (let i = 0; i < 3; i++) { const a0 = t * 1.4 + i * 2.094 + tw.id; x.beginPath(); x.arc(tw.x, tw.y, rr, a0, a0 + 0.9); x.stroke(); }
        } else if (maxT === 4 && !tw.offline && Q.decor) {
          x.strokeStyle = U.rgba(tw.def.color, 0.3); x.lineWidth = 1;
          x.beginPath(); x.arc(tw.x, tw.y, tw.def.r + 5, t * 0.8 + tw.id, t * 0.8 + tw.id + 1.6); x.stroke();
        }
        // animated bits for static towers
        if (!tw.offline) {
          if (tw.type === 'arc' && Q.glow) {
            x.globalCompositeOperation = 'lighter';
            x.globalAlpha = 0.5 + 0.5 * Math.random();
            Spr.draw(x, Spr.glow('#8ab4ff'), tw.x, tw.y, 0, 0.5 + tw.tiers[0] * 0.06);
            x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
          } else if (tw.type === 'amp') {
            x.strokeStyle = U.rgba('#ff5ad1', 0.7); x.lineWidth = 1.5;
            for (let i = 0; i < 2; i++) { x.beginPath(); x.arc(tw.x, tw.y, 14 + i * 4, t * (i ? -2 : 2), t * (i ? -2 : 2) + 2); x.stroke(); }
            const ph = (t * 0.5 + tw.id * 0.1) % 1;
            x.strokeStyle = U.rgba('#ff5ad1', 0.25 * (1 - ph)); x.beginPath(); x.arc(tw.x, tw.y, tw.s.range * ph, 0, TAU); x.stroke();
          } else if (tw.type === 'gravity') {
            x.strokeStyle = 'rgba(199,125,255,0.8)'; x.lineWidth = 1.2;
            x.beginPath(); x.ellipse(tw.x, tw.y, 15, 6, t * 1.5, 0, TAU); x.stroke();
            x.beginPath(); x.ellipse(tw.x, tw.y, 15, 6, -t * 1.1 + 1, 0, TAU); x.stroke();
          } else if (tw.type === 'firewall' && Q.glow) {
            x.globalCompositeOperation = 'lighter';
            x.globalAlpha = 0.4 + 0.2 * Math.sin(t * 6 + tw.id);
            const [A, B, C] = tw.tiers;
            Spr.draw(x, Spr.glow(B > A && B >= C ? '#8fe8ff' : C > A && C > B ? '#b7ffcf' : '#ff8a3d'), tw.x, tw.y, 0, 0.7);
            x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
          } else if (tw.type === 'farm' && tw.farmPay > 0) {
            x.fillStyle = '#ffd84d'; x.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8);
            x.beginPath(); x.arc(tw.x, tw.y - 22, 3, 0, TAU); x.fill(); x.globalAlpha = 1;
          }
        }
        if (ui.selectedTower === tw) {
          x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 2;
          x.setLineDash([4, 4]); x.lineDashOffset = -t * 10;
          x.beginPath(); x.arc(tw.x, tw.y, tw.def.r + 6, 0, TAU); x.stroke(); x.setLineDash([]);
        }
      }
    }

    drawTowerHeads(x, t, ui) {
      const m = this.match;
      for (const tw of m.towers) {
        if (Spr.hasHead(tw.type)) {
          const skin = this.skinFor(tw.type);
          const spr = Spr.towerHead(tw.type, tw.tiers, skin);
          const back = tw.recoil * 3;
          const maxT = Math.max(tw.tiers[0], tw.tiers[1], tw.tiers[2]);
          let sc = (tw.placeT < 0.25 ? 0.7 + 0.3 * (tw.placeT / 0.25) : 1) * (1 + Math.max(0, maxT - 2) * 0.06);
          if (tw.offline) sc *= 0.94;
          Spr.draw(x, spr, tw.x - Math.cos(tw.angle) * back, tw.y - Math.sin(tw.angle) * back, tw.angle + (tw.offline ? Math.sin(t * 20 + tw.id) * 0.05 : 0), sc);
          if (tw.type === 'pulse' && tw.tiers[1] >= 5 && !tw.offline) {
            x.strokeStyle = 'rgba(143,240,255,0.6)'; x.lineWidth = 1.5;
            x.beginPath(); x.arc(tw.x + Math.cos(tw.angle) * 10, tw.y + Math.sin(tw.angle) * 10, 5, t * 20, t * 20 + 3); x.stroke();
          }
          if (tw.type === 'quantum' && !tw.offline) {
            const ch = 1 - Math.min(1, tw.cd * tw.s.rate);
            x.fillStyle = `rgba(224,163,255,${0.3 + ch * 0.6})`;
            x.beginPath(); x.arc(tw.x, tw.y, 3 + ch * 4, 0, TAU); x.fill();
          }
        }
        if (tw.type === 'drone') {
          for (const d of tw.drones) Spr.draw(x, Spr.drone(d.gun), d.x, d.y, d.a);
        }
        if (tw.offline) {
          x.fillStyle = 'rgba(10,10,20,0.55)';
          x.beginPath(); x.arc(tw.x, tw.y, tw.def.r + 2, 0, TAU); x.fill();
          x.strokeStyle = '#ff4d6d'; x.lineWidth = 2.5;
          x.beginPath(); x.moveTo(tw.x - 6, tw.y - 6); x.lineTo(tw.x + 6, tw.y + 6); x.moveTo(tw.x + 6, tw.y - 6); x.lineTo(tw.x - 6, tw.y + 6); x.stroke();
          if (Math.random() < 0.1) m.fx.spark(tw.x + (Math.random() - 0.5) * 20, tw.y + (Math.random() - 0.5) * 20, '#8ab4ff', 1, 40, 0.2, 1.5);
        } else if (tw.dark) {
          x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(tw.x, tw.y, tw.def.r + 2, 0, TAU); x.fill();
        }
      }
      // range of selected
      const st = ui.selectedTower;
      if (st && m.towers.includes(st)) {
        const r = st.rangeNow || st.s.range;
        x.fillStyle = 'rgba(255,255,255,0.06)'; x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 1.5;
        x.beginPath(); x.arc(st.x, st.y, r, 0, TAU); x.fill(); x.stroke();
      }
      if (ui.hoverTower && ui.hoverTower !== st && !ui.placing) {
        const h = ui.hoverTower;
        x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 1;
        x.beginPath(); x.arc(h.x, h.y, h.rangeNow || h.s.range, 0, TAU); x.stroke();
      }
    }

    drawZombies(x) {
      for (const z of this.match.zombies) Spr.draw(x, Spr.enemy('zombie'), z.x, z.y, z.a);
    }

    drawEnemies(x, t, ui) {
      const m = this.match;
      const E = m.enemies;
      const showBars = true;
      // body pass
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (!e.alive || e.dist < 0) continue;
        const ca = Math.cos(e.ang), sa = Math.sin(e.ang);
        let px = e.x - ca * e.kick * 2, py = e.y - sa * e.kick * 2;
        if (!e.boss) py += Math.sin(e.age * 9 + e.wobble) * 0.8;
        let alpha = 1;
        const hidden = e.stealth && !(e.revealT > 0 || e.permaReveal || e.revealAura);
        if (e.def.stealth) alpha = hidden ? 0.42 + 0.1 * Math.sin(t * 5 + e.wobble) : 0.9;
        if (e.phased) alpha = 0.25 + 0.15 * Math.sin(t * 30);
        if (e.burrowT > 0) alpha = 0.3;
        if (e.inTunnel) alpha *= 0.85;
        x.globalAlpha = alpha;
        // boss auras under body
        if (e.boss) this.bossUnder(x, e, px, py, t);
        if (e.elite) {
          const ec = CS.ELITES[e.elite].color;
          x.strokeStyle = ec; x.lineWidth = 2;
          x.setLineDash([4, 3]); x.lineDashOffset = t * 12;
          x.beginPath(); x.arc(px, py, e.r + 5, 0, TAU); x.stroke(); x.setLineDash([]);
          if (e.elite === 'commander') { x.strokeStyle = U.rgba(ec, 0.2); x.beginPath(); x.arc(px, py, 110, 0, TAU); x.stroke(); }
        }
        const spr = Spr.enemy(e.type, e.hitT > 0);
        let rot = Spr.ROTATING[e.type] ? e.ang : 0;
        if (e.type === 'overclocker') rot = t * 4;
        if (e.type === 'wormseg') rot = e.ang;
        Spr.draw(x, spr, px, py, rot, e.hitT > 0 ? 1.06 : 1);
        if (e.stunT > 0 && !e.boss) {
          x.fillStyle = 'rgba(190,240,255,0.45)'; x.beginPath(); x.arc(px, py, e.r + 2, 0, TAU); x.fill();
        }
        if (e.shield > 0) {
          const f = e.shield / e.shieldMax;
          x.fillStyle = `rgba(110,180,255,${0.12 + 0.12 * f})`;
          x.strokeStyle = `rgba(160,210,255,${0.4 + 0.5 * f})`; x.lineWidth = 1.5 + f;
          x.beginPath(); x.arc(px, py, e.r + 5, 0, TAU); x.fill(); x.stroke();
        }
        if (e.markT > 0) {
          x.strokeStyle = '#ff4d6d'; x.lineWidth = 2;
          const rr = e.r + 10;
          x.beginPath(); x.moveTo(px - rr, py); x.lineTo(px - rr + 6, py); x.moveTo(px + rr, py); x.lineTo(px + rr - 6, py); x.moveTo(px, py - rr); x.lineTo(px, py - rr + 6); x.moveTo(px, py + rr); x.lineTo(px, py + rr - 6); x.stroke();
          x.beginPath(); x.arc(px, py, rr - 3, 0, TAU); x.stroke();
        }
        if (e.boss) this.bossOver(x, e, px, py, t);
        x.globalAlpha = 1;
        if (ui.selectedEnemy === e) {
          x.strokeStyle = '#ffffff'; x.lineWidth = 1.5; x.setLineDash([3, 3]);
          x.beginPath(); x.arc(px, py, e.r + 9, 0, TAU); x.stroke(); x.setLineDash([]);
        }
        e.rx = px; e.ry = py;
      }
      // bars & status pass
      if (!showBars) return;
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (!e.alive || e.dist < 0 || e.boss) continue;
        const damaged = e.hp < e.maxHp;
        const px = e.rx, py = e.ry - e.r - 7;
        if (damaged || e.shieldMax) {
          const w = Math.max(16, e.r * 2);
          x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(px - w / 2 - 1, py - 1, w + 2, 4);
          const f = Math.max(0, e.hp / e.maxHp);
          x.fillStyle = f > 0.5 ? '#6dff8a' : f > 0.25 ? '#ffd84d' : '#ff4d6d';
          x.fillRect(px - w / 2, py, w * f, 2);
          if (e.shieldMax) { x.fillStyle = '#8ac4ff'; x.fillRect(px - w / 2, py + 2, w * (e.shield / e.shieldMax), 1.2); }
        }
        let sx = px - 8;
        const dot = (c) => { x.fillStyle = c; x.fillRect(sx, py - 5, 3, 3); sx += 4; };
        if (e.burnT > 0) dot('#ff8a3d');
        if (e.virusT > 0) dot('#7dff6a');
        if (e.slowAura > 0 || e.slowT > 0) dot('#8fe8ff');
        if (e.vulnT > 0 || e.vulnAura > 0) dot('#ff5a7a');
        if (e.elite) dot(CS.ELITES[e.elite].color);
      }
    }

    bossUnder(x, e, px, py, t) {
      if (e.type === 'ram' && e.abT2 < 1.6) {
        const k = 1 - e.abT2 / 1.6;
        x.strokeStyle = `rgba(90,160,255,${0.3 + k * 0.6})`; x.lineWidth = 2 + k * 3;
        x.beginPath(); x.arc(px, py, 175 * k, 0, TAU); x.stroke();
      }
      if (e.type === 'blackout') {
        const g = x.createRadialGradient(px, py, 0, px, py, e.r * 2.6);
        g.addColorStop(0, 'rgba(20,0,40,0.8)'); g.addColorStop(1, 'rgba(20,0,40,0)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, e.r * 2.6, 0, TAU); x.fill();
      }
      if (e.type === 'root') {
        x.strokeStyle = 'rgba(255,61,110,0.5)'; x.lineWidth = 2;
        for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(px, py, e.r + 12 + i * 8, t * (i % 2 ? -1 : 1) * (1 + i * 0.4), t * (i % 2 ? -1 : 1) * (1 + i * 0.4) + 3.5); x.stroke(); }
        if (e.speedMul > 1) { x.strokeStyle = 'rgba(255,216,77,0.6)'; x.beginPath(); x.moveTo(px - Math.cos(e.ang) * 50, py - Math.sin(e.ang) * 50); x.lineTo(px - Math.cos(e.ang) * 90, py - Math.sin(e.ang) * 90); x.stroke(); }
      }
      if (e.type === 'worm' && e.burrowT > 0) {
        x.fillStyle = 'rgba(60,40,20,0.6)'; x.beginPath(); x.ellipse(px, py, e.r * 1.4, e.r * 0.8, e.ang, 0, TAU); x.fill();
      }
    }
    bossOver(x, e, px, py, t) {
      // name tag
      x.font = 'bold 10px Rajdhani, sans-serif';
      x.textAlign = 'center';
      x.fillStyle = 'rgba(0,0,0,0.6)';
      const w = e.r * 2.4;
      x.fillRect(px - w / 2 - 1, py - e.r - 15, w + 2, 6);
      x.fillStyle = '#ff4d6d'; x.fillRect(px - w / 2, py - e.r - 14, w * Math.max(0, e.hp / e.maxHp), 4);
      if (e.shieldMax && e.shield > 0) { x.fillStyle = '#8ac4ff'; x.fillRect(px - w / 2, py - e.r - 16, w * (e.shield / e.shieldMax), 2); }
    }

    drawProjectiles(x, Q) {
      const m = this.match;
      const items = m.projs.items;
      const glow = Q.glow;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        if (!p.active || p.delay > 0) continue;
        if (p.kind === 'bullet') {
          const tl = 0.018;
          x.strokeStyle = p.color; x.lineWidth = p.size * 1.2;
          x.globalAlpha = 0.5;
          x.beginPath(); x.moveTo(p.x - p.vx * tl, p.y - p.vy * tl); x.lineTo(p.x, p.y); x.stroke();
          x.globalAlpha = 1;
          x.fillStyle = '#ffffff'; x.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        } else if (p.kind === 'missile' || p.kind === 'kamikaze') {
          x.save(); x.translate(p.x, p.y); x.rotate(Math.atan2(p.vy, p.vx));
          if (p.kind === 'kamikaze') { Spr.draw(x, Spr.drone(false), 0, 0, 0); }
          else {
            x.fillStyle = '#d9dde5'; x.fillRect(-5, -1.8, 9, 3.6);
            x.fillStyle = '#ff5a3d'; x.fillRect(3, -1.8, 3, 3.6);
            x.fillStyle = '#ffd08a'; x.beginPath(); x.arc(-6, 0, 2 + Math.random(), 0, TAU); x.fill();
          }
          x.restore();
        } else if (p.kind === 'glob') {
          x.fillStyle = '#7dff6a'; x.beginPath(); x.arc(p.x, p.y, p.size, 0, TAU); x.fill();
          x.fillStyle = '#eaffea'; x.beginPath(); x.arc(p.x - 1, p.y - 1, p.size * 0.4, 0, TAU); x.fill();
        } else if (p.kind === 'bomblet') {
          x.fillStyle = '#ffb547'; x.beginPath(); x.arc(p.x, p.y, 2.5, 0, TAU); x.fill();
        }
      }
      if (glow) {
        x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          if (!p.active || p.delay > 0 || p.kind === 'bomblet') continue;
          Spr.draw(x, Spr.glow(p.kind === 'missile' ? '#ff8a4d' : p.color), p.x, p.y, 0, p.kind === 'bullet' ? 0.25 + p.size * 0.04 : 0.45);
        }
        x.globalCompositeOperation = 'source-over';
      }
    }

    drawFx(x, Q) {
      const fx = this.match.fx;
      // rings
      fx.rings.forEachActive((g) => {
        const k = 1 - g.life / g.max;
        x.strokeStyle = g.color; x.globalAlpha = Math.max(0, 1 - k); x.lineWidth = g.width;
        x.beginPath(); x.arc(g.x, g.y, Math.max(0.1, g.r0 + (g.r1 - g.r0) * k), 0, TAU); x.stroke();
      });
      x.globalAlpha = 1;
      // beams
      fx.beams.forEachActive((b) => {
        const f = b.life / b.max;
        x.globalAlpha = f;
        if (b.kind === 1 && b.pts) {
          x.strokeStyle = b.color; x.lineWidth = b.width * 2.2; x.globalAlpha = f * 0.35;
          x.beginPath(); x.moveTo(b.pts[0], b.pts[1]); for (let i = 2; i < b.pts.length; i += 2) x.lineTo(b.pts[i], b.pts[i + 1]); x.stroke();
          x.globalAlpha = f; x.strokeStyle = '#ffffff'; x.lineWidth = b.width * 0.7; x.stroke();
        } else if (b.kind === 2) {
          x.strokeStyle = b.color; x.lineWidth = b.width * f + 1; x.globalAlpha = 0.5 * f;
          x.beginPath(); x.moveTo(b.x1, b.y1); x.lineTo(b.x2, b.y2); x.stroke();
          x.strokeStyle = '#ffffff'; x.lineWidth = Math.max(1, b.width * 0.35 * f); x.globalAlpha = f; x.stroke();
        } else {
          x.strokeStyle = b.color; x.lineWidth = b.width;
          x.beginPath(); x.moveTo(b.x1, b.y1); x.lineTo(b.x2, b.y2); x.stroke();
        }
      });
      x.globalAlpha = 1;
      // particles
      const P = fx.parts.items;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (!p.active) continue;
        const f = p.life / p.max;
        if (p.kind === 2) { x.globalAlpha = f * 0.35; x.fillStyle = p.color; x.beginPath(); x.arc(p.x, p.y, p.size * (1.6 - f * 0.6), 0, TAU); x.fill(); }
        else if (p.kind === 1) { x.globalAlpha = Math.min(1, f * 2); x.fillStyle = p.color; x.save(); x.translate(p.x, p.y); x.rotate(p.life * 12); x.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); x.restore(); }
      }
      x.globalAlpha = 1;
      if (Q.glow) x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (!p.active || p.kind !== 0) continue;
        x.globalAlpha = p.life / p.max;
        x.fillStyle = p.color;
        x.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      x.globalAlpha = 1;
      if (Q.glow) {
        fx.flashes.forEachActive((f) => {
          x.globalAlpha = (f.life / f.max) * 0.8;
          Spr.draw(x, Spr.glow(f.color), f.x, f.y, 0, (f.r * 2) / 64);
        });
      }
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    }

    drawDarkness(x, t) {
      const m = this.match;
      for (const z of m.zones) {
        if (z.kind !== 'dark') continue;
        const f = Math.min(1, z.t * 3, (z.dur - z.t) * 3);
        const g = x.createRadialGradient(z.x, z.y, z.r * 0.3, z.x, z.y, z.r);
        g.addColorStop(0, `rgba(4,0,12,${0.85 * f})`); g.addColorStop(1, 'rgba(4,0,12,0)');
        x.fillStyle = g; x.beginPath(); x.arc(z.x, z.y, z.r, 0, TAU); x.fill();
      }
      if (m.sand && m.sand.active) {
        x.fillStyle = 'rgba(210,160,90,0.22)'; x.fillRect(0, 0, CS.WORLD_W, CS.WORLD_H);
        x.strokeStyle = 'rgba(255,230,180,0.35)'; x.lineWidth = 1.5;
        x.beginPath();
        for (let i = 0; i < 40; i++) { const yy = (i * 97) % 720, xx = ((t * 400 + i * 173) % 1400) - 60; x.moveTo(xx, yy); x.lineTo(xx + 40, yy + 4); }
        x.stroke();
      }
      if (m.freezeT > 0) { x.fillStyle = `rgba(160,230,255,${0.12 * Math.min(1, m.freezeT)})`; x.fillRect(0, 0, CS.WORLD_W, CS.WORLD_H); }
    }

    drawOverlays(x, t, ui) {
      const m = this.match;
      const edge = (col, a) => {
        const g = x.createRadialGradient(640, 360, 380, 640, 360, 760);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, U.rgba(col, a));
        x.fillStyle = g; x.fillRect(0, 0, CS.WORLD_W, CS.WORLD_H);
      };
      if (m.overclockT > 0) edge('#ffb547', 0.25 + 0.1 * Math.sin(t * 8));
      if (m.overloadT > 0) edge('#ff4d4d', 0.22 + 0.1 * Math.sin(t * 10));
      if (m.surgeT > 0) edge('#ffd84d', 0.15);
      if (m.coreHp / m.coreMax < 0.25 && m.state === 'play') edge('#ff0033', 0.12 + 0.08 * Math.sin(t * 5));
    }

    drawPlacement(x, t, ui) {
      if (ui.marker) {
        const mk = ui.marker;
        const ph = (t * 1.2) % 1;
        x.strokeStyle = `rgba(255,216,77,${1 - ph})`; x.lineWidth = 3;
        x.beginPath(); x.arc(mk.x, mk.y, 12 + ph * 26, 0, TAU); x.stroke();
        x.strokeStyle = '#ffd84d'; x.lineWidth = 2;
        x.beginPath(); x.arc(mk.x, mk.y, 18, 0, TAU); x.stroke();
      }
      const h = ui.hover;
      if (!h) return;
      if (ui.abilityTarget === 'orbital') {
        x.strokeStyle = 'rgba(255,106,61,0.9)'; x.lineWidth = 2;
        x.setLineDash([8, 6]); x.lineDashOffset = t * 30;
        x.beginPath(); x.arc(h.x, h.y, 170, 0, TAU); x.stroke(); x.setLineDash([]);
        x.fillStyle = 'rgba(255,106,61,0.12)'; x.fill();
        x.beginPath(); x.moveTo(h.x - 14, h.y); x.lineTo(h.x + 14, h.y); x.moveTo(h.x, h.y - 14); x.lineTo(h.x, h.y + 14); x.stroke();
        return;
      }
      if (!ui.placing) return;
      const def = CS.TOWERS[ui.placing];
      // show no-build zones
      if (this.placeMask) {
        x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 0.16 + 0.04 * Math.sin(t * 4); x.drawImage(this.placeMask, 0, 0); x.restore();
        x.fillStyle = 'rgba(255,51,85,0.16)';
        for (const tw of this.match.towers) { x.beginPath(); x.arc(tw.x, tw.y, tw.def.r + def.r - 2, 0, TAU); x.fill(); }
        const m = this.match;
        if (m.corrupt && m.corrupt.active >= 0) { const z = m.def.corruption[m.corrupt.active]; x.beginPath(); x.arc(z.x, z.y, z.r, 0, TAU); x.fill(); }
      }
      const s = CS.buildStats(ui.placing, [0, 0, 0]);
      const ok = ui.placeValid;
      const r = s.range * (1 + this.match.research.rangePct);
      x.fillStyle = ok ? 'rgba(120,220,255,0.10)' : 'rgba(255,60,80,0.12)';
      x.strokeStyle = ok ? 'rgba(160,235,255,0.8)' : 'rgba(255,80,100,0.9)';
      x.lineWidth = 1.5;
      x.beginPath(); x.arc(h.x, h.y, r, 0, TAU); x.fill(); x.stroke();
      x.globalAlpha = 0.75;
      Spr.draw(x, Spr.towerBase(ui.placing, [0, 0, 0], this.skinFor(ui.placing)), h.x, h.y);
      if (Spr.hasHead(ui.placing)) Spr.draw(x, Spr.towerHead(ui.placing, [0, 0, 0], this.skinFor(ui.placing)), h.x, h.y, -Math.PI / 2);
      x.globalAlpha = 1;
      x.strokeStyle = ok ? '#6dffb0' : '#ff4d6d'; x.lineWidth = 2;
      x.beginPath(); x.arc(h.x, h.y, def.r + 3, 0, TAU); x.stroke();
      if (!ok) {
        x.beginPath(); x.moveTo(h.x - 7, h.y - 7); x.lineTo(h.x + 7, h.y + 7); x.moveTo(h.x + 7, h.y - 7); x.lineTo(h.x - 7, h.y + 7); x.stroke();
      }
    }

    drawTexts(x) {
      const fx = this.match.fx;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      fx.texts.forEachActive((tx) => {
        const f = tx.life / tx.max;
        x.globalAlpha = Math.min(1, f * 2.5);
        x.font = '700 ' + tx.size + 'px Rajdhani, "Segoe UI", sans-serif';
        x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,0.75)';
        x.strokeText(tx.str, tx.x, tx.y);
        x.fillStyle = tx.color; x.fillText(tx.str, tx.x, tx.y);
      });
      x.globalAlpha = 1;
    }
  }

  CS.Renderer = Renderer;
})();
