/* Plays the tutorial with real mouse/keyboard input. NODE_PATH=$(npm root -g) node tools/tutorial-test.js outdir */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForTimeout(900);
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  // Welcome modal -> Start Tutorial
  await page.click('[data-a=y]');
  await page.waitForTimeout(600);
  await shot('t01');
  const tipText = () => page.$eval('#tip', (e) => e.innerText).catch(() => '(no tip)');
  console.log('1:', await tipText());
  // world -> screen helper
  const toScreen = async (x, y) => page.evaluate(([x, y]) => { const r = document.getElementById('cv').getBoundingClientRect(); return { x: r.left + (x / 1280) * r.width, y: r.top + (y / 720) * r.height }; }, [x, y]);
  await page.keyboard.press('1');
  await page.waitForTimeout(200);
  console.log('2:', await tipText());
  let p = await toScreen(312, 212);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(150);
  await shot('t02-placing');
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(300);
  console.log('3:', await tipText());
  await shot('t03');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  console.log('4:', await tipText());
  await page.click('.tb-btn.spd[data-speed="3"]');
  // wait for wave 1 to finish
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); const done = await page.evaluate(() => CS.app.match.stats.wavesCleared >= 1); if (done) break; }
  await page.waitForTimeout(400);
  console.log('5:', await tipText());
  await shot('t04-wave1done');
  await page.mouse.click(p.x, p.y); // select turret
  await page.waitForTimeout(300);
  console.log('6:', await tipText());
  await shot('t05-inspector');
  await page.keyboard.press('a');
  await page.waitForTimeout(300);
  console.log('7:', await tipText());
  // place second turret with keyboard and mouse
  await page.keyboard.press('Escape');
  await page.keyboard.press('1');
  p = await toScreen(560, 330);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  console.log('8:', await tipText());
  // Play rest of tutorial quickly: give money, auto-build, start waves
  for (let w = 0; w < 80; w++) {
    const st = await page.evaluate(() => {
      const m = CS.app.match; if (!m) return 'nomatch';
      if (m.credits > 450) { const spots = [[170, 300], [420, 330], [700, 280], [860, 460], [980, 460], [640, 110], [900, 250]]; for (const s of spots) if (m.credits >= m.placeCost('pulse') && m.canPlace('pulse', s[0], s[1]).ok) { m.placeTower('pulse', s[0], s[1]); break; } }
      for (const t of m.towers) { if (m.credits > 300 && t.tiers[0] < 2) m.upgradeTower(t, 0); }
      if (m.towers[0] && m.towers[0].targeting === 'first') { CS.app.hud.select(m.towers[0]); CS.app.hud.cycleTargeting(m.towers[0], 1); }
      if (m.canStartWave() && m.enemies.length === 0) CS.app.hud.startWave();
      return m.state + ' w' + m.wave;
    });
    if (w % 10 === 0) console.log('loop', st, '|', (await tipText()).replace(/\n/g, ' ').slice(0, 90));
    if (st.startsWith('victory') || st === 'nomatch') break;
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1800);
  await shot('t06-end');
  const save = await page.evaluate(() => ({ lvl: CS.Save.data.level, xp: CS.Save.data.xp, chips: CS.Save.data.chips, tut: CS.Save.data.tutorialDone, ach: Object.keys(CS.Save.data.achievements) }));
  console.log('save', JSON.stringify(save));
  console.log('ERRORS:', errors.join('\n') || 'none');
  await browser.close();
})();
