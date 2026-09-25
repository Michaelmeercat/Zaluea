/* CIRCUIT SIEGE — save system & profile logic (localStorage, export/import) */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;
  const P = CS.PROG;
  const KEY = 'circuitSiege.save.v1';

  function defaults() {
    return {
      v: 1,
      created: Date.now(),
      level: 1, xp: 0, chips: 0,
      boughtTowers: {},
      mastery: {},
      skins: {},
      research: {},
      maps: {},
      achievements: {},
      stats: {
        kills: 0, bosses: 0, damage: 0, creditsEarned: 0, farmCredits: 0, towersPlaced: 0, wins: 0, losses: 0, games: 0,
        timePlayed: 0, highestWave: 0, caches: 0, dailies: 0, challenges: 0, towerUse: {}, biggestHit: 0,
      },
      settings: { quality: 'auto', master: 0.8, music: 0.5, sfx: 0.7, shake: true, dmgNumbers: true, showFps: false, autoStart: false, confirmSell: false },
      loadouts: [
        { name: 'GENERAL', towers: ['pulse', 'sniper', 'firewall', 'arc'] },
        { name: 'BOSS KILLER', towers: [] },
        { name: 'SWARM CONTROL', towers: [] },
        { name: 'ECONOMY', towers: [] },
      ],
      loadoutIdx: 0,
      tutorialDone: false,
      daily: {},
      challengesDone: {},
      icon: 'chip', title: 'Recruit', coreSkin: 'standard',
      seenEnemies: {},
    };
  }

  function merge(base, over) {
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], over[k]);
      else base[k] = over[k];
    }
    return base;
  }

  const S = {
    data: defaults(),
    listeners: [],
    storageOk: true,
  };

  S.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) S.data = merge(defaults(), JSON.parse(raw));
    } catch (e) {
      S.storageOk = false;
      console.warn('Save load failed', e);
    }
    return S.data;
  };

  let saveTimer = null;
  S.save = function (now) {
    if (typeof localStorage === 'undefined') return;
    const doSave = () => {
      saveTimer = null;
      try { localStorage.setItem(KEY, JSON.stringify(S.data)); S.storageOk = true; }
      catch (e) { S.storageOk = false; console.warn('Save failed', e); }
    };
    if (now) { if (saveTimer) clearTimeout(saveTimer); doSave(); return; }
    if (!saveTimer) saveTimer = setTimeout(doSave, 400);
  };

  // Save code: "CS1." + base64(json) + "." + checksum
  function checksum(str) { return (CS.U.hashStr(str) % 1679616).toString(36); }
  S.exportCode = function () {
    const json = JSON.stringify(S.data);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return 'CS1.' + b64 + '.' + checksum(json);
  };
  S.importCode = function (code) {
    code = (code || '').trim();
    let json;
    if (code.startsWith('{')) json = code; // raw JSON save file
    else {
      const parts = code.split('.');
      if (parts.length !== 3 || parts[0] !== 'CS1') throw new Error('Not a Circuit Siege save code.');
      json = decodeURIComponent(escape(atob(parts[1])));
      if (checksum(json) !== parts[2]) throw new Error('Save code is damaged (checksum mismatch).');
    }
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== 'object' || typeof obj.level !== 'number') throw new Error('Save data is invalid.');
    S.data = merge(defaults(), obj);
    S.save(true);
  };
  S.downloadFile = function () {
    const blob = new Blob([JSON.stringify(S.data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'circuit-siege-save-' + CS.U.todayKey() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  S.reset = function () {
    const settings = S.data.settings;
    S.data = defaults();
    S.data.settings = settings;
    S.save(true);
  };

  // ───────────────────────── Profile helpers
  const d = () => S.data;
  S.notify = function (kind, payload) { for (const l of S.listeners) l(kind, payload); };

  S.isTowerUnlocked = (id) => d().level >= CS.TOWERS[id].unlockLevel || !!d().boughtTowers[id];
  S.towerBuyCost = (id) => 60 + CS.TOWERS[id].unlockLevel * 45;
  S.buyTower = function (id) {
    const c = S.towerBuyCost(id);
    if (d().chips < c || S.isTowerUnlocked(id)) return false;
    d().chips -= c; d().boughtTowers[id] = true; S.save(); return true;
  };
  S.mapIndex = (id) => CS.MAPS.findIndex((m) => m.id === id);
  S.isMapCompleted = (id) => { const m = d().maps[id]; return !!(m && m.best); };
  S.isMapUnlocked = function (id) {
    const def = CS.MAP_BY_ID[id];
    if (d().level >= def.unlockLevel) return true;
    const i = S.mapIndex(id);
    return i > 0 && i < 6 && S.isMapCompleted(CS.MAPS[i - 1].id);
  };
  S.isDiffUnlocked = function (diffId) {
    const df = CS.DIFFICULTIES[diffId];
    if (!df.unlockLevel || d().level >= df.unlockLevel) return true;
    // Beating any map on the previous difficulty also unlocks it
    const prev = CS.DIFF_ORDER[CS.DIFF_ORDER.indexOf(diffId) - 1];
    for (const k in d().maps) if (d().maps[k].done && d().maps[k].done[prev]) return true;
    return false;
  };
  S.isModeUnlocked = (id) => d().level >= P.MODES[id].level;

  S.mastery = function (tid) {
    if (!d().mastery[tid]) d().mastery[tid] = { lvl: 1, xp: 0 };
    return d().mastery[tid];
  };
  S.addMasteryXP = function (tid, amount) {
    const m = S.mastery(tid);
    const out = [];
    m.xp += Math.round(amount);
    while (m.lvl < 30 && m.xp >= P.masteryNeed(m.lvl)) {
      m.xp -= P.masteryNeed(m.lvl);
      m.lvl++;
      out.push(m.lvl);
      if (m.lvl >= 5) S.unlockAch('specialist');
      if (CS.TOWER_ORDER.every((t) => S.mastery(t).lvl >= 5)) S.unlockAch('polymath');
    }
    return out;
  };
  S.tier5Unlocked = (tid) => S.mastery(tid).lvl >= 3;
  S.masteryBonus = function (tid) {
    const L = S.mastery(tid).lvl;
    return { rate: L >= 4 ? 0.02 : 0, cost: L >= 10 ? 0.03 : 0, trail: L >= 8, glow: L >= 12 };
  };
  S.skinUnlocked = (tid, skin) => S.mastery(tid).lvl >= P.SKINS[skin].lvl || (skin === 'obsidian' && !!d().achievements.nightmare_fuel);
  S.skinOf = (tid) => d().skins[tid] || 'default';

  S.addXP = function (amount) {
    const res = { levels: [], chips: 0, unlocks: [] };
    d().xp += Math.round(amount);
    while (d().xp >= P.xpToNext(d().level)) {
      d().xp -= P.xpToNext(d().level);
      d().level++;
      const c = P.levelChips(d().level);
      d().chips += c;
      res.chips += c;
      res.levels.push(d().level);
      const u = P.LEVEL_UNLOCKS[d().level];
      if (u) res.unlocks.push(...u);
      if (d().level >= 10) S.unlockAch('level10');
      if (d().level >= 25) S.unlockAch('level25');
    }
    return res;
  };

  S.unlockAch = function (id) {
    if (d().achievements[id]) return false;
    const a = P.ACH_BY_ID[id];
    if (!a) return false;
    d().achievements[id] = Date.now();
    d().chips += a.chips;
    S.notify('achievement', a);
    S.save();
    return true;
  };

  S.checkStatAchievements = function () {
    const st = d().stats;
    if (st.towersPlaced >= 100) S.unlockAch('engineer');
    if (st.towersPlaced >= 1000) S.unlockAch('architect');
    if (st.creditsEarned >= 100000) S.unlockAch('economist');
    if (st.creditsEarned >= 1000000) S.unlockAch('tycoon');
    if (st.bosses >= 25) S.unlockAch('boss_hunter');
    if (st.kills >= 10000) S.unlockAch('exterminator');
    if (st.kills >= 100000) S.unlockAch('purge');
    if (st.caches >= 10) S.unlockAch('cache_raider');
    if (st.farmCredits >= 50000) S.unlockAch('farmer');
    if (st.dailies >= 1) S.unlockAch('daily_1');
    if (st.dailies >= 7) S.unlockAch('daily_7');
    if (st.challenges >= 5) S.unlockAch('challenger');
    if (st.highestWave >= 75) S.unlockAch('endless_75');
    if (st.highestWave >= 125) S.unlockAch('endless_125');
    if (P.RESEARCH.every((r) => d().research[r.id])) S.unlockAch('scholar');
    if (CS.MAPS.every((m) => S.isMapCompleted(m.id))) S.unlockAch('cartographer');
  };

  S.research = () => P.researchBonuses(d().research);
  S.canResearch = function (id) {
    const r = P.RESEARCH_BY_ID[id];
    if (d().research[id]) return false;
    if (!r.req.every((q) => d().research[q])) return false;
    return d().chips >= r.cost;
  };
  S.doResearch = function (id) {
    if (!S.canResearch(id)) return false;
    d().chips -= P.RESEARCH_BY_ID[id].cost;
    d().research[id] = true;
    S.checkStatAchievements();
    S.save();
    return true;
  };

  S.unlockedTowers = () => CS.TOWER_ORDER.filter((t) => S.isTowerUnlocked(t));
  S.currentLoadout = function () {
    const lo = d().loadouts[d().loadoutIdx] || d().loadouts[0];
    let towers = lo.towers.filter((t) => CS.TOWERS[t] && S.isTowerUnlocked(t));
    if (towers.length === 0) towers = S.unlockedTowers().slice(0, 6);
    return towers.slice(0, 6);
  };

  S.iconUnlocked = function (id) {
    const ic = P.ICONS[id];
    if (!ic) return false;
    if (ic.ach) return !!d().achievements[ic.ach];
    return d().level >= ic.level;
  };
  S.titles = function () {
    const t = ['Recruit'];
    for (const L in P.LEVEL_UNLOCKS) for (const u of P.LEVEL_UNLOCKS[L]) if (u.t === 'title' && d().level >= +L) t.push(u.id);
    for (const tid of CS.TOWER_ORDER) if (S.mastery(tid).lvl >= 20) t.push(CS.TOWERS[tid].name + ' Legend');
    if (d().achievements.nightmare_fuel) t.push('Nightmare Walker');
    if (d().achievements.root_access) t.push('Root Breaker');
    return t;
  };

  CS.Save = S;
})();
