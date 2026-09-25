/* CIRCUIT SIEGE — enemy definitions */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;

  // hp/speed are base values before wave & difficulty scaling. speed in px/s. leak = core damage.
  const E = {
    frag: { id: 'frag', name: 'Data Fragment', hp: 18, speed: 68, r: 11, reward: 4, leak: 1, color: '#3ee6d0',
      traits: ['Basic corrupted data.'] },
    mini: { id: 'mini', name: 'Bit Shard', hp: 12, speed: 80, r: 8, reward: 1, leak: 1, color: '#ffb44d',
      traits: ['Fragment released by a Splitter.'] },
    zip: { id: 'zip', name: 'Zip File', hp: 11, speed: 150, r: 9, reward: 3, leak: 1, color: '#ffe04d', fast: true,
      traits: ['Extremely fast.', 'Low health.'] },
    breaker: { id: 'breaker', name: 'Firewall Breaker', hp: 95, speed: 40, r: 16, reward: 12, leak: 3, armor: 4, color: '#9aa7b8',
      traits: ['Heavy armor: reduces physical damage by 4 per hit.', 'Explosives ignore half; energy & toxic ignore all.'] },
    shield: { id: 'shield', name: 'Shield Packet', hp: 40, shield: 65, speed: 60, r: 12, reward: 10, leak: 2, color: '#4d9bff',
      traits: ['Energy shield absorbs damage.', 'Shield regenerates after 2s without damage.', 'Energy deals bonus shield damage.'] },
    ghost: { id: 'ghost', name: 'Ghost Process', hp: 48, speed: 78, r: 11, reward: 10, leak: 2, stealth: true, color: '#d9c8ff',
      traits: ['Stealth: only detecting towers can target it.', 'Area damage still hits it.'] },
    splitter: { id: 'splitter', name: 'Splitter', hp: 75, speed: 52, r: 14, reward: 8, leak: 2, split: 4, color: '#ff9a3d',
      traits: ['Splits into 4 Bit Shards when destroyed.'] },
    healer: { id: 'healer', name: 'Healer', hp: 75, speed: 54, r: 13, reward: 14, leak: 2, heal: 0.1, healEvery: 2.5, healRange: 100, color: '#ff8fc8',
      traits: ['Restores 10% HP to nearby enemies every 2.5s.', 'High priority target!'] },
    overclocker: { id: 'overclocker', name: 'Overclocker', hp: 65, speed: 62, r: 13, reward: 12, leak: 2, haste: 0.4, hasteRange: 100, color: '#ff4d5e',
      traits: ['Nearby enemies move 40% faster.'] },
    trojan: { id: 'trojan', name: 'Trojan', hp: 120, speed: 58, r: 12, reward: 10, leak: 3, transform: 'trojanx', color: '#3ee6d0',
      traits: ['Disguised as a Data Fragment.', 'Transforms into a stronger form below 50% HP.'] },
    trojanx: { id: 'trojanx', name: 'Trojan (Unpacked)', hp: 150, speed: 80, r: 15, reward: 22, leak: 4, armor: 3, color: '#ff3d6e',
      traits: ['Unpacked payload: fast and armored.'] },
    cache: { id: 'cache', name: 'Data Cache', hp: 320, speed: 105, r: 13, reward: 0, leak: 0, cache: true, color: '#ffd84d',
      traits: ['Bonus target! Destroy it before it escapes for bonus Credits.'] },
    zombie: { id: 'zombie', name: 'Zombie Code', hp: 1, speed: 60, r: 10, reward: 0, leak: 0, color: '#7dff6a', traits: [] },

    // ─── Bosses
    ram: { id: 'ram', name: 'RAM CRUSHER', boss: true, hp: 1900, speed: 24, r: 34, reward: 400, leak: 100, armor: 3, color: '#5aa0ff',
      traits: ['Boss. Armored hull.', 'Shockwave disables nearby towers every 9s.'] },
    worm: { id: 'worm', name: 'THE WORM', boss: true, hp: 2200, speed: 34, r: 24, reward: 500, leak: 100, armor: 4, segments: 7, color: '#9dff5a',
      traits: ['Boss. Long segmented body.', 'Each living segment adds 1 armor to the head and spawns Zip Files.', 'Destroy segments to weaken it.'] },
    wormseg: { id: 'wormseg', name: 'Worm Segment', hp: 340, speed: 34, r: 17, reward: 40, leak: 5, armor: 2, color: '#6fd644',
      traits: ['Part of THE WORM.'] },
    blackout: { id: 'blackout', name: 'BLACKOUT', boss: true, hp: 5000, speed: 30, r: 32, reward: 700, leak: 120, color: '#8a5cff',
      traits: ['Boss. Plunges regions of the map into darkness.', 'Towers in darkness lose range and targeting.', 'Releases Ghost Processes.'] },
    root: { id: 'root', name: 'ROOT', boss: true, hp: 26000, speed: 26, r: 40, reward: 2000, leak: 9999, armor: 6, color: '#ff3d6e',
      traits: ['Final boss. Summons enemies, gains shields,', 'shifts speed, disables towers and corrupts the grid.'] },
    sentinel: { id: 'sentinel', name: 'SENTINEL', boss: true, hp: 700, speed: 30, r: 26, reward: 150, leak: 60, color: '#39d0ff',
      traits: ['Training boss. Slow but tough.'] },
  };

  CS.ENEMIES = E;

  CS.ELITES = {
    fortified: { id: 'fortified', name: 'FORTIFIED', color: '#c0c9d6', desc: '+5 armor, +50% HP' },
    hyper: { id: 'hyper', name: 'HYPER', color: '#ffe04d', desc: '+50% speed' },
    regen: { id: 'regen', name: 'REGENERATING', color: '#6aff8a', desc: 'Restores 2% HP per second' },
    phased: { id: 'phased', name: 'PHASED', color: '#b69cff', desc: 'Periodically becomes untargetable' },
    commander: { id: 'commander', name: 'COMMANDER', color: '#ff5a5a', desc: 'Nearby enemies take 25% less damage and move faster' },
  };
  CS.ELITE_IDS = Object.keys(CS.ELITES);

  // Enemy types shown in the tutorial / info codex in intro order.
  CS.ENEMY_INTRO = {
    zip: 'ZIP FILES are small and extremely fast. Keep turrets near the exit!',
    breaker: 'FIREWALL BREAKERS are armored. Use explosives, energy (Arc) or armor piercing.',
    shield: 'SHIELD PACKETS regenerate shields. Arc Towers deal double shield damage.',
    ghost: 'GHOST PROCESSES are stealthy. You need towers with DETECTION.',
    splitter: 'SPLITTERS burst into smaller shards when destroyed.',
    healer: 'HEALERS restore nearby enemies. Take them out first!',
    overclocker: 'OVERCLOCKERS speed up enemies around them.',
    trojan: 'TROJANS look harmless, but unpack into a dangerous form at half health.',
  };
})();
