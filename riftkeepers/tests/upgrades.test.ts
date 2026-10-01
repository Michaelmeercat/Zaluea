import { describe, expect, it } from 'vitest';
import { TOWER_TYPES } from '../src/core/types';
import { DIFFICULTY } from '../src/data/difficulty';
import { TIER_MULT, TOWERS, canUpgradePath, computeStats, defaultStats } from '../src/data/towers';
import { roundPrice } from '../src/core/math';
import { findSpot, newSim, SPOTS } from './helpers';

describe('cross-path upgrade rules', () => {
  it('allows two paths, only one beyond tier 2', () => {
    expect(canUpgradePath([0, 0, 0], 0).ok).toBe(true);
    expect(canUpgradePath([2, 2, 0], 0).ok).toBe(true); // 2/2 -> 3/2 is fine
    expect(canUpgradePath([3, 2, 0], 1).ok).toBe(false); // secondary capped at 2
    expect(canUpgradePath([3, 1, 0], 1).ok).toBe(true); // secondary up to 2
    expect(canUpgradePath([1, 1, 0], 2).ok).toBe(false); // third path locked
    expect(canUpgradePath([5, 2, 0], 0).ok).toBe(false); // complete
    expect(canUpgradePath([2, 3, 0], 0).ok).toBe(false); // B is past tier 2, so A caps at 2
    expect(canUpgradePath([2, 3, 0], 1).ok).toBe(true);
    expect(canUpgradePath([3, 0, 0], 0, 3).ok).toBe(false); // challenge tier cap
  });

  it('explains locked upgrades', () => {
    const r = canUpgradePath([1, 1, 0], 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/two paths/);
    const r2 = canUpgradePath([3, 2, 0], 1);
    if (!r2.ok) expect(r2.reason).toMatch(/tier 2/);
  });

  it('only one tier-5 per tower type and path', () => {
    const sim = newSim({ startGold: 1e7 });
    const a = sim.place('archer', SPOTS[0].x, SPOTS[0].y).id!;
    const b = sim.place('archer', SPOTS[1].x, SPOTS[1].y).id!;
    for (let i = 0; i < 5; i++) expect(sim.upgrade(a, 0).ok).toBe(true);
    for (let i = 0; i < 4; i++) expect(sim.upgrade(b, 0).ok).toBe(true);
    const r = sim.upgrade(b, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/tier-5/);
    // a different path's tier 5 is allowed on the second archer
    const c = sim.place('archer', SPOTS[2].x, SPOTS[2].y).id!;
    for (let i = 0; i < 5; i++) expect(sim.upgrade(c, 1).ok).toBe(true);
    // selling the first frees the slot
    sim.sell(a);
    expect(sim.upgrade(b, 0).ok).toBe(true);
  });
});

describe('every upgrade changes real stats', () => {
  it('each of the 90 upgrades modifies at least one stat', () => {
    let count = 0;
    for (const t of TOWER_TYPES) {
      for (let p = 0; p < 3; p++) {
        for (let tier = 1; tier <= 5; tier++) {
          const before = computeStats(t, p === 0 ? [tier - 1, 0, 0] : p === 1 ? [0, tier - 1, 0] : [0, 0, tier - 1]);
          const after = computeStats(t, p === 0 ? [tier, 0, 0] : p === 1 ? [0, tier, 0] : [0, 0, tier]);
          expect(JSON.stringify(after), `${t} path ${p} tier ${tier}`).not.toEqual(JSON.stringify(before));
          count++;
        }
      }
    }
    expect(count).toBe(90);
  });

  it('cross-path effects combine', () => {
    const s = computeStats('archer', [2, 0, 3]); // +1 dmg, +25% range, detect, homing, snare
    expect(s.damage).toBe(3);
    expect(s.detect).toBe(true);
    expect(s.homing).toBe(true);
    expect(s.slow).toBeCloseTo(0.3);
    expect(s.range).toBeCloseTo(145 * 1.25 * 1.15);
    const st = computeStats('storm', [3, 0, 2]);
    expect(st.chain).toBe(4);
    expect(st.detect).toBe(true);
    expect(st.interval).toBeCloseTo(0.8 * 0.8);
  });

  it('defaults are sane', () => {
    expect(defaultStats().bigMult).toBe(1);
  });
});

describe('gold and prices', () => {
  it('applies difficulty price multipliers with consistent rounding', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const sim = newSim({ difficulty: d, startGold: 1e6 });
      expect(sim.towerCost('archer')).toBe(roundPrice(180 * DIFFICULTY[d].costMult));
      expect(sim.towerCost('storm')).toBe(roundPrice(650 * DIFFICULTY[d].costMult));
      const id = sim.place('archer', SPOTS[0].x, SPOTS[0].y).id!;
      const t = sim.towerById(id)!;
      expect(sim.upgradeCost(t, 0)).toBe(roundPrice(180 * TIER_MULT[0] * DIFFICULTY[d].costMult));
    }
  });

  it('deducts the displayed price only on successful placement', () => {
    const sim = newSim({ startGold: 1000 });
    const price = sim.towerCost('archer');
    const bad = sim.place('archer', 300, 130); // on the road
    expect(bad.ok).toBe(false);
    expect(sim.gold).toBe(1000);
    const ok = sim.place('archer', SPOTS[0].x, SPOTS[0].y);
    expect(ok.ok).toBe(true);
    expect(sim.gold).toBe(1000 - price);
  });

  it('refuses purchases without enough gold', () => {
    const sim = newSim({ startGold: 100 });
    expect(sim.place('archer', SPOTS[0].x, SPOTS[0].y).ok).toBe(false);
    expect(sim.gold).toBe(100);
  });

  it('sells for 70% of the total actually invested', () => {
    const sim = newSim({ startGold: 10000 });
    const id = sim.place('archer', SPOTS[0].x, SPOTS[0].y).id!;
    sim.upgrade(id, 0);
    sim.upgrade(id, 0);
    const t = sim.towerById(id)!;
    const invested = 180 + 110 + 215;
    expect(t.invested).toBe(invested);
    const before = sim.gold;
    sim.sell(id);
    expect(sim.gold - before).toBe(Math.floor(invested * 0.7));
    expect(sim.towers.length).toBe(0);
  });

  it('beacon discounts are bounded, local, and selling refunds the discounted amount', () => {
    const sim = newSim({ startGold: 1e6 });
    const b = sim.place('beacon', 470, 220).id!;
    for (let i = 0; i < 5; i++) sim.upgrade(b, 2);
    expect(sim.discountAt(470, 300)).toBeCloseTo(0.15);
    expect(sim.discountAt(1100, 450)).toBe(0);
    const sp = findSpot(sim, 'archer', 470, 220, 110, 45);
    const price = sim.towerCost('archer', sp.x, sp.y);
    expect(price).toBe(roundPrice(180 * 0.85));
    const before = sim.gold;
    const id = sim.place('archer', sp.x, sp.y).id!;
    expect(before - sim.gold).toBe(price);
    const t = sim.towerById(id)!;
    expect(t.invested).toBe(price);
    // floor: discount never exceeds 30% even if data were more generous
    expect(sim.priceFor(1000, 470, 300)).toBeGreaterThanOrEqual(700);
  });

  it('selling removes the tower\'s projectiles, zones and drones', () => {
    const sim = newSim({ startGold: 1e6 });
    const id = sim.place('alchemist', SPOTS[0].x, SPOTS[0].y).id!;
    for (let i = 0; i < 3; i++) sim.upgrade(id, 1);
    sim.zones.push({ id: 999, owner: id, x: 300, y: 130, r: 30, dps: 5, t: 5, max: 5, burnDps: 0, burnDur: 0 });
    sim.drones.push({ id: 998, owner: id, x: 0, y: 0, ang: 0, life: 10, cd: 1, orbit: 40 });
    sim.sell(id);
    expect(sim.zones.length).toBe(0);
    expect(sim.drones.length).toBe(0);
  });
});

describe('placement rules', () => {
  it('rejects road, blockers, overlaps and edges with reasons', () => {
    const sim = newSim({ startGold: 1e6 });
    expect(sim.checkPlace('archer', 300, 130)).toMatchObject({ ok: false, reason: expect.stringMatching(/road/) });
    expect(sim.checkPlace('archer', 150, 330)).toMatchObject({ ok: false, reason: expect.stringMatching(/pond/) });
    expect(sim.checkPlace('archer', 5, 400)).toMatchObject({ ok: false, reason: expect.stringMatching(/edge/) });
    sim.place('archer', 300, 250);
    expect(sim.checkPlace('archer', 310, 255)).toMatchObject({ ok: false, reason: expect.stringMatching(/Overlaps/) });
  });

  it('frostglass only allows building on ledges', () => {
    const sim = newSim({ mapId: 'frostglass', startGold: 1e6 });
    expect(sim.checkPlace('archer', 600, 190).ok).toBe(true);
    expect(sim.checkPlace('archer', 600, 330).ok).toBe(false);
  });

  it('market obstacles block until cleared for their price', () => {
    const sim = newSim({ mapId: 'market', startGold: 1000 });
    const o = sim.map.def.obstacles!.find((x) => x.id === 'barrels-b')!;
    expect(sim.checkPlace('archer', o.x, o.y).ok).toBe(false);
    expect(sim.removeObstacle(o.id).ok).toBe(true);
    expect(sim.gold).toBe(1000 - o.cost);
    expect(sim.checkPlace('archer', o.x, o.y).ok).toBe(true);
    expect(sim.removeObstacle(o.id).ok).toBe(false);
  });

  it('only one hero', () => {
    const sim = newSim({ startGold: 1e6 });
    expect(sim.place('lyra', SPOTS[0].x, SPOTS[0].y).ok).toBe(true);
    expect(sim.place('lyra', SPOTS[1].x, SPOTS[1].y).ok).toBe(false);
  });

  it('enforces challenge restrictions', () => {
    const sim = newSim({ startGold: 1e6, allowedTowers: ['archer', 'warden'], maxTowers: 2, noSelling: true });
    expect(sim.place('alchemist', SPOTS[0].x, SPOTS[0].y).ok).toBe(false);
    const a = sim.place('archer', SPOTS[0].x, SPOTS[0].y).id!;
    expect(sim.place('warden', SPOTS[1].x, SPOTS[1].y).ok).toBe(true);
    expect(sim.place('archer', SPOTS[2].x, SPOTS[2].y).ok).toBe(false);
    expect(sim.sell(a).ok).toBe(false);
  });
});

describe('data integrity', () => {
  it('all towers have 3 paths x 5 upgrades with descriptions', () => {
    for (const t of TOWER_TYPES) {
      expect(TOWERS[t].paths.length).toBe(3);
      for (const p of TOWERS[t].paths) {
        expect(p.upgrades.length).toBe(5);
        for (const u of p.upgrades) expect(u.desc.length).toBeGreaterThan(8);
      }
    }
  });
});
