/**
 * Balance playtests: an automated player runs full campaigns headless.
 * Run with `npm run balance` (excluded from the default `npm test` because it takes a while).
 */
import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../src/core/types';
import { runBot, type BotPlan } from '../src/sim/bot';
import { Sim, makeConfig } from '../src/sim/sim';

const STARTER: BotPlan = {
  build: [
    { type: 'archer', paths: [0, 2] }, { type: 'archer', paths: [1, 2] }, { type: 'alchemist', paths: [0, 2] },
    { type: 'warden', paths: [1, 0] }, { type: 'archer', paths: [0, 2] }, { type: 'alchemist', paths: [2, 0] },
    { type: 'archer', paths: [1, 0] }, { type: 'warden', paths: [0, 1] }, { type: 'alchemist', paths: [0, 2] },
  ],
  repeat: { type: 'alchemist', paths: [0, 1] },
  waveDiv: 5,
};

const base = { baseCount: Number(process.env.BASE ?? 3), waveDiv: Number(process.env.DIV ?? 4), maxTowers: Number(process.env.MAXT ?? 40) };
const PLANS: Record<string, BotPlan> = {
  mixed: {
    build: [
      { type: 'archer', paths: [0, 2] }, { type: 'alchemist', paths: [0, 2] }, { type: 'archer', paths: [1, 2] },
      { type: 'warden', paths: [1, 0] }, { type: 'alchemist', paths: [2, 0] }, { type: 'storm', paths: [0, 2] },
      { type: 'lyra', paths: [0, 0] }, { type: 'beacon', paths: [0, 1] }, { type: 'archer', paths: [0, 2] },
      { type: 'alchemist', paths: [0, 2] }, { type: 'storm', paths: [1, 2] }, { type: 'warden', paths: [0, 1] },
    ],
    repeat: { type: 'alchemist', paths: [0, 1] }, ...base,
  },
  splash: {
    build: [
      { type: 'archer', paths: [2, 0] }, { type: 'alchemist', paths: [0, 2] }, { type: 'alchemist', paths: [2, 0] },
      { type: 'archer', paths: [0, 2] }, { type: 'warden', paths: [1, 0] }, { type: 'alchemist', paths: [0, 1] },
      { type: 'lyra', paths: [0, 0] }, { type: 'storm', paths: [0, 2] }, { type: 'beacon', paths: [0, 1] },
      { type: 'alchemist', paths: [0, 2] }, { type: 'storm', paths: [0, 2] },
    ],
    repeat: { type: 'alchemist', paths: [0, 2] }, ...base,
  },
  eco: {
    build: [
      { type: 'archer', paths: [0, 2] }, { type: 'alchemist', paths: [0, 2] }, { type: 'archer', paths: [1, 2] },
      { type: 'orchard', paths: [0, 2], fromWave: 6 }, { type: 'warden', paths: [1, 0] }, { type: 'alchemist', paths: [2, 0] },
      { type: 'storm', paths: [0, 2] }, { type: 'lyra', paths: [0, 0] }, { type: 'beacon', paths: [0, 1] },
      { type: 'archer', paths: [0, 2] }, { type: 'storm', paths: [1, 2] }, { type: 'alchemist', paths: [0, 2] },
    ],
    repeat: { type: 'alchemist', paths: [0, 1] }, ...base,
  },
};

function play(mapId: string, d: Difficulty, plan: BotPlan, allowed?: string[]) {
  const sim = new Sim(makeConfig({ mapId, difficulty: d, seed: 1234, ...(allowed ? { allowedTowers: allowed as any, heroAllowed: allowed.includes('lyra') } : {}) }));
  const t0 = Date.now();
  const r = runBot(sim, plan);
  return { ...r, ms: Date.now() - t0 };
}

describe('balance playtests', () => {
  it('easy is winnable with starter towers', () => {
    for (const m of ['meadow', 'ruins', 'twinroot']) {
      const r = play(m, 'easy', STARTER, ['archer', 'alchemist', 'warden']);
      console.log(`${m} easy starter: ${r.outcome} wave ${r.wave} lives ${r.lives} ${r.history}`);
      expect(r.outcome).toBe('victory');
    }
  }, 300000);

  it('reports full-roster results on every map and difficulty', () => {
    const maps = (process.env.MAPS ?? 'meadow,ruins,twinroot,frostglass,market,citadel').split(',');
    const diffs = (process.env.DIFFS ?? 'easy,normal,hard').split(',') as Difficulty[];
    for (const m of maps)
      for (const d of diffs) {
        let best: ReturnType<typeof play> & { plan?: string } = null as any;
        for (const [name, plan] of Object.entries(PLANS)) {
          const r = play(m, d, plan);
          if (!best || r.wave > best.wave || (r.wave === best.wave && r.lives > best.lives)) best = { ...r, plan: name };
        }
        const r = best;
        console.log(`${m} ${d}: ${r.outcome} wave ${r.wave} lives ${r.lives} earned ${r.goldEarned} plan ${r.plan} ${r.towers.join(' ')}\n    ${r.history}`);
      }
  }, 1800000);
});
