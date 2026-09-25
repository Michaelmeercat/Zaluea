'use strict';
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1.25 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(600);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.argv[2] || 4) });
  const run = async (label, wave, map) => {
    await page.evaluate(([wave, map]) => {
      CS.UI.closeAllModals();
      CS.Save.data.settings.quality = 'auto'; CS.Save.data.settings.showFps = true;
      CS.app.startMatch({ mapId: map, diff: 'standard', modes: [], rules: {}, loadout: ['pulse', 'missile', 'arc', 'virus', 'drone', 'firewall'] });
      const m = CS.app.match; m.credits = 1e7;
      const R = CS.U.rng(3); let n = 0;
      for (let i = 0; i < 400 && n < 30; i++) { const x = 40 + R() * 1200, y = 40 + R() * 640; const ty = m.loadout[n % 6]; const t = m.placeTower(ty, x, y); if (t) { n++; for (let k = 0; k < 4; k++) m.upgradeTower(t, 1, true); m.upgradeTower(t, 0, true); m.upgradeTower(t, 0, true); } }
      m.wave = wave - 1; if (wave > 60) m.continueEndless(); m.startWave(); m.speed = 3;
      CS.app.fps.frames = 0; CS.app.fps.time = 0;
    }, [wave, map]);
    const samples = [];
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(1500); samples.push(await page.evaluate(() => ({ fps: Math.round(CS.app.fps.value), en: CS.app.match.enemies.length, pr: CS.app.match.projs.count, q: CS.app.effectiveQuality() }))); }
    console.log(label, JSON.stringify(samples));
  };
  await run('w59-processor', 59, 'processor');
  await run('endless-w120', 120, 'green');
  console.log('errors', errors.join('\n') || 'none');
  await b.close();
})();
