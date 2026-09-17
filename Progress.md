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
- [x] **Uniform unit-icon cells** (2026-09-17) — unit sprites now sit in fixed square cells
  (`object-fit: contain`) so every faction row is the same height regardless of native sprite size.
- [x] **Grouped hero menu** (2026-09-17) — faction hero picker is now sectioned by class (fighter then
  caster, e.g. Order → General / Priest) with a header + count; each hero is a row with portrait +
  name + icons of its Mastery unit, Specialty skill, and Primary (class) skill. Neutral mastery units
  not in the 12 base rosters show a dashed placeholder (sprite backfill = follow-up).
- [x] **Skill tree overlay** (2026-09-17) — full dynamic pyramid (Starting/2nd/3rd/4th rows + mastery
  tip from `heroes.json.skilltree[realm]`) with point allocation. Hero level = 1 + points spent and
  updates live; each rank's level gate = `ROW_BASE[iy](-4,0,4,6) + RANK_COST[rank](1,4,9,15,22,30…) −
  5·isSpecialty`; a skill can't out-rank its connected parent; de-allocation cascades to keep the tree
  valid. All grounded in `draw_skillpyramid_ext` + `SKILLSETDATA` (army_scripts/hero_scripts.gml).
  New pipeline data: `data.skills` (icon+maxRanks), `data.unitSprites` (name→sprite), per-hero row
  icons; `assets/skills/` copied from `spr_skills_RR`.

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
