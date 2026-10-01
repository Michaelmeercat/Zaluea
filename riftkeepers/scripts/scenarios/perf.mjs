import { seed, UNLOCKED_SAVE, spots } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=tab-sandbox]');
  await page.click(`[data-testid=sandbox-${process.env.MAP || 'ruins'}]`);
  await page.waitForSelector('.sandbox-tools');
  const types = ['archer', 'alchemist', 'warden', 'storm', 'archer', 'alchemist', 'storm', 'beacon', 'archer', 'alchemist', 'warden', 'storm', 'lyra', 'alchemist', 'archer', 'storm', 'warden', 'alchemist', 'archer', 'storm', 'beacon', 'orchard'];
  const placed = await page.evaluate((types) => {
    const s = window.__rk.sim();
    const res = [];
    const cand = [];
    for (let y = 40; y < 690; y += 17) for (let x = 40; x < 1240; x += 17) cand.push({ x, y });
    // prefer spots near the road
    let i = 0;
    for (const t of types) {
      let ok = false;
      for (const c of cand) {
        if (!s.checkPlace(t, c.x, c.y).ok) continue;
        let near = false;
        for (const p of s.map.paths) for (let k = 0; k < p.xs.length; k += 8) if (Math.hypot(p.xs[k] - c.x, p.ys[k] - c.y) < 75) { near = true; break; }
        if (!near) continue;
        const r = s.place(t, c.x, c.y);
        if (r.ok) {
          const lv = [[4, 2, 0], [0, 4, 2], [2, 0, 4], [3, 0, 2]][i++ % 4];
          const order = []; lv.forEach((n, p) => { if (n <= 2) for (let j = 0; j < n; j++) order.push(p); }); lv.forEach((n, p) => { if (n > 2) for (let j = 0; j < n; j++) order.push(p); });
          for (const p of order) s.upgrade(r.id, p);
          ok = true; break;
        }
      }
      res.push(ok);
    }
    return res.filter(Boolean).length;
  }, types);
  ctx.log('towers placed', placed);
  const heap0 = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
  await page.evaluate(() => { window.__rk.session.speed = 3; });
  // keep the battlefield saturated: spawn mixed waves continuously
  await page.evaluate(() => {
    const kinds = ['sproutling', 'skitter', 'bulwark', 'wisp', 'emberkin', 'frostling', 'broodpod', 'mender', 'brute'];
    window.__spawn = setInterval(() => {
      const s = window.__rk.sim();
      if (s.enemies.length < 260) for (const k of kinds) s.sandboxSpawn(k, 6, Math.random() < 0.3 ? ['shield'] : [], 12);
    }, 500);
  });
  await page.waitForTimeout(4000);
  const sample = async () => page.evaluate(() => new Promise((res) => {
    let frames = 0, worst = 0, last = performance.now();
    const t0 = last;
    const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; frames++; if (now - t0 < 5000) requestAnimationFrame(f); else res({ fps: Math.round(frames / ((now - t0) / 1000)), worstFrameMs: Math.round(worst), enemies: window.__rk.sim().enemies.length, proj: window.__rk.sim().projectiles.length, particles: window.__rk.session.renderer.particles.pool.filter((p) => p.active).length }); };
    requestAnimationFrame(f);
  }));
  const r1 = await sample();
  ctx.log('3x busy scene:', JSON.stringify(r1));
  await ctx.shot('perf-busy');
  // low quality
  await page.evaluate(() => { const a = window.__rk.session; a.app.save.settings.quality = 'low'; a.app.save.settings.reducedEffects = true; a['applyQuality'](); a['resize'](); });
  const r2 = await sample();
  ctx.log('3x busy scene (low quality + reduced effects):', JSON.stringify(r2));
  await page.evaluate(() => clearInterval(window.__spawn));
  // repeated sandbox restarts: heap should not grow without bound
  for (let i = 0; i < 6; i++) {
    await page.click('[data-testid=pause]');
    await page.click('[data-testid=quit]');
    await page.click('[data-testid=play]');
    await page.click('[data-testid=tab-sandbox]');
    await page.click(`[data-testid=sandbox-${process.env.MAP || 'ruins'}]`);
    await page.waitForSelector('.sandbox-tools');
    await page.evaluate(() => window.__rk.sim().sandboxSpawn('sproutling', 30, [], 1));
    await page.waitForTimeout(500);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const heap1 = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
  ctx.log('heap MB before', (heap0 / 1e6).toFixed(1), 'after busy scene + 6 restarts + GC', (heap1 / 1e6).toFixed(1));
}
