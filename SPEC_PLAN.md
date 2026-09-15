# Hero's Hour Build Calculator — Spec Plan

## Purpose
A theorycraft sandbox for **Hero's Hour** heroes: pick a hero, plan their skill tree, equip
artifacts on a paperdoll, and see the resulting primary stats and the army-wide buffs they produce —
so a player can test hero builds and artifact/set combinations without grinding them in-game. The
secondary goal is surfacing synergy: which artifacts complete a set, and which elements share a
faction / magic school.

## Data model
Compiled from the sibling `_hh_extract` datamine into `window.HH_DATA` (see `WIKI_CONTEXT.md`).

- **hero** — `id` (=roster index, 0–249), `name`, `faction`, `factionIndex`, `classId`, `className`,
  `classType` (fighter/caster), `race`, `portraitFrame` (=index into `spr_heroportraitROGUE`),
  `startingSpell`, `masteryUnit`, `specialtySkill`, `skilltree{HH,RR}` (the 16-slot pyramid),
  `skillset`, `traits:[faction:<faction>]`.
- **class** — `id` (0–37), `name`, `classType`, `faction`, `silhouetteFrame` (=classId+2 into
  `spr_classsilhouettes`), `traits:[faction]`.
- **artifact** — `id` (name slug), `name`, `slot` (1–10), `quality` (1–5), `iconFrame`
  (=`spr_artifactO` frame), `effects:[{code,size}]` (stat/skill deltas), `setId`,
  `traits:[set:<set>]`. **One artifact per slot; the paperdoll is a 2-col × 5-row grid** (slot i =
  `slot−1`).
- **artifactSet** — `id`, `name`, `threshold` (pieces needed: 3 for sets 1–8, 2 for 9–32), `members`.
- **trait** — `id`, `name`, `color`, `icon`, `kind` (`faction | school | unittype | set`),
  `show_in_table`. Colours come from the data → `--aff-color`/`--aff-text`. Associations only;
  conflicts (if any authored later) live in a separate `conflicts` channel.
- **spell / skill / unit** — shipped for P1 (skill tree, army, spell synergy); icons already mapped
  (`skill_icons.json`, spell/artifact field `[3]`).

**Effect codes** (artifact `effects`): 1 Attack · 2 Defense · 3 Knowledge · 4 Spellpower · 5 Morale ·
6 Luck · 7 Movement · 8 Sight · 9 Creature-Speed (codes ≥18 = skill grants, ≥100 = skill ranks,
10–17 = economy — surfaced in P1, not in the P0 primary-stat table).

**Build object** (persisted to `hhbc.build`):
`{ heroId, realm: "HH"|"RR", equipment: Array<10> (artifactId|null), stats: {A,D,K,S,M,L} }`.

### The stat model (P0 fidelity)
- Primary stats **A/D/K/S/M/L** are user inputs (the hero "at whatever level" — sandbox). Base = the
  user value; the **Artifacts** column sums each equipped artifact's contribution; **Total** =
  Base + Σ. Additive — no cell shows two numbers.
- **Derived army buffs** (from the extract's verified combat model): Attack → **+3 % army damage /
  pt**, Defense → **+3 % army health / pt** (`army_scripts.gml:745,747`). Shown as a small derived
  readout below the primary table, not as artifact-additive rows.
- Faithful per-hero base stats from the class level-up lottery is **P1** (needs the leveling model);
  P0 treats stats as sandbox inputs.

## Architecture
- Stack: vanilla HTML/CSS/JS; data compiled to `window.HH_DATA` (see `WIKI_CONTEXT.md`).
- Data flow: `_hh_extract` → `build-assets.mjs` (copies referenced sprite frames → `assets/`) +
  `build-data.mjs` (transforms extract tables → `data/*.json` + `data.js`, runs hygiene guardrails).
- Persistence: `localStorage` under `hhbc.*`.
- Palette sampled from the game UI art (parchment/leather + gold frames + blue action buttons).

## Feature plan (prioritized)
### P0 — baseline (this session; runnable + testable)
- [ ] Hero selector overlay (250 heroes; portrait, faction, class) + realm HH/RR toggle
- [ ] 10-slot **artifact paperdoll** over the class silhouette; slot-aware artifact selector
- [ ] Primary-stat controls (A/D/K/S/M/L steppers)
- [ ] Live **stat table** (Base | Artifacts | Total) + derived army-damage/health buffs
- [ ] **Cross-reference matrix**: hero + equipped artifacts × {faction, set} traits + set-completion
### P1 — core value (next sessions)
- [ ] 16-slot **skill-tree picker** (fixed pyramid; HH/RR realms) using `skill_icons.json`
- [ ] **Army composition** (faction dwellings + neutrals) with combat-stat readout
- [ ] Spell / magic-school synergy; artifact skill-grants (effect codes ≥18) into the stat model
- [ ] Save / load / share builds (schema-versioned)
### P2 — nice-to-have
- [ ] Battle / DPS simulation from `PROCEDURAL_MAP.md`
- [ ] Appendix + detail pages; collection tracking
- [ ] Trimmed per-unit display sprites (`unitIdx*20`)

## Open questions
- Per-hero base primary stats: derive from the class level-up model (P1) or keep sandbox inputs?
- Faction insignia frame for the Rogue realm (engine faction order 14 vs heroes.json 12) — confirm.
- Which magic-school associations to attach to artifacts (artdata carries no school directly; may
  derive from effect codes / set theme).
