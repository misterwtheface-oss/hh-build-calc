# Hero's Hour Build Calculator — Progress

## Current state (updated 2026-09-18)
LIVE at https://misterwtheface-oss.github.io/hh-build-calc/. Data + assets compiled from the sibling
`_hh_extract` by `build-data.mjs` / `build-assets.mjs` (extract is decompiled, **not hand-verified**;
see `../_hh_extract/CONTEXT_MAP.md`). Deploy workflow: user said go **straight to deployment**, they
verify live (no local preview step).

Flow: **lean faction landing** → **hero selector** (list-first: the roster is the focus, a centered
info panel opens only on tap; two hero tiles per row; classes ordered by the in-game lexicon =
classId). The info panel shows the hero's **Specialty = its specialty UNIT** (icon + stats/abilities),
the real **Starting skills**, and **Starting spell** (icon + rank/school/type/targeting). → **build
view**: hero header, an **in-game-accurate paperdoll** (class silhouette centered with 5 artifact
slots flanking each side, glow bg), primary-stat steppers, live totals (Base | Artifacts | Total),
army-damage/health buffs, set bonuses. **Skill Tree** overlay = the **current 6-node model**
(hero's Learnable majors, each with faction/class-filtered sub-skills; rows show effect text with
per-rank bonuses scaled to the current rank; fixed-size gate badges; level/major-rank gating).
Mastery-unit icons cover **250/250** (DLC-complete).

## Backlog
### In progress
- [ ] (none — P0 landed)
### Next up (P1)
- [ ] Army composition (faction dwellings + neutrals) with combat-stat readout
- [ ] Artifact skill-grants (effect codes ≥18) + spell/magic-school synergy into the stat model
- [ ] Faithful per-hero base primary stats from the class level-up model (replaces sandbox inputs)
- [ ] Save / load / share builds (schema-versioned under `hhbc.builds`)
- [ ] Skill-tree polish: per-rank scaling for effects worded without the literal "per rank"
  (current scaler keys off that phrase); the ~2 missing unit stat cards (Woodfae, Conquest Minstrel)
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
- [x] ~~**Skill tree overlay** (2026-09-17) — 16-slot pyramid from `heroes.json.skilltree[realm]`~~
  **SUPERSEDED 2026-09-18** — that pyramid came from LEGACY `skilltree.{HH,RR}` files that predate a
  game rework; replaced by the current 6-node model (see the 2026-09-18 session below).

### Done — 2026-09-18 session (UI polish + major data corrections)
- [x] **Lean selectors** — dropped the "N heroes" chrome on faction tiles; hero picker is **list-first**
  (info panel only on tap), **two hero tiles per row**, classes ordered by the **lexicon (classId)**.
- [x] **Consolidated hero info panel** — centered portrait; **Specialty = the specialty UNIT** (with
  Tier/HP/DMG/growth + abilities), real **Starting skills**, and **Starting spell** (icon + rank/
  school/type/targeting). Mobile: list on top, info panel docked bottom, centered + enlarged.
- [x] **Full sprite/data audit of the extract** — confirmed **144/144 sprites exported**; resolved the
  unit→sprite mapping (`_hh_extract/data/units/unit_sprites.json`, base + Rogue-DLC realms) → mastery
  icons **77→250/250**.
- [x] **Enrichment data wired in** — `unit_stats.json`, `skill_descs.json` (100% coverage), spell
  rank/type/targeting. (Spell **mana cost is GM-PRNG-seeded** → not statically derivable, not shown.)
- [x] **DATA CORRECTIONS (were wrong, now right):**
  - Hero **specialty is the UNIT** (roster `[7]`), not roster `[9]` (which the engine repurposes as
    the skillset at runtime) — old "Specialty: <skill>" matched nothing in-game.
  - **Stale starting-skill names** — `"<Faction> Warrior"` → each faction's tier-0 subskill
    (Order Warrior → Royal Tribute), remapped from `SKILLSETDATA` in `build_heroes.mjs`.
  - **Skill tree rebuilt** to the current **6-node model** (`data.skillsets` from
    `_hh_extract/build_skillsets.mjs`, filtered to the runtime roster → 3-5 subs/node); UI shows
    effect text with **per-rank bonuses scaled to the current rank**, fixed-size gate badges.
  - **skill_descs** fixed to capture `add_skill` entries whose long-desc arg is a variable
    (`global.bufftextD`) → recovered the last missing descriptions.
- [x] **Paperdoll** rebuilt to the **in-game layout** (silhouette centered, slots flanking), full-width
  on mobile, glow background; **traits/xref table removed** from the planner.

## Known issues / warnings
- Data is an **extract, not golden** — values are decompiled but unverified against the live game.
- Primary stats are sandbox inputs (no faithful per-hero/level base yet).
- **Spell mana cost not shown** — it's rolled at runtime by GameMaker's seeded PRNG (bracketed by
  rank: t1≈4-7, t2≈8-12, t3≈14-22), so it's not statically derivable (same wall as the hero-unlock
  PRNG). We show rank/school/type/targeting instead.
- **Per-rank scaler** only computes totals for effects that use the literal phrase "per rank"; other
  wordings show the base description without a computed total.
- **2 mastery/specialty units lack stat cards** (Woodfae, Conquest Minstrel) — special units with no
  entry in `units_base/`; they still show name + icon.
- ⚠️ **Do NOT reintroduce legacy extract files:** `_hh_extract/data/skilltrees/*` (16-slot pyramid)
  and the `"<Faction> Warrior"` skillset names predate game reworks. Truth = `skillsets.json` +
  `heroes.json.learnable` (tree) and `build_heroes.mjs`'s remapped skillset (starting skills).
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
- 2026-09-18: **Big session — UI polish + data corrections + skill-tree rebuild** (all deployed).
  Lean selectors (list-first hero picker, 2-up tiles, lexicon class order); consolidated hero info
  panel (specialty UNIT + stats/abilities, real starting skills, starting spell). **Extract audit:**
  144/144 sprites confirmed; unit→sprite mapping resolved for **250/250 mastery** (base + Rogue-DLC,
  `build_unit_sprites.mjs`). Enrichment: `unit_stats.json`, `skill_descs.json` (100%), spell
  rank/type/targeting. **Corrections:** specialty = unit (not roster `[9]`); stale "<Faction> Warrior"
  starting skills → faction tier-0 subskill; **skill tree fully rebuilt to the current 6-node model**
  (`skillsets.json`, roster-filtered, per-hero faction/class sub-skill filter, per-rank effect
  scaling, gate badges) replacing the legacy pyramid; skill_descs parser fixed for variable long-desc
  args. **Paperdoll** rebuilt to the in-game centered-silhouette-with-flanking-slots layout (full-width
  + glow on mobile); traits table removed. New extract artifacts: `data/units/unit_sprites.json`,
  `unit_stats.json`, `data/skills/skill_descs.json`, `skillsets.json` (+ their `build_*.mjs`); calc
  `data.skillsets` + `hero.learnable`/`masteryUnitStats`/`startsWith`/spell fields. Docs synced:
  `../_hh_extract/CONTEXT_MAP.md`, memories [[hh-build-calc-site]] + [[project_hh_extract]].
