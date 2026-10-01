import { autoplay, stopAutoplay, seed, UNLOCKED_SAVE, PLAN_FULL } from './lib.mjs';
export default async function (page, ctx) {
  for (const [map, diff, wave] of [['twinroot', 'normal', 55], ['citadel', 'hard', 74]]) {
    await seed(page, ctx, UNLOCKED_SAVE);
    await page.click('[data-testid=play]');
    await page.click(`[data-testid=map-${map}]`);
    await page.click(`[data-testid=diff-${diff}]`);
    await page.click('[data-testid=start-run]');
    await page.waitForSelector('[data-testid=start-wave]');
    await page.evaluate((w) => { const s = window.__rk.sim(); s.wave = w - 6; s.gold = 160000; }, wave);
    await autoplay(page, { ...PLAN_FULL, baseCount: 18, waveDiv: 100, maxTowers: 24 }, 12);
    await page.waitForFunction((w) => window.__rk.sim().wave >= w || window.__rk.sim().state !== 'playing', wave, { timeout: 400000, polling: 250 });
    await page.evaluate(() => { window.__rk.session.speed = 3; });
    await page.waitForTimeout(6000);
    const fps = await page.evaluate(() => new Promise((res) => { let f = 0; const t0 = performance.now(); let worst = 0, last = t0; const tick = () => { const n = performance.now(); worst = Math.max(worst, n - last); last = n; f++; if (n - t0 < 4000) requestAnimationFrame(tick); else res({ fps: Math.round(f / 4), worst: Math.round(worst), enemies: window.__rk.sim().enemies.length, wave: window.__rk.sim().wave, lives: window.__rk.sim().lives, towers: window.__rk.sim().towers.map((t) => t.type[0] + t.levels.join('')).join(' ') }); }; requestAnimationFrame(tick); }));
    ctx.log(`${map} ${diff}:`, JSON.stringify(fps));
    await ctx.shot(`late-${map}-${diff}`);
    await stopAutoplay(page);
  }
}
