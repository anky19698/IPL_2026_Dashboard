# Cricket Analysis Hub

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

## Pages

| Page | What it answers |
| --- | --- |
| 💪 Batter Strengths | Which bowlers does this batter score most against? Sort by runs, sixes, fours or boundaries. |
| 🎯 Batter Weakness | Which bowlers get this batter out most? Sort by dismissals, balls per dismissal, lowest strike rate or dot balls. |
| 🛡 Batter vs Teams | Which opposition does this batter score most against? Same sort options. |
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

| File | Contents |
| --- | --- |
| `meta.json` | build timestamp, match counts, shard count |
| `teams.json` | every team, with its colour and logo or flag |
| `bat_index.json` / `bowl_index.json` | player name → shard number |
| `bat/<n>.json` | per batter: totals against each bowler (`b`) and each team (`t`) |
| `bowl/<n>.json` | per bowler: totals against each batter (`b`) |
| `inn/<n>.json` | per batter-vs-bowler pairing: every individual encounter |
| `venues.json` | per ground: innings averages and result splits |
| `milestones.json` | players approaching a career landmark |

Per-player data is spread across numbered shard files so a page only downloads
the slice it needs instead of a single large file. A name always maps to the
same shard, which also keeps the daily commit small — only the shards holding
players who actually played get rewritten.

Number lists are positional:

- batter vs bowler — `[balls, runs, dismissals, dots, fours, sixes]`
- batter vs team — the same, plus `matches` on the end
- an encounter — `[runs, balls, out, date, venue index, fours, sixes]`, where the
  venue index points into that shard's `v` list
