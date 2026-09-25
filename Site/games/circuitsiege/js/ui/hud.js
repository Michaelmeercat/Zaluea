/* CIRCUIT SIEGE — in-game HUD, input & event presentation */
(function () {
  'use strict';
  const CS = window.CS;
  const U = CS.U;
  const UI = CS.UI;
  const $ = UI.$;
  const S = CS.Save;

  const AB_KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  const PATH_CLS = ['pA', 'pB', 'pC'];
  const UP_KEYS = ['A', 'S', 'D'];

  class Hud {
    constructor(app) {
      this.app = app;
      this.ui = { hover: null, placing: null, placeValid: false, selectedTower: null, selectedEnemy: null, abilityTarget: null, hoverTower: null };
      this.creditsCounter = UI.counter($('#tb-credits'));
      this.lastSig = '';
      this.refreshT = 0;
      this.shiftHeld = false;
      this.wireStatic();
    }

    wireStatic() {
      const cv = $('#cv');
      cv.addEventListener('pointermove', (e) => this.onMove(e));
      cv.addEventListener('pointerdown', (e) => this.onDown(e));
      cv.addEventListener('pointerleave', () => { this.ui.hover = null; this.ui.hoverTower = null; this.hint(''); });
      cv.addEventListener('contextmenu', (e) => { e.preventDefault(); this.cancel(); });
      $('#btn-start').onclick = () => this.startWave();
      $('#btn-pause').onclick = () => this.togglePause();
      $('#btn-menu').onclick = () => this.openPauseMenu();
      document.querySelectorAll('.tb-btn.spd').forEach((b) => (b.onclick = () => this.setSpeed(+b.dataset.speed)));
      $('#chk-auto').onchange = (e) => { if (this.m) this.m.autoStart = e.target.checked; S.data.settings.autoStart = e.target.checked; S.save(); };
      UI.wireSounds($('#game'));
    }

    // ───────────────────────── lifecycle
    bind(match, renderer) {
      this.m = match;
      this.r = renderer;
      this.ui.placing = null; this.ui.selectedTower = null; this.ui.selectedEnemy = null; this.ui.abilityTarget = null; this.ui.hover = null;
      this.lastSig = '';
      this.lastInspect = '';
      match.autoStart = !!S.data.settings.autoStart && !match.tutorial;
      $('#chk-auto').checked = match.autoStart;
      $('#chk-auto').parentElement.style.display = match.tutorial ? 'none' : '';
      $('#tb-map').textContent = match.def.name + ' · ' + match.diff.name;
      const mods = [];
      for (const k in match.modes) mods.push('<span class="chip red" title="' + U.esc(CS.PROG.MODES[k].desc) + '">' + CS.PROG.MODES[k].name + '</span>');
      if (match.cfg.daily) mods.push('<span class="chip gold">DAILY</span>');
      if (match.cfg.challenge) mods.push('<span class="chip gold">' + U.esc(match.cfg.challenge.name) + '</span>');
      $('#tb-mods').innerHTML = mods.join('');
      this.creditsCounter.set(match.credits, true);
      this.buildShop();
      this.showInspector(null);
      this.setSpeed(1);
      this.renderAbilities(true);
      $('#boss-bar').classList.add('hidden');
      $('#banner').classList.add('hidden');
      $('#event-banner').classList.add('hidden');
      $('#enemy-card').classList.add('hidden');
      $('#intro-card').classList.add('hidden');
      $('#tip').classList.add('hidden');
      this.introQueue = [];
      match.listener = (type, d) => this.onEvent(type, d);
      this.updateNextWave();
      this.refresh(true);
      this.tut = match.tutorial ? new CS.Tutorial(this) : null;
      if (this.tut) this.tut.start();
    }

    unbind() {
      if (this.tut) this.tut.stop();
      this.tut = null;
      if (this.m) this.m.listener = null;
      this.m = null;
      if (this.introTimer) clearTimeout(this.introTimer);
    }

    // ───────────────────────── shop
    buildShop() {
      const shop = $('#shop');
      shop.innerHTML = '';
      this.shopEls = [];
      this.m.loadout.forEach((type, i) => {
        const def = CS.TOWERS[type];
        const b = U.el('button', 'shop-item');
        b.innerHTML = `<span class="si-key">${i + 1}</span><img src="${CS.Spr.towerIcon(type, [0, 0, 0], S.skinOf(type), 64)}" alt=""><div class="si-name">${def.name}</div><div class="si-cost">¢<span>${this.m.placeCost(type)}</span></div>`;
        b.onclick = () => this.selectShop(type);
        b.onmouseenter = () => this.showTip(type, b);
        b.onmouseleave = () => this.hideTip();
        b.dataset.type = type;
        shop.appendChild(b);
        this.shopEls.push({ el: b, type, costEl: b.querySelector('.si-cost span') });
      });
    }

    showTip(type, anchor) {
      let tip = document.getElementById('shop-tip');
      if (!tip) { tip = U.el('div', ''); tip.id = 'shop-tip'; document.getElementById('app').appendChild(tip); }
      const def = CS.TOWERS[type];
      const s = CS.buildStats(type, [0, 0, 0]);
      const rows = [];
      if (def.kind === 'farm') rows.push(['Income', '¢' + s.income + ' per wave']);
      else if (def.kind === 'amp') rows.push(['Buff', '+' + Math.round(s.buffRate * 100) + '% attack speed'], ['Radius', s.range]);
      else if (def.kind === 'aura') rows.push(['Slow', Math.round(s.auraSlow * 100) + '% in field'], ['Field', s.range]);
      else if (def.kind === 'drones') rows.push(['Drones', s.drones + ' × ' + s.droneDmg + ' dmg'], ['Leash', s.range]);
      else rows.push(['Damage', s.dmg + (s.count > 1 ? ' ×' + s.count : '') + ' ' + ({ phys: 'physical', energy: 'energy', explosive: 'explosive', toxic: 'toxic' }[s.type] || '')], ['Speed', s.rate + '/s'], ['Range', s.range]);
      const det = CS.detectInfo(type);
      rows.push(['Stealth detect', det]);
      tip.innerHTML = `<div class="st-n">${def.name} <span>¢${this.m ? U.fmt(this.m.placeCost(type)) : def.cost}</span></div><div class="st-r">${def.role}</div><div class="st-d">${U.esc(def.desc)}</div>${rows.map(([k, v]) => `<div class="st-row"><span>${k}</span><b>${v}</b></div>`).join('')}`;
      const r = anchor.getBoundingClientRect();
      tip.style.display = 'block';
      tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, r.top) + 'px';
      tip.style.left = (r.left - tip.offsetWidth - 10) + 'px';
    }
    hideTip() { const t = document.getElementById('shop-tip'); if (t) t.style.display = 'none'; }

    anyDetection() {
      return this.m.towers.some((t) => t.s.detect || t.s.auraReveal || t.s.buffDetect);
    }

    selectShop(type) {
      if (!this.m || this.m.state === 'defeat') return;
      if (this.ui.placing === type) { this.cancel(); return; }
      if (this.m.credits < this.m.placeCost(type)) { CS.sfx('error'); this.hint('Not enough Credits', 1.2); return; }
      this.ui.placing = type;
      this.ui.abilityTarget = null;
      this.ui.selectedTower = null;
      this.showInspector(null);
      if (this.ui.hover) this.ui.placeValid = this.m.canPlace(type, this.ui.hover.x, this.ui.hover.y).ok;
    }

    cancel() {
      if (this.ui.placing || this.ui.abilityTarget) { this.ui.placing = null; this.ui.abilityTarget = null; this.hint(''); return true; }
      if (this.ui.selectedTower || this.ui.selectedEnemy) { this.select(null); this.ui.selectedEnemy = null; $('#enemy-card').classList.add('hidden'); return true; }
      return false;
    }

    // ───────────────────────── input
    onMove(e) {
      if (!this.m) return;
      const p = this.r.toWorld(e.clientX, e.clientY);
      this.ui.hover = p;
      if (this.ui.placing) {
        const chk = this.m.canPlace(this.ui.placing, p.x, p.y);
        this.ui.placeValid = chk.ok;
        this.hint(chk.ok ? (this.m.credits >= this.m.placeCost(this.ui.placing) ? '' : 'Not enough Credits') : chk.why);
      } else {
        this.ui.hoverTower = this.towerAt(p.x, p.y);
      }
      this.shiftHeld = e.shiftKey;
    }

    onDown(e) {
      if (!this.m) return;
      CS.Audio.unlock();
      if (e.button === 2) { this.cancel(); return; }
      if (e.button !== 0) return;
      const p = this.r.toWorld(e.clientX, e.clientY);
      this.ui.hover = p;
      if (this.ui.abilityTarget) {
        if (this.m.useAbility(this.ui.abilityTarget, p.x, p.y)) { this.ui.abilityTarget = null; this.hint(''); this.renderAbilities(true); }
        return;
      }
      if (this.ui.placing) {
        const type = this.ui.placing;
        const chk = this.m.canPlace(type, p.x, p.y);
        if (!chk.ok) { CS.sfx('error'); this.hint(chk.why, 1.2); return; }
        if (this.m.credits < this.m.placeCost(type)) { CS.sfx('error'); this.hint('Not enough Credits', 1.2); return; }
        const t = this.m.placeTower(type, p.x, p.y);
        if (t) {
          S.data.stats.towersPlaced++;
          S.checkStatAchievements();
          if (!(e.shiftKey && this.m.credits >= this.m.placeCost(type))) { this.ui.placing = null; this.hint(''); }
        }
        return;
      }
      const t = this.towerAt(p.x, p.y);
      if (t) { this.select(t); return; }
      const en = this.enemyAt(p.x, p.y);
      if (en) { this.ui.selectedEnemy = en; this.select(null); this.renderEnemyCard(true); return; }
      this.select(null);
      this.ui.selectedEnemy = null;
      $('#enemy-card').classList.add('hidden');
    }

    towerAt(x, y) {
      let best = null, bd = Infinity;
      for (const t of this.m.towers) {
        const d = U.dist2(x, y, t.x, t.y);
        if (d < (t.def.r + 5) * (t.def.r + 5) && d < bd) { bd = d; best = t; }
      }
      return best;
    }
    enemyAt(x, y) {
      let best = null, bd = Infinity;
      for (const e of this.m.enemies) {
        if (!e.alive || e.dist < 0) continue;
        const d = U.dist2(x, y, e.x, e.y);
        if (d < (e.r + 8) * (e.r + 8) && d < bd) { bd = d; best = e; }
      }
      return best;
    }

    select(t) {
      this.ui.selectedTower = t;
      if (t) { this.ui.placing = null; this.ui.selectedEnemy = null; $('#enemy-card').classList.add('hidden'); }
      this.showInspector(t);
    }

    onKey(e) {
      if (!this.m) return false;
      const k = e.key;
      const up = k.length === 1 ? k.toUpperCase() : k;
      if (k === 'Escape') { if (!this.cancel()) this.openPauseMenu(); return true; }
      if (UI.hasModal()) return false;
      if (k >= '1' && k <= '9') { const i = +k - 1; if (this.m.loadout[i]) this.selectShop(this.m.loadout[i]); return true; }
      if (k === ' ') { this.startWave(); return true; }
      if (up === 'F') { this.setSpeed(this.m.speed >= 3 ? 1 : this.m.speed + 1); return true; }
      if (up === 'P') { this.togglePause(); return true; }
      if (up === 'H' || k === '?') { this.app.showHelp(); return true; }
      const ai = AB_KEYS.indexOf(up);
      if (ai >= 0 && this.abilityOrder && this.abilityOrder[ai]) { this.triggerAbility(this.abilityOrder[ai]); return true; }
      const t = this.ui.selectedTower;
      if (t && this.m.towers.includes(t)) {
        const ui = UP_KEYS.indexOf(up);
        if (ui >= 0) { this.buyUpgrade(t, ui); return true; }
        if (k === 'Backspace' || k === 'Delete') { this.sell(t); return true; }
        if (k === 'Tab' || k === '.' || k === ',') { this.cycleTargeting(t, k === ',' ? -1 : 1); return true; }
      }
      return false;
    }

    // ───────────────────────── actions
    startWave() {
      if (!this.m) return;
      if (this.tut && !this.tut.allowStart()) { CS.sfx('error'); return; }
      if (this.m.startWave()) { this.updateNextWave(); this.refresh(true); }
    }
    setSpeed(s) {
      if (!this.m) return;
      this.m.speed = s;
      this.m.paused = false;
      document.querySelectorAll('.tb-btn.spd').forEach((b) => b.classList.toggle('sel', +b.dataset.speed === s));
      $('#btn-pause').classList.remove('sel');
    }
    togglePause() {
      if (!this.m) return;
      this.m.paused = !this.m.paused;
      $('#btn-pause').classList.toggle('sel', this.m.paused);
      $('#btn-pause').textContent = this.m.paused ? '▶' : '❚❚';
      this.hint(this.m.paused ? 'PAUSED — press P to resume' : '', this.m.paused ? 0 : 0.01);
    }
    openPauseMenu() {
      if (!this.m || UI.hasModal()) return;
      const was = this.m.paused;
      this.m.paused = true;
      const st = S.data.settings;
      const md = UI.modal(`<h2>PAUSED</h2><div class="sub">${U.esc(this.m.def.name)} · ${this.m.diff.name} · Wave ${this.m.wave}</div>
        <div class="set-row"><label>Master volume</label><input type="range" min="0" max="1" step="0.05" value="${st.master}" data-v="master"></div>
        <div class="set-row"><label>Music</label><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-v="music"></div>
        <div class="set-row"><label>Sound effects</label><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-v="sfx"></div>
        <div class="modal-actions">
          <button class="btn ghost" data-a="help">Controls</button>
          <button class="btn ghost" data-a="settings">Settings</button>
          <button class="btn danger" data-a="quit">Quit</button>
          <button class="btn" data-a="restart">Restart</button>
          <button class="btn primary" data-a="resume">Resume</button>
        </div>`, { width: 520, onClose: () => { if (this.m) this.m.paused = was && false; } });
      md.querySelectorAll('input[type=range]').forEach((inp) => (inp.oninput = () => { st[inp.dataset.v] = +inp.value; CS.Audio.setVolumes({ master: st.master, music: st.music, sfx: st.sfx }); S.save(); }));
      md.querySelector('[data-a=resume]').onclick = () => UI.closeModal(md);
      md.querySelector('[data-a=help]').onclick = () => this.app.showHelp();
      md.querySelector('[data-a=settings]').onclick = () => this.app.menus.settingsModal();
      md.querySelector('[data-a=restart]').onclick = () => UI.confirm('Restart match?', 'Progress in this match will be lost (XP for cleared waves is still awarded).', 'Restart', () => { UI.closeAllModals(); this.app.restartMatch(); }, true);
      md.querySelector('[data-a=quit]').onclick = () => UI.confirm('Quit to menu?', 'You will receive XP for the waves you cleared.', 'Quit', () => { UI.closeAllModals(); this.app.quitMatch(); }, true);
    }

    buyUpgrade(t, path) {
      const m = this.m;
      const res = this.upgradeState(t, path);
      if (!res.can) { CS.sfx('error'); this.hint(res.why, 1.2); return; }
      if (m.upgradeTower(t, path)) {
        if (t.tiers[path] === 5) S.unlockAch('max_power');
        this.lastInspect = '';
        this.showInspector(t);
      }
    }
    sell(t) {
      const doSell = () => { this.m.sellTower(t); this.select(null); };
      if (S.data.settings.confirmSell) UI.confirm('Sell tower?', 'Sell ' + t.def.name + ' for ¢' + this.m.sellValue(t) + '?', 'Sell', doSell, true);
      else doSell();
    }
    cycleTargeting(t, dir) {
      const list = t.def.targeting;
      if (!list.length) return;
      const i = (list.indexOf(t.targeting) + dir + list.length) % list.length;
      t.targeting = list[i];
      t.target = null;
      this.lastInspect = '';
      this.showInspector(t);
      this.app.onTargetingChanged && this.app.onTargetingChanged(t);
    }
    triggerAbility(id) {
      const m = this.m;
      if (!m.abilityReady(id)) { CS.sfx('error'); return; }
      if (CS.ABILITIES[id].target) {
        this.ui.abilityTarget = this.ui.abilityTarget === id ? null : id;
        this.ui.placing = null;
        this.hint(this.ui.abilityTarget ? 'Click to target ' + CS.ABILITIES[id].name + ' (right-click to cancel)' : '');
        return;
      }
      if (m.useAbility(id)) this.renderAbilities(true);
      else CS.sfx('error');
    }

    upgradeState(t, path) {
      const m = this.m;
      const tier = t.tiers[path];
      if (tier >= 5) return { can: false, why: 'Maxed', maxed: true };
      if (m.rules.maxTier && tier >= m.rules.maxTier) return { can: false, why: 'Challenge limit: tier ' + m.rules.maxTier };
      const chk = CS.canTakeUpgrade(t.tiers, path);
      if (!chk.ok) return { can: false, why: chk.why, blocked: true };
      if (tier === 4 && !S.tier5Unlocked(t.type)) return { can: false, why: 'Requires ' + t.def.name + ' Mastery 3', locked: true };
      const cost = m.upgradeCost(t, path);
      if (m.credits < cost) return { can: false, why: 'Need ¢' + U.fmt(cost), poor: true, cost };
      return { can: true, cost };
    }

    // ───────────────────────── inspector
    showInspector(t) {
      const iv = $('#inspect-view'), sv = $('#shop-view');
      if (!t) { iv.classList.add('hidden'); sv.classList.remove('hidden'); this.lastInspect = ''; return; }
      iv.classList.remove('hidden'); sv.classList.add('hidden');
      this.renderInspector(true);
    }

    inspectorSig(t) {
      const m = this.m;
      let s = t.id + ':' + t.tiers.join('') + ':' + t.targeting + ':' + (t.offline ? 1 : 0);
      for (let p = 0; p < 3; p++) { const st = this.upgradeState(t, p); s += st.can ? 'y' : st.poor ? 'p' : 'n'; }
      return s;
    }

    renderInspector(force) {
      const t = this.ui.selectedTower;
      if (!t || !this.m.towers.includes(t)) { if (t) this.select(null); return; }
      const sig = this.inspectorSig(t);
      const iv = $('#inspect-view');
      if (!force && sig === this.lastInspect) { this.updateInspectorLive(t); return; }
      this.lastInspect = sig;
      const m = this.m, s = t.s, def = t.def;
      const mas = S.mastery(t.type);
      const tlist = def.targeting;
      let statRows = '';
      const row = (k, v) => (statRows += `<div><span>${k}</span><b>${v}</b></div>`);
      if (def.kind === 'farm') { row('Per wave', '¢' + Math.round(s.income)); if (s.interest) row('Interest', Math.round(s.interest * 100) + '%'); if (s.bounty) row('Bounty', '+' + Math.round(s.bounty * 100) + '%'); row('Earned', '<span data-l="earned">¢' + U.fmt(t.earned) + '</span>'); }
      else if (def.kind === 'amp') { row('Dmg buff', '+' + Math.round(s.buffDmg * 100) + '%'); row('Speed buff', '+' + Math.round(s.buffRate * 100) + '%'); if (s.buffRange) row('Range buff', '+' + Math.round(s.buffRange * 100) + '%'); row('Radius', Math.round(s.range)); }
      else if (def.kind === 'aura') { row('Slow', Math.round(s.auraSlow * 100) + '%'); if (s.auraDot) row('Dmg/s', Math.round(s.auraDot)); row('Radius', Math.round(s.range)); row('Total dmg', '<span data-l="dmg">' + U.fmt(t.dmgDealt) + '</span>'); row('Destroyed', '<span data-l="kills">' + t.kills + '</span>'); }
      else if (def.kind === 'drones') { row('Drones', s.drones + (s.gunships ? '+' + s.gunships : '')); row('Drone dmg', Math.round(s.droneDmg)); row('Leash', s.globalLeash ? 'Map' : Math.round(s.range)); row('Detect', s.detect ? 'Yes' : 'No'); row('Total dmg', '<span data-l="dmg">' + U.fmt(t.dmgDealt) + '</span>'); row('Destroyed', '<span data-l="kills">' + t.kills + '</span>'); }
      else {
        const dmg = def.kind === 'virus' ? Math.round(s.virusDps) + '/s' : Math.round(s.dmg) + (s.count > 1 ? '×' + s.count : '');
        row('Damage', dmg); row('Speed', s.rate.toFixed(2) + '/s'); row('Range', s.range > 1500 ? 'Map' : Math.round(s.range)); row('Detect', s.detect ? '<span style="color:var(--green)">Yes</span>' : '<span style="color:#ff8fa3" title="' + CS.detectInfo(t.type) + '">No</span>');
        row('Total dmg', '<span data-l="dmg">' + U.fmt(t.dmgDealt) + '</span>'); row('Destroyed', '<span data-l="kills">' + t.kills + '</span>');
      }
      let budget = '<div class="budget">BUILD ';
      const total = t.tiers[0] + t.tiers[1] + t.tiers[2];
      const cl = ['a', 'b', 'c'];
      for (let p = 0; p < 3; p++) for (let i = 0; i < t.tiers[p]; i++) budget += `<i class="${cl[p]}"></i>`;
      for (let i = total; i < CS.UPGRADE_RULES.maxTotal; i++) budget += '<i></i>';
      budget += ` <span style="margin-left:4px">${t.tiers.join('-')}</span></div>`;
      let ups = '';
      for (let p = 0; p < 3; p++) {
        const path = def.paths[p];
        const tier = t.tiers[p];
        const st = this.upgradeState(t, p);
        let tiersHtml = '';
        for (let i = 0; i < 5; i++) tiersHtml += `<i class="${i < tier ? 'on' : ''}"></i>`;
        if (st.maxed) {
          ups += `<div class="upg ${PATH_CLS[p]} maxed"><div class="up-top"><span class="up-path">${path.name}</span><span class="up-tiers">${tiersHtml}</span></div><div class="up-name">★ ${U.esc(path.ups[4].n)}</div><div class="up-desc">Path complete.</div></div>`;
          continue;
        }
        const up = path.ups[tier];
        const cost = m.upgradeCost(t, p);
        const label = st.can ? '¢' + U.fmt(cost) : st.poor ? '¢' + U.fmt(cost) : st.locked ? '🔒 Mastery 3' : st.blocked ? '✕ ' + st.why : st.why;
        ups += `<div class="upg ${PATH_CLS[p]} ${tier === 4 ? 't5' : ''}"><div class="up-top"><span class="up-path">${path.name}</span><span class="up-tiers">${tiersHtml}</span></div>
          <div class="up-name">${U.esc(up.n)}</div><div class="up-desc">${U.esc(up.d)}${st.locked ? '<br><span style="color:var(--gold)">Use this tower in matches to earn Mastery — tier 5 unlocks at Mastery 3 (now ' + mas.lvl + ').</span>' : ''}</div><span class="up-key">${UP_KEYS[p]}</span>
          <button class="up-buy ${st.poor ? 'poor' : ''}" data-p="${p}" ${st.can ? '' : 'disabled'}>${label}</button></div>`;
      }
      let tg = '';
      if (tlist.length) tg = `<div class="targeting"><span class="tg-l">TARGET</span><button data-tg="-1">◀</button><span class="tg-v">${CS.TARGET_NAMES[t.targeting]}</span><button data-tg="1">▶</button></div>`;
      const strip = '<div class="build-strip">' + m.loadout.map((ty, i) => `<button data-build="${ty}" title="Build ${CS.TOWERS[ty].name} (${i + 1})"><img src="${CS.Spr.towerIcon(ty, [0, 0, 0], S.skinOf(ty), 64)}" alt=""></button>`).join('') + '</div>';
      iv.innerHTML = strip + `<div class="ins-head"><img src="${CS.Spr.towerIcon(t.type, t.tiers, S.skinOf(t.type), 64)}" alt=""><div><div class="ins-name">${def.name}</div><div class="ins-sub">${def.role} · Mastery ${mas.lvl}</div></div><button class="ins-close" title="Close (Esc)">✕</button></div>
        ${t.offline ? '<div class="chip red" style="margin-top:6px">OFFLINE — disrupted</div>' : ''}
        <div class="ins-stats">${statRows}</div>${tg}${budget}${ups}
        <button class="btn danger small sell-btn" data-sell>Sell ¢${U.fmt(m.sellValue(t))} <span style="opacity:.6;font-size:11px">(Del)</span></button>`;
      iv.querySelector('.ins-close').onclick = () => this.select(null);
      iv.querySelectorAll('[data-build]').forEach((b) => (b.onclick = () => this.selectShop(b.dataset.build)));
      iv.querySelectorAll('.up-buy').forEach((b) => (b.onclick = () => this.buyUpgrade(t, +b.dataset.p)));
      iv.querySelectorAll('[data-tg]').forEach((b) => (b.onclick = () => this.cycleTargeting(t, +b.dataset.tg)));
      iv.querySelector('[data-sell]').onclick = () => this.sell(t);
      this.liveEls = { dmg: iv.querySelector('[data-l=dmg]'), kills: iv.querySelector('[data-l=kills]'), earned: iv.querySelector('[data-l=earned]') };
      if (this.tut) this.tut.onInspector && this.tut.onInspector();
    }
    updateInspectorLive(t) {
      const L = this.liveEls;
      if (!L) return;
      if (L.dmg) L.dmg.textContent = U.fmt(t.dmgDealt);
      if (L.kills) L.kills.textContent = t.kills;
      if (L.earned) L.earned.textContent = '¢' + U.fmt(t.earned);
    }

    // ───────────────────────── abilities
    renderAbilities(force) {
      const m = this.m;
      const box = $('#abilities');
      const ids = Object.keys(CS.ABILITIES).filter((id) => m.abilities[id] && m.abilities[id].avail);
      const sig = ids.join(',');
      if (force || sig !== this.abSig) {
        this.abSig = sig;
        this.abilityOrder = ids;
        if (!ids.length) { box.innerHTML = '<div class="ab-empty">Tier-5 upgrades unlock abilities.</div>'; this.abEls = []; return; }
        box.innerHTML = '';
        this.abPrimed = false;
        this.abEls = ids.map((id, i) => {
          const a = CS.ABILITIES[id];
          const b = U.el('button', 'ab-btn');
          b.style.borderColor = a.color;
          b.title = a.name + ' — ' + a.desc + ' (' + AB_KEYS[i] + ')';
          b.innerHTML = `<span class="ab-k">${AB_KEYS[i]}</span><span class="ab-t" style="color:${a.color}">${a.name}</span><div class="ab-cd"></div><span class="ab-sec"></span>`;
          b.onclick = () => this.triggerAbility(id);
          box.appendChild(b);
          return { id, b, cd: b.querySelector('.ab-cd'), sec: b.querySelector('.ab-sec') };
        });
      }
      this.abPrimed = true;
      for (const a of this.abEls || []) {
        const st = m.abilities[a.id];
        const f = Math.max(0, st.cd / st.max);
        a.cd.style.height = (f * 100).toFixed(1) + '%';
        a.sec.textContent = st.cd > 0 ? Math.ceil(st.cd) + 's' : '';
        const ready = st.cd <= 0 && !m.rules.noAbilities;
        if (ready && !a.wasReady && this.abPrimed) { CS.sfx('achievement', 0.5); this.hint(CS.ABILITIES[a.id].name + ' ready — press ' + AB_KEYS[this.abilityOrder.indexOf(a.id)], 2); }
        a.wasReady = ready;
        a.b.classList.toggle('ready', ready);
      }
    }

    // ───────────────────────── wave preview
    updateNextWave() {
      const m = this.m;
      const el = $('#next-wave');
      const w = m.wave + 1;
      if (m.state === 'victory' || (!m.endless && w > m.maxWave)) { el.innerHTML = '<span>Final wave in progress</span>'; return; }
      const groups = m.tutorial && w < CS.TUTORIAL_WAVES.length ? CS.getTutorialWave(w) : CS.getWave(w, m.seed, m.endless || w > 100);
      const agg = {};
      for (const g of groups) agg[g.type] = (agg[g.type] || 0) + g.count;
      let html = '<span style="margin-right:4px">NEXT:</span>';
      for (const k in agg) {
        const def = CS.ENEMIES[k];
        html += `<span class="nw ${def.boss ? 'boss' : ''}" title="${U.esc(def.name)}"><img src="${CS.Spr.enemyIcon(k, 44)}" alt="">${def.boss ? 'BOSS' : agg[k]}</span>`;
      }
      el.innerHTML = html;
    }

    // ───────────────────────── enemy card
    renderEnemyCard(force) {
      const e = this.ui.selectedEnemy;
      const card = $('#enemy-card');
      if (!e || !e.alive) { card.classList.add('hidden'); this.ui.selectedEnemy = null; return; }
      card.classList.remove('hidden');
      const fx = [];
      if (e.stunT > 0) fx.push('<span class="chip cyan">Stunned</span>');
      if (e.slowAura > 0 || e.slowT > 0 || this.m.freezeT > 0) fx.push('<span class="chip cyan">Slowed</span>');
      if (e.burnT > 0) fx.push('<span class="chip gold">Burning</span>');
      if (e.virusT > 0) fx.push('<span class="chip green">Infected</span>');
      if (e.vulnT > 0 || e.vulnAura > 0) fx.push('<span class="chip red">Exposed</span>');
      if (e.markT > 0) fx.push('<span class="chip red">Marked</span>');
      if (e.permaReveal || e.revealAura) fx.push('<span class="chip">Revealed</span>');
      if (e.elite) fx.push(`<span class="chip" style="color:${CS.ELITES[e.elite].color}">${CS.ELITES[e.elite].name}</span>`);
      const sig = e.id + ':' + e.type + ':' + fx.join('');
      const armor = Math.max(0, e.armor - e.shred - e.shredAura);
      const spd = Math.round(this.m.enemyMoveSpeed(e));
      if (force || sig !== this.enemySig) {
        this.enemySig = sig;
        card.innerHTML = `<button class="ec-x">✕</button><div class="ec-top"><img src="${CS.Spr.enemyIcon(e.type, 48)}" alt=""><div><div class="ec-n">${U.esc(e.def.name)}</div><div style="color:var(--muted);font-size:12px">Wave ${e.wave}${e.elite ? ' · ELITE' : ''}</div></div></div>
          <div class="ec-hp"><div data-e="bar"></div></div>
          <div class="ec-g"><div>HP <b data-e="hp"></b></div><div>Shield <b data-e="sh"></b></div><div>Armor <b data-e="ar"></b></div><div>Speed <b data-e="sp"></b></div></div>
          <div class="ec-tr">${e.def.traits.map(U.esc).join(' ')}${e.elite ? ' ' + CS.ELITES[e.elite].desc + '.' : ''}</div><div class="ec-fx">${fx.join('')}</div>`;
        card.querySelector('.ec-x').onclick = () => { this.ui.selectedEnemy = null; card.classList.add('hidden'); };
      }
      card.querySelector('[data-e=bar]').style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
      card.querySelector('[data-e=hp]').textContent = U.fmt(Math.max(0, e.hp)) + '/' + U.fmt(e.maxHp);
      card.querySelector('[data-e=sh]').textContent = e.shieldMax ? U.fmt(e.shield) : '—';
      card.querySelector('[data-e=ar]').textContent = armor;
      card.querySelector('[data-e=sp]').textContent = spd;
    }

    // ───────────────────────── per-frame
    refresh(force) {
      const m = this.m;
      if (!m) return;
      this.refreshT -= 1;
      if (!force && this.refreshT > 0) return;
      this.refreshT = 5; // every ~5 frames
      $('#tb-wave').textContent = m.wave + '/' + (m.endless ? '∞' : m.maxWave);
      this.creditsCounter.set(m.credits);
      const core = $('#tb-core');
      if (core.textContent !== String(Math.max(0, Math.ceil(m.coreHp)))) core.textContent = Math.max(0, Math.ceil(m.coreHp));
      $('#tb-core-bar').style.width = Math.max(0, (m.coreHp / m.coreMax) * 100) + '%';
      for (const s of this.shopEls) {
        const c = m.placeCost(s.type);
        s.costEl.textContent = U.fmt(c);
        s.el.classList.toggle('poor', m.credits < c);
        s.el.classList.toggle('sel', this.ui.placing === s.type);
      }
      const can = m.canStartWave();
      const btn = $('#btn-start');
      btn.disabled = !can;
      btn.classList.toggle('pulse', can && m.enemies.length === 0 && m.wave < m.maxWave);
      btn.textContent = m.state === 'victory' ? '✓ VICTORY' : can ? (m.enemies.length ? '⏩ SEND NEXT WAVE' : '▶ START WAVE') : '… WAVE IN PROGRESS';
      if (this.ui.selectedTower) this.renderInspector(false);
      this.renderAbilities(false);
      if (this.ui.selectedEnemy) this.renderEnemyCard(false);
      // boss bar
      const bb = m.bossBar;
      const bar = $('#boss-bar');
      if (bb && bb.alive) {
        bar.classList.remove('hidden');
        $('#bb-name').textContent = bb.def.name + (bb.type === 'worm' ? ' · SEGMENTS ' + Math.max(0, bb.segAlive) : bb.type === 'root' ? ' · PHASE ' + (bb.rootPhase + 1) : '');
        $('#bb-fill').style.width = Math.max(0, (bb.hp / bb.maxHp) * 100) + '%';
        $('#bb-shield').style.width = bb.shieldMax ? Math.max(0, (bb.shield / bb.shieldMax) * 100) + '%' : '0%';
      } else bar.classList.add('hidden');
      if (this.tut) this.tut.update();
    }

    hint(text, life) {
      const h = $('#hint-bar');
      if (this.hintTimer) { clearTimeout(this.hintTimer); this.hintTimer = null; }
      if (!text) { h.classList.remove('show'); return; }
      h.textContent = text;
      h.classList.add('show');
      if (life) this.hintTimer = setTimeout(() => h.classList.remove('show'), life * 1000);
    }

    banner(main, sub, cls, life) {
      const b = $('#banner');
      b.className = cls || '';
      b.innerHTML = `<div class="b-main">${main}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
      b.classList.remove('hidden');
      clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => b.classList.add('hidden'), (life || 2.3) * 1000);
    }

    showIntro(type) {
      const d = CS.ENEMIES[type];
      const txt = CS.ENEMY_INTRO[type];
      if (!txt) return;
      const c = $('#intro-card');
      c.innerHTML = `<img src="${CS.Spr.enemyIcon(type, 48)}" alt=""><div><div class="ic-h">NEW THREAT</div><div class="ic-t">${U.esc(txt)}</div></div>`;
      c.classList.remove('hidden');
      clearTimeout(this.introTimer);
      this.introTimer = setTimeout(() => c.classList.add('hidden'), 7000);
      c.onclick = () => c.classList.add('hidden');
    }

    showBossIntro(e) {
      const c = $('#intro-card');
      c.innerHTML = `<img src="${CS.Spr.enemyIcon(e.type, 48)}" alt=""><div><div class="ic-h">BOSS · ${U.esc(e.def.name)}</div><div class="ic-t">${e.def.traits.map(U.esc).join(' ')}</div><div class="ic-t" style="color:#ffb3c1;margin-top:3px">HP ${U.fmt(e.maxHp)}${e.armor ? ' · Armor ' + e.armor : ''}</div></div>`;
      c.classList.remove('hidden');
      clearTimeout(this.introTimer);
      this.introTimer = setTimeout(() => c.classList.add('hidden'), 9000);
      c.onclick = () => c.classList.add('hidden');
    }

    // ───────────────────────── match events
    onEvent(type, d) {
      const m = this.m;
      switch (type) {
        case 'waveStart': {
          if (d.boss.length) {
            this.banner('⚠ WARNING ⚠', d.boss.join(' + ') + ' APPROACHING', 'boss', 3);
          } else this.banner('WAVE ' + d.wave, m.endless ? 'ENDLESS' : d.wave === m.maxWave ? 'FINAL WAVE' : '', '', 1.8);
          this.app.updateMusic();
          const groups = m.tutorial && d.wave < CS.TUTORIAL_WAVES.length ? CS.getTutorialWave(d.wave) : CS.getWave(d.wave, m.seed, m.endless || d.wave > 100);
          if (groups.some((g) => g.type === 'ghost' || g.type === 'blackout') && !this.anyDetection()) {
            UI.toast('STEALTH ALERT', 'Ghost Processes incoming and <b>none of your towers can detect them</b>! Upgrade for detection (hover a tower in the build menu to see how).', 'warn', 6);
          }
          for (const t of d.newTypes) {
            if (!S.data.seenEnemies[t] && CS.ENEMY_INTRO[t]) { S.data.seenEnemies[t] = true; S.save(); this.showIntro(t); break; }
          }
          this.updateNextWave();
          break;
        }
        case 'waveEnd':
          if (m.state === 'play') { this.banner('WAVE ' + d.wave + ' CLEAR', '+¢' + (d.bonus + d.interest), 'good', 1.6); CS.sfx('wave_end'); }
          this.updateNextWave();
          break;
        case 'boss':
          this.app.updateMusic();
          if (d.type !== 'wormseg') this.showBossIntro(d);
          break;
        case 'bossKilled':
          this.banner(d.def.name + ' DESTROYED', '', 'good', 2);
          setTimeout(() => this.app.updateMusic(), 300);
          break;
        case 'leak': {
          const c = $('.tb-stat.core');
          c.classList.remove('hurt'); void c.offsetWidth; c.classList.add('hurt');
          break;
        }
        case 'event': {
          const eb = $('#event-banner');
          eb.innerHTML = `<div class="eb-t">${U.esc(d.title)}</div><div class="eb-d">${U.esc(d.text)}</div>${d.offer ? '<div style="display:flex;gap:6px"><button class="btn gold small" data-a="y">Accept</button><button class="btn ghost small" data-a="n">Decline</button></div>' : ''}`;
          eb.classList.remove('hidden');
          CS.sfx('cash');
          if (d.offer) {
            eb.querySelector('[data-a=y]').onclick = () => { m.acceptEvent(); eb.classList.add('hidden'); };
            eb.querySelector('[data-a=n]').onclick = () => { m.event = null; eb.classList.add('hidden'); };
          } else setTimeout(() => eb.classList.add('hidden'), 5000);
          break;
        }
        case 'eventExpired': $('#event-banner').classList.add('hidden'); break;
        case 'eventAccepted': this.banner('SYSTEM OVERLOAD', 'Towers +50% speed · Enemies +25% speed', 'boss', 2); break;
        case 'cacheKilled': this.hint('Data Cache destroyed! +¢' + d, 2); break;
        case 'cacheEscaped': this.hint('The Data Cache escaped.', 2); break;
        case 'toast': UI.toast('SYSTEM', U.esc(d), 'warn', 2.6); break;
        case 'abilityUnlocked': this.renderAbilities(true); UI.toast('ABILITY ONLINE', CS.ABILITIES[d].name + ' — press ' + (AB_KEYS[(this.abilityOrder || []).indexOf(d)] || '') , '', 3); break;
        case 'victory': this.app.onVictory(); break;
        case 'defeat': this.app.onDefeat(); break;
        case 'endless': this.updateNextWave(); break;
        case 'upgraded': case 'placed': case 'sold': this.renderAbilities(true); break;
      }
      if (this.tut) this.tut.onEvent(type, d);
    }
  }

  CS.Hud = Hud;
})();
