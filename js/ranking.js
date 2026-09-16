/* Shared "pick something, get a ranked table" page.

   Five pages are this same page with a different thing to pick, a different
   list to rank, and different columns:

     Batter Strengths / Weakness / vs Teams — pick a batter
     Team Weakness (Batting / Bowling)      — pick a team
     Batting / Bowling Leaders              — pick nothing, rank everyone

   The three make*Page helpers below fill in the parts that differ, so each
   page file only has to describe its columns and sorts. */

import * as store from "./store.js";
import { DEFAULT_FILTER, filterById, statsByOpponent, seasonsAvailable } from "./formats.js";
import {
  pageHeader, searchBox, wireSearchBox, competitionChips, chipRow, onChipPick,
  seasonPicker, wireSeasonPicker, describeSeason,
  rankTable, emptyState, escapeHtml, teamCell,
} from "./ui.js";

export const ROWS_TO_SHOW = 10;

function makeRankingPage(settings) {
  return {
    async render(el, params) {
      const teams = await store.teams();

      /* A leaderboard ranks everybody at once, so it has nothing to pick and
         no search box. Every other page picks a batter or a team first. */
      const hasPicker = Boolean(settings.pickList);
      const { labels, keyOf } = hasPicker
        ? await settings.pickList(teams)
        : { labels: [], keyOf: null };

      /* What the reader typed vs what the data file is keyed by. For batters
         these are the same; for teams the reader sees "India" and the file is
         keyed by the team id. */
      const keyFor = label => (keyOf ? keyOf[label] : label);

      let chosen = hasPicker ? "" : settings.title;
      if (params && hasPicker) {
        const wanted = decodeURIComponent(params);
        if (labels.includes(wanted)) chosen = wanted;
      }
      let competition = DEFAULT_FILTER;
      let sortId = settings.sorts[0].id;
      let showAll = false;
      let record = null;
      let years = [];
      let season = null;
      /* Whether the reader has actually chosen a season. Until they do, the
         range follows whatever is on screen instead of sticking. */
      let seasonChosen = false;

      el.innerHTML = `
        ${pageHeader(settings.icon, settings.title, settings.subtitle)}
        ${hasPicker ? `<div class="picker-row">
          ${searchBox("rankPick", settings.searchPlaceholder, settings.searchIcon)}
        </div>` : ""}
        ${competitionChips(competition)}
        <div id="rankSeason"></div>
        ${chipRow("sort", settings.sorts, sortId, "Sort by")}
        <div id="rankResult"></div>`;

      if (hasPicker) {
        wireSearchBox("rankPick", labels, label => {
          chosen = label;
          window.history.replaceState(null, "", `#${settings.route}/${encodeURIComponent(label)}`);
          loadChosen();
        });
      }

      onChipPick(el, "competition", value => {
        competition = value;
        showAll = false;
        refreshSeasons();
        paint();
      });
      onChipPick(el, "sort", value => { sortId = value; showAll = false; paint(); });

      const output = document.getElementById("rankResult");
      const seasonSlot = document.getElementById("rankSeason");

      async function loadChosen() {
        if (!chosen) { output.innerHTML = startPrompt(); return; }
        output.innerHTML = `<div class="loader"><div class="loader__spinner"></div>
          <p>Loading ${escapeHtml(chosen)}…</p></div>`;
        try {
          record = await settings.loadRecord(keyFor(chosen));
        } catch {
          output.innerHTML = emptyState("⚠️", "Could not load this data.");
          return;
        }
        showAll = false;
        refreshSeasons();
        paint();
      }

      function opponents() {
        return record ? settings.opponentsOf(record, settings.source) : null;
      }

      /* The year list follows whatever is showing, so you are only ever offered
         seasons that actually have something in them.

         If the reader has not picked a season, the range opens out to whatever
         the current competition covers. Switching from IPL to Test should not
         quietly leave the range stuck at the IPL years and hide the earlier
         Tests. Once they have picked, the pick is kept wherever it still fits
         and clamped where it does not. */
      function refreshSeasons() {
        years = record ? seasonsAvailable(opponents(), filterById(competition).codes) : [];
        if (!years.length) {
          season = null;
          seasonSlot.innerHTML = "";
          return;
        }
        const first = years[0], last = years[years.length - 1];
        if (!seasonChosen || !season) {
          season = { from: first, to: last };
        } else {
          const from = Math.min(Math.max(season.from, first), last);
          const to = Math.min(Math.max(season.to, first), last);
          season = { from: Math.min(from, to), to: Math.max(from, to) };
        }
        drawSeasonPicker();
      }

      /* Drawing the picker replaces its markup, so wire it up again each time. */
      function drawSeasonPicker() {
        seasonSlot.innerHTML = seasonPicker(years, season.from, season.to);
        wireSeasonPicker(seasonSlot, years, season, picked => {
          season = picked;
          /* Going back to the whole span counts as not having picked, so the
             range starts following the competition again. */
          seasonChosen = !(picked.from === years[0] && picked.to === years[years.length - 1]);
          showAll = false;
          drawSeasonPicker();
          paint();
        });
      }

      function startPrompt() {
        return `<div class="empty"><div class="empty__icon">${settings.icon}</div>
          <div class="empty__text">${escapeHtml(settings.prompt)}</div></div>`;
      }

      function paint() {
        if (!chosen) { output.innerHTML = startPrompt(); return; }
        if (!record) {
          output.innerHTML = emptyState("🚫", `No data found for <strong>${escapeHtml(chosen)}</strong>`);
          return;
        }

        const filter = filterById(competition);
        const sort = settings.sorts.find(s => s.id === sortId) || settings.sorts[0];
        const spanLabel = describeSeason(years, season);

        let rows = statsByOpponent(opponents(), filter.codes, season);
        if (settings.keepRow) rows = rows.filter(settings.keepRow);
        if (sort.needs) rows = rows.filter(sort.needs);
        rows.sort(sort.compare);

        if (!rows.length) {
          output.innerHTML = emptyState("🚫",
            `<strong>${escapeHtml(chosen)}</strong> has no ${escapeHtml(settings.subject)}
             in <strong>${filter.label}</strong> for <strong>${escapeHtml(spanLabel)}</strong>`);
          return;
        }

        const shown = showAll ? rows : rows.slice(0, ROWS_TO_SHOW);
        const columns = settings.columns(teams);

        let html = `<div class="rank-summary animate-in">
          <span class="rank-summary__name">${settings.badge(keyFor(chosen), teams, chosen)}</span>
          <span class="rank-summary__meta">${filter.label} · ${escapeHtml(spanLabel)}
            · sorted by ${escapeHtml(sort.label)}
            · showing ${shown.length} of ${rows.length}${sort.note ? ` · ${escapeHtml(sort.note)}` : ""}</span>
        </div>`;

        html += rankTable(columns, shown);

        if (settings.explainWinLoss && rows.some(row => row.runsDrawn > 0)) {
          html += `<p class="table-note">Runs (W) and Runs (L) are runs made in matches
            the batter's own team won or lost. Draws, ties and no-results count in
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

      if (!hasPicker) {
        await loadChosen();
      } else if (chosen) {
        document.getElementById("rankPick").value = chosen;
        await loadChosen();
      } else {
        output.innerHTML = startPrompt();
      }
    },
  };
}

/* ─── Pick a batter ────────────────────────────────────────────────────────── */

export function makeBatterRankingPage(settings) {
  return makeRankingPage({
    ...settings,
    searchIcon: "🏏",
    searchPlaceholder: "Search a batter…",
    prompt: `Search for a batter above to see ${settings.subject}`,
    explainWinLoss: true,
    async pickList() {
      const index = await store.batterIndex();
      return { labels: Object.keys(index), keyOf: null };
    },
    loadRecord: name => store.batterRecord(name),
    opponentsOf: (record, source) => record[source],
    badge: (_key, _teams, label) => `🏏 ${escapeHtml(label)}`,
  });
}

/* ─── Pick a team ──────────────────────────────────────────────────────────── */

/* settings.side is "batting" (rank the batters who have scored against them)
   or "bowling" (rank the bowlers who have taken wickets against them). */
export function makeTeamRankingPage(settings) {
  return makeRankingPage({
    ...settings,
    searchIcon: "🛡",
    searchPlaceholder: "Search a team…",
    prompt: `Search for a team above to see ${settings.subject}`,
    async pickList(teams) {
      const index = await store.teamIndex();
      const keyOf = {};
      for (const teamId of Object.keys(index[settings.side] || {})) {
        keyOf[teams[teamId]?.name || teamId] = teamId;
      }
      return { labels: Object.keys(keyOf).sort((a, b) => a.localeCompare(b)), keyOf };
    },
    loadRecord: teamId => store.teamRecord(settings.side, teamId),
    /* A team file is already the map of player to their year rows. */
    opponentsOf: record => record,
    badge: (teamId, teams) => teamCell(teamId, teams),
  });
}

/* ─── Rank everyone (the leaderboards) ─────────────────────────────────────── */

/* No picker: the whole file is the list. settings.load says which one. */
export function makeLeaderboardPage(settings) {
  return makeRankingPage({
    ...settings,
    loadRecord: () => settings.load(),
    /* The file is already a map of player name to their year rows. */
    opponentsOf: record => record,
    badge: (_key, _teams, label) => `${settings.icon} ${escapeHtml(label)}`,
  });
}

/* ─── Column and sort building blocks the pages share ─────────────────────── */

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

/* Runs made in matches the batter's team won, and lost. Shared by the batter
   pages and the team batting page so the columns read the same everywhere. */
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
export const SORT_BY_WICKETS    = { id: "wickets",    label: "Wickets",           compare: biggestFirst(r => r.outs) };
export const SORT_BY_DOTS       = { id: "dots",       label: "Dot balls",         compare: biggestFirst(r => r.dots) };
export const SORT_BY_BALLS      = { id: "balls",      label: "Balls bowled",      compare: biggestFirst(r => r.balls) };
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
/* The career leaderboard needs a much higher floor than a single matchup does,
   or a bowler with two tidy overs to their name tops the list. */
export const SORT_BY_CAREER_ECONOMY_LOW = {
  id: "econlow", label: "Economy (lowest)", compare: smallestFirst(r => r.economy),
  needs: r => r.balls >= 3000, note: "min 500 overs",
};
export const SORT_BY_ECONOMY_LOW = {
  id: "econlow", label: "Economy (lowest)", compare: smallestFirst(r => r.economy),
  needs: r => r.balls >= 60, note: "min 10 overs",
};
