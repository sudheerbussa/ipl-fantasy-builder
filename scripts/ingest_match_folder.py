#!/usr/bin/env python3
"""Bulk ingest all match JSON files into recent form DB."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import List


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest all match input JSON files in a folder."
    )
    parser.add_argument(
        "--inputs-dir",
        default="data/match_inputs",
        help="Directory containing match JSON files.",
    )
    parser.add_argument(
        "--skip-errors",
        action="store_true",
        help="Continue processing even if one file fails.",
    )
    return parser.parse_args()


def sorted_match_files(inputs_dir: Path) -> List[Path]:
    files = [p for p in inputs_dir.glob("*.json") if p.is_file()]
    return sorted(files, key=lambda p: p.name)


def read_match_id(path: Path) -> str:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return str(payload.get("match_id", path.name))
    except json.JSONDecodeError:
        return path.name


def main() -> None:
    args = parse_args()
    inputs_dir = Path(args.inputs_dir)
    files = sorted_match_files(inputs_dir)

    if not files:
        print(f"No match files found in: {inputs_dir}")
        return

    ok_count = 0
    skipped = []
    failed = []

    for file_path in files:
        cmd = [
            "python3",
            "scripts/update_recent_form.py",
            "--match-file",
            str(file_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            ok_count += 1
            print(f"[OK] {file_path.name}")
        else:
            match_id = read_match_id(file_path)
            reason = result.stderr.strip() or result.stdout.strip() or "Unknown error"
            if "Duplicate match_id already present" in reason:
                skipped.append((file_path.name, match_id))
                print(f"[SKIP] {file_path.name} ({match_id}) duplicate")
            else:
                failed.append((file_path.name, match_id, reason))
                print(f"[FAIL] {file_path.name} ({match_id})")
                if not args.skip_errors:
                    break

    print(f"\nIngested successfully: {ok_count}")
    print(f"Skipped duplicates: {len(skipped)}")
    if failed:
        print(f"Failed: {len(failed)}")
        for file_name, match_id, reason in failed:
            print(f"- {file_name} ({match_id}): {reason.splitlines()[-1]}")
    else:
        print("Failed: 0")


if __name__ == "__main__":
    main()
