import { autoplay, stopAutoplay, seed, UNLOCKED_SAVE, PLAN_FULL } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, { ...UNLOCKED_SAVE, medals: { ...UNLOCKED_SAVE.medals, frostglass: { easy: true } } });
  const shards0 = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).shards);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=map-frostglass]');
  await page.click('[data-testid=diff-easy]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  // dev fast-forward: jump to wave 37 with a war chest (simulates a long run)
  await page.evaluate(() => { const s = window.__rk.sim(); s.wave = 37; s.gold = 40000; });
  await autoplay(page, PLAN_FULL, 30);
  await page.waitForSelector('.result', { timeout: 300000 });
  await stopAutoplay(page);
  await page.waitForTimeout(300);
  ctx.log('victory:', (await page.textContent('.result ul')).replace(/\s+/g, ' '));
  const shards1 = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).shards);
  ctx.log('shards', shards0, '->', shards1, '(repeat clear: expected +25 plus any achievements)');
  await page.click('[data-testid=endless]');
  await page.waitForTimeout(500);
  await ctx.shot('endless-start');
  await autoplay(page, PLAN_FULL, 30);
  await page.waitForFunction(() => window.__rk.sim().wave >= 43, null, { timeout: 300000, polling: 200 });
  await page.waitForFunction(() => !window.__rk.sim().waveActive, null, { timeout: 300000, polling: 100 });
  await stopAutoplay(page);
  const st = await page.evaluate(() => { const s = window.__rk.sim(); return { wave: s.wave, endless: s.cfg.endless, hud: document.querySelector('[data-testid=wave-val]').textContent }; });
  ctx.log('endless state', JSON.stringify(st));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).activeRun);
  ctx.log('endless active run saved:', !!saved, saved && saved.snapshot.cfg.endless, saved && saved.runId.slice(0, 8));
  // force a defeat: sell everything, 1 life, start wave
  await page.evaluate(() => { const s = window.__rk.sim(); for (const t of [...s.towers]) s.sell(t.id); s.lives = 1; });
  await page.click('[data-testid=start-wave]', { force: true });
  await page.waitForSelector('.result', { timeout: 120000 });
  await page.waitForTimeout(300);
  await ctx.shot('endless-defeat');
  ctx.log('defeat:', (await page.textContent('.result')).replace(/\s+/g, ' ').slice(0, 300));
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')));
  ctx.log('endlessBest', JSON.stringify(save.endlessBest), 'shards', save.shards, 'activeRun', save.activeRun);
  // retry from the result screen
  await page.click('[data-testid=retry]');
  await page.waitForFunction(() => window.__rk && window.__rk.sim().wave === 0 && window.__rk.sim().state === 'playing', null, { timeout: 5000 });
  ctx.log('retry ok:', await page.evaluate(() => `${window.__rk.sim().cfg.mapId} ${window.__rk.sim().cfg.difficulty} endless=${window.__rk.sim().cfg.endless}`));
}
