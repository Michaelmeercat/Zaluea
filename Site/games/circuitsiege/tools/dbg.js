const { loadCS } = require('./sim.js');
const bot = require('./bot.js');
// patch: print per-wave core for swarm
const origPlay = bot.play;
const CSx = loadCS();
