const { play } = require('./bot.js');
const [maps, diffs, los, mw] = process.argv.slice(2);
for (const map of maps.split(',')) for (const diff of diffs.split(',')) for (const lo of los.split(',')) {
  const r = play(map, diff, lo, +(mw || 999), [], false);
  console.log(`${map.padEnd(10)} ${diff.padEnd(9)} ${lo.padEnd(8)} ${r.result.padEnd(8)} wave=${String(r.wave).padEnd(3)} core=${String(Math.round(r.core)).padEnd(4)} earned=${r.earned}`);
}
