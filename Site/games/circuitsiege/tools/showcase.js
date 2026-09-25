'use strict';
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1100, height: 760 } });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    CS.UI.closeAllModals();
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:999;background:#0d131d;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px;font:13px sans-serif;color:#ccc;overflow:auto';
    for (const t of CS.TOWER_ORDER) for (const tiers of [[0, 0, 0], [5, 2, 0], [0, 5, 2], [2, 0, 5]]) {
      const c = document.createElement('div');
      c.style.cssText = 'display:flex;align-items:center;gap:6px';
      c.innerHTML = `<img src="${CS.Spr.towerIcon(t, tiers, 'default', 96)}" width="52" height="52"><span>${CS.TOWERS[t].name} ${tiers.join('-')}</span>`;
      d.appendChild(c);
    }
    document.body.appendChild(d);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.argv[2] });
  await b.close();
})();
