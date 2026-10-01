/** Lyra, the Rift Scout. Levels are earned from completed waves while she is on the field. */
export const HERO = {
  id: 'lyra' as const,
  name: 'Lyra, the Rift Scout',
  cost: 450,
  radius: 18,
  description: 'A daring scout who reads the rifts. Fires homing arcane bolts and grows stronger with every wave she survives.',
  /** Cumulative XP needed to reach level index+1. */
  xpThresholds: [0, 120, 300, 540, 840, 1200, 1640, 2160, 2760, 3440],
  /** XP gained when a wave completes while Lyra is placed. */
  xpPerWave: (wave: number) => 30 + 6 * wave,
};

export interface HeroLevelStats {
  damage: number;
  interval: number;
  range: number;
  detect: boolean;
  bigMult: number;
  pulse: { damage: number; radius: number; cd: number } | null;
  anchor: { slow: number; duration: number; cd: number } | null;
}

export const HERO_LEVEL_TEXT = [
  'Arcane bolt: 3 damage every 0.7s, range 140.',
  'Range 140 → 165.',
  'Unlocks Rift Pulse: 30 arcane damage to enemies within 110 (30s cooldown).',
  'Damage 3 → 5.',
  'Detects concealed enemies.',
  'Rift Pulse: 70 damage, radius 130.',
  'Attack interval 0.7s → 0.5s.',
  'Unlocks Time Anchor: all enemies slowed 40% for 5s (bosses 20%), 60s cooldown.',
  'Double damage against bosses and Brutes.',
  'Damage 8. Rift Pulse 140 damage, radius 150, 22s. Time Anchor 55% for 7s, 50s.',
];

export function heroStats(level: number): HeroLevelStats {
  const s: HeroLevelStats = { damage: 3, interval: 0.7, range: 140, detect: false, bigMult: 1, pulse: null, anchor: null };
  if (level >= 2) s.range = 165;
  if (level >= 3) s.pulse = { damage: 30, radius: 110, cd: 30 };
  if (level >= 4) s.damage = 5;
  if (level >= 5) s.detect = true;
  if (level >= 6) s.pulse = { damage: 70, radius: 130, cd: 30 };
  if (level >= 7) s.interval = 0.5;
  if (level >= 8) s.anchor = { slow: 0.4, duration: 5, cd: 60 };
  if (level >= 9) s.bigMult = 2;
  if (level >= 10) {
    s.damage = 8;
    s.pulse = { damage: 140, radius: 150, cd: 22 };
    s.anchor = { slow: 0.55, duration: 7, cd: 50 };
  }
  return s;
}

export function heroLevelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < HERO.xpThresholds.length; i++) if (xp >= HERO.xpThresholds[i]) lvl = i + 1;
  return lvl;
}
