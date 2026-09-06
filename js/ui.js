/* Shared UI helpers */

import { FILTERS } from "./formats.js";

export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

export function hud(value, label, color = "var(--gold)", rgb = "255,215,0") {
  return `<div class="hud" style="--hud-color:${color}; --hud-rgb:${rgb};">
    <div class="hud__value">${value}</div>
    <div class="hud__label">${label}</div>
  </div>`;
}

export function fmtDate(raw) {
  if (!raw) return "";
  const date = new Date(String(raw).split(" ")[0] + "T00:00:00");
  if (isNaN(date)) return raw;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function innRow(inn) {
  const sr = inn.balls ? (inn.runs / inn.balls * 100).toFixed(1) : 0;
  const extras = [];
  if (inn.fours) extras.push(`${inn.fours}×4`);
  if (inn.sixes) extras.push(`${inn.sixes}×6`);
  const boundaries = extras.length ? ` (${extras.join(", ")})` : "";
  const outTag = inn.dismissed ? '<span class="inn-row__badge">OUT</span>' : "";
  const venue = inn.venue ? ` · 🏟 ${escapeHtml(inn.venue)}` : "";

  return `<div class="inn-row${inn.dismissed ? " inn-row--out" : ""}">
    <div style="flex:1;">
      <div class="inn-row__score">${inn.runs} off ${inn.balls} balls${boundaries}${outTag}</div>
      <div class="inn-row__detail">SR: ${sr} · 📅 ${fmtDate(inn.date)}${venue}</div>
    </div>
  </div>`;
}

let collapseCount = 0;
export function collapse(toggleText, bodyHtml) {
  const id = `col_${++collapseCount}`;
  return `<button class="collapse-toggle" onclick="(function(e){
    e.classList.toggle('open');
    document.getElementById('${id}').classList.toggle('open');
  })(this)"><span class="arrow">▸</span> ${toggleText}</button>
  <div class="collapse-body" id="${id}">${bodyHtml}</div>`;
}

/* ─── Filter chip rows ─────────────────────────────────────────────────────── */

export function chipRow(groupName, options, selectedId, label) {
  const chips = options.map(option => `
    <button class="chip${option.id === selectedId ? " chip--on" : ""}"
            data-group="${groupName}" data-value="${option.id}">${escapeHtml(option.label)}</button>`
  ).join("");
  return `<div class="filter-row">
    ${label ? `<span class="filter-row__label">${escapeHtml(label)}</span>` : ""}
    <div class="chips" data-chips="${groupName}">${chips}</div>
  </div>`;
}

export function competitionChips(selectedId) {
  return chipRow("competition", FILTERS, selectedId, "Competition");
}

/* Wire up a chip row. onPick gets the newly chosen value. */
export function onChipPick(root, groupName, onPick) {
  const container = root.querySelector(`[data-chips="${groupName}"]`);
  if (!container) return;
  container.addEventListener("click", event => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    container.querySelectorAll(".chip").forEach(c => c.classList.toggle("chip--on", c === chip));
    onPick(chip.dataset.value);
  });
}

/* ─── Season picker ───────────────────────────────────────────────────────── */

/* A "from" and a "to" year, plus a button to go back to the whole career.
   Setting both ends to the same year is how you look at one season. */
export function seasonPicker(years, from, to) {
  if (!years.length) {
    return `<div class="filter-row">
      <span class="filter-row__label">Season</span>
      <span class="season-empty">—</span>
    </div>`;
  }

  const options = chosen => years.map(year =>
    `<option value="${year}"${year === chosen ? " selected" : ""}>${year}</option>`
  ).join("");

  const wholeCareer = from === years[0] && to === years[years.length - 1];

  return `<div class="filter-row">
    <span class="filter-row__label">Season</span>
    <div class="season-picker">
      <button class="chip${wholeCareer ? " chip--on" : ""}" data-season-all="1">All years</button>
      <select class="season-select" data-season-edge="from" aria-label="From year">${options(from)}</select>
      <span class="season-picker__dash">to</span>
      <select class="season-select" data-season-edge="to" aria-label="To year">${options(to)}</select>
    </div>
  </div>`;
}

/* Wire a season picker up. onPick gets {from, to}; the ends are kept in order,
   so dragging "from" past "to" pushes "to" along rather than going blank. */
export function wireSeasonPicker(root, years, current, onPick) {
  const picker = root.querySelector(".season-picker");
  if (!picker) return;

  picker.querySelector("[data-season-all]")?.addEventListener("click", () => {
    onPick({ from: years[0], to: years[years.length - 1] });
  });

  picker.querySelectorAll(".season-select").forEach(select => {
    select.addEventListener("change", () => {
      const value = Number(select.value);
      let { from, to } = current;
      if (select.dataset.seasonEdge === "from") {
        from = value;
        if (from > to) to = from;
      } else {
        to = value;
        if (to < from) from = to;
      }
      onPick({ from, to });
    });
  });
}

/* How the chosen span reads in the summary line. */
export function describeSeason(years, season) {
  if (!years.length || !season) return "all years";
  if (season.from === years[0] && season.to === years[years.length - 1]) return "all years";
  return season.from === season.to ? `${season.from}` : `${season.from}–${season.to}`;
}

/* ─── Player search box ───────────────────────────────────────────────────── */

export function searchBox(id, placeholder, icon = "🏏") {
  return `<div class="search-wrap">
    <span class="search-icon">${icon}</span>
    <input class="search-input" id="${id}" placeholder="${escapeHtml(placeholder)}"
           autocomplete="off" spellcheck="false">
    <div class="dropdown" id="${id}Drop"></div>
  </div>`;
}

/* Type-ahead over a list of names, with arrow-key and Enter support. */
export function wireSearchBox(id, names, onPick) {
  const input = document.getElementById(id);
  const drop = document.getElementById(`${id}Drop`);
  if (!input || !drop) return;
  let highlighted = -1;

  function close() { drop.classList.remove("open"); highlighted = -1; }

  function paint(matches) {
    drop.innerHTML = matches.map((name, i) =>
      `<div class="dropdown__item${i === highlighted ? " dropdown__item--on" : ""}">${escapeHtml(name)}</div>`
    ).join("");
    drop.classList.toggle("open", matches.length > 0);
  }

  function currentMatches() {
    const query = input.value.toLowerCase().trim();
    if (!query) return [];
    const startsWith = [], contains = [];
    for (const name of names) {
      const lower = name.toLowerCase();
      if (lower.startsWith(query)) startsWith.push(name);
      else if (lower.includes(query)) contains.push(name);
      if (startsWith.length >= 25) break;
    }
    return startsWith.concat(contains).slice(0, 25);
  }

  input.addEventListener("input", () => { highlighted = -1; paint(currentMatches()); });

  input.addEventListener("keydown", event => {
    const items = [...drop.querySelectorAll(".dropdown__item")];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!items.length) return;
      event.preventDefault();
      highlighted += event.key === "ArrowDown" ? 1 : -1;
      if (highlighted < 0) highlighted = items.length - 1;
      if (highlighted >= items.length) highlighted = 0;
      items.forEach((item, i) => item.classList.toggle("dropdown__item--on", i === highlighted));
      items[highlighted].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      const chosen = items[highlighted >= 0 ? highlighted : 0];
      if (chosen) { input.value = chosen.textContent; close(); onPick(chosen.textContent); }
    } else if (event.key === "Escape") {
      close();
    }
  });

  drop.addEventListener("mousedown", event => {
    const item = event.target.closest(".dropdown__item");
    if (!item) return;
    event.preventDefault();
    input.value = item.textContent;
    close();
    onPick(item.textContent);
  });

  input.addEventListener("blur", () => setTimeout(close, 150));
}

/* ─── Ranking table ───────────────────────────────────────────────────────── */

/* columns: [{ label, align, cell(row, index) }] */
export function rankTable(columns, rows) {
  const head = columns.map(col =>
    `<th${col.align === "left" ? ' class="left"' : ""}>${escapeHtml(col.label)}</th>`
  ).join("");

  const body = rows.map((row, index) => `<tr>${columns.map(col =>
    `<td${col.align === "left" ? ' class="left"' : ""}>${col.cell(row, index)}</td>`
  ).join("")}</tr>`).join("");

  return `<div class="table-wrap animate-in">
    <table class="stat-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </div>`;
}

export function emptyState(icon, text) {
  return `<div class="empty"><div class="empty__icon">${icon}</div>
    <div class="empty__text">${text}</div></div>`;
}

export function pageHeader(icon, title, subtitle) {
  return `<div class="page-header">
    <h1>${icon} <span class="accent">${escapeHtml(title)}</span></h1>
    <p>${escapeHtml(subtitle)}</p>
  </div>`;
}

/* Team name plus its logo or flag, ready to drop in a table cell. */
export function teamCell(teamId, teams) {
  const team = teams[teamId] || {};
  const color = team.color || "var(--text)";
  const badge = team.logo
    ? `<img class="team-cell__logo" src="${team.logo}" alt="" loading="lazy">`
    : `<span class="team-cell__flag">${team.badge || "🏏"}</span>`;
  return `<span class="team-cell">${badge}
    <span style="color:${color}; font-weight:700;">${escapeHtml(team.name || teamId)}</span></span>`;
}
