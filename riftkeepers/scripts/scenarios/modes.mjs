import { autoplay, stopAutoplay, seed, UNLOCKED_SAVE, PLAN_FULL, clickWorld, spots } from './lib.mjs';
async function winFast(page, plan) {
  await page.evaluate(() => { const s = window.__rk.sim(); s.wave = s.cfg.finalWave - 2; s.gold = 30000; });
  await autoplay(page, plan, 30);
  await page.waitForSelector('.result', { timeout: 300000 });
  await stopAutoplay(page);
  await page.waitForTimeout(300);
  return (await page.textContent('.result')).replace(/\s+/g, ' ');
}
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  // ---- daily
  await page.click('[data-testid=play]');
  await page.click('[data-testid=tab-daily]');
  const dailyText = (await page.textContent('.detail .card')).replace(/\s+/g, ' ');
  ctx.log('daily card:', dailyText.slice(0, 220));
  await page.click('[data-testid=start-daily]');
  await page.waitForSelector('[data-testid=start-wave]');
  const cfg = await page.evaluate(() => window.__rk.sim().cfg);
  ctx.log('daily cfg', cfg.mapId, cfg.allowedTowers.join(','), 'final', cfg.finalWave, 'lives', cfg.lives, 'hp', cfg.hpMult, 'speed', cfg.speedMult, 'max', cfg.maxTowers, 'hero', cfg.heroAllowed);
  // a tower outside the roster must be refused in the UI
  const banned = ['archer', 'alchemist', 'warden', 'storm', 'beacon', 'orchard'].find((t) => !cfg.allowedTowers.includes(t));
  await page.click(`[data-testid=shop-${banned}]`);
  ctx.log('banned tower toast:', await page.locator('.toast').last().textContent());
  const plan = { build: cfg.allowedTowers.filter((t) => t !== 'beacon' && t !== 'orchard').map((t) => ({ type: t, paths: [0, 2] })), repeat: { type: cfg.allowedTowers.find((t) => t !== 'beacon' && t !== 'orchard'), paths: [0, 1] }, baseCount: 3, waveDiv: 3 };
  const r1 = await winFast(page, plan);
  ctx.log('daily result:', r1.slice(0, 260));
  await page.click('[data-testid=retry]');
  await page.waitForSelector('[data-testid=start-wave]');
  const r2 = await winFast(page, plan);
  ctx.log('daily replay:', r2.match(/Daily Challenge[^R]*/)?.[0]);
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')));
  ctx.log('daily claimed', save.daily.claimed.join(','));
  // ---- restricted challenge: two disciplines (archer + warden only)
  await page.click('[data-testid=to-maps]');
  await page.click('[data-testid=tab-challenges]');
  await ctx.shot('challenges-unlocked');
  await page.click('[data-testid=challenge-two-disciplines]');
  await page.waitForSelector('[data-testid=start-wave]');
  const ccfg = await page.evaluate(() => window.__rk.sim().cfg);
  ctx.log('challenge cfg', ccfg.challengeId, ccfg.allowedTowers.join(','), 'final', ccfg.finalWave);
  await page.click('[data-testid=shop-alchemist]');
  ctx.log('blocked alchemist toast:', await page.locator('.toast').last().textContent());
  const r3 = await winFast(page, { build: [{ type: 'archer', paths: [0, 2] }, { type: 'warden', paths: [1, 0] }], repeat: { type: 'archer', paths: [1, 2] }, baseCount: 3, waveDiv: 3 });
  ctx.log('challenge result:', r3.match(/Challenge complete[^R]*/)?.[0]);
  // ---- tight ranks: max towers enforced
  await page.click('[data-testid=to-maps]');
  await page.click('[data-testid=tab-challenges]');
  await page.click('[data-testid=challenge-tight-ranks]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.evaluate(() => { window.__rk.sim().gold = 99999; });
  const ss = await spots(page, 'archer', 9, 50);
  for (const p of ss) { await page.click('[data-testid=shop-archer]').catch(() => {}); await clickWorld(page, p.x, p.y); await page.keyboard.press('Escape'); }
  const n = await page.evaluate(() => window.__rk.sim().towers.length);
  ctx.log('tight ranks towers placed (max 8):', n, 'last toast:', await page.locator('.toast').last().textContent().catch(() => ''));
  // ---- iron will: no selling
  await page.click('[data-testid=pause]');
  await page.click('[data-testid=quit]');
  await page.click('[data-testid=play]');
  await page.click('[data-testid=tab-challenges]');
  await page.click('[data-testid=challenge-iron-will]');
  await page.click('.modal .btn-red').catch(() => {});
  await page.waitForSelector('[data-testid=start-wave]');
  const p = (await spots(page, 'archer', 1))[0];
  await page.click('[data-testid=shop-archer]');
  await clickWorld(page, p.x, p.y);
  await clickWorld(page, p.x, p.y - 10);
  await page.waitForSelector('[data-testid=tower-panel]');
  ctx.log('iron will sell button disabled:', await page.isDisabled('[data-testid=sell]'), 'lives', await page.textContent('[data-testid=lives-val]'));
}
