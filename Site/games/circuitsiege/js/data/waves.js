/* CIRCUIT SIEGE — waves & difficulty
 * Wave DSL: "type*count/gap@start" groups, comma separated. Groups run in parallel from their start time.
 */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;
  const U = CS.U;

  CS.DIFFICULTIES = {
    casual: { id: 'casual', name: 'Casual', waves: 40, hp: 0.8, speed: 1, cash: 800, core: 200, cost: 0.85, reward: 1.1, boss: 0.8, elite: 0.5, xp: 1, chips: 1, color: '#6dffb0',
      desc: '40 waves. More Credits. Designed for learning.' },
    standard: { id: 'standard', name: 'Standard', waves: 60, hp: 1, speed: 1, cash: 650, core: 150, cost: 1, reward: 1, boss: 1, elite: 1, xp: 1.5, chips: 1.6, color: '#39d0ff',
      desc: '60 waves. The intended experience.' },
    advanced: { id: 'advanced', name: 'Advanced', waves: 80, hp: 1.2, speed: 1.05, cash: 550, core: 100, cost: 1.08, reward: 0.95, boss: 1.25, elite: 1.5, xp: 2.2, chips: 2.5, color: '#ffb547', unlockLevel: 5,
      desc: '80 waves. Stronger enemies, less money.' },
    nightmare: { id: 'nightmare', name: 'Nightmare', waves: 100, hp: 1.45, speed: 1.1, cash: 500, core: 50, cost: 1.2, reward: 0.9, boss: 1.6, elite: 2.2, xp: 3.2, chips: 4, color: '#ff4d6d', unlockLevel: 12,
      desc: '100 waves. Elite modifiers everywhere. Bosses are brutal.' },
  };
  CS.DIFF_ORDER = ['casual', 'standard', 'advanced', 'nightmare'];

  const HAND = [
    null,
    'frag*10/1.1',
    'frag*16/0.85',
    'frag*12/0.7,frag*8/0.5@10',
    'frag*24/0.6',
    'frag*20/0.5,frag*12/0.3@11',
    'frag*30/0.45',
    'frag*18/0.4,frag*18/0.4@9',
    'frag*40/0.35',
    'frag*26/0.3,frag*20/0.25@10',
    'frag*50/0.25',
    // 11-20: fast enemies & splitters
    'zip*8/0.9,frag*20/0.5@4',
    'frag*30/0.4,zip*12/0.5@6',
    'zip*25/0.35',
    'frag*40/0.3,zip*16/0.4@8',
    'splitter*6/1.6,frag*30/0.3@3',
    'zip*40/0.22',
    'splitter*10/1.1,zip*20/0.4@5',
    'frag*60/0.18,zip*20/0.3@6',
    'splitter*14/0.9,frag*40/0.2@4,zip*25/0.3@10',
    'ram*1/1,frag*30/0.5@3',
    // 21-30: armor
    'breaker*4/2.5,frag*30/0.4@2',
    'breaker*8/1.8,zip*20/0.4@5',
    'breaker*6/1.5,splitter*10/1.0@4',
    'trojan*10/1.2,frag*30/0.3@3',
    'breaker*14/1.2,zip*30/0.25@6',
    'overclocker*4/3,frag*50/0.25@1',
    'breaker*16/1.0,overclocker*4/3@4,zip*30/0.3@8',
    'trojan*18/0.8,splitter*10/1@6',
    'breaker*20/0.8,overclocker*8/1.8@3,frag*40/0.2@6',
    'worm*1/1,zip*30/0.4@5',
    // 31-40: shields & healers
    'shield*10/1.2,frag*40/0.3@2',
    'shield*18/0.9,zip*30/0.3@5',
    'shield*15/0.9,breaker*12/1.1@3',
    'healer*5/2.5,frag*60/0.2@1,breaker*8/1.4@5',
    'shield*25/0.6,overclocker*6/2@6',
    'healer*8/2,shield*20/0.7@2,trojan*15/0.8@8',
    'breaker*25/0.7,healer*6/2@4',
    'shield*30/0.5,zip*50/0.18@4',
    'shield*25/0.6,breaker*20/0.8@2,healer*8/1.8@6,overclocker*6/2@10',
    'blackout*1/1,ghost*6/1.5@6,frag*40/0.3@2',
    // 41-50: stealth & specials
    'ghost*8/1.4,frag*40/0.25@2',
    'ghost*14/1.0,shield*15/0.8@4',
    'ghost*12/0.9,breaker*15/0.9@3,zip*30/0.25@7',
    'splitter*20/0.6,ghost*10/1@5,healer*6/2@8',
    'ghost*25/0.6,overclocker*8/1.5@4',
    'trojan*25/0.6,ghost*15/0.8@4,shield*20/0.6@8',
    'breaker*30/0.6,healer*10/1.5@3,ghost*15/0.7@6',
    'ghost*35/0.45,zip*60/0.15@5',
    'shield*30/0.5,breaker*25/0.6@3,ghost*20/0.6@6,overclocker*10/1.2@9',
    'ram*1/1,healer*6/3@3,breaker*20/0.8@6',
    // 51-60: large mixed attacks
    'frag*120/0.1,zip*60/0.15@4',
    'breaker*40/0.45,shield*30/0.5@3',
    'trojan*40/0.4,ghost*30/0.5@5',
    'splitter*40/0.4,healer*12/1.2@4,overclocker*12/1.2@8',
    'shield*50/0.35,ghost*40/0.4@3',
    'breaker*50/0.35,zip*100/0.1@6',
    'trojan*40/0.35,splitter*30/0.5@3,healer*15/1@6',
    'ghost*50/0.3,shield*40/0.4@3,overclocker*15/1@6',
    'breaker*40/0.4,shield*40/0.4@2,ghost*40/0.4@4,healer*15/1@6,overclocker*15/1@8,trojan*30/0.5@10',
    'root*1/1',
  ];

  function parse(str) {
    return str.split(',').map((g) => {
      const m = g.trim().match(/^(\w+)\*(\d+)\/([\d.]+)(?:@([\d.]+))?$/);
      if (!m) throw new Error('Bad wave group ' + g);
      return { type: m[1], count: +m[2], gap: +m[3], start: m[4] ? +m[4] : 0 };
    });
  }

  const POOL_LATE = ['frag', 'zip', 'breaker', 'shield', 'ghost', 'splitter', 'healer', 'overclocker', 'trojan'];

  // Procedural wave for 61+ (and endless). Deterministic per wave number & map seed.
  function genWave(w, seed, endless) {
    const r = U.rng(U.hashStr('wave' + w + ':' + seed));
    const groups = [];
    const bossWave = w % 10 === 0;
    if (bossWave) {
      const bosses = ['ram', 'worm', 'blackout', 'root'];
      if (w === 70) { groups.push({ type: 'worm', count: 1, gap: 1, start: 0 }, { type: 'blackout', count: 1, gap: 1, start: 12 }); }
      else if (w === 80 || w === 100) { groups.push({ type: 'root', count: 1, gap: 1, start: 0 }); }
      else if (w === 90) { groups.push({ type: 'ram', count: 1, gap: 1, start: 0 }, { type: 'worm', count: 1, gap: 1, start: 8 }, { type: 'blackout', count: 1, gap: 1, start: 16 }); }
      else {
        const n = 1 + Math.min(3, Math.floor((w - 100) / 30));
        for (let i = 0; i < n; i++) groups.push({ type: bosses[(w / 10 + i) % 4], count: 1, gap: 1, start: i * 10 });
      }
      groups.push({ type: r.pick(['healer', 'shield', 'breaker']), count: 10 + Math.floor(w / 5), gap: 0.6, start: 4 });
      return groups;
    }
    const nGroups = 3 + Math.min(4, Math.floor((w - 60) / 12)) + (r() < 0.4 ? 1 : 0);
    const intensity = 1 + (w - 60) * 0.035 + (endless ? (w - 100) * 0.02 : 0);
    let t = 0;
    for (let i = 0; i < nGroups; i++) {
      const type = r.pick(POOL_LATE);
      const baseCount = { frag: 70, zip: 60, breaker: 30, shield: 32, ghost: 32, splitter: 26, healer: 10, overclocker: 10, trojan: 28 }[type];
      const count = Math.round(baseCount * (0.7 + r() * 0.6) * Math.min(3, intensity));
      const gap = Math.max(0.06, (type === 'healer' || type === 'overclocker' ? 1.2 : 0.35) / Math.sqrt(intensity));
      groups.push({ type, count, gap, start: t });
      t += 2 + r() * 4;
    }
    return groups;
  }

  CS.getWave = function (w, seed, endless) {
    if (w < HAND.length && HAND[w]) return parse(HAND[w]);
    return genWave(w, seed || 'x', endless);
  };

  CS.TUTORIAL_WAVES = [
    null,
    'frag*8/1.4',
    'frag*12/1.0',
    'zip*8/0.9,frag*8/0.9@3',
    'frag*16/0.6',
    'breaker*3/2.2,frag*10/0.7@1',
    'sentinel*1/1,frag*10/1@3',
  ];
  CS.getTutorialWave = (w) => parse(CS.TUTORIAL_WAVES[w]);

  CS.isBossWave = function (w, tutorial) {
    const groups = tutorial ? CS.getTutorialWave(w) : CS.getWave(w);
    return groups.some((g) => CS.ENEMIES[g.type] && CS.ENEMIES[g.type].boss);
  };

  // Enemy HP scaling by wave.
  CS.hpScale = function (w) {
    let s = 1 + 0.02 * (w - 1);
    if (w > 30) s += 0.03 * (w - 30);
    if (w > 50) s += 0.05 * (w - 50);
    if (w > 80) s += 0.08 * (w - 80);
    if (w > 100) s *= Math.pow(1.045, w - 100);
    return s;
  };
  CS.speedScale = function (w) {
    let s = 1;
    if (w > 50) s += 0.004 * (w - 50);
    if (w > 100) s += 0.004 * (w - 100);
    return Math.min(s, 1.6);
  };
  CS.eliteChance = function (w, diffElite, endless) {
    if (w < 45) return 0;
    let c = 0.015 + (w - 45) * 0.004;
    if (endless) c += 0.05;
    return Math.min(0.5, c * diffElite);
  };
  CS.waveBonus = (w) => 100 + w * 4;
})();
