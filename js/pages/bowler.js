/* Bowler Strengths — the batters a bowler gets out most, per competition. */

import * as store from "../store.js";
import { DEFAULT_FILTER, filterById, statsByOpponent } from "../formats.js";
import {
  pageHeader, searchBox, wireSearchBox, competitionChips, chipRow, onChipPick,
  rankTable, emptyState, escapeHtml,
} from "../ui.js";

const ROWS_TO_SHOW = 10;

const SORTS = [
  { id: "outs",  label: "Dismissals", compare: (a, b) => b.outs - a.outs || b.balls - a.balls },
  { id: "dots",  label: "Dot balls",  compare: (a, b) => b.dots - a.dots || b.balls - a.balls },
  { id: "balls", label: "Balls bowled", compare: (a, b) => b.balls - a.balls },
  { id: "econ",  label: "Strike rate conceded (lowest)",
    compare: (a, b) => a.strikeRate - b.strikeRate || b.balls - a.balls,
    needs: r => r.balls >= 18, note: "min 18 balls" },
];

export async function render(el, params) {
  const index = await store.bowlerIndex();
  const bowlerNames = Object.keys(index);

  let bowler = params ? decodeURIComponent(params) : "";
  let competition = DEFAULT_FILTER;
  let sortId = SORTS[0].id;
  let showAll = false;
  let record = null;

  el.innerHTML = `
    ${pageHeader("⚾", "Bowler Strengths", "Pick a bowler to rank the batters they dominate")}
    <div class="picker-row">${searchBox("bowlPick", "Search a bowler…", "⚾")}</div>
    ${competitionChips(competition)}
    ${chipRow("sort", SORTS, sortId, "Sort by")}
    <div id="bowlResult"></div>`;

  const output = document.getElementById("bowlResult");

  wireSearchBox("bowlPick", bowlerNames, name => {
    bowler = name;
    window.history.replaceState(null, "", `#bowler/${encodeURIComponent(name)}`);
    loadBowler();
  });

  onChipPick(el, "competition", value => { competition = value; showAll = false; paint(); });
  onChipPick(el, "sort", value => { sortId = value; showAll = false; paint(); });

  async function loadBowler() {
    output.innerHTML = `<div class="loader"><div class="loader__spinner"></div><p>Loading ${escapeHtml(bowler)}…</p></div>`;
    try {
      record = await store.bowlerRecord(bowler);
    } catch {
      output.innerHTML = emptyState("⚠️", "Could not load this bowler's data.");
      return;
    }
    showAll = false;
    paint();
  }

  function paint() {
    if (!bowler) {
      output.innerHTML = emptyState("⚾", "Search for a bowler above to see who they dominate");
      return;
    }
    const filter = filterById(competition);
    const sort = SORTS.find(s => s.id === sortId) || SORTS[0];
    let rows = statsByOpponent(record?.b, filter.codes).filter(r => r.outs > 0);
    if (sort.needs) rows = rows.filter(sort.needs);
    rows.sort(sort.compare);

    if (!rows.length) {
      output.innerHTML = emptyState("🚫",
        `<strong>${escapeHtml(bowler)}</strong> has no dismissals in <strong>${filter.label}</strong>`);
      return;
    }

    const shown = showAll ? rows : rows.slice(0, ROWS_TO_SHOW);
    const columns = [
      { label: "#", align: "left", cell: (_r, i) => `<span class="rank-num">${i + 1}</span>` },
      { label: "Batter", align: "left", cell: r => `<span class="opp-cell">🏏 ${escapeHtml(r.opponent)}</span>` },
      { label: "Out", cell: r => `<strong style="color:var(--red);">${r.outs}</strong>` },
      { label: "Balls", cell: r => r.balls },
      { label: "Runs", cell: r => r.runs },
      { label: "SR", cell: r => r.strikeRate },
      { label: "Avg", cell: r => r.average ?? `<span class="dim">—</span>` },
      { label: "Balls/Out", cell: r => r.ballsPerOut ?? `<span class="dim">—</span>` },
      { label: "Dots", cell: r => r.dots },
      { label: "Dot %", cell: r => `${r.dotPct}%` },
    ];

    let html = `<div class="rank-summary animate-in">
      <span class="rank-summary__name">⚾ ${escapeHtml(bowler)}</span>
      <span class="rank-summary__meta">${filter.label} · sorted by ${escapeHtml(sort.label)}
        · showing ${shown.length} of ${rows.length}${sort.note ? ` · ${escapeHtml(sort.note)}` : ""}</span>
    </div>`;
    html += rankTable(columns, shown);

    if (rows.length > ROWS_TO_SHOW) {
      html += `<div style="text-align:center; margin-top:1rem;">
        <button class="btn btn--outline" id="bowlToggle">
          ${showAll ? `Show top ${ROWS_TO_SHOW} only` : `Show all ${rows.length}`}
        </button></div>`;
    }

    output.innerHTML = html;
    document.getElementById("bowlToggle")?.addEventListener("click", () => {
      showAll = !showAll;
      paint();
    });
  }

  if (bowler && index[bowler] !== undefined) {
    document.getElementById("bowlPick").value = bowler;
    await loadBowler();
  } else {
    bowler = "";
    paint();
  }
}
