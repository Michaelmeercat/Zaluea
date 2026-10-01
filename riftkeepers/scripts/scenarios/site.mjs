export default async function (page, ctx) {
  await page.goto('http://localhost:8090/games.html');
  await page.waitForSelector('#gameslist a');
  const names = await page.locator('#gameslist a').allTextContents();
  ctx.log('games list:', names.join(', '));
  await page.click('#gameslist a:has-text("Riftkeepers")');
  const frame = page.frameLocator('#gamewindow');
  await frame.locator('[data-testid=play]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await ctx.shot('site-iframe');
  await frame.locator('[data-testid=play]').click();
  await frame.locator('text=Skip tutorial').click();
  await frame.locator('[data-testid=map-meadow]').click();
  await frame.locator('[data-testid=start-run]').click();
  await frame.locator('[data-testid=start-wave]').waitFor();
  ctx.log('game started inside the site iframe');
}
