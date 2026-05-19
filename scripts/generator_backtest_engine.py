"""
Generator logic aligned with web/app.js: `high_scoring_games` only (6-cell catalog + C/VC pools).

Used by tune_generator_backtest.py to score portfolios against realized fantasy points.
"""

from __future__ import annotations

import itertools
import math
import random
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

PlayerKey = Tuple[str, str]

ROLE_PRIORS = {
    "wicket_keeper": 34.0,
    "all_rounder": 38.0,
    "bowler": 32.0,
    "batsman": 30.0,
}

ATTEMPTS_MULTIPLIER = 500
HIGH_SCORING_MIN_QUOTA_FRAC = 0.8
HIGH_SCORING_ATTEMPTS_MULTIPLIER = 4
LINEUP_REPEAT_COOLDOWN = 3
# Fixed high-scoring catalog: A1 × {B1, B2a, B3} per α/β — omits A1–B2b (death-decided chase).
HIGH_SCORING_SCENARIO_IDS_BATTING_HEAVY_6 = [
    "α1",
    "α2",
    "α4",
    "β1",
    "β2",
    "β4",
]
DEFAULT_SCENARIO_PROFILE = "batting_heavy_6"
HIGH_SCORING_SCENARIO_PROFILES = {
    "batting_heavy_6": HIGH_SCORING_SCENARIO_IDS_BATTING_HEAVY_6,
}


@dataclass
class GeneratorTuning:
    """Tunable knobs for `high_scoring_games` generation (single strategy)."""

    repeat_lambda: float = 0.42
    cv_uniform_blend: float = 0.14
    lineup_ceiling_nudge: float = 0.12
    lower_middle_bat_weight: float = 0.5
    cv_fairness_lambda: float = 3.0
    blend_proj_weight: float = 0.55
    blend_ceiling_weight: float = 0.30
    blend_role_stability_weight: float = 0.15

    def normalized(self) -> "GeneratorTuning":
        bp = float(max(0.0, min(1.0, self.blend_proj_weight)))
        bc = float(max(0.0, min(1.0, self.blend_ceiling_weight)))
        br = float(max(0.0, min(1.0, self.blend_role_stability_weight)))
        blend_sum = bp + bc + br
        if blend_sum <= 0:
            bp, bc, br = 0.55, 0.30, 0.15
            blend_sum = 1.0
        return GeneratorTuning(
            repeat_lambda=float(max(0.0, min(3.0, self.repeat_lambda))),
            cv_uniform_blend=float(max(0.0, min(1.0, self.cv_uniform_blend))),
            lineup_ceiling_nudge=float(max(0.0, min(0.5, self.lineup_ceiling_nudge))),
            lower_middle_bat_weight=float(max(0.05, min(1.0, self.lower_middle_bat_weight))),
            cv_fairness_lambda=float(max(0.0, min(25.0, self.cv_fairness_lambda))),
            blend_proj_weight=bp / blend_sum,
            blend_ceiling_weight=bc / blend_sum,
            blend_role_stability_weight=br / blend_sum,
        )


HIGH_SCORING_DRAW_PARAMS = {"temperature": 1.14, "noise": 0.24}


def weighted_average(values: List[float]) -> float:
    if not values:
        return 0.0
    weights = [i + 1 for i in range(len(values))]
    return sum(v * w for v, w in zip(values, weights)) / sum(weights)


def infer_batting_slot_from_profile(profile: Dict[str, Any]) -> int:
    tags = profile.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    role = profile.get("primary_role", "batsman")
    if role == "bowler":
        return 9
    if role == "all_rounder":
        if "top_order" in tags:
            return 3
        if "finisher" in tags:
            return 6
        return 7
    if role == "wicket_keeper":
        if "finisher" in tags:
            return 6
        if "top_order" in tags:
            return 2
        return 4
    if "top_order" in tags:
        return 2
    if "middle_order" in tags:
        return 5
    if "finisher" in tags:
        return 6
    if "anchor" in tags:
        return 3
    return 5


def resolve_typical_slot(
    team: str,
    player: str,
    profile: Dict[str, Any],
    batting_slots: Optional[Dict[str, Any]],
) -> int:
    if batting_slots:
        team_map = batting_slots.get("teams", {}).get(team) or {}
        ent = team_map.get(player) if isinstance(team_map, dict) else None
        if isinstance(ent, dict) and isinstance(ent.get("typical_slot"), (int, float)):
            s = int(ent["typical_slot"])
            if 1 <= s <= 11:
                return s
    return infer_batting_slot_from_profile(profile)


def normalize_role_label(role: str) -> str:
    s = str(role or "").strip().lower().replace("-", "_")
    if s in ("wk", "wicket_keeper"):
        return "wicket_keeper"
    if s in ("bat", "batsman"):
        return "batsman"
    if s in ("ar", "all_rounder", "allrounder"):
        return "all_rounder"
    if s in ("bowl", "bowler"):
        return "bowler"
    return "batsman"


def resolve_profile_role(profile: Dict[str, Any], fallback_role: str) -> str:
    if bool(profile.get("is_wicket_keeper")):
        return "wicket_keeper"
    primary = profile.get("primary_role", fallback_role)
    return normalize_role_label(str(primary))


def pool_player_key(row: Dict[str, Any]) -> str:
    return f'{row["team"]}::{row["player"]}'


def repeat_penalty_factor(
    row: Dict[str, Any], appearance_counts: Dict[str, int], repeat_lambda: float
) -> float:
    c = appearance_counts.get(pool_player_key(row), 0)
    return 1.0 / (1.0 + repeat_lambda * c)


def lower_middle_batsman_draw_factor(row: Dict[str, Any], t: GeneratorTuning) -> float:
    if row.get("role") != "batsman":
        return 1.0
    s = int(row.get("typical_slot") or 5)
    if s < 6:
        return 1.0
    w = float(t.lower_middle_bat_weight)
    return max(0.05, min(1.0, w))


def blended_player_score(row: Dict[str, Any], tuning: GeneratorTuning) -> float:
    t = tuning.normalized()
    proj = float(row.get("proj") or 0)
    cap = min(float(row.get("ceiling") or 0), proj + 28.0)
    role_stability = max(0.0, min(1.0, float(row.get("role_stability") or 0.0)))
    return (
        t.blend_proj_weight * proj
        + t.blend_ceiling_weight * cap
        + t.blend_role_stability_weight * (proj * role_stability)
    )


def compute_row_draw_weight(
    row: Dict[str, Any],
    params: Dict[str, float],
    appearance_counts: Dict[str, int],
    tuning: GeneratorTuning,
    rng: random.Random,
) -> float:
    t = tuning.normalized()
    rep = repeat_penalty_factor(row, appearance_counts, float(t.repeat_lambda))
    bat_f = lower_middle_batsman_draw_factor(row, t)
    base_proj = blended_player_score(row, t)
    ceiling = float(row.get("ceiling") or 0)
    ceiling_gap = max(0.0, ceiling - base_proj)
    lift = min(0.55, ceiling_gap / 48.0)
    base = base_proj * (1 + t.lineup_ceiling_nudge * lift)
    noisy = base * (1 + (rng.random() * 2 - 1) * params["noise"])
    return max(0.01, math.pow(max(0.1, noisy), params["temperature"]) * rep * bat_f)


def weighted_sample_without_replacement(
    items: List[Dict[str, Any]], k: int, rng: random.Random
) -> List[Dict[str, Any]]:
    pool = [dict(x) for x in items]
    picked: List[Dict[str, Any]] = []
    for _ in range(min(k, len(pool))):
        total_w = sum(max(0.01, float(x["weight"])) for x in pool)
        r = rng.random() * total_w
        idx = 0
        while idx < len(pool):
            r -= max(0.01, float(pool[idx]["weight"]))
            if r <= 0:
                break
            idx += 1
        picked.append(pool.pop(min(idx, len(pool) - 1)))
    return picked


def role_count(team: List[Dict[str, Any]], role: str) -> int:
    return sum(1 for p in team if p.get("role") == role)


MIN_PLAYERS_PER_TEAM = 4


def is_valid_generated_team(team: List[Dict[str, Any]]) -> bool:
    if len(team) != 11:
        return False
    player_keys: Set[str] = set()
    team_count: Dict[str, int] = {}
    role_count_d = {
        "wicket_keeper": 0,
        "batsman": 0,
        "bowler": 0,
        "all_rounder": 0,
    }
    profile_all_rounders_in_xi = 0
    for p in team:
        player_keys.add(pool_player_key(p))
        team_count[p["team"]] = team_count.get(p["team"], 0) + 1
        r = p.get("role")
        if r in role_count_d:
            role_count_d[r] += 1
        if str(p.get("profile_role", p.get("role", "batsman"))) == "all_rounder":
            profile_all_rounders_in_xi += 1
    if len(team_count) < 2:
        return False
    if len(player_keys) != 11:
        return False
    if any(c < MIN_PLAYERS_PER_TEAM for c in team_count.values()):
        return False
    return (
        role_count_d["wicket_keeper"] >= 1
        and role_count_d["batsman"] >= 1
        and role_count_d["bowler"] >= 1
        and profile_all_rounders_in_xi >= 1
    )


def build_team_uniqueness_key(players: List[Dict[str, Any]], captain: str, vice: str) -> str:
    lineup = sorted(f'{p["team"]}::{p["player"]}' for p in players)
    return "|".join(lineup) + f"#{captain}#{vice}"


def build_lineup_only_key(players: List[Dict[str, Any]]) -> str:
    lineup = sorted(f'{p["team"]}::{p["player"]}' for p in players)
    return "|".join(lineup)


def balanced_cv_score(row: Dict[str, Any], tuning: GeneratorTuning) -> float:
    return blended_player_score(row, tuning)


def _scenario_cv_multiplier(row: Dict[str, Any], scenario_id: str, pool_kind: str) -> float:
    """Scenario-aware C/VC bias using the scenario cell ID (alpha/beta x 1..8)."""
    role = str(row.get("role") or "")
    slot = int(row.get("typical_slot") or 5)
    phase = 1
    if scenario_id and scenario_id[-1].isdigit():
        phase = int(scenario_id[-1])
    is_cap = pool_kind == "captain"
    m = 1.0

    if phase <= 2:
        # Top-order batting heavy cells.
        if role in ("batsman", "wicket_keeper") and slot <= 3:
            m *= 1.18 if is_cap else 1.10
        if role == "bowler":
            m *= 0.92 if is_cap else 0.96
    elif phase <= 4:
        # Stable all-round balance cells.
        if role == "all_rounder":
            m *= 1.16
        elif role == "bowler":
            m *= 1.06 if not is_cap else 1.02
    elif phase <= 6:
        # Bowling-influence cells.
        if role == "bowler":
            m *= 1.18 if not is_cap else 1.10
        if role == "batsman" and slot >= 6:
            m *= 0.92
    else:
        # Mixed variance cells.
        if role in ("all_rounder", "wicket_keeper"):
            m *= 1.10
        if role == "batsman" and 3 <= slot <= 5:
            m *= 1.06

    return max(0.75, min(1.35, m))


def weighted_pick_by_score_with_uniform_blend(
    rows: List[Dict[str, Any]],
    score_fn: Callable[[Dict[str, Any]], float],
    uniform_blend: float,
    rng: random.Random,
) -> Optional[Dict[str, Any]]:
    if not rows:
        return None
    u = min(1.0, max(0.0, uniform_blend))
    scores = [max(1e-9, score_fn(r)) for r in rows]
    max_s = max(scores)
    n = len(rows)
    weights = [(1 - u) * (s / max_s) + u * (1 / n) for s in scores]
    total = sum(weights)
    r = rng.random() * total
    for i, w in enumerate(weights):
        r -= w
        if r <= 0:
            return rows[i]
    return rows[-1]


def row_in_cv_pool(
    row: Dict[str, Any], pool_kind: str, cv_sets: Dict[str, Dict[str, Set[str]]]
) -> bool:
    team = row["team"]
    player = row["player"]
    kind = "captain" if pool_kind == "captain" else "vice_captain"
    return player in cv_sets.get(team, {}).get(kind, set())


@dataclass
class CvFairnessState:
    cap_keys: List[str]
    vc_keys: List[str]
    union_keys: List[str]
    cap_key_set: Set[str] = field(default_factory=set)
    captain_counts: Dict[str, int] = field(default_factory=dict)
    vice_counts: Dict[str, int] = field(default_factory=dict)
    teams_built: int = 0

    @property
    def g_cap(self) -> int:
        return max(1, len(self.cap_keys))

    @property
    def g_vc(self) -> int:
        return max(1, len(self.vc_keys))

    @property
    def g_union(self) -> int:
        return max(1, len(self.union_keys))


def build_cv_fairness_state(
    pool: List[Dict[str, Any]], cv_sets: Dict[str, Dict[str, Set[str]]]
) -> CvFairnessState:
    cap_keys: List[str] = []
    vc_keys: List[str] = []
    union_keys: List[str] = []
    seen_c: Set[str] = set()
    seen_v: Set[str] = set()
    seen_u: Set[str] = set()
    for row in pool:
        k = pool_player_key(row)
        if row_in_cv_pool(row, "captain", cv_sets) and k not in seen_c:
            seen_c.add(k)
            cap_keys.append(k)
            if k not in seen_u:
                seen_u.add(k)
                union_keys.append(k)
        if row_in_cv_pool(row, "vice_captain", cv_sets) and k not in seen_v:
            seen_v.add(k)
            vc_keys.append(k)
            if k not in seen_u:
                seen_u.add(k)
                union_keys.append(k)
    return CvFairnessState(
        cap_keys=cap_keys,
        vc_keys=vc_keys,
        union_keys=union_keys,
        cap_key_set=set(cap_keys),
    )


def _captain_fair_bonus(row: Dict[str, Any], tuning: GeneratorTuning, cv: Optional[CvFairnessState]) -> float:
    if cv is None:
        return 0.0
    lam = float(tuning.cv_fairness_lambda)
    k = pool_player_key(row)
    ideal = (cv.teams_built + 1) / cv.g_cap
    have = cv.captain_counts.get(k, 0)
    ideal_total = (2 * (cv.teams_built + 1)) / cv.g_union
    have_total = cv.captain_counts.get(k, 0) + cv.vice_counts.get(k, 0)
    union_bonus = lam * (ideal_total - have_total)
    return lam * (ideal - have) + union_bonus


def _vice_fair_bonus(row: Dict[str, Any], tuning: GeneratorTuning, cv: Optional[CvFairnessState]) -> float:
    if cv is None:
        return 0.0
    lam = float(tuning.cv_fairness_lambda)
    k = pool_player_key(row)
    ideal = (cv.teams_built + 1) / cv.g_vc
    have = cv.vice_counts.get(k, 0)
    ideal_total = (2 * (cv.teams_built + 1)) / cv.g_union
    have_total = cv.captain_counts.get(k, 0) + cv.vice_counts.get(k, 0)
    union_bonus = lam * (ideal_total - have_total)
    # Extra VC-only boost: helps players who can only appear via VC catch up in total C+VC exposure.
    vc_only_bonus = 0.0
    if k not in cv.cap_key_set:
        vc_only_bonus = 0.75 * lam * (ideal_total - have_total)
    return lam * (ideal - have) + union_bonus + vc_only_bonus


def choose_captain_vice(
    team: List[Dict[str, Any]],
    tuning: GeneratorTuning,
    cv_sets: Dict[str, Dict[str, Set[str]]],
    rng: random.Random,
    scenario_id: str,
    cv_fair: Optional[CvFairnessState] = None,
) -> Optional[Tuple[str, str]]:
    cap_pool = [r for r in team if row_in_cv_pool(r, "captain", cv_sets)]
    vc_all = [r for r in team if row_in_cv_pool(r, "vice_captain", cv_sets)]
    if not cap_pool or not vc_all:
        return None

    tn = tuning.normalized()
    blend = tn.cv_uniform_blend
    cap_row = weighted_pick_by_score_with_uniform_blend(
        cap_pool,
        lambda r: (
            balanced_cv_score(r, tn) * _scenario_cv_multiplier(r, scenario_id, "captain")
            + _captain_fair_bonus(r, tn, cv_fair)
        ),
        blend,
        rng,
    )
    if cap_row:
        vc_cand = [r for r in vc_all if r["player"] != cap_row["player"]]
        if vc_cand:
            vc_row = weighted_pick_by_score_with_uniform_blend(
                vc_cand,
                lambda r: (
                    balanced_cv_score(r, tn) * _scenario_cv_multiplier(r, scenario_id, "vice_captain")
                    + _vice_fair_bonus(r, tn, cv_fair)
                ),
                blend,
                rng,
            )
            if vc_row:
                return cap_row["player"], vc_row["player"]

    cap_sorted = sorted(
        cap_pool,
        key=lambda r: (
            float(r.get("proj") or 0) * _scenario_cv_multiplier(r, scenario_id, "captain")
            + _captain_fair_bonus(r, tn, cv_fair)
        ),
        reverse=True,
    )
    captain_row = cap_sorted[0]
    vc_cand = [r for r in vc_all if r["player"] != captain_row["player"]]
    if not vc_cand:
        return None
    vc_sorted = sorted(
        vc_cand,
        key=lambda r: (
            float(r.get("proj") or 0) * _scenario_cv_multiplier(r, scenario_id, "vice_captain")
            + _vice_fair_bonus(r, tn, cv_fair)
        ),
        reverse=True,
    )
    return captain_row["player"], vc_sorted[0]["player"]


def _compute_high_scoring_min_per_cell(num_teams: int, scenario_count: int) -> Tuple[int, float]:
    n = max(1, int(scenario_count))
    fair = num_teams / n
    min_per = int(math.floor(HIGH_SCORING_MIN_QUOTA_FRAC * fair))
    while min_per > 0 and min_per * n > num_teams:
        min_per -= 1
    return min_per, fair


def _pick_high_scoring_scenario_index(
    scenario_counts: List[int], min_per: int, rng: random.Random
) -> int:
    n = len(scenario_counts)
    under = [i for i in range(n) if scenario_counts[i] < min_per]
    if under:
        return under[rng.randint(0, len(under) - 1)]
    return rng.randint(0, n - 1)


def _generate_high_scoring_teams(
    pool: List[Dict[str, Any]],
    num_teams: int,
    tuning: GeneratorTuning,
    rng: random.Random,
    cv_sets: Dict[str, Dict[str, Set[str]]],
    seen_keys: Optional[Set[str]],
    appearance_counts: Optional[Dict[str, int]],
    cv_fair: Optional[CvFairnessState],
) -> List[Dict[str, Any]]:
    t = tuning.normalized()
    params = HIGH_SCORING_DRAW_PARAMS
    counts = appearance_counts if appearance_counts is not None else {}
    local_seen: Set[str] = seen_keys if seen_keys is not None else set()
    cv_st = cv_fair if cv_fair is not None else build_cv_fairness_state(pool, cv_sets)
    scenario_ids = HIGH_SCORING_SCENARIO_PROFILES.get(
        DEFAULT_SCENARIO_PROFILE, HIGH_SCORING_SCENARIO_IDS_BATTING_HEAVY_6
    )
    min_per, _fair = _compute_high_scoring_min_per_cell(num_teams, len(scenario_ids))
    scenario_counts = [0] * len(scenario_ids)
    out: List[Dict[str, Any]] = []
    recent_lineups: List[str] = []
    recent_lineup_set: Set[str] = set()
    attempts = 0
    hard_cap = num_teams * ATTEMPTS_MULTIPLIER * HIGH_SCORING_ATTEMPTS_MULTIPLIER

    while len(out) < num_teams and attempts < hard_cap:
        attempts += 1
        si = _pick_high_scoring_scenario_index(scenario_counts, min_per, rng)
        scenario_id = scenario_ids[si]
        weighted_pool: List[Dict[str, Any]] = []
        for row in pool:
            w = compute_row_draw_weight(row, params, counts, t, rng)
            weighted_pool.append({**row, "weight": w})
        team = weighted_sample_without_replacement(weighted_pool, 11, rng)
        if not is_valid_generated_team(team):
            continue
        cvc = choose_captain_vice(team, t, cv_sets, rng, scenario_id, cv_st)
        if not cvc:
            continue
        captain, vice_captain = cvc
        players_out = [
            {
                "team": r["team"],
                "player": r["player"],
                "role": r.get("role", "batsman"),
                "profile_role": r.get("profile_role", r.get("role", "batsman")),
            }
            for r in team
        ]
        lineup_key = build_lineup_only_key(players_out)
        if lineup_key in recent_lineup_set:
            continue
        key = build_team_uniqueness_key(players_out, captain, vice_captain)
        if key in local_seen:
            continue
        local_seen.add(key)
        recent_lineups.append(lineup_key)
        recent_lineup_set.add(lineup_key)
        if len(recent_lineups) > LINEUP_REPEAT_COOLDOWN:
            evicted = recent_lineups.pop(0)
            recent_lineup_set.discard(evicted)
        for r in team:
            pk = pool_player_key(r)
            counts[pk] = counts.get(pk, 0) + 1
        cap_row = next(r for r in team if r["player"] == captain)
        vc_row = next(r for r in team if r["player"] == vice_captain)
        ck = pool_player_key(cap_row)
        vk = pool_player_key(vc_row)
        cv_st.captain_counts[ck] = cv_st.captain_counts.get(ck, 0) + 1
        cv_st.vice_counts[vk] = cv_st.vice_counts.get(vk, 0) + 1
        cv_st.teams_built += 1
        proj_sum = sum(float(r.get("proj") or 0) for r in team)
        cap_proj = next(float(r.get("proj") or 0) for r in team if r["player"] == captain)
        vc_proj = next(float(r.get("proj") or 0) for r in team if r["player"] == vice_captain)
        projected = proj_sum + cap_proj + 0.5 * vc_proj
        scenario_counts[si] += 1
        out.append(
            {
                "strategy": "high_scoring_games",
                "captain": captain,
                "vice_captain": vice_captain,
                "projected_points": round(projected, 2),
                "players": players_out,
                "high_score_scenario": scenario_id,
            }
        )
    return out


def generate_teams(
    pool: List[Dict[str, Any]],
    num_teams: int,
    tuning: GeneratorTuning,
    rng: random.Random,
    cv_sets: Dict[str, Dict[str, Set[str]]],
    seen_keys: Optional[Set[str]] = None,
    appearance_counts: Optional[Dict[str, int]] = None,
    cv_fair: Optional[CvFairnessState] = None,
) -> List[Dict[str, Any]]:
    """Generate `num_teams` unique `high_scoring_games` portfolios (6-cell catalog + C/VC pools)."""
    return _generate_high_scoring_teams(
        pool, num_teams, tuning, rng, cv_sets, seen_keys, appearance_counts, cv_fair
    )


def score_team_actual(
    team_row: Dict[str, Any], actual_points: Dict[PlayerKey, float]
) -> float:
    base = 0.0
    c_bonus = 0.0
    vc_bonus = 0.0
    cap = team_row["captain"]
    vc = team_row["vice_captain"]
    for p in team_row["players"]:
        key = (p["team"], p["player"])
        pts = actual_points.get(key, 0.0)
        base += pts
        if p["player"] == cap:
            c_bonus += pts
        if p["player"] == vc:
            vc_bonus += 0.5 * pts
    return base + c_bonus + vc_bonus


def portfolio_metrics(
    portfolio: List[Dict[str, Any]], actual_points: Dict[PlayerKey, float]
) -> Dict[str, float]:
    if not portfolio:
        return {"best": 0.0, "avg": 0.0, "top5_avg": 0.0, "p90": 0.0}
    scores = [score_team_actual(t, actual_points) for t in portfolio]
    scores.sort(reverse=True)
    top5 = scores[: min(5, len(scores))]
    p90_idx = max(0, min(len(scores) - 1, int(len(scores) * 0.1)))
    return {
        "best": round(scores[0], 2),
        "avg": round(sum(scores) / len(scores), 2),
        "top5_avg": round(sum(top5) / len(top5), 2),
        "p90": round(scores[p90_idx], 2),
    }


# Max pool size for brute-force oracle fallback (C(n,11)); keep small — use PuLP for production.
ORACLE_MAX_POOL_BRUTE = 20


def _oracle_max_brute_force(
    pool: List[Dict[str, Any]],
    pts_arr: List[float],
    cv_sets: Dict[str, Dict[str, Set[str]]],
) -> Tuple[Optional[float], Optional[Dict[str, Any]]]:
    n = len(pool)
    best_score = float("-inf")
    best_detail: Optional[Dict[str, Any]] = None
    for comb in itertools.combinations(range(n), 11):
        team = [pool[i] for i in comb]
        if not is_valid_generated_team(team):
            continue
        ssum = sum(pts_arr[i] for i in comb)
        for ia in comb:
            a = pool[ia]
            ta, cap_name = a["team"], a["player"]
            if cap_name not in cv_sets.get(ta, {}).get("captain", set()):
                continue
            pa = pts_arr[ia]
            for ib in comb:
                if ib == ia:
                    continue
                b = pool[ib]
                tb, vc_name = b["team"], b["player"]
                if vc_name not in cv_sets.get(tb, {}).get("vice_captain", set()):
                    continue
                sc = ssum + pa + 0.5 * pts_arr[ib]
                if sc > best_score:
                    best_score = sc
                    best_detail = {
                        "score": round(sc, 2),
                        "captain": cap_name,
                        "vice_captain": vc_name,
                        "player_names": sorted(pool[i]["player"] for i in comb),
                    }
    if best_detail is None:
        return None, {"error": "no_valid_lineup_with_c_vc"}
    return round(best_score, 2), best_detail


def _oracle_max_mip_pulp(
    pool: List[Dict[str, Any]],
    pts_arr: List[float],
    cv_sets: Dict[str, Dict[str, Set[str]]],
) -> Tuple[Optional[float], Optional[Dict[str, Any]]]:
    """Exact max via 0–1 integer program (requires `pip install pulp`)."""
    import pulp

    n = len(pool)
    teams_in_pool = list({p["team"] for p in pool})
    if len(teams_in_pool) < 2:
        return None, {"error": "fewer_than_two_teams_in_pool"}

    prob = pulp.LpProblem("oracle_xi", pulp.LpMaximize)
    x = [pulp.LpVariable(f"x{i}", cat="Binary") for i in range(n)]
    c = [pulp.LpVariable(f"c{i}", cat="Binary") for i in range(n)]
    v = [pulp.LpVariable(f"v{i}", cat="Binary") for i in range(n)]

    prob += pulp.lpSum(pts_arr[i] * x[i] + pts_arr[i] * c[i] + 0.5 * pts_arr[i] * v[i] for i in range(n))
    prob += pulp.lpSum(x) == 11
    prob += pulp.lpSum(c) == 1
    prob += pulp.lpSum(v) == 1
    for i in range(n):
        prob += c[i] <= x[i]
        prob += v[i] <= x[i]
        prob += c[i] + v[i] <= 1
        team = pool[i]["team"]
        pname = pool[i]["player"]
        if pname not in cv_sets.get(team, {}).get("captain", set()):
            prob += c[i] == 0
        if pname not in cv_sets.get(team, {}).get("vice_captain", set()):
            prob += v[i] == 0

    for role in ("wicket_keeper", "batsman", "bowler"):
        idx = [i for i in range(n) if pool[i].get("role") == role]
        if idx:
            prob += pulp.lpSum(x[i] for i in idx) >= 1
        else:
            return None, {"error": f"no_player_with_role_{role}"}

    idx_ar_profile = [
        i
        for i in range(n)
        if str(pool[i].get("profile_role", pool[i].get("role", "batsman"))) == "all_rounder"
    ]
    if idx_ar_profile:
        prob += pulp.lpSum(x[i] for i in idx_ar_profile) >= 1
    else:
        return None, {"error": "no_player_with_profile_role_all_rounder"}

    for tm in teams_in_pool:
        idx = [i for i in range(n) if pool[i]["team"] == tm]
        prob += pulp.lpSum(x[i] for i in idx) >= MIN_PLAYERS_PER_TEAM

    prob.solve(pulp.PULP_CBC_CMD(msg=False))
    if prob.status != pulp.LpStatusOptimal:
        return None, {"error": f"mip_not_optimal_status_{pulp.LpStatus[prob.status]}"}

    xv = [pulp.value(x[i]) for i in range(n)]
    c_vals = [pulp.value(c[i]) for i in range(n)]
    v_vals = [pulp.value(v[i]) for i in range(n)]
    if xv is None or any(v is None for v in xv):
        return None, {"error": "mip_no_solution"}

    chosen = [i for i in range(n) if xv[i] > 0.5]
    cap_i = next((i for i in range(n) if c_vals[i] is not None and c_vals[i] > 0.5), None)
    vc_i = next((i for i in range(n) if v_vals[i] is not None and v_vals[i] > 0.5), None)
    if len(chosen) != 11 or cap_i is None or vc_i is None:
        return None, {"error": "mip_parse_failed"}

    obj = float(pulp.value(prob.objective))
    best_detail = {
        "score": round(obj, 2),
        "captain": pool[cap_i]["player"],
        "vice_captain": pool[vc_i]["player"],
        "player_names": sorted(pool[i]["player"] for i in chosen),
        "method": "mip_pulp",
    }
    return round(obj, 2), best_detail


def oracle_max_fantasy_score(
    pool: List[Dict[str, Any]],
    actual_points: Dict[PlayerKey, float],
    cv_sets: Dict[str, Dict[str, Set[str]]],
) -> Tuple[Optional[float], Optional[Dict[str, Any]]]:
    """
    Maximum achievable fantasy score on this match's pool using:
    - same valid-XI rules as the generator (2 teams, WK/BAT/BOWL/AR),
    - captain / vice-captain only from franchise C/VC pools ∩ pool,
    - scoring: sum(pts) + pts(captain) + 0.5 * pts(vice) (Dream11-style vs score_team_actual).

    Uses PuLP (CBC) MIP when `pulp` is installed; otherwise brute force for n <= ORACLE_MAX_POOL_BRUTE.
    """
    n = len(pool)
    if n < 11:
        return None, {"error": "pool_smaller_than_11"}

    pts_arr = [float(actual_points.get((p["team"], p["player"]), 0.0)) for p in pool]

    try:
        import pulp  # noqa: F401
    except ImportError:
        pulp = None

    if pulp is not None:
        return _oracle_max_mip_pulp(pool, pts_arr, cv_sets)

    if n > ORACLE_MAX_POOL_BRUTE:
        return None, {
            "error": "install_pulp_for_oracle",
            "hint": "pip install pulp  (pool too large for built-in brute-force oracle)",
        }
    import warnings

    warnings.warn(
        "oracle_max_fantasy_score: using slow brute force; `pip install pulp` for fast exact oracle.",
        stacklevel=2,
    )
    return _oracle_max_brute_force(pool, pts_arr, cv_sets)


def build_cv_sets_for_pool(
    pool: List[Dict[str, Any]], cv_pools_json: Dict[str, Any]
) -> Dict[str, Dict[str, Set[str]]]:
    """Per team: keep captain_pool and vice_captain_pool separate (each intersected with match pool)."""
    by_team: Dict[str, Set[str]] = {}
    for r in pool:
        by_team.setdefault(r["team"], set()).add(r["player"])
    base = (cv_pools_json or {}).get("pools") or {}
    out: Dict[str, Dict[str, Set[str]]] = {}
    for team, sel in by_team.items():
        entry = base.get(team) or {}
        cap = set(entry.get("captain_pool") or []) & sel
        vc = set(entry.get("vice_captain_pool") or []) & sel
        out[team] = {"captain": cap, "vice_captain": vc}
    return out


def expected_points(
    key: PlayerKey,
    history: Dict[PlayerKey, List[float]],
    role: str,
) -> float:
    arr = history.get(key, [])
    if arr:
        weights = [i + 1 for i in range(len(arr))]
        return sum(v * w for v, w in zip(arr, weights)) / sum(weights)
    priors = ROLE_PRIORS
    return float(priors.get(role, 30.0))


def compute_role_stability(pts_hist: List[float], typical_slot: int, probable_xi: bool) -> float:
    if not pts_hist:
        return 0.55 if probable_xi else 0.4
    m = weighted_average(pts_hist)
    var = sum((x - m) ** 2 for x in pts_hist) / len(pts_hist)
    std = math.sqrt(max(0.0, var))
    cv = std / m if m > 1e-9 else 1.5
    consistency = max(0.0, min(1.0, 1.0 - cv))
    slot_bonus = 0.12 if typical_slot <= 3 else (0.06 if typical_slot <= 5 else 0.0)
    xi_bonus = 0.08 if probable_xi else 0.0
    return max(0.0, min(1.0, consistency + slot_bonus + xi_bonus))


def build_match_pool_from_stats(
    match: Dict[str, Any],
    role_lookup: Dict[PlayerKey, str],
    profiles: Dict[str, Any],
    history: Dict[PlayerKey, List[float]],
    form_teams: Dict[str, Any],
    batting_slots: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    profile_teams = profiles.get("teams", {})
    out: List[Dict[str, Any]] = []
    for row in match.get("player_stats", []):
        team = str(row["team"])
        player = str(row["player"])
        key: PlayerKey = (team, player)
        prof = profile_teams.get(team, {}).get(player, {})
        role = role_lookup.get(key, prof.get("primary_role", "batsman"))
        if role not in ("wicket_keeper", "batsman", "bowler", "all_rounder"):
            role = "batsman"
        profile_role = resolve_profile_role(prof, role)

        rec = (form_teams.get(team) or {}).get(player, {})
        pts_hist = [float(x) for x in rec.get("last_fantasy_points", [])]
        proj = expected_points(key, history, role)
        if pts_hist:
            ceiling = max(pts_hist)
            floor = min(pts_hist)
        else:
            ceiling = proj + 12.0
            floor = max(0.0, proj - 12.0)

        typical_slot = resolve_typical_slot(team, player, prof, batting_slots)
        role_stability = compute_role_stability(
            pts_hist, typical_slot, bool(rec.get("probable_xi"))
        )
        out.append(
            {
                "team": team,
                "player": player,
                "role": role,
                "profile_role": profile_role,
                "proj": proj,
                "ceiling": ceiling,
                "floor": floor,
                "typical_slot": typical_slot,
                "role_stability": role_stability,
            }
        )
    return out
