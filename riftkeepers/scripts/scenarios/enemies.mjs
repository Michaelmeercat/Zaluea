import { clickWorld, seed, spots, worldToPage } from './lib.mjs';
export default async function (page, ctx) {
  await seed(page, ctx);
  await page.click('[data-testid=play]');
  await page.click('[data-testid=tab-sandbox]');
  await page.click('[data-testid=sandbox-meadow]');
  await page.waitForSelector('.sandbox-tools');
  const enemies = ['sproutling', 'skitter', 'bulwark', 'wisp', 'emberkin', 'frostling', 'broodpod', 'mender', 'brute', 'colossus'];
  for (const e of enemies) { await page.selectOption('.sandbox-tools select', e); await page.click('[data-testid=sb-spawn1]'); }
  await page.selectOption('.sandbox-tools select', 'sproutling');
  for (const v of ['Concealed', 'Regenerating', 'Shielded', 'Reinforced']) {
    await page.check(`.chips label:has-text("${v}") input`);
    await page.click('[data-testid=sb-spawn1]');
    await page.uncheck(`.chips label:has-text("${v}") input`);
  }
  await page.evaluate(() => { window.__rk.session.speed = 3; });
  await page.waitForTimeout(7000);
  // apply statuses for visual check
  await page.evaluate(() => {
    const s = window.__rk.sim();
    const es = s.enemies;
    s.applyBurn(es[0], 1, 30, 0, 0); s.applySlow(es[1], 'frost', 0.4, 30); s.applyFreeze(es[2], 30, 0); es[3].markAmt = 0.3; es[3].markT = 30;
    s.applyCorrode(es[4], 1, 30, 0); es[5].stunT = 30; es[6].hp = es[6].maxHp * 0.4;
  });
  await page.waitForTimeout(500);
  const p1 = await worldToPage(page, 0, 0), p2 = await worldToPage(page, 1280, 720);
  await page.screenshot({ path: '/tmp/claude-0/shots/enemies-full.png', clip: { x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y } });
  // boss phases
  const st = [];
  for (const f of [0.5, 0.2]) {
    await page.evaluate((f) => { const b = window.__rk.sim().enemies.find((e) => e.def.boss); b.hp = b.maxHp * f; }, f);
    await page.waitForTimeout(2600);
    st.push(await page.evaluate(() => { const b = window.__rk.sim().enemies.find((e) => e.def.boss); return `phase ${b.boss.phase} tele ${b.boss.telegraph || '-'} summons ${b.boss.summonsTotal} harden ${b.boss.hardenT.toFixed(1)}`; }));
    const b = await page.evaluate(() => { const b = window.__rk.sim().enemies.find((e) => e.def.boss); return { x: b.x, y: b.y }; });
    const c = await worldToPage(page, b.x, b.y);
    await page.screenshot({ path: `/tmp/claude-0/shots/boss-${f}.png`, clip: { x: c.x - 160, y: c.y - 140, width: 320, height: 240 } });
  }
  ctx.log('boss', st.join(' | '));
}
