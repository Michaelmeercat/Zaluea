import { autoplay, stopAutoplay, seed, UNLOCKED_SAVE, PLAN_FULL } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=map-twinroot]');
  await page.click('[data-testid=diff-normal]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await autoplay(page, PLAN_FULL, 20);
  await page.waitForFunction(() => window.__rk.sim().wave >= 6 && window.__rk.sim().waveActive, null, { timeout: 120000, polling: 100 });
  await stopAutoplay(page);
  const mid = await page.evaluate(() => { const s = window.__rk.sim(); return { wave: s.wave, gold: s.gold, towers: s.towers.length, earned: s.stats.goldEarned }; });
  // buy something mid-wave, then reload without quitting
  await page.evaluate(() => { const s = window.__rk.sim(); const t = s.towers[0]; s.upgrade(t.id, 0); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).activeRun);
  ctx.log('mid-wave', JSON.stringify(mid), 'saved snapshot wave', saved.snapshot.wave, 'gold', saved.snapshot.gold, 'midWave', saved.midWave);
  await page.reload();
  await page.waitForSelector('[data-testid=continue]');
  ctx.log('continue label:', (await page.textContent('[data-testid=continue]')).replace(/\s+/g, ' '));
  await ctx.shot('continue-title');
  await page.click('[data-testid=continue]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.waitForTimeout(600);
  const restored = await page.evaluate(() => { const s = window.__rk.sim(); return { wave: s.wave, gold: s.gold, towers: s.towers.length, active: s.waveActive }; });
  ctx.log('restored', JSON.stringify(restored), 'toast:', await page.locator('.toast').allTextContents());
  if (restored.gold !== saved.snapshot.gold || restored.wave !== saved.snapshot.wave) throw new Error('restore mismatch');
  // between-wave save & quit via pause menu
  await page.click('[data-testid=start-wave]', { force: true });
  await page.waitForFunction(() => !window.__rk.sim().waveActive, null, { timeout: 120000, polling: 100 }).catch(() => {});
  await page.evaluate(() => { window.__rk.session.speed = 20; });
  await page.waitForFunction(() => !window.__rk.sim().waveActive, null, { timeout: 120000, polling: 100 });
  const before = await page.evaluate(() => { const s = window.__rk.sim(); return { wave: s.wave, gold: s.gold, lives: s.lives, towers: s.towers.map((t) => t.levels.join('')).join(',') }; });
  await page.click('[data-testid=pause]');
  await ctx.shot('pause-menu');
  await page.click('[data-testid=quit]');
  await page.waitForSelector('[data-testid=continue]');
  await page.reload();
  await page.click('[data-testid=continue]');
  await page.waitForSelector('[data-testid=start-wave]');
  const after = await page.evaluate(() => { const s = window.__rk.sim(); return { wave: s.wave, gold: s.gold, lives: s.lives, towers: s.towers.map((t) => t.levels.join('')).join(',') }; });
  ctx.log('boundary save', JSON.stringify(before), '->', JSON.stringify(after), JSON.stringify(before) === JSON.stringify(after) ? 'MATCH' : 'MISMATCH');
  // restart several times and check listeners do not accumulate
  const cdp = await page.context().newCDPSession(page);
  const count = async () => {
    const res = {};
    for (const expr of ['window', 'document']) {
      const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
      res[expr] = listeners.length;
    }
    return res;
  };
  const c0 = await count();
  for (let i = 0; i < 5; i++) {
    await page.click('[data-testid=pause]');
    await page.click('[data-testid=restart]');
    await page.click('.modal .btn-red');
    await page.waitForFunction(() => window.__rk && window.__rk.sim().wave === 0, null, { timeout: 5000 });
    await page.waitForTimeout(150);
  }
  const c1 = await count();
  ctx.log('listeners before restarts', JSON.stringify(c0), 'after 5 restarts', JSON.stringify(c1));
  const rafCheck = await page.evaluate(async () => { let n = 0; const t = performance.now(); await new Promise((r) => { const f = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n; });
  ctx.log('fps probe after restarts', rafCheck);
}
