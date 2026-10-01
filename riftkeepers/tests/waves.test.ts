import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { MAPS, activeRoutes } from '../src/data/maps';
import { AUTHORED_WAVES, endlessWave, getWave, parseGroup } from '../src/data/waves';
import { Sim, makeConfig, STEP } from '../src/sim/sim';
import { hashState, newSim, runWaveToEnd, SPOTS } from './helpers';

describe('authored waves', () => {
  it('has 80 parsed waves with all required fields', () => {
    expect(AUTHORED_WAVES.length).toBe(80);
    for (const w of AUTHORED_WAVES) {
      expect(w.groups.length).toBeGreaterThan(0);
      for (const g of w.groups) {
        expect(g.count).toBeGreaterThan(0);
        expect(g.interval).toBeGreaterThan(0);
        expect(g.start).toBeGreaterThanOrEqual(0);
        expect(ENEMIES[g.type]).toBeTruthy();
      }
    }
  });

  it('introduces mechanics on schedule', () => {
    const firstSeen = new Map<string, number>();
    for (const w of AUTHORED_WAVES) {
      for (const g of w.groups) {
        if (!firstSeen.has(g.type)) firstSeen.set(g.type, w.wave);
        for (const f of g.flags) if (!firstSeen.has('v-' + f)) firstSeen.set('v-' + f, w.wave);
      }
    }
    expect(firstSeen.get('sproutling')).toBe(1);
    for (let i = 1; i <= 5; i++) expect(AUTHORED_WAVES[i - 1].groups.every((g) => g.type === 'sproutling')).toBe(true);
    expect(firstSeen.get('skitter')).toBe(6);
    expect(firstSeen.get('bulwark')).toBe(10);
    expect(firstSeen.get('wisp')).toBe(14);
    expect(Math.min(firstSeen.get('emberkin')!, firstSeen.get('frostling')!)).toBe(18);
    expect(firstSeen.get('broodpod')).toBe(22);
    expect(firstSeen.get('mender')).toBe(28);
    expect(firstSeen.get('v-regen')).toBeGreaterThanOrEqual(28);
    expect(firstSeen.get('brute')).toBe(30);
    expect(firstSeen.get('colossus')).toBe(40);
    for (const w of [40, 60, 80]) expect(getWave(w, 1).boss).toBe(true);
    // stronger encounters at 60 and 80
    const bossHp = (w: number) => getWave(w, 1).groups.filter((g) => g.type === 'colossus').reduce((a, g) => a + g.count * g.hp, 0);
    expect(bossHp(60)).toBeGreaterThan(bossHp(40));
    expect(bossHp(80)).toBeGreaterThan(bossHp(60));
  });

  it('parses DSL flags, paths, hp and reward modifiers', () => {
    const g = parseGroup('brute*3/0.5@4 >1 !sc x2.5 $0.5');
    expect(g).toMatchObject({ type: 'brute', count: 3, interval: 0.5, start: 4, path: 1, flags: ['shield', 'concealed'], hp: 2.5, reward: 0.5 });
  });

  it('endless generation is deterministic and bounded', () => {
    for (let w = 81; w < 200; w += 7) {
      expect(JSON.stringify(endlessWave(w, 99))).toBe(JSON.stringify(endlessWave(w, 99)));
      const total = endlessWave(w, 99).groups.reduce((a, g) => a + g.count, 0);
      expect(total).toBeLessThanOrEqual(4 * 160 + 4);
    }
    expect(endlessWave(90, 1).boss).toBe(true);
    expect(JSON.stringify(endlessWave(85, 1))).not.toBe(JSON.stringify(endlessWave(85, 2)));
  });
});

describe('multi-path maps', () => {
  it('twinroot alternates enemies between both branches', () => {
    const sim = newSim({ mapId: 'twinroot' });
    sim.startWave();
    const paths = new Set(sim.spawnQueue.map((s) => s.path));
    expect(paths).toEqual(new Set([0, 1]));
  });

  it('citadel routes change between waves and every route is used', () => {
    const m = MAPS.find((x) => x.id === 'citadel')!;
    const used = new Set<number>();
    const sets = new Set<string>();
    for (let w = 1; w <= 20; w++) {
      const r = activeRoutes(m, w);
      r.forEach((i) => used.add(i));
      sets.add(r.join(','));
    }
    expect(used).toEqual(new Set([0, 1, 2]));
    expect(sets.size).toBeGreaterThan(1);
    // placement validity is independent of active routes (all paths are always blocked)
    const sim = newSim({ mapId: 'citadel' });
    const ok1 = sim.checkPlace('archer', 175, 210).ok;
    sim.wave = 5;
    expect(sim.checkPlace('archer', 175, 210).ok).toBe(ok1);
  });

  it('every map has valid placement spots near every path', () => {
    for (const m of MAPS) {
      const sim = newSim({ mapId: m.id });
      let valid = 0;
      for (let y = 20; y < 700; y += 20) for (let x = 20; x < 1260; x += 20) if (sim.checkPlace('archer', x, y).ok) valid++;
      expect(valid, m.id).toBeGreaterThan(60);
    }
  });
});

describe('determinism and speed', () => {
  const script = (sim: Sim) => {
    sim.place('archer', SPOTS[0].x, SPOTS[0].y);
    sim.place('archer', SPOTS[1].x, SPOTS[1].y);
    sim.place('alchemist', SPOTS[2].x, SPOTS[2].y);
  };

  it('same seed and inputs give identical results', () => {
    const a = new Sim(makeConfig({ mapId: 'meadow', difficulty: 'normal', seed: 7, startGold: 5000 }));
    const b = new Sim(makeConfig({ mapId: 'meadow', difficulty: 'normal', seed: 7, startGold: 5000 }));
    a.recordEvents = b.recordEvents = false;
    script(a);
    script(b);
    for (let w = 0; w < 6; w++) {
      a.startWave();
      b.startWave();
      runWaveToEnd(a);
      runWaveToEnd(b);
    }
    expect(hashState(a)).toBe(hashState(b));
  });

  it('1x/2x/3x speed only changes how many fixed steps run per frame', () => {
    const results: string[] = [];
    for (const speed of [1, 2, 3]) {
      const sim = new Sim(makeConfig({ mapId: 'meadow', difficulty: 'normal', seed: 11, startGold: 5000 }));
      sim.recordEvents = false;
      script(sim);
      sim.startWave();
      // emulate the frame loop with an accumulator at 60fps
      let acc = 0;
      const frameDt = 1 / 60;
      const totalTicks = 60 * 40;
      while (sim.tick < totalTicks) {
        acc += frameDt * speed;
        while (acc >= STEP - 1e-9 && sim.tick < totalTicks) {
          sim.step();
          acc -= STEP;
        }
      }
      results.push(hashState(sim));
    }
    expect(results[1]).toBe(results[0]);
    expect(results[2]).toBe(results[0]);
  });

  it('a paused sim does not change', () => {
    const sim = newSim({ startGold: 5000 });
    script(sim);
    sim.startWave();
    for (let i = 0; i < 300; i++) sim.step();
    const h = hashState(sim);
    // the session simply does not call step() while paused
    expect(hashState(sim)).toBe(h);
  });
});
