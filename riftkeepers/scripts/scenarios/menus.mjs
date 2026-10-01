// Visit every title-screen destination and verify back navigation (button + Escape).
export default async function (page, ctx) {
  await page.goto(ctx.base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid=play]');
  const dests = ['Guardians', 'Collection', 'Achievements', 'Settings', 'Help'];
  for (const [i, d] of dests.entries()) {
    await page.click(`.title-sub button:has-text("${d}")`);
    await page.waitForSelector('.topbar h1');
    const title = await page.textContent('.topbar h1');
    await page.waitForTimeout(250);
    await ctx.shot('menu-' + d.toLowerCase());
    if (i % 2 === 0) await page.click('button[aria-label=Back]');
    else await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid=play]', { timeout: 3000 });
    ctx.log(`${d}: title "${title}" -> back OK`);
  }
  // tabs inside screens
  await page.click('.title-sub button:has-text("Guardians")');
  for (const t of ['Talents', 'Cosmetics', 'Guardians']) { await page.click(`.tabs button:has-text("${t}")`); await page.waitForTimeout(150); await ctx.shot('guardians-' + t.toLowerCase()); }
  await page.click('.card.coll-item >> nth=3');
  await page.waitForSelector('.modal');
  await ctx.shot('guardian-detail');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.keyboard.press('Escape');
  await page.click('.title-sub button:has-text("Collection")');
  for (const t of ['Enemies', 'Variants & Boss']) { await page.click(`.tabs button:has-text("${t}")`); await page.waitForTimeout(150); await ctx.shot('collection-' + t.split(' ')[0].toLowerCase()); }
  await page.keyboard.press('Escape');
  // play -> tabs -> back
  await page.click('[data-testid=play]');
  await page.click('text=Skip tutorial');
  for (const t of ['challenges', 'daily', 'sandbox', 'campaign']) { await page.click(`[data-testid=tab-${t}]`); await page.waitForTimeout(250); await ctx.shot('play-' + t); }
  await page.click('[data-testid=map-ruins]');
  await page.waitForTimeout(200);
  await ctx.shot('map-locked');
  await page.keyboard.press('Escape'); // closes detail
  await page.waitForSelector('[data-testid=map-meadow]');
  await page.keyboard.press('Escape'); // back to title
  await page.waitForSelector('[data-testid=play]');
  ctx.log('play screen back OK');
  // browser back button maps to in-app back
  await page.click('.title-sub button:has-text("Help")');
  await page.goBack();
  await page.waitForSelector('[data-testid=play]', { timeout: 3000 });
  ctx.log('browser back OK');
}
