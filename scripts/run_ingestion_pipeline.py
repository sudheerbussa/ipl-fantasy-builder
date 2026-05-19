#!/usr/bin/env python3
"""Run end-to-end ingestion pipeline for one match URL."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch -> normalize -> convert -> optional backtest")
    parser.add_argument("--match-id", required=True, help="Match id, e.g. IPL2026-021")
    parser.add_argument("--url", required=True, help="Scorecard URL")
    parser.add_argument("--source", default="cricbuzz", choices=["cricbuzz", "espncricinfo", "generic"])
    parser.add_argument("--date", required=True, help="Match date YYYY-MM-DD")
    parser.add_argument("--team-a", required=True, help="Team A exact name")
    parser.add_argument("--team-b", required=True, help="Team B exact name")
    parser.add_argument("--run-backtest", action="store_true", help="Run 40-team backtest after ingestion")
    parser.add_argument("--num-teams", type=int, default=40, help="Team count for backtest (if enabled)")
    return parser.parse_args()


def run(cmd: list[str], desc: str) -> None:
    print(f"\n[STEP] {desc}")
    print(" ".join(cmd))
    result = subprocess.run(cmd, cwd=ROOT)
    if result.returncode != 0:
        raise RuntimeError(f"Step failed: {desc}")


def main() -> None:
    args = parse_args()
    normalized_out = f"data/normalized_scorecards/{args.match_id}.json"
    historical_out = f"data/historical_matches/{args.match_id}.json"

    try:
        run(
            [
                sys.executable,
                "scripts/fetch_match_data_online.py",
                "--match-id",
                args.match_id,
                "--source",
                args.source,
                "--url",
                args.url,
            ],
            "Fetch raw match data",
        )
        run(
            [
                sys.executable,
                "scripts/normalize_fetched_match_data.py",
                "--match-id",
                args.match_id,
                "--source",
                args.source,
                "--date",
                args.date,
                "--team-a",
                args.team_a,
                "--team-b",
                args.team_b,
                "--output",
                normalized_out,
            ],
            "Normalize fetched data",
        )
        run(
            [
                sys.executable,
                "scripts/convert_scorecard_to_fantasy.py",
                "--input",
                normalized_out,
                "--output",
                historical_out,
            ],
            "Convert normalized scorecard to fantasy points",
        )

        if args.run_backtest:
            run(
                [
                    sys.executable,
                    "scripts/backtest_gl_portfolio.py",
                    "--num-teams",
                    str(args.num_teams),
                ],
                f"Run backtest ({args.num_teams} teams)",
            )

        print("\nPipeline completed successfully.")
        print(f"- Normalized: {normalized_out}")
        print(f"- Historical fantasy file: {historical_out}")
    except RuntimeError as exc:
        print(f"\nPipeline stopped: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
