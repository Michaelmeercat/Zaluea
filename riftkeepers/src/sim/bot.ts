/**
 * Development/test-only automated player used for balance runs and verification.
 * Never wired into the player-facing UI.
 */
import type { UnitType } from '../core/types';
import { TOWERS } from '../data/towers';
import type { Tower } from './entities';
import { Sim } from './sim';

export interface Spot {
  x: number;
  y: number;
  cover: number;
}

/** Score candidate positions by how much path lies within `range`. */
export function scoreSpots(sim: Sim, type: UnitType, range: number, step = 16): Spot[] {
  const out: Spot[] = [];
  const rm = sim.map;
  for (let y = 20; y < 700; y += step)
    for (let x = 20; x < 1260; x += step) {
      if (!sim.checkPlace(type, x, y).ok) continue;
      // sqrt per path rewards spots that cover several roads (and balances separate paths)
      let cover = 0;
      for (const p of rm.paths) {
        let c = 0;
        for (let i = 0; i < p.xs.length; i += 3) {
          const d = Math.hypot(p.xs[i] - x, p.ys[i] - y);
          if (d <= range) c += 1 + (p.cum[i] / p.length) * 0.7;
        }
        cover += Math.sqrt(c) * 6;
      }
      out.push({ x, y, cover });
    }
  out.sort((a, b) => b.cover - a.cover || a.y - b.y || a.x - b.x);
  return out;
}

/** Pick the spot that best covers the least-defended path (keeps separate roads balanced). */
function balancedSpot(sim: Sim, spots: Spot[], range: number): Spot | undefined {
  const paths = sim.map.paths;
  if (paths.length < 2) return spots[0];
  const defended = paths.map((p) => {
    let c = 0;
    for (const t of sim.towers) {
      if (t.base.attack === 'none') continue;
      for (let i = 0; i < p.xs.length; i += 6) if (Math.hypot(p.xs[i] - t.x, p.ys[i] - t.y) <= sim.effRange(t)) c++;
    }
    return c;
  });
  const weakest = defended.indexOf(Math.min(...defended));
  let best: Spot | undefined, bs = -1;
  for (const s of spots.slice(0, 400)) {
    const p = paths[weakest];
    let c = 0;
    for (let i = 0; i < p.xs.length; i += 3) if (Math.hypot(p.xs[i] - s.x, p.ys[i] - s.y) <= range) c++;
    const score = c * 3 + s.cover;
    if (score > bs) { bs = score; best = s; }
  }
  return best;
}

export interface BotPlan {
  /** Ordered build list: tower type and preferred upgrade paths [primary, secondary]. */
  build: { type: UnitType; paths: [number, number]; maxTier?: number; fromWave?: number }[];
  /** Repeat this entry after the list is exhausted. */
  repeat?: { type: UnitType; paths: [number, number] };
  maxTowers?: number;
  baseCount?: number;
  waveDiv?: number;
}

export class Bot {
  idx = 0;
  lastClear = -1;
  constructor(public sim: Sim, public plan: BotPlan) {}

  placeBest(type: UnitType): Tower | undefined {
    const range = type === 'lyra' ? 160 : type === 'beacon' ? 130 : type === 'orchard' ? 60 : TOWERS[type].base.range ?? 130;
    if (type === 'beacon') {
      // put beacons next to the most guardians
      let best: { x: number; y: number; n: number } | null = null;
      for (const s of scoreSpots(this.sim, type, 120, 20).slice(0, 200)) {
        const n = this.sim.towers.filter((t) => Math.hypot(t.x - s.x, t.y - s.y) < 125).length;
        if (!best || n > best.n) best = { x: s.x, y: s.y, n };
      }
      if (!best) return;
      const r = this.sim.place(type, best.x, best.y);
      return r.ok ? this.sim.towerById(r.id!) : undefined;
    }
    const spots = type === 'orchard' ? scoreSpots(this.sim, type, 1, 24).reverse() : scoreSpots(this.sim, type, range);
    const pick = type === 'orchard' ? undefined : balancedSpot(this.sim, spots, range);
    if (pick) {
      const r = this.sim.place(type, pick.x, pick.y);
      if (r.ok) return this.sim.towerById(r.id!);
    }
    for (const s of spots.slice(0, 30)) {
      const r = this.sim.place(type, s.x, s.y);
      if (r.ok) return this.sim.towerById(r.id!);
    }
    return undefined;
  }

  /** Desired guardian count grows with the wave number; the rest of the gold goes into upgrades. */
  desiredCount(): number {
    const w = this.sim.wave + 1;
    return Math.min(this.plan.maxTowers ?? 40, (this.plan.baseCount ?? 2) + Math.floor(w / (this.plan.waveDiv ?? 4)));
  }

  /** Called between waves (and periodically mid-wave): spend gold. */
  act() {
    const sim = this.sim;
    let guard = 0;
    while (guard++ < 60) {
      const next = this.plan.build[this.idx] ?? (this.plan.repeat ? { ...this.plan.repeat, fromWave: 0 } : undefined);
      const wantMore = next && sim.towers.length < this.desiredCount() && (!next.fromWave || sim.wave + 1 >= next.fromWave);
      if (wantMore) {
        const cost = sim.towerCost(next!.type);
        if (sim.gold < cost) {
          // early on, an affordable archer beats waiting (covers a second road, etc.)
          if (sim.towers.length < 3 && next!.type !== 'archer' && sim.gold >= sim.towerCost('archer')) {
            const placed = this.placeBest('archer');
            if (placed) (placed as any).__plan = { type: 'archer', paths: [1, 2] };
            continue;
          }
          break;
        }
        const placed = this.placeBest(next!.type);
        this.idx++;
        if (placed) (placed as any).__plan = next;
        continue;
      }
      let bestUp: { t: Tower; path: number; cost: number } | null = null;
      for (const t of sim.towers) {
        if (t.type === 'lyra') continue;
        const pref = this.prefFor(t);
        // secondary path first up to its cap (cheap utility like detection), then primary
        const order: [number, number][] = [[pref.paths[1], 2], [pref.paths[0], pref.maxTier ?? 5]];
        if (t.levels[pref.paths[0]] < 2) order.reverse();
        for (const [path, max] of order) {
          if (path === pref.paths[1] && path === pref.paths[0]) continue;
          if (t.levels[path] >= max) continue;
          const c = sim.canUpgrade(t, path);
          if (c.cost !== undefined && (c.ok || c.reason === 'Not enough gold.')) {
            if (!bestUp || c.cost < bestUp.cost) bestUp = { t, path, cost: c.cost };
            break;
          }
        }
      }
      if (bestUp && sim.gold >= bestUp.cost) {
        if (!sim.upgrade(bestUp.t.id, bestUp.path).ok) break;
        continue;
      }
      // nothing affordable to upgrade: maybe add a tower beyond the desired count if upgrades are far away
      if (next && (!bestUp || bestUp.cost > sim.towerCost(next.type) * 3) && sim.gold >= sim.towerCost(next.type) && sim.towers.length < (this.plan.maxTowers ?? 40)) {
        const placed = this.placeBest(next.type);
        this.idx++;
        if (placed) (placed as any).__plan = next;
        continue;
      }
      break;
    }
    // clear removable obstacles once the defense is established (premium central spots)
    if (sim.towers.length >= 5 && !sim.waveActive && this.lastClear !== sim.wave) {
      const obs = (sim.map.def.obstacles ?? []).filter((o) => !sim.removedObstacles.has(o.id)).sort((a, b) => a.cost - b.cost)[0];
      if (obs && sim.gold >= obs.cost * 3) {
        sim.removeObstacle(obs.id);
        this.lastClear = sim.wave;
      }
    }
    sim.collectAllDrops();
    for (const t of sim.towers) if (t.bank > 0 && sim.wave % 5 === 0) sim.withdrawBank(t.id);
  }

  useAbilities() {
    for (const a of this.sim.abilities()) {
      if (!a.ready) continue;
      if (a.id === 'bank') continue;
      if (a.id === 'instantHarvest' || this.sim.enemies.length > 10 || this.sim.enemies.some((e) => e.def.boss)) this.sim.useAbility(a.towerId, a.id);
    }
  }

  prefFor(t: Tower): { paths: [number, number]; maxTier?: number } {
    return (t as any).__plan ?? { paths: [0, 1] };
  }
}

export interface RunResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  wave: number;
  lives: number;
  gold: number;
  kills: number;
  goldEarned: number;
  towers: string[];
  history: string;
}

/** Run a whole game headless. */
export function runBot(sim: Sim, plan: BotPlan, maxWave = 999): RunResult {
  sim.recordEvents = false;
  const bot = new Bot(sim, plan);
  bot.act();
  const hist: string[] = [];
  let lastLives = sim.lives;
  while (sim.state === 'playing' && sim.wave < maxWave) {
    sim.startWave();
    let ticks = 0;
    while (sim.waveActive && sim.state === 'playing' && ticks < 60 * 60 * 15) {
      sim.step();
      ticks++;
      if (ticks % 120 === 0) {
        bot.act();
        bot.useAbilities();
      }
    }
    if (ticks >= 60 * 60 * 15) return { outcome: 'timeout', wave: sim.wave, lives: sim.lives, gold: sim.gold, kills: sim.stats.kills, goldEarned: sim.stats.goldEarned, towers: [], history: hist.join(' ') };
    if (sim.lives < lastLives) hist.push(`w${sim.wave}:-${lastLives - sim.lives}`);
    lastLives = sim.lives;
    bot.act();
  }
  return {
    outcome: sim.state === 'victory' ? 'victory' : sim.state === 'defeat' ? 'defeat' : 'timeout',
    wave: sim.wave,
    lives: sim.lives,
    gold: sim.gold,
    kills: sim.stats.kills,
    goldEarned: sim.stats.goldEarned,
    towers: sim.towers.map((t) => `${t.type}[${t.levels.join('')}]`),
    history: hist.join(' ') + (sim.state === 'defeat' ? ` died@${sim.wave}` : ''),
  };
}
