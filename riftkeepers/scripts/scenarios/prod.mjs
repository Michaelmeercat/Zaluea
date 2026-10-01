export default async function (page, ctx) {
  await page.goto(ctx.base);
  await page.waitForSelector('[data-testid=play]');
  ctx.log('dev hooks absent in prod:', await page.evaluate(() => window.__rk === undefined));
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null || false, null, { timeout: 15000 }).catch(() => {});
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'active' : 'installing') : 'none'; });
  ctx.log('service worker:', sw);
  await page.reload();
  await page.waitForSelector('[data-testid=play]');
  const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return (await c.keys()).length; });
  ctx.log('cached entries:', cached);
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForSelector('[data-testid=play]', { timeout: 10000 });
  ctx.log('offline reload OK; font loaded:', await page.evaluate(() => document.fonts.check('600 16px Fredoka')));
  await page.click('[data-testid=play]');
  await page.click('text=Skip tutorial');
  await page.click('[data-testid=map-meadow]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.waitForTimeout(500);
  await ctx.shot('offline-game');
  ctx.log('offline gameplay screen OK');
  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  ctx.log('manifest:', manifest.name, manifest.display, manifest.icons.length, 'icons');
}
