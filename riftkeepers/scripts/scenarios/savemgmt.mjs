import { seed, UNLOCKED_SAVE } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, { ...UNLOCKED_SAVE, shards: 777 });
  await page.click('.title-sub button:has-text("Settings")');
  await page.click('button:has-text("Export")');
  const exported = await page.inputValue('textarea.savebox');
  ctx.log('exported length', exported.length);
  // reset progress (two-step confirm)
  await page.click('button:has-text("Reset progress")');
  await page.click('.modal button:has-text("Cancel")');
  ctx.log('after cancel shards', await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).shards));
  await page.click('button:has-text("Reset progress")');
  await page.click('.modal .btn-red');
  await page.waitForSelector('[data-testid=play]');
  ctx.log('after reset shards', await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).shards));
  // import bad, then good
  await page.click('.title-sub button:has-text("Settings")');
  await page.fill('textarea.savebox', 'not a save');
  await page.click('button:has-text("Import")');
  await page.click('.modal .btn-red');
  ctx.log('bad import toast:', await page.locator('.toast').last().textContent());
  await page.fill('textarea.savebox', exported);
  await page.click('button:has-text("Import")');
  await page.click('.modal .btn-red');
  await page.waitForSelector('[data-testid=play]');
  ctx.log('after import shards', await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).shards), 'version text', await page.textContent('.version'));
  // corrupted save on load
  await page.evaluate(() => localStorage.setItem('riftkeepers.save', '{"shards": 5, oops'));
  await page.reload();
  await page.waitForSelector('[data-testid=play]');
  await page.waitForTimeout(500);
  ctx.log('corrupt load toast:', await page.locator('.toast').allTextContents(), 'backup kept', await page.evaluate(() => !!localStorage.getItem('riftkeepers.save.corrupt')));
}
