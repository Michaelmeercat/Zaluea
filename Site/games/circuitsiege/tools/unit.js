/* Engine correctness sweep: node tools/unit.js */
'use strict';
const { loadCS } = require('./sim.js');
const CS = loadCS();
let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('FAIL:', msg); } };

// 1. Upgrade rule
ok(CS.canTakeUpgrade([5, 2, 0], 2).ok === false, '5-2-0 cannot add C');
ok(CS.canTakeUpgrade([4, 2, 0], 2).ok === true, '4-2-0 can add C (4-2-1)');
ok(CS.canTakeUpgrade([3, 3, 0], 0).ok === false, 'two paths above 2 not allowed');
ok(CS.canTakeUpgrade([2, 2, 2], 0).ok === true, '3-2-2 allowed');
ok(CS.canTakeUpgrade([3, 2, 2], 0).ok === false, 'budget 7 max');

// All legal builds
function legalBuilds() {
  const out = [];
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) for (let c = 0; c <= 5; c++) {
    const t = [a, b, c];
    if (a + b + c > 7) continue;
    if (t.filter((x) => x > 2).length > 1) continue;
    out.push(t);
  }
  return out;
}
const builds = legalBuilds();
const numericKeys = ['dmg', 'rate', 'range', 'projSpeed', 'pierce', 'splash', 'count', 'income'];
for (const id of CS.TOWER_ORDER) {
  for (const b of builds) {
    const s = CS.buildStats(id, b);
    for (const k of numericKeys) ok(Number.isFinite(s[k]), `${id} ${b} stat ${k}=${s[k]}`);
    ok(s.rate > 0 && s.range > 0, `${id} ${b} rate/range positive`);
  }
}

// 2. Simulate every tower at a sample of builds vs every enemy type
const enemyTypes = Object.keys(CS.ENEMIES).filter((t) => t !== 'zombie' && t !== 'wormseg' && t !== 'trojanx');
const sampleBuilds = [[0, 0, 0], [5, 2, 0], [0, 5, 2], [2, 0, 5], [2, 2, 2], [4, 1, 2], [1, 2, 4]];
const spots = { green: [[312, 212], [170, 300], [420, 330], [560, 330], [700, 280], [860, 460], [980, 460]] };
let errs = 0;
for (const id of CS.TOWER_ORDER) {
  for (const b of sampleBuilds) {
    try {
      const m = new CS.Match({ mapId: 'green', diff: 'standard', loadout: [id] });
      m.credits = 1e9;
      for (const [x, y] of spots.green) {
        const t = m.placeTower(id, x, y);
        if (!t) continue;
        for (let p = 0; p < 3; p++) for (let i = 0; i < b[p]; i++) m.upgradeTower(t, p, true);
        ok(t.tiers.join('') === b.join(''), `${id} upgrade to ${b} got ${t.tiers}`);
      }
      // amp/farm need other towers
      m.placeTower('pulse', 250, 300);
      m.wave = 30;
      for (const et of enemyTypes) m.spawnEnemy(et, 0, 50 + Math.random() * 400, 30);
      m.makeElite(m.enemies[0], 'phased');
      m.makeElite(m.enemies[1], 'commander');
      m.makeElite(m.enemies[2], 'regen');
      for (let i = 0; i < 60 * 25; i++) m.step(1 / 60);
      // abilities
      for (const aid in m.abilities) { m.abilities[aid].cd = 0; m.spawnEnemy('frag', 0, 300, 30); m.useAbility(aid, 500, 400); }
      for (let i = 0; i < 60 * 5; i++) m.step(1 / 60);
      for (const e of m.enemies) ok(Number.isFinite(e.hp) && Number.isFinite(e.x) && Number.isFinite(e.dist), `${id} ${b} enemy ${e.type} NaN`);
      for (const t of m.towers) ok(Number.isFinite(t.dmgDealt), `${id} dmgDealt NaN`);
      ok(Number.isFinite(m.credits), `${id} credits NaN`);
      if (b.join('') !== '000' && !['farm', 'amp', 'firewall', 'gravity'].includes(id)) ok(m.stats.damage > 0, `${id} ${b} dealt no damage`);
      // sell everything
      for (const t of m.towers.slice()) m.sellTower(t);
      ok(m.towers.length === 0, 'sell all');
    } catch (e) { errs++; fails++; console.log('EXCEPTION', id, b, e.stack.split('\n').slice(0, 4).join(' | ')); }
  }
}

// 3. All maps: build, reverse, spawn and run bosses
for (const md of CS.MAPS) {
  for (const rev of [false, true]) {
    try {
      const m = new CS.Match({ mapId: md.id, diff: 'nightmare', loadout: ['pulse'], modes: rev ? ['reverse', 'double', 'inflation'] : ['speed'] });
      ok(m.map.paths.every((p) => p.len > 500), md.id + ' path length');
      m.credits = 1e6;
      m.wave = 59;
      m.startWave(); // ROOT (double)
      for (let i = 0; i < 60 * 40; i++) m.step(1 / 60);
      m.spawnQueue = [];
      m.enemies.forEach((e) => (e.alive = false));
      m.step(1 / 60);
      for (const w of [20, 30, 40, 70, 90]) { m.spawnQueue = []; m.wave = w - 1; m.startWave(); for (let i = 0; i < 60 * 15; i++) m.step(1 / 60); }
      ok(true, md.id + ' ran');
    } catch (e) { errs++; fails++; console.log('EXCEPTION map', md.id, rev, e.stack.split('\n').slice(0, 4).join(' | ')); }
  }
}

// 4. Waves 1-130 generate
for (let w = 1; w <= 130; w++) { const g = CS.getWave(w, 'x', w > 100); ok(g.length > 0 && g.every((q) => CS.ENEMIES[q.type] && q.count > 0), 'wave ' + w); }

// 5. Victory detection on a short tutorial run
{
  const m = new CS.Match({ mapId: 'green', diff: 'casual', loadout: ['pulse'], tutorial: true });
  m.credits = 1e6;
  let victory = false;
  m.listener = (t) => { if (t === 'victory') victory = true; };
  for (const [x, y] of spots.green) { const t = m.placeTower('sniper', x, y); if (t) { m.upgradeTower(t, 0, true); m.upgradeTower(t, 0, true); } }
  for (let k = 0; k < 200 && !victory; k++) { if (m.canStartWave() && m.enemies.length === 0) m.startWave(); for (let i = 0; i < 120; i++) m.step(1 / 60); }
  ok(victory, 'tutorial victory fires');
  m.continueEndless();
  ok(m.canStartWave(), 'endless can start');
  m.startWave();
  ok(m.wave === 7, 'endless wave increments');
}
// 6. Daily challenge deterministic
ok(JSON.stringify(CS.PROG.dailyChallenge('2026-09-25')) === JSON.stringify(CS.PROG.dailyChallenge('2026-09-25')), 'daily deterministic');
const days = new Set(); for (let d = 1; d <= 28; d++) days.add(CS.PROG.dailyChallenge('2026-02-' + String(d).padStart(2, '0')).map);
ok(days.size >= 4, 'daily varies maps');

console.log(`${checks} checks, ${fails} failures, ${errs} exceptions`);
process.exit(fails ? 1 : 0);
