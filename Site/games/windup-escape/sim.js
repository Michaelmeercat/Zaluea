/*
 * Wind-Up Escape — deterministic game rules.
 *
 * The room is a grid. Time advances in "beats": every beat the toy walks one
 * tile (or bonks a wall and turns around). The player's only input is how many
 * clockwise quarter-turns to make at each tile centre. Everything that moves
 * (marbles, pop-up blocks) is a pure function of the beat number, so the same
 * code drives the game and the offline solver that proves each level beatable.
 */
(function (root) {
  'use strict';

  var DX = [0, 1, 0, -1];
  var DY = [-1, 0, 1, 0];
  var DIR = { up: 0, right: 1, down: 2, left: 3 };

  var FLOOR = 0, WALL = 1, HOLE = 2, EXIT = 3, ARROW = 4, CRUMBLE = 5, PISTON = 6, PIPE = 7;
  var ARROW_CH = { '^': 0, '>': 1, 'v': 2, '<': 3 };

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }
  function popcount(n) { var c = 0; while (n) { n &= n - 1; c++; } return c; }

  function parseLevel(def) {
    var rows = def.map;
    var h = rows.length, w = rows[0].length;
    var L = {
      def: def, w: w, h: h, n: w * h,
      tile: new Array(w * h),
      arrowDir: {}, pistonGroup: {}, pipeLink: {}, pipeId: {},
      keyIndex: {}, winderIndex: {}, crumbleIndex: {},
      keys: [], winders: [], crumbles: [], pipes: [], pistons: [],
      exits: [], start: -1, startDir: DIR[def.dir || 'right'],
      marbles: [],
      spring: def.spring,
      winderBonus: def.winderBonus || 10,
      pistonPeriod: def.pistonPeriod || 4,
      pistonUpFor: def.pistonUpFor || ((def.pistonPeriod || 4) / 2),
      pistonOffset: def.pistonOffset || 0,
      period: 1
    };
    var pipeFirst = {};
    for (var y = 0; y < h; y++) {
      if (rows[y].length !== w) throw new Error(def.name + ': row ' + y + ' has wrong width');
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x], i = y * w + x;
        var t = FLOOR;
        if (ch === '#' || ch === ' ') t = WALL;
        else if (ch === '.') t = FLOOR;
        else if (ch === 'S') { t = FLOOR; L.start = i; }
        else if (ch === 'E') { t = EXIT; L.exits.push(i); }
        else if (ch === 'k') { t = FLOOR; L.keyIndex[i] = L.keys.length; L.keys.push(i); }
        else if (ch === 'w') { t = FLOOR; L.winderIndex[i] = L.winders.length; L.winders.push(i); }
        else if (ch === 'o') t = HOLE;
        else if (ARROW_CH.hasOwnProperty(ch)) { t = ARROW; L.arrowDir[i] = ARROW_CH[ch]; }
        else if (ch === 'c') { t = CRUMBLE; L.crumbleIndex[i] = L.crumbles.length; L.crumbles.push(i); }
        else if (ch === 'A' || ch === 'B') { t = PISTON; L.pistonGroup[i] = ch === 'A' ? 0 : 1; L.pistons.push(i); }
        else if (ch >= '1' && ch <= '9') {
          t = PIPE;
          L.pipeId[i] = +ch;
          if (pipeFirst[ch] === undefined) pipeFirst[ch] = i;
          else { L.pipeLink[i] = pipeFirst[ch]; L.pipeLink[pipeFirst[ch]] = i; L.pipes.push([pipeFirst[ch], i]); }
        }
        else throw new Error(def.name + ': unknown map char ' + ch);
        L.tile[i] = t;
      }
    }
    if (L.start < 0) throw new Error(def.name + ': no start');
    if (!L.exits.length) throw new Error(def.name + ': no exit');
    Object.keys(pipeFirst).forEach(function (ch) {
      if (L.pipeLink[pipeFirst[ch]] === undefined) throw new Error(def.name + ': unpaired pipe ' + ch);
    });

    if (L.pistons.length) L.period = lcm(L.period, L.pistonPeriod);

    (def.marbles || []).forEach(function (m, mi) {
      var pts = m.path.map(function (p) { return p[1] * w + p[0]; });
      var cyc = [];
      for (var k = 0; k < pts.length; k++) {
        var a = pts[k], b = pts[(k + 1) % pts.length];
        var ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
        if (ax !== bx && ay !== by) throw new Error(def.name + ': marble ' + mi + ' path not straight');
        var sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
        var cx = ax, cy = ay;
        while (cx !== bx || cy !== by) { cyc.push(cy * w + cx); cx += sx; cy += sy; }
      }
      cyc.forEach(function (c) {
        if (L.tile[c] !== FLOOR) throw new Error(def.name + ': marble ' + mi + ' path crosses non-floor at ' + (c % w) + ',' + ((c / w) | 0));
      });
      L.marbles.push({ cycle: cyc, offset: m.offset || 0, color: m.color || mi });
      L.period = lcm(L.period, cyc.length);
    });
    return L;
  }

  function marblePos(L, m, b) {
    var c = m.cycle;
    return c[(b + m.offset) % c.length];
  }

  // Scheduled height of a pop-up block group at beat b (true = up / solid).
  function pistonUp(L, group, b) {
    var ph = ((b + L.pistonOffset) % L.pistonPeriod + L.pistonPeriod) % L.pistonPeriod;
    var aUp = ph < L.pistonUpFor;
    return group === 0 ? aUp : !aUp;
  }

  function initialState(L) {
    return { pos: L.start, dir: L.startDir, b: 0, keys: 0, winders: 0, crumbled: 0, status: 0, cause: null };
  }

  function springLeft(L, s) {
    return L.spring + popcount(s.winders) * L.winderBonus - s.b;
  }

  function isForced(L, s) { return L.tile[s.pos] === ARROW; }

  // Advance one beat. `turns` = clockwise quarter turns chosen at this tile.
  function step(L, s, turns) {
    var ev = {
      kind: 'move', from: s.pos, to: s.pos, dir0: s.dir, dir: s.dir, turns: 0,
      key: -1, winder: -1, crumble: -1, teleport: -1, arrow: -1,
      death: null, deathP: 1, win: false, windDown: false
    };
    if (isForced(L, s)) turns = 0;
    turns = ((turns % 4) + 4) % 4;
    var dir = (s.dir + turns) % 4;
    ev.turns = turns;
    ev.dir = dir;
    var b1 = s.b + 1;
    var w = L.w;
    var x = s.pos % w, y = (s.pos / w) | 0;
    var nx = x + DX[dir], ny = y + DY[dir];
    var t = -1, blocked = false;
    if (nx < 0 || ny < 0 || nx >= w || ny >= L.h) blocked = true;
    else {
      t = ny * w + nx;
      var tt = L.tile[t];
      if (tt === WALL) blocked = true;
      else if (tt === PISTON && pistonUp(L, L.pistonGroup[t], b1)) blocked = true;
    }
    var ns = {
      pos: s.pos, dir: dir, b: b1, keys: s.keys, winders: s.winders,
      crumbled: s.crumbled, status: 0, cause: null
    };
    if (blocked) {
      ev.kind = 'bonk';
      ev.to = s.pos;
      ns.dir = (dir + 2) % 4;
    } else {
      ev.to = t;
      ns.pos = t;
    }

    // Marbles: touching one knocks the toy over.
    for (var mi = 0; mi < L.marbles.length; mi++) {
      var m = L.marbles[mi];
      var a = marblePos(L, m, s.b), c = marblePos(L, m, b1);
      if (ev.kind === 'move' && a === t && c === s.pos) { ev.death = 'marble'; ev.deathP = 0.5; ev.marble = mi; break; }
      if (c === ns.pos) { ev.death = 'marble'; ev.deathP = ev.kind === 'bonk' ? 0.55 : 0.8; ev.marble = mi; break; }
    }
    if (ev.death) { ns.status = 2; ns.cause = ev.death; return { state: ns, ev: ev }; }

    if (ev.kind === 'move') {
      if (L.tile[s.pos] === CRUMBLE) { ns.crumbled |= 1 << L.crumbleIndex[s.pos]; ev.crumble = s.pos; }
      var tt2 = L.tile[t];
      if (tt2 === HOLE || (tt2 === CRUMBLE && (s.crumbled & (1 << L.crumbleIndex[t])))) {
        ev.death = 'fall'; ev.deathP = 0.85; ns.status = 2; ns.cause = 'fall';
        return { state: ns, ev: ev };
      }
      if (tt2 === EXIT) { ev.win = true; ns.status = 1; return { state: ns, ev: ev }; }
      if (L.keyIndex[t] !== undefined && !(s.keys & (1 << L.keyIndex[t]))) { ns.keys |= 1 << L.keyIndex[t]; ev.key = t; }
      if (L.winderIndex[t] !== undefined && !(s.winders & (1 << L.winderIndex[t]))) { ns.winders |= 1 << L.winderIndex[t]; ev.winder = t; }
      if (tt2 === ARROW) { ns.dir = L.arrowDir[t]; ev.arrow = t; }
      if (tt2 === PIPE) {
        ns.pos = L.pipeLink[t];
        ev.teleport = ns.pos;
        for (var mj = 0; mj < L.marbles.length; mj++) {
          if (marblePos(L, L.marbles[mj], b1) === ns.pos) { ev.death = 'marble'; ev.deathP = 1; ev.marble = mj; ns.status = 2; ns.cause = 'marble'; return { state: ns, ev: ev }; }
        }
      }
    }
    if (springLeft(L, ns) <= 0) { ev.windDown = true; ns.status = 2; ns.cause = 'spring'; }
    return { state: ns, ev: ev };
  }

  var api = {
    DX: DX, DY: DY, DIR: DIR,
    FLOOR: FLOOR, WALL: WALL, HOLE: HOLE, EXIT: EXIT, ARROW: ARROW, CRUMBLE: CRUMBLE, PISTON: PISTON, PIPE: PIPE,
    parseLevel: parseLevel, initialState: initialState, step: step,
    marblePos: marblePos, pistonUp: pistonUp, springLeft: springLeft, isForced: isForced,
    popcount: popcount
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WSim = api;
})(this);
