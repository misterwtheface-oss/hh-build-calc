/*
  build-assets.mjs — copies ONLY the sprite frames the SPA references out of the sibling
  _hh_extract datamine into assets/. The full 32k-frame sprite dump stays in the extract;
  the calculator repo tracks just the subset it loads at runtime.

  Sources (see ../_hh_extract/assets/ASSET_MAP.md for the entity→frame joins):
    hero portrait      spr_heroportraitROGUE/<index>.png      -> assets/heroes/<index>.png
    artifact icon      spr_artifactO/<artdata[3]>.png          -> assets/artifacts/<frame>.png
    class silhouette   spr_classsilhouettes/<classId+2>.png    -> assets/classes/<frame>.png
    faction sigil      spr_factions_/<engineFactionIndex>.png  -> assets/factions/<engineFactionIndex>.png
  Faction sigils are white silhouettes the game tints at runtime; the SPA renders them the same way
  (CSS mask + faction colour), so the raw white PNG is exactly what we need. engineFactionIndex =
  factionIndex for 0-11, and Rogue (heroes factionIndex 12) maps to engine 14 (ASSET_MAP.md).

  Run BEFORE build-data.mjs so the hygiene guardrails can verify every icon path exists.
  Usage:  node build-assets.mjs
*/
import fs from "node:fs";
import path from "node:path";

const EXTRACT = path.resolve("..", "_hh_extract");
const SPRITES = path.join(EXTRACT, "assets", "sprites");
const ASSETS = "assets";

if (!fs.existsSync(SPRITES)) {
  console.error(`Extract sprites not found at ${SPRITES}. Is ../_hh_extract present with assets/sprites exported?`);
  process.exit(1);
}

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const heroes = readJSON(path.join(EXTRACT, "data", "heroes", "heroes.json"));
const heroArr = Array.isArray(heroes) ? heroes : Object.values(heroes);
const classes = readJSON(path.join(EXTRACT, "data", "heroes", "classes.json"));
const classArr = Array.isArray(classes) ? classes : Object.values(classes);

// artifact icon frames: parse global.artdata field [3] (see build-data.mjs for the shared parser)
const artGml = fs.readFileSync(path.join(EXTRACT, "code", "gml", "gml_GlobalScript_hero_scripts.gml"), "utf8");
const artRows = extractGmlArray(artGml, "global.artdata = ");
const artifactFrames = [...new Set(artRows.map((r) => r[3]))];

let copied = 0, missing = [];
function copyFrame(sheet, frame, destDir, destName) {
  const src = path.join(SPRITES, sheet, `${sheet}_${frame}.png`);
  const dest = path.join(ASSETS, destDir, `${destName}.png`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(src)) { missing.push(src); return; }
  fs.copyFileSync(src, dest);
  copied++;
}

for (const h of heroArr) copyFrame("spr_heroportraitROGUE", h.index, "heroes", String(h.index));
for (const f of artifactFrames) copyFrame("spr_artifactO", f, "artifacts", String(f));
for (const c of classArr) copyFrame("spr_classsilhouettes", c.silhouetteFrame, "classes", String(c.silhouetteFrame));

// faction sigils: one per playable faction. engineFactionIndex = factionIndex (0-11), Rogue -> 14.
const factionFrames = [...new Set(heroArr.map((h) => (h.factionIndex < 12 ? h.factionIndex : 14)))];
for (const fi of factionFrames) copyFrame("spr_factions_", fi, "factions", String(fi));

// per-faction unit roster sprites (tiny idle frames for the landing tiles).
// sheet = MOB_SHEET[engineFactionIndex]; idle frame = unitIndexWithinFaction * 20 (ASSET_MAP.md).
// The 12 base factions (engine 0-11) each carry 9 ordered units in MOBID; Rogue has no standard town.
const MOB_SHEET = ["spr_mob_cas", "spr_mob_ram", "spr_mob_tow", "spr_mob_nec", "spr_mob_inf",
  "spr_mob_str", "spr_mob_for", "spr_mob_dun", "spr_mob_isl", "spr_mob_dwa", "spr_mob_qin", "spr_mob_lov"];
const mobidGml = fs.readFileSync(path.join(EXTRACT, "data", "factions", "MOBID_base_table.gml"), "utf8");
const MOBID = extractGmlArray(mobidGml, "global.MOBID = ");
for (let fi = 0; fi < MOB_SHEET.length; fi++) {
  const roster = MOBID[fi] || [];
  for (let ui = 0; ui < roster.length; ui++) copyFrame(MOB_SHEET[fi], ui * 20, "units", `${fi}_${ui}`);
}

console.log(`build-assets: copied ${copied} sprite frames into ${ASSETS}/.`);
if (missing.length) {
  console.warn(`⚠ ${missing.length} source frame(s) missing in the extract:`);
  missing.slice(0, 10).forEach((m) => console.warn(`    ${m}`));
  if (missing.length > 10) console.warn(`    …and ${missing.length - 10} more`);
}

// --- shared: extract a `<name>[[...]]` GML array literal and JSON.parse it ---
function extractGmlArray(text, marker) {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  let i = text.indexOf("[", at), depth = 0, inStr = false, end = -1;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  return JSON.parse(text.slice(i, end));
}
