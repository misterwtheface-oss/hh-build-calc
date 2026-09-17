/*
  build-data.mjs — compiles the sibling _hh_extract datamine into data/*.json + data.js
  as `window.HH_DATA = {...}`, running data-hygiene guardrails first.

  Usage:  node build-data.mjs           (warnings allowed)
          node build-data.mjs --strict  (warnings promoted to errors)

  Guardrail philosophy: resolve every cross-reference (hero→class, artifact→set,
  element→trait) and every asset path BEFORE writing data.js. Run build-assets.mjs
  first so the icon frames exist to check. On any error we refuse to write data.js.
*/
import fs from "node:fs";
import path from "node:path";

// --- config ---
const ACRONYM = "HH";
const EXTRACT = path.resolve("..", "_hh_extract");
const ASSETS_DIR = "assets";
const DATA_DIR = "data";
const OUT = "data.js";
const STRICT = process.argv.includes("--strict");
// artifact effect code → primary-stat key (codes ≥10 are income/skills, handled in P1)
const EFFECT_STAT = { 1: "A", 2: "D", 3: "K", 4: "S", 5: "M", 6: "L", 7: "movement", 8: "sight", 9: "speed" };
// artifact set names + piece thresholds (constants: hero_scripts.gml global.setname/setthreshold)
const SET_NAMES = ["", "Mesmer", "Rabbit", "Titan", "Mandel", "Tusk", "Widle", "Echoes", "Extracter", "Chaos", "Ruthless", "Slayer", "Exarch", "Bronze", "Regal", "Legend", "Rogue", "Gladiator", "Heretic", "Ascetic", "General", "Batal", "Conjurer", "Eastcay", "Protector", "Paragon", "Assassin", "Kismet", "Mithril", "Jotun", "Scarlet", "Necrotic", "Mudcaster"];
const SET_THRESHOLD = [0, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
// faction identity colours (match the game's factions; used as trait --aff-color)
const FACTION_COLOR = {
  Order: "#3f6f9e", Wild: "#4a8c3f", Arcane: "#3fb0ac", Decay: "#6a5a8c", Pyre: "#d1622f",
  Horde: "#a0512c", Enclave: "#6b7c99", Lament: "#5b3a7d", Tide: "#2f8fb0", Earthen: "#b08a3f",
  Pillar: "#3f9e6f", Delirium: "#a03f8c", Rogue: "#b0403f",
};
// -------------

const errors = [], warnings = [];
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const insigniaFrame = (fi) => (fi < 12 ? fi : 14);

/** Extract a `<marker>[[...]]` GML array literal and JSON.parse it. */
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

// deterministic hue-spread colour for a set id → hex (sets have no single identity colour in-game)
function setColor(id) {
  const h = (id * 137.508) % 360, s = 55, l = 52;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const col = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * col).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ── load extract ──
const heroArr = (() => { const h = readJSON(path.join(EXTRACT, "data/heroes/heroes.json")); return Array.isArray(h) ? h : Object.values(h); })();
const classArr = (() => { const c = readJSON(path.join(EXTRACT, "data/heroes/classes.json")); return Array.isArray(c) ? c : Object.values(c); })();
const artRows = extractGmlArray(fs.readFileSync(path.join(EXTRACT, "code/gml/gml_GlobalScript_hero_scripts.gml"), "utf8"), "global.artdata = ");

// ── traits (faction + set) — structured association data ──
const traits = [];
const factionNames = [...new Set(heroArr.map((h) => h.faction))];
const factionIdxByName = {};
for (const h of heroArr) if (!(h.faction in factionIdxByName)) factionIdxByName[h.faction] = h.factionIndex;
for (const name of factionNames) {
  // Faction identity is carried by the banner COLOUR. The game's insignia sprites are white
  // silhouettes tinted at runtime, so they render blank as raw PNGs — icon:null (tinted-emblem = P1).
  traits.push({ id: `fac:${slug(name)}`, name, color: FACTION_COLOR[name] || "#888888", icon: null, kind: "faction", show_in_table: true });
}
for (let sid = 1; sid < SET_NAMES.length; sid++) {
  traits.push({ id: `set:${sid}`, name: `${SET_NAMES[sid]} Set`, color: setColor(sid), icon: null, kind: "set", show_in_table: true, threshold: SET_THRESHOLD[sid] });
}
const facTrait = (name) => `fac:${slug(name)}`;

// ── factions (ordered, for the landing screen) ──
// One row per playable faction in factionIndex order. sigil = white silhouette from spr_factions_
// (engineFactionIndex; Rogue -> 14), rendered tinted via CSS mask on the client. heroCount is
// grounded from the roster. This is the landing list; artifacts are faction-neutral and excluded.
// Per-faction ordered unit roster (tiny sprites for the landing tiles). The 12 base factions
// (factionIndex 0-11) each carry 9 units in MOBID order; sprite = spr_mob_* frame unitIndex*20,
// copied by build-assets.mjs to assets/units/<factionIndex>_<unitIndex>.png. Rogue has no town roster.
const MOBID = extractGmlArray(fs.readFileSync(path.join(EXTRACT, "data/factions/MOBID_base_table.gml"), "utf8"), "global.MOBID = ");
const factionUnits = (fi) => (fi < 12 && MOBID[fi] ? MOBID[fi].map((u, ui) => ({ name: u[0], sprite: `assets/units/${fi}_${ui}.png` })) : []);

const factionOrder = [...new Set(heroArr.map((h) => h.factionIndex))].sort((a, b) => a - b);
const factions = factionOrder.map((fi) => {
  const name = heroArr.find((h) => h.factionIndex === fi).faction;
  const frame = insigniaFrame(fi); // engineFactionIndex: 0-11 as-is, Rogue(12) -> 14
  return {
    name, factionIndex: fi, engineFactionIndex: frame,
    color: FACTION_COLOR[name] || "#888888",
    sigil: `assets/factions/${frame}.png`,
    traitId: facTrait(name),
    heroCount: heroArr.filter((h) => h.factionIndex === fi).length,
    units: factionUnits(fi),
  };
});

// ── classes ──
const classes = classArr.map((c) => ({
  id: c.id, name: c.name, classType: c.classType, faction: c.faction,
  silhouetteFrame: c.silhouetteFrame,
  icon: `assets/classes/${c.silhouetteFrame}.png`,
  traits: c.faction ? [facTrait(c.faction)] : [],
}));
const classById = new Map(classes.map((c) => [c.id, c]));

// ── heroes ──
const heroes = heroArr.map((h) => ({
  id: h.index, name: h.name, faction: h.faction, factionIndex: h.factionIndex,
  classId: h.classId, className: h.class, classType: h.classType, race: h.race,
  portraitFrame: h.index, icon: `assets/heroes/${h.index}.png`,
  startingSpell: h.startingSpell, masteryUnit: h.masteryUnit, specialtySkill: h.specialtySkill,
  unlockTier: h.unlockTier, unlockable: h.unlockable,
  skilltree: h.skilltree, skillset: h.skillset,
  traits: [facTrait(h.faction)],
}));

// ── artifacts (parse artdata rows) ──
// row = [name, slot(1-10), quality(1-5), spriteIdx, size1, effect1, size2, effect2, setId, str/magic]
const idSeen = new Map();
const artifacts = artRows.map((r) => {
  const [name, slot, quality, sprite, s1, e1, s2, e2, setId] = r;
  let id = slug(name);
  if (idSeen.has(id)) { const n = idSeen.get(id) + 1; idSeen.set(id, n); id = `${id}-${n}`; } else idSeen.set(id, 1);
  const effects = [];
  for (const [size, code] of [[s1, e1], [s2, e2]]) if (!(size === 0 && code === 0)) effects.push({ size, code });
  return {
    id, name, slot, quality, iconFrame: sprite, icon: `assets/artifacts/${sprite}.png`,
    setId: setId || 0, effects,
    traits: setId ? [`set:${setId}`] : [],
  };
});

// ── artifact sets (with members) ──
const artifactSets = [];
for (let sid = 1; sid < SET_NAMES.length; sid++) {
  const members = artifacts.filter((a) => a.setId === sid).map((a) => a.id);
  artifactSets.push({ id: sid, name: SET_NAMES[sid], threshold: SET_THRESHOLD[sid], members });
}

// ═══ GUARDRAILS ═══
const traitIndex = new Map(traits.map((t) => [t.id, t]));
// icon paths are stored page-root-relative (e.g. "assets/heroes/0.png") so the browser resolves
// them correctly from index.html; check them as-is from the repo root.
const assetMiss = (rel) => !fs.existsSync(rel);

// dupes
const seenHero = new Set(); for (const h of heroes) { if (seenHero.has(h.id)) errors.push(`duplicate hero id ${h.id}`); seenHero.add(h.id); }
const seenArt = new Set(); for (const a of artifacts) { if (seenArt.has(a.id)) errors.push(`duplicate artifact id "${a.id}"`); seenArt.add(a.id); }

// traits: valid colour + icon exists
for (const t of traits) {
  if (!/^#[0-9a-fA-F]{6}$/.test(t.color)) warnings.push(`trait "${t.id}" invalid colour "${t.color}"`);
  if (t.icon && assetMiss(t.icon)) errors.push(`trait "${t.id}" → assets/${t.icon} (missing)`);
}
// factions (landing list): valid colour, resolvable trait, sigil exists
for (const f of factions) {
  if (!/^#[0-9a-fA-F]{6}$/.test(f.color)) warnings.push(`faction "${f.name}" invalid colour "${f.color}"`);
  if (!traitIndex.has(f.traitId)) errors.push(`faction "${f.name}" → trait "${f.traitId}" (no such trait)`);
  if (assetMiss(f.sigil)) errors.push(`faction "${f.name}" → ${f.sigil} (missing sigil)`);
  for (const u of f.units) if (assetMiss(u.sprite)) errors.push(`faction "${f.name}" unit "${u.name}" → ${u.sprite} (missing sprite)`);
}
// heroes: class resolves, traits resolve, portrait exists
for (const h of heroes) {
  if (!classById.has(h.classId)) errors.push(`hero ${h.id} "${h.name}" → classId ${h.classId} (no such class)`);
  for (const tr of h.traits) if (!traitIndex.has(tr)) errors.push(`hero "${h.name}" → trait "${tr}" (no such trait)`);
  if (assetMiss(h.icon)) errors.push(`hero "${h.name}" → assets/${h.icon} (missing)`);
}
// classes: traits resolve, silhouette exists
for (const c of classes) {
  for (const tr of c.traits) if (!traitIndex.has(tr)) errors.push(`class "${c.name}" → trait "${tr}" (no such trait)`);
  if (assetMiss(c.icon)) errors.push(`class "${c.name}" → assets/${c.icon} (missing)`);
}
// artifacts: set + trait resolve, icon exists, effect codes known-ish
for (const a of artifacts) {
  if (a.setId && !artifactSets.some((s) => s.id === a.setId)) errors.push(`artifact "${a.name}" → setId ${a.setId} (no such set)`);
  for (const tr of a.traits) if (!traitIndex.has(tr)) errors.push(`artifact "${a.name}" → trait "${tr}" (no such trait)`);
  if (assetMiss(a.icon)) errors.push(`artifact "${a.name}" → assets/${a.icon} (missing)`);
  if (a.slot < 1 || a.slot > 10) warnings.push(`artifact "${a.name}" has out-of-range slot ${a.slot}`);
}

// ── report ──
const assetCount = heroes.length + classes.length + artifacts.length + traits.filter((t) => t.icon).length;
console.log("── Data hygiene report ─────────────────────");
console.log(`✓ ${heroes.length} heroes, ${classes.length} classes, ${artifacts.length} artifacts, ${artifactSets.length} sets, ${traits.length} traits, ${factions.length} factions; ${assetCount} asset paths checked`);
if (errors.length) { console.log(`✗ ${errors.length} error(s):`); errors.slice(0, 40).forEach((e) => console.log(`    ${e}`)); if (errors.length > 40) console.log(`    …and ${errors.length - 40} more`); }
if (warnings.length) { console.log(`⚠ ${warnings.length} warning(s):`); warnings.slice(0, 20).forEach((w) => console.log(`    ${w}`)); if (warnings.length > 20) console.log(`    …and ${warnings.length - 20} more`); }
console.log("─".repeat(44));

const hard = errors.length + (STRICT ? warnings.length : 0);
if (hard) { console.error(`BUILD FAILED: ${hard} error(s). data.js left untouched.`); process.exit(1); }

// ── write shipped JSON + data.js ──
fs.mkdirSync(DATA_DIR, { recursive: true });
const data = { heroes, classes, artifacts, artifactSets, traits, factions, effectStat: EFFECT_STAT };
for (const [k, v] of Object.entries(data)) fs.writeFileSync(path.join(DATA_DIR, `${k}.json`), JSON.stringify(v, null, 0));
fs.writeFileSync(OUT, `window.${ACRONYM}_DATA = ${JSON.stringify(data)};\n`);
console.log(`Wrote ${OUT} (window.${ACRONYM}_DATA) and ${DATA_DIR}/*.json.`);
