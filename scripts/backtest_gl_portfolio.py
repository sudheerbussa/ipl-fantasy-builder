#!/usr/bin/env python3
"""Backtest GL portfolio strategies on historical IPL matches."""

from __future__ import annotations

import argparse
import json
import math
import random
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple


HIST_DIR = Path("data/historical_matches")
PROFILES_PATH = Path("data/ipl2026_player_profiles.json")
OUTPUT_PATH = Path("data/backtest_report.json")
MATCH_ID_PATTERN = re.compile(r"^IPL2026-\d{3}$")


@dataclass
class PlayerStat:
    team: str
    player: str
    fantasy_points: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backtest GL strategy portfolios.")
    parser.add_argument("--num-teams", type=int, default=40, help="Teams per strategy per match.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    parser.add_argument(
        "--historical-dir",
        default=str(HIST_DIR),
        help="Directory containing historical match JSON files.",
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_PATH),
        help="Output backtest report path.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def list_matches(path: Path) -> List[Path]:
    files = [p for p in path.glob("*.json") if p.is_file()]
    return sorted(files, key=lambda p: p.name)


def parse_match_date(match: Dict[str, Any]) -> datetime:
    return datetime.strptime(match["date"], "%Y-%m-%d")


def get_match_players(match: Dict[str, Any]) -> List[PlayerStat]:
    out = []
    for row in match.get("player_stats", []):
        out.append(
            PlayerStat(
                team=row["team"],
                player=row["player"],
                fantasy_points=float(row.get("fantasy_points", 0)),
            )
        )
    return out


def build_role_lookup(profiles: Dict[str, Any]) -> Dict[Tuple[str, str], str]:
    out = {}
    for team_name, players in profiles.get("teams", {}).items():
        for player_name, profile in players.items():
            out[(team_name, player_name)] = profile.get("primary_role", "batsman")
    return out


def expected_points(player_key: Tuple[str, str], history: Dict[Tuple[str, str], List[float]], role: str) -> float:
    arr = history.get(player_key, [])
    if arr:
        # Recent form weighted average (latest match higher weight)
        weights = [i + 1 for i in range(len(arr))]
        return sum(v * w for v, w in zip(arr, weights)) / sum(weights)
    # Role-based prior fallback
    priors = {
        "wicket_keeper": 34.0,
        "all_rounder": 38.0,
        "bowler": 32.0,
        "batsman": 30.0,
    }
    return priors.get(role, 30.0)


def weighted_sample_without_replacement(items: List[Dict[str, Any]], k: int, rng: random.Random) -> List[Dict[str, Any]]:
    picked = []
    pool = items[:]
    for _ in range(min(k, len(pool))):
        total = sum(max(0.01, x["weight"]) for x in pool)
        r = rng.random() * total
        upto = 0.0
        idx = 0
        for i, x in enumerate(pool):
            upto += max(0.01, x["weight"])
            if upto >= r:
                idx = i
                break
        picked.append(pool.pop(idx))
    return picked


def role_count(team: List[Dict[str, Any]], role: str) -> int:
    return sum(1 for p in team if p["role"] == role)


def is_valid_team(team: List[Dict[str, Any]]) -> bool:
    if len(team) != 11:
        return False
    per_side = defaultdict(int)
    for p in team:
        per_side[p["team"]] += 1
    # User rule: at least one player from each side.
    if len(per_side) < 2:
        return False
    if role_count(team, "wicket_keeper") < 1:
        return False
    if role_count(team, "batsman") < 1:
        return False
    if role_count(team, "bowler") < 1:
        return False
    if role_count(team, "all_rounder") < 1:
        return False
    return True


def is_valid_match_record(match: Dict[str, Any], valid_teams: set[str]) -> bool:
    match_id = str(match.get("match_id", ""))
    team_a = str(match.get("team_a", ""))
    team_b = str(match.get("team_b", ""))
    player_stats = match.get("player_stats", [])
    if not MATCH_ID_PATTERN.match(match_id):
        return False
    if team_a not in valid_teams or team_b not in valid_teams:
        return False
    if not isinstance(player_stats, list) or len(player_stats) == 0:
        return False
    return True


def choose_c_vc(team: List[Dict[str, Any]], _rng: random.Random, _strategy: str) -> Tuple[str, str]:
    """Captain must be a batsman; vice-captain only batsman or all-rounder."""
    batsmen = [p for p in team if p.get("role") == "batsman"]
    vc_eligible = [p for p in team if p.get("role") in ("batsman", "all_rounder")]
    cap_pool = batsmen if batsmen else team
    vc_pool = vc_eligible if vc_eligible else team
    sorted_bat = sorted(cap_pool, key=lambda x: x["proj"], reverse=True)
    sorted_vc = sorted(vc_pool, key=lambda x: x["proj"], reverse=True)
    c = sorted_bat[0]["player"]
    vc = sorted_vc[min(2, len(sorted_vc) - 1)]["player"]
    if c == vc:
        vc = next((p["player"] for p in sorted_vc if p["player"] != c), sorted_vc[0]["player"])
    return c, vc


def strategy_params(_name: str) -> Dict[str, float]:
    """Projection + noise draw (legacy GL backtest; aligns with high_scoring lineup temperature)."""
    return {"temperature": 1.14, "noise": 0.24}


def generate_portfolio(
    match: Dict[str, Any],
    expected_map: Dict[Tuple[str, str], float],
    role_lookup: Dict[Tuple[str, str], str],
    num_teams: int,
    strategy: str,
    rng: random.Random,
) -> List[Dict[str, Any]]:
    stats = get_match_players(match)
    pool = []
    for s in stats:
        key = (s.team, s.player)
        proj = expected_map[key]
        role = role_lookup.get(key, "batsman")
        # proxy: high projected player assumed higher ownership
        ownership_proxy = min(0.95, max(0.05, proj / 70.0))
        pool.append(
            {
                "team": s.team,
                "player": s.player,
                "proj": proj,
                "role": role,
                "ownership_proxy": ownership_proxy,
            }
        )

    params = strategy_params(strategy)
    out = []
    attempts = 0
    while len(out) < num_teams and attempts < num_teams * 80:
        attempts += 1
        weighted = []
        for p in pool:
            noisy_proj = p["proj"] * (1 + rng.uniform(-params["noise"], params["noise"]))
            weight = max(0.1, math.pow(max(0.1, noisy_proj), params["temperature"]))
            weighted.append({**p, "weight": weight})
        team = weighted_sample_without_replacement(weighted, 11, rng)
        if not is_valid_team(team):
            continue
        c, vc = choose_c_vc(team, rng, strategy)
        out.append(
            {
                "players": [{"team": p["team"], "player": p["player"]} for p in team],
                "captain": c,
                "vice_captain": vc,
            }
        )
    return out


def score_portfolio(portfolio: List[Dict[str, Any]], actual_points: Dict[Tuple[str, str], float]) -> Dict[str, float]:
    scores = []
    for t in portfolio:
        base = 0.0
        c_bonus = 0.0
        vc_bonus = 0.0
        for p in t["players"]:
            key = (p["team"], p["player"])
            pts = actual_points.get(key, 0.0)
            base += pts
            if p["player"] == t["captain"]:
                c_bonus += pts
            if p["player"] == t["vice_captain"]:
                vc_bonus += 0.5 * pts
        scores.append(base + c_bonus + vc_bonus)
    if not scores:
        return {"best": 0, "avg": 0, "top5_avg": 0, "p90": 0}
    scores_sorted = sorted(scores, reverse=True)
    top5 = scores_sorted[: min(5, len(scores_sorted))]
    p90_idx = max(0, min(len(scores_sorted) - 1, int(len(scores_sorted) * 0.1)))
    return {
        "best": round(scores_sorted[0], 2),
        "avg": round(sum(scores_sorted) / len(scores_sorted), 2),
        "top5_avg": round(sum(top5) / len(top5), 2),
        "p90": round(scores_sorted[p90_idx], 2),
    }


def main() -> None:
    args = parse_args()
    rng = random.Random(args.seed)
    match_dir = Path(args.historical_dir)
    output = Path(args.output)

    profiles = load_json(PROFILES_PATH)
    role_lookup = build_role_lookup(profiles)
    files = list_matches(match_dir)
    if not files:
        raise SystemExit(f"No historical match files found in {match_dir}")

    valid_teams = set(profiles.get("teams", {}).keys())
    matches = [
        m
        for m in (load_json(p) for p in files)
        if is_valid_match_record(m, valid_teams)
    ]
    matches.sort(key=parse_match_date)

    history: Dict[Tuple[str, str], List[float]] = defaultdict(list)
    strategies = ["high_scoring_games"]
    aggregate = {s: {"best": [], "avg": [], "top5_avg": [], "p90": []} for s in strategies}
    match_reports = []

    for match in matches:
        actual_map = {
            (row["team"], row["player"]): float(row.get("fantasy_points", 0))
            for row in match.get("player_stats", [])
        }
        expected_map = {}
        for key in actual_map:
            role = role_lookup.get(key, "batsman")
            expected_map[key] = expected_points(key, history, role)

        strategy_out = {}
        for strategy in strategies:
            portfolio = generate_portfolio(
                match=match,
                expected_map=expected_map,
                role_lookup=role_lookup,
                num_teams=args.num_teams,
                strategy=strategy,
                rng=rng,
            )
            metrics = score_portfolio(portfolio, actual_map)
            strategy_out[strategy] = metrics
            for k in aggregate[strategy]:
                aggregate[strategy][k].append(metrics[k])

        match_reports.append(
            {
                "match_id": match["match_id"],
                "date": match["date"],
                "teams": [match["team_a"], match["team_b"]],
                "strategy_metrics": strategy_out,
            }
        )

        # Update history after scoring this match.
        for key, points in actual_map.items():
            history[key].append(points)
            if len(history[key]) > 8:
                history[key] = history[key][-8:]

    summary = {}
    for strategy, vals in aggregate.items():
        summary[strategy] = {
            metric: round(sum(arr) / len(arr), 2) if arr else 0.0
            for metric, arr in vals.items()
        }

    report = {
        "config": {
            "num_teams": args.num_teams,
            "strategies": strategies,
            "historical_matches": len(matches),
        },
        "strategy_summary": summary,
        "match_reports": match_reports,
        "recommendation_note": "For GL 40-team start, prioritize strategy with highest mean best-score and p90.",
    }
    write_json(output, report)
    print(f"Backtest completed on {len(matches)} matches.")
    print(f"Report written: {output}")


if __name__ == "__main__":
    main()
