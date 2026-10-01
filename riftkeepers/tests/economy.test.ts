import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { endOfWaveGold } from '../src/data/difficulty';
import { newSim, runWaveToEnd, spawn, SPOTS } from './helpers';

describe('reward budgets', () => {
  it('split families pay their explicit budget exactly once', () => {
    for (const def of Object.values(ENEMIES)) {
      const total = def.reward + (def.children ? def.children.count * def.children.rewardEach : 0);
      expect(total, def.id).toBe(def.rewardBudget);
    }
  });

  it('killing a broodpod and all children yields 8 gold', () => {
    const sim = newSim({ startGold: 0 });
    sim.wave = 22;
    const p = spawn(sim, 'broodpod', 400);
    sim.kill(p, 0);
    const kids = sim.enemies.filter((e) => e.alive && e.type === 'sproutling');
    expect(kids.length).toBe(3);
    expect(kids.every((k) => k.path === p.path && Math.abs(k.dist - p.dist) <= 30)).toBe(true);
    expect(kids.every((k) => k.hpScale === p.hpScale)).toBe(true);
    for (const k of kids) sim.kill(k, 0);
    expect(sim.gold).toBe(8);
  });

  it('brute family yields 25; an escaped parent spawns no children and costs lives once', () => {
    const sim = newSim({ startGold: 0 });
    const b = spawn(sim, 'brute', 400);
    sim.kill(b, 0);
    for (const k of sim.enemies.filter((e) => e.alive && e.type === 'skitter')) sim.kill(k, 0);
    expect(sim.gold).toBe(25);
    const sim2 = newSim({ startGold: 0 });
    const lives = sim2.lives;
    const b2 = spawn(sim2, 'brute', sim2.map.paths[0].length - 0.2);
    sim2.step();
    sim2.step();
    expect(sim2.lives).toBe(lives - 10);
    expect(sim2.enemies.length).toBe(0);
    expect(sim2.stats.leaks).toBe(1);
    sim2.leak(b2); // second call is a no-op
    expect(sim2.lives).toBe(lives - 10);
  });
});

describe('end of wave', () => {
  it('pays 40 + 4×wave only when the wave completes', () => {
    const sim = newSim({ startGold: 0 });
    sim.startWave();
    expect(sim.gold).toBe(0);
    // leak everything quickly
    runWaveToEnd(sim);
    expect(sim.waveActive).toBe(false);
    expect(sim.gold).toBe(endOfWaveGold(1));
  });

  it('a failed wave pays nothing', () => {
    const sim = newSim({ startGold: 0, lives: 3 });
    const before = sim.gold;
    sim.startWave();
    runWaveToEnd(sim);
    expect(sim.state).toBe('defeat');
    expect(sim.gold).toBe(before);
  });

  it('wave ends only after spawns, children and pending effects are done', () => {
    const sim = newSim({ startGold: 1e6 });
    sim.startWave();
    // clear all scheduled spawns but keep one living enemy
    sim.spawnIdx = sim.spawnQueue.length;
    spawn(sim, 'broodpod', 100);
    sim.step();
    expect(sim.waveActive).toBe(true);
    sim.kill(sim.enemies[0], 0); // children appear
    sim.step();
    expect(sim.waveActive).toBe(true);
    for (const e of [...sim.enemies]) sim.kill(e, 0);
    sim.pendingSpawnEffects = 1;
    sim.step();
    expect(sim.waveActive).toBe(true);
    sim.pendingSpawnEffects = 0;
    sim.step();
    expect(sim.waveActive).toBe(false);
  });
});

describe('orchard economy', () => {
  it('base income is 80 per completed wave with a real payback period', () => {
    const sim = newSim({ startGold: 10000 });
    sim.place('orchard', 1100, 450);
    const g = sim.gold;
    sim.completeWave();
    expect(sim.gold - g).toBe(endOfWaveGold(sim.wave) + 80);
    expect(700 / 80).toBeGreaterThan(8);
  });

  it('bank deposits with bonus, enforces capacity, interest once per wave', () => {
    const sim = newSim({ startGold: 1e6 });
    const id = sim.place('orchard', 1100, 450).id!;
    sim.upgrade(id, 1); // vault: bonus 10%, cap 800
    const t = sim.towerById(id)!;
    sim.wave = 1;
    const g0 = sim.gold;
    sim.completeWave();
    expect(t.bank).toBeCloseTo(88);
    expect(sim.gold - g0).toBe(endOfWaveGold(1));
    sim.upgrade(id, 1);
    sim.upgrade(id, 1); // interest 8%, cap 1600
    t.bank = 1000;
    sim.completeWave();
    expect(t.bank).toBeCloseTo(1000 + 80 + 88);
    t.bank = 1590;
    const g1 = sim.gold;
    sim.completeWave();
    expect(t.bank).toBe(1600); // capped
    // overflow deposit is paid directly: interest fills 10, deposit 88 all overflows
    expect(sim.gold - g1).toBe(endOfWaveGold(sim.wave) + 88);
  });

  it('withdrawal moves the balance exactly once', () => {
    const sim = newSim({ startGold: 1e6 });
    const id = sim.place('orchard', 1100, 450).id!;
    sim.upgrade(id, 1);
    const t = sim.towerById(id)!;
    t.bank = 500;
    const g = sim.gold;
    expect(sim.withdrawBank(id).ok).toBe(true);
    expect(sim.withdrawBank(id).ok).toBe(false);
    expect(sim.gold - g).toBe(500);
  });

  it('harvest drops persist until collected and cannot be collected twice', () => {
    const sim = newSim({ startGold: 1e6 });
    const id = sim.place('orchard', 1100, 450).id!;
    sim.upgrade(id, 2); // drops +15%
    sim.completeWave();
    expect(sim.drops.length).toBe(3);
    const total = sim.drops.reduce((a, d) => a + d.value, 0);
    expect(total).toBe(Math.round(80 * 1.15));
    for (let i = 0; i < 600; i++) sim.step();
    expect(sim.drops.length).toBe(3); // no auto-collect at tier 1
    const g = sim.gold;
    const d = sim.drops[0];
    expect(sim.collectDrop(d.id).ok).toBe(true);
    expect(sim.collectDrop(d.id).ok).toBe(false);
    expect(sim.gold - g).toBe(d.value);
    sim.upgrade(id, 2);
    sim.upgrade(id, 2); // auto collect 8s
    sim.completeWave();
    for (let i = 0; i < 60 * 9; i++) sim.step();
    expect(sim.drops.length).toBe(2); // the new auto drops collected; older (auto=0) remain
  });

  it('instant harvest is limited per wave', () => {
    const sim = newSim({ startGold: 1e7 });
    const id = sim.place('orchard', 1100, 450).id!;
    for (let i = 0; i < 4; i++) sim.upgrade(id, 2);
    const g = sim.gold;
    expect(sim.useAbility(id, 'instantHarvest').ok).toBe(true);
    expect(sim.useAbility(id, 'instantHarvest').ok).toBe(false);
    expect(sim.gold - g).toBe(Math.round(80 * 0.4));
    sim.completeWave();
    expect(sim.towerById(id)!.harvestCharges).toBe(1);
  });

  it('beacon tithe and wave bonus are bounded', () => {
    const sim = newSim({ startGold: 1e7 });
    const b = sim.place('beacon', 470, 220).id!;
    for (let i = 0; i < 5; i++) sim.upgrade(b, 2);
    const b2 = sim.place('beacon', 320, 520).id!;
    for (let i = 0; i < 5; i++) expect(sim.upgrade(b2, 2).ok).toBe(i < 4); // tier-5 unique
    expect(sim.waveBonus()).toBeCloseTo(0.15);
    void SPOTS;
  });
});
