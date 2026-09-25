/* CIRCUIT SIEGE — menu screens */
(function () {
  'use strict';
  const CS = window.CS;
  const U = CS.U;
  const UI = CS.UI;
  const S = CS.Save;
  const P = CS.PROG;
  const $ = UI.$;
  const esc = U.esc;

  const thumbCache = {};
  function mapThumb(id) {
    if (!thumbCache[id]) thumbCache[id] = CS.MapArt.thumbnail(CS.MAP_BY_ID[id], 480, 270).toDataURL('image/jpeg', 0.85);
    return thumbCache[id];
  }
  // Non-blocking thumbnails: render one per frame and fill <img data-thumb>
  function fillThumbs(root) {
    const imgs = Array.from(root.querySelectorAll('img[data-thumb]'));
    let i = 0;
    const step = () => {
      if (i >= imgs.length) return;
      const im = imgs[i++];
      if (document.body.contains(im)) im.src = mapThumb(im.dataset.thumb);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const diffLetter = { casual: 'C', standard: 'S', advanced: 'A', nightmare: 'N' };

  class Menus {
    constructor(app) {
      this.app = app;
      this.root = $('#menu');
      UI.wireSounds(this.root);
    }

    show(name, arg) {
      this.current = name;
      this.root.scrollTop = 0;
      this[name](arg);
    }

    page(title, body, backTo) {
      this.root.innerHTML = `<div class="menu-page"><div class="page-head"><button class="btn back small" data-back>◀ Back</button><h1>${title}</h1><div class="chip gold" title="Data Chips"><span class="dc">${U.fmt(S.data.chips)}</span></div><div class="chip cyan">LVL ${S.data.level}</div></div>${body}</div>`;
      this.root.querySelector('[data-back]').onclick = () => this.show(backTo || 'main');
      return this.root.querySelector('.menu-page');
    }

    // ───────────────────────────── MAIN
    main() {
      const d = S.data;
      const need = P.xpToNext(d.level);
      const daily = P.dailyChallenge(U.todayKey());
      const dailyDone = d.daily[daily.date];
      // next unlock
      let nextU = '';
      for (let L = d.level + 1; L < d.level + 30; L++) {
        const u = P.LEVEL_UNLOCKS[L];
        if (u) { nextU = `Level ${L}: <b>${u.map(unlockName).join(', ')}</b>`; break; }
      }
      const newStuff = P.RESEARCH.some((r) => S.canResearch(r.id));
      this.root.innerHTML = `
      <div class="main-menu">
        <div>
          <div class="logo"><div class="l1">CIRCUIT</div><div class="l2">SIEGE</div><div class="tag">DEFEND THE CORE</div></div>
          <div class="menu-buttons">
            <button class="mbtn play" data-go="play"><span class="mi">▶</span>PLAY</button>
            <button class="mbtn" data-go="towers"><span class="mi">⬢</span>TOWERS</button>
            <button class="mbtn" data-go="research"><span class="mi">⚗</span>RESEARCH ${newStuff ? '<span class="badge">NEW</span>' : ''}</button>
            <button class="mbtn" data-go="challenges"><span class="mi">⚑</span>CHALLENGES ${!dailyDone ? '<span class="badge">DAILY</span>' : ''}</button>
            <button class="mbtn" data-go="achievements"><span class="mi">✦</span>ACHIEVEMENTS</button>
            <button class="mbtn" data-go="profile"><span class="mi">◉</span>PROFILE</button>
            <button class="mbtn" data-go="settings"><span class="mi">⚙</span>SETTINGS</button>
          </div>
        </div>
        <div class="menu-side">
          <div class="panel"><div class="profile-card">
            <div class="pc-icon">${S.iconHTML(d.icon)}</div>
            <div class="pc-main"><div class="pc-name">Operator · Level ${d.level}</div><div class="pc-title">${esc(d.title)}</div>
              <div class="xpbar"><div style="width:${((d.xp / need) * 100).toFixed(1)}%"></div></div>
              <div class="xptext"><span>${U.fmt(d.xp)} / ${U.fmt(need)} XP</span><span class="dc">${U.fmt(d.chips)}</span></div></div>
          </div>${nextU ? `<div class="next-unlock" style="margin-top:10px">Next unlock — ${nextU}</div>` : ''}</div>
          ${!d.tutorialDone ? `<div class="panel daily-teaser" data-go="tutorial" style="border-color:var(--gold)"><h3 style="color:var(--gold)">NEW OPERATOR?</h3><div class="dt-map">Start the Tutorial</div><div style="color:var(--muted)">Learn the basics in about 5 minutes. Rewards <span class="dc">20</span></div></div>` : ''}
          <div class="panel daily-teaser" data-go="challenges"><h3>DAILY PROTOCOL · ${daily.date}</h3>
            <div class="dt-map">${esc(CS.MAP_BY_ID[daily.map].name)} · ${CS.DIFFICULTIES[daily.diff].name}</div>
            <ul>${daily.lines.slice(0, 3).map((l) => '<li>' + esc(l) + '</li>').join('')}</ul>
            <div>${dailyDone ? '<span class="chip green">✓ COMPLETED TODAY</span>' : 'Reward <span class="dc">' + daily.reward + '</span>'}</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn small ghost" data-go="tutorial">Replay Tutorial</button>
            <button class="btn small ghost" data-go="help">Controls</button>
          </div>
          <div style="color:var(--dim);font-size:12px">Progress saves automatically in this browser. Use Settings → Export Save to back it up.${S.storageOk ? '' : ' <span style="color:var(--red)">Storage unavailable — export your save!</span>'}</div>
        </div>
      </div>`;
      this.root.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => {
        const g = b.dataset.go;
        if (g === 'tutorial') this.app.startTutorial();
        else if (g === 'help') this.app.showHelp();
        else this.show(g);
      }));
    }

    // ───────────────────────────── PLAY / MAPS
    play(preset) {
      preset = preset || {};
      let html = `<div class="map-grid">`;
      for (const m of CS.MAPS) {
        const unlocked = S.isMapUnlocked(m.id);
        const rec = S.data.maps[m.id] || {};
        const medals = CS.DIFF_ORDER.map((df) => `<span class="medal ${df} ${rec.done && rec.done[df] ? 'done' : ''}" title="${CS.DIFFICULTIES[df].name}">${diffLetter[df]}</span>`).join('');
        html += `<div class="map-card ${unlocked ? '' : 'locked'}" data-map="${m.id}">
          <img class="thumb" src="${thumbCache[m.id] || BLANK}" ${thumbCache[m.id] ? '' : 'data-thumb="' + m.id + '"'} alt="">
          ${unlocked ? '' : `<div class="lock-over"><div><span class="lk">🔒</span>Level ${m.unlockLevel}${S.mapIndex(m.id) > 0 && S.mapIndex(m.id) < 6 ? '<br><span style="font-size:13px;font-weight:600">or beat ' + esc(CS.MAPS[S.mapIndex(m.id) - 1].name) + '</span>' : ''}</div></div>`}
          <div class="mc-body"><div class="mc-name"><span>${esc(m.name)}</span>${UI.stars(m.stars)}</div>
          <div class="mc-desc">${esc(m.desc)}</div>
          <div class="mc-medals">${medals}<span class="mc-endless">${rec.bestWave ? 'Best wave ' + rec.bestWave : m.diff} · <span class="dc">${m.chips}+</span></span></div></div>
        </div>`;
      }
      html += '</div>';
      const pgEl = this.page('SELECT MAP', html, 'main');
      fillThumbs(pgEl);
      this.root.querySelectorAll('.map-card').forEach((c) => (c.onclick = () => {
        const id = c.dataset.map;
        if (!S.isMapUnlocked(id)) { CS.sfx('error'); return; }
        this.setupModal(id, preset);
      }));
    }

    setupModal(mapId, preset) {
      const def = CS.MAP_BY_ID[mapId];
      let diff = preset.diff || 'standard';
      if (!S.isDiffUnlocked(diff)) diff = 'casual';
      const modes = new Set(preset.modes || []);
      const md = UI.modal(`<h2>${esc(def.name)}</h2><div class="sub">${esc(def.desc)}</div>
        <div class="sec-label">DIFFICULTY</div><div class="diff-row"></div>
        <div class="sec-label">SPECIAL MODES <span style="font-weight:500;letter-spacing:0">(optional · bonus rewards)</span></div><div class="mode-grid"></div>
        <div id="setup-reward" style="margin-top:12px;color:var(--muted)"></div>
        <div class="modal-actions"><button class="btn ghost" data-a="x">Cancel</button><button class="btn primary" data-a="go">Choose Loadout ▶</button></div>`, { width: 760 });
      const drow = md.querySelector('.diff-row'), mg = md.querySelector('.mode-grid');
      const rec = S.data.maps[mapId] || {};
      const render = () => {
        drow.innerHTML = CS.DIFF_ORDER.map((id) => {
          const df = CS.DIFFICULTIES[id];
          const ok = S.isDiffUnlocked(id);
          return `<button class="diff-btn ${diff === id ? 'sel' : ''}" data-d="${id}" ${ok ? '' : 'disabled'}><div class="dn" style="color:${df.color}">${df.name}${rec.done && rec.done[id] ? ' ✓' : ''}</div><div class="dd">${ok ? df.desc : 'Unlocks at level ' + df.unlockLevel}</div></button>`;
        }).join('');
        mg.innerHTML = P.MODE_ORDER.map((id) => {
          const mo = P.MODES[id];
          const ok = S.isModeUnlocked(id);
          return `<div class="mode-tog ${modes.has(id) ? 'on' : ''} ${ok ? '' : 'locked'}" data-m="${id}"><div class="box">${modes.has(id) ? '✓' : ''}</div><div><div class="mt-n">${mo.name} ${ok ? '<span style="color:var(--gold);font-size:12px">×' + mo.reward + '</span>' : ''}</div><div class="mt-d">${ok ? esc(mo.desc) : 'Unlocks at level ' + mo.level}</div></div></div>`;
        }).join('');
        drow.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { diff = b.dataset.d; render(); }));
        mg.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
          const id = b.dataset.m;
          if (!S.isModeUnlocked(id)) { CS.sfx('error'); return; }
          modes.has(id) ? modes.delete(id) : modes.add(id);
          if (modes.has('limited') && modes.has('random')) modes.delete(id === 'limited' ? 'random' : 'limited');
          render();
        }));
        const df = CS.DIFFICULTIES[diff];
        let mult = 1; modes.forEach((m) => (mult *= P.MODES[m].reward));
        const first = !(rec.done && rec.done[diff]);
        md.querySelector('#setup-reward').innerHTML = `Victory reward: <span class="dc">${Math.round(def.chips * df.chips * mult * (first ? 2 : 1))}</span> ${first ? '<span class="chip gold">FIRST CLEAR ×2</span>' : ''} · ${df.waves} waves`;
      };
      render();
      md.querySelector('[data-a=x]').onclick = () => UI.closeModal(md);
      md.querySelector('[data-a=go]').onclick = () => {
        UI.closeModal(md);
        this.show('loadout', { mapId, diff, modes: Array.from(modes), rules: {} });
      };
    }

    // ───────────────────────────── LOADOUT
    loadout(cfg) {
      const rules = cfg.rules || {};
      const modes = new Set(cfg.modes || []);
      const maxSlots = modes.has('limited') ? 4 : 6;
      const banned = new Set(rules.banned || []);
      const only = rules.only ? new Set(rules.only) : null;
      const allowed = (t) => !banned.has(t) && (!only || only.has(t));
      const d = S.data;
      let sel;
      let forced = false;
      if (modes.has('random')) {
        const pool = CS.TOWER_ORDER.filter(allowed);
        const r = U.rng(U.hashStr(cfg.mapId + cfg.diff + (cfg.daily ? cfg.daily.date : Date.now())));
        sel = [];
        while (sel.length < Math.min(6, pool.length)) { const t = r.pick(pool); if (!sel.includes(t)) sel.push(t); }
        forced = true;
      } else if (only) { sel = Array.from(only); forced = true; }
      else sel = S.currentLoadout().filter(allowed).slice(0, maxSlots);
      let hover = sel[0] || 'pulse';

      const draw = () => {
        const lo = d.loadouts[d.loadoutIdx];
        let tabs = forced ? '' : `<div class="lo-tabs">${d.loadouts.map((l, i) => `<button class="lo-tab ${i === d.loadoutIdx ? 'sel' : ''}" data-lo="${i}">${esc(l.name)}</button>`).join('')}<button class="lo-tab" data-rename title="Rename loadout">✎</button></div>`;
        let grid = '<div class="tower-grid">';
        for (const t of CS.TOWER_ORDER) {
          const def = CS.TOWERS[t];
          const unlocked = S.isTowerUnlocked(t) || modes.has('random');
          const ok = allowed(t);
          const m = S.mastery(t);
          const isSel = sel.includes(t);
          const cost = Math.round(def.cost * CS.DIFFICULTIES[cfg.diff].cost / 5) * 5;
          grid += `<div class="tcard ${isSel ? 'sel' : ''} ${unlocked && ok ? '' : 'locked'}" data-t="${t}">
            <img src="${CS.Spr.towerIcon(t, [0, 0, 0], S.skinOf(t), 64)}" alt=""><div class="tn">${def.name}</div><div class="tr">${def.role}</div>
            <div class="tc">¢${cost}</div><div class="tm">MASTERY ${m.lvl}</div>
            ${!ok ? '<div class="lockline">BANNED</div>' : !unlocked ? `<div class="lockline">Level ${def.unlockLevel}</div><button class="btn tiny gold" data-buy="${t}" style="margin-top:4px">Unlock ◈${S.towerBuyCost(t)}</button>` : ''}
          </div>`;
        }
        grid += '</div>';
        let slots = '<div class="slots">';
        for (let i = 0; i < maxSlots; i++) {
          const t = sel[i];
          slots += `<div class="slot ${t ? 'filled' : ''}" data-slot="${i}"><span class="sk">${i + 1}</span>${t ? `<img src="${CS.Spr.towerIcon(t, [0, 0, 0], S.skinOf(t), 64)}" alt="">` : ''}</div>`;
        }
        slots += '</div>';
        const hd = CS.TOWERS[hover];
        const detail = `<div class="tdetail"><h4>${hd.name} <span class="chip">${hd.role}</span></h4><div>${esc(hd.desc)}</div>
          <div class="tags">${hd.tags.map((x) => '<span class="chip cyan">' + esc(x) + '</span>').join('')}</div>
          ${hd.paths.map((p, i) => `<h4 style="color:var(--path${'ABC'[i]})">${p.name}</h4><div>${p.ups.map((u) => esc(u.n)).join(' → ')}</div>`).join('')}</div>`;
        const pg = this.page('LOADOUT', `
          <div style="margin:-6px 0 12px;color:var(--muted)">${esc(CS.MAP_BY_ID[cfg.mapId].name)} · ${CS.DIFFICULTIES[cfg.diff].name}${cfg.modes && cfg.modes.length ? ' · ' + cfg.modes.map((m) => P.MODES[m].name).join(', ') : ''}${cfg.daily ? ' · DAILY' : ''}${cfg.challenge ? ' · ' + esc(cfg.challenge.name) : ''}</div>
          <div class="loadout-wrap"><div>${tabs}${grid}</div>
          <div><div class="panel"><h3>SELECTED ${sel.length}/${maxSlots}${forced ? ' · LOCKED' : ''}</h3>${slots}
            <button class="btn primary" data-start style="width:100%;margin-top:12px;font-size:20px" ${sel.length ? '' : 'disabled'}>START MATCH ▶</button>
            ${forced ? '<div style="font-size:13px;color:var(--muted);margin-top:6px">This mode assigns your towers.</div>' : '<div style="font-size:13px;color:var(--muted);margin-top:6px">Click towers to add/remove. Saved automatically to this preset.</div>'}
          </div><div class="panel" style="margin-top:12px">${detail}</div></div></div>`, 'play');
        pg.querySelectorAll('[data-lo]').forEach((b) => (b.onclick = () => {
          d.loadoutIdx = +b.dataset.lo; S.save();
          sel = S.currentLoadout().filter(allowed).slice(0, maxSlots);
          draw();
        }));
        const rn = pg.querySelector('[data-rename]');
        if (rn) rn.onclick = () => {
          const m = UI.modal(`<h2>Rename loadout</h2><input id="lo-name" maxlength="16" value="${esc(lo.name)}" style="width:100%;padding:8px;font-size:18px;background:#070b12;color:#fff;border:1px solid var(--line2)"><div class="modal-actions"><button class="btn primary" data-a="ok">Save</button></div>`, { width: 380 });
          const inp = m.querySelector('#lo-name'); inp.focus(); inp.select();
          const ok = () => { lo.name = (inp.value.trim() || lo.name).toUpperCase(); S.save(); UI.closeModal(m); draw(); };
          m.querySelector('[data-a=ok]').onclick = ok;
          inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); e.stopPropagation(); };
        };
        pg.querySelectorAll('.tcard').forEach((c) => {
          c.onmouseenter = () => { if (hover !== c.dataset.t) { hover = c.dataset.t; const det = pg.querySelector('.tdetail'); if (det) { const nd = CS.TOWERS[hover]; det.innerHTML = `<h4>${nd.name} <span class="chip">${nd.role}</span></h4><div>${esc(nd.desc)}</div><div class="tags">${nd.tags.map((x) => '<span class="chip cyan">' + esc(x) + '</span>').join('')}</div>${nd.paths.map((p, i) => `<h4 style="color:var(--path${'ABC'[i]})">${p.name}</h4><div>${p.ups.map((u) => esc(u.n)).join(' → ')}</div>`).join('')}`; } } };
          c.onclick = (e) => {
            if (e.target.dataset.buy) return;
            const t = c.dataset.t;
            if (forced) return;
            if (!S.isTowerUnlocked(t) || !allowed(t)) { CS.sfx('error'); return; }
            if (sel.includes(t)) sel = sel.filter((x) => x !== t);
            else if (sel.length < maxSlots) sel.push(t);
            else { CS.sfx('error'); return; }
            if (!modes.has('limited') && !only) { lo.towers = sel.slice(); S.save(); }
            draw();
          };
        });
        pg.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = (e) => {
          e.stopPropagation();
          const t = b.dataset.buy;
          UI.confirm('Unlock ' + CS.TOWERS[t].name + '?', `Spend <span class="dc">${S.towerBuyCost(t)}</span> to unlock it now (it also unlocks automatically at level ${CS.TOWERS[t].unlockLevel}).`, 'Unlock', () => {
            if (S.buyTower(t)) { CS.sfx('upgrade'); draw(); } else { CS.sfx('error'); UI.toast('NOT ENOUGH CHIPS', 'Earn Data Chips by winning matches and completing challenges.', 'warn'); }
          });
        }));
        pg.querySelectorAll('[data-slot]').forEach((s) => (s.onclick = () => {
          const i = +s.dataset.slot;
          if (forced || !sel[i]) return;
          sel.splice(i, 1);
          if (!modes.has('limited') && !only) { lo.towers = sel.slice(); S.save(); }
          draw();
        }));
        pg.querySelector('[data-start]').onclick = () => {
          const c = Object.assign({}, cfg, { loadout: sel.slice() });
          this.app.startMatch(c);
        };
      };
      draw();
    }

    // ───────────────────────────── TOWERS CODEX
    towers(selId) {
      let cur = selId || 'pulse';
      const draw = () => {
        let list = '<div class="codex-list">';
        for (const t of CS.TOWER_ORDER) {
          const def = CS.TOWERS[t];
          const un = S.isTowerUnlocked(t);
          list += `<div class="codex-item ${t === cur ? 'sel' : ''} ${un ? '' : 'locked'}" data-t="${t}"><img src="${CS.Spr.towerIcon(t, [0, 0, 0], S.skinOf(t), 64)}" alt=""><div><div class="ci-n">${def.name}</div><div class="ci-m">${un ? 'Mastery ' + S.mastery(t).lvl : 'Level ' + def.unlockLevel}</div></div></div>`;
        }
        list += '</div>';
        const def = CS.TOWERS[cur];
        const un = S.isTowerUnlocked(cur);
        const m = S.mastery(cur);
        const need = P.masteryNeed(m.lvl);
        const s0 = CS.buildStats(cur, [0, 0, 0]);
        const variants = [[5, 2, 0], [0, 5, 2], [2, 0, 5]].map((tiers) => `<div style="text-align:center"><img src="${CS.Spr.towerIcon(cur, tiers, S.skinOf(cur), 96)}" style="width:72px;height:72px" alt=""><div style="font-size:11px;color:var(--muted)">${tiers.join('-')}</div></div>`).join('');
        const statLine = def.kind === 'farm' ? `Income ¢${s0.income}/wave` : def.kind === 'amp' ? `Buff radius ${s0.range} · +${Math.round(s0.buffRate * 100)}% attack speed` : def.kind === 'aura' ? `Field ${s0.range} · Slow ${Math.round(s0.auraSlow * 100)}%` : def.kind === 'drones' ? `${s0.drones} drones · ${s0.droneDmg} dmg · leash ${s0.range}` : `Damage ${s0.dmg} · ${s0.rate}/s · Range ${s0.range}`;
        const paths = def.paths.map((p, pi) => `<div class="pcol p${'ABC'[pi]}"><h4>${p.name}</h4>${p.ups.map((u, i) => `<div class="up ${i === 4 ? 't5' : ''}"><div class="un"><span><span class="tierno">T${i + 1}</span>${esc(u.n)}</span><span style="color:var(--gold)">¢${U.fmt(u.c)}</span></div><div class="ud">${esc(u.d)}</div></div>`).join('')}</div>`).join('');
        const rewards = Object.keys(P.MASTERY_REWARDS).map((L) => `<span class="mreward ${m.lvl >= +L ? 'got' : ''}">L${L}: ${esc(P.MASTERY_REWARDS[L].text)}</span>`).join('');
        const skins = Object.values(P.SKINS).map((sk) => {
          const ok = S.skinUnlocked(cur, sk.id);
          return `<div class="skin-opt ${S.skinOf(cur) === sk.id ? 'sel' : ''} ${ok ? '' : 'locked'}" data-skin="${sk.id}" title="${ok ? sk.name : 'Mastery ' + sk.lvl}"><img src="${CS.Spr.towerIcon(cur, [2, 2, 0], sk.id, 64)}" alt="">${sk.name}</div>`;
        }).join('');
        const pg = this.page('TOWERS', `<div class="codex">${list}<div class="panel">
          <div class="cx-head"><img src="${CS.Spr.towerIcon(cur, [0, 0, 0], S.skinOf(cur), 128)}" alt=""><div style="flex:1"><h2>${def.name}</h2><div style="color:var(--muted)">${def.role} · ¢${def.cost} · ${statLine}</div><div class="tags">${def.tags.map((x) => '<span class="chip cyan">' + esc(x) + '</span>').join('')}</div><div style="margin-top:8px">${esc(def.desc)}</div>
          ${un ? '' : `<div style="margin-top:8px"><span class="chip red">LOCKED — Level ${def.unlockLevel}</span> <button class="btn tiny gold" data-buy>Unlock now ◈${S.towerBuyCost(cur)}</button></div>`}</div>
          <div style="display:flex;gap:6px">${variants}</div></div>
          <div class="sec-label">UPGRADE PATHS · max 7 upgrades · only one path past tier 2 · tier 5 needs Mastery 3</div>
          <div class="paths3">${paths}</div>
          <div class="sec-label">MASTERY ${m.lvl} <span style="font-weight:500;letter-spacing:0">(${U.fmt(m.xp)} / ${U.fmt(need)} XP — earned by using this tower)</span></div>
          <div class="xpbar"><div style="width:${((m.xp / need) * 100).toFixed(1)}%"></div></div>
          <div class="mastery-row">${rewards}</div>
          <div class="sec-label">SKINS</div><div class="skin-row">${skins}</div>
        </div></div>`, 'main');
        pg.querySelectorAll('.codex-item').forEach((c) => (c.onclick = () => { cur = c.dataset.t; draw(); }));
        pg.querySelectorAll('[data-skin]').forEach((c) => (c.onclick = () => {
          if (!S.skinUnlocked(cur, c.dataset.skin)) { CS.sfx('error'); return; }
          S.data.skins[cur] = c.dataset.skin; S.save(); draw();
        }));
        const bb = pg.querySelector('[data-buy]');
        if (bb) bb.onclick = () => { if (S.buyTower(cur)) { CS.sfx('upgrade'); draw(); } else { CS.sfx('error'); UI.toast('NOT ENOUGH CHIPS', 'Earn Data Chips by winning matches.', 'warn'); } };
      };
      draw();
    }

    // ───────────────────────────── RESEARCH
    research() {
      const draw = () => {
        let html = `<div style="color:var(--muted);margin:-6px 0 14px">Spend Data Chips on permanent upgrades. Bonuses are small but add up. ${P.RESEARCH.filter((r) => S.data.research[r.id]).length}/${P.RESEARCH.length} complete.</div><div class="research-cols">`;
        for (const cat of P.RESEARCH_CATS) {
          html += `<div class="rcat"><h3>${cat.toUpperCase()}</h3>`;
          for (const r of P.RESEARCH.filter((x) => x.cat === cat)) {
            const done = !!S.data.research[r.id];
            const reqOk = r.req.every((q) => S.data.research[q]);
            const cls = done ? 'done' : !reqOk ? 'locked' : S.data.chips >= r.cost ? 'avail' : 'avail poor';
            html += `<div class="rnode ${cls}" data-r="${r.id}"><div class="rn">${esc(r.name)}</div><div class="rd">${esc(r.desc)}</div><div class="rc">${done ? '✓ RESEARCHED' : !reqOk ? '🔒 Requires ' + r.req.map((q) => P.RESEARCH_BY_ID[q].name).join(', ') : '<span class="dc">' + r.cost + '</span>'}</div></div>`;
          }
          html += '</div>';
        }
        html += '</div>';
        const pg = this.page('RESEARCH', html, 'main');
        pg.querySelectorAll('[data-r]').forEach((n) => (n.onclick = () => {
          if (S.doResearch(n.dataset.r)) { CS.sfx('upgrade'); draw(); } else CS.sfx('error');
        }));
      };
      draw();
    }

    // ───────────────────────────── CHALLENGES
    challenges() {
      const d = S.data;
      const daily = P.dailyChallenge(U.todayKey());
      const ddone = d.daily[daily.date];
      let html = `<div class="panel" style="display:grid;grid-template-columns:260px 1fr;gap:16px;align-items:center">
        <img src="${mapThumb(daily.map)}" style="width:100%;display:block" alt="">
        <div><h3>DAILY PROTOCOL · ${daily.date}</h3><div style="font-size:22px;font-weight:700">${esc(CS.MAP_BY_ID[daily.map].name)} · ${CS.DIFFICULTIES[daily.diff].name}</div>
        <ul style="color:var(--muted);margin:6px 0">${daily.lines.map((l) => '<li>' + esc(l) + '</li>').join('')}</ul>
        <div style="display:flex;gap:10px;align-items:center">${ddone ? '<span class="chip green">✓ COMPLETED — new protocol tomorrow</span>' : 'Reward <span class="dc">' + daily.reward + '</span>'}<button class="btn primary small" data-daily>${ddone ? 'Replay' : 'Play Daily'}</button></div>
        <div style="font-size:12px;color:var(--dim);margin-top:6px">Every player gets the same challenge today. Completed dailies: ${d.stats.dailies}</div></div></div>`;
      html += `<div class="sec-label">SPECIAL MODES — enable them from any map's setup screen</div><div class="list-grid">`;
      for (const id of P.MODE_ORDER) {
        const mo = P.MODES[id];
        const ok = S.isModeUnlocked(id);
        html += `<div class="ch-card"><div class="cn">${mo.name} <span style="color:var(--gold);font-size:14px">×${mo.reward} rewards</span></div><div class="cm">${esc(mo.desc)}</div><div class="row">${ok ? `<button class="btn small" data-mode="${id}">Play with ${mo.name}</button>` : '<span class="chip red">Level ' + mo.level + '</span>'}</div></div>`;
      }
      html += `</div><div class="sec-label">ADVANCED CHALLENGES · ${Object.keys(d.challengesDone).length}/${P.CHALLENGES.length}</div><div class="list-grid">`;
      for (const c of P.CHALLENGES) {
        const ok = d.level >= c.level;
        const done = d.challengesDone[c.id];
        html += `<div class="ch-card ${done ? 'done' : ''}"><div class="cn">${esc(c.name)} ${done ? '<span class="chip green">✓</span>' : ''}</div><div class="cm">${esc(CS.MAP_BY_ID[c.map].name)} · ${CS.DIFFICULTIES[c.diff].name}</div><div>${esc(c.desc)}</div>
          <div class="row">${ok ? `<button class="btn small ${done ? '' : 'primary'}" data-ch="${c.id}">${done ? 'Replay' : 'Attempt'}</button>` : '<span class="chip red">Level ' + c.level + '</span>'}<span style="margin-left:auto">${done ? '' : '<span class="dc">' + c.reward + '</span>'}</span></div></div>`;
      }
      html += '</div>';
      const pg = this.page('CHALLENGES', html, 'main');
      pg.querySelector('[data-daily]').onclick = () => this.show('loadout', { mapId: daily.map, diff: daily.diff, modes: daily.rules.modes, rules: daily.rules, daily });
      pg.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => this.show('play', { modes: [b.dataset.mode] })));
      pg.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => {
        const c = P.CHALLENGES.find((x) => x.id === b.dataset.ch);
        this.show('loadout', { mapId: c.map, diff: c.diff, modes: c.rules.modes || [], rules: c.rules, challenge: c });
      }));
    }

    // ───────────────────────────── ACHIEVEMENTS
    achievements() {
      const d = S.data;
      const n = P.ACHIEVEMENTS.filter((a) => d.achievements[a.id]).length;
      let html = `<div style="color:var(--muted);margin:-6px 0 14px">${n}/${P.ACHIEVEMENTS.length} unlocked · Each grants Data Chips.</div><div class="list-grid">`;
      for (const a of P.ACHIEVEMENTS) {
        const done = d.achievements[a.id];
        html += `<div class="ach ${done ? 'done' : ''}"><div class="ai">${done ? '✦' : '·'}</div><div style="flex:1"><div class="an">${esc(a.name)}</div><div class="ad">${esc(a.desc)}</div></div><div class="dc" style="${done ? 'opacity:.5' : ''}">${a.chips}</div></div>`;
      }
      html += '</div>';
      this.page('ACHIEVEMENTS', html, 'main');
    }

    // ───────────────────────────── PROFILE
    profile() {
      const draw = () => {
        const d = S.data;
        const st = d.stats;
        let fav = '—', favN = 0;
        for (const k in st.towerUse) if (st.towerUse[k] > favN) { favN = st.towerUse[k]; fav = CS.TOWERS[k] ? CS.TOWERS[k].name : k; }
        const icons = Object.values(P.ICONS).map((ic) => { const ok = S.iconUnlocked(ic.id); return `<div class="icon-opt ${d.icon === ic.id ? 'sel' : ''} ${ok ? '' : 'locked'}" data-icon="${ic.id}" title="${ok ? ic.name : ic.level ? 'Level ' + ic.level : 'Achievement: ' + P.ACH_BY_ID[ic.ach].name}">${ic.glyph}</div>`; }).join('')
          + CS.TOWER_ORDER.map((t) => { const id = 'tw:' + t; const ok = S.iconUnlocked(id); return `<div class="icon-opt ${d.icon === id ? 'sel' : ''} ${ok ? '' : 'locked'}" data-icon="${id}" title="${CS.TOWERS[t].name}${ok ? '' : ' — Mastery 6'}"><img src="${CS.Spr.towerIcon(t, [5, 0, 2], S.skinOf(t), 64)}" style="width:38px;height:38px" alt=""></div>`; }).join('');
        const titles = S.titles().map((t) => `<option ${t === d.title ? 'selected' : ''}>${esc(t)}</option>`).join('');
        const cores = Object.values(P.CORE_SKINS).map((c) => { const ok = d.level >= c.level; return `<div class="icon-opt ${d.coreSkin === c.id ? 'sel' : ''} ${ok ? '' : 'locked'}" data-core="${c.id}" title="${ok ? c.name : 'Level ' + c.level}" style="color:${c.c1}">⬢</div>`; }).join('');
        const rows = [
          ['Account level', d.level], ['Data Chips', U.fmt(d.chips)], ['Enemies destroyed', U.fmt(st.kills)], ['Bosses defeated', U.fmt(st.bosses)], ['Total damage dealt', U.fmt(st.damage)],
          ['Credits earned', U.fmt(st.creditsEarned)], ['Towers placed', U.fmt(st.towersPlaced)], ['Favorite tower', fav], ['Highest wave', st.highestWave],
          ['Games completed', st.wins], ['Games lost', st.losses], ['Biggest hit', U.fmt(st.biggestHit)], ['Daily challenges', st.dailies], ['Time played', U.fmtTime(st.timePlayed)],
        ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
        const maps = CS.MAPS.map((m) => { const r = d.maps[m.id] || {}; return `<tr><td>${esc(m.name)}</td><td>${r.best ? CS.DIFFICULTIES[r.best].name : '—'}${r.bestWave ? ' · wave ' + r.bestWave : ''}</td></tr>`; }).join('');
        const pg = this.page('PROFILE', `<div class="two-col"><div>
          <div class="panel"><h3>IDENTITY</h3><div class="sec-label" style="margin-top:0">ICON</div><div class="icon-pick">${icons}</div>
          <div class="sec-label">TITLE</div><select id="title-sel" style="width:100%;padding:6px;background:#070b12;color:#fff;border:1px solid var(--line2);font-size:16px">${titles}</select>
          <div class="sec-label">CORE SKIN</div><div class="icon-pick">${cores}</div></div>
          <div class="panel" style="margin-top:14px"><h3>MAP RECORDS</h3><table class="stat-table">${maps}</table></div></div>
          <div class="panel"><h3>LIFETIME STATISTICS</h3><table class="stat-table">${rows}</table></div></div>`, 'main');
        pg.querySelectorAll('[data-icon]').forEach((b) => (b.onclick = () => { if (!S.iconUnlocked(b.dataset.icon)) return CS.sfx('error'); d.icon = b.dataset.icon; S.save(); draw(); }));
        pg.querySelectorAll('[data-core]').forEach((b) => (b.onclick = () => { if (d.level < P.CORE_SKINS[b.dataset.core].level) return CS.sfx('error'); d.coreSkin = b.dataset.core; S.save(); draw(); }));
        pg.querySelector('#title-sel').onchange = (e) => { d.title = e.target.value; S.save(); };
      };
      draw();
    }

    // ───────────────────────────── SETTINGS
    settingsHTML() {
      const st = S.data.settings;
      const seg = (key, opts) => `<div class="seg" data-seg="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(st[key]) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div>`;
      const sw = (key) => `<button class="switch ${st[key] ? 'on' : ''}" data-sw="${key}"></button>`;
      const sl = (key) => `<input type="range" min="0" max="1" step="0.05" value="${st[key]}" data-sl="${key}">`;
      return `<div class="two-col"><div class="panel"><h3>GRAPHICS</h3>
        <div class="set-row"><label>Quality</label>${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Med'], ['high', 'High']])}</div>
        <div style="font-size:12px;color:var(--muted)">Low disables glow, reduces particles and resolution. Auto lowers quality if frame rate drops.</div>
        <div class="set-row"><label>Screen shake</label>${sw('shake')}</div>
        <div class="set-row"><label>Damage numbers</label>${sw('dmgNumbers')}</div>
        <div class="set-row"><label>Show FPS</label>${sw('showFps')}</div>
        <h3 style="margin-top:14px">GAMEPLAY</h3>
        <div class="set-row"><label>Auto-start waves</label>${sw('autoStart')}</div>
        <div class="set-row"><label>Confirm before selling</label>${sw('confirmSell')}</div>
        <h3 style="margin-top:14px">AUDIO</h3>
        <div class="set-row"><label>Master</label>${sl('master')}</div>
        <div class="set-row"><label>Music</label>${sl('music')}</div>
        <div class="set-row"><label>Sound effects</label>${sl('sfx')}</div>
      </div><div class="panel"><h3>SAVE DATA</h3>
        <div style="font-size:14px;color:var(--muted);margin-bottom:8px">Progress is saved in this browser. Export a save code or file to keep a backup or move to another device.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" data-save="export">Show Save Code</button><button class="btn small" data-save="copy">Copy Code</button>${window.CS_EMBEDDED ? '' : '<button class="btn small" data-save="download">Download File</button>'}</div>
        <textarea class="code" id="save-code" readonly placeholder="Your save code appears here"></textarea>
        <div class="sec-label">IMPORT</div>
        <textarea class="code" id="import-code" placeholder="Paste a save code here"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="btn small primary" data-save="import">Import Code</button><label class="btn small" style="display:inline-block">Load File<input type="file" accept=".json,application/json,text/plain" id="import-file" style="display:none"></label></div>
        <div class="sec-label">DANGER ZONE</div>
        <button class="btn small danger" data-save="reset">Reset All Progress</button>
        <h3 style="margin-top:16px">CONTROLS</h3>${this.keysHTML()}
      </div></div>`;
    }
    keysHTML() {
      return `<div class="keys">
        <kbd>1</kbd><span>–<kbd>6</kbd> Select tower to build (Shift+click to place several)</span>
        <kbd>Click</kbd><span>Place / select tower or enemy</span>
        <kbd>Right-click</kbd><span>Cancel (two-finger tap on trackpads) — <kbd>Esc</kbd> also works</span>
        <kbd>Space</kbd><span>Start / send next wave</span>
        <kbd>F</kbd><span>Cycle speed 1× / 2× / 3×</span>
        <kbd>P</kbd><span>Pause</span>
        <kbd>A</kbd><span><kbd>S</kbd> <kbd>D</kbd> Buy upgrade on path 1 / 2 / 3</span>
        <kbd>Tab</kbd><span>Cycle targeting (also <kbd>,</kbd> <kbd>.</kbd>)</span>
        <kbd>Del</kbd><span>Sell selected tower (Backspace too)</span>
        <kbd>Q</kbd><span><kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>T</kbd> <kbd>Y</kbd> Activate abilities</span>
        <kbd>H</kbd><span>Show controls</span></div>`;
    }
    wireSettings(root, onChange) {
      const st = S.data.settings;
      const apply = () => { S.save(); this.app.applySettings(); if (onChange) onChange(); };
      root.querySelectorAll('[data-seg]').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => { st[g.dataset.seg] = b.dataset.v; g.querySelectorAll('button').forEach((x) => x.classList.toggle('sel', x === b)); apply(); })));
      root.querySelectorAll('[data-sw]').forEach((b) => (b.onclick = () => { st[b.dataset.sw] = !st[b.dataset.sw]; b.classList.toggle('on', st[b.dataset.sw]); apply(); }));
      root.querySelectorAll('[data-sl]').forEach((i) => (i.oninput = () => { st[i.dataset.sl] = +i.value; apply(); }));
      const code = root.querySelector('#save-code');
      root.querySelectorAll('[data-save]').forEach((b) => (b.onclick = () => {
        const a = b.dataset.save;
        if (a === 'export') { code.value = S.exportCode(); code.select(); }
        if (a === 'copy') { code.value = S.exportCode(); code.select(); const fail = () => { code.select(); UI.toast('SAVE', 'Code selected. Copy it with Ctrl+C or long-press → Copy.'); }; try { navigator.clipboard.writeText(code.value).then(() => UI.toast('SAVE', 'Save code copied to clipboard.'), fail); } catch (e) { fail(); } }
        if (a === 'download') { S.downloadFile(); UI.toast('SAVE', 'Save file downloaded.'); }
        if (a === 'import') {
          const v = root.querySelector('#import-code').value;
          UI.confirm('Import save?', 'This replaces your current progress.', 'Import', () => {
            try { S.importCode(v); this.app.applySettings(); UI.toast('SAVE', 'Save imported successfully!'); this.show('main'); } catch (e) { UI.toast('IMPORT FAILED', esc(e.message), 'warn', 4); }
          }, true);
        }
        if (a === 'reset') {
          const m = UI.modal(`<h2>Reset all progress?</h2><div class="sub">This permanently deletes your level, Data Chips, research, mastery and records. Type <b>RESET</b> to confirm.</div><input id="rs" style="width:100%;padding:8px;font-size:18px;background:#070b12;color:#fff;border:1px solid var(--line2)"><div class="modal-actions"><button class="btn ghost" data-a="n">Cancel</button><button class="btn danger" data-a="y">Reset</button></div>`, { width: 440 });
          const inp = m.querySelector('#rs'); inp.focus();
          inp.onkeydown = (e) => e.stopPropagation();
          m.querySelector('[data-a=n]').onclick = () => UI.closeModal(m);
          m.querySelector('[data-a=y]').onclick = () => { if (inp.value.trim().toUpperCase() !== 'RESET') { CS.sfx('error'); return; } S.reset(); UI.closeAllModals(); UI.toast('SAVE', 'Progress reset.'); this.show('main'); };
        }
      }));
      const f = root.querySelector('#import-file');
      if (f) f.onchange = () => {
        const file = f.files[0];
        if (!file) return;
        const rd = new FileReader();
        rd.onload = () => { try { S.importCode(String(rd.result)); this.app.applySettings(); UI.toast('SAVE', 'Save file imported!'); this.show('main'); } catch (e) { UI.toast('IMPORT FAILED', esc(e.message), 'warn', 4); } };
        rd.readAsText(file);
      };
      root.querySelectorAll('textarea').forEach((t) => (t.onkeydown = (e) => e.stopPropagation()));
    }
    settings() {
      const pg = this.page('SETTINGS', this.settingsHTML(), 'main');
      this.wireSettings(pg);
    }
    settingsModal() {
      const m = UI.modal('<h2>SETTINGS</h2>' + this.settingsHTML() + '<div class="modal-actions"><button class="btn primary" data-a="close">Close</button></div>', { width: 980 });
      this.wireSettings(m);
      m.querySelector('[data-a=close]').onclick = () => UI.closeModal(m);
    }
  }

  function unlockName(u) {
    if (u.t === 'tower') return CS.TOWERS[u.id].name;
    if (u.t === 'map') return CS.MAP_BY_ID[u.id].name;
    if (u.t === 'diff') return CS.DIFFICULTIES[u.id].name + ' difficulty';
    if (u.t === 'mode') return P.MODES[u.id].name + ' mode';
    if (u.t === 'core') return P.CORE_SKINS[u.id].name;
    if (u.t === 'icon') return 'Icon ' + P.ICONS[u.id].glyph;
    if (u.t === 'title') return 'Title "' + u.id + '"';
    return u.id;
  }
  CS.unlockName = unlockName;
  CS.Menus = Menus;
})();
