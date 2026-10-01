# Riftkeepers — development progress / handoff notes

Project lives in `riftkeepers/` (the repo root holds an unrelated proxy site; the only change there is an
added entry in `Site/games.js` plus the built game copied to `Site/games/riftkeepers/` via `npm run build:site`).

## Commands
- `npm install`, `npm run dev` (Vite, :5173), `npm run build` (typecheck + build to `dist/`), `npm run preview` (:4173)
- `npm run build:site` — build and copy into `../Site/games/riftkeepers`, registering it in the site's game list
- `npm run build:artifact` — single self-contained page in `dist-artifact/` (published as a private claude.ai Artifact)
- `npm test` — 74 unit tests; `npm run balance` — headless bot playtests (slow)
- Dev art gallery: `/gallery.html?show=maps|sprites|icon|bot` (dev server only, not in the build)
- Browser scenarios: `node scripts/drive.mjs scripts/scenarios/<name>.mjs [w] [h] [mobile]` (needs the dev server;
  `BASE=http://localhost:4173/` for the production preview). Screenshots go to `/tmp/claude-0/shots`.
- Icons: `node scripts/make-icons.mjs` (renders PNGs from game art via the gallery page)

## Architecture
- `src/core` — RNG (mulberry32), math, shared types.
- `src/data` — structured definitions: difficulty, enemies, towers (+90 upgrades with add/mul/set effects), hero,
  maps, waves (DSL, 80 authored), tips, progression (talents, cosmetics, achievements, challenges, daily modifiers).
- `src/sim` — deterministic fixed-step (1/60 s) simulation (`Sim`), no DOM. Map runtime/placement, Catmull-Rom
  path sampling, spatial grid, pre-wave snapshot/restore. `bot.ts` is dev/test only (never imported by the app).
- `src/render` — Canvas 2D renderer, procedural art (towers/enemies/maps), sprite cache, pooled particles.
- `src/audio` — WebAudio synthesized SFX (throttled, voice-capped) + procedural music (menu/game/boss).
- `src/save` — versioned save, sanitize/validate, import/export, corruption backup.
- `src/game` — progression rules (unlocks, rewards, daily, challenges), session (loop, input, HUD, saving), panels,
  tutorial.
- `src/ui` — app shell (navigation, back/Escape/browser-back, modals, toasts), screens, styles, icons.

## Status — complete
- [x] Data, sim, art, renderer, audio, save, progression, UI shell + all screens, game session, tutorial, help,
  collection, PWA (manifest, icons, generated service worker), unit tests, balance pass, site integration.

## Browser verification performed (Playwright scenarios in `scripts/scenarios`)
menus/back navigation, tutorial (fresh save → finish), first gameplay, sandbox (all 6 towers + Lyra, every path to
tier 5, all tower abilities), all enemies/variants/status indicators, boss phases, full Easy run to victory,
endless continuation + defeat, daily (reward once), restricted challenges (roster, tower cap, no-sell),
save/continue (mid-wave restore + boundary), restarts (no listener growth), mobile portrait/landscape touch flow,
rotation, audio, performance (busy 3× scene, heap after restarts), production/offline, economy UI, save
export/import/reset/corruption, keyboard shortcuts, site iframe integration.

## Known limitations
- Balance was tuned with a simple bot; human results will differ (see BALANCE.md).
- No pinch-zoom (optional in the brief); the battlefield scales to fit.
- Audio is synthesized; verified programmatically (context state, gains, voice cap), not by ear.
