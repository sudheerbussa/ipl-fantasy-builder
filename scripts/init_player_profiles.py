#!/usr/bin/env python3
"""Initialize static player profile categories from squads."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

SQUADS_PATH = Path("data/ipl2026_squads.json")
RECENT_FORM_PATH = Path("data/ipl2026_recent_form.json")
OUTPUT_PATH = Path("data/ipl2026_player_profiles.json")


# Manual role and tag assignments. Unlisted players default to "unknown".
MANUAL_OVERRIDES: Dict[str, Dict[str, Dict[str, Any]]] = {
    "Chennai Super Kings": {
        "Ruturaj Gaikwad": {"primary_role": "batsman", "tags": ["anchor"]},
        "MS Dhoni": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["finisher"]},
        "Sanju Samson": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["top_order"]},
        "Shivam Dube": {"primary_role": "all_rounder", "tags": ["finisher"]},
        "Noor Ahmad": {"primary_role": "bowler", "tags": ["wicket_taker", "spinner"]},
        "Khaleel Ahmed": {"primary_role": "bowler", "tags": ["pace"]},
    },
    "Delhi Capitals": {
        "KL Rahul": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["anchor"]},
        "Abishek Porel": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["top_order"]},
        "Axar Patel": {"primary_role": "all_rounder", "tags": ["spinner"]},
        "Kuldeep Yadav": {"primary_role": "bowler", "tags": ["wicket_taker", "spinner"]},
        "Mitchell Starc": {"primary_role": "bowler", "tags": ["death_bowler", "wicket_taker", "pace"]},
    },
    "Gujarat Titans": {
        "Jos Buttler": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["top_order"]},
        "Anuj Rawat": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Shubman Gill": {"primary_role": "batsman", "tags": ["anchor"]},
        "Rashid Khan": {"primary_role": "bowler", "tags": ["wicket_taker", "spinner"]},
        "Mohammed Siraj": {"primary_role": "bowler", "tags": ["pace", "wicket_taker"]},
        "Kagiso Rabada": {"primary_role": "bowler", "tags": ["death_bowler", "wicket_taker", "pace"]},
    },
    "Kolkata Knight Riders": {
        "Ajinkya Rahane": {"primary_role": "batsman", "tags": ["anchor"]},
        "Angkrish Raghuvanshi": {
            "primary_role": "wicket_keeper",
            "is_wicket_keeper": True,
            "tags": ["anchor", "probable_xi", "top_order"],
        },
        "Sunil Narine": {"primary_role": "all_rounder", "tags": ["wicket_taker", "spinner"]},
        "Varun Chakravarthy": {"primary_role": "bowler", "tags": ["wicket_taker", "spinner"]},
        "Tim Seifert": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Finn Allen": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["top_order"]},
    },
    "Lucknow Super Giants": {
        "Rishabh Pant": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["top_order"]},
        "Nicholas Pooran": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["finisher"]},
        "Josh Inglis": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Mitchell Marsh": {"primary_role": "all_rounder", "tags": ["top_order"]},
        "Mohammed Shami": {"primary_role": "bowler", "tags": ["wicket_taker", "pace"]},
        "Avesh Khan": {"primary_role": "bowler", "tags": ["death_bowler", "pace"]},
        "Wanindu Hasaranga": {"primary_role": "all_rounder", "tags": ["wicket_taker", "spinner"]},
    },
    "Mumbai Indians": {
        "Rohit Sharma": {"primary_role": "batsman", "tags": ["anchor"]},
        "Suryakumar Yadav": {"primary_role": "batsman", "tags": ["top_order"]},
        "Hardik Pandya": {"primary_role": "all_rounder", "tags": ["finisher"]},
        "Tilak Varma": {"primary_role": "batsman", "tags": ["top_order"]},
        "Jasprit Bumrah": {"primary_role": "bowler", "tags": ["death_bowler", "wicket_taker", "pace"]},
        "Quinton de Kock": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Ryan Rickelton": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
    },
    "Punjab Kings": {
        "Prabhsimran Singh": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Vishnu Vinod": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Shreyas Iyer": {"primary_role": "batsman", "tags": ["anchor"]},
        "Arshdeep Singh": {"primary_role": "bowler", "tags": ["death_bowler", "wicket_taker", "pace"]},
        "Yuzvendra Chahal": {"primary_role": "bowler", "tags": ["wicket_taker", "spinner"]},
        "Marco Jansen": {"primary_role": "all_rounder", "tags": ["pace"]},
        "Marcus Stoinis": {"primary_role": "all_rounder", "tags": ["finisher"]},
    },
    "Rajasthan Royals": {
        "Dhruv Jurel": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Donovan Ferreira": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["finisher"]},
        "Lhuan-dre Pretorius": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Riyan Parag": {"primary_role": "all_rounder", "tags": ["top_order"]},
        "Yashasvi Jaiswal": {"primary_role": "batsman", "tags": ["top_order"]},
        "Ravindra Jadeja": {"primary_role": "all_rounder", "tags": ["spinner"]},
        "Jofra Archer": {"primary_role": "bowler", "tags": ["death_bowler", "wicket_taker", "pace"]},
        "Ravi Bishnoi": {"primary_role": "bowler", "tags": ["wicket_taker", "spinner"]},
    },
    "Royal Challengers Bengaluru": {
        "Jitesh Sharma": {"primary_role": "wicket_keeper", "is_wicket_keeper": True},
        "Phil Salt": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["top_order"]},
        "Virat Kohli": {"primary_role": "batsman", "tags": ["anchor"]},
        "Rajat Patidar": {"primary_role": "batsman", "tags": ["top_order"]},
        "Krunal Pandya": {"primary_role": "all_rounder", "tags": ["spinner"]},
        "Josh Hazlewood": {"primary_role": "bowler", "tags": ["pace", "wicket_taker"]},
        "Bhuvneshwar Kumar": {"primary_role": "bowler", "tags": ["powerplay_bowler", "pace"]},
    },
    "Sunrisers Hyderabad": {
        "Ishan Kishan": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["top_order"]},
        "Heinrich Klaasen": {"primary_role": "wicket_keeper", "is_wicket_keeper": True, "tags": ["finisher"]},
        "Abhishek Sharma": {"primary_role": "all_rounder", "tags": ["top_order"]},
        "Travis Head": {"primary_role": "batsman", "tags": ["top_order"]},
        "Pat Cummins": {"primary_role": "bowler", "tags": ["pace", "wicket_taker"]},
        "Harshal Patel": {"primary_role": "bowler", "tags": ["death_bowler", "wicket_taker", "pace"]},
    },
}


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_squad_list(team: Dict[str, Any]) -> List[str]:
    players = list(team.get("players", []))
    captain = team.get("captain")
    if captain and captain not in players:
        players.insert(0, captain)
    return players


def infer_role_from_recent_form(team_form: Dict[str, Any], player: str) -> Dict[str, Any]:
    rec = team_form.get(player, {})
    runs = rec.get("last_runs", []) or []
    wickets = rec.get("last_wickets", []) or []
    playing_xi_count = int(rec.get("playing_xi_count", 0) or 0)

    avg_runs = (sum(runs) / len(runs)) if runs else 0.0
    avg_wickets = (sum(wickets) / len(wickets)) if wickets else 0.0

    tags: List[str] = []
    if avg_wickets >= 1.0:
        tags.append("wicket_taker")
    if avg_runs >= 25:
        tags.append("top_order")
    if avg_runs >= 35 and avg_wickets <= 0.2:
        tags.append("anchor")
    if avg_wickets >= 1.5:
        tags.append("death_bowler")
    if avg_runs >= 20 and avg_wickets >= 0.5:
        role = "all_rounder"
    elif avg_wickets >= 0.8:
        role = "bowler"
    else:
        role = "batsman"

    if playing_xi_count >= 2:
        tags.append("probable_xi")
    tags.append("auto_inferred")

    return {
        "primary_role": role,
        "is_wicket_keeper": False,
        "tags": sorted(set(tags)),
        "source": "auto_inferred_recent_form_v1",
    }


def main() -> None:
    squads = load_json(SQUADS_PATH)
    recent_form = load_json(RECENT_FORM_PATH) if RECENT_FORM_PATH.exists() else {"player_form": {}}
    player_form = recent_form.get("player_form", {})
    teams_out: Dict[str, Dict[str, Any]] = {}
    total_players = 0
    inferred_players = 0

    for team in squads.get("teams", []):
        team_name = team["team"]
        teams_out[team_name] = {}
        overrides = MANUAL_OVERRIDES.get(team_name, {})
        team_form = player_form.get(team_name, {})

        for player in get_squad_list(team):
            override = overrides.get(player, {})
            if override:
                profile = {
                    "primary_role": override.get("primary_role", "batsman"),
                    "is_wicket_keeper": bool(override.get("is_wicket_keeper", False)),
                    "tags": sorted(set(override.get("tags", []))),
                    "source": "static_manual_v1",
                }
            else:
                profile = infer_role_from_recent_form(team_form, player)
                inferred_players += 1
            teams_out[team_name][player] = profile
            total_players += 1

    payload = {
        "tournament": "Indian Premier League",
        "season": 2026,
        "notes": "Profiles combine static manual overrides and automatic role inference from recent form data. Review auto inferred tags as more matches are ingested.",
        "role_options": ["batsman", "bowler", "all_rounder", "wicket_keeper"],
        "tag_options": [
            "anchor",
            "top_order",
            "finisher",
            "spinner",
            "pace",
            "powerplay_bowler",
            "death_bowler",
            "wicket_taker",
            "probable_xi",
            "auto_inferred",
        ],
        "teams": teams_out,
        "stats": {
            "total_players": total_players,
            "manually_tagged_teams": len(MANUAL_OVERRIDES),
            "auto_inferred_players": inferred_players,
        },
    }

    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, ensure_ascii=True)
        file.write("\n")

    print(f"Wrote player profiles: {OUTPUT_PATH}")
    print(f"Players included: {total_players}")


if __name__ == "__main__":
    main()
