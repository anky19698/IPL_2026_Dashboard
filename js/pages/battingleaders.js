/* Batting Leaders — every batter's career totals, ranked. Not against anyone
   in particular: this is their whole record in the chosen competitions and
   seasons. */

import * as store from "../store.js";
import {
  makeLeaderboardPage, rankColumn, opponentColumn, numberColumn,
  RUNS_WON_COLUMN, RUNS_LOST_COLUMN,
  SORT_BY_RUNS, SORT_BY_SIXES, SORT_BY_FOURS, SORT_BY_BOUNDARIES,
  SORT_BY_RUNS_WON, SORT_BY_RUNS_LOST,
} from "../ranking.js";

const page = makeLeaderboardPage({
  route: "battingleaders",
  icon: "🏆",
  title: "Batting Leaders",
  subtitle: "Career runs across every match in the data",
  subject: "batting records",
  explainWinLoss: true,
  load: () => store.battingLeaders(),
  sorts: [SORT_BY_RUNS, SORT_BY_SIXES, SORT_BY_FOURS, SORT_BY_BOUNDARIES,
          SORT_BY_RUNS_WON, SORT_BY_RUNS_LOST],
  columns: () => [
    rankColumn,
    opponentColumn("Batter", "🏏"),
    numberColumn("Mat", r => r.matches),
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
