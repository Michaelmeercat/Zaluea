import { Rng, hashString } from '../core/rng';
import { TOWER_TYPES, type Difficulty, type TowerType, type UnitType } from '../core/types';
import { DIFFICULTY } from '../data/difficulty';
import { MAPS, MAP_BY_ID } from '../data/maps';
import {
  ACHIEVEMENTS, CHALLENGES, COSMETICS, DAILY_FINAL_WAVE, DAILY_MODIFIERS, DAILY_REWARD, DEFEAT_MIN_WAVES, DEFEAT_SHARDS_CAP,
  DEFEAT_SHARDS_PER_WAVE, STARTER_TOWERS, TALENTS, type ChallengeDef, type DailyModifier,
} from '../data/progression';
import type { SaveData } from '../save/save';
import type { RunConfig } from '../sim/entities';
import { makeConfig, type Sim } from '../sim/sim';

export function mapsCompleted(save: SaveData): string[] {
  return MAPS.filter((m) => Object.values(save.medals[m.id] ?? {}).some(Boolean)).map((m) => m.id);
}

function anyWin(save: SaveData, diffs: Difficulty[]): boolean {
  return Object.values(save.medals).some((r) => diffs.some((d) => r[d]));
}

export function isTowerUnlocked(save: SaveData, t: UnitType): boolean {
  if (t === 'lyra') return mapsCompleted(save).length >= 3;
  if (STARTER_TOWERS.includes(t)) return true;
  if (t === 'storm') return anyWin(save, ['easy', 'normal', 'hard']);
  if (t === 'beacon') return anyWin(save, ['normal', 'hard']);
  if (t === 'orchard') return mapsCompleted(save).length >= 2;
  return false;
}

export function unlockedTowers(save: SaveData): TowerType[] {
  return TOWER_TYPES.filter((t) => isTowerUnlocked(save, t));
}

export function isMapUnlocked(save: SaveData, mapId: string): boolean {
  const m = MAP_BY_ID[mapId];
  if (!m) return false;
  if (!m.unlock) return true;
  if (save.unlockedMaps.includes(mapId)) return true;
  return save.stats.victories >= m.unlock.victories;
}

export function buyMap(save: SaveData, mapId: string): string | null {
  const m = MAP_BY_ID[mapId];
  if (!m?.unlock || isMapUnlocked(save, mapId)) return 'Already unlocked.';
  if (save.shards < m.unlock.shards) return 'Not enough Rift Shards.';
  save.shards -= m.unlock.shards;
  save.unlockedMaps.push(mapId);
  return null;
}

export function buyTalent(save: SaveData, id: 'gold' | 'lives' | 'xp'): string | null {
  const t = TALENTS.find((x) => x.id === id)!;
  const rank = save.talents[id];
  if (rank >= t.maxRank) return 'Already at maximum rank.';
  const cost = t.costs[rank];
  if (save.shards < cost) return 'Not enough Rift Shards.';
  save.shards -= cost;
  save.talents[id] = rank + 1;
  return null;
}

export function buyCosmetic(save: SaveData, id: string): string | null {
  const c = COSMETICS.find((x) => x.id === id);
  if (!c) return 'Unknown item.';
  if (save.cosmetics.owned.includes(id)) return 'Already owned.';
  if (save.shards < c.cost) return 'Not enough Rift Shards.';
  save.shards -= c.cost;
  save.cosmetics.owned.push(id);
  return null;
}

export function grantShards(save: SaveData, n: number) {
  save.shards += n;
  save.totalShardsEarned += n;
}

let runCounter = 0;
export function newRunId(): string {
  return `${Date.now().toString(36)}-${(runCounter++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Campaign config including (modest) permanent talent bonuses unless Pure mode is on. */
export function campaignConfig(save: SaveData, mapId: string, difficulty: Difficulty, pure: boolean, seed: number): RunConfig {
  const d = DIFFICULTY[difficulty];
  const t = pure ? { gold: 0, lives: 0, xp: 0 } : save.talents;
  return makeConfig({
    mapId, difficulty, mode: 'campaign', seed,
    startGold: Math.round(d.startGold * (1 + t.gold * 0.02)),
    lives: d.lives + t.lives,
    heroXpMult: 1 + t.xp * 0.01,
    allowedTowers: unlockedTowers(save),
    heroAllowed: isTowerUnlocked(save, 'lyra'),
    bonusesDisabled: pure,
  });
}

export function challengeConfig(save: SaveData, ch: ChallengeDef, seed: number): RunConfig {
  let allowed = unlockedTowers(save);
  if (ch.allowedTowers) allowed = ch.allowedTowers.slice();
  if (ch.bannedTowers) allowed = allowed.filter((t) => !ch.bannedTowers!.includes(t));
  return makeConfig({
    mapId: ch.mapId, difficulty: ch.difficulty, mode: 'challenge', seed, challengeId: ch.id, finalWave: ch.finalWave,
    allowedTowers: allowed, heroAllowed: ch.heroAllowed !== false && isTowerUnlocked(save, 'lyra'),
    maxTowers: ch.maxTowers ?? 0, maxTier: ch.maxTier ?? 5, noSelling: !!ch.noSelling, lives: ch.lives ?? DIFFICULTY[ch.difficulty].lives,
    bonusesDisabled: true, label: ch.name,
  });
}

export function challengeAvailable(save: SaveData, ch: ChallengeDef): { ok: boolean; reason?: string } {
  if (!isMapUnlocked(save, ch.mapId)) return { ok: false, reason: `Unlock ${MAP_BY_ID[ch.mapId].name} first.` };
  return { ok: true };
}

export interface DailyInfo {
  date: string;
  mapId: string;
  towers: TowerType[];
  modifiers: DailyModifier[];
  seed: number;
}

export function localDateKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Deterministic daily challenge generated from the date. */
export function dailyInfo(date: string): DailyInfo {
  const seed = hashString('riftkeepers-daily-' + date);
  const rng = new Rng(seed);
  const mapId = MAPS[rng.int(MAPS.length)].id;
  const pool: TowerType[] = rng.shuffle([...TOWER_TYPES]);
  // always include at least one attacking tower that can detect (archer or storm) for fairness
  let towers = pool.slice(0, 3);
  if (!towers.includes('archer') && !towers.includes('storm')) towers[2] = rng.next() < 0.5 ? 'archer' : 'storm';
  if (!towers.some((t) => t !== 'beacon' && t !== 'orchard')) towers[0] = 'archer';
  towers = [...new Set(towers)];
  const mods = rng.shuffle([...DAILY_MODIFIERS]).slice(0, 2);
  return { date, mapId, towers, modifiers: mods, seed };
}

export function dailyConfig(info: DailyInfo): RunConfig {
  const d = DIFFICULTY.normal;
  const has = (id: string) => info.modifiers.some((m) => m.id === id);
  return makeConfig({
    mapId: info.mapId, difficulty: 'normal', mode: 'daily', seed: info.seed, dailyDate: info.date, finalWave: DAILY_FINAL_WAVE,
    allowedTowers: info.towers, heroAllowed: !has('nohero'),
    startGold: Math.round(d.startGold * (has('rich') ? 1.5 : 1)), lives: has('glass') ? 40 : d.lives,
    speedMult: has('swift') ? 1.12 : 1, hpMult: has('hardy') ? 1.2 : 1, maxTowers: has('limited') ? 10 : 0,
    costMult: has('thrifty') ? 0.85 : 1, bonusesDisabled: true, label: `Daily ${info.date}`,
  });
}

export function sandboxConfig(save: SaveData, mapId: string): RunConfig {
  return makeConfig({
    mapId, difficulty: 'normal', mode: 'sandbox', sandbox: true, startGold: 0, lives: 9999, allowedTowers: unlockedTowers(save),
    heroAllowed: isTowerUnlocked(save, 'lyra'), bonusesDisabled: true, label: 'Sandbox',
  });
}

export interface RunReward {
  outcome: 'victory' | 'defeat';
  shards: number;
  lines: string[];
  medals: string[];
  achievements: string[];
  unlocks: string[];
  firstClear: boolean;
}

function snapshotUnlocks(save: SaveData) {
  return {
    towers: TOWER_TYPES.filter((t) => isTowerUnlocked(save, t)),
    lyra: isTowerUnlocked(save, 'lyra'),
    maps: MAPS.filter((m) => isMapUnlocked(save, m.id)).map((m) => m.id),
  };
}

/** Award achievements based on current run state; returns newly earned names. Each grants shards exactly once. */
export function checkAchievements(save: SaveData, sim: Sim | null, outcome?: 'victory' | 'defeat'): string[] {
  const got: string[] = [];
  const award = (id: string) => {
    if (save.achievements[id]) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id)!;
    save.achievements[id] = Date.now();
    grantShards(save, a.reward);
    got.push(a.name);
  };
  // sandbox never grants achievements or rewards
  if (sim && !sim.cfg.sandbox) {
    {
      for (const t of sim.stats.towerTypesUsed) award(`use-${t}`);
      if (sim.stats.maxTier >= 5) award('tier5');
      if (sim.stats.bossKills > 0) award('boss');
      if (sim.stats.heroMaxLevel >= 10) award('hero-10');
      if (sim.cfg.endless && sim.wave - sim.cfg.finalWave >= 10) award('endless-10');
      if (outcome === 'victory') {
        award('first-victory');
        if (sim.stats.leaks === 0) award('flawless');
        if (sim.stats.towerTypesUsed.filter((t) => t !== 'lyra').length <= 2) award('lean');
        if (sim.cfg.difficulty === 'hard' && sim.cfg.mode === 'campaign') award('hard-win');
        if (sim.cfg.mode === 'daily') award('daily');
        if (sim.cfg.mode === 'challenge') award('challenge');
      }
    }
  }
  if (save.stats.totalKills >= 5000) award('kills-5000');
  if (save.stats.totalKills >= 25000) award('kills-25000');
  if (mapsCompleted(save).length >= MAPS.length) award('all-maps');
  return got;
}

/**
 * Settle a finished run exactly once (guarded by runId). Endless continuation after a victory is settled
 * separately via settleEndless (records only, no repeated first-clear rewards).
 */
export function settleRun(save: SaveData, sim: Sim, runId: string, outcome: 'victory' | 'defeat'): RunReward {
  const res: RunReward = { outcome, shards: 0, lines: [], medals: [], achievements: [], unlocks: [], firstClear: false };
  if (save.finishedRuns.includes(runId) || sim.cfg.sandbox) return res;
  const before = snapshotUnlocks(save);
  const shardsBefore = save.shards;
  const cfg = sim.cfg;
  const mapId = cfg.mapId, diff = cfg.difficulty;
  const completedWaves = outcome === 'victory' ? sim.wave : sim.wave - 1;
  save.stats.runs++;
  save.stats.totalKills += sim.stats.kills;
  save.stats.bossKills += sim.stats.bossKills;

  if (cfg.mode === 'campaign' || cfg.mode === 'tutorial') {
    const best = save.best[mapId] ?? (save.best[mapId] = {});
    best[diff] = Math.max(best[diff] ?? 0, completedWaves);
  }

  if (outcome === 'victory') {
    if (cfg.mode === 'campaign' || cfg.mode === 'tutorial') {
      save.stats.victories++;
      const medals = save.medals[mapId] ?? (save.medals[mapId] = {});
      const first = !medals[diff];
      medals[diff] = true;
      const d = DIFFICULTY[diff];
      const amt = first ? d.firstClearShards : d.repeatShards;
      grantShards(save, amt);
      res.firstClear = first;
      res.lines.push(`${first ? 'First clear' : 'Victory'} — ${MAP_BY_ID[mapId].name} (${d.name}): +${amt} Shards`);
      if (first) res.medals.push(`${d.medal} medal`);
      if (sim.stats.leaks === 0) {
        const fl = save.flawless[mapId] ?? (save.flawless[mapId] = {});
        if (!fl[diff]) res.medals.push('Flawless medal');
        fl[diff] = true;
      }
      if (cfg.bonusesDisabled) {
        const pu = save.pure[mapId] ?? (save.pure[mapId] = {});
        if (!pu[diff]) res.medals.push('Pure medal (no permanent bonuses)');
        pu[diff] = true;
      }
    } else if (cfg.mode === 'challenge' && cfg.challengeId) {
      const ch = CHALLENGES.find((c) => c.id === cfg.challengeId);
      if (ch && !save.challenges.completed.includes(ch.id)) {
        save.challenges.completed.push(ch.id);
        grantShards(save, ch.reward);
        res.lines.push(`Challenge complete — ${ch.name}: +${ch.reward} Shards`);
      } else if (ch) res.lines.push(`Challenge complete — ${ch.name} (reward already claimed)`);
    } else if (cfg.mode === 'daily' && cfg.dailyDate) {
      if (!save.daily.claimed.includes(cfg.dailyDate)) {
        save.daily.claimed.push(cfg.dailyDate);
        grantShards(save, DAILY_REWARD);
        res.lines.push(`Daily Challenge ${cfg.dailyDate}: +${DAILY_REWARD} Shards`);
      } else res.lines.push(`Daily Challenge ${cfg.dailyDate} (reward already claimed today)`);
    }
  } else {
    save.stats.defeats++;
    const waves = completedWaves - (sim.stats.startWave ?? 0);
    if (waves >= DEFEAT_MIN_WAVES && (cfg.mode === 'campaign' || cfg.mode === 'tutorial')) {
      const amt = Math.min(DEFEAT_SHARDS_CAP, Math.floor(waves * DEFEAT_SHARDS_PER_WAVE));
      grantShards(save, amt);
      res.lines.push(`Consolation for surviving ${waves} waves: +${amt} Shards`);
    }
  }
  res.achievements = checkAchievements(save, sim, outcome);
  const after = snapshotUnlocks(save);
  for (const t of after.towers) if (!before.towers.includes(t)) res.unlocks.push(`New guardian: ${towerName(t)}`);
  if (after.lyra && !before.lyra) res.unlocks.push('New hero: Lyra, the Rift Scout');
  for (const m of after.maps) if (!before.maps.includes(m)) res.unlocks.push(`New map: ${MAP_BY_ID[m].name}`);
  res.shards = save.shards - shardsBefore;
  save.finishedRuns.push(runId);
  save.finishedRuns = save.finishedRuns.slice(-200);
  return res;
}

/** Endless records after a victory continuation. No first-clear rewards are repeated. */
export function settleEndless(save: SaveData, sim: Sim): string[] {
  const rec = save.endlessBest[sim.cfg.mapId] ?? (save.endlessBest[sim.cfg.mapId] = {});
  const completed = sim.state === 'defeat' ? sim.wave - 1 : sim.wave;
  const lines: string[] = [];
  if (completed > (rec[sim.cfg.difficulty] ?? 0)) {
    rec[sim.cfg.difficulty] = completed;
    lines.push(`New endless record: wave ${completed}`);
  }
  save.stats.totalKills += 0;
  return lines;
}

const NAMES: Record<UnitType, string> = {
  archer: 'Thorn Archer', alchemist: 'Ember Alchemist', warden: 'Frost Warden', storm: 'Storm Engineer', beacon: 'Sun Beacon',
  orchard: 'Crystal Orchard', lyra: 'Lyra',
};
export const towerName = (t: UnitType) => NAMES[t];
