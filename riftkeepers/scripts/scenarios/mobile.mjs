import { seed, UNLOCKED_SAVE, worldToPage, spots } from './lib.mjs';
export default async function (page, ctx) {
  const tag = process.env.TAG || 'm';
  await seed(page, ctx, UNLOCKED_SAVE);
  await ctx.shot(tag + '-title');
  await page.tap('[data-testid=play]');
  await page.waitForTimeout(300);
  await ctx.shot(tag + '-maps');
  await page.tap('[data-testid=map-meadow]');
  await page.waitForTimeout(300);
  await ctx.shot(tag + '-detail');
  await page.tap('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.waitForTimeout(500);
  await ctx.shot(tag + '-game');
  // touch placement: tap shop, drag on map, confirm button appears
  await page.tap('[data-testid=shop-archer]');
  const [good] = await spots(page, 'archer', 1);
  const target = await worldToPage(page, good.x, good.y);
  // finger lands ~48px below the preview (offset so the finger doesn't hide the tower)
  await page.touchscreen.tap(target.x, target.y + 48);
  await page.waitForTimeout(400);
  await ctx.shot(tag + '-placing');
  const preview = await page.evaluate(() => window.__rk.session.placing);
  ctx.log('preview', JSON.stringify(preview), 'confirm visible', await page.isVisible('[data-testid=place-confirm]'));
  const goldBefore = await page.evaluate(() => window.__rk.sim().gold);
  // cancel costs nothing
  await page.tap('[data-testid=place-cancel]');
  ctx.log('cancel: gold unchanged', goldBefore === (await page.evaluate(() => window.__rk.sim().gold)), 'towers', await page.evaluate(() => window.__rk.sim().towers.length));
  // invalid placement on the road shows a reason and no charge
  await page.tap('[data-testid=shop-archer]');
  const road = await worldToPage(page, 300, 130);
  await page.touchscreen.tap(road.x, road.y + 48);
  await page.waitForTimeout(200);
  ctx.log('invalid msg:', await page.textContent('.placebar .msg'), 'confirm disabled', await page.isDisabled('[data-testid=place-confirm]'));
  await ctx.shot(tag + '-invalid');
  // now place for real
  await page.touchscreen.tap(target.x, target.y + 48);
  await page.waitForTimeout(400);
  await page.tap('[data-testid=place-confirm]');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ gold: window.__rk.sim().gold, towers: window.__rk.sim().towers.length }));
  ctx.log('placed:', JSON.stringify(after), 'charged', goldBefore - after.gold);
  // select tower by tapping it, panel opens; same tap must not buy
  const t = await page.evaluate(() => { const t = window.__rk.sim().towers[0]; return { x: t.x, y: t.y }; });
  const tp = await worldToPage(page, t.x, t.y - 8);
  const g0 = await page.evaluate(() => window.__rk.sim().gold);
  await page.touchscreen.tap(tp.x, tp.y);
  await page.waitForTimeout(400);
  ctx.log('panel open', await page.isVisible('[data-testid=tower-panel]'), 'gold unchanged by select', g0 === (await page.evaluate(() => window.__rk.sim().gold)));
  await ctx.shot(tag + '-panel');
  await page.tap('[data-testid=up-1]');
  await page.waitForTimeout(150);
  ctx.log('upgrade bought', await page.evaluate(() => window.__rk.sim().towers[0].levels.join('')));
  // tap empty ground closes panel
  const empty = await worldToPage(page, 640, 650);
  await page.touchscreen.tap(empty.x, empty.y);
  await page.waitForTimeout(200);
  ctx.log('panel closed', !(await page.isVisible('[data-testid=tower-panel]')));
  // rotate: change viewport, state preserved
  const vp = page.viewportSize();
  await page.click('[data-testid=pause]').catch(() => {});
  await page.keyboard.press('Escape');
  await page.touchscreen.tap(tp.x, tp.y);
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(600);
  ctx.log('after rotate: selected', await page.evaluate(() => window.__rk.session.selectedId), 'towers', await page.evaluate(() => window.__rk.sim().towers.length));
  await ctx.shot(tag + '-rotated');
  // check minimum touch target sizes across visible buttons
  const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { t: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => Math.min(x.w, x.h) < 40));
  ctx.log('buttons under 40px:', JSON.stringify(small));
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
  ctx.log('page overflow', JSON.stringify(overflow));
}
