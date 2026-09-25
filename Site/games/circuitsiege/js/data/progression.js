/* CIRCUIT SIEGE — progression data: levels, unlocks, research, mastery, achievements, modes, challenges */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;
  const U = CS.U;
  const P = {};

  // ── Account level curve: quick early, slower later.
  P.xpToNext = (L) => Math.round(150 + 90 * (L - 1) + 6 * (L - 1) * (L - 1));
  P.levelChips = (L) => 20 + 5 * L;

  P.LEVEL_UNLOCKS = {
    2: [{ t: 'tower', id: 'missile' }, { t: 'map', id: 'crossing' }],
    3: [{ t: 'tower', id: 'drone' }, { t: 'icon', id: 'bolt' }],
    4: [{ t: 'tower', id: 'farm' }, { t: 'map', id: 'cooling' }],
    5: [{ t: 'tower', id: 'virus' }, { t: 'diff', id: 'advanced' }],
    6: [{ t: 'tower', id: 'rail' }, { t: 'map', id: 'highway' }],
    7: [{ t: 'tower', id: 'amp' }, { t: 'mode', id: 'onelife' }, { t: 'mode', id: 'speed' }],
    8: [{ t: 'tower', id: 'gravity' }, { t: 'icon', id: 'eye' }],
    9: [{ t: 'map', id: 'corruption' }, { t: 'mode', id: 'limited' }],
    10: [{ t: 'tower', id: 'quantum' }, { t: 'mode', id: 'inflation' }],
    11: [{ t: 'map', id: 'processor' }],
    12: [{ t: 'diff', id: 'nightmare' }, { t: 'mode', id: 'double' }],
    13: [{ t: 'map', id: 'dunes' }, { t: 'mode', id: 'reverse' }],
    14: [{ t: 'mode', id: 'random' }, { t: 'core', id: 'sunforge' }],
    15: [{ t: 'icon', id: 'crown' }, { t: 'title', id: 'Grid Warden' }],
    20: [{ t: 'core', id: 'void' }, { t: 'title', id: 'Siege Master' }],
    25: [{ t: 'icon', id: 'skull' }],
    30: [{ t: 'core', id: 'aurora' }, { t: 'title', id: 'Kernel Guardian' }],
    40: [{ t: 'icon', id: 'star' }],
    50: [{ t: 'core', id: 'singularity' }, { t: 'title', id: 'Root Administrator' }],
    75: [{ t: 'icon', id: 'infinity' }, { t: 'title', id: 'Legend of the Grid' }],
  };

  P.CORE_SKINS = {
    standard: { id: 'standard', name: 'Standard Core', c1: '#39d0ff', c2: '#e8fbff', level: 1 },
    sunforge: { id: 'sunforge', name: 'Sunforge Core', c1: '#ffb547', c2: '#fff4d6', level: 14 },
    void: { id: 'void', name: 'Void Core', c1: '#b04dff', c2: '#f3dcff', level: 20 },
    aurora: { id: 'aurora', name: 'Aurora Core', c1: '#52e08a', c2: '#dfffe9', level: 30 },
    singularity: { id: 'singularity', name: 'Singularity Core', c1: '#ff4d6d', c2: '#ffffff', level: 50 },
  };

  P.ICONS = {
    chip: { id: 'chip', glyph: '◈', name: 'Chip', level: 1 },
    bolt: { id: 'bolt', glyph: 'ϟ', name: 'Bolt', level: 3 },
    eye: { id: 'eye', glyph: '◉', name: 'Watcher', level: 8 },
    crown: { id: 'crown', glyph: '♛', name: 'Crown', level: 15 },
    skull: { id: 'skull', glyph: '☠', name: 'Purger', level: 25 },
    star: { id: 'star', glyph: '✦', name: 'Nova', level: 40 },
    infinity: { id: 'infinity', glyph: '∞', name: 'Infinite', level: 75 },
    hex: { id: 'hex', glyph: '⬡', name: 'Hex', ach: 'boss_hunter' },
    root: { id: 'root', glyph: '⌘', name: 'Root', ach: 'root_access' },
    moon: { id: 'moon', glyph: '☾', name: 'Nightmare', ach: 'nightmare_fuel' },
  };

  // ── Tower mastery
  P.masteryNeed = (L) => Math.round(200 + 150 * (L - 1) + 25 * (L - 1) * (L - 1));
  P.MASTERY_REWARDS = {
    2: { skin: 'carbon', text: 'Carbon skin' },
    3: { tier5: true, text: 'Tier 5 upgrades unlocked' },
    4: { bonus: 'rate', text: '+2% attack speed' },
    5: { skin: 'crimson', text: 'Crimson skin' },
    6: { icon: true, text: 'Tower profile icon' },
    8: { trail: true, text: 'Prismatic projectile effect' },
    10: { skin: 'gold', bonus: 'cost', text: 'Gold skin & -3% cost' },
    12: { glow: true, text: 'Overdrive tier-5 visual' },
    15: { skin: 'prism', text: 'Prism skin' },
    20: { skin: 'obsidian', title: true, text: 'Obsidian skin & Legend title' },
  };
  P.SKINS = {
    default: { id: 'default', name: 'Default', plate: '#2b3342', plate2: '#1a202b', trim: '#4b5a70', lvl: 1 },
    carbon: { id: 'carbon', name: 'Carbon', plate: '#222428', plate2: '#111214', trim: '#5d6470', lvl: 2 },
    crimson: { id: 'crimson', name: 'Crimson', plate: '#4a1c26', plate2: '#2a0d13', trim: '#c23b52', lvl: 5 },
    gold: { id: 'gold', name: 'Gold', plate: '#5c4516', plate2: '#33260a', trim: '#ffcf4d', lvl: 10 },
    prism: { id: 'prism', name: 'Prism', plate: '#2c2350', plate2: '#16112e', trim: '#8af5ff', lvl: 15, prism: true },
    obsidian: { id: 'obsidian', name: 'Obsidian', plate: '#0f0f14', plate2: '#050507', trim: '#b04dff', lvl: 20 },
  };

  // ── Research tree
  P.RESEARCH = [
    // Economy
    { id: 'e1', cat: 'Economy', name: 'Seed Capital I', desc: 'Starting Credits +2%', cost: 40, req: [], fx: { cashPct: 0.02 } },
    { id: 'e2', cat: 'Economy', name: 'Seed Capital II', desc: 'Starting Credits +4%', cost: 90, req: ['e1'], fx: { cashPct: 0.04 } },
    { id: 'e3', cat: 'Economy', name: 'Seed Capital III', desc: 'Starting Credits +6%', cost: 180, req: ['e2'], fx: { cashPct: 0.06 } },
    { id: 'e4', cat: 'Economy', name: 'Wave Dividend I', desc: 'End-of-wave bonus +5%', cost: 120, req: ['e1'], fx: { wavePct: 0.05 } },
    { id: 'e5', cat: 'Economy', name: 'Wave Dividend II', desc: 'End-of-wave bonus +10%', cost: 260, req: ['e4'], fx: { wavePct: 0.1 } },
    { id: 'e6', cat: 'Economy', name: 'Salvage Protocol', desc: 'Towers sell for 75% instead of 70%', cost: 220, req: ['e2'], fx: { sellPct: 0.05 } },
    { id: 'e7', cat: 'Economy', name: 'Farm Firmware', desc: 'Data Farm income +8%', cost: 320, req: ['e5'], fx: { farmPct: 0.08 } },
    { id: 'e8', cat: 'Economy', name: 'Venture Fund', desc: 'Starting Credits +8%', cost: 420, req: ['e3'], fx: { cashPct: 0.08 } },
    // Defense
    { id: 'd1', cat: 'Defense', name: 'Core Plating I', desc: 'Core HP +5', cost: 50, req: [], fx: { coreHp: 5 } },
    { id: 'd2', cat: 'Defense', name: 'Core Plating II', desc: 'Core HP +10', cost: 130, req: ['d1'], fx: { coreHp: 10 } },
    { id: 'd3', cat: 'Defense', name: 'Self-Repair', desc: 'Core regains 2 HP after every boss wave', cost: 220, req: ['d1'], fx: { coreRegen: 2 } },
    { id: 'd4', cat: 'Defense', name: 'Core Plating III', desc: 'Core HP +20', cost: 360, req: ['d2'], fx: { coreHp: 20 } },
    { id: 'd5', cat: 'Defense', name: 'Emergency Reserve', desc: 'Receive 300 Credits the first time the Core drops below 50%', cost: 300, req: ['d3'], fx: { reserve: 300 } },
    // Towers
    { id: 't1', cat: 'Towers', name: 'Streamlined Patches', desc: 'First upgrade on each path costs 8% less', cost: 80, req: [], fx: { firstUpg: 0.08 } },
    { id: 't2', cat: 'Towers', name: 'Signal Boost', desc: 'All towers +3% range', cost: 150, req: ['t1'], fx: { rangePct: 0.03 } },
    { id: 't3', cat: 'Towers', name: 'Magnetic Barrels', desc: 'Projectile speed +8%', cost: 110, req: ['t1'], fx: { projPct: 0.08 } },
    { id: 't4', cat: 'Towers', name: 'Bulk Fabrication', desc: 'Tower placement cost -3%', cost: 260, req: ['t2'], fx: { costPct: 0.03 } },
    { id: 't5', cat: 'Towers', name: 'Refined Algorithms', desc: 'All towers +3% damage', cost: 420, req: ['t4'], fx: { dmgPct: 0.03 } },
    { id: 't6', cat: 'Towers', name: 'Signal Boost II', desc: 'All towers +3% range', cost: 480, req: ['t5'], fx: { rangePct: 0.03 } },
    // Abilities
    { id: 'a1', cat: 'Abilities', name: 'Capacitor Tuning', desc: 'Ability cooldowns -5%', cost: 200, req: [], fx: { cdPct: 0.05 } },
    { id: 'a2', cat: 'Abilities', name: 'Hot Standby', desc: 'Abilities start the match ready', cost: 300, req: ['a1'], fx: { abilityReady: 1 } },
    { id: 'a3', cat: 'Abilities', name: 'Capacitor Tuning II', desc: 'Ability cooldowns -10%', cost: 460, req: ['a1'], fx: { cdPct: 0.1 } },
    // Progression
    { id: 'p1', cat: 'Progression', name: 'Data Mining I', desc: 'Account XP +5%', cost: 100, req: [], fx: { xpPct: 0.05 } },
    { id: 'p2', cat: 'Progression', name: 'Data Mining II', desc: 'Account XP +10%', cost: 260, req: ['p1'], fx: { xpPct: 0.1 } },
    { id: 'p3', cat: 'Progression', name: 'Chip Recycler', desc: 'Data Chips earned +5%', cost: 320, req: ['p2'], fx: { chipsPct: 0.05 } },
    { id: 'p4', cat: 'Progression', name: 'Field Training', desc: 'Tower Mastery XP +15%', cost: 200, req: ['p1'], fx: { masteryPct: 0.15 } },
  ];
  P.RESEARCH_BY_ID = {};
  for (const r of P.RESEARCH) P.RESEARCH_BY_ID[r.id] = r;
  P.RESEARCH_CATS = ['Economy', 'Defense', 'Towers', 'Abilities', 'Progression'];

  P.researchBonuses = function (researched) {
    const b = { cashPct: 0, wavePct: 0, sellPct: 0, farmPct: 0, coreHp: 0, coreRegen: 0, reserve: 0, firstUpg: 0, rangePct: 0, projPct: 0, costPct: 0, dmgPct: 0, cdPct: 0, abilityReady: 0, xpPct: 0, chipsPct: 0, masteryPct: 0 };
    for (const id in researched) {
      if (!researched[id]) continue;
      const r = P.RESEARCH_BY_ID[id];
      if (!r) continue;
      for (const k in r.fx) b[k] += r.fx[k];
    }
    return b;
  };

  // ── Special modes
  P.MODES = {
    onelife: { id: 'onelife', name: 'One Life', desc: 'One enemy reaching the Core ends the run.', level: 7, reward: 1.5 },
    speed: { id: 'speed', name: 'Speed Protocol', desc: 'Enemies move 40% faster.', level: 7, reward: 1.3 },
    limited: { id: 'limited', name: 'Limited Hardware', desc: 'Only four tower types allowed.', level: 9, reward: 1.3 },
    inflation: { id: 'inflation', name: 'Inflation', desc: 'Tower and upgrade prices rise 1.5% every wave.', level: 10, reward: 1.35 },
    double: { id: 'double', name: 'Double Trouble', desc: 'Every boss appears twice.', level: 12, reward: 1.4 },
    reverse: { id: 'reverse', name: 'Reverse Routing', desc: 'Enemies travel the map backward.', level: 13, reward: 1.2 },
    random: { id: 'random', name: 'Random Loadout', desc: 'You receive six random towers.', level: 14, reward: 1.25 },
  };
  P.MODE_ORDER = ['onelife', 'speed', 'limited', 'inflation', 'double', 'reverse', 'random'];

  // ── Hand-made challenges
  P.CHALLENGES = [
    { id: 'c_pulse', name: 'Pulse Purist', map: 'green', diff: 'standard', desc: 'Only Pulse Turrets allowed.', rules: { only: ['pulse'] }, reward: 150, level: 3 },
    { id: 'c_lean', name: 'Lean Startup', map: 'crossing', diff: 'standard', desc: 'Start with 350 Credits. Data Farms banned.', rules: { cash: 350, banned: ['farm'] }, reward: 160, level: 5 },
    { id: 'c_cold', name: 'No Brakes', map: 'cooling', diff: 'standard', desc: 'Firewall and Gravity Well banned.', rules: { banned: ['firewall', 'gravity'] }, reward: 180, level: 6 },
    { id: 'c_min', name: 'Minimalist', map: 'highway', diff: 'standard', desc: 'Place at most 8 towers.', rules: { maxTowers: 8 }, reward: 220, level: 7 },
    { id: 'c_rush', name: 'Rush Hour', map: 'crossing', diff: 'advanced', desc: 'Speed Protocol on Advanced.', rules: { modes: ['speed'] }, reward: 260, level: 8 },
    { id: 'c_tier', name: 'Budget Cuts', map: 'dunes', diff: 'standard', desc: 'Upgrades limited to tier 3.', rules: { maxTier: 3 }, reward: 220, level: 13 },
    { id: 'c_glass', name: 'Glass Core', map: 'corruption', diff: 'standard', desc: 'One Life. No mistakes.', rules: { modes: ['onelife'] }, reward: 320, level: 10 },
    { id: 'c_boss', name: 'Boss Rush', map: 'green', diff: 'advanced', desc: 'Double Trouble on Advanced.', rules: { modes: ['double'] }, reward: 300, level: 12 },
    { id: 'c_back', name: 'Backwards Compatible', map: 'processor', diff: 'standard', desc: 'Reverse Routing on the Central Processor.', rules: { modes: ['reverse'] }, reward: 340, level: 13 },
    { id: 'c_lotto', name: 'Hardware Lottery', map: 'cooling', diff: 'standard', desc: 'Random Loadout, no abilities.', rules: { modes: ['random'], noAbilities: true }, reward: 260, level: 14 },
    { id: 'c_nightmare', name: 'Kernel Panic', map: 'processor', diff: 'nightmare', desc: 'Nightmare with Inflation.', rules: { modes: ['inflation'] }, reward: 600, level: 15 },
  ];

  // ── Daily challenge (deterministic from date, no server required)
  P.dailyChallenge = function (dateKey) {
    const r = U.rng(U.hashStr('circuit-siege-daily-' + dateKey));
    const map = r.pick(CS.MAPS.map((m) => m.id));
    const diff = r() < 0.6 ? 'standard' : 'advanced';
    const rules = { banned: [], modes: [] };
    const lines = [];
    const towers = CS.TOWER_ORDER.slice();
    const nBan = r.int(1, 2);
    for (let i = 0; i < nBan; i++) {
      const t = r.pick(towers.filter((x) => x !== 'pulse' && rules.banned.indexOf(x) < 0));
      rules.banned.push(t);
      lines.push(CS.TOWERS[t].name + ' unavailable');
    }
    const spd = r.pick([0, 0.1, 0.15, 0.2]);
    if (spd) { rules.enemySpeed = spd; lines.push('Enemies move ' + Math.round(spd * 100) + '% faster'); }
    const cash = r.pick([0, 0.15, 0.25, -0.15]);
    if (cash) { rules.cashPct = cash; lines.push((cash > 0 ? 'Start with ' + Math.round(cash * 100) + '% extra Credits' : 'Start with ' + Math.round(-cash * 100) + '% fewer Credits')); }
    if (r() < 0.45) {
      const m = r.pick(['inflation', 'double', 'reverse', 'onelife']);
      if (m === 'onelife' && diff === 'advanced') { /* too cruel */ } else { rules.modes.push(m); lines.push(P.MODES[m].name + ': ' + P.MODES[m].desc); }
    }
    if (r() < 0.3) { rules.maxTier = 4; lines.push('Upgrades limited to tier 4'); }
    const reward = 80 + (diff === 'advanced' ? 60 : 0) + rules.modes.length * 30 + Math.round(spd * 200);
    return { id: 'daily-' + dateKey, date: dateKey, map, diff, rules, lines, reward, name: 'Daily Protocol' };
  };

  // ── Achievements
  P.ACHIEVEMENTS = [
    { id: 'tutorial', name: 'BOOT SEQUENCE', desc: 'Finish the tutorial.', chips: 20 },
    { id: 'first_defense', name: 'FIRST DEFENSE', desc: 'Complete your first match.', chips: 25 },
    { id: 'not_even_close', name: 'NOT EVEN CLOSE', desc: 'Win a match with exactly 1 Core HP.', chips: 100 },
    { id: 'overkill', name: 'OVERKILL', desc: 'Deal 10,000 damage in a single hit.', chips: 60 },
    { id: 'engineer', name: 'ENGINEER', desc: 'Place 100 total towers.', chips: 50 },
    { id: 'architect', name: 'ARCHITECT', desc: 'Place 1,000 total towers.', chips: 150 },
    { id: 'economist', name: 'ECONOMIST', desc: 'Generate 100,000 Credits.', chips: 75 },
    { id: 'tycoon', name: 'TYCOON', desc: 'Generate 1,000,000 Credits.', chips: 200 },
    { id: 'untouchable', name: 'UNTOUCHABLE', desc: 'Complete a Standard (or harder) map without losing Core HP.', chips: 150 },
    { id: 'boss_hunter', name: 'BOSS HUNTER', desc: 'Destroy 25 bosses.', chips: 100, icon: 'hex' },
    { id: 'root_access', name: 'ROOT ACCESS', desc: 'Defeat ROOT.', chips: 100, icon: 'root' },
    { id: 'exterminator', name: 'EXTERMINATOR', desc: 'Destroy 10,000 enemies.', chips: 75 },
    { id: 'purge', name: 'SYSTEM PURGE', desc: 'Destroy 100,000 enemies.', chips: 200 },
    { id: 'max_power', name: 'MAXIMUM POWER', desc: 'Purchase a tier 5 upgrade.', chips: 50 },
    { id: 'specialist', name: 'SPECIALIST', desc: 'Reach Mastery 5 with any tower.', chips: 60 },
    { id: 'polymath', name: 'POLYMATH', desc: 'Reach Mastery 5 with every tower.', chips: 300 },
    { id: 'scholar', name: 'SCHOLAR', desc: 'Complete every Research node.', chips: 300 },
    { id: 'cartographer', name: 'CARTOGRAPHER', desc: 'Beat every map on any difficulty.', chips: 200 },
    { id: 'advanced_win', name: 'ADVANCED USER', desc: 'Beat any map on Advanced.', chips: 120 },
    { id: 'nightmare_fuel', name: 'NIGHTMARE FUEL', desc: 'Beat any map on Nightmare.', chips: 300, icon: 'moon' },
    { id: 'endless_75', name: 'INFINITE LOOP', desc: 'Reach wave 75 in any match.', chips: 100 },
    { id: 'endless_125', name: 'STACK OVERFLOW', desc: 'Reach wave 125 in any match.', chips: 250 },
    { id: 'daily_1', name: 'DAILY DRIVER', desc: 'Complete a Daily Challenge.', chips: 50 },
    { id: 'daily_7', name: 'CRON JOB', desc: 'Complete 7 Daily Challenges.', chips: 150 },
    { id: 'one_life', name: 'FLAWLESS EXECUTION', desc: 'Win a One Life match.', chips: 150 },
    { id: 'cache_raider', name: 'CACHE RAIDER', desc: 'Destroy 10 Data Caches.', chips: 60 },
    { id: 'minimalist', name: 'MINIMALIST', desc: 'Win a Standard match placing 8 or fewer towers.', chips: 150 },
    { id: 'farmer', name: 'DATA HARVESTER', desc: 'Earn 50,000 Credits from Data Farms.', chips: 80 },
    { id: 'chain', name: 'CHAIN REACTION', desc: 'Hit 25 enemies with a single arc.', chips: 60 },
    { id: 'level10', name: 'SYSADMIN', desc: 'Reach account level 10.', chips: 80 },
    { id: 'level25', name: 'NETWORK ARCHITECT', desc: 'Reach account level 25.', chips: 200 },
    { id: 'challenger', name: 'CHALLENGER', desc: 'Complete 5 hand-made Challenges.', chips: 150 },
  ];
  P.ACH_BY_ID = {};
  for (const a of P.ACHIEVEMENTS) P.ACH_BY_ID[a.id] = a;

  CS.PROG = P;
})();
