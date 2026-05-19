#!/usr/bin/env python3
"""
Exact count of valid 11-player XIs from a fixed selection pool (e.g. 24 ticked players).

Parity target: web/app.js `isValidGeneratedTeam` when role rows use `getEffectiveLineupRole`
and min-AR uses profile/raw role via `resolve_profile_role` (same as `getRawProfileRole` for AR).

C/VC check: structural only — at least one captain name from franchise captain pool ∩ XI
and a different vice name from franchise vice pool ∩ XI. Does NOT apply the web scenario
verification layer (bowler pairing / chase-side rules); those can reject some pairs per cell.

Usage:
  python scripts/count_valid_xis.py --selection path/to/selection.json
  python scripts/count_valid_xis.py --demo-squads "Delhi Capitals" "Mumbai Indians"

selection.json format:
{
  "team_a": "Delhi Capitals",
  "team_b": "Mumbai Indians",
  "players": [
    "Delhi Capitals::KL Rahul",
    "Mumbai Indians::Rohit Sharma"
  ]
}
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from itertools import combinations
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from generator_backtest_engine import (  # noqa: E402
    build_cv_sets_for_pool,
    resolve_profile_role,
    resolve_typical_slot,
)

PROFILES_PATH = ROOT / "data" / "ipl2026_player_profiles.json"
BATTING_SLOTS_PATH = ROOT / "data" / "ipl2026_batting_slots.json"
C_VC_PATH = ROOT / "data" / "c_vc_pools.json"
SQUADS_PATH = ROOT / "data" / "ipl2026_squads.json"


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def squad_player_names(squads: Dict[str, Any], team_name: str, limit: int) -> List[str]:
    teams = {row["team"]: row for row in squads.get("teams", [])}
    if team_name not in teams:
        raise ValueError(f"Unknown team: {team_name}")
    row = teams[team_name]
    players = list(row.get("players", []))
    captain = row.get("captain")
    if captain and captain not in players:
        players.insert(0, captain)
    elif captain and captain in players:
        players = [captain] + [p for p in players if p != captain]
    out: List[str] = []
    seen: Set[str] = set()
    for p in players:
        if p not in seen:
            seen.add(p)
            out.append(p)
        if len(out) >= limit:
            break
    return out


def effective_lineup_role(typical_slot: int, profile_role: str) -> str:
    if profile_role != "all_rounder":
        return profile_role
    if typical_slot <= 5:
        return "batsman"
    return "all_rounder"


def build_row(
    team: str,
    player: str,
    profiles_by_team: Dict[str, Any],
    batting_slots: Dict[str, Any],
) -> Dict[str, Any]:
    prof = (profiles_by_team.get(team) or {}).get(player) or {}
    primary = prof.get("primary_role", "batsman")
    if primary not in ("wicket_keeper", "batsman", "bowler", "all_rounder"):
        primary = "batsman"
    profile_role = resolve_profile_role(prof, primary)
    typical_slot = resolve_typical_slot(team, player, prof, batting_slots)
    eff = effective_lineup_role(typical_slot, profile_role)
    return {
        "team": team,
        "player": player,
        "role": eff,
        "profile_role": profile_role,
        "typical_slot": typical_slot,
    }


def parse_selection_players(raw_players: Any) -> List[Tuple[str, str]]:
    out: List[Tuple[str, str]] = []
    for item in raw_players:
        if isinstance(item, str):
            sep = item.index("::")
            out.append((item[:sep], item[sep + 2 :]))
        elif isinstance(item, dict):
            out.append((str(item["team"]), str(item["player"])))
        else:
            raise ValueError(f"Bad player entry: {item}")
    keys = [f"{t}::{p}" for t, p in out]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate players in selection")
    return out


def is_valid_xi_web(
    team: List[Dict[str, Any]],
    max_bowlers: int,
    max_all_rounders: int,
) -> bool:
    if len(team) != 11:
        return False
    player_keys: Set[str] = set()
    team_count: Dict[str, int] = {}
    role_count = {"wicket_keeper": 0, "batsman": 0, "bowler": 0, "all_rounder": 0}
    profile_ar = 0
    for r in team:
        k = f'{r["team"]}::{r["player"]}'
        player_keys.add(k)
        team_count[r["team"]] = team_count.get(r["team"], 0) + 1
        role = r["role"]
        if role in role_count:
            role_count[role] += 1
        if r.get("profile_role") == "all_rounder":
            profile_ar += 1
    if len(player_keys) != 11:
        return False
    if len(team_count) < 2:
        return False
    if any(c < 4 for c in team_count.values()):
        return False
    if role_count["wicket_keeper"] < 1:
        return False
    if role_count["batsman"] < 1:
        return False
    if role_count["bowler"] < 1:
        return False
    if profile_ar < 1:
        return False
    if role_count["bowler"] > max_bowlers:
        return False
    if role_count["all_rounder"] > max_all_rounders:
        return False
    return True


def has_structural_cv_pair(
    team: List[Dict[str, Any]], cv_sets: Dict[str, Dict[str, Set[str]]]
) -> bool:
    for c in team:
        if c["player"] not in cv_sets.get(c["team"], {}).get("captain", set()):
            continue
        for v in team:
            if v["player"] == c["player"]:
                continue
            if v["player"] in cv_sets.get(v["team"], {}).get("vice_captain", set()):
                return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Count valid XIs from a selection pool.")
    parser.add_argument("--selection", type=str, default="", help="JSON path (team_a, team_b, players).")
    parser.add_argument("--demo-squads", nargs=2, metavar=("TEAM_A", "TEAM_B"), help="12+12 from squads.")
    parser.add_argument("--profiles", type=str, default=str(PROFILES_PATH))
    parser.add_argument("--batting-slots", type=str, default=str(BATTING_SLOTS_PATH))
    parser.add_argument("--c-vc-pools", type=str, default=str(C_VC_PATH))
    parser.add_argument("--squads", type=str, default=str(SQUADS_PATH))
    parser.add_argument("--max-bowlers", type=int, default=3)
    parser.add_argument("--max-all-rounders", type=int, default=2)
    parser.add_argument("--progress-every", type=int, default=250000)
    args = parser.parse_args()

    profiles_root = load_json(Path(args.profiles))
    profiles_by_team = profiles_root.get("teams", {})
    batting_slots = load_json(Path(args.batting_slots))
    cv_json = load_json(Path(args.c_vc_pools))

    if args.demo_squads:
        squads = load_json(Path(args.squads))
        a, b = args.demo_squads
        pa = squad_player_names(squads, a, 12)
        pb = squad_player_names(squads, b, 12)
        players_pairs = [(a, n) for n in pa] + [(b, n) for n in pb]
        team_a, team_b = a, b
    elif args.selection:
        sel = load_json(Path(args.selection))
        team_a = str(sel["team_a"])
        team_b = str(sel["team_b"])
        players_pairs = parse_selection_players(sel["players"])
    else:
        parser.error("Provide --selection JSON or --demo-squads TEAM_A TEAM_B")

    rows = [
        build_row(t, p, profiles_by_team, batting_slots) for t, p in players_pairs
    ]
    n = len(rows)
    if n < 11:
        raise SystemExit(f"Need at least 11 players, got {n}")

    pool_for_cv = [{"team": r["team"], "player": r["player"]} for r in rows]
    cv_sets = build_cv_sets_for_pool(pool_for_cv, cv_json)

    max_b = max(1, min(11, args.max_bowlers))
    max_ar = max(1, min(11, args.max_all_rounders))

    total_comb = math.comb(n, 11)
    t0 = time.perf_counter()
    valid = 0
    with_cv = 0
    scanned = 0

    for idxs in combinations(range(n), 11):
        scanned += 1
        team = [rows[i] for i in idxs]
        if not is_valid_xi_web(team, max_b, max_ar):
            continue
        valid += 1
        if has_structural_cv_pair(team, cv_sets):
            with_cv += 1

        if args.progress_every and scanned % args.progress_every == 0:
            elapsed = time.perf_counter() - t0
            print(
                f"  ... scanned {scanned:,} / {total_comb:,} combos ({100.0 * scanned / total_comb:.1f}%) "
                f"in {elapsed:.1f}s -- valid so far: {valid:,}",
                flush=True,
            )

    elapsed = time.perf_counter() - t0
    print()
    print("=== Pool ===")
    print(f"  Players: {n}  (C({n},11) = {total_comb:,} raw combinations)")
    print(f"  Teams: {team_a} vs {team_b}")
    print(f"  Role caps (web defaults): max bowlers = {max_b}, max all-rounders = {max_ar}")
    print()
    print("=== Results (web-style XI rules, structural C/VC only) ===")
    print(f"  Valid XIs:              {valid:,}")
    print(f"  Valid + legal C/VC pair: {with_cv:,}")
    if valid:
        print(f"  Fraction with C/VC:     {with_cv / valid:.4f}")
    print(f"  Elapsed:                {elapsed:.2f}s")
    print()
    if valid >= 280:
        print("  => 280 DISTINCT XIs is feasible on pure counting (valid >= 280).")
    else:
        print("  => 280 DISTINCT XIs is NOT possible under these rules for this pool.")
    if with_cv >= 280:
        print("  => 280 teams with distinct (XI,C,VC) is feasible if generator finds them.")
    else:
        print("  => Even allowing C/VC variants, structural C/VC may cap below 280 for some scenarios.")


if __name__ == "__main__":
    main()
