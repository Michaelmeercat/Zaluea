'use strict';
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(600);
  await page.evaluate(() => (window.__speed = 3));
  const q = process.argv[2] || 'medium';
  await page.evaluate((q) => {
    CS.UI.closeAllModals();
    CS.Save.data.settings.quality = q;
    CS.app.startMatch({ mapId: 'processor', diff: 'standard', modes: [], rules: {}, loadout: ['pulse', 'missile', 'arc', 'virus', 'drone', 'firewall'] });
    CS.app.applySettings();
    const m = CS.app.match; m.credits = 1e7;
    const R = CS.U.rng(3); let n = 0;
    for (let i = 0; i < 400 && n < 30; i++) { const x = 40 + R() * 1200, y = 40 + R() * 640; const ty = m.loadout[n % 6]; const t = m.placeTower(ty, x, y); if (t) { n++; for (let k = 0; k < 4; k++) m.upgradeTower(t, 1, true); m.upgradeTower(t, 0, true); m.upgradeTower(t, 0, true); } }
    m.wave = 58; m.startWave(); m.speed = +(window.__speed || 1);
    // instrument
    const P = (window.__prof = {});
    const wrap = (obj, name, key) => { const f = obj[name]; obj[name] = function () { const t0 = performance.now(); const r = f.apply(this, arguments); P[key] = (P[key] || 0) + performance.now() - t0; return r; }; };
    wrap(m, 'update', 'update'); for (const k of ['updateTowers','enemyAuras','updateEnemies','updateProjectiles','updateZones','updateZombies']) wrap(m, k, 'm.' + k);
    const R2 = CS.app.renderer;
    for (const k of ['drawAmbient', 'drawChevrons', 'drawMapZones', 'drawGroundZones', 'drawAuras', 'drawCores', 'drawTowerBases', 'drawZombies', 'drawEnemies', 'drawTowerHeads', 'drawProjectiles', 'drawFx', 'drawDarkness', 'drawOverlays', 'drawPlacement', 'drawTexts']) wrap(R2, k, k);
    wrap(R2, 'render', 'renderTotal');
    wrap(CS.app.hud, 'refresh', 'hud');
    P.frames = 0;
    const of = CS.app.frame.bind(CS.app);
  }, q);
  await page.waitForTimeout(8000);
  const res = await page.evaluate(() => { const P = window.__prof; return { P, enemies: CS.app.match.enemies.length, fps: CS.app.fps.value }; });
  const secs = 8;
  const out = Object.entries(res.P).map(([k, v]) => [k, (v / secs).toFixed(1) + 'ms/s']);
  console.log(q, 'fps', Math.round(res.fps), 'enemies', res.enemies);
  console.log(out.map((o) => o.join('=')).join('  '));
  await b.close();
})();
