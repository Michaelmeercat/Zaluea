import { autoplay, stopAutoplay, seed, UNLOCKED_SAVE, PLAN_FULL } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=map-meadow]');
  await page.click('[data-testid=diff-easy]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.evaluate(() => { const s = window.__rk.sim(); s.wave = 38; s.gold = 40000; });
  await autoplay(page, PLAN_FULL, 20);
  await page.waitForFunction(() => window.__rk.sim().state !== 'playing', null, { timeout: 300000, polling: 50 });
  await stopAutoplay(page);
  await page.waitForTimeout(500);
  await ctx.shot('victory-fx');
  await page.waitForSelector('.result', { timeout: 5000 });
  ctx.log('result shown');
}
