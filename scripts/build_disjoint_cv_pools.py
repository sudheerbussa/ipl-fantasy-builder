#!/usr/bin/env python3
"""
Build data/c_vc_pools.json with per-franchise captain / vice_captain name lists.

The generator and UI treat **C and VC eligibility as the union** of the two arrays
(same as merging them into one pool). This script still writes a **small captain_pool**
(top-order batsmen) plus **vice_captain_pool** (rest of squad) for readability; the
union equals the full squad for typical squads.

Batting slot inference mirrors web/app.js for batsmen.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
SQUADS_PATH = ROOT / "data" / "ipl2026_squads.json"
PROFILES_PATH = ROOT / "data" / "ipl2026_player_profiles.json"
BATTING_SLOTS_PATH = ROOT / "data" / "ipl2026_batting_slots.json"
OUT_PATH = ROOT / "data" / "c_vc_pools.json"


def load_json(p: Path) -> Dict[str, Any]:
    with p.open("r", encoding="utf-8") as f:
        return json.load(f)


def infer_slot_batsman(profile: Dict[str, Any]) -> int:
    tags = profile.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    if "top_order" in tags:
        return 2
    if "anchor" in tags:
        return 3
    if "middle_order" in tags:
        return 5
    if "finisher" in tags:
        return 6
    return 5


def slot_from_file(
    team: str,
    player: str,
    batting_file: Dict[str, Any],
) -> int | None:
    teams = (batting_file.get("teams") or {}).get(team) or {}
    if not isinstance(teams, dict):
        return None
    ent = teams.get(player)
    if isinstance(ent, dict) and isinstance(ent.get("typical_slot"), (int, float)):
        s = int(ent["typical_slot"])
        if 1 <= s <= 11:
            return s
    return None


def squad_player_names(team_row: Dict[str, Any]) -> List[str]:
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


def captain_candidates_for_team(
    team: str,
    profiles_teams: Dict[str, Any],
    batting_file: Dict[str, Any],
) -> List[str]:
    """Up to 3 batsmen with slot 1–3 (file override or inferred)."""
    cands: List[Tuple[int, str]] = []
    team_profiles = profiles_teams.get(team) or {}
    for pname, profile in team_profiles.items():
        if not isinstance(profile, dict):
            continue
        if profile.get("primary_role") != "batsman":
            continue
        s_file = slot_from_file(team, pname, batting_file)
        if s_file is not None:
            slot = s_file
        else:
            slot = infer_slot_batsman(profile)
        if slot <= 3:
            cands.append((slot, pname))
    cands.sort(key=lambda t: (t[0], t[1]))
    seen = set()
    out: List[str] = []
    for _s, pname in cands:
        if pname in seen:
            continue
        seen.add(pname)
        out.append(pname)
        if len(out) >= 3:
            break
    return out


def main() -> None:
    squads = load_json(SQUADS_PATH)
    profiles = load_json(PROFILES_PATH)
    batting_file = load_json(BATTING_SLOTS_PATH) if BATTING_SLOTS_PATH.exists() else {}
    profile_teams = profiles.get("teams") or {}

    pools: Dict[str, Any] = {}
    for team_row in squads.get("teams") or []:
        team = team_row.get("team")
        if not team:
            continue
        roster = squad_player_names(team_row)
        cap = captain_candidates_for_team(team, profile_teams, batting_file)
        cap_set = set(cap)
        vice = [n for n in roster if n not in cap_set]
        vice.sort(key=lambda x: x.lower())
        cap.sort(key=lambda x: x.lower())
        pools[team] = {"captain_pool": cap, "vice_captain_pool": vice}

    payload = {
        "version": 2,
        "notes": "Generator uses union(captain_pool, vice_captain_pool) for C/VC eligibility. This file uses a small top-order captain list plus rest-of-squad vice list (union = full squad). Edit in UI.",
        "pools": pools,
    }
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")
    print(f"Wrote {OUT_PATH} ({len(pools)} teams)")


if __name__ == "__main__":
    main()
