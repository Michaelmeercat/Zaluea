export default async function (page, ctx) {
  const q = process.env.Q || 'map=market&diff=normal&wave=18';
  await page.goto(ctx.base + 'gallery.html?show=bot&' + q);
  await page.waitForFunction(() => window.__fps && window.__fps.length >= 3, null, { timeout: 120000 });
  await ctx.shot('botview');
  ctx.log(JSON.stringify(await page.evaluate(() => ({ fps: window.__fps, info: window.__info }))));
}
