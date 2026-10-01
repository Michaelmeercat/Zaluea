import { describe, expect, it } from 'vitest';
import { SaveStore, defaultSave, sanitize, validateSnapshot, type Storage } from '../src/save/save';
import { Sim } from '../src/sim/sim';
import { campaignConfig, checkAchievements, isMapUnlocked, isTowerUnlocked, settleRun, buyMap, buyTalent, dailyInfo } from '../src/game/progression';
import { newSim, runWaveToEnd, SPOTS, hashState } from './helpers';

class MemStore implements Storage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('save data', () => {
  it('corrupted saves recover gracefully with a backup', () => {
    const st = new MemStore();
    st.setItem('riftkeepers.save', '{not json');
    const store = new SaveStore(st);
    expect(store.recoveredFromCorruption).toBe(true);
    expect(store.data.shards).toBe(0);
    expect(st.getItem('riftkeepers.save.corrupt')).toBe('{not json');
  });

  it('missing and invalid fields receive safe defaults', () => {
    const s = sanitize({ shards: -50, talents: { gold: 99 }, unlockedMaps: ['nope', 'ruins'], medals: { meadow: { easy: true, bogus: 1 }, fake: {} }, settings: { music: 7 } });
    expect(s.shards).toBe(0);
    expect(s.talents.gold).toBe(5);
    expect(s.unlockedMaps).toEqual(['meadow', 'ruins']);
    expect(s.medals).toEqual({ meadow: { easy: true } });
    expect(s.settings.music).toBe(1);
    expect(s.settings.quality).toBe('high');
    expect(s.activeRun).toBeNull();
  });

  it('import validates data; export round-trips', () => {
    const st = new MemStore();
    const store = new SaveStore(st);
    store.data.shards = 123;
    const text = store.exportString();
    const other = new SaveStore(new MemStore());
    expect(other.importString('garbage')).toMatch(/does not look/);
    expect(other.importString(btoa('{"shards":5}'))).toMatch(/does not look/);
    expect(other.importString(text)).toBeNull();
    expect(other.data.shards).toBe(123);
  });

  it('reload does not lose progress', () => {
    const st = new MemStore();
    const a = new SaveStore(st);
    a.data.shards = 77;
    a.data.achievements['first-victory'] = 1;
    a.save();
    const b = new SaveStore(st);
    expect(b.data.shards).toBe(77);
    expect(b.data.achievements['first-victory']).toBe(1);
  });
});

describe('run snapshots', () => {
  it('snapshot/restore reproduces state and continues identically', () => {
    const sim = newSim({ startGold: 5000 });
    sim.place('archer', SPOTS[0].x, SPOTS[0].y);
    const s2 = sim.place('orchard', 1100, 450).id!;
    sim.upgrade(s2, 2);
    sim.startWave();
    runWaveToEnd(sim);
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    expect(validateSnapshot(snap)).not.toBeNull();
    const restored = Sim.restore(snap);
    restored.recordEvents = false;
    expect(restored.gold).toBe(sim.gold);
    expect(restored.drops.length).toBe(sim.drops.length);
    expect(restored.towers.map((t) => t.levels.join(''))).toEqual(sim.towers.map((t) => t.levels.join('')));
    sim.startWave();
    restored.startWave();
    runWaveToEnd(sim);
    runWaveToEnd(restored);
    expect(hashState(restored).split('|').slice(1).join('|')).toBe(hashState(sim).split('|').slice(1).join('|'));
  });

  it('mid-wave reload restores the pre-wave snapshot without duplicate gold or purchases', () => {
    const sim = newSim({ startGold: 2000 });
    sim.place('archer', SPOTS[0].x, SPOTS[0].y);
    const pre = sim.snapshot();
    sim.startWave();
    for (let i = 0; i < 600; i++) sim.step();
    sim.place('archer', SPOTS[1].x, SPOTS[1].y); // bought mid-wave
    const restored = Sim.restore(JSON.parse(JSON.stringify(pre)));
    expect(restored.gold).toBe(pre.gold);
    expect(restored.towers.length).toBe(1);
    expect(restored.wave).toBe(0);
    expect(restored.waveActive).toBe(false);
  });

  it('rejects malformed snapshots', () => {
    const sim = newSim();
    const snap = JSON.parse(JSON.stringify(sim.snapshot()));
    snap.towers.push({ type: 'dragon', levels: [0, 0, 0], x: 1, y: 1, invested: 1 });
    expect(validateSnapshot(snap)).toBeNull();
    const snap2 = JSON.parse(JSON.stringify(sim.snapshot()));
    snap2.cfg.mapId = 'atlantis';
    expect(validateSnapshot(snap2)).toBeNull();
  });
});

describe('progression', () => {
  const finishRun = (save: ReturnType<typeof defaultSave>, mapId: string, diff: 'easy' | 'normal' | 'hard', outcome: 'victory' | 'defeat', runId: string, wave?: number) => {
    const sim = new Sim(campaignConfig(save, mapId, diff, false, 1));
    sim.wave = wave ?? sim.cfg.finalWave;
    sim.state = outcome;
    return settleRun(save, sim, runId, outcome);
  };

  it('starting content and tower unlocks', () => {
    const s = defaultSave();
    expect(isTowerUnlocked(s, 'archer')).toBe(true);
    expect(isTowerUnlocked(s, 'storm')).toBe(false);
    expect(isMapUnlocked(s, 'meadow')).toBe(true);
    expect(isMapUnlocked(s, 'ruins')).toBe(false);
    finishRun(s, 'meadow', 'easy', 'victory', 'r1');
    expect(isTowerUnlocked(s, 'storm')).toBe(true);
    expect(isTowerUnlocked(s, 'beacon')).toBe(false);
    expect(isMapUnlocked(s, 'ruins')).toBe(true);
    finishRun(s, 'meadow', 'normal', 'victory', 'r2');
    expect(isTowerUnlocked(s, 'beacon')).toBe(true);
    expect(isTowerUnlocked(s, 'orchard')).toBe(false);
    finishRun(s, 'ruins', 'easy', 'victory', 'r3');
    expect(isTowerUnlocked(s, 'orchard')).toBe(true);
    expect(isTowerUnlocked(s, 'lyra')).toBe(false);
    finishRun(s, 'twinroot', 'easy', 'victory', 'r4');
    expect(isTowerUnlocked(s, 'lyra')).toBe(true);
  });

  it('first clears pay once per map+difficulty; repeats pay less; same run never pays twice', () => {
    const s = defaultSave();
    const r1 = finishRun(s, 'meadow', 'easy', 'victory', 'a');
    expect(r1.firstClear).toBe(true);
    const after1 = s.shards;
    expect(after1).toBeGreaterThanOrEqual(100);
    const again = finishRun(s, 'meadow', 'easy', 'victory', 'a');
    expect(again.shards).toBe(0);
    expect(s.shards).toBe(after1);
    const r2 = finishRun(s, 'meadow', 'easy', 'victory', 'b');
    expect(r2.firstClear).toBe(false);
    expect(s.shards - after1).toBe(25);
    const r3 = finishRun(s, 'meadow', 'hard', 'victory', 'c');
    expect(r3.firstClear).toBe(true);
  });

  it('defeat rewards are small, bounded, and zero for instant restarts', () => {
    const s = defaultSave();
    const quick = finishRun(s, 'meadow', 'easy', 'defeat', 'q', 1);
    expect(quick.shards).toBe(0);
    const mid = finishRun(s, 'meadow', 'easy', 'defeat', 'm', 30);
    expect(mid.shards).toBe(Math.floor(29 * 0.6));
    const long = finishRun(s, 'meadow', 'hard', 'defeat', 'l', 79);
    expect(long.shards).toBeLessThanOrEqual(40);
  });

  it('achievements grant rewards only once', () => {
    const s = defaultSave();
    const sim = newSim({ startGold: 1e6 });
    sim.place('archer', SPOTS[0].x, SPOTS[0].y);
    const got = checkAchievements(s, sim);
    expect(got).toContain('Thorn and Bow');
    const sh = s.shards;
    expect(checkAchievements(s, sim)).toEqual([]);
    expect(s.shards).toBe(sh);
  });

  it('talents are modest and disabled in pure mode', () => {
    const s = defaultSave();
    s.shards = 10000;
    for (let i = 0; i < 6; i++) buyTalent(s, 'gold');
    for (let i = 0; i < 6; i++) buyTalent(s, 'lives');
    expect(s.talents.gold).toBe(5);
    const cfg = campaignConfig(s, 'meadow', 'normal', false, 1);
    expect(cfg.startGold).toBe(Math.round(650 * 1.1));
    expect(cfg.lives).toBe(105);
    const pure = campaignConfig(s, 'meadow', 'normal', true, 1);
    expect(pure.startGold).toBe(650);
    expect(pure.lives).toBe(100);
  });

  it('maps can be bought with shards', () => {
    const s = defaultSave();
    s.shards = 140;
    expect(buyMap(s, 'ruins')).toMatch(/Not enough/);
    s.shards = 150;
    expect(buyMap(s, 'ruins')).toBeNull();
    expect(isMapUnlocked(s, 'ruins')).toBe(true);
    expect(s.shards).toBe(0);
  });

  it('daily challenge is deterministic per date with one reward per date', () => {
    expect(JSON.stringify(dailyInfo('2026-10-01'))).toBe(JSON.stringify(dailyInfo('2026-10-01')));
    expect(dailyInfo('2026-10-01').towers.length).toBeGreaterThan(0);
    const s = defaultSave();
    const run = (id: string) => {
      const info = dailyInfo('2026-10-01');
      const sim = new Sim({ ...campaignConfig(s, info.mapId, 'normal', true, 1), mode: 'daily', dailyDate: '2026-10-01', finalWave: 30 });
      sim.wave = 30;
      sim.state = 'victory';
      return settleRun(s, sim, id, 'victory');
    };
    const a = run('d1');
    const b = run('d2');
    expect(a.lines.join()).toMatch(/\+60/);
    expect(b.lines.join()).toMatch(/already claimed/);
  });
});
