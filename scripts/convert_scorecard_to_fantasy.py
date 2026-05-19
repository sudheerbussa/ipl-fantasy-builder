#!/usr/bin/env python3
"""Convert normalized scorecard stats into Dream11-like fantasy points."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple


DEFAULT_SCORING = {
    "playing_xi": 4,  # In announced lineups
    "playing_substitute": 4,  # Impact / substitute (when explicitly marked)
    "batting": {
        "run": 1,
        "four_bonus": 4,
        "six_bonus": 6,
        "duck_penalty": -2,  # apply for batters/all-rounders/wk with runs == 0 and balls > 0
        "milestones": [
            {"min_runs": 100, "points": 16},
            {"min_runs": 50, "points": 8},
            {"min_runs": 25, "points": 4},
            {"min_runs": 75, "points": 12},
        ],
    },
    "bowling": {
        "wicket": 30,  # Excluding run out
        "dot_ball": 1,
        "maiden_over": 12,
        "lbw_bowled_bonus": 8,  # optional if provided in input
        "milestones": [
            {"min_wickets": 3, "points": 4},
            {"min_wickets": 4, "points": 8},
            {"min_wickets": 5, "points": 12},
        ],
    },
    "fielding": {
        "catch": 8,
        "stumping": 12,
        "run_out_direct": 12,
        "run_out_indirect": 6,
        "three_catch_bonus": 4,
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert scorecard stats to fantasy points.")
    parser.add_argument("--input", required=True, help="Normalized scorecard JSON file.")
    parser.add_argument(
        "--output",
        required=True,
        help="Output match JSON file (compatible with historical backtest format).",
    )
    parser.add_argument(
        "--scoring-config",
        default="",
        help="Optional custom scoring config JSON path.",
    )
    return parser.parse_args()


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=True)
        f.write("\n")


def overs_to_float(overs: Any) -> float:
    if isinstance(overs, (int, float)):
        return float(overs)
    if isinstance(overs, str) and "." in overs:
        o, b = overs.split(".", 1)
        return float(o) + float(b) / 6.0
    return float(overs or 0)


def compute_batting_points(player: Dict[str, Any], scoring: Dict[str, Any]) -> int:
    b = player.get("batting", {})
    role = player.get("role", "batsman")
    runs = int(b.get("runs", 0))
    balls = int(b.get("balls", 0))
    fours = int(b.get("fours", 0))
    sixes = int(b.get("sixes", 0))
    pts = runs * scoring["batting"]["run"] + fours * scoring["batting"]["four_bonus"] + sixes * scoring["batting"]["six_bonus"]

    for ms in sorted(scoring["batting"]["milestones"], key=lambda x: x["min_runs"], reverse=True):
        if runs >= ms["min_runs"]:
            pts += ms["points"]
            break

    if runs == 0 and balls > 0 and role in {"batsman", "all_rounder", "wicket_keeper"}:
        pts += scoring["batting"]["duck_penalty"]

    # Strike-rate points (except pure bowlers), min 10 balls.
    if balls >= 10 and role != "bowler":
        sr = (runs / balls) * 100 if balls else 0
        if sr > 170:
            pts += 6
        elif 150 < sr <= 170:
            pts += 4
        elif 130 <= sr <= 150:
            pts += 2
        elif 60 <= sr <= 70:
            pts -= 2
        elif 50 <= sr < 60:
            pts -= 4
        elif sr < 50:
            pts -= 6
    return int(pts)


def compute_bowling_points(player: Dict[str, Any], scoring: Dict[str, Any]) -> int:
    bw = player.get("bowling", {})
    wickets = int(bw.get("wickets", 0))
    runs_conceded = float(bw.get("runs_conceded", 0))
    overs = overs_to_float(bw.get("overs", 0))
    lbw_bowled = int(bw.get("lbw_bowled", 0))
    dot_balls = int(bw.get("dot_balls", 0))
    maidens = int(bw.get("maidens", 0))
    pts = (
        wickets * scoring["bowling"]["wicket"]
        + lbw_bowled * scoring["bowling"]["lbw_bowled_bonus"]
        + dot_balls * scoring["bowling"]["dot_ball"]
        + maidens * scoring["bowling"]["maiden_over"]
    )

    for ms in sorted(scoring["bowling"]["milestones"], key=lambda x: x["min_wickets"], reverse=True):
        if wickets >= ms["min_wickets"]:
            pts += ms["points"]
            break

    if overs >= 2:
        er = (runs_conceded / overs) if overs else 99
        # Economy-rate points bands from screenshot.
        if er < 5:
            pts += 6
        elif 5 <= er < 6:
            pts += 4
        elif 6 <= er <= 7:
            pts += 2
        elif 10 <= er <= 11:
            pts -= 2
        elif 11 < er <= 12:
            pts -= 4
        elif er > 12:
            pts -= 6
    return int(pts)


def compute_fielding_points(player: Dict[str, Any], scoring: Dict[str, Any]) -> int:
    f = player.get("fielding", {})
    catches = int(f.get("catches", 0))
    stumpings = int(f.get("stumpings", 0))
    ro_dir = int(f.get("run_out_direct", 0))
    ro_ind = int(f.get("run_out_indirect", 0))
    pts = (
        catches * scoring["fielding"]["catch"]
        + stumpings * scoring["fielding"]["stumping"]
        + ro_dir * scoring["fielding"]["run_out_direct"]
        + ro_ind * scoring["fielding"]["run_out_indirect"]
    )
    if catches >= 3:
        pts += scoring["fielding"]["three_catch_bonus"]
    return int(pts)


def parse_dismissal_contributions(
    players: List[Dict[str, Any]],
) -> Tuple[Dict[Tuple[str, str], Dict[str, int]], Dict[Tuple[str, str], int]]:
    """
    Parse dismissal text from batting rows and derive:
    - fielding contributions for fielders/keepers
    - lbw_or_bowled wicket counts for bowlers
    """
    # quick player lookup by lowercase name
    roster = {
        (p.get("player", "").strip().lower()): (p.get("team", ""), p.get("player", "").strip())
        for p in players
    }

    fielding_map: Dict[Tuple[str, str], Dict[str, int]] = {}
    lbw_bowled_map: Dict[Tuple[str, str], int] = {}

    def ensure_fielding_key(team: str, player: str) -> Dict[str, int]:
        key = (team, player)
        if key not in fielding_map:
            fielding_map[key] = {
                "catches": 0,
                "stumpings": 0,
                "run_out_direct": 0,
                "run_out_indirect": 0,
            }
        return fielding_map[key]

    for p in players:
        b = p.get("batting", {})
        dismissal = str(
            b.get("dismissal_text")
            or b.get("dismissal")
            or b.get("how_out")
            or b.get("out_desc")
            or ""
        ).strip()
        if not dismissal:
            continue
        lower = dismissal.lower()

        # c Fielder b Bowler
        if lower.startswith("c ") and " b " in lower and "run out" not in lower:
            try:
                first = dismissal.split(" b ", 1)[0].strip()  # c Fielder
                fielder_name = first[2:].strip().strip("()")
                fielder_key = fielder_name.lower()
                if fielder_key in roster:
                    fielder_team, fielder_canonical = roster[fielder_key]
                    ensure_fielding_key(fielder_team, fielder_canonical)["catches"] += 1
            except Exception:
                pass

        # st Keeper b Bowler
        if lower.startswith("st ") and " b " in lower:
            try:
                first = dismissal.split(" b ", 1)[0].strip()  # st Keeper
                keeper_name = first[3:].strip().strip("()")
                keeper_key = keeper_name.lower()
                if keeper_key in roster:
                    keeper_team, keeper_canonical = roster[keeper_key]
                    ensure_fielding_key(keeper_team, keeper_canonical)["stumpings"] += 1
            except Exception:
                pass

        # run out (Fielder) OR run out (Fielder1/Fielder2)
        if "run out" in lower:
            inside = ""
            if "(" in dismissal and ")" in dismissal:
                inside = dismissal.split("(", 1)[1].split(")", 1)[0]
            names = [x.strip() for x in inside.split("/") if x.strip()]
            if len(names) == 1:
                nm = names[0]
                key = nm.lower()
                if key in roster:
                    team, canonical = roster[key]
                    ensure_fielding_key(team, canonical)["run_out_direct"] += 1
            elif len(names) >= 2:
                # assign first as direct, second as indirect (heuristic)
                nm1, nm2 = names[0], names[1]
                k1, k2 = nm1.lower(), nm2.lower()
                if k1 in roster:
                    t1, c1 = roster[k1]
                    ensure_fielding_key(t1, c1)["run_out_direct"] += 1
                if k2 in roster:
                    t2, c2 = roster[k2]
                    ensure_fielding_key(t2, c2)["run_out_indirect"] += 1

        # LBW / Bowled bonus to bowler
        # e.g. "lbw b Bowler", "b Bowler"
        if lower.startswith("lbw b "):
            bowler = dismissal[6:].strip()
            key = bowler.lower()
            if key in roster:
                team, canonical = roster[key]
                lbw_bowled_map[(team, canonical)] = lbw_bowled_map.get((team, canonical), 0) + 1
        elif lower.startswith("b "):
            bowler = dismissal[2:].strip()
            key = bowler.lower()
            if key in roster:
                team, canonical = roster[key]
                lbw_bowled_map[(team, canonical)] = lbw_bowled_map.get((team, canonical), 0) + 1
        elif " b " in lower:
            # Fallback heuristic requested by user:
            # if dismissal is not catch/stumping/run-out and still bowler-attributed,
            # treat it as bowled/lbw style wicket for bonus.
            is_fielding_dismissal = lower.startswith("c ") or lower.startswith("st ") or "run out" in lower
            excluded = (
                "retired" in lower
                or "timed out" in lower
                or "obstructing" in lower
                or "hit wicket" in lower
                or "handled the ball" in lower
                or "not out" in lower
            )
            if not is_fielding_dismissal and not excluded:
                bowler = dismissal.rsplit(" b ", 1)[-1].strip()
                key = bowler.lower()
                if key in roster:
                    team, canonical = roster[key]
                    lbw_bowled_map[(team, canonical)] = lbw_bowled_map.get((team, canonical), 0) + 1

    return fielding_map, lbw_bowled_map


def main() -> None:
    args = parse_args()
    inp = load_json(Path(args.input))
    scoring = DEFAULT_SCORING
    if args.scoring_config:
        scoring = load_json(Path(args.scoring_config))

    players = inp.get("players", [])
    fielding_map, lbw_bowled_map = parse_dismissal_contributions(players)

    player_rows = []
    for p in players:
        playing_xi = bool(p.get("is_in_playing_xi", True))
        is_substitute = bool(p.get("is_playing_substitute", False))
        key = (p.get("team", ""), p.get("player", ""))

        # Merge parsed fielding contributions into row before point computation.
        if key in fielding_map:
            f = p.setdefault("fielding", {})
            merged = fielding_map[key]
            f["catches"] = int(f.get("catches", 0)) + int(merged.get("catches", 0))
            f["stumpings"] = int(f.get("stumpings", 0)) + int(merged.get("stumpings", 0))
            f["run_out_direct"] = int(f.get("run_out_direct", 0)) + int(merged.get("run_out_direct", 0))
            f["run_out_indirect"] = int(f.get("run_out_indirect", 0)) + int(merged.get("run_out_indirect", 0))

        # Merge lbw/bowled bonus wickets for bowlers.
        if key in lbw_bowled_map:
            bw = p.setdefault("bowling", {})
            bw["lbw_bowled"] = int(bw.get("lbw_bowled", 0)) + int(lbw_bowled_map[key])

        bat = compute_batting_points(p, scoring)
        bowl = compute_bowling_points(p, scoring)
        fld = compute_fielding_points(p, scoring)
        xi = scoring["playing_xi"] if playing_xi else 0
        sub = scoring["playing_substitute"] if is_substitute else 0
        total = xi + sub + bat + bowl + fld
        player_rows.append(
            {
                "team": p["team"],
                "player": p["player"],
                "runs": int(p.get("batting", {}).get("runs", 0)),
                "wickets": int(p.get("bowling", {}).get("wickets", 0)),
                "fantasy_points": int(total),
                "breakdown": {
                    "playing_xi": xi,
                    "playing_substitute": sub,
                    "batting": bat,
                    "bowling": bowl,
                    "fielding": fld,
                },
            }
        )

    out = {
        "match_id": inp["match_id"],
        "date": inp["date"],
        "team_a": inp["team_a"],
        "team_b": inp["team_b"],
        "player_stats": player_rows,
    }
    write_json(Path(args.output), out)
    print(f"Wrote fantasy points match file: {args.output}")


if __name__ == "__main__":
    main()
