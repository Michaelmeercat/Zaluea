#!/usr/bin/env node
/*
 * Proves every level is beatable using the same rules the game runs.
 *   node tools/check-levels.js            # summary for every level
 *   node tools/check-levels.js 7 -v       # level 7 with solution path
 * Exits non-zero if any level is unbeatable, if par is unreachable while
 * collecting every key, or if a level's declared requirements do not hold.
 */
'use strict';
var path = require('path');
var Sim = require(path.join(__dirname, '..', 'sim.js'));
var Solver = require(path.join(__dirname, '..', 'solver.js'));
var LEVELS = require(path.join(__dirname, '..', 'levels.js'));

var args = process.argv.slice(2);
var verbose = args.indexOf('-v') >= 0;
var only = args.filter(function (a) { return /^\d+$/.test(a); }).map(Number);
var BEAT = 0.5;
var failures = 0;

function draw(L, turns) {
  var grid = L.def.map.map(function (r) { return r.split(''); });
  var s = Sim.initialState(L);
  var dirCh = ['^', '>', 'v', '<'];
  for (var i = 0; i < turns.length && s.status === 0; i++) {
    var r = Sim.step(L, s, turns[i]);
    var x = s.pos % L.w, y = (s.pos / L.w) | 0;
    if (turns[i] && grid[y][x] === '.') grid[y][x] = String(turns[i]);
    else if (grid[y][x] === '.') grid[y][x] = r.ev.kind === 'bonk' ? '!' : dirCh[r.ev.dir].replace('^', "'").replace('v', ',');
    s = r.state;
  }
  return grid.map(function (r) { return '    ' + r.join(' '); }).join('\n');
}

// Route a player would plan if they ignored everything that moves.
function naiveCheck(def, L) {
  if (!L.marbles.length && !L.pistons.length) return '';
  var still = Object.assign({}, def, { marbles: [], map: def.map.map(function (r) { return r.replace(/[AB]/g, '.'); }) });
  var SL = Sim.parseLevel(still);
  var plan = Solver.solve(SL, { allKeys: true, maxTap: 1 }) || Solver.solve(SL, { allKeys: true });
  if (!plan) return ' | naive: none';
  var s = Sim.initialState(L), cause = null;
  for (var i = 0; i < plan.turns.length && s.status === 0; i++) {
    var r = Sim.step(L, s, plan.turns[i]);
    if (r.ev.kind === 'bonk' && !cause) {
      var t = L.tile[s.pos + (Sim.DY[r.ev.dir] * L.w) + Sim.DX[r.ev.dir]];
      if (t === Sim.PISTON) cause = 'bonked a block';
    }
    s = r.state;
  }
  if (s.status === 1 && s.keys === (1 << L.keys.length) - 1 && !cause) return ' | naive: WORKS';
  return ' | naive: fails (' + (cause || s.cause || 'lost keys') + ')';
}

function tapInfo(turns) {
  var taps = 0, multi = 0;
  turns.forEach(function (t) { taps += t; if (t >= 2) multi++; });
  return taps + ' taps' + (multi ? ' (' + multi + ' multi)' : '');
}

LEVELS.forEach(function (def, idx) {
  var num = idx + 1;
  if (only.length && only.indexOf(num) < 0) return;
  var L;
  try { L = Sim.parseLevel(def); } catch (e) { console.log('L' + num + ' PARSE ERROR ' + e.message); failures++; return; }
  var fast = Solver.solve(L, {});
  var full = Solver.solve(L, { allKeys: true });
  var single = Solver.solve(L, { allKeys: true, maxTap: 1 });
  var problems = [];
  if (!fast) problems.push('UNBEATABLE');
  if (!full) problems.push('cannot collect every key and escape');
  if (full && def.par < full.beats) problems.push('par ' + def.par + ' < best all-key time ' + full.beats);
  if (full && def.spring < full.beats && !(def.needsWinder || def.needsWinderForKeys || L.winders.length)) problems.push('spring too short');
  if (full) {
    var end = Solver.replay(L, full.turns);
    if (end.status !== 1) problems.push('replay mismatch');
  }
  if (def.needsWinder) {
    var nw = Solver.solve(L, { noWinders: true });
    if (nw) problems.push('beatable without wind-up keys (' + nw.beats + ' beats)');
  }
  if (def.needsWinderForKeys) {
    var nwk = Solver.solve(L, { noWinders: true, allKeys: true });
    if (nwk) problems.push('all keys reachable without wind-up keys');
  }
  var line = 'L' + (num < 10 ? ' ' : '') + num + ' ' + (def.name + '                    ').slice(0, 22) +
    ' spring ' + (def.spring * BEAT).toFixed(1) + 's' +
    ' | fastest ' + (fast ? (fast.beats * BEAT).toFixed(1) + 's' : '---') +
    ' | all keys ' + (full ? (full.beats * BEAT).toFixed(1) + 's ' + tapInfo(full.turns) : '---') +
    ' | 1-tap ' + (single ? (single.beats * BEAT).toFixed(1) + 's' : '---') +
    ' | par ' + (def.par * BEAT).toFixed(1) + 's' +
    ' | period ' + L.period + naiveCheck(def, L);
  console.log(line + (problems.length ? '   <<< ' + problems.join('; ') : ''));
  if (problems.length) failures++;
  if (verbose && full) {
    console.log('   turns: ' + full.turns.join(''));
    console.log(draw(L, full.turns));
    if (fast && fast.beats < full.beats) { console.log('   fastest (keys ignored): ' + fast.turns.join('')); console.log(draw(L, fast.turns)); }
  }
});

if (failures) { console.log('\n' + failures + ' level(s) have problems'); process.exit(1); }
console.log('\nAll levels beatable.');
