import { clickWorld, seed, spots } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=tab-sandbox]');
  await page.click('[data-testid=sandbox-meadow]');
  await page.waitForSelector('.sandbox-tools');
  const types = ['archer', 'alchemist', 'warden', 'storm', 'beacon', 'orchard', 'lyra'];
  // paths to show per tower: 5/2 on different primaries
  const plans = { archer: [[5, 2, 0], [0, 5, 2], [2, 0, 5]], alchemist: [[5, 0, 2], [2, 5, 0], [0, 2, 5]], warden: [[5, 2, 0], [0, 5, 2], [2, 0, 5]], storm: [[5, 0, 2], [2, 5, 0], [0, 2, 5]], beacon: [[5, 2, 0]], orchard: [[5, 2, 0]], lyra: [[0, 0, 0]] };
  const placed = [];
  for (const t of types) {
    for (const lv of plans[t]) {
      const [p] = await spots(page, t, 1, 50);
      if (!p) { ctx.log('no spot for', t); continue; }
      await page.click(`[data-testid=shop-${t}]`);
      await clickWorld(page, p.x, p.y);
      const id = await page.evaluate(() => { const s = window.__rk.sim(); return s.towers[s.towers.length - 1].id; });
      const res = await page.evaluate(([id, lv]) => {
        const s = window.__rk.sim(); const out = [];
        // buy in an order that respects cross-path rules: secondary first up to 2, then primary
        const order = [];
        lv.forEach((n, path) => { if (n <= 2) for (let i = 0; i < n; i++) order.push(path); });
        lv.forEach((n, path) => { if (n > 2) for (let i = 0; i < n; i++) order.push(path); });
        for (const path of order) { const r = s.upgrade(id, path); if (!r.ok) out.push(r.reason); }
        return out;
      }, [id, lv]);
      placed.push({ t, lv: lv.join(''), errors: res });
    }
  }
  ctx.log(JSON.stringify(placed));
  await page.waitForTimeout(600);
  await ctx.shot('sandbox-towers');
  // spawn every enemy with variants via the UI spawner
  const enemies = ['sproutling', 'skitter', 'bulwark', 'wisp', 'emberkin', 'frostling', 'broodpod', 'mender', 'brute', 'colossus'];
  for (const e of enemies) {
    await page.selectOption('.sandbox-tools select', e);
    await page.click('[data-testid=sb-spawn1]');
  }
  // variants
  await page.selectOption('.sandbox-tools select', 'bulwark');
  for (const v of ['Concealed', 'Regenerating', 'Shielded', 'Reinforced']) await page.check(`.chips label:has-text("${v}") input`);
  await page.click('[data-testid=sb-spawn1]');
  await page.waitForTimeout(3500);
  await ctx.shot('sandbox-enemies');
  // abilities via keyboard (Q..Y)
  const before = await page.evaluate(() => window.__rk.sim().abilities().map((a) => `${a.name}:${a.ready}`));
  ctx.log('abilities before', before.join(', '));
  for (const k of ['q', 'w', 'e', 'r', 't', 'y']) { await page.keyboard.press(k); await page.waitForTimeout(150); }
  const after = await page.evaluate(() => window.__rk.sim().abilities().map((a) => `${a.name}:${a.ready ? 'ready' : Math.ceil(a.cd) + 's'}`));
  ctx.log('abilities after', after.join(', '));
  await page.waitForTimeout(300);
  await ctx.shot('sandbox-abilities');
  // boss phases: force health thresholds and watch telegraphs
  const phases = [];
  for (const frac of [0.5, 0.2]) {
    await page.evaluate((f) => { const b = window.__rk.sim().enemies.find((e) => e.def.boss); if (b) { b.hp = b.maxHp * f; b.dist = 400; } }, frac);
    await page.waitForTimeout(2500);
    phases.push(await page.evaluate(() => { const b = window.__rk.sim().enemies.find((e) => e.def.boss); return b ? `phase ${b.boss.phase} telegraph ${b.boss.telegraph} summons ${b.boss.summonsTotal}` : 'no boss'; }));
    await ctx.shot('boss-' + frac);
  }
  ctx.log('boss', phases.join(' | '));
  // select a tier-5 tower and view panel
  const t5 = await page.evaluate(() => { const s = window.__rk.sim(); const t = s.towers.find((t) => t.type === 'archer'); return { x: t.x, y: t.y }; });
  await page.keyboard.press('Escape');
  await clickWorld(page, t5.x, t5.y);
  await page.waitForTimeout(400);
  await ctx.shot('sandbox-panel');
  // clear and reset
  await page.click('text=Clear enemies');
  await page.click('text=Reset towers');
  await page.waitForTimeout(200);
  ctx.log('after reset towers', await page.evaluate(() => window.__rk.sim().towers.length), 'enemies', await page.evaluate(() => window.__rk.sim().enemies.length));
}
