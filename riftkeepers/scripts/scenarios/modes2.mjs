import { seed, UNLOCKED_SAVE, clickWorld, spots } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=tab-challenges]');
  await page.click('[data-testid=challenge-tight-ranks]');
  await page.waitForTimeout(500);
  await ctx.shot('tight-start');
  await page.waitForSelector('[data-testid=start-wave]', { timeout: 5000 });
  await page.evaluate(() => { window.__rk.sim().gold = 99999; });
  const ss = await spots(page, 'archer', 9, 50);
  for (const p of ss) { await page.click('[data-testid=shop-archer]'); await clickWorld(page, p.x, p.y); if (await page.evaluate(() => !!window.__rk.session.placing)) await page.keyboard.press('Escape'); if (await page.evaluate(() => window.__rk.session.selectedId)) await page.keyboard.press('Escape'); }
  const n = await page.evaluate(() => window.__rk.sim().towers.length);
  ctx.log('tight ranks towers placed (max 8):', n, 'toasts:', (await page.locator('.toast').allTextContents()).join(' | '));
  await page.click('[data-testid=pause]');
  await page.click('[data-testid=quit]');
  await page.click('[data-testid=play]');
  await page.click('[data-testid=tab-challenges]');
  await page.click('[data-testid=challenge-iron-will]');
  await page.waitForTimeout(300);
  if (await page.isVisible('.modal')) { ctx.log('abandon prompt:', (await page.textContent('.modal')).replace(/\s+/g, ' ')); await page.click('.modal .btn-red'); }
  await page.waitForSelector('[data-testid=start-wave]');
  const p = (await spots(page, 'archer', 1))[0];
  await page.click('[data-testid=shop-archer]');
  await clickWorld(page, p.x, p.y);
  await page.waitForTimeout(200);
  await clickWorld(page, p.x, p.y - 10);
  await page.waitForSelector('[data-testid=tower-panel]');
  ctx.log('iron will sell disabled:', await page.isDisabled('[data-testid=sell]'), 'lives', await page.textContent('[data-testid=lives-val]'));
  await page.keyboard.press('s');
  ctx.log('towers after S key:', await page.evaluate(() => window.__rk.sim().towers.length));
}
