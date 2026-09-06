/* Batter Strengths — which bowlers a batter scores most freely against. */

import {
  makeBatterRankingPage, rankColumn, opponentColumn, numberColumn,
  RUNS_WON_COLUMN, RUNS_LOST_COLUMN,
  SORT_BY_RUNS, SORT_BY_SIXES, SORT_BY_FOURS, SORT_BY_BOUNDARIES,
  SORT_BY_RUNS_WON, SORT_BY_RUNS_LOST,
} from "../ranking.js";

const page = makeBatterRankingPage({
  route: "strengths",
  icon: "💪",
  title: "Batter Strengths",
  subtitle: "Pick a batter to rank the bowlers they score most against",
  subject: "bowlers faced",
  source: "b",
  sorts: [SORT_BY_RUNS, SORT_BY_SIXES, SORT_BY_FOURS, SORT_BY_BOUNDARIES,
          SORT_BY_RUNS_WON, SORT_BY_RUNS_LOST],
  columns: () => [
    rankColumn,
    opponentColumn("Bowler", "⚾"),
    numberColumn("Runs", r => r.runs, { strong: true, color: "var(--gold)" }),
    RUNS_WON_COLUMN,
    RUNS_LOST_COLUMN,
    numberColumn("Balls", r => r.balls),
    numberColumn("SR", r => r.strikeRate),
    numberColumn("4s", r => r.fours),
    numberColumn("6s", r => r.sixes),
    numberColumn("4s+6s", r => r.boundaries, { strong: true, color: "var(--purple)" }),
    numberColumn("Out", r => r.outs),
    numberColumn("Avg", r => r.average),
  ],
});

export const render = page.render;
