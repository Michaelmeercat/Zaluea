import type { AbilityId, DamageType, Difficulty, EnemyType, RunMode, TargetMode, TowerType, UnitType, Variant } from '../core/types';
import type { EnemyDef } from '../data/enemies';
import type { SupportStats, TowerStats } from '../data/towers';

export interface Slow {
  key: string;
  amt: number;
  t: number;
}

export interface BossState {
  phase: 1 | 2 | 3;
  shieldCd: number;
  summonCd: number;
  hardenCd: number;
  hardenT: number;
  tempShield: number;
  tempShieldT: number;
  telegraph: '' | 'shield' | 'summon' | 'harden';
  telegraphT: number;
  summonsAlive: number;
  summonsTotal: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  def: EnemyDef;
  path: number;
  dist: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  armor: number;
  concealed: boolean;
  regen: boolean;
  variants: Variant[];
  speed: number;
  reward: number;
  rewardMult: number;
  hpScale: number;
  alive: boolean;
  slows: Slow[];
  freezeT: number;
  stunT: number;
  ccImmuneT: number;
  frozenBonus: number;
  burnDps: number;
  burnT: number;
  burnGen: number;
  burnSrc: number;
  burnSpreadCd: number;
  corrodeDps: number;
  corrodeT: number;
  corrodeSrc: number;
  shredAmt: number;
  shredT: number;
  markAmt: number;
  markT: number;
  exposedT: number;
  sinceHit: number;
  healCd: number;
  boss: BossState | null;
  parentBoss: number;
  flashT: number;
  anim: number;
}

export interface Tower {
  id: number;
  type: UnitType;
  x: number;
  y: number;
  radius: number;
  levels: [number, number, number];
  invested: number;
  targeting: TargetMode;
  base: TowerStats;
  /** Support buffs this tower currently receives (strongest per category). */
  buffs: SupportStats;
  cd: number;
  angle: number;
  attackAnim: number;
  placedAt: number;
  damageDealt: number;
  kills: number;
  attackCount: number;
  freezeCd: number;
  exposeCd: number;
  droneCd: number;
  abilityCd: number;
  abilityT: number;
  mode: 'fire' | 'acid';
  bank: number;
  harvestCharges: number;
  pulseCd: number;
  anchorCd: number;
}

export type ProjKind = 'arrow' | 'flask' | 'shard' | 'spark' | 'bolt';

export interface Projectile {
  id: number;
  kind: ProjKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  life: number;
  owner: number;
  stats: TowerStats;
  dmg: number;
  dmgType: DamageType;
  pierce: number;
  hit: number[];
  target: number;
  homing: boolean;
  tx: number;
  ty: number;
  radius: number;
  detect: boolean;
  armorPierce: number;
  resistPierce: number;
  stun: boolean;
  size: number;
  alive: boolean;
  /** Flask flight progress 0..1 (for arc rendering). */
  flight: number;
  flightTotal: number;
  sx: number;
  sy: number;
}

export interface GroundZone {
  id: number;
  owner: number;
  x: number;
  y: number;
  r: number;
  dps: number;
  t: number;
  max: number;
  burnDps: number;
  burnDur: number;
}

export interface Drone {
  id: number;
  owner: number;
  x: number;
  y: number;
  ang: number;
  life: number;
  cd: number;
  orbit: number;
}

export interface Drop {
  id: number;
  owner: number;
  x: number;
  y: number;
  value: number;
  age: number;
  auto: number;
}

export interface SpawnEntry {
  time: number;
  type: EnemyType;
  path: number;
  flags: Variant[];
  hp: number;
  reward: number;
}

export interface RunConfig {
  mapId: string;
  difficulty: Difficulty;
  mode: RunMode;
  seed: number;
  startGold: number;
  lives: number;
  finalWave: number;
  allowedTowers: TowerType[];
  heroAllowed: boolean;
  maxTowers: number;
  maxTier: number;
  noSelling: boolean;
  hpMult: number;
  speedMult: number;
  costMult: number;
  heroXpMult: number;
  endless: boolean;
  sandbox: boolean;
  challengeId?: string;
  dailyDate?: string;
  bonusesDisabled: boolean;
  startWave?: number;
  label?: string;
}

export interface RunStats {
  kills: number;
  goldEarned: number;
  leaks: number;
  livesLost: number;
  bossKills: number;
  maxTier: number;
  towerTypesUsed: UnitType[];
  soldDamage: { type: UnitType; label: string; damage: number }[];
  wavesCompletedThisSession: number;
  heroMaxLevel: number;
  startWave: number;
}

export interface AbilityInfo {
  key: string;
  id: AbilityId | 'bank';
  towerId: number;
  name: string;
  cd: number;
  max: number;
  ready: boolean;
  charges?: number;
  value?: number;
}

export type SimEvent =
  | { t: 'shot'; kind: ProjKind | 'rail' | 'zap'; x: number; y: number; tx: number; ty: number; owner: number; w?: number }
  | { t: 'hit'; kind: string; x: number; y: number }
  | { t: 'boom'; kind: 'fire' | 'acid' | 'frost' | 'arcane' | 'secondary'; x: number; y: number; r: number }
  | { t: 'chain'; pts: number[] }
  | { t: 'kill'; x: number; y: number; type: EnemyType; reward: number; big: boolean }
  | { t: 'leak'; x: number; y: number; lives: number }
  | { t: 'nova'; x: number; y: number; r: number }
  | { t: 'pulse'; x: number; y: number; r: number }
  | { t: 'heal'; x: number; y: number; r: number }
  | { t: 'gold'; x: number; y: number; amount: number }
  | { t: 'place'; x: number; y: number; type: UnitType }
  | { t: 'upgrade'; x: number; y: number; tier: number }
  | { t: 'sell'; x: number; y: number }
  | { t: 'ability'; id: string; x: number; y: number }
  | { t: 'bossPhase'; phase: number; x: number; y: number }
  | { t: 'telegraph'; kind: string; x: number; y: number }
  | { t: 'summon'; x: number; y: number }
  | { t: 'shieldUp'; x: number; y: number }
  | { t: 'waveStart'; wave: number; boss: boolean }
  | { t: 'waveEnd'; wave: number; reward: number; income: number }
  | { t: 'levelUp'; level: number; x: number; y: number }
  | { t: 'victory' }
  | { t: 'defeat' }
  | { t: 'drop'; x: number; y: number }
  | { t: 'collect'; x: number; y: number; amount: number };
