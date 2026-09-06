/* Competition and season filters.

   The data files store every stat split by competition using a one-letter code:
     p = IPL     t = Test     o = ODI     i = T20I

   A competition filter is just a list of those codes, so "International" and
   "All Combined" are worked out in the browser by adding the parts together.

   Batter records go one level finer: each competition holds one row per year,
     [year, balls, runs, dismissals, dots, fours, sixes, runs won, runs lost]
   with batter-vs-team rows carrying matches on the end. That lets the season
   filter add up whichever years the reader picked. */

export const FILTERS = [
  { id: "all",  label: "All Combined",  short: "All",   codes: ["p", "t", "o", "i"] },
  { id: "intl", label: "International", short: "Intl",  codes: ["t", "o", "i"] },
  { id: "ipl",  label: "IPL",           short: "IPL",   codes: ["p"] },
  { id: "test", label: "Test",          short: "Test",  codes: ["t"] },
  { id: "odi",  label: "ODI",           short: "ODI",   codes: ["o"] },
  { id: "t20i", label: "T20I",          short: "T20I",  codes: ["i"] },
];

export const DEFAULT_FILTER = "all";

export function filterById(id) {
  return FILTERS.find(f => f.id === id) || FILTERS[0];
}

/* Where each number sits inside a year row. */
const YEAR = 0, BALLS = 1, RUNS = 2, OUTS = 3, DOTS = 4,
      FOURS = 5, SIXES = 6, RUNS_WON = 7, RUNS_LOST = 8, MATCHES = 9;

/* ─── Career totals (the Bowler Strengths files, which have no year rows) ─── */

/* Add up the per-competition numbers a filter covers.
   Returns null when the player has nothing in any of those competitions. */
export function combine(perCompetition, codes) {
  if (!perCompetition) return null;
  let total = null;
  for (const code of codes) {
    const numbers = perCompetition[code];
    if (!numbers) continue;
    if (!total) total = numbers.slice();
    else for (let i = 0; i < total.length; i++) total[i] += numbers[i] || 0;
  }
  return total;
}

/* Turn a [balls, runs, dismissals, dots, fours, sixes] list into named stats.
   These files carry no win/loss split, so those come back as zero. */
export function toStats(numbers) {
  if (!numbers) return null;
  const [balls, runs, outs, dots, fours, sixes] = numbers;
  return derive({ balls, runs, outs, dots, fours, sixes, matches: 0, runsWon: 0, runsLost: 0 });
}

/* Every opponent in a career-total file, for the Bowler Strengths page. */
export function statsByOpponentCareer(opponentMap, codes) {
  const out = [];
  for (const [opponent, perCompetition] of Object.entries(opponentMap || {})) {
    const stats = toStats(combine(perCompetition, codes));
    if (stats && stats.balls > 0) out.push({ opponent, ...stats });
  }
  return out;
}

/* ─── Year rows (the batter files) ────────────────────────────────────────── */

/* Every year a batter has a record in, across the chosen competitions. */
export function seasonsAvailable(opponentMap, codes) {
  const years = new Set();
  for (const perCompetition of Object.values(opponentMap || {})) {
    for (const code of codes) {
      for (const row of perCompetition[code] || []) {
        if (row[YEAR] > 0) years.add(row[YEAR]);
      }
    }
  }
  return [...years].sort((a, b) => a - b);
}

/* Add up the year rows a competition filter and season range cover, and work
   out the derived stats. A null season range means every year. */
export function combineYears(perCompetition, codes, season) {
  if (!perCompetition) return null;
  const from = season?.from ?? -Infinity;
  const to = season?.to ?? Infinity;

  let found = false;
  const total = { balls: 0, runs: 0, outs: 0, dots: 0, fours: 0, sixes: 0,
                  runsWon: 0, runsLost: 0, matches: 0 };

  for (const code of codes) {
    for (const row of perCompetition[code] || []) {
      if (row[YEAR] < from || row[YEAR] > to) continue;
      found = true;
      total.balls += row[BALLS];
      total.runs += row[RUNS];
      total.outs += row[OUTS];
      total.dots += row[DOTS];
      total.fours += row[FOURS];
      total.sixes += row[SIXES];
      total.runsWon += row[RUNS_WON];
      total.runsLost += row[RUNS_LOST];
      total.matches += row[MATCHES] || 0;
    }
  }
  return found ? derive(total) : null;
}

/* Everything derived from the raw counts, so the tables and sorts share it. */
function derive(total) {
  const { balls, runs, outs, fours, sixes, dots } = total;
  return {
    ...total,
    boundaries: fours + sixes,
    strikeRate: balls ? +(runs / balls * 100).toFixed(1) : 0,
    average: outs ? +(runs / outs).toFixed(1) : null,
    ballsPerOut: outs ? +(balls / outs).toFixed(1) : null,
    dotPct: balls ? +(dots / balls * 100).toFixed(1) : 0,
    /* Runs in matches that ended in a draw, tie or no result — whatever the
       win and loss columns do not account for. */
    runsDrawn: runs - total.runsWon - total.runsLost,
  };
}

/* Every opponent (bowler name or team id) a batter has faced, with the chosen
   competitions and seasons already added together. */
export function statsByOpponent(opponentMap, codes, season) {
  const out = [];
  for (const [opponent, perCompetition] of Object.entries(opponentMap || {})) {
    const stats = combineYears(perCompetition, codes, season);
    if (stats && stats.balls > 0) out.push({ opponent, ...stats });
  }
  return out;
}
