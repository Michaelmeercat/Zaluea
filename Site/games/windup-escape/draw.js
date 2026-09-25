/*
 * Wind-Up Escape — procedural canvas art. Everything is drawn from shapes so
 * it stays crisp at any size. T is the tile size in pixels.
 */
(function (root) {
  'use strict';

  var C = {
    floorA: '#fff3dc', floorB: '#ffe6bf', floorEdge: 'rgba(196,128,64,0.16)',
    woodTop: '#e9a05b', wood: '#c97a3c', woodDark: '#9a5526', woodLine: 'rgba(120,60,20,0.25)',
    blocks: [
      ['#ff6b6b', '#e03e3e', '#ff9d9d'], ['#4dabf7', '#1c7ed6', '#8fcdff'],
      ['#ffd43b', '#f0a800', '#ffe785'], ['#51cf66', '#2b9a44', '#8ce99a'],
      ['#b197fc', '#7950f2', '#d0bfff'], ['#ff922b', '#e8590c', '#ffc078']
    ],
    hole: '#2a2142', holeMid: '#3d3160', holeRim: '#8a6a4a',
    arrow: '#22c3ae', arrowDark: '#0f8f80', arrowLight: '#7ff0de',
    cookie: '#e3a55c', cookieDark: '#b8733a', cookieLight: '#f6c784', chip: '#5e3517',
    piston: [['#ff5fa2', '#c9246b', '#ffa3cb'], ['#3bc9f5', '#1286b5', '#a5e9ff']],
    tubes: [['#9b6bff', '#5f3dc4'], ['#ff922b', '#d9480f'], ['#40c057', '#2b8a3e'], ['#f06595', '#c2255c'], ['#339af0', '#1864ab']],
    exit: '#37b24d', exitDark: '#237032', exitLight: '#8ce99a',
    gold: '#ffcc33', goldDark: '#d99100', goldLight: '#fff0a8',
    winder: '#74c0fc', winderDark: '#1971c2', winderLight: '#d0ebff',
    toy: '#ff4d5a', toyDark: '#c92a3a', toyLight: '#ff9aa2', belly: '#fff4dc', band: '#ffcc33',
    marbles: [['#ff6b9d', '#a61e4d'], ['#748ffc', '#364fc7'], ['#38d9a9', '#087f5b'], ['#ffa94d', '#d9480f']],
    ink: '#3b2a4a',
    // Toy paint jobs, unlocked with stars.
    skins: [
      { name: 'Cherry', stars: 0, body: '#ff4d5a', dark: '#c92a3a', light: '#ff9aa2', line: '#8f1d2a', band: '#ffcc33', bolt: '#e09a00' },
      { name: 'Sky', stars: 15, body: '#4dabf7', dark: '#1c7ed6', light: '#a5d8ff', line: '#174a8a', band: '#ffcc33', bolt: '#e09a00' },
      { name: 'Frog', stars: 30, body: '#51cf66', dark: '#2b8a3e', light: '#b2f2bb', line: '#1d5e2b', band: '#ff922b', bolt: '#d9480f' },
      { name: 'Grape', stars: 45, body: '#9775fa', dark: '#6741d9', light: '#d0bfff', line: '#3f2a8c', band: '#ffcc33', bolt: '#e09a00' },
      { name: 'Gold', stars: 60, body: '#ffd43b', dark: '#f08c00', light: '#fff9db', line: '#a15c00', band: '#ff5a67', bolt: '#c92a3a' }
    ]
  };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  }
  function hash(x, y) {
    var h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // ---------------------------------------------------------------- wallpaper
  function wallpaper(ctx, w, h, t) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7fd3ff');
    g.addColorStop(1, '#b8a4ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    var s = Math.max(36, Math.min(w, h) / 9);
    for (var y = -1; y < h / s + 1; y++) {
      for (var x = -1; x < w / s + 1; x++) {
        var px = x * s + (y % 2 ? s / 2 : 0), py = y * s;
        var k = hash(x + 50, y + 50);
        if (k < 0.33) { ellipse(ctx, px, py, s * 0.09, s * 0.09); ctx.fill(); }
        else if (k < 0.55) star(ctx, px, py, s * 0.13, s * 0.06, 5, k * 6), ctx.fill();
        else if (k < 0.66) { rr(ctx, px - s * 0.08, py - s * 0.08, s * 0.16, s * 0.16, s * 0.04); ctx.fill(); }
      }
    }
    ctx.restore();
  }

  function star(ctx, x, y, R, r, n, rot) {
    ctx.beginPath();
    for (var i = 0; i < n * 2; i++) {
      var a = rot + i * Math.PI / n - Math.PI / 2;
      var rad = i % 2 ? r : R;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
  }

  // -------------------------------------------------------------- floor tiles
  function floor(ctx, x, y, T, tx, ty) {
    ctx.fillStyle = (tx + ty) % 2 ? C.floorB : C.floorA;
    ctx.fillRect(x, y, T + 0.5, T + 0.5);
  }

  function hole(ctx, x, y, T, depth) {
    var m = T * 0.06;
    ctx.fillStyle = C.holeRim;
    rr(ctx, x + m * 0.5, y + m * 0.5, T - m, T - m, T * 0.2);
    ctx.fill();
    var g = ctx.createLinearGradient(0, y, 0, y + T);
    g.addColorStop(0, '#120c22');
    g.addColorStop(0.55, C.hole);
    g.addColorStop(1, C.holeMid);
    ctx.fillStyle = g;
    rr(ctx, x + m * 1.4, y + m * 1.4, T - m * 2.8, T - m * 2.8, T * 0.16);
    ctx.fill();
    // hint of depth: a few specks
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ellipse(ctx, x + T * 0.5, y + T * 0.72, T * 0.22, T * 0.06);
    ctx.fill();
  }

  function block(ctx, x, y, T, col, d, letter, lift) {
    // 3/4 view block; top face raised by d. `lift` squashes the whole block for pop-ups.
    var m = T * 0.04;
    ctx.fillStyle = 'rgba(70,35,10,0.25)';
    rr(ctx, x + m, y + m + T * 0.06, T - m * 2, T - m * 2, T * 0.14);
    ctx.fill();
    ctx.fillStyle = col[1];
    rr(ctx, x + m, y + m - d, T - m * 2, T - m * 2 + d, T * 0.14);
    ctx.fill();
    ctx.fillStyle = col[0];
    rr(ctx, x + m, y + m - d, T - m * 2, T - m * 2, T * 0.14);
    ctx.fill();
    ctx.fillStyle = col[2];
    rr(ctx, x + m * 3, y + m * 2.4 - d, T - m * 6, T * 0.16, T * 0.08);
    ctx.globalAlpha = 0.55;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (letter) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '700 ' + Math.round(T * 0.46) + 'px Fredoka, "Baloo 2", "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, x + T / 2, y + T / 2 - d + T * 0.03);
      ctx.strokeStyle = col[1];
      ctx.lineWidth = Math.max(1, T * 0.03);
      ctx.globalAlpha = 0.35;
      ctx.strokeText(letter, x + T / 2, y + T / 2 - d + T * 0.03);
      ctx.globalAlpha = 1;
    }
  }

  function frame(ctx, x, y, T, d, tx, ty) {
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(x - 0.5, y - d, T + 1, T + d);
    ctx.fillStyle = C.woodTop;
    ctx.fillRect(x - 0.5, y - d, T + 1, T - 1);
    ctx.strokeStyle = C.woodLine;
    ctx.lineWidth = Math.max(1, T * 0.025);
    var k = hash(tx, ty);
    ctx.beginPath();
    for (var i = 0; i < 3; i++) {
      var yy = y - d + T * (0.22 + i * 0.26) + k * T * 0.06;
      ctx.moveTo(x, yy);
      ctx.quadraticCurveTo(x + T * 0.5, yy + (k - 0.5) * T * 0.12, x + T, yy);
    }
    ctx.stroke();
  }

  function arrowPad(ctx, x, y, T, dir, t) {
    var m = T * 0.08;
    ctx.fillStyle = C.arrowDark;
    rr(ctx, x + m, y + m + T * 0.04, T - m * 2, T - m * 2, T * 0.18);
    ctx.fill();
    ctx.fillStyle = C.arrow;
    rr(ctx, x + m, y + m, T - m * 2, T - m * 2, T * 0.18);
    ctx.fill();
    ctx.save();
    ctx.translate(x + T / 2, y + T / 2);
    ctx.rotate(dir * Math.PI / 2);
    rr(ctx, -T / 2 + m * 1.6, -T / 2 + m * 1.6, T - m * 3.2, T - m * 3.2, T * 0.12);
    ctx.clip();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = T * 0.09;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var off = ((t * 1.6) % 1) * T * 0.34;
    for (var i = -2; i < 3; i++) {
      var cy = i * T * 0.34 - off + T * 0.1;
      ctx.globalAlpha = 0.95 - Math.abs(cy) / (T * 0.7);
      ctx.beginPath();
      ctx.moveTo(-T * 0.2, cy + T * 0.12);
      ctx.lineTo(0, cy - T * 0.08);
      ctx.lineTo(T * 0.2, cy + T * 0.12);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function cookie(ctx, x, y, T, cracked, tx, ty, shake) {
    var m = T * 0.07;
    var sx = shake ? (Math.random() - 0.5) * T * 0.04 : 0;
    x += sx;
    ctx.fillStyle = C.cookieDark;
    rr(ctx, x + m, y + m + T * 0.05, T - m * 2, T - m * 2, T * 0.22);
    ctx.fill();
    ctx.fillStyle = C.cookie;
    rr(ctx, x + m, y + m, T - m * 2, T - m * 2, T * 0.22);
    ctx.fill();
    ctx.fillStyle = C.cookieLight;
    ctx.globalAlpha = 0.6;
    rr(ctx, x + m * 2, y + m * 1.6, T - m * 4, T * 0.12, T * 0.06);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.chip;
    for (var i = 0; i < 5; i++) {
      var a = hash(tx * 7 + i, ty * 13 + i), b = hash(tx * 3 + i * 5, ty * 11 + i * 2);
      ellipse(ctx, x + T * (0.22 + a * 0.56), y + T * (0.25 + b * 0.52), T * 0.045, T * 0.038);
      ctx.fill();
    }
    if (cracked) {
      ctx.strokeStyle = C.chip;
      ctx.lineWidth = Math.max(1, T * 0.035);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + T * 0.2, y + T * 0.3);
      ctx.lineTo(x + T * 0.42, y + T * 0.45);
      ctx.lineTo(x + T * 0.38, y + T * 0.62);
      ctx.lineTo(x + T * 0.6, y + T * 0.8);
      ctx.moveTo(x + T * 0.42, y + T * 0.45);
      ctx.lineTo(x + T * 0.7, y + T * 0.36);
      ctx.stroke();
    }
  }

  function pistonBase(ctx, x, y, T, group, warn) {
    var col = C.piston[group];
    var m = T * 0.1;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    rr(ctx, x + m * 0.6, y + m * 0.6, T - m * 1.2, T - m * 1.2, T * 0.16);
    ctx.fill();
    ctx.strokeStyle = col[0];
    ctx.lineWidth = T * 0.06;
    ctx.setLineDash([T * 0.12, T * 0.08]);
    rr(ctx, x + m, y + m, T - m * 2, T - m * 2, T * 0.14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col[0];
    ctx.globalAlpha = warn ? 0.55 + 0.45 * warn : 0.35;
    pistonEmblem(ctx, x + T / 2, y + T / 2, T * (warn ? 1 + warn * 0.25 : 1), group);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Group A shows a circle, group B a diamond, so they differ by shape too.
  function pistonEmblem(ctx, cx, cy, T, group) {
    if (group === 0) { ellipse(ctx, cx, cy, T * 0.12, T * 0.12); return; }
    var r = T * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
    ctx.closePath();
  }

  function tube(ctx, x, y, T, id, t, pulse) {
    var col = C.tubes[(id - 1) % C.tubes.length];
    var cx = x + T / 2, cy = y + T / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ellipse(ctx, cx, cy + T * 0.08, T * 0.42, T * 0.36);
    ctx.fill();
    ctx.fillStyle = col[1];
    ellipse(ctx, cx, cy + T * 0.04, T * 0.42, T * 0.36);
    ctx.fill();
    ctx.fillStyle = col[0];
    ellipse(ctx, cx, cy, T * 0.42, T * 0.34);
    ctx.fill();
    ctx.fillStyle = '#1c1233';
    ellipse(ctx, cx, cy, T * 0.28, T * 0.22);
    ctx.fill();
    ctx.save();
    ellipse(ctx, cx, cy, T * 0.28, T * 0.22);
    ctx.clip();
    ctx.strokeStyle = col[0];
    ctx.lineWidth = T * 0.05;
    ctx.globalAlpha = 0.8;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      var a0 = t * 4 + i * Math.PI * 2 / 3;
      for (var k = 0; k < 12; k++) {
        var a = a0 + k * 0.35, rad = T * 0.02 + k * T * 0.022;
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.78);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, cx - T * 0.16, cy - T * 0.18, T * 0.1, T * 0.05);
    ctx.fill();
    if (pulse) {
      ctx.strokeStyle = col[0];
      ctx.globalAlpha = pulse;
      ctx.lineWidth = T * 0.06;
      ellipse(ctx, cx, cy, T * (0.42 + (1 - pulse) * 0.3), T * (0.34 + (1 - pulse) * 0.25));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 1-3 pips on the rim tell twin tubes apart without relying on colour
    ctx.fillStyle = '#fff';
    var n = ((id - 1) % 3) + 1;
    for (var p = 0; p < n; p++) {
      ellipse(ctx, cx + (p - (n - 1) / 2) * T * 0.12, cy + T * 0.28, T * 0.04, T * 0.04);
      ctx.fill();
    }
  }

  // side: 0 top,1 right,2 bottom,3 left, -1 interior
  function exitDoor(ctx, x, y, T, side, t, open) {
    var cx = x + T / 2, cy = y + T / 2;
    var m = T * 0.06;
    ctx.fillStyle = C.exitDark;
    rr(ctx, x + m, y + m + T * 0.05, T - m * 2, T - m * 2, T * 0.2);
    ctx.fill();
    ctx.fillStyle = C.exit;
    rr(ctx, x + m, y + m, T - m * 2, T - m * 2, T * 0.2);
    ctx.fill();
    var glow = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.18 + glow * 0.18) + ')';
    rr(ctx, x + m * 2.2, y + m * 2.2, T - m * 4.4, T - m * 4.4, T * 0.14);
    ctx.fill();
    // arrow pointing out of the box
    var dir = side < 0 ? 0 : side;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir * Math.PI / 2);
    var bob = Math.sin(t * 5) * T * 0.05;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -T * 0.3 - bob);
    ctx.lineTo(T * 0.22, -T * 0.06 - bob);
    ctx.lineTo(T * 0.09, -T * 0.06 - bob);
    ctx.lineTo(T * 0.09, T * 0.24 - bob);
    ctx.lineTo(-T * 0.09, T * 0.24 - bob);
    ctx.lineTo(-T * 0.09, -T * 0.06 - bob);
    ctx.lineTo(-T * 0.22, -T * 0.06 - bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function startPad(ctx, x, y, T) {
    ctx.strokeStyle = 'rgba(196,128,64,0.35)';
    ctx.lineWidth = T * 0.05;
    ctx.setLineDash([T * 0.1, T * 0.08]);
    rr(ctx, x + T * 0.14, y + T * 0.14, T * 0.72, T * 0.72, T * 0.2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ------------------------------------------------------------------- items
  function goldKey(ctx, cx, cy, T, t, scale) {
    scale = (scale == null ? 1 : scale) * 1.18;
    var bob = Math.sin(t * 3) * T * 0.05;
    ctx.fillStyle = 'rgba(80,40,0,0.2)';
    ellipse(ctx, cx, cy + T * 0.24, T * 0.2 * scale, T * 0.07 * scale);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy - T * 0.06 + bob);
    ctx.scale(scale, scale);
    ctx.rotate(-0.5 + Math.sin(t * 2) * 0.12);
    var s = T;
    ctx.lineJoin = 'round';
    ctx.fillStyle = C.gold;
    ctx.strokeStyle = C.goldDark;
    ctx.lineWidth = s * 0.05;
    // bow
    ctx.beginPath();
    ctx.arc(-s * 0.16, 0, s * 0.15, 0, Math.PI * 2);
    ctx.moveTo(-s * 0.02, -s * 0.05);
    ctx.lineTo(s * 0.28, -s * 0.05);
    ctx.lineTo(s * 0.28, s * 0.13);
    ctx.lineTo(s * 0.2, s * 0.13);
    ctx.lineTo(s * 0.2, s * 0.05);
    ctx.lineTo(s * 0.14, s * 0.05);
    ctx.lineTo(s * 0.14, s * 0.11);
    ctx.lineTo(s * 0.07, s * 0.11);
    ctx.lineTo(s * 0.07, s * 0.05);
    ctx.lineTo(-s * 0.02, s * 0.05);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = C.goldDark;
    ellipse(ctx, -s * 0.16, 0, s * 0.06, s * 0.06);
    ctx.fill();
    ctx.fillStyle = C.goldLight;
    ellipse(ctx, -s * 0.21, -s * 0.07, s * 0.04, s * 0.025);
    ctx.fill();
    ctx.restore();
    // twinkle
    var tw = (t * 0.9 + cx * 0.013) % 1;
    if (tw < 0.25) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = Math.sin(tw / 0.25 * Math.PI);
      star(ctx, cx + T * 0.18, cy - T * 0.22 + bob, T * 0.09, T * 0.025, 4, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function butterflyKey(ctx, T, spin, col, dark, size) {
    // A wind-up key seen from the side; spin is the rotation about its stem.
    var L = T * size;
    var c = Math.cos(spin);
    var w = Math.max(0.18, Math.abs(c));
    ctx.fillStyle = dark;
    rr(ctx, -L * 0.14, 0, L * 0.28, L * 0.9, L * 0.1);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.strokeStyle = dark;
    ctx.lineWidth = L * 0.12;
    ellipse(ctx, -L * 0.52 * w, -L * 0.1, L * 0.5 * w, L * 0.4);
    ctx.stroke(); ctx.fill();
    ellipse(ctx, L * 0.52 * w, -L * 0.1, L * 0.5 * w, L * 0.4);
    ctx.stroke(); ctx.fill();
    ctx.fillStyle = dark;
    ellipse(ctx, 0, -L * 0.1, L * 0.16, L * 0.2);
    ctx.fill();
  }

  function winder(ctx, cx, cy, T, t, scale) {
    scale = scale == null ? 1 : scale;
    var bob = Math.sin(t * 2.6 + 1) * T * 0.05;
    ctx.fillStyle = 'rgba(0,30,80,0.2)';
    ellipse(ctx, cx, cy + T * 0.3, T * 0.26 * scale, T * 0.08 * scale);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy - T * 0.04 + bob);
    ctx.scale(scale, scale);
    var glow = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = 'rgba(165,216,255,' + (0.45 + glow * 0.25) + ')';
    ellipse(ctx, 0, 0, T * 0.36, T * 0.36);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = T * 0.04;
    ctx.stroke();
    ctx.translate(0, T * 0.06);
    butterflyKey(ctx, T, t * 3, C.winder, C.winderDark, 0.34);
    ctx.restore();
    // "+" badge
    ctx.save();
    ctx.translate(cx + T * 0.27, cy - T * 0.27 + bob);
    ctx.scale(scale, scale);
    ctx.fillStyle = C.winderDark;
    ellipse(ctx, 0, 0, T * 0.12, T * 0.12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-T * 0.065, -T * 0.02, T * 0.13, T * 0.04);
    ctx.fillRect(-T * 0.02, -T * 0.065, T * 0.04, T * 0.13);
    ctx.restore();
  }

  function marble(ctx, cx, cy, T, colorIdx, roll, alpha) {
    var col = C.marbles[colorIdx % C.marbles.length];
    var r = T * 0.3;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = 'rgba(30,10,40,0.28)';
    ellipse(ctx, cx, cy + r * 0.85, r * 0.95, r * 0.35);
    ctx.fill();
    var g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.05);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, col[0]);
    g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    ellipse(ctx, cx, cy, r, r);
    ctx.fill();
    // swirl
    ctx.save();
    ellipse(ctx, cx, cy, r, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    var a = roll;
    ctx.moveTo(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * 1.1);
    ctx.quadraticCurveTo(cx, cy, cx + Math.cos(a + 2.2) * r * 1.1, cy + Math.sin(a + 2.2) * r * 1.1);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ellipse(ctx, cx - r * 0.35, cy - r * 0.42, r * 0.22, r * 0.14);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------------------------------- toy
  // o: { ang (radians, 0 = up, clockwise), walk (radians), keySpin, scale,
  //      alpha, tilt, squash, blink (0..1), dizzy, sleepy, shadow }
  function toy(ctx, cx, cy, T, o) {
    var r = T * 0.32;
    var sk = o.skin || C.skins[0];
    var hx = Math.sin(o.ang), hy = -Math.cos(o.ang);
    var sc = o.scale == null ? 1 : o.scale;
    var sq = o.squash || 0;
    var lift = Math.abs(Math.sin(o.walk || 0)) * T * 0.045;
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(cx, cy);
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(70,30,20,0.25)';
      ellipse(ctx, 0, T * 0.24, r * 1.05 * sc, r * 0.36 * sc);
      ctx.fill();
    }
    ctx.translate(0, -T * 0.06 - lift);
    ctx.rotate(o.tilt || 0);
    ctx.scale(sc * (1 + sq), sc * (1 - sq));

    // feet
    var walk = o.walk || 0;
    var fl = Math.max(0, Math.sin(walk)) * T * 0.06, fr = Math.max(0, -Math.sin(walk)) * T * 0.06;
    ctx.fillStyle = '#ff9f1c';
    ctx.strokeStyle = '#c9700a';
    ctx.lineWidth = T * 0.025;
    ellipse(ctx, -r * 0.45 + hx * r * 0.1, r * 0.92 - fl, r * 0.28, r * 0.17);
    ctx.fill(); ctx.stroke();
    ellipse(ctx, r * 0.45 + hx * r * 0.1, r * 0.92 - fr, r * 0.28, r * 0.17);
    ctx.fill(); ctx.stroke();

    // wind-up key sticks out of the back
    var kx = -hx * r * 1.08, ky = -hy * r * 0.62 - r * 0.12;
    var keyBehind = hy > -0.25;
    function drawKey() {
      ctx.save();
      ctx.translate(kx, ky);
      var stemAng = Math.atan2(-hy * 0.62, -hx) - Math.PI / 2;
      var vert = Math.abs(hy);
      ctx.rotate(stemAng * (1 - vert * 0.999));
      ctx.scale(1, 1 - vert * 0.35);
      butterflyKey(ctx, T, o.keySpin || 0, C.gold, C.goldDark, 0.24);
      ctx.restore();
    }
    if (keyBehind) drawKey();

    // body
    var g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, sk.light);
    g.addColorStop(0.35, sk.body);
    g.addColorStop(1, sk.dark);
    ctx.fillStyle = g;
    ctx.strokeStyle = sk.line;
    ctx.lineWidth = T * 0.03;
    ellipse(ctx, 0, 0, r, r * 1.02);
    ctx.fill();
    ctx.stroke();
    // tin band with rivets
    ctx.save();
    ellipse(ctx, 0, 0, r, r * 1.02);
    ctx.clip();
    ctx.fillStyle = sk.band;
    ctx.fillRect(-r, r * 0.3, r * 2, r * 0.22);
    ctx.fillStyle = sk.bolt;
    for (var i = -2; i <= 2; i++) {
      ellipse(ctx, i * r * 0.36 + hx * r * 0.15, r * 0.41, r * 0.05, r * 0.05);
      ctx.fill();
    }
    ctx.restore();
    // top bolt
    ctx.fillStyle = sk.band;
    ctx.strokeStyle = '#c98a00';
    ellipse(ctx, 0, -r * 0.98, r * 0.2, r * 0.12);
    ctx.fill(); ctx.stroke();

    // face (hidden when walking away from the camera)
    var vis = Math.max(0, Math.min(1, (hy + 0.85) / 0.85));
    if (vis > 0.02) {
      var fx = hx * r * 0.42, fy = -r * 0.14 + hy * r * 0.08;
      var spread = r * (0.34 - Math.abs(hx) * 0.1);
      var ew = r * 0.21 * (0.5 + 0.5 * vis), eh = r * 0.25 * (1 - (o.blink || 0) * 0.9);
      ctx.globalAlpha *= Math.min(1, vis * 1.6);
      // belly patch
      ctx.fillStyle = C.belly;
      ellipse(ctx, fx * 0.6, r * 0.05 + fy * 0.2, r * 0.55 * (0.6 + 0.4 * vis), r * 0.52);
      ctx.globalAlpha *= 0.35;
      ctx.fill();
      ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * Math.min(1, vis * 1.6);
      if (o.dizzy || o.sleepy) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = T * 0.035;
        ctx.lineCap = 'round';
        [-1, 1].forEach(function (s) {
          var ex = fx + s * spread, ey = fy;
          ctx.beginPath();
          if (o.dizzy) {
            ctx.moveTo(ex - ew * 0.7, ey - eh * 0.6); ctx.lineTo(ex + ew * 0.7, ey + eh * 0.6);
            ctx.moveTo(ex + ew * 0.7, ey - eh * 0.6); ctx.lineTo(ex - ew * 0.7, ey + eh * 0.6);
          } else {
            ctx.moveTo(ex - ew * 0.8, ey); ctx.quadraticCurveTo(ex, ey + eh * 0.5, ex + ew * 0.8, ey);
          }
          ctx.stroke();
        });
      } else {
        [-1, 1].forEach(function (s) {
          var ex = fx + s * spread, ey = fy;
          ctx.fillStyle = '#ffffff';
          ellipse(ctx, ex, ey, ew, eh);
          ctx.fill();
          ctx.strokeStyle = 'rgba(80,20,30,0.35)';
          ctx.lineWidth = T * 0.015;
          ctx.stroke();
          if (eh > r * 0.06) {
            ctx.fillStyle = C.ink;
            ellipse(ctx, ex + hx * ew * 0.35, ey + hy * eh * 0.2 + eh * 0.1, ew * 0.55, Math.min(eh, ew) * 0.62);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ellipse(ctx, ex + hx * ew * 0.35 - ew * 0.2, ey - eh * 0.2, ew * 0.2, ew * 0.2);
            ctx.fill();
          }
        });
      }
      // cheeks + mouth
      ctx.fillStyle = 'rgba(255,150,170,0.8)';
      ellipse(ctx, fx - spread * 1.25, fy + r * 0.3, r * 0.1, r * 0.06);
      ctx.fill();
      ellipse(ctx, fx + spread * 1.25, fy + r * 0.3, r * 0.1, r * 0.06);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = T * 0.03;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (o.dizzy) {
        ctx.ellipse(fx, fy + r * 0.36, r * 0.09, r * 0.07, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(fx, fy + r * 0.22, r * 0.12, 0.2 * Math.PI, 0.8 * Math.PI);
      }
      ctx.stroke();
      ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    }
    if (!keyBehind) drawKey();
    ctx.restore();
  }

  // ------------------------------------------------------------ misc markers
  function turnMark(ctx, cx, cy, T, t) {
    var p = (Math.sin(t * 5) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.45 + p * 0.4;
    ctx.strokeStyle = '#ff4d8d';
    ctx.lineWidth = T * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, T * (0.26 + p * 0.03), -Math.PI * 0.9, Math.PI * 0.35);
    ctx.stroke();
    var a = Math.PI * 0.35, R = T * (0.26 + p * 0.03);
    var ax = cx + Math.cos(a) * R, ay = cy + Math.sin(a) * R;
    ctx.fillStyle = '#ff4d8d';
    ctx.beginPath();
    ctx.moveTo(ax + T * 0.12, ay - T * 0.02);
    ctx.lineTo(ax - T * 0.06, ay + T * 0.14);
    ctx.lineTo(ax - T * 0.08, ay - T * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Arrow on the next tile showing which way the toy will turn there.
  function heading(ctx, cx, cy, T, dirAng, n, pulse) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dirAng);
    var s = 1 + pulse * 0.2;
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, T * 0.12);
    ctx.lineTo(0, -T * 0.2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = T * 0.2;
    ctx.stroke();
    ctx.strokeStyle = '#ff4d8d';
    ctx.lineWidth = T * 0.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -T * 0.42);
    ctx.lineTo(T * 0.2, -T * 0.16);
    ctx.lineTo(-T * 0.2, -T * 0.16);
    ctx.closePath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = T * 0.07;
    ctx.stroke();
    ctx.fillStyle = '#ff4d8d';
    ctx.fill();
    ctx.restore();
  }

  root.WDraw = {
    C: C, rr: rr, ellipse: ellipse, star: star, hash: hash,
    wallpaper: wallpaper, floor: floor, hole: hole, block: block, frame: frame,
    arrowPad: arrowPad, cookie: cookie, pistonBase: pistonBase, pistonEmblem: pistonEmblem, tube: tube,
    exitDoor: exitDoor, startPad: startPad, goldKey: goldKey, winder: winder,
    butterflyKey: butterflyKey, marble: marble, toy: toy, turnMark: turnMark, heading: heading
  };
})(this);
