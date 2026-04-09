#!/usr/bin/env python3
"""
IPL 2026 Dashboard — Data Builder
Downloads CricSheet ball-by-ball data and outputs JSON files for the static site.
Run daily via GitHub Actions or manually: python scripts/build_data.py
"""

import io, json, math, os, sys, zipfile, glob
import pandas as pd
import numpy as np
import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
RAW_DIR = os.path.join(ROOT, ".cricsheet_raw")
CRICSHEET_URL = "https://cricsheet.org/downloads/ipl_male_csv2.zip"

# ─── Team name normalisation ─────────────────────────────────────────────────

TEAM_CODE_MAP = {
    "Chennai Super Kings": "CSK", "Mumbai Indians": "MI",
    "Royal Challengers Bangalore": "RCB", "Royal Challengers Bengaluru": "RCB",
    "Kolkata Knight Riders": "KKR", "Sunrisers Hyderabad": "SRH",
    "Delhi Capitals": "DC", "Delhi Daredevils": "DC",
    "Punjab Kings": "PBKS", "Kings XI Punjab": "PBKS",
    "Rajasthan Royals": "RR", "Lucknow Super Giants": "LSG",
    "Gujarat Titans": "GT", "Rising Pune Supergiant": "RPS",
    "Rising Pune Supergiants": "RPS", "Pune Warriors": "PW",
    "Gujarat Lions": "GL", "Deccan Chargers": "SRH",
    "Kochi Tuskers Kerala": "KTK",
}

CURRENT_TEAMS = {"CSK", "MI", "RCB", "KKR", "SRH", "DC", "PBKS", "RR", "LSG", "GT"}
BOWLER_WKT_TYPES = {"bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"}

def _code(name): return TEAM_CODE_MAP.get(name, name)

VENUE_NORM = {
    "m.chinnaswamy stadium": "M. Chinnaswamy Stadium, Bengaluru",
    "m chinnaswamy stadium": "M. Chinnaswamy Stadium, Bengaluru",
    "chinnaswamy": "M. Chinnaswamy Stadium, Bengaluru",
    "wankhede stadium": "Wankhede Stadium, Mumbai",
    "wankhede": "Wankhede Stadium, Mumbai",
    "ma chidambaram stadium, chepauk, chennai": "M.A. Chidambaram Stadium, Chennai",
    "ma chidambaram stadium, chepauk": "M.A. Chidambaram Stadium, Chennai",
    "chepauk": "M.A. Chidambaram Stadium, Chennai",
    "chidambaram": "M.A. Chidambaram Stadium, Chennai",
    "eden gardens": "Eden Gardens, Kolkata",
    "rajiv gandhi international stadium, uppal": "Rajiv Gandhi Intl. Stadium, Hyderabad",
    "rajiv gandhi international stadium": "Rajiv Gandhi Intl. Stadium, Hyderabad",
    "arun jaitley stadium, delhi": "Arun Jaitley Stadium, Delhi",
    "arun jaitley stadium": "Arun Jaitley Stadium, Delhi",
    "feroz shah kotla": "Arun Jaitley Stadium, Delhi",
    "narendra modi stadium, ahmedabad": "Narendra Modi Stadium, Ahmedabad",
    "narendra modi stadium": "Narendra Modi Stadium, Ahmedabad",
    "motera": "Narendra Modi Stadium, Ahmedabad",
    "sardar patel stadium, motera": "Narendra Modi Stadium, Ahmedabad",
    "bharat ratna shri atal bihari vajpayee ekana cricket stadium, lucknow": "Ekana Cricket Stadium, Lucknow",
    "ekana cricket stadium, lucknow": "Ekana Cricket Stadium, Lucknow",
    "ekana cricket stadium": "Ekana Cricket Stadium, Lucknow",
    "sawai mansingh stadium": "Sawai Mansingh Stadium, Jaipur",
    "punjab cricket association is bindra stadium, mohali": "PCA Stadium, Mohali",
    "punjab cricket association stadium, mohali": "PCA Stadium, Mohali",
    "maharaja yadavindra singh international cricket stadium, mullanpur": "New PCA Stadium, Mullanpur",
    "new pca stadium, mullanpur": "New PCA Stadium, Mullanpur",
    "himachal pradesh cricket association stadium": "HPCA Stadium, Dharamsala",
    "barsapara cricket stadium, guwahati": "ACA Stadium, Guwahati",
    "aca-vdca cricket stadium, guwahati": "ACA Stadium, Guwahati",
    "shaheed veer narayan singh international stadium": "SVN Stadium, Raipur",
    "dr. y.s. rajasekhara reddy aca-vdca cricket stadium, visakhapatnam": "ACA-VDCA Stadium, Visakhapatnam",
    "dr dy patil sports academy, navi mumbai": "DY Patil Stadium, Navi Mumbai",
    "brabourne stadium, mumbai": "Brabourne Stadium, Mumbai",
    "maharashtra cricket association stadium, pune": "MCA Stadium, Pune",
    "subrata roy sahara stadium": "MCA Stadium, Pune",
}

def _norm_venue(raw):
    if pd.isna(raw): return "Unknown"
    key = raw.strip().lower()
    for pat, canon in VENUE_NORM.items():
        if pat in key: return canon
    return raw.strip()

# ─── Static data ──────────────────────────────────────────────────────────────

TEAMS = {
    "CSK": {
        "name": "Chennai Super Kings", "short": "CSK",
        "captain": "Ruturaj Gaikwad", "coach": "Stephen Fleming",
        "home_ground": "M.A. Chidambaram Stadium, Chennai",
        "primary_color": "#FFCB05", "secondary_color": "#0081E9", "group": "A",
        "key_players": ["Ruturaj Gaikwad", "MS Dhoni", "Sanju Samson", "Shivam Dube", "Khaleel Ahmed"],
        "squad_2026": ["RD Gaikwad","MS Dhoni","SV Samson","S Dube","A Mhatre","SN Khan","Kartik Sharma","A Kamboj","J Overton","D Brevis","MW Short","KK Ahmed","Noor Ahmad","MJ Henry","Rahul Chahar","S Gopal","Gurjapneet Singh","Mukesh Choudhary","Prashant Veer","Aman Khan","R Ghosh","N Ellis","A Hosein","Z Foulkes"],
    },
    "MI": {
        "name": "Mumbai Indians", "short": "MI",
        "captain": "Hardik Pandya", "coach": "Mark Boucher",
        "home_ground": "Wankhede Stadium, Mumbai",
        "primary_color": "#004BA0", "secondary_color": "#D1AB3E", "group": "B",
        "key_players": ["Hardik Pandya", "Rohit Sharma", "Jasprit Bumrah", "Suryakumar Yadav", "Tilak Varma"],
        "squad_2026": ["HH Pandya","RG Sharma","SA Yadav","Tilak Varma","JJ Bumrah","RD Rickelton","Naman Dhir","SN Thakur","M Markande","TA Boult","AM Ghazanfar","WG Jacks","Q de Kock","DL Chahar","R Minz","C Bosch","SE Rutherford","MJ Santner","Raj Bawa","D Malewar","Raghu Sharma","Ashwani Kumar","M Izhar","M Rawat"],
    },
    "RCB": {
        "name": "Royal Challengers Bengaluru", "short": "RCB",
        "captain": "Rajat Patidar", "coach": "Andy Flower",
        "home_ground": "M. Chinnaswamy Stadium, Bengaluru",
        "primary_color": "#EC1C24", "secondary_color": "#2B2A29", "group": "A",
        "key_players": ["Virat Kohli", "Rajat Patidar", "Phil Salt", "Bhuvneshwar Kumar", "Krunal Pandya"],
        "squad_2026": ["V Kohli","RM Patidar","D Padikkal","PD Salt","B Kumar","KH Pandya","VR Iyer","JM Sharma","Suyash Sharma","S Singh","Abhinandan Singh","V Ostwal","R Salam","JA Duffy","TH David","R Shepherd","J Bethell","S Deswal","K Chouhan","V Malhotra","M Yadav"],
    },
    "KKR": {
        "name": "Kolkata Knight Riders", "short": "KKR",
        "captain": "Ajinkya Rahane", "coach": "Chandrakant Pandit",
        "home_ground": "Eden Gardens, Kolkata",
        "primary_color": "#3A225D", "secondary_color": "#D4A843", "group": "A",
        "key_players": ["Ajinkya Rahane", "Sunil Narine", "Cameron Green", "Rinku Singh", "Varun Chakravarthy"],
        "squad_2026": ["AM Rahane","SP Narine","C Green","RK Singh","CV Varun","A Raghuvanshi","FH Allen","Kartik Tyagi","Ramandeep Singh","AS Roy","B Muzarabani","VG Arora","MK Pandey","R Tripathi","RR Powell","R Ravindra","T Seifert","M Pathirana","U Malik","D Kamra","S Ranjan","S Dubey","N Saini","P Solanki"],
    },
    "SRH": {
        "name": "Sunrisers Hyderabad", "short": "SRH",
        "captain": "Pat Cummins", "coach": "Daniel Vettori",
        "home_ground": "Rajiv Gandhi Intl. Stadium, Hyderabad",
        "primary_color": "#FF822A", "secondary_color": "#000000", "group": "B",
        "key_players": ["Pat Cummins", "Heinrich Klaasen", "Travis Head", "Abhishek Sharma", "Ishan Kishan"],
        "squad_2026": ["PJ Cummins","H Klaasen","TM Head","Abhishek Sharma","Ishan Kishan","HV Patel","Nithish Kumar Reddy","L Livingstone","JD Unadkat","E Malinga","S Arora","Aniket Verma","DA Payne","Harsh Dubey","Shivang Kumar","B Carse","J Edwards","K Mendis","S Mavi","Z Ansari","K Fuletra","O Tarmale","A Kumar","S Hussain","P Hinge"],
    },
    "DC": {
        "name": "Delhi Capitals", "short": "DC",
        "captain": "Axar Patel", "coach": "Ricky Ponting",
        "home_ground": "Arun Jaitley Stadium, Delhi",
        "primary_color": "#17479E", "secondary_color": "#EF1B23", "group": "B",
        "key_players": ["Axar Patel", "Kuldeep Yadav", "KL Rahul", "Mitchell Starc", "Tristan Stubbs"],
        "squad_2026": ["AR Patel","KL Rahul","Kuldeep Yadav","MA Starc","T Stubbs","N Rana","P Nissanka","L Ngidi","Mukesh Kumar","T Natarajan","Sameer Rizvi","V Nigam","P Shaw","K Nair","A Sharma","S Parakh","A Porel","A Nabi","M Tiwari","T Vijay","A Mandal","D Chameera","D Miller","K Jamieson"],
    },
    "PBKS": {
        "name": "Punjab Kings", "short": "PBKS",
        "captain": "Shreyas Iyer", "coach": "Trevor Bayliss",
        "home_ground": "New PCA Stadium, Mullanpur",
        "primary_color": "#DD1F2D", "secondary_color": "#A7A9AC", "group": "A",
        "key_players": ["Shreyas Iyer", "Arshdeep Singh", "Yuzvendra Chahal", "Marco Jansen", "Marcus Stoinis"],
        "squad_2026": ["SS Iyer","Arshdeep Singh","YS Chahal","M Jansen","MP Stoinis","P Simran Singh","N Wadhera","Priyansh Arya","Shashank Singh","Vijaykumar Vyshak","XC Bartlett","C Connolly","H Brar","Musheer Khan","S Shedge","P Dubey","V Nishad","Y Thakur","A Omarzai","B Dwarshuis","M Owen","L Ferguson","H Singh","V Vishnu"],
    },
    "RR": {
        "name": "Rajasthan Royals", "short": "RR",
        "captain": "Riyan Parag", "coach": "Kumar Sangakkara",
        "home_ground": "Sawai Mansingh Stadium, Jaipur",
        "primary_color": "#EA1A85", "secondary_color": "#254AA5", "group": "A",
        "key_players": ["Riyan Parag", "Yashasvi Jaiswal", "Ravindra Jadeja", "Jofra Archer", "Shimron Hetmyer"],
        "squad_2026": ["R Parag","YBK Jaiswal","RA Jadeja","JC Archer","SO Hetmyer","Dhruv Jurel","V Suryavanshi","Sandeep Sharma","Ravi Bishnoi","N Burger","Brijesh Sharma","S Dubey","T Deshpande","A Rao","R Singh","Y Punja","V Puthur","S Mishra","K Sen","L Pretorius","D Ferreira","K Maphaka","A Milne","D Shanaka"],
    },
    "LSG": {
        "name": "Lucknow Super Giants", "short": "LSG",
        "captain": "Rishabh Pant", "coach": "Justin Langer",
        "home_ground": "Ekana Cricket Stadium, Lucknow",
        "primary_color": "#A72056", "secondary_color": "#FFCC00", "group": "B",
        "key_players": ["Rishabh Pant", "Nicholas Pooran", "Mitchell Marsh", "Avesh Khan", "Mayank Yadav"],
        "squad_2026": ["RR Pant","N Pooran","MR Marsh","AK Markram","A Nortje","A Badoni","Abdul Samad","Shahbaz Ahmed","Mohammed Shami","Mohsin Khan","Avesh Khan","Prince Yadav","MD Choudhary","H Singh","A Raghuwanshi","A Kulkarni","D Rathi","M Siddharth","A Singh","Mayank Yadav","N Tiwari","M Breetzke","J Inglis","W Hasaranga","A Tendulkar"],
    },
    "GT": {
        "name": "Gujarat Titans", "short": "GT",
        "captain": "Shubman Gill", "coach": "Ashish Nehra",
        "home_ground": "Narendra Modi Stadium, Ahmedabad",
        "primary_color": "#1C1C1C", "secondary_color": "#0B4973", "group": "B",
        "key_players": ["Shubman Gill", "Rashid Khan", "Jos Buttler", "Kagiso Rabada", "Sai Sudharsan"],
        "squad_2026": ["Shubman Gill","B Sai Sudharsan","Rashid Khan","K Rabada","JC Buttler","GD Phillips","Washington Sundar","R Tewatia","Mohammed Siraj","M Prasidh Krishna","M Shahrukh Khan","Ashok Sharma","A Rawat","K Kushagra","M Suthar","N Sindhu","J Yadav","A Khan","R Sai Kishore","G Brar","I Sharma","L Wood","T Banton","J Holder","K Khejroliya"],
    },
}

SCHEDULE = [
    {"match":1,"date":"2026-03-28","team1":"RCB","team2":"SRH","venue":"M. Chinnaswamy Stadium, Bengaluru","time":"19:30"},
    {"match":2,"date":"2026-03-29","team1":"MI","team2":"KKR","venue":"Wankhede Stadium, Mumbai","time":"19:30"},
    {"match":3,"date":"2026-03-30","team1":"RR","team2":"CSK","venue":"ACA Stadium, Guwahati","time":"19:30"},
    {"match":4,"date":"2026-03-31","team1":"PBKS","team2":"GT","venue":"New PCA Stadium, Mullanpur","time":"19:30"},
    {"match":5,"date":"2026-04-01","team1":"LSG","team2":"DC","venue":"Ekana Cricket Stadium, Lucknow","time":"19:30"},
    {"match":6,"date":"2026-04-02","team1":"KKR","team2":"SRH","venue":"Eden Gardens, Kolkata","time":"19:30"},
    {"match":7,"date":"2026-04-03","team1":"CSK","team2":"PBKS","venue":"M.A. Chidambaram Stadium, Chennai","time":"19:30"},
    {"match":8,"date":"2026-04-04","team1":"DC","team2":"MI","venue":"Arun Jaitley Stadium, Delhi","time":"15:30"},
    {"match":9,"date":"2026-04-04","team1":"GT","team2":"RR","venue":"Narendra Modi Stadium, Ahmedabad","time":"19:30"},
    {"match":10,"date":"2026-04-05","team1":"SRH","team2":"LSG","venue":"Rajiv Gandhi Intl. Stadium, Hyderabad","time":"15:30"},
    {"match":11,"date":"2026-04-05","team1":"RCB","team2":"CSK","venue":"M. Chinnaswamy Stadium, Bengaluru","time":"19:30"},
    {"match":12,"date":"2026-04-06","team1":"KKR","team2":"PBKS","venue":"Eden Gardens, Kolkata","time":"19:30"},
    {"match":13,"date":"2026-04-07","team1":"RR","team2":"MI","venue":"ACA Stadium, Guwahati","time":"19:30"},
    {"match":14,"date":"2026-04-08","team1":"DC","team2":"GT","venue":"Arun Jaitley Stadium, Delhi","time":"19:30"},
    {"match":15,"date":"2026-04-09","team1":"KKR","team2":"LSG","venue":"Eden Gardens, Kolkata","time":"19:30"},
    {"match":16,"date":"2026-04-10","team1":"RR","team2":"RCB","venue":"ACA Stadium, Guwahati","time":"19:30"},
    {"match":17,"date":"2026-04-11","team1":"PBKS","team2":"SRH","venue":"New PCA Stadium, Mullanpur","time":"15:30"},
    {"match":18,"date":"2026-04-11","team1":"CSK","team2":"DC","venue":"M.A. Chidambaram Stadium, Chennai","time":"19:30"},
    {"match":19,"date":"2026-04-12","team1":"LSG","team2":"GT","venue":"Ekana Cricket Stadium, Lucknow","time":"15:30"},
    {"match":20,"date":"2026-04-12","team1":"MI","team2":"RCB","venue":"Wankhede Stadium, Mumbai","time":"19:30"},
    {"match":21,"date":"2026-04-13","team1":"SRH","team2":"RR","venue":"Rajiv Gandhi Intl. Stadium, Hyderabad","time":"19:30"},
    {"match":22,"date":"2026-04-14","team1":"DC","team2":"LSG","venue":"Arun Jaitley Stadium, Delhi","time":"19:30"},
    {"match":23,"date":"2026-04-15","team1":"GT","team2":"KKR","venue":"Narendra Modi Stadium, Ahmedabad","time":"19:30"},
    {"match":24,"date":"2026-04-16","team1":"MI","team2":"PBKS","venue":"Wankhede Stadium, Mumbai","time":"19:30"},
    {"match":25,"date":"2026-04-17","team1":"CSK","team2":"RCB","venue":"M.A. Chidambaram Stadium, Chennai","time":"19:30"},
    {"match":26,"date":"2026-04-18","team1":"RR","team2":"GT","venue":"Sawai Mansingh Stadium, Jaipur","time":"19:30"},
    {"match":27,"date":"2026-04-19","team1":"LSG","team2":"SRH","venue":"Ekana Cricket Stadium, Lucknow","time":"15:30"},
    {"match":28,"date":"2026-04-19","team1":"KKR","team2":"MI","venue":"Eden Gardens, Kolkata","time":"19:30"},
    {"match":29,"date":"2026-04-20","team1":"DC","team2":"CSK","venue":"Arun Jaitley Stadium, Delhi","time":"19:30"},
    {"match":30,"date":"2026-04-20","team1":"PBKS","team2":"RCB","venue":"New PCA Stadium, Mullanpur","time":"19:30"},
    {"match":31,"date":"2026-04-21","team1":"SRH","team2":"GT","venue":"Rajiv Gandhi Intl. Stadium, Hyderabad","time":"19:30"},
    {"match":32,"date":"2026-04-22","team1":"MI","team2":"CSK","venue":"Wankhede Stadium, Mumbai","time":"15:30"},
    {"match":33,"date":"2026-04-22","team1":"RR","team2":"KKR","venue":"Sawai Mansingh Stadium, Jaipur","time":"19:30"},
    {"match":34,"date":"2026-04-23","team1":"LSG","team2":"PBKS","venue":"Ekana Cricket Stadium, Lucknow","time":"19:30"},
    {"match":35,"date":"2026-04-24","team1":"RCB","team2":"DC","venue":"M. Chinnaswamy Stadium, Bengaluru","time":"19:30"},
    {"match":36,"date":"2026-04-25","team1":"GT","team2":"SRH","venue":"Narendra Modi Stadium, Ahmedabad","time":"19:30"},
    {"match":37,"date":"2026-04-26","team1":"CSK","team2":"RR","venue":"M.A. Chidambaram Stadium, Chennai","time":"15:30"},
    {"match":38,"date":"2026-04-26","team1":"KKR","team2":"LSG","venue":"Eden Gardens, Kolkata","time":"19:30"},
    {"match":39,"date":"2026-04-27","team1":"MI","team2":"DC","venue":"Wankhede Stadium, Mumbai","time":"19:30"},
    {"match":40,"date":"2026-04-27","team1":"PBKS","team2":"SRH","venue":"New PCA Stadium, Mullanpur","time":"19:30"},
    {"match":41,"date":"2026-04-29","team1":"MI","team2":"SRH","venue":"Wankhede Stadium, Mumbai","time":"19:30"},
    {"match":42,"date":"2026-04-30","team1":"GT","team2":"RCB","venue":"Narendra Modi Stadium, Ahmedabad","time":"19:30"},
    {"match":43,"date":"2026-05-01","team1":"RR","team2":"DC","venue":"Sawai Mansingh Stadium, Jaipur","time":"19:30"},
    {"match":44,"date":"2026-05-02","team1":"CSK","team2":"MI","venue":"M.A. Chidambaram Stadium, Chennai","time":"19:30"},
    {"match":45,"date":"2026-05-03","team1":"SRH","team2":"KKR","venue":"Rajiv Gandhi Intl. Stadium, Hyderabad","time":"15:30"},
    {"match":46,"date":"2026-05-03","team1":"GT","team2":"PBKS","venue":"Narendra Modi Stadium, Ahmedabad","time":"19:30"},
    {"match":47,"date":"2026-05-04","team1":"MI","team2":"LSG","venue":"Wankhede Stadium, Mumbai","time":"19:30"},
    {"match":48,"date":"2026-05-05","team1":"DC","team2":"CSK","venue":"Arun Jaitley Stadium, Delhi","time":"19:30"},
    {"match":49,"date":"2026-05-06","team1":"SRH","team2":"PBKS","venue":"Rajiv Gandhi Intl. Stadium, Hyderabad","time":"19:30"},
    {"match":50,"date":"2026-05-07","team1":"LSG","team2":"RCB","venue":"Ekana Cricket Stadium, Lucknow","time":"19:30"},
    {"match":51,"date":"2026-05-08","team1":"DC","team2":"KKR","venue":"Arun Jaitley Stadium, Delhi","time":"19:30"},
    {"match":52,"date":"2026-05-09","team1":"RR","team2":"GT","venue":"Sawai Mansingh Stadium, Jaipur","time":"19:30"},
    {"match":53,"date":"2026-05-10","team1":"CSK","team2":"LSG","venue":"M.A. Chidambaram Stadium, Chennai","time":"15:30"},
    {"match":54,"date":"2026-05-10","team1":"RCB","team2":"MI","venue":"Shaheed Veer Narayan Singh Stadium, Raipur","time":"19:30"},
    {"match":55,"date":"2026-05-11","team1":"PBKS","team2":"DC","venue":"HPCA Stadium, Dharamsala","time":"19:30"},
    {"match":56,"date":"2026-05-12","team1":"GT","team2":"SRH","venue":"Narendra Modi Stadium, Ahmedabad","time":"19:30"},
    {"match":57,"date":"2026-05-13","team1":"RCB","team2":"KKR","venue":"Shaheed Veer Narayan Singh Stadium, Raipur","time":"19:30"},
    {"match":58,"date":"2026-05-14","team1":"PBKS","team2":"MI","venue":"HPCA Stadium, Dharamsala","time":"19:30"},
    {"match":59,"date":"2026-05-15","team1":"LSG","team2":"CSK","venue":"Ekana Cricket Stadium, Lucknow","time":"19:30"},
    {"match":60,"date":"2026-05-16","team1":"KKR","team2":"GT","venue":"Eden Gardens, Kolkata","time":"19:30"},
    {"match":61,"date":"2026-05-17","team1":"DC","team2":"PBKS","venue":"Arun Jaitley Stadium, Delhi","time":"19:30"},
    {"match":62,"date":"2026-05-17","team1":"CSK","team2":"RR","venue":"M.A. Chidambaram Stadium, Chennai","time":"19:30"},
    {"match":63,"date":"2026-05-18","team1":"LSG","team2":"MI","venue":"Ekana Cricket Stadium, Lucknow","time":"19:30"},
    {"match":64,"date":"2026-05-18","team1":"RCB","team2":"SRH","venue":"M. Chinnaswamy Stadium, Bengaluru","time":"19:30"},
    {"match":65,"date":"2026-05-19","team1":"GT","team2":"DC","venue":"Narendra Modi Stadium, Ahmedabad","time":"19:30"},
    {"match":66,"date":"2026-05-19","team1":"KKR","team2":"PBKS","venue":"Eden Gardens, Kolkata","time":"19:30"},
    {"match":67,"date":"2026-05-20","team1":"CSK","team2":"RCB","venue":"M.A. Chidambaram Stadium, Chennai","time":"19:30"},
    {"match":68,"date":"2026-05-20","team1":"RR","team2":"LSG","venue":"Sawai Mansingh Stadium, Jaipur","time":"19:30"},
    {"match":69,"date":"2026-05-21","team1":"MI","team2":"GT","venue":"Wankhede Stadium, Mumbai","time":"19:30"},
    {"match":70,"date":"2026-05-24","team1":"DC","team2":"KKR","venue":"Arun Jaitley Stadium, Delhi","time":"19:30"},
    {"match":71,"date":"2026-05-27","team1":"TBD","team2":"TBD","venue":"TBD","time":"19:30","stage":"Qualifier 1"},
    {"match":72,"date":"2026-05-28","team1":"TBD","team2":"TBD","venue":"TBD","time":"19:30","stage":"Eliminator"},
    {"match":73,"date":"2026-05-30","team1":"TBD","team2":"TBD","venue":"TBD","time":"19:30","stage":"Qualifier 2"},
    {"match":74,"date":"2026-05-31","team1":"TBD","team2":"TBD","venue":"TBD","time":"19:30","stage":"Final"},
]

# ─── CricSheet data fetcher ───────────────────────────────────────────────────

def download_cricsheet():
    print("⬇  Downloading CricSheet IPL data...")
    os.makedirs(RAW_DIR, exist_ok=True)
    resp = requests.get(CRICSHEET_URL, timeout=180)
    resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content), "r") as zf:
        zf.extractall(RAW_DIR)
    print(f"   Extracted to {RAW_DIR}")

def load_deliveries():
    delivery_files = glob.glob(os.path.join(RAW_DIR, "[0-9]*.csv"))
    delivery_files = [f for f in delivery_files if "_info" not in os.path.basename(f)]
    frames = []
    for fp in delivery_files:
        try: frames.append(pd.read_csv(fp, low_memory=False))
        except: continue
    if not frames: raise RuntimeError("No delivery files found")
    df = pd.concat(frames, ignore_index=True)
    df = df[df["innings"].isin([1, 2])]
    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    return df

def load_match_info():
    info_files = glob.glob(os.path.join(RAW_DIR, "*_info.csv"))
    rows = []
    for fp in info_files:
        mid = os.path.basename(fp).replace("_info.csv", "")
        try:
            with open(fp, "r", encoding="utf-8") as fh:
                for line in fh:
                    parts = line.strip().split(",", 3)
                    if len(parts) >= 3 and parts[0] == "info":
                        rows.append({"match_id": mid, "field": parts[1],
                                     "value": parts[2] if len(parts) == 3 else ",".join(parts[2:])})
        except: continue
    return pd.DataFrame(rows)

# ─── Builders ─────────────────────────────────────────────────────────────────

def build_h2h(info_df):
    print("🏏 Building H2H data...")
    winners = info_df[info_df["field"] == "winner"][["match_id", "value"]].copy()
    winners.columns = ["match_id", "winner"]
    teams = info_df[info_df["field"] == "team"][["match_id", "value"]].copy()
    teams.columns = ["match_id", "team"]
    match_teams = teams.groupby("match_id")["team"].apply(list).reset_index()
    match_teams = match_teams[match_teams["team"].apply(len) == 2]
    outcomes = info_df[info_df["field"] == "outcome"][["match_id", "value"]].copy()
    outcomes.columns = ["match_id", "outcome"]
    merged = match_teams.merge(winners, on="match_id", how="left").merge(outcomes, on="match_id", how="left")

    # Also get margins, dates, venues, seasons for match results
    def _ext(field):
        sub = info_df[info_df["field"] == field][["match_id", "value"]].copy()
        sub.columns = ["match_id", field]
        sub["match_id"] = sub["match_id"].astype(str)
        return sub
    winner_runs = _ext("winner_runs")
    winner_wickets = _ext("winner_wickets")
    dates = _ext("date")
    venues = _ext("venue")
    seasons = _ext("season")
    merged["match_id"] = merged["match_id"].astype(str)
    for extra in [winner_runs, winner_wickets, dates, venues, seasons]:
        merged = merged.merge(extra, on="match_id", how="left")

    h2h = {}
    for _, row in merged.iterrows():
        t1_full, t2_full = row["team"][0], row["team"][1]
        t1, t2 = _code(t1_full), _code(t2_full)
        if t1 not in CURRENT_TEAMS or t2 not in CURRENT_TEAMS: continue
        key = "_".join(sorted([t1, t2]))
        if key not in h2h:
            h2h[key] = {"team1": sorted([t1,t2])[0], "team2": sorted([t1,t2])[1],
                        "team1_wins": 0, "team2_wins": 0, "no_result": 0, "total": 0, "results": []}
        rec = h2h[key]
        rec["total"] += 1
        winner = row.get("winner")
        w_code = _code(winner) if pd.notna(winner) else None
        if w_code == rec["team1"]: rec["team1_wins"] += 1
        elif w_code == rec["team2"]: rec["team2_wins"] += 1
        else: rec["no_result"] += 1

        margin = ""
        if pd.notna(row.get("winner_runs")): margin = f"by {int(float(row['winner_runs']))} runs"
        elif pd.notna(row.get("winner_wickets")): margin = f"by {int(float(row['winner_wickets']))} wickets"
        result_text = f"{w_code} won {margin}" if w_code else "No result"
        raw_date = str(row.get("date", "")).replace("/", "-")

        rec["results"].append({
            "date": raw_date, "season": str(row.get("season", "")),
            "venue": str(row.get("venue", "")), "winner": w_code or "",
            "margin": margin, "result_text": result_text,
        })

    for rec in h2h.values():
        rec["results"].sort(key=lambda r: r["date"], reverse=True)
    return h2h

def build_venues(df, info_df):
    print("🏟  Building venue stats...")
    df["total_runs"] = df["runs_off_bat"].fillna(0) + df["extras"].fillna(0)
    inn_tot = df.groupby(["match_id","innings"]).agg(runs=("total_runs","sum"), venue=("venue","first")).reset_index()
    inn_tot["venue_norm"] = inn_tot["venue"].apply(_norm_venue)
    avg_first = inn_tot[inn_tot["innings"]==1].groupby("venue_norm")["runs"].mean()
    avg_second = inn_tot[inn_tot["innings"]==2].groupby("venue_norm")["runs"].mean()

    winners = info_df[info_df["field"]=="winner"][["match_id","value"]].copy()
    winners.columns = ["match_id","winner"]; winners["match_id"] = winners["match_id"].astype(str)
    toss_dec = info_df[info_df["field"]=="toss_decision"][["match_id","value"]].copy()
    toss_dec.columns = ["match_id","toss_decision"]; toss_dec["match_id"] = toss_dec["match_id"].astype(str)
    toss_win = info_df[info_df["field"]=="toss_winner"][["match_id","value"]].copy()
    toss_win.columns = ["match_id","toss_winner"]; toss_win["match_id"] = toss_win["match_id"].astype(str)
    mt = info_df[info_df["field"]=="team"][["match_id","value"]].copy()
    mt.columns = ["match_id","team"]; mt["match_id"] = mt["match_id"].astype(str)
    match_teams = mt.groupby("match_id")["team"].apply(list).reset_index()
    match_teams = match_teams[match_teams["team"].apply(len)==2]

    meta = match_teams.merge(toss_win, on="match_id", how="left").merge(toss_dec, on="match_id", how="left").merge(winners, on="match_id", how="left")
    mv = df.drop_duplicates("match_id")[["match_id","venue"]].copy()
    mv["match_id"] = mv["match_id"].astype(str)
    mv["venue_norm"] = mv["venue"].apply(_norm_venue)
    meta = meta.merge(mv[["match_id","venue_norm"]], on="match_id", how="left")

    def _bf(row):
        tl = row["team"]; tw = row.get("toss_winner"); td = row.get("toss_decision")
        if pd.isna(tw) or pd.isna(td): return tl[0]
        return tw if td == "bat" else ([t for t in tl if t != tw][0] if len(tl)==2 else tl[0])
    meta["bat_first"] = meta.apply(_bf, axis=1)

    vr = {}
    for _, row in meta.iterrows():
        v = row.get("venue_norm")
        if pd.isna(v) or v == "Unknown": continue
        w = row.get("winner"); bf = row.get("bat_first")
        if pd.isna(w) or pd.isna(bf): continue
        if v not in vr: vr[v] = {"matches":0,"bat_first_wins":0,"bat_second_wins":0}
        vr[v]["matches"] += 1
        if w == bf: vr[v]["bat_first_wins"] += 1
        else: vr[v]["bat_second_wins"] += 1

    venues = {}
    for v, rec in vr.items():
        total = rec["matches"]; bf_w = rec["bat_first_wins"]; bs_w = rec["bat_second_wins"]
        bf_pct = round(bf_w/total*100,1) if total else 50
        bs_pct = round(bs_w/total*100,1) if total else 50
        a1 = int(round(avg_first.get(v,165))); a2 = int(round(avg_second.get(v,155)))
        nature = "Defend-Friendly" if bf_pct > 53 else ("Chase-Friendly" if bs_pct > 53 else "Balanced")
        venues[v] = {"matches":total,"bat_first_wins":bf_w,"bat_second_wins":bs_w,
                      "bat_first_pct":bf_pct,"bat_second_pct":bs_pct,
                      "avg_1st_innings":a1,"avg_2nd_innings":a2,"nature":nature}
    return venues

def build_bvb(df):
    print("⚡ Building batter vs bowler data...")
    df["is_bowler_wicket"] = df["wicket_type"].isin(BOWLER_WKT_TYPES).astype(int)
    df["is_dot"] = (df["runs_off_bat"]==0).astype(int)
    df["is_four"] = (df["runs_off_bat"]==4).astype(int)
    df["is_six"] = (df["runs_off_bat"]==6).astype(int)
    df["is_legal"] = df["wides"].isna().astype(int)

    agg = df.groupby(["striker","bowler"]).agg(
        balls=("is_legal","sum"), runs=("runs_off_bat","sum"),
        dismissals=("is_bowler_wicket","sum"), dots=("is_dot","sum"),
        fours=("is_four","sum"), sixes=("is_six","sum"),
    ).reset_index()
    agg = agg[agg["balls"] >= 1].copy()
    agg["sr"] = (agg["runs"]/agg["balls"]*100).round(1)
    agg["avg"] = agg.apply(lambda r: round(r["runs"]/r["dismissals"],1) if r["dismissals"]>0 else 0, axis=1)

    bvb_list = []
    for _, r in agg.iterrows():
        bvb_list.append({
            "batter": r["striker"], "bowler": r["bowler"],
            "balls": int(r["balls"]), "runs": int(r["runs"]),
            "dismissals": int(r["dismissals"]), "dots": int(r["dots"]),
            "fours": int(r["fours"]), "sixes": int(r["sixes"]),
            "sr": float(r["sr"]), "avg": float(r["avg"]),
        })

    # innings breakdown for matchups with >= 3 balls
    print("📋 Building BvB innings breakdowns...")
    sig = agg[agg["balls"] >= 3][["striker","bowler"]].values.tolist()
    sig_set = {(s,b) for s,b in sig}

    innings_map = {}
    for (mid, inn, striker, bowler), grp in df.groupby(["match_id","innings","striker","bowler"]):
        if (striker, bowler) not in sig_set: continue
        key = f"{striker}__{bowler}"
        grp_legal = grp[grp["wides"].isna()]
        inn_date = str(grp["start_date"].iloc[0]).split(" ")[0] if "start_date" in grp.columns else ""
        inn_venue = str(grp["venue"].iloc[0]) if "venue" in grp.columns else ""
        entry = {
            "runs": int(grp["runs_off_bat"].sum()), "balls": len(grp_legal),
            "dismissed": int(grp["wicket_type"].isin(BOWLER_WKT_TYPES).sum()) > 0,
            "date": inn_date, "venue": inn_venue,
            "fours": int((grp["runs_off_bat"]==4).sum()),
            "sixes": int((grp["runs_off_bat"]==6).sum()),
        }
        innings_map.setdefault(key, []).append(entry)

    for v in innings_map.values():
        v.sort(key=lambda x: x["date"], reverse=True)

    return bvb_list, innings_map

def build_batter_team(df):
    print("🏏 Building batter vs team data...")
    df["bowling_team_code"] = df["bowling_team"].map(_code)
    df["is_bowler_wicket"] = df["wicket_type"].isin(BOWLER_WKT_TYPES).astype(int)
    df["is_legal"] = df["wides"].isna().astype(int)

    result = {}
    for (batter, bt_code), grp in df.groupby(["striker","bowling_team_code"]):
        if bt_code not in CURRENT_TEAMS: continue
        legal = grp[grp["wides"].isna()]
        balls = len(legal); runs = int(grp["runs_off_bat"].sum())
        if balls < 6: continue
        dismissals = int(grp["wicket_type"].isin(BOWLER_WKT_TYPES).sum())
        dots = int((legal["runs_off_bat"]==0).sum())
        fours = int((grp["runs_off_bat"]==4).sum())
        sixes = int((grp["runs_off_bat"]==6).sum())
        sr = round(runs/balls*100, 1) if balls else 0
        avg = round(runs/dismissals, 1) if dismissals > 0 else 0
        matches = grp["match_id"].nunique()

        innings = []
        for (mid, inn), ig in grp.groupby(["match_id","innings"]):
            ig_legal = ig[ig["wides"].isna()]
            i_date = str(ig["start_date"].iloc[0]).split(" ")[0] if "start_date" in ig.columns else ""
            i_venue = str(ig["venue"].iloc[0]) if "venue" in ig.columns else ""
            innings.append({
                "runs": int(ig["runs_off_bat"].sum()), "balls": len(ig_legal),
                "dismissed": int(ig["wicket_type"].isin(BOWLER_WKT_TYPES).sum()) > 0,
                "date": i_date, "venue": i_venue,
                "fours": int((ig["runs_off_bat"]==4).sum()),
                "sixes": int((ig["runs_off_bat"]==6).sum()),
            })
        innings.sort(key=lambda x: x["date"], reverse=True)

        result[f"{batter}__{bt_code}"] = {
            "batter": batter, "team": bt_code, "balls": balls, "runs": runs,
            "dismissals": dismissals, "dots": dots, "fours": fours, "sixes": sixes,
            "sr": sr, "avg": avg, "matches": matches, "innings": innings,
        }
    return result

def build_milestones(df):
    print("🎯 Building milestones...")
    df["is_legal"] = df["wides"].isna().astype(int)
    df["is_bowler_wicket"] = df["wicket_type"].isin(BOWLER_WKT_TYPES).astype(int)

    player_to_team = {}
    for code, meta in TEAMS.items():
        for name in meta.get("squad_2026", []):
            player_to_team[name] = code

    bat = df.groupby("striker").agg(total_runs=("runs_off_bat","sum")).reset_index()
    bat = bat[bat["striker"].isin(player_to_team)].copy()
    bat["team"] = bat["striker"].map(player_to_team)

    bowl = df.groupby("bowler").agg(wickets=("is_bowler_wicket","sum")).reset_index()
    bowl = bowl[bowl["bowler"].isin(player_to_team)].copy()
    bowl["team"] = bowl["bowler"].map(player_to_team)

    milestones, watchlist = [], []
    for _, r in bat.iterrows():
        val = int(r["total_runs"])
        if val < 450: continue
        nxt = ((val//500)+1)*500; needed = nxt - val
        entry = {"player":r["striker"],"team":r["team"],"milestone":f"{nxt:,} IPL Runs",
                 "current":f"{val:,} runs","needed":f"{needed} runs","icon":"🏏",
                 "detail":f"Currently at {val:,}, needs {needed} more to reach {nxt:,}",
                 "_n":needed}
        if needed <= 50: milestones.append(entry)
        elif needed <= 200: watchlist.append(entry)

    for _, r in bowl.iterrows():
        val = int(r["wickets"])
        if val < 45: continue
        nxt = ((val//50)+1)*50; needed = nxt - val
        entry = {"player":r["bowler"],"team":r["team"],"milestone":f"{nxt} IPL Wickets",
                 "current":f"{val} wickets","needed":f"{needed} wickets","icon":"🪵",
                 "detail":f"Currently at {val}, needs {needed} more to reach {nxt}",
                 "_n":needed}
        if needed <= 5: milestones.append(entry)
        elif needed <= 20: watchlist.append(entry)

    milestones.sort(key=lambda m: m["_n"])
    watchlist.sort(key=lambda m: m["_n"])
    for m in milestones: m.pop("_n")
    for m in watchlist: m.pop("_n"); m["icon"] = "👀"
    return {"imminent": milestones[:15], "watchlist": watchlist[:15]}

# ─── Points Table (2026 Season) ────────────────────────────────────────────────

def build_points_table(df, info_df):
    print("🏆 Building 2026 points table...")
    df_2026 = df[df["start_date"].dt.year == 2026].copy()
    if df_2026.empty:
        return {"standings": [], "team_results": {}}

    df_2026["total_runs"] = df_2026["runs_off_bat"].fillna(0) + df_2026["extras"].fillna(0)
    df_2026["is_legal"] = df_2026["wides"].isna() & df_2026["noballs"].isna()

    # Per-team per-match aggregation for NRR
    match_team_stats = {}
    for (mid, inn, bat_team), grp in df_2026.groupby(["match_id", "innings", "batting_team"]):
        key = (str(mid), _code(bat_team))
        runs = int(grp["total_runs"].sum())
        legal = grp["is_legal"].sum()
        overs = legal / 6
        # Check if all out (last wicket in innings)
        all_out = grp["wicket_type"].notna().sum()
        max_ball = grp["ball"].max() if "ball" in grp.columns else 0
        match_team_stats.setdefault(str(mid), {})[_code(bat_team)] = {
            "runs_scored": runs, "overs_faced": round(overs, 1),
        }

    # Get match-level info for 2026
    info_2026_ids = set(df_2026["match_id"].astype(str).unique())
    rel_info = info_df[info_df["match_id"].astype(str).isin(info_2026_ids)]

    def _get(field):
        sub = rel_info[rel_info["field"] == field][["match_id", "value"]].copy()
        sub.columns = ["match_id", field]
        sub["match_id"] = sub["match_id"].astype(str)
        return sub

    winners = _get("winner")
    dates = _get("date")
    venues = _get("venue")
    teams_info = rel_info[rel_info["field"] == "team"][["match_id", "value"]].copy()
    teams_info.columns = ["match_id", "team"]
    teams_info["match_id"] = teams_info["match_id"].astype(str)
    match_teams = teams_info.groupby("match_id")["team"].apply(list).reset_index()
    match_teams = match_teams[match_teams["team"].apply(len) == 2]
    winner_runs = _get("winner_runs")
    winner_wickets = _get("winner_wickets")
    outcomes = _get("outcome")

    base = match_teams.copy()
    for extra in [winners, dates, venues, winner_runs, winner_wickets, outcomes]:
        base = base.merge(extra, on="match_id", how="left")

    # Build standings and results
    standings = {}
    team_results = {}

    for _, row in base.iterrows():
        mid = row["match_id"]
        t1_full, t2_full = row["team"][0], row["team"][1]
        t1, t2 = _code(t1_full), _code(t2_full)
        if t1 not in CURRENT_TEAMS or t2 not in CURRENT_TEAMS:
            continue

        for t in [t1, t2]:
            if t not in standings:
                standings[t] = {"team": t, "p": 0, "w": 0, "l": 0, "nr": 0, "pts": 0,
                                "nrr_for_runs": 0, "nrr_for_overs": 0,
                                "nrr_against_runs": 0, "nrr_against_overs": 0}

        winner_full = row.get("winner")
        w_code = _code(winner_full) if pd.notna(winner_full) else None

        standings[t1]["p"] += 1
        standings[t2]["p"] += 1

        if w_code and w_code in (t1, t2):
            loser = t2 if w_code == t1 else t1
            standings[w_code]["w"] += 1
            standings[w_code]["pts"] += 2
            standings[loser]["l"] += 1
        else:
            standings[t1]["nr"] += 1
            standings[t2]["nr"] += 1
            standings[t1]["pts"] += 1
            standings[t2]["pts"] += 1

        # NRR components
        mts = match_team_stats.get(mid, {})
        for t, opp in [(t1, t2), (t2, t1)]:
            my = mts.get(t, {})
            their = mts.get(opp, {})
            standings[t]["nrr_for_runs"] += my.get("runs_scored", 0)
            standings[t]["nrr_for_overs"] += my.get("overs_faced", 0)
            standings[t]["nrr_against_runs"] += their.get("runs_scored", 0)
            standings[t]["nrr_against_overs"] += their.get("overs_faced", 0)

        # Build result entries for each team
        margin = ""
        if pd.notna(row.get("winner_runs")):
            margin = f"by {int(float(row['winner_runs']))} runs"
        elif pd.notna(row.get("winner_wickets")):
            margin = f"by {int(float(row['winner_wickets']))} wickets"
        result_text = f"{w_code} won {margin}" if w_code else "No result"
        raw_date = str(row.get("date", "")).replace("/", "-")
        venue = str(row.get("venue", ""))

        for t, opp in [(t1, t2), (t2, t1)]:
            won = w_code == t
            lost = w_code is not None and w_code != t
            team_results.setdefault(t, []).append({
                "date": raw_date, "opponent": opp, "venue": venue,
                "result": "W" if won else ("L" if lost else "NR"),
                "result_text": result_text, "margin": margin,
            })

    # Compute NRR
    for s in standings.values():
        nrr_for = (s["nrr_for_runs"] / s["nrr_for_overs"]) if s["nrr_for_overs"] > 0 else 0
        nrr_against = (s["nrr_against_runs"] / s["nrr_against_overs"]) if s["nrr_against_overs"] > 0 else 0
        s["nrr"] = round(nrr_for - nrr_against, 3)
        del s["nrr_for_runs"], s["nrr_for_overs"], s["nrr_against_runs"], s["nrr_against_overs"]

    # Sort: pts desc, nrr desc, w desc
    sorted_standings = sorted(standings.values(), key=lambda x: (-x["pts"], -x["nrr"], -x["w"]))

    # Sort each team's results by date desc
    for t in team_results:
        team_results[t].sort(key=lambda x: x["date"], reverse=True)

    return {"standings": sorted_standings, "team_results": team_results}


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    download_cricsheet()
    print("📊 Loading data...")
    df = load_deliveries()
    info_df = load_match_info()
    print(f"   {len(df):,} deliveries, {len(info_df):,} info rows")

    # Static data
    teams_out = {}
    squads_out = {}
    for code, meta in TEAMS.items():
        teams_out[code] = {k: v for k, v in meta.items() if k != "squad_2026"}
        squads_out[code] = meta["squad_2026"]

    _write("teams.json", teams_out)
    _write("squads.json", squads_out)
    _write("schedule.json", SCHEDULE)

    h2h = build_h2h(info_df)
    _write("h2h.json", h2h)

    venues = build_venues(df.copy(), info_df)
    _write("venues.json", venues)

    bvb_list, bvb_innings = build_bvb(df.copy())
    _write("bvb.json", bvb_list)
    _write("bvb_innings.json", bvb_innings)

    bt = build_batter_team(df.copy())
    _write("batter_team.json", bt)

    ms = build_milestones(df.copy())
    _write("milestones.json", ms)

    pts = build_points_table(df.copy(), info_df)
    _write("points_table.json", pts)

    print("✅ All data files written to data/")

def _write(name, obj):
    path = os.path.join(DATA_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(path) / 1024
    print(f"   📁 {name} ({size_kb:.0f} KB)")

if __name__ == "__main__":
    main()
