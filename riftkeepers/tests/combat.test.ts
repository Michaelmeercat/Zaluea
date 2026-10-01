import { describe, expect, it } from 'vitest';
import { COLOSSUS } from '../src/data/enemies';
import { findSpot, newSim, spawn, stepN } from './helpers';

const src = (o: Partial<{ armorPierce: number; resistPierce: number; bigMult: number; dot: boolean }> = {}) => ({
  owner: 0, armorPierce: 0, resistPierce: 0, bigMult: 1, ...o,
});

describe('damage rules', () => {
  it('armor reduces each physical/fire/frost hit by 2, minimum 1', () => {
    const sim = newSim();
    const e = spawn(sim, 'bulwark');
    const hp = e.hp;
    sim.damage(e, 2, 'physical', src());
    expect(hp - e.hp).toBeCloseTo(1); // 2-2 => min 1
    sim.damage(e, 5, 'physical', src());
    expect(hp - e.hp).toBeCloseTo(1 + 3);
    sim.damage(e, 5, 'fire', src());
    expect(hp - e.hp).toBeCloseTo(4 + 3);
  });

  it('arcane and acid bypass armor; armor pierce and shred reduce it', () => {
    const sim = newSim();
    const e = spawn(sim, 'bulwark', 300, ['armored']); // armor 4
    expect(e.armor).toBe(4);
    let hp = e.hp;
    sim.damage(e, 3, 'arcane', src());
    expect(hp - e.hp).toBeCloseTo(3);
    hp = e.hp;
    sim.damage(e, 3, 'acid', src());
    expect(hp - e.hp).toBeCloseTo(3);
    hp = e.hp;
    sim.damage(e, 6, 'physical', src({ armorPierce: 1 }));
    expect(hp - e.hp).toBeCloseTo(3);
    e.shredAmt = 2;
    hp = e.hp;
    sim.damage(e, 6, 'physical', src({ armorPierce: 1 }));
    expect(hp - e.hp).toBeCloseTo(5);
    hp = e.hp;
    sim.damage(e, 6, 'physical', src({ armorPierce: 99 }));
    expect(hp - e.hp).toBeCloseTo(6);
  });

  it('damage over time ignores armor', () => {
    const sim = newSim();
    const e = spawn(sim, 'bulwark');
    const hp = e.hp;
    sim.damage(e, 0.5, 'fire', src({ dot: true }));
    expect(hp - e.hp).toBeCloseTo(0.5);
  });

  it('fire/frost resistance cuts 75%, reduced by resist pierce', () => {
    const sim = newSim();
    const ek = spawn(sim, 'emberkin');
    let hp = ek.hp;
    sim.damage(ek, 8, 'fire', src());
    expect(hp - ek.hp).toBeCloseTo(2);
    hp = ek.hp;
    sim.damage(ek, 8, 'fire', src({ resistPierce: 0.5 }));
    expect(hp - ek.hp).toBeCloseTo(8 * (0.25 + 0.375));
    hp = ek.hp;
    sim.damage(ek, 8, 'physical', src());
    expect(hp - ek.hp).toBeCloseTo(8);
    const fr = spawn(sim, 'frostling');
    hp = fr.hp;
    sim.damage(fr, 8, 'frost', src());
    expect(hp - fr.hp).toBeCloseTo(2);
    expect(sim.applyFreeze(fr, 1, 0)).toBe(false);
  });

  it('shields absorb before health', () => {
    const sim = newSim();
    const e = spawn(sim, 'sproutling', 300, ['shield']);
    expect(e.shield).toBeCloseTo(e.maxHp * 0.5);
    const hp = e.hp;
    sim.damage(e, e.shield - 0.5, 'arcane', src());
    expect(e.hp).toBeCloseTo(hp);
    sim.damage(e, 1, 'arcane', src());
    expect(e.shield).toBe(0);
    expect(e.hp).toBeCloseTo(hp - 0.5);
  });

  it('big-enemy multipliers only affect brutes and bosses', () => {
    const sim = newSim();
    const b = spawn(sim, 'brute');
    const s = spawn(sim, 'sproutling');
    let hp = b.hp;
    sim.damage(b, 10, 'arcane', src({ bigMult: 3 }));
    expect(hp - b.hp).toBeCloseTo(30);
    hp = s.hp;
    sim.damage(s, 1, 'arcane', src({ bigMult: 3 }));
    expect(hp - s.hp).toBeCloseTo(1);
  });

  it('marks and shatter amplify damage', () => {
    const sim = newSim();
    const e = spawn(sim, 'mender');
    e.markAmt = 0.5;
    let hp = e.hp;
    sim.damage(e, 10, 'arcane', src());
    expect(hp - e.hp).toBeCloseTo(15);
    e.markAmt = 0;
    sim.applyFreeze(e, 1, 0.5);
    hp = e.hp;
    sim.damage(e, 10, 'arcane', src());
    expect(hp - e.hp).toBeCloseTo(15);
  });
});

describe('concealment detection', () => {
  it('towers without detection cannot target concealed enemies', () => {
    const sim = newSim({ startGold: 1e6 });
    const id = sim.place('archer', 300, 250).id!;
    const t = sim.towerById(id)!;
    const w = spawn(sim, 'wisp', 250);
    sim.rebuildGrid();
    expect(sim.canTarget(t, w)).toBe(false);
    expect(sim.pickTarget(t, sim.effRange(t), 'first')).toBeUndefined();
    sim.upgrade(id, 2); // Keen Eyes
    expect(sim.canTarget(t, w)).toBe(true);
    expect(sim.pickTarget(t, sim.effRange(t), 'first')?.id).toBe(w.id);
  });

  it('exposure and beacon detection grant targeting', () => {
    const sim = newSim({ startGold: 1e6 });
    const id = sim.place('archer', 300, 250).id!;
    const t = sim.towerById(id)!;
    const w = spawn(sim, 'wisp', 250);
    w.exposedT = 1;
    expect(sim.canTarget(t, w)).toBe(true);
    w.exposedT = 0;
    const bs = findSpot(sim, 'beacon', 300, 250, 110, 45);
    const b = sim.place('beacon', bs.x, bs.y).id!;
    sim.upgrade(b, 1);
    sim.upgrade(b, 1); // Revealing Light
    sim.recomputeBuffs();
    expect(t.buffs.detect).toBe(true);
    expect(sim.canTarget(t, w)).toBe(true);
    sim.sell(b);
    sim.recomputeBuffs();
    expect(sim.canTarget(t, w)).toBe(false);
  });
});

describe('support buffs', () => {
  it('identical buffs do not stack; strongest wins; removal updates immediately', () => {
    const sim = newSim({ startGold: 1e7 });
    const a = sim.place('archer', 300, 250).id!;
    const s1 = findSpot(sim, 'beacon', 300, 250, 110, 45);
    const b1 = sim.place('beacon', s1.x, s1.y).id!;
    const b2 = sim.place('beacon', 900, 600).id!; // far away
    const s3 = findSpot(sim, 'beacon', 300, 250, 120, 45);
    const b3 = sim.place('beacon', s3.x, s3.y).id!;
    sim.upgrade(b1, 0); // +10%
    for (let i = 0; i < 4; i++) sim.upgrade(b3, 0); // +25%
    sim.step();
    const t = sim.towerById(a)!;
    expect(t.buffs.atkSpeed).toBeCloseTo(0.25);
    expect(sim.effInterval(t)).toBeCloseTo(0.65 / 1.25);
    sim.sell(b3);
    sim.step();
    expect(t.buffs.atkSpeed).toBeCloseTo(0.1);
    // different categories combine
    sim.upgrade(b1, 2);
    sim.step();
    expect(t.buffs.atkSpeed).toBeCloseTo(0.1);
    void b2;
  });

  it('beacons never buff beacons (no feedback loops)', () => {
    const sim = newSim({ startGold: 1e7 });
    const b1 = sim.place('beacon', 470, 220).id!;
    const s2 = findSpot(sim, 'beacon', 470, 220, 110, 45);
    const b2 = sim.place('beacon', s2.x, s2.y).id!;
    for (let i = 0; i < 2; i++) sim.upgrade(b1, 1);
    sim.upgrade(b1, 0);
    sim.step();
    expect(sim.towerById(b2)!.buffs.rangePct).toBe(0);
    expect(sim.towerById(b2)!.buffs.atkSpeed).toBe(0);
  });
});

describe('debuff rules', () => {
  it('slows keep one slot per source, strongest applies, capped', () => {
    const sim = newSim();
    const e = spawn(sim, 'sproutling');
    sim.applySlow(e, 'frost', 0.25, 1);
    sim.applySlow(e, 'frost', 0.4, 0.5);
    expect(e.slows.length).toBe(1);
    expect(e.slows[0].amt).toBeCloseTo(0.4);
    expect(e.slows[0].t).toBeCloseTo(1);
    sim.applySlow(e, 'snare', 0.3, 2);
    expect(sim.slowFactor(e)).toBeCloseTo(0.6);
    sim.applySlow(e, 'aura', 0.95, 1);
    expect(sim.slowFactor(e)).toBeCloseTo(0.25);
  });

  it('bosses take half slows and cannot be frozen or stunned', () => {
    const sim = newSim();
    const b = spawn(sim, 'colossus');
    sim.applySlow(b, 'frost', 0.6, 2);
    expect(sim.slowFactor(b)).toBeCloseTo(1 - 0.6 * COLOSSUS.slowEffect);
    expect(sim.applyFreeze(b, 2, 0)).toBe(false);
    sim.applyStun(b, 2);
    expect(b.stunT).toBe(0);
  });

  it('freeze grants brief immunity afterwards (no permanent lock)', () => {
    const sim = newSim();
    const e = spawn(sim, 'sproutling');
    expect(sim.applyFreeze(e, 0.5, 0)).toBe(true);
    expect(sim.applyFreeze(e, 0.5, 0)).toBe(false);
    stepN(sim, 32);
    expect(e.freezeT).toBeLessThanOrEqual(0);
    expect(sim.applyFreeze(e, 0.5, 0)).toBe(false); // immune
    stepN(sim, 62);
    expect(sim.applyFreeze(e, 0.5, 0)).toBe(true);
  });

  it('burns refresh to the longer duration and keep the stronger dps', () => {
    const sim = newSim();
    const e = spawn(sim, 'mender');
    sim.applyBurn(e, 4, 5, 0, 0);
    sim.applyBurn(e, 2, 8, 0, 0);
    expect(e.burnDps).toBe(4);
    expect(e.burnT).toBe(8);
    sim.applyBurn(e, 6, 1, 0, 0);
    expect(e.burnDps).toBe(6);
    expect(e.burnT).toBe(8);
  });

  it('menders heal nearby enemies but never above max', () => {
    const sim = newSim();
    const m = spawn(sim, 'mender', 300);
    const s = spawn(sim, 'bulwark', 310);
    s.hp = s.maxHp - 1;
    sim.rebuildGrid();
    m.healCd = 0;
    sim.updateMender(m, 0.016);
    expect(s.hp).toBe(s.maxHp);
    s.hp = 5;
    m.healCd = 0;
    sim.updateMender(m, 0.016);
    expect(s.hp).toBeCloseTo(5 + s.maxHp * 0.08);
  });

  it('regenerating enemies heal only after a delay without damage', () => {
    const sim = newSim();
    const e = spawn(sim, 'bulwark', 300, ['regen']);
    e.hp = 10;
    stepN(sim, 60);
    expect(e.hp).toBeCloseTo(10);
    stepN(sim, 120);
    expect(e.hp).toBeGreaterThan(10);
  });
});

describe('targeting', () => {
  it('first/last/strong/close are stable', () => {
    const sim = newSim({ startGold: 1e6 });
    const id = sim.place('archer', 300, 250).id!;
    const t = sim.towerById(id)!;
    const a = spawn(sim, 'sproutling', 250);
    const b = spawn(sim, 'bulwark', 330);
    const c = spawn(sim, 'sproutling', 400);
    sim.rebuildGrid();
    const r = sim.effRange(t) + 50;
    expect(sim.pickTarget(t, r, 'first')?.id).toBe(c.id);
    expect(sim.pickTarget(t, r, 'last')?.id).toBe(a.id);
    expect(sim.pickTarget(t, r, 'strong')?.id).toBe(b.id);
    const d = spawn(sim, 'sproutling', 400); // exact tie with c
    sim.rebuildGrid();
    expect(sim.pickTarget(t, r, 'first')?.id).toBe(c.id);
    void d;
  });
});

describe('boss phases', () => {
  it('colossus moves through 3 phases with summons capped and no invulnerability', () => {
    const sim = newSim();
    sim.wave = 40;
    sim.waveActive = true;
    const b = spawn(sim, 'colossus', 100);
    stepN(sim, 60 * 6);
    expect(b.boss!.phase).toBe(1);
    expect(b.boss!.tempShield > 0 || b.boss!.telegraph === 'shield' || b.boss!.shieldCd > 0).toBe(true);
    b.hp = b.maxHp * 0.5;
    for (let i = 0; i < 60 * 120; i++) {
      sim.step();
      for (const e of sim.enemies) if (e !== b && e.alive) e.dist = Math.min(e.dist, 200); // keep summons on the map
      b.dist = 300;
    }
    expect(b.boss!.phase).toBe(2);
    expect(b.boss!.summonsTotal).toBeLessThanOrEqual(COLOSSUS.summonMaxTotal);
    expect(b.boss!.summonsAlive).toBeLessThanOrEqual(COLOSSUS.summonMaxAlive);
    const summons = sim.enemies.filter((e) => e.parentBoss === b.id);
    expect(summons.every((s) => s.path === b.path)).toBe(true);
    expect(summons.every((s) => s.reward === 0)).toBe(true);
    b.hp = b.maxHp * 0.2;
    stepN(sim, 60 * 12);
    expect(b.boss!.phase).toBe(3);
    // harden halves damage at most; never fully invulnerable
    b.boss!.hardenT = 2;
    const hp = b.hp;
    sim.damage(b, 100, 'arcane', src());
    expect(hp - b.hp).toBeCloseTo(50);
  });
});

describe('cross-path combinations', () => {
  it('rail shots still chain when Chain Lightning tiers are owned', () => {
    const sim = newSim({ startGold: 1e7 });
    const id = sim.place('storm', 300, 250).id!;
    sim.upgrade(id, 0); // Arc Coil: chain 1
    for (let i = 0; i < 3; i++) sim.upgrade(id, 1); // Rail Driver
    const t = sim.towerById(id)!;
    expect(t.base.rail).toBe(true);
    expect(t.base.chain).toBe(1);
    const a = spawn(sim, 'mender', 200);
    sim.rebuildGrid();
    const calls: number[] = [];
    const orig = sim.chainFrom.bind(sim);
    sim.chainFrom = (p, first) => { calls.push(first.id); orig(p, first); };
    sim.fireRail(t, a, 10, 'arcane');
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(calls).toEqual([a.id]);
    // without chain tiers no arc is attempted
    const id2 = sim.place('storm', 860, 450).id!;
    for (let i = 0; i < 3; i++) sim.upgrade(id2, 1);
    calls.length = 0;
    sim.fireRail(sim.towerById(id2)!, a, 10, 'arcane');
    expect(calls).toEqual([]);
  });
});
