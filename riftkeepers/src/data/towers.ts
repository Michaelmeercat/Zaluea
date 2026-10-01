import type { AbilityId, DamageType, TowerType } from '../core/types';

export type AttackKind = 'arrow' | 'flask' | 'shard' | 'spark' | 'bolt' | 'none';

/** Support effects a Sun Beacon (or Winter Field) grants to towers in range. Identical categories never stack: strongest wins. */
export interface SupportStats {
  atkSpeed: number; // +fraction attack speed
  dmgPct: number; // +fraction damage
  rangePct: number; // +fraction range
  detect: boolean;
  armorPierce: number; // armor ignored per hit
  resistPierce: number; // 0..1 fraction of resistance penalty removed
  discount: number; // fraction off purchases/upgrades in range
  waveBonus: number; // +fraction end-of-wave reward (global, strongest beacon only)
  projSpeed: number; // +fraction projectile speed
  exposeAll: boolean; // enemies in range are exposed (targetable without detection)
}

export interface TowerStats {
  attack: AttackKind;
  damage: number;
  dmgType: DamageType;
  interval: number;
  range: number;
  projSpeed: number;
  pierce: number;
  projectiles: number;
  spread: number; // total spread in degrees
  projSize: number;
  homing: boolean;
  detect: boolean;
  armorPierce: number;
  bigMult: number; // damage multiplier vs brutes and bosses
  // splash (flasks / bursts)
  splash: number;
  splashCap: number;
  // control
  slow: number;
  slowDur: number;
  freezeEvery: number;
  freezeRadius: number;
  freezeDur: number;
  freezeDamage: number;
  freezeOnTower: boolean;
  frozenBonus: number;
  bossSlow: number; // extra slow applied to bosses / frost-resistant enemies by freeze novas
  // fire / chemistry
  burnDps: number;
  burnDur: number;
  burnSpread: number; // spread generations
  groundDur: number;
  groundRadius: number;
  groundDps: number;
  groundMax: number;
  corrodeDps: number;
  corrodeDur: number;
  shred: number;
  shredDur: number;
  secondary: number;
  secondaryPct: number;
  secondaryRadius: number;
  secondaryCap: number;
  burst: number;
  burstPct: number;
  burstCap: number;
  modes: boolean;
  // ranger
  mark: number;
  markDur: number;
  // storm
  chain: number;
  chainRange: number;
  stunEvery: number;
  stunDur: number;
  rail: boolean;
  railWidth: number;
  // winter field
  auraSlow: number;
  exposeEvery: number;
  exposeDur: number;
  // devices
  droneMax: number;
  droneDmg: number;
  droneInterval: number;
  droneLife: number;
  droneEvery: number;
  droneRange: number;
  // support (beacon / winter field)
  support: SupportStats;
  supportRange: number;
  // economy
  income: number;
  bank: boolean;
  bankBonus: number;
  bankCap: number;
  interest: number;
  bankButton: boolean;
  harvest: boolean;
  harvestBonus: number;
  autoCollect: number;
  harvestCharges: number;
  harvestPct: number;
  // active ability
  ability: AbilityId | null;
  abilityCd: number;
}

export const emptySupport = (): SupportStats => ({
  atkSpeed: 0, dmgPct: 0, rangePct: 0, detect: false, armorPierce: 0, resistPierce: 0,
  discount: 0, waveBonus: 0, projSpeed: 0, exposeAll: false,
});

export const defaultStats = (): TowerStats => ({
  attack: 'none', damage: 0, dmgType: 'physical', interval: 1, range: 0, projSpeed: 600, pierce: 1, projectiles: 1,
  spread: 0, projSize: 1, homing: false, detect: false, armorPierce: 0, bigMult: 1,
  splash: 0, splashCap: 0, slow: 0, slowDur: 0, freezeEvery: 0, freezeRadius: 0, freezeDur: 0, freezeDamage: 0,
  freezeOnTower: false, frozenBonus: 0, bossSlow: 0,
  burnDps: 0, burnDur: 0, burnSpread: 0, groundDur: 0, groundRadius: 0, groundDps: 0, groundMax: 0,
  corrodeDps: 0, corrodeDur: 0, shred: 0, shredDur: 0, secondary: 0, secondaryPct: 0, secondaryRadius: 0, secondaryCap: 0,
  burst: 0, burstPct: 0, burstCap: 0, modes: false, mark: 0, markDur: 0,
  chain: 0, chainRange: 0, stunEvery: 0, stunDur: 0, rail: false, railWidth: 0,
  auraSlow: 0, exposeEvery: 0, exposeDur: 0,
  droneMax: 0, droneDmg: 0, droneInterval: 0, droneLife: 0, droneEvery: 0, droneRange: 0,
  support: emptySupport(), supportRange: 0,
  income: 0, bank: false, bankBonus: 0, bankCap: 0, interest: 0, bankButton: false,
  harvest: false, harvestBonus: 0, autoCollect: 0, harvestCharges: 0, harvestPct: 0,
  ability: null, abilityCd: 0,
});

type NumKeys = { [K in keyof TowerStats]: TowerStats[K] extends number ? K : never }[keyof TowerStats];
type SupNumKeys = { [K in keyof SupportStats]: SupportStats[K] extends number ? K : never }[keyof SupportStats];

export interface UpgradeDef {
  name: string;
  /** Player-facing description with exact numbers. */
  desc: string;
  /** Explicit price override (base cost × tier multiplier otherwise). */
  cost?: number;
  add?: Partial<Record<NumKeys, number>>;
  mul?: Partial<Record<NumKeys, number>>;
  set?: Partial<TowerStats>;
  support?: Partial<Record<SupNumKeys, number>> & { detect?: boolean; exposeAll?: boolean };
}

export interface PathDef {
  name: string;
  color: string;
  upgrades: [UpgradeDef, UpgradeDef, UpgradeDef, UpgradeDef, UpgradeDef];
}

export interface TowerDef {
  id: TowerType;
  name: string;
  role: string;
  cost: number;
  radius: number;
  description: string;
  base: Partial<TowerStats>;
  paths: [PathDef, PathDef, PathDef];
  color: string;
}

/** Upgrade price multipliers of base cost. Brief start values were 0.6/1.2/3/8/22; tiers 3-5 lowered after playtests (see BALANCE.md). */
export const TIER_MULT = [0.6, 1.2, 2.6, 6.5, 18];

export const TOWERS: Record<TowerType, TowerDef> = {
  archer: {
    id: 'archer', name: 'Thorn Archer', role: 'Affordable single-target', cost: 180, radius: 20, color: '#5fa84a',
    description: 'A nimble ranger who looses thorn-tipped arrows at the foremost enemy.',
    base: { attack: 'arrow', damage: 2, dmgType: 'physical', interval: 0.65, range: 145, projSpeed: 620, pierce: 1 },
    paths: [
      {
        name: 'Precision', color: '#e8b04a',
        upgrades: [
          { name: 'Sharpened Tips', desc: '+1 damage (2 → 3).', add: { damage: 1 } },
          { name: 'Longbow', desc: '+25% range, +20% arrow speed.', mul: { range: 1.25, projSpeed: 1.2 } },
          { name: 'Armor Breaker', desc: 'Arrows ignore all armor. +2 damage.', add: { damage: 2, armorPierce: 99 } },
          { name: 'Giant Hunter', desc: '+2 damage. Triple damage against Brutes and bosses.', add: { damage: 2 }, set: { bigMult: 3 } },
          { name: 'Worldpiercer', desc: '+14 damage, +6 pierce, 4× damage vs Brutes and bosses, very fast arrows. 20% slower draw.', add: { damage: 14, pierce: 6 }, mul: { interval: 1.2, projSpeed: 1.6 }, set: { bigMult: 4, projSize: 1.8 } },
        ],
      },
      {
        name: 'Barrage', color: '#d9644a',
        upgrades: [
          { name: 'Quick Draw', desc: '20% faster attacks.', mul: { interval: 0.8 } },
          { name: 'Twin Shot', desc: 'Fires 2 arrows with a 10° spread.', set: { projectiles: 2, spread: 10 } },
          { name: 'Fan Volley', desc: 'Fires 5 arrows in a 40° fan.', set: { projectiles: 5, spread: 40 } },
          { name: 'Relentless Quiver', desc: '40% faster volleys, +2 pierce.', mul: { interval: 0.6 }, add: { pierce: 2 } },
          { name: 'Thousand Thorns', desc: '9-arrow 60° volleys, +3 damage, +2 pierce, 30% faster.', set: { projectiles: 9, spread: 60 }, add: { damage: 3, pierce: 2 }, mul: { interval: 0.7 } },
        ],
      },
      {
        name: 'Ranger', color: '#4aa8d9',
        upgrades: [
          { name: 'Keen Eyes', desc: 'Detects concealed enemies.', set: { detect: true } },
          { name: 'Tracking Arrows', desc: 'Arrows home in and retarget if their target falls. +15% range.', set: { homing: true }, mul: { range: 1.15 } },
          { name: 'Snare Tips', desc: 'Hits slow enemies by 30% for 0.8s.', set: { slow: 0.3, slowDur: 0.8 } },
          { name: 'Marked Prey', desc: 'Struck enemies are marked for 3s and take +25% damage from all guardians.', set: { mark: 0.25, markDur: 3 } },
          { name: 'Huntmaster', desc: 'Marks deal +50% for 4s, +3 damage. Active — Focused Barrage: 4× attack speed for 5s (45s cooldown).', add: { damage: 3 }, set: { mark: 0.5, markDur: 4, ability: 'focusBarrage', abilityCd: 45 } },
        ],
      },
    ],
  },
  alchemist: {
    id: 'alchemist', name: 'Ember Alchemist', role: 'Splash and burning', cost: 420, radius: 21, color: '#e0773a',
    description: 'Hurls volatile flasks that burst into fire, hitting up to 12 enemies in an area.',
    base: { attack: 'flask', damage: 4, dmgType: 'fire', interval: 1.3, range: 125, projSpeed: 380, splash: 40, splashCap: 12 },
    paths: [
      {
        name: 'Detonation', color: '#f0b030',
        upgrades: [
          { name: 'Bigger Flasks', desc: '+30% explosion radius.', mul: { splash: 1.3 } },
          { name: 'Potent Mix', desc: '+3 explosion damage.', add: { damage: 3 } },
          { name: 'Shrapnel Salts', desc: '+2 damage. Explosions shred 2 armor for 3s. Hit cap 16.', add: { damage: 2 }, set: { shred: 2, shredDur: 3, splashCap: 16 } },
          { name: 'Chain Reaction', desc: 'Each blast triggers 3 secondary blasts on nearby enemies (50% damage, radius 32, 6 hits each).', set: { secondary: 3, secondaryPct: 0.5, secondaryRadius: 32, secondaryCap: 6 } },
          { name: 'Cataclysm Flask', desc: '+24 damage, 60% bigger blasts, hit cap 40, double damage vs giants.', add: { damage: 24 }, mul: { splash: 1.6 }, set: { splashCap: 40, bigMult: 2, projSize: 1.8 } },
        ],
      },
      {
        name: 'Wildfire', color: '#e04a2a',
        upgrades: [
          { name: 'Kindling', desc: 'Burns enemies for 2 damage/sec over 3s.', set: { burnDps: 2, burnDur: 3 } },
          { name: 'Searing Oil', desc: 'Burns deal 4 damage/sec over 5s.', set: { burnDps: 4, burnDur: 5 } },
          { name: 'Firepit', desc: 'Impacts leave burning ground (radius 35, 6 dmg/sec, 3s). Max 3 zones.', set: { groundDur: 3, groundRadius: 35, groundDps: 6, groundMax: 3 } },
          { name: 'Spreading Flames', desc: 'Burning enemies ignite one neighbour within 50 every second (up to 2 spreads per chain). Burns 6/sec.', set: { burnSpread: 2, burnDps: 6 } },
          { name: 'Eternal Pyre', desc: 'Burns 14/sec for 6s. Fire zones: radius 55, 22 dmg/sec, 8s. Max 4 zones.', set: { burnDps: 14, burnDur: 6, groundDur: 8, groundRadius: 55, groundDps: 22, groundMax: 4 } },
        ],
      },
      {
        name: 'Chemistry', color: '#7ad04a',
        upgrades: [
          { name: 'Quick Hands', desc: '20% faster throwing.', mul: { interval: 0.8 } },
          { name: 'Long Arm', desc: '+25% range.', mul: { range: 1.25 } },
          { name: 'Acid Conversion', desc: 'Flasks deal acid instead of fire: ignores armor and fire resistance. +1 damage.', set: { dmgType: 'acid' }, add: { damage: 1 } },
          { name: 'Corrosive Brew', desc: 'Acid corrodes for 8 damage/sec over 4s (ignores armor). +2 damage.', set: { corrodeDps: 8, corrodeDur: 4 }, add: { damage: 2 } },
          { name: 'Unstable Formula', desc: '+10 damage. Toggle fire (+50% damage) or acid mode. Active — Chemical Burst: 150 acid damage in radius 160 (40s cooldown).', add: { damage: 10 }, set: { modes: true, ability: 'chemBurst', abilityCd: 40 } },
        ],
      },
    ],
  },
  warden: {
    id: 'warden', name: 'Frost Warden', role: 'Slow and control', cost: 360, radius: 20, color: '#6cc6f0',
    description: 'Launches frost shards that slow enemies by 25% for 1.5s.',
    base: { attack: 'shard', damage: 1, dmgType: 'frost', interval: 0.9, range: 120, projSpeed: 520, slow: 0.25, slowDur: 1.5 },
    paths: [
      {
        name: 'Deep Freeze', color: '#a0e0ff',
        upgrades: [
          { name: 'Bitter Cold', desc: 'Slow strength 25% → 40%.', set: { slow: 0.4 } },
          { name: 'Lingering Chill', desc: 'Slows last 3s.', set: { slowDur: 3 } },
          { name: 'Flash Freeze', desc: 'Every 4s, freezes normal enemies within 60 of the target for 1s.', set: { freezeEvery: 4, freezeRadius: 60, freezeDur: 1 } },
          { name: 'Shatter', desc: 'Frozen enemies take +50% damage. Freezes every 3s, dealing 6 damage.', set: { frozenBonus: 0.5, freezeEvery: 3, freezeDamage: 6 } },
          { name: 'Absolute Winter', desc: 'Every 3s a winter nova freezes all normal enemies within 150 of the tower for 1.5s (25 damage). Bosses and frost-resistant foes are slowed 60% instead. Slow 55%.', set: { freezeOnTower: true, freezeRadius: 150, freezeDur: 1.5, freezeDamage: 25, bossSlow: 0.6, slow: 0.55 } },
        ],
      },
      {
        name: 'Ice Shards', color: '#5aa0e8',
        upgrades: [
          { name: 'Honed Ice', desc: '+2 damage.', add: { damage: 2 } },
          { name: 'Spear Shards', desc: '+2 pierce.', add: { pierce: 2 } },
          { name: 'Shard Spray', desc: 'Fires 3 shards in a 30° spread.', set: { projectiles: 3, spread: 30 } },
          { name: 'Bursting Shards', desc: 'Shards burst on impact (radius 36, 50% damage, 6 hits). +2 damage.', set: { burst: 36, burstPct: 0.5, burstCap: 6 }, add: { damage: 2 } },
          { name: 'Glacier Cannon', desc: '+18 damage, +8 pierce, huge shards, 1.5× vs giants. 10% slower.', add: { damage: 18, pierce: 8 }, mul: { interval: 1.1 }, set: { bigMult: 1.5, projSize: 2 } },
        ],
      },
      {
        name: 'Winter Field', color: '#c0a0f0',
        upgrades: [
          { name: 'Wide Frost', desc: '+20% range.', mul: { range: 1.2 } },
          { name: 'Chill Aura', desc: 'Enemies in range are slowed 15% by an aura.', set: { auraSlow: 0.15 } },
          { name: 'Crisp Air', desc: 'Guardians in range gain +25% projectile speed.', support: { projSpeed: 0.25 } },
          { name: 'Frost Exposure', desc: 'Every 3s, enemies in range are exposed for 2s: any guardian can target them.', set: { exposeEvery: 3, exposeDur: 2 } },
          { name: 'Blizzard Sanctuary', desc: 'Aura slow 30%. Guardians in range gain +15% attack speed. Active — Blizzard: slows every enemy 50% for 6s (bosses 25%), 50s cooldown.', set: { auraSlow: 0.3, ability: 'blizzard', abilityCd: 50 }, support: { atkSpeed: 0.15 } },
        ],
      },
    ],
  },
  storm: {
    id: 'storm', name: 'Storm Engineer', role: 'Chains and utility', cost: 650, radius: 21, color: '#8a7af0',
    description: 'Fires crackling arcane sparks that ignore armor and pass through 2 enemies.',
    base: { attack: 'spark', damage: 3, dmgType: 'arcane', interval: 0.8, range: 135, projSpeed: 760, pierce: 2 },
    paths: [
      {
        name: 'Chain Lightning', color: '#b0a0ff',
        upgrades: [
          { name: 'Arc Coil', desc: 'Sparks chain to 1 extra enemy within 70.', set: { chain: 1, chainRange: 70 } },
          { name: 'Overcharge', desc: '+2 arcane damage.', add: { damage: 2 } },
          { name: 'Forked Arc', desc: 'Chains to 4 enemies within 100.', set: { chain: 4, chainRange: 100 } },
          { name: 'Static Shock', desc: 'Every 4th attack stuns normal enemies it hits for 0.6s.', set: { stunEvery: 4, stunDur: 0.6 } },
          { name: 'Tempest Network', desc: '+10 damage, chains to 10 enemies (max) within 140, 20% faster.', add: { damage: 10 }, set: { chain: 10, chainRange: 140 }, mul: { interval: 0.8 } },
        ],
      },
      {
        name: 'Rail Tech', color: '#f0d050',
        upgrades: [
          { name: 'Extended Antenna', desc: '+20% range.', mul: { range: 1.2 } },
          { name: 'Magnetic Coils', desc: '+50% projectile speed, +2 damage.', mul: { projSpeed: 1.5 }, add: { damage: 2 } },
          { name: 'Rail Driver', desc: 'Attacks become an instant rail line piercing 6 enemies. 25% slower.', set: { rail: true, railWidth: 10 }, add: { pierce: 5 }, mul: { interval: 1.25 } },
          { name: 'Titan Breaker', desc: '+4 damage, triple damage vs Brutes and bosses.', add: { damage: 4 }, set: { bigMult: 3 } },
          { name: 'Rift Railgun', desc: '+70 damage, pierces 30, 4× vs giants. Fires every ~2s.', add: { damage: 70, pierce: 24 }, mul: { interval: 2 }, set: { bigMult: 4, railWidth: 18 } },
        ],
      },
      {
        name: 'Devices', color: '#50d0b0',
        upgrades: [
          { name: 'Servo Loader', desc: '20% faster attacks.', mul: { interval: 0.8 } },
          { name: 'Scanner Array', desc: 'Detects concealed enemies.', set: { detect: true } },
          { name: 'Scout Drone', desc: 'Every 20s deploys a drone (12s) that zaps for 2 arcane every 0.5s, range 90. Max 1.', set: { droneMax: 1, droneDmg: 2, droneInterval: 0.5, droneLife: 12, droneEvery: 20, droneRange: 90 } },
          { name: 'Upgraded Drones', desc: 'Drones deal 5, last 20s, deploy every 12s. Max 2.', set: { droneMax: 2, droneDmg: 5, droneLife: 20, droneEvery: 12 } },
          { name: 'Machine Swarm', desc: 'Up to 4 drones (8 dmg every 0.3s, 30s, every 6s). Active — Overdrive: this tower and its drones attack 2× faster for 8s (45s cooldown).', set: { droneMax: 4, droneDmg: 8, droneInterval: 0.3, droneLife: 30, droneEvery: 6, ability: 'overdrive', abilityCd: 45 } },
        ],
      },
    ],
  },
  beacon: {
    id: 'beacon', name: 'Sun Beacon', role: 'Support', cost: 500, radius: 20, color: '#f5c542',
    description: 'A radiant obelisk that empowers nearby guardians. Does not attack. Identical buffs never stack — the strongest applies.',
    base: { attack: 'none', range: 130, supportRange: 130 },
    paths: [
      {
        name: 'Battle Light', color: '#f08a3a',
        upgrades: [
          { name: 'Warm Glow', desc: 'Guardians in range gain +10% attack speed.', support: { atkSpeed: 0.1 } },
          { name: 'Wide Glow', desc: '+20% support range.', mul: { supportRange: 1.2, range: 1.2 } },
          { name: 'Battle Hymn', desc: 'Guardians in range deal +15% damage.', support: { dmgPct: 0.15 } },
          { name: 'Radiant Haste', desc: 'Attack speed bonus 10% → 25%.', support: { atkSpeed: 0.25 } },
          { name: 'Solar Command', desc: '+35% attack speed, +30% damage in range. Active — Solar Flare: every guardian gains +50% attack speed for 8s (60s cooldown).', support: { atkSpeed: 0.35, dmgPct: 0.3 }, set: { ability: 'solarFlare', abilityCd: 60 } },
        ],
      },
      {
        name: 'Revealing Light', color: '#fff0a0',
        upgrades: [
          { name: 'Clear Sight', desc: 'Guardians in range gain +10% range.', support: { rangePct: 0.1 } },
          { name: 'Revealing Light', desc: 'Guardians in range detect concealed enemies.', support: { detect: true } },
          { name: 'Sunder Light', desc: 'Guardians in range ignore 1 armor per hit.', support: { armorPierce: 1 } },
          { name: 'Purifying Light', desc: 'Guardians in range halve enemy fire/frost resistance penalties.', support: { resistPierce: 0.5 } },
          { name: 'True Sight', desc: '+20% range for allies, ignore 3 armor, ignore resistances, and every enemy in range is exposed.', support: { rangePct: 0.2, armorPierce: 3, resistPierce: 1, exposeAll: true } },
        ],
      },
      {
        name: 'Prosperity', color: '#f0d060',
        upgrades: [
          { name: "Merchant's Favor", desc: 'Purchases and upgrades in range cost 5% less.', support: { discount: 0.05 } },
          { name: 'Wave Blessing', desc: 'End-of-wave reward +5% (strongest beacon only).', support: { waveBonus: 0.05 } },
          { name: 'Tithe', desc: 'Generates 60 gold per completed wave.', set: { income: 60 } },
          { name: 'Golden Hands', desc: 'Discount 10%, income 150 per wave.', support: { discount: 0.1 }, set: { income: 150 } },
          { name: 'Golden Age', desc: 'Discount 15%, wave reward +15%, income 400 per wave.', support: { discount: 0.15, waveBonus: 0.15 }, set: { income: 400 } },
        ],
      },
    ],
  },
  orchard: {
    id: 'orchard', name: 'Crystal Orchard', role: 'Economy', cost: 700, radius: 24, color: '#e06ac0',
    description: 'Grows rift crystals. Pays 80 gold at the end of every completed wave.',
    base: { attack: 'none', range: 0, income: 80 },
    paths: [
      {
        name: 'Growth', color: '#70d060',
        upgrades: [
          { name: 'Rich Soil', desc: 'Income +30 (→ 110 per wave).', add: { income: 30 } },
          { name: 'Deep Roots', desc: 'Income +40 (→ 150).', add: { income: 40 } },
          { name: 'Crystal Bloom', desc: 'Income +100 (→ 250).', add: { income: 100 } },
          { name: 'Radiant Grove', desc: 'Income +250 (→ 500).', add: { income: 250 } },
          { name: 'Worldtree', desc: 'Income +900 (→ 1400).', add: { income: 900 } },
        ],
      },
      {
        name: 'Banking', color: '#e0c050',
        upgrades: [
          { name: 'Crystal Vault', desc: 'Income is deposited with a +10% bonus into a bank (capacity 800). Withdraw any time. Overflow is paid directly.', set: { bank: true, bankBonus: 0.1, bankCap: 800 } },
          { name: 'Bigger Vault', desc: 'Bank capacity 1600.', set: { bankCap: 1600 } },
          { name: 'Compound Interest', desc: 'Bank earns 8% interest each completed wave (up to capacity).', set: { interest: 0.08 } },
          { name: 'Crystal Treasury', desc: 'Capacity 4000, interest 12%.', set: { bankCap: 4000, interest: 0.12 } },
          { name: 'Rift Reserve', desc: 'Capacity 12000, interest 15%, deposit bonus 20%. Adds a quick-collect button to the ability bar.', set: { bankCap: 12000, interest: 0.15, bankBonus: 0.2, bankButton: true } },
        ],
      },
      {
        name: 'Harvest', color: '#a070f0',
        upgrades: [
          { name: 'Crystal Drops', desc: 'Income drops as 3 collectible crystals worth +15% in total. Tap to collect.', set: { harvest: true, harvestBonus: 0.15 } },
          { name: 'Lustrous Crystals', desc: 'Crystals worth +35% in total.', set: { harvestBonus: 0.35 } },
          { name: 'Auto-Gatherer', desc: 'Uncollected crystals collect themselves after 8s.', set: { autoCollect: 8 } },
          { name: 'Instant Harvest', desc: 'Once per wave, instantly harvest 40% of this orchard\'s income.', set: { harvestCharges: 1, harvestPct: 0.4, ability: 'instantHarvest', abilityCd: 1 } },
          { name: 'Overflow Orchard', desc: 'Income +200, crystals worth +80%, Instant Harvest gives 100% with 2 charges per wave.', add: { income: 200 }, set: { harvestBonus: 0.8, harvestCharges: 2, harvestPct: 1 } },
        ],
      },
    ],
  },
};

/** Unmodified (difficulty-free) upgrade price. */
export function baseUpgradeCost(type: TowerType, path: number, tier: number): number {
  const def = TOWERS[type];
  const up = def.paths[path].upgrades[tier];
  return up.cost ?? def.cost * TIER_MULT[tier];
}

/** Compute a tower's own stats from its upgrade levels. Adds, then multipliers, then sets — order independent across paths. */
export function computeStats(type: TowerType, levels: readonly number[]): TowerStats {
  const def = TOWERS[type];
  const s = defaultStats();
  Object.assign(s, def.base);
  s.support = emptySupport();
  const ups: UpgradeDef[] = [];
  for (let p = 0; p < 3; p++) for (let t = 0; t < levels[p]; t++) ups.push(def.paths[p].upgrades[t]);
  // sets first in tier order (a later tier overrides an earlier tier of the same path)
  const sorted = ups
    .map((u, i) => ({ u, i }))
    .sort((a, b) => a.i - b.i);
  for (const { u } of sorted) if (u.set) Object.assign(s, u.set);
  for (const { u } of sorted) if (u.add) for (const k in u.add) (s as any)[k] += (u.add as any)[k];
  for (const { u } of sorted) if (u.mul) for (const k in u.mul) (s as any)[k] *= (u.mul as any)[k];
  for (const { u } of sorted)
    if (u.support)
      for (const k in u.support) {
        const v = (u.support as any)[k];
        const cur = (s.support as any)[k];
        (s.support as any)[k] = typeof v === 'boolean' ? cur || v : Math.max(cur, v);
      }
  if (s.supportRange === 0 && hasAnySupport(s.support)) s.supportRange = s.range;
  return s;
}

export function hasAnySupport(sp: SupportStats): boolean {
  return (
    sp.atkSpeed > 0 || sp.dmgPct > 0 || sp.rangePct > 0 || sp.detect || sp.armorPierce > 0 || sp.resistPierce > 0 ||
    sp.discount > 0 || sp.waveBonus > 0 || sp.projSpeed > 0 || sp.exposeAll
  );
}

export type UpgradeCheck = { ok: true } | { ok: false; reason: string };

/**
 * Cross-path rules:
 * - at most two paths may have upgrades
 * - only one path may go beyond tier 2
 */
export function canUpgradePath(levels: readonly number[], path: number, maxTier = 5): UpgradeCheck {
  const cur = levels[path];
  if (cur >= 5) return { ok: false, reason: 'Path complete.' };
  if (cur >= maxTier) return { ok: false, reason: `This challenge limits upgrades to tier ${maxTier}.` };
  const used = levels.map((l, i) => (l > 0 ? i : -1)).filter((i) => i >= 0);
  if (cur === 0 && used.length >= 2) return { ok: false, reason: 'Locked: two paths are already in use.' };
  const next = cur + 1;
  if (next >= 3) {
    const other = levels.findIndex((l, i) => i !== path && l >= 3);
    if (other >= 0) return { ok: false, reason: 'Locked: another path is past tier 2 (secondary paths cap at tier 2).' };
  }
  return { ok: true };
}
