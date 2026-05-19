# Team Generation Strategy Guide

This document describes the **only** supported generator strategy: **`high_scoring_games`**. It covers hard rules, lineup weighting, the 6-cell catalog, C/VC pools, and how to tune and backtest.

## 1) End-to-End Team Formation Flow

Primary implementation files:

- `web/app.js` (UI generation logic)
- `scripts/generator_backtest_engine.py` (Python mirror for tuning/backtests/reports)
- `scripts/tune_generator_backtest.py` (OAT + joint tuning)
- `scripts/oracle_vs_generation_report.py` (oracle gap benchmarking)
- `docs/high_scoring_games_beginner_scenarios.md` (pre-toss scenario catalog §8)

Pipeline per match (or per fixture in the UI):

1. Build a player pool (squads + selected players + walk-forward projections as applicable).
2. For each player, compute role, `proj`, `ceiling`, `floor`, and `typical_slot` (from `data/ipl2026_batting_slots.json` when available, else profile tags).
3. Build C/VC eligibility from `data/c_vc_pools.json` (per franchise: union of captain and vice pools, intersected with the pool).
4. **6-cell catalog:** before each draw, pick a scenario index from `α1, α2, α4, β1, β2, β4`, biased so each cell reaches at least **80%** of a fair per-cell count `floor(0.8 × teams / 6)` when feasible (see `HIGH_SCORING_MIN_QUOTA_FRAC` in code).
5. Repeatedly: compute draw weight → sample 11 without replacement → validate XI → pick C and VC from pools (with fairness nudge) → dedupe on **XI + C + VC + scenario id**.
6. Stop at target team count or the attempt cap (`teams × 500 × 4` for high-scoring).

## 2) Hard Rules and Constraints

### XI validity

- Exactly 11 players.
- At least 2 real teams represented.
- **At least 4 players from each team** (4–7 split).
- At least 1 of each role: wicket_keeper, batsman, all_rounder, bowler.

### C/VC rules

- C and VC must appear in the franchise pool (union of captain and vice lists in JSON, intersected with the match pool).
- Captain and vice captain must be **two different players** (2× and 1.5× multipliers in scoring).

### Dedupe and diversity

- Uniqueness key: sorted lineup + captain + vice + **high_score_scenario** (so the same XI can exist in different catalog cells).
- Repeat penalty: `1 / (1 + λ × appearances)` on pool keys.

## 3) Lineup and C/VC Weighting

### XI draw weight

- `base = proj × (1 + lineup_ceiling_nudge × lift)` with `lift = min(0.55, max(0, ceiling − proj) / 48)`.
- Noise and temperature: `temperature = 1.14`, `noise = 0.24` (see `HIGH_SCORING_DRAW_PARAMS` in engine / `HIGH_SCORING_DRAW_PARAMS` in `web/app.js`).
- **Lower-middle batsman factor:** pure batsmen with `typical_slot ≥ 6` are multiplied by `lower_middle_bat_weight` (≤ 1 down-weights them).

### C/VC from pools

- Score mass: `0.8 × proj + 0.2 × min(ceiling, proj + 28)`.
- Mixed with uniform mass using **`cv_uniform_blend`** (0 = score-only, 1 ≈ uniform in pool).
- **`cv_fairness_lambda`:** nudges captain and vice usage toward equal counts across everyone in the C and VC pool keys (shared `cvFair` state across teams in one generate run).

## 4) Tunable Parameters (`GeneratorTuning` / UI)

| Snake case (presets / Python) | UI id | Role |
|--------------------------------|-------|------|
| `repeat_lambda` | `tuningRepeatLambda` | Repeat / diversity penalty |
| `lineup_ceiling_nudge` | `tuningLineupCeilingNudge` | Ceiling uplift on XI weights |
| `cv_uniform_blend` | `tuningCvUniformBlend` | C/VC uniform vs score blend |
| `cv_fairness_lambda` | `tuningCvFairnessLambda` | Equal-opportunity nudge for C/VC keys |
| `lower_middle_bat_weight` | `tuningLowerMiddleBatWeight` | Down-weight slot ≥6 pure batsmen |

Legacy preset keys (`balanced_cv_uniform_blend`, `repeat_lambda_balanced`, etc.) are migrated in the web UI when loading JSON.

## 5) Practical Tuning Method

1. Use `scripts/tune_generator_backtest.py` with `--num-teams` 200 on historical JSON matches.
2. Run one-at-a-time (OAT) sweeps or joint random search / Optuna on the five knobs above; objective is **mean `best`** portfolio score for `high_scoring_games`.
3. Write presets with `--apply-best-oat` → `data/generator_tuning_presets.json` and load them in the Generator tab.

## 6) Oracle Gap

`scripts/oracle_vs_generation_report.py` compares hindsight-optimal XI + C/VC (realized points) to the best of **N** generated teams using the same rules. Large gaps are normal; use mean gap and distribution as sanity checks after tuning.

## 7) Operational Checklist

- Keep `data/ipl2026_batting_slots.json` updated for credible `typical_slot`.
- Maintain `data/c_vc_pools.json` so at least two distinct names per team intersect the match pool.
- For the high-scoring **narrative** filter (which matches to play), follow `docs/high_scoring_games_beginner_scenarios.md`.
