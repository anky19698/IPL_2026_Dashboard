/* Batter vs Teams — which opposition a batter scores most against. */

import {
  makeBatterRankingPage, rankColumn, teamColumn, numberColumn,
  SORT_BY_RUNS, SORT_BY_SIXES, SORT_BY_FOURS, SORT_BY_BOUNDARIES,
} from "../ranking.js";

const page = makeBatterRankingPage({
  route: "batterteams",
  icon: "🛡",
  title: "Batter Strengths vs Teams",
  subtitle: "Pick a batter to rank the teams they score most against",
  subject: "team records",
  source: "t",
  sorts: [SORT_BY_RUNS, SORT_BY_SIXES, SORT_BY_FOURS, SORT_BY_BOUNDARIES],
  columns: teams => [
    rankColumn,
    teamColumn(teams),
    numberColumn("Mat", r => r.matches),
    numberColumn("Runs", r => r.runs, { strong: true, color: "var(--green)" }),
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
