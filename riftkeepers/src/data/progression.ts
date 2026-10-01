import type { Difficulty, TowerType } from '../core/types';

export interface TalentDef {
  id: 'gold' | 'lives' | 'xp';
  name: string;
  desc: (rank: number) => string;
  maxRank: number;
  costs: number[];
}

/** Permanent talents — deliberately modest. Disabled in Pure (challenge) mode. */
export const TALENTS: TalentDef[] = [
  { id: 'gold', name: 'Prepared Purse', desc: (r) => `+${r * 2}% starting gold`, maxRank: 5, costs: [40, 60, 80, 100, 120] },
  { id: 'lives', name: 'Stout Gates', desc: (r) => `+${r} starting lives`, maxRank: 5, costs: [30, 45, 60, 75, 90] },
  { id: 'xp', name: 'Rift Lore', desc: (r) => `+${r}% hero experience`, maxRank: 5, costs: [30, 45, 60, 75, 90] },
];

export interface CosmeticDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  kind: 'lyra' | 'trim' | 'trail';
  value: string;
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'lyra-violet', name: 'Rift Scout (Violet)', desc: "Lyra's classic violet cloak.", cost: 0, kind: 'lyra', value: 'violet' },
  { id: 'lyra-ember', name: 'Ember Cloak', desc: 'A warm crimson cloak for Lyra.', cost: 120, kind: 'lyra', value: 'ember' },
  { id: 'lyra-verdant', name: 'Verdant Cloak', desc: 'A forest-green cloak for Lyra.', cost: 120, kind: 'lyra', value: 'verdant' },
  { id: 'lyra-starlight', name: 'Starlight Cloak', desc: 'Midnight blue with golden trim.', cost: 200, kind: 'lyra', value: 'starlight' },
  { id: 'gold-trim', name: 'Gilded Platforms', desc: 'Golden trim on every guardian platform.', cost: 150, kind: 'trim', value: 'gold' },
  { id: 'prismatic', name: 'Prismatic Trails', desc: 'Rainbow trails on arrows, shards and sparks.', cost: 180, kind: 'trail', value: 'prismatic' },
];

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-victory', name: 'First Light', desc: 'Win any run.', reward: 30 },
  { id: 'boss', name: 'Colossus Felled', desc: 'Defeat a Rift Colossus.', reward: 30 },
  { id: 'tier5', name: 'Peak Guardian', desc: 'Purchase any tier-5 upgrade.', reward: 30 },
  { id: 'use-archer', name: 'Thorn and Bow', desc: 'Place a Thorn Archer.', reward: 5 },
  { id: 'use-alchemist', name: 'Volatile Mixtures', desc: 'Place an Ember Alchemist.', reward: 5 },
  { id: 'use-warden', name: 'Cold Front', desc: 'Place a Frost Warden.', reward: 5 },
  { id: 'use-storm', name: 'Live Wire', desc: 'Place a Storm Engineer.', reward: 10 },
  { id: 'use-beacon', name: 'Bright Idea', desc: 'Place a Sun Beacon.', reward: 10 },
  { id: 'use-orchard', name: 'Green Thumb', desc: 'Place a Crystal Orchard.', reward: 10 },
  { id: 'use-lyra', name: 'Scout Ahead', desc: 'Place Lyra, the Rift Scout.', reward: 10 },
  { id: 'flawless', name: 'Untouched Gate', desc: 'Win a run without a single leak.', reward: 60 },
  { id: 'lean', name: 'Lean Squad', desc: 'Win a run using at most two guardian types (Lyra excluded).', reward: 60 },
  { id: 'kills-5000', name: 'Rift Sweeper', desc: 'Defeat 5,000 enemies in total.', reward: 40 },
  { id: 'kills-25000', name: 'Riftbane', desc: 'Defeat 25,000 enemies in total.', reward: 80 },
  { id: 'all-maps', name: 'Keeper of All Isles', desc: 'Win on all six maps.', reward: 150 },
  { id: 'hero-10', name: "Lyra's Ascension", desc: 'Raise Lyra to level 10.', reward: 30 },
  { id: 'hard-win', name: 'Golden Guardian', desc: 'Win a run on Hard.', reward: 80 },
  { id: 'daily', name: 'Daily Devotion', desc: 'Complete a Daily Challenge.', reward: 20 },
  { id: 'endless-10', name: 'Beyond the Rift', desc: 'Clear 10 waves of Endless mode.', reward: 40 },
  { id: 'challenge', name: 'Rule Breaker', desc: 'Complete a Restricted Challenge.', reward: 30 },
];

export interface ChallengeDef {
  id: string;
  name: string;
  mapId: string;
  difficulty: Difficulty;
  finalWave: number;
  rules: string[];
  reward: number;
  allowedTowers?: TowerType[];
  bannedTowers?: TowerType[];
  maxTowers?: number;
  maxTier?: number;
  heroAllowed?: boolean;
  noSelling?: boolean;
  lives?: number;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'frugal', name: 'Frugal Keepers', mapId: 'meadow', difficulty: 'normal', finalWave: 40, rules: ['No Crystal Orchards'], reward: 80, bannedTowers: ['orchard'] },
  { id: 'tight-ranks', name: 'Tight Ranks', mapId: 'ruins', difficulty: 'easy', finalWave: 35, rules: ['At most 8 guardians (Lyra excluded)'], reward: 80, maxTowers: 8 },
  { id: 'two-disciplines', name: 'Two Disciplines', mapId: 'twinroot', difficulty: 'easy', finalWave: 35, rules: ['Only Thorn Archers and Frost Wardens', 'Lyra allowed'], reward: 90, allowedTowers: ['archer', 'warden'] },
  { id: 'fire-and-ice', name: 'Fire and Ice', mapId: 'frostglass', difficulty: 'easy', finalWave: 35, rules: ['Only Ember Alchemists and Frost Wardens', 'No hero'], reward: 100, allowedTowers: ['alchemist', 'warden'], heroAllowed: false },
  { id: 'no-peak', name: 'No Peaks', mapId: 'market', difficulty: 'normal', finalWave: 40, rules: ['Upgrades limited to tier 3'], reward: 120, maxTier: 3 },
  { id: 'iron-will', name: 'Iron Will', mapId: 'citadel', difficulty: 'easy', finalWave: 40, rules: ['Only 30 lives', 'Selling disabled'], reward: 150, lives: 30, noSelling: true },
];

export const DAILY_REWARD = 60;
export const DAILY_FINAL_WAVE = 30;

export interface DailyModifier {
  id: string;
  name: string;
  desc: string;
}
export const DAILY_MODIFIERS: DailyModifier[] = [
  { id: 'rich', name: 'Rich Start', desc: '+50% starting gold.' },
  { id: 'glass', name: 'Glass Village', desc: 'Only 40 lives.' },
  { id: 'swift', name: 'Swift Foes', desc: 'Enemies move 12% faster.' },
  { id: 'hardy', name: 'Hardy Foes', desc: 'Enemies have 20% more health.' },
  { id: 'limited', name: 'Small Garrison', desc: 'At most 10 guardians.' },
  { id: 'nohero', name: 'Solo Guardians', desc: 'Lyra is unavailable.' },
  { id: 'thrifty', name: 'Market Day', desc: 'All prices 15% lower.' },
];

/** Starter content and unlock rules (also described in the UI). */
export const STARTER_TOWERS: TowerType[] = ['archer', 'alchemist', 'warden'];
export const TOWER_UNLOCK_TEXT: Record<TowerType | 'lyra', string> = {
  archer: 'Available from the start.',
  alchemist: 'Available from the start.',
  warden: 'Available from the start.',
  storm: 'Unlocks with your first victory on Easy (or harder).',
  beacon: 'Unlocks with your first victory on Normal (or harder).',
  orchard: 'Unlocks after winning on two different maps.',
  lyra: 'Unlocks after winning on three different maps.',
};

export const DEFEAT_SHARDS_PER_WAVE = 0.6;
export const DEFEAT_SHARDS_CAP = 40;
export const DEFEAT_MIN_WAVES = 5;
