/* Venue Explorer — scoring and result patterns at every ground. */

import * as store from "../store.js";
import { FILTERS, filterById } from "../formats.js";
import { pageHeader, chipRow, onChipPick, hud, emptyState, escapeHtml } from "../ui.js";

export async function render(el) {
  const data = await store.venues();
  let competition = "all";
  let ground = "";

  el.innerHTML = `
    ${pageHeader("🏟", "Venue Explorer", "Scoring and chasing patterns across every ground")}
    ${chipRow("competition", FILTERS, competition, "Competition")}
    <div class="select-wrap" style="max-width:560px; margin:1rem 0 1.5rem;">
      <select id="venueSel"><option value="">Choose a ground…</option></select>
    </div>
    <div id="venueResult"></div>`;

  const select = document.getElementById("venueSel");
  const output = document.getElementById("venueResult");

  onChipPick(el, "competition", value => { competition = value; fillGrounds(); paint(); });
  select.addEventListener("change", () => { ground = select.value; paint(); });

  /* Only offer grounds that have matches in the chosen competition, ordered by
     how much cricket has been played there. */
  function fillGrounds() {
    const codes = filterById(competition).codes;
    const grounds = Object.entries(data)
      .map(([name, byCode]) => ({
        name,
        matches: codes.reduce((sum, code) => sum + (byCode[code]?.matches || 0), 0),
      }))
      .filter(entry => entry.matches > 0)
      .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));

    select.innerHTML = `<option value="">Choose a ground…</option>` + grounds.map(entry =>
      `<option value="${escapeHtml(entry.name)}"${entry.name === ground ? " selected" : ""}>
        ${escapeHtml(entry.name)} (${entry.matches})</option>`
    ).join("");

    if (!grounds.some(entry => entry.name === ground)) ground = "";
    select.value = ground;
  }

  function paint() {
    if (!ground) { output.innerHTML = emptyState("🏟", "Pick a ground to see its numbers"); return; }

    const filter = filterById(competition);
    const byCode = data[ground] || {};
    const totals = { matches: 0, firstRuns: 0, secondRuns: 0, batFirstWins: 0, chaseWins: 0 };

    for (const code of filter.codes) {
      const stats = byCode[code];
      if (!stats) continue;
      totals.matches += stats.matches;
      totals.firstRuns += stats.avg_first * stats.matches;
      totals.secondRuns += stats.avg_second * stats.matches;
      totals.batFirstWins += stats.bat_first_wins;
      totals.chaseWins += stats.chase_wins;
    }

    if (!totals.matches) {
      output.innerHTML = emptyState("🚫", `No ${filter.label} matches recorded at this ground`);
      return;
    }

    const avgFirst = Math.round(totals.firstRuns / totals.matches);
    const avgSecond = Math.round(totals.secondRuns / totals.matches);
    const decided = totals.batFirstWins + totals.chaseWins;
    const batFirstPct = decided ? +(totals.batFirstWins / decided * 100).toFixed(1) : 0;
    const chasePct = decided ? +(totals.chaseWins / decided * 100).toFixed(1) : 0;

    const nature = batFirstPct > 53 ? "Defend-Friendly" : chasePct > 53 ? "Chase-Friendly" : "Balanced";
    const natureColor = nature === "Chase-Friendly" ? "var(--green)"
      : nature === "Defend-Friendly" ? "var(--orange)" : "var(--blue)";

    output.innerHTML = `
      <div class="card card--flat animate-in" style="margin-bottom:1rem;">
        <h3 style="font-size:1.1rem; margin-bottom:0.5rem;">🏟 ${escapeHtml(ground)}</h3>
        <span class="team-badge" style="background:rgba(255,255,255,0.05); color:${natureColor};
          border-color:${natureColor}; font-size:0.78rem;">${nature} · ${filter.label}</span>
      </div>
      <div class="hud-grid hud-grid--4 animate-in stagger-1">
        ${hud(totals.matches, "Matches", "var(--blue)", "59,130,246")}
        ${hud(avgFirst, "Avg 1st Innings", "var(--green)", "16,185,129")}
        ${hud(avgSecond, "Avg 2nd Innings", "var(--orange)", "245,158,11")}
        ${hud(batFirstPct + "%", "Bat First Win %", "var(--gold)", "255,215,0")}
      </div>
      <div class="hud-grid hud-grid--4 animate-in stagger-2" style="margin-top:0.75rem;">
        ${hud(totals.batFirstWins, "Bat First Wins", "var(--green)", "16,185,129")}
        ${hud(totals.chaseWins, "Chase Wins", "var(--blue)", "59,130,246")}
        ${hud(chasePct + "%", "Chase Win %", "var(--purple)", "168,85,247")}
        ${hud(Math.round((avgFirst + avgSecond) / 2), "Avg Score", "var(--text)", "226,232,240")}
      </div>
      ${splitByCompetition(byCode)}`;
  }

  function splitByCompetition(byCode) {
    const parts = [
      ["p", "IPL"], ["t", "Test"], ["o", "ODI"], ["i", "T20I"],
    ].filter(([code]) => byCode[code]).map(([code, name]) => {
      const stats = byCode[code];
      return `<span class="split-pill"><strong>${name}</strong> ${stats.matches} mat
        · 1st inns ${stats.avg_first}</span>`;
    });
    return parts.length ? `<div class="split-row animate-in" style="margin-top:1rem;">${parts.join("")}</div>` : "";
  }

  fillGrounds();
  paint();
}
