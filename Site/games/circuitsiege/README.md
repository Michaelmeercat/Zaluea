# CIRCUIT SIEGE

An original browser tower-defense game built for Chromebooks: plain HTML5 canvas and JavaScript, with no build step and no downloads. Open `index.html` (or use the site's Games page) to play. Progress saves to the browser's local storage.

## What's in the game
- **7 maps**: Green Circuit, Data Crossing (two entrances), Cooling Facility (speed tunnels), Broken Highway (split lanes), Corruption Pit (zones that shut down towers), Central Processor (four lanes, expert) and Solar Dunes (sandstorms).
- **12 towers**, each with **3 upgrade paths × 5 tiers**. A tower can take 7 upgrades in total, and only one path can go above tier 2.
- **11 active abilities** unlocked by tier-5 upgrades (Orbital Strike, System Freeze, Emergency Overclock, and more).
- **Enemies**: 12 types, 5 elite modifiers and 4 bosses with their own mechanics (RAM Crusher, The Worm, Blackout, ROOT).
- **Difficulties**: Casual (40 waves), Standard (60), Advanced (80) and Nightmare (100), plus Endless.
- **Modes**: 7 special modes, 11 hand-made challenges and a daily challenge generated from the date.
- **Progression**: account levels, a 26-node research tree, tower mastery (skins, projectile effects, tier-5 unlocks), 32 achievements, lifetime stats, and save export/import.
- **Presentation**: synthesized sound effects and music (no audio files), Low/Medium/High/Auto graphics quality, and full keyboard shortcuts.

## Controls
`1-6` build · `Space` start wave · `F` speed · `P` pause · `A/S/D` upgrade paths · `Tab` targeting · `Del` sell · `Q W E R T Y` abilities · right-click or `Esc` cancel · `H` help

## Developer tools (`tools/`)
- `node tools/unit.js`: engine correctness sweep (every tower build, enemy, boss, ability and map).
- `node tools/bot.js <map> <difficulty> <loadout>`: a headless bot plays a full match, for balance testing.
- `node tools/sweep.js <maps> <difficulties> <loadouts>`: batch balance runs.
- `NODE_PATH=$(npm root -g) node tools/browser-test.js <outdir>`: Playwright smoke test with screenshots (also `tutorial-test.js`, `systems-test.js`, `perf-test.js`).
