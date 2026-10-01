export type Difficulty = 'easy' | 'normal' | 'hard';
export type DamageType = 'physical' | 'fire' | 'frost' | 'arcane' | 'acid';
export type TargetMode = 'first' | 'last' | 'strong' | 'close';
export type TowerType = 'archer' | 'alchemist' | 'warden' | 'storm' | 'beacon' | 'orchard';
export type UnitType = TowerType | 'lyra';
export type EnemyType =
  | 'sproutling'
  | 'skitter'
  | 'bulwark'
  | 'wisp'
  | 'emberkin'
  | 'frostling'
  | 'broodpod'
  | 'mender'
  | 'brute'
  | 'colossus';
export type Variant = 'concealed' | 'regen' | 'shield' | 'armored';
export type RunMode = 'campaign' | 'daily' | 'challenge' | 'sandbox' | 'tutorial';
export type AbilityId =
  | 'focusBarrage'
  | 'chemBurst'
  | 'blizzard'
  | 'overdrive'
  | 'solarFlare'
  | 'instantHarvest'
  | 'riftPulse'
  | 'timeAnchor';

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];
export const TOWER_TYPES: TowerType[] = ['archer', 'alchemist', 'warden', 'storm', 'beacon', 'orchard'];
