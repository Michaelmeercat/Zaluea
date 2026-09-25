/* Competent-player bot for balance testing.
 * node tools/bot.js <map> <diff> <loadoutName> [maxWave] [modes,comma]
 */
'use strict';
const { loadCS } = require('./sim.js');

const PLANS = {
  pulse: [[2, 1], [2, 2], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
  sniper: [[2, 1], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2], [0, 4], [0, 5]],
  firewall: [[0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [0, 4], [0, 5]],
  arc: [[0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [0, 4], [0, 5]],
  missile: [[2, 1], [2, 2], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
  drone: [[2, 1], [2, 2], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
  farm: [[0, 1], [0, 2], [0, 3], [2, 1], [2, 2], [0, 4], [0, 5]],
  virus: [[0, 1], [2, 1], [0, 2], [2, 2], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
  rail: [[2, 1], [2, 2], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
  amp: [[1, 1], [1, 2], [2, 1], [2, 2], [1, 3], [1, 4], [1, 5]],
  gravity: [[2, 1], [0, 1], [0, 2], [2, 2], [0, 3], [0, 4], [0, 5]],
  quantum: [[1, 1], [1, 2], [2, 1], [2, 2], [0, 1], [0, 2], [0, 3], [0, 4]],
};
const LOADOUTS = {
  starter: ['pulse', 'sniper', 'firewall', 'arc'],
  general: ['pulse', 'sniper', 'arc', 'missile', 'firewall', 'drone'],
  econ: ['pulse', 'sniper', 'arc', 'missile', 'farm', 'amp'],
  late: ['pulse', 'sniper', 'virus', 'rail', 'gravity', 'quantum'],
  swarm: ['pulse', 'drone', 'arc', 'missile', 'virus', 'amp'],
  pulseonly: ['pulse'],
};
// Build order weights per loadout (which tower to add next)
function nextType(lo, m, counts) {
  const w = m.wave;
  const want = [];
  const has = (t) => lo.includes(t);
  if ((counts.pulse || 0) < 2 && has('pulse')) return 'pulse';
  if (w >= 3 && has('sniper') && (counts.sniper || 0) < 1 + Math.floor(w / 25)) return 'sniper';
  if (w >= 6 && has('farm') && (counts.farm || 0) < Math.min(3, Math.floor(w / 8))) return 'farm';
  if (w >= 8 && has('arc') && (counts.arc || 0) < 1 + Math.floor(w / 20)) return 'arc';
  if (w >= 10 && has('missile') && (counts.missile || 0) < 1 + Math.floor(w / 22)) return 'missile';
  if (w >= 12 && has('firewall') && (counts.firewall || 0) < 1 + Math.floor(w / 30)) return 'firewall';
  if (w >= 12 && has('drone') && (counts.drone || 0) < 1 + Math.floor(w / 30)) return 'drone';
  if (w >= 10 && has('virus') && (counts.virus || 0) < 1 + Math.floor(w / 25)) return 'virus';
  if (w >= 14 && has('rail') && (counts.rail || 0) < 1 + Math.floor(w / 25)) return 'rail';
  if (w >= 16 && has('gravity') && (counts.gravity || 0) < 1 + Math.floor(w / 35)) return 'gravity';
  if (w >= 22 && has('amp') && (counts.amp || 0) < 1 + Math.floor(w / 30)) return 'amp';
  if (w >= 28 && has('quantum') && (counts.quantum || 0) < Math.floor(w / 20)) return 'quantum';
  for (const t of lo) want.push(t);
  return want[(counts._n || 0) % want.length];
}

function coverage(CS, m, x, y, r) {
  let c = 0;
  for (const p of m.map.paths) for (let k = 0; k < p.n; k += 4) { const dx = p.xs[k] - x, dy = p.ys[k] - y; if (dx * dx + dy * dy < r * r) c++; }
  return c;
}

function play(mapId, diff, loName, maxWave, modes, verbose) {
  const CS = loadCS();
  const lo = LOADOUTS[loName] || loName.split('+');
  const m = new CS.Match({ mapId, diff, loadout: lo, modes: modes || [] });
  const spots = [];
  for (let y = 24; y < 700; y += 20) for (let x = 24; x < 1260; x += 20) {
    const d = CS.pathDistAt(m.map, x, y);
    if (d < 36 || d > 200) continue;
    spots.push({ x, y, c130: coverage(CS, m, x, y, 130), c90: coverage(CS, m, x, y, 85), c200: coverage(CS, m, x, y, 200), d });
  }
  const log = [];
  let simTime = 0;
  m.leak = ((orig) => (e) => { if (e.boss && verbose) log.push(`  boss ${e.type} leaked ${(100 * e.hp / e.maxHp).toFixed(0)}% hp w${m.wave}`); orig(e); })(m.leak.bind(m));
  m.listener = (type, d) => {
    if (type === 'bossKilled' && verbose) log.push(`  boss ${d.type} killed w${m.wave}`);
    if (type === 'waveEnd' && verbose && (d.wave % 10 === 0 || process.env.ALLW)) log.push(`w${d.wave} core=${m.coreHp} earned=${m.stats.creditsEarned} bank=${Math.round(m.credits)} towers=${m.towers.map((t) => t.type[0] + t.tiers.join('')).join(',')}`);
  };
  const counts = { _n: 0 };
  function bestSpot(type) {
    const def = CS.TOWERS[type];
    const s = CS.buildStats(type, [0, 0, 0]);
    const key = def.kind === 'aura' ? 'c90' : s.range > 180 ? 'c200' : 'c130';
    let best = null, bs = -1;
    for (const sp of spots) {
      if (def.kind === 'aura' && sp.d > 60) continue;
      if (!m.canPlace(type, sp.x, sp.y).ok) continue;
      if (m.def.corruption && m.def.corruption.some((z) => (z.x - sp.x) ** 2 + (z.y - sp.y) ** 2 < (z.r + 6) ** 2)) continue;
      let sc = sp[key];
      if (type === 'amp' || type === 'farm') { sc = 0; for (const t of m.towers) if ((t.x - sp.x) ** 2 + (t.y - sp.y) ** 2 < 100 * 100) sc += 5; sc += sp.d > 50 ? 1 : 0; }
      if (sc > bs) { bs = sc; best = sp; }
    }
    return best;
  }
  const focus = +(process.env.FOCUS || 1.2);
  function tick() {
    for (let guard = 0; guard < 20; guard++) {
      const target = Math.min(+(process.env.MAXT || 16), 2 + Math.floor(m.wave / 3));
      let did = false;
      if (m.towers.length < target) {
        const t = nextType(lo, m, counts);
        const cost = m.placeCost(t);
        if (m.credits >= cost) {
          const sp = bestSpot(t);
          if (sp && m.placeTower(t, sp.x, sp.y)) { counts[t] = (counts[t] || 0) + 1; counts._n++; did = true; }
        } else if (m.towers.length < 3) break; // save for it
      }
      if (!did) {
        let best = null, bc = Infinity;
        for (const t of m.towers) {
          const plan = PLANS[t.type];
          for (const [p, cap] of plan) {
            if (t.tiers[p] >= cap) continue;
            if (!CS.canTakeUpgrade(t.tiers, p).ok) break;
            const sum = t.tiers[0] + t.tiers[1] + t.tiers[2];
            let c = m.upgradeCost(t, p) / Math.pow(1 + sum, focus);
            if (sum < 2) c /= 4;
            if (t.type === 'farm' && m.wave < 40) c /= 3;
            if (c < bc) { bc = c; best = [t, p]; }
            break;
          }
        }
        if (best && m.credits >= m.upgradeCost(best[0], best[1])) { m.upgradeTower(best[0], best[1]); did = true; }
      }
      if (!did) break;
    }
    // use abilities when ready
    for (const id in m.abilities) if (m.abilityReady(id) && m.enemies.length > 5) {
      let tx, ty;
      if (id === 'orbital') { const e = m.enemies.find((q) => q.alive && q.dist > 0); if (!e) continue; tx = e.x; ty = e.y; }
      m.useAbility(id, tx, ty);
    }
    for (const t of m.towers) if (t.def.targeting.includes('strong') && t.type === 'sniper') t.targeting = 'strong';
  }
  while (m.state === 'play' && m.wave < maxWave) {
    tick();
    if (m.canStartWave() && m.enemies.length === 0) m.startWave();
    for (let i = 0; i < 30; i++) { m.step(1 / 60); simTime += 1 / 60; }
    if (simTime > 3 * 3600) break;
  }
  // finish last wave
  while (m.state === 'play' && m.enemies.length) { for (let i = 0; i < 60; i++) m.step(1 / 60); }
  return { mapId, diff, lo: loName, result: m.state, wave: m.stats.wavesCleared, core: m.coreHp, earned: m.stats.creditsEarned, mins: (simTime / 60).toFixed(0), log, towers: m.towers.map((t) => t.type + t.tiers.join('')).join(' ') };
}

if (require.main === module) {
  const [map = 'green', diff = 'standard', lo = 'general', mw = '999', modes = ''] = process.argv.slice(2);
  const r = play(map, diff, lo, +mw, modes ? modes.split(',') : [], true);
  console.log(r.log.join('\n'));
  console.log(`${r.mapId}/${r.diff}/${r.lo}: ${r.result} wave=${r.wave} core=${r.core} earned=${r.earned} time=${r.mins}m`);
  console.log(r.towers);
}
module.exports = { play, LOADOUTS };
