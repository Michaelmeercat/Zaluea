import { seed, UNLOCKED_SAVE, clickWorld, spots, worldToPage } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=map-meadow]');
  await page.click('[data-testid=diff-easy]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.evaluate(() => { window.__rk.sim().gold = 100000; });
  const sp = await spots(page, 'orchard', 3, 80);
  const ids = [];
  for (const p of sp.slice(0, 2)) { await page.click('[data-testid=shop-orchard]'); await clickWorld(page, p.x, p.y); ids.push(await page.evaluate(() => { const s = window.__rk.sim(); return s.towers[s.towers.length - 1].id; })); }
  await page.click('[data-testid=shop-beacon]');
  await clickWorld(page, sp[2].x, sp[2].y);
  const b = await page.evaluate(() => { const s = window.__rk.sim(); return s.towers[s.towers.length - 1].id; });
  // orchard 1: Harvest to 5 (+Growth 2); orchard 2: Banking to 5 (+Growth 2); beacon: Prosperity 5 (+Revealing 2)
  const r = await page.evaluate(([o1, o2, b]) => {
    const s = window.__rk.sim(); const out = [];
    for (const [id, path, sec] of [[o1, 2, 0], [o2, 1, 0], [b, 2, 1]]) { for (let i = 0; i < 2; i++) out.push(s.upgrade(id, sec).ok); for (let i = 0; i < 5; i++) out.push(s.upgrade(id, path).ok); }
    return out.every(Boolean);
  }, [ids[0], ids[1], b]);
  ctx.log('upgrades ok', r);
  await page.click('[data-testid=start-wave]', { force: true });
  await page.evaluate(() => { window.__rk.session.speed = 8; });
  await page.waitForFunction(() => !window.__rk.sim().waveActive, null, { timeout: 120000 });
  await page.evaluate(() => { window.__rk.session.speed = 1; });
  const st = await page.evaluate(() => { const s = window.__rk.sim(); return { drops: s.drops.map((d) => d.value), bank: s.towers.map((t) => Math.floor(t.bank)), abilities: s.abilities().map((a) => `${a.name}${a.value !== undefined ? '=' + a.value : ''}${a.charges !== undefined ? ' x' + a.charges : ''}`) }; });
  ctx.log('after wave 1', JSON.stringify(st));
  await ctx.shot('economy-drops');
  // tap a crystal drop on the field
  const d = await page.evaluate(() => { const d = window.__rk.sim().drops[0]; return { x: d.x, y: d.y - 10, v: d.value }; });
  const g0 = await page.evaluate(() => window.__rk.sim().gold);
  await clickWorld(page, d.x, d.y);
  const g1 = await page.evaluate(() => window.__rk.sim().gold);
  ctx.log('tapped drop worth', d.v, 'gold +', g1 - g0, 'drops left', await page.evaluate(() => window.__rk.sim().drops.length));
  // instant harvest via ability button
  await page.click('[data-testid=ability-instantHarvest]');
  const g2 = await page.evaluate(() => window.__rk.sim().gold);
  await page.click('[data-testid=ability-instantHarvest]');
  const g3 = await page.evaluate(() => window.__rk.sim().gold);
  await page.click('[data-testid=ability-instantHarvest]');
  const g4 = await page.evaluate(() => window.__rk.sim().gold);
  ctx.log('instant harvest gains', g2 - g1, g3 - g2, 'third (no charges)', g4 - g3);
  // rift reserve quick-collect button
  const bank0 = await page.evaluate(() => Math.floor(window.__rk.sim().towers.find((t) => t.base.bankButton).bank));
  await page.click('[data-testid=ability-bank]');
  const g5 = await page.evaluate(() => window.__rk.sim().gold);
  ctx.log('bank collected', bank0, 'gold +', g5 - g4, 'bank now', await page.evaluate(() => window.__rk.sim().towers.find((t) => t.base.bankButton).bank));
  // tithe & discount
  ctx.log('beacon tithe', await page.evaluate(() => window.__rk.sim().towers.find((t) => t.type === 'beacon').base.income), 'wave bonus', await page.evaluate(() => window.__rk.sim().waveBonus()));
  // reload -> no duplicate payouts
  const before = await page.evaluate(() => ({ gold: window.__rk.sim().gold, drops: window.__rk.sim().drops.length, bank: window.__rk.sim().towers.map((t) => Math.floor(t.bank)).join(',') }));
  await page.reload();
  await page.click('[data-testid=continue]');
  await page.waitForSelector('[data-testid=start-wave]');
  const after = await page.evaluate(() => ({ gold: window.__rk.sim().gold, drops: window.__rk.sim().drops.length, bank: window.__rk.sim().towers.map((t) => Math.floor(t.bank)).join(',') }));
  ctx.log('reload consistency', JSON.stringify(before), JSON.stringify(after), JSON.stringify(before) === JSON.stringify(after) ? 'MATCH' : 'MISMATCH');
}
