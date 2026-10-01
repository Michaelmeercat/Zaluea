import { Rng } from '../core/rng';
import { roundPrice } from '../core/math';
import type { AbilityId, DamageType, EnemyType, TargetMode, TowerType, UnitType, Variant } from '../core/types';
import { DIFFICULTY, endOfWaveGold, endlessSpeedScale, waveHealthScale } from '../data/difficulty';
import { ARMOR_VARIANT, COLOSSUS, ENEMIES, REGEN, SHIELD_PCT, SPEED_SCALE } from '../data/enemies';
import { HERO, heroLevelForXp, heroStats } from '../data/hero';
import { MAP_BY_ID, WORLD_H, WORLD_W, activeRoutes } from '../data/maps';
import {
  TOWERS, baseUpgradeCost, canUpgradePath, computeStats, defaultStats, emptySupport, hasAnySupport,
  type SupportStats, type TowerStats,
} from '../data/towers';
import { getWave, type WaveDef } from '../data/waves';
import type {
  AbilityInfo, Drone, Drop, Enemy, GroundZone, Projectile, ProjKind, RunConfig, RunStats, SimEvent, SpawnEntry, Tower,
} from './entities';
import { buildRuntimeMap, checkPlacement, type PlacementResult, type RuntimeMap } from './mapRuntime';
import { posAt } from './path';
import { SpatialGrid } from './spatial';

export const STEP = 1 / 60;
export const SELL_RATE = 0.7;
export const MAX_DISCOUNT = 0.3;
export const CC_IMMUNITY = 1.0;
export const MAX_SLOW = 0.75;
const ARMOR_TYPES: Record<DamageType, boolean> = { physical: true, fire: true, frost: true, arcane: false, acid: false };

export type SimState = 'playing' | 'victory' | 'defeat';

export interface ActionResult {
  ok: boolean;
  reason?: string;
  id?: number;
}

export interface DamageSource {
  owner: number;
  armorPierce: number;
  resistPierce: number;
  bigMult: number;
  dot?: boolean;
}

const mapCache = new Map<string, RuntimeMap>();
export function getRuntimeMap(id: string): RuntimeMap {
  let rm = mapCache.get(id);
  if (!rm) {
    rm = buildRuntimeMap(MAP_BY_ID[id]);
    mapCache.set(id, rm);
  }
  return rm;
}

export function makeConfig(partial: Partial<RunConfig> & { mapId: string; difficulty: RunConfig['difficulty'] }): RunConfig {
  const d = DIFFICULTY[partial.difficulty];
  return {
    mode: 'campaign',
    seed: 12345,
    startGold: d.startGold,
    lives: d.lives,
    finalWave: d.finalWave,
    allowedTowers: ['archer', 'alchemist', 'warden', 'storm', 'beacon', 'orchard'],
    heroAllowed: true,
    maxTowers: 0,
    maxTier: 5,
    noSelling: false,
    hpMult: 1,
    speedMult: 1,
    costMult: 1,
    heroXpMult: 1,
    endless: false,
    sandbox: false,
    bonusesDisabled: false,
    ...partial,
  };
}

export class Sim {
  cfg: RunConfig;
  map: RuntimeMap;
  rng: Rng;
  tick = 0;
  time = 0;
  gold: number;
  lives: number;
  /** Last wave that was started (0 before the first). */
  wave = 0;
  waveActive = false;
  waveTime = 0;
  state: SimState = 'playing';
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  zones: GroundZone[] = [];
  drones: Drone[] = [];
  drops: Drop[] = [];
  spawnQueue: SpawnEntry[] = [];
  spawnIdx = 0;
  removedObstacles = new Set<string>();
  heroXp = 0;
  globalSlows: { key: string; amt: number; t: number }[] = [];
  globalHasteT = 0;
  nextId = 1;
  events: SimEvent[] = [];
  recordEvents = true;
  stats: RunStats;
  pendingSpawnEffects = 0;
  goldFrac = 0;
  grid = new SpatialGrid<Enemy>(WORLD_W + 200, WORLD_H + 200, 64);
  private qbuf: Enemy[] = [];
  private qbuf2: Enemy[] = [];
  buffsDirty = true;
  currentWaveDef: WaveDef | null = null;

  constructor(cfg: RunConfig) {
    this.cfg = cfg;
    this.map = getRuntimeMap(cfg.mapId);
    this.rng = new Rng(cfg.seed);
    this.gold = cfg.startGold;
    this.lives = cfg.lives;
    if (cfg.startWave && cfg.startWave > 1) this.wave = cfg.startWave - 1;
    this.stats = {
      kills: 0, goldEarned: 0, leaks: 0, livesLost: 0, bossKills: 0, maxTier: 0, towerTypesUsed: [], soldDamage: [],
      wavesCompletedThisSession: 0, heroMaxLevel: 0, startWave: this.wave,
    };
  }

  // ---------------------------------------------------------------- helpers
  emit(e: SimEvent) {
    if (this.recordEvents) this.events.push(e);
  }
  get diff() {
    return DIFFICULTY[this.cfg.difficulty];
  }
  get finalWave() {
    return this.cfg.finalWave;
  }
  get heroLevel() {
    return heroLevelForXp(this.heroXp);
  }
  get hero(): Tower | undefined {
    return this.towers.find((t) => t.type === 'lyra');
  }
  towerById(id: number) {
    return this.towers.find((t) => t.id === id);
  }
  enemyById(id: number) {
    for (const e of this.enemies) if (e.id === id) return e;
    return undefined;
  }
  addGold(amount: number, earned = true) {
    this.goldFrac += amount;
    const whole = Math.floor(this.goldFrac + 1e-9);
    this.goldFrac -= whole;
    this.gold += whole;
    if (earned) this.stats.goldEarned += whole;
  }

  /** Discount fraction (bounded) granted by beacons covering a point. */
  discountAt(x: number, y: number): number {
    let d = 0;
    for (const t of this.towers) {
      const sp = t.base.support;
      if (sp.discount > 0 && Math.hypot(t.x - x, t.y - y) <= t.base.supportRange) d = Math.max(d, sp.discount);
    }
    return Math.min(MAX_DISCOUNT, d);
  }

  priceFor(base: number, x?: number, y?: number): number {
    if (this.cfg.sandbox) return 0;
    const disc = x === undefined ? 0 : this.discountAt(x, y!);
    return roundPrice(base * this.diff.costMult * this.cfg.costMult * (1 - disc));
  }

  towerCost(type: UnitType, x?: number, y?: number): number {
    const base = type === 'lyra' ? HERO.cost : TOWERS[type].cost;
    return this.priceFor(base, x, y);
  }

  upgradeCost(t: Tower, path: number): number {
    if (t.type === 'lyra') return 0;
    const tier = t.levels[path];
    if (tier >= 5) return 0;
    return this.priceFor(baseUpgradeCost(t.type, path, tier), t.x, t.y);
  }

  sellValue(t: Tower): number {
    return Math.floor(t.invested * SELL_RATE);
  }

  unitRadius(type: UnitType) {
    return type === 'lyra' ? HERO.radius : TOWERS[type].radius;
  }

  checkPlace(type: UnitType, x: number, y: number): PlacementResult {
    return checkPlacement(this.map, {
      x, y, r: this.unitRadius(type), towers: this.towers, removedObstacles: this.removedObstacles,
    });
  }

  canBuy(type: UnitType): ActionResult {
    if (this.state !== 'playing') return { ok: false, reason: 'The run is over.' };
    if (type === 'lyra') {
      if (!this.cfg.heroAllowed) return { ok: false, reason: 'Lyra is not available in this run.' };
      if (this.hero) return { ok: false, reason: 'Only one hero can be placed.' };
    } else if (!this.cfg.allowedTowers.includes(type)) return { ok: false, reason: 'Not available in this run.' };
    if (type !== 'lyra' && this.cfg.maxTowers > 0 && this.towers.filter((t) => t.type !== 'lyra').length >= this.cfg.maxTowers)
      return { ok: false, reason: `Tower limit reached (${this.cfg.maxTowers}).` };
    return { ok: true };
  }

  // ---------------------------------------------------------------- commands
  place(type: UnitType, x: number, y: number): ActionResult {
    const can = this.canBuy(type);
    if (!can.ok) return can;
    const pl = this.checkPlace(type, x, y);
    if (!pl.ok) return pl;
    const price = this.towerCost(type, x, y);
    if (this.gold < price) return { ok: false, reason: 'Not enough gold.' };
    this.gold -= price;
    const t: Tower = {
      id: this.nextId++, type, x, y, radius: this.unitRadius(type), levels: [0, 0, 0], invested: price, targeting: 'first',
      base: defaultStats(), buffs: emptySupport(), cd: 0.15, angle: -Math.PI / 2, attackAnim: 0, placedAt: this.time,
      damageDealt: 0, kills: 0, attackCount: 0, freezeCd: 0, exposeCd: 0, droneCd: 2, abilityCd: 0, abilityT: 0,
      mode: 'acid', bank: 0, harvestCharges: 0, pulseCd: 0, anchorCd: 0,
    };
    this.refreshStats(t);
    t.harvestCharges = t.base.harvestCharges;
    this.towers.push(t);
    if (!this.stats.towerTypesUsed.includes(type)) this.stats.towerTypesUsed.push(type);
    if (type === 'lyra') this.stats.heroMaxLevel = Math.max(this.stats.heroMaxLevel, this.heroLevel);
    this.buffsDirty = true;
    this.emit({ t: 'place', x, y, type });
    return { ok: true, id: t.id };
  }

  canUpgrade(t: Tower, path: number): ActionResult & { cost?: number } {
    if (t.type === 'lyra') return { ok: false, reason: 'Lyra levels up from completed waves.' };
    const chk = canUpgradePath(t.levels, path, this.cfg.maxTier);
    if (!chk.ok) return chk;
    if (t.levels[path] === 4) {
      const other = this.towers.find((o) => o !== t && o.type === t.type && o.levels[path] === 5);
      if (other) return { ok: false, reason: 'Only one tier-5 of this path may exist at a time.' };
    }
    const cost = this.upgradeCost(t, path);
    if (this.gold < cost) return { ok: false, reason: 'Not enough gold.', cost };
    return { ok: true, cost };
  }

  upgrade(id: number, path: number): ActionResult {
    if (this.state !== 'playing') return { ok: false, reason: 'The run is over.' };
    const t = this.towerById(id);
    if (!t) return { ok: false, reason: 'No such guardian.' };
    const chk = this.canUpgrade(t, path);
    if (!chk.ok) return chk;
    const cost = chk.cost!;
    this.gold -= cost;
    t.invested += cost;
    t.levels[path]++;
    this.refreshStats(t);
    if (path === 2 && t.type === 'orchard') t.harvestCharges = Math.max(t.harvestCharges, t.base.harvestCharges);
    this.stats.maxTier = Math.max(this.stats.maxTier, t.levels[path]);
    this.buffsDirty = true;
    this.emit({ t: 'upgrade', x: t.x, y: t.y, tier: t.levels[path] });
    return { ok: true };
  }

  sell(id: number): ActionResult {
    if (this.state !== 'playing') return { ok: false, reason: 'The run is over.' };
    if (this.cfg.noSelling) return { ok: false, reason: 'Selling is disabled in this challenge.' };
    const idx = this.towers.findIndex((t) => t.id === id);
    if (idx < 0) return { ok: false, reason: 'No such guardian.' };
    const t = this.towers[idx];
    const refund = this.cfg.sandbox ? 0 : this.sellValue(t);
    this.gold += refund;
    if (t.bank > 0) this.gold += Math.floor(t.bank);
    this.towers.splice(idx, 1);
    if (t.damageDealt > 0) this.stats.soldDamage.push({ type: t.type, label: this.unitName(t), damage: t.damageDealt });
    // remove effects that should not persist
    this.projectiles = this.projectiles.filter((p) => p.owner !== id);
    this.zones = this.zones.filter((z) => z.owner !== id);
    this.drones = this.drones.filter((d) => d.owner !== id);
    this.buffsDirty = true;
    this.emit({ t: 'sell', x: t.x, y: t.y });
    return { ok: true };
  }

  setTargeting(id: number, mode: TargetMode) {
    const t = this.towerById(id);
    if (t) t.targeting = mode;
  }

  setMode(id: number, mode: 'fire' | 'acid') {
    const t = this.towerById(id);
    if (t && t.base.modes) t.mode = mode;
  }

  removeObstacle(oid: string): ActionResult {
    const o = this.map.def.obstacles?.find((x) => x.id === oid);
    if (!o || this.removedObstacles.has(oid)) return { ok: false, reason: 'Nothing to clear.' };
    const cost = this.cfg.sandbox ? 0 : o.cost;
    if (this.gold < cost) return { ok: false, reason: 'Not enough gold.' };
    this.gold -= cost;
    this.removedObstacles.add(oid);
    this.emit({ t: 'sell', x: o.x, y: o.y });
    return { ok: true };
  }

  collectDrop(id: number): ActionResult {
    const i = this.drops.findIndex((d) => d.id === id);
    if (i < 0) return { ok: false };
    const d = this.drops[i];
    this.drops.splice(i, 1);
    this.addGold(d.value);
    this.emit({ t: 'collect', x: d.x, y: d.y, amount: d.value });
    return { ok: true };
  }

  collectAllDrops() {
    for (const d of [...this.drops]) this.collectDrop(d.id);
  }

  withdrawBank(id: number): ActionResult {
    const t = this.towerById(id);
    if (!t || t.bank <= 0) return { ok: false, reason: 'The bank is empty.' };
    const amt = Math.floor(t.bank);
    t.bank = 0;
    this.gold += amt; // already counted as earned when deposited
    this.emit({ t: 'collect', x: t.x, y: t.y, amount: amt });
    return { ok: true };
  }

  startWave(): ActionResult {
    if (this.state !== 'playing') return { ok: false, reason: 'The run is over.' };
    if (this.waveActive) return { ok: false, reason: 'A wave is already in progress.' };
    if (this.cfg.sandbox) return { ok: false, reason: 'Use the sandbox spawner.' };
    this.wave++;
    const def = getWave(this.wave, this.cfg.seed);
    this.currentWaveDef = def;
    const routes = activeRoutes(this.map.def, this.wave);
    const entries: (SpawnEntry & { order: number })[] = [];
    let alt = 0, order = 0;
    for (const g of def.groups) {
      for (let i = 0; i < g.count; i++) {
        const path = g.path === 'alt' ? routes[alt++ % routes.length] : routes[g.path % routes.length];
        entries.push({ time: g.start + i * g.interval, type: g.type, path, flags: g.flags, hp: g.hp, reward: g.reward, order: order++ });
      }
    }
    entries.sort((a, b) => a.time - b.time || a.order - b.order);
    this.spawnQueue = entries;
    this.spawnIdx = 0;
    this.waveTime = 0;
    this.waveActive = true;
    this.emit({ t: 'waveStart', wave: this.wave, boss: def.boss });
    return { ok: true };
  }

  /** Sandbox: spawn enemies directly. */
  sandboxSpawn(type: EnemyType, count: number, flags: Variant[], hpMult: number) {
    const routes = this.map.def.paths.map((_, i) => i);
    for (let i = 0; i < count; i++) {
      this.spawnQueue.push({ time: this.waveTime + i * 0.35, type, path: routes[i % routes.length], flags, hp: hpMult, reward: 0 });
    }
    this.spawnQueue.sort((a, b) => a.time - b.time);
    this.waveActive = true;
  }

  sandboxClear() {
    this.enemies.length = 0;
    this.spawnQueue.length = 0;
    this.spawnIdx = 0;
    this.projectiles.length = 0;
  }

  // ---------------------------------------------------------------- abilities
  abilities(): AbilityInfo[] {
    const out: AbilityInfo[] = [];
    const h = this.hero;
    if (h) {
      const hs = heroStats(this.heroLevel);
      if (hs.pulse) out.push({ key: 'pulse', id: 'riftPulse', towerId: h.id, name: 'Rift Pulse', cd: h.pulseCd, max: hs.pulse.cd, ready: h.pulseCd <= 0 });
      if (hs.anchor) out.push({ key: 'anchor', id: 'timeAnchor', towerId: h.id, name: 'Time Anchor', cd: h.anchorCd, max: hs.anchor.cd, ready: h.anchorCd <= 0 });
    }
    for (const t of this.towers) {
      if (t.base.ability === 'instantHarvest') {
        out.push({ key: 'harvest' + t.id, id: 'instantHarvest', towerId: t.id, name: 'Instant Harvest', cd: 0, max: 1, ready: t.harvestCharges > 0, charges: t.harvestCharges });
      } else if (t.base.ability) {
        out.push({ key: t.base.ability + t.id, id: t.base.ability, towerId: t.id, name: ABILITY_NAMES[t.base.ability], cd: t.abilityCd, max: t.base.abilityCd, ready: t.abilityCd <= 0 });
      }
      if (t.base.bankButton) out.push({ key: 'bank' + t.id, id: 'bank', towerId: t.id, name: 'Collect Reserve', cd: 0, max: 1, ready: t.bank >= 1, value: Math.floor(t.bank) });
    }
    return out;
  }

  useAbility(towerId: number, id: AbilityId | 'bank'): ActionResult {
    if (this.state !== 'playing') return { ok: false, reason: 'The run is over.' };
    const t = this.towerById(towerId);
    if (!t) return { ok: false, reason: 'Unavailable.' };
    if (id === 'bank') return this.withdrawBank(towerId);
    if (id === 'riftPulse' || id === 'timeAnchor') {
      const hs = heroStats(this.heroLevel);
      if (id === 'riftPulse') {
        if (!hs.pulse || t.pulseCd > 0) return { ok: false, reason: 'Not ready.' };
        t.pulseCd = hs.pulse.cd;
        const src: DamageSource = { owner: t.id, armorPierce: 0, resistPierce: 0, bigMult: hs.bigMult };
        for (const e of this.queryEnemies(t.x, t.y, hs.pulse.radius, this.qbuf2)) this.damage(e, hs.pulse.damage * (1 + t.buffs.dmgPct), 'arcane', src);
        this.emit({ t: 'pulse', x: t.x, y: t.y, r: hs.pulse.radius });
      } else {
        if (!hs.anchor || t.anchorCd > 0) return { ok: false, reason: 'Not ready.' };
        t.anchorCd = hs.anchor.cd;
        this.addGlobalSlow('anchor', hs.anchor.slow, hs.anchor.duration);
        this.emit({ t: 'ability', id, x: t.x, y: t.y });
      }
      return { ok: true };
    }
    if (t.base.ability !== id) return { ok: false, reason: 'Unavailable.' };
    if (id === 'instantHarvest') {
      if (t.harvestCharges <= 0) return { ok: false, reason: 'No charges left this wave.' };
      t.harvestCharges--;
      const amt = Math.round(t.base.income * t.base.harvestPct);
      this.addGold(amt);
      this.emit({ t: 'collect', x: t.x, y: t.y, amount: amt });
      return { ok: true };
    }
    if (t.abilityCd > 0) return { ok: false, reason: 'Not ready.' };
    t.abilityCd = t.base.abilityCd;
    switch (id) {
      case 'focusBarrage':
        t.abilityT = 5;
        break;
      case 'overdrive':
        t.abilityT = 8;
        break;
      case 'blizzard':
        this.addGlobalSlow('blizzard', 0.5, 6);
        break;
      case 'solarFlare':
        this.globalHasteT = 8;
        this.buffsDirty = true;
        break;
      case 'chemBurst': {
        const src: DamageSource = { owner: t.id, armorPierce: 0, resistPierce: 0, bigMult: 1 };
        for (const e of this.queryEnemies(t.x, t.y, 160, this.qbuf2)) {
          this.damage(e, 150, 'acid', src);
          if (e.alive) this.applyCorrode(e, Math.max(8, t.base.corrodeDps), 4, t.id);
        }
        this.emit({ t: 'boom', kind: 'acid', x: t.x, y: t.y, r: 160 });
        break;
      }
    }
    this.emit({ t: 'ability', id, x: t.x, y: t.y });
    return { ok: true };
  }

  addGlobalSlow(key: string, amt: number, t: number) {
    const g = this.globalSlows.find((s) => s.key === key);
    if (g) {
      g.amt = Math.max(g.amt, amt);
      g.t = Math.max(g.t, t);
    } else this.globalSlows.push({ key, amt, t });
  }

  // ---------------------------------------------------------------- stats & buffs
  unitName(t: Tower) {
    return t.type === 'lyra' ? 'Lyra' : TOWERS[t.type].name;
  }

  refreshStats(t: Tower) {
    if (t.type === 'lyra') {
      const hs = heroStats(this.heroLevel);
      const s = defaultStats();
      s.attack = 'bolt';
      s.damage = hs.damage;
      s.interval = hs.interval;
      s.range = hs.range;
      s.projSpeed = 720;
      s.homing = true;
      s.dmgType = 'arcane';
      s.detect = hs.detect;
      s.bigMult = hs.bigMult;
      t.base = s;
    } else {
      t.base = computeStats(t.type, t.levels);
    }
  }

  recomputeBuffs() {
    this.buffsDirty = false;
    const sources = this.towers.filter((t) => hasAnySupport(t.base.support));
    for (const t of this.towers) {
      const b = emptySupport();
      if (t.type !== 'beacon' && t.type !== 'orchard') {
        for (const s of sources) {
          if (s === t) continue;
          if (Math.hypot(s.x - t.x, s.y - t.y) > s.base.supportRange + t.radius * 0.5) continue;
          const sp = s.base.support;
          b.atkSpeed = Math.max(b.atkSpeed, sp.atkSpeed);
          b.dmgPct = Math.max(b.dmgPct, sp.dmgPct);
          b.rangePct = Math.max(b.rangePct, sp.rangePct);
          b.detect = b.detect || sp.detect;
          b.armorPierce = Math.max(b.armorPierce, sp.armorPierce);
          b.resistPierce = Math.max(b.resistPierce, sp.resistPierce);
          b.projSpeed = Math.max(b.projSpeed, sp.projSpeed);
        }
      }
      t.buffs = b;
    }
  }

  waveBonus(): number {
    let w = 0;
    for (const t of this.towers) w = Math.max(w, t.base.support.waveBonus);
    return Math.min(0.15, w);
  }

  effRange(t: Tower) {
    return t.base.range * (1 + t.buffs.rangePct);
  }
  effDetect(t: Tower) {
    return t.base.detect || t.buffs.detect;
  }
  effInterval(t: Tower) {
    let speed = 1 + t.buffs.atkSpeed;
    if (this.globalHasteT > 0) speed *= 1.5;
    let iv = t.base.interval / speed;
    if (t.abilityT > 0 && t.base.ability === 'focusBarrage') iv *= 0.25;
    if (t.abilityT > 0 && t.base.ability === 'overdrive') iv *= 0.5;
    return iv;
  }
  effDamage(t: Tower) {
    let d = t.base.damage * (1 + t.buffs.dmgPct);
    if (t.base.modes && t.mode === 'fire') d *= 1.5;
    return d;
  }
  effDmgType(t: Tower): DamageType {
    if (t.base.modes) return t.mode === 'fire' ? 'fire' : 'acid';
    return t.base.dmgType;
  }

  // ---------------------------------------------------------------- simulation
  step() {
    if (this.state !== 'playing') return;
    const dt = STEP;
    this.tick++;
    this.time += dt;
    if (this.buffsDirty) this.recomputeBuffs();

    // timers
    if (this.globalHasteT > 0) {
      this.globalHasteT -= dt;
      if (this.globalHasteT <= 0) this.buffsDirty = true;
    }
    for (let i = this.globalSlows.length - 1; i >= 0; i--) {
      this.globalSlows[i].t -= dt;
      if (this.globalSlows[i].t <= 0) this.globalSlows.splice(i, 1);
    }

    if (this.waveActive) {
      this.waveTime += dt;
      while (this.spawnIdx < this.spawnQueue.length && this.spawnQueue[this.spawnIdx].time <= this.waveTime) {
        const s = this.spawnQueue[this.spawnIdx++];
        this.spawnEnemy(s.type, s.path, 0, s.flags, s.hp, s.reward, this.wave);
      }
    }

    this.rebuildGrid();
    this.updateEnemies(dt);
    if (this.state !== 'playing') return;
    this.rebuildGrid();
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.updateDrones(dt);
    this.updateDrops(dt);
    this.cleanupEnemies();

    if (this.waveActive && !this.cfg.sandbox) this.checkWaveEnd();
    if (this.cfg.sandbox && this.spawnIdx >= this.spawnQueue.length && this.enemies.length === 0) {
      this.waveActive = false;
      this.spawnQueue.length = 0;
      this.spawnIdx = 0;
      this.waveTime = 0;
    }
  }

  rebuildGrid() {
    this.grid.clear();
    for (const e of this.enemies) if (e.alive) this.grid.insert(e);
  }

  queryEnemies(x: number, y: number, r: number, out: Enemy[]): Enemy[] {
    const res = this.grid.query(x, y, r + 50, out);
    let n = 0;
    for (let i = 0; i < res.length; i++) {
      const e = res[i];
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.def.radius * 0.5;
      if (dx * dx + dy * dy <= rr * rr) res[n++] = e;
    }
    res.length = n;
    // stable order for determinism
    res.sort((a, b) => a.id - b.id);
    return res;
  }

  spawnEnemy(type: EnemyType, path: number, dist: number, flags: Variant[], hpMult: number, rewardMult: number, wave: number, hpScaleOverride?: number): Enemy {
    const def = ENEMIES[type];
    const hpScale = hpScaleOverride ?? waveHealthScale(wave, this.finalWave) * this.diff.enemyHp * hpMult * this.cfg.hpMult;
    const maxHp = def.hp * hpScale;
    const p = this.map.paths[path];
    const pos = posAt(p, dist);
    const e: Enemy = {
      id: this.nextId++, type, def, path, dist, x: pos.x, y: pos.y, angle: pos.angle, hp: maxHp, maxHp, shield: 0, maxShield: 0,
      armor: def.armor + (flags.includes('armored') ? ARMOR_VARIANT : 0),
      concealed: def.concealed || flags.includes('concealed'), regen: flags.includes('regen'), variants: flags,
      speed: def.speed * SPEED_SCALE * this.diff.enemySpeed * endlessSpeedScale(wave, this.finalWave) * this.cfg.speedMult,
      reward: def.reward * rewardMult, rewardMult, hpScale, alive: true, slows: [], freezeT: 0, stunT: 0, ccImmuneT: 0,
      frozenBonus: 0, burnDps: 0, burnT: 0, burnGen: 0, burnSrc: 0, burnSpreadCd: 1, corrodeDps: 0, corrodeT: 0, corrodeSrc: 0,
      shredAmt: 0, shredT: 0, markAmt: 0, markT: 0, exposedT: 0, sinceHit: 0, healCd: def.heal ? def.heal.interval : 0,
      boss: null, parentBoss: 0, flashT: 0, anim: (this.nextId * 0.37) % 1,
    };
    if (flags.includes('shield')) e.shield = e.maxShield = maxHp * SHIELD_PCT;
    if (def.boss) {
      e.boss = {
        phase: 1, shieldCd: 4, summonCd: COLOSSUS.summonEvery, hardenCd: 3, hardenT: 0, tempShield: 0, tempShieldT: 0,
        telegraph: '', telegraphT: 0, summonsAlive: 0, summonsTotal: 0,
      };
    }
    this.enemies.push(e);
    return e;
  }

  slowFactor(e: Enemy): number {
    if (e.freezeT > 0 || e.stunT > 0) return 0;
    let s = 0;
    for (const sl of e.slows) {
      let a = sl.amt;
      if (e.def.frostResist && sl.key !== 'snare' && sl.key !== 'anchor') a *= 0.5;
      if (a > s) s = a;
    }
    for (const g of this.globalSlows) {
      let a = g.amt;
      if (e.def.frostResist && g.key === 'blizzard') a *= 0.5;
      if (a > s) s = a;
    }
    if (e.def.boss) s *= COLOSSUS.slowEffect;
    return 1 - Math.min(MAX_SLOW, s);
  }

  updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // statuses
      if (e.freezeT > 0) {
        e.freezeT -= dt;
        if (e.freezeT <= 0) { e.frozenBonus = 0; e.ccImmuneT = CC_IMMUNITY; }
      } else if (e.stunT > 0) {
        e.stunT -= dt;
        if (e.stunT <= 0) e.ccImmuneT = CC_IMMUNITY;
      } else if (e.ccImmuneT > 0) e.ccImmuneT -= dt;
      for (let i = e.slows.length - 1; i >= 0; i--) {
        e.slows[i].t -= dt;
        if (e.slows[i].t <= 0) e.slows.splice(i, 1);
      }
      if (e.shredT > 0 && (e.shredT -= dt) <= 0) e.shredAmt = 0;
      if (e.markT > 0 && (e.markT -= dt) <= 0) e.markAmt = 0;
      if (e.exposedT > 0) e.exposedT -= dt;
      if (e.flashT > 0) e.flashT -= dt;
      e.sinceHit += dt;

      if (e.burnT > 0) {
        e.burnT -= dt;
        this.damage(e, e.burnDps * dt, 'fire', { owner: e.burnSrc, armorPierce: 0, resistPierce: 0, bigMult: 1, dot: true });
        if (e.burnGen > 0 && e.alive) {
          e.burnSpreadCd -= dt;
          if (e.burnSpreadCd <= 0) {
            e.burnSpreadCd = 1;
            const near = this.queryEnemies(e.x, e.y, 50, this.qbuf2);
            for (const n of near) {
              if (n !== e && n.burnT <= 0) {
                this.applyBurn(n, e.burnDps, Math.max(1, e.burnT), e.burnSrc, e.burnGen - 1);
                break;
              }
            }
          }
        }
        if (e.burnT <= 0) e.burnDps = 0;
        if (!e.alive) continue;
      }
      if (e.corrodeT > 0) {
        e.corrodeT -= dt;
        this.damage(e, e.corrodeDps * dt, 'acid', { owner: e.corrodeSrc, armorPierce: 0, resistPierce: 0, bigMult: 1, dot: true });
        if (e.corrodeT <= 0) e.corrodeDps = 0;
        if (!e.alive) continue;
      }
      if (e.regen && e.sinceHit >= REGEN.delay && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * REGEN.pctPerSec * dt);
      if (e.def.heal) this.updateMender(e, dt);
      if (e.boss) this.updateBoss(e, dt);

      // movement
      let spd = e.speed * this.slowFactor(e);
      if (e.boss && e.boss.phase === 3) spd *= COLOSSUS.phase3Speed;
      e.dist += spd * dt;
      e.anim += dt * (0.6 + spd / 60);
      const p = this.map.paths[e.path];
      if (e.dist >= p.length) {
        this.leak(e);
        if (this.state !== 'playing') return;
        continue;
      }
      const pos = posAt(p, e.dist);
      e.x = pos.x;
      e.y = pos.y;
      e.angle = pos.angle;
    }
  }

  updateMender(e: Enemy, dt: number) {
    const h = e.def.heal!;
    e.healCd -= dt;
    if (e.healCd > 0) return;
    e.healCd = h.interval;
    let healed = false;
    for (const o of this.queryEnemies(e.x, e.y, h.radius, this.qbuf2)) {
      if (o === e || o.hp >= o.maxHp) continue;
      const amt = Math.min(o.maxHp * h.pct, h.maxFlat * o.hpScale);
      o.hp = Math.min(o.maxHp, o.hp + amt);
      healed = true;
    }
    if (healed) this.emit({ t: 'heal', x: e.x, y: e.y, r: h.radius });
  }

  updateBoss(e: Enemy, dt: number) {
    const b = e.boss!;
    const frac = e.hp / e.maxHp;
    const phase: 1 | 2 | 3 = frac > COLOSSUS.phase2At ? 1 : frac > COLOSSUS.phase3At ? 2 : 3;
    if (phase !== b.phase) {
      // a pending summon telegraph from this boss is cancelled by the phase change
      if (b.telegraph === 'summon') this.pendingSpawnEffects = Math.max(0, this.pendingSpawnEffects - 1);
      b.phase = phase;
      b.telegraph = '';
      b.telegraphT = 0;
      if (phase === 3) { b.tempShield = 0; b.tempShieldT = 0; }
      this.emit({ t: 'bossPhase', phase, x: e.x, y: e.y });
    }
    if (b.tempShieldT > 0) {
      b.tempShieldT -= dt;
      if (b.tempShieldT <= 0) b.tempShield = 0;
    }
    if (b.hardenT > 0) b.hardenT -= dt;
    if (b.telegraph) {
      b.telegraphT -= dt;
      if (b.telegraphT <= 0) {
        const kind = b.telegraph;
        b.telegraph = '';
        if (kind === 'shield' && b.phase === 1) {
          b.tempShield = e.maxHp * COLOSSUS.shieldPct;
          b.tempShieldT = COLOSSUS.shieldDuration;
          this.emit({ t: 'shieldUp', x: e.x, y: e.y });
        } else if (kind === 'summon') {
          this.pendingSpawnEffects = Math.max(0, this.pendingSpawnEffects - 1);
          if (b.phase === 2) this.bossSummon(e);
        } else if (kind === 'harden' && b.phase === 3) {
          b.hardenT = COLOSSUS.hardenDuration;
        }
      }
      return;
    }
    if (b.phase === 1) {
      b.shieldCd -= dt;
      if (b.shieldCd <= 0 && b.tempShieldT <= 0) {
        b.shieldCd = COLOSSUS.shieldEvery;
        b.telegraph = 'shield';
        b.telegraphT = 1;
        this.emit({ t: 'telegraph', kind: 'shield', x: e.x, y: e.y });
      }
    } else if (b.phase === 2) {
      b.summonCd -= dt;
      if (b.summonCd <= 0) {
        b.summonCd = COLOSSUS.summonEvery;
        if (b.summonsAlive < COLOSSUS.summonMaxAlive && b.summonsTotal < COLOSSUS.summonMaxTotal) {
          b.telegraph = 'summon';
          b.telegraphT = COLOSSUS.summonTelegraph;
          this.pendingSpawnEffects++;
          this.emit({ t: 'telegraph', kind: 'summon', x: e.x, y: e.y });
        }
      }
    } else {
      b.hardenCd -= dt;
      if (b.hardenCd <= 0 && b.hardenT <= 0) {
        b.hardenCd = COLOSSUS.hardenEvery;
        b.telegraph = 'harden';
        b.telegraphT = COLOSSUS.hardenTelegraph;
        this.emit({ t: 'telegraph', kind: 'harden', x: e.x, y: e.y });
      }
    }
  }

  bossSummon(e: Enemy) {
    const b = e.boss!;
    const n = Math.min(COLOSSUS.summonCount, COLOSSUS.summonMaxAlive - b.summonsAlive, COLOSSUS.summonMaxTotal - b.summonsTotal);
    for (let i = 0; i < n; i++) {
      const type: EnemyType = i % 2 === 0 ? 'skitter' : 'sproutling';
      const c = this.spawnEnemy(type, e.path, Math.max(0, e.dist - 30 - i * 14), [], 1, 0, this.wave);
      c.parentBoss = e.id;
      b.summonsAlive++;
      b.summonsTotal++;
    }
    if (n > 0) this.emit({ t: 'summon', x: e.x, y: e.y });
  }

  leak(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    const lost = e.def.leak;
    this.lives = Math.max(0, this.lives - lost);
    this.stats.leaks++;
    this.stats.livesLost += lost;
    this.onEnemyGone(e);
    this.emit({ t: 'leak', x: e.x, y: e.y, lives: lost });
    if (this.lives <= 0 && !this.cfg.sandbox) {
      this.state = 'defeat';
      this.waveActive = false;
      this.emit({ t: 'defeat' });
    }
    if (this.cfg.sandbox) this.lives = Math.max(this.lives, 1);
  }

  onEnemyGone(e: Enemy) {
    if (e.parentBoss) {
      const boss = this.enemyById(e.parentBoss);
      if (boss && boss.boss) boss.boss.summonsAlive = Math.max(0, boss.boss.summonsAlive - 1);
    }
    if (e.boss && e.boss.telegraph === 'summon') {
      this.pendingSpawnEffects = Math.max(0, this.pendingSpawnEffects - 1);
      e.boss.telegraph = '';
    }
  }

  cleanupEnemies() {
    let n = 0;
    for (const e of this.enemies) if (e.alive) this.enemies[n++] = e;
    this.enemies.length = n;
  }

  checkWaveEnd() {
    if (this.spawnIdx < this.spawnQueue.length) return;
    if (this.enemies.length > 0) return;
    if (this.pendingSpawnEffects > 0) return;
    this.completeWave();
  }

  completeWave() {
    this.waveActive = false;
    this.spawnQueue = [];
    this.spawnIdx = 0;
    const w = this.wave;
    const reward = Math.round(endOfWaveGold(w) * (1 + this.waveBonus()));
    this.addGold(reward);
    let income = 0;
    for (const t of this.towers) {
      if (t.type === 'orchard') income += this.orchardPayout(t);
      else if (t.base.income > 0) {
        income += t.base.income;
        this.addGold(t.base.income);
      }
      t.harvestCharges = t.base.harvestCharges;
    }
    if (this.hero) {
      const before = this.heroLevel;
      this.heroXp += Math.round(HERO.xpPerWave(w) * this.cfg.heroXpMult);
      const after = this.heroLevel;
      this.stats.heroMaxLevel = Math.max(this.stats.heroMaxLevel, after);
      if (after > before) {
        const h = this.hero;
        this.refreshStats(h);
        this.emit({ t: 'levelUp', level: after, x: h.x, y: h.y });
      }
    }
    this.zones = [];
    this.drones = [];
    this.projectiles = [];
    this.globalSlows = [];
    this.stats.wavesCompletedThisSession++;
    this.emit({ t: 'waveEnd', wave: w, reward, income });
    if (w >= this.finalWave && !this.cfg.endless && !this.cfg.sandbox) {
      this.state = 'victory';
      this.emit({ t: 'victory' });
    }
  }

  /** Pays out an orchard at wave end; returns gold paid immediately (for the summary). */
  orchardPayout(t: Tower): number {
    const s = t.base;
    let income = s.income;
    let paid = 0;
    // interest first, on the balance carried from previous waves
    if (s.bank && s.interest > 0 && t.bank > 0) {
      const gain = Math.min(s.bankCap - t.bank, Math.floor(t.bank * s.interest));
      if (gain > 0) {
        t.bank += gain;
        this.stats.goldEarned += gain;
      }
    }
    let toBank = 0, toDrops = 0, direct = 0;
    if (s.bank && s.harvest) {
      toBank = income / 2;
      toDrops = income / 2;
    } else if (s.bank) toBank = income;
    else if (s.harvest) toDrops = income;
    else direct = income;
    if (toBank > 0) {
      const dep = toBank * (1 + s.bankBonus);
      const room = Math.max(0, s.bankCap - t.bank);
      const into = Math.min(room, dep);
      t.bank += into;
      this.stats.goldEarned += Math.floor(into);
      direct += dep - into;
    }
    if (toDrops > 0) {
      const total = Math.round(toDrops * (1 + s.harvestBonus));
      const each = Math.floor(total / 3);
      for (let i = 0; i < 3; i++) {
        const v = i === 2 ? total - each * 2 : each;
        const a = this.rng.next() * Math.PI * 2;
        const r = 34 + this.rng.next() * 16;
        this.drops.push({
          id: this.nextId++, owner: t.id, x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r * 0.8, value: v, age: 0, auto: s.autoCollect,
        });
      }
      this.emit({ t: 'drop', x: t.x, y: t.y });
    }
    if (direct > 0) {
      this.addGold(direct);
      paid += direct;
      this.emit({ t: 'gold', x: t.x, y: t.y - 20, amount: Math.round(direct) });
    }
    return paid;
  }

  updateDrops(dt: number) {
    for (const d of [...this.drops]) {
      d.age += dt;
      if (d.auto > 0 && d.age >= d.auto) this.collectDrop(d.id);
    }
  }

  // ---------------------------------------------------------------- damage
  canTarget(t: Tower, e: Enemy): boolean {
    return !e.concealed || e.exposedT > 0 || this.effDetect(t);
  }

  damage(e: Enemy, amount: number, type: DamageType, src: DamageSource) {
    if (!e.alive || amount <= 0) return;
    let mult = 1;
    if (type === 'fire' && e.def.fireResist) mult *= 0.25 + 0.75 * src.resistPierce;
    if (type === 'frost' && e.def.frostResist) mult *= 0.25 + 0.75 * src.resistPierce;
    if (e.markAmt > 0) mult *= 1 + e.markAmt;
    if (e.freezeT > 0 && e.frozenBonus > 0) mult *= 1 + e.frozenBonus;
    if (e.def.big) mult *= src.bigMult;
    let dmg = amount * mult;
    if (!src.dot && ARMOR_TYPES[type] && e.armor > 0) {
      const eff = Math.max(0, e.armor - e.shredAmt - src.armorPierce);
      if (eff > 0) dmg = Math.max(1, dmg - eff);
    }
    if (e.boss && e.boss.hardenT > 0) dmg *= 1 - COLOSSUS.hardenReduction;
    if (!src.dot) {
      e.flashT = 0.08;
    }
    e.sinceHit = 0;
    // shields absorb first
    if (e.boss && e.boss.tempShield > 0) {
      const a = Math.min(e.boss.tempShield, dmg);
      e.boss.tempShield -= a;
      dmg -= a;
      this.credit(src.owner, a);
    }
    if (dmg > 0 && e.shield > 0) {
      const a = Math.min(e.shield, dmg);
      e.shield -= a;
      dmg -= a;
      this.credit(src.owner, a);
    }
    if (dmg <= 0) return;
    const dealt = Math.min(e.hp, dmg);
    e.hp -= dmg;
    this.credit(src.owner, dealt);
    if (e.hp <= 0.0001) this.kill(e, src.owner);
  }

  credit(owner: number, amount: number) {
    if (!owner) return;
    const t = this.towerById(owner);
    if (t) t.damageDealt += amount;
  }

  kill(e: Enemy, owner: number) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    this.stats.kills++;
    if (e.def.boss) this.stats.bossKills++;
    const t = owner ? this.towerById(owner) : undefined;
    if (t) t.kills++;
    if (e.reward > 0) this.addGold(e.reward);
    this.onEnemyGone(e);
    this.emit({ t: 'kill', x: e.x, y: e.y, type: e.type, reward: e.reward, big: e.def.big });
    const ch = e.def.children;
    if (ch && !this.cfg.sandbox) {
      for (let i = 0; i < ch.count; i++) {
        const c = this.spawnEnemy(ch.type, e.path, Math.max(0, e.dist - i * 10), [], 1, 0, this.wave, e.hpScale);
        c.reward = ch.rewardEach * e.rewardMult;
        c.x += (i - (ch.count - 1) / 2) * 3;
      }
    } else if (ch && this.cfg.sandbox) {
      for (let i = 0; i < ch.count; i++) this.spawnEnemy(ch.type, e.path, Math.max(0, e.dist - i * 10), [], 1, 0, this.wave, e.hpScale);
    }
  }

  applySlow(e: Enemy, key: string, amt: number, dur: number) {
    const s = e.slows.find((x) => x.key === key);
    if (s) {
      s.amt = Math.max(s.amt, amt);
      s.t = Math.max(s.t, dur);
    } else e.slows.push({ key, amt, t: dur });
  }
  applyFreeze(e: Enemy, dur: number, bonus: number): boolean {
    if (e.def.boss || e.def.frostResist || e.freezeT > 0 || e.stunT > 0 || e.ccImmuneT > 0) return false;
    e.freezeT = dur;
    e.frozenBonus = bonus;
    return true;
  }
  applyStun(e: Enemy, dur: number) {
    if (e.def.boss || e.freezeT > 0 || e.stunT > 0 || e.ccImmuneT > 0) return;
    e.stunT = dur;
  }
  applyBurn(e: Enemy, dps: number, dur: number, src: number, gen: number) {
    if (dps >= e.burnDps) {
      e.burnDps = dps;
      e.burnSrc = src;
      e.burnGen = Math.max(gen, e.burnT > 0 ? Math.min(e.burnGen, gen) : gen);
    }
    e.burnT = Math.max(e.burnT, dur);
  }
  applyCorrode(e: Enemy, dps: number, dur: number, src: number) {
    if (dps >= e.corrodeDps) {
      e.corrodeDps = dps;
      e.corrodeSrc = src;
    }
    e.corrodeT = Math.max(e.corrodeT, dur);
  }

  /** On-hit effects shared by projectiles and instant attacks. */
  onHitEffects(e: Enemy, s: TowerStats, owner: number) {
    if (!e.alive) return;
    if (s.slow > 0) this.applySlow(e, s.attack === 'arrow' ? 'snare' : 'frost', s.slow, s.slowDur);
    if (s.burnDps > 0) this.applyBurn(e, s.burnDps, s.burnDur, owner, s.burnSpread);
    if (s.corrodeDps > 0) this.applyCorrode(e, s.corrodeDps, s.corrodeDur, owner);
    if (s.shred > 0) {
      e.shredAmt = Math.max(e.shredAmt, s.shred);
      e.shredT = Math.max(e.shredT, s.shredDur);
    }
    if (s.mark > 0) {
      e.markAmt = Math.max(e.markAmt, s.mark);
      e.markT = Math.max(e.markT, s.markDur);
    }
  }

  // ---------------------------------------------------------------- towers
  pickTarget(t: Tower, range: number, mode: TargetMode, exclude?: Set<number>): Enemy | undefined {
    const cands = this.queryEnemies(t.x, t.y, range, this.qbuf);
    let best: Enemy | undefined;
    let bestScore = -Infinity;
    for (const e of cands) {
      if (!this.canTarget(t, e)) continue;
      if (exclude && exclude.has(e.id)) continue;
      const remaining = this.map.paths[e.path].length - e.dist;
      let score: number;
      switch (mode) {
        case 'first': score = -remaining; break;
        case 'last': score = remaining; break;
        case 'strong': score = e.def.threat * 1e6 + e.hp + e.shield - remaining * 1e-3; break;
        case 'close': score = -Math.hypot(e.x - t.x, e.y - t.y); break;
      }
      // ids are sorted ascending, so strict > keeps the lowest id on ties (stable)
      if (score > bestScore + 1e-6) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  predict(e: Enemy, speed: number, fromX: number, fromY: number): { x: number; y: number } {
    let tx = e.x, ty = e.y;
    const spd = e.speed * this.slowFactor(e) * (e.boss?.phase === 3 ? COLOSSUS.phase3Speed : 1);
    for (let i = 0; i < 2; i++) {
      const tt = Math.hypot(tx - fromX, ty - fromY) / speed;
      const p = posAt(this.map.paths[e.path], Math.min(e.dist + spd * tt, this.map.paths[e.path].length));
      tx = p.x;
      ty = p.y;
    }
    return { x: tx, y: ty };
  }

  updateTowers(dt: number) {
    for (const t of this.towers) {
      if (t.attackAnim > 0) t.attackAnim -= dt;
      if (t.abilityCd > 0) t.abilityCd -= dt;
      if (t.abilityT > 0) t.abilityT -= dt;
      if (t.pulseCd > 0) t.pulseCd -= dt;
      if (t.anchorCd > 0) t.anchorCd -= dt;
      const s = t.base;
      const range = this.effRange(t);

      // Winter Field aura / exposure (works even without an attack target)
      if (s.auraSlow > 0 || s.exposeEvery > 0 || s.support.exposeAll) {
        const inRange = this.queryEnemies(t.x, t.y, range, this.qbuf2);
        if (s.auraSlow > 0) for (const e of inRange) this.applySlow(e, 'aura', s.auraSlow, 0.25);
        if (s.support.exposeAll) for (const e of inRange) e.exposedT = Math.max(e.exposedT, 0.25);
        if (s.exposeEvery > 0) {
          t.exposeCd -= dt;
          if (t.exposeCd <= 0 && inRange.length > 0) {
            t.exposeCd = s.exposeEvery;
            for (const e of inRange) e.exposedT = Math.max(e.exposedT, s.exposeDur);
            this.emit({ t: 'nova', x: t.x, y: t.y, r: range });
          }
        }
      }
      if (s.droneMax > 0) {
        t.droneCd -= dt * (t.abilityT > 0 && s.ability === 'overdrive' ? 2 : 1);
        if (t.droneCd <= 0 && this.waveActive) {
          t.droneCd = s.droneEvery;
          const mine = this.drones.filter((d) => d.owner === t.id);
          if (mine.length < s.droneMax) {
            this.drones.push({ id: this.nextId++, owner: t.id, x: t.x, y: t.y, ang: (mine.length * Math.PI * 2) / s.droneMax, life: s.droneLife, cd: 0.5, orbit: 46 + mine.length * 10 });
          }
        }
      }
      if (s.attack === 'none') continue;

      // Absolute Winter: periodic nova centred on the tower
      if (s.freezeEvery > 0) t.freezeCd -= dt;
      if (s.freezeOnTower && t.freezeCd <= 0) {
        const inR = this.queryEnemies(t.x, t.y, s.freezeRadius, this.qbuf2);
        if (inR.length) {
          t.freezeCd = s.freezeEvery;
          this.freezeNova(t, t.x, t.y, s.freezeRadius, inR);
        }
      }

      t.cd -= dt;
      if (t.cd > 0) continue;
      const target = this.pickTarget(t, range, t.targeting);
      if (!target) {
        t.cd = 0;
        continue;
      }
      t.cd = this.effInterval(t);
      t.attackCount++;
      t.attackAnim = 0.18;
      t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      this.fire(t, target);
    }
  }

  freezeNova(t: Tower, x: number, y: number, r: number, list: Enemy[]) {
    const s = t.base;
    const src = this.srcFor(t);
    for (const e of list) {
      const froze = this.applyFreeze(e, s.freezeDur, s.frozenBonus);
      if (!froze && s.bossSlow > 0) this.applySlow(e, 'frost', s.bossSlow, s.freezeDur + 0.5);
      if (s.freezeDamage > 0) this.damage(e, s.freezeDamage * (1 + t.buffs.dmgPct), 'frost', src);
    }
    this.emit({ t: 'nova', x, y, r });
  }

  srcFor(t: Tower): DamageSource {
    return { owner: t.id, armorPierce: t.base.armorPierce + t.buffs.armorPierce, resistPierce: t.buffs.resistPierce, bigMult: t.base.bigMult };
  }

  fire(t: Tower, target: Enemy) {
    const s = t.base;
    const dmg = this.effDamage(t);
    const dmgType = this.effDmgType(t);
    const projSpeed = s.projSpeed * (1 + t.buffs.projSpeed);
    // Flash Freeze (targeted nova)
    if (s.freezeEvery > 0 && !s.freezeOnTower && t.freezeCd <= 0) {
      t.freezeCd = s.freezeEvery;
      this.freezeNova(t, target.x, target.y, s.freezeRadius, this.queryEnemies(target.x, target.y, s.freezeRadius, this.qbuf2));
    }
    if (s.rail) {
      this.fireRail(t, target, dmg, dmgType);
      return;
    }
    const kind: ProjKind = s.attack === 'none' ? 'arrow' : (s.attack as ProjKind);
    const aim = this.predict(target, projSpeed, t.x, t.y);
    const baseAng = Math.atan2(aim.y - t.y, aim.x - t.x);
    t.angle = baseAng;
    const n = s.projectiles;
    const spread = (s.spread * Math.PI) / 180;
    const homing = s.homing || (t.abilityT > 0 && s.ability === 'focusBarrage');
    const stun = s.stunEvery > 0 && t.attackCount % s.stunEvery === 0;
    for (let i = 0; i < n; i++) {
      const ang = n === 1 ? baseAng : baseAng - spread / 2 + (spread * i) / (n - 1);
      const p: Projectile = {
        id: this.nextId++, kind, x: t.x + Math.cos(ang) * 14, y: t.y - 10 + Math.sin(ang) * 14, vx: Math.cos(ang) * projSpeed, vy: Math.sin(ang) * projSpeed,
        speed: projSpeed, life: this.effRange(t) * 1.6 + 80, owner: t.id, stats: s, dmg, dmgType, pierce: s.pierce, hit: [],
        target: target.id, homing, tx: aim.x, ty: aim.y, radius: kind === 'flask' ? 6 : 6 + 3 * (s.projSize - 1),
        detect: this.effDetect(t), armorPierce: s.armorPierce + t.buffs.armorPierce, resistPierce: t.buffs.resistPierce,
        stun, size: s.projSize, alive: true, flight: 0, flightTotal: 0, sx: t.x, sy: t.y - 10,
      };
      if (kind === 'flask') {
        const d = Math.hypot(aim.x - p.x, aim.y - p.y);
        p.flightTotal = Math.max(0.12, d / projSpeed);
        p.vx = (aim.x - p.x) / p.flightTotal;
        p.vy = (aim.y - p.y) / p.flightTotal;
      }
      this.projectiles.push(p);
    }
    this.emit({ t: 'shot', kind, x: t.x, y: t.y, tx: aim.x, ty: aim.y, owner: t.id });
  }

  fireRail(t: Tower, target: Enemy, dmg: number, dmgType: DamageType) {
    const s = t.base;
    const ang = Math.atan2(target.y - t.y, target.x - t.x);
    const len = this.effRange(t) * 1.6;
    const x2 = t.x + Math.cos(ang) * len, y2 = t.y + Math.sin(ang) * len;
    const cands = this.grid.query((t.x + x2) / 2, (t.y + y2) / 2, len / 2 + 40, this.qbuf2);
    const hits: { e: Enemy; along: number }[] = [];
    const dx = Math.cos(ang), dy = Math.sin(ang);
    for (const e of cands) {
      if (!e.alive) continue;
      const rx = e.x - t.x, ry = e.y - t.y;
      const along = rx * dx + ry * dy;
      if (along < 0 || along > len) continue;
      const perp = Math.abs(rx * dy - ry * dx);
      if (perp <= s.railWidth + e.def.radius) hits.push({ e, along });
    }
    hits.sort((a, b) => a.along - b.along || a.e.id - b.e.id);
    const src = this.srcFor(t);
    let n = 0;
    const first = hits[0]?.e;
    const stun = s.stunEvery > 0 && t.attackCount % s.stunEvery === 0;
    for (const h of hits) {
      if (n >= s.pierce) break;
      this.damage(h.e, dmg, dmgType, src);
      this.onHitEffects(h.e, s, t.id);
      if (stun && h.e.alive) this.applyStun(h.e, s.stunDur);
      n++;
    }
    // cross-path: Chain Lightning tiers arc from the first enemy the rail strikes
    if (first && s.chain > 0) {
      this.chainFrom({
        stats: s, owner: t.id, dmg, dmgType, armorPierce: src.armorPierce, resistPierce: src.resistPierce, detect: this.effDetect(t), stun,
      } as Projectile, first);
    }
    this.emit({ t: 'shot', kind: 'rail', x: t.x, y: t.y - 12, tx: x2, ty: y2, owner: t.id, w: s.railWidth });
  }

  updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      if (p.kind === 'flask') {
        p.flight += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.flight >= p.flightTotal) {
          p.x = p.tx;
          p.y = p.ty;
          this.explodeFlask(p);
          p.alive = false;
        }
        continue;
      }
      if (p.homing) {
        let tgt = this.enemyById(p.target);
        if (!tgt || !tgt.alive) {
          tgt = this.findRetarget(p);
          if (tgt) p.target = tgt.id;
        }
        if (tgt && tgt.alive) {
          const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-12 * dt, Math.min(12 * dt, diff));
          const na = cur + turn;
          p.vx = Math.cos(na) * p.speed;
          p.vy = Math.sin(na) * p.speed;
        }
      }
      // sub-step to avoid tunnelling at high projectile speeds
      const stepLen = p.speed * dt;
      const sub = Math.max(1, Math.ceil(stepLen / 12));
      for (let k = 0; k < sub && p.alive; k++) {
        p.x += (p.vx * dt) / sub;
        p.y += (p.vy * dt) / sub;
        this.projectileCollide(p);
      }
      p.life -= stepLen;
      if (p.life <= 0 || p.x < -60 || p.y < -60 || p.x > WORLD_W + 60 || p.y > WORLD_H + 60) p.alive = false;
    }
    let n = 0;
    for (const p of this.projectiles) if (p.alive) this.projectiles[n++] = p;
    this.projectiles.length = n;
  }

  findRetarget(p: Projectile): Enemy | undefined {
    const near = this.queryEnemies(p.x, p.y, 160, this.qbuf2);
    let best: Enemy | undefined, bd = Infinity;
    for (const e of near) {
      if (p.hit.includes(e.id)) continue;
      if (e.concealed && !p.detect && e.exposedT <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  projectileCollide(p: Projectile) {
    const cands = this.grid.query(p.x, p.y, p.radius + 50, this.qbuf2);
    let bestE: Enemy | undefined;
    let bestD = Infinity;
    for (const e of cands) {
      if (!e.alive || p.hit.includes(e.id)) continue;
      const rr = p.radius + e.def.radius;
      const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d2 <= rr * rr && (d2 < bestD || (d2 === bestD && bestE && e.id < bestE.id))) {
        bestD = d2;
        bestE = e;
      }
    }
    if (!bestE) return;
    this.projectileHit(p, bestE);
  }

  projectileHit(p: Projectile, e: Enemy) {
    p.hit.push(e.id);
    const s = p.stats;
    const src: DamageSource = { owner: p.owner, armorPierce: p.armorPierce, resistPierce: p.resistPierce, bigMult: s.bigMult };
    this.damage(e, p.dmg, p.dmgType, src);
    this.onHitEffects(e, s, p.owner);
    if (p.stun && e.alive) this.applyStun(e, s.stunDur);
    this.emit({ t: 'hit', kind: p.kind, x: e.x, y: e.y });
    if (s.chain > 0) this.chainFrom(p, e);
    if (s.burst > 0) this.explode(p.owner, s, e.x, e.y, s.burst, p.dmg * s.burstPct, p.dmgType, s.burstCap, src, 'frost', e.id);
    p.pierce--;
    if (p.pierce <= 0) p.alive = false;
  }

  chainFrom(p: Projectile, first: Enemy) {
    const s = p.stats;
    const hitSet = new Set<number>([first.id]);
    const pts = [first.x, first.y];
    let last = first;
    const src: DamageSource = { owner: p.owner, armorPierce: p.armorPierce, resistPierce: p.resistPierce, bigMult: s.bigMult };
    for (let i = 0; i < Math.min(10, s.chain); i++) {
      const near = this.queryEnemies(last.x, last.y, s.chainRange, this.qbuf2);
      let best: Enemy | undefined, bd = Infinity;
      for (const e of near) {
        if (hitSet.has(e.id)) continue;
        if (e.concealed && !p.detect && e.exposedT <= 0) continue;
        const d = Math.hypot(e.x - last.x, e.y - last.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hitSet.add(best.id);
      pts.push(best.x, best.y);
      this.damage(best, p.dmg * 0.8, p.dmgType, src);
      if (p.stun && best.alive) this.applyStun(best, s.stunDur);
      last = best;
    }
    if (pts.length > 2) this.emit({ t: 'chain', pts });
  }

  explodeFlask(p: Projectile) {
    const s = p.stats;
    const src: DamageSource = { owner: p.owner, armorPierce: p.armorPierce, resistPierce: p.resistPierce, bigMult: s.bigMult };
    const kind = p.dmgType === 'acid' ? 'acid' : 'fire';
    this.explode(p.owner, s, p.x, p.y, s.splash, p.dmg, p.dmgType, s.splashCap, src, kind);
    if (s.secondary > 0) {
      const near = this.queryEnemies(p.x, p.y, 90, this.qbuf).slice();
      near.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) || a.id - b.id);
      let n = 0;
      for (const e of near) {
        if (n >= s.secondary) break;
        if (!e.alive) continue;
        this.explode(p.owner, s, e.x, e.y, s.secondaryRadius, p.dmg * s.secondaryPct, p.dmgType, s.secondaryCap, src, 'secondary');
        n++;
      }
    }
    if (s.groundDur > 0) {
      const mine = this.zones.filter((z) => z.owner === p.owner);
      if (mine.length >= s.groundMax) {
        const oldest = mine[0];
        this.zones.splice(this.zones.indexOf(oldest), 1);
      }
      this.zones.push({ id: this.nextId++, owner: p.owner, x: p.x, y: p.y, r: s.groundRadius, dps: s.groundDps, t: s.groundDur, max: s.groundDur, burnDps: s.burnDps, burnDur: Math.min(2, s.burnDur) });
    }
  }

  explode(owner: number, s: TowerStats, x: number, y: number, r: number, dmg: number, type: DamageType, cap: number, src: DamageSource, kind: 'fire' | 'acid' | 'frost' | 'secondary', skipId = 0) {
    const list = this.queryEnemies(x, y, r, this.qbuf2).slice();
    list.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) || a.id - b.id);
    let n = 0;
    for (const e of list) {
      if (n >= cap) break;
      if (e.id === skipId) continue;
      this.damage(e, dmg, type, src);
      if (kind !== 'frost') this.onHitEffects(e, s, owner);
      else if (s.slow > 0 && e.alive) this.applySlow(e, 'frost', s.slow, s.slowDur);
      n++;
    }
    this.emit({ t: 'boom', kind, x, y, r });
  }

  updateZones(dt: number) {
    for (const z of this.zones) {
      z.t -= dt;
      const src: DamageSource = { owner: z.owner, armorPierce: 0, resistPierce: 0, bigMult: 1, dot: true };
      for (const e of this.queryEnemies(z.x, z.y, z.r, this.qbuf2)) {
        this.damage(e, z.dps * dt, 'fire', src);
        if (e.alive && z.burnDps > 0) this.applyBurn(e, z.burnDps, z.burnDur, z.owner, 0);
      }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  updateDrones(dt: number) {
    for (const d of this.drones) {
      const t = this.towerById(d.owner);
      if (!t) { d.life = 0; continue; }
      const od = t.abilityT > 0 && t.base.ability === 'overdrive';
      d.life -= dt;
      d.ang += dt * 1.4;
      // orbit the guardian, drifting toward the nearest road point
      d.x = t.x + Math.cos(d.ang) * d.orbit;
      d.y = t.y + Math.sin(d.ang) * d.orbit * 0.8;
      d.cd -= dt * (od ? 2 : 1) * (this.globalHasteT > 0 ? 1.5 : 1);
      if (d.cd > 0) continue;
      const near = this.queryEnemies(d.x, d.y, t.base.droneRange, this.qbuf2);
      let best: Enemy | undefined, bd = Infinity;
      for (const e of near) {
        if (!this.canTarget(t, e)) continue;
        const rem = this.map.paths[e.path].length - e.dist;
        if (rem < bd) { bd = rem; best = e; }
      }
      if (!best) { d.cd = 0.1; continue; }
      d.cd = t.base.droneInterval;
      this.damage(best, t.base.droneDmg * (1 + t.buffs.dmgPct), 'arcane', this.srcFor(t));
      this.emit({ t: 'shot', kind: 'zap', x: d.x, y: d.y, tx: best.x, ty: best.y, owner: t.id });
    }
    this.drones = this.drones.filter((d) => d.life > 0);
  }

  // ---------------------------------------------------------------- info
  nextWaveDef(): WaveDef {
    return getWave(this.wave + 1, this.cfg.seed);
  }
  nextRoutes(): number[] {
    return activeRoutes(this.map.def, this.wave + 1);
  }
  waveProgress(): number {
    if (!this.waveActive) return 0;
    const total = this.spawnQueue.length || 1;
    return Math.min(1, this.spawnIdx / total);
  }

  bestTower(): { label: string; damage: number } | null {
    const all = [
      ...this.towers.map((t) => ({ label: this.unitName(t), damage: t.damageDealt })),
      ...this.stats.soldDamage,
    ];
    if (!all.length) return null;
    all.sort((a, b) => b.damage - a.damage);
    return all[0].damage > 0 ? { label: all[0].label, damage: Math.round(all[0].damage) } : null;
  }

  // ---------------------------------------------------------------- snapshot (pre-wave save)
  snapshot(): RunSnapshot {
    if (this.waveActive) throw new Error('Snapshots are only taken between waves');
    return {
      v: 1,
      cfg: { ...this.cfg },
      tick: this.tick,
      time: this.time,
      gold: this.gold,
      goldFrac: this.goldFrac,
      lives: this.lives,
      wave: this.wave,
      rng: this.rng.state,
      nextId: this.nextId,
      heroXp: this.heroXp,
      removedObstacles: [...this.removedObstacles],
      towers: this.towers.map((t) => ({
        id: t.id, type: t.type, x: t.x, y: t.y, levels: [...t.levels] as [number, number, number], invested: t.invested,
        targeting: t.targeting, damageDealt: t.damageDealt, kills: t.kills, abilityCd: t.abilityCd, mode: t.mode, bank: t.bank,
        harvestCharges: t.harvestCharges, pulseCd: t.pulseCd, anchorCd: t.anchorCd, droneCd: t.droneCd,
      })),
      drops: this.drops.map((d) => ({ ...d })),
      stats: JSON.parse(JSON.stringify(this.stats)),
    };
  }

  static restore(snap: RunSnapshot): Sim {
    const sim = new Sim(snap.cfg);
    sim.tick = snap.tick;
    sim.time = snap.time;
    sim.gold = snap.gold;
    sim.goldFrac = snap.goldFrac || 0;
    sim.lives = snap.lives;
    sim.wave = snap.wave;
    sim.rng.state = snap.rng >>> 0;
    sim.nextId = snap.nextId;
    sim.heroXp = snap.heroXp;
    sim.removedObstacles = new Set(snap.removedObstacles);
    for (const st of snap.towers) {
      const t: Tower = {
        id: st.id, type: st.type, x: st.x, y: st.y, radius: sim.unitRadius(st.type), levels: [...st.levels] as [number, number, number],
        invested: st.invested, targeting: st.targeting, base: defaultStats(), buffs: emptySupport(), cd: 0.2, angle: -Math.PI / 2,
        attackAnim: 0, placedAt: sim.time - 10, damageDealt: st.damageDealt, kills: st.kills, attackCount: 0, freezeCd: 0, exposeCd: 0,
        droneCd: st.droneCd ?? 2, abilityCd: st.abilityCd, abilityT: 0, mode: st.mode, bank: st.bank, harvestCharges: st.harvestCharges,
        pulseCd: st.pulseCd, anchorCd: st.anchorCd,
      };
      sim.refreshStats(t);
      sim.towers.push(t);
    }
    sim.drops = snap.drops.map((d) => ({ ...d }));
    sim.stats = { ...sim.stats, ...snap.stats, wavesCompletedThisSession: snap.stats.wavesCompletedThisSession ?? 0 };
    sim.buffsDirty = true;
    return sim;
  }
}

export interface RunSnapshot {
  v: 1;
  cfg: RunConfig;
  tick: number;
  time: number;
  gold: number;
  goldFrac: number;
  lives: number;
  wave: number;
  rng: number;
  nextId: number;
  heroXp: number;
  removedObstacles: string[];
  towers: {
    id: number; type: UnitType; x: number; y: number; levels: [number, number, number]; invested: number; targeting: TargetMode;
    damageDealt: number; kills: number; abilityCd: number; mode: 'fire' | 'acid'; bank: number; harvestCharges: number;
    pulseCd: number; anchorCd: number; droneCd: number;
  }[];
  drops: Drop[];
  stats: RunStats;
}

export const ABILITY_NAMES: Record<AbilityId, string> = {
  focusBarrage: 'Focused Barrage',
  chemBurst: 'Chemical Burst',
  blizzard: 'Blizzard',
  overdrive: 'Overdrive',
  solarFlare: 'Solar Flare',
  instantHarvest: 'Instant Harvest',
  riftPulse: 'Rift Pulse',
  timeAnchor: 'Time Anchor',
};

export type { TowerType };
