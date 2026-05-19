# Bat-first pool XI strategy (`bat_first_pool_xi`)

This document describes the **optional** generator mode added alongside **`high_scoring_games`**. Implementation lives in `web/app.js` (search `STRATEGY_ID_BAT_POOLS`, `generateBatFirstPoolTeamsForStrategy`). Pool assignments are editable in the Generator tab and persisted per fixture in `localStorage` under `ipl2026_bat_first_pools_v1`.

---

## 1) Motivation

Instead of drawing all 11 players from one weighted pool, this mode **anchors the XI** using **two user-edited pools** and exactly **two lineup shapes**:

- **Seg A**: **6** from P1 + **5** from P2  
- **Seg B**: **5** from P1 + **6** from P2  

**Full pool %:** the first chunk of accepted teams uses **all** of P1 and P2. The remainder uses the same pools **minus** ids in **Reduced-pool exclusions**.

**Segment weights (independent):**

- Among **full-pool** teams, UI **Full Seg A / B %** sets how many draws use 6+5 vs 5+6 (normalized to 100%; default **50 / 50**).
- Among **reduced-pool** teams, **Reduced Seg A / B %** does the same with a **separate** default **50 / 50** (can differ from full-pool weights).

Pool membership is edited in the UI and persisted per fixture in `localStorage` under `ipl2026_bat_first_pools_v1`.

Captain and vice-captain, franchise balance, minimum WK / BAT / BOWL / profile-AR rules, and max bowler / max all-rounder **UI caps** apply in **`high_scoring_games` only**; **`bat_first_pool_xi` ignores those max caps** (pool structure drives composition). See `docs/c_vc_scenario_combinations.md` for C/VC behaviour.

---

## 2) Default pool rules (Auto-fill)

Auto-fill only looks at **ticked** players for the fixture:

| Pool | Rule |
|------|------|
| **Pool 2** | Profile **bowler** or **all_rounder** (`getRawProfileRole`). |
| **Pool 1** | Everyone else ticked (typically WK / batsman). |

You can **move any ticked player** between **P1** and **P2** with the pool buttons. Every **ticked** player must appear in **exactly one** pool before generation. **Unticked** players are **not** shown in the pool columns.

The generator builds projection rows from **ticks ∪ P1 ∪ P2** (P1/P2 are subsets of ticks), so the match pool still includes all ticked names even if a ticked player were missing from pools — but validation requires every tick to be assigned to a pool before generate.

---

## 3) Combination coverage vs random fallback

Let \(n_i\) be the number of players in pool \(i\) **after** applying full vs reduced logic (reduced runs subtract excluded ids from both pools).

- **Seg A (6+5):** P1 takes \(k_1=6\), P2 takes \(k_2=5\).  
- **Seg B (5+6):** P1 takes \(5\), P2 takes \(6\).

Each pool uses \(\binom{n}{k}\) enumeration when below `BAT_POOL_COMBO_ENUM_CAP`, else uniform random \(k\)-subsets. On reject, combo index advances with `(targetRank + consecutiveFailures) % comboCount` when enumerated.

**Optional franchise 7–4 cap (UI checkbox, persisted as `split74Quota`):** After a candidate XI passes `isValidGeneratedTeam`, if it has **7 players from one fixture franchise and 4 from the other** (treat **4+7** the same as **7+4**), it counts toward a quota. Among **\(N\)** target teams, at most **\(\lfloor N/5\rfloor\)** **accepted** teams may be of that type; further 7/4 franchise splits are rejected (`franchise_74_quota`) until the generator finishes or hits the attempt cap.

---

## 4) Full pool vs reduced segment

- **Full segment:** uses all rows from P1 and P2 (subject to XI validation and C/VC). Segment mix = **Full Seg A / B %**.
- **Reduced segment:** same pools **excluding** **Reduced-pool exclusions**. Segment mix = **Reduced Seg A / B %** (independent percentages).
- Repeat penalty / draw weights use the main match pool projections; no third “flex” pool.

---

## 5) Scenarios and dedupe

- **Scenario cells:** the same **6-cell** catalog and per-cell quota logic as `high_scoring_games` (`pickHighScoringScenarioIndex`, `computeHighScoringMinPerCell`).
- **Uniqueness:** still `XI + captain + vice-captain` (`buildTeamUniquenessKey`). Many structured draws are rejected if C/VC or validation fails; the loop stops at the bat-first attempt cap.

---

## 6) Operational checklist

1. Tick the players you want in scope, choose generator mode **bat_first_pool_xi**, then **Auto-fill** (or assign P1/P2 manually).
2. Global constraints apply to the **generator pool** (all ticked players, with P1/P2 driving the bat-first draws).
3. If **Restrict C/VC pool picks to ticked** is on, ensure C/VC lists intersect your ticks, or turn the restriction off.
4. Set **Full pool %**, **Full Seg A/B %**, **Reduced Seg A/B %**, and optional **Reduced-pool exclusions** as needed.
5. Confirm the hint line: pool sizes, segment counts for full vs reduced, and combo feasibility.
6. **Generate teams** — CSV/PDF behaviour is unchanged; `strategy` column reads `bat_first_pool_xi`.

---

## 7) Rejection diagnostics (UI + optional console)

After **Generate**, the page shows **Bat-first draw diagnostics**: counts for `bad_length`, `overlap_keys`, `franchise_74_quota` (when the cap is enabled), `cvc_none`, `dedupe_collision`, plus **XI rule** buckets from `explainInvalidGeneratedTeam` (codes mirror `isValidGeneratedTeam`). Tick **Verbose bat-first log** before generating to also store a short **sample list** and print a summary to the **browser console**.

---

## 8) Revision log

| Date | Change |
|------|--------|
| — | Two pools; only segments **6+5** and **5+6**; separate segment % for full-pool vs reduced-pool teams (default 50/50 each); full-pool % + exclusions. Legacy three-pool JSON still migrates old P3 on load. |
