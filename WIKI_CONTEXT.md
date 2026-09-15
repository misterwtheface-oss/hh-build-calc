# Hero's Hour — Wiki / Context Tree

## Game basics
Hero's Hour is a **HoMM-like** turn-based strategy game with a signature **real-time mass-battle**
combat system. You recruit heroes, build towns, explore an adventure map, and fight battles where
each unit in a stack is an individual creature. This calculator models the **hero build**: a hero's
class/faction, their skill-tree picks, equipped artifacts, and primary stats — and the army-wide
buffs those stats produce.

## Key mechanics (for the calculator)
- **One `obj_unit` = one creature.** A stack of N is N individual creatures; there is no shared stack
  HP pool. Army buffs apply per-creature.
- **Primary stats → army buffs (verified):** Attack → **+3 % base damage per point**; Defense →
  **+3 % base health per point** (additive-linear). Knowledge/Spellpower drive the hero's spells.
- **Skill tree is a fixed 16-slot pyramid**, identical geometry for every hero, two realm variants
  (**HH** base game, **RR** Rogue DLC): Mastery Unit → Starting 1/2 → 2nd row ×4 → 3rd row
  (1,2,middle,3,4) → 4th row ×4. Only the *contents* vary per hero — hard-code the layout.
- **Paperdoll = 10 artifact slots** in a 2-col × 5-row grid; `slot = artifact.slot − 1`; one artifact
  per slot; equipping auto-swaps. Behind the slots sits the **class silhouette**.
- **Artifact sets:** 32 sets; sets 1–8 need **3** pieces, sets 9–32 need **2**. Set completion is the
  headline paperdoll synergy.
- **⚠️ Faction-index caveat:** unit sprites use an *engine* faction order (12=Elemental, 14=Rogue)
  that differs from `heroes.json` `factionIndex` (12=Rogue). Join **units** on the engine/MOBID
  index; hero/class faction is `factionIndex`.
- **Portrait join:** hero portrait = `spr_heroportraitROGUE` frame = `hero.index` (250 frames, 1:1).

## Data sources & datamine access
- **Datamine workspace:** `../_hh_extract/` — the sibling extract (NOT shipped; see `.gitignore`).
  Entry point `../_hh_extract/CONTEXT_MAP.md`; formulas in `../_hh_extract/code/PROCEDURAL_MAP.md`;
  asset joins in `../_hh_extract/assets/ASSET_MAP.md`.
- **How to (re)generate this calculator's data** (run from `hh-build-calc/`):
    1. `node build-assets.mjs` — copies the referenced sprite frames out of
       `../_hh_extract/assets/sprites/…` into `assets/` (hero portraits, artifact icons, class
       silhouettes, faction insignia). The full 32k-frame sprite dump stays in the extract.
    2. `node build-data.mjs` — reads the extract and emits `data/*.json` + `data.js`, running the
       hygiene guardrails. `--strict` promotes warnings to errors.
- **Which extract files feed the build:**
    - `../_hh_extract/data/heroes/heroes.json` → heroes (250)
    - `../_hh_extract/data/heroes/classes.json` → classes (38, incl. `silhouetteFrame`)
    - `../_hh_extract/data/artifacts/artdata_base_table.gml` → artifacts (parsed: name, slot, quality,
      iconFrame, effects, setId)
    - `../_hh_extract/data/skills/skill_icons.json` → skill→icon frames (P1)
    - set names/thresholds: constants from `_hh_extract/code/gml/gml_GlobalScript_hero_scripts.gml`
      (`global.setname` / `global.setthreshold`), inlined in `build-data.mjs`
    - sprites: `../_hh_extract/assets/sprites/{spr_heroportraitROGUE,spr_artifactO,spr_classsilhouettes,spr_insignia_}/`
- **What's shipped vs. gitignored:**
    - SHIPPED (tracked): `data/*.json`, `data.js`, `assets/{heroes,artifacts,classes,factions}/*.png`,
      the SPA code.
    - GITIGNORED / never committed: the entire `_hh_extract` workspace (sibling), the raw `.gml`
      tables, and the full sprite export — anything the SPA does not load at runtime.

## Data model reference
See `SPEC_PLAN.md` § Data model for the authoritative field-by-field description the build pipeline
expects. Effect-code → stat mapping is in `build-data.mjs` (`EFFECT_STAT`). Data is an **extract, not
a verified golden dataset** — numbers are decompiled but not hand-verified; treat as provisional until
confirmed against the live game.
