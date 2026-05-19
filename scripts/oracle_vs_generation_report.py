#!/usr/bin/env python3
"""
For each historical match: compare
  (1) Oracle = maximum fantasy points achievable from that match's player pool
      under the same XI + C/VC-pool rules as the web generator, using realized points.
  (2) Best team among N generated `high_scoring_games` lineups (walk-forward projections,
      same as tune_generator_backtest.py).

Oracle uses brute force over C(n,11) when n <= 28 (all IPL2026 historical files qualify).

Optional: overlay fantasy points from data/manual_fantasy_points/IPL2026-XXX_fantasy_points.csv
when cells are filled (same keys as JSON).

Output: data/oracle_vs_generation_report.json
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generator_backtest_engine import (  # noqa: E402
    GeneratorTuning,
    build_cv_fairness_state,
    build_cv_sets_for_pool,
    build_match_pool_from_stats,
    generate_teams,
    oracle_max_fantasy_score,
    portfolio_metrics,
)

ROOT = Path(__file__).resolve().parents[1]
HIST_DIR = ROOT / "data" / "historical_matches"
PROFILES_PATH = ROOT / "data" / "ipl2026_player_profiles.json"
RECENT_FORM_PATH = ROOT / "data" / "ipl2026_recent_form.json"
C_VC_PATH = ROOT / "data" / "c_vc_pools.json"
BATTING_SLOTS_PATH = ROOT / "data" / "ipl2026_batting_slots.json"
MANUAL_CSV_DIR = ROOT / "data" / "manual_fantasy_points"
OUTPUT_PATH = ROOT / "data" / "oracle_vs_generation_report.json"

MATCH_ID_PATTERN = re.compile(r"^IPL2026-\d{3}$")
STRATEGY = "high_scoring_games"


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def build_role_lookup(profiles: Dict[str, Any]) -> Dict[Tuple[str, str], str]:
    out: Dict[Tuple[str, str], str] = {}
    for team_name, players in profiles.get("teams", {}).items():
        for player_name, profile in players.items():
            out[(team_name, player_name)] = str(profile.get("primary_role", "batsman"))
    return out


def list_matches(path: Path) -> List[Path]:
    return sorted([p for p in path.glob("*.json") if p.is_file()], key=lambda p: p.name)


def is_valid_match_record(match: Dict[str, Any], valid_teams: set) -> bool:
    mid = str(match.get("match_id", ""))
    if not MATCH_ID_PATTERN.match(mid):
        return False
    ta, tb = str(match.get("team_a", "")), str(match.get("team_b", ""))
    if ta not in valid_teams or tb not in valid_teams:
        return False
    ps = match.get("player_stats")
    return isinstance(ps, list) and len(ps) > 0


def actual_points_from_match_json(match: Dict[str, Any]) -> Dict[Tuple[str, str], float]:
    out: Dict[Tuple[str, str], float] = {}
    for row in match.get("player_stats", []):
        key = (str(row["team"]), str(row["player"]))
        out[key] = float(row.get("fantasy_points", 0))
    return out


def overlay_csv_points(
    match_id: str,
    base: Dict[Tuple[str, str], float],
    csv_dir: Path,
) -> Dict[Tuple[str, str], float]:
    path = csv_dir / f"{match_id}_fantasy_points.csv"
    if not path.exists():
        return base
    merged = dict(base)
    with path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            raw = row.get("fantasy_points")
            if raw is None or str(raw).strip() == "":
                continue
            try:
                v = float(raw)
            except ValueError:
                continue
            team = str(row.get("team", "")).strip()
            player = str(row.get("player", "")).strip()
            if team and player:
                merged[(team, player)] = v
    return merged


def default_generator_tuning() -> GeneratorTuning:
    return GeneratorTuning(
        repeat_lambda=1.6705,
        cv_uniform_blend=0.604,
        lineup_ceiling_nudge=0.1734,
        lower_middle_bat_weight=0.4312,
        cv_fairness_lambda=5.4421,
        blend_proj_weight=0.5324,
        blend_ceiling_weight=0.3719,
        blend_role_stability_weight=0.0957,
    ).normalized()


def run_match(
    match: Dict[str, Any],
    history: Dict[Tuple[str, str], List[float]],
    role_lookup: Dict[Tuple[str, str], str],
    profiles: Dict[str, Any],
    player_form: Dict[str, Any],
    batting_slots: Dict[str, Any] | None,
    cv_pools: Dict[str, Any],
    tuning: GeneratorTuning,
    num_teams: int,
    base_seed: int,
    actual_points: Dict[Tuple[str, str], float],
) -> Dict[str, Any]:
    pool = build_match_pool_from_stats(
        match, role_lookup, profiles, history, player_form, batting_slots
    )
    cv_sets = build_cv_sets_for_pool(pool, cv_pools)

    oracle_val, oracle_detail = oracle_max_fantasy_score(pool, actual_points, cv_sets)

    strat_rows: Dict[str, Any] = {}
    cv_fair = build_cv_fairness_state(pool, cv_sets)
    rng = random.Random(base_seed)
    teams = generate_teams(
        pool,
        num_teams,
        tuning,
        rng,
        cv_sets,
        seen_keys=set(),
        appearance_counts={},
        cv_fair=cv_fair,
    )
    met = portfolio_metrics(teams, actual_points)
    strat_rows[STRATEGY] = {
        "metrics": met,
        "teams_generated": len(teams),
        "requested": num_teams,
    }

    gap_hs = None if oracle_val is None else round(oracle_val - strat_rows[STRATEGY]["metrics"]["best"], 2)

    return {
        "match_id": match["match_id"],
        "date": match.get("date"),
        "teams": [match.get("team_a"), match.get("team_b")],
        "pool_size": len(pool),
        "oracle_max_points": oracle_val,
        "oracle_detail": oracle_detail,
        "generation": strat_rows,
        "gap_oracle_minus_best_high_scoring": gap_hs,
        "note": "Generator uses walk-forward projections (not match actuals) to draw teams; scores use actual points.",
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Oracle vs generated teams on historical matches.")
    p.add_argument("--historical-dir", type=str, default=str(HIST_DIR))
    p.add_argument("--num-teams", type=int, default=200, help="Teams per strategy per match (default 200).")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument(
        "--manual-csv-dir",
        type=str,
        default=str(MANUAL_CSV_DIR),
        help="If CSV exists per match, non-empty fantasy_points override JSON.",
    )
    p.add_argument("--output", type=str, default=str(OUTPUT_PATH))
    return p.parse_args()


def main() -> None:
    args = parse_args()
    hist_path = Path(args.historical_dir)
    csv_dir = Path(args.manual_csv_dir)

    try:
        import pulp  # noqa: F401

        oracle_method = "mip_pulp_cbc (exact)"
    except ImportError:
        oracle_method = "brute_force_small_pool_or_requires_pulp"

    profiles = load_json(PROFILES_PATH)
    recent_form = load_json(RECENT_FORM_PATH)
    player_form = recent_form.get("player_form") or {}
    cv_pools = load_json(C_VC_PATH)
    batting_slots: Dict[str, Any] | None = None
    if BATTING_SLOTS_PATH.exists():
        batting_slots = load_json(BATTING_SLOTS_PATH)

    role_lookup = build_role_lookup(profiles)
    valid_teams = set(profiles.get("teams", {}).keys())
    files = list_matches(hist_path)
    matches = [m for m in (load_json(p) for p in files) if is_valid_match_record(m, valid_teams)]
    matches.sort(key=lambda m: m.get("date", ""))

    tuning = default_generator_tuning()
    history: Dict[Tuple[str, str], List[float]] = {}
    per_match: List[Dict[str, Any]] = []

    for mi, match in enumerate(matches):
        mid = str(match["match_id"])
        base_pts = actual_points_from_match_json(match)
        actual_points = overlay_csv_points(mid, base_pts, csv_dir)

        row = run_match(
            match,
            history,
            role_lookup,
            profiles,
            player_form,
            batting_slots,
            cv_pools,
            tuning,
            args.num_teams,
            args.seed + mi * 10007,
            actual_points,
        )
        row["points_source"] = "json_plus_csv_overlay" if (csv_dir / f"{mid}_fantasy_points.csv").exists() else "json"
        per_match.append(row)

        for key, pts in actual_points.items():
            history.setdefault(key, []).append(pts)
            if len(history[key]) > 8:
                history[key] = history[key][-8:]

    def mean_gap(key: str) -> Any:
        vals = [r[key] for r in per_match if r.get(key) is not None]
        return round(sum(vals) / len(vals), 2) if vals else None

    oracle_scores = [r["oracle_max_points"] for r in per_match if r.get("oracle_max_points") is not None]
    hs_bests = [r["generation"][STRATEGY]["metrics"]["best"] for r in per_match]

    report = {
        "config": {
            "matches": len(matches),
            "num_teams_per_match": args.num_teams,
            "seed_base": args.seed,
            "tuning": tuning_to_dict(tuning),
            "strategy": STRATEGY,
            "oracle_method": oracle_method,
            "scoring": "sum(pts) + pts(captain) + 0.5 * pts(vice_captain)",
        },
        "summary": {
            "mean_oracle_max": round(sum(oracle_scores) / len(oracle_scores), 2) if oracle_scores else None,
            "mean_best_high_scoring_games": round(sum(hs_bests) / len(hs_bests), 2) if hs_bests else None,
            "mean_gap_oracle_minus_high_scoring": mean_gap("gap_oracle_minus_best_high_scoring"),
        },
        "interpretation": (
            "Oracle uses realized points and can pick any valid XI + C/VC from the pool. "
            "The generator does not see match actuals; it uses prior-match projections only. "
            "Large gaps are expected. Smaller gaps mean the random portfolio sometimes lands near the hindsight optimum."
        ),
        "per_match": per_match,
    }
    write_json(Path(args.output), report)
    print(f"Matches: {len(matches)}")
    print("Summary:", json.dumps(report["summary"], indent=2))
    print(f"Report: {args.output}")


def tuning_to_dict(t: GeneratorTuning) -> Dict[str, Any]:
    d = t.normalized()
    return {
        "repeat_lambda": d.repeat_lambda,
        "cv_uniform_blend": d.cv_uniform_blend,
        "lineup_ceiling_nudge": d.lineup_ceiling_nudge,
        "lower_middle_bat_weight": d.lower_middle_bat_weight,
        "cv_fairness_lambda": d.cv_fairness_lambda,
        "blend_proj_weight": d.blend_proj_weight,
        "blend_ceiling_weight": d.blend_ceiling_weight,
        "blend_role_stability_weight": d.blend_role_stability_weight,
    }


if __name__ == "__main__":
    main()
