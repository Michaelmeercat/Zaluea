// Generic Playwright driver: node scripts/drive.mjs <scenario.mjs> [w] [h] [mobile]
// The scenario exports `default async function(page, ctx)`.
import { chromium, devices } from 'playwright';
import path from 'node:path';
const [scen, w = '1280', h = '720', mobile] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctxOpts = mobile ? { viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: +w, height: +h } };
const context = await browser.newContext(ctxOpts);
const page = await context.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
const shotDir = '/tmp/claude-0/shots';
const ctx = {
  base: process.env.BASE || 'http://localhost:5173/',
  shot: async (name) => { await page.screenshot({ path: `${shotDir}/${name}.png` }); console.log('shot', name); },
  log: (...a) => console.log(...a),
  errs,
};
try {
  const mod = await import(path.resolve(scen));
  await mod.default(page, ctx);
} catch (e) {
  console.log('SCENARIO FAILED', e.message);
  await page.screenshot({ path: `${shotDir}/failure.png` }).catch(() => {});
  process.exitCode = 1;
}
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await browser.close();
