import { DIFFICULTIES, TOWER_TYPES, type Difficulty, type TowerType, type UnitType } from '../core/types';
import { MAP_BY_ID } from '../data/maps';
import { ACHIEVEMENTS, COSMETICS, TALENTS } from '../data/progression';
import type { RunSnapshot } from '../sim/sim';

export const SAVE_KEY = 'riftkeepers.save';
export const SAVE_VERSION = 2;

export interface Settings {
  music: number;
  sfx: number;
  muted: boolean;
  quality: 'low' | 'medium' | 'high';
  reducedEffects: boolean;
  confirmPlacement: 'touch' | 'always';
  autoStart: boolean;
  screenShake: boolean;
}

export type DiffRecord<T> = Partial<Record<Difficulty, T>>;

export interface ActiveRun {
  snapshot: RunSnapshot;
  savedAt: number;
  /** True when the player was mid-wave; continuing restores the start of that wave. */
  midWave: boolean;
  runId: string;
}

export interface SaveData {
  version: number;
  shards: number;
  totalShardsEarned: number;
  unlockedMaps: string[];
  talents: { gold: number; lives: number; xp: number };
  cosmetics: { owned: string[]; lyra: string; trim: boolean; prismatic: boolean };
  medals: Record<string, DiffRecord<boolean>>;
  flawless: Record<string, DiffRecord<boolean>>;
  pure: Record<string, DiffRecord<boolean>>;
  best: Record<string, DiffRecord<number>>;
  endlessBest: Record<string, DiffRecord<number>>;
  achievements: Record<string, number>;
  stats: { victories: number; defeats: number; totalKills: number; bossKills: number; runs: number };
  settings: Settings;
  daily: { claimed: string[] };
  challenges: { completed: string[] };
  tutorialDone: boolean;
  finishedRuns: string[];
  activeRun: ActiveRun | null;
}

export const defaultSettings = (): Settings => ({
  music: 0.5, sfx: 0.75, muted: false, quality: 'high', reducedEffects: false, confirmPlacement: 'touch', autoStart: false, screenShake: true,
});

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    shards: 0,
    totalShardsEarned: 0,
    unlockedMaps: ['meadow'],
    talents: { gold: 0, lives: 0, xp: 0 },
    cosmetics: { owned: ['lyra-violet'], lyra: 'violet', trim: false, prismatic: false },
    medals: {},
    flawless: {},
    pure: {},
    best: {},
    endlessBest: {},
    achievements: {},
    stats: { victories: 0, defeats: 0, totalKills: 0, bossKills: 0, runs: 0 },
    settings: defaultSettings(),
    daily: { claimed: [] },
    challenges: { completed: [] },
    tutorialDone: false,
    finishedRuns: [],
    activeRun: null,
  };
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const strArr = (v: unknown, allowed?: (s: string) => boolean): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && (!allowed || allowed(x))))] : [];

function diffRecord<T>(v: unknown, check: (x: unknown) => x is T): Record<string, DiffRecord<T>> {
  const out: Record<string, DiffRecord<T>> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [mapId, rec] of Object.entries(v as Record<string, unknown>)) {
    if (!MAP_BY_ID[mapId] || !rec || typeof rec !== 'object') continue;
    const r: DiffRecord<T> = {};
    for (const d of DIFFICULTIES) {
      const x = (rec as Record<string, unknown>)[d];
      if (check(x)) r[d] = x;
    }
    out[mapId] = r;
  }
  return out;
}
const isBool = (x: unknown): x is boolean => typeof x === 'boolean';
const isWave = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 100000;

const UNIT_TYPES: UnitType[] = [...TOWER_TYPES, 'lyra'];

/** Validate a run snapshot; returns null if anything is structurally wrong. */
export function validateSnapshot(s: unknown): RunSnapshot | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as RunSnapshot;
  try {
    if (o.v !== 1 || !o.cfg || !MAP_BY_ID[o.cfg.mapId] || !DIFFICULTIES.includes(o.cfg.difficulty)) return null;
    if (![o.gold, o.lives, o.wave, o.nextId, o.heroXp, o.tick, o.time].every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
    if (o.lives <= 0 || o.wave < 0 || o.gold < 0) return null;
    if (!Array.isArray(o.towers) || !Array.isArray(o.drops) || !Array.isArray(o.removedObstacles)) return null;
    for (const t of o.towers) {
      if (!UNIT_TYPES.includes(t.type)) return null;
      if (!Array.isArray(t.levels) || t.levels.length !== 3 || t.levels.some((l) => typeof l !== 'number' || l < 0 || l > 5)) return null;
      if (typeof t.x !== 'number' || typeof t.y !== 'number' || typeof t.invested !== 'number') return null;
      if (!['first', 'last', 'strong', 'close'].includes(t.targeting)) t.targeting = 'first';
    }
    for (const d of o.drops) if (typeof d.value !== 'number' || typeof d.x !== 'number') return null;
    if (!Array.isArray(o.cfg.allowedTowers)) return null;
    o.cfg.allowedTowers = o.cfg.allowedTowers.filter((t) => (TOWER_TYPES as string[]).includes(t)) as TowerType[];
    o.stats = { ...o.stats };
    if (!Array.isArray(o.stats.towerTypesUsed)) o.stats.towerTypesUsed = [];
    if (!Array.isArray(o.stats.soldDamage)) o.stats.soldDamage = [];
    return o;
  } catch {
    return null;
  }
}

/** Merge arbitrary (possibly old, partial or hostile) data onto safe defaults. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, any>;
  d.shards = Math.floor(num(r.shards, 0, 0, 1e7));
  d.totalShardsEarned = Math.floor(num(r.totalShardsEarned, d.shards, 0, 1e8));
  d.unlockedMaps = strArr(r.unlockedMaps, (m) => !!MAP_BY_ID[m]);
  if (!d.unlockedMaps.includes('meadow')) d.unlockedMaps.unshift('meadow');
  const tal = r.talents ?? {};
  for (const t of TALENTS) d.talents[t.id] = Math.floor(num(tal[t.id], 0, 0, t.maxRank));
  const cos = r.cosmetics ?? {};
  d.cosmetics.owned = strArr(cos.owned, (c) => COSMETICS.some((x) => x.id === c));
  if (!d.cosmetics.owned.includes('lyra-violet')) d.cosmetics.owned.push('lyra-violet');
  const lyraOk = (v: unknown) => COSMETICS.some((c) => c.kind === 'lyra' && c.value === v && d.cosmetics.owned.includes(c.id));
  d.cosmetics.lyra = lyraOk(cos.lyra) ? cos.lyra : 'violet';
  d.cosmetics.trim = bool(cos.trim, false) && d.cosmetics.owned.includes('gold-trim');
  d.cosmetics.prismatic = bool(cos.prismatic, false) && d.cosmetics.owned.includes('prismatic');
  d.medals = diffRecord(r.medals, isBool);
  d.flawless = diffRecord(r.flawless, isBool);
  d.pure = diffRecord(r.pure, isBool);
  d.best = diffRecord(r.best, isWave);
  d.endlessBest = diffRecord(r.endlessBest, isWave);
  if (r.achievements && typeof r.achievements === 'object')
    for (const a of ACHIEVEMENTS) if (typeof r.achievements[a.id] === 'number') d.achievements[a.id] = r.achievements[a.id];
  const st = r.stats ?? {};
  d.stats = {
    victories: Math.floor(num(st.victories, 0, 0)), defeats: Math.floor(num(st.defeats, 0, 0)),
    totalKills: Math.floor(num(st.totalKills, 0, 0)), bossKills: Math.floor(num(st.bossKills, 0, 0)), runs: Math.floor(num(st.runs, 0, 0)),
  };
  const s = r.settings ?? {};
  d.settings = {
    music: num(s.music, d.settings.music, 0, 1),
    sfx: num(s.sfx, d.settings.sfx, 0, 1),
    muted: bool(s.muted, false),
    quality: ['low', 'medium', 'high'].includes(s.quality) ? s.quality : 'high',
    reducedEffects: bool(s.reducedEffects, false),
    confirmPlacement: s.confirmPlacement === 'always' ? 'always' : 'touch',
    autoStart: bool(s.autoStart, false),
    screenShake: bool(s.screenShake, true),
  };
  d.daily.claimed = strArr(r.daily?.claimed, (x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-400);
  d.challenges.completed = strArr(r.challenges?.completed);
  d.tutorialDone = bool(r.tutorialDone, false);
  d.finishedRuns = strArr(r.finishedRuns).slice(-200);
  if (r.activeRun && typeof r.activeRun === 'object') {
    const snap = validateSnapshot(r.activeRun.snapshot);
    if (snap && typeof r.activeRun.runId === 'string' && !d.finishedRuns.includes(r.activeRun.runId))
      d.activeRun = { snapshot: snap, savedAt: num(r.activeRun.savedAt, Date.now()), midWave: bool(r.activeRun.midWave, false), runId: r.activeRun.runId };
  }
  return d;
}

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class SaveStore {
  data: SaveData;
  recoveredFromCorruption = false;
  private store: Storage | null;

  constructor(store: Storage | null = storage()) {
    this.store = store;
    this.data = this.load();
  }

  load(): SaveData {
    const raw = this.store?.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      this.recoveredFromCorruption = true;
      try {
        this.store?.setItem(SAVE_KEY + '.corrupt', raw);
      } catch { /* ignore */ }
      return defaultSave();
    }
  }

  save() {
    try {
      this.store?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or unavailable: progress stays in memory */
    }
  }

  exportString(): string {
    const json = JSON.stringify({ ...this.data, exportedAt: Date.now(), game: 'riftkeepers' });
    return btoa(unescape(encodeURIComponent(json)));
  }

  /** Validates and applies an exported save. Returns an error message on failure. */
  importString(text: string): string | null {
    let parsed: unknown;
    try {
      const t = text.trim();
      const json = t.startsWith('{') ? t : decodeURIComponent(escape(atob(t)));
      parsed = JSON.parse(json);
    } catch {
      return 'That does not look like a Riftkeepers save.';
    }
    if (!parsed || typeof parsed !== 'object' || (parsed as any).game !== 'riftkeepers') return 'That does not look like a Riftkeepers save.';
    this.data = sanitize(parsed);
    this.save();
    return null;
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }
}
