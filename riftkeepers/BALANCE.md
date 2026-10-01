# Balance notes

Balance was tuned with an automated, headless player (`src/sim/bot.ts`, dev/test only) that plays full
campaigns with several build plans. Run it with `npm run balance`. The bot is a deliberately simple
player (greedy placement, cheapest-upgrade-first), so a thoughtful human should do noticeably better.

## Material changes from the brief's starting values

| Change | Before | After | Reason |
|---|---|---|---|
| World speed scale | — | Brief speeds used literally (1 world unit/sec = 1 brief unit) on a 1280×720 world | At 1.5× a base Thorn Archer killed only 7 of 30 Sproutlings: enemies left range before taking the 3 hits they need. |
| Upgrade price multipliers | 0.6 / 1.2 / 3 / 8 / 22 × base | 0.6 / 1.2 / **2.6 / 6.5 / 18** × base | Tier 3–5 gave too little power per gold; towers rarely got past tier 2 in 40 waves. Tier 5 is still a long-run goal. |
| Storm Engineer base spark | pierce 1 | **pierce 2** | 650 gold for 3.75 single-target DPS was the worst value in the shop. |
| Archer *Armor Breaker* | +1 damage | **+2 damage** | Make the main armor answer feel like a real upgrade. |
| Alchemist *Shrapnel Salts* | shred only | **+2 damage** + shred | Same reason; tier 3 should be a power spike. |
| Colossus phase 3 | ×1.6 speed, harden 2.5s every 8s | **×1.35 speed, harden 2s every 10s** | The boss reliably escaped with ~10% health left, making the swing feel unfair rather than tense. |
| First Colossus (wave 40) | 1× health | **0.8× health** | First boss should be beatable by a sound Easy build. |
| Wave 60 / 70 / 80 bosses | — | 1.8× (shielded) / 2× 1.4× / 3× 1.4× (shielded) | Stronger encounters as requested, kept within reach of tier-4/5 defenses. |
| Talent "starting gold" | "+10 starting gold" | **up to +10% starting gold** (5 ranks × 2%) | A flat +10 gold is imperceptible; 10% stays modest (65 gold on Normal). |
| Health scaling | `1 + 0.025 × max(0, wave − 10)` | unchanged (an extra post-40 ramp was tried and removed) | |

## Map changes

Twinroot Crossing, Clockwork Market and Rift Citadel originally had routes of ~1,300–1,700 units, against
~2,450 on Meadow Bend. Shorter routes mean less time in range, which made those maps 2× harder for reasons
unrelated to their mechanics. Their roads were redesigned to ~1,930–2,250 units per route. Clockwork Market
now has a long shared central stretch where towers on the centre line (mostly behind paid obstacles) reach
both roads.

## Wave authoring

Waves are authored by hand in `src/data/waves.ts` (DSL documented in the file). They were tuned against a
"health per cumulative gold" curve (`scratch`-style helper reproduced in the balance test output) so that:

- waves 1–5 only feature Sproutlings and stay well within a starting build,
- each new mechanic debuts in a small group (Bulwarks, Wisps, Broodpods…) before becoming common,
- a lighter "breather" wave follows major spikes (13, 21, 27, 33, 41, 47, 52, 57, 61, 66, 71, 76),
- the ratio of wave health to cumulative gold rises gradually (≈0.1 early → ≈0.35–0.45 late),
- boss waves (40, 60, 70, 80) are spikes by design but have long walk times.

## Latest bot results (best of three build plans, final build)

| Map | Easy (starters only) | Easy (full roster) | Normal | Hard |
|---|---|---|---|---|
| Meadow Bend | Win, 150/150 lives | Win, 150/150 | reached wave 59 | reached wave 23 |
| Sunken Ruins | Win, 150/150 | Win, 150/150 | reached wave 60 (lost on the final boss) | reached wave 48 |
| Twinroot Crossing | Win, 150/150 | Win, 150/150 | **Win** (10 lives left) | reached wave 51 |
| Frostglass Pass | — | Win, 150/150 | **Win** (56 lives left) | reached wave 55 |
| Clockwork Market | — | Win, 142/150 | reached wave 46 | reached wave 24 |
| Rift Citadel | — | Win, 150/150 | **Win** (44 lives left) | reached wave 32 |

Interpretation: Easy is welcoming; Normal is winnable and rewards planning (the bot loses mostly to
concealed + armored late waves that a player who reads the pre-wave tips can prepare for); Hard needs strong
combinations, economy and upgrade focus. Clockwork Market is the hardest map for the bot because it does not
exploit the central obstacle spots as well as a human.

Known limitation: the bot is a proxy, not a human. These numbers show relative difficulty, not exact human
outcomes.
