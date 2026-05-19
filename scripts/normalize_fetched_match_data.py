#!/usr/bin/env python3
"""Normalize fetched match artifacts into scorecard template format."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


RAW_DIR = Path("data/raw_scorecards")
SQUADS_PATH = Path("data/ipl2026_squads.json")
OUT_DIR = Path("data/normalized_scorecards")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize raw fetched scorecard artifacts.")
    parser.add_argument("--match-id", required=True, help="Match id used during fetch (e.g. IPL2026-021).")
    parser.add_argument("--source", default="cricbuzz", help="Source key used during fetch.")
    parser.add_argument("--team-a", required=True, help="Team A exact name.")
    parser.add_argument("--team-b", required=True, help="Team B exact name.")
    parser.add_argument("--date", required=True, help="Match date YYYY-MM-DD")
    parser.add_argument(
        "--output",
        default="",
        help="Optional output JSON path. Defaults to data/normalized_scorecards/<match_id>.json",
    )
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def build_player_team_lookup(squads: Dict[str, Any], team_a: str, team_b: str) -> Dict[str, str]:
    lookup: Dict[str, str] = {}
    for team in squads.get("teams", []):
        tname = team["team"]
        if tname not in {team_a, team_b}:
            continue
        for p in [team.get("captain"), *team.get("players", [])]:
            if p:
                lookup[p.lower()] = tname
    return lookup


def parse_number(value: Any, default: int = 0) -> int:
    try:
        return int(float(str(value).strip()))
    except Exception:
        return default


def parse_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(str(value).strip())
    except Exception:
        return default


def extract_from_blob_obj(
    obj: Any,
    player_team_lookup: Dict[str, str],
) -> List[Dict[str, Any]]:
    """Try to discover score rows in unknown JSON tree."""
    rows: List[Dict[str, Any]] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            # Heuristic for batting row
            keys = {k.lower() for k in node.keys()}
            if {"name", "runs"}.issubset(keys) and ("balls" in keys or "b" in keys):
                name = str(node.get("name") or node.get("batsmanName") or "").strip()
                if name:
                    team = player_team_lookup.get(name.lower(), "")
                    rows.append(
                        {
                            "team": team,
                            "player": name,
                            "batting": {
                                "runs": parse_number(node.get("runs", node.get("r", 0))),
                                "balls": parse_number(node.get("balls", node.get("b", 0))),
                                "fours": parse_number(node.get("fours", node.get("4s", 0))),
                                "sixes": parse_number(node.get("sixes", node.get("6s", 0))),
                            },
                            "bowling": {"overs": 0, "runs_conceded": 0, "wickets": 0, "lbw_bowled": 0},
                            "fielding": {"catches": 0, "stumpings": 0, "run_out_direct": 0, "run_out_indirect": 0},
                        }
                    )
            # Heuristic for bowling row
            if {"name", "overs", "wickets"}.issubset(keys):
                name = str(node.get("name") or node.get("bowlerName") or "").strip()
                if name:
                    team = player_team_lookup.get(name.lower(), "")
                    rows.append(
                        {
                            "team": team,
                            "player": name,
                            "batting": {"runs": 0, "balls": 0, "fours": 0, "sixes": 0},
                            "bowling": {
                                "overs": str(node.get("overs", 0)),
                                "runs_conceded": parse_number(node.get("runs", node.get("runsConceded", 0))),
                                "wickets": parse_number(node.get("wickets", node.get("wkts", 0))),
                                "lbw_bowled": 0,
                            },
                            "fielding": {"catches": 0, "stumpings": 0, "run_out_direct": 0, "run_out_indirect": 0},
                        }
                    )
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for x in node:
                walk(x)

    walk(obj)
    return rows


def merge_player_rows(rows: List[Dict[str, Any]], player_team_lookup: Dict[str, str]) -> List[Dict[str, Any]]:
    by_player: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        name = r["player"].strip()
        key = name.lower()
        if key not in by_player:
            team = r.get("team") or player_team_lookup.get(key, "")
            by_player[key] = {
                "team": team,
                "player": name,
                "role": "batsman",
                "is_in_playing_xi": True,
                "batting": {"runs": 0, "balls": 0, "fours": 0, "sixes": 0},
                "bowling": {"overs": "0", "runs_conceded": 0, "wickets": 0, "lbw_bowled": 0},
                "fielding": {"catches": 0, "stumpings": 0, "run_out_direct": 0, "run_out_indirect": 0},
            }
        tgt = by_player[key]
        # Use max for batting runs/balls, bowling wickets/runs.
        tgt["batting"]["runs"] = max(tgt["batting"]["runs"], parse_number(r.get("batting", {}).get("runs", 0)))
        tgt["batting"]["balls"] = max(tgt["batting"]["balls"], parse_number(r.get("batting", {}).get("balls", 0)))
        tgt["batting"]["fours"] = max(tgt["batting"]["fours"], parse_number(r.get("batting", {}).get("fours", 0)))
        tgt["batting"]["sixes"] = max(tgt["batting"]["sixes"], parse_number(r.get("batting", {}).get("sixes", 0)))
        bw = r.get("bowling", {})
        tgt["bowling"]["overs"] = str(max(parse_float(tgt["bowling"]["overs"], 0), parse_float(bw.get("overs", 0), 0)))
        tgt["bowling"]["runs_conceded"] = max(tgt["bowling"]["runs_conceded"], parse_number(bw.get("runs_conceded", 0)))
        tgt["bowling"]["wickets"] = max(tgt["bowling"]["wickets"], parse_number(bw.get("wickets", 0)))
    # Keep only players with known team and some activity.
    normalized = []
    for p in by_player.values():
        active = p["batting"]["balls"] > 0 or parse_float(p["bowling"]["overs"], 0) > 0
        if p["team"] and active:
            normalized.append(p)
    return sorted(normalized, key=lambda x: (x["team"], x["player"]))


def fallback_parse_from_html(html: str, player_team_lookup: Dict[str, str]) -> List[Dict[str, Any]]:
    """Basic regex fallback for scorecard lines like: Name ... runs balls ..."""
    rows: List[Dict[str, Any]] = []
    # Very loose pattern; may capture false positives.
    pattern = re.compile(r"\n([A-Za-z .'-]{3,})\n+(\d{1,3})\n+(\d{1,3})\n+(\d{1,2})\n+(\d{1,2})\n+(\d{1,3}\.\d{1,2})")
    for m in pattern.finditer(html):
        name = m.group(1).strip()
        if name.lower() not in player_team_lookup:
            continue
        rows.append(
            {
                "team": player_team_lookup.get(name.lower(), ""),
                "player": name,
                "batting": {
                    "runs": parse_number(m.group(2)),
                    "balls": parse_number(m.group(3)),
                    "fours": parse_number(m.group(4)),
                    "sixes": parse_number(m.group(5)),
                },
                "bowling": {"overs": 0, "runs_conceded": 0, "wickets": 0, "lbw_bowled": 0},
                "fielding": {"catches": 0, "stumpings": 0, "run_out_direct": 0, "run_out_indirect": 0},
            }
        )
    return rows


def main() -> None:
    args = parse_args()
    squads = load_json(SQUADS_PATH)
    lookup = build_player_team_lookup(squads, args.team_a, args.team_b)

    blob_path = RAW_DIR / f"{args.match_id}__{args.source}__blobs.json"
    html_path = RAW_DIR / f"{args.match_id}__{args.source}.html"
    if not blob_path.exists() and not html_path.exists():
        raise SystemExit("No raw artifacts found. Run fetch_match_data_online.py first.")

    rows: List[Dict[str, Any]] = []
    blobs_used = 0
    if blob_path.exists():
        blobs = load_json(blob_path)
        for blob in blobs if isinstance(blobs, list) else []:
            extracted = extract_from_blob_obj(blob, lookup)
            if extracted:
                blobs_used += 1
                rows.extend(extracted)

    html_used = False
    if not rows and html_path.exists():
        html = html_path.read_text(encoding="utf-8", errors="replace")
        rows.extend(fallback_parse_from_html(html, lookup))
        html_used = True

    merged = merge_player_rows(rows, lookup)
    output = Path(args.output) if args.output else (OUT_DIR / f"{args.match_id}.json")
    payload = {
        "match_id": args.match_id,
        "date": args.date,
        "team_a": args.team_a,
        "team_b": args.team_b,
        "players": merged,
        "normalizer_meta": {
            "source": args.source,
            "blob_file": str(blob_path),
            "html_file": str(html_path),
            "rows_detected_raw": len(rows),
            "players_normalized": len(merged),
            "blobs_used": blobs_used,
            "html_fallback_used": html_used,
        },
    }
    write_json(output, payload)
    print(f"Normalized file: {output}")
    print(f"Players normalized: {len(merged)}")
    print(f"Blobs used: {blobs_used}, html fallback: {html_used}")


if __name__ == "__main__":
    main()
