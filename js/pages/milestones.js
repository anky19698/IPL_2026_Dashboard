/* Milestones — active players sitting just short of a round career total. */

import * as store from "../store.js";
import { pageHeader, chipRow, onChipPick, emptyState, escapeHtml } from "../ui.js";

/* Milestones are counted inside one competition at a time, so the combined
   options do not apply here. */
const COMPETITIONS = [
  { id: "p", label: "IPL" },
  { id: "t", label: "Test" },
  { id: "o", label: "ODI" },
  { id: "i", label: "T20I" },
];

export async function render(el) {
  const [data, teams] = await Promise.all([store.milestones(), store.teams()]);
  let competition = "p";

  el.innerHTML = `
    ${pageHeader("🏅", "Milestones Approaching", "Players closing in on a career landmark")}
    ${chipRow("competition", COMPETITIONS, competition, "Competition")}
    <div id="msResult"></div>`;

  const output = document.getElementById("msResult");
  onChipPick(el, "competition", value => { competition = value; paint(); });

  function paint() {
    const bucket = data[competition] || { imminent: [], watchlist: [] };
    const imminent = bucket.imminent || [];
    const watchlist = bucket.watchlist || [];

    if (!imminent.length && !watchlist.length) {
      output.innerHTML = emptyState("🏅", "No milestones approaching in this competition");
      return;
    }

    let html = "";
    if (imminent.length) {
      html += `<div class="section-title">🔥 Imminent</div>`;
      html += imminent.map((entry, i) => milestoneRow(entry, i, teams)).join("");
    }
    if (watchlist.length) {
      html += `<div class="section-title" style="margin-top:2rem;">👀 On the Watchlist</div>`;
      html += watchlist.map((entry, i) => milestoneRow(entry, i, teams)).join("");
    }
    output.innerHTML = html;
  }

  paint();
}

function milestoneRow(entry, i, teams) {
  const team = teams[entry.team] || {};
  const badge = team.logo
    ? `<img class="ms-row__team-logo" src="${team.logo}" alt="${escapeHtml(team.short || "")}">`
    : `<span class="ms-row__team-flag" title="${escapeHtml(team.name || "")}">${team.badge || "🏏"}</span>`;

  return `<div class="ms-row animate-in" style="animation-delay:${Math.min(i, 8) * 0.04}s;">
    <span class="ms-row__icon">${entry.icon}</span>
    ${badge}
    <div class="ms-row__info">
      <div class="ms-row__player">${escapeHtml(entry.player)}</div>
      <div class="ms-row__detail">${escapeHtml(entry.detail)}</div>
    </div>
    <div class="ms-row__needed">${escapeHtml(entry.needed)}</div>
  </div>`;
}
