// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [selectorForElementShot]
import { chromium } from 'playwright';
const [url, out, w = '1300', h = '900', sel] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(url);
await page.waitForTimeout(1500);
if (sel) await page.locator(sel).screenshot({ path: out }); else await page.screenshot({ path: out, fullPage: true });
console.log(errs.join('\n') || 'no errors');
await browser.close();
