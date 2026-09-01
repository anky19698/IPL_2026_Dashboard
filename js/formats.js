/* Competition filters.

   The data files store every stat split by competition using a one-letter code:
     p = IPL     t = Test     o = ODI     i = T20I

   A filter is just a list of those codes, so "International" and "All Combined"
   are worked out in the browser by adding the parts together. */

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

/* Turn the raw number list into named stats.

   Batter-vs-bowler rows are [balls, runs, outs, dots, fours, sixes]
   Batter-vs-team rows add a seventh number: matches played. */
export function toStats(numbers) {
  if (!numbers) return null;
  const [balls, runs, outs, dots, fours, sixes, matches] = numbers;
  return {
    balls, runs, outs, dots, fours, sixes,
    matches: matches ?? 0,
    boundaries: fours + sixes,
    strikeRate: balls ? +(runs / balls * 100).toFixed(1) : 0,
    average: outs ? +(runs / outs).toFixed(1) : null,
    ballsPerOut: outs ? +(balls / outs).toFixed(1) : null,
    dotPct: balls ? +(dots / balls * 100).toFixed(1) : 0,
  };
}

/* Every opponent (bowler name or team id) a batter has faced, with the
   selected competitions already added together. */
export function statsByOpponent(opponentMap, codes) {
  const out = [];
  for (const [opponent, perCompetition] of Object.entries(opponentMap || {})) {
    const stats = toStats(combine(perCompetition, codes));
    if (stats && stats.balls > 0) out.push({ opponent, ...stats });
  }
  return out;
}
