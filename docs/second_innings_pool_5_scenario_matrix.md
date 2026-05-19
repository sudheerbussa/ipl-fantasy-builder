# 2nd-innings 5-player strategy — chase-middle vs first-innings bowl

**Status:** Design reference for generator mode **`second_innings_pool_5`**. **Lineup shape** = two products below. **C/VC** = **pool-based** rules per product (separate from high-scoring α/β cells).

**Implementation:** `web/app.js` (`STRATEGY_ID_SECOND_INNINGS`, `getSecondInningsPoolBasedCvIds`, `classifyTickedPlayerForSecondInningsCv`). **UI:** Generator → 2nd innings pools. **Persistence:** `localStorage` key `ipl2026_second_innings_pools_v1`.

**Related:** Full-XI C/VC layer concepts in `docs/c_vc_scenario_combinations.md` (2nd-innings uses a **relaxed** subset on 5-player teams).

---

## 1. Notation

| Symbol | Meaning |
|--------|---------|
| **F** | Franchise that **batted first** (non-chasing team for this fixture) |
| **Ch** | **Chasing** team (2nd innings batting; user picks in **Chasing team** dropdown) |
| **Top** | Chase pool: Ch top-order batters (WK + bat slot ≤ 3) |
| **Rest** | Chase pool: all other ticked Ch players (middle/lower bat, Ch bowlers, Ch AR, …) |
| **P2** | First-innings pool: ticked **F** players with profile role **bowler** or **all_rounder** |
| **\((T,R,P2)\)** | Triplet: pick \(T\) from Top, \(R\) from Rest, \(P2\) from P2; **\(T+R+P2=5\)** |

**Tags on generated rows** (`highScoreScenario` column):

| Tag | UI name | Story |
|-----|---------|--------|
| `si_chase_middle` | Chase-middle | **Ch** middle/top order drives the chase; **F** contributes via P2 |
| `si_first_innings_bowl` | First-innings bowl | **F** bowlers/AR dominate the 2nd innings; lineup is **P2-heavy** |

---

## 2. Player pools

Three editable lists per fixture. User may move players with **Top / Rest / P2** buttons. Every **ticked** player must sit in exactly one pool before generation.

### 2.1 Auto-fill rules

| Pool | Rule (ticked players only) |
|------|----------------------------|
| **Top** | **Ch** + (WK **or** batsman with batting slot **≤ 3**) |
| **Rest** | **Ch** + not Top (includes Ch bowlers, Ch AR, middle/lower bat, …) |
| **P2** | **F** + effective role **bowler** **or** profile role **all_rounder** |

**Not auto-placed in P2:** F pure batters / WK (move manually if needed).

**C/VC on pool assign:** Adding a player to Top, Rest, or P2 also adds them to **both** scenario C/VC pool lists (user can untick per scenario).

### 2.2 Minimum sizes for generation

- **≥ 5** players total across Top + Rest + P2 (ticked).
- Each configured triplet \((T,R,P2)\) must satisfy **Top ≥ T**, **Rest ≥ R**, **P2 ≥ P2** count (blocker message if not).

### 2.3 Generator match pool

For projections, the engine uses **ticked squad ∪ (Top ∪ Rest ∪ P2)** so pool members get `proj` / role rows even if not ticked (same pattern as bat-first pools).

---

## 3. Triplet notation & global rules

\((T,R,P2)\): \(T\) from **Top**, \(R\) from **Rest**, \(P2\) from **P2**; **\(T+R+P2=5\)**.

| Rule | Detail |
|------|--------|
| **Sum** | Each triplet must sum to **5** (parser rejects invalid tokens) |
| **Uniqueness in XI** | Five distinct `team::player` keys per team |
| **Combo rotation** | Team index \(k\) uses `combos[k % \|combos\|]` |
| **Schedule** | Within each \((T,R,P2)\), combinations are enumerated (if small) or random-sampled |
| **Separate catalogs** | **Chase-middle** and **first-innings bowl** use **different** comma-separated combo lists in UI |

**Reading triplets:** `2-0-3` = 2 from Rest, 0 from Top, 3 from P2 (bowl-heavy).

---

## 4. Scenario summary

| Id | Tag | Lineup intent | Default combo emphasis |
|----|-----|---------------|-------------------------|
| **Chase** | `si_chase_middle` | Mostly **Ch** (Top + Rest) + some **F** P2 | Higher **R**; moderate P2 |
| **Bowl** | `si_first_innings_bowl` | **F** P2 bowlers/AR; some **Ch** via Rest/Top | Higher **P2**; often **T=0** |

**Portfolio split:** **Chase-middle %** (default **50**) → `nChase = round(N × %)` (same rounding as bat-first **full pool %**); `nBowl = N - nChase`.

**Output order:** Teams are **interleaved** chase, bowl, chase, bowl, … after each block is built.

**Dedupe:**

| Scope | Key |
|-------|-----|
| Within one scenario | `lineup#captain#vice\|si_chase_middle` or `\|si_first_innings_bowl` |
| Across scenarios | **Allowed** — same XI + C/VC may appear once in chase and once in bowl |

**Lineup cooldown:** Last **3** accepted XIs per scenario block cannot repeat (XI-only key; C/VC change allowed).

---

## 5. Default triplet catalogs

Shipped defaults (upgraded from legacy specs on load when still on old app defaults).

### 5.1 Chase-middle (`si_chase_middle`)

**Default spec:** `0-3-2,0-2-3,1-2-2,1-1-3`

| Triplet | \(T\) | \(R\) | P2 | Story skew |
|---------|------|------|-----|------------|
| `0-3-2` | 0 | 3 | 2 | Chase rest-heavy + 2 F P2 |
| `0-2-3` | 0 | 2 | 3 | More F P2 |
| `1-2-2` | 1 | 2 | 2 | One Ch top + rest + 2 F P2 |
| `1-1-3` | 1 | 1 | 3 | One Ch top + one Ch rest + 3 F P2 |

**Removed from defaults (v2):** `1-3-1`.

### 5.2 First-innings bowl (`si_first_innings_bowl`)

**Default spec:** `0-2-3,1-1-3,2-0-3,1-2-2`

| Triplet | \(T\) | \(R\) | P2 | Story skew |
|---------|------|------|-----|------------|
| `0-2-3` | 0 | 2 | 3 | P2-heavy |
| `1-1-3` | 1 | 1 | 3 | One Ch top + one Ch rest + 3 P2 |
| `2-0-3` | 2 | 0 | 3 | Two Ch rest + 3 P2 (no Ch top) |
| `1-2-2` | 1 | 2 | 2 | One Ch top + two Ch rest + 2 P2 |

**Removed from defaults (v2):** `0-1-4`, `1-0-4` (needed **P2 ≥ 4**; caused many short pools to fail).

### 5.3 Custom specs

- Comma-separated list of triplets; duplicates deduped.
- Legacy migration upgrades old shipped defaults and legacy `P1-P2` pair specs on load.

---

## 6. C/VC — pool-based (not role-based)

**Lineup scenario** (chase vs bowl) chooses **which triplet catalog** builds the 5.  
**C/VC** eligibility is determined by **which pool** the player sits in, not batting role.

| Scenario | Captain pool | Vice-captain pool |
|----------|--------------|-------------------|
| **Chase-middle** | **Top ∪ Rest** | **Rest ∪ P2** |
| **First-innings bowl** | **P2 only** | **Top ∪ Rest ∪ P2** |

### 6.1 Autofill & UI ticks

- **Auto-fill** ticks every squad player who matches the pool rules above (`classifyTickedPlayerForSecondInningsCv`).
- **Manual ticks** may **narrow** the pool used at generation (only ticked names that still satisfy pool rules).
- If **no** valid C or VC ticks remain, generation falls back to the **full pool-based** lists.

### 6.2 UI hints

| Scenario | Captain | Vice |
|----------|---------|------|
| Chase-middle | Chase **Top** or **Rest** pool | Chase **Rest** or first-innings **P2** pool |
| First-innings bowl | First-innings **P2** pool only | Chase **Top**, **Rest**, or **P2** pool |

### 6.3 C/VC at generation time

| Step | Behaviour |
|------|-----------|
| **Eligibility** | `getSecondInningsPoolBasedCvIds` from live Top / Rest / P2 lists |
| **Ticks** | Optional subset; empty → use full pool-based lists |
| **Drawn XI** | C/VC chosen from pool rules **∩** drawn 5 (with relax fallback) |
| **Layer id** | **α2/β2** (chase) or **α5/β5** (bowl) — score multipliers only |
| **Dual bowler** | `same_franchise_dual_bowler_cvc` **skipped** on 5-player teams |

### 6.4 Why pool-based reduces `cvc_none`

| Old (role-based) | New (pool-based) |
|------------------|------------------|
| Ch bowler in Rest → not in chase C/VC autofill | Ch bowler in Rest → **eligible for C** (chase) |
| Bowl XI `2-0-3` → only F bowlers as C candidates | **C ∈ P2** matches all three F picks |
| VC required “anchor” middle bat | **VC ∈ Rest∪P2** matches anyone in those pools |

---

## 7. Chase vs bowl — expectation matrix

| Question | Chase-middle | First-innings bowl |
|----------|--------------|---------------------|
| Who wins the story? | **Ch** batters chase | **F** bowlers/AR in 2nd inns |
| XI bias | Top + Rest (Ch) | P2 (F) |
| **C pool** | Top ∪ Rest | P2 only |
| **VC pool** | Rest ∪ P2 | Top ∪ Rest ∪ P2 |
| Ch bowlers in XI? | **Yes** (Rest) | **Yes** (Rest) |
| Ch bowlers as C (chase)? | **Yes** if in Top or Rest | **No** (not in P2) |
| Same XI+C/VC in both products? | **Allowed** (different dedupe buckets) |

---

## 8. Worked examples (nominal pools)

**Setup:** Top = 3, Rest = 4, P2 = 5; Chase-middle % = 50%; N = 80 → 40 chase + 40 bowl.

### 8.1 Chase-middle draw `0-3-2`

- **XI:** 0 Top + 3 Rest + 2 P2.
- **C:** any of the 3 Rest (and 0 Top).
- **VC:** any of 3 Rest or 2 P2 → always at least one legal pair.

### 8.2 Bowl draw `2-0-3`

- **XI:** 2 Rest + 3 P2.
- **C:** any of 3 P2.
- **VC:** any of 2 Rest or 3 P2 → full XI is VC-eligible.

---

## 9. Implementation notes

1. **Mode id:** `second_innings_pool_5`; min squad tick count **5** (not 11).
2. **Defaults:** `DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC`, `DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC` in `app.js`.
3. **C/VC:** `getSecondInningsPoolBasedCvIds`, `getSecondInningsCvRuntimeOptsForGeneration`.
4. **Attempts cap:** `N × ATTEMPTS_MULTIPLIER × SECOND_INNINGS_ATTEMPTS_MULTIPLIER` (**×4**) per block.
5. **Diagnostics:** `#secondInningsGenLog` — per-scenario rejects.

### 9.1 Pre-generate checklist

- [ ] Chasing team selected  
- [ ] Auto-fill (or manual) Top / Rest / P2  
- [ ] Chase & bowl combo strings valid for pool sizes  
- [ ] Chase-middle % set  
- [ ] Pool-based C/VC: Rest + P2 non-empty for chase; P2 non-empty for bowl  

---

## 10. Open items

- [ ] Fixture-specific combo whitelists (optional)  
- [ ] 3-pass same-XI dup cap (as split-pool / bat-first) for 2nd-innings  

---

## 11. Revision history

| Version | Change |
|---------|--------|
| **v1** | Initial matrix: pools, triplets, chase/bowl scenarios, role-based C/VC |
| **v2** | Chase defaults drop `1-3-1`; bowl defaults drop `0-1-4`/`1-0-4`, add `1-2-2`; **C/VC pool-based** (chase C∈T∪R VC∈R∪P2; bowl C∈P2 VC∈T∪R∪P2) |
| **v2.1** | Chase defaults add `1-1-3` |
