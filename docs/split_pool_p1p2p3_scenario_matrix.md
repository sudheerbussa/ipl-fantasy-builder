# Split-pool XI strategy (P1 / P2 / P3) — C1–C4 profiles

**Status:** Design reference for the split-pool generator. **Lineup shape** = profiles **C1–C4**. **C/VC** = expected match outcome separately (`docs/c_vc_scenario_combinations.md`).

**Nominal pools per franchise:** \(|P1|=3\), \(|P2|=4\), \(|P3|=5\) → **12 ticked**. **P3 composition (default):** ~**3 pure bowlers** + **~2 bowling all-rounders**; **P2** = middle / batting only.

---

## 1. Franchise pools

| Pool | Meaning |
|------|---------|
| **P1** | Top-order / powerplay batting |
| **P2** | Middle batters *(no bowling AR here — they live in **P3**)* |
| **P3** | **Pure bowlers** + **bowling all-rounders** |

**Rules**

- User may move players between P1 ↔ P2 ↔ P3.
- Generator uses live \(|P1|, |P2|, |P3|\).
- If franchise \(X\) contributes \(n_X \ge 1\) and \(|P3_X|>0\), require **≥1 pick from \(P3_X\)** *(at least one P3 slot per contributing side — not a separate “min 1 pure bowler per side” rule; bowler vs AR is decided at fill, §1.1)*.

**Profile caps on total P3 picks** *(paired XI)*:

| Profile | Rule |
|---------|------|
| **C1** | **`p_A + p_B ≤ 4`** |
| **C4** | **`p_A + p_B ≤ 5`** |
| C2, C3 | no extra cap beyond §1.1 |

### 1.1 Bowling all-rounders in **P3**

| Concept | Rule |
|---------|------|
| **Triplet \(p\)** | Every pick from **P3** (bowler or AR). |
| **Pure bowler \(b\)** | Profile role **`bowler`** only — counted toward cap. |
| **AR in P3** | Role **`all_rounder`** — fills a **P3** slot but **not** \(b\). |

**At XI fill (required):** **`b_A + b_B ≤ 4`**.

**From P3 slots only (planning):** if you take \(p_A\) from A’s P3 and \(p_B\) from B’s P3,

\[
b_A + b_B \le 4,\quad
b_A \le p_A,\ b_B \le p_B
\]

Minimum **bowling AR** picks from P3 in that XI:

\[
\text{AR}_{\min} = \max(0,\ p_A + p_B - 4)
\]

*(Example: \(p_A=3, p_B=3\) → need **2** AR from P3 across both sides, at most **4** pure bowlers.)*

**Nominal P3 pool (per franchise):** ensure **≥2** profile `all_rounder` in P3 when using high-\(p\) triplets (\(p_A+p_B>4\)).

---

## 2. XI segments

| Segment | Team A | Team B | Frequency |
|---------|--------|--------|-----------|
| **6–5** | 6 | 5 | Majority |
| **5–6** | 5 | 6 | Majority |
| **7–4** | 7 | 4 | ≤ 10% |
| **4–7** | 4 | 7 | ≤ 10% |

### 2.1 Seven–four rule (two **H** pools → seven picks)

| Profile | Team A | Team B | **7-pick side** | Segment |
|---------|--------|--------|-----------------|---------|
| **C1** | H · L · L | H · L · L | — | **7–4 / 4–7 N/A** |
| **C2** | **H · L · H** | L · H · L | **A** | **7–4** |
| **C3** | L · H · L | **H · L · H** | **B** | **4–7** |
| **C4** | **L · H · H** | **L · H · H** | Either | **7–4** or **4–7** |

### 2.2 C2 / C3 mirror — one segment per profile *(§5)*

**C2** and **C3** are pool-band mirrors. Each profile lists **only** the segments below; dropped segments are the exact pair-table mirror (swap `tA-rA-pA|tB-rB-pB` ↔ `tB-rB-pB|tA-rA-pA` under the partner profile’s bands).

| Segment | **C2** §5 | **C3** §5 |
|---------|-------------|-------------|
| **6–5** | ✓ | — |
| **5–6** | — | ✓ |
| **7–4** | ✓ | N/A |
| **4–7** | N/A | ✓ |

**Portfolio:** round-robin **C1→C2→C3→C4** → **C2** always **6–5** (or **7–4**), **C3** always **5–6** (or **4–7**) — both majority splits without duplicating tables. **C/VC** unchanged (outcome-based).

---

## 3. Triplet notation & global rules

\((t,r,p)\): \(t\) from P1, \(r\) from P2, \(p\) from P3; \(t+r+p=n\).

Full XI: **`(tA-rA-pA)|(tB-rB-pB)`**.

| Rule | Detail |
|------|--------|
| **P1 cross-franchise (required)** | **Never** \(t_A=3\) **and** \(t_B=3\) in the **same XI** — do not take all three tops from **both** franchises. **Allowed:** \(t=3\) on **Team A only**, or **Team B only**, or **\(t\le2\)** on both. |
| **P1-H / L** | \(t\ge2\) / \(t\le1\) |
| **P2-H / L** | \(r\ge2\) / \(r\le1\) |
| **P3-H / L** | \(p\ge2\) / \(p\le2\) (\(p\ge1\) if \(|P3|>0\)) |
| **Pure bowlers** | **`b_A+b_B≤4`** at fill (§1.1) |

**Pair columns in §5:** **AR\*** = \(\max(0, p_A+p_B-4)\) bowling AR required from P3 when the rest of P3 picks are pure bowlers.

### 3.1 P1 “all three tops” rule (paired XI)

| Situation | Allowed? |
|-----------|------------|
| \(t_A=3\), \(t_B\le2\) | ✓ |
| \(t_B=3\), \(t_A\le2\) | ✓ |
| \(t_A=3\) **and** \(t_B=3\) | **✗ forbidden** |
| \(t_A\le2\), \(t_B\le2\) | ✓ |

**Generator:** when one side’s triplet has \(t=3\), only pair with opponent triplets that have \(t\le2\).  
**Whitelist:** drop any `3-*-*|3-*-*` pair from §5.

### 3.2 Paired triplet selection *(canonical — not per-side)*

| Model | Allowed? |
|-------|----------|
| Pick a valid **Team A** triplet and a valid **Team B** triplet **independently**, then combine | **✗** |
| Pick **one row** from the §5 **pair whitelist** `tA-rA-pA\|tB-rB-pB` for the active profile + segment | **✓** |

**Why pairs:** Independent draws often violate §3.1 (\(t_A=3 \land t_B=3\)), wrong segment sums (\(n_A+n_B\ne 11\)), or profile caps (\(p_A+p_B\)). The whitelist is the **only** source of \((t,r,p)\) counts for both franchises in one XI.

**After the pair is chosen:** P1 / P2 / P3 **players** are still drawn **within each franchise** (weighted random from live pools) subject to the paired counts — that is separate from triplet-shape selection.

**Tiers (for code + review):**

| Tier | Role |
|------|------|
| **Primary (P)** | Default pair pool — every generated XI should use these unless you explicitly enable secondary |
| **Secondary (S)** | Optional add-ons (current code: ~35% chance to merge **S** into the pool with **P**) |

**Review workflow:** Use **§5.0** tables. Mark any **P** or **S** row to **remove**; later we sync `web/split_pool_catalog.js` `PAIRS` to match.

---

## 4. Profile summary

| Id | Team A | Team B | Story |
|----|--------|--------|-------|
| **C1** | H · L · L | H · L · L | Both top-heavy |
| **C2** | H · L · H | L · H · L | A tops+bowl; B middle |
| **C3** | L · H · L | H · L · H | A middle; B tops+bowl |
| **C4** | L · H · H | L · H · H | Both middle+bowl; **`p_A+p_B≤5`** |

**Portfolio (example):** 25% each · round-robin **C1→C2→C3→C4**. **C2/C3:** majority split via **C2 6–5** + **C3 5–6** only (§2.2).

---

## 5. Triplet-pair whitelist *(bowling AR in P3)*

**Notation:** `TeamA_triplet|TeamB_triplet` = `(tA-rA-pA)|(tB-rB-pB)` with \(t+r+p=n\) on that side for the active segment.

**Columns:** **Tier** **P** = primary · **S** = secondary · **AR\*** = \(\max(0,p_A+p_B-4)\) bowling AR slots required from P3 at fill · **Keep?** = your review (default ✓).

**Source of truth for implementation:** `web/split_pool_catalog.js` → `PAIRS` (must match this section after review).

---

### 5.0 C1 — P1A-H, P2A-L, P3A-L · P1B-H, P2B-L, P3B-L

**Caps:** **`p_A+p_B≤4`** · segments **6–5**, **5–6** only · **`2-2-2`** allowed on A when \(n_A=6\) (P2-L stretch).

| Seg | Tier | Pair (A\|B) | \(t_A,t_B\) | \(p_A,p_B\) | AR\* | Keep? |
|-----|------|-------------|-------------|-------------|------|-------|
| 6–5 | P | `3-1-2\|2-1-2` | 3,2 | 4 | 0 | ✓ |
| 6–5 | P | `2-2-2\|3-0-2` | 2,3 | 4 | 0 | ✓ |
| 6–5 | P | `2-2-2\|3-1-1` | 2,3 | 3 | 0 | ✓ |
| 6–5 | P | `2-2-2\|2-1-2` | 2,2 | 4 | 0 | ✓ |
| 5–6 | P | `2-1-2\|3-1-2` | 2,3 | 4 | 0 | ✓ |
| 5–6 | P | `2-1-2\|2-2-2` | 2,2 | 4 | 0 | ✓ |
| 5–6 | P | `3-0-2\|2-2-2` | 3,2 | 4 | 0 | ✓ |
| 5–6 | P | `3-1-1\|2-2-2` | 3,2 | 3 | 0 | ✓ |

**Not whitelisted** *(examples — do not add without re-audit):* `3-1-2\|3-0-2` (§3.1 both \(t=3\)) · any cross-segment sum (e.g. A `2-1-2` on 6–5) · `*\|2-0-3` (\(p_A+p_B>4\)).

---

### 5.1 C2 — P1A-H, P2A-L, P3A-H · P1B-L, P2B-H, P3B-L

**§2.2:** **6–5** + **7–4** only (no **5–6** here — use **C3**). **§3.1:** only **A** may have \(t=3\). Prefer **\(p_A,p_B\le3\)**.

#### Segment 6–5 (\(n_A=6\), \(n_B=5\))

| Tier | Pair (A\|B) | \(t_A,t_B\) | \(p_A,p_B\) | AR\* | Keep? |
|------|-------------|-------------|-------------|------|-------|
| P | `2-1-3\|0-4-1` | 2,0 | 3,1 | 0 | ✓ |
| P | `2-1-3\|1-3-1` | 2,1 | 3,1 | 0 | ✓ |
| P | `3-0-3\|0-4-1` | 3,0 | 3,1 | 0 | ✓ |
| P | `3-0-3\|1-3-1` | 3,1 | 3,1 | 0 | ✓ |
| P | `3-1-2\|0-3-2` | 3,0 | 2,2 | 0 | ✓ |
| P | `3-1-2\|0-4-1` | 3,0 | 2,1 | 0 | ✓ |
| P | `3-1-2\|1-2-2` | 3,1 | 2,2 | 0 | ✓ |
| P | `3-1-2\|1-3-1` | 3,1 | 2,1 | 0 | ✓ |
| S | `2-1-3\|0-3-2` | 2,0 | 3,2 | 1 | ✓ |
| S | `2-1-3\|1-2-2` | 2,1 | 3,2 | 1 | ✓ |
| S | `3-0-3\|0-3-2` | 3,0 | 3,2 | 1 | ✓ |
| S | `3-0-3\|1-2-2` | 3,1 | 3,2 | 1 | ✓ |

#### Segment 7–4 (\(n_A=7\), \(n_B=4\))

| Tier | Pair (A\|B) | \(p_A,p_B\) | AR\* | Keep? |
|------|-------------|-------------|------|-------|
| P | `3-1-3\|0-3-1` | 3,1 | 0 | ✓ |
| P | `3-1-3\|1-2-1` | 3,1 | 0 | ✓ |
| S | `3-1-3\|0-2-2` | 3,2 | 1 | ✓ |

**Excluded from whitelist:** `2-0-4` / `2-0-5` / `3-0-4` style (\(p\ge4\) on one side) · **AR\*≥2** pairs · **4–7** segment (N/A for C2).

---

### 5.2 C3 — P1A-L, P2A-H, P3A-L · P1B-H, P2B-L, P3B-H

**Mirror of C2** (swap A/B bands). **§2.2:** **5–6** + **4–7** only. **§3.1:** only **B** may have \(t=3\).

#### Segment 5–6 (\(n_A=5\), \(n_B=6\)) — *mirror of C2 **6–5** pairs*

| Tier | Pair (A\|B) | \(t_A,t_B\) | \(p_A,p_B\) | AR\* | Keep? |
|------|-------------|-------------|-------------|------|-------|
| P | `0-3-2\|3-1-2` | 0,3 | 2,2 | 0 | ✓ |
| P | `0-4-1\|2-1-3` | 0,2 | 1,3 | 0 | ✓ |
| P | `0-4-1\|3-0-3` | 0,3 | 1,3 | 0 | ✓ |
| P | `0-4-1\|3-1-2` | 0,3 | 1,2 | 0 | ✓ |
| P | `1-2-2\|3-1-2` | 1,3 | 2,2 | 0 | ✓ |
| P | `1-3-1\|2-1-3` | 1,2 | 1,3 | 0 | ✓ |
| P | `1-3-1\|3-0-3` | 1,3 | 1,3 | 0 | ✓ |
| P | `1-3-1\|3-1-2` | 1,3 | 1,2 | 0 | ✓ |
| S | `0-3-2\|2-1-3` | 0,2 | 2,3 | 1 | ✓ |
| S | `0-3-2\|3-0-3` | 0,3 | 2,3 | 1 | ✓ |
| S | `1-2-2\|2-1-3` | 1,2 | 2,3 | 1 | ✓ |
| S | `1-2-2\|3-0-3` | 1,3 | 2,3 | 1 | ✓ |

#### Segment 4–7 (\(n_A=4\), \(n_B=7\)) — *mirror of C2 **7–4***

| Tier | Pair (A\|B) | \(p_A,p_B\) | AR\* | Keep? |
|------|-------------|-------------|------|-------|
| P | `0-3-1\|3-1-3` | 1,3 | 0 | ✓ |
| P | `1-2-1\|3-1-3` | 1,3 | 0 | ✓ |
| S | `0-2-2\|3-1-3` | 2,3 | 1 | ✓ |

**6–5 / 7–4:** N/A for C3 (see C2).

---

### 5.3 C4 — P1A-L, P2A-H, P3A-H · P1B-L, P2B-H, P3B-H

**Caps:** **`p_A+p_B≤5`** · all four segments · both sides P1-L (\(t\le1\)) — §3.1 never binds.

#### Segment 6–5 (\(n_A=6\), \(n_B=5\))

| Tier | Pair (A\|B) | \(p_A+p_B\) | AR\* | Keep? |
|------|-------------|-------------|------|-------|
| P | `0-4-2\|0-3-2` | 4 | 0 | ✓ |
| P | `0-4-2\|1-2-2` | 4 | 0 | ✓ |
| P | `1-3-2\|0-3-2` | 4 | 0 | ✓ |
| P | `1-3-2\|1-2-2` | 4 | 0 | ✓ |
| S | `0-3-3\|0-3-2` | 5 | 1 | ✓ |
| S | `0-3-3\|1-2-2` | 5 | 1 | ✓ |
| S | `0-4-2\|0-2-3` | 5 | 1 | ✓ |
| S | `1-2-3\|0-3-2` | 5 | 1 | ✓ |
| S | `1-2-3\|1-2-2` | 5 | 1 | ✓ |
| S | `1-3-2\|0-2-3` | 5 | 1 | ✓ |

#### Segment 5–6 (\(n_A=5\), \(n_B=6\))

| Tier | Pair (A\|B) | \(p_A+p_B\) | AR\* | Keep? |
|------|-------------|-------------|------|-------|
| P | `0-3-2\|0-4-2` | 4 | 0 | ✓ |
| P | `0-3-2\|1-3-2` | 4 | 0 | ✓ |
| P | `1-2-2\|0-4-2` | 4 | 0 | ✓ |
| P | `1-2-2\|1-3-2` | 4 | 0 | ✓ |
| S | `0-2-3\|0-4-2` | 5 | 1 | ✓ |
| S | `0-2-3\|1-3-2` | 5 | 1 | ✓ |
| S | `0-3-2\|0-3-3` | 5 | 1 | ✓ |
| S | `0-3-2\|1-2-3` | 5 | 1 | ✓ |
| S | `1-2-2\|0-3-3` | 5 | 1 | ✓ |
| S | `1-2-2\|1-2-3` | 5 | 1 | ✓ |

#### Segment 7–4 (\(n_A=7\), \(n_B=4\))

| Tier | Pair (A\|B) | \(p_A+p_B\) | AR\* | Keep? |
|------|-------------|-------------|------|-------|
| P | `1-4-2\|0-2-2` | 4 | 0 | ✓ |
| S | `0-4-3\|0-2-2` | 5 | 1 | ✓ |
| S | `1-3-3\|0-2-2` | 5 | 1 | ✓ |

#### Segment 4–7 (\(n_A=4\), \(n_B=7\))

| Tier | Pair (A\|B) | \(p_A+p_B\) | AR\* | Keep? |
|------|-------------|-------------|------|-------|
| P | `0-2-2\|1-4-2` | 4 | 0 | ✓ |
| S | `0-2-2\|0-4-3` | 5 | 1 | ✓ |
| S | `0-2-2\|1-3-3` | 5 | 1 | ✓ |

**Not whitelisted:** pairs with **`p_A+p_B>5`** or **`0-2-4` / `0-2-5`**-style triplets under this cap.

---

### 5.4 Per-side triplet lists *(reference only — do not pick independently)*

These are the **unique** `t-r-p` strings that appear in §5.0–5.3 for that profile/segment. Use only as a cross-check when editing the pair tables.

| Profile | Segment | Team A triplets in whitelist | Team B triplets in whitelist |
|---------|---------|------------------------------|------------------------------|
| C1 | 6–5 | `3-1-2`, `2-2-2` | `3-0-2`, `3-1-1`, `2-1-2` |
| C1 | 5–6 | `2-1-2`, `3-0-2`, `3-1-1` | `3-1-2`, `2-2-2` |
| C2 | 6–5 | `2-1-3`, `3-0-3`, `3-1-2` | `0-3-2`, `0-4-1`, `1-2-2`, `1-3-1` |
| C2 | 7–4 | `3-1-3` | `0-2-2`, `0-3-1`, `1-2-1` |
| C3 | 5–6 | `0-3-2`, `0-4-1`, `1-2-2`, `1-3-1` | `2-1-3`, `3-0-3`, `3-1-2` |
| C3 | 4–7 | `0-2-2`, `0-3-1`, `1-2-1` | `3-1-3` |
| C4 | 6–5 | `0-3-3`, `0-4-2`, `1-2-3`, `1-3-2` | `0-2-3`, `0-3-2`, `1-2-2` |
| C4 | 5–6 | `0-2-3`, `0-3-2`, `1-2-2` | `0-3-3`, `0-4-2`, `1-2-3`, `1-3-2` |
| C4 | 7–4 | `1-4-2`, `0-4-3`, `1-3-3` | `0-2-2` |
| C4 | 4–7 | `0-2-2` | `1-4-2`, `0-4-3`, `1-3-3` |

---

## 6. Implementation notes

1. **Pools:** P3 = bowlers + bowling AR; P2 = batters/middle only.
2. Pick **C***, segment (§2), then **one pair** from §5.0–5.3 **`PAIRS[profile][segment]`** — **never** sample Team A and Team B triplets separately. **C2/C3:** respect §2.2 segment routing.
3. **`pickPair(profile, segment)`** returns parsed `(tA,rA,pA,tB,rB,pB)`; **P** + optional **S** tier (~35% merge today).
4. **Fill P3:** exactly **`AR*`** profile-AR from P3; remainder P3 = bowlers; **`b_A+b_B≤4`**.
5. **Fill P1/P2** counts from the pair; player choice within pools stays weighted random.
6. **`isValidGeneratedTeam`** + **C/VC** from outcome UI.

**Code sync checklist (after your pair review)**

- [ ] Update `web/split_pool_catalog.js` `PAIRS` to match §5 tables (drop rows you mark remove)
- [ ] Confirm generator never builds XIs except via `pickPair` (no per-side triplet RNG)
- [ ] Re-run `scripts/audit_split_pool_pairs.py` if adding pairs

**Open items**

- [ ] Final portfolio % C1–C4
- [ ] P3 pool split (3+2 vs 4+1 bowlers/AR)
- [x] **6–5 vs 5–6** — via **C2 6–5** + **C3 5–6** in round-robin (§2.2)
- [ ] **Your review:** strike **Keep?** on any §5 row to drop before code change

---

## 7. Revision history

| Version | Change |
|---------|--------|
| **v13** | **Bowling AR in P3** — full triplet/pair catalogs; **`AR*`** fill rule; **`b≤4`** unchanged |
| **v14** | **§3.1** P1 both-sides-\(t=3\) rule; C1 **`2-2-2`**; full C1 pair tables (valid / forbidden) |
| **v15** | **C1:** **`p_A+p_B\le4`**; drop `2-0-3` and pairs with **≥5** P3 total |
| **v16** | **C1 5–6:** fix B triplets to \(n=6\) only (`3-1-2`, `2-2-2`); remove 5-sum pairs |
| **v17** | **C1 6–5:** drop A `2-1-2` (\(n=5\)); **4** valid pairs only; forbidden wrong-sum pairs |
| **v18** | **C2 review:** full pair tables (16 / 9 / 12); sum + AR\* columns; no wrong-\(n\) triplets |
| **v19** | **C2 shortlist:** \(p_A,p_B\le3\) per side; whitelist **8+5+2** (AR\*=0); drop `2-0-4`, heavy 7–4 |
| **v20** | **C2 5–6:** restore **`0-4-2`** (\(p=2\), \(r=4\)); +2 whitelist pairs; fix mistaken \(p_B=4\) note |
| **v21** | **C3 mirror audit:** align shortlist with C2 (**7+8+2** AR\*=0); drop **AR\*≥2** / **`2-0-4`**; fix 6–5 AR\* grouping; add §3.1 + 7–4 N/A |
| **v22** | **§2.2:** drop duplicate **C2 5–6** and **C3 6–5**; round-robin uses **C2 6–5** + **C3 5–6** only |
| **v23** | **C4 audit:** triplets ✓ all segments; fix **6–5** AR\* buckets (+1 AR0, +2 AR1, move `1-2-3\|1-2-2`); **5–6** +2 AR1, +1 AR2; **7–4** `0-2-5\|0-2-2` → AR\*=3; shortlist tables |
| **v24** | **§1:** clarify **≥1 P3 per side** (not min BOW per side); **C4** cap **`p_A+p_B≤5`** — drop C4 **AR\*≥2** pairs and unusable **`p=4/5`** triplets in pairs |
| **v25** | **§3.2** paired selection canonical; **§5** restructured as **pair whitelist** (P/S tiers, **Keep?** column); per-side lists demoted to §5.4 reference; aligns with `split_pool_catalog.js` |
