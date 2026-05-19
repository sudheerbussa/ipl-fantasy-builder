#!/usr/bin/env python3
"""Detect and resolve role conflicts from online overrides."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Set

OVERRIDES_PATH = Path("data/online_role_overrides.json")
REPORT_PATH = Path("data/online_role_conflicts_report.json")

# Higher priority first.
ROLE_PRECEDENCE = ["wicket_keeper", "all_rounder", "bowler", "batsman"]


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def chosen_role(roles: Set[str]) -> str:
    for role in ROLE_PRECEDENCE:
        if role in roles:
            return role
    return "batsman"


def main() -> None:
    data = load_json(OVERRIDES_PATH)
    teams = data.get("teams", {})

    conflict_report: Dict[str, List[Dict[str, Any]]] = {}
    total_conflicts = 0
    fixes_applied = 0

    for team_name, role_map in teams.items():
        player_roles: Dict[str, Set[str]] = {}
        for role, players in role_map.items():
            for player in players:
                player_roles.setdefault(player, set()).add(role)

        team_conflicts = []
        # Rebuild clean role buckets for this team.
        clean_buckets: Dict[str, List[str]] = {r: [] for r in ROLE_PRECEDENCE}

        for player, roles in sorted(player_roles.items()):
            if len(roles) > 1:
                total_conflicts += 1
                resolved = chosen_role(roles)
                team_conflicts.append(
                    {
                        "player": player,
                        "roles_found": sorted(roles),
                        "resolved_role": resolved,
                    }
                )
                fixes_applied += 1
                clean_buckets[resolved].append(player)
            else:
                only_role = next(iter(roles))
                if only_role not in clean_buckets:
                    clean_buckets[only_role] = []
                clean_buckets[only_role].append(player)

        # Sort and save back.
        for role in list(role_map.keys()):
            role_map[role] = sorted(clean_buckets.get(role, []))
        # Ensure all expected role buckets exist.
        for role in ROLE_PRECEDENCE:
            role_map.setdefault(role, [])

        if team_conflicts:
            conflict_report[team_name] = team_conflicts

    write_json(OVERRIDES_PATH, data)
    write_json(
        REPORT_PATH,
        {
            "total_conflicts": total_conflicts,
            "fixes_applied": fixes_applied,
            "role_precedence": ROLE_PRECEDENCE,
            "teams_with_conflicts": conflict_report,
        },
    )

    print(f"Conflicts found: {total_conflicts}")
    print(f"Fixes applied: {fixes_applied}")
    print(f"Report written: {REPORT_PATH}")


if __name__ == "__main__":
    main()
