import { seed, UNLOCKED_SAVE } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=map-meadow]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.click('[data-testid=shop-archer]'); // focus stays on the shop button, placement starts
  await page.keyboard.press('Escape'); // cancel placement
  ctx.log('placing after esc', await page.evaluate(() => !!window.__rk.session.placing), 'focused', await page.evaluate(() => document.activeElement.dataset.testid));
  await page.keyboard.press(' ');
  await page.waitForTimeout(200);
  ctx.log('space: waveActive', await page.evaluate(() => window.__rk.sim().waveActive), 'placing (should be false)', await page.evaluate(() => !!window.__rk.session.placing));
  await page.keyboard.press('Tab');
  ctx.log('tab speed', await page.evaluate(() => window.__rk.session.speed));
  await page.keyboard.press('2');
  ctx.log('key 2 placing', await page.evaluate(() => window.__rk.session.placing?.type));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  ctx.log('esc twice -> pause menu', await page.isVisible('[data-testid=resume]'));
  await page.keyboard.press('1');
  ctx.log('shortcut ignored while modal open', await page.evaluate(() => !window.__rk.session.placing));
}
