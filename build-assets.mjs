/*
  build-assets.mjs — copies ONLY the sprite frames the SPA references out of the sibling
  _hh_extract datamine into assets/. The full 32k-frame sprite dump stays in the extract;
  the calculator repo tracks just the subset it loads at runtime.

  Sources (see ../_hh_extract/assets/ASSET_MAP.md for the entity→frame joins):
    hero portrait      spr_heroportraitROGUE/<index>.png      -> assets/heroes/<index>.png
    artifact icon      spr_artifactO/<artdata[3]>.png          -> assets/artifacts/<frame>.png
    class silhouette   spr_classsilhouettes/<classId+2>.png    -> assets/classes/<frame>.png
    faction insignia   spr_insignia_/<engineFactionIndex>.png  -> assets/factions/<factionIndex>.png

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

// faction insignia: heroes.json factionIndex 0–11 == engine order; 12 (Rogue) -> engine 14.
const factionIdxs = [...new Set(heroArr.map((h) => h.factionIndex))];
const insigniaFrame = (fi) => (fi < 12 ? fi : 14);

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
for (const fi of factionIdxs) copyFrame("spr_insignia_", insigniaFrame(fi), "factions", String(fi));

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
