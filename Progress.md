# Hero's Hour Build Calculator — Progress

## Current state
Scaffolded 2026-09-14. P0 flow is runnable: pick a hero (realm HH/RR toggle), equip artifacts on a
10-slot paperdoll over the class silhouette, adjust primary stats, and read live totals (Base |
Artifacts | Total) plus derived army-damage/health buffs and a faction/set cross-reference matrix with
set-completion. Data + assets are compiled from the sibling `_hh_extract` by `build-data.mjs` /
`build-assets.mjs`. Data is a raw extract — **decompiled, not hand-verified**.

## Backlog
### In progress
- [ ] (none — P0 landed)
### Next up (P1)
- [ ] 16-slot skill-tree picker (fixed pyramid, HH/RR realms) using `skill_icons.json`
- [ ] Army composition (faction dwellings + neutrals) with combat-stat readout
- [ ] Artifact skill-grants (effect codes ≥18) + spell/magic-school synergy into the stat model
- [ ] Faithful per-hero base primary stats from the class level-up model (replaces sandbox inputs)
- [ ] Save / load / share builds (schema-versioned under `hhbc.builds`)
### Later (P2)
- [ ] Battle / DPS simulation from `../_hh_extract/code/PROCEDURAL_MAP.md`
- [ ] Appendix + detail pages; collection tracking
- [ ] Trimmed per-unit display sprites (`unitIdx*20`), unit-type & magic-school trait channels live
### Done
- [x] Skeleton scaffolded, P0 flow runnable (2026-09-14)
- [x] **Faction landing screen** (2026-09-17) — app now opens on a vertical list of parchment
  rectangle tiles, one per playable faction in factionIndex order, each with its faction-tinted
  **sigil** (spr_factions_ white silhouette + CSS mask) and the **Cinzel** display font. Tile →
  hero selector filtered to that faction; a "‹ Factions" button in the build header returns to it.
  Returning users (saved hero) skip to the build. Fed by new `data.factions` + `assets/factions/`.
- [x] **Faction unit rosters on landing tiles** (2026-09-17) — each of the 12 base faction tiles shows
  its 9 units as tiny ordered pixel sprites (idle frame = `unitIndex*20` off `spr_mob_*`, parsed from
  `MOBID_base_table.gml`), name on hover. 108 sprites in `assets/units/`; Rogue (no standard town) has
  no strip. Verified the frame mapping empirically (idx4→Cavalry, idx6→Gryphon).

## Known issues / warnings
- Data is an **extract, not golden** — values are decompiled but unverified against the live game.
- Primary stats are sandbox inputs in P0 (no faithful per-hero/level base yet).
- **Faction trait banners are still colour-only.** SOLVED for the landing (sigils tint via CSS
  `mask` + `--fac-color`); the trait banners themselves haven't adopted masked sigils yet because a
  faction-coloured sigil on a same-coloured banner would be invisible. Follow-up: tint the sigil a
  contrasting ink/cream inside banners if we want icons there too.
- Any `build-data.mjs` hygiene warnings get parked here as they arise.

## Session log
- 2026-09-14: Scaffolded from build-calc-planner. Planning artifacts + skeleton adapted for the HH
  hero build (hero selector, artifact paperdoll, primary-stat table, faction/set xref matrix).
  Pipeline reads `_hh_extract`; palette sampled from game UI art. P0 verified locally; git initialized.
- 2026-09-14: **Published to GitHub Pages** → https://misterwtheface-oss.github.io/hh-build-calc/
  (repo `misterwtheface-oss/hh-build-calc`, branch `master`); analytics beacon activated.
- 2026-09-14: **Fixed icon 404s** — stored icon paths omitted the `assets/` prefix so every image
  404'd live; now stored page-root-relative (`assets/heroes|artifacts|classes/…`) and checked as-is.
  Dropped the blank runtime-tinted faction insignia (faction traits are colour-only now). Verified
  live: art renders.
