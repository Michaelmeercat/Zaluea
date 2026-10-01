export default async function (page, ctx) {
  await page.goto(ctx.base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid=play]');
  await page.click('[data-testid=play]');
  await page.waitForTimeout(300);
  await ctx.shot('welcome');
  await page.click('text=Skip tutorial');
  await page.waitForSelector('[data-testid=map-meadow]');
  await page.waitForTimeout(400);
  await ctx.shot('maps');
  await page.click('[data-testid=map-meadow]');
  await page.waitForTimeout(400);
  await ctx.shot('map-detail');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(800);
  await ctx.shot('game0');
  // place archer: click shop then click map
  await page.click('[data-testid=shop-archer]');
  const box = await page.locator('.field canvas').boundingBox();
  const W = (x, y) => { const s = Math.min(box.width / 1280, box.height / 720); const ox = (box.width - 1280 * s) / 2, oy = (box.height - 720 * s) / 2; return { x: box.x + ox + x * s, y: box.y + oy + y * s }; };
  let p = W(300, 250);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(200);
  await ctx.shot('placing');
  await page.mouse.click(p.x, p.y);
  await page.click('[data-testid=shop-archer]');
  p = W(470, 220); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y);
  await page.click('[data-testid=shop-alchemist]');
  p = W(320, 520); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y);
  await page.click('[data-testid=start-wave]', { force: true });
  await page.waitForTimeout(6000);
  await ctx.shot('wave1');
  // select archer
  p = W(300, 245); await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(300);
  await ctx.shot('selected');
}
