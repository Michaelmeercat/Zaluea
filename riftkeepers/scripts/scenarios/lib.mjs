export async function worldToPage(page, x, y) {
  const box = await page.locator('.field canvas').boundingBox();
  const s = Math.min(box.width / 1280, box.height / 720);
  const ox = (box.width - 1280 * s) / 2, oy = (box.height - 720 * s) / 2;
  return { x: box.x + ox + x * s, y: box.y + oy + y * s };
}
export async function clickWorld(page, x, y) {
  const p = await worldToPage(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
}
export async function tapWorld(page, x, y) {
  const p = await worldToPage(page, x, y);
  await page.touchscreen.tap(p.x, p.y);
}
export async function waitWaveEnd(page, timeout = 240000) {
  await page.waitForFunction(() => !window.__rk.sim().waveActive, null, { timeout, polling: 250 });
}
export async function fast(page, speed) {
  await page.evaluate((s) => { window.__rk.session.speed = s; }, speed);
}
export async function freshStart(page, ctx) {
  await page.goto(ctx.base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-testid=play]');
}
export const UNLOCKED_SAVE = {
  version: 2, shards: 2000, totalShardsEarned: 2000, unlockedMaps: ['meadow', 'ruins', 'twinroot', 'frostglass', 'market', 'citadel'],
  medals: { meadow: { easy: true, normal: true }, ruins: { easy: true }, twinroot: { easy: true } },
  stats: { victories: 4, defeats: 0, totalKills: 100, bossKills: 0, runs: 4 }, tutorialDone: true,
};
export async function seed(page, ctx, save = UNLOCKED_SAVE) {
  await page.goto(ctx.base);
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('riftkeepers.save', JSON.stringify(s)); }, save);
  await page.reload();
  await page.waitForSelector('[data-testid=play]');
}
/** Find valid spots via the sim (dev hook). */
export async function spots(page, type, n, minGap = 60) {
  return page.evaluate(([type, n, minGap]) => {
    const sim = window.__rk.sim();
    const out = [];
    for (let y = 60; y < 680 && out.length < n; y += 23)
      for (let x = 60; x < 1220 && out.length < n; x += 29) {
        if (out.some((p) => Math.hypot(p.x - x, p.y - y) < minGap)) continue;
        if (sim.checkPlace(type, x, y).ok) out.push({ x, y });
      }
    return out;
  }, [type, n, minGap]);
}
/** Install the dev-only bot inside the page to auto-play the current session (dev server only). */
export async function autoplay(page, plan, speed = 30) {
  await page.evaluate(async ([plan, speed]) => {
    const { Bot } = await import('/src/sim/bot.ts');
    const sess = window.__rk.session;
    const bot = new Bot(sess.sim, plan);
    sess.speed = speed;
    window.__bot = bot;
    window.__botTimer = setInterval(() => {
      const s = window.__rk?.session?.sim;
      if (!s || s.state !== 'playing') return;
      if (bot.sim !== s) bot.sim = s;
      bot.act();
      bot.useAbilities();
      if (!s.waveActive && !document.querySelector('.modal')) window.__rk.session.startWave();
    }, 120);
  }, [plan, speed]);
}
export async function stopAutoplay(page) {
  await page.evaluate(() => clearInterval(window.__botTimer));
}
export const PLAN_FULL = {
  build: [
    { type: 'archer', paths: [0, 2] }, { type: 'alchemist', paths: [0, 2] }, { type: 'archer', paths: [1, 2] },
    { type: 'warden', paths: [1, 0] }, { type: 'alchemist', paths: [2, 0] }, { type: 'storm', paths: [0, 2] },
    { type: 'lyra', paths: [0, 0] }, { type: 'beacon', paths: [0, 1] }, { type: 'archer', paths: [0, 2] },
    { type: 'alchemist', paths: [0, 2] }, { type: 'storm', paths: [1, 2] }, { type: 'warden', paths: [0, 1] },
  ],
  repeat: { type: 'alchemist', paths: [0, 1] }, baseCount: 3, waveDiv: 4,
};
export const PLAN_STARTER = {
  build: [
    { type: 'archer', paths: [0, 2] }, { type: 'archer', paths: [1, 2] }, { type: 'alchemist', paths: [0, 2] },
    { type: 'warden', paths: [1, 0] }, { type: 'archer', paths: [0, 2] }, { type: 'alchemist', paths: [2, 0] },
    { type: 'archer', paths: [1, 0] }, { type: 'warden', paths: [0, 1] }, { type: 'alchemist', paths: [0, 2] },
  ],
  repeat: { type: 'alchemist', paths: [0, 1] }, baseCount: 3, waveDiv: 5,
};
