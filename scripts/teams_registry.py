#!/usr/bin/env python3
"""
Team name registry and clean-up rules.

CricSheet spells the same team several different ways across seasons and
formats. This file holds every rule we use to collapse those spellings into
one canonical team, plus the display details (short code, colour, flag or
logo) the dashboard needs.

Everything here is data only. The clean-up functions live at the bottom.
"""

import os
import re
import unicodedata
from functools import lru_cache

# We only have crests for the sides currently playing, so check before pointing
# the site at a logo file that is not there.
LOGO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logos")
AVAILABLE_LOGOS = set()
if os.path.isdir(LOGO_DIR):
    AVAILABLE_LOGOS = {name[:-4] for name in os.listdir(LOGO_DIR) if name.endswith(".png")}

# ─── Franchise teams (IPL) ────────────────────────────────────────────────────
# Every CricSheet spelling on the left, the team code we keep on the right.
# Renames and re-brands of the same franchise are treated as one team.

IPL_NAME_TO_CODE = {
    "Chennai Super Kings": "CSK",
    "Mumbai Indians": "MI",
    "Royal Challengers Bangalore": "RCB",
    "Royal Challengers Bengaluru": "RCB",
    "Kolkata Knight Riders": "KKR",
    "Sunrisers Hyderabad": "SRH",
    "Deccan Chargers": "SRH",
    "Delhi Capitals": "DC",
    "Delhi Daredevils": "DC",
    "Punjab Kings": "PBKS",
    "Kings XI Punjab": "PBKS",
    "Rajasthan Royals": "RR",
    "Lucknow Super Giants": "LSG",
    "Gujarat Titans": "GT",
    "Rising Pune Supergiant": "RPS",
    "Rising Pune Supergiants": "RPS",
    "Pune Warriors": "PW",
    "Gujarat Lions": "GL",
    "Kochi Tuskers Kerala": "KTK",
}

IPL_TEAMS = {
    "CSK": {"name": "Chennai Super Kings", "short": "CSK", "color": "#FFCB05",
            "captain": "Ruturaj Gaikwad", "home_ground": "M.A. Chidambaram Stadium, Chennai"},
    "MI": {"name": "Mumbai Indians", "short": "MI", "color": "#004BA0",
           "captain": "Hardik Pandya", "home_ground": "Wankhede Stadium, Mumbai"},
    "RCB": {"name": "Royal Challengers Bengaluru", "short": "RCB", "color": "#EC1C24",
            "captain": "Rajat Patidar", "home_ground": "M. Chinnaswamy Stadium, Bengaluru"},
    "KKR": {"name": "Kolkata Knight Riders", "short": "KKR", "color": "#B39CD9",
            "captain": "Ajinkya Rahane", "home_ground": "Eden Gardens, Kolkata"},
    "SRH": {"name": "Sunrisers Hyderabad", "short": "SRH", "color": "#FF822A",
            "captain": "Pat Cummins", "home_ground": "Rajiv Gandhi Intl. Stadium, Hyderabad"},
    "DC": {"name": "Delhi Capitals", "short": "DC", "color": "#17479E",
           "captain": "Axar Patel", "home_ground": "Arun Jaitley Stadium, Delhi"},
    "PBKS": {"name": "Punjab Kings", "short": "PBKS", "color": "#DD1F2D",
             "captain": "Shreyas Iyer", "home_ground": "New PCA Stadium, Mullanpur"},
    "RR": {"name": "Rajasthan Royals", "short": "RR", "color": "#EA1A85",
           "captain": "Riyan Parag", "home_ground": "Sawai Mansingh Stadium, Jaipur"},
    "LSG": {"name": "Lucknow Super Giants", "short": "LSG", "color": "#A72056",
            "captain": "Rishabh Pant", "home_ground": "Ekana Cricket Stadium, Lucknow"},
    "GT": {"name": "Gujarat Titans", "short": "GT", "color": "#7CE8F5",
           "captain": "Shubman Gill", "home_ground": "Narendra Modi Stadium, Ahmedabad"},
    "RPS": {"name": "Rising Pune Supergiant", "short": "RPS", "color": "#8B5CF6"},
    "PW": {"name": "Pune Warriors India", "short": "PW", "color": "#2563EB"},
    "GL": {"name": "Gujarat Lions", "short": "GL", "color": "#F97316"},
    "KTK": {"name": "Kochi Tuskers Kerala", "short": "KTK", "color": "#F97316"},
}

# Teams that still play in IPL 2026 — used where we only want current sides.
CURRENT_IPL_TEAMS = {"CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "LSG", "GT"}

# ─── International teams ──────────────────────────────────────────────────────
# CricSheet spellings that mean the same country. Left side is anything we have
# seen (or might reasonably see), right side is the name we keep.

INTERNATIONAL_ALIASES = {
    "United States of America": "United States",
    "USA": "United States",
    "U.S.A.": "United States",
    "United Arab Emirates": "United Arab Emirates",
    "U.A.E.": "United Arab Emirates",
    "UAE": "United Arab Emirates",
    "Papua New Guinea": "Papua New Guinea",
    "P.N.G.": "Papua New Guinea",
    "PNG": "Papua New Guinea",
    "Swaziland": "Eswatini",
    "Czech Republic": "Czechia",
    "Turks and Caicos Island": "Turks and Caicos Islands",
    "Cayman Island": "Cayman Islands",
    "Cook Island": "Cook Islands",
    "Isle of Man": "Isle of Man",
    "Ivory Coast": "Cote d'Ivoire",
    "Côte d'Ivoire": "Cote d'Ivoire",
    "St Helena": "Saint Helena",
    "St. Helena": "Saint Helena",
    "South Korea": "South Korea",
    "Korea": "South Korea",
    "Republic of Korea": "South Korea",
    "Hong Kong China": "Hong Kong",
    "Netherlands": "Netherlands",
    "Holland": "Netherlands",
    "Timor-Leste": "Timor-Leste",
    "East Timor": "Timor-Leste",
    "Myanmar": "Myanmar",
    "Burma": "Myanmar",
    "Mainland China": "China",
    "Chinese Taipei": "Chinese Taipei",
}

# Short code, flag and colour for the countries people actually look up.
# Anything missing gets a code built from its name and a neutral colour.
COUNTRY_DETAILS = {
    "India": ("IND", "🇮🇳", "#1565C0"),
    "Australia": ("AUS", "🇦🇺", "#FFD700"),
    "England": ("ENG", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "#CE1124"),
    "Pakistan": ("PAK", "🇵🇰", "#01411C"),
    "South Africa": ("SA", "🇿🇦", "#007A4D"),
    "New Zealand": ("NZ", "🇳🇿", "#00B2A9"),
    "Sri Lanka": ("SL", "🇱🇰", "#00534E"),
    "West Indies": ("WI", "🏏", "#7B0041"),
    "Bangladesh": ("BAN", "🇧🇩", "#006A4E"),
    "Afghanistan": ("AFG", "🇦🇫", "#1B5E9F"),
    "Zimbabwe": ("ZIM", "🇿🇼", "#D40000"),
    "Ireland": ("IRE", "🇮🇪", "#169B62"),
    "Scotland": ("SCO", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "#005EB8"),
    "Netherlands": ("NED", "🇳🇱", "#FF6600"),
    "Nepal": ("NEP", "🇳🇵", "#DC143C"),
    "United Arab Emirates": ("UAE", "🇦🇪", "#00732F"),
    "Oman": ("OMA", "🇴🇲", "#C8102E"),
    "Namibia": ("NAM", "🇳🇦", "#003580"),
    "United States": ("USA", "🇺🇸", "#3C3B6E"),
    "Canada": ("CAN", "🇨🇦", "#FF0000"),
    "Papua New Guinea": ("PNG", "🇵🇬", "#CE1126"),
    "Kenya": ("KEN", "🇰🇪", "#006600"),
    "Hong Kong": ("HK", "🇭🇰", "#DE2910"),
    "Bermuda": ("BER", "🇧🇲", "#C8102E"),
    "Jersey": ("JER", "🇯🇪", "#CE1124"),
    "Guernsey": ("GUE", "🇬🇬", "#E8112D"),
    "Italy": ("ITA", "🇮🇹", "#008C45"),
    "Germany": ("GER", "🇩🇪", "#DD0000"),
    "Denmark": ("DEN", "🇩🇰", "#C60C30"),
    "Uganda": ("UGA", "🇺🇬", "#FCDC04"),
    "Nigeria": ("NGA", "🇳🇬", "#008751"),
    "Tanzania": ("TAN", "🇹🇿", "#1EB53A"),
    "Singapore": ("SIN", "🇸🇬", "#EF3340"),
    "Malaysia": ("MAS", "🇲🇾", "#010066"),
    "Qatar": ("QAT", "🇶🇦", "#8A1538"),
    "Kuwait": ("KUW", "🇰🇼", "#007A3D"),
    "Bahrain": ("BRN", "🇧🇭", "#CE1126"),
    "Saudi Arabia": ("KSA", "🇸🇦", "#006C35"),
    "Japan": ("JPN", "🇯🇵", "#BC002D"),
    "Fiji": ("FIJ", "🇫🇯", "#68BFE5"),
    "Vanuatu": ("VAN", "🇻🇺", "#009543"),
    "Samoa": ("SAM", "🇼🇸", "#CE1126"),
    "France": ("FRA", "🇫🇷", "#0055A4"),
    "Spain": ("ESP", "🇪🇸", "#AA151B"),
    "Portugal": ("POR", "🇵🇹", "#006600"),
    "Austria": ("AUT", "🇦🇹", "#ED2939"),
    "Belgium": ("BEL", "🇧🇪", "#FDDA24"),
    "Norway": ("NOR", "🇳🇴", "#BA0C2F"),
    "Sweden": ("SWE", "🇸🇪", "#006AA7"),
    "Finland": ("FIN", "🇫🇮", "#003580"),
    "Malta": ("MLT", "🇲🇹", "#CF142B"),
    "Israel": ("ISR", "🇮🇱", "#0038B8"),
    "Argentina": ("ARG", "🇦🇷", "#6CACE4"),
    "Brazil": ("BRA", "🇧🇷", "#009C3B"),
    "Botswana": ("BOT", "🇧🇼", "#6DA9D2"),
    "Ghana": ("GHA", "🇬🇭", "#006B3F"),
    "Rwanda": ("RWA", "🇷🇼", "#20603D"),
    "Malawi": ("MWI", "🇲🇼", "#CE1126"),
    "Mozambique": ("MOZ", "🇲🇿", "#009739"),
    "Eswatini": ("SWZ", "🇸🇿", "#3E5EB9"),
    "Lesotho": ("LES", "🇱🇸", "#00209F"),
    "Sierra Leone": ("SLE", "🇸🇱", "#1EB53A"),
    "Cameroon": ("CMR", "🇨🇲", "#007A5E"),
    "Gambia": ("GAM", "🇬🇲", "#CE1126"),
    "Mali": ("MLI", "🇲🇱", "#14B53A"),
    "Seychelles": ("SEY", "🇸🇨", "#003F87"),
    "Zambia": ("ZAM", "🇿🇲", "#198A00"),
    "Cote d'Ivoire": ("CIV", "🇨🇮", "#F77F00"),
    "Czechia": ("CZE", "🇨🇿", "#11457E"),
    "Croatia": ("CRO", "🇭🇷", "#FF0000"),
    "Serbia": ("SRB", "🇷🇸", "#0C4076"),
    "Slovenia": ("SLO", "🇸🇮", "#005DA4"),
    "Hungary": ("HUN", "🇭🇺", "#477050"),
    "Romania": ("ROM", "🇷🇴", "#002B7F"),
    "Bulgaria": ("BUL", "🇧🇬", "#00966E"),
    "Greece": ("GRE", "🇬🇷", "#0D5EAF"),
    "Cyprus": ("CYP", "🇨🇾", "#D57800"),
    "Turkey": ("TUR", "🇹🇷", "#E30A17"),
    "Estonia": ("EST", "🇪🇪", "#0072CE"),
    "Luxembourg": ("LUX", "🇱🇺", "#00A1DE"),
    "Switzerland": ("SUI", "🇨🇭", "#D52B1E"),
    "Gibraltar": ("GIB", "🇬🇮", "#DA000C"),
    "Isle of Man": ("IOM", "🇮🇲", "#CF142B"),
    "Thailand": ("THA", "🇹🇭", "#A51931"),
    "Indonesia": ("INA", "🇮🇩", "#CE1126"),
    "Philippines": ("PHI", "🇵🇭", "#0038A8"),
    "China": ("CHN", "🇨🇳", "#DE2910"),
    "South Korea": ("KOR", "🇰🇷", "#003478"),
    "Mongolia": ("MGL", "🇲🇳", "#C4272F"),
    "Bhutan": ("BHU", "🇧🇹", "#FFD520"),
    "Maldives": ("MDV", "🇲🇻", "#D21034"),
    "Myanmar": ("MYA", "🇲🇲", "#FECB00"),
    "Cambodia": ("CAM", "🇰🇭", "#032EA1"),
    "Iran": ("IRI", "🇮🇷", "#239F40"),
    "Uzbekistan": ("UZB", "🇺🇿", "#0099B5"),
    "Timor-Leste": ("TLS", "🇹🇱", "#DC241F"),
    "Mexico": ("MEX", "🇲🇽", "#006341"),
    "Panama": ("PAN", "🇵🇦", "#005293"),
    "Peru": ("PER", "🇵🇪", "#D91023"),
    "Chile": ("CHI", "🇨🇱", "#0039A6"),
    "Costa Rica": ("CRC", "🇨🇷", "#002B7F"),
    "Belize": ("BLZ", "🇧🇿", "#003F87"),
    "Bahamas": ("BAH", "🇧🇸", "#00778B"),
    "Cayman Islands": ("CAY", "🇰🇾", "#00285E"),
    "Turks and Caicos Islands": ("TKS", "🇹🇨", "#00247D"),
    "Suriname": ("SUR", "🇸🇷", "#377E3F"),
    "Saint Helena": ("SHN", "🇸🇭", "#00247D"),
    "Cook Islands": ("COK", "🇨🇰", "#00247D"),
    "Chinese Taipei": ("TPE", "🇹🇼", "#000095"),
    "Asia XI": ("ASI", "🏏", "#F59E0B"),
    "Africa XI": ("AFR", "🏏", "#10B981"),
    "ICC World XI": ("ICC", "🏏", "#3B82F6"),
}

# Colours handed out to countries we have no explicit colour for.
FALLBACK_COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#A855F7", "#EC4899",
    "#14B8A6", "#F97316", "#6366F1", "#84CC16", "#EF4444",
]


# ─── Clean-up helpers ─────────────────────────────────────────────────────────

@lru_cache(maxsize=None)
def _plain(name):
    """Lower-case, accent-free, punctuation-free version used only for comparing."""
    text = unicodedata.normalize("NFKD", str(name))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().replace("&", "and")
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _singular(name):
    """Same as _plain but with a trailing 's' dropped, so 'Islands' == 'Island'."""
    plain = _plain(name)
    if plain.endswith("s") and not plain.endswith("ss"):
        return plain[:-1]
    return plain


@lru_cache(maxsize=None)
def canonical_team(raw_name):
    """
    Turn one CricSheet team name into the name we keep.

    IPL sides come back as their team code (CSK, MI, ...). International sides
    come back as the tidied country name.
    """
    if raw_name is None:
        return None
    name = re.sub(r"\s+", " ", str(raw_name)).strip()
    if not name:
        return None
    if name in IPL_NAME_TO_CODE:
        return IPL_NAME_TO_CODE[name]
    if name in INTERNATIONAL_ALIASES:
        return INTERNATIONAL_ALIASES[name]
    # A spelling we have not listed — try the punctuation-free match before
    # giving up and keeping the name as-is.
    return _PLAIN_LOOKUP.get(_plain(name), name)


def find_near_duplicates(names):
    """
    Spot team names that differ only by a trailing 's', punctuation or accents.

    Returns a dict of {name_to_drop: name_to_keep}. We deliberately do NOT do
    loose fuzzy matching here — 'Austria' and 'Australia' are close enough to
    fool a similarity score but are obviously different teams.
    """
    buckets = {}
    for name in names:
        buckets.setdefault(_singular(name), []).append(name)

    merges = {}
    for group in buckets.values():
        if len(group) < 2:
            continue
        # Keep the longest spelling — it is almost always the fuller, newer one.
        keeper = sorted(group, key=lambda n: (-len(n), n))[0]
        for other in group:
            if other != keeper:
                merges[other] = keeper
    return merges


def team_details(team_id):
    """Display details for a canonical team id: name, short code, colour, badge."""
    if team_id in IPL_TEAMS:
        info = dict(IPL_TEAMS[team_id])
        info["kind"] = "ipl"
        has_logo = team_id in AVAILABLE_LOGOS
        info["logo"] = f"logos/{team_id}.png" if has_logo else ""
        info["badge"] = "" if has_logo else "🏏"
        return info

    if team_id in COUNTRY_DETAILS:
        short, flag, color = COUNTRY_DETAILS[team_id]
    else:
        short = _plain(team_id).replace(" ", "")[:3].upper() or "TBD"
        flag = "🏏"
        color = FALLBACK_COLORS[sum(ord(c) for c in team_id) % len(FALLBACK_COLORS)]

    return {"name": team_id, "short": short, "color": color,
            "kind": "international", "logo": "", "badge": flag}


# Punctuation-free version of every spelling above, built once at import time.
_PLAIN_LOOKUP = {}
for _known, _canon in list(IPL_NAME_TO_CODE.items()) + list(INTERNATIONAL_ALIASES.items()):
    _PLAIN_LOOKUP.setdefault(_plain(_known), _canon)
