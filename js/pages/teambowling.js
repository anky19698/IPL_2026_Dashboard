/* Team Weakness — Bowling: the bowlers who take most wickets against a team.

   Every number here is read from the bowling side: balls bowled, runs
   conceded, wickets taken. That makes Avg the bowling average and SR the
   bowling strike rate — balls per wicket. */

import {
  makeTeamRankingPage, rankColumn, opponentColumn, numberColumn,
  SORT_BY_WICKETS, SORT_BY_DOTS, SORT_BY_BALLS, SORT_BY_ECONOMY_LOW,
} from "../ranking.js";

const page = makeTeamRankingPage({
  route: "teambowling",
  side: "bowling",
  icon: "🧨",
  title: "Team Weakness — Bowling",
  subtitle: "Pick a team to rank the bowlers who take most wickets against them",
  subject: "bowling records",
  // A bowler who has never taken a wicket against them is not a weakness.
  keepRow: row => row.outs > 0,
  sorts: [SORT_BY_WICKETS, SORT_BY_DOTS, SORT_BY_BALLS, SORT_BY_ECONOMY_LOW],
  columns: () => [
    rankColumn,
    opponentColumn("Bowler", "⚾"),
    numberColumn("Mat", r => r.matches),
    numberColumn("Wkts", r => r.outs, { strong: true, color: "var(--red)" }),
    numberColumn("Balls", r => r.balls),
    numberColumn("Runs", r => r.runs),
    numberColumn("Econ", r => r.economy, { strong: true, color: "var(--orange)" }),
    numberColumn("Avg", r => r.average),
    numberColumn("SR", r => r.ballsPerOut),
    numberColumn("Dots", r => r.dots),
    numberColumn("Dot %", r => r.dotPct, { suffix: "%" }),
  ],
});

export const render = page.render;
