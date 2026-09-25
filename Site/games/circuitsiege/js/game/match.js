/* CIRCUIT SIEGE — match simulation (headless-safe: no DOM access here) */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;
  const U = CS.U;
  const E = CS.ENEMIES;
  const sfx = (n, v) => { if (CS.sfx) CS.sfx(n, v); };

  const DT = 1 / 60;
  const tmpPos = { x: 0, y: 0, a: 0 };
  let NEXT_ID = 1;

  function newEnemy() {
    return { alive: false };
  }

  class Match {
    constructor(cfg) {
      this.cfg = cfg;
      this.def = CS.MAP_BY_ID[cfg.mapId];
      this.modes = {};
      for (const m of cfg.modes || []) this.modes[m] = true;
      this.rules = cfg.rules || {};
      this.map = CS.buildMap(this.def, !!this.modes.reverse);
      this.diff = CS.DIFFICULTIES[cfg.diff];
      this.research = cfg.research || CS.PROG.researchBonuses({});
      this.masteryBonus = cfg.masteryBonus || (() => ({ rate: 0, cost: 0, trail: false, glow: false }));
      this.tutorial = !!cfg.tutorial;
      this.loadout = cfg.loadout;
      this.seed = cfg.mapId + ':' + cfg.diff;
      this.fx = new CS.FX();
      this.listener = null;

      const cashMult = 1 + this.research.cashPct + (this.rules.cashPct || 0);
      this.credits = Math.round((this.rules.cash || this.diff.cash) * cashMult);
      if (this.tutorial) this.credits = 400;
      this.coreMax = this.diff.core + this.research.coreHp;
      if (this.modes.onelife) this.coreMax = 1;
      this.coreHp = this.coreMax;
      this.maxWave = this.tutorial ? CS.TUTORIAL_WAVES.length - 1 : this.diff.waves;
      this.wave = 0;
      this.endless = false;
      this.state = 'play'; // play | victory | defeat
      this.victoryShown = false;
      this.time = 0;
      this.speed = 1;
      this.paused = false;

      this.enemies = [];
      this.enemyPool = [];
      this.towers = [];
      this.zones = [];
      this.zombies = [];
      this.spawnQueue = [];
      this.waveClock = 0;
      this.waveLeft = {}; // wave -> remaining enemies (queued + alive)
      this.rr = 0;
      this.grid = new U.Grid(CS.WORLD_W + 200, CS.WORLD_H + 200, 64);

      this.projs = new U.Pool(() => ({}), 200);
      this.abilities = {};
      this.overclockT = 0; this.freezeT = 0; this.overloadT = 0; this.surgeT = 0;
      this.event = null; // current random event offer
      this.autoStart = false;
      this.autoTimer = 0;
      this.reserveUsed = false;
      this.corrupt = this.def.corruption ? { active: -1, warn: -1, timer: 18, t: 0 } : null;
      this.sand = this.def.sandstorm ? { timer: 30, t: 0, active: false } : null;
      this.bossBar = null;
      this.stats = { kills: 0, damage: 0, creditsEarned: 0, farmCredits: 0, towersPlaced: 0, leaks: 0, bosses: 0, biggestHit: 0, maxChain: 0, caches: 0, towerTypes: {}, wavesCleared: 0, rootKilled: false, coreLost: 0 };
      this.inflation = 1;
      this.seen = {};
    }

    emit(type, data) { if (this.listener) this.listener(type, data); }

    // ───────────────────────── Economy helpers
    costMult() { return this.diff.cost * this.inflation; }
    placeCost(type) {
      const def = CS.TOWERS[type];
      const mb = this.masteryBonus(type);
      return Math.round(def.cost * this.costMult() * (1 - this.research.costPct) * (1 - mb.cost) / 5) * 5;
    }
    upgradeCost(t, path) {
      const tier = t.tiers[path];
      if (tier >= 5) return Infinity;
      const up = t.def.paths[path].ups[tier];
      let c = up.c * this.costMult();
      if (tier === 0) c *= 1 - this.research.firstUpg;
      let disc = 0;
      for (const f of this.towers) {
        if (f.type === 'farm' && f.s.supplyDiscount > disc && U.dist2(f.x, f.y, t.x, t.y) <= f.s.range * f.s.range) disc = f.s.supplyDiscount;
      }
      c *= 1 - disc;
      return Math.round(c / 5) * 5;
    }
    sellValue(t) { return Math.floor(t.spent * (0.7 + this.research.sellPct)); }
    addCredits(n, x, y, fromFarm) {
      n = Math.round(n);
      if (n <= 0) return;
      this.credits += n;
      this.stats.creditsEarned += n;
      if (fromFarm) this.stats.farmCredits += n;
      if (x !== undefined && fromFarm) this.fx.text(x, y - 16, '+' + n, '#ffd84d', 14, 1.1);
    }

    // ───────────────────────── Placement
    canPlace(type, x, y) {
      const def = CS.TOWERS[type];
      const r = def.r;
      if (x < r || y < r || x > CS.WORLD_W - r || y > CS.WORLD_H - r) return { ok: false, why: 'Out of bounds' };
      if (CS.pathDistAt(this.map, x, y) < CS.PATH_W / 2 + r - 4) return { ok: false, why: 'Cannot build on the path' };
      if (CS.pointBlocked(this.def, x, y, r - 4)) return { ok: false, why: 'Restricted terrain' };
      for (const c of this.map.cores) if (U.dist2(x, y, c.x, c.y) < (r + 34) * (r + 34)) return { ok: false, why: 'Too close to the Core' };
      for (const t of this.towers) {
        const rr = t.def.r + r - 2;
        if (U.dist2(x, y, t.x, t.y) < rr * rr) return { ok: false, why: 'Overlaps another tower' };
      }
      if (this.corrupt && this.corrupt.active >= 0) {
        const z = this.def.corruption[this.corrupt.active];
        if (U.dist2(x, y, z.x, z.y) < z.r * z.r) return { ok: false, why: 'Corrupted zone' };
      }
      for (const z of this.zones) if (z.kind === 'corrupt' && U.dist2(x, y, z.x, z.y) < z.r * z.r) return { ok: false, why: 'Corrupted zone' };
      if (this.rules.maxTowers && this.towers.length >= this.rules.maxTowers) return { ok: false, why: 'Tower limit reached (' + this.rules.maxTowers + ')' };
      return { ok: true };
    }

    placeTower(type, x, y) {
      const cost = this.placeCost(type);
      if (this.credits < cost) return null;
      if (!this.canPlace(type, x, y).ok) return null;
      this.credits -= cost;
      const def = CS.TOWERS[type];
      const t = {
        id: NEXT_ID++, type, def, x, y, tiers: [0, 0, 0], spent: cost, angle: -Math.PI / 2, cd: 0.2, target: null, retargetT: 0,
        targeting: def.targeting[0] || null, dmgDealt: 0, kills: 0, disabledT: 0, offline: false, recoil: 0, drones: [], shots: 0,
        auraT: { pulse: 0, freeze: 0, pull: 0, implode: 0 }, farmPay: 0, farmT: 0, placeT: 0, beamT: 0, earned: 0, spin: 0,
      };
      t.baseS = CS.buildStats(type, t.tiers);
      this.towers.push(t);
      this.stats.towersPlaced++;
      this.stats.towerTypes[type] = (this.stats.towerTypes[type] || 0) + 1;
      this.refreshTowers();
      this.fx.ring(x, y, 6, def.r + 16, def.color, 0.4, 3);
      this.fx.spark(x, y, def.color, 14, 120, 0.4, 2);
      sfx('place');
      this.emit('placed', t);
      return t;
    }

    upgradeTower(t, path, free) {
      if (this.rules.maxTier && t.tiers[path] >= this.rules.maxTier) return false;
      const chk = CS.canTakeUpgrade(t.tiers, path);
      if (!chk.ok) return false;
      if (t.tiers[path] === 4 && this.cfg.tier5Locked && this.cfg.tier5Locked(t.type)) return false;
      const cost = this.upgradeCost(t, path);
      if (!free) {
        if (this.credits < cost) return false;
        this.credits -= cost;
        t.spent += cost;
      }
      t.tiers[path]++;
      t.baseS = CS.buildStats(t.type, t.tiers);
      this.refreshTowers();
      const tier = t.tiers[path];
      this.fx.ring(t.x, t.y, 8, t.def.r + 30, tier >= 5 ? '#ffd84d' : t.def.color, 0.55, tier >= 4 ? 5 : 3);
      this.fx.spark(t.x, t.y, tier >= 5 ? '#ffd84d' : '#ffffff', tier >= 5 ? 40 : 18, tier >= 5 ? 220 : 140, 0.6, 2.5);
      if (tier >= 5) { this.fx.flash(t.x, t.y, 120, '#ffd84d', 0.4); this.fx.shake(3); }
      t.placeT = 0;
      sfx(tier >= 5 ? 'upgrade5' : 'upgrade');
      this.emit('upgraded', { t, path, tier });
      return true;
    }

    sellTower(t) {
      const v = this.sellValue(t);
      this.credits += v;
      this.towers.splice(this.towers.indexOf(t), 1);
      (this.soldTowers || (this.soldTowers = [])).push({ type: t.type, dmgDealt: t.dmgDealt, kills: t.kills, earned: t.earned });
      this.fx.spark(t.x, t.y, '#ffd84d', 16, 140, 0.5, 2);
      this.fx.text(t.x, t.y - 10, '+' + v, '#ffd84d', 14, 1);
      this.refreshTowers();
      sfx('sell');
      this.emit('sold', t);
    }

    // Recompute final stats with amplifier buffs, research, network effects.
    refreshTowers() {
      const R = this.research;
      const amps = this.towers.filter((t) => t.type === 'amp');
      let net = false, eliteSpot = false;
      for (const t of this.towers) {
        if (t.baseS.netPulse) net = true;
        if (t.baseS.eliteSpotter) eliteSpot = true;
      }
      const spotters = this.towers.filter((t) => t.baseS.spotter > 0);
      for (const t of this.towers) {
        const s = Object.assign({}, t.baseS);
        const mb = this.masteryBonus(t.type);
        // Amplifier (strongest per stat, no stacking)
        const b = { dmg: 0, rate: 0, range: 0, pen: 0, crit: 0, detect: false, proj: 0, cd: 0, pierce: 0, boss: 0 };
        if (t.type !== 'amp') {
          for (const a of amps) {
            const as = a.baseS;
            if (U.dist2(a.x, a.y, t.x, t.y) > as.range * as.range) continue;
            b.dmg = Math.max(b.dmg, as.buffDmg); b.rate = Math.max(b.rate, as.buffRate); b.range = Math.max(b.range, as.buffRange);
            b.pen = Math.max(b.pen, as.buffArmorPen); b.crit = Math.max(b.crit, as.buffCrit); b.detect = b.detect || as.buffDetect;
            b.proj = Math.max(b.proj, as.buffProj); b.cd = Math.max(b.cd, as.buffCd); b.pierce = Math.max(b.pierce, as.buffPierce); b.boss = Math.max(b.boss, as.buffBoss);
          }
        }
        t.buff = b;
        const dm = (1 + b.dmg) * (1 + R.dmgPct);
        s.dmg *= dm; s.droneDmg *= dm; s.auraDot *= dm; s.virusDps *= dm; s.faraday *= dm; s.auraPulseDmg *= dm; s.implodeDmg *= dm; s.trail *= dm; s.field *= dm; s.overload *= dm;
        const rm = (1 + b.rate) * (1 + mb.rate);
        s.rate *= rm; s.droneRate *= rm;
        s.range *= (1 + b.range) * (1 + R.rangePct);
        s.armorPen += b.pen; s.crit = Math.min(0.9, s.crit + b.crit); s.detect = s.detect || b.detect;
        s.projSpeed *= (1 + b.proj) * (1 + R.projPct); s.pierce += b.pierce; s.bossMult += b.boss;
        if (t.type === 'farm') s.income *= 1 + R.farmPct;
        if (net && t.type === 'pulse') { s.rate *= 1.25; s.range *= 1.1; s.detect = true; }
        for (const sp of spotters) {
          if (sp === t) continue;
          if (U.dist2(sp.x, sp.y, t.x, t.y) <= sp.baseS.spotter * sp.baseS.spotter) { s.detect = true; if (sp.baseS.spotRange) s.range *= 1 + sp.baseS.spotRange; }
        }
        if (eliteSpot) s.detect = true;
        t.s = s;
        // Drone fleet sync
        if (t.type === 'drone') {
          const want = s.drones + s.gunships;
          while (t.drones.length < want) t.drones.push({ x: t.x, y: t.y, vx: 0, vy: 0, cd: Math.random(), target: null, rt: 0, gun: false, a: 0, orbit: Math.random() * 6.28 });
          while (t.drones.length > want) t.drones.pop();
          for (let i = 0; i < t.drones.length; i++) t.drones[i].gun = i >= s.drones;
        }
      }
      // Abilities available
      const avail = {};
      for (const t of this.towers) if (t.s.ability) avail[t.s.ability] = true;
      for (const id in avail) {
        if (!this.abilities[id]) {
          const max = CS.ABILITIES[id].cd * (1 - this.research.cdPct);
          this.abilities[id] = { id, cd: this.research.abilityReady ? 0 : max * 0.5, max };
          this.emit('abilityUnlocked', id);
        }
      }
      for (const id in this.abilities) this.abilities[id].avail = !!avail[id];
    }

    // ───────────────────────── Waves
    canStartWave() {
      return this.state === 'play' && this.spawnQueue.length === 0 && (this.wave < this.maxWave || this.endless);
    }

    startWave() {
      if (!this.canStartWave()) return false;
      this.wave++;
      const w = this.wave;
      let groups = this.tutorial ? CS.getTutorialWave(w) : CS.getWave(w, this.seed, this.endless || w > 100);
      if (this.modes.double) {
        const extra = [];
        for (const g of groups) if (E[g.type].boss) extra.push({ type: g.type, count: g.count, gap: g.gap, start: g.start + 9 });
        groups = groups.concat(extra);
      }
      const q = [];
      let bossNames = [];
      for (const g of groups) {
        for (let i = 0; i < g.count; i++) q.push({ t: g.start + i * g.gap, type: g.type });
        if (E[g.type].boss) bossNames.push(E[g.type].name);
      }
      // Random events
      this.event = null;
      if (!this.tutorial && w >= 8 && bossNames.length === 0 && Math.random() < 0.11) {
        const roll = Math.random();
        if (roll < 0.45) { q.push({ t: 4 + Math.random() * 4, type: 'cache' }); this.emit('event', { id: 'cache', title: 'DATA CACHE DETECTED', text: 'Destroy the golden cache before it escapes for bonus Credits!' }); }
        else if (roll < 0.75) { this.event = { id: 'overload', expires: 8 }; this.emit('event', { id: 'overload', title: 'SYSTEM OVERLOAD', text: 'Accept? Towers +50% attack speed for 15s — but enemies move 25% faster.', offer: true }); }
        else { this.surgeT = 20; this.emit('event', { id: 'surge', title: 'CREDIT SURGE', text: 'Enemies drop double Credits for 20 seconds!' }); }
      }
      q.sort((a, b) => a.t - b.t);
      for (const s of q) s.wave = w;
      this.spawnQueue = q;
      this.waveClock = 0;
      this.waveLeft[w] = q.length;
      if (this.modes.inflation) this.inflation = 1 + 0.015 * w;
      // Farms pay out over the wave
      for (const t of this.towers) if (t.type === 'farm') { t.farmPay = t.s.income; t.farmT = 0.5; t.farmChunks = 5; }
      for (const t of this.towers) if (t.type === 'sniper' && t.s.income) { this.addCredits(t.s.income, t.x, t.y, false); }
      // Introduce new enemy types
      const newTypes = [];
      for (const g of groups) if (!this.seen[g.type]) { this.seen[g.type] = true; newTypes.push(g.type); }
      this.emit('waveStart', { wave: w, boss: bossNames, newTypes });
      if (bossNames.length) { sfx('boss'); } else sfx('wave');
      return true;
    }

    acceptEvent() {
      if (!this.event) return;
      if (this.event.id === 'overload') { this.overloadT = 15; sfx('ability'); this.emit('eventAccepted', 'overload'); }
      this.event = null;
    }

    waveComplete(w) {
      delete this.waveLeft[w];
      this.stats.wavesCleared = Math.max(this.stats.wavesCleared, w);
      if (this.state !== 'play') return;
      let bonus = CS.waveBonus(w) * (1 + this.research.wavePct) * (this.diff.id === 'casual' ? 1.2 : 1);
      if (this.tutorial) bonus = 60;
      this.addCredits(bonus);
      // Interest (best farm)
      let interest = 0;
      for (const t of this.towers) if (t.type === 'farm' && t.s.interest) interest = Math.max(interest, Math.min(t.s.interestCap, this.credits * t.s.interest));
      if (interest > 0) { this.addCredits(interest, undefined, undefined, true); }
      const isBoss = this.tutorial ? false : CS.isBossWave(w);
      if (isBoss && this.research.coreRegen) this.coreHp = Math.min(this.coreMax, this.coreHp + this.research.coreRegen);
      this.emit('waveEnd', { wave: w, bonus: Math.round(bonus), interest: Math.round(interest) });
      if (!this.endless && this.wave >= this.maxWave && this.spawnQueue.length === 0 && Object.keys(this.waveLeft).length === 0) {
        this.state = 'victory';
        sfx('victory');
        this.emit('victory', {});
      }
    }

    continueEndless() {
      this.endless = true;
      this.maxWave = Infinity;
      this.state = 'play';
      this.emit('endless', {});
    }

    // ───────────────────────── Enemies
    spawnEnemy(type, pathIdx, dist, wave, opts) {
      const def = E[type];
      let e = this.enemyPool.pop() || newEnemy();
      const path = this.map.paths[pathIdx];
      const hs = CS.hpScale(wave) * this.diff.hp * (def.boss ? this.diff.boss : 1) * (this.tutorial ? 0.8 : 1);
      e.id = NEXT_ID++; e.def = def; e.type = type; e.path = path; e.pathIdx = pathIdx; e.dist = dist;
      e.x = path.xs[0]; e.y = path.ys[0]; e.ang = 0; e.r = def.r; e.alive = true; e.wave = wave; e.boss = !!def.boss;
      e.maxHp = e.hp = Math.round(def.hp * hs);
      e.armor = (def.armor || 0) + (wave > 40 && def.armor ? Math.floor((wave - 40) / 15) : 0);
      e.shieldMax = e.shield = def.shield ? Math.round(def.shield * hs) : 0;
      e.shieldHitT = 5;
      let spd = def.speed * this.diff.speed * CS.speedScale(wave);
      if (this.modes.speed) spd *= 1.4;
      if (this.rules.enemySpeed) spd *= 1 + this.rules.enemySpeed;
      e.speed = spd;
      e.stealth = !!def.stealth; e.revealT = 0; e.permaReveal = false;
      e.slowT = 0; e.slowAmt = 0; e.slowAura = 0; e.stunT = 0;
      e.burnDps = 0; e.burnT = 0; e.burnSrc = null;
      e.virusDps = 0; e.virusT = 0; e.virusSrc = null; e.spreadT = 0;
      e.vulnT = 0; e.vulnAmt = 0; e.vulnAura = 0; e.markT = 0; e.shred = 0; e.shredAura = 0;
      e.hasteAura = 0; e.commanded = false; e.quarantined = false; e.revealAura = false;
      e.hitT = 0; e.kick = 0; e.numAcc = 0; e.numT = 0; e.critAcc = 0;
      e.abT = 1 + Math.random(); e.abT2 = 3; e.abT3 = 5; e.abT4 = 7; e.phaseT = 2 + Math.random() * 2; e.phased = false; e.burrowT = 0;
      e.leader = null; e.segIdx = 0; e.segAlive = 0; e.segs = null; e.transformed = false; e.rootPhase = 0; e.speedMul = 1; e.speedModeT = 9;
      e.elite = null; e.age = 0; e.escaped = false; e.cacheValue = 0; e.wobble = Math.random() * 6.28; e.lastHitBy = null;
      e.inTunnel = false;
      // Elite roll
      if (!def.boss && !opts?.noElite && type !== 'mini' && type !== 'cache' && type !== 'wormseg') {
        const ch = this.tutorial ? 0 : CS.eliteChance(wave, this.diff.elite, this.endless);
        if (ch > 0 && Math.random() < ch) this.makeElite(e, U.pick(CS.ELITE_IDS));
      }
      if (type === 'cache') e.cacheValue = 250 + wave * 12;
      this.enemies.push(e);
      if (opts && opts.count !== false) this.waveLeft[wave] = (this.waveLeft[wave] || 0) + 1;
      if (def.boss) this.onBossSpawn(e);
      CS.pathPos(path, Math.max(0, dist), tmpPos); e.x = tmpPos.x; e.y = tmpPos.y; e.ang = tmpPos.a;
      return e;
    }

    makeElite(e, id) {
      e.elite = id;
      if (id === 'fortified') { e.armor += 5; e.maxHp = e.hp = Math.round(e.maxHp * 1.5); }
      if (id === 'hyper') e.speed *= 1.5;
    }

    onBossSpawn(e) {
      if (e.type === 'worm') {
        e.segs = [];
        const n = E.worm.segments;
        for (let i = 0; i < n; i++) {
          const s = this.spawnEnemy('wormseg', e.pathIdx, e.dist - (i + 1) * 30, e.wave, { noElite: true, count: true });
          s.leader = e; s.segIdx = i + 1;
          s.maxHp = s.hp = Math.round(E.wormseg.hp * CS.hpScale(e.wave) * this.diff.hp * this.diff.boss);
          e.segs.push(s);
        }
        e.segAlive = n;
      }
      this.bossBar = e;
      this.emit('boss', e);
    }

    // Is enemy targetable by tower t
    canTarget(t, e) {
      if (!e.alive || e.phased || e.burrowT > 0 || e.dist < 0) return false;
      if (e.stealth && !(t.s.detect || e.revealT > 0 || e.permaReveal || e.revealAura)) return false;
      return true;
    }

    score(e, mode, t) {
      switch (mode) {
        case 'first': return e.dist - e.path.len; // less remaining = higher
        case 'last': return e.path.len - e.dist;
        case 'strong': return (e.boss ? 1e9 : 0) + e.hp + e.shield;
        case 'weak': return -(e.hp + e.shield);
        case 'close': return -U.dist2(e.x, e.y, t.x, t.y);
        case 'boss': return (e.boss ? 2e9 : 0) + (e.elite ? 1e9 : 0) + e.hp + e.shield;
        case 'fast': return e.speed * (e.def.fast ? 3 : 1) + (e.dist - e.path.len) * 0.001;
        default: return e.dist;
      }
    }

    findTarget(t, range, mode) {
      let best = null, bs = -Infinity;
      const r2base = range;
      this.grid.query(t.x, t.y, range + 40, (e) => {
        if (!this.canTarget(t, e)) return;
        const rr = r2base + e.r * 0.6;
        if (U.dist2(e.x, e.y, t.x, t.y) > rr * rr) return;
        const sc = this.score(e, mode, t);
        if (sc > bs) { bs = sc; best = e; }
      });
      return best;
    }

    findTargets(t, range, mode, n) {
      const list = [];
      this.grid.query(t.x, t.y, range + 40, (e) => {
        if (!this.canTarget(t, e)) return;
        const rr = range + e.r * 0.6;
        if (U.dist2(e.x, e.y, t.x, t.y) > rr * rr) return;
        list.push(e);
      });
      list.sort((a, b) => this.score(b, mode, t) - this.score(a, mode, t));
      return list.slice(0, n);
    }

    // ───────────────────────── Damage
    damage(e, amt, type, src, opts) {
      if (!e.alive || e.phased || amt <= 0) return 0;
      if (e.burrowT > 0 && !(opts && opts.area)) return 0;
      const s = src ? src.s : null;
      let m = 1 + e.vulnAura + (e.vulnT > 0 ? e.vulnAmt : 0) + (e.markT > 0 ? 1 : 0);
      if (e.virusT > 0 && e.virusSrc && e.virusSrc.s.weaken) m += e.virusSrc.s.weaken;
      if (s && e.boss) m *= s.bossMult;
      if (e.commanded) m *= 0.75;
      amt *= m;
      const crit = opts && opts.crit;
      // Shields
      if (e.shield > 0 && type !== 'toxic' && !(opts && opts.bypass)) {
        const sm = s ? s.shieldMult : 1;
        const sd = amt * sm;
        if (sd >= e.shield) {
          amt -= e.shield / sm;
          e.shield = 0;
          this.fx.ring(e.x, e.y, e.r, e.r + 14, '#7fc4ff', 0.3, 2);
          sfx('shield_break');
        } else { e.shield -= sd; amt = 0; }
        e.shieldHitT = 0;
      }
      // Armor
      if (amt > 0 && e.armor > 0 && type !== 'energy' && type !== 'toxic' && type !== 'fire') {
        let ar = e.armor - e.shred - e.shredAura - (e.virusT > 0 && e.virusSrc ? e.virusSrc.s.virusShred : 0);
        if (type === 'explosive') ar *= 0.5;
        ar -= (opts && opts.pen !== undefined ? opts.pen : s ? s.armorPen : 0);
        if (ar > 0) amt = Math.max(amt * 0.2, amt - ar);
      }
      if (amt <= 0) return 0;
      const dealt = Math.min(amt, e.hp);
      e.hp -= amt;
      this.stats.damage += dealt;
      if (src) src.dmgDealt += dealt;
      if (amt > this.stats.biggestHit) this.stats.biggestHit = amt;
      e.lastHitBy = src;
      if (!(opts && opts.dot)) { e.hitT = 0.09; e.kick = Math.min(3, e.kick + 1.2); }
      if (crit) this.fx.text(e.x, e.y - e.r - 6, Math.round(amt) + '!', '#ff5a7a', 15, 0.9);
      else e.numAcc += amt;
      // Trojan unpack
      if (e.def.transform && !e.transformed && e.hp > 0 && e.hp < e.maxHp * 0.5) this.transformTrojan(e);
      if (e.hp <= 0) this.kill(e, src);
      return dealt;
    }

    transformTrojan(e) {
      const nd = E[e.def.transform];
      e.transformed = true;
      e.def = nd; e.type = nd.id;
      const hs = CS.hpScale(e.wave) * this.diff.hp;
      e.maxHp = e.hp = Math.round(nd.hp * hs);
      e.armor = nd.armor || 0;
      e.speed = nd.speed * this.diff.speed * CS.speedScale(e.wave) * (this.modes.speed ? 1.4 : 1) * (1 + (this.rules.enemySpeed || 0));
      e.r = nd.r;
      this.fx.ring(e.x, e.y, 4, 40, '#ff3d6e', 0.35, 3);
      this.fx.shards(e.x, e.y, '#3ee6d0', 10, 120);
      sfx('transform');
      if (!this.seen.trojanx) { this.seen.trojanx = true; }
    }

    // Hit with all on-hit effects of source stats
    hit(e, t, baseDmg, opts) {
      const s = t.s;
      let dmg = baseDmg;
      let crit = false;
      if (s.crit > 0 && Math.random() < s.crit) { dmg *= s.critMult; crit = true; if (s.markOnCrit) { e.vulnT = 3; e.vulnAmt = Math.max(e.vulnAmt, s.markOnCrit); } }
      if (s.antiFast && e.def.fast) dmg *= s.antiFast;
      if (s.execute && !e.boss && e.hp < e.maxHp * s.execute) dmg = e.hp + e.shield + 1;
      const o = opts || {};
      o.crit = crit;
      this.damage(e, dmg, o.type || s.type, t, o);
      if (!e.alive) return;
      if (s.stun && !e.boss) e.stunT = Math.max(e.stunT, s.stun);
      if (s.slow) { e.slowT = Math.max(e.slowT, s.slowDur); e.slowAmt = Math.max(e.slowAmt, s.slow); }
      if (s.burn) { e.burnDps = Math.max(e.burnDps, s.burn); e.burnT = Math.max(e.burnT, s.burnDur); e.burnSrc = t; }
      if (s.vuln) { e.vulnT = Math.max(e.vulnT, s.vulnDur); e.vulnAmt = Math.max(e.vulnAmt, s.vuln); }
      if (s.shred && !o.noShred) e.shred = Math.min(e.armor, e.shred + s.shred);
      if (s.reveal && e.stealth) e.permaReveal = true;
      if (s.knock && !e.boss) e.dist = Math.max(0, e.dist - s.knock * (o.knockMul || 1));
    }

    infect(e, t, mult) {
      const s = t.s;
      const dps = s.virusDps * (mult || 1);
      if (dps >= e.virusDps || e.virusT <= 0) { e.virusDps = dps; e.virusSrc = t; }
      e.virusT = Math.max(e.virusT, s.virusDur);
      if (s.reveal && e.stealth) e.permaReveal = true;
    }

    splash(x, y, r, dmg, type, t, opts, except) {
      const r2 = r * r;
      let n = 0;
      this.grid.query(x, y, r + 40, (e) => {
        if (!e.alive || e === except || e.dist < 0) return;
        const rr = r + e.r;
        if (U.dist2(x, y, e.x, e.y) > rr * rr) return;
        if (t) this.hit(e, t, dmg, Object.assign({ area: true, type }, opts || {}));
        else this.damage(e, dmg, type, null, { area: true });
        n++;
      });
      return n;
    }

    kill(e, src) {
      if (!e.alive) return;
      e.alive = false;
      const def = e.def;
      this.stats.kills++;
      if (src) src.kills++;
      // Credits
      if (def.reward > 0) {
        let mult = this.diff.reward * (this.surgeT > 0 ? 2 : 1);
        let bounty = 0, gb = 0;
        for (const f of this.towers) {
          if (f.type !== 'farm') continue;
          if (f.s.globalBounty > gb) gb = f.s.globalBounty;
          if (f.s.bounty > bounty && U.dist2(f.x, f.y, e.x, e.y) <= f.s.range * f.s.range) bounty = f.s.bounty;
        }
        mult *= 1 + bounty + gb;
        const endlessDecay = this.wave > 60 ? Math.max(0.35, 1 - (this.wave - 60) * 0.012) : 1;
        this.addCredits(def.reward * mult * endlessDecay);
      }
      if (e.cacheValue) {
        this.addCredits(e.cacheValue);
        this.stats.caches++;
        this.fx.text(e.x, e.y - 20, '+' + e.cacheValue + ' CACHE', '#ffd84d', 18, 1.6);
        this.emit('cacheKilled', e.cacheValue);
        sfx('cash');
      }
      // FX
      const col = def.color;
      if (e.boss) {
        this.fx.shards(e.x, e.y, col, 40, 260); this.fx.spark(e.x, e.y, '#ffffff', 40, 300, 0.9, 3);
        this.fx.ring(e.x, e.y, 10, 180, col, 0.8, 6); this.fx.flash(e.x, e.y, 260, col, 0.5); this.fx.shake(7);
        this.stats.bosses++;
        if (e.type === 'root') this.stats.rootKilled = true;
        sfx('boss_kill');
        this.emit('bossKilled', e);
        if (this.bossBar === e) this.bossBar = this.enemies.find((o) => o.alive && o.boss) || null;
      } else {
        this.fx.shards(e.x, e.y, col, e.r > 13 ? 8 : 5, 110);
        this.fx.spark(e.x, e.y, col, 5, 90, 0.35, 2);
        if (e.r > 14) this.fx.ring(e.x, e.y, 4, e.r + 16, col, 0.25, 2);
        sfx('kill');
      }
      // Splitter
      if (def.split) {
        for (let i = 0; i < def.split; i++) {
          const c = this.spawnEnemy('mini', e.pathIdx, Math.max(0, e.dist - i * 10 + 8), e.wave, { noElite: true });
          c.stunT = 0.15;
          if (e.virusT > 0 && e.virusSrc) this.infect(c, e.virusSrc);
        }
      }
      // Worm linkage
      if (e.leader && e.leader.alive) {
        e.leader.segAlive--;
      }
      if (e.segs) for (const s of e.segs) s.leader = null;
      // Virus spread / zombies
      if (e.virusT > 0 && e.virusSrc) {
        const vs = e.virusSrc.s;
        if (vs.spreadOnDeath) this.spreadVirus(e, e.virusSrc, vs.spreadOnDeath, 90);
        if (vs.zombie && !e.boss) this.zombies.push({ path: e.path, dist: e.dist, x: e.x, y: e.y, power: 60 + this.wave * 12, charges: 3, src: e.virusSrc, life: 18, hitCd: 0 });
      }
      // Arc overload
      if (src && src.s.overload && src.type === 'arc') {
        this.fx.ring(e.x, e.y, 4, 45, '#8ab4ff', 0.25, 2);
        this.splash(e.x, e.y, 45, src.s.overload, 'energy', null);
      }
      const w = e.wave;
      if (this.waveLeft[w] !== undefined) {
        this.waveLeft[w]--;
      }
    }

    spreadVirus(e, src, n, range) {
      let c = 0;
      this.grid.query(e.x, e.y, range, (o) => {
        if (c >= n || o === e || !o.alive || o.virusT > 0) return;
        if (U.dist2(o.x, o.y, e.x, e.y) > range * range) return;
        this.infect(o, src);
        this.fx.beam(e.x, e.y, o.x, o.y, '#7dff6a', 1.5, 0.25, 0);
        c++;
      });
    }

    leak(e) {
      e.alive = false;
      if (e.cacheValue) { this.emit('cacheEscaped', {}); }
      else {
        let dmg = e.def.leak;
        if (this.tutorial && e.boss) dmg = 60;
        if (this.modes.onelife) dmg = 9999;
        if (dmg > 0) {
          this.coreHp -= dmg;
          this.stats.leaks++;
          this.stats.coreLost += dmg;
          this.fx.shake(e.boss ? 7 : 3);
          const c = this.map.cores[0];
          this.fx.ring(e.x, e.y, 6, 40, '#ff4d6d', 0.4, 3);
          sfx('leak');
          this.emit('leak', { dmg });
          if (this.research.reserve && !this.reserveUsed && this.coreHp > 0 && this.coreHp < this.coreMax * 0.5) {
            this.reserveUsed = true; this.addCredits(this.research.reserve);
            this.emit('toast', 'EMERGENCY RESERVE: +' + this.research.reserve + ' Credits');
          }
          if (this.coreHp <= 0) {
            this.coreHp = 0;
            if (this.state === 'play') { this.state = 'defeat'; sfx('defeat'); this.emit('defeat', {}); }
          }
        }
      }
      if (e.leader && e.leader.alive) e.leader.segAlive--;
      if (e.segs) for (const s of e.segs) s.leader = null;
      if (this.bossBar === e) this.bossBar = this.enemies.find((o) => o.alive && o.boss && o !== e) || null;
      if (this.waveLeft[e.wave] !== undefined) this.waveLeft[e.wave]--;
    }

    // ───────────────────────── Abilities
    abilityReady(id) {
      const a = this.abilities[id];
      return a && a.avail && a.cd <= 0 && this.state === 'play' && !this.rules.noAbilities;
    }

    useAbility(id, x, y) {
      if (!this.abilityReady(id)) return false;
      const a = this.abilities[id];
      const w = Math.max(1, this.wave);
      const holders = this.towers.filter((t) => t.s.ability === id && !t.offline);
      if (holders.length === 0) return false;
      const alive = this.enemies.filter((e) => e.alive && e.dist >= 0);
      switch (id) {
        case 'overclock':
          this.overclockT = 10;
          for (const t of this.towers) this.fx.ring(t.x, t.y, 4, 30, '#ffb547', 0.5, 2);
          break;
        case 'orbital': {
          if (x === undefined) return false;
          const dmg = 2500 + 180 * w;
          this.zones.push({ kind: 'orbital', x, y, r: 170, t: 0, dur: 0.9, fired: false, dmg, src: holders[0] });
          break;
        }
        case 'freeze':
          this.freezeT = 5;
          this.fx.flash(640, 360, 900, '#8fe8ff', 0.5);
          for (const e of alive) this.fx.spark(e.x, e.y, '#dff8ff', 3, 60, 0.5, 2);
          break;
        case 'swarm': {
          const targets = alive.slice().sort((p, q) => (q.hp + (q.boss ? 1e9 : 0)) - (p.hp + (p.boss ? 1e9 : 0)));
          if (!targets.length) return false;
          for (let i = 0; i < 20; i++) {
            const h = holders[i % holders.length];
            this.spawnProj('kamikaze', h, h.x, h.y, targets[i % Math.min(6, targets.length)], { dmg: 220 + 25 * w, splash: 55, speed: 360 + Math.random() * 80, delay: i * 0.05 });
          }
          break;
        }
        case 'storm': {
          if (!alive.length) return false;
          const dmg = 300 + 30 * w;
          for (const e of alive) {
            this.fx.bolt(e.x + (Math.random() - 0.5) * 40, e.y - 260, e.x, e.y, '#bcd4ff', 2.5, 0.35);
            this.damage(e, dmg * (e.boss ? 3 : 1), 'energy', holders[0]);
            if (e.alive && !e.boss) e.stunT = Math.max(e.stunT, 0.5);
          }
          this.fx.flash(640, 360, 1000, '#8ab4ff', 0.3);
          this.fx.shake(4);
          break;
        }
        case 'mark': {
          let tgt = null;
          for (const e of alive) if (!tgt || (e.boss ? 1e9 : 0) + e.hp > (tgt.boss ? 1e9 : 0) + tgt.hp) tgt = e;
          if (!tgt) return false;
          tgt.markT = 8;
          for (const h of holders) { this.fx.beam(h.x, h.y, tgt.x, tgt.y, '#ff4d6d', 4, 0.4, 2); this.damage(tgt, h.s.dmg * 12, 'phys', h, { pen: 999 }); }
          break;
        }
        case 'pandemic': {
          if (!alive.length) return false;
          const best = holders.reduce((p, q) => (q.s.virusDps > p.s.virusDps ? q : p));
          for (const e of alive) { e.virusDps = Math.max(e.virusDps, best.s.virusDps * 2); e.virusSrc = best; e.virusT = Math.max(e.virusT, 8); this.fx.spark(e.x, e.y, '#7dff6a', 3, 60, 0.5, 2); }
          this.fx.flash(640, 360, 900, '#7dff6a', 0.35);
          break;
        }
        case 'horizon':
          for (const h of holders) {
            this.fx.ring(h.x, h.y, 300, 10, '#c77dff', 0.6, 5);
            for (const e of alive) {
              if (U.dist2(e.x, e.y, h.x, h.y) > 300 * 300) continue;
              e.dist = Math.max(0, e.dist - (e.boss ? 90 : 220));
              e.stunT = Math.max(e.stunT, e.boss ? 0.6 : 1.5);
            }
          }
          this.fx.shake(4);
          break;
        case 'overcharge':
          for (const h of holders) h.beamT = 4;
          break;
        case 'singularity': {
          let tgt = null;
          for (const e of alive) if (!tgt || (e.boss ? 1e9 : 0) + e.hp > (tgt.boss ? 1e9 : 0) + tgt.hp) tgt = e;
          if (!tgt) return false;
          const h = holders[0];
          this.fx.beam(h.x, h.y, tgt.x, tgt.y, '#e0a3ff', 10, 0.6, 2);
          this.damage(tgt, 40000 + h.s.dmg * 25, 'energy', h, { bypass: true });
          this.zones.push({ kind: 'hole', x: tgt.x, y: tgt.y, r: 110, t: 0, dur: 3, dps: 600 + 40 * w, src: h });
          this.fx.flash(tgt.x, tgt.y, 300, '#e0a3ff', 0.5);
          this.fx.shake(6);
          break;
        }
        case 'harvest': {
          const amt = 1500 + 45 * w;
          this.addCredits(amt, holders[0].x, holders[0].y, true);
          this.fx.spark(holders[0].x, holders[0].y, '#ffd84d', 40, 220, 0.8, 3);
          break;
        }
      }
      let cdMult = 1;
      for (const h of holders) if (h.buff && h.buff.cd) cdMult = Math.min(cdMult, 1 - h.buff.cd);
      a.cd = a.max * cdMult;
      sfx('ability');
      this.emit('abilityUsed', id);
      return true;
    }

    // ───────────────────────── Projectiles
    spawnProj(kind, t, x, y, target, o) {
      if (this.projs.count > 600) return null;
      const p = this.projs.get();
      p.kind = kind; p.t = t; p.x = x; p.y = y; p.target = target; p.hits = null; p.life = o.life || 2.5;
      p.dmg = o.dmg; p.speed = o.speed || 400; p.pierce = o.pierce || 1; p.splash = o.splash || 0; p.type = o.type || (t ? t.s.type : 'phys');
      p.size = o.size || 3; p.color = o.color || (t ? t.def.color : '#fff'); p.delay = o.delay || 0; p.tx = o.tx; p.ty = o.ty; p.turn = o.turn || 6;
      p.trail = !!o.trail; p.opts = o.opts || null; p.age = 0;
      let ax = o.ax !== undefined ? o.ax : target ? target.x : x + 1, ay = o.ay !== undefined ? o.ay : target ? target.y : y;
      const a = o.angle !== undefined ? o.angle : Math.atan2(ay - y, ax - x);
      p.vx = Math.cos(a) * p.speed; p.vy = Math.sin(a) * p.speed; p.a = a;
      return p;
    }

    // Lead the target along its path
    leadAim(t, e, speed) {
      const d = Math.sqrt(U.dist2(t.x, t.y, e.x, e.y));
      const tt = d / speed;
      const sp = this.enemyMoveSpeed(e);
      CS.pathPos(e.path, Math.min(e.path.len, e.dist + sp * tt), tmpPos);
      return tmpPos;
    }

    updateProjectiles(dt) {
      const items = this.projs.items;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        if (!p.active) continue;
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.age += dt;
        p.life -= dt;
        if (p.life <= 0) { if (p.kind === 'bomblet') this.explode(p, p.x, p.y); this.projs.release(p); continue; }
        if (p.target && !p.target.alive) {
          p.target = null;
          if ((p.kind === 'missile' && p.t && p.t.s.retarget) || p.kind === 'kamikaze') p.target = this.findNearest(p.x, p.y, 260);
        }
        if (p.kind === 'missile' || p.kind === 'kamikaze' || p.kind === 'glob') {
          if (p.target) {
            const want = Math.atan2(p.target.y - p.y, p.target.x - p.x);
            p.a = U.angleLerp(p.a, want, Math.min(1, p.turn * dt));
            if (p.kind !== 'glob') p.speed = Math.min(p.speed * (1 + dt * 1.5), 900);
            p.vx = Math.cos(p.a) * p.speed; p.vy = Math.sin(p.a) * p.speed;
          }
          if (p.trail && this.fx.q.glow && Math.random() < 0.6) this.fx.smoke(p.x, p.y, 1, 'rgba(180,180,190,1)');
        }
        const ox = p.x, oy = p.y;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -60 || p.y < -60 || p.x > CS.WORLD_W + 60 || p.y > CS.WORLD_H + 60) { this.projs.release(p); continue; }
        if (p.kind === 'bomblet') {
          if (U.dist2(p.x, p.y, p.tx, p.ty) < 64) { this.explode(p, p.tx, p.ty); this.projs.release(p); }
          continue;
        }
        // Collision via grid
        let done = false;
        const pr = p.size + 2;
        this.grid.query(p.x, p.y, 40, (e) => {
          if (done || !e.alive || e.dist < 0 || e.phased || e.burrowT > 0) return;
          if (p.kind !== 'missile' && p.kind !== 'kamikaze' && e.stealth && p.t && !this.canTarget(p.t, e)) return;
          const rr = e.r + pr;
          if (U.segDist2(e.x, e.y, ox, oy, p.x, p.y) > rr * rr) return;
          if (p.hits && p.hits.indexOf(e.id) >= 0) return;
          // hit!
          if (p.kind === 'missile' || p.kind === 'kamikaze') { this.explode(p, p.x, p.y); done = true; return true; }
          if (p.kind === 'glob') {
            this.infect(e, p.t);
            if (p.dmg) this.hit(e, p.t, p.dmg);
            if (p.splash) {
              this.grid.query(p.x, p.y, p.splash + 20, (o) => { if (o.alive && U.dist2(o.x, o.y, p.x, p.y) < p.splash * p.splash) this.infect(o, p.t); });
              this.fx.ring(p.x, p.y, 4, p.splash, '#7dff6a', 0.3, 2);
            }
            if (p.t.s.cloud) this.zones.push({ kind: 'cloud', x: p.x, y: p.y, r: 42, t: 0, dur: p.t.s.cloud, src: p.t, tick: 0 });
            this.fx.spark(p.x, p.y, '#7dff6a', 4, 70, 0.3, 2);
            done = true; return true;
          }
          // bullets / shards / drone shots
          if (p.t) this.hit(e, p.t, p.dmg, p.opts); else this.damage(e, p.dmg, p.type, null);
          if (p.splash) { this.fx.ring(p.x, p.y, 3, p.splash, p.color, 0.22, 2); this.splash(p.x, p.y, p.splash, p.dmg * 0.5, p.type, p.t, { noShred: true }, e); }
          this.fx.spark(p.x, p.y, p.color, 2, 70, 0.2, 1.5);
          p.pierce--;
          if (p.pierce <= 0) { done = true; return true; }
          if (!p.hits) p.hits = [];
          p.hits.push(e.id);
        });
        if (done) this.projs.release(p);
      }
    }

    explode(p, x, y) {
      const t = p.t;
      const r = p.splash || 40;
      this.fx.flash(x, y, r * 1.6, '#ffb070', 0.18);
      this.fx.ring(x, y, 4, r, '#ffb070', 0.3, 3);
      this.fx.spark(x, y, '#ffd08a', 8, 160, 0.35, 2);
      this.fx.smoke(x, y, 3);
      this.fx.shake(r > 70 ? 2 : 0.8);
      sfx('explode');
      if (t) {
        this.splash(x, y, r, p.dmg, p.type, t, { knockMul: 1 });
        if (p.kind === 'missile' && t.s.cluster) {
          for (let i = 0; i < t.s.cluster; i++) {
            const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 35;
            this.spawnProj('bomblet', t, x, y, null, { dmg: p.dmg * 0.4, splash: 30, speed: 160, tx: x + Math.cos(a) * d, ty: y + Math.sin(a) * d, angle: a, life: 0.6, size: 2, color: '#ffb547' });
          }
        }
      } else this.splash(x, y, r, p.dmg, p.type, null);
    }

    // ───────────────────────── Towers
    updateTowers(dt) {
      const globalRate = (this.overclockT > 0 ? 1.75 : 1) * (this.overloadT > 0 ? 1.5 : 1);
      const sandMul = this.sand && this.sand.active ? 0.8 : 1;
      const darks = this.zones.filter((z) => z.kind === 'dark');
      const corrupts = this.zones.filter((z) => z.kind === 'corrupt');
      const cz = this.corrupt && this.corrupt.active >= 0 ? this.def.corruption[this.corrupt.active] : null;
      for (const t of this.towers) {
        t.placeT += dt;
        t.recoil = Math.max(0, t.recoil - dt * 6);
        t.spin += dt;
        if (t.disabledT > 0) t.disabledT -= dt;
        let off = t.disabledT > 0;
        if (!off && cz && U.dist2(t.x, t.y, cz.x, cz.y) < cz.r * cz.r) off = true;
        if (!off) for (const z of corrupts) if (U.dist2(t.x, t.y, z.x, z.y) < z.r * z.r) { off = true; break; }
        t.offline = off;
        t.dark = false;
        for (const z of darks) if (U.dist2(t.x, t.y, z.x, z.y) < z.r * z.r) { t.dark = true; break; }
        if (off) continue;
        const s = t.s;
        const range = s.range * sandMul * (t.dark ? 0.5 : 1);
        t.rangeNow = range;
        const mode = t.dark ? 'close' : t.targeting;
        const rate = s.rate * globalRate;
        switch (t.def.kind) {
          case 'bullet': case 'hitscan': case 'rail': case 'chain': case 'missile': case 'virus': case 'quantum':
            this.towerAttack(t, dt, range, mode, rate);
            break;
          case 'aura':
            this.towerAura(t, dt, range);
            break;
          case 'drones':
            this.updateDrones(t, dt, range, mode, globalRate);
            break;
          case 'farm':
            if (t.farmPay > 0) {
              t.farmT -= dt;
              if (t.farmT <= 0) {
                const chunk = Math.round(t.farmPay / t.farmChunks);
                t.farmPay -= chunk; t.farmChunks--;
                t.earned += chunk;
                this.addCredits(chunk, t.x, t.y, true);
                this.fx.spark(t.x, t.y - 8, '#ffd84d', 4, 60, 0.4, 2);
                sfx('coin');
                t.farmT = 2.2;
                if (t.farmChunks <= 0) t.farmPay = 0;
              }
            }
            break;
        }
        if (s.faraday) {
          this.grid.query(t.x, t.y, range + 30, (e) => {
            if (!e.alive || e.dist < 0 || U.dist2(e.x, e.y, t.x, t.y) > range * range) return;
            if (e.shield > 0) { e.shield = 0; this.fx.ring(e.x, e.y, e.r, e.r + 10, '#8ab4ff', 0.2, 2); }
            this.damage(e, s.faraday * dt, 'energy', t, { dot: true, area: true });
            if (Math.random() < dt * 3) this.fx.bolt(t.x, t.y - 10, e.x, e.y, '#bcd4ff', 1.2, 0.08);
          });
        }
      }
    }

    towerAttack(t, dt, range, mode, rate) {
      const s = t.s;
      if (t.beamT > 0) { t.beamT -= dt; rate = Math.max(rate, 10); }
      t.cd -= dt;
      t.retargetT -= dt;
      if (t.retargetT <= 0 || !t.target || !t.target.alive || !this.canTarget(t, t.target) || U.dist2(t.x, t.y, t.target.x, t.target.y) > (range + t.target.r) * (range + t.target.r)) {
        t.target = this.findTarget(t, range, mode);
        t.retargetT = 0.12;
      }
      const e = t.target;
      if (e) {
        const want = Math.atan2(e.y - t.y, e.x - t.x);
        t.angle = U.angleLerp(t.angle, want, Math.min(1, dt * (t.def.kind === 'quantum' ? 5 : 14)));
      }
      if (t.cd > 0 || !e) { if (t.cd < 0) t.cd = 0; return; }
      t.cd += 1 / rate;
      t.recoil = 1;
      t.shots++;
      const k = t.def.kind;
      const muzzle = t.def.r + 4;
      const mx = t.x + Math.cos(t.angle) * muzzle, my = t.y + Math.sin(t.angle) * muzzle;
      if (k === 'bullet') {
        const n = s.count;
        const aim = this.leadAim(t, e, s.projSpeed);
        const base = Math.atan2(aim.y - my, aim.x - mx);
        for (let i = 0; i < n; i++) {
          const off = n > 1 ? (i - (n - 1) / 2) * s.spread : 0;
          this.spawnProj('bullet', t, mx, my, e, { dmg: s.dmg, speed: s.projSpeed, pierce: s.pierce, splash: s.splash, angle: base + off + (Math.random() - 0.5) * 0.03, size: s.projSize, color: s.projColor || (t.tiers[0] >= 4 ? '#ff7bf2' : '#8ff0ff'), life: range / s.projSpeed * 1.6 + 0.2 });
        }
        this.fx.flash(mx, my, 16, '#8ff0ff', 0.06);
        sfx('shoot_pulse');
      } else if (k === 'hitscan') {
        this.fx.beam(mx, my, e.x, e.y, t.tiers[0] >= 5 ? '#ff4d6d' : '#d6ffb8', t.tiers[0] >= 3 ? 2.5 : 1.6, 0.14, 0);
        this.fx.flash(mx, my, 20, '#d6ffb8', 0.08);
        const ex = e.x, ey = e.y;
        this.hit(e, t, s.dmg);
        this.fx.spark(ex, ey, '#d6ffb8', 4, 120, 0.25, 2);
        if (s.shrapnel) {
          for (let i = 0; i < s.shrapnel; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = this.spawnProj('bullet', t, ex, ey, null, { dmg: s.dmg * s.shrapnelMult, speed: 520, pierce: 1, angle: a, size: 2, color: '#d6ffb8', life: 0.25, opts: { noShred: true } });
            if (sp) sp.hits = [e.id];
          }
        }
        sfx('shoot_sniper');
      } else if (k === 'rail') {
        const a = Math.atan2(e.y - t.y, e.x - t.x);
        const len = Math.max(range, 200) + 60;
        const x2 = t.x + Math.cos(a) * len, y2 = t.y + Math.sin(a) * len;
        const hits = [];
        this.grid.query((t.x + x2) / 2, (t.y + y2) / 2, len / 2 + 40, (o) => {
          if (!o.alive || o.dist < 0 || o.phased || o.burrowT > 0) return;
          if (o.stealth && !this.canTarget(t, o)) return;
          const rr = o.r + 7;
          if (U.segDist2(o.x, o.y, mx, my, x2, y2) > rr * rr) return;
          hits.push(o);
        });
        hits.sort((p, q) => U.dist2(p.x, p.y, t.x, t.y) - U.dist2(q.x, q.y, t.x, t.y));
        let n = 0;
        for (const o of hits) {
          if (n >= s.pierce) break;
          this.hit(o, t, s.dmg * (1 + s.overpen * n));
          this.fx.spark(o.x, o.y, '#baf8ff', 3, 100, 0.25, 2);
          n++;
        }
        const w = t.tiers[0] >= 5 || t.beamT > 0 ? 6 : t.tiers[0] >= 3 ? 4 : 3;
        this.fx.beam(mx, my, x2, y2, '#66f0ff', w, t.beamT > 0 ? 0.12 : 0.25, 2);
        if (s.trail) this.zones.push({ kind: 'trail', x: mx, y: my, x2, y2, r: 12, t: 0, dur: 2, dps: s.trail, src: t });
        this.fx.shake(t.beamT > 0 ? 0 : 1);
        sfx('rail');
      } else if (k === 'chain') {
        const hitList = [e];
        let last = e;
        let dmg = s.dmg;
        this.fx.bolt(mx, my - 6, e.x, e.y, '#bcd4ff', 2.2, 0.14);
        this.hit(e, t, dmg);
        let storm = s.stormEvery && t.shots % s.stormEvery === 0;
        for (let j = 0; j < s.chain; j++) {
          let best = null, bd = Infinity;
          const cr = s.chainRange;
          this.grid.query(last.x, last.y, cr + 20, (o) => {
            if (!o.alive || o.dist < 0 || hitList.indexOf(o) >= 0 || !this.canTarget(t, o)) return;
            const d = U.dist2(o.x, o.y, last.x, last.y);
            if (d < cr * cr && d < bd) { bd = d; best = o; }
          });
          if (!best) break;
          dmg *= s.chainFalloff;
          this.fx.bolt(last.x, last.y, best.x, best.y, '#bcd4ff', 1.8, 0.14);
          hitList.push(best);
          this.hit(best, t, dmg);
          last = best;
        }
        if (hitList.length > this.stats.maxChain) this.stats.maxChain = hitList.length;
        if (storm) {
          const ts = this.findTargets(t, range * 1.5, 'strong', 12);
          for (const o of ts) { this.fx.bolt(o.x + (Math.random() - 0.5) * 30, o.y - 220, o.x, o.y, '#e6eeff', 3, 0.25); this.hit(o, t, s.dmg * 2); }
          this.fx.flash(t.x, t.y, 120, '#8ab4ff', 0.2);
          sfx('storm');
        }
        sfx('zap');
      } else if (k === 'missile') {
        let ts = s.count > 1 ? this.findTargets(t, range, mode, s.count) : [e];
        if (!ts.length) ts = [e];
        for (let i = 0; i < s.count; i++) {
          const tg = ts[i % ts.length];
          const a = t.angle + (Math.random() - 0.5) * 1.4;
          this.spawnProj('missile', t, t.x + (Math.random() - 0.5) * 10, t.y + (Math.random() - 0.5) * 10, tg, { dmg: s.dmg, speed: s.projSpeed * 0.6, splash: s.splash, angle: a, size: 4, color: '#ff8a4d', trail: true, life: 4, turn: 7, delay: i * 0.04 });
        }
        sfx('missile');
      } else if (k === 'virus') {
        this.spawnProj('glob', t, mx, my, e, { dmg: s.dmg, speed: s.projSpeed, angle: t.angle, size: 5, color: '#7dff6a', life: 2.5, turn: 9 });
        sfx('glob');
      } else if (k === 'quantum') {
        let ts = s.count > 1 ? this.findTargets(t, range, mode, s.count) : [e];
        if (!ts.length) ts = [e];
        for (const tg of ts) this.quantumBlast(t, mx, my, tg.x, tg.y, tg);
        this.fx.shake(3);
        sfx('quantum');
      }
    }

    quantumBlast(t, mx, my, x, y, tg) {
      const s = t.s;
      this.fx.beam(mx, my, x, y, '#e0a3ff', 7, 0.3, 2);
      this.fx.flash(x, y, s.splash * 2.2, '#e0a3ff', 0.3);
      this.fx.ring(x, y, 6, s.splash, '#f3dcff', 0.45, 4);
      this.fx.spark(x, y, '#f3dcff', 18, 220, 0.5, 2.5);
      const opts = { bypass: s.shieldBypass };
      this.splash(x, y, s.splash, s.dmg, 'energy', t, opts);
      if (s.doubleHit) { this.splash(x, y, s.splash, s.dmg, 'energy', t, opts); this.fx.ring(x, y, 6, s.splash * 1.2, '#ffffff', 0.55, 2); }
      if (s.field) this.zones.push({ kind: 'field', x, y, r: s.splash * 0.75, t: 0, dur: s.fieldDur, dps: s.field, src: t });
      if (s.echo) {
        let best = null, bd = Infinity;
        this.grid.query(x, y, 170, (o) => {
          if (!o.alive || o === tg || o.dist < 0) return;
          const d = U.dist2(o.x, o.y, x, y);
          if (d > 40 * 40 && d < bd) { bd = d; best = o; }
        });
        if (best) {
          this.fx.bolt(x, y, best.x, best.y, '#e0a3ff', 3, 0.25);
          this.fx.ring(best.x, best.y, 6, s.splash * 0.8, '#e0a3ff', 0.4, 3);
          this.splash(best.x, best.y, s.splash * 0.8, s.dmg * 0.6, 'energy', t, opts);
        }
      }
    }

    towerAura(t, dt, range) {
      const s = t.s;
      const r2 = range * range;
      const inside = [];
      this.grid.query(t.x, t.y, range + 40, (e) => {
        if (!e.alive || e.dist < 0) return;
        const rr = range + e.r * 0.5;
        if (U.dist2(e.x, e.y, t.x, t.y) > rr * rr) return;
        inside.push(e);
      });
      if (s.auraReveal || s.auraQuarantine) for (const e of inside) { if (s.auraReveal) e.revealAura = true; if (s.auraQuarantine) e.quarantined = true; }
      for (const e of inside) {
        let sl = s.auraSlow * (e.boss ? s.bossSlowMult : 1);
        if (s.armoredSlow && e.armor > 0) sl += s.armoredSlow;
        if (sl > e.slowAura) e.slowAura = Math.min(0.9, sl);
        if (s.slowLinger) { e.slowT = Math.max(e.slowT, s.slowLinger); e.slowAmt = Math.max(e.slowAmt, sl * 0.8); }
        if (s.auraDot) {
          if (t.type === 'firewall') { e.burnDps = Math.max(e.burnDps, s.auraDot); e.burnT = Math.max(e.burnT, s.auraLinger || 0.15); e.burnSrc = t; }
          else this.damage(e, s.auraDot * dt, 'fire', t, { dot: true, area: true });
        }
        if (s.auraShred) e.shredAura = Math.max(e.shredAura, s.auraShred);
        if (s.auraVuln) e.vulnAura = Math.max(e.vulnAura, s.auraVuln);
        if (s.auraShieldStrip && e.shield > 0) { e.shield = Math.max(0, e.shield - s.auraShieldStrip * dt); e.shieldHitT = 0; }
        if (s.auraPct && e.alive) this.damage(e, e.maxHp * s.auraPct * (e.boss ? 0.16 : 1) * dt, 'toxic', t, { dot: true, area: true });
        if (s.auraStripElite && e.elite) { e.elite = null; this.fx.ring(e.x, e.y, e.r, e.r + 12, '#ffffff', 0.3, 2); }
        if (s.blackHole && e.alive && !e.boss && e.hp < e.maxHp * s.blackHole) { this.fx.ring(e.x, e.y, e.r + 10, 2, '#c77dff', 0.3, 2); this.kill(e, t); }
      }
      const has = inside.length > 0;
      const T = t.auraT;
      if (s.freezeEvery) {
        T.freeze -= dt;
        if (T.freeze <= 0 && has) {
          T.freeze = s.freezeEvery;
          for (const e of inside) {
            if (e.boss) { if (s.freezeBoss) e.stunT = Math.max(e.stunT, 0.3); }
            else e.stunT = Math.max(e.stunT, s.freezeDur);
          }
          this.fx.ring(t.x, t.y, 6, range, t.type === 'gravity' ? '#c77dff' : '#bff4ff', 0.45, 4);
          if (t.type === 'firewall') for (const e of inside) this.fx.spark(e.x, e.y, '#e8fbff', 3, 50, 0.4, 2);
          sfx('freeze');
        }
      }
      if (s.auraPulseEvery) {
        T.pulse -= dt;
        if (T.pulse <= 0 && has) {
          T.pulse = s.auraPulseEvery;
          for (const e of inside) this.damage(e, s.auraPulseDmg, 'fire', t, { area: true });
          this.fx.ring(t.x, t.y, 6, range, '#ff8a3d', 0.4, 5);
          this.fx.flash(t.x, t.y, range * 1.3, '#ff8a3d', 0.25);
          sfx('explode');
        }
      }
      if (s.pullEvery) {
        T.pull -= dt;
        if (T.pull <= 0 && has) {
          T.pull = s.pullEvery;
          for (const e of inside) e.dist = Math.max(0, e.dist - s.pullDist * (e.boss ? 0.3 : 1));
          this.fx.ring(t.x, t.y, range, 8, '#c77dff', 0.35, 2);
        }
      }
      if (s.implodeEvery) {
        T.implode -= dt;
        if (T.implode <= 0 && has) {
          T.implode = s.implodeEvery;
          for (const e of inside) { this.damage(e, s.implodeDmg, 'fire', t, { area: true }); if (e.alive) e.dist = Math.max(0, e.dist - s.implodePull * (e.boss ? 0.3 : 1)); }
          this.fx.ring(t.x, t.y, range * 1.2, 4, '#e7c2ff', 0.45, 5);
          this.fx.flash(t.x, t.y, range * 1.5, '#c77dff', 0.3);
          this.fx.shake(2);
          sfx('implode');
        }
      }
    }

    updateDrones(t, dt, range, mode, globalRate) {
      const s = t.s;
      const leash = s.globalLeash ? 2000 : range;
      for (const d of t.drones) {
        d.rt -= dt;
        if (d.rt <= 0 || !d.target || !d.target.alive || !this.canTarget(t, d.target) || U.dist2(d.target.x, d.target.y, t.x, t.y) > leash * leash) {
          d.target = s.globalLeash ? this.findTargetGlobal(t, mode) : this.findTarget(t, leash, mode);
          d.rt = 0.3 + Math.random() * 0.2;
        }
        let gx, gy;
        d.orbit += dt * (d.gun ? 1.2 : 2.4);
        if (d.target) {
          const orr = d.gun ? 80 : 55;
          gx = d.target.x + Math.cos(d.orbit) * orr; gy = d.target.y + Math.sin(d.orbit) * orr;
        } else {
          gx = t.x + Math.cos(d.orbit) * 34; gy = t.y + Math.sin(d.orbit) * 34;
        }
        const dx = gx - d.x, dy = gy - d.y;
        const L = Math.hypot(dx, dy) || 1;
        const maxv = s.droneSpeed * (d.gun ? 0.7 : 1);
        d.vx += (dx / L) * maxv * 5 * dt; d.vy += (dy / L) * maxv * 5 * dt;
        const v = Math.hypot(d.vx, d.vy);
        if (v > maxv) { d.vx *= maxv / v; d.vy *= maxv / v; }
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.target) d.a = Math.atan2(d.target.y - d.y, d.target.x - d.x);
        else d.a = Math.atan2(d.vy, d.vx);
        d.cd -= dt;
        if (d.target && d.cd <= 0 && U.dist2(d.x, d.y, d.target.x, d.target.y) < 130 * 130) {
          if (d.gun) {
            d.cd = 1 / (0.9 * globalRate);
            this.spawnProj('bullet', t, d.x, d.y, d.target, { dmg: 45 * (1 + (s.droneDmg - 4) * 0.08), speed: 480, splash: 40, size: 4, color: '#e6ff9a', life: 0.6, ax: d.target.x, ay: d.target.y });
            sfx('shoot_pulse', 0.6);
          } else {
            d.cd = 1 / (s.droneRate * globalRate);
            this.spawnProj('bullet', t, d.x, d.y, d.target, { dmg: s.droneDmg, speed: 520, splash: s.droneSplash, size: s.droneSplash ? 3 : 2, color: '#d7ff8a', life: 0.5, ax: d.target.x, ay: d.target.y });
          }
        }
      }
    }

    findNearest(x, y, r) {
      let best = null, bd = r * r;
      this.grid.query(x, y, r, (e) => {
        if (!e.alive || e.dist < 0 || e.phased || e.burrowT > 0) return;
        const d = U.dist2(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      });
      return best;
    }

    findTargetGlobal(t, mode) {
      let best = null, bs = -Infinity;
      for (const e of this.enemies) {
        if (!this.canTarget(t, e)) continue;
        const sc = this.score(e, mode, t);
        if (sc > bs) { bs = sc; best = e; }
      }
      return best;
    }

    // ───────────────────────── Enemy movement & abilities
    enemyMoveSpeed(e) {
      if (e.stunT > 0) return 0;
      let slow = Math.max(e.slowAura, e.slowT > 0 ? e.slowAmt : 0);
      if (e.virusT > 0 && e.virusSrc && e.virusSrc.s.virusSlow) slow = Math.max(slow, e.virusSrc.s.virusSlow);
      if (this.freezeT > 0) slow = Math.max(slow, e.boss ? 0.35 : 0.7);
      let v = e.speed * e.speedMul * (1 - slow);
      if (!e.quarantined) {
        v *= 1 + e.hasteAura;
      }
      if (e.inTunnel) v *= 1.7;
      if (this.overloadT > 0) v *= 1.25;
      return v;
    }

    updateEnemies(dt) {
      const list = this.enemies;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive) continue;
        e.age += dt;
        if (e.hitT > 0) e.hitT -= dt;
        e.kick *= Math.pow(0.001, dt);
        // Timers
        if (e.stunT > 0) e.stunT -= dt;
        if (e.slowT > 0) e.slowT -= dt; else e.slowAmt = 0;
        if (e.vulnT > 0) e.vulnT -= dt;
        if (e.markT > 0) e.markT -= dt;
        if (e.revealT > 0) e.revealT -= dt;
        // DoTs
        if (e.burnT > 0) { e.burnT -= dt; this.damage(e, e.burnDps * dt, 'fire', e.burnSrc, { dot: true }); if (!e.alive) continue; if (Math.random() < dt * 8) this.fx.spark(e.x, e.y - 4, '#ff9a3d', 1, 30, 0.35, 2); }
        if (e.virusT > 0) {
          e.virusT -= dt;
          const vs = e.virusSrc ? e.virusSrc.s : null;
          let dps = e.virusDps;
          if (vs && vs.virusPct) dps += e.maxHp * vs.virusPct * (e.boss ? 0.25 : 1);
          this.damage(e, dps * dt, 'toxic', e.virusSrc, { dot: true });
          if (!e.alive) continue;
          if (vs && vs.virusExecute && !e.boss && e.hp < e.maxHp * vs.virusExecute) { this.kill(e, e.virusSrc); continue; }
          if (vs && vs.spreadEvery) {
            e.spreadT -= dt;
            if (e.spreadT <= 0) { e.spreadT = vs.spreadEvery; this.spreadVirus(e, e.virusSrc, 1, 70); }
          }
          if (Math.random() < dt * 4) this.fx.spark(e.x, e.y, '#7dff6a', 1, 25, 0.4, 2);
        }
        // Shield regen
        if (e.shieldMax > 0) {
          e.shieldHitT += dt;
          if (e.shieldHitT > 2 && e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + e.shieldMax * 0.35 * dt);
        }
        // Elite behaviours
        if (e.elite && !e.quarantined) {
          if (e.elite === 'regen' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
          if (e.elite === 'phased') {
            e.phaseT -= dt;
            if (e.phaseT <= 0) { e.phased = !e.phased; e.phaseT = e.phased ? 1.2 : 3.5; }
          }
        } else if (e.phased) e.phased = false;
        if (e.def.heal && !e.quarantined) {
          e.abT -= dt;
          if (e.abT <= 0) {
            e.abT = e.def.healEvery;
            const hr = e.def.healRange;
            this.fx.ring(e.x, e.y, 6, hr, '#ff8fc8', 0.5, 2);
            this.grid.query(e.x, e.y, hr, (o) => {
              if (!o.alive || o.quarantined || U.dist2(o.x, o.y, e.x, e.y) > hr * hr) return;
              const amt = o.maxHp * (o.boss ? 0.01 : e.def.heal);
              if (o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + amt); this.fx.spark(o.x, o.y - 6, '#ffb3dc', 2, 30, 0.4, 2); }
            });
          }
        }
        if (e.boss) this.updateBoss(e, dt);
        if (!e.alive) continue;
        // Movement
        if (e.leader && e.leader.alive) {
          e.dist = e.leader.dist - e.segIdx * 30;
          e.stunT = 0;
        } else {
          if (e.burrowT > 0) e.burrowT -= dt;
          e.dist += this.enemyMoveSpeed(e) * dt;
        }
        if (e.dist >= e.path.len) { this.leak(e); continue; }
        const pd = Math.max(0, e.dist);
        CS.pathPos(e.path, pd, tmpPos);
        e.x = tmpPos.x; e.y = tmpPos.y; e.ang = tmpPos.a;
        // Tunnels
        if (this.map.tunnels.length) {
          e.inTunnel = false;
          for (const tn of this.map.tunnels) if (tn.path === e.pathIdx && e.dist > tn.from && e.dist < tn.to) { e.inTunnel = true; break; }
        }
        // Damage number accumulation
        if (e.numAcc > 0) {
          e.numT -= dt;
          if (e.numT <= 0) {
            // Only show meaningful chunks to keep big fights readable
            if (e.numAcc >= 1 && (e.boss || e.numAcc >= e.maxHp * 0.2 || this.enemies.length < 25)) this.fx.text(e.x, e.y - e.r - 4, U.fmt(e.numAcc), e.boss ? '#ffd84d' : '#ffffff', e.boss ? 13 : 11, 0.7);
            e.numAcc = 0; e.numT = e.boss ? 0.5 : 0.7;
          }
        }
      }
    }

    // Auras from enemies (overclockers, commanders) — before movement
    enemyAuras() {
      for (const e of this.enemies) { e.hasteAura = 0; e.commanded = false; }
      for (const e of this.enemies) {
        if (!e.alive || e.quarantined) continue;
        if (e.def.haste) {
          const hr = e.def.hasteRange;
          this.grid.query(e.x, e.y, hr, (o) => { if (o !== e && o.alive && U.dist2(o.x, o.y, e.x, e.y) < hr * hr) o.hasteAura = Math.max(o.hasteAura, e.def.haste); });
        }
        if (e.elite === 'commander') {
          this.grid.query(e.x, e.y, 110, (o) => { if (o !== e && o.alive && U.dist2(o.x, o.y, e.x, e.y) < 110 * 110) { o.commanded = true; o.hasteAura = Math.max(o.hasteAura, 0.15); } });
        }
      }
    }

    updateBoss(e, dt) {
      const w = e.wave;
      if (e.type === 'ram') {
        e.abT2 -= dt;
        if (e.abT2 <= 0) {
          e.abT2 = 9;
          const R = 175;
          this.fx.ring(e.x, e.y, 10, R, '#5aa0ff', 0.7, 6);
          this.fx.ring(e.x, e.y, 10, R * 0.7, '#ffffff', 0.5, 3);
          this.fx.shake(5);
          sfx('shockwave');
          for (const t of this.towers) if (U.dist2(t.x, t.y, e.x, e.y) < R * R) { t.disabledT = Math.max(t.disabledT, 2.5); this.fx.spark(t.x, t.y, '#5aa0ff', 6, 80, 0.5, 2); }
        }
      } else if (e.type === 'worm') {
        e.armor = 4 + 2 * Math.max(0, e.segAlive);
        e.abT2 -= dt;
        if (e.abT2 <= 0 && e.dist > 60) {
          e.abT2 = 6;
          const n = Math.ceil(Math.max(0, e.segAlive) / 2);
          for (let i = 0; i < n; i++) this.spawnEnemy('zip', e.pathIdx, Math.max(0, e.dist - 30 - i * 14), w, { noElite: true });
          if (n) this.fx.ring(e.x, e.y, 4, 50, '#9dff5a', 0.4, 2);
        }
        e.abT3 -= dt;
        if (e.abT3 <= 0 && e.segAlive > 0) {
          e.abT3 = 10;
          e.burrowT = 0.6 + e.segAlive * 0.18;
          this.fx.smoke(e.x, e.y, 6, '#5a7a3a');
        }
      } else if (e.type === 'blackout') {
        e.abT2 -= dt;
        if (e.abT2 <= 0) {
          e.abT2 = 11;
          const picks = this.towers.length ? this.towers : [{ x: 640, y: 360 }];
          const n = Math.min(3, 1 + Math.floor(this.towers.length / 6));
          for (let i = 0; i < n; i++) {
            const t = U.pick(picks);
            this.zones.push({ kind: 'dark', x: t.x + (Math.random() - 0.5) * 60, y: t.y + (Math.random() - 0.5) * 60, r: 135, t: 0, dur: 6.5 });
          }
          sfx('blackout');
          this.emit('toast', 'BLACKOUT: sectors offline!');
        }
        e.abT3 -= dt;
        if (e.abT3 <= 0) {
          e.abT3 = 7;
          for (let i = 0; i < 2; i++) this.spawnEnemy('ghost', e.pathIdx, Math.max(0, e.dist - 20 - i * 16), w, { noElite: true });
        }
      } else if (e.type === 'root') {
        // Shields at 75/50/25%
        const frac = e.hp / e.maxHp;
        const phases = [0.75, 0.5, 0.25];
        if (e.rootPhase < 3 && frac < phases[e.rootPhase]) {
          e.rootPhase++;
          e.shieldMax = e.shield = Math.round(e.maxHp * 0.12);
          e.shieldHitT = -999; // does not regenerate
          this.fx.ring(e.x, e.y, 10, 120, '#ff3d6e', 0.6, 6);
          this.emit('toast', 'ROOT: firewall shield online (phase ' + (e.rootPhase + 1) + ')');
          sfx('shield_up');
        }
        e.abT -= dt;
        if (e.abT <= 0) {
          e.abT = 7 - e.rootPhase;
          const pool = ['breaker', 'shield', 'ghost', 'healer', 'trojan', 'splitter'];
          for (let i = 0; i < 4; i++) this.spawnEnemy(U.pick(pool), e.pathIdx, Math.max(0, e.dist - 30 - i * 15), w);
          this.fx.ring(e.x, e.y, 4, 70, '#ff3d6e', 0.4, 3);
        }
        e.speedModeT -= dt;
        if (e.speedModeT <= 0) {
          if (e.speedMul === 1) { e.speedMul = Math.random() < 0.5 ? 0.5 : 1.9; e.speedModeT = 3; }
          else { e.speedMul = 1; e.speedModeT = 6 + Math.random() * 3; }
        }
        e.abT3 -= dt;
        if (e.abT3 <= 0) {
          e.abT3 = 12;
          const cands = this.towers.filter((t) => !t.offline);
          for (let i = 0; i < 3 && cands.length; i++) {
            const t = cands.splice(Math.floor(Math.random() * cands.length), 1)[0];
            t.disabledT = Math.max(t.disabledT, 4);
            this.fx.bolt(e.x, e.y, t.x, t.y, '#ff3d6e', 2.5, 0.35);
          }
          sfx('zap');
        }
        e.abT4 -= dt;
        if (e.abT4 <= 0) {
          e.abT4 = 15;
          const t = this.towers.length ? U.pick(this.towers) : null;
          const x = t ? t.x : 640, y = t ? t.y : 360;
          this.zones.push({ kind: 'corrupt', x, y, r: 85, t: 0, dur: 8 });
          this.emit('toast', 'ROOT is corrupting the grid!');
        }
      } else if (e.type === 'sentinel') {
        // no abilities
      }
    }

    updateZombies(dt) {
      for (let i = this.zombies.length - 1; i >= 0; i--) {
        const z = this.zombies[i];
        z.life -= dt;
        z.dist -= 60 * dt;
        z.hitCd -= dt;
        if (z.dist <= 0 || z.life <= 0 || z.charges <= 0) { this.zombies.splice(i, 1); this.fx.spark(z.x, z.y, '#7dff6a', 5, 60, 0.3, 2); continue; }
        CS.pathPos(z.path, z.dist, tmpPos);
        z.x = tmpPos.x; z.y = tmpPos.y; z.a = tmpPos.a + Math.PI;
        if (z.hitCd <= 0) {
          let hitOne = null;
          this.grid.query(z.x, z.y, 30, (e) => {
            if (hitOne || !e.alive || e.dist < 0 || U.dist2(e.x, e.y, z.x, z.y) > (e.r + 10) * (e.r + 10)) return;
            hitOne = e;
          });
          if (hitOne) {
            this.damage(hitOne, z.power, 'toxic', z.src);
            this.fx.spark(z.x, z.y, '#7dff6a', 6, 90, 0.3, 2);
            z.charges--; z.hitCd = 0.3;
          }
        }
      }
    }

    updateZones(dt) {
      for (let i = this.zones.length - 1; i >= 0; i--) {
        const z = this.zones[i];
        z.t += dt;
        if (z.kind === 'cloud') {
          this.grid.query(z.x, z.y, z.r + 20, (e) => { if (e.alive && U.dist2(e.x, e.y, z.x, z.y) < z.r * z.r) this.infect(e, z.src); });
        } else if (z.kind === 'field' || z.kind === 'hole') {
          this.grid.query(z.x, z.y, z.r + 20, (e) => {
            if (!e.alive || U.dist2(e.x, e.y, z.x, z.y) > z.r * z.r) return;
            this.damage(e, z.dps * dt, 'energy', z.src, { dot: true, area: true });
            if (z.kind === 'hole' && e.alive && !e.boss) e.dist = Math.max(0, e.dist - 40 * dt);
          });
        } else if (z.kind === 'trail') {
          const mx = (z.x + z.x2) / 2, my = (z.y + z.y2) / 2, half = Math.hypot(z.x2 - z.x, z.y2 - z.y) / 2;
          this.grid.query(mx, my, half + 30, (e) => {
            if (!e.alive || e.dist < 0) return;
            if (U.segDist2(e.x, e.y, z.x, z.y, z.x2, z.y2) > (e.r + z.r) * (e.r + z.r)) return;
            this.damage(e, z.dps * dt, 'energy', z.src, { dot: true, area: true });
          });
        } else if (z.kind === 'orbital') {
          if (!z.fired && z.t >= 0.75) {
            z.fired = true;
            this.fx.flash(z.x, z.y, 420, '#ffcf8a', 0.6);
            this.fx.ring(z.x, z.y, 10, z.r, '#ff6a3d', 0.6, 8);
            this.fx.ring(z.x, z.y, 10, z.r * 1.4, '#ffd08a', 0.8, 3);
            this.fx.spark(z.x, z.y, '#ffd08a', 60, 380, 0.9, 3);
            this.fx.smoke(z.x, z.y, 14, '#5a4a40');
            this.fx.shake(7);
            sfx('orbital');
            this.grid.query(z.x, z.y, z.r + 40, (e) => {
              if (!e.alive || e.dist < 0 || U.dist2(e.x, e.y, z.x, z.y) > (z.r + e.r) * (z.r + e.r)) return;
              this.damage(e, z.dmg * (e.boss ? 1.5 : 1), 'explosive', z.src, { area: true, pen: 99 });
            });
          }
        }
        if (z.t >= z.dur) this.zones.splice(i, 1);
      }
    }

    updateMapMechanics(dt) {
      if (this.corrupt) {
        const c = this.corrupt;
        c.timer -= dt;
        if (c.active >= 0) {
          if (c.timer <= 0) { c.active = -1; c.timer = 16 + Math.random() * 10; this.emit('toast', 'Corruption receding.'); }
        } else if (c.warn >= 0) {
          if (c.timer <= 0) { c.active = c.warn; c.warn = -1; c.timer = 14; sfx('corrupt'); this.fx.shake(2); }
        } else if (c.timer <= 0 && this.wave > 0) {
          c.warn = Math.floor(Math.random() * this.def.corruption.length);
          c.timer = 4;
          this.emit('toast', '⚠ Corruption surge incoming!');
        }
      }
      if (this.sand) {
        const s = this.sand;
        s.timer -= dt;
        if (s.active) {
          if (s.timer <= 0) { s.active = false; s.timer = 30 + Math.random() * 15; }
        } else if (s.timer <= 0 && this.wave > 0) {
          s.active = true; s.timer = 11; this.emit('toast', 'SANDSTORM: tower range -20%');
        }
      }
    }

    // ───────────────────────── Main step
    step(dt) {
      if (this.state === 'defeat') return;
      this.time += dt;
      // Spawning
      if (this.spawnQueue.length) {
        this.waveClock += dt;
        while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveClock) {
          const s = this.spawnQueue.shift();
          const npaths = this.map.paths.length;
          const pi = (this.rr++) % npaths;
          this.spawnEnemy(s.type, pi, 0, s.wave, { count: false });
        }
      }
      // Grid
      this.grid.clear();
      for (const e of this.enemies) {
        if (!e.alive) continue;
        this.grid.insert(e, e.x, e.y);
        e.slowAura = 0; e.shredAura = 0; e.vulnAura = 0; e.quarantined = false; e.revealAura = false;
      }
      // Towers auras first so quarantine/slows apply this step
      this.updateTowers(dt);
      this.enemyAuras();
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateZones(dt);
      this.updateZombies(dt);
      this.updateMapMechanics(dt);
      // Global timers
      if (this.overclockT > 0) this.overclockT -= dt;
      if (this.freezeT > 0) this.freezeT -= dt;
      if (this.overloadT > 0) this.overloadT -= dt;
      if (this.surgeT > 0) this.surgeT -= dt;
      if (this.event && this.event.expires !== undefined) { this.event.expires -= dt; if (this.event.expires <= 0) { this.event = null; this.emit('eventExpired', {}); } }
      for (const id in this.abilities) {
        const a = this.abilities[id];
        if (a.cd > 0) a.cd -= dt;
      }
      // Compact dead enemies
      let j = 0;
      const L = this.enemies;
      for (let i = 0; i < L.length; i++) {
        const e = L[i];
        if (e.alive) L[j++] = e;
        else { e.path = null; e.virusSrc = e.burnSrc = e.lastHitBy = e.leader = null; e.segs = null; this.enemyPool.push(e); }
      }
      L.length = j;
      // Wave completion
      for (const k in this.waveLeft) {
        const w = +k;
        const queued = this.spawnQueue.length && this.spawnQueue.some((s) => s.wave === w);
        if (!queued && this.waveLeft[k] <= 0) this.waveComplete(w);
      }
      // Auto start
      if (this.autoStart && this.state === 'play' && this.canStartWave() && this.enemies.length === 0 && !this.tutorial) {
        this.autoTimer += dt;
        if (this.autoTimer > 1.2) { this.autoTimer = 0; this.startWave(); }
      } else this.autoTimer = 0;
    }

    // Advance by real frame time with fixed sub-steps (speed multiplier = more sub-steps).
    update(realDt) {
      if (this.paused) return;
      const steps = this.speed;
      this.acc = (this.acc || 0) + Math.min(realDt, 0.1);
      let n = 0;
      while (this.acc >= DT && n < 6) {
        for (let i = 0; i < steps; i++) this.step(DT);
        this.acc -= DT;
        n++;
      }
      if (n >= 6) this.acc = 0;
      this.fx.load = Math.min(1, this.enemies.length / 350 + this.projs.count / 800);
      this.fx.update(Math.min(realDt, 0.1) * this.speed);
    }
  }

  Match.DT = DT;
  CS.Match = Match;
})();
