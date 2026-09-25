/* Headless balance simulator for CIRCUIT SIEGE.
 * Usage: node tools/sim.js [mapId] [diff] [strategy] [maxWave]
 * Loads the real game scripts into a VM context and plays with a simple bot.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', 'js');
const FILES = ['util.js', 'data/towers.js', 'data/enemies.js', 'data/maps.js', 'data/waves.js', 'data/progression.js', 'game/fx.js', 'game/match.js'];

function loadCS() {
  const ctx = { console, Math, Date, JSON, Object, Array, Float32Array, Map, Set, setTimeout, clearTimeout };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.CS;
}

const STRATS = {
  // Each entry: list of [towerType, pathPriorities] cycled when buying
  basic: { towers: ['pulse', 'pulse', 'sniper', 'firewall', 'arc', 'pulse', 'arc', 'sniper'], plan: { pulse: [[0, 2], [2, 2], [0, 5]], sniper: [[2, 2], [0, 5], [1, 2]], firewall: [[0, 2], [2, 3], [0, 5]], arc: [[1, 2], [0, 5], [2, 2]] } },
  mixed: { towers: ['pulse', 'pulse', 'sniper', 'missile', 'arc', 'firewall', 'drone', 'missile', 'arc', 'sniper'], plan: { pulse: [[2, 2], [1, 5], [0, 2]], sniper: [[2, 2], [0, 5], [1, 2]], missile: [[2, 2], [1, 5], [0, 2]], arc: [[2, 2], [1, 5]], firewall: [[0, 5], [2, 2]], drone: [[2, 2], [1, 5]] } },
  farm: { towers: ['pulse', 'pulse', 'farm', 'sniper', 'arc', 'farm', 'missile', 'firewall', 'arc'], plan: { pulse: [[2, 2], [1, 5], [0, 2]], sniper: [[2, 2], [0, 5], [1, 2]], missile: [[2, 2], [1, 5], [0, 2]], arc: [[2, 2], [0, 5]], firewall: [[0, 5], [2, 2]], farm: [[0, 3], [2, 2], [0, 5]] } },
  late: { towers: ['pulse', 'pulse', 'sniper', 'missile', 'virus', 'arc', 'rail', 'amp', 'gravity', 'quantum', 'arc', 'missile'], plan: { pulse: [[2, 2], [1, 5], [0, 2]], sniper: [[2, 2], [0, 5], [1, 2]], missile: [[2, 2], [1, 5], [0, 2]], arc: [[2, 2], [0, 5]], virus: [[0, 2], [1, 5], [2, 2]], rail: [[2, 2], [0, 5], [1, 2]], amp: [[1, 5], [2, 2]], gravity: [[0, 5], [1, 2]], quantum: [[1, 2], [0, 5]] } },
};

function candidateSpots(CS, m) {
  // grid of spots scored by path coverage within 130px
  const spots = [];
  for (let y = 30; y < 700; y += 24) {
    for (let x = 30; x < 1260; x += 24) {
      const d = CS.pathDistAt(m.map, x, y);
      if (d < 40 || d > 90) continue;
      let cover = 0;
      for (const p of m.map.paths) for (let k = 0; k < p.n; k += 5) { const dx = p.xs[k] - x, dy = p.ys[k] - y; if (dx * dx + dy * dy < 130 * 130) cover++; }
      spots.push({ x, y, cover });
    }
  }
  spots.sort((a, b) => b.cover - a.cover);
  return spots;
}

function run(mapId, diff, stratName, maxWave, opts) {
  opts = opts || {};
  const CS = loadCS();
  const strat = STRATS[stratName];
  const m = new CS.Match({ mapId, diff, loadout: strat.towers, modes: opts.modes || [] });
  const spots = candidateSpots(CS, m);
  let buyIdx = 0;
  const t0 = Date.now();
  let lastLeaks = 0;
  const log = [];
  m.listener = (type, d) => {
    if (type === 'leak' && d.dmg > 50) { const b = m.enemies.find((e) => e.boss && !e.alive && e.dist >= e.path.len) || m.bossBar; log.push(`BOSS LEAK wave ${m.wave}`); }
    if (type === 'bossKilled') log.push(`boss ${d.type} killed wave ${m.wave} t=${(simTime/60).toFixed(1)}m`);
    if (type === 'waveEnd' && (d.wave % 10 === 0 || m.stats.leaks > lastLeaks)) {
      log.push(`w${d.wave} core=${m.coreHp} credits=${m.credits} towers=${m.towers.length} leaks=${m.stats.leaks} enemiesAlive=${m.enemies.length}`);
      lastLeaks = m.stats.leaks;
    }
  };
  let simTime = 0;
  function spend() {
    for (let guard = 0; guard < 30; guard++) {
      // Try upgrade plan first when we have >= 6 towers, else build
      const nextType = strat.towers[buyIdx % strat.towers.length];
      const target = Math.min(opts.maxTowers || 40, 3 + Math.floor(m.wave / 2.5));
      const wantBuild = m.towers.length < target;
      let did = false;
      if (wantBuild && m.credits >= m.placeCost(nextType)) {
        for (const s of spots) {
          if (m.canPlace(nextType, s.x, s.y).ok) { m.placeTower(nextType, s.x, s.y); buyIdx++; did = true; break; }
        }
      }
      if (!did) {
        // cheapest useful upgrade following plan
        let best = null, bc = Infinity;
        for (const t of m.towers) {
          const plan = strat.plan[t.type];
          if (!plan) continue;
          for (const [p, cap] of plan) {
            if (t.tiers[p] >= cap) continue;
            if (!CS.canTakeUpgrade(t.tiers, p).ok) continue;
            const c = m.upgradeCost(t, p);
            if (c < bc) { bc = c; best = [t, p]; }
            break;
          }
        }
        if (best && m.credits >= bc) { m.upgradeTower(best[0], best[1]); did = true; }
      }
      if (!did) break;
    }
  }
  const origLeak = m.leak.bind(m);
  m.leak = (e) => { if (e.boss) log.push(`boss ${e.type} leaked with ${(100 * e.hp / e.maxHp).toFixed(0)}% hp`); origLeak(e); };
  while (m.state === 'play' && m.wave < maxWave) {
    spend();
    if (m.canStartWave() && m.enemies.length === 0) m.startWave();
    for (let i = 0; i < 30; i++) { m.step(1 / 60); simTime += 1 / 60; }
    if (simTime > 60 * 60 * 3) { log.push('TIMEOUT'); break; }
    if (m.state === 'victory') break;
  }
  const ms = Date.now() - t0;
  return { result: m.state, wave: m.wave, core: m.coreHp, leaks: m.stats.leaks, credits: m.credits, earned: m.stats.creditsEarned, towers: m.towers.map((t) => t.type + '[' + t.tiers.join('') + ']').join(' '), log, ms, simMin: (simTime / 60).toFixed(1) };
}

if (require.main === module) {
  const [mapId = 'green', diff = 'standard', strat = 'mixed', maxWave = '999'] = process.argv.slice(2);
  const r = run(mapId, diff, strat, +maxWave);
  console.log(r.log.join('\n'));
  console.log(`RESULT ${mapId}/${diff}/${strat}: ${r.result} wave=${r.wave} core=${r.core} leaks=${r.leaks} earned=${r.earned} sim=${r.simMin}min real=${r.ms}ms`);
  console.log('towers:', r.towers);
}
module.exports = { run, loadCS };
