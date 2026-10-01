import { autoplay, stopAutoplay, seed, PLAN_STARTER } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, { version: 2, tutorialDone: true });
  await page.click('[data-testid=play]');
  await page.click('[data-testid=map-meadow]');
  await page.click('[data-testid=diff-easy]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  const t0 = Date.now();
  await autoplay(page, PLAN_STARTER, 40);
  let lastLog = 0;
  while (true) {
    const st = await page.evaluate(() => { const s = window.__rk.sim(); return { wave: s.wave, lives: s.lives, gold: s.gold, state: s.state, enemies: s.enemies.length }; });
    if (Date.now() - lastLog > 15000) { ctx.log(JSON.stringify(st), Math.round((Date.now() - t0) / 1000) + 's'); lastLog = Date.now(); }
    if (st.state !== 'playing') break;
    if (st.wave === 20 && !ctx.mid) { ctx.mid = true; await ctx.shot('easy-w20'); }
    if (st.wave === 40 && !ctx.boss) { ctx.boss = true; await page.waitForTimeout(1500); await ctx.shot('easy-w40-boss'); }
    await page.waitForTimeout(1000);
    if (Date.now() - t0 > 15 * 60 * 1000) throw new Error('timeout');
  }
  await stopAutoplay(page);
  await page.waitForSelector('.result', { timeout: 10000 });
  await page.waitForTimeout(400);
  await ctx.shot('easy-result');
  ctx.log('RESULT:', (await page.textContent('.result')).replace(/\s+/g, ' ').slice(0, 600));
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')));
  ctx.log('save: shards', save.shards, 'medals', JSON.stringify(save.medals), 'activeRun', save.activeRun, 'victories', save.stats.victories, 'ach', Object.keys(save.achievements).join(','));
  ctx.log('elapsed', Math.round((Date.now() - t0) / 1000) + 's');
}
