/* Bowling Leaders — every bowler's career totals, ranked by wickets.

   Read from the bowling side: balls bowled, runs conceded, wickets taken,
   which makes Avg the bowling average and SR the bowling strike rate. */

import * as store from "../store.js";
import {
  makeLeaderboardPage, rankColumn, opponentColumn, numberColumn,
  SORT_BY_WICKETS, SORT_BY_DOTS, SORT_BY_BALLS, SORT_BY_CAREER_ECONOMY_LOW,
} from "../ranking.js";

const page = makeLeaderboardPage({
  route: "bowlingleaders",
  icon: "🥇",
  title: "Bowling Leaders",
  subtitle: "Career wickets across every match in the data",
  subject: "bowling records",
  load: () => store.bowlingLeaders(),
  // Someone who has bowled but never taken a wicket does not belong on a
  // wickets leaderboard.
  keepRow: row => row.outs > 0,
  sorts: [SORT_BY_WICKETS, SORT_BY_DOTS, SORT_BY_BALLS, SORT_BY_CAREER_ECONOMY_LOW],
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
