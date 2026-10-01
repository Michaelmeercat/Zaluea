import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
for (const [size, mask, name] of [[192, 0, 'icon-192'], [512, 0, 'icon-512'], [512, 1, 'icon-maskable-512']]) {
  await page.goto(`http://localhost:5173/gallery.html?show=icon&size=${size}&maskable=${mask}`);
  await page.waitForSelector('#icon');
  await page.waitForTimeout(300);
  await page.locator('#icon').screenshot({ path: `public/icons/${name}.png`, omitBackground: true });
}
await browser.close();
console.log('icons done');
