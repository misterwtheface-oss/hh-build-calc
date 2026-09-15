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

  const DATA = window.HH_DATA || { heroes: [], classes: [], artifacts: [], artifactSets: [], traits: [], effectStat: {} };
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
  const state = { build: load(), ovl: null };

  function makeBuild() {
    return { heroId: null, realm: "HH", equipment: Array(SLOT_COUNT).fill(null), stats: { A: 0, D: 0, K: 0, S: 0, M: 0, L: 0 } };
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

  // ═══ BUILD VIEW ═══
  function renderApp() {
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
          ${realmToggleHTML()}
        </div>
      </div>` : `
      <div class="hero-header" data-action="open-hero">
        <div class="hero-portrait"><span class="muted">?</span></div>
        <div class="hero-id"><h2 class="hero-empty">Select a hero</h2><div class="hero-sub muted">Click to choose from 250 heroes</div></div>
      </div>`;

    const silhouette = cls ? `<div class="paperdoll-silhouette"><img src="${esc(cls.icon)}" alt="" onerror="this.style.display='none'"></div>` : "";
    const slots = state.build.equipment.map((id, i) => {
      const a = id ? artById.get(id) : null;
      const q = a ? QUALITY_COLOR[a.quality] || "var(--border-hi)" : "";
      const inner = a ? `<img src="${esc(a.icon)}" alt="" title="${esc(a.name)}" onerror="this.style.visibility='hidden'">` : `<span class="slot-empty">+</span>`;
      return `<div class="slot ${a ? "filled" : ""}" style="${a ? `--q-color:${q}` : ""}" data-action="open-slot" data-slot="${i}" title="${a ? esc(a.name) : "Slot " + (i + 1)}">${inner}</div>`;
    }).join("");

    app.innerHTML = `
      <header class="app-header"><h1>Hero's Hour Build Calculator</h1><button class="ghost" data-action="clear">Clear</button></header>
      <main class="planning-main">
        ${heroHeader}
        <div class="build-body">
          <div class="paperdoll">${silhouette}<div class="paperdoll-grid">${slots}</div></div>
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
  function openHeroOverlay() {
    state.ovl = { kind: "hero", pending: state.build.heroId, search: "" };
    openOverlayShell("Choose a hero");
  }
  function openSlotOverlay(slotIndex) {
    state.ovl = { kind: "artifact", slotIndex, pending: state.build.equipment[slotIndex], search: "" };
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
      const list = DATA.heroes.filter((h) => !q || h.name.toLowerCase().includes(q) || h.faction.toLowerCase().includes(q) || h.className.toLowerCase().includes(q));
      panel.querySelector(".ovl-grid").innerHTML = list.length ? list.map((h) => cardHTML(h.id, h.icon, h.name, h.id === state.ovl.pending)).join("") : `<p class="muted">No matches.</p>`;
      const p = state.ovl.pending != null ? heroById.get(state.ovl.pending) : null;
      panel.querySelector(".ovl-left").innerHTML = `<h3>Hero</h3>` + (p
        ? `<p><b>${esc(p.name)}</b></p><p class="muted">${esc(p.className)} (${esc(p.classType)})</p>
           <p class="muted">Faction: ${esc(p.faction)}</p><p class="muted">Race: ${esc(p.race || "—")}</p>
           <p class="muted">Unlock tier: ${esc(String(p.unlockTier))}</p>`
        : `<p class="muted">Select a hero.</p>`);
      panel.querySelector(".ovl-right").innerHTML = p
        ? `<div class="ovl-right-top"><h3>${esc(p.name)}</h3></div>
           <div class="ovl-right-body">
             ${p.traits.map((id) => traitBanner(traitById.get(id))).join("")}
             <p class="muted">Mastery unit: ${esc(p.masteryUnit || "—")}</p>
             <p class="muted">Specialty: ${esc(p.specialtySkill || "—")}</p>
             <p class="muted">Starting spell: ${esc(p.startingSpell || "—")}</p>
           </div>`
        : `<div class="ovl-right-top"><h3>Details</h3></div><div class="ovl-right-body"><p class="muted">Select a hero to see details.</p></div>`;
      panel.querySelector(".overlay-body").classList.toggle("has-selection", !!p);
    } else {
      const slot = state.ovl.slotIndex + 1;
      const list = DATA.artifacts.filter((a) => a.slot === slot).filter((a) => !q || a.name.toLowerCase().includes(q));
      panel.querySelector(".ovl-grid").innerHTML = list.length ? list.map((a) => cardHTML(a.id, a.icon, a.name, a.id === state.ovl.pending, QUALITY_COLOR[a.quality])).join("") : `<p class="muted">No artifacts for this slot.</p>`;
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
      panel.querySelector(".overlay-body").classList.toggle("has-selection", !!p);
    }
    SCROLLERS.forEach((sel, i) => { const el = panel.querySelector(sel); if (el) el.scrollTop = saved[i]; });
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
      if (state.ovl.kind === "hero") state.build.heroId = state.ovl.pending;
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

  // ═══ EVENT DELEGATION ═══
  function onAppClick(e) {
    const el = e.target.closest("[data-action]"); if (!el) return;
    // realm toggle sits inside the hero header; don't let its clicks open the hero selector
    switch (el.dataset.action) {
      case "open-hero": openHeroOverlay(); break;
      case "open-slot": openSlotOverlay(Number(el.dataset.slot)); break;
      case "set-realm": e.stopPropagation(); state.build.realm = el.dataset.realm; persist(); renderApp(); break;
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
      case "pick": { const id = el.dataset.id; state.ovl.pending = state.ovl.pending === id || (state.ovl.kind === "hero" && String(state.ovl.pending) === id) ? null : (state.ovl.kind === "hero" ? Number(id) : id); refreshOverlay(); break; }
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
      case "nav-hero": closeDetail(); state.build.heroId = Number(el.dataset.id); persist(); renderApp(); break;
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
