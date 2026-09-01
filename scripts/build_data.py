#!/usr/bin/env python3
"""
Cricket Analysis Hub — Data Builder

Downloads CricSheet ball-by-ball data for the IPL and for men's international
cricket (Test, ODI, T20I) and writes the JSON files the static site reads.

Run it by hand with:  python scripts/build_data.py
Or let the daily GitHub Action do it.

Everything you might want to change lives in the SETTINGS block below.
"""

import io, json, glob, os, shutil, sys, zipfile, zlib
from collections import defaultdict
from datetime import datetime, timezone, timedelta

import pandas as pd

# Windows terminals default to a codepage that cannot print the emoji in our
# progress messages, so force UTF-8 output everywhere.
try:
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from teams_registry import (
    canonical_team, find_near_duplicates, team_details,
    IPL_TEAMS, CURRENT_IPL_TEAMS, _plain,
)

# ══════════════════════════════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
RAW_DIR = os.path.join(ROOT, ".cricsheet_raw")

# The four competitions we pull. The short code is what we use as a key inside
# the JSON files, so keep these stable — the website reads the same codes.
COMPETITIONS = [
    {"code": "p", "name": "IPL",  "slug": "ipl",   "url": "https://cricsheet.org/downloads/ipl_male_csv2.zip"},
    {"code": "t", "name": "Test", "slug": "tests", "url": "https://cricsheet.org/downloads/tests_male_csv2.zip"},
    {"code": "o", "name": "ODI",  "slug": "odis",  "url": "https://cricsheet.org/downloads/odis_male_csv2.zip"},
    {"code": "i", "name": "T20I", "slug": "t20s",  "url": "https://cricsheet.org/downloads/t20s_male_csv2.zip"},
]

# Skip the download and reuse whatever is already unzipped in .cricsheet_raw.
# Handy while developing; the GitHub Action always downloads fresh.
reuse_downloaded_files = False

# A batter-vs-bowler pairing needs at least this many balls before we keep it.
# Anything smaller is noise and just bloats the data files.
smallest_balls_for_a_matchup = 3

# Ball-by-ball innings detail is only kept for pairings this size or larger.
smallest_balls_for_innings_detail = 10

# A batter-vs-team record needs at least this many balls to be kept.
smallest_balls_for_a_team_record = 6

# Player data is split across this many files per keyed set, so the browser
# only downloads the slice it needs. Keep it a power of two.
number_of_shards = 128

# A player counts as "active" for milestones if they played within this window.
days_before_a_player_goes_inactive = 900

# Milestone step sizes per competition: (runs step, wickets step).
milestone_steps = {
    "p": (500, 50),
    "t": (1000, 50),
    "o": (1000, 50),
    "i": (500, 25),
}

# How close a player must be to count as imminent / on the watchlist.
milestone_imminent_runs, milestone_watchlist_runs = 60, 250
milestone_imminent_wickets, milestone_watchlist_wickets = 5, 20

# Dismissals we credit to the bowler.
BOWLER_WICKET_TYPES = {"bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"}

# Columns we actually read out of the CricSheet CSVs.
DELIVERY_COLUMNS = ["match_id", "innings", "start_date", "venue", "batting_team",
                    "bowling_team", "striker", "bowler", "runs_off_bat", "extras",
                    "wides", "wicket_type", "player_dismissed"]

# Known IPL venue spellings collapsed into one name.
IPL_VENUE_NAMES = {
    "m.chinnaswamy stadium": "M. Chinnaswamy Stadium, Bengaluru",
    "m chinnaswamy stadium": "M. Chinnaswamy Stadium, Bengaluru",
    "wankhede stadium": "Wankhede Stadium, Mumbai",
    "ma chidambaram stadium": "M.A. Chidambaram Stadium, Chennai",
    "m a chidambaram stadium": "M.A. Chidambaram Stadium, Chennai",
    "eden gardens": "Eden Gardens, Kolkata",
    "rajiv gandhi international stadium": "Rajiv Gandhi Intl. Stadium, Hyderabad",
    "arun jaitley stadium": "Arun Jaitley Stadium, Delhi",
    "feroz shah kotla": "Arun Jaitley Stadium, Delhi",
    "narendra modi stadium": "Narendra Modi Stadium, Ahmedabad",
    "sardar patel stadium": "Narendra Modi Stadium, Ahmedabad",
    "bharat ratna shri atal bihari vajpayee ekana cricket stadium": "Ekana Cricket Stadium, Lucknow",
    "ekana cricket stadium": "Ekana Cricket Stadium, Lucknow",
    "sawai mansingh stadium": "Sawai Mansingh Stadium, Jaipur",
    "punjab cricket association is bindra stadium": "PCA Stadium, Mohali",
    "punjab cricket association stadium": "PCA Stadium, Mohali",
    "maharaja yadavindra singh international cricket stadium": "New PCA Stadium, Mullanpur",
    "himachal pradesh cricket association stadium": "HPCA Stadium, Dharamsala",
    "barsapara cricket stadium": "ACA Stadium, Guwahati",
    "shaheed veer narayan singh international stadium": "SVN Stadium, Raipur",
    "dr y s rajasekhara reddy aca vdca cricket stadium": "ACA-VDCA Stadium, Visakhapatnam",
    "dr dy patil sports academy": "DY Patil Stadium, Navi Mumbai",
    "maharashtra cricket association stadium": "MCA Stadium, Pune",
    "subrata roy sahara stadium": "MCA Stadium, Pune",
    "brabourne stadium": "Brabourne Stadium, Mumbai",
}


# ══════════════════════════════════════════════════════════════════════════════
# Downloading and reading CricSheet files
# ══════════════════════════════════════════════════════════════════════════════

def download_competition(comp):
    folder = os.path.join(RAW_DIR, comp["slug"])
    if reuse_downloaded_files and os.path.isdir(folder) and os.listdir(folder):
        print(f"   reusing already-downloaded {comp['name']} files")
        return folder

    import requests
    print(f"⬇  downloading {comp['name']} data...")
    response = requests.get(comp["url"], timeout=600)
    response.raise_for_status()
    # Start from an empty folder so a match withdrawn upstream does not linger.
    if os.path.isdir(folder):
        shutil.rmtree(folder)
    os.makedirs(folder, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(response.content), "r") as archive:
        archive.extractall(folder)
    return folder


def read_deliveries(folder):
    # One file per match, named after the match id. Some archives also ship an
    # all_matches.csv holding the same deliveries again, so only take the
    # numbered files or every ball would be counted twice.
    paths = [p for p in glob.glob(os.path.join(folder, "*.csv"))
             if os.path.basename(p)[:-4].isdigit()]
    frames = []
    for path in paths:
        try:
            frames.append(pd.read_csv(path, usecols=DELIVERY_COLUMNS, low_memory=False))
        except Exception:
            continue
    if not frames:
        raise RuntimeError(f"no delivery files found in {folder}")
    deliveries = pd.concat(frames, ignore_index=True)
    deliveries["match_id"] = deliveries["match_id"].astype(str)
    deliveries["start_date"] = pd.to_datetime(deliveries["start_date"], errors="coerce")
    return deliveries


def read_match_results(folder):
    """Winner and match date for every match, pulled from the *_info.csv files."""
    results = {}
    for path in glob.glob(os.path.join(folder, "*_info.csv")):
        match_id = os.path.basename(path).replace("_info.csv", "")
        record = {"winner": None, "season": None}
        try:
            with open(path, "r", encoding="utf-8") as handle:
                for line in handle:
                    parts = line.rstrip("\n").split(",")
                    if len(parts) < 3 or parts[0] != "info":
                        continue
                    field, value = parts[1], ",".join(parts[2:]).strip()
                    if field in ("winner", "season"):
                        record[field] = value
        except Exception:
            continue
        results[match_id] = record
    return results


# ══════════════════════════════════════════════════════════════════════════════
# Adding the helper columns we aggregate on
# ══════════════════════════════════════════════════════════════════════════════

def add_helper_columns(deliveries):
    runs = deliveries["runs_off_bat"].fillna(0)
    deliveries["runs_off_bat"] = runs

    deliveries["legal"] = deliveries["wides"].isna().astype("int32")
    deliveries["four"] = (runs == 4).astype("int32")
    deliveries["six"] = (runs == 6).astype("int32")
    deliveries["dot"] = ((runs == 0) & deliveries["wides"].isna()).astype("int32")

    credited = deliveries["wicket_type"].isin(BOWLER_WICKET_TYPES)
    struck_out = deliveries["player_dismissed"] == deliveries["striker"]
    deliveries["bowler_wicket"] = (credited & struck_out).astype("int32")

    spellings = set(deliveries["bowling_team"].dropna().unique())
    spellings.update(deliveries["batting_team"].dropna().unique())
    team_ids = {name: canonical_team(name) for name in spellings}
    deliveries["bowling_team_id"] = deliveries["bowling_team"].map(team_ids)
    deliveries["batting_team_id"] = deliveries["batting_team"].map(team_ids)
    deliveries["match_date"] = deliveries["start_date"].dt.strftime("%Y-%m-%d")
    return deliveries


# ══════════════════════════════════════════════════════════════════════════════
# Aggregating
# ══════════════════════════════════════════════════════════════════════════════

def aggregate_batter_vs_bowler(deliveries):
    grouped = deliveries.groupby(["striker", "bowler"], sort=False).agg(
        balls=("legal", "sum"),
        runs=("runs_off_bat", "sum"),
        outs=("bowler_wicket", "sum"),
        dots=("dot", "sum"),
        fours=("four", "sum"),
        sixes=("six", "sum"),
    ).reset_index()
    grouped = grouped[grouped["balls"] >= smallest_balls_for_a_matchup]
    return grouped


def aggregate_batter_vs_team(deliveries):
    grouped = deliveries.groupby(["striker", "bowling_team_id"], sort=False).agg(
        balls=("legal", "sum"),
        runs=("runs_off_bat", "sum"),
        outs=("bowler_wicket", "sum"),
        dots=("dot", "sum"),
        fours=("four", "sum"),
        sixes=("six", "sum"),
        matches=("match_id", "nunique"),
    ).reset_index()
    grouped = grouped[grouped["balls"] >= smallest_balls_for_a_team_record]
    return grouped


def aggregate_innings(deliveries, keep_pairs):
    grouped = deliveries.groupby(["striker", "bowler", "match_id", "innings"], sort=False).agg(
        runs=("runs_off_bat", "sum"),
        balls=("legal", "sum"),
        outs=("bowler_wicket", "max"),
        fours=("four", "sum"),
        sixes=("six", "sum"),
        date=("match_date", "first"),
        venue=("venue", "first"),
    ).reset_index()

    return grouped.merge(keep_pairs, on=["striker", "bowler"], how="inner")


def aggregate_player_totals(deliveries):
    """Career runs / wickets / last-played date, used for the milestones page."""
    batting = deliveries.groupby("striker", sort=False).agg(
        runs=("runs_off_bat", "sum"),
        balls=("legal", "sum"),
        last_played=("match_date", "max"),
    ).reset_index()

    bowling = deliveries.groupby("bowler", sort=False).agg(
        wickets=("bowler_wicket", "sum"),
        last_played=("match_date", "max"),
    ).reset_index()

    # The team a player most recently turned out for, for the badge on the row.
    recent = deliveries.sort_values("start_date").drop_duplicates("striker", keep="last")
    batter_team = dict(zip(recent["striker"], recent["batting_team_id"]))
    recent_bowl = deliveries.sort_values("start_date").drop_duplicates("bowler", keep="last")
    bowler_team = dict(zip(recent_bowl["bowler"], recent_bowl["bowling_team_id"]))

    return batting, bowling, batter_team, bowler_team


def aggregate_venue_stats(deliveries, match_results):
    """Per-venue innings totals and bat-first / chasing win counts."""
    deliveries["all_runs"] = deliveries["runs_off_bat"] + deliveries["extras"].fillna(0)

    per_innings = deliveries.groupby(["match_id", "innings"], sort=False).agg(
        runs=("all_runs", "sum"),
        venue=("venue", "first"),
        batting_team_id=("batting_team_id", "first"),
    ).reset_index()

    first_innings = per_innings[per_innings["innings"] == 1]
    second_innings = per_innings[per_innings["innings"] == 2]

    stats = defaultdict(lambda: {"matches": 0, "first_runs": 0, "first_count": 0,
                                 "second_runs": 0, "second_count": 0,
                                 "bat_first_wins": 0, "chase_wins": 0})

    for row in first_innings.itertuples(index=False):
        entry = stats[row.venue]
        entry["matches"] += 1
        entry["first_runs"] += int(row.runs)
        entry["first_count"] += 1

        winner = match_results.get(row.match_id, {}).get("winner")
        winner_id = canonical_team(winner) if winner else None
        if winner_id:
            if winner_id == row.batting_team_id:
                entry["bat_first_wins"] += 1
            else:
                entry["chase_wins"] += 1

    for row in second_innings.itertuples(index=False):
        entry = stats[row.venue]
        entry["second_runs"] += int(row.runs)
        entry["second_count"] += 1

    return stats


# ══════════════════════════════════════════════════════════════════════════════
# Venue name clean-up
# ══════════════════════════════════════════════════════════════════════════════

def build_venue_name_map(raw_names):
    """
    Collapse the different spellings CricSheet uses for one ground.

    Two spellings are treated as the same ground when the part before the first
    comma matches and they do not name two different cities after it.
    """
    mapped = {}
    remaining = []

    for raw in raw_names:
        if not raw or str(raw) == "nan":
            continue
        plain = _plain(raw)
        matched = None
        for pattern, canonical in IPL_VENUE_NAMES.items():
            if pattern in plain:
                matched = canonical
                break
        if matched:
            mapped[raw] = matched
        else:
            remaining.append(raw)

    groups = defaultdict(list)
    for raw in remaining:
        head = str(raw).split(",")[0]
        groups[_plain(head)].append(raw)

    for members in groups.values():
        cities = set()
        for raw in members:
            parts = str(raw).split(",")
            if len(parts) > 1:
                cities.add(_plain(parts[-1]))
        if len(cities) > 1:
            # Genuinely different grounds that happen to share a name.
            for raw in members:
                mapped[raw] = str(raw).strip()
        else:
            keeper = sorted(members, key=lambda n: (-len(str(n)), str(n)))[0]
            for raw in members:
                mapped[raw] = str(keeper).strip()

    return mapped


# ══════════════════════════════════════════════════════════════════════════════
# Writing the output files
# ══════════════════════════════════════════════════════════════════════════════

def shard_for(name):
    """Which file a player's data lives in. Stable, so unchanged players keep
    the same file and the daily commit stays small."""
    return zlib.crc32(str(name).encode("utf-8")) % number_of_shards


def write_json(relative_path, payload):
    path = os.path.join(DATA_DIR, relative_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path)


def write_sharded(folder, contents_by_name):
    """Group per-player payloads into shard files and write them out."""
    shards = defaultdict(dict)
    for name, payload in contents_by_name.items():
        shards[shard_for(name)][name] = payload

    target = os.path.join(DATA_DIR, folder)
    if os.path.isdir(target):
        shutil.rmtree(target)

    total = 0
    for shard_id in range(number_of_shards):
        total += write_json(f"{folder}/{shard_id}.json", shards.get(shard_id, {}))
    print(f"   📁 {folder}/  ({number_of_shards} files, {total/1024/1024:.1f} MB)")
    return total


# ══════════════════════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════════════════════

def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    matchup_totals = defaultdict(dict)      # (batter, bowler) -> {code: [6 numbers]}
    team_totals = defaultdict(dict)         # (batter, team)   -> {code: [7 numbers]}
    innings_rows = defaultdict(dict)        # (batter, bowler) -> {code: [rows]}
    venue_totals = {}                       # code -> {raw venue: counters}
    player_totals = {}                      # code -> (batting, bowling, teams)
    match_counts = {}
    raw_venue_names = set()
    raw_team_names = set()
    seen_team_ids = set()

    for comp in COMPETITIONS:
        code = comp["code"]
        folder = download_competition(comp)

        print(f"📊 reading {comp['name']}...")
        deliveries = read_deliveries(folder)
        results = read_match_results(folder)
        match_counts[comp["name"]] = int(deliveries["match_id"].nunique())
        print(f"   {len(deliveries):,} deliveries across {match_counts[comp['name']]:,} matches")

        raw_team_names.update(deliveries["batting_team"].dropna().unique())
        raw_team_names.update(deliveries["bowling_team"].dropna().unique())
        raw_venue_names.update(deliveries["venue"].dropna().unique())

        deliveries = add_helper_columns(deliveries)
        seen_team_ids.update(deliveries["bowling_team_id"].dropna().unique())
        seen_team_ids.update(deliveries["batting_team_id"].dropna().unique())

        print(f"   ⚡ batter vs bowler...")
        matchups = aggregate_batter_vs_bowler(deliveries)
        for row in matchups.itertuples(index=False):
            matchup_totals[(row.striker, row.bowler)][code] = [
                int(row.balls), int(row.runs), int(row.outs),
                int(row.dots), int(row.fours), int(row.sixes),
            ]

        print(f"   🛡  batter vs team...")
        team_records = aggregate_batter_vs_team(deliveries)
        for row in team_records.itertuples(index=False):
            if not row.bowling_team_id:
                continue
            team_totals[(row.striker, row.bowling_team_id)][code] = [
                int(row.balls), int(row.runs), int(row.outs), int(row.dots),
                int(row.fours), int(row.sixes), int(row.matches),
            ]

        print(f"   📋 innings breakdown...")
        keep_pairs = matchups.loc[matchups["balls"] >= smallest_balls_for_innings_detail,
                                  ["striker", "bowler"]]
        innings = aggregate_innings(deliveries, keep_pairs)
        for row in innings.itertuples(index=False):
            bucket = innings_rows[(row.striker, row.bowler)].setdefault(code, [])
            bucket.append([int(row.runs), int(row.balls), int(row.outs),
                           row.date or "", str(row.venue),
                           int(row.fours), int(row.sixes)])

        print(f"   🏟  venues...")
        venue_totals[code] = aggregate_venue_stats(deliveries, results)

        print(f"   🎯 player totals...")
        player_totals[code] = aggregate_player_totals(deliveries)

        del deliveries, results, matchups, team_records, innings

    # ─── Report any team spellings we may still be double-counting ────────────
    canonical_names = sorted({canonical_team(n) for n in raw_team_names if canonical_team(n)})
    leftover = find_near_duplicates([n for n in canonical_names if n not in IPL_TEAMS])
    if leftover:
        print("\n⚠️  merging near-duplicate team names:")
        for drop, keep_name in leftover.items():
            print(f"     {drop!r} -> {keep_name!r}")
        merged = defaultdict(dict)
        for (batter, team), by_code in team_totals.items():
            target = leftover.get(team, team)
            existing = merged[(batter, target)]
            for code, numbers in by_code.items():
                if code in existing:
                    existing[code] = [a + b for a, b in zip(existing[code], numbers)]
                else:
                    existing[code] = list(numbers)
        team_totals = merged
        seen_team_ids = {leftover.get(t, t) for t in seen_team_ids}
    else:
        print("\n✅ no leftover duplicate team names")

    # ─── Venue names ──────────────────────────────────────────────────────────
    venue_name_map = build_venue_name_map(raw_venue_names)
    print(f"   {len(raw_venue_names):,} venue spellings -> {len(set(venue_name_map.values())):,} grounds")

    # ─── Teams file ───────────────────────────────────────────────────────────
    teams_out = {}
    for team_id in sorted(seen_team_ids):
        teams_out[team_id] = team_details(team_id)
    for team_id in CURRENT_IPL_TEAMS:
        teams_out.setdefault(team_id, team_details(team_id))
    write_json("teams.json", teams_out)
    print(f"   📁 teams.json ({len(teams_out)} teams)")

    # ─── Batter-keyed files ───────────────────────────────────────────────────
    print("\n📦 packing player files...")
    batter_payloads = defaultdict(lambda: {"b": {}, "t": {}})
    for (batter, bowler), by_code in matchup_totals.items():
        batter_payloads[batter]["b"][bowler] = by_code
    for (batter, team), by_code in team_totals.items():
        batter_payloads[batter]["t"][team] = by_code

    bowler_payloads = defaultdict(lambda: {"b": {}})
    for (batter, bowler), by_code in matchup_totals.items():
        bowler_payloads[bowler]["b"][batter] = by_code

    write_sharded("bat", dict(batter_payloads))
    write_sharded("bowl", dict(bowler_payloads))

    # ─── Innings files (keyed by batter so the matchup page loads one shard) ──
    grouped_innings = defaultdict(dict)
    for (batter, bowler), by_code in innings_rows.items():
        grouped_innings[shard_for(batter)][(batter, bowler)] = by_code

    innings_shards = {}
    for shard_id, entries in grouped_innings.items():
        venues_here = sorted({venue_name_map.get(row[4], row[4])
                              for by_code in entries.values()
                              for rows in by_code.values()
                              for row in rows})
        venue_index = {name: i for i, name in enumerate(venues_here)}
        matchups_out = {}
        for (batter, bowler), by_code in entries.items():
            per_code = {}
            for code, rows in by_code.items():
                packed = [[r[0], r[1], r[2], r[3],
                           venue_index[venue_name_map.get(r[4], r[4])], r[5], r[6]]
                          for r in rows]
                packed.sort(key=lambda r: r[3], reverse=True)
                per_code[code] = packed
            matchups_out[f"{batter}__{bowler}"] = per_code
        innings_shards[shard_id] = {"v": venues_here, "m": matchups_out}

    target = os.path.join(DATA_DIR, "inn")
    if os.path.isdir(target):
        shutil.rmtree(target)
    total = 0
    for shard_id in range(number_of_shards):
        total += write_json(f"inn/{shard_id}.json", innings_shards.get(shard_id, {"v": [], "m": {}}))
    print(f"   📁 inn/  ({number_of_shards} files, {total/1024/1024:.1f} MB)")

    # ─── Name lists / shard lookup ────────────────────────────────────────────
    write_json("bat_index.json", {name: shard_for(name) for name in sorted(batter_payloads)})
    write_json("bowl_index.json", {name: shard_for(name) for name in sorted(bowler_payloads)})
    print(f"   📁 bat_index.json ({len(batter_payloads):,} batters)")
    print(f"   📁 bowl_index.json ({len(bowler_payloads):,} bowlers)")

    # ─── Venues ───────────────────────────────────────────────────────────────
    venues_out = defaultdict(dict)
    for code, per_raw_venue in venue_totals.items():
        merged_by_ground = defaultdict(lambda: {"matches": 0, "first_runs": 0, "first_count": 0,
                                                "second_runs": 0, "second_count": 0,
                                                "bat_first_wins": 0, "chase_wins": 0})
        for raw, counters in per_raw_venue.items():
            ground = venue_name_map.get(raw, raw)
            target_counters = merged_by_ground[ground]
            for field, value in counters.items():
                target_counters[field] += value

        for ground, c in merged_by_ground.items():
            decided = c["bat_first_wins"] + c["chase_wins"]
            venues_out[ground][code] = {
                "matches": c["matches"],
                "avg_first": round(c["first_runs"] / c["first_count"], 1) if c["first_count"] else 0,
                "avg_second": round(c["second_runs"] / c["second_count"], 1) if c["second_count"] else 0,
                "bat_first_wins": c["bat_first_wins"],
                "chase_wins": c["chase_wins"],
                "bat_first_pct": round(c["bat_first_wins"] / decided * 100, 1) if decided else 0,
                "chase_pct": round(c["chase_wins"] / decided * 100, 1) if decided else 0,
            }
    write_json("venues.json", dict(venues_out))
    print(f"   📁 venues.json ({len(venues_out):,} grounds)")

    # ─── Milestones ───────────────────────────────────────────────────────────
    write_json("milestones.json", build_milestones(player_totals, leftover))
    print("   📁 milestones.json")

    # ─── Meta ─────────────────────────────────────────────────────────────────
    write_json("meta.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "shards": number_of_shards,
        "competitions": [{"code": c["code"], "name": c["name"]} for c in COMPETITIONS],
        "match_counts": match_counts,
        "batters": len(batter_payloads),
        "bowlers": len(bowler_payloads),
    })
    print("   📁 meta.json")
    print("\n✅ done — data/ is up to date")


def build_milestones(player_totals, merged_team_names):
    """Players sitting just short of a round-number career total, per competition."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_before_a_player_goes_inactive)).strftime("%Y-%m-%d")

    def badge_team(team_id):
        return merged_team_names.get(team_id, team_id) or ""

    out = {}
    for code, (batting, bowling, batter_team, bowler_team) in player_totals.items():
        runs_step, wickets_step = milestone_steps[code]
        imminent, watchlist = [], []

        for row in batting.itertuples(index=False):
            if not row.last_played or row.last_played < cutoff:
                continue
            total = int(row.runs)
            if total < runs_step * 0.8:
                continue
            target = ((total // runs_step) + 1) * runs_step
            needed = target - total
            if needed > milestone_watchlist_runs:
                continue
            entry = {"player": row.striker,
                     "team": badge_team(batter_team.get(row.striker)),
                     "milestone": f"{target:,} runs", "icon": "🏏",
                     "detail": f"On {total:,} runs — {needed} away from {target:,}",
                     "needed": f"{needed} runs", "sort": needed}
            (imminent if needed <= milestone_imminent_runs else watchlist).append(entry)

        for row in bowling.itertuples(index=False):
            if not row.last_played or row.last_played < cutoff:
                continue
            total = int(row.wickets)
            if total < wickets_step * 0.8:
                continue
            target = ((total // wickets_step) + 1) * wickets_step
            needed = target - total
            if needed > milestone_watchlist_wickets:
                continue
            entry = {"player": row.bowler,
                     "team": badge_team(bowler_team.get(row.bowler)),
                     "milestone": f"{target} wickets", "icon": "🪵",
                     "detail": f"On {total} wickets — {needed} away from {target}",
                     "needed": f"{needed} wickets", "sort": needed}
            (imminent if needed <= milestone_imminent_wickets else watchlist).append(entry)

        imminent.sort(key=lambda e: e["sort"])
        watchlist.sort(key=lambda e: e["sort"])
        for entry in imminent + watchlist:
            entry.pop("sort")
        for entry in watchlist:
            entry["icon"] = "👀"
        out[code] = {"imminent": imminent[:25], "watchlist": watchlist[:25]}
    return out


if __name__ == "__main__":
    main()
