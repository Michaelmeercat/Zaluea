/*
 * Wind-Up Escape — game loop, input, rendering and menus.
 *
 * Timing model: the toy walks one tile per beat (0.5 s). A tap turns the toy
 * 90° clockwise at the next tile centre. Taps in the first third of a step
 * still count for the tile the toy just left (it cuts the corner), and quick
 * bursts of taps stay together, so a triple-tap left turn never gets split.
 */
(function () {
  'use strict';
  var Sim = window.WSim, Solver = window.WSolver, Draw = window.WDraw, Sound = window.WAudio, LEVELS = window.WLEVELS;
  var C = Draw.C;

  var BEAT = 0.5;
  var GRACE = 0.34;
  var BURST = 0.2;
  var RETRO_MAX = 0.97;
  var BONK_AT = 0.35;
  var TAU = Math.PI * 2;

  // ------------------------------------------------------------ save data
  var SAVE_KEY = 'windup-escape-save-v1';
  var save = loadSave();
  function loadSave() {
    var d = null;
    try { d = JSON.parse(window.localStorage.getItem(SAVE_KEY)); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = {};
    return {
      stars: Array.isArray(d.stars) ? d.stars : [],
      best: Array.isArray(d.best) ? d.best : [],
      sound: d.sound !== false,
      music: d.music !== false,
      skin: typeof d.skin === 'number' ? d.skin : 0
    };
  }
  function writeSave() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ }
  }
  function isUnlocked(i) { return i === 0 || (save.stars[i - 1] || 0) > 0; }
  function totalStars() { var t = 0; for (var i = 0; i < LEVELS.length; i++) t += save.stars[i] || 0; return t; }
  function skinUnlocked(i) { return totalStars() >= C.skins[i].stars; }
  function currentSkin() {
    var i = save.skin;
    if (!(i >= 0 && i < C.skins.length) || !skinUnlocked(i)) i = 0;
    return C.skins[i];
  }
  function firstOpenLevel() {
    for (var i = 0; i < LEVELS.length; i++) if (!(save.stars[i] > 0)) return i;
    return LEVELS.length - 1;
  }

  // ------------------------------------------------------------------ DOM
  function $(id) { return document.getElementById(id); }
  var app = $('app');
  var canvas = $('board');
  var ctx = canvas.getContext('2d');
  // Static art (wallpaper, floor, holes) lives on its own layer underneath.
  var staticCanvas = $('bg');
  var sctx = staticCanvas.getContext('2d');
  var ui = {
    hud: $('hud'), num: $('hud-num'), name: $('hud-name'), keys: $('hud-keys'), keysText: $('hud-keys-text'),
    spring: $('spring'), fill: $('spring-fill'), par: $('spring-par'), springText: $('spring-text'),
    hint: $('hint'), demo: $('demo-badge'), toast: $('toast'),
    title: $('screen-title'), levels: $('screen-levels'), grid: $('level-grid'), total: $('total-stars'),
    start: $('card-start'), startNum: $('start-num'), startName: $('start-name'), intro: $('start-intro'),
    introIco: $('intro-ico'), introText: $('intro-text'), tip: $('start-tip'), goalKeys: $('goal-keys'), goalTime: $('goal-time'),
    result: $('card-result'), resultTitle: $('result-title'), resultStars: $('result-stars'), resultSub: $('result-sub'),
    resultGoals: $('result-goals'), next: $('btn-next'), retry: $('btn-retry'), show: $('btn-show'), spaceAction: $('space-action'), rHint: $('r-hint'),
    pause: $('card-pause'), titleToy: $('title-toy')
  };

  var INTROS = {
    turn: 'Winky walks all by itself. <b><span class="touch-only">Tap</span><span class="key-only">Press Space</span></b> to turn right&nbsp;&#8635; and reach the green door!',
    bonk: 'Bump into a block and you bounce back the other way.',
    left: 'No left turn? Tap <b>3 times</b> quickly &mdash; or turn into a wall and bounce off it!',
    winder: 'Blue wind-up keys give your spring <b>+5 seconds</b>.',
    hole: 'Watch out for holes! Turn in time or down you go.',
    arrow: 'Arrow pads point you their way. You can\'t turn while you\'re on one.',
    marble: 'Rolling marbles knock you over. Slip past right behind them!',
    piston: 'Pop-up blocks rise and sink. Walk through while they\'re down.',
    crumble: 'Cookie tiles crumble once you step off them. No going back!',
    pipe: 'Walk into a tube to pop out of its twin, still facing the same way.'
  };
  var FAILS = {
    marble: ['Knocked over!', 'Marbles move as fast as you. Follow right behind one.'],
    fall: ['Down the hole!', 'Turns happen at the next tile, so tap a little early.'],
    spring: ['Wound down!', 'Take a shorter route, or grab a wind-up key.']
  };

  // --------------------------------------------------------------- state
  var G = {
    mode: 'title', phase: 'idle', prevPhase: null,
    li: 0, def: null, L: null,
    s: null, cur: null, p: 0, queued: 0,
    lastTap: -99, lastTapRetro: false,
    time: 0, windT: 0, endT: 0, cause: null,
    fails: 0, taps: 0, springMax: 1,
    demo: null, lastTeleport: false, resultShown: false,
    bonked: false
  };
  var vis = { ang: 0, walk: 0, keySpin: 0, corrX: 0, corrY: 0, blink: 0, blinkT: 2, shake: 0 };
  var view = { w: 1, h: 1, dpr: 1, T: 40, ox: 0, oy: 0, d: 10, strips: [] };
  var parts = [];
  var crumbleAnim = {};
  var tubePulse = {};
  var solutionCache = {};
  var hasKeys = false;

  function isQuiet() { return G.mode !== 'play' || (G.demo && G.demo.attract); }
  function sfx(name, a) { if (!isQuiet()) Sound.sfx[name](a); }
  // Short rumbles on phones that support it (Android); silent elsewhere.
  function buzz(pattern) {
    if (isQuiet() || !save.sound || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not allowed */ }
  }

  // -------------------------------------------------------------- layout
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    view.w = w; view.h = h; view.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (!G.L) {
      staticCanvas.width = canvas.width;
      staticCanvas.height = canvas.height;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      Draw.wallpaper(sctx, w, h);
    }
    layoutBoard();
  }

  function layoutBoard() {
    if (!G.L) return;
    var L = G.L, top, bottom, side = 12;
    if (G.mode === 'play') {
      var r = ui.hud.getBoundingClientRect();
      var compact = view.h <= 520 && view.w > view.h;
      top = (r.height ? r.bottom : 100) + (compact ? 6 : 10);
      bottom = compact ? 38 : 62;
    } else {
      top = 20; bottom = 20;
    }
    var availW = view.w - side * 2, availH = view.h - top - bottom;
    var T = Math.min(availW / L.w, availH / (L.h + 0.35));
    T = Math.max(12, Math.min(96, Math.floor(T)));
    view.T = T;
    view.d = Math.round(T * 0.24);
    view.ox = Math.round((view.w - L.w * T) / 2);
    view.oy = Math.round(top + (availH - L.h * T) / 2 + view.d * 0.5);
    buildStatic();
  }

  function tileXY(i) { return { x: i % G.L.w, y: (i / G.L.w) | 0 }; }
  function px(tx) { return view.ox + tx * view.T; }
  function py(ty) { return view.oy + ty * view.T; }

  // Border walls are the wooden toy box; everything inside is a toy block.
  function isFrame(x, y) {
    var L = G.L;
    if (L.tile[y * L.w + x] !== Sim.WALL) return false;
    return x === 0 || y === 0 || x === L.w - 1 || y === L.h - 1;
  }

  function buildStatic() {
    var L = G.L, T = view.T, d = view.d, dpr = view.dpr;
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Draw.wallpaper(sctx, view.w, view.h);
    // box shadow
    sctx.fillStyle = 'rgba(50,25,90,0.28)';
    Draw.rr(sctx, view.ox - T * 0.05, view.oy - d + T * 0.28, L.w * T + T * 0.1, L.h * T + d, T * 0.35);
    sctx.fill();
    for (var y = 0; y < L.h; y++) for (var x = 0; x < L.w; x++) {
      var i = y * L.w + x, t = L.tile[i];
      if (t === Sim.WALL && isFrame(x, y)) continue;
      Draw.floor(sctx, px(x), py(y), T, x, y);
    }
    for (var j = 0; j < L.n; j++) {
      var q = tileXY(j);
      if (L.tile[j] === Sim.HOLE) Draw.hole(sctx, px(q.x), py(q.y), T);
    }
    var st = tileXY(L.start);
    Draw.startPad(sctx, px(st.x), py(st.y), T);
    // wall strips, one per row, drawn interleaved with sprites for depth
    view.strips = [];
    for (var r = 0; r < L.h; r++) {
      var any = false;
      for (var cx = 0; cx < L.w; cx++) if (L.tile[r * L.w + cx] === Sim.WALL) any = true;
      if (!any) { view.strips.push(null); continue; }
      var sc = document.createElement('canvas');
      sc.width = Math.ceil(L.w * T * dpr) + 2;
      sc.height = Math.ceil((T + d + 2) * dpr);
      var c2 = sc.getContext('2d');
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (var x2 = 0; x2 < L.w; x2++) {
        if (L.tile[r * L.w + x2] !== Sim.WALL) continue;
        if (isFrame(x2, r)) Draw.frame(c2, x2 * T, d + 1, T, d, x2, r);
        else {
          var h = Draw.hash(x2 + G.li * 3, r + G.li * 7);
          var col = C.blocks[Math.floor(h * C.blocks.length) % C.blocks.length];
          var letter = 'ABCDEFGHJKLMNOPRSTUWXYZ'.charAt(Math.floor(Draw.hash(r * 5 + 1, x2 * 3 + G.li) * 23));
          Draw.block(c2, x2 * T, d + 1, T, col, d, letter);
        }
      }
      view.strips.push(sc);
    }
  }

  // ------------------------------------------------------------ levels
  function loadLevel(i) {
    G.li = i;
    G.def = LEVELS[i];
    G.L = Sim.parseLevel(G.def);
    G.fails = 0;
    resetRun();
  }

  function resetRun() {
    var L = G.L;
    G.s = Sim.initialState(L);
    G.cur = null;
    G.p = 0;
    G.queued = 0;
    G.lastTap = -99;
    G.lastTapRetro = false;
    G.windT = 0;
    G.endT = 0;
    G.cause = null;
    G.lastTeleport = false;
    G.resultShown = false;
    G.bonked = false;
    G.springMax = L.spring;
    vis.ang = L.startDir * Math.PI / 2;
    vis.corrX = vis.corrY = 0;
    vis.shake = 0;
    parts = [];
    crumbleAnim = {};
    tubePulse = {};
    G.phase = 'ready';
    updateHUD(true);
  }

  function solutionFor(i) {
    if (!solutionCache[i]) {
      var L = Sim.parseLevel(LEVELS[i]);
      solutionCache[i] = Solver.solve(L, { allKeys: true, maxTap: 1 }) || Solver.solve(L, { allKeys: true }) || Solver.solve(L, {});
    }
    return solutionCache[i];
  }

  // -------------------------------------------------------------- flow
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function goTitle() {
    G.mode = 'title';
    hideAllCards();
    hide(ui.hud); hide(ui.hint); hide(ui.demo); hide(ui.levels);
    show(ui.title);
    startAttract();
  }

  function goLevels() {
    G.mode = 'levels';
    hideAllCards();
    hide(ui.hud); hide(ui.hint); hide(ui.demo); hide(ui.title);
    buildLevelGrid();
    show(ui.levels);
    if (!G.demo || !G.demo.attract) startAttract();
    Sound.duck(false);
  }

  var attractOrder = [0, 11, 5, 16, 8, 12, 6, 13, 2, 17];
  var attractIdx = 0;
  function startAttract() {
    var i = attractOrder[attractIdx % attractOrder.length];
    attractIdx++;
    loadLevel(i);
    var sol = solutionFor(i);
    G.demo = { turns: sol ? sol.turns : [], attract: true };
    layoutBoard();
    G.phase = 'winding';
    G.windT = 0.3;
  }

  function startLevel(i) {
    if (!isUnlocked(i)) return;
    G.mode = 'play';
    G.demo = null;
    hide(ui.title); hide(ui.levels); hideAllCards(); hide(ui.demo);
    loadLevel(i);
    show(ui.hud);
    ui.num.textContent = i + 1;
    ui.name.textContent = G.def.name;
    layoutBoard();
    showStartCard();
  }

  function hideAllCards() { hide(ui.start); hide(ui.result); hide(ui.pause); }

  function showStartCard() {
    var def = G.def, L = G.L;
    G.phase = 'intro';
    ui.startNum.textContent = G.li + 1;
    ui.startName.textContent = def.name;
    if (def.intro) {
      ui.introText.innerHTML = INTROS[def.intro];
      drawIntroIcon(def.intro);
      show(ui.intro);
    } else hide(ui.intro);
    if (def.tip) { ui.tip.textContent = def.tip; show(ui.tip); } else hide(ui.tip);
    var nk = L.keys.length;
    ui.goalKeys.textContent = nk === 1 ? 'Grab the gold key' : 'Grab all ' + nk + ' gold keys';
    ui.goalTime.textContent = 'Escape within ' + (def.par * BEAT).toFixed(1) + 's';
    show(ui.start);
    hide(ui.hint);
  }

  function enterReady() {
    hide(ui.start);
    G.phase = 'ready';
    setHint(hasKeys ? 'Press Space to wind up!' : 'Tap to wind up!', true);
  }

  function setHint(text, pulse) {
    if (!text) { hide(ui.hint); return; }
    ui.hint.textContent = text;
    ui.hint.classList.toggle('pulse', !!pulse);
    show(ui.hint);
  }

  function beginWind() {
    G.phase = 'winding';
    G.windT = 0;
    sfx('windup');
    if (G.li < 2 && !G.demo) setHint(hasKeys ? 'Space = turn right ↻' : 'Tap anywhere = turn right ↻', false);
    else hide(ui.hint);
    ui.spring.classList.add('running');
  }

  function retry() {
    hideAllCards();
    hide(ui.demo);
    G.demo = null;
    resetRun();
    enterReady();
    Sound.duck(false);
  }

  function nextLevel() {
    if (G.li + 1 < LEVELS.length && isUnlocked(G.li + 1)) startLevel(G.li + 1);
    else goLevels();
  }

  function startDemo() {
    var sol = solutionFor(G.li);
    if (!sol) return;
    hideAllCards();
    resetRun();
    G.demo = { turns: sol.turns, attract: false };
    hide(ui.hint);
    show(ui.demo);
    Sound.duck(false);
    beginWind();
  }

  function stopDemo() {
    G.demo = null;
    hide(ui.demo);
    resetRun();
    enterReady();
    ui.spring.classList.remove('running');
  }

  function pause() {
    if (G.mode !== 'play' || G.phase === 'paused' || G.phase === 'won' || G.phase === 'dead') return;
    if (!ui.result.classList.contains('hidden')) return;
    G.prevPhase = G.phase;
    G.phase = 'paused';
    show(ui.pause);
    ui.spring.classList.remove('running');
    Sound.duck(true);
  }
  function resume() {
    if (G.phase !== 'paused') return;
    hide(ui.pause);
    G.phase = G.prevPhase;
    if (G.phase === 'run' || G.phase === 'winding') ui.spring.classList.add('running');
    Sound.duck(false);
  }

  // --------------------------------------------------------------- beats
  function startBeat() {
    var L = G.L, s = G.s;
    var turns = G.queued;
    G.queued = 0;
    if (G.demo) turns = G.demo.turns[s.b] || 0;
    if (Sim.isForced(L, s) && turns % 4) {
      turns = 0;
      spawnText(s.pos, '✕', '#ff4d8d', 0.7);
    }
    G.cur = { s0: s, turns: turns, res: Sim.step(L, s, turns), popOut: G.lastTeleport };
    G.lastTeleport = false;
    G.bonked = false;
    if (turns % 4) { sfx('turn', turns % 4); turnSpark(); }
    var sp = tileXY(s.pos);
    parts.push({ k: 'puff', x: sp.x + 0.5 + (Math.random() - 0.5) * 0.2, y: sp.y + 0.78, vx: 0, vy: -0.15, life: 0.35, max: 0.35 });
    var left = Sim.springLeft(L, s);
    sfx('step', left * BEAT <= 3);
    if (L.pistons.length && pistonChanges(s.b)) sfx('piston');
  }

  function pistonChanges(b) {
    return Sim.pistonUp(G.L, 0, b) !== Sim.pistonUp(G.L, 0, b + 1);
  }

  function commitBeat() {
    var res = G.cur.res, ev = res.ev, ns = res.state;
    G.s = ns;
    if (ev.key >= 0) onKey(ev.key);
    if (ev.winder >= 0) onWinder(ev.winder);
    if (ev.crumble >= 0) onCrumble(ev.crumble);
    if (ev.teleport >= 0) {
      sfx('warp');
      G.lastTeleport = true;
      tubePulse[ev.to] = 1;
      tubePulse[ev.teleport] = 1;
    }
    if (ns.status === 1) { win(); return; }
    if (ns.status === 2) { die(ns.cause); return; }
    startBeat();
  }

  function update(dt) {
    G.time += dt;
    updateVisuals(dt);
    updateParts(dt);
    if (G.mode === 'play' && G.phase === 'paused') return;
    var ph = G.phase;
    if (ph === 'winding') {
      G.windT += dt;
      if (G.windT >= 0.6) { G.phase = 'run'; G.p = 0; startBeat(); }
    } else if (ph === 'run') {
      runBeat(dt);
    } else if (ph === 'won' || ph === 'dead') {
      G.endT += dt;
      if (!G.resultShown && G.endT > (ph === 'won' ? 1.0 : 1.2)) {
        G.resultShown = true;
        if (G.demo && G.demo.attract) startAttract();
        else if (G.demo) { stopDemo(); flashToast('Your turn!'); }
        else showResult(ph === 'won');
      }
    }
    if (G.mode === 'play') updateHUD(false);
  }

  function runBeat(dt) {
    var prev = G.p;
    G.p += dt / BEAT;
    var ev = G.cur.res.ev;
    if (ev.kind === 'bonk' && !G.bonked && G.p >= BONK_AT) { G.bonked = true; onBonk(); }
    if (G.demo && !G.demo.attract && prev < 0.55 && G.p >= 0.55) {
      var nt = G.demo.turns[G.cur.s0.b + 1] || 0;
      if (nt % 4 && G.cur.res.state.status === 0) {
        spawnTapBubble(nt % 4);
        sfx('queue');
      }
    }
    if (ev.death && G.p >= ev.deathP) { G.p = ev.deathP; G.s = G.cur.res.state; die(ev.death); return; }
    if (G.p >= 1) {
      G.p -= 1;
      commitBeat();
      // Won or wound down on arrival: hold the pose at the tile just reached.
      if (G.phase !== 'run') G.p = 1;
    }
  }

  // --------------------------------------------------------------- input
  function onTap() {
    Sound.unlock();
    if (G.mode !== 'play') return;
    if (G.demo) { stopDemo(); return; }
    switch (G.phase) {
      case 'intro': enterReady(); sfx('ui'); return;
      case 'ready': beginWind(); return;
      case 'winding':
        G.queued++;
        G.lastTap = G.time;
        G.lastTapRetro = false;
        sfx('queue');
        return;
      case 'run': break;
      default: return;
    }
    G.taps++;
    var cur = G.cur, p = G.p;
    var forced = Sim.isForced(G.L, cur.s0);
    var burst = G.lastTapRetro && (G.time - G.lastTap) < BURST;
    var retro = !forced && (p < GRACE || (burst && p < RETRO_MAX));
    if (retro) {
      var before = toyPos(cur, p);
      cur.turns++;
      cur.res = Sim.step(G.L, cur.s0, cur.turns);
      var after = toyPos(cur, p);
      vis.corrX += before.x - after.x;
      vis.corrY += before.y - after.y;
      if (cur.res.ev.kind === 'bonk' && p >= BONK_AT) { G.bonked = true; onBonk(); }
      else if (cur.res.ev.kind !== 'bonk') G.bonked = false;
      sfx('turn', cur.turns % 4);
      turnSpark();
    } else {
      G.queued++;
      sfx('queue');
    }
    G.lastTapRetro = retro;
    G.lastTap = G.time;
    if (G.li < 2 && G.taps > 5 && !ui.hint.classList.contains('hidden')) hide(ui.hint);
  }

  function primaryAction() {
    Sound.unlock();
    if (G.mode === 'title') { sfx('ui'); goLevels(); return; }
    if (G.mode === 'levels') { startLevel(firstOpenLevel()); return; }
    if (!ui.pause.classList.contains('hidden')) { resume(); return; }
    if (!ui.result.classList.contains('hidden')) {
      if (G.phase === 'won' && !ui.next.classList.contains('hidden')) nextLevel();
      else retry();
      return;
    }
    onTap();
  }

  // ------------------------------------------------------------ events
  function onBonk() {
    var ev = G.cur.res.ev;
    sfx('bonk');
    buzz(18);
    vis.shake = Math.max(vis.shake, 0.12);
    var f = tileXY(ev.from);
    var bx = f.x + 0.5 + Sim.DX[ev.dir] * 0.5, by = f.y + 0.5 + Sim.DY[ev.dir] * 0.5;
    for (var i = 0; i < 6; i++) {
      var a = Math.random() * TAU;
      parts.push({ k: 'spark', x: bx, y: by - 0.2, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 2.2 - 1.5, g: 6, life: 0.5, max: 0.5, c: '#ffe066', s: 0.12 });
    }
    parts.push({ k: 'text', x: bx, y: by - 0.5, vy: -1.2, life: 0.6, max: 0.6, text: 'BONK!', c: '#ff4d8d', s: 0.36 });
  }

  function onKey(tile) {
    sfx('key');
    buzz(10);
    var q = tileXY(tile);
    burst(q.x + 0.5, q.y + 0.4, ['#ffe066', '#ffcc33', '#fff'], 14, 3);
    parts.push({ k: 'ring', x: q.x + 0.5, y: q.y + 0.5, life: 0.4, max: 0.4, c: '#ffcc33' });
    var r = ui.keys.getBoundingClientRect();
    parts.push({ k: 'fly', sx: px(q.x + 0.5), sy: py(q.y + 0.4), tx: r.left + 22, ty: r.top + r.height / 2, life: 0.55, max: 0.55 });
  }

  function onWinder(tile) {
    sfx('winder');
    var q = tileXY(tile);
    burst(q.x + 0.5, q.y + 0.4, ['#74c0fc', '#d0ebff', '#fff'], 12, 2.6);
    parts.push({ k: 'text', x: q.x + 0.5, y: q.y - 0.1, vy: -0.9, life: 1.0, max: 1.0, text: '+' + (G.L.winderBonus * BEAT) + 's', c: '#1971c2', s: 0.5 });
    G.springMax = Math.max(G.springMax, Sim.springLeft(G.L, G.cur.res.state));
    ui.spring.classList.add('boost');
    setTimeout(function () { ui.spring.classList.remove('boost'); }, 350);
  }

  function onCrumble(tile) {
    sfx('crumble');
    crumbleAnim[tile] = 0.001;
    var q = tileXY(tile);
    for (var i = 0; i < 8; i++) {
      parts.push({ k: 'crumb', x: q.x + 0.2 + Math.random() * 0.6, y: q.y + 0.2 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 1.5, g: 5, life: 0.5, max: 0.5, c: Math.random() < 0.3 ? C.chip : C.cookie, s: 0.08 + Math.random() * 0.06 });
    }
  }

  function turnSpark() {
    var pos = toyNow();
    parts.push({ k: 'ring', x: pos.x + 0.5, y: pos.y + 0.55, life: 0.25, max: 0.25, c: '#ff4d8d' });
  }

  function spawnText(tile, text, color, life) {
    var q = tileXY(tile);
    parts.push({ k: 'text', x: q.x + 0.5, y: q.y - 0.1, vy: -0.8, life: life, max: life, text: text, c: color, s: 0.4 });
  }

  function spawnTapBubble(n) {
    var pos = toyNow();
    parts.push({ k: 'bubble', x: pos.x + 0.5, y: pos.y - 0.45, life: 0.7, max: 0.7, text: n === 1 ? 'TAP' : n === 2 ? 'TAP ×2' : 'TAP ×3' });
  }

  function burst(x, y, colors, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, sp = speed * (0.5 + Math.random() * 0.7);
      parts.push({ k: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, g: 5, life: 0.7, max: 0.7, c: colors[i % colors.length], s: 0.1 + Math.random() * 0.08 });
    }
  }

  function confetti(x, y, n) {
    var cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc', '#ff922b'];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 3 + Math.random() * 4;
      parts.push({ k: 'conf', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 4.5, life: 1.6, max: 1.6, c: cols[i % cols.length], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, s: 0.12 + Math.random() * 0.08 });
    }
  }

  function win() {
    G.phase = 'won';
    G.endT = 0;
    G.p = 1;
    ui.spring.classList.remove('running');
    sfx('win');
    buzz([20, 60, 30]);
    var e = tileXY(G.cur.res.ev.to);
    confetti(e.x + 0.5, e.y + 0.5, isQuiet() ? 20 : 60);
  }

  function die(cause) {
    G.phase = 'dead';
    G.cause = cause;
    G.endT = 0;
    ui.spring.classList.remove('running');
    buzz(cause === 'spring' ? 30 : 70);
    if (cause === 'marble') {
      sfx('crash');
      vis.shake = 0.35;
      var q = toyNow();
      burst(q.x + 0.5, q.y + 0.3, ['#ffe066', '#fff', '#ff6b9d'], 12, 3);
      parts.push({ k: 'text', x: q.x + 0.5, y: q.y - 0.3, vy: -0.9, life: 0.9, max: 0.9, text: 'OOF!', c: '#e03e3e', s: 0.45 });
    } else if (cause === 'fall') {
      sfx('fall');
    } else {
      sfx('winddown');
    }
  }

  function showResult(won) {
    var L = G.L, def = G.def, s = G.s;
    var nk = L.keys.length, got = Sim.popcount(s.keys);
    var time = s.b * BEAT;
    var stars = [true, got === nk, s.b <= def.par];
    Sound.duck(true);
    hide(ui.hint);
    var starEls = ui.resultStars.children;
    for (var i = 0; i < 3; i++) starEls[i].classList.remove('on');
    ui.resultGoals.innerHTML = '';
    hide(ui.show);
    if (won) {
      var n = stars.filter(Boolean).length;
      var prevStars = save.stars[G.li] || 0;
      var before = totalStars();
      save.stars[G.li] = Math.max(prevStars, n);
      var unlocked = C.skins.filter(function (sk) { return sk.stars > before && sk.stars <= totalStars(); });
      if (!(save.best[G.li] <= time)) save.best[G.li] = time;
      writeSave();
      G.fails = 0;
      var last = G.li === LEVELS.length - 1;
      ui.resultTitle.textContent = last ? 'You escaped the toy box!' : n === 3 ? 'Perfect escape!' : 'Escaped!';
      ui.resultSub.textContent = last ? 'All ' + LEVELS.length + ' rooms cleared — ' + totalStars() + ' of ' + LEVELS.length * 3 + ' stars.' :
        (prevStars && n > prevStars ? 'New best: ' + n + ' stars!' : (save.best[G.li] < time ? 'Best time ' + save.best[G.li].toFixed(1) + 's' : ''));
      addGoal(true, 'Escaped in ' + time.toFixed(1) + 's');
      addGoal(stars[1], 'Gold keys ' + got + '/' + nk);
      addGoal(stars[2], 'Within ' + (def.par * BEAT).toFixed(1) + 's');
      [0, 1, 2].forEach(function (k) {
        setTimeout(function () {
          if (ui.result.classList.contains('hidden')) return;
          if (stars[k]) { starEls[k].classList.add('on'); sfx('star', k); }
          else sfx('nostar');
        }, 250 + k * 330);
      });
      ui.next.classList.remove('hidden');
      ui.spaceAction.textContent = last ? 'rooms' : 'next room';
      show(ui.rHint);
      if (unlocked.length) {
        var sk = unlocked[unlocked.length - 1];
        ui.resultSub.textContent = 'New paint unlocked: ' + sk.name + '! Pick it in the room list.';
      }
    } else {
      G.fails++;
      var f = FAILS[G.cause] || FAILS.spring;
      ui.resultTitle.textContent = f[0];
      ui.resultSub.textContent = f[1];
      addGoal(got === nk, 'Gold keys ' + got + '/' + nk);
      if (G.li + 1 < LEVELS.length && isUnlocked(G.li + 1)) ui.next.classList.remove('hidden');
      else ui.next.classList.add('hidden');
      if (G.fails >= 2) show(ui.show);
      ui.spaceAction.textContent = 'retry';
      hide(ui.rHint);
    }
    show(ui.result);
  }

  function addGoal(ok, text) {
    var li = document.createElement('li');
    if (!ok) li.className = 'miss';
    li.innerHTML = '<span class="star-ico"></span>';
    li.appendChild(document.createTextNode(text));
    ui.resultGoals.appendChild(li);
  }

  function flashToast(text) {
    ui.toast.textContent = text;
    show(ui.toast);
    clearTimeout(flashToast.t);
    flashToast.t = setTimeout(function () { hide(ui.toast); }, 1200);
  }

  // ------------------------------------------------------------- visuals
  function easeOut(t) { t = Math.max(0, Math.min(1, t)); return 1 - (1 - t) * (1 - t); }
  function easeInOut(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Toy position in tile units (top-left of tile) for the current beat.
  function toyPos(cur, p) {
    var L = G.L, ev = cur.res.ev;
    var f = tileXY(ev.from);
    if (ev.kind === 'bonk') {
      var o = p < BONK_AT ? 0.3 * easeOut(p / BONK_AT) : 0.3 * (1 - easeInOut((p - BONK_AT) / (1 - BONK_AT)));
      return { x: f.x + Sim.DX[ev.dir] * o, y: f.y + Sim.DY[ev.dir] * o };
    }
    var t = tileXY(ev.to);
    return { x: lerp(f.x, t.x, p), y: lerp(f.y, t.y, p) };
  }

  function toyNow() {
    if (!started()) return tileXY(G.s.pos);
    var q = toyPos(G.cur, Math.min(1, G.p));
    return { x: q.x + vis.corrX, y: q.y + vis.corrY };
  }

  function facingTarget() {
    if (!started()) return G.s.dir * Math.PI / 2;
    var ev = G.cur.res.ev;
    var d = ev.dir;
    if (ev.kind === 'bonk' && G.p >= BONK_AT) d = (d + 2) % 4;
    if (G.phase === 'won') d = ev.dir;
    return d * Math.PI / 2;
  }

  function updateVisuals(dt) {
    var target = facingTarget();
    while (target < vis.ang - Math.PI + 0.01) target += TAU;
    while (target > vis.ang + Math.PI + 0.01) target -= TAU;
    vis.ang += (target - vis.ang) * Math.min(1, dt * 22);
    var running = G.phase === 'run';
    if (running) vis.walk += dt * TAU / BEAT;
    else vis.walk *= Math.pow(0.001, dt);
    var spin = G.phase === 'winding' ? 26 : running ? 7 : G.phase === 'dead' && G.cause === 'spring' ? Math.max(0, 5 - G.endT * 6) : 1.2;
    if (G.phase === 'ready' || G.phase === 'intro') spin = 0.8;
    vis.keySpin += dt * spin;
    var k = Math.pow(0.0005, dt);
    vis.corrX *= k; vis.corrY *= k;
    vis.shake *= Math.pow(0.02, dt);
    vis.blinkT -= dt;
    if (vis.blinkT < 0) { vis.blink = 1; vis.blinkT = 2 + Math.random() * 3; }
    vis.blink = Math.max(0, vis.blink - dt * 7);
    for (var c in crumbleAnim) if (crumbleAnim[c] < 1) crumbleAnim[c] = Math.min(1, crumbleAnim[c] + dt * 2.8);
    for (var t in tubePulse) tubePulse[t] = Math.max(0, tubePulse[t] - dt * 2.2);
  }

  function updateParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i];
      q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); if (q.k === 'fly') bumpKeys(); continue; }
      if (q.vx !== undefined) q.x += q.vx * dt;
      if (q.vy !== undefined) q.y += q.vy * dt;
      if (q.g) q.vy += q.g * dt;
      if (q.k === 'conf') { q.vx *= Math.pow(0.4, dt); q.rot += q.vr * dt; if (q.vy > 2) q.vy = 2; }
    }
  }

  function bumpKeys() {
    ui.keys.classList.remove('bump');
    void ui.keys.offsetWidth;
    ui.keys.classList.add('bump');
  }

  var hudCache = {};
  function setText(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }
  function updateHUD(force) {
    var L = G.L, s = G.s;
    if (!L || !s) return;
    if (force) hudCache = {};
    var left = Sim.springLeft(L, s);
    if (G.phase === 'run') left -= G.p;
    if (G.phase === 'dead' && G.cause === 'spring') left = 0;
    left = Math.max(0, left);
    var sec = left * BEAT;
    setText(ui.springText, 'st', sec.toFixed(1));
    var frac = Math.max(0, Math.min(1, left / G.springMax));
    var w = (frac * 100).toFixed(1) + '%';
    if (hudCache.w !== w) { hudCache.w = w; ui.fill.style.width = w; }
    var cls = sec <= 2.5 ? 'danger' : sec <= 5 ? 'warn' : '';
    if (hudCache.cls !== cls) {
      hudCache.cls = cls;
      ui.spring.classList.toggle('warn', cls === 'warn');
      ui.spring.classList.toggle('danger', cls === 'danger');
    }
    // Time-star flag: where the bar will be when the par time runs out.
    var total = L.spring + Sim.popcount(s.winders) * L.winderBonus;
    var parLeft = total - G.def.par;
    var parPos = parLeft > 0 ? (Math.min(1, parLeft / G.springMax) * 100).toFixed(1) + '%' : '';
    if (hudCache.par !== parPos) {
      hudCache.par = parPos;
      ui.par.style.display = parPos ? '' : 'none';
      if (parPos) ui.par.style.left = parPos;
    }
    var missed = parLeft > 0 && left < parLeft - 1e-6;
    if (hudCache.missed !== missed) { hudCache.missed = missed; ui.par.classList.toggle('missed', missed); }
    var nk = L.keys.length, got = Sim.popcount(s.keys);
    var flying = 0;
    for (var i = 0; i < parts.length; i++) if (parts[i].k === 'fly') flying++;
    setText(ui.keysText, 'k', (got - flying) + '/' + nk);
  }

  // ------------------------------------------------------------ rendering
  var bgShaken = false;
  function render() {
    var dpr = view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!G.L) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (vis.shake > 0.005) {
      var a = vis.shake * view.T * 0.25;
      var sx = (Math.random() - 0.5) * a, sy = (Math.random() - 0.5) * a;
      ctx.translate(sx, sy);
      staticCanvas.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      bgShaken = true;
    } else if (bgShaken) {
      staticCanvas.style.transform = '';
      bgShaken = false;
    }
    drawFlats();
    drawSorted();
    drawParts();
    ctx.restore();
  }

  function started() { return !!G.cur && (G.phase === 'run' || G.phase === 'dead' || G.phase === 'won' || (G.phase === 'paused' && G.prevPhase === 'run')); }
  function curBeat() { return started() ? G.cur.s0.b : (G.s ? G.s.b : 0); }
  function curP() { return started() ? Math.min(1, G.p) : 0; }

  // Height of a pop-up block (0 = flat, 1 = up) at this moment.
  function pistonHeight(i) {
    var L = G.L, b = curBeat(), p = curP();
    var g = L.pistonGroup[i];
    var h0 = Sim.pistonUp(L, g, b) ? 1 : 0;
    var h1 = Sim.pistonUp(L, g, b + 1) ? 1 : 0;
    if (!started()) return h0 && G.s.pos !== i ? 1 : 0;
    var cur = G.cur;
    var onStart = cur.s0.pos === i, onEnd = cur.res.state.pos === i;
    if (onStart) h0 = 0;
    if (onEnd) h1 = 0;
    if (h0 === h1) return h0;
    if (h1 && onStart) return easeOut((p - 0.55) / 0.3);
    var t = easeOut(p / 0.3);
    return h1 ? t : 1 - t;
  }

  function pistonWarn(i) {
    var L = G.L, b = curBeat(), g = L.pistonGroup[i];
    if (Sim.pistonUp(L, g, b + 1)) return 0;
    if (!Sim.pistonUp(L, g, b + 2)) return 0;
    return 0.5 + 0.5 * Math.sin(G.time * 18);
  }

  function exitSide(i) {
    var q = tileXY(i), L = G.L;
    if (q.y === 0) return 0;
    if (q.x === L.w - 1) return 1;
    if (q.y === L.h - 1) return 2;
    if (q.x === 0) return 3;
    return -1;
  }

  function drawFlats() {
    var L = G.L, T = view.T, t = G.time, s = G.s;
    var cur = G.cur, running = started();
    var crumbled = s.crumbled;
    var toyTile = running && cur ? cur.s0.pos : s.pos;
    for (var i = 0; i < L.n; i++) {
      var tt = L.tile[i];
      if (tt === Sim.FLOOR || tt === Sim.WALL || tt === Sim.HOLE) continue;
      var q = tileXY(i), x = px(q.x), y = py(q.y);
      if (tt === Sim.ARROW) Draw.arrowPad(ctx, x, y, T, L.arrowDir[i], t);
      else if (tt === Sim.EXIT) Draw.exitDoor(ctx, x, y, T, exitSide(i), t);
      else if (tt === Sim.PIPE) Draw.tube(ctx, x, y, T, L.pipeId[i], t, tubePulse[i] || 0);
      else if (tt === Sim.PISTON) Draw.pistonBase(ctx, x, y, T, L.pistonGroup[i], pistonWarn(i));
      else if (tt === Sim.CRUMBLE) {
        var bit = 1 << L.crumbleIndex[i];
        var gone = crumbled & bit;
        if (gone) {
          Draw.hole(ctx, x, y, T);
          var a = crumbleAnim[i];
          if (a !== undefined && a < 1) {
            ctx.save();
            ctx.globalAlpha = 1 - a;
            ctx.translate(x + T / 2, y + T / 2 + a * T * 0.2);
            ctx.scale(1 - a * 0.6, 1 - a * 0.6);
            Draw.cookie(ctx, -T / 2, -T / 2, T, true, q.x, q.y);
            ctx.restore();
          }
        } else {
          var onIt = toyTile === i || (running && cur && cur.res.state.pos === i && G.p > 0.5);
          Draw.cookie(ctx, x, y, T, onIt, q.x, q.y, onIt && running && G.phase === 'run');
        }
      }
    }
    if (G.def.marks && G.mode === 'play' && !G.demo) {
      G.def.marks.forEach(function (m) { Draw.turnMark(ctx, px(m[0] + 0.5), py(m[1] + 0.5), T, t); });
    }
    // Next-turn chevron
    var qn = G.queued % 4;
    if (qn && (G.phase === 'run' || G.phase === 'winding')) {
      var at = G.phase === 'run' ? cur.res.state : G.s;
      if (at.status === 0 || G.phase === 'winding') {
        var nq = tileXY(at.pos);
        var forced = Sim.isForced(L, at) && G.phase === 'run';
        var nd = (at.dir + qn) % 4;
        ctx.save();
        if (forced) ctx.globalAlpha = 0.35;
        Draw.heading(ctx, px(nq.x + 0.5), py(nq.y + 0.5), T, nd * Math.PI / 2, qn, (G.time - G.lastTap) < 0.15 ? 1 - (G.time - G.lastTap) / 0.15 : 0);
        ctx.restore();
      }
    }
  }

  function drawSorted() {
    var L = G.L, T = view.T, t = G.time, s = G.s;
    var list = [];
    var b = curBeat(), p = curP();
    for (var r = 0; r < L.h; r++) if (view.strips[r]) list.push({ key: r + 1, strip: r });
    // pop-up blocks
    for (var pi = 0; pi < L.pistons.length; pi++) {
      var ti = L.pistons[pi], h = pistonHeight(ti);
      if (h > 0.01) { var pq = tileXY(ti); list.push({ key: pq.y + 1 - 0.001, piston: ti, h: h }); }
    }
    // items
    L.keys.forEach(function (ti, k) {
      if (s.keys & (1 << k)) return;
      var q = tileXY(ti);
      list.push({ key: q.y + 1.01, item: 'key', x: q.x, y: q.y });
    });
    L.winders.forEach(function (ti, k) {
      if (s.winders & (1 << k)) return;
      var q = tileXY(ti);
      list.push({ key: q.y + 1.01, item: 'winder', x: q.x, y: q.y });
    });
    // marbles
    var frozenP = p;
    L.marbles.forEach(function (m, mi) {
      var a = tileXY(Sim.marblePos(L, m, b)), c = tileXY(Sim.marblePos(L, m, b + 1));
      var mp = frozenP;
      var mx = lerp(a.x, c.x, mp), my = lerp(a.y, c.y, mp);
      var roll = (b + mp) * 2.2 * (c.x - a.x + c.y - a.y);
      list.push({ key: my + 1.02, marble: mi, x: mx, y: my, roll: roll, col: m.color, dx: c.x - a.x, dy: c.y - a.y });
    });
    // toy
    var toy = toyState();
    if (toy) list.push({ key: toy.y + 1.03, toy: toy });

    list.sort(function (u, v) { return u.key - v.key; });
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.strip !== undefined) {
        ctx.drawImage(view.strips[e.strip], view.ox, py(e.strip) - view.d - 1, view.strips[e.strip].width / view.dpr, view.strips[e.strip].height / view.dpr);
      } else if (e.piston !== undefined) {
        var q = tileXY(e.piston);
        var col = C.piston[L.pistonGroup[e.piston]];
        var hh = e.h;
        var jig = 0;
        if (started() && G.p > 0.45 && Sim.pistonUp(L, L.pistonGroup[e.piston], b + 1) && !Sim.pistonUp(L, L.pistonGroup[e.piston], b + 2)) {
          jig = Math.sin(G.time * 55) * T * 0.025;   // about to sink
        }
        ctx.save();
        ctx.translate(jig, 0);
        Draw.block(ctx, px(q.x), py(q.y), T, col, view.d * hh, null);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        Draw.pistonEmblem(ctx, px(q.x + 0.5), py(q.y + 0.5) - view.d * hh, T, L.pistonGroup[e.piston]);
        ctx.fill();
        ctx.restore();
      } else if (e.item === 'key') {
        Draw.goldKey(ctx, px(e.x + 0.5), py(e.y + 0.5), T, t + e.x * 0.7);
      } else if (e.item === 'winder') {
        Draw.winder(ctx, px(e.x + 0.5), py(e.y + 0.5), T, t + e.y * 0.5);
      } else if (e.marble !== undefined) {
        // faint trail shows which way the marble is rolling
        var mc = C.marbles[e.col % C.marbles.length][0];
        ctx.fillStyle = mc;
        for (var g = 1; g <= 2; g++) {
          ctx.globalAlpha = 0.28 / g;
          Draw.ellipse(ctx, px(e.x + 0.5 - e.dx * 0.28 * g), py(e.y + 0.5 - e.dy * 0.28 * g), T * (0.26 - g * 0.05), T * (0.26 - g * 0.05));
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        Draw.marble(ctx, px(e.x + 0.5), py(e.y + 0.5) - T * 0.02, T, e.col, e.roll);
      } else if (e.toy) {
        drawToy(e.toy);
      }
    }
  }

  function toyState() {
    var s = G.s, L = G.L;
    var pos = toyNow();
    var o = { x: pos.x, y: pos.y, ang: vis.ang, walk: vis.walk, keySpin: vis.keySpin, blink: vis.blink, scale: 1, alpha: 1, squash: 0, tilt: 0, skin: currentSkin() };
    var ph = G.phase === 'paused' ? G.prevPhase : G.phase;
    if (ph === 'intro' || ph === 'ready') {
      o.squash = Math.sin(G.time * 3) * 0.03;
    } else if (ph === 'winding') {
      o.squash = Math.sin(G.windT * 40) * 0.06;
      o.tilt = Math.sin(G.windT * 30) * 0.05;
    } else if (ph === 'run' && G.cur) {
      var ev = G.cur.res.ev;
      if (ev.teleport >= 0 && G.p > 0.55) {
        var k = (G.p - 0.55) / 0.45;
        o.scale = Math.max(0, 1 - k);
        o.tilt = k * 3;
      }
      if (G.cur.popOut) {
        var k2 = Math.min(1, G.p / 0.3);
        o.scale = Math.min(o.scale, 0.2 + 0.8 * k2 + Math.sin(k2 * Math.PI) * 0.25);
      }
      if (ev.kind === 'bonk' && G.p > BONK_AT) {
        var w = (G.p - BONK_AT) / (1 - BONK_AT);
        o.squash = Math.sin(w * Math.PI * 3) * 0.12 * (1 - w);
      }
      if (ev.arrow >= 0 && G.p > 0.8) o.squash = -0.05;
    } else if (ph === 'won') {
      var ev2 = G.cur.res.ev;
      var e = Math.min(1, G.endT / 0.45);
      o.x += Sim.DX[ev2.dir] * e * 0.6;
      o.y += Sim.DY[ev2.dir] * e * 0.6;
      o.scale = 1 - e * 0.7;
      o.alpha = 1 - e;
      o.walk = vis.walk + G.endT * 20;
      if (e >= 1) return null;
    } else if (ph === 'dead') {
      var d = G.endT;
      if (G.cause === 'marble') {
        var ev3 = G.cur.res.ev;
        var side = Sim.DX[ev3.dir] >= 0 ? -1 : 1;
        o.tilt = side * Math.min(1, d * 5) * Math.PI / 2 * (1 + Math.sin(Math.min(1, d * 5) * Math.PI) * 0.15);
        o.dizzy = true;
        o.y -= Math.sin(Math.min(1, d * 4) * Math.PI) * 0.25;
      } else if (G.cause === 'fall') {
        var f = Math.min(1, d / 0.7);
        var tq = tileXY(G.cur.res.ev.to);
        o.x = lerp(o.x, tq.x, Math.min(1, d * 6));
        o.y = lerp(o.y, tq.y, Math.min(1, d * 6)) + f * 0.2;
        o.scale = 1 - f;
        o.tilt = f * 6;
        o.shadow = false;
        if (f >= 1) return null;
      } else {
        o.sleepy = true;
        o.squash = Math.min(0.1, d * 0.2);
        o.tilt = Math.min(0.25, d * 0.4);
        o.walk = 0;
      }
    }
    return o;
  }

  function drawToy(o) {
    var T = view.T;
    var cx = px(o.x + 0.5), cy = py(o.y + 0.5);
    Draw.toy(ctx, cx, cy, T, o);
    if (o.dizzy) {
      for (var i = 0; i < 3; i++) {
        var a = G.time * 5 + i * TAU / 3;
        ctx.fillStyle = '#ffd43b';
        Draw.star(ctx, cx + Math.cos(a) * T * 0.3, cy - T * 0.5 + Math.sin(a) * T * 0.1, T * 0.09, T * 0.04, 5, a);
        ctx.fill();
      }
    }
    if (o.sleepy && G.endT > 0.5) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = T * 0.04;
      ctx.font = '700 ' + Math.round(T * 0.3) + 'px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      for (var z = 0; z < 3; z++) {
        var tz = ((G.endT - 0.5) * 0.8 + z / 3) % 1;
        ctx.globalAlpha = Math.sin(tz * Math.PI);
        var zx = cx + T * (0.2 + tz * 0.3), zy = cy - T * (0.5 + tz * 0.6);
        ctx.strokeText('z', zx, zy);
        ctx.fillText('z', zx, zy);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawParts() {
    var T = view.T;
    for (var i = 0; i < parts.length; i++) {
      var q = parts[i];
      var a = Math.max(0, q.life / q.max);
      if (q.k === 'spark' || q.k === 'crumb') {
        ctx.globalAlpha = Math.min(1, a * 1.5);
        ctx.fillStyle = q.c;
        if (q.k === 'spark') Draw.star(ctx, px(q.x), py(q.y), T * q.s, T * q.s * 0.45, 4, q.life * 6);
        else Draw.ellipse(ctx, px(q.x), py(q.y), T * q.s, T * q.s);
        ctx.fill();
      } else if (q.k === 'conf') {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.save();
        ctx.translate(px(q.x), py(q.y));
        ctx.rotate(q.rot);
        ctx.fillStyle = q.c;
        ctx.fillRect(-T * q.s / 2, -T * q.s * 0.3, T * q.s, T * q.s * 0.6 * Math.abs(Math.cos(q.rot * 1.7)));
        ctx.restore();
      } else if (q.k === 'puff') {
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = '#ffffff';
        Draw.ellipse(ctx, px(q.x), py(q.y), T * (0.1 + (1 - a) * 0.12), T * (0.06 + (1 - a) * 0.06));
        ctx.fill();
      } else if (q.k === 'ring') {
        ctx.globalAlpha = a;
        ctx.strokeStyle = q.c;
        ctx.lineWidth = T * 0.06;
        Draw.ellipse(ctx, px(q.x), py(q.y), T * (0.5 - a * 0.25), T * (0.36 - a * 0.18));
        ctx.stroke();
      } else if (q.k === 'text') {
        var pop = Math.min(1, (q.max - q.life) / 0.12);
        ctx.globalAlpha = Math.min(1, a * 2.5);
        ctx.font = '700 ' + Math.round(T * q.s * (0.7 + 0.3 * pop)) + 'px Fredoka, "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = T * 0.09;
        ctx.strokeStyle = '#fff';
        ctx.lineJoin = 'round';
        ctx.strokeText(q.text, px(q.x), py(q.y));
        ctx.fillStyle = q.c;
        ctx.fillText(q.text, px(q.x), py(q.y));
      } else if (q.k === 'bubble') {
        ctx.globalAlpha = Math.min(1, a * 3);
        var bx = px(q.x), by = py(q.y) - (1 - a) * T * 0.2;
        ctx.font = '700 ' + Math.round(T * 0.3) + 'px Fredoka, sans-serif';
        var tw = ctx.measureText(q.text).width + T * 0.36;
        ctx.fillStyle = '#9775fa';
        Draw.rr(ctx, bx - tw / 2, by - T * 0.22, tw, T * 0.44, T * 0.22);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(q.text, bx, by + T * 0.01);
      } else if (q.k === 'fly') {
        var k = 1 - a;
        var e = easeInOut(k);
        var fx = lerp(q.sx, q.tx, e), fy = lerp(q.sy, q.ty, e) - Math.sin(k * Math.PI) * 60;
        ctx.globalAlpha = 1;
        Draw.goldKey(ctx, fx, fy, T * (1 - k * 0.4), 0, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------- menus
  function buildLevelGrid() {
    ui.grid.innerHTML = '';
    var current = firstOpenLevel();
    LEVELS.forEach(function (def, i) {
      var b = document.createElement('button');
      var col = C.blocks[i % C.blocks.length];
      b.className = 'lvl';
      b.style.setProperty('--bg', col[0]);
      b.style.setProperty('--bd', col[1]);
      b.style.animationDelay = (i * 22) + 'ms';
      var locked = !isUnlocked(i);
      if (locked) b.classList.add('locked');
      if (i === current && !locked) b.classList.add('current');
      var st = save.stars[i] || 0;
      b.innerHTML = '<span class="lvl-num">' + (i + 1) + '</span>' + (locked ? '<span class="lock" aria-hidden="true"></span>' :
        '<span class="lvl-stars"><i class="' + (st > 0 ? 'on' : '') + '"></i><i class="' + (st > 1 ? 'on' : '') + '"></i><i class="' + (st > 2 ? 'on' : '') + '"></i></span>');
      b.setAttribute('aria-label', 'Room ' + (i + 1) + ' ' + def.name + (locked ? ' (locked)' : ', ' + st + ' stars'));
      b.addEventListener('click', function () {
        Sound.unlock();
        if (locked) {
          Sound.sfx.locked();
          flashToast('Escape room ' + i + ' first!');
          return;
        }
        Sound.sfx.ui();
        startLevel(i);
      });
      ui.grid.appendChild(b);
    });
    ui.total.textContent = totalStars() + '/' + LEVELS.length * 3;
    buildSkins();
  }

  function buildSkins() {
    var box = $('skins');
    box.innerHTML = '';
    var cur = currentSkin();
    C.skins.forEach(function (sk, i) {
      var b = document.createElement('button');
      var open = skinUnlocked(i);
      b.className = 'skin' + (sk === cur ? ' on' : '') + (open ? '' : ' locked');
      b.setAttribute('aria-label', sk.name + (open ? '' : ' (needs ' + sk.stars + ' stars)'));
      var c = document.createElement('canvas');
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = 46 * dpr; c.height = 46 * dpr;
      var cx2 = c.getContext('2d');
      cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
      Draw.toy(cx2, 23, 26, 40, { ang: Math.PI, walk: 0, keySpin: 0.6 + i, skin: sk, shadow: false });
      b.appendChild(c);
      if (!open) {
        var need = document.createElement('span');
        need.className = 'need';
        need.textContent = '\u2605' + sk.stars;
        b.appendChild(need);
      }
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        Sound.unlock();
        if (!open) { Sound.sfx.locked(); flashToast('Collect ' + sk.stars + ' stars to unlock ' + sk.name + '!'); return; }
        save.skin = i;
        writeSave();
        Sound.sfx.windup();
        buildSkins();
      });
      box.appendChild(b);
    });
  }

  function drawIntroIcon(kind) {
    var c = ui.introIco, cx2 = c.getContext('2d');
    var T = 56, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 72 * dpr; c.height = 72 * dpr;
    cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx2.clearRect(0, 0, 72, 72);
    var x = 8, y = 10;
    Draw.floor(cx2, x, y, T, 0, 0);
    var t = 0.3;
    switch (kind) {
      case 'turn': case 'left':
        Draw.toy(cx2, x + T / 2, y + T / 2, T, { ang: Math.PI / 2, walk: 0, keySpin: 0.5, skin: currentSkin() });
        Draw.turnMark(cx2, x + T / 2, y + T / 2, T * 1.1, 1);
        break;
      case 'bonk': Draw.block(cx2, x, y + 4, T, C.blocks[1], T * 0.22, 'B'); break;
      case 'winder': Draw.winder(cx2, x + T / 2, y + T / 2, T * 1.2, t); break;
      case 'hole': Draw.hole(cx2, x, y, T); break;
      case 'arrow': Draw.arrowPad(cx2, x, y, T, 1, t); break;
      case 'marble': Draw.marble(cx2, x + T / 2, y + T / 2, T * 1.3, 0, 0.6); break;
      case 'piston': Draw.pistonBase(cx2, x, y, T, 0, 0); Draw.block(cx2, x, y + 4, T, C.piston[0], T * 0.2, null); break;
      case 'crumble': Draw.cookie(cx2, x, y, T, true, 1, 2); break;
      case 'pipe': Draw.tube(cx2, x, y, T, 1, t, 0); break;
    }
  }

  // Title mascot
  var titleT = 0, titleHop = 0;
  function drawTitleToy(dt) {
    var c = ui.titleToy;
    if (G.mode !== 'title') return;
    titleT += dt;
    titleHop = Math.max(0, titleHop - dt * 2.2);
    var cx2 = c.getContext('2d');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var size = c.clientWidth || 150;
    if (c.width !== Math.round(size * dpr)) { c.width = Math.round(size * dpr); c.height = Math.round(size * dpr); }
    cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx2.clearRect(0, 0, size, size);
    var T = size * 0.62;
    var hop = Math.sin(titleHop * Math.PI) * size * 0.18;
    Draw.toy(cx2, size / 2, size * 0.58 - hop, T, {
      ang: Math.PI + Math.sin(titleT * 0.9) * 0.6, walk: titleT * 9, keySpin: titleT * 6 + titleHop * 20,
      blink: (titleT % 3.2) < 0.12 ? 1 : 0, squash: Math.sin(titleT * 9) * 0.02, skin: currentSkin()
    });
  }

  function refreshToggles() {
    var on = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke-width="2.2" stroke-linecap="round"/></svg>';
    var off = '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke-width="2.2" stroke-linecap="round"/></svg>';
    var mOn = '<svg viewBox="0 0 24 24"><path d="M9 17.5V6l10-2v11.5" fill="none" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="16.5" cy="15.5" r="2.8"/></svg>';
    var mOff = '<svg viewBox="0 0 24 24"><path d="M9 17.5V6l10-2v11.5" fill="none" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="16.5" cy="15.5" r="2.8"/><path d="M3 3l18 18" stroke-width="2.4" stroke-linecap="round"/></svg>';
    ['btn-sound', 'btn-sound2'].forEach(function (id) {
      var b = $(id); b.innerHTML = save.sound ? on : off; b.classList.toggle('off', !save.sound);
      b.setAttribute('aria-pressed', save.sound ? 'true' : 'false');
    });
    ['btn-music', 'btn-music2'].forEach(function (id) {
      var b = $(id); b.innerHTML = save.music ? mOn : mOff; b.classList.toggle('off', !save.music);
      b.setAttribute('aria-pressed', save.music ? 'true' : 'false');
    });
  }

  // ---------------------------------------------------------- wiring
  function onClick(id, fn) {
    $(id).addEventListener('click', function (e) {
      e.stopPropagation();
      Sound.unlock();
      fn(e);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }

  onClick('btn-play', function () { Sound.sfx.ui(); goLevels(); });
  onClick('btn-levels-back', function () { Sound.sfx.back(); goTitle(); });
  onClick('btn-pause', function () { Sound.sfx.ui(); pause(); });
  onClick('btn-resume', function () { Sound.sfx.ui(); resume(); });
  onClick('btn-restart', function () { Sound.sfx.ui(); retry(); });
  onClick('btn-quit', function () { Sound.sfx.back(); goLevels(); });
  onClick('btn-levels', function () { Sound.sfx.back(); goLevels(); });
  onClick('btn-retry', function () { Sound.sfx.ui(); retry(); });
  onClick('btn-next', function () { Sound.sfx.ui(); nextLevel(); });
  onClick('btn-show', function () { Sound.sfx.ui(); startDemo(); });
  // Two taps to erase progress; embedded browsers often suppress confirm().
  var resetTimer = null;
  onClick('btn-reset', function () {
    var btn = $('btn-reset');
    clearTimeout(resetTimer);
    if (btn.getAttribute('data-armed')) {
      save.stars = []; save.best = []; save.skin = 0; writeSave(); buildLevelGrid();
      btn.removeAttribute('data-armed');
      btn.textContent = 'Progress erased';
      Sound.sfx.back();
      resetTimer = setTimeout(function () { btn.textContent = 'Reset progress'; }, 2000);
    } else {
      btn.setAttribute('data-armed', '1');
      btn.textContent = 'Tap again to erase all stars';
      Sound.sfx.locked();
      resetTimer = setTimeout(function () { btn.removeAttribute('data-armed'); btn.textContent = 'Reset progress'; }, 3000);
    }
  });
  function toggleSound() { save.sound = !save.sound; Sound.setSound(save.sound); writeSave(); refreshToggles(); Sound.sfx.ui(); }
  function toggleMusic() { save.music = !save.music; Sound.setMusic(save.music); writeSave(); refreshToggles(); }
  onClick('btn-sound', toggleSound);
  onClick('btn-sound2', toggleSound);
  onClick('btn-music', toggleMusic);
  onClick('btn-music2', toggleMusic);
  ui.titleToy.addEventListener('pointerdown', function () { Sound.unlock(); titleHop = 1; Sound.sfx.windup(); });

  app.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') setKeyMode(false);
    try { window.focus(); } catch (err) { /* cross-origin frame */ }
    var tgt = e.target;
    if (tgt.closest && tgt.closest('button, .screen, #card-result, #card-pause')) return;
    if (G.mode !== 'play') return;
    e.preventDefault();
    onTap();
  });
  app.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // iOS only lets audio start from touchend/click, so unlock there as well.
  document.addEventListener('touchend', function () { Sound.unlock(); }, { passive: true });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      setKeyMode(true);
      primaryAction();
    } else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
    } else if (k === 'Escape' || k === 'p' || k === 'P') {
      if (G.mode === 'play') {
        if (!ui.result.classList.contains('hidden')) goLevels();
        else if (G.phase === 'paused') resume();
        else if (G.demo) stopDemo();
        else pause();
      } else if (G.mode === 'levels') goTitle();
    } else if (k === 'r' || k === 'R') {
      if (G.mode === 'play' && !G.demo && (G.phase !== 'intro')) retry();
    }
  });

  function setKeyMode(on) {
    if (hasKeys === on) return;
    hasKeys = on;
    document.body.classList.toggle('has-keys', on);
    if (G.mode === 'play' && G.phase === 'ready') enterReady();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pause(); Sound.suspend(); } else Sound.resume();
  });
  window.addEventListener('blur', function () { pause(); });
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  // ---------------------------------------------------------- main loop
  var last = 0, looping = true, menuSkip = false;
  function frame(ts) {
    if (!looping) return;
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
    last = ts;
    update(dt);
    drawTitleToy(dt);
    // Menus sit on a blurred backdrop; redraw it at half rate to spare phones.
    menuSkip = G.mode === 'play' ? false : !menuSkip;
    if (!menuSkip) render();
    window.requestAnimationFrame(frame);
  }

  // Test hooks (used by the automated play-through; harmless for players).
  window.WGame = {
    state: function () { return { mode: G.mode, phase: G.phase, li: G.li, beat: G.s && G.s.b, pos: G.s && G.s.pos, p: G.p, queued: G.queued, keys: G.s && G.s.keys, stars: save.stars.slice() }; },
    startLevel: startLevel, tap: onTap, primary: primaryAction, retry: retry, goLevels: goLevels,
    advance: function (dt, skipRender) { update(dt); if (!skipRender) render(); },
    stopLoop: function () { looping = false; },
    solution: solutionFor
  };

  // ---------------------------------------------------------- boot
  setKeyMode(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  Sound.setSound(save.sound);
  Sound.setMusic(save.music);
  refreshToggles();
  resize();
  goTitle();
  window.requestAnimationFrame(frame);
  // Block letters are pre-rendered, so redraw them once the web font arrives.
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { layoutBoard(); });
  }
  try { window.focus(); } catch (e) { /* ignore */ }
})();
