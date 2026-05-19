#!/usr/bin/env python3
"""Update IPL recent form database from a match input JSON."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any, Dict, List


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update data/ipl2026_recent_form.json from a match input file."
    )
    parser.add_argument(
        "--squads",
        default="data/ipl2026_squads.json",
        help="Path to squads JSON file.",
    )
    parser.add_argument(
        "--recent-form",
        default="data/ipl2026_recent_form.json",
        help="Path to recent form JSON file.",
    )
    parser.add_argument(
        "--match-file",
        required=True,
        help="Path to one match input JSON file.",
    )
    parser.add_argument(
        "--window-size",
        type=int,
        default=5,
        help="Rolling window size for last_* arrays.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def roster_lookup(squads: Dict[str, Any]) -> Dict[str, set]:
    lookup: Dict[str, set] = {}
    for team in squads.get("teams", []):
        players = set(team.get("players", []))
        captain = team.get("captain")
        if captain:
            players.add(captain)
        lookup[team["team"]] = players
    return lookup


def append_rolling(target: List[int], value: int, window_size: int) -> List[int]:
    out = [*target, int(value)]
    if len(out) > window_size:
        out = out[-window_size:]
    return out


def ensure_player_record(team_form: Dict[str, Any], player: str) -> Dict[str, Any]:
    return team_form.setdefault(
        player,
        {
            "last_fantasy_points": [],
            "last_runs": [],
            "last_wickets": [],
            "probable_xi": False,
            "playing_xi_count": 0,
        },
    )


def mark_playing_xi(
    db: Dict[str, Any],
    match: Dict[str, Any],
    valid_rosters: Dict[str, set],
) -> None:
    team_form = db.setdefault("player_form", {})
    playing_xi = match.get("playing_xi", {})
    for team_name, players in playing_xi.items():
        if team_name not in valid_rosters:
            raise ValueError(f"Unknown team in playing_xi: {team_name}")
        if not isinstance(players, list):
            raise ValueError(f"playing_xi for {team_name} must be a list")

        tform = team_form.setdefault(team_name, {})
        for player in players:
            if player not in valid_rosters[team_name]:
                raise ValueError(f"Unknown player '{player}' for team '{team_name}'")
            rec = ensure_player_record(tform, player)
            rec["playing_xi_count"] = int(rec.get("playing_xi_count", 0)) + 1
            rec["probable_xi"] = rec["playing_xi_count"] >= 2


def update_stats(
    db: Dict[str, Any],
    match: Dict[str, Any],
    valid_rosters: Dict[str, set],
    window_size: int,
) -> None:
    team_form = db.setdefault("player_form", {})
    player_stats = match.get("player_stats", [])
    if not isinstance(player_stats, list):
        raise ValueError("player_stats must be a list")

    for stat in player_stats:
        team_name = stat["team"]
        player = stat["player"]
        runs = int(stat.get("runs", 0))
        wickets = int(stat.get("wickets", 0))
        fantasy_points = int(stat.get("fantasy_points", 0))

        if team_name not in valid_rosters:
            raise ValueError(f"Unknown team in player_stats: {team_name}")
        if player not in valid_rosters[team_name]:
            raise ValueError(f"Unknown player '{player}' for team '{team_name}'")

        tform = team_form.setdefault(team_name, {})
        rec = ensure_player_record(tform, player)
        rec["last_runs"] = append_rolling(rec.get("last_runs", []), runs, window_size)
        rec["last_wickets"] = append_rolling(
            rec.get("last_wickets", []), wickets, window_size
        )
        rec["last_fantasy_points"] = append_rolling(
            rec.get("last_fantasy_points", []), fantasy_points, window_size
        )


def append_match_history(db: Dict[str, Any], match: Dict[str, Any]) -> None:
    history = db.setdefault("match_history", [])
    match_id = match["match_id"]
    if any(existing.get("match_id") == match_id for existing in history):
        raise ValueError(f"Duplicate match_id already present: {match_id}")

    history.append(
        {
            "match_id": match_id,
            "date": match.get("date"),
            "team_a": match.get("team_a"),
            "team_b": match.get("team_b"),
            "player_stats_count": len(match.get("player_stats", [])),
        }
    )


def main() -> None:
    args = parse_args()
    squads_path = Path(args.squads)
    recent_form_path = Path(args.recent_form)
    match_file_path = Path(args.match_file)

    squads = load_json(squads_path)
    db = load_json(recent_form_path)
    match = load_json(match_file_path)
    valid_rosters = roster_lookup(squads)

    required_keys = ["match_id", "date", "team_a", "team_b", "playing_xi", "player_stats"]
    missing = [key for key in required_keys if key not in match]
    if missing:
        raise ValueError(f"Missing required keys in match input: {', '.join(missing)}")

    append_match_history(db, match)
    mark_playing_xi(db, match, valid_rosters)
    update_stats(db, match, valid_rosters, args.window_size)
    db["last_updated"] = str(date.today())

    write_json(recent_form_path, db)
    print(f"Updated recent form DB: {recent_form_path}")
    print(f"Ingested match: {match['match_id']}")


if __name__ == "__main__":
    main()
