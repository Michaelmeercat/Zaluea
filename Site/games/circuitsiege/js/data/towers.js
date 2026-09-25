/* CIRCUIT SIEGE — tower definitions
 * Every tower has 3 upgrade paths x 5 tiers.
 * Upgrade rule ("Core Budget"): at most 7 upgrades total per tower and only ONE path may go above tier 2.
 * Upgrade `f` receives the mutable stats object and modifies it.
 */
(function () {
  'use strict';
  const CS = (typeof window !== 'undefined' ? window : globalThis).CS;

  CS.UPGRADE_RULES = { maxTotal: 7, secondaryCap: 2 };

  CS.ABILITIES = {
    overclock: { id: 'overclock', name: 'Emergency Overclock', cd: 60, color: '#ffb547', desc: 'All towers gain +75% attack speed for 10s.' },
    orbital: { id: 'orbital', name: 'Orbital Strike', cd: 60, color: '#ff6a3d', target: true, desc: 'Call a massive orbital blast on a chosen location.' },
    freeze: { id: 'freeze', name: 'System Freeze', cd: 45, color: '#8fe8ff', desc: 'Slow every enemy by 70% for 5s (bosses 35%).' },
    swarm: { id: 'swarm', name: 'Swarm Strike', cd: 40, color: '#b7ff5a', desc: 'Launch 20 kamikaze drones at the strongest enemies.' },
    storm: { id: 'storm', name: 'Storm Surge', cd: 50, color: '#8ab4ff', desc: 'Lightning strikes every enemy for heavy energy damage.' },
    mark: { id: 'mark', name: 'Mark for Deletion', cd: 50, color: '#ff4d6d', desc: 'Strongest enemy takes +100% damage for 8s and is struck hard.' },
    pandemic: { id: 'pandemic', name: 'Pandemic', cd: 45, color: '#7dff6a', desc: 'Infect every enemy on the map with a super-strain.' },
    horizon: { id: 'horizon', name: 'Event Horizon', cd: 50, color: '#c77dff', desc: 'Drag enemies near your Gravity Wells backward and stun them.' },
    overcharge: { id: 'overcharge', name: 'Overcharge Beam', cd: 45, color: '#66f0ff', desc: 'Railguns fire continuously for 4s.' },
    singularity: { id: 'singularity', name: 'Singularity Shot', cd: 60, color: '#e0a3ff', desc: 'Obliterate the strongest enemy with a collapsing singularity.' },
    harvest: { id: 'harvest', name: 'Data Harvest', cd: 60, color: '#ffd84d', desc: 'Instantly harvest bonus credits.' },
  };

  const T = {};

  // ─────────────────────────────── PULSE TURRET
  T.pulse = {
    id: 'pulse', name: 'Pulse Turret', cost: 120, unlockLevel: 1, color: '#39d0ff', r: 17,
    role: 'Rapid single-target', tags: ['Cheap', 'Fast fire', 'Versatile'],
    desc: 'Reliable starter turret that fires quick energy slugs. Upgrades turn it into a plasma cannon, a bullet storm or a network commander.',
    kind: 'bullet', targeting: ['first', 'last', 'strong', 'weak', 'close'],
    base: { dmg: 5, rate: 2.2, range: 135, projSpeed: 640, pierce: 1, type: 'phys' },
    paths: [
      { name: 'DAMAGE', ups: [
        { n: 'Reinforced Shots', c: 110, d: '+2 damage and shots pierce 1 extra enemy.', f: (s) => { s.dmg += 2; s.pierce += 1; } },
        { n: 'Armor Piercing', c: 240, d: 'Ignores 4 armor. +3 damage.', f: (s) => { s.armorPen += 4; s.dmg += 3; } },
        { n: 'Heavy Rounds', c: 650, d: '+8 damage, bigger rounds knock enemies back.', f: (s) => { s.dmg += 8; s.knock += 5; s.projSize = 5; } },
        { n: 'Plasma Ammunition', c: 1900, d: 'Plasma rounds: +20 damage, +2 pierce and ignite targets.', f: (s) => { s.dmg += 20; s.pierce += 2; s.burn = Math.max(s.burn, 15); s.burnDur = 2; s.projColor = '#ff7bf2'; } },
        { n: 'Core Destroyer', c: 6800, d: 'x3 damage, x2.5 vs bosses, rounds detonate on impact.', f: (s) => { s.dmg *= 3; s.bossMult *= 2.5; s.splash = Math.max(s.splash, 34); s.projSize = 7; } },
      ] },
      { name: 'SPEED', ups: [
        { n: 'Faster Motors', c: 100, d: '+25% attack speed.', f: (s) => { s.rate *= 1.25; } },
        { n: 'Improved Cooling', c: 260, d: '+30% attack speed.', f: (s) => { s.rate *= 1.3; } },
        { n: 'Rapid Fire', c: 720, d: 'Twin barrels: fires 2 shots per volley, +1 damage.', f: (s) => { s.count = Math.max(s.count, 2); s.spread = 0.12; s.dmg += 1; } },
        { n: 'Overclock', c: 2300, d: 'x2 attack speed, +2 damage, +40% projectile speed.', f: (s) => { s.rate *= 2; s.dmg += 2; s.projSpeed *= 1.4; } },
        { n: 'Bullet Storm', c: 7200, d: 'Quad rotary barrels: 4 shots per volley, +60% attack speed, +3 damage.', f: (s) => { s.count = 4; s.spread = 0.16; s.rate *= 1.6; s.dmg += 3; } },
      ] },
      { name: 'UTILITY', ups: [
        { n: 'Better Targeting', c: 90, d: '+15% range, +20% projectile speed.', f: (s) => { s.range *= 1.15; s.projSpeed *= 1.2; } },
        { n: 'Stealth Detection', c: 180, d: 'Can target Ghost Processes.', f: (s) => { s.detect = true; } },
        { n: 'Longer Range', c: 420, d: '+25% range.', f: (s) => { s.range *= 1.25; } },
        { n: 'Weak Point Scanner', c: 1500, d: '25% chance to crit for x3 damage. Crits expose the target (+15% damage taken).', f: (s) => { s.crit = Math.max(s.crit, 0.25); s.critMult = Math.max(s.critMult, 3); s.markOnCrit = 0.15; } },
        { n: 'Command Network', c: 5200, d: 'Every Pulse Turret gains +25% attack speed, +10% range and detection. This turret deals x2 damage.', f: (s) => { s.dmg *= 2; s.netPulse = true; } },
      ] },
    ],
  };

  // ─────────────────────────────── SNIPER NODE
  T.sniper = {
    id: 'sniper', name: 'Sniper Node', cost: 300, unlockLevel: 1, color: '#9dff7a', r: 17,
    role: 'Long-range precision', tags: ['Huge range', 'High damage', 'Boss damage'],
    desc: 'A long-range precision node that hits instantly anywhere in its huge range. Ideal for picking off priority targets.',
    kind: 'hitscan', targeting: ['first', 'last', 'strong', 'weak', 'close', 'boss'],
    base: { dmg: 30, rate: 0.55, range: 480, pierce: 1, type: 'phys', armorPen: 2 },
    paths: [
      { name: 'CALIBER', ups: [
        { n: 'Heavy Caliber', c: 260, d: '+22 damage.', f: (s) => { s.dmg += 22; } },
        { n: 'Deadeye', c: 620, d: '+15 damage and ignores 6 more armor.', f: (s) => { s.dmg += 15; s.armorPen += 6; } },
        { n: 'Shatter Rounds', c: 1600, d: '+40 damage. Every hit permanently strips 2 armor.', f: (s) => { s.dmg += 40; s.shred += 2; } },
        { n: 'Execution Protocol', c: 4200, d: '+130 damage. Instantly deletes non-boss enemies under 20% HP.', f: (s) => { s.dmg += 130; s.execute = Math.max(s.execute, 0.2); } },
        { n: 'Singularity Bolt', c: 11500, d: 'x3 damage, x3 vs bosses. Unlocks MARK FOR DELETION.', f: (s) => { s.dmg *= 3; s.bossMult *= 3; s.ability = 'mark'; } },
      ] },
      { name: 'RELOAD', ups: [
        { n: 'Bolt Upgrade', c: 220, d: '+30% attack speed.', f: (s) => { s.rate *= 1.3; } },
        { n: 'Auto Loader', c: 520, d: '+40% attack speed.', f: (s) => { s.rate *= 1.4; } },
        { n: 'Semi-Auto', c: 1400, d: '+80% attack speed.', f: (s) => { s.rate *= 1.8; } },
        { n: 'Shrapnel Rounds', c: 3200, d: 'Hits burst into 4 shrapnel shards dealing 35% damage to nearby enemies.', f: (s) => { s.shrapnel = 4; s.shrapnelMult = 0.35; } },
        { n: 'Full Auto Node', c: 9200, d: 'x2.5 attack speed and 8 shrapnel shards.', f: (s) => { s.rate *= 2.5; s.shrapnel = 8; } },
      ] },
      { name: 'SPOTTER', ups: [
        { n: 'Thermal Optics', c: 160, d: 'Detects Ghost Processes. +10% range.', f: (s) => { s.detect = true; s.range *= 1.1; } },
        { n: 'Stun Rounds', c: 520, d: 'Hits stun non-boss enemies for 0.3s.', f: (s) => { s.stun = Math.max(s.stun, 0.3); } },
        { n: 'Supply Link', c: 1400, d: 'Earns 90 Credits every wave. Nearby towers gain detection.', f: (s) => { s.income += 90; s.spotter = 130; } },
        { n: 'Recon Uplink', c: 3300, d: 'Hits permanently reveal stealth enemies. Towers within 250 gain +10% range.', f: (s) => { s.reveal = true; s.spotter = 250; s.spotRange = 0.1; } },
        { n: 'Elite Spotter', c: 8600, d: 'ALL towers gain detection. 50% crit chance for x4 damage.', f: (s) => { s.eliteSpotter = true; s.crit = 0.5; s.critMult = 4; } },
      ] },
    ],
  };

  // ─────────────────────────────── FIREWALL
  T.firewall = {
    id: 'firewall', name: 'Firewall', cost: 260, unlockLevel: 1, color: '#ff8a3d', r: 17,
    role: 'Area slow & burn', tags: ['Crowd control', 'Area', 'Damage-over-time'],
    desc: 'Projects a barrier field over the path that slows every enemy inside. Can be upgraded to burn, freeze or quarantine.',
    kind: 'aura', targeting: [],
    base: { range: 82, auraSlow: 0.3, type: 'toxic', dmg: 0, rate: 1 },
    paths: [
      { name: 'BURN', ups: [
        { n: 'Heat Sink', c: 220, d: 'Field burns enemies for 6 dmg/s.', f: (s) => { s.auraDot += 6; } },
        { n: 'Thermal Flood', c: 480, d: '+10 dmg/s. Burning lingers 2s after leaving.', f: (s) => { s.auraDot += 10; s.auraLinger = 2; } },
        { n: 'Meltdown', c: 1300, d: '+25 dmg/s. Enemies inside lose 3 armor.', f: (s) => { s.auraDot += 25; s.auraShred = 3; } },
        { n: 'Inferno Core', c: 3600, d: '+60 dmg/s. Erupts every 2s for 90 damage.', f: (s) => { s.auraDot += 60; s.auraPulseEvery = 2; s.auraPulseDmg = 90; } },
        { n: 'Solar Barrier', c: 10500, d: 'x3 burn, eruptions deal 450, enemies inside take +25% damage.', f: (s) => { s.auraDot *= 3; s.auraPulseDmg = 450; s.auraVuln = Math.max(s.auraVuln, 0.25); } },
      ] },
      { name: 'COLD', ups: [
        { n: 'Cryo Coils', c: 190, d: 'Slow increased to 45%.', f: (s) => { s.auraSlow = Math.max(s.auraSlow, 0.45); } },
        { n: 'Frost Mesh', c: 420, d: '+20% field size.', f: (s) => { s.range *= 1.2; } },
        { n: 'Deep Freeze', c: 1250, d: 'Every 4s, freezes non-boss enemies inside for 0.8s.', f: (s) => { s.freezeEvery = 4; s.freezeDur = 0.8; } },
        { n: 'Permafrost', c: 3100, d: 'Slow increased to 60% and lingers 2s.', f: (s) => { s.auraSlow = Math.max(s.auraSlow, 0.6); s.slowLinger = 2; } },
        { n: 'Absolute Zero', c: 8200, d: 'Freezes last 1.5s. Unlocks SYSTEM FREEZE.', f: (s) => { s.freezeDur = 1.5; s.freezeEvery = 3; s.ability = 'freeze'; } },
      ] },
      { name: 'BARRIER', ups: [
        { n: 'Wider Grid', c: 160, d: '+15% field size.', f: (s) => { s.range *= 1.15; } },
        { n: 'Packet Filter', c: 360, d: 'Ghosts inside the field are exposed to ALL towers.', f: (s) => { s.auraReveal = true; } },
        { n: 'Shield Scrambler', c: 950, d: 'Drains enemy shields by 45/s inside and blocks shield regen.', f: (s) => { s.auraShieldStrip = 45; } },
        { n: 'Quarantine', c: 2900, d: 'Disables enemy abilities inside: healing, overclock auras, regeneration and phasing.', f: (s) => { s.auraQuarantine = true; } },
        { n: 'Kill Switch', c: 7800, d: 'Field deals 2.5% max HP/s (0.4% bosses) and strips elite modifiers.', f: (s) => { s.auraPct = 0.025; s.auraStripElite = true; } },
      ] },
    ],
  };

  // ─────────────────────────────── ARC TOWER
  T.arc = {
    id: 'arc', name: 'Arc Tower', cost: 400, unlockLevel: 1, color: '#8ab4ff', r: 17,
    role: 'Chain lightning', tags: ['Groups', 'Anti-shield', 'Energy'],
    desc: 'Discharges electricity that chains between enemies. Energy ignores armor and deals double damage to shields.',
    kind: 'chain', targeting: ['first', 'last', 'strong', 'weak', 'close'],
    base: { dmg: 11, rate: 0.95, range: 120, chain: 4, chainRange: 85, chainFalloff: 0.85, type: 'energy', shieldMult: 2 },
    paths: [
      { name: 'VOLTAGE', ups: [
        { n: 'High Voltage', c: 260, d: '+6 damage.', f: (s) => { s.dmg += 6; } },
        { n: 'Capacitor Bank', c: 680, d: '+10 damage, chains lose less power.', f: (s) => { s.dmg += 10; s.chainFalloff = 0.95; } },
        { n: 'Plasma Arc', c: 1600, d: '+22 damage, x1.5 vs bosses.', f: (s) => { s.dmg += 22; s.bossMult *= 1.5; } },
        { n: 'Thunderhead', c: 4100, d: 'Every 4th strike is a storm bolt hitting 12 enemies for double damage.', f: (s) => { s.stormEvery = 4; } },
        { n: 'Storm Surge', c: 10200, d: 'x2.5 damage. Unlocks STORM SURGE.', f: (s) => { s.dmg *= 2.5; s.ability = 'storm'; } },
      ] },
      { name: 'CHAINS', ups: [
        { n: 'Conductive', c: 220, d: 'Chains to 2 more enemies.', f: (s) => { s.chain += 2; } },
        { n: 'Branching', c: 580, d: 'Chains to 3 more enemies, longer jumps.', f: (s) => { s.chain += 3; s.chainRange += 20; } },
        { n: 'Overload Nodes', c: 1450, d: 'Enemies destroyed by arcs explode for 45 damage.', f: (s) => { s.overload = 45; } },
        { n: 'Tesla Web', c: 3600, d: 'Chains to 8 more enemies. +30% attack speed.', f: (s) => { s.chain += 8; s.rate *= 1.3; } },
        { n: 'Grid Collapse', c: 9200, d: 'Chains up to 40 enemies with no power loss. +50% attack speed.', f: (s) => { s.chain = 40; s.chainFalloff = 1; s.rate *= 1.5; s.overload *= 2; } },
      ] },
      { name: 'CONTROL', ups: [
        { n: 'Longer Coils', c: 190, d: '+20% range.', f: (s) => { s.range *= 1.2; } },
        { n: 'Static Field', c: 470, d: 'Hits slow enemies by 25% for 1s.', f: (s) => { s.slow = Math.max(s.slow, 0.25); s.slowDur = 1; } },
        { n: 'Ionize', c: 1150, d: 'Hit enemies take +15% damage from all sources for 2s.', f: (s) => { s.vuln = Math.max(s.vuln, 0.15); s.vulnDur = 2; } },
        { n: 'Detection Arc', c: 2600, d: 'Detects stealth. Hits stun for 0.25s.', f: (s) => { s.detect = true; s.stun = Math.max(s.stun, 0.25); } },
        { n: 'Faraday Cage', c: 7200, d: 'Constantly shocks every enemy in range for 40/s and instantly shatters shields.', f: (s) => { s.faraday = 40; } },
      ] },
    ],
  };

  // ─────────────────────────────── MISSILE ARRAY
  T.missile = {
    id: 'missile', name: 'Missile Array', cost: 520, unlockLevel: 2, color: '#ff6a3d', r: 18,
    role: 'Explosive area damage', tags: ['Splash', 'Anti-group', 'Half armor'],
    desc: 'Launches homing missiles that explode on impact. Explosions only suffer half of enemy armor.',
    kind: 'missile', targeting: ['first', 'last', 'strong', 'weak', 'close', 'boss'],
    base: { dmg: 16, rate: 0.7, range: 165, projSpeed: 300, splash: 55, type: 'explosive', count: 1 },
    paths: [
      { name: 'WARHEAD', ups: [
        { n: 'Bigger Payload', c: 300, d: '+8 damage, +15 blast radius.', f: (s) => { s.dmg += 8; s.splash += 15; } },
        { n: 'Cluster Bombs', c: 820, d: 'Explosions scatter 4 bomblets.', f: (s) => { s.cluster = 4; } },
        { n: 'Thermobaric', c: 2050, d: '+30 damage, explosions leave burning targets.', f: (s) => { s.dmg += 30; s.burn = Math.max(s.burn, 15); s.burnDur = 2; } },
        { n: 'Bunker Buster', c: 5100, d: 'x2 damage, fully ignores armor, x1.5 vs bosses.', f: (s) => { s.dmg *= 2; s.armorPen += 99; s.bossMult *= 1.5; } },
        { n: 'Obliterator', c: 13200, d: 'x3 damage, +50% blast radius, blasts knock enemies back.', f: (s) => { s.dmg *= 3; s.splash *= 1.5; s.knock += 12; } },
      ] },
      { name: 'LAUNCHER', ups: [
        { n: 'Faster Reload', c: 260, d: '+30% attack speed.', f: (s) => { s.rate *= 1.3; } },
        { n: 'Twin Pods', c: 720, d: 'Fires 2 missiles per salvo.', f: (s) => { s.count = Math.max(s.count, 2); } },
        { n: 'Salvo', c: 1850, d: 'Fires 4 missiles per salvo, +20% attack speed.', f: (s) => { s.count = Math.max(s.count, 4); s.rate *= 1.2; } },
        { n: 'Swarm Rockets', c: 4600, d: '8 missiles per salvo, +50% missile speed.', f: (s) => { s.count = Math.max(s.count, 8); s.projSpeed *= 1.5; } },
        { n: 'Rain of Fire', c: 11200, d: '12 missiles per salvo, +50% attack speed.', f: (s) => { s.count = 12; s.rate *= 1.5; } },
      ] },
      { name: 'GUIDANCE', ups: [
        { n: 'Targeting Radar', c: 210, d: '+20% range.', f: (s) => { s.range *= 1.2; } },
        { n: 'Seeker Heads', c: 460, d: 'Detects stealth, missiles re-target if their target dies.', f: (s) => { s.detect = true; s.retarget = true; } },
        { n: 'Long-Range Battery', c: 1150, d: '+40% range.', f: (s) => { s.range *= 1.4; } },
        { n: 'Concussive', c: 3100, d: 'Explosions stun non-boss enemies for 0.4s.', f: (s) => { s.stun = Math.max(s.stun, 0.4); } },
        { n: 'Orbital Uplink', c: 9100, d: '+30% blast radius. Unlocks ORBITAL STRIKE.', f: (s) => { s.splash *= 1.3; s.ability = 'orbital'; } },
      ] },
    ],
  };

  // ─────────────────────────────── DRONE HUB
  T.drone = {
    id: 'drone', name: 'Drone Hub', cost: 480, unlockLevel: 3, color: '#b7ff5a', r: 18,
    role: 'Roaming hunters', tags: ['Mobile', 'Anti-fast', 'Coverage'],
    desc: 'Launches autonomous drones that hunt enemies anywhere within their leash. Great coverage for long paths.',
    kind: 'drones', targeting: ['first', 'last', 'strong', 'close', 'fast'],
    base: { range: 210, drones: 2, droneDmg: 5, droneRate: 2.4, droneSpeed: 230, type: 'phys', dmg: 5, rate: 2.4 },
    paths: [
      { name: 'PAYLOAD', ups: [
        { n: 'Hardened Drones', c: 260, d: '+3 drone damage.', f: (s) => { s.droneDmg += 3; } },
        { n: 'Micro Missiles', c: 720, d: 'Drones fire micro missiles with a small blast.', f: (s) => { s.droneSplash = 26; s.droneDmg += 1; } },
        { n: 'Heavy Chassis', c: 1650, d: '+10 drone damage, armored drones.', f: (s) => { s.droneDmg += 10; s.armorPen += 3; } },
        { n: 'Gunship', c: 4300, d: 'Adds a gunship that fires heavy 45-damage shells.', f: (s) => { s.gunships = 1; } },
        { n: 'Carrier Command', c: 11500, d: '+3 gunships and x2 drone damage.', f: (s) => { s.gunships = 4; s.droneDmg *= 2; } },
      ] },
      { name: 'SWARM', ups: [
        { n: 'Extra Drone', c: 320, d: '+1 drone.', f: (s) => { s.drones += 1; } },
        { n: 'Swarm Logic', c: 740, d: '+1 drone, +30% drone speed.', f: (s) => { s.drones += 1; s.droneSpeed *= 1.3; } },
        { n: 'Hive Mind', c: 1550, d: '+2 drones. Drones deal +30% damage.', f: (s) => { s.drones += 2; s.droneDmg *= 1.3; } },
        { n: 'Replicator', c: 3900, d: '+3 drones, +30% fire rate, +3 drone damage.', f: (s) => { s.drones += 3; s.droneRate *= 1.3; s.droneDmg += 3; } },
        { n: 'Swarm Protocol', c: 9300, d: '+4 drones, x1.5 drone damage. Unlocks SWARM STRIKE.', f: (s) => { s.drones += 4; s.droneDmg *= 1.5; s.ability = 'swarm'; } },
      ] },
      { name: 'SENSORS', ups: [
        { n: 'Long Leash', c: 210, d: '+30% hunting range.', f: (s) => { s.range *= 1.3; } },
        { n: 'Sensor Array', c: 360, d: 'Drones detect stealth.', f: (s) => { s.detect = true; } },
        { n: 'Interceptors', c: 1150, d: 'Drones deal x2 damage to fast enemies.', f: (s) => { s.antiFast = 2; } },
        { n: 'EMP Drones', c: 2900, d: 'Drone hits drain shields x3 and briefly stun.', f: (s) => { s.shieldMult = Math.max(s.shieldMult, 3); s.stun = Math.max(s.stun, 0.12); } },
        { n: 'Overwatch AI', c: 7700, d: 'Drones patrol the ENTIRE map. x2 fire rate.', f: (s) => { s.globalLeash = true; s.droneRate *= 2; } },
      ] },
    ],
  };

  // ─────────────────────────────── DATA FARM
  T.farm = {
    id: 'farm', name: 'Data Farm', cost: 650, unlockLevel: 4, color: '#ffd84d', r: 18,
    role: 'Economy', tags: ['Income', 'Support', 'Risky early'],
    desc: 'Mines data during waves and converts it into Credits. Investing early pays off later — if you survive.',
    kind: 'farm', targeting: [],
    base: { range: 110, income: 90 },
    paths: [
      { name: 'YIELD', ups: [
        { n: 'Denser Storage', c: 420, d: '+60 Credits per wave.', f: (s) => { s.income += 60; } },
        { n: 'Compression', c: 950, d: '+100 Credits per wave.', f: (s) => { s.income += 100; } },
        { n: 'Server Cluster', c: 2500, d: '+240 Credits per wave.', f: (s) => { s.income += 240; } },
        { n: 'Data Center', c: 6200, d: '+650 Credits per wave.', f: (s) => { s.income += 650; } },
        { n: 'Mega Cloud', c: 15500, d: '+1900 Credits per wave.', f: (s) => { s.income += 1900; } },
      ] },
      { name: 'INTEREST', ups: [
        { n: 'Savings Protocol', c: 520, d: 'Earn 2% interest on banked Credits each wave (max 150).', f: (s) => { s.interest = 0.02; s.interestCap = 150; } },
        { n: 'Stock Algorithm', c: 1250, d: 'Interest 4% (max 400).', f: (s) => { s.interest = 0.04; s.interestCap = 400; } },
        { n: 'Crypto Vault', c: 3100, d: 'Interest 5% (max 800), +60 per wave.', f: (s) => { s.interest = 0.05; s.interestCap = 800; s.income += 60; } },
        { n: 'Investment Bank', c: 7200, d: 'Interest 6% (max 1600).', f: (s) => { s.interest = 0.06; s.interestCap = 1600; } },
        { n: 'Market Maker', c: 16500, d: 'Interest 8% (max 3000). Unlocks DATA HARVEST.', f: (s) => { s.interest = 0.08; s.interestCap = 3000; s.ability = 'harvest'; } },
      ] },
      { name: 'LOGISTICS', ups: [
        { n: 'Tech Supply', c: 380, d: 'Towers in range get 6% cheaper upgrades.', f: (s) => { s.supplyDiscount = 0.06; } },
        { n: 'Bounty Protocol', c: 900, d: 'Enemies destroyed in range give +30% Credits.', f: (s) => { s.bounty = 0.3; } },
        { n: 'Logistics Hub', c: 2100, d: 'Discount 12%, +100 Credits per wave.', f: (s) => { s.supplyDiscount = 0.12; s.income += 100; } },
        { n: 'Tax Engine', c: 5200, d: 'ALL kills give +10% Credits.', f: (s) => { s.globalBounty = 0.1; } },
        { n: 'Venture Core', c: 12500, d: 'Global kill bonus 20%, +500 per wave, discount 15%.', f: (s) => { s.globalBounty = 0.2; s.income += 500; s.supplyDiscount = 0.15; } },
      ] },
    ],
  };

  // ─────────────────────────────── VIRUS LAB
  T.virus = {
    id: 'virus', name: 'Virus Lab', cost: 380, unlockLevel: 5, color: '#7dff6a', r: 17,
    role: 'Damage-over-time', tags: ['Infection', 'Ignores armor & shields', 'Spread'],
    desc: 'Fires infectious code that damages over time, bypassing armor and shields. Infection can spread through crowds.',
    kind: 'virus', targeting: ['first', 'last', 'strong', 'weak', 'close'],
    base: { dmg: 2, rate: 0.85, range: 140, projSpeed: 330, type: 'toxic', virusDps: 10, virusDur: 4 },
    paths: [
      { name: 'POTENCY', ups: [
        { n: 'Aggressive Strain', c: 260, d: '+8 infection damage/s.', f: (s) => { s.virusDps += 8; } },
        { n: 'Necrotic Code', c: 680, d: '+15 dmg/s, infection lasts 2s longer.', f: (s) => { s.virusDps += 15; s.virusDur += 2; } },
        { n: 'Corrosive Payload', c: 1650, d: 'Infected enemies lose 3 armor. +20 dmg/s.', f: (s) => { s.virusShred = 3; s.virusDps += 20; } },
        { n: 'Hemorrhage', c: 4600, d: 'Infection also deals 1% max HP/s (0.25% bosses).', f: (s) => { s.virusPct = 0.01; } },
        { n: 'Extinction Code', c: 12200, d: 'x3 infection damage. Infected non-boss enemies under 10% HP are deleted.', f: (s) => { s.virusDps *= 3; s.virusExecute = 0.1; } },
      ] },
      { name: 'CONTAGION', ups: [
        { n: 'Airborne', c: 260, d: 'Infection jumps to 2 nearby enemies on death.', f: (s) => { s.spreadOnDeath = 2; } },
        { n: 'Outbreak', c: 720, d: 'Infected enemies spread it to a neighbour every 1.5s.', f: (s) => { s.spreadEvery = 1.5; } },
        { n: 'Epidemic', c: 1800, d: 'Globs splash, infecting everything nearby.', f: (s) => { s.splash = Math.max(s.splash, 50); } },
        { n: 'Plague Cloud', c: 4300, d: 'Globs leave toxic clouds on the path for 5s.', f: (s) => { s.cloud = 5; } },
        { n: 'Pandemic', c: 10200, d: 'Spread every 0.6s. Unlocks PANDEMIC.', f: (s) => { s.spreadEvery = 0.6; s.ability = 'pandemic'; } },
      ] },
      { name: 'BIO-HACK', ups: [
        { n: 'Mutagen', c: 210, d: '+20% range.', f: (s) => { s.range *= 1.2; } },
        { n: 'Weaken', c: 470, d: 'Infected enemies take +10% damage from all sources.', f: (s) => { s.weaken = 0.1; } },
        { n: 'Slow Metabolism', c: 1150, d: 'Infected enemies move 25% slower.', f: (s) => { s.virusSlow = 0.25; } },
        { n: 'Genome Scanner', c: 2700, d: 'Detects stealth. Infected ghosts lose stealth.', f: (s) => { s.detect = true; s.reveal = true; } },
        { n: 'Zombie Protocol', c: 8200, d: 'Infected enemies that die rise as zombie code marching BACKWARD, ramming enemies.', f: (s) => { s.zombie = true; } },
      ] },
    ],
  };

  // ─────────────────────────────── RAILGUN
  T.rail = {
    id: 'rail', name: 'Railgun', cost: 650, unlockLevel: 6, color: '#66f0ff', r: 18,
    role: 'Piercing line damage', tags: ['Pierce', 'Anti-armor', 'Lines'],
    desc: 'Accelerates a slug to hypersonic speed, piercing everything in a line. Place it where the path runs straight.',
    kind: 'rail', targeting: ['first', 'last', 'strong', 'close', 'boss'],
    base: { dmg: 55, rate: 0.36, range: 290, pierce: 5, type: 'phys', armorPen: 5 },
    paths: [
      { name: 'POWER', ups: [
        { n: 'Capacitors', c: 420, d: '+30 damage.', f: (s) => { s.dmg += 30; } },
        { n: 'Tungsten Slug', c: 950, d: 'Pierces 3 more enemies, ignores 5 more armor.', f: (s) => { s.pierce += 3; s.armorPen += 5; } },
        { n: 'Magnetic Accelerator', c: 2300, d: '+85 damage.', f: (s) => { s.dmg += 85; } },
        { n: 'Hypervelocity', c: 5700, d: 'x2 damage, unlimited pierce.', f: (s) => { s.dmg *= 2; s.pierce = 60; } },
        { n: 'Planet Cracker', c: 14500, d: 'x3 damage, x2 vs bosses. Unlocks OVERCHARGE BEAM.', f: (s) => { s.dmg *= 3; s.bossMult *= 2; s.ability = 'overcharge'; } },
      ] },
      { name: 'CYCLE', ups: [
        { n: 'Coolant Loop', c: 380, d: '+30% attack speed.', f: (s) => { s.rate *= 1.3; } },
        { n: 'Dual Rails', c: 950, d: '+60% attack speed.', f: (s) => { s.rate *= 1.6; } },
        { n: 'Auto-Cycler', c: 2100, d: '+50% attack speed.', f: (s) => { s.rate *= 1.5; } },
        { n: 'Flux Loader', c: 4900, d: 'Rails leave an ionized trail dealing 35 dmg/s for 2s.', f: (s) => { s.trail = 35; } },
        { n: 'Gatling Rail', c: 12500, d: 'x3 attack speed.', f: (s) => { s.rate *= 3; s.trail *= 1.5; } },
      ] },
      { name: 'SCOPE', ups: [
        { n: 'Targeting Array', c: 260, d: '+20% range.', f: (s) => { s.range *= 1.2; } },
        { n: 'Phase Scanner', c: 520, d: 'Detects stealth.', f: (s) => { s.detect = true; } },
        { n: 'Shieldbreaker', c: 1450, d: 'x3 damage to shields, fully ignores armor.', f: (s) => { s.shieldMult = Math.max(s.shieldMult, 3); s.armorPen += 99; } },
        { n: 'Overpenetration', c: 3600, d: 'Damage increases +20% for each enemy pierced.', f: (s) => { s.overpen = 0.2; } },
        { n: 'Terminal Velocity', c: 9800, d: 'Map-wide range, +150% damage, 20% crit chance.', f: (s) => { s.range = 2000; s.dmg *= 2.5; s.crit = Math.max(s.crit, 0.2); s.critMult = Math.max(s.critMult, 2.5); } },
      ] },
    ],
  };

  // ─────────────────────────────── AMPLIFIER
  T.amp = {
    id: 'amp', name: 'Amplifier', cost: 700, unlockLevel: 7, color: '#ff5ad1', r: 18,
    role: 'Support buffs', tags: ['Support', 'Buffs', 'Synergy'],
    desc: 'Broadcasts a boost signal to towers in range. Amplifier buffs do not stack — the strongest applies.',
    kind: 'amp', targeting: [],
    base: { range: 115, buffRate: 0.12 },
    paths: [
      { name: 'POWER', ups: [
        { n: 'Signal Boost', c: 420, d: 'Towers in range deal +10% damage.', f: (s) => { s.buffDmg += 0.1; } },
        { n: 'Power Surge', c: 1050, d: '+15% more damage.', f: (s) => { s.buffDmg += 0.15; } },
        { n: 'Armor Link', c: 2600, d: 'Towers in range ignore 4 armor.', f: (s) => { s.buffArmorPen += 4; } },
        { n: 'Critical Mass', c: 6300, d: '+25% damage and +10% crit chance.', f: (s) => { s.buffDmg += 0.25; s.buffCrit += 0.1; } },
        { n: 'Apex Amplifier', c: 14500, d: '+50% damage and +50% vs bosses.', f: (s) => { s.buffDmg += 0.5; s.buffBoss += 0.5; } },
      ] },
      { name: 'TEMPO', ups: [
        { n: 'Clock Sync', c: 380, d: '+10% attack speed.', f: (s) => { s.buffRate += 0.1; } },
        { n: 'Turbo Bus', c: 950, d: '+10% attack speed.', f: (s) => { s.buffRate += 0.1; } },
        { n: 'Cooldown Relay', c: 2300, d: 'Abilities recharge 25% faster.', f: (s) => { s.buffCd += 0.25; } },
        { n: 'Hyperthreading', c: 5600, d: '+20% attack speed.', f: (s) => { s.buffRate += 0.2; } },
        { n: 'Emergency Overclock', c: 12500, d: '+15% attack speed. Unlocks EMERGENCY OVERCLOCK.', f: (s) => { s.buffRate += 0.15; s.ability = 'overclock'; } },
      ] },
      { name: 'REACH', ups: [
        { n: 'Antenna', c: 320, d: '+20% buff radius.', f: (s) => { s.range *= 1.2; } },
        { n: 'Wideband', c: 850, d: 'Towers in range gain +12% range.', f: (s) => { s.buffRange += 0.12; } },
        { n: 'Radar Mesh', c: 1850, d: 'Towers in range detect stealth.', f: (s) => { s.buffDetect = true; } },
        { n: 'Projectile Accel', c: 4300, d: '+40% projectile speed, +8% range.', f: (s) => { s.buffProj += 0.4; s.buffRange += 0.08; } },
        { n: 'Broadcast Tower', c: 11200, d: 'Buff radius x2.5, +1 pierce for towers in range.', f: (s) => { s.range *= 2.5; s.buffPierce += 1; } },
      ] },
    ],
  };

  // ─────────────────────────────── GRAVITY WELL
  T.gravity = {
    id: 'gravity', name: 'Gravity Well', cost: 600, unlockLevel: 8, color: '#c77dff', r: 18,
    role: 'Heavy crowd control', tags: ['Strong slow', 'Pull back', 'Area'],
    desc: 'Bends space around a point, dramatically slowing everything inside. Late upgrades drag enemies backward.',
    kind: 'aura', targeting: [],
    base: { range: 78, auraSlow: 0.5, bossSlowMult: 0.3, type: 'phys' },
    paths: [
      { name: 'SINGULARITY', ups: [
        { n: 'Dense Core', c: 360, d: 'Slow increased to 60%.', f: (s) => { s.auraSlow = Math.max(s.auraSlow, 0.6); } },
        { n: 'Crush Field', c: 820, d: 'Crushes enemies inside for 14 dmg/s (ignores armor).', f: (s) => { s.auraDot += 14; } },
        { n: 'Tidal Force', c: 2050, d: 'Every 2.5s, pulls enemies inside back 18px.', f: (s) => { s.pullEvery = 2.5; s.pullDist = 18; } },
        { n: 'Collapse', c: 5100, d: 'Every 6s implodes for 220 damage and drags enemies back 45px.', f: (s) => { s.implodeEvery = 6; s.implodeDmg = 220; s.implodePull = 45; } },
        { n: 'Event Horizon', c: 12200, d: 'Crush x3. Unlocks EVENT HORIZON.', f: (s) => { s.auraDot *= 3; s.implodeDmg *= 2; s.ability = 'horizon'; } },
      ] },
      { name: 'FIELD', ups: [
        { n: 'Wide Field', c: 300, d: '+20% field size.', f: (s) => { s.range *= 1.2; } },
        { n: 'Dual Orbit', c: 720, d: '+15% field size, slow lingers 1s.', f: (s) => { s.range *= 1.15; s.slowLinger = Math.max(s.slowLinger, 1); } },
        { n: 'Warp Lane', c: 1650, d: 'Enemies inside take +20% damage.', f: (s) => { s.auraVuln = Math.max(s.auraVuln, 0.2); } },
        { n: 'Stasis Rings', c: 4100, d: 'Every 5s, stops everything inside for 1s (bosses 0.3s).', f: (s) => { s.freezeEvery = 5; s.freezeDur = 1; s.freezeBoss = true; } },
        { n: 'Chronostasis', c: 10200, d: '+40% field size, slow 80% (bosses 45%).', f: (s) => { s.range *= 1.4; s.auraSlow = 0.8; s.bossSlowMult = 0.56; } },
      ] },
      { name: 'DISTORTION', ups: [
        { n: 'Gravity Lens', c: 260, d: 'Ghosts inside the field are exposed to ALL towers.', f: (s) => { s.auraReveal = true; } },
        { n: 'Mass Scanner', c: 620, d: 'Armored enemies are slowed an extra 15%.', f: (s) => { s.armoredSlow = 0.15; } },
        { n: 'Shield Tear', c: 1550, d: 'Drains shields by 70/s inside.', f: (s) => { s.auraShieldStrip = 70; } },
        { n: 'Phase Anchor', c: 3600, d: 'Enemies inside cannot phase, burrow or be sped up.', f: (s) => { s.auraQuarantine = true; } },
        { n: 'Black Hole', c: 9300, d: 'Deletes non-boss enemies under 15% HP. Deals 3% max HP/s.', f: (s) => { s.blackHole = 0.15; s.auraPct = 0.03; } },
      ] },
    ],
  };

  // ─────────────────────────────── QUANTUM CANNON
  T.quantum = {
    id: 'quantum', name: 'Quantum Cannon', cost: 1800, unlockLevel: 10, color: '#e0a3ff', r: 22,
    role: 'Late-game devastation', tags: ['Expensive', 'Massive damage', 'Energy'],
    desc: 'A colossal experimental cannon that collapses probability into a single devastating blast. Needs a huge investment.',
    kind: 'quantum', targeting: ['first', 'last', 'strong', 'close', 'boss'],
    base: { dmg: 380, rate: 0.3, range: 225, splash: 70, type: 'energy', count: 1 },
    paths: [
      { name: 'ANNIHILATION', ups: [
        { n: 'Particle Focus', c: 1100, d: '+260 damage.', f: (s) => { s.dmg += 260; } },
        { n: 'Entangled Payload', c: 2600, d: 'Each blast echoes onto a second nearby enemy.', f: (s) => { s.echo = true; } },
        { n: 'Quantum Tunneling', c: 6200, d: 'Blasts bypass shields. x1.5 vs bosses.', f: (s) => { s.shieldBypass = true; s.bossMult *= 1.5; } },
        { n: 'Superposition', c: 14500, d: 'Every blast strikes twice.', f: (s) => { s.doubleHit = true; } },
        { n: 'Singularity Shot', c: 30000, d: 'x2 damage. Unlocks SINGULARITY SHOT.', f: (s) => { s.dmg *= 2; s.ability = 'singularity'; } },
      ] },
      { name: 'CYCLE', ups: [
        { n: 'Cold Fusion', c: 950, d: '+30% attack speed.', f: (s) => { s.rate *= 1.3; } },
        { n: 'Qubit Stack', c: 2300, d: '+40% attack speed.', f: (s) => { s.rate *= 1.4; } },
        { n: 'Parallel Universes', c: 5700, d: 'Fires 2 blasts at different targets.', f: (s) => { s.count = Math.max(s.count, 2); } },
        { n: 'Infinite Loop', c: 12500, d: '+60% attack speed.', f: (s) => { s.rate *= 1.6; } },
        { n: 'Many-Worlds', c: 27000, d: 'Fires 4 blasts, +30% attack speed.', f: (s) => { s.count = 4; s.rate *= 1.3; } },
      ] },
      { name: 'FIELD', ups: [
        { n: 'Wider Lens', c: 850, d: '+25% range, +20 blast radius.', f: (s) => { s.range *= 1.25; s.splash += 20; } },
        { n: 'Wave Function', c: 1900, d: 'Detects stealth. Blasts slow by 40% for 2s.', f: (s) => { s.detect = true; s.slow = Math.max(s.slow, 0.4); s.slowDur = 2; } },
        { n: 'Decoherence', c: 4600, d: 'Blasts leave an unstable field dealing 110 dmg/s for 3s.', f: (s) => { s.field = 110; s.fieldDur = 3; } },
        { n: 'Observer Effect', c: 10200, d: 'Hit enemies take +25% damage for 4s.', f: (s) => { s.vuln = Math.max(s.vuln, 0.25); s.vulnDur = 4; } },
        { n: 'Reality Tear', c: 24500, d: 'x2.5 blast radius, fields x3.', f: (s) => { s.splash *= 2.5; s.field *= 3; } },
      ] },
    ],
  };

  CS.TOWERS = T;
  CS.TOWER_ORDER = ['pulse', 'sniper', 'firewall', 'arc', 'missile', 'drone', 'farm', 'virus', 'rail', 'amp', 'gravity', 'quantum'];

  CS.TARGET_NAMES = { first: 'First', last: 'Last', strong: 'Strongest', weak: 'Weakest', close: 'Closest', boss: 'Boss/Elite', fast: 'Fastest' };

  // Stats template — every field any tower might read.
  CS.defaultStats = function () {
    return {
      dmg: 0, rate: 1, range: 100, type: 'phys', projSpeed: 400, projSize: 3, projColor: null, pierce: 1, armorPen: 0, detect: false,
      splash: 0, count: 1, spread: 0, chain: 0, chainRange: 0, chainFalloff: 1, crit: 0, critMult: 2, bossMult: 1, shieldMult: 1,
      knock: 0, burn: 0, burnDur: 0, slow: 0, slowDur: 0, stun: 0, shred: 0, vuln: 0, vulnDur: 0, execute: 0, shrapnel: 0, shrapnelMult: 0,
      markOnCrit: 0, netPulse: false, spotter: 0, spotRange: 0, reveal: false, eliteSpotter: false, income: 0,
      auraSlow: 0, auraDot: 0, auraLinger: 0, auraShred: 0, auraPulseEvery: 0, auraPulseDmg: 0, auraVuln: 0, freezeEvery: 0, freezeDur: 0, freezeBoss: false,
      slowLinger: 0, auraReveal: false, auraShieldStrip: 0, auraQuarantine: false, auraPct: 0, auraStripElite: false, bossSlowMult: 0.4,
      pullEvery: 0, pullDist: 0, implodeEvery: 0, implodeDmg: 0, implodePull: 0, armoredSlow: 0, blackHole: 0,
      stormEvery: 0, overload: 0, faraday: 0,
      cluster: 0, retarget: false,
      drones: 0, droneDmg: 0, droneRate: 1, droneSpeed: 200, droneSplash: 0, gunships: 0, antiFast: 0, globalLeash: false,
      virusDps: 0, virusDur: 0, virusShred: 0, virusPct: 0, virusExecute: 0, spreadOnDeath: 0, spreadEvery: 0, cloud: 0, weaken: 0, virusSlow: 0, zombie: false,
      interest: 0, interestCap: 0, supplyDiscount: 0, bounty: 0, globalBounty: 0,
      buffDmg: 0, buffRate: 0, buffRange: 0, buffArmorPen: 0, buffCrit: 0, buffDetect: false, buffProj: 0, buffCd: 0, buffPierce: 0, buffBoss: 0,
      trail: 0, overpen: 0,
      echo: false, shieldBypass: false, doubleHit: false, field: 0, fieldDur: 0,
      ability: null,
    };
  };

  // Validate an upgrade purchase against the Core Budget rule.
  CS.canTakeUpgrade = function (tiers, path) {
    const next = tiers.slice();
    next[path]++;
    if (next[path] > 5) return { ok: false, why: 'Path maxed' };
    const total = next[0] + next[1] + next[2];
    if (total > CS.UPGRADE_RULES.maxTotal) return { ok: false, why: 'Core budget full (7)' };
    let above = 0;
    for (const t of next) if (t > CS.UPGRADE_RULES.secondaryCap) above++;
    if (above > 1) return { ok: false, why: 'Only one path above tier 2' };
    return { ok: true };
  };

  // Where (if anywhere) a tower gains stealth detection or reveal
  CS.detectInfo = function (towerId) {
    const def = CS.TOWERS[towerId];
    const s0 = CS.buildStats(towerId, [0, 0, 0]);
    if (s0.detect) return 'Built-in';
    for (let p = 0; p < 3; p++) {
      for (let i = 1; i <= 5; i++) {
        const tiers = [0, 0, 0]; tiers[p] = i;
        const s = CS.buildStats(towerId, tiers);
        if (s.detect) return def.paths[p].name + ' T' + i;
        if (s.auraReveal) return def.paths[p].name + ' T' + i + ' (reveals in field)';
        if (s.buffDetect) return def.paths[p].name + ' T' + i + ' (grants to nearby)';
        if (s.eliteSpotter) return def.paths[p].name + ' T' + i;
      }
    }
    return 'None';
  };

  CS.buildStats = function (towerId, tiers) {
    const def = CS.TOWERS[towerId];
    const s = CS.defaultStats();
    Object.assign(s, def.base);
    for (let p = 0; p < 3; p++) {
      for (let i = 0; i < tiers[p]; i++) def.paths[p].ups[i].f(s);
    }
    return s;
  };
})();
