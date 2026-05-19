#!/usr/bin/env python3
"""Draft `data/ipl2026_batting_slots.json` from normalized scorecards.

Heuristic (no true batting order in JSON): within each team in each match,
among players with balls faced > 0, rank 1 = most balls (proxy for early
order). Pure bowlers with 0 balls -> slot 10. Bat/AR/WK with 0 balls -> 8.

Across matches, `typical_slot` = rounded median of observed ranks.

Use `--merge` to keep existing file entries; entries with ``"source": "manual"``
are never overwritten."""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path
from typing import Any, Dict, List


def load_json(path: Path) -> Dict[str, Any]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def balls_faced(row: Dict[str, Any]) -> int:
    b = row.get("batting") or {}
    try:
        return int(float(str(b.get("balls", 0))))
    except Exception:
        return 0


def runs_bat(row: Dict[str, Any]) -> int:
    b = row.get("batting") or {}
    try:
        return int(float(str(b.get("runs", 0))))
    except Exception:
        return 0


def role_kind(role: str) -> str:
    r = (role or "batsman").lower()
    if r in ("wicket_keeper", "wk"):
        return "wk"
    if r == "bowler":
        return "bowler"
    if r in ("all_rounder", "allrounder"):
        return "ar"
    return "bat"


def infer_slot_for_match(team_rows: List[Dict[str, Any]], row: Dict[str, Any]) -> int:
    rk = role_kind(str(row.get("role", "")))
    bf = balls_faced(row)
    if rk == "bowler" and bf == 0:
        return 10

    batters = [p for p in team_rows if balls_faced(p) > 0]
    batters.sort(key=lambda p: (balls_faced(p), runs_bat(p)), reverse=True)
    order = {p["player"]: idx + 1 for idx, p in enumerate(batters)}
    name = row.get("player")
    if name in order:
        return max(1, min(11, order[name]))
    if rk == "bowler":
        return 10
    if bf == 0:
        return 8
    return 7


def collect_slots(input_dir: Path) -> Dict[str, Dict[str, List[int]]]:
    slots: Dict[str, Dict[str, List[int]]] = {}
    for path in sorted(input_dir.glob("*.json")):
        data = load_json(path)
        players: List[Dict[str, Any]] = data.get("players") or []
        by_team: Dict[str, List[Dict[str, Any]]] = {}
        for p in players:
            if not p.get("is_in_playing_xi"):
                continue
            t = p.get("team")
            if not t:
                continue
            by_team.setdefault(str(t), []).append(p)
        for team, trows in by_team.items():
            slots.setdefault(team, {})
            for row in trows:
                name = row.get("player")
                if not name:
                    continue
                slot = infer_slot_for_match(trows, row)
                slots[team].setdefault(str(name), []).append(slot)
    return slots


def aggregate(slots: Dict[str, Dict[str, List[int]]]) -> Dict[str, Dict[str, Any]]:
    out_teams: Dict[str, Dict[str, Any]] = {}
    for team, pmap in slots.items():
        out_teams[team] = {}
        for player, arr in pmap.items():
            med = int(round(statistics.median(arr)))
            med = max(1, min(11, med))
            out_teams[team][player] = {
                "typical_slot": med,
                "source": "scorecard_median",
                "matches_observed": len(arr),
            }
    return out_teams


def merge_teams(existing: Dict[str, Any], draft: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {k: dict(v) for k, v in (existing or {}).items()}
    for team, pmap in draft.items():
        merged.setdefault(team, {})
        for player, ent in pmap.items():
            old = merged[team].get(player)
            if isinstance(old, dict) and str(old.get("source", "")).lower() == "manual":
                continue
            merged[team][player] = ent
    return merged


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--input-dir",
        type=Path,
        default=Path("data/normalized_scorecards"),
        help="Directory of normalized scorecard JSON files.",
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=Path("data/ipl2026_batting_slots.json"),
        help="Output path (ipl2026_batting_slots.json schema).",
    )
    ap.add_argument(
        "--merge",
        action="store_true",
        help="Merge into existing output; manual sources preserved.",
    )
    ap.add_argument("--dry-run", action="store_true", help="Print summary only; do not write.")
    args = ap.parse_args()

    slots = collect_slots(args.input_dir)
    draft_teams = aggregate(slots)

    if args.merge and args.output.exists():
        cur = load_json(args.output)
        existing_teams = cur.get("teams") or {}
        final_teams = merge_teams(existing_teams, draft_teams)
    else:
        final_teams = draft_teams

    payload = {
        "version": 1,
        "notes": "typical_batting_slot from scorecard heuristic (balls-faced rank) unless overridden; "
        "source=manual preserved with --merge. Refine key players by hand.",
        "teams": final_teams,
    }

    n_players = sum(len(v) for v in final_teams.values())
    print(f"Teams: {len(final_teams)}  Players with slots: {n_players}  (from {args.input_dir})")
    if args.dry_run:
        return
    write_json(args.output, payload)
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
