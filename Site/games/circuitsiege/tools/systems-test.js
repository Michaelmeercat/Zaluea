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
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    CS.UI.closeAllModals();
    const S = CS.Save;
    S.data.level = 7; S.data.chips = 1234; S.data.research.e1 = true; S.save(true);
    const code = S.exportCode();
    S.reset();
    const afterReset = S.data.level;
    S.importCode(code);
    const afterImport = [S.data.level, S.data.chips, !!S.data.research.e1];
    let badRejected = false; try { S.importCode('CS1.garbage.x'); } catch (e) { badRejected = true; }
    let tamperRejected = false; try { const p = code.split('.'); S.importCode(p[0] + '.' + p[1] + '.zzz'); } catch (e) { tamperRejected = true; }
    // raw JSON import (file)
    S.importCode(JSON.stringify(S.data));
    const persisted = JSON.parse(localStorage.getItem('circuitSiege.save.v1')).level;
    return { afterReset, afterImport, badRejected, tamperRejected, persisted };
  });
  console.log('save:', JSON.stringify(r));
  // match: restart, settings switch, quit
  const r2 = await page.evaluate(async () => {
    CS.app.startMatch({ mapId: 'green', diff: 'standard', modes: [], rules: {}, loadout: ['pulse', 'sniper'] });
    const m1 = CS.app.match; m1.placeTower('pulse', 312, 212); m1.startWave();
    CS.app.restartMatch();
    const m2 = CS.app.match;
    const fresh = m2 !== m1 && m2.towers.length === 0 && m2.wave === 0;
    for (const q of ['low', 'medium', 'high', 'auto']) { CS.Save.data.settings.quality = q; CS.app.applySettings(); }
    CS.app.hud.onKey({ key: 'f' }); const spd = m2.speed;
    CS.app.hud.onKey({ key: 'p' }); const paused = m2.paused; CS.app.hud.onKey({ key: 'p' });
    CS.app.hud.onKey({ key: '1' }); const placing = CS.app.hud.ui.placing;
    CS.app.hud.onKey({ key: 'Escape' });
    CS.app.quitMatch();
    return { fresh, spd, paused, placing, screen: CS.app.screen, menu: CS.app.menus.current };
  });
  console.log('match:', JSON.stringify(r2));
  for (const [w, h] of [[1024, 600], [1280, 720], [1920, 1080], [1366, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { CS.app.startMatch({ mapId: 'highway', diff: 'standard', modes: [], rules: {}, loadout: ['pulse', 'sniper', 'arc', 'missile', 'drone', 'firewall'] }); });
    await page.waitForTimeout(400);
    const dims = await page.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(); return [Math.round(c.width), Math.round(c.height), document.documentElement.scrollWidth <= innerWidth]; });
    console.log('viewport', w, h, 'canvas', dims);
    await page.screenshot({ path: path.join(OUT, 'vp-' + w + '.png') });
    await page.evaluate(() => CS.app.quitMatch(true));
  }
  console.log('errors:', errors.join('\n') || 'none');
  await b.close();
})();
