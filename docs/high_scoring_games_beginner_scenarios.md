# High-scoring games: beginner scenarios (draft)

This document is a **starting point** for a batting-heavy, high-total strategy. We will revise it as we add generator logic and backtests.

---

## 1) Why focus on high-scoring games?

**Working idea:** In matches where both sides are likely to score heavily, the **game tends to stay in “batting-forward” phases** for longer. There are fewer classic “collapse and defend” stories, so the **number of plausible match narratives shrinks**. Fewer narratives usually means:

- More balls for top-order and middle-order batters who are locked into the XI.
- Bowlers are less often the sole match-winners (though wicket-takers in the middle or at the death still spike).

**Caveat:** “High score” does not guarantee simple fantasy outcomes. It mainly **narrows** which player types are in play; you still need **lineups and form** (and optionally venue if you choose to use it).

---

## 2) What we mean by “high-scoring” (beginner filter)

The **16-scenario system** below can run **without venue data**: use a **manual or squad-based toggle** (e.g. “treat this match as high-scoring”) plus lineups. If you *do* have useful venue signals, you can add them; they are **not required** for the scenario grid.

Use **at least one** of these as a pre-match screen (tune thresholds later):

| Signal | Beginner interpretation |
|--------|-------------------------|
| **Venue / ground history** *(optional)* | High recent first-innings averages, short boundaries—skip if data absent or untrusted. |
| **Two strong batting lineups** | Both teams have several proven boundary hitters in the top six. |
| **Dew / chase advantage (if relevant)** | Second innings gets easier ball-striking; totals and chases both inflate. |
| **Weak or incomplete bowling attacks** | Missing frontline bowlers increases run rate. |

If few boxes tick, treat the match as **not** in scope for this strategy.

---

## 3) Simplified scenario set (beginner version)

In high-scoring games we **first** ignore rare tails (e.g. 8-down finishes). Each label maps to “who gets fantasy volume.”

### Scenario A — First innings sets a big total

- **A1 — Top order carries:** Openers and #3–4 score most of the runs; lower middle faces few balls.
- **A2 — Middle / death launch:** Slow or steady start, then 5–7 and finishers cash in late.

*Team-building note:* **A1 vs A2** can be informed by lineups (who opens vs who finishes) or left as a **split** in pre-toss generation (cover both).

### Scenario B — Chase (second innings)

- **B1 — Comfortable chase:** Top order wins with overs to spare; many middle-order picks bat little.
- **B2a — Competitive chase (middle decides):** Required rate stays tricky through overs ~8–16; middle order and spin-hitters face many balls; game still in balance before the death.
- **B2b — Competitive chase (death decides):** Looks under control earlier, or par position, but **wickets or dot pressure late** means overs 16–20 decide it; finishers and death bowlers swing fantasy.
- **B3 — Chase falls short:** Often involves wickets in clusters (powerplay or middle overs); **bowlers** and one **anchor** may dominate fantasy among your picks.

*B2 split rationale:* “Competitive” was doing two jobs—**who faces the key balls** (middle vs death). Separating **B2a** and **B2b** keeps roster emphasis clearer.

---

## 4) How many combined scenarios? (8 vs 16)

Fix **which team bats first** (after toss / known order). For that single match:

- First innings pattern: **A1** or **A2** → **2**
- Chase pattern: **B1**, **B2a**, **B2b**, or **B3** → **4**

So for **Team A batting first and Team B chasing** you get **2 × 4 = 8** combined narratives.

The same structure applies if **Team B bats first and Team A chases**—another **8** combinations. Names (A/B) describe **innings role** (first dig vs chase), not fixed team letters; swap “who is A” when the other side bats first.

**Full catalog across both batting orders:** **8 + 8 = 16** scenario types.

- **After the toss** (you know who bats first): only **one** branch is live, so you only need **8** narrative combinations for *that* match.
- **Before the toss** (you must submit or freeze lineups early): you **do not** know which branch will occur, so **planning** should reason over the full **16** if you want to avoid being wrong-footed when batting order flips optimal stacks, captain choices, and bowler exposure.

---

## 5) Pre-toss workflow: many teams (e.g. ≥200) and multi-match slates

**Operational constraint:** You may need to generate **a large number of lineups** (e.g. **≥200**) and have **little time after the toss** to edit or re-enter teams. In that case you effectively build **before** the toss (or under incomplete information).

**What that implies for scenarios**

- Optimal fantasy construction often depends on **which team bats first** (first-innings batters vs chase batters, which bowlers get powerplay vs death, dew, etc.).
- If you cannot condition on the toss, you treat **both** batting-order outcomes as possible. Together with **A1/A2** and **B1/B2a/B2b/B3**, your **pre-toss design space** is the **16-type** catalog (same structure, **mirrored** when the other team bats first—not 16 arbitrary unrelated stories).
- You are not required to build **equal** mass on all 16; you can **weight** branches using **non-venue priors** (toss tendencies, squad strength, gut) or keep them **uniform**. The point is to **allocate** some of your team budget so you are not all-in on a single toss outcome.

**Portfolio goal across many matches**

- Over a **slate of ~10–15 matches**, only a subset will turn out “high scoring” in hindsight. The strategy is **not** to predict every game perfectly; it is to **pre-select** matches that fit the high-score filter, then **spread** many lineups so that—when a game does go high-scoring—**some** of your pre-toss coverage hits the **live** branch (toss + A/B narrative) that actually occurred.
- **End goal (working):** maximize the chance that, among those high-score games, **at least part** of your large entry set aligns with the realized scenario, because the scenario set for high totals is still **smaller** than in low-scoring chaos.

**Practical note:** 200 teams ≠ 200 copies of 16 cells. Use **stratified** generation (caps per scenario, de-duplication, correlation limits) so entries stay diverse; tune later in code and backtests.

---

## 6) Why this is still “fewer scenarios” than low/medium games

| Low / medium scoring | High scoring (our target) |
|----------------------|---------------------------|
| Collapses, 130-all-out, squeeze in middle overs | Fewer “all-out cheap” games; more overs of attack |
| Spinners strangling for 8 overs | Still happens, but batters have more room to recover |
| Tail deciding the game more often | Tail involved less often until very tight chase (B3 / some B2b) |

Compared to unconstrained T20 modelling, **8** narratives per match **after toss** (and **16** pre-toss if you must hedge both orders) is still a **small** discrete set—good for rules and tuning.

---

## 7) Beginner mapping: scenario → roster emphasis

Rough guide only; we will replace this with weighted rules in code.

| Scenario | Emphasis |
|----------|----------|
| **A1** | Openers, top-order anchors, in-form #3 |
| **A2** | Middle order, finishers, hard-hitting all-rounders lower in the order |
| **B1** | Same as chasing team’s **top order**; avoid over-stacking 6–7 unless they are also bowlers |
| **B2a** | Middle-order batters, all-rounders at 5–7; bowlers who bowl overs 7–15 |
| **B2b** | Finishers, death bowlers (both sides); fewer balls for “pure” #4 if they already did the job |
| **B3** | Bowlers with wicket upside; one premium batter who can bat deep |

---

## 8) Sixteen-case catalog (pre-toss IDs)

**Notation**

- **F** = team batting **first** in that branch (first innings).
- **Ch** = **chasing** team (second innings).
- **α-branch:** F = **Team 1**, Ch = **Team 2** (eight cells **α1…α8**).
- **β-branch:** F = **Team 2**, Ch = **Team 1** (eight cells **β1…β8**).

Each cell is **(first-dig story A×) × (chase story B×)**. Labels **A1/A2** and **B1/B2a/B2b/B3** are defined in §3.

| ID | First dig | Chase | Short description |
|----|-----------|-------|-------------------|
| α1 / β1 | A1 | B1 | F top-order sets total; **comfortable** chase (Ch top order wins). |
| α2 / β2 | A1 | B2a | F top-order sets total; chase **decided in middle** overs. |
| α3 / β3 | A1 | B2b | F top-order sets total; chase **decided at death**. |
| α4 / β4 | A1 | B3 | F top-order sets total; **Ch chase fails** — F defends. |
| α5 / β5 | A2 | B1 | F **middle/death** launch; Ch **comfortable** chase. |
| α6 / β6 | A2 | B2a | F late surge; chase **middle** phase decides. |
| α7 / β7 | A2 | B2b | F late surge; **death** decides chase. |
| α8 / β8 | A2 | B3 | F late surge; **Ch fails** — F wins. |

**Mirroring rule:** **βk** is the same narrative as **αk** but with **F and Ch swapped** (Team 2 bats first). All Captain / VC advice in §9 for **α** applies to **β** by swapping **F ↔ Ch** (and Team 1 ↔ Team 2).

---

## 9) Captain & vice-captain by scenario (2× / 1.5×)

Fantasy scoring multipliers (**Captain 2×**, **Vice-captain 1.5×**) mean C/VC should follow the **story** of each cell, not only raw projection. Pools below are **archetypes**; intersect with your global C/VC eligibility (e.g. `c_vc_pools.json`) when implementing.

**Legend:** **F** = first innings team, **Ch** = chase team. Table is for **α** (T1 = F, T2 = Ch). For **β**, swap F/Ch.

| Cell | Primary **C** (2×) | Primary **VC** (1.5×) | Usually **avoid / down-weight** for C & VC |
|------|-------------------|----------------------|-----------------------------------------------|
| **α1** | **Ch** top-order bat **or** **F** top-order bat (both had volume). | Second **Ch** top bat; **F** #2–3; **Ch** batting all-rounder with bat + some overs. | **Ch** pure bowlers (easy chase, fewer fantasy overs); **F** death-only bat if they barely faced balls (A1). |
| **α2** | **Ch** middle-order (≈4–6) / anchor who carried the tricky middle. | **F** middle-overs bowlers; **F** top bat (already “banked”); **Ch** AR. | **Ch** openers if narrative is cheap-out + middle rescue (use lineups to down-weight). |
| **α3** | **Ch** finisher **or** **F** death bowler if defense tight. | **Ch** death bowler; **F** death bowler; **Ch** top-order if set deep. | Part-timers; bowlers with no death role. |
| **α4** | **F** bowler (defending wickets) **or** **F** top-order bat (winning total). | **F** second bowler or **F** other bat; **Ch** “lone hand” chase batter; **Ch** AR with bat. | **Ch pure bowlers** for C/VC — losing chase: their side’s bowlers often low upside *in this story* (your example). |
| **α5** | **Ch** top-order **or** **F** middle / finisher (first-dig story). | **F** finisher / **F** #5–7; second **Ch** top bat. | **F** openers if A2 means they underperformed (slot-based). |
| **α6** | **Ch** middle **or** **F** middle / finisher. | **F** middle bowlers; **Ch** AR; **Ch** #5–6. | **F** openers under A2 “didn’t fire” narrative. |
| **α7** | **Ch** finisher; **F** finisher; **F** or **Ch** death bowler. | Complementary finisher ↔ death bowler; **Ch** 6–7 hitter. | Pure top-order with no death/middle exposure. |
| **α8** | **F** bowler **or** **F** middle / finisher (winning total + defense). | **F** second bowler/bat; **Ch** “almost” anchor. | **Ch bowlers** (same logic as α4: chase lost). |

**β1…β8:** Re-read the table with **F = Team 2**, **Ch = Team 1**. Example: **β4** (T2 first, A1, B3): **C** = **T2** bowler or **T2** top bat; **VC** = **T2** #2 / **T1** chase hero bat; **avoid T1 pure bowlers** for C/VC in that *defending Ch failed* story when **Ch = T1**.

**Implementation notes**

- **B3 and α4/α8/β4/β8:** defending **F** bowlers and **F** first-dig batters lead; **Ch** bowlers are structurally weak C/VC choices unless you explicitly model a rare “early wickets” sub-story.
- **B1:** chase was easy → **Ch** batters over **Ch** bowlers for multipliers.
- **B2a vs B2b:** shift weight from **middle bat + middle bowlers** to **finishers + death bowlers**.

---

## 10) Venue-free generation plan (outline)

1. **Tag match** as high-scoring using **non-venue** inputs: manual flag, both squads strong on paper, weak bowling list, etc.
2. **Pre-toss:** assign a **target count** per cell among **α1…α8, β1…β8** (uniform or weighted); enforce **caps** so the portfolio does not collapse onto one cell.
3. **Per cell:** bias XI sampling using §7; then choose **C** and **VC** from that cell’s archetype ∩ XI ∩ the **shared** C/VC eligibility list (`c_vc_pools.json` union), with **C ≠ VC**.
4. **Scale:** for **≥200** teams, use **stratified quotas** + de-duplication + optional repeat penalties—not 200 random copies of one scenario.
5. **After toss (optional late pass):** drop the wrong **α** or **β** branch and keep only the matching eight cells if you still have edit time.

---

## 11) Open questions (for the next edit)

- Exact **non-venue** rules for “tag as high-scoring” (squad thresholds, manual only, etc.).
- How to **detect A1 vs A2** and **B1 vs B2a vs B2b vs B3** automatically from live data vs **purely stratified** pre-toss coverage.
- Minimum **bowler count** so the XI is not brittle in B3.
- **Pre-toss allocation:** default weights across the **16** cells; per-cell caps; correlation limits between entries.
- How many **high-score candidate** matches per slate and how many teams per match vs slate-wide.
- JSON / code mapping: **cell id → C/VC candidate weights / down_weight** intersecting the shared `c_vc_pools.json` eligibility set.

---

## 12) Revision log

| Date | Change |
|------|--------|
| 2026-04-18 | Initial beginner draft: high-score rationale, 2×3 combined stories (before B2 split). |
| 2026-04-18 | B2 split into B2a/B2b; 8 scenarios per batting-order branch, 16 in full catalog; section renumber. |
| 2026-04-18 | Pre-toss ≥200 teams, multi-match portfolio goal; §4 clarified post-toss vs pre-toss. |
| 2026-04-18 | §8–§10: sixteen-case IDs (α/β), C/VC table, venue-free generation outline; §2/§5 venue optional. |
| 2026-04-18 | Core rules doc touch: shared C/VC eligibility (no disjoint pool requirement). |
