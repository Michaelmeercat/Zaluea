import type { Difficulty } from '../core/types';

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  startGold: number;
  lives: number;
  finalWave: number;
  enemyHp: number;
  enemySpeed: number;
  costMult: number;
  firstClearShards: number;
  repeatShards: number;
  medal: string;
  blurb: string;
}

export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: 'easy', name: 'Easy', startGold: 800, lives: 150, finalWave: 40,
    enemyHp: 0.85, enemySpeed: 0.9, costMult: 0.9,
    firstClearShards: 100, repeatShards: 25, medal: 'Bronze',
    blurb: 'A welcoming flight. 40 waves, cheaper guardians.',
  },
  normal: {
    id: 'normal', name: 'Normal', startGold: 650, lives: 100, finalWave: 60,
    enemyHp: 1, enemySpeed: 1, costMult: 1,
    firstClearShards: 180, repeatShards: 45, medal: 'Silver',
    blurb: 'Plan ahead. 60 waves including two Colossus encounters.',
  },
  hard: {
    id: 'hard', name: 'Hard', startGold: 600, lives: 75, finalWave: 80,
    enemyHp: 1.2, enemySpeed: 1.08, costMult: 1.1,
    firstClearShards: 300, repeatShards: 75, medal: 'Gold',
    blurb: 'For seasoned keepers. 80 waves, tougher and faster foes.',
  },
};

/** Health scaling by wave (applied on top of difficulty). Endless adds a gentle compounding factor. */
export function waveHealthScale(wave: number, finalWave: number): number {
  let s = 1 + 0.025 * Math.max(0, wave - 10);
  if (wave > finalWave) s *= Math.pow(1.045, wave - finalWave);
  return s;
}

/** Endless speed bonus, carefully capped. */
export function endlessSpeedScale(wave: number, finalWave: number): number {
  if (wave <= finalWave) return 1;
  return Math.min(1.25, 1 + 0.008 * (wave - finalWave));
}

export const endOfWaveGold = (wave: number) => 40 + 4 * wave;
