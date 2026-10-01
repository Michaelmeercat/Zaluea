import type { EnemyType, Variant } from '../src/core/types';
import type { Enemy, RunConfig } from '../src/sim/entities';
import { Sim, makeConfig } from '../src/sim/sim';

export function newSim(partial: Partial<RunConfig> = {}): Sim {
  const sim = new Sim(makeConfig({ mapId: 'meadow', difficulty: 'normal', seed: 42, ...partial }));
  sim.recordEvents = false;
  return sim;
}

/** Spots on Meadow Bend known to be valid for placement. */
export const SPOTS = [
  { x: 300, y: 250 }, { x: 470, y: 220 }, { x: 320, y: 520 }, { x: 520, y: 470 }, { x: 760, y: 300 }, { x: 860, y: 450 },
  { x: 1100, y: 450 }, { x: 600, y: 120 }, { x: 150, y: 470 }, { x: 900, y: 600 },
];

export function spawn(sim: Sim, type: EnemyType, dist = 300, flags: Variant[] = [], path = 0): Enemy {
  return sim.spawnEnemy(type, path, dist, flags, 1, 1, Math.max(1, sim.wave));
}

export function stepN(sim: Sim, n: number) {
  for (let i = 0; i < n; i++) sim.step();
}

export function runWaveToEnd(sim: Sim, maxTicks = 60 * 600) {
  let t = 0;
  while (sim.waveActive && sim.state === 'playing' && t++ < maxTicks) sim.step();
}

export function hashState(sim: Sim): string {
  const parts = [
    sim.tick, sim.gold, sim.lives, sim.wave, sim.stats.kills, sim.rng.state,
    ...sim.enemies.map((e) => `${e.id}:${e.type}:${e.dist.toFixed(4)}:${e.hp.toFixed(4)}`),
    ...sim.towers.map((t) => `${t.id}:${t.damageDealt.toFixed(3)}:${t.kills}`),
    ...sim.projectiles.map((p) => `${p.id}:${p.x.toFixed(3)}:${p.y.toFixed(3)}`),
  ];
  return parts.join('|');
}

/** Find a valid placement for `type` within maxDist of (x,y), nearest first. */
export function findSpot(sim: Sim, type: Parameters<Sim['checkPlace']>[0], x: number, y: number, maxDist = 120, minDist = 0) {
  let best: { x: number; y: number; d: number } | null = null;
  for (let yy = y - maxDist; yy <= y + maxDist; yy += 6)
    for (let xx = x - maxDist; xx <= x + maxDist; xx += 6) {
      const d = Math.hypot(xx - x, yy - y);
      if (d > maxDist || d < minDist) continue;
      if (!sim.checkPlace(type, xx, yy).ok) continue;
      if (!best || d < best.d) best = { x: xx, y: yy, d };
    }
  if (!best) throw new Error(`no spot near ${x},${y}`);
  return best;
}
