/* Batter Weakness — the bowlers who have dismissed a batter most often. */

import {
  makeBatterRankingPage, rankColumn, opponentColumn, numberColumn,
  RUNS_WON_COLUMN, RUNS_LOST_COLUMN,
  SORT_BY_OUTS, SORT_BY_BALLS_PER_OUT, SORT_BY_STRIKE_RATE_LOW, SORT_BY_DOTS,
  SORT_BY_RUNS_WON, SORT_BY_RUNS_LOST,
} from "../ranking.js";

const page = makeBatterRankingPage({
  route: "weakness",
  icon: "🎯",
  title: "Batter Weakness",
  subtitle: "Pick a batter to rank the bowlers who get them out most",
  subject: "dismissals",
  source: "b",
  sorts: [SORT_BY_OUTS, SORT_BY_BALLS_PER_OUT, SORT_BY_STRIKE_RATE_LOW, SORT_BY_DOTS,
          SORT_BY_RUNS_WON, SORT_BY_RUNS_LOST],
  // A bowler who has never got this batter out is not a weakness, so leave
  // them out of the table whichever way it is sorted.
  keepRow: row => row.outs > 0,
  columns: () => [
    rankColumn,
    opponentColumn("Bowler", "⚾"),
    numberColumn("Out", r => r.outs, { strong: true, color: "var(--red)" }),
    numberColumn("Balls", r => r.balls),
    numberColumn("Runs", r => r.runs),
    RUNS_WON_COLUMN,
    RUNS_LOST_COLUMN,
    numberColumn("SR", r => r.strikeRate),
    numberColumn("Avg", r => r.average),
    numberColumn("Balls/Out", r => r.ballsPerOut, { strong: true, color: "var(--orange)" }),
    numberColumn("Dots", r => r.dots),
    numberColumn("Dot %", r => r.dotPct, { suffix: "%" }),
  ],
});

export const render = page.render;
