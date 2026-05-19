#!/usr/bin/env python3
"""Query historical match points by date and team names."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Query match fantasy points.")
    parser.add_argument("--date", required=True, help="Match date YYYY-MM-DD")
    parser.add_argument("--team-a", required=True, help="Team A")
    parser.add_argument("--team-b", required=True, help="Team B")
    parser.add_argument(
        "--historical-dir",
        default="data/historical_matches",
        help="Path to historical matches folder.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    args = parse_args()
    match_dir = Path(args.historical_dir)
    files = sorted(match_dir.glob("*.json"))
    found: List[Dict[str, Any]] = []

    targets = {args.team_a.strip(), args.team_b.strip()}
    for file in files:
        match = load_json(file)
        if match.get("date") != args.date:
            continue
        teams = {match.get("team_a"), match.get("team_b")}
        if teams == targets:
            found.append(match)

    if not found:
        print("No matching match found in local historical dataset.")
        return

    for match in found:
        print(f"\nMatch: {match['match_id']} | {match['date']} | {match['team_a']} vs {match['team_b']}")
        for row in sorted(match.get("player_stats", []), key=lambda x: x.get("fantasy_points", 0), reverse=True):
            print(
                f"- {row['player']} ({row['team']}): FP={row.get('fantasy_points',0)} "
                f"Runs={row.get('runs',0)} Wkts={row.get('wickets',0)}"
            )


if __name__ == "__main__":
    main()
