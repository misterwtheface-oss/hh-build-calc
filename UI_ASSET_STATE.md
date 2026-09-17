# UI Asset State — Hero's Hour Build Calculator

Grounded audit of what art the calc actually ships vs. what the `_hh_extract` datamine
can supply. Produced alongside the backend mapping cycles (player colors, faction→asset
joins, skill-icon join, faction-color theme). All source frames live in
`../_hh_extract/assets/sprites/<sheet>/` and are pulled in by `build-assets.mjs`.

## Currently shipped (P0 — complete, all referenced in `data.js`)
| Dir | Files | Source sheet | Join | Status |
|---|---|---|---|---|
| `assets/heroes/` | 250 | `spr_heroportraitROGUE` | frame = `hero.index` | ✅ complete, all 250 referenced |
| `assets/artifacts/` | 268 | `spr_artifactO` | frame = `artdata[i][3]` | ✅ complete, all 268 referenced |
| `assets/classes/` | 38 | `spr_classsilhouettes` | frame = `classId + 2` | ✅ complete, all 38 referenced |

Every path stored in `data.js` is page-root-relative with the `assets/` prefix
(`assets/heroes/0.png`) per the known icon-path gotcha — no 404s.

## Empty / not yet wired
| Dir | Files | Why | Unblocked by |
|---|---|---|---|
| `assets/factions/` | 0 | Faction emblems are **white silhouettes tinted at runtime** — they render blank as raw PNGs, so P0 used colour-only banners. | **Now shippable** — see below. |
| `assets/skills/` | 0 | Skill-tree picker (P1) not built yet. | `skills_consolidated.json` (298 icons mapped). |

## Findings from the mapping cycles

**Faction emblems are now shippable (closes the P0 "faction traits have no icon" gap).**
Both `spr_factions_` (large 64×64) and `spr_insignia_` (small) are white-on-transparent
silhouettes — verified visually, both blank as raw art. But we now have:
- `_hh_extract/data/player_colors.json` — 21 player colours → exact hex (Cycle 1).
- `_hh_extract/data/faction_color_theme.json` — a curated faction→colour mapping (Cycle 4).

So the calc can render **real coloured emblems** by using each `spr_factions_` frame as a
CSS `mask-image` (or canvas multiply) and filling with the faction's themed hex. 15 frames
(engine faction index 0–14) cover every faction incl. Elemental/Neutral/Rogue. This replaces
the colour-only banners with tinted insignia at no extra art cost.

**Skill icons are fully mapped and ready to copy (P1 skill-tree picker).**
`spr_skills_RR` has 511 frames; `_hh_extract/data/skills/skills_consolidated.json` joins
**298/298 skill names → {backendIndex, iconFrame, maxRanks, kind}** (Cycle 3). `build-assets.mjs`
just needs to copy the referenced `iconFrame`s into `assets/skills/`. (Short descriptions are
partial — `skill_descriptions.gml` only *rewrites* 22 skills; full text lives in the on-disk
skilltree data, not this file.)

**Unit sprites available for army composition (P1, later).**
`faction_assets.json` (Cycle 2) groups every hero portrait + class silhouette by faction and
records each faction's unit sheet (`spr_mob_*`, idle frame = `unitIndexWithinFaction * 20`).
Not copied yet — needed once army composition lands. Artifacts are **faction-neutral** and are
deliberately not grouped under any faction.

## Recommended next asset steps (priority order)
1. **Tint faction emblems** — copy `spr_factions_` frames 0–14 → `assets/factions/`, add
   `faction_color_theme.json` to the data bundle, render as tinted masks. Small, high polish.
2. **Copy skill icons** — extend `build-assets.mjs` to copy `skills_consolidated.json`
   `iconFrame`s → `assets/skills/`; bundle the JSON. Prereq for the skill-tree picker.
3. **Unit display sprites** — trim `spr_mob_*` idle frames per faction when army composition
   is built.
