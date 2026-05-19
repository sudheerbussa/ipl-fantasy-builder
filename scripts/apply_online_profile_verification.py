#!/usr/bin/env python3
"""Apply online role overrides to player profiles and generate verification report."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Tuple

PROFILES_PATH = Path("data/ipl2026_player_profiles.json")
SQUADS_PATH = Path("data/ipl2026_squads.json")
OVERRIDES_PATH = Path("data/online_role_overrides.json")
REPORT_PATH = Path("data/online_profile_verification_report.json")


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def squad_lookup(squads: Dict[str, Any]) -> Dict[str, set]:
    out: Dict[str, set] = {}
    for team in squads.get("teams", []):
        players = set(team.get("players", []))
        cap = team.get("captain")
        if cap:
            players.add(cap)
        out[team["team"]] = players
    return out


def update_profile(profile: Dict[str, Any], role: str) -> Dict[str, Any]:
    tags = set(profile.get("tags", []))
    tags.discard("auto_inferred")
    if role == "bowler":
        tags.add("wicket_taker")
    if role == "wicket_keeper":
        tags.add("top_order")
    profile["primary_role"] = role
    profile["is_wicket_keeper"] = role == "wicket_keeper"
    profile["tags"] = sorted(tags)
    profile["source"] = "online_verified_v1"
    return profile


def main() -> None:
    profiles = load_json(PROFILES_PATH)
    squads = load_json(SQUADS_PATH)
    overrides = load_json(OVERRIDES_PATH)
    valid = squad_lookup(squads)
    teams_profiles = profiles.get("teams", {})

    updated = 0
    skipped_not_in_squad = 0
    missing_in_profiles = 0
    per_team: Dict[str, Dict[str, int]] = {}

    for team_name, role_map in overrides.get("teams", {}).items():
        per_team[team_name] = {"updated": 0, "skipped_not_in_squad": 0, "missing_in_profiles": 0}
        valid_players = valid.get(team_name, set())
        team_profiles = teams_profiles.get(team_name, {})
        for role, players in role_map.items():
            for player in players:
                if player not in valid_players:
                    skipped_not_in_squad += 1
                    per_team[team_name]["skipped_not_in_squad"] += 1
                    continue
                if player not in team_profiles:
                    missing_in_profiles += 1
                    per_team[team_name]["missing_in_profiles"] += 1
                    continue
                current = team_profiles[player]
                team_profiles[player] = update_profile(current, role)
                updated += 1
                per_team[team_name]["updated"] += 1

    profiles.setdefault("stats", {})
    profiles["stats"]["online_verified_updates"] = updated
    profiles["stats"]["online_verification_source"] = "online_role_overrides.json"
    write_json(PROFILES_PATH, profiles)

    report = {
      "updated_profiles": updated,
      "skipped_not_in_squad": skipped_not_in_squad,
      "missing_in_profiles": missing_in_profiles,
      "teams": per_team,
      "source_urls": overrides.get("source_urls", []),
      "note": "Some source pages may include stale names; those were skipped when absent in squad."
    }
    write_json(REPORT_PATH, report)

    print(f"Updated profiles: {updated}")
    print(f"Skipped not in squad: {skipped_not_in_squad}")
    print(f"Missing in profiles: {missing_in_profiles}")
    print(f"Report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
