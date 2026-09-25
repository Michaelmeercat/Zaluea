'use strict';
const path = require('path');
const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + ' ' + e.stack));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(700);
  await page.evaluate(() => { CS.UI.closeAllModals(); const d = CS.Save.data; d.level = 9; d.chips = 900; d.research.e1 = true; d.research.d1 = true; d.mastery.pulse = { lvl: 6, xp: 300 }; CS.Save.data.maps.green = { done: { casual: true, standard: true }, best: 'standard', bestWave: 72 }; });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  for (const p of ['main', 'research', 'challenges', 'profile', 'settings', 'achievements']) { await page.evaluate((p) => CS.app.menus.show(p), p); await page.waitForTimeout(600); await shot('s-' + p); }
  await page.evaluate(() => CS.app.menus.show('play')); await page.waitForTimeout(900); await shot('s-play');
  await page.evaluate(() => CS.app.menus.show('loadout', { mapId: 'cooling', diff: 'advanced', modes: ['limited'], rules: {} })); await page.waitForTimeout(600); await shot('s-loadout');
  await page.evaluate(() => CS.app.menus.show('play')); await page.waitForTimeout(300);
  await page.click('.map-card[data-map=crossing]'); await page.waitForTimeout(400); await shot('s-setup');
  await page.evaluate(() => { CS.UI.closeAllModals(); CS.app.startMatch({ mapId: 'crossing', diff: 'casual', modes: [], rules: {}, loadout: ['pulse', 'sniper', 'firewall', 'arc', 'missile', 'drone'] }); const m = CS.app.match; m.credits = 1e5; for (const [x, y] of [[300, 300], [400, 420], [600, 280], [850, 250], [1080, 380], [560, 460]]) { const t = m.placeTower('missile', x, y); if (t) { for (let i = 0; i < 4; i++) m.upgradeTower(t, 1, true); m.upgradeTower(t, 0, true); } } m.wave = 39; m.stats.wavesCleared = 39; m.startWave(); m.speed = 3; });
  await page.waitForTimeout(3000); await shot('s-casual40');
  await page.evaluate(() => { const m = CS.app.match; m.enemies.forEach((e) => m.kill(e, null)); m.spawnQueue = []; });
  await page.waitForTimeout(2500); await shot('s-victory');
  console.log('errors:', errors.join('\n') || 'none');
  await b.close();
})();
