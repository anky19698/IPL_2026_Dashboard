# Cricket Dashboard

A static dashboard for digging into batter and bowler matchups across the IPL
and men's international cricket, built from [CricSheet](https://cricsheet.org)
ball-by-ball data.

Every page can be filtered by competition:

| Filter | What it covers |
| --- | --- |
| All Combined | IPL + Test + ODI + T20I |
| International | Test + ODI + T20I |
| IPL | IPL only |
| Test / ODI / T20I | that format only |

The three batter pages, the two team pages and the two leaderboards add a
season filter on top of that. Pick a "from" and a
"to" year for a span, or set both to the same year for a single season; "All
years" puts it back to the whole career. Only years the batter actually has a
record in are offered, and the list follows whichever competition is selected.

The batter pages and Team vs Batters also carry **Runs (W)** and **Runs (L)** —
runs made in matches the batter's own team went on to win or lose — and can be
sorted by either. Drawn Tests, ties and no-results belong to neither column, so
the two do not always add up to the total.

## Pages

| Page | What it answers |
| --- | --- |
| 💪 Batter Strengths | Which bowlers does this batter score most against? Sort by runs, sixes, fours, boundaries, or runs in a win or a loss. |
| 🎯 Batter Weakness | Which bowlers get this batter out most? Sort by dismissals, balls per dismissal, lowest strike rate, dot balls, or runs in a win or a loss. |
| 🛡 Batter vs Teams | Which opposition does this batter score most against? Same sort options as Batter Strengths. |
| 🩹 Team vs Batters | Pick a team: which batters score most against them? Same filters and sorts as Batter Strengths. |
| 🧨 Team vs Bowlers | Pick a team: which bowlers take most wickets against them? Sort by wickets, dot balls, balls bowled or lowest economy. |
| 🏆 Batting Leaders | Every batter's career runs, ranked. Nothing to pick — same filters and sorts as Batter Strengths. |
| 🥇 Bowling Leaders | Every bowler's career wickets, ranked. Sort by wickets, dot balls, balls bowled or lowest economy. |
| ⚔️ Player Matchup | One batter against one bowler, with every encounter listed. |
| ⚾ Bowler Strengths | Which batters does this bowler dominate? |
| 🏅 Milestones | Active players closing in on a career landmark. |
| 🏟 Venue Explorer | Scoring and chasing patterns at every ground. |

## Running it

The site is plain HTML, CSS and ES modules — no build step. It does fetch JSON,
so it needs to be served over HTTP rather than opened as a file:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## What the data does and does not cover

CricSheet has ball-by-ball data from 2001 onwards and nothing before that, so
the leaderboards are career totals **within this data**, not lifetime records.
The early years are thin — one Test in 2001 and one in 2002, against roughly
forty a year by 2006 — so a player whose career started before about 2005 will
read low against the record books. Stuart Broad's 604 Test wickets and Alastair
Cook's 12,472 Test runs come out exactly right; James Anderson, who debuted in
2003, reads 682 against his actual 704.

Super overs are left out of every total, which is how official records treat
them, and four or six runs that were all run count as runs but not as a
boundary.

## Rebuilding the data

```bash
pip install -r scripts/requirements.txt
python scripts/build_data.py
```

The script downloads the four CricSheet archives (IPL, Tests, ODIs, T20Is),
works out every aggregate the site needs, and writes the `data/` folder. It
takes a few minutes. Every setting worth changing — thresholds, shard count,
milestone steps — sits in the `SETTINGS` block at the top of the file.

Team name clean-up rules live in `scripts/teams_registry.py`. CricSheet spells
the same side several ways ("Royal Challengers Bangalore" and "Royal Challengers
Bengaluru", "Kings XI Punjab" and "Punjab Kings", "Swaziland" and "Eswatini"),
and everything there exists to collapse those into one team.

[`.github/workflows/update-data.yml`](.github/workflows/update-data.yml) runs
the same script every day at 02:30 UTC and commits the result.

## How the data files are laid out

Stats are stored split by competition, keyed by a one-letter code — `p` for
IPL, `t` for Test, `o` for ODI, `i` for T20I. The combined filters are worked
out in the browser by adding the parts together, so nothing is stored twice.

Batter files go one level finer and hold a row per calendar year, which is what
the season filter adds up. Bowler files keep the smaller career-total shape,
since that page has no season filter.

| File | Contents |
| --- | --- |
| `meta.json` | build timestamp, match counts, shard count |
| `teams.json` | every team, with its colour and logo or flag |
| `bat_index.json` / `bowl_index.json` | player name → shard number |
| `bat/<n>.json` | per batter: per-year rows against each bowler (`b`) and each team (`t`) |
| `bowl/<n>.json` | per bowler: career totals against each batter (`b`) |
| `tbat/<team>.json` | per team: per-year rows for every batter who has scored against them |
| `tbowl/<team>.json` | per team: per-year rows for every bowler who has taken wickets against them |
| `team_index.json` | team id → file name, for the batting and bowling sets |
| `leaders_bat.json` | every batter's per-year career totals, for the Batting Leaders page |
| `leaders_bowl.json` | every bowler's per-year career totals, for the Bowling Leaders page |
| `inn/<n>.json` | per batter-vs-bowler pairing: every individual encounter |
| `venues.json` | per ground: innings averages and result splits |
| `milestones.json` | players approaching a career landmark |

Teams get one file each rather than a hashed shard, because there are only a
couple of hundred of them and a reader only ever looks at one at a time.

Per-player data is spread across numbered shard files so a page only downloads
the slice it needs instead of a single large file. A name always maps to the
same shard, which also keeps the daily commit small — only the shards holding
players who actually played get rewritten.

Number lists are positional:

- a batter's year row against a bowler —
  `[year, balls, runs, dismissals, dots, fours, sixes, runs won, runs lost]`
- a batter's year row against a team — the same, plus `matches` on the end
- a bowler's year row against a team — the same positions again, read from the
  bowling side: balls bowled, runs conceded, wickets taken. That makes
  `runs / outs` the bowling average and `balls / outs` the bowling strike rate
  without any extra fields. The two win/loss slots are left at zero, since they
  describe a batter's own team result
- a bowler's career total against a batter —
  `[balls, runs, dismissals, dots, fours, sixes]`
- an encounter — `[runs, balls, out, date, venue index, fours, sixes]`, where the
  venue index points into that shard's `v` list

"Runs won" and "runs lost" are the batter's runs in matches their own team won
or lost. The year is the calendar year the match started in, so a Test series
spanning New Year is split across two years rather than following CricSheet's
`2016/17` style season label.
