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

## Known issues / warnings
- Data is an **extract, not golden** — values are decompiled but unverified against the live game.
- Primary stats are sandbox inputs in P0 (no faithful per-hero/level base yet).
- **Faction traits have no icon** (colour-only banners). The game's insignia sprites are white
  silhouettes tinted at runtime, so they render blank as raw PNGs. P1 polish: recolour/tint the
  insignia (or another emblem source) to ship real faction icons.
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
