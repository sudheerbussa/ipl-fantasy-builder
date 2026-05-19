#!/usr/bin/env python3
"""Generate high_scoring_games fantasy teams for two IPL squads and export CSV (engine parity)."""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Set

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from generator_backtest_engine import (  # noqa: E402
    GeneratorTuning,
    build_cv_sets_for_pool,
    generate_teams,
    infer_batting_slot_from_profile,
)

SQUADS_PATH = ROOT / "data" / "ipl2026_squads.json"
PROFILES_PATH = ROOT / "data" / "ipl2026_player_profiles.json"
RECENT_FORM_PATH = ROOT / "data" / "ipl2026_recent_form.json"
C_VC_PATH = ROOT / "data" / "c_vc_pools.json"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "generated_teams"

ROLE_PRIORS = {
    "wicket_keeper": 34.0,
    "all_rounder": 38.0,
    "bowler": 32.0,
    "batsman": 30.0,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate high_scoring_games teams for two squads and export CSV."
    )
    parser.add_argument("--team-a", required=True, help="First team name.")
    parser.add_argument("--team-b", required=True, help="Second team name.")
    parser.add_argument(
        "--num-teams",
        type=int,
        default=40,
        help="Number of teams to generate.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument("--squads", default=str(SQUADS_PATH), help="Squads JSON path.")
    parser.add_argument("--profiles", default=str(PROFILES_PATH), help="Profiles JSON path.")
    parser.add_argument("--recent-form", default=str(RECENT_FORM_PATH), help="Recent form JSON path.")
    parser.add_argument("--c-vc-pools", default=str(C_VC_PATH), help="C/VC pools JSON path.")
    parser.add_argument("--output-csv", default="", help="Output CSV path.")
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def weighted_average(values: List[float]) -> float:
    if not values:
        return 0.0
    weights = [i + 1 for i in range(len(values))]
    return sum(v * w for v, w in zip(values, weights)) / sum(weights)


def build_player_pool(
    team_a: str,
    team_b: str,
    squads: Dict[str, Any],
    profiles: Dict[str, Any],
    recent_form: Dict[str, Any],
) -> List[Dict[str, Any]]:
    teams = {row["team"]: row for row in squads.get("teams", [])}
    if team_a not in teams or team_b not in teams:
        raise ValueError("One or both team names are not present in squads data.")

    profile_teams = profiles.get("teams", {})
    form_teams = recent_form.get("player_form", {})
    out: List[Dict[str, Any]] = []

    def squad_players(team_name: str) -> List[str]:
        team_row = teams[team_name]
        players = list(team_row.get("players", []))
        captain = team_row.get("captain")
        if captain and captain not in players:
            players.insert(0, captain)
        return players

    for team_name in [team_a, team_b]:
        for player in squad_players(team_name):
            profile = profile_teams.get(team_name, {}).get(player, {})
            role = profile.get("primary_role", "batsman")
            if role not in ("wicket_keeper", "batsman", "bowler", "all_rounder"):
                role = "batsman"
            if profile.get("is_wicket_keeper"):
                profile_role = "wicket_keeper"
            else:
                profile_role = role

            rec = form_teams.get(team_name, {}).get(player, {})
            points_hist = [float(x) for x in rec.get("last_fantasy_points", [])]
            if points_hist:
                proj = weighted_average(points_hist)
                ceiling = max(points_hist)
                floor = min(points_hist)
            else:
                proj = ROLE_PRIORS.get(role, 30.0)
                ceiling = proj + 12.0
                floor = max(0.0, proj - 12.0)

            ownership_proxy = min(0.95, max(0.05, proj / 70.0))
            typical_slot = infer_batting_slot_from_profile(profile)
            role_stability = 0.6 if rec.get("probable_xi") else 0.45
            out.append(
                {
                    "team": team_name,
                    "player": player,
                    "role": role,
                    "profile_role": profile_role,
                    "proj": proj,
                    "ceiling": ceiling,
                    "floor": floor,
                    "ownership_proxy": ownership_proxy,
                    "typical_slot": typical_slot,
                    "role_stability": role_stability,
                }
            )
    return out


def sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")


def write_csv(path: Path, teams: List[Dict[str, Any]], team_a: str, team_b: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "strategy",
                "high_score_scenario",
                "team_index",
                "captain",
                "vice_captain",
                "projected_points",
                "team_a_count",
                "team_b_count",
                "wk_count",
                "bat_count",
                "bowl_count",
                "ar_count",
                "players",
            ]
        )
        for idx, row in enumerate(teams, start=1):
            players = row["players"]
            per_team: Dict[str, int] = defaultdict(int)
            per_role: Dict[str, int] = defaultdict(int)
            for p in players:
                per_team[p["team"]] += 1
                per_role[p["role"]] += 1
            player_str = " | ".join(
                [f"{p['player']} ({p['team']}, {p['role']})" for p in players]
            )
            writer.writerow(
                [
                    row.get("strategy", "high_scoring_games"),
                    row.get("high_score_scenario", ""),
                    idx,
                    row["captain"],
                    row["vice_captain"],
                    row["projected_points"],
                    per_team.get(team_a, 0),
                    per_team.get(team_b, 0),
                    per_role.get("wicket_keeper", 0),
                    per_role.get("batsman", 0),
                    per_role.get("bowler", 0),
                    per_role.get("all_rounder", 0),
                    player_str,
                ]
            )


def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)

    team_a = args.team_a
    team_b = args.team_b
    num_teams = args.num_teams

    squads = load_json(Path(args.squads))
    profiles = load_json(Path(args.profiles))
    recent_form = load_json(Path(args.recent_form))
    cv_pools = load_json(Path(args.c_vc_pools))

    pool = build_player_pool(team_a, team_b, squads, profiles, recent_form)
    if len(pool) < 11:
        raise SystemExit("Not enough players in pool to create teams.")

    cv_sets = build_cv_sets_for_pool(pool, cv_pools)
    tuning = GeneratorTuning().normalized()
    seen: Set[str] = set()
    teams = generate_teams(
        pool,
        num_teams,
        tuning,
        rng,
        cv_sets,
        seen_keys=seen,
        appearance_counts={},
        cv_fair=None,
    )

    if len(teams) < num_teams:
        print(
            f"[WARN] high_scoring_games: generated {len(teams)} unique teams (requested {num_teams})."
        )

    if args.output_csv:
        out_csv = Path(args.output_csv)
    else:
        out_csv = (
            DEFAULT_OUTPUT_DIR
            / f"{sanitize(team_a)}_vs_{sanitize(team_b)}_high_scoring_{num_teams}.csv"
        )

    write_csv(out_csv, teams, team_a, team_b)
    print(f"Wrote CSV: {out_csv}")
    print(f"Teams generated: {len(teams)}")


if __name__ == "__main__":
    main()
