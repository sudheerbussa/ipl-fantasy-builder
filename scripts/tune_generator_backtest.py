#!/usr/bin/env python3
"""
Walk-forward backtest: tune generator parameters against historical fantasy points.

Mirrors web/app.js tuning (see generator_backtest_engine.py). For each match, uses
only prior matches to build projection history (same idea as backtest_gl_portfolio.py),
then generates `high_scoring_games` portfolios and scores them with realized points.

Outputs data/tuning_backtest_report.json. Optionally:
  --apply-best-oat writes data/generator_tuning_presets.json (OAT merge + joint search).
  --random-search-trials / --optuna-trials for joint optimization of all knobs.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from dataclasses import asdict, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from generator_backtest_engine import (  # noqa: E402
    ATTEMPTS_MULTIPLIER,
    HIGH_SCORING_ATTEMPTS_MULTIPLIER,
    GeneratorTuning,
    build_cv_fairness_state,
    build_cv_sets_for_pool,
    build_match_pool_from_stats,
    generate_teams,
    portfolio_metrics,
)

ROOT = Path(__file__).resolve().parents[1]
HIST_DIR = ROOT / "data" / "historical_matches"
PROFILES_PATH = ROOT / "data" / "ipl2026_player_profiles.json"
RECENT_FORM_PATH = ROOT / "data" / "ipl2026_recent_form.json"
C_VC_PATH = ROOT / "data" / "c_vc_pools.json"
BATTING_SLOTS_PATH = ROOT / "data" / "ipl2026_batting_slots.json"
OUTPUT_PATH = ROOT / "data" / "tuning_backtest_report.json"
PRESETS_PATH = ROOT / "data" / "generator_tuning_presets.json"

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


def build_role_lookup_py(profiles: Dict[str, Any]) -> Dict[Tuple[str, str], str]:
    out: Dict[Tuple[str, str], str] = {}
    for team_name, players in profiles.get("teams", {}).items():
        for player_name, profile in players.items():
            out[(team_name, player_name)] = str(profile.get("primary_role", "batsman"))
    return out


def list_matches(path: Path) -> List[Path]:
    files = [p for p in path.glob("*.json") if p.is_file()]
    return sorted(files, key=lambda p: p.name)


def is_valid_match_record(match: Dict[str, Any], valid_teams: set) -> bool:
    mid = str(match.get("match_id", ""))
    ta = str(match.get("team_a", ""))
    tb = str(match.get("team_b", ""))
    if not MATCH_ID_PATTERN.match(mid):
        return False
    if ta not in valid_teams or tb not in valid_teams:
        return False
    ps = match.get("player_stats")
    if not isinstance(ps, list) or len(ps) == 0:
        return False
    return True


def default_tuning() -> GeneratorTuning:
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


def tuning_to_json_dict(t: GeneratorTuning) -> Dict[str, Any]:
    d = asdict(t.normalized())
    out: Dict[str, Any] = {}
    for k, v in d.items():
        if k.endswith("_until") or k.endswith("_start"):
            out[k] = int(v)
        else:
            out[k] = round(float(v), 4)
    return out


def joint_objective(summary: Dict[str, Dict[str, float]]) -> float:
    """Higher is better: mean-best for high_scoring_games."""
    return float(summary[STRATEGY]["best"])


def run_single_config(
    matches: List[Dict[str, Any]],
    role_lookup: Dict[Tuple[str, str], str],
    profiles: Dict[str, Any],
    player_form: Dict[str, Any],
    batting_slots: Dict[str, Any] | None,
    cv_pools: Dict[str, Any],
    tuning: GeneratorTuning,
    num_teams: int,
    base_seed: int,
) -> Tuple[Dict[str, Dict[str, List[float]]], List[Dict[str, Any]], int]:
    history: Dict[Tuple[str, str], List[float]] = {}
    aggregate = {STRATEGY: {"best": [], "avg": [], "top5_avg": [], "p90": []}}
    match_rows: List[Dict[str, Any]] = []
    skipped = 0

    for mi, match in enumerate(matches):
        actual_map: Dict[Tuple[str, str], float] = {}
        for row in match.get("player_stats", []):
            key = (str(row["team"]), str(row["player"]))
            actual_map[key] = float(row.get("fantasy_points", 0))

        pool = build_match_pool_from_stats(
            match, role_lookup, profiles, history, player_form, batting_slots
        )
        cv_sets = build_cv_sets_for_pool(pool, cv_pools)
        team_counts: Dict[str, int] = {}
        for r in pool:
            team_counts[r["team"]] = team_counts.get(r["team"], 0) + 1
        min_per_team_ok = len(team_counts) >= 2 and all(c >= 4 for c in team_counts.values())
        cvc_names = {
            r["player"]
            for r in pool
            if r["player"] in cv_sets.get(r["team"], {}).get("captain", set())
        }
        cv_ok = len(cvc_names) >= 2
        if len(pool) < 11 or not min_per_team_ok or not cv_ok:
            skipped += 1
            for key, pts in actual_map.items():
                history.setdefault(key, []).append(pts)
                if len(history[key]) > 8:
                    history[key] = history[key][-8:]
            match_rows.append(
                {
                    "match_id": match["match_id"],
                    "skipped": True,
                    "reason": "small_pool_or_cv",
                }
            )
            continue

        strat_out: Dict[str, Any] = {}
        cv_fair = build_cv_fairness_state(pool, cv_sets)
        rng = random.Random(base_seed + mi * 10007)
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
        m = portfolio_metrics(teams, actual_map)
        strat_out[STRATEGY] = m
        for k in aggregate[STRATEGY]:
            aggregate[STRATEGY][k].append(m[k])

        match_rows.append(
            {
                "match_id": match["match_id"],
                "date": match.get("date"),
                "teams": [match.get("team_a"), match.get("team_b")],
                "strategies": strat_out,
                "generated_teams_per_strategy": num_teams,
            }
        )

        for key, pts in actual_map.items():
            history.setdefault(key, []).append(pts)
            if len(history[key]) > 8:
                history[key] = history[key][-8:]

    return aggregate, match_rows, skipped


def mean_list(xs: List[float]) -> float:
    return round(sum(xs) / len(xs), 2) if xs else 0.0


def summarize(
    aggregate: Dict[str, Dict[str, List[float]]],
) -> Dict[str, Dict[str, float]]:
    out: Dict[str, Dict[str, float]] = {}
    for strat, metrics in aggregate.items():
        out[strat] = {m: mean_list(v) for m, v in metrics.items()}
    return out


def build_oat_merge_preset(base: GeneratorTuning, oat: List[Dict[str, Any]]) -> GeneratorTuning:
    """Per OAT param, pick the knob value that maximized mean-best for high_scoring_games on that sweep."""
    hs = STRATEGY
    best_rep = base.repeat_lambda
    best_rep_score = -1.0
    for o in oat:
        if o.get("param") != "repeat_lambda":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_rep_score:
            best_rep_score = sc
            best_rep = float(o["tuning"]["repeat_lambda"])
    best_cv = base.cv_uniform_blend
    best_cv_score = -1.0
    for o in oat:
        if o.get("param") != "cv_uniform_blend":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_cv_score:
            best_cv_score = sc
            best_cv = float(o["tuning"]["cv_uniform_blend"])
    best_ceil = base.lineup_ceiling_nudge
    best_ceil_score = -1.0
    for o in oat:
        if o.get("param") != "lineup_ceiling_nudge":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_ceil_score:
            best_ceil_score = sc
            best_ceil = float(o["tuning"]["lineup_ceiling_nudge"])
    best_lmb = base.lower_middle_bat_weight
    best_lmb_score = -1.0
    for o in oat:
        if o.get("param") != "lower_middle_bat_weight":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_lmb_score:
            best_lmb_score = sc
            best_lmb = float(o["tuning"]["lower_middle_bat_weight"])
    best_fair = base.cv_fairness_lambda
    best_fair_score = -1.0
    for o in oat:
        if o.get("param") != "cv_fairness_lambda":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_fair_score:
            best_fair_score = sc
            best_fair = float(o["tuning"]["cv_fairness_lambda"])
    best_bp = base.blend_proj_weight
    best_bp_score = -1.0
    for o in oat:
        if o.get("param") != "blend_proj_weight":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_bp_score:
            best_bp_score = sc
            best_bp = float(o["tuning"]["blend_proj_weight"])
    best_bc = base.blend_ceiling_weight
    best_bc_score = -1.0
    for o in oat:
        if o.get("param") != "blend_ceiling_weight":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_bc_score:
            best_bc_score = sc
            best_bc = float(o["tuning"]["blend_ceiling_weight"])
    best_br = base.blend_role_stability_weight
    best_br_score = -1.0
    for o in oat:
        if o.get("param") != "blend_role_stability_weight":
            continue
        sc = float(o["summary"][hs]["best"])
        if sc > best_br_score:
            best_br_score = sc
            best_br = float(o["tuning"]["blend_role_stability_weight"])
    return replace(
        base,
        repeat_lambda=best_rep,
        cv_uniform_blend=best_cv,
        lineup_ceiling_nudge=best_ceil,
        lower_middle_bat_weight=best_lmb,
        cv_fairness_lambda=best_fair,
        blend_proj_weight=best_bp,
        blend_ceiling_weight=best_bc,
        blend_role_stability_weight=best_br,
    ).normalized()


def sample_random_tuning(rng: random.Random) -> GeneratorTuning:
    return GeneratorTuning(
        repeat_lambda=rng.uniform(0.08, 2.2),
        cv_uniform_blend=rng.uniform(0.0, 1.0),
        lineup_ceiling_nudge=rng.uniform(0.0, 0.45),
        lower_middle_bat_weight=rng.uniform(0.05, 1.0),
        cv_fairness_lambda=rng.uniform(0.0, 12.0),
        blend_proj_weight=rng.uniform(0.2, 0.9),
        blend_ceiling_weight=rng.uniform(0.05, 0.6),
        blend_role_stability_weight=rng.uniform(0.0, 0.4),
    ).normalized()


def run_joint_random_search(
    matches: List[Dict[str, Any]],
    role_lookup: Dict[Tuple[str, str], str],
    profiles: Dict[str, Any],
    player_form: Dict[str, Any],
    batting_slots: Dict[str, Any] | None,
    cv_pools: Dict[str, Any],
    num_teams: int,
    base_seed: int,
    trials: int,
    rng: random.Random,
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    best_obj = float("-inf")
    best_summary: Optional[Dict[str, Dict[str, float]]] = None
    best_tuning: Optional[GeneratorTuning] = None
    trial_rows: List[Dict[str, Any]] = []
    for i in range(trials):
        t = sample_random_tuning(rng)
        agg, _, _ = run_single_config(
            matches,
            role_lookup,
            profiles,
            player_form,
            batting_slots,
            cv_pools,
            t,
            num_teams,
            base_seed,
        )
        summary = summarize(agg)
        obj = joint_objective(summary)
        trial_rows.append(
            {
                "trial": i + 1,
                "joint_objective": round(obj, 4),
                "tuning": tuning_to_json_dict(t),
                "summary": summary,
            }
        )
        if obj > best_obj:
            best_obj = obj
            best_summary = summary
            best_tuning = t
    if best_tuning is None or best_summary is None:
        return None, trial_rows
    return (
        {
            "method": "random_search",
            "trials": trials,
            "best_joint_objective": round(best_obj, 4),
            "best_tuning": tuning_to_json_dict(best_tuning),
            "best_summary": best_summary,
        },
        trial_rows,
    )


def run_optuna_joint(
    matches: List[Dict[str, Any]],
    role_lookup: Dict[Tuple[str, str], str],
    profiles: Dict[str, Any],
    player_form: Dict[str, Any],
    batting_slots: Dict[str, Any] | None,
    cv_pools: Dict[str, Any],
    num_teams: int,
    base_seed: int,
    n_trials: int,
) -> Optional[Dict[str, Any]]:
    try:
        import optuna
    except ImportError:
        return None

    optuna.logging.set_verbosity(optuna.logging.WARNING)

    def objective(trial: "optuna.Trial") -> float:
        t = GeneratorTuning(
            repeat_lambda=trial.suggest_float("repeat_lambda", 0.08, 2.2),
            cv_uniform_blend=trial.suggest_float("cv_uniform_blend", 0.0, 1.0),
            lineup_ceiling_nudge=trial.suggest_float("lineup_ceiling_nudge", 0.0, 0.45),
            lower_middle_bat_weight=trial.suggest_float("lower_middle_bat_weight", 0.05, 1.0),
            cv_fairness_lambda=trial.suggest_float("cv_fairness_lambda", 0.0, 12.0),
            blend_proj_weight=trial.suggest_float("blend_proj_weight", 0.2, 0.9),
            blend_ceiling_weight=trial.suggest_float("blend_ceiling_weight", 0.05, 0.6),
            blend_role_stability_weight=trial.suggest_float("blend_role_stability_weight", 0.0, 0.4),
        ).normalized()
        agg, _, _ = run_single_config(
            matches,
            role_lookup,
            profiles,
            player_form,
            batting_slots,
            cv_pools,
            t,
            num_teams,
            base_seed,
        )
        summary = summarize(agg)
        return joint_objective(summary)

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    best = study.best_trial
    bt = GeneratorTuning(
        repeat_lambda=best.params["repeat_lambda"],
        cv_uniform_blend=best.params["cv_uniform_blend"],
        lineup_ceiling_nudge=best.params["lineup_ceiling_nudge"],
        lower_middle_bat_weight=best.params["lower_middle_bat_weight"],
        cv_fairness_lambda=best.params["cv_fairness_lambda"],
        blend_proj_weight=best.params["blend_proj_weight"],
        blend_ceiling_weight=best.params["blend_ceiling_weight"],
        blend_role_stability_weight=best.params["blend_role_stability_weight"],
    ).normalized()
    agg, _, _ = run_single_config(
        matches,
        role_lookup,
        profiles,
        player_form,
        batting_slots,
        cv_pools,
        bt,
        num_teams,
        base_seed,
    )
    summary = summarize(agg)
    return {
        "method": "optuna_tpe",
        "trials": n_trials,
        "best_joint_objective": round(joint_objective(summary), 4),
        "best_tuning": tuning_to_json_dict(bt),
        "best_summary": summary,
        "best_value": round(float(best.value), 4),
    }


def write_presets_file(
    base: GeneratorTuning,
    oat_preset: Optional[GeneratorTuning],
    joint_rs: Optional[Dict[str, Any]],
    joint_optuna: Optional[Dict[str, Any]],
) -> None:
    presets: List[Dict[str, Any]] = [
        {
            "id": "default",
            "label": "Default (app)",
            "source": "web/app.js DEFAULT_GENERATOR_TUNING",
            "tuning": tuning_to_json_dict(base),
        }
    ]
    if oat_preset is not None:
        presets.append(
            {
                "id": "backtest_apr2026",
                "label": "Backtest Apr 2026 (OAT merge)",
                "source": "Per-knob OAT winner for high_scoring_games mean-best",
                "tuning": tuning_to_json_dict(oat_preset),
            }
        )
    if joint_rs is not None:
        presets.append(
            {
                "id": "backtest_apr2026_joint_rs",
                "label": "Backtest Apr 2026 (joint random search)",
                "source": "Random search over all knobs; maximize high_scoring_games mean-best",
                "tuning": joint_rs["best_tuning"],
                "metrics": {
                    "joint_objective": joint_rs["best_joint_objective"],
                    "high_scoring_mean_best": joint_rs["best_summary"][STRATEGY]["best"],
                },
            }
        )
    if joint_optuna is not None:
        presets.append(
            {
                "id": "backtest_apr2026_joint_optuna",
                "label": "Backtest Apr 2026 (joint Optuna)",
                "source": "TPE sampler; maximize high_scoring_games mean-best",
                "tuning": joint_optuna["best_tuning"],
                "metrics": {
                    "joint_objective": joint_optuna["best_joint_objective"],
                    "high_scoring_mean_best": joint_optuna["best_summary"][STRATEGY]["best"],
                },
            }
        )

    payload = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "presets": presets,
    }
    write_json(PRESETS_PATH, payload)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Tune generator vs historical fantasy points.")
    p.add_argument("--historical-dir", type=str, default=str(HIST_DIR))
    p.add_argument("--num-teams", type=int, default=40, help="Teams per match (high_scoring_games).")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--output", type=str, default=str(OUTPUT_PATH))
    p.add_argument(
        "--quick",
        action="store_true",
        help="Smaller one-at-a-time grid (2 values per knob instead of 3).",
    )
    p.add_argument(
        "--skip-oat",
        action="store_true",
        help="Skip one-at-a-time grid (faster when only running joint search).",
    )
    p.add_argument(
        "--apply-best-oat",
        action="store_true",
        help=f"Write {PRESETS_PATH} with Default + OAT-merge preset (+ joint if computed).",
    )
    p.add_argument(
        "--random-search-trials",
        type=int,
        default=0,
        help="Joint random search trials over all tuning knobs (0=off).",
    )
    p.add_argument(
        "--optuna-trials",
        type=int,
        default=0,
        help="Joint Optuna optimization trials (requires: pip install optuna). 0=off.",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    hist_path = Path(args.historical_dir)
    profiles = load_json(PROFILES_PATH)
    recent_form = load_json(RECENT_FORM_PATH)
    player_form = recent_form.get("player_form") or {}
    cv_pools = load_json(C_VC_PATH)
    batting_slots: Dict[str, Any] | None = None
    if BATTING_SLOTS_PATH.exists():
        batting_slots = load_json(BATTING_SLOTS_PATH)

    role_lookup = build_role_lookup_py(profiles)
    valid_teams = set(profiles.get("teams", {}).keys())
    files = list_matches(hist_path)
    matches = [m for m in (load_json(p) for p in files) if is_valid_match_record(m, valid_teams)]
    matches.sort(key=lambda m: m.get("date", ""))

    base = default_tuning()
    baseline_agg, baseline_matches, skipped = run_single_config(
        matches,
        role_lookup,
        profiles,
        player_form,
        batting_slots,
        cv_pools,
        base,
        args.num_teams,
        args.seed,
    )
    baseline_summary = summarize(baseline_agg)

    oat: List[Dict[str, Any]] = []
    if not args.skip_oat:
        grid_repeat = [0.15, 0.42, 0.9, 1.5] if not args.quick else [0.2, 1.0]
        grid_ceiling = [0.0, 0.12, 0.28] if not args.quick else [0.0, 0.12]
        grid_cvc = [0.05, 0.14, 0.35] if not args.quick else [0.05, 0.3]
        grid_lmb = [0.2, 0.5, 0.8, 1.0] if not args.quick else [0.35, 0.9]
        grid_fair = [0.0, 3.0, 8.0] if not args.quick else [1.0, 6.0]
        grid_bp = [0.4, 0.55, 0.7] if not args.quick else [0.45, 0.65]
        grid_bc = [0.15, 0.3, 0.45] if not args.quick else [0.2, 0.4]
        grid_br = [0.05, 0.15, 0.25] if not args.quick else [0.1, 0.2]

        def add_oat(name: str, variants: List[GeneratorTuning]) -> None:
            for t in variants:
                agg, _, _ = run_single_config(
                    matches,
                    role_lookup,
                    profiles,
                    player_form,
                    batting_slots,
                    cv_pools,
                    t,
                    args.num_teams,
                    args.seed,
                )
                oat.append(
                    {
                        "param": name,
                        "tuning": tuning_to_json_dict(t),
                        "summary": summarize(agg),
                    }
                )

        add_oat(
            "repeat_lambda",
            [replace(base, repeat_lambda=v).normalized() for v in grid_repeat],
        )
        add_oat(
            "lineup_ceiling_nudge",
            [replace(base, lineup_ceiling_nudge=v).normalized() for v in grid_ceiling],
        )
        add_oat(
            "cv_uniform_blend",
            [replace(base, cv_uniform_blend=v).normalized() for v in grid_cvc],
        )
        add_oat(
            "lower_middle_bat_weight",
            [replace(base, lower_middle_bat_weight=v).normalized() for v in grid_lmb],
        )
        add_oat(
            "cv_fairness_lambda",
            [replace(base, cv_fairness_lambda=v).normalized() for v in grid_fair],
        )
        add_oat(
            "blend_proj_weight",
            [replace(base, blend_proj_weight=v).normalized() for v in grid_bp],
        )
        add_oat(
            "blend_ceiling_weight",
            [replace(base, blend_ceiling_weight=v).normalized() for v in grid_bc],
        )
        add_oat(
            "blend_role_stability_weight",
            [replace(base, blend_role_stability_weight=v).normalized() for v in grid_br],
        )

    all_summaries = [baseline_summary] + [o["summary"] for o in oat]
    best_hs = max(s[STRATEGY]["best"] for s in all_summaries)

    oat_preset: Optional[GeneratorTuning] = None
    if oat:
        oat_preset = build_oat_merge_preset(base, oat)

    joint_rs_result: Optional[Dict[str, Any]] = None
    joint_rs_trials: List[Dict[str, Any]] = []
    if args.random_search_trials > 0:
        rs_rng = random.Random(args.seed + 91_117)
        joint_rs_result, joint_rs_trials = run_joint_random_search(
            matches,
            role_lookup,
            profiles,
            player_form,
            batting_slots,
            cv_pools,
            args.num_teams,
            args.seed,
            args.random_search_trials,
            rs_rng,
        )

    joint_optuna_result: Optional[Dict[str, Any]] = None
    if args.optuna_trials > 0:
        joint_optuna_result = run_optuna_joint(
            matches,
            role_lookup,
            profiles,
            player_form,
            batting_slots,
            cv_pools,
            args.num_teams,
            args.seed,
            args.optuna_trials,
        )
        if joint_optuna_result is None:
            print("Optuna not installed — skipped. Install with: pip install optuna")

    if args.apply_best_oat or args.random_search_trials > 0 or args.optuna_trials > 0:
        write_presets_file(
            base,
            oat_preset if oat else None,
            joint_rs_result,
            joint_optuna_result,
        )
        print(f"Presets written: {PRESETS_PATH}")

    recommendation = (
        "Walk-forward backtest on realized fantasy points. "
        "Higher mean 'best' = better typical top team in the generated portfolio. "
        "Use OAT rows to see which knobs move the metric. "
        "Joint search maximizes high_scoring_games mean-best. "
        f"Baseline mean best — {STRATEGY}: {baseline_summary[STRATEGY]['best']}."
    )

    report: Dict[str, Any] = {
        "config": {
            "matches": len(matches),
            "skipped_matches": skipped,
            "num_teams_per_match": args.num_teams,
            "attempts_cap_high_scoring_games": args.num_teams
            * ATTEMPTS_MULTIPLIER
            * HIGH_SCORING_ATTEMPTS_MULTIPLIER,
            "seed": args.seed,
            "default_tuning": tuning_to_json_dict(base),
            "note": "Projections use expected_points from prior matches only (same as backtest_gl_portfolio).",
        },
        "baseline_summary": baseline_summary,
        "baseline_per_match": baseline_matches,
        "one_at_a_time_runs": oat,
        "hints": {
            "best_high_scoring_mean_best_seen": best_hs,
        },
        "recommendation": recommendation,
    }
    if joint_rs_result is not None:
        report["joint_random_search"] = {
            "summary": joint_rs_result,
            "trial_count": len(joint_rs_trials),
            "top_trials_by_objective": sorted(
                joint_rs_trials,
                key=lambda r: r["joint_objective"],
                reverse=True,
            )[:10],
        }
    if joint_optuna_result is not None:
        report["joint_optuna"] = joint_optuna_result

    write_json(Path(args.output), report)
    print(f"Matches: {len(matches)}, skipped: {skipped}")
    print("Baseline (mean across matches):")
    print(f"  {STRATEGY}: {baseline_summary[STRATEGY]}")
    if joint_rs_result:
        print(
            "Joint random search best:",
            joint_rs_result["best_joint_objective"],
            "tuning",
            joint_rs_result["best_tuning"],
        )
    if joint_optuna_result:
        print(
            "Joint Optuna best:",
            joint_optuna_result["best_joint_objective"],
            joint_optuna_result["best_tuning"],
        )
    print(f"Report written: {args.output}")


if __name__ == "__main__":
    main()
