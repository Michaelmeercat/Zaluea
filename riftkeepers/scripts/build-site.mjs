// Copies the production build into the surrounding Zaluea site and registers it in Site/games.js.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const site = resolve(root, '..', 'Site');
if (!existsSync(site)) {
  console.log('No ../Site folder found; nothing to integrate.');
  process.exit(0);
}
const dest = resolve(site, 'games', 'riftkeepers');
rmSync(dest, { recursive: true, force: true });
cpSync(resolve(root, 'dist'), dest, { recursive: true });
const gamesJs = resolve(site, 'games.js');
const src = readFileSync(gamesJs, 'utf8');
if (!src.includes('games/riftkeepers/index.html')) {
  const next = src.replace(
    /(var games = \[\s*\n)([\s\S]*?)(\n\];)/,
    (_m, a, body, c) => `${a}${body.replace(/\s*$/, '')},\n    {name: "Riftkeepers", path: "games/riftkeepers/index.html"}${c}`,
  );
  if (next === src) throw new Error('Could not find the games list in Site/games.js');
  writeFileSync(gamesJs, next);
  console.log('Registered Riftkeepers in Site/games.js');
}
console.log('Copied build to', dest);
