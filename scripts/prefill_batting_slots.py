#!/usr/bin/env python3
"""
Prefill data/ipl2026_batting_slots.json from squads + player profiles.

Uses the same inference as generator_backtest_engine.infer_batting_slot_from_profile.

  python3 scripts/prefill_batting_slots.py           # full replace
  python3 scripts/prefill_batting_slots.py --merge   # keep existing slots, add new squad names only
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
SQUADS_PATH = ROOT / "data" / "ipl2026_squads.json"
PROFILES_PATH = ROOT / "data" / "ipl2026_player_profiles.json"
OUT_PATH = ROOT / "data" / "ipl2026_batting_slots.json"


def load_json(p: Path) -> Dict[str, Any]:
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def squad_names(team_row: Dict[str, Any]) -> List[str]:
    names: List[str] = []
    cap = team_row.get("captain")
    players = list(team_row.get("players") or [])
    if cap and cap not in players:
        players.insert(0, cap)
    seen = set()
    for n in players:
        if n and n not in seen:
            seen.add(n)
            names.append(n)
    return names


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Prefill batting slots JSON.")
    p.add_argument(
        "--merge",
        action="store_true",
        help="Keep existing typical_slot entries; only add missing players / new squads.",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    from generator_backtest_engine import infer_batting_slot_from_profile

    squads = load_json(SQUADS_PATH)
    profiles = load_json(PROFILES_PATH)
    profile_teams = profiles.get("teams") or {}

    existing_teams: Dict[str, Any] = {}
    if args.merge and OUT_PATH.exists():
        try:
            existing_teams = (load_json(OUT_PATH).get("teams") or {})  # type: ignore[assignment]
        except (json.JSONDecodeError, OSError):
            existing_teams = {}

    teams_out: Dict[str, Dict[str, Dict[str, int]]] = {}

    for team_row in squads.get("teams") or []:
        team = team_row.get("team")
        if not team:
            continue
        team_profiles = profile_teams.get(team) or {}
        prev = existing_teams.get(team) if isinstance(existing_teams.get(team), dict) else {}
        per_team: Dict[str, Dict[str, int]] = {}
        for pname in squad_names(team_row):
            if (
                args.merge
                and isinstance(prev.get(pname), dict)
                and isinstance(prev[pname].get("typical_slot"), (int, float))
            ):
                s = int(prev[pname]["typical_slot"])
                per_team[pname] = {"typical_slot": max(1, min(11, s))}
                continue
            prof = team_profiles.get(pname)
            if not isinstance(prof, dict):
                prof = {"primary_role": "batsman", "tags": []}
            slot = infer_batting_slot_from_profile(prof)
            slot = max(1, min(11, int(slot)))
            per_team[pname] = {"typical_slot": slot}
        teams_out[team] = per_team

    payload = {
        "version": 1,
        "notes": (
            "typical_slot: 1 = opener, 2–3 = top, 4–5 = middle, 6 = lower-middle, 7+ = tail (bat/AR). "
            "Bowlers default to 9. "
            "Prefilled via scripts/prefill_batting_slots.py from ipl2026_player_profiles.json tags/roles — "
            "edit any player here; this file overrides profile inference in the app. "
            "Re-run without --merge to rebuild all slots from profiles; use --merge to keep manual edits."
        ),
        "teams": teams_out,
    }
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")
    n = sum(len(v) for v in teams_out.values())
    mode = "merge" if args.merge else "replace"
    print(f"Wrote {OUT_PATH} ({mode}) — {len(teams_out)} teams, {n} player rows")


if __name__ == "__main__":
    main()
