/*
 * Breadth-first search over beats. Used offline to prove every level can be
 * beaten (and to set par times), and in-game to power the "Show me" hint.
 */
(function (root) {
  'use strict';
  var Sim = (typeof module !== 'undefined' && module.exports) ? require('./sim.js') : root.WSim;

  // opts.allKeys: only accept escapes holding every gold key.
  // opts.noWinders: pretend wind-up keys do not exist (to test they are needed).
  // opts.maxTap: limit taps per tile (1 = never double/triple tap).
  // Returns { beats, turns: [turns per beat] } or null.
  function solve(L, opts) {
    opts = opts || {};
    var allKeys = (1 << L.keys.length) - 1;
    var start = Sim.initialState(L);
    var seen = Object.create(null);
    var layer = [{ s: start, parent: null, turns: 0 }];
    var maxBeats = opts.maxBeats || 400;
    function keyOf(s) {
      return s.pos + ',' + s.dir + ',' + (s.b % L.period) + ',' + s.keys + ',' + s.winders + ',' + s.crumbled;
    }
    seen[keyOf(start)] = true;
    for (var b = 0; b < maxBeats && layer.length; b++) {
      var next = [];
      for (var i = 0; i < layer.length; i++) {
        var node = layer[i];
        var choices = Sim.isForced(L, node.s) ? 1 : (opts.maxTap ? opts.maxTap + 1 : 4);
        for (var t = 0; t < choices; t++) {
          var r = Sim.step(L, node.s, t);
          var ns = r.state;
          if (opts.noWinders && r.ev.winder >= 0) continue;
          if (ns.status === 1) {
            if (!opts.allKeys || ns.keys === allKeys) {
              var turns = [t], p = node;
              while (p.parent) { turns.push(p.turns); p = p.parent; }
              turns.reverse();
              return { beats: ns.b, turns: turns, keys: ns.keys };
            }
            continue;
          }
          if (ns.status !== 0) continue;
          var k = keyOf(ns);
          if (seen[k]) continue;
          seen[k] = true;
          next.push({ s: ns, parent: node, turns: t });
        }
      }
      layer = next;
    }
    return null;
  }

  // Replays a turn list through the rules; returns the final state.
  function replay(L, turns) {
    var s = Sim.initialState(L);
    for (var i = 0; i < turns.length && s.status === 0; i++) s = Sim.step(L, s, turns[i]).state;
    return s;
  }

  var api = { solve: solve, replay: replay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WSolver = api;
})(this);
