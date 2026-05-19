# Captain & vice-captain combinations (scenario layer)

This document describes how **C / VC** pairs are chosen for the **high-scoring** generator, with emphasis on the **batting-heavy 6-cell** catalog (`α1`, `α2`, `α4`, `β1`, `β2`, `β4`) and the **second verification layer** implemented in `web/app.js`.

See also: `docs/high_scoring_games_beginner_scenarios.md` (§8 catalog, §9 C/VC table).

---

## 1) Notation: first dig (F) vs chase (Ch)

- **α-branch:** Team **A** bats **first** → **F = Team A**, **Ch = Team B**.
- **β-branch:** Team **B** bats **first** → **F = Team B**, **Ch = Team A**.

Scenario id **suffix digit** (last character `1`, `2`, …) encodes the **chase narrative** in the 16-cell system. The app’s **6-cell** subset uses:

| Suffix | Chase story (from §8) | Short label |
|--------|------------------------|-------------|
| **1** | Comfortable chase (**B1**) | `b1` |
| **2** | Middle decides (**B2a**) | `b2a` |
| **4** | Chase fails / defense wins (**B3**) | `b3` |

Examples: `α1` = A1 first dig + B1 chase; `β4` = A1 first dig + B3 chase with **F = Team B**, **Ch = Team A**.

---

## 2) Role semantics (aligned with lineup logic)

For **C/VC scoring and this verification layer**, player **role** is **`getEffectiveLineupRole`**:

- **All-rounders** with typical batting slot **≤ 5** are treated as **batsmen** (top-order bat narrative), not as AR for multipliers or rules.
- **WK / BAT / true AR (slot 6+) / BOWL** follow the same effective role as XI caps.

---

## 3) Current pipeline (layers)

1. **Captain pool pre-filter (B3 only):** For scenario suffix **`4`** (`α4`, `β4` — chase fails / defense), **chasing-team bowlers** are **removed** from the captain candidate pool when possible (aligns with §9: C should lean **F** bat/bowl, not **Ch** bowler). If that filter would leave **no** captain options, the app **keeps the unfiltered pool** so generation can still proceed.

2. **Pair-spread layer (batch generation only):** For `high_scoring_games` and `bat_first_pool_xi`, counts of **accepted** teams are kept per `(scenarioId, captainKey, viceKey)` (`team::player` keys). If the current XI has **≥ 6** legal `(C, VC)` pairs (same rules as below + **dedupe**), one pair is **sampled** with weight `jointScenarioScore × (1/(1+n))^β`, with an extra soft boost when `n = 0` for that scenario. Otherwise this layer is skipped and step 3 runs unchanged.

3. **Primary pick:** C and VC from **UI-finalized pools** (`c_vc_pools.json` ∩ ticked players), with **scenario-weighted** scores (`scenarioCvMultiplier`), **franchise-7** captain restriction, **4–7** vice rule (no VC bowler from the **4-player** franchise when the other has 7), and **C/VC fairness** (λ). Uses stochastic blend + fallback by projection.

4. **Verification layer:** After the primary pick, the app **validates** the pair. If invalid, it tries **alternative vice-captains** only (same **C**), ranked by the same **vice** score as the primary step.  
   - During **batch generation**, each candidate VC is also checked against **`seenKeys`** so a repair does not produce a **duplicate** `(XI + C + VC)` row.

5. **Ranked C × VC fallback:** If step 4 still fails, the app tries **every captain** in the (possibly B3-filtered) pool in **captain score order**, and for each captain every **vice** in **vice score order**, until a pair passes the scenario layer and (if provided) **dedupe**. This reduces wasted XI draws when the first random C is a bad narrative fit.

If all of the above fail, the **team is discarded** for that attempt.

---

## 4) Starter verification rules (v1)

These are **hard filters** (not soft weights). Codes appear in code / future logging.

| Code | When it applies | Rule |
|------|-----------------|------|
| `same_franchise_dual_bowler_cvc` | All scenarios | **C** and **VC** are both **bowlers** from the **same** franchise → reject pair (weak narrative spread). |
| `vc_chase_team_bowler_b1_b3` | Suffix **1** or **4** (B1 / B3) | **VC** is a **bowler** from the **chasing** franchise → reject (easy chase / failed chase: chase bowlers are poor multiplier bets in these stories). |
| `captain_chase_team_bowler_b3` | Suffix **4** (B3) | **C** is a **bowler** from the **chasing** franchise → reject (defense / “lone hand” chase: captain should lean **F** or chase **bat**). |

**Not yet implemented (documented for extension):**

- B2a-specific complements (e.g. C = Ch middle → avoid VC = Ch opener when narrative is “cheap powerplay + middle rescue”).
- Explicit finisher / death-bowler pairing for suffix **2** in death-heavy sub-stories.
- Editable JSON rule file; v1 rules are in code for speed.

---

## 5) Duplicates after repair

Uniqueness key (generation): **`buildTeamUniquenessKey(players, captain, viceCaptain)`** = sorted XI + `#` + C + `#` + VC.

After any **VC** change in the verification layer, the generator **re-checks** this key against **`seenKeys`** before accepting the team. If the repaired pair collides, the next ranked VC is tried; if none work, the draw is skipped.

---

## 6) Swaps and CSV reload

When C/VC are **reassigned** after swaps, the app passes **`highScoreScenario`** from that team row (default `α1` if missing) into **`chooseCaptainViceCaptain`**, so the same verification layer applies.

---

## 7) Revision log

| Date | Change |
|------|--------|
| 2026-05-02 | Initial doc: 6-cell F/Ch mapping, effective AR-as-bat, two-layer pipeline, v1 rules, dedupe after repair. |
| 2026-05-02 | B3 captain pool pre-filter; ranked captain × vice fallback after VC-only repair. |
