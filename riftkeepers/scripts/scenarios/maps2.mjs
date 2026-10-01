import { seed, UNLOCKED_SAVE, clickWorld } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, { ...UNLOCKED_SAVE, cosmetics: { owned: ['lyra-violet', 'lyra-ember', 'gold-trim', 'prismatic'], lyra: 'ember', trim: true, prismatic: true } });
  for (const m of ['citadel', 'market']) {
    await page.click('[data-testid=play]');
    await page.click(`[data-testid=map-${m}]`);
    await page.click('[data-testid=diff-normal]');
    await page.click('[data-testid=start-run]');
    const ab = await page.$('.modal .btn-red'); if (ab) await ab.click();
    await page.waitForSelector('[data-testid=start-wave]');
    await page.waitForTimeout(600);
    if (m === 'market') {
      // place an archer near the center to show gold trim, then try to place on an obstacle and clear it
      await page.evaluate(() => { window.__rk.sim().gold = 5000; });
      await page.click('[data-testid=shop-archer]');
      await clickWorld(page, 505, 370);
      await page.click('[data-testid=shop-lyra]');
      await clickWorld(page, 770, 370);
      await page.click('[data-testid=shop-archer]');
      await clickWorld(page, 575, 370);
      ctx.log('obstacle placement msg:', await page.textContent('.placebar .msg'));
      await page.waitForTimeout(200);
      await ctx.shot('market-placing');
      await page.keyboard.press('Escape');
      await clickWorld(page, 575, 370);
      await page.waitForSelector('[data-testid=clear-obstacle]');
      ctx.log('clear prompt:', (await page.textContent('.modal')).replace(/\s+/g, ' '));
      await page.click('[data-testid=clear-obstacle]');
      ctx.log('removed obstacles', await page.evaluate(() => [...window.__rk.sim().removedObstacles].join(',')), 'gold', await page.evaluate(() => window.__rk.sim().gold));
      await page.click('[data-testid=start-wave]', { force: true });
      await page.evaluate(() => { window.__rk.session.speed = 3; });
      await page.waitForTimeout(5000);
      await ctx.shot('market-wave');
    } else {
      await ctx.shot('citadel-routes');
      ctx.log('citadel next routes', await page.evaluate(() => window.__rk.sim().nextRoutes().join(',')));
    }
    await page.click('[data-testid=pause]');
    await page.click('[data-testid=quit]');
  }
}
