import type { EnemyType, Variant } from '../core/types';
import { Rng, mixSeed } from '../core/rng';

/**
 * Authored wave schedules.
 *
 * Group syntax:  type*count/interval@start [>path] [!flags] [xHP] [$reward]
 *   type      enemy id (sprout = sproutling, brute, colossus...)
 *   count     number of enemies
 *   interval  seconds between spawns in the group
 *   start     group delay: seconds after the wave begins
 *   >path     'a' alternate across active paths (default), or an index into the active route list
 *   !flags    c = concealed, r = regenerating, s = shielded, a = reinforced armor
 *   xHP       extra health multiplier for this group
 *   $reward   reward multiplier for this group (reward budget adjustment)
 */
export interface WaveGroup {
  type: EnemyType;
  count: number;
  interval: number;
  start: number;
  path: 'alt' | number;
  flags: Variant[];
  hp: number;
  reward: number;
}

export interface WaveDef {
  wave: number;
  groups: WaveGroup[];
  boss: boolean;
  note?: string;
}

const ALIAS: Record<string, EnemyType> = {
  sprout: 'sproutling', sproutling: 'sproutling', skitter: 'skitter', bulwark: 'bulwark', wisp: 'wisp',
  ember: 'emberkin', emberkin: 'emberkin', frost: 'frostling', frostling: 'frostling', brood: 'broodpod',
  broodpod: 'broodpod', mender: 'mender', brute: 'brute', colossus: 'colossus',
};
const FLAG: Record<string, Variant> = { c: 'concealed', r: 'regen', s: 'shield', a: 'armored' };

export function parseGroup(tok: string): WaveGroup {
  const m = /^([a-z]+)\*(\d+)(?:\/([\d.]+))?@([\d.]+)((?:\s*(?:>[a\d]|![crsa]+|x[\d.]+|\$[\d.]+))*)$/.exec(tok.trim());
  if (!m) throw new Error('Bad wave group: ' + tok);
  const type = ALIAS[m[1]];
  if (!type) throw new Error('Unknown enemy: ' + m[1]);
  const g: WaveGroup = {
    type, count: +m[2], interval: m[3] ? +m[3] : 1, start: +m[4], path: 'alt', flags: [], hp: 1, reward: 1,
  };
  const rest = m[5] || '';
  for (const part of rest.match(/>[a\d]|![crsa]+|x[\d.]+|\$[\d.]+/g) || []) {
    if (part[0] === '>') g.path = part[1] === 'a' ? 'alt' : +part[1];
    else if (part[0] === '!') for (const f of part.slice(1)) g.flags.push(FLAG[f]);
    else if (part[0] === 'x') g.hp = +part.slice(1);
    else if (part[0] === '$') g.reward = +part.slice(1);
  }
  return g;
}

/** Authored waves 1-80. Groups are separated by ';'. */
export const WAVE_SCRIPT: string[] = [
  /* 1 */ 'sprout*12/1@0',
  /* 2 */ 'sprout*15/0.96@0',
  /* 3 */ 'sprout*10/0.84@0; sprout*10/0.6@11',
  /* 4 */ 'sprout*24/0.58@0',
  /* 5 */ 'sprout*17/0.41@0; sprout*14/0.63@10',
  /* 6 */ 'sprout*14/0.69@0; skitter*5/0.96@8',
  /* 7 */ 'sprout*20/0.54@0; skitter*10/0.72@4',
  /* 8 */ 'skitter*17/0.53@0; sprout*17/0.59@5',
  /* 9 */ 'sprout*38/0.36@0',
  /* 10 */ 'sprout*17/0.59@0; bulwark*3/2.5@6',
  /* 11 */ 'skitter*21/0.42@0; bulwark*3/2.67@8',
  /* 12 */ 'sprout*24/0.44@0; bulwark*3/2.5@3; skitter*8/0.5@12',
  /* 13 */ 'sprout*24/0.62@0; skitter*10/0.6@5',
  /* 14 */ 'sprout*16/0.6@0; wisp*3/1.8@6',
  /* 15 */ 'wisp*5/1.2@0; bulwark*3/2@5; sprout*19/0.44@10',
  /* 16 */ 'skitter*40/0.31@0',
  /* 17 */ 'bulwark*6/1.5@0; wisp*5/1.1@6; sprout*22/0.44@12',
  /* 18 */ 'ember*6/1.33@0; sprout*20/0.5@4',
  /* 19 */ 'frost*8/1.25@0; ember*5/1.2@5; skitter*16/0.38@10',
  /* 20 */ 'sprout*40/0.28@0; bulwark*6/1.33@6; wisp*6/1.07@10',
  /* 21 */ 'skitter*24/0.38@0; ember*5/0.96@6; frost*5/0.96@9',
  /* 22 */ 'brood*3/2.67@0; sprout*24/0.44@4',
  /* 23 */ 'brood*5/1.92@0; wisp*8/0.75@6; frost*6/0.93@10',
  /* 24 */ 'bulwark*10/1.2@0; ember*8/0.75@5; skitter*19/0.32@12',
  /* 25 */ 'sprout*56/0.19@0; brood*5/1.44@6',
  /* 26 */ 'wisp*14/0.7@0; skitter*24/0.38@6; bulwark*8/1@12',
  /* 27 */ 'brood*6/1.33@0; frost*10/0.6@6',
  /* 28 */ 'mender*2/4.5@0; sprout*32/0.38@0; bulwark*8/1@8',
  /* 29 */ 'sprout*24/0.5@0 !r; skitter*24/0.38@6 !r; mender*4/2.5@4',
  /* 30 */ 'sprout*32/0.31@0; brute*1/1@6',
  /* 31 */ 'brood*6/1.6@0; mender*3/2.5@3; wisp*10/0.7@8',
  /* 32 */ 'bulwark*12/0.8@0; frost*8/0.6@5; ember*8/0.6@10',
  /* 33 */ 'skitter*48/0.25@0',
  /* 34 */ 'sprout*20/0.6@0 !s; bulwark*8/1@6 !s; wisp*10/0.6@10',
  /* 35 */ 'brute*2/5@0; mender*3/2.5@2; skitter*24/0.35@6',
  /* 36 */ 'wisp*16/0.45@0 !r; brood*8/0.9@6; bulwark*10/0.7@12',
  /* 37 */ 'ember*12/0.6@0; frost*12/0.6@6; brute*2/4@10',
  /* 38 */ 'sprout*70/0.15@0; brood*8/0.7@8; mender*4/1.4@10',
  /* 39 */ 'brute*2/4@0; wisp*14/0.6@3 !s; bulwark*12/0.65@10 !a',
  /* 40 */ 'mender*6/2@0; sprout*40/0.3@0; colossus*1@8 x0.8; skitter*30/0.3@14',
  /* 41 */ 'brood*12/0.8@0; skitter*30/0.25@6',
  /* 42 */ 'bulwark*24/0.5@0 !a; wisp*14/0.6@6',
  /* 43 */ 'ember*20/0.4@0 !s; frost*20/0.4@6 !s',
  /* 44 */ 'brute*4/2.5@0; mender*6/1.6@2',
  /* 45 */ 'sprout*100/0.12@0 !r; brood*12/0.7@5',
  /* 46 */ 'wisp*30/0.35@0 !r; bulwark*20/0.6@6 !s; skitter*30/0.25@10',
  /* 47 */ 'skitter*60/0.18@0; frost*16/0.5@6',
  /* 48 */ 'brute*4/2.2@0 !a; mender*8/1.2@3; wisp*14/0.6@8',
  /* 49 */ 'brood*18/0.6@0 !s; ember*20/0.35@6',
  /* 50 */ 'brute*6/1.6@0; skitter*50/0.15@4; mender*6/1.5@8',
  /* 51 */ 'wisp*28/0.38@0 !s; bulwark*28/0.42@6 !a',
  /* 52 */ 'sprout*150/0.09@0 !r',
  /* 53 */ 'frost*30/0.3@0 !a; ember*30/0.3@6 !a; brute*3/2.5@10',
  /* 54 */ 'brood*30/0.4@0 !r; mender*10/1.2@4',
  /* 55 */ 'brute*5/1.6@0 !s; wisp*30/0.35@6',
  /* 56 */ 'bulwark*50/0.25@0 !s; skitter*60/0.15@8',
  /* 57 */ 'ember*30/0.35@0; frost*30/0.35@3',
  /* 58 */ 'brute*6/1.6@0 !a; mender*12/1@2; brood*8/0.8@8 !s',
  /* 59 */ 'wisp*40/0.25@0 !rs; bulwark*32/0.38@6 !a; brute*3/2@12 !c',
  /* 60 */ 'mender*8/1.88@0; skitter*60/0.16@4; colossus*1@8 x1.8 !s; brute*3/2.67@14',
  /* 61 */ 'sprout*120/0.1@0; brood*12/0.6@4',
  /* 62 */ 'brute*8/1@0 !r; wisp*40/0.25@4 !s',
  /* 63 */ 'bulwark*50/0.25@0 !as; ember*36/0.25@8',
  /* 64 */ 'frost*50/0.2@0 !s; mender*14/0.8@3; brute*3/1.5@10',
  /* 65 */ 'brood*45/0.25@0 !r; skitter*90/0.1@6',
  /* 66 */ 'wisp*45/0.3@0; bulwark*30/0.4@6',
  /* 67 */ 'brute*8/0.9@0 !s; mender*10/0.8@2',
  /* 68 */ 'ember*80/0.15@0 !a; frost*80/0.15@6 !a',
  /* 69 */ 'brute*10/1@0 !a; wisp*45/0.2@4 !rs',
  /* 70 */ 'mender*12/1@0; skitter*90/0.13@4; colossus*2/12@6 x1.4',
  /* 71 */ 'sprout*190/0.08@0 !r; brood*16/0.5@6',
  /* 72 */ 'brood*36/0.3@0 !s; bulwark*45/0.25@6 !a',
  /* 73 */ 'brute*14/0.7@0 !r; mender*16/0.7@2',
  /* 74 */ 'wisp*90/0.13@0 !s; ember*45/0.2@6 !a; frost*45/0.2@10 !a',
  /* 75 */ 'brute*10/0.8@0 !sc; skitter*110/0.08@4 !r',
  /* 76 */ 'bulwark*60/0.3@0',
  /* 77 */ 'brood*50/0.22@0 !rs; mender*22/0.6@3',
  /* 78 */ 'brute*13/0.6@0 !a; wisp*75/0.15@4 !rs',
  /* 79 */ 'ember*60/0.15@0 !s; frost*60/0.15@4 !s; brute*6/1@10 !a',
  /* 80 */ 'brute*10/1.6@0; mender*15/1.07@2; colossus*3/16@6 x1.4 !s; wisp*60/0.2@10 !r',
];

export const WAVE_NOTES: Record<number, string> = {
  13: 'Breather after the first armor wave.',
  21: 'Breather after the wave-20 spike.',
  27: 'Breather before healers arrive.',
  33: 'Pure speed check.',
  40: 'First Rift Colossus.',
  41: 'Breather after the first boss.',
  47: 'Breather.',
  52: 'Regenerating swarm.',
  57: 'Breather.',
  60: 'Elder Colossus (1.8× health) with a shield.',
  61: 'Breather.',
  66: 'Breather.',
  70: 'Twin Colossi.',
  71: 'Regenerating swarm.',
  76: 'Breather before the finale.',
  80: 'Final assault: three shielded Elder Colossi.',
};

const parsed: WaveDef[] = WAVE_SCRIPT.map((s, i) => {
  const groups = s.split(';').map(parseGroup);
  return { wave: i + 1, groups, boss: groups.some((g) => g.type === 'colossus'), note: WAVE_NOTES[i + 1] };
});

/** Deterministic endless-mode wave generator. */
export function endlessWave(wave: number, seed: number): WaveDef {
  const rng = new Rng(mixSeed(seed, wave * 7919));
  const pool: EnemyType[] = ['sproutling', 'skitter', 'bulwark', 'wisp', 'emberkin', 'frostling', 'broodpod', 'mender', 'brute'];
  const flagsPool: Variant[] = ['concealed', 'regen', 'shield', 'armored'];
  const groups: WaveGroup[] = [];
  const boss = wave % 10 === 0;
  const nGroups = 2 + rng.int(2);
  let t = 0;
  // Counts are capped so that endless never spawns unbounded objects; difficulty grows through health instead.
  for (let i = 0; i < nGroups; i++) {
    const type = rng.pick(pool);
    const base = type === 'brute' ? 12 : type === 'mender' ? 16 : type === 'broodpod' ? 40 : 80;
    const count = Math.min(base + Math.floor((wave - 60) * (type === 'brute' ? 0.4 : 1.5)), type === 'brute' ? 40 : 160);
    const flags: Variant[] = [];
    if (rng.next() < 0.5) flags.push(rng.pick(flagsPool));
    if (rng.next() < 0.25) flags.push(rng.pick(flagsPool));
    groups.push({
      type, count, interval: type === 'brute' ? 0.7 : 0.12 + rng.next() * 0.1, start: t, path: 'alt',
      flags: [...new Set(flags)], hp: 1, reward: 0.6,
    });
    t += 4 + rng.int(5);
  }
  if (boss) {
    const n = Math.min(4, 1 + Math.floor((wave - 60) / 30));
    groups.push({ type: 'colossus', count: n, interval: 12, start: 6, path: 'alt', flags: ['shield'], hp: 2.5, reward: 0.5 });
  }
  return { wave, groups, boss };
}

export function getWave(wave: number, seed: number): WaveDef {
  if (wave >= 1 && wave <= parsed.length) return parsed[wave - 1];
  return endlessWave(wave, seed);
}

export const AUTHORED_WAVES = parsed;
