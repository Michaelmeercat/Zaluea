import { seed, UNLOCKED_SAVE, worldToPage } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.tap('[data-testid=play]');
  await page.tap('[data-testid=map-meadow]');
  await page.tap('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.evaluate(() => {
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend']) document.addEventListener(ev, (e) => console.log('EV', ev, e.target.className || e.target.tagName, e.pointerType || ''), true);
  });
  page.on('console', (m) => { if (m.text().startsWith('EV')) ctx.log(m.text()); });
  await page.tap('[data-testid=shop-archer]');
  await page.waitForTimeout(200);
  ctx.log('placing after shop tap', JSON.stringify(await page.evaluate(() => window.__rk.session.placing)));
  const p = await worldToPage(page, 300, 250);
  await page.touchscreen.tap(p.x, p.y + 48);
  await page.waitForTimeout(200);
  ctx.log('placing after field tap', JSON.stringify(await page.evaluate(() => window.__rk.session.placing)));
}
