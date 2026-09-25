/* CIRCUIT SIEGE — application controller: loop, match lifecycle, rewards, settings */
(function () {
  'use strict';
  const CS = window.CS;
  const U = CS.U;
  const UI = CS.UI;
  const S = CS.Save;
  const P = CS.PROG;
  const $ = UI.$;

  const QUAL_ORDER = ['low', 'medium', 'high'];
  const DPR_CAP = { low: 1, medium: 1.5, high: 2 };

  // ───────────────────────── Menu background (lightweight animated circuit board)
  class MenuBG {
    constructor(cv) {
      this.cv = cv; this.x = cv.getContext('2d');
      this.traces = []; this.pulses = []; this.bits = [];
      this.resize();
    }
    resize() {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.cv.width = this.w * dpr; this.cv.height = this.h * dpr;
      this.x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const r = U.rng(7);
      this.traces = [];
      for (let i = 0; i < 38; i++) {
        let px = Math.round((r() * this.w) / 30) * 30, py = Math.round((r() * this.h) / 30) * 30;
        const pts = [[px, py]];
        for (let k = 0; k < 5; k++) { if (r() < 0.5) px += (r() < 0.5 ? -1 : 1) * (60 + Math.round(r() * 5) * 30); else py += (r() < 0.5 ? -1 : 1) * (60 + Math.round(r() * 5) * 30); pts.push([px, py]); }
        this.traces.push(pts);
      }
      this.bits = [];
      const types = ['frag', 'zip', 'shield', 'ghost', 'breaker', 'splitter'];
      for (let i = 0; i < 12; i++) this.bits.push({ x: r() * this.w, y: r() * this.h, v: 10 + r() * 25, t: types[i % types.length], a: r() * 6 });
    }
    draw(t) {
      const x = this.x;
      const g = x.createLinearGradient(0, 0, this.w, this.h);
      g.addColorStop(0, '#070b12'); g.addColorStop(1, '#0c1420');
      x.fillStyle = g; x.fillRect(0, 0, this.w, this.h);
      x.strokeStyle = 'rgba(57,208,255,0.035)'; x.lineWidth = 1;
      x.beginPath();
      for (let gx = 0; gx < this.w; gx += 30) { x.moveTo(gx, 0); x.lineTo(gx, this.h); }
      for (let gy = 0; gy < this.h; gy += 30) { x.moveTo(0, gy); x.lineTo(this.w, gy); }
      x.stroke();
      x.lineWidth = 2;
      for (let i = 0; i < this.traces.length; i++) {
        const tr = this.traces[i];
        x.strokeStyle = i % 5 === 0 ? 'rgba(255,181,71,0.12)' : 'rgba(57,208,255,0.12)';
        x.beginPath(); tr.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
        const ph = (t * 0.12 + i * 0.173) % 1;
        const seg = Math.floor(ph * (tr.length - 1)), f = ph * (tr.length - 1) - seg;
        const p0 = tr[seg], p1 = tr[seg + 1];
        x.fillStyle = i % 5 === 0 ? '#ffb547' : '#8ff0ff';
        x.fillRect(p0[0] + (p1[0] - p0[0]) * f - 2, p0[1] + (p1[1] - p0[1]) * f - 2, 4, 4);
      }
      x.globalAlpha = 0.18;
      for (const b of this.bits) {
        const px = (b.x + t * b.v) % (this.w + 60) - 30;
        const spr = CS.Spr.enemy(b.t);
        const s = spr.size * 1.6;
        x.drawImage(spr.c, px - s / 2, b.y + Math.sin(t + b.a) * 10 - s / 2, s, s);
      }
      x.globalAlpha = 1;
    }
  }

  // ───────────────────────── App
  class App {
    constructor() {
      S.load();
      this.menuBG = new MenuBG($('#menu-bg'));
      this.renderer = new CS.Renderer($('#cv'));
      this.renderer.skinFor = (t) => S.skinOf(t);
      this.hud = new CS.Hud(this);
      this.menus = new CS.Menus(this);
      this.match = null;
      this.screen = 'menu';
      this.autoQ = 'high';
      this.fps = { frames: 0, time: 0, value: 60, low: 0 };
      this.last = performance.now();
      this.t = 0;
      S.listeners.push((kind, a) => {
        if (kind === 'achievement') { UI.toast('ACHIEVEMENT UNLOCKED', `<b>${U.esc(a.name)}</b> — ${U.esc(a.desc)} <span class="dc">${a.chips}</span>`, 'ach', 4.5); CS.sfx('achievement'); }
      });
      this.applySettings();
      this.bindGlobal();
      this.menus.show('main');
      CS.Audio.music('menu');
      requestAnimationFrame((t) => this.frame(t));
      if (!S.data.tutorialDone && !S.data.stats.games) setTimeout(() => this.offerTutorial(), 400);
    }

    offerTutorial() {
      const m = UI.modal(`<h2>WELCOME, OPERATOR</h2><div class="sub">The network is under siege by corrupted programs. Want a quick hands-on briefing? It takes about 5 minutes.</div><div class="modal-actions"><button class="btn ghost" data-a="n">Skip for now</button><button class="btn primary" data-a="y">Start Tutorial</button></div>`, { width: 480 });
      m.querySelector('[data-a=n]').onclick = () => UI.closeModal(m);
      m.querySelector('[data-a=y]').onclick = () => { UI.closeModal(m); this.startTutorial(); };
    }

    bindGlobal() {
      const unlock = () => { CS.Audio.unlock(); if (CS.Audio.track && CS.Audio.ready) CS.Audio.startSeqIfIdle(); };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      window.addEventListener('resize', () => this.onResize());
      document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
        if (this.screen === 'game') {
          if (this.hud.onKey(e)) { e.preventDefault(); }
          else if (e.key === 'Escape' && UI.hasModal()) { UI.closeModal(); }
        } else if (e.key === 'Escape') {
          if (UI.hasModal()) UI.closeModal();
          else if (this.menus.current !== 'main') this.menus.show('main');
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.match && this.screen === 'game' && !this.match.paused && this.match.state === 'play') this.hud.togglePause();
        if (document.hidden) S.save(true);
      });
      window.addEventListener('beforeunload', () => S.save(true));
      window.addEventListener('contextmenu', (e) => { if (this.screen === 'game') e.preventDefault(); });
    }

    effectiveQuality() {
      const q = S.data.settings.quality;
      return q === 'auto' ? this.autoQ : q;
    }

    applySettings() {
      const st = S.data.settings;
      CS.Audio.setVolumes({ master: st.master, music: st.music, sfx: st.sfx });
      const q = this.effectiveQuality();
      this.renderer.setQuality(q);
      if (this.match) { this.match.fx.setQuality(q); this.match.fx.shakeOn = st.shake; this.match.fx.dmgNumbers = st.dmgNumbers; this.match.autoStart = st.autoStart && !this.match.tutorial; $('#chk-auto').checked = this.match.autoStart; }
      $('#tb-fps').style.display = st.showFps ? '' : 'none';
      this.renderer.coreSkin = P.CORE_SKINS[S.data.coreSkin] || P.CORE_SKINS.standard;
      this.onResize();
    }

    onResize() {
      this.menuBG.resize();
      if (this.screen === 'game') {
        const st = $('#stage');
        this.renderer.resize(st.clientWidth, st.clientHeight, DPR_CAP[this.effectiveQuality()]);
      }
    }

    show(screen) {
      this.screen = screen;
      $('#menu').classList.toggle('active', screen === 'menu');
      $('#game').classList.toggle('active', screen === 'game');
      $('#menu-bg').style.display = screen === 'menu' ? '' : 'none';
    }

    // ───────────────────────── match lifecycle
    startMatch(cfg) {
      UI.closeAllModals();
      if (this.match) this.endMatchCleanup();
      this.lastCfg = cfg;
      const research = S.research();
      const mcfg = Object.assign({}, cfg, {
        research,
        masteryBonus: (t) => S.masteryBonus(t),
        tier5Locked: (t) => !S.tier5Unlocked(t),
      });
      const m = new CS.Match(mcfg);
      m.fx.setQuality(this.effectiveQuality());
      m.fx.shakeOn = S.data.settings.shake;
      m.fx.dmgNumbers = S.data.settings.dmgNumbers;
      this.match = m;
      this.paid = { waves: 0, victory: false };
      this.show('game');
      this.onResize();
      this.renderer.setMatch(m);
      this.hud.bind(m, this.renderer);
      this.updateMusic();
      S.data.stats.games++;
      S.save();
    }

    startTutorial() {
      this.startMatch({ mapId: 'green', diff: 'casual', modes: [], rules: {}, loadout: ['pulse', 'sniper', 'firewall', 'arc'], tutorial: true });
    }
    skipTutorial() {
      S.data.tutorialDone = true;
      S.save();
      UI.closeAllModals();
      this.quitMatch(true);
    }

    restartMatch() {
      this.grantRewards('quit');
      const cfg = this.lastCfg;
      this.startMatch(cfg);
    }

    quitMatch(silent) {
      if (this.match && !silent) {
        const res = this.grantRewards('quit');
        if (res.xp > 0) UI.toast('MATCH ENDED', `+${U.fmt(res.xp)} XP for waves cleared.`, 'lvl');
      }
      this.endMatchCleanup();
      this.show('menu');
      this.menus.show('main');
      CS.Audio.music('menu');
    }

    endMatchCleanup() {
      this.hud.unbind();
      this.match = null;
    }

    updateMusic() {
      const m = this.match;
      if (!m) return;
      if (m.enemies.some((e) => e.alive && e.boss)) CS.Audio.music('boss');
      else if (m.wave >= Math.max(30, Math.floor(m.maxWave * 0.66)) || m.endless) CS.Audio.music('late');
      else CS.Audio.music('game');
    }

    // Compute & grant XP / chips / mastery / stats. kind: victory | defeat | quit
    grantRewards(kind) {
      const m = this.match;
      const d = S.data;
      const out = { xp: 0, chips: 0, levels: [], unlocks: [], mastery: [], first: false };
      if (!m) return out;
      const R = S.research();
      const df = m.diff;
      let modeMult = 1;
      for (const k in m.modes) modeMult *= P.MODES[k].reward;
      const newWaves = Math.max(0, m.stats.wavesCleared - this.paid.waves);
      this.paid.waves = m.stats.wavesCleared;
      let xp = newWaves * 12 * df.xp;
      let chips = 0;
      const victoryNow = kind === 'victory' && !this.paid.victory;
      if (m.tutorial) {
        xp = victoryNow ? 260 : newWaves * 15;
        if (victoryNow) { d.tutorialDone = true; S.unlockAch('tutorial'); }
      } else if (victoryNow) {
        xp += 300 * df.xp * (1 + 0.15 * (m.def.stars - 1));
        const rec = d.maps[m.def.id] || (d.maps[m.def.id] = { done: {} });
        rec.done = rec.done || {};
        out.first = !rec.done[df.id];
        chips += m.def.chips * df.chips * modeMult * (out.first ? 2 : 1);
        rec.done[df.id] = true;
        if (!rec.best || CS.DIFF_ORDER.indexOf(df.id) > CS.DIFF_ORDER.indexOf(rec.best)) rec.best = df.id;
        if (m.cfg.daily && !d.daily[m.cfg.daily.date]) { d.daily[m.cfg.daily.date] = true; d.stats.dailies++; chips += m.cfg.daily.reward; out.daily = m.cfg.daily.reward; }
        if (m.cfg.challenge && !d.challengesDone[m.cfg.challenge.id]) { d.challengesDone[m.cfg.challenge.id] = true; d.stats.challenges++; chips += m.cfg.challenge.reward; out.challenge = m.cfg.challenge.reward; }
        d.stats.wins++;
        S.unlockAch('first_defense');
        if (m.coreHp === 1) S.unlockAch('not_even_close');
        const diffIdx = CS.DIFF_ORDER.indexOf(df.id);
        if (diffIdx >= 1 && m.stats.coreLost === 0) S.unlockAch('untouchable');
        if (diffIdx >= 2) S.unlockAch('advanced_win');
        if (diffIdx >= 3) S.unlockAch('nightmare_fuel');
        if (m.modes.onelife) S.unlockAch('one_life');
        if (diffIdx >= 1 && m.stats.towersPlaced <= 8) S.unlockAch('minimalist');
        this.paid.victory = true;
      } else if (kind === 'defeat' && !this.paid.victory) {
        chips += Math.floor(m.stats.wavesCleared * 0.6 * df.chips);
        d.stats.losses++;
      }
      if (m.endless && kind !== 'victory') chips += Math.max(0, m.stats.wavesCleared - m.diff.waves);
      if (!m.tutorial) xp *= modeMult;
      xp *= 1 + R.xpPct;
      chips *= 1 + R.chipsPct;
      xp = Math.round(xp); chips = Math.round(chips);
      out.xp = xp; out.chips = chips;
      d.chips += chips;
      // Map records
      if (!m.tutorial) {
        const rec = d.maps[m.def.id] || (d.maps[m.def.id] = { done: {} });
        rec.bestWave = Math.max(rec.bestWave || 0, m.stats.wavesCleared);
      }
      // Stats (only add the delta since last grant)
      const st = d.stats;
      const prev = this.paid.stats || { kills: 0, damage: 0, bosses: 0, creditsEarned: 0, farmCredits: 0, caches: 0 };
      st.kills += m.stats.kills - prev.kills;
      st.damage += m.stats.damage - prev.damage;
      st.bosses += m.stats.bosses - prev.bosses;
      st.creditsEarned += m.stats.creditsEarned - prev.creditsEarned;
      st.farmCredits += m.stats.farmCredits - prev.farmCredits;
      st.caches += m.stats.caches - prev.caches;
      this.paid.stats = { kills: m.stats.kills, damage: m.stats.damage, bosses: m.stats.bosses, creditsEarned: m.stats.creditsEarned, farmCredits: m.stats.farmCredits, caches: m.stats.caches };
      st.biggestHit = Math.max(st.biggestHit, Math.round(m.stats.biggestHit));
      st.highestWave = Math.max(st.highestWave, m.stats.wavesCleared);
      if (m.stats.biggestHit >= 10000) S.unlockAch('overkill');
      if (m.stats.maxChain >= 25) S.unlockAch('chain');
      if (m.stats.rootKilled) S.unlockAch('root_access');
      // Mastery (once per match end event, based on towers' contributions)
      if (!this.paid.mastery || kind !== 'quit' || true) {
        const perf = this.towerPerf(m);
        const dmult = (1 + 0.25 * CS.DIFF_ORDER.indexOf(df.id)) * (1 + R.masteryPct);
        const prevM = this.paid.mastery || {};
        const nowM = {};
        for (const type in perf) {
          const p = perf[type];
          let x = 20 + p.kills * 0.6 + p.dmg / 400 + p.earned / 25 + p.support;
          x = Math.min(4000, x * dmult);
          nowM[type] = x;
          const delta = x - (prevM[type] || 0);
          if (delta <= 0) continue;
          const ups = S.addMasteryXP(type, delta);
          st.towerUse[type] = (st.towerUse[type] || 0) + 0;
          if (ups.length) out.mastery.push({ type, lvl: ups[ups.length - 1] });
        }
        this.paid.mastery = nowM;
        if (!this.paid.useCounted) { for (const type in m.stats.towerTypes) st.towerUse[type] = (st.towerUse[type] || 0) + m.stats.towerTypes[type]; this.paid.useCounted = true; }
      }
      // XP & levels
      const lv = S.addXP(xp);
      out.levels = lv.levels; out.unlocks = lv.unlocks; out.levelChips = lv.chips;
      if (lv.levels.length) { CS.sfx('levelup'); UI.toast('LEVEL UP', `You reached level <b>${lv.levels[lv.levels.length - 1]}</b>! <span class="dc">${lv.chips}</span>`, 'lvl', 4); }
      S.checkStatAchievements();
      S.save(true);
      return out;
    }

    towerPerf(m) {
      const perf = {};
      const add = (t) => {
        const p = perf[t.type] || (perf[t.type] = { dmg: 0, kills: 0, earned: 0, support: 0 });
        p.dmg += t.dmgDealt; p.kills += t.kills; p.earned += t.earned || 0;
        if (t.type === 'amp') p.support += 25 * m.stats.wavesCleared / Math.max(1, m.towers.length / 6);
      };
      for (const t of m.towers) add(t);
      for (const t of m.soldTowers || []) add(t);
      return perf;
    }

    endScreen(kind, res) {
      const m = this.match;
      const win = kind === 'victory';
      const endlessOver = kind === 'defeat' && m.endless;
      const title = win ? (m.tutorial ? 'TRAINING COMPLETE' : 'CORE SECURED') : endlessOver ? 'ENDLESS RUN OVER' : 'CORE BREACHED';
      const sub = win ? `${m.def.name} · ${m.diff.name} · ${m.maxWave} waves` : `Reached wave ${m.wave} on ${m.def.name}`;
      const unl = [];
      for (const u of res.unlocks) unl.push(`<div class="unlock">UNLOCKED: <b>${U.esc(CS.unlockName(u))}</b></div>`);
      for (const mm of res.mastery) unl.push(`<div class="unlock">${CS.TOWERS[mm.type].name} reached <b>Mastery ${mm.lvl}</b>${P.MASTERY_REWARDS[mm.lvl] ? ' — ' + P.MASTERY_REWARDS[mm.lvl].text : ''}</div>`);
      if (res.first) unl.push('<div class="unlock"><b>FIRST CLEAR</b> on this difficulty — double Data Chips!</div>');
      if (res.daily) unl.push(`<div class="unlock"><b>DAILY PROTOCOL COMPLETE</b> <span class="dc">${res.daily}</span></div>`);
      if (res.challenge) unl.push(`<div class="unlock"><b>CHALLENGE COMPLETE</b> <span class="dc">${res.challenge}</span></div>`);
      const perfList = m.towers.slice().sort((a, b) => b.dmgDealt - a.dmgDealt).slice(0, 5);
      const maxD = perfList.length ? Math.max(1, perfList[0].dmgDealt) : 1;
      const perf = perfList.map((t) => `<div class="tp"><img src="${CS.Spr.towerIcon(t.type, t.tiers, S.skinOf(t.type), 48)}" alt=""><span style="width:120px">${t.def.name} <span style="color:var(--dim)">${t.tiers.join('-')}</span></span><div class="bar"><div style="width:${(t.dmgDealt / maxD) * 100}%"></div></div><span style="width:70px;text-align:right">${U.fmt(t.dmgDealt)}</span></div>`).join('');
      const html = `<h1 class="end-title ${win || endlessOver ? 'win' : 'lose'}">${title}</h1><div class="end-sub">${U.esc(sub)}</div>
        <div class="reward-row"><div class="reward"><div class="rv" style="color:var(--cyan2)">+${U.fmt(res.xp)}</div><div class="rl">XP</div></div><div class="reward"><div class="rv dc">${U.fmt(res.chips + (res.levelChips || 0))}</div><div class="rl">DATA CHIPS</div></div><div class="reward"><div class="rv">${S.data.level}</div><div class="rl">LEVEL</div></div></div>
        <div class="xpbar"><div style="width:${((S.data.xp / P.xpToNext(S.data.level)) * 100).toFixed(1)}%"></div></div>
        <div class="unlock-list">${unl.join('')}</div>
        <div class="sec-label">MATCH STATS</div>
        <div class="mini-stats"><div>Enemies <b>${U.fmt(m.stats.kills)}</b></div><div>Damage <b>${U.fmt(m.stats.damage)}</b></div><div>Credits earned <b>${U.fmt(m.stats.creditsEarned)}</b></div><div>Core lost <b>${U.fmt(m.stats.coreLost)}</b></div><div>Bosses <b>${m.stats.bosses}</b></div><div>Towers built <b>${m.stats.towersPlaced}</b></div></div>
        ${perf ? '<div class="sec-label">TOP TOWERS</div><div class="tower-perf">' + perf + '</div>' : ''}
        <div class="modal-actions">
          <button class="btn ghost" data-a="menu">Main Menu</button>
          ${m.tutorial ? '<button class="btn primary" data-a="play">Play Green Circuit ▶</button>' : '<button class="btn" data-a="retry">' + (win ? 'Replay' : 'Retry') + '</button>'}
          ${win && !m.tutorial ? '<button class="btn gold" data-a="endless">Continue Endless ∞</button>' : ''}
        </div>`;
      const md = UI.modal(html, { width: 700, dismiss: false });
      md.querySelector('[data-a=menu]').onclick = () => { UI.closeModal(md); this.endMatchCleanup(); this.show('menu'); this.menus.show('main'); CS.Audio.music('menu'); };
      const rt = md.querySelector('[data-a=retry]');
      if (rt) rt.onclick = () => { UI.closeModal(md); this.startMatch(this.lastCfg); };
      const pl = md.querySelector('[data-a=play]');
      if (pl) pl.onclick = () => { UI.closeModal(md); this.endMatchCleanup(); this.show('menu'); this.menus.show('play'); CS.Audio.music('menu'); };
      const en = md.querySelector('[data-a=endless]');
      if (en) en.onclick = () => { UI.closeModal(md); m.continueEndless(); this.hud.banner('ENDLESS MODE', 'How long can the Core survive?', '', 2.5); this.updateMusic(); };
    }

    onVictory() {
      const res = this.grantRewards('victory');
      setTimeout(() => { if (this.match) this.endScreen('victory', res); }, 1200);
    }
    onDefeat() {
      const res = this.grantRewards('defeat');
      CS.Audio.music(null);
      setTimeout(() => { if (this.match) this.endScreen('defeat', res); }, 1400);
    }

    showHelp() {
      const m = UI.modal('<h2>CONTROLS</h2><div class="sub">Mouse, trackpad and keyboard all work.</div>' + this.menus.keysHTML() + `<div class="sec-label">TIPS</div><div style="color:var(--muted);font-size:14px;line-height:1.4">• Armor reduces each hit by a flat amount — big hits, explosives and energy beat it.<br>• Arc Towers deal double damage to shields.<br>• Ghost Processes need towers with <b>detection</b>.<br>• Each tower can take 7 upgrades; only one path can go beyond tier 2.<br>• Data Farms pay out during each wave — invest early, profit later.</div><div class="modal-actions"><button class="btn primary" data-a="ok">Got it</button></div>`, { width: 620 });
      m.querySelector('[data-a=ok]').onclick = () => UI.closeModal(m);
    }

    // ───────────────────────── main loop
    frame(now) {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      if (this.screen === 'game' && this.match) {
        const m = this.match;
        const busy = !m.paused && !UI.hasModal();
        if (busy || m.state !== 'play') m.update(UI.hasModal() && m.state === 'play' ? 0 : dt);
        if (!m.paused && m.state === 'play') S.data.stats.timePlayed += dt;
        this.renderer.render(this.hud.ui, this.t);
        this.hud.refresh();
        this.trackFps(dt);
      } else if (this.screen === 'menu') {
        if ((this.menuFrame = (this.menuFrame || 0) + 1) % 2 === 0) this.menuBG.draw(this.t);
      }
      requestAnimationFrame((t) => this.frame(t));
    }

    trackFps(dt) {
      const f = this.fps;
      f.frames++; f.time += dt;
      if (f.time >= 2) {
        f.value = f.frames / f.time;
        f.frames = 0; f.time = 0;
        if (S.data.settings.showFps) $('#tb-fps').textContent = Math.round(f.value) + ' fps';
        if (S.data.settings.quality === 'auto' && !this.match.paused) {
          if (f.value < 42) f.low++; else f.low = 0;
          if (f.low >= 2) {
            const i = QUAL_ORDER.indexOf(this.autoQ);
            if (i > 0) { this.autoQ = QUAL_ORDER[i - 1]; this.applySettings(); UI.toast('PERFORMANCE', 'Graphics lowered to ' + this.autoQ.toUpperCase() + ' to keep things smooth.', '', 3); }
            f.low = 0;
          }
        }
      }
    }
  }

  CS.Audio.startSeqIfIdle = function () { if (CS.Audio.track && !CS.Audio._seqStarted) { CS.Audio._seqStarted = true; CS.Audio.startSeq(); } };
  const origMusic = CS.Audio.music;
  CS.Audio.music = function (name) {
    if (!name) { CS.Audio.track = null; CS.Audio.startSeq(); return; }
    if (CS.Audio.track === name) return;
    CS.Audio.track = name;
    if (CS.Audio.ready) { CS.Audio._seqStarted = true; CS.Audio.startSeq(); }
  };
  void origMusic;

  window.addEventListener('DOMContentLoaded', () => { CS.app = new App(); });
})();
