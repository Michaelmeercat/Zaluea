/* Browser smoke test: NODE_PATH=$(npm root -g) node tools/browser-test.js [outdir] */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const OUT = process.argv[2] || path.join(__dirname, '..', '..', '..', '..', '.shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await page.goto(URL);
  await page.waitForTimeout(800);
  const shot = async (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  await shot('01-welcome');
  await page.evaluate(() => CS.UI.closeAllModals());
  await shot('02-main');
  // visit every menu page
  for (const p of ['play', 'towers', 'research', 'challenges', 'achievements', 'profile', 'settings']) {
    await page.evaluate((p) => CS.app.menus.show(p), p);
    await page.waitForTimeout(150);
    await shot('03-menu-' + p);
  }
  await page.evaluate(() => CS.app.menus.show('play'));
  await page.click('.map-card[data-map=green]');
  await page.waitForTimeout(200);
  await shot('04-setup');
  await page.click('[data-a=go]');
  await page.waitForTimeout(200);
  await shot('05-loadout');
  await page.click('[data-start]');
  await page.waitForTimeout(500);
  await shot('06-game-start');
  // Place towers and run waves quickly with give-money cheat
  const res = await page.evaluate(() => {
    const m = CS.app.match;
    m.credits = 50000;
    const spots = [[312, 212], [170, 300], [420, 330], [580, 300], [700, 280], [860, 460], [980, 460], [1140, 420], [640, 110], [320, 520]];
    const types = m.loadout;
    let placed = 0;
    spots.forEach((s, i) => { if (m.placeTower(types[i % types.length], s[0], s[1])) placed++; });
    // upgrade some
    for (const t of m.towers) { m.upgradeTower(t, 0); m.upgradeTower(t, 0); m.upgradeTower(t, 2); }
    m.speed = 3;
    m.startWave();
    return { placed, towers: m.towers.length };
  });
  console.log('placed', res);
  await page.waitForTimeout(2500);
  await shot('07-game-wave1');
  // select a tower to show inspector
  await page.evaluate(() => { const h = CS.app.hud; h.select(CS.app.match.towers[0]); });
  await page.waitForTimeout(300);
  await shot('08-inspector');
  // jump to a boss wave with many enemies to test perf
  const perf = await page.evaluate(async () => {
    const m = CS.app.match;
    for (const t of m.towers) { m.upgradeTower(t, 0); m.upgradeTower(t, 0); }
    m.wave = 19; m.spawnQueue = []; m.enemies.forEach((e) => (e.alive = false));
    m.startWave();
    return m.wave;
  });
  await page.waitForTimeout(6000);
  await shot('09-boss20');
  await page.evaluate(() => { const m = CS.app.match; m.spawnQueue = []; m.wave = 58; m.startWave(); });
  await page.waitForTimeout(6000);
  const fps = await page.evaluate(() => ({ fps: CS.app.fps.value, enemies: CS.app.match.enemies.length, q: CS.app.effectiveQuality() }));
  console.log('late wave', fps);
  await shot('10-wave59');
  // other maps
  for (const id of ['crossing', 'cooling', 'highway', 'corruption', 'processor', 'dunes']) {
    await page.evaluate((id) => { CS.app.startMatch({ mapId: id, diff: 'standard', modes: [], rules: {}, loadout: ['pulse', 'sniper', 'firewall', 'arc', 'missile', 'drone'] }); const m = CS.app.match; m.credits = 5000; m.speed = 3; m.startWave(); }, id);
    await page.waitForTimeout(1500);
    await shot('11-map-' + id);
  }
  // defeat + victory screens
  await page.evaluate(() => { const m = CS.app.match; m.coreHp = 1; m.leak({ def: CS.ENEMIES.frag, wave: 1, alive: true }); });
  await page.waitForTimeout(1800);
  await shot('12-defeat');
  console.log('ERRORS:\n' + (errors.join('\n') || 'none'));
  await browser.close();
})();
