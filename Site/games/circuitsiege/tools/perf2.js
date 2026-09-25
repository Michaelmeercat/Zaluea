'use strict';
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const variant of ['baseline', 'noanim', 'noanim+nocanvas']) {
    const page = await b.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1.25 });
    await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
    await page.waitForTimeout(500);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate((variant) => {
      CS.UI.closeAllModals();
      CS.Save.data.settings.quality = 'medium';
      if (variant !== 'baseline') { const st = document.createElement('style'); st.textContent = '*{animation:none!important;transition:none!important}'; document.head.appendChild(st); }
      CS.app.startMatch({ mapId: 'green', diff: 'standard', modes: [], rules: {}, loadout: ['pulse', 'missile', 'arc', 'virus', 'drone', 'firewall'] });
      CS.app.applySettings();
      if (variant === 'noanim+nocanvas') CS.app.renderer.render = () => {};
      const m = CS.app.match; m.credits = 1e6;
      m.placeTower('pulse', 312, 212);
      CS.app.fps.frames = 0; CS.app.fps.time = 0;
    }, variant);
    await page.waitForTimeout(6000);
    console.log(variant, Math.round(await page.evaluate(() => CS.app.fps.value)));
    await page.close();
  }
  await b.close();
})();
