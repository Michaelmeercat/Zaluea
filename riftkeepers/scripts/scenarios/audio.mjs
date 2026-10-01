import { seed, UNLOCKED_SAVE } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx, UNLOCKED_SAVE);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=map-meadow]');
  await page.click('[data-testid=start-run]');
  await page.waitForSelector('[data-testid=start-wave]');
  await page.waitForTimeout(800);
  const a1 = await page.evaluate(() => { const a = window.__rk.audio; return { state: a.ctx && a.ctx.state, master: a.master.gain.value, music: a.musicGain.gain.value.toFixed(3), sfx: a.sfxGain.gain.value.toFixed(3) }; });
  ctx.log('after gesture', JSON.stringify(a1));
  // trigger sounds rapidly at 3x: voice cap should hold
  await page.evaluate(() => { const a = window.__rk.audio; let max = 0; const orig = a.voice.bind(a); window.__maxVoices = 0; a.voice = (d) => { orig(d); window.__maxVoices = Math.max(window.__maxVoices, a.voices); }; for (let i = 0; i < 300; i++) a.play(['arrow', 'kill', 'boom', 'spark', 'coin'][i % 5]); });
  ctx.log('max simultaneous voices after 300 rapid plays:', await page.evaluate(() => window.__maxVoices));
  // pause -> settings -> mute & sliders
  await page.click('[data-testid=pause]');
  await page.click('[data-testid=pause-settings]');
  await page.check('.modal label.toggle:has-text("Mute everything") input');
  await page.waitForTimeout(200);
  const a2 = await page.evaluate(() => window.__rk.audio.master.gain.value);
  await page.uncheck('.modal label.toggle:has-text("Mute everything") input');
  await page.locator('.modal input[aria-label="Music volume"]').fill('20');
  await page.locator('.modal input[aria-label="Sound effects"]').fill('90');
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('riftkeepers.save')).settings);
  ctx.log('muted master gain', a2.toFixed(3), 'settings saved', JSON.stringify({ music: s.music, sfx: s.sfx, muted: s.muted }));
  await ctx.shot('ingame-settings');
  // hidden page auto-pauses and suspends audio
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.click('[data-testid=start-wave]', { force: true });
  await page.waitForTimeout(500);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ paused: window.__rk.session.paused, tick: window.__rk.sim().tick, audio: window.__rk.audio.ctx.state }));
  await page.waitForTimeout(1000);
  const st2 = await page.evaluate(() => window.__rk.sim().tick);
  ctx.log('hidden -> paused', st.paused, 'audio', st.audio, 'sim ticks frozen', st.tick === st2);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  ctx.log('visible again: audio', await page.evaluate(() => window.__rk.audio.ctx.state), 'pause menu shown', await page.isVisible('[data-testid=resume]'));
}
