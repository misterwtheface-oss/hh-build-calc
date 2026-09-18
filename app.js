/*
  Hero's Hour Build Calculator — app logic (P0: hero + artifact paperdoll + stats).
  Reads window.HH_DATA (generated into data.js by build-data.mjs).

  Build-first + overlay-driven (see build-calc-planner references):
    - Home screen = the build: hero header + 10-slot artifact paperdoll + stat panel + xref matrix.
    - Click the hero header → hero selector overlay; click a paperdoll slot → slot-filtered
      artifact selector; both on #overlay-root. Detail pages stack on #detail-overlay-root.
    - Overlays statically sized (CSS); every re-render preserves scrollTop.
    - Escape / ✕ / backdrop = dismiss (no commit); Confirm commits.
    - Traits (faction/set) are DATA; banners theme via --aff-color/--aff-text; the cross-reference
      matrix surfaces shared faction/set synergy + set completion.
*/
(function () {
  "use strict";

  const DATA = window.HH_DATA || { heroes: [], classes: [], artifacts: [], artifactSets: [], traits: [], factions: [], effectStat: {} };
  const STORAGE_KEY = "hhbc.build";
  const SLOT_COUNT = 10;            // paperdoll: 2-col × 5-row
  const PRIMARY = ["A", "D", "K", "S", "M", "L"];
  const STAT_META = {
    A: { label: "Attack" }, D: { label: "Defense" }, K: { label: "Knowledge" }, S: { label: "Spellpower" },
    M: { label: "Morale" }, L: { label: "Luck" },
    movement: { label: "Movement" }, sight: { label: "Sight" }, speed: { label: "Creature Speed" },
  };
  const EFFECT_STAT = DATA.effectStat || {};                 // code(str) -> stat key
  const QUALITY_COLOR = { 1: "#9a9a9a", 2: "#6fca6a", 3: "#3f9edd", 4: "#a86fd1", 5: "#e8c05a" };

  const heroById = new Map(DATA.heroes.map((h) => [h.id, h]));
  const classById = new Map(DATA.classes.map((c) => [c.id, c]));
  const artById = new Map(DATA.artifacts.map((a) => [a.id, a]));
  const traitById = new Map(DATA.traits.map((t) => [t.id, t]));
  const setById = new Map(DATA.artifactSets.map((s) => [s.id, s]));

  // ── state ──
  // view: "landing" = faction picker (first screen); "build" = the hero build.
  // Returning users with a saved hero drop straight into their build.
  const state = { build: load(), ovl: null, view: null };
  state.view = state.build.heroId != null ? "build" : "landing";

  function makeBuild() {
    return { heroId: null, realm: "HH", equipment: Array(SLOT_COUNT).fill(null), stats: { A: 0, D: 0, K: 0, S: 0, M: 0, L: 0 }, skillRanks: {} };
  }
  function load() {
    let b;
    try { b = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { b = null; }
    const base = makeBuild();
    if (!b) return base;
    return {
      heroId: heroById.has(b.heroId) ? b.heroId : null,
      realm: b.realm === "RR" ? "RR" : "HH",
      equipment: Array.from({ length: SLOT_COUNT }, (_, i) => (artById.has(b.equipment?.[i]) ? b.equipment[i] : null)),
      stats: { ...base.stats, ...(b.stats || {}) },
      skillRanks: (b.skillRanks && typeof b.skillRanks === "object") ? b.skillRanks : {},
    };
  }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.build)); }

  // ── html helpers ──
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function textColorFor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); if (!m) return "#fff";
    const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? "#111" : "#fff";
  }
  function traitBanner(trait, labelOverride) {
    if (!trait) return "";
    const color = trait.color || "var(--surface2)";
    const label = labelOverride || trait.name;
    return `<div class="trait-banner" data-action="nav-trait" data-trait="${esc(trait.id)}"
        style="--aff-color:${esc(color)};--aff-text:${textColorFor(color)}" title="${esc(label)}">
      ${trait.icon ? `<span class="trait-banner-icon"><img src="${esc(trait.icon)}" alt="" onerror="this.style.visibility='hidden'"></span>` : ""}
      <span class="trait-banner-label">${esc(label)}</span>
    </div>`;
  }

  // effect → human label ("+4 Spellpower", "+350 (weekly income)", "grants a skill", …)
  function effectLabel(e) {
    const key = EFFECT_STAT[String(e.code)];
    const sign = e.size > 0 ? "+" : "";
    if (key) return `${sign}${e.size} ${STAT_META[key].label}`;
    if (e.code >= 10 && e.code <= 16) return `${sign}${e.size} weekly income`;
    if (e.code >= 18) return `grants a skill (×${e.size})`;
    return `effect ${e.code} (×${e.size})`;
  }

  // ── stat compute ──
  function artifactStats() {
    const out = {};
    for (const id of state.build.equipment) {
      const a = id ? artById.get(id) : null; if (!a) continue;
      for (const e of a.effects || []) { const key = EFFECT_STAT[String(e.code)]; if (key) out[key] = (out[key] || 0) + e.size; }
    }
    return out;
  }

  // Stat TABLE (grid: Stat | Base | Artifacts | Total). Additive; delta green/red; no cell shows
  // two numbers. Rows the build touches get a faint highlight.
  function statTableHTML() {
    const art = artifactStats();
    let rows = "";
    for (const key of Object.keys(STAT_META)) {
      const isPrimary = PRIMARY.includes(key);
      const base = isPrimary ? Number(state.build.stats[key] || 0) : 0;
      const add = Number(art[key] || 0);
      if (!base && !add) continue;
      const total = base + add;
      const cls = add > 0 ? " pos" : add < 0 ? " neg" : "";
      const disp = add > 0 ? "+" + add : add < 0 ? String(add) : "—";
      rows += `<div class="stat-row${add ? " hl-med" : ""}">
        <span class="stat-key">${esc(STAT_META[key].label)}</span>
        <span class="stat-base">${base}</span>
        <span class="stat-src stat-val${cls}">${disp}</span>
        <span class="stat-total">${total}</span>
      </div>`;
    }
    if (!rows) rows = `<div class="stat-row"><span class="stat-key muted">No stats yet.</span><span></span><span></span><span></span></div>`;
    return `<div class="stat-grid">
      <div class="stat-header"><span>Stat</span><span>Base</span><span>Artifacts</span><span>Total</span></div>
      ${rows}
    </div>`;
  }

  // Derived army buffs (verified: Attack → +3% army damage/pt, Defense → +3% army health/pt).
  function armyBuffsHTML() {
    const art = artifactStats();
    const totalA = Number(state.build.stats.A || 0) + Number(art.A || 0);
    const totalD = Number(state.build.stats.D || 0) + Number(art.D || 0);
    return `<div class="army-buffs">
      <div class="army-buff"><span>Army damage <span class="muted">(+3%/Attack)</span></span><span class="ab-val">+${totalA * 3}%</span></div>
      <div class="army-buff"><span>Army health <span class="muted">(+3%/Defense)</span></span><span class="ab-val">+${totalD * 3}%</span></div>
    </div>`;
  }

  // Set completion: how many equipped artifacts share each set vs its threshold.
  function setProgressHTML() {
    const counts = new Map();
    for (const id of state.build.equipment) { const a = id ? artById.get(id) : null; if (a && a.setId) counts.set(a.setId, (counts.get(a.setId) || 0) + 1); }
    if (!counts.size) return `<p class="muted">Equip artifacts from the same set to progress a set bonus.</p>`;
    const rows = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([sid, n]) => {
      const s = setById.get(sid), t = traitById.get(`set:${sid}`), active = n >= s.threshold;
      return `<div class="set-row${active ? " active" : ""}">${traitBanner(t, `${s.name} Set`)}<span class="set-count">${n}/${s.threshold}${active ? " ✓" : ""}</span></div>`;
    }).join("");
    return `<div class="set-progress">${rows}</div>`;
  }

  // Cross-reference MATRIX: traits (columns) × build elements (rows). Faction (hero) + set
  // (artifacts). A set column is "active" once its shared count reaches the set threshold.
  function xrefMatrixHTML() {
    const hero = state.build.heroId != null ? heroById.get(state.build.heroId) : null;
    const arts = state.build.equipment.map((id) => (id ? artById.get(id) : null)).filter(Boolean);
    const elements = [];
    if (hero) elements.push({ kind: "hero", id: hero.id, name: hero.name, traits: hero.traits });
    for (const a of arts) elements.push({ kind: "art", id: a.id, name: a.name, traits: a.traits });
    if (!elements.length) return "";

    const count = new Map();
    for (const el of elements) for (const t of el.traits) count.set(t, (count.get(t) || 0) + 1);
    const cols = [...count.keys()].map((id) => traitById.get(id)).filter(Boolean).filter((t) => t.show_in_table !== false)
      .sort((a, b) => (count.get(b.id) - count.get(a.id)) || a.name.localeCompare(b.name));
    if (!cols.length) return "";
    const isActive = (t) => (count.get(t.id) || 0) >= (t.threshold || 2);

    const colHead = (t) => `<th class="xref-colhead"><div class="xref-col" data-action="nav-trait" data-trait="${esc(t.id)}"
        style="--aff-color:${esc(t.color)};--aff-text:${textColorFor(t.color)}">
        ${t.icon ? `<img class="xref-col-icon" src="${esc(t.icon)}" alt="" onerror="this.style.visibility='hidden'">` : ""}
        <span class="xref-col-name">${esc(t.name)}</span></div></th>`;
    const rows = elements.map((el) => {
      const set = new Set(el.traits);
      const nav = el.kind === "hero" ? `data-action="open-hero"` : `data-action="nav-artifact" data-id="${esc(el.id)}"`;
      return `<tr><th class="xref-rowhead" ${nav}><span>${esc(el.name)}</span></th>
        ${cols.map((t) => `<td class="${set.has(t.id) ? "xref-on" : ""}">${set.has(t.id) ? "●" : ""}</td>`).join("")}</tr>`;
    }).join("");
    const shared = `<tr class="xref-shared"><th class="xref-rowhead">Shared</th>
      ${cols.map((t) => { const n = count.get(t.id) || 0; return `<td class="${isActive(t) ? "xref-sh" : ""}">${n}</td>`; }).join("")}</tr>`;

    return `<section class="xref-section">
      <h2>Trait coverage</h2>
      <div class="xref-wrap"><table class="player-xref">
        <thead><tr><th class="xref-corner"></th>${cols.map(colHead).join("")}</tr></thead>
        <tbody>${rows}${shared}</tbody>
      </table></div>
      <div class="xref-legend"><span><b class="xref-on">●</b> has trait</span><span><b class="xref-sh">n</b> set complete / shared</span></div>
    </section>`;
  }

  // ═══ LANDING VIEW — vertical parchment faction tiles, in faction order ═══
  function renderLanding() {
    const app = document.getElementById("app");
    const prevScroll = (app.querySelector(".faction-list") || {}).scrollTop || 0;
    const tiles = DATA.factions.map((f) => `
      <button class="faction-tile" data-action="open-faction" data-faction="${esc(f.name)}"
          style="--fac-color:${esc(f.color)}" title="${esc(f.name)}">
        <span class="faction-sigil" style="-webkit-mask-image:url('${esc(f.sigil)}');mask-image:url('${esc(f.sigil)}')" aria-hidden="true"></span>
        <span class="faction-tile-text">
          <span class="faction-name">${esc(f.name)}</span>
          ${(f.units && f.units.length) ? `<span class="faction-units">${f.units.map((u) =>
            `<img class="faction-unit" src="${esc(u.sprite)}" alt="" title="${esc(u.name)}" onerror="this.style.display='none'">`).join("")}</span>` : ""}
        </span>
        <span class="faction-chevron" aria-hidden="true">›</span>
      </button>`).join("");
    app.innerHTML = `
      <header class="app-header landing-header"><h1>Hero's Hour Build Calculator</h1></header>
      <main class="landing-main">
        <p class="landing-lead">Choose a faction</p>
        <div class="faction-list">${tiles}</div>
      </main>`;
    const list = app.querySelector(".faction-list");
    if (list) list.scrollTop = prevScroll;
  }

  // ═══ BUILD VIEW ═══
  function renderApp() {
    if (state.view === "landing") return renderLanding();
    const app = document.getElementById("app");
    const prevMain = app.querySelector(".planning-main");
    const prevScroll = prevMain ? prevMain.scrollTop : 0;

    const hero = state.build.heroId != null ? heroById.get(state.build.heroId) : null;
    const cls = hero ? classById.get(hero.classId) : null;

    const heroHeader = hero ? `
      <div class="hero-header" data-action="open-hero">
        <div class="hero-portrait"><img src="${esc(hero.icon)}" alt="" onerror="this.style.visibility='hidden'"></div>
        <div class="hero-id">
          <h2>${esc(hero.name)}</h2>
          <div class="hero-sub">${esc(hero.faction)} · ${esc(hero.className)} <span class="muted">(${esc(hero.classType)})</span></div>
          <div class="hero-meta">Mastery: ${esc(realmField(hero, "Mastery Unit") || hero.masteryUnit || "—")} · Specialty: ${esc(hero.specialtySkill || "—")}</div>
          <div class="hero-actions" data-stop="1">
            ${realmToggleHTML()}
            <button class="skilltree-open" data-action="open-skilltree">Skill Tree</button>
          </div>
        </div>
      </div>` : `
      <div class="hero-header" data-action="open-hero">
        <div class="hero-portrait"><span class="muted">?</span></div>
        <div class="hero-id"><h2 class="hero-empty">Select a hero</h2><div class="hero-sub muted">Click to choose from 250 heroes</div></div>
      </div>`;

    // Paperdoll mirrors the in-game layout (army_scripts.gml:3668-3684): the class silhouette sits in
    // the MIDDLE with artifact slots in two flanking columns — nx = base + 240*(i%2), ny row = i div 2.
    // So the left column is slots 0,2,4,6,8 and the right column is 1,3,5,7,9 (top → bottom).
    const slotHTML = (i) => {
      const id = state.build.equipment[i];
      const a = id ? artById.get(id) : null;
      const q = a ? QUALITY_COLOR[a.quality] || "var(--border-hi)" : "";
      const inner = a ? `<img src="${esc(a.icon)}" alt="" title="${esc(a.name)}" onerror="this.style.visibility='hidden'">` : `<span class="slot-empty">+</span>`;
      return `<div class="slot ${a ? "filled" : ""}" style="${a ? `--q-color:${q}` : ""}" data-action="open-slot" data-slot="${i}" title="${a ? esc(a.name) : "Slot " + (i + 1)}">${inner}</div>`;
    };
    const leftCol = [0, 2, 4, 6, 8].map(slotHTML).join("");
    const rightCol = [1, 3, 5, 7, 9].map(slotHTML).join("");
    const silhouette = cls ? `<img src="${esc(cls.icon)}" alt="${esc(hero ? hero.className : "")}" onerror="this.style.visibility='hidden'">` : "";

    app.innerHTML = `
      <header class="app-header"><button class="ghost" data-action="go-landing">‹ Factions</button><h1>Hero's Hour Build Calculator</h1><button class="ghost" data-action="clear">Clear</button></header>
      <main class="planning-main">
        ${heroHeader}
        <div class="build-body">
          <div class="paperdoll">
            <div class="paperdoll-col">${leftCol}</div>
            <div class="paperdoll-mid">${silhouette}</div>
            <div class="paperdoll-col">${rightCol}</div>
          </div>
          <div class="stat-panel">
            <div class="panel-box"><h2>Primary Stats</h2>${statSteppersHTML()}</div>
            <div class="panel-box"><h2>Totals</h2>${statTableHTML()}</div>
            <div class="panel-box"><h2>Army Buffs</h2>${armyBuffsHTML()}</div>
            <div class="panel-box"><h2>Set Bonuses</h2>${setProgressHTML()}</div>
          </div>
        </div>
        ${xrefMatrixHTML()}
      </main>`;

    const newMain = app.querySelector(".planning-main");
    if (newMain) newMain.scrollTop = prevScroll;
  }

  function realmField(hero, slot) { return hero && hero.skilltree && hero.skilltree[state.build.realm] ? hero.skilltree[state.build.realm][slot] : null; }
  function realmToggleHTML() {
    return `<div class="realm-toggle" data-stop="1">
      ${["HH", "RR"].map((r) => `<button data-action="set-realm" data-realm="${r}" class="${state.build.realm === r ? "on" : ""}">${r === "HH" ? "Base" : "Rogue"}</button>`).join("")}
    </div>`;
  }
  function statSteppersHTML() {
    return `<div class="stat-steppers">${PRIMARY.map((k) => `
      <span class="st-label">${esc(STAT_META[k].label)}</span>
      <span class="st-ctrl">
        <button data-action="stat-dec" data-key="${k}">−</button>
        <span class="st-val">${Number(state.build.stats[k] || 0)}</span>
        <button data-action="stat-inc" data-key="${k}">+</button>
      </span>`).join("")}</div>`;
  }

  // ═══ SELECTOR OVERLAY (#overlay-root) — hero or slot(artifact) ═══
  function openHeroOverlay(faction) {
    // touched=false → the info panel stays closed on entry (list is the focus); it opens only
    // once the user actively taps a card. The current pick is still highlighted in the list.
    state.ovl = { kind: "hero", pending: state.build.heroId, search: "", faction: faction || null, touched: false };
    openOverlayShell(faction ? `Choose a ${faction} hero` : "Choose a hero");
  }
  function openSlotOverlay(slotIndex) {
    state.ovl = { kind: "artifact", slotIndex, pending: state.build.equipment[slotIndex], search: "", touched: false };
    openOverlayShell(`Choose artifact — slot ${slotIndex + 1}`);
  }
  function openOverlayShell(title) {
    const root = document.getElementById("overlay-root");
    root.innerHTML = `
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header"><h2>${esc(title)}</h2><button class="overlay-close" data-action="cancel" aria-label="Close">&times;</button></div>
        <div class="overlay-body">
          <div class="ovl-info"><div class="ovl-left"></div><div class="ovl-right"></div></div>
          <div class="ovl-center">
            <div class="ovl-center-search"><input class="ovl-search" type="search" placeholder="Search…" /></div>
            <div class="ovl-center-scroll"><div class="ovl-grid"></div></div>
          </div>
        </div>
        <div class="overlay-footer"><button class="ghost" data-action="cancel">Cancel</button><button data-action="confirm">Confirm</button></div>
      </div>`;
    root.classList.remove("hidden"); root.setAttribute("aria-hidden", "false");
    refreshOverlay();
    const input = root.querySelector(".ovl-search");
    const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (input && !isTouch) input.focus();
  }

  const SCROLLERS = [".ovl-center-scroll", ".ovl-info", ".ovl-left", ".ovl-right-body"];
  function refreshOverlay() {
    const panel = document.querySelector("#overlay-root .overlay-panel");
    if (!panel || !state.ovl) return;
    const saved = SCROLLERS.map((sel) => { const el = panel.querySelector(sel); return el ? el.scrollTop : 0; });
    const q = state.ovl.search.trim().toLowerCase();

    if (state.ovl.kind === "hero") {
      const fac = state.ovl.faction;
      const list = DATA.heroes
        .filter((h) => !fac || h.faction === fac)
        .filter((h) => !q || h.name.toLowerCase().includes(q) || h.faction.toLowerCase().includes(q) || h.className.toLowerCase().includes(q));
      const grid = panel.querySelector(".ovl-grid");
      grid.className = "ovl-grid hero-groups";
      grid.innerHTML = list.length ? heroGroupsHTML(list, !fac) : `<p class="muted">No matches.</p>`;
      const p = state.ovl.pending != null ? heroById.get(state.ovl.pending) : null;
      // Single consolidated info panel (centered portrait + context blocks); ovl-left is emptied
      // and overlay-body gets .solo-info so only the one panel shows beside the list.
      panel.querySelector(".ovl-left").innerHTML = "";
      panel.querySelector(".ovl-right").innerHTML = heroInfoHTML(p);
      panel.querySelector(".overlay-body").classList.add("solo-info");
      panel.querySelector(".overlay-body").classList.toggle("has-selection", !!p && state.ovl.touched);
    } else {
      panel.querySelector(".overlay-body").classList.remove("solo-info");
      const slot = state.ovl.slotIndex + 1;
      const list = DATA.artifacts.filter((a) => a.slot === slot).filter((a) => !q || a.name.toLowerCase().includes(q));
      const grid = panel.querySelector(".ovl-grid");
      grid.className = "ovl-grid";
      grid.innerHTML = list.length ? list.map((a) => cardHTML(a.id, a.icon, a.name, a.id === state.ovl.pending, QUALITY_COLOR[a.quality])).join("") : `<p class="muted">No artifacts for this slot.</p>`;
      const p = state.ovl.pending ? artById.get(state.ovl.pending) : null;
      panel.querySelector(".ovl-left").innerHTML = `<h3>Effects</h3>` + (p
        ? (p.effects.length ? `<ul class="trait-users" style="flex-direction:column">${p.effects.map((e) => `<li>${esc(effectLabel(e))}</li>`).join("")}</ul>` : `<p class="muted">No stat effects.</p>`)
        : `<p class="muted">Select an artifact.</p>`);
      panel.querySelector(".ovl-right").innerHTML = p
        ? `<div class="ovl-right-top"><h3>${esc(p.name)}</h3><button class="ghost" data-action="detail" data-id="${esc(p.id)}">More info</button></div>
           <div class="ovl-right-body">
             ${p.setId ? traitBanner(traitById.get(`set:${p.setId}`), `${setById.get(p.setId).name} Set`) : ""}
             <p class="muted">Slot ${p.slot} · Quality ${p.quality}/5</p>
             ${p.setId ? `<p class="muted">Set: ${esc(setById.get(p.setId).name)} (needs ${setById.get(p.setId).threshold})</p>` : ""}
           </div>`
        : `<div class="ovl-right-top"><h3>Details</h3></div><div class="ovl-right-body"><p class="muted">Select an artifact to see details.</p></div>`;
      panel.querySelector(".overlay-body").classList.toggle("has-selection", !!p && state.ovl.touched);
    }
    SCROLLERS.forEach((sel, i) => { const el = panel.querySelector(sel); if (el) el.scrollTop = saved[i]; });
  }

  // Grouped hero list: sectioned by class (a faction's fighter then caster), each hero its own
  // row with icons of Mastery unit, Specialty, and Primary (class) skill.
  function heroGroupsHTML(list, showFaction) {
    const groups = new Map(); // classId -> {cls, faction, heroes[]}
    for (const h of list) {
      if (!groups.has(h.classId)) groups.set(h.classId, { classId: h.classId, className: h.className, classType: h.classType, faction: h.faction, heroes: [] });
      groups.get(h.classId).heroes.push(h);
    }
    // Order classes as the in-game lexicon does: by classId (faction-grouped, fighter before caster).
    const ordered = [...groups.values()].sort((a, b) => a.classId - b.classId);
    return ordered.map((g) => `
      <section class="hero-group">
        <header class="hero-group-head">
          <span class="hg-title">${showFaction ? esc(g.faction) + " · " : ""}${esc(g.className)}</span>
          <span class="hg-type">${esc(g.classType)}</span>
          <span class="hg-count">${g.heroes.length}</span>
        </header>
        <div class="hero-group-body">${g.heroes.map(heroRowHTML).join("")}</div>
      </section>`).join("");
  }
  function miniIcon(src, label, kind) {
    return `<span class="hero-mini ${kind}" title="${esc(label)}">
      ${src ? `<img src="${esc(src)}" alt="" onerror="this.style.display='none';this.parentNode.classList.add('mini-empty')">` : ""}
      <span class="hero-mini-label">${esc(label)}</span></span>`;
  }
  function heroRowHTML(h) {
    const sel = h.id === state.ovl.pending;
    return `<div class="hero-row ${sel ? "selected" : ""}" data-action="pick" data-id="${esc(h.id)}" title="${esc(h.name)}">
      <span class="hero-row-portrait"><img src="${esc(h.icon)}" alt="" onerror="this.style.visibility='hidden'"></span>
      <span class="hero-row-id"><span class="hero-row-name">${esc(h.name)}</span></span>
      <span class="hero-row-icons">
        ${miniIcon(h.masterySprite, h.masteryUnit || "—", "mini-unit")}
        ${(h.startsWith || []).slice(0, 2).map((s) => miniIcon(s.icon, s.name, "mini-skill")).join("")}
      </span>
    </div>`;
  }

  const chip = (label) => (label || label === 0 ? `<span class="info-chip">${esc(label)}</span>` : "");
  // One context block: leading icon + kind/name, an optional row of stat/meta chips, and an
  // optional description. Returns "" when the element is absent for this hero.
  function infoBlock({ kind, name, icon, meta, desc }) {
    if (!name) return "";
    return `<div class="info-block">
      <div class="info-block-head">
        <span class="info-ico ${icon ? "" : "info-ico-empty"}">${icon ? `<img src="${esc(icon)}" alt="" onerror="this.parentNode.classList.add('info-ico-empty');this.remove()">` : ""}</span>
        <span class="info-block-id">
          <span class="info-kind">${esc(kind)}</span>
          <span class="info-name">${esc(name)}</span>
        </span>
      </div>
      ${meta ? `<div class="info-chips">${meta}</div>` : ""}
      ${desc ? `<p class="info-desc">${esc(desc)}</p>` : ""}
    </div>`;
  }
  const RANK_ROMAN = ["", "I", "II", "III", "IV", "V"];
  // Consolidated hero detail: centered portrait, faction banner, then Mastery-unit (with unit
  // stats + abilities), Specialty (with per-rank scaling text), and Starting-spell (rank/school/
  // type/targeting + cooldown for adventure spells) blocks.
  function heroInfoHTML(p) {
    if (!p) return `<div class="ovl-right-top detail-head"><h3>Details</h3></div>
      <div class="ovl-right-body"><p class="muted">Tap a hero to see details.</p></div>`;

    const mu = p.masteryUnitStats;
    const muMeta = mu ? [
      mu.tier != null ? chip(`Tier ${mu.tier}`) : "",
      mu.health != null ? chip(`${mu.health} HP`) : "",
      mu.damage != null ? chip(`${mu.damage} DMG`) : "",
      mu.growth != null ? chip(`+${mu.growth}/wk`) : "",
      mu.attackType ? chip(mu.attackType) : "",
    ].join("") : "";
    const muDesc = mu && mu.abilities && mu.abilities.length ? `Abilities: ${mu.abilities.join(", ")}` : null;

    const adv = p.startingSpellRank >= 4;
    const spMeta = p.startingSpell ? [
      chip(adv ? "Adventure" : `Rank ${RANK_ROMAN[Math.round(p.startingSpellRank)] || Math.round(p.startingSpellRank)}`),
      chip(p.startingSpellSchool),
      chip(p.startingSpellType),
      p.startingSpellTargeting && p.startingSpellTargeting !== p.startingSpellType ? chip(p.startingSpellTargeting) : "",
      adv ? chip("7-day cooldown") : "",
    ].join("") : "";

    // Starting skills the hero begins with (icon + name + summary), from the on-disk skillset.
    const skillsHTML = (p.startsWith || []).map((s) => `
      <div class="skill-row">
        <span class="info-ico ${s.icon ? "" : "info-ico-empty"}">${s.icon ? `<img src="${esc(s.icon)}" alt="" onerror="this.parentNode.classList.add('info-ico-empty');this.remove()">` : ""}</span>
        <span class="skill-row-txt"><span class="info-name">${esc(s.name)}</span>${s.desc ? `<span class="skill-row-desc">${esc(s.desc)}</span>` : ""}</span>
      </div>`).join("");
    const startingSkillsBlock = (p.startsWith && p.startsWith.length) ? `<div class="info-block">
        <div class="info-block-head"><span class="info-block-id"><span class="info-kind">Starts with</span></span></div>
        <div class="skill-list">${skillsHTML}</div>
      </div>` : "";

    return `<div class="ovl-right-top detail-head">
        <div class="detail-icon"><img src="${esc(p.icon)}" alt="" onerror="this.style.visibility='hidden'"></div>
        <h3>${esc(p.name)}</h3>
        <div class="detail-sub muted">${esc(p.className)} · ${esc(p.classType)} · ${esc(p.faction)}</div>
      </div>
      <div class="ovl-right-body">
        <div class="primary-traits">${p.traits.map((id) => traitBanner(traitById.get(id))).join("")}</div>
        ${infoBlock({ kind: "Specialty", name: p.masteryUnit, icon: p.masterySprite, meta: muMeta, desc: muDesc })}
        ${startingSkillsBlock}
        ${infoBlock({ kind: "Starting spell", name: p.startingSpell, icon: p.startingSpellIcon, meta: spMeta, desc: p.startingSpellDesc })}
        <div class="detail-meta muted">Race: ${esc(p.race || "—")} · Unlock tier: ${esc(String(p.unlockTier))}</div>
      </div>`;
  }

  function cardHTML(id, icon, name, selected, qColor) {
    const ring = qColor && selected ? "" : "";
    return `<div class="ovl-card ${selected ? "selected" : ""}" data-action="pick" data-id="${esc(id)}" title="${esc(name)}"${qColor ? ` style="box-shadow:inset 0 0 0 1px ${qColor}"` : ""}>
      ${icon ? `<img src="${esc(icon)}" alt="" onerror="this.style.display='none';this.parentNode.querySelector('.ovl-card-fallback').style.display='block'">` : ""}
      <span class="ovl-card-fallback" style="display:${icon ? "none" : "block"}">${esc(name)}</span>
    </div>`;
  }

  function closeOverlay(commit) {
    if (!state.ovl) return;
    if (commit) {
      if (state.ovl.kind === "hero") {
        if (state.build.heroId !== state.ovl.pending) state.build.skillRanks = {}; // new hero → fresh tree
        state.build.heroId = state.ovl.pending; if (state.build.heroId != null) state.view = "build";
      }
      else state.build.equipment[state.ovl.slotIndex] = state.ovl.pending;
      persist();
    }
    state.ovl = null;
    const root = document.getElementById("overlay-root");
    root.classList.add("hidden"); root.setAttribute("aria-hidden", "true"); root.innerHTML = "";
    renderApp();
  }

  // ═══ DETAIL OVERLAY (#detail-overlay-root) ═══
  function openArtifactDetail(id) {
    const a = artById.get(id); if (!a) return;
    const setLine = a.setId ? `<p>Set: <b>${esc(setById.get(a.setId).name)}</b> — needs ${setById.get(a.setId).threshold} pieces.</p>
      <h3>Set members</h3><ul class="trait-users">${setById.get(a.setId).members.map((mid) => { const m = artById.get(mid); return m ? `<li data-action="nav-artifact" data-id="${esc(m.id)}">${esc(m.name)}</li>` : ""; }).join("")}</ul>` : "";
    renderDetail(esc(a.name), `
      ${a.setId ? `<div class="primary-traits">${traitBanner(traitById.get(`set:${a.setId}`), `${setById.get(a.setId).name} Set`)}</div>` : ""}
      <p class="muted">Slot ${a.slot} · Quality ${a.quality}/5</p>
      <h3>Effects</h3>${a.effects.length ? `<ul class="trait-users" style="flex-direction:column">${a.effects.map((e) => `<li>${esc(effectLabel(e))}</li>`).join("")}</ul>` : `<p class="muted">No effects.</p>`}
      ${setLine}`);
  }
  function openTraitDetail(id) {
    const t = traitById.get(id); if (!t) return;
    let usersHtml;
    if (t.kind === "set") {
      const s = setById.get(Number(id.split(":")[1]));
      usersHtml = `<h3>Set members</h3><ul class="trait-users">${s.members.map((mid) => { const m = artById.get(mid); return m ? `<li data-action="nav-artifact" data-id="${esc(m.id)}">${esc(m.name)}</li>` : ""; }).join("")}</ul>
        <p class="muted">Complete with ${s.threshold} pieces.</p>`;
    } else {
      const heroes = DATA.heroes.filter((h) => h.traits.includes(id)).slice(0, 60);
      usersHtml = `<h3>Heroes</h3><ul class="trait-users">${heroes.map((h) => `<li data-action="nav-hero" data-id="${esc(h.id)}">${esc(h.name)}</li>`).join("")}</ul>`;
    }
    renderDetail(esc(t.name), `<div class="primary-traits">${traitBanner(t)}</div>${usersHtml}`);
  }
  function renderDetail(title, bodyHtml) {
    const root = document.getElementById("detail-overlay-root");
    root.innerHTML = `
      <div class="overlay-panel" role="dialog" aria-modal="true">
        <div class="overlay-header"><h2>${title}</h2><button class="overlay-close" data-action="close-detail" aria-label="Close">&times;</button></div>
        <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll detail-main">${bodyHtml}</div></div></div>
        <div class="overlay-footer"><button data-action="close-detail">Close</button></div>
      </div>`;
    root.classList.remove("hidden"); root.setAttribute("aria-hidden", "false");
  }
  function closeDetail() {
    const root = document.getElementById("detail-overlay-root");
    root.classList.add("hidden"); root.setAttribute("aria-hidden", "true"); root.innerHTML = "";
  }

  // ═══ SKILL TREE (#detail-overlay-root) — CURRENT 6-node model ═══
  // A hero's tree = its `learnable` nodes (major/class skills). Each node shows its group's
  // sub-skills, pre-filtered per hero in build-data. Gating (SKILLSETDATA, hero_scripts.gml:18383+):
  //   hero level = 1 + total ranks; a skill needs level ≥ lvlReq; a sub-skill also needs its node's
  //   major skill at rank ≥ rankReq; maxRanks per skill. (The old tiered pyramid was legacy data.)
  const SETS = DATA.skillsets || { majorIndex: {}, groups: [] };
  const SK_ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

  // sub-skill faction/class filter (hero_scripts.gml:18277 hero_subskill_available)
  function availFor(hero, v) {
    if (!v) return true;
    const d = Math.floor(v / 100), m = v % 100;
    if (d === 1) return hero.factionIndex === m;
    if (d === 2) return hero.factionIndex !== m;
    if (d === 3) return hero.classId === m;
    if (d === 4) return hero.classId !== m;
    return true;
  }
  // the ≤6 nodes for a hero: {major, subs[]} — major = the learnable skill record; subs filtered.
  function heroNodes(hero) {
    const nodes = [];
    for (const name of hero.learnable || []) {
      const gi = SETS.majorIndex[name]; if (gi == null) continue;
      const g = SETS.groups[gi];
      const major = g.majors.find((mm) => mm.name === name) || { name, maxRanks: 4, lvlReq: 0, rankReq: 0, icon: null };
      nodes.push({ major, subs: g.subs.filter((s) => availFor(hero, s.avail)) });
    }
    return nodes;
  }
  const rankOf = (name) => Number(state.build.skillRanks[name] || 0);
  function totalRanks() { let n = 0; for (const k in state.build.skillRanks) n += Number(state.build.skillRanks[k] || 0); return n; }
  const heroLevel = () => 1 + totalRanks();

  function canInc(skill, node) {
    if (rankOf(skill.name) >= skill.maxRanks) return false;
    if (heroLevel() < (skill.lvlReq || 0)) return false;
    if (node && skill !== node.major && rankOf(node.major.name) < (skill.rankReq || 0)) return false;
    return true;
  }
  // short reason a not-yet-allocated skill is locked ("" if allocatable)
  function lockReason(skill, node) {
    if (heroLevel() < (skill.lvlReq || 0)) return `Lv ${skill.lvlReq}`;
    if (node && skill !== node.major && rankOf(node.major.name) < (skill.rankReq || 0)) return `${node.major.name} ${SK_ROMAN[skill.rankReq] || skill.rankReq}`;
    return "";
  }
  function findSkill(hero, name) {
    for (const node of heroNodes(hero)) for (const s of [node.major, ...node.subs]) if (s.name === name) return { s, node };
    return null;
  }
  function incSkill(name) {
    const hero = heroById.get(state.build.heroId); if (!hero) return;
    const f = findSkill(hero, name); if (!f || !canInc(f.s, f.node)) return;
    state.build.skillRanks[name] = rankOf(name) + 1; persist(); renderSkillTree();
  }
  // drop ranks the current level/major-rank no longer supports (cascade after a decrement)
  function pruneInvalid(hero) {
    const byName = {}, nodeOf = {};
    for (const node of heroNodes(hero)) for (const s of [node.major, ...node.subs]) { byName[s.name] = s; nodeOf[s.name] = node; }
    for (const k of Object.keys(state.build.skillRanks)) if (!byName[k]) delete state.build.skillRanks[k]; // not in this hero's tree
    let guard = 0;
    for (;;) {
      if (guard++ > 500) break;
      const L = heroLevel(); let bad = null;
      for (const name of Object.keys(state.build.skillRanks)) {
        const r = rankOf(name); if (r <= 0) continue;
        const s = byName[name], node = nodeOf[name];
        if (r > s.maxRanks || L < (s.lvlReq || 0) || (s !== node.major && rankOf(node.major.name) < (s.rankReq || 0))) { bad = name; break; }
      }
      if (!bad) break;
      const nr = rankOf(bad) - 1; if (nr <= 0) delete state.build.skillRanks[bad]; else state.build.skillRanks[bad] = nr;
    }
  }
  function decSkill(name) {
    const hero = heroById.get(state.build.heroId); if (!hero || rankOf(name) <= 0) return;
    const nr = rankOf(name) - 1; if (nr <= 0) delete state.build.skillRanks[name]; else state.build.skillRanks[name] = nr;
    pruneInvalid(hero); persist(); renderSkillTree();
  }
  function openSkillTree() {
    const hero = state.build.heroId != null ? heroById.get(state.build.heroId) : null;
    if (!hero) { openHeroOverlay(); return; }
    pruneInvalid(hero); renderSkillTree();
  }
  function renderSkillTree() {
    const hero = heroById.get(state.build.heroId); if (!hero) return;
    const nodes = heroNodes(hero);
    const level = heroLevel(), points = level - 1;

    const cellHTML = (s, node, isMajor) => {
      const r = rankOf(s.name), max = s.maxRanks, can = canInc(s, node);
      const lock = r === 0 ? lockReason(s, node) : "";
      const pips = Array.from({ length: max }, (_, i) => `<span class="tk-pip ${i < r ? "on" : ""}"></span>`).join("");
      return `<div class="tk-node ${isMajor ? "tk-major" : ""} ${r > 0 ? "allocated" : ""} ${r === 0 && !can ? "locked" : ""}" title="${esc(s.name)}${s.desc ? " — " + esc(s.desc) : ""}">
        <div class="tk-icon">${s.icon ? `<img src="${esc(s.icon)}" alt="" onerror="this.style.display='none'">` : `<span class="tk-ico-fallback">${esc(s.name[0])}</span>`}</div>
        <div class="tk-name">${esc(s.name)}</div>
        <div class="tk-pips">${pips}</div>
        <div class="tk-ctrl">
          <button class="tk-btn" data-action="skill-dec" data-skill="${esc(s.name)}" ${r <= 0 ? "disabled" : ""}>−</button>
          <span class="tk-rank">${r}/${max}</span>
          <button class="tk-btn" data-action="skill-inc" data-skill="${esc(s.name)}" ${r >= max || !can ? "disabled" : ""}>+</button>
        </div>
        ${lock ? `<div class="tk-req no">${esc(lock)}</div>` : (r >= max ? `<div class="tk-req max">MAX</div>` : `<div class="tk-req ok">&nbsp;</div>`)}
      </div>`;
    };
    const nodesHTML = nodes.map((node) => `
      <section class="tk-nodegroup">
        <div class="tk-nodegroup-major">${cellHTML(node.major, node, true)}</div>
        <div class="tk-nodegroup-subs">${node.subs.map((s) => cellHTML(s, node, false)).join("")}</div>
      </section>`).join("");

    const root = document.getElementById("detail-overlay-root");
    const prev = root.querySelector(".tk-scroll");
    const prevScroll = prev ? prev.scrollTop : 0;
    root.innerHTML = `
      <div class="overlay-panel skilltree-panel" role="dialog" aria-modal="true">
        <div class="overlay-header">
          <h2>${esc(hero.name)} — Skill Tree</h2>
          <button class="overlay-close" data-action="close-detail" aria-label="Close">&times;</button>
        </div>
        <div class="tk-bar">
          <div class="tk-level"><span class="tk-level-num">${level}</span><span class="tk-level-lbl">Level</span></div>
          <div class="tk-points">${points} skill point${points === 1 ? "" : "s"} spent</div>
          <button class="ghost" data-action="skill-reset">Reset</button>
        </div>
        <div class="overlay-body"><div class="tk-scroll">
          ${nodes.length ? nodesHTML : `<p class="muted">This hero has no skill-tree data.</p>`}
          <p class="tk-note muted">Each node is a major skill with its sub-skills. Raising anything costs a level; a sub-skill unlocks at its required level and once its node's major skill reaches the required rank.</p>
        </div></div>
        <div class="overlay-footer"><button data-action="close-detail">Done</button></div>
      </div>`;
    root.classList.remove("hidden"); root.setAttribute("aria-hidden", "false");
    const sc = root.querySelector(".tk-scroll"); if (sc) sc.scrollTop = prevScroll;
  }

  // ═══ EVENT DELEGATION ═══
  function onAppClick(e) {
    const el = e.target.closest("[data-action]"); if (!el) return;
    // realm toggle sits inside the hero header; don't let its clicks open the hero selector
    switch (el.dataset.action) {
      case "open-faction": openHeroOverlay(el.dataset.faction); break;
      case "go-landing": state.view = "landing"; renderApp(); break;
      case "open-hero": openHeroOverlay(); break;
      case "open-slot": openSlotOverlay(Number(el.dataset.slot)); break;
      case "open-skilltree": e.stopPropagation(); openSkillTree(); break;
      case "set-realm": {
        e.stopPropagation();
        if (state.build.realm !== el.dataset.realm) { state.build.realm = el.dataset.realm; persist(); renderApp(); }
        break;
      }
      case "stat-inc": bumpStat(el.dataset.key, +1); break;
      case "stat-dec": bumpStat(el.dataset.key, -1); break;
      case "clear": state.build = makeBuild(); persist(); renderApp(); break;
      case "nav-trait": openTraitDetail(el.dataset.trait); break;
      case "nav-artifact": openArtifactDetail(el.dataset.id); break;
    }
  }
  function bumpStat(key, d) {
    if (!PRIMARY.includes(key)) return;
    state.build.stats[key] = Math.max(0, Number(state.build.stats[key] || 0) + d);
    persist(); renderApp();
  }

  function onOverlayClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el) { if (e.target.id === "overlay-root") closeOverlay(false); return; }
    switch (el.dataset.action) {
      case "pick": { const id = el.dataset.id; state.ovl.touched = true; state.ovl.pending = state.ovl.pending === id || (state.ovl.kind === "hero" && String(state.ovl.pending) === id) ? null : (state.ovl.kind === "hero" ? Number(id) : id); refreshOverlay(); break; }
      case "detail": openArtifactDetail(el.dataset.id); break;
      case "nav-trait": openTraitDetail(el.dataset.trait); break;
      case "cancel": closeOverlay(false); break;
      case "confirm": closeOverlay(true); break;
    }
  }
  function onOverlayInput(e) { if (!e.target.classList.contains("ovl-search")) return; state.ovl.search = e.target.value; refreshOverlay(); }
  function onDetailClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el) { if (e.target.id === "detail-overlay-root") closeDetail(); return; }
    switch (el.dataset.action) {
      case "close-detail": closeDetail(); break;
      case "nav-trait": openTraitDetail(el.dataset.trait); break;
      case "nav-artifact": openArtifactDetail(el.dataset.id); break;
      case "nav-hero": closeDetail(); if (state.build.heroId !== Number(el.dataset.id)) state.build.skillRanks = {}; state.build.heroId = Number(el.dataset.id); persist(); renderApp(); break;
      case "skill-inc": incSkill(el.dataset.skill); break;
      case "skill-dec": decSkill(el.dataset.skill); break;
      case "skill-reset": state.build.skillRanks = {}; persist(); renderSkillTree(); break;
    }
  }
  function onKeydown(e) {
    if (e.key !== "Escape") return;
    if (!document.getElementById("detail-overlay-root").classList.contains("hidden")) return closeDetail();
    if (state.ovl) closeOverlay(false);
  }

  // ── init ──
  document.getElementById("app").addEventListener("click", onAppClick);
  document.getElementById("overlay-root").addEventListener("click", onOverlayClick);
  document.getElementById("overlay-root").addEventListener("input", onOverlayInput);
  document.getElementById("detail-overlay-root").addEventListener("click", onDetailClick);
  document.addEventListener("keydown", onKeydown);
  renderApp();
})();
