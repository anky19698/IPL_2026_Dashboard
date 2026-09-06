/* Shared "pick a batter, get a ranked table" page.

   Batter Strengths, Batter Weakness and Batter vs Teams are the same page with
   a different source list, sort options and columns, so they all come from
   here. Each of those page files just hands over its settings. */

import * as store from "./store.js";
import { DEFAULT_FILTER, filterById, statsByOpponent, seasonsAvailable } from "./formats.js";
import {
  pageHeader, searchBox, wireSearchBox, competitionChips, chipRow, onChipPick,
  seasonPicker, wireSeasonPicker, describeSeason,
  rankTable, emptyState, escapeHtml, teamCell,
} from "./ui.js";

export const ROWS_TO_SHOW = 10;

export function makeBatterRankingPage(settings) {
  return {
    async render(el, params) {
      const [index, teams] = await Promise.all([store.batterIndex(), store.teams()]);
      const batterNames = Object.keys(index);

      let batter = params ? decodeURIComponent(params) : "";
      let competition = DEFAULT_FILTER;
      let sortId = settings.sorts[0].id;
      let showAll = false;
      let record = null;
      let years = [];
      let season = null;

      el.innerHTML = `
        ${pageHeader(settings.icon, settings.title, settings.subtitle)}
        <div class="picker-row">
          ${searchBox("rankBatter", "Search a batter…", "🏏")}
        </div>
        ${competitionChips(competition)}
        <div id="rankSeason"></div>
        ${chipRow("sort", settings.sorts, sortId, "Sort by")}
        <div id="rankResult"></div>`;

      wireSearchBox("rankBatter", batterNames, name => {
        batter = name;
        window.history.replaceState(null, "", `#${settings.route}/${encodeURIComponent(name)}`);
        loadBatter();
      });

      onChipPick(el, "competition", value => {
        competition = value;
        showAll = false;
        refreshSeasons();
        paint();
      });
      onChipPick(el, "sort", value => { sortId = value; showAll = false; paint(); });

      const output = document.getElementById("rankResult");
      const seasonSlot = document.getElementById("rankSeason");

      async function loadBatter() {
        if (!batter) { output.innerHTML = startPrompt(); return; }
        output.innerHTML = `<div class="loader"><div class="loader__spinner"></div><p>Loading ${escapeHtml(batter)}…</p></div>`;
        try {
          record = await store.batterRecord(batter);
        } catch {
          output.innerHTML = emptyState("⚠️", "Could not load this batter's data.");
          return;
        }
        showAll = false;
        refreshSeasons();
        paint();
      }

      /* The year list follows whichever batter and competition are showing, so
         you are only ever offered seasons that actually have something in them.
         An existing pick is kept where it still fits and widened where it does
         not, rather than silently emptying the table. */
      function refreshSeasons() {
        years = record ? seasonsAvailable(record[settings.source], filterById(competition).codes) : [];
        if (!years.length) {
          season = null;
          seasonSlot.innerHTML = "";
          return;
        }
        const first = years[0], last = years[years.length - 1];
        const from = Math.min(Math.max(season?.from ?? first, first), last);
        const to = Math.min(Math.max(season?.to ?? last, first), last);
        season = { from: Math.min(from, to), to: Math.max(from, to) };
        drawSeasonPicker();
      }

      /* Draw the picker and wire it up. Picking a year redraws it so the two
         selects show the clamped span, which means wiring it again. */
      function drawSeasonPicker() {
        seasonSlot.innerHTML = seasonPicker(years, season.from, season.to);
        wireSeasonPicker(seasonSlot, years, season, picked => {
          season = picked;
          showAll = false;
          drawSeasonPicker();
          paint();
        });
      }

      function startPrompt() {
        return `<div class="empty"><div class="empty__icon">${settings.icon}</div>
          <div class="empty__text">Search for a batter above to see ${escapeHtml(settings.subject)}</div></div>`;
      }

      function paint() {
        if (!batter) { output.innerHTML = startPrompt(); return; }
        if (!record) {
          output.innerHTML = emptyState("🚫", `No data found for <strong>${escapeHtml(batter)}</strong>`);
          return;
        }

        const filter = filterById(competition);
        const sort = settings.sorts.find(s => s.id === sortId) || settings.sorts[0];
        const spanLabel = describeSeason(years, season);

        let rows = statsByOpponent(record[settings.source], filter.codes, season);
        if (settings.keepRow) rows = rows.filter(settings.keepRow);
        if (sort.needs) rows = rows.filter(sort.needs);
        rows.sort(sort.compare);

        if (!rows.length) {
          output.innerHTML = emptyState("🚫",
            `<strong>${escapeHtml(batter)}</strong> has no ${escapeHtml(settings.subject)}
             in <strong>${filter.label}</strong> for <strong>${escapeHtml(spanLabel)}</strong>`);
          return;
        }

        const shown = showAll ? rows : rows.slice(0, ROWS_TO_SHOW);
        const columns = settings.columns(teams);

        let html = `<div class="rank-summary animate-in">
          <span class="rank-summary__name">🏏 ${escapeHtml(batter)}</span>
          <span class="rank-summary__meta">${filter.label} · ${escapeHtml(spanLabel)}
            · sorted by ${escapeHtml(sort.label)}
            · showing ${shown.length} of ${rows.length}${sort.note ? ` · ${escapeHtml(sort.note)}` : ""}</span>
        </div>`;

        html += rankTable(columns, shown);

        if (rows.some(row => row.runsDrawn > 0)) {
          html += `<p class="table-note">Runs (W) and Runs (L) are runs made in matches
            this batter's own team won or lost. Draws, ties and no-results count in
            neither, so the two do not always add up to the total.</p>`;
        }

        if (rows.length > ROWS_TO_SHOW) {
          html += `<div style="text-align:center; margin-top:1rem;">
            <button class="btn btn--outline" id="rankToggle">
              ${showAll ? `Show top ${ROWS_TO_SHOW} only` : `Show all ${rows.length}`}
            </button></div>`;
        }

        output.innerHTML = html;
        document.getElementById("rankToggle")?.addEventListener("click", () => {
          showAll = !showAll;
          paint();
        });
      }

      if (batter && index[batter] !== undefined) {
        document.getElementById("rankBatter").value = batter;
        await loadBatter();
      } else {
        batter = "";
        output.innerHTML = startPrompt();
      }
    },
  };
}

/* ─── Column and sort building blocks the three pages share ───────────────── */

export const opponentColumn = (label, icon) => ({
  label, align: "left",
  cell: row => `<span class="opp-cell">${icon} ${escapeHtml(row.opponent)}</span>`,
});

export const teamColumn = teams => ({
  label: "Team", align: "left",
  cell: row => teamCell(row.opponent, teams),
});

export const rankColumn = {
  label: "#", align: "left",
  cell: (_row, index) => `<span class="rank-num">${index + 1}</span>`,
};

export const numberColumn = (label, pick, options = {}) => ({
  label,
  cell: row => {
    const value = pick(row);
    if (value === null || value === undefined) return `<span class="dim">—</span>`;
    const text = options.suffix ? `${value}${options.suffix}` : value;
    return options.strong ? `<strong style="color:${options.color || "var(--gold)"};">${text}</strong>` : text;
  },
});

/* Runs made in matches the batter's team won, and lost. Shared by all three
   batter pages so the columns read the same everywhere. */
export const RUNS_WON_COLUMN = numberColumn("Runs (W)", r => r.runsWon,
  { strong: true, color: "var(--green)" });
export const RUNS_LOST_COLUMN = numberColumn("Runs (L)", r => r.runsLost,
  { strong: true, color: "var(--red)" });

/* Sorts are "biggest first" unless the name says otherwise. Ties fall back to
   more runs, then more balls, so the order never jumps around at random. */
function biggestFirst(pick) {
  return (a, b) => (pick(b) - pick(a)) || (b.runs - a.runs) || (b.balls - a.balls);
}

function smallestFirst(pick) {
  return (a, b) => {
    const left = pick(a), right = pick(b);
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) || (b.outs - a.outs) || (b.balls - a.balls);
  };
}

export const SORT_BY_RUNS       = { id: "runs",       label: "Runs",              compare: biggestFirst(r => r.runs) };
export const SORT_BY_SIXES      = { id: "sixes",      label: "Sixes hit",         compare: biggestFirst(r => r.sixes) };
export const SORT_BY_FOURS      = { id: "fours",      label: "Fours hit",         compare: biggestFirst(r => r.fours) };
export const SORT_BY_BOUNDARIES = { id: "boundaries", label: "Boundaries (4s+6s)", compare: biggestFirst(r => r.boundaries) };
export const SORT_BY_OUTS       = { id: "outs",       label: "Dismissals",        compare: biggestFirst(r => r.outs) };
export const SORT_BY_DOTS       = { id: "dots",       label: "Dot balls",         compare: biggestFirst(r => r.dots) };
export const SORT_BY_RUNS_WON   = { id: "runswon",    label: "Runs in a win",     compare: biggestFirst(r => r.runsWon) };
export const SORT_BY_RUNS_LOST  = { id: "runslost",   label: "Runs in a loss",    compare: biggestFirst(r => r.runsLost) };
export const SORT_BY_BALLS_PER_OUT = {
  id: "bpd", label: "Balls per dismissal (lowest)", compare: smallestFirst(r => r.ballsPerOut),
  needs: r => r.balls >= 18 && r.outs >= 2, note: "min 18 balls & 2 dismissals",
};
export const SORT_BY_STRIKE_RATE_LOW = {
  id: "srlow", label: "Strike rate (lowest)", compare: smallestFirst(r => r.strikeRate),
  needs: r => r.balls >= 18, note: "min 18 balls",
};
