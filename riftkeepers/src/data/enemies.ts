import type { EnemyType, Variant } from '../core/types';

/** World units per brief-unit of speed. Brief speeds are "units/sec"; our world is 1280x720. */
export const SPEED_SCALE = 1.0;

export interface EnemyDef {
  id: EnemyType;
  name: string;
  hp: number;
  speed: number;
  /** Gold for killing this unit itself (children carry their own share of the budget). */
  reward: number;
  /** Total reward budget for the whole family (parent + children). Verified by tests. */
  rewardBudget: number;
  leak: number;
  radius: number;
  armor: number;
  concealed: boolean;
  fireResist: boolean;
  frostResist: boolean;
  boss: boolean;
  /** Counts as a "giant" for anti-big bonuses (brutes and bosses). */
  big: boolean;
  /** Threat rating used for Strong targeting. */
  threat: number;
  children?: { type: EnemyType; count: number; rewardEach: number };
  heal?: { pct: number; radius: number; interval: number; maxFlat: number };
  mechanic: string;
  description: string;
  firstWave: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  sproutling: {
    id: 'sproutling', name: 'Sproutling', hp: 6, speed: 45, reward: 2, rewardBudget: 2, leak: 1, radius: 12,
    armor: 0, concealed: false, fireResist: false, frostResist: false, boss: false, big: false, threat: 1,
    mechanic: 'Basic', description: 'A sprightly bulb-creature that hops out of every rift. Weak alone, dangerous in crowds.', firstWave: 1,
  },
  skitter: {
    id: 'skitter', name: 'Skitter', hp: 4, speed: 85, reward: 2, rewardBudget: 2, leak: 1, radius: 10,
    armor: 0, concealed: false, fireResist: false, frostResist: false, boss: false, big: false, threat: 2,
    mechanic: 'Fast', description: 'A six-legged rift bug that scurries nearly twice as fast as a Sproutling. Fragile.', firstWave: 6,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', hp: 28, speed: 30, reward: 5, rewardBudget: 5, leak: 3, radius: 16,
    armor: 2, concealed: false, fireResist: false, frostResist: false, boss: false, big: false, threat: 5,
    mechanic: 'Armored', description: 'A plated stone beetle. Armor reduces each physical, fire or frost hit by 2 (minimum 1).', firstWave: 10,
  },
  wisp: {
    id: 'wisp', name: 'Wisp', hp: 12, speed: 55, reward: 4, rewardBudget: 4, leak: 2, radius: 12,
    armor: 0, concealed: true, fireResist: false, frostResist: false, boss: false, big: false, threat: 4,
    mechanic: 'Concealed', description: 'A flickering spirit. Only guardians with detection can target it.', firstWave: 14,
  },
  emberkin: {
    id: 'emberkin', name: 'Emberkin', hp: 20, speed: 45, reward: 4, rewardBudget: 4, leak: 2, radius: 13,
    armor: 0, concealed: false, fireResist: true, frostResist: false, boss: false, big: false, threat: 4,
    mechanic: 'Fire resistant', description: 'A blazing imp. Takes 75% less fire damage.', firstWave: 18,
  },
  frostling: {
    id: 'frostling', name: 'Frostling', hp: 20, speed: 45, reward: 4, rewardBudget: 4, leak: 2, radius: 13,
    armor: 0, concealed: false, fireResist: false, frostResist: true, boss: false, big: false, threat: 4,
    mechanic: 'Frost resistant', description: 'A crystalline blob. Takes 75% less frost damage, half-strength slows, cannot be frozen.', firstWave: 18,
  },
  broodpod: {
    id: 'broodpod', name: 'Broodpod', hp: 36, speed: 35, reward: 2, rewardBudget: 8, leak: 4, radius: 17,
    armor: 0, concealed: false, fireResist: false, frostResist: false, boss: false, big: false, threat: 6,
    children: { type: 'sproutling', count: 3, rewardEach: 2 },
    mechanic: 'Splits', description: 'A swollen pod that bursts into three Sproutlings when defeated.', firstWave: 22,
  },
  mender: {
    id: 'mender', name: 'Mender', hp: 45, speed: 40, reward: 7, rewardBudget: 7, leak: 4, radius: 14,
    armor: 0, concealed: false, fireResist: false, frostResist: false, boss: false, big: false, threat: 8,
    heal: { pct: 0.08, radius: 95, interval: 3, maxFlat: 60 },
    mechanic: 'Healer', description: 'A mushroom shaman. Every 3s heals nearby enemies by 8% of their max health (never above full).', firstWave: 28,
  },
  brute: {
    id: 'brute', name: 'Rift Brute', hp: 240, speed: 25, reward: 9, rewardBudget: 25, leak: 10, radius: 24,
    armor: 0, concealed: false, fireResist: false, frostResist: false, boss: false, big: true, threat: 20,
    children: { type: 'skitter', count: 4, rewardEach: 4 },
    mechanic: 'Giant', description: 'A hulking horned brute. Releases four Skitters when defeated.', firstWave: 30,
  },
  colossus: {
    id: 'colossus', name: 'Rift Colossus', hp: 1200, speed: 18, reward: 100, rewardBudget: 100, leak: 30, radius: 40,
    armor: 0, concealed: false, fireResist: false, frostResist: false, boss: true, big: true, threat: 100,
    mechanic: 'Boss', description: 'A crystal titan with three phases: shields, summons, then a hardened charge. Half-strength slows; immune to freeze and stun.', firstWave: 40,
  },
};

export const ENEMY_ORDER: EnemyType[] = [
  'sproutling', 'skitter', 'bulwark', 'wisp', 'emberkin', 'frostling', 'broodpod', 'mender', 'brute', 'colossus',
];

export interface VariantDef {
  id: Variant;
  name: string;
  description: string;
}
export const VARIANTS: Record<Variant, VariantDef> = {
  concealed: { id: 'concealed', name: 'Concealed', description: 'Requires detection to be targeted.' },
  regen: { id: 'regen', name: 'Regenerating', description: 'After 2.5s without taking damage, heals 8% max health per second.' },
  shield: { id: 'shield', name: 'Shielded', description: 'A shield worth 50% of max health absorbs damage first.' },
  armored: { id: 'armored', name: 'Reinforced', description: '+2 armor.' },
};

/** Boss tuning (explicit limits and cooldowns). */
export const COLOSSUS = {
  phase2At: 0.65,
  phase3At: 0.3,
  shieldEvery: 9,
  shieldPct: 0.08,
  shieldDuration: 4,
  summonEvery: 7,
  summonTelegraph: 1.2,
  summonCount: 4,
  summonMaxAlive: 12,
  summonMaxTotal: 24,
  phase3Speed: 1.35,
  hardenEvery: 10,
  hardenDuration: 2,
  hardenTelegraph: 1,
  hardenReduction: 0.5,
  slowEffect: 0.5,
};

export const REGEN = { delay: 2.5, pctPerSec: 0.08 };
export const SHIELD_PCT = 0.5;
export const ARMOR_VARIANT = 2;
