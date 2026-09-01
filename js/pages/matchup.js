/* Player Matchup — one batter against one bowler, across every competition. */

import * as store from "../store.js";
import { DEFAULT_FILTER, filterById, combine, toStats } from "../formats.js";
import {
  pageHeader, searchBox, wireSearchBox, competitionChips, onChipPick,
  hud, innRow, emptyState, escapeHtml, collapse,
} from "../ui.js";

const COMPETITION_NAMES = { p: "IPL", t: "Test", o: "ODI", i: "T20I" };

export async function render(el, params) {
  const [batterIndex, bowlerIndex] = await Promise.all([store.batterIndex(), store.bowlerIndex()]);
  const batterNames = Object.keys(batterIndex);
  const bowlerNames = Object.keys(bowlerIndex);

  let batter = "", bowler = "";
  if (params) {
    const [a, b] = decodeURIComponent(params).split("__");
    if (a && batterIndex[a] !== undefined) batter = a;
    if (b && bowlerIndex[b] !== undefined) bowler = b;
  }
  let competition = DEFAULT_FILTER;
  let record = null, innings = {};

  el.innerHTML = `
    ${pageHeader("⚔️", "Player Matchup", "Any batter against any bowler — IPL, Test, ODI and T20I")}
    <div class="grid-2" style="margin-bottom:1rem;">
      ${searchBox("muBatter", "Search batter…", "🏏")}
      ${searchBox("muBowler", "Search bowler…", "⚾")}
    </div>
    ${competitionChips(competition)}
    <div id="muResult"></div>`;

  const output = document.getElementById("muResult");

  wireSearchBox("muBatter", batterNames, name => { batter = name; reload(); });
  wireSearchBox("muBowler", bowlerNames, name => { bowler = name; reload(); });
  onChipPick(el, "competition", value => { competition = value; paint(); });

  async function reload() {
    if (!batter || !bowler) { paint(); return; }
    window.history.replaceState(null, "", `#matchup/${encodeURIComponent(`${batter}__${bowler}`)}`);
    output.innerHTML = `<div class="loader"><div class="loader__spinner"></div><p>Loading matchup…</p></div>`;
    try {
      const [batterRecord, matchupInnings] = await Promise.all([
        store.batterRecord(batter),
        store.matchupInnings(batter, bowler),
      ]);
      record = batterRecord?.b?.[bowler] || null;
      innings = matchupInnings;
    } catch {
      output.innerHTML = emptyState("⚠️", "Could not load this matchup.");
      return;
    }
    paint();
  }

  function paint() {
    if (!batter || !bowler) {
      output.innerHTML = batter || bowler
        ? emptyState("⚔️", "Pick both a batter and a bowler")
        : emptyState("⚔️", "Search for a batter and a bowler to see their head-to-head");
      return;
    }

    const filter = filterById(competition);
    const stats = toStats(combine(record, filter.codes));

    if (!stats) {
      output.innerHTML = `${breakdownBar(record)}
        ${emptyState("🚫", `<strong>${escapeHtml(batter)}</strong> has not faced
          <strong>${escapeHtml(bowler)}</strong> in <strong>${filter.label}</strong>`)}`;
      return;
    }

    let html = `<div class="card card--flat animate-in" style="margin-bottom:1rem; text-align:center; padding:1.4rem;">
      <div style="font-size:1.25rem; font-weight:800;">
        🏏 <span style="color:var(--gold);">${escapeHtml(batter)}</span>
        <span style="color:var(--text-dim);"> vs </span>
        ⚾ <span>${escapeHtml(bowler)}</span>
      </div>
      <div style="color:var(--text-muted); font-size:0.82rem; margin-top:0.3rem;">${filter.label}</div>
    </div>`;

    html += breakdownBar(record);

    html += `<div class="hud-grid hud-grid--6 animate-in stagger-1">
      ${hud(stats.balls, "Balls", "var(--text-muted)", "148,163,184")}
      ${hud(stats.runs, "Runs", "var(--green)", "16,185,129")}
      ${hud(stats.outs, "Dismissed", "var(--red)", "239,68,68")}
      ${hud(stats.strikeRate, "Strike Rate", "var(--blue)", "59,130,246")}
      ${hud(stats.average ?? "—", "Average", "var(--orange)", "245,158,11")}
      ${hud(stats.dots, "Dot Balls", "var(--text-dim)", "71,85,105")}
    </div>`;

    html += `<div class="hud-grid hud-grid--4 animate-in stagger-2" style="margin-top:0.75rem;">
      ${hud(stats.fours, "Fours", "var(--green)", "16,185,129")}
      ${hud(stats.sixes, "Sixes", "var(--purple)", "168,85,247")}
      ${hud(stats.boundaries, "Boundaries", "var(--gold)", "255,215,0")}
      ${hud(stats.dotPct + "%", "Dot Ball %", "var(--text-dim)", "71,85,105")}
    </div>`;

    const encounters = filter.codes
      .flatMap(code => (innings[code] || []).map(inn => ({ ...inn, competition: COMPETITION_NAMES[code] })))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    if (encounters.length) {
      const rows = encounters.map(inn =>
        innRow(inn).replace('class="inn-row__score">',
          `class="inn-row__score"><span class="comp-tag">${inn.competition}</span> `)
      );
      html += `<div class="section-title animate-in stagger-3" style="margin-top:1.5rem;">
        📋 Innings Breakdown (${encounters.length} encounters)</div>`;
      html += rows.slice(0, 8).join("");
      if (rows.length > 8) {
        html += collapse(`📋 View all ${rows.length} encounters`, rows.slice(8).join(""));
      }
    }

    html += verdict(stats, batter, bowler);
    output.innerHTML = html;
  }

  /* A small strip showing how the matchup splits across competitions, so it is
     obvious which filters have anything in them. */
  function breakdownBar(perCompetition) {
    if (!perCompetition) return "";
    const parts = Object.entries(COMPETITION_NAMES)
      .filter(([code]) => perCompetition[code])
      .map(([code, name]) => {
        const s = toStats(perCompetition[code]);
        return `<span class="split-pill"><strong>${name}</strong> ${s.runs}(${s.balls})
          · ${s.outs} out</span>`;
      });
    if (!parts.length) return "";
    return `<div class="split-row animate-in">${parts.join("")}</div>`;
  }
}

function verdict(stats, batter, bowler) {
  if (stats.balls < 12) return "";
  if (stats.outs >= 3 && stats.strikeRate < 110) {
    return `<div class="card animate-in verdict verdict--bowler">
      <strong>Verdict:</strong> ⚾ <strong>${escapeHtml(bowler)}</strong> holds the edge —
      ${stats.outs} dismissals at a strike rate of ${stats.strikeRate}</div>`;
  }
  if (stats.outs === 0 && stats.strikeRate > 140) {
    return `<div class="card animate-in verdict verdict--batter">
      <strong>Verdict:</strong> 🏏 <strong>${escapeHtml(batter)}</strong> holds the edge —
      ${stats.runs} runs at a strike rate of ${stats.strikeRate}, never dismissed</div>`;
  }
  return "";
}
