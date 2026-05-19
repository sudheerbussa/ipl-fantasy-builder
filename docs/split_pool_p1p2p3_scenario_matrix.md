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

## 5. Triplet catalog *(bowling AR in P3)*

### C1 — P1A-H, P2A-L, P3A-L · P1B-H, P2B-L, P3B-L

*P1-heavy story — tops face balls; bowlers don’t dominate early. **C1-only:** **`p_A + p_B ≤ 4`**. Per-side **P3-L:** \(p\le2\). **`2-2-2`** on \(n=6\) approved (\(r=2\) mild stretch of P2-L). **Check:** each triplet must satisfy **\(t+r+p=n\)** for that side (\(n_A=5\) or \(6\) on **5–6**; \(n_A=6\) or \(5\) on **6–5**) so the pair always totals **11**.*

#### 6–5 (\(n_A=6\), \(n_B=5\))

**Team A** \(n=6\): `3-1-2`, `2-2-2` only

| Triplet | Sum | Notes |
|---------|-----|--------|
| `3-1-2` | 6 | ✓ P1 max (pair only with B \(t\le2\)) |
| `2-2-2` | 6 | ✓ P2 stretch |
| ~~`2-1-2`~~ | **5** | **Wrong segment** — use on **5–6** A (\(n=5\)) or **6–5** B only |

**Team B** \(n=5\): `3-0-2`, `3-1-1`, `2-1-2`

| Triplet | Sum | \(p\) | Notes |
|---------|-----|-------|--------|
| `3-0-2` | 5 | 2 | P1 max (pair only with A \(t\le2\)) |
| `3-1-1` | 5 | 1 | P1 max |
| `2-1-2` | 5 | 2 | |

**Valid pairs** *(§3.1 + \(p_A+p_B\le4\) + **11 players**)*:

| Pair | \(n_A+n_B\) | \(t_A,t_B\) | \(p_A+p_B\) |
|------|-------------|-------------|-------------|
| `3-1-2\|2-1-2` | 11 | 3,2 | 4 |
| `2-2-2\|3-0-2` | 11 | 2,3 | 4 |
| `2-2-2\|3-1-1` | 11 | 2,3 | 3 |
| `2-2-2\|2-1-2` | 11 | 2,2 | 4 |

**Forbidden pairs:**

| Pair | Why |
|------|-----|
| `3-1-2\|3-0-2` | both \(t=3\) (§3.1) |
| `3-1-2\|3-1-1` | both \(t=3\) |
| `2-1-2\|3-0-2` | A `2-1-2` sums to **5**, not **6** → **10** players |
| `2-1-2\|3-1-1` | A `2-1-2` sums to **5**, not **6** |
| `2-1-2\|2-1-2` | A `2-1-2` sums to **5**, not **6** |
| `2-1-2\|3-1-2` | A on wrong segment *(and **5–6** B only)* |
| `3-1-2\|2-0-3` | \(p_A+p_B=5\); B `2-0-3` invalid |
| `2-2-2\|2-0-3` | \(p_A+p_B=5\) |

#### 5–6 (\(n_A=5\), \(n_B=6\))

**Team A** \(n=5\): `2-1-2`, `3-0-2`, `3-1-1`  
**Team B** \(n=6\): `3-1-2`, `2-2-2` only

| Triplet | Sum | Notes |
|---------|-----|--------|
| `3-1-2` | 6 | ✓ |
| `2-2-2` | 6 | ✓ (P2 stretch) |
| ~~`2-1-2`~~ | **5** | **Wrong segment** — use on **6–5** B (\(n=5\)) only |
| ~~`3-0-2`~~ | **5** | **Wrong segment** — use on **6–5** B only |

**Valid pairs** *(§3.1 + \(p_A+p_B\le4\) + **11 players**)*:

| Pair | \(n_A+n_B\) | \(t_A,t_B\) | \(p_A+p_B\) |
|------|-------------|-------------|-------------|
| `2-1-2\|3-1-2` | 11 | 2,3 | 4 |
| `2-1-2\|2-2-2` | 11 | 2,2 | 4 |
| `3-0-2\|2-2-2` | 11 | 3,2 | 4 |
| `3-1-1\|2-2-2` | 11 | 3,2 | 3 |

**Forbidden pairs:**

| Pair | Why |
|------|-----|
| `3-0-2\|3-1-2` | both \(t=3\) |
| `3-1-1\|3-1-2` | both \(t=3\) |
| `2-1-2\|2-1-2` | B triplet sums to **5**, not **6** |
| `2-1-2\|3-0-2` | B `3-0-2` sums to **5**, not **6** |
| `3-0-2\|2-1-2` | B `2-1-2` sums to **5**, not **6** |
| `3-1-1\|2-1-2` | B `2-1-2` sums to **5**, not **6** |
| `2-1-2\|2-0-3` | \(p_A+p_B=5\) |
| `3-0-2\|2-0-3` | \(p_A+p_B=5\) |
| `3-1-1\|2-0-3` | \(p_A+p_B=5\) |

#### 7–4 / 4–7 — **N/A**

---

### C2 — P1A-H, P2A-L, P3A-H · P1B-L, P2B-H, P3B-L

*A tops + bowl (**H/L/H**); B middle rescue (**L/H/L**). **§3.1:** only **A** can have \(t=3\) (B is P1-L). Fill: **`b_A+b_B≤4`**, **`AR*`** from §1.1. **§2.2:** segments **6–5**, **7–4** only — **5–6** → **C3** §5–6 (mirror).*

**C2 shortlist rule:** do **not** take **4+ P3 picks from one franchise** (\(p_A\le3\) and \(p_B\le3\)) — the **third** number in `t-r-p` is **\(p\)** (e.g. `0-4-2` → \(p=2\), not 4). **Recommended whitelist** = **\(p_A,p_B\le3\)** and **AR\*=0** first.

#### 6–5 (\(n_A=6\), \(n_B=5\))

**Team A** \(n=6\) H/L/H:

| Triplet | Sum | \(p\) |
|---------|-----|-------|
| `2-1-3` | 6 | 3 |
| `3-0-3` | 6 | 3 |
| `3-1-2` | 6 | 2 |
| ~~`2-0-4`~~ | 6 | **4** — **excluded** from shortlist |

**Team B** \(n=5\) L/H/L:

| Triplet | Sum | \(p\) |
|---------|-----|-------|
| `0-3-2` | 5 | 2 |
| `0-4-1` | 5 | 1 |
| `1-2-2` | 5 | 2 |
| `1-3-1` | 5 | 1 |

**Recommended whitelist** *(AR\*=0, \(p_A,p_B\le3\))* — **8 pairs:**

| Pair | \(t_A,t_B\) | \(p_A,p_B\) |
|------|-------------|-------------|
| `2-1-3\|0-4-1` | 2,0 | 3,1 |
| `2-1-3\|1-3-1` | 2,1 | 3,1 |
| `3-0-3\|0-4-1` | 3,0 | 3,1 |
| `3-0-3\|1-3-1` | 3,1 | 3,1 |
| `3-1-2\|0-3-2` | 3,0 | 2,2 |
| `3-1-2\|0-4-1` | 3,0 | 2,1 |
| `3-1-2\|1-2-2` | 3,1 | 2,2 |
| `3-1-2\|1-3-1` | 3,1 | 2,1 |

**Optional add** *(AR\*=1, still \(p\le3\) per side)*: `2-1-3\|0-3-2` · `2-1-3\|1-2-2` · `3-0-3\|0-3-2` · `3-0-3\|1-2-2`

**Excluded from shortlist** *(full catalog only)*: any pair using **`2-0-4`** (\(p_A=4\)); **AR\*≥2** pairs; §3.1 N/A on this segment (B never \(t=3\)).

#### 5–6 — **see C3** §5 *(§2.2 mirror; not duplicated here)*

#### 7–4 *(A=7, B=4 — §2.1)*

**Team A** \(n=7\) H/L/H: **`3-1-3` only** for shortlist (\(p=3\)) · ~~`2-0-5`~~ (\(p=5\)) · ~~`2-1-4`~~ / ~~`3-0-4`~~ (\(p=4\))  
**Team B** \(n=4\) L/H/L: `0-2-2`, `0-3-1`, `1-2-1`

**Recommended whitelist** *(AR\*=0)* — **2 pairs:**

| Pair | \(p_A,p_B\) |
|------|-------------|
| `3-1-3\|0-3-1` | 3,1 |
| `3-1-3\|1-2-1` | 3,1 |

**Optional** *(AR\*=1)*: `3-1-3\|0-2-2` (\(p_A,p_B=3,2\))

**Excluded:** all pairs using **`2-0-5`**, **`2-1-4`**, **`3-0-4`**; **AR\*≥2** catalog pairs.

#### 4–7 — **N/A** (two-H side is A only)

---

### C3 — P1A-L, P2A-H, P3A-L · P1B-H, P2B-L, P3B-H

*A middle rescue (**L/H/L**); B tops + bowl (**H/L/H**). **Mirror of C2:** swap pool bands and **§3.1** — only **B** can have \(t=3\) (A is P1-L). Same **C2 shortlist rule** (\(p_A,p_B\le3\), **AR\*=0** first). **§2.2:** segments **5–6**, **4–7** only — **6–5** → **C2** §6–5 (mirror).*

#### 6–5 — **see C2** §5 *(§2.2 mirror; not duplicated here)*

#### 5–6 (\(n_A=5\), \(n_B=6\))

**Team A** \(n=5\) L/H/L: `0-3-2`, `0-4-1`, `1-2-2`, `1-3-1` — read as \(t,r,p\): **`0-4-1`** has **\(p=1\)** (the **4** is **P2**)

**Team B** \(n=6\) H/L/H:

| Triplet | Sum | \(p\) |
|---------|-----|-------|
| `2-1-3` | 6 | 3 |
| `3-0-3` | 6 | 3 |
| `3-1-2` | 6 | 2 |
| ~~`2-0-4`~~ | 6 | **4** — **excluded** from shortlist |

**Recommended whitelist** *(AR\*=0, \(p_A,p_B\le3\) each side)* — **8 pairs** *(mirror of C2 **6–5**; sole C2/C3 home for this split)*:

| Pair | \(t_A,t_B\) | \(p_A,p_B\) |
|------|-------------|-------------|
| `0-3-2\|3-1-2` | 0,3 | 2,2 |
| `0-4-1\|2-1-3` | 0,2 | 1,3 |
| `0-4-1\|3-0-3` | 0,3 | 1,3 |
| `0-4-1\|3-1-2` | 0,3 | 1,2 |
| `1-2-2\|3-1-2` | 1,3 | 2,2 |
| `1-3-1\|2-1-3` | 1,2 | 1,3 |
| `1-3-1\|3-0-3` | 1,3 | 1,3 |
| `1-3-1\|3-1-2` | 1,3 | 1,2 |

**Optional add** *(AR\*=1, still \(p\le3\) per side)*: `0-3-2\|2-1-3` · `0-3-2\|3-0-3` · `1-2-2\|2-1-3` · `1-2-2\|3-0-3`

**Excluded from shortlist** *(full catalog only)*: any pair using **`2-0-4`** on B (\(p_B=4\)); **AR\*≥2** pairs.

#### 4–7 *(A=4, B=7 — §2.1)*

**Team A** \(n=4\) L/H/L: `0-2-2`, `0-3-1`, `1-2-1`  
**Team B** \(n=7\) H/L/H: **`3-1-3` only** for shortlist (\(p=3\)) · ~~`2-0-5`~~ (\(p=5\)) · ~~`2-1-4`~~ / ~~`3-0-4`~~ (\(p=4\))

**Recommended whitelist** *(AR\*=0)* — **2 pairs** *(mirror of C2 **7–4**)*:

| Pair | \(p_A,p_B\) |
|------|-------------|
| `0-3-1\|3-1-3` | 1,3 |
| `1-2-1\|3-1-3` | 1,3 |

**Optional** *(AR\*=1)*: `0-2-2\|3-1-3` (\(p_A,p_B=2,3\))

**Excluded:** all pairs using **`2-0-5`**, **`2-1-4`**, **`3-0-4`** on B; **AR\*≥2** catalog pairs.

#### 7–4 — **N/A** (two-H side is B only)

---

### C4 — P1A-L, P2A-H, P3A-H · P1B-L, P2B-H, P3B-H

*Both sides **L/H/H** (middle + bowl heavy; P1-L so **\(t\le1\)** both sides — §3.1 never binds). **C4-only:** **`p_A + p_B ≤ 5`** (with P3-H \(p\ge2\) each side, effective **\(p\le3\)** per side in any pair). **Shortlist:** **AR\*=0** first. **Verified:** triplets satisfy \(t+r+p=n\) and bands; pairs below satisfy §3.1 + **`p_A+p_B≤5`**.*

#### 6–5 (\(n_A=6\), \(n_B=5\))

**Team A** \(n=6\) L/H/H:

| Triplet | Sum | \(p\) |
|---------|-----|-------|
| `0-3-3` | 6 | 3 |
| `0-4-2` | 6 | 2 |
| `1-2-3` | 6 | 3 |
| `1-3-2` | 6 | 2 |
| ~~`0-2-4`~~ | 6 | **4** — **no valid B partner** under **`p_A+p_B≤5`** + P3-H |

**Team B** \(n=5\) L/H/H: `0-2-3`, `0-3-2`, `1-2-2`

**Recommended whitelist** *(AR\*=0, \(p_A+p_B\le5\))* — **4 pairs:**

| Pair | \(p_A+p_B\) |
|------|-------------|
| `0-4-2\|0-3-2` | 4 |
| `0-4-2\|1-2-2` | 4 |
| `1-3-2\|0-3-2` | 4 |
| `1-3-2\|1-2-2` | 4 |

**Optional** *(AR\*=1)*: `0-3-3\|0-3-2` · `0-3-3\|1-2-2` · `0-4-2\|0-2-3` · `1-2-3\|0-3-2` · `1-2-3\|1-2-2` · `1-3-2\|0-2-3`

**Excluded** *(full enum only)*: any pair with **`p_A+p_B>5`** (e.g. `0-2-4\|…`, `0-3-3\|0-2-3`); **AR\*≥2** under this cap.

#### 5–6 (\(n_A=5\), \(n_B=6\))

**Team A** \(n=5\) L/H/H: `0-2-3`, `0-3-2`, `1-2-2`

**Team B** \(n=6\) L/H/H:

| Triplet | Sum | \(p\) |
|---------|-----|-------|
| `0-3-3` | 6 | 3 |
| `0-4-2` | 6 | 2 |
| `1-2-3` | 6 | 3 |
| `1-3-2` | 6 | 2 |
| ~~`0-2-4`~~ | 6 | **4** — **no valid A partner** under **`p_A+p_B≤5`** |

**Recommended whitelist** *(AR\*=0)* — **4 pairs:**

| Pair | \(p_A+p_B\) |
|------|-------------|
| `0-3-2\|0-4-2` | 4 |
| `0-3-2\|1-3-2` | 4 |
| `1-2-2\|0-4-2` | 4 |
| `1-2-2\|1-3-2` | 4 |

**Optional** *(AR\*=1)*: `0-2-3\|0-4-2` · `0-2-3\|1-3-2` · `0-3-2\|0-3-3` · `0-3-2\|1-2-3` · `1-2-2\|0-3-3` · `1-2-2\|1-2-3`

**Excluded:** **`p_A+p_B>5`**; **AR\*≥2**.

#### 7–4 *(A=7, B=4 — §2.1)*

**Team A** \(n=7\) L/H/H: **`1-4-2`**, **`1-3-3`**, **`0-4-3`** only *(~~`0-3-4`~~, ~~`1-2-4`~~, ~~`0-2-5`~~ — cannot pair with B **`0-2-2`** under **`p_A+p_B≤5`))*  
**Team B** \(n=4\) L/H/H: `0-2-2` only

**Recommended whitelist** *(AR\*=0)* — **1 pair:**

| Pair | \(p_A+p_B\) |
|------|-------------|
| `1-4-2\|0-2-2` | 4 |

**Optional** *(AR\*=1)*: `0-4-3\|0-2-2` · `1-3-3\|0-2-2`

**Excluded:** **`0-2-5\|0-2-2`**, **`0-3-4\|0-2-2`**, **`1-2-4\|0-2-2`** (\(p_A+p_B>5\)).

#### 4–7 *(A=4, B=7 — §2.1)*

**Team A** \(n=4\) L/H/H: `0-2-2` only  
**Team B** \(n=7\) L/H/H: **`1-4-2`**, **`1-3-3`**, **`0-4-3`** only *(same exclusions as **7–4** A)*

**Recommended whitelist** *(AR\*=0)* — **1 pair:**

| Pair | \(p_A+p_B\) |
|------|-------------|
| `0-2-2\|1-4-2` | 4 |

**Optional** *(AR\*=1)*: `0-2-2\|0-4-3` · `0-2-2\|1-3-3`

**Excluded:** **`0-2-2\|0-2-5`**, **`0-2-2\|0-3-4`**, **`0-2-2\|1-2-4`**.

---

## 6. Implementation notes

1. **Pools:** P3 = bowlers + bowling AR; P2 = batters/middle only.
2. Pick **C***, segment, then **pair** from §5 (or enumerate sides + filter \(t_A=3 \land t_B=3\)). **C2/C3:** respect §2.2 — e.g. **C2** + **5–6** → use **C3** catalog (and vice versa for **C3** + **6–5**).
3. **Fill P3 slots:** choose exactly **`AR*`** players with role `all_rounder` from P3; fill remaining P3 slots with `bowler` so **`b_A+b_B≤4`**.
4. **≥1 P3 pick per contributing side** (§1); profile caps **C1** `p_A+p_B≤4`, **C4** `p_A+p_B≤5`.
5. Fill P1/P2; then **`isValidGeneratedTeam`**: ≥1 WK, BAT, profile-AR, BOWL in XI (global mins).
6. **C/VC** from outcome UI.

**Open items**

- [ ] Final portfolio % C1–C4
- [ ] P3 pool split (3+2 vs 4+1 bowlers/AR)
- [x] **6–5 vs 5–6** — via **C2 6–5** + **C3 5–6** in round-robin (§2.2)

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
