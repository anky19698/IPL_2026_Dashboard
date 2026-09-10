/* Team Weakness — Batting: the batters who score most against a chosen team. */

import {
  makeTeamRankingPage, rankColumn, opponentColumn, numberColumn,
  RUNS_WON_COLUMN, RUNS_LOST_COLUMN,
  SORT_BY_RUNS, SORT_BY_SIXES, SORT_BY_FOURS, SORT_BY_BOUNDARIES,
  SORT_BY_RUNS_WON, SORT_BY_RUNS_LOST,
} from "../ranking.js";

const page = makeTeamRankingPage({
  route: "teambatting",
  side: "batting",
  icon: "🩹",
  title: "Team Weakness — Batting",
  subtitle: "Pick a team to rank the batters who score most against them",
  subject: "batting records",
  explainWinLoss: true,
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
