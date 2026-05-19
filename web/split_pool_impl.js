/**
 * Split-pool generator (P1/P2/P3). Requires split_pool_catalog.js and app.js globals.
 * Patches generation when mode split_pool_p1p2p3 is selected.
 */
(function () {
  const STRATEGY_ID_SPLIT_POOL = "split_pool_p1p2p3";
  const SPLIT_POOL_STORAGE_KEY = "ipl2026_split_pools_v1";
  const SPLIT_POOL_ATTEMPTS_MULTIPLIER = 3;
  const DEFAULT_SPLIT_POOL_FULL_POOL_PCT = 50;

  function emptyFranchisePools() {
    return { p1: [], p2: [], p3: [] };
  }

  function ensureSplitPoolState() {
    if (!window.state.splitPools) {
      window.state.splitPools = {
        fixtureKey: "",
        teamA: emptyFranchisePools(),
        teamB: emptyFranchisePools(),
        fullPoolPercent: DEFAULT_SPLIT_POOL_FULL_POOL_PCT,
        reducedExcludeIds: [],
        lineupDupStages: [...(window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES || [0, 1, 2])],
      };
    }
    if (window.state.splitPools.fullPoolPercent == null) {
      window.state.splitPools.fullPoolPercent = DEFAULT_SPLIT_POOL_FULL_POOL_PCT;
    }
    if (!Array.isArray(window.state.splitPools.reducedExcludeIds)) {
      window.state.splitPools.reducedExcludeIds = [];
    }
    if (!Array.isArray(window.state.splitPools.lineupDupStages)) {
      window.state.splitPools.lineupDupStages = [...(window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES || [0, 1, 2])];
    }
  }

  function getSplitPoolLineupDupStagesFromUi() {
    const fn = window.iplSanitizeBatFirstLineupDupStages;
    const fallback = window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES || [0, 1, 2];
    return typeof fn === "function"
      ? fn([
          document.getElementById("splitPoolDupStage1Input")?.value ??
            window.state.splitPools.lineupDupStages?.[0],
          document.getElementById("splitPoolDupStage2Input")?.value ??
            window.state.splitPools.lineupDupStages?.[1],
          document.getElementById("splitPoolDupStage3Input")?.value ??
            window.state.splitPools.lineupDupStages?.[2],
        ])
      : fallback;
  }

  function applySplitPoolLineupDupStagesToUi(stages) {
    const fn = window.iplSanitizeBatFirstLineupDupStages;
    const s =
      typeof fn === "function"
        ? fn(stages)
        : window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES || [0, 1, 2];
    const ids = ["splitPoolDupStage1Input", "splitPoolDupStage2Input", "splitPoolDupStage3Input"];
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = String(s[i]);
      }
    });
    window.state.splitPools.lineupDupStages = [...s];
  }

  function getSplitPoolUnionIds() {
    const sp = window.state.splitPools;
    return [
      ...new Set([
        ...sp.teamA.p1,
        ...sp.teamA.p2,
        ...sp.teamA.p3,
        ...sp.teamB.p1,
        ...sp.teamB.p2,
        ...sp.teamB.p3,
      ]),
    ];
  }

  function getSplitPoolFullPoolPercentFromUi() {
    const el = document.getElementById("splitPoolFullPoolPctInput");
    let v = Number(el?.value ?? window.state.splitPools?.fullPoolPercent ?? DEFAULT_SPLIT_POOL_FULL_POOL_PCT);
    if (Number.isNaN(v)) {
      v = DEFAULT_SPLIT_POOL_FULL_POOL_PCT;
    }
    return Math.min(100, Math.max(0, Math.round(v)));
  }

  function applySplitPoolFullPoolPercentToUi(pct) {
    const el = document.getElementById("splitPoolFullPoolPctInput");
    const v = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)));
    if (el) {
      el.value = String(v);
    }
    window.state.splitPools.fullPoolPercent = v;
  }

  function filterSplitPoolIdList(ids, excludeSet) {
    if (!excludeSet || excludeSet.size === 0) {
      return ids;
    }
    return ids.filter((id) => !excludeSet.has(id));
  }

  function effectiveSplitPoolsForBuild(useReduced, excludeSet) {
    const sp = window.state.splitPools;
    if (!useReduced) {
      return sp;
    }
    return {
      teamA: {
        p1: filterSplitPoolIdList(sp.teamA.p1, excludeSet),
        p2: filterSplitPoolIdList(sp.teamA.p2, excludeSet),
        p3: filterSplitPoolIdList(sp.teamA.p3, excludeSet),
      },
      teamB: {
        p1: filterSplitPoolIdList(sp.teamB.p1, excludeSet),
        p2: filterSplitPoolIdList(sp.teamB.p2, excludeSet),
        p3: filterSplitPoolIdList(sp.teamB.p3, excludeSet),
      },
    };
  }

  function getSplitPoolFixtureKey() {
    const a = window.teamASelect?.value || "";
    const b = window.teamBSelect?.value || "";
    return a && b ? `${a}::${b}` : "";
  }

  function persistSplitPools() {
    ensureSplitPoolState();
    window.state.splitPools.fullPoolPercent = getSplitPoolFullPoolPercentFromUi();
    window.state.splitPools.lineupDupStages = getSplitPoolLineupDupStagesFromUi();
    const union = new Set(getSplitPoolUnionIds());
    if (typeof window.iplSanitizeBatReducedExcludeIds === "function") {
      window.state.splitPools.reducedExcludeIds = window.iplSanitizeBatReducedExcludeIds(
        window.state.splitPools.reducedExcludeIds,
        union
      );
    }
    try {
      localStorage.setItem(
        SPLIT_POOL_STORAGE_KEY,
        JSON.stringify({
          fixtureKey: window.state.splitPools.fixtureKey,
          teamA: window.state.splitPools.teamA,
          teamB: window.state.splitPools.teamB,
          fullPoolPercent: window.state.splitPools.fullPoolPercent,
          reducedExcludeIds: window.state.splitPools.reducedExcludeIds,
          lineupDupStages: window.state.splitPools.lineupDupStages,
        })
      );
    } catch (_e) {
      /* ignore quota */
    }
  }

  function loadSplitPoolsForFixture() {
    ensureSplitPoolState();
    const fk = getSplitPoolFixtureKey();
    if (!fk) {
      window.state.splitPools.fixtureKey = "";
      return;
    }
    try {
      const raw = localStorage.getItem(SPLIT_POOL_STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.fixtureKey === fk && o.teamA && o.teamB) {
          window.state.splitPools = {
            fixtureKey: fk,
            teamA: {
              p1: [...(o.teamA.p1 || [])],
              p2: [...(o.teamA.p2 || [])],
              p3: [...(o.teamA.p3 || [])],
            },
            teamB: {
              p1: [...(o.teamB.p1 || [])],
              p2: [...(o.teamB.p2 || [])],
              p3: [...(o.teamB.p3 || [])],
            },
            fullPoolPercent:
              o.fullPoolPercent != null && Number.isFinite(Number(o.fullPoolPercent))
                ? Math.min(100, Math.max(0, Math.round(Number(o.fullPoolPercent))))
                : DEFAULT_SPLIT_POOL_FULL_POOL_PCT,
            reducedExcludeIds: Array.isArray(o.reducedExcludeIds) ? [...o.reducedExcludeIds] : [],
            lineupDupStages:
              typeof window.iplSanitizeBatFirstLineupDupStages === "function"
                ? window.iplSanitizeBatFirstLineupDupStages(o.lineupDupStages)
                : [...(window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES || [0, 1, 2])],
          };
          const union = new Set(getSplitPoolUnionIds());
          if (typeof window.iplSanitizeBatReducedExcludeIds === "function") {
            window.state.splitPools.reducedExcludeIds = window.iplSanitizeBatReducedExcludeIds(
              window.state.splitPools.reducedExcludeIds,
              union
            );
          }
          applySplitPoolFullPoolPercentToUi(window.state.splitPools.fullPoolPercent);
          applySplitPoolLineupDupStagesToUi(window.state.splitPools.lineupDupStages);
          return;
        }
      }
    } catch (_e) {
      /* ignore */
    }
    window.state.splitPools.fixtureKey = fk;
    window.state.splitPools.teamA = emptyFranchisePools();
    window.state.splitPools.teamB = emptyFranchisePools();
    window.state.splitPools.fullPoolPercent = DEFAULT_SPLIT_POOL_FULL_POOL_PCT;
    window.state.splitPools.reducedExcludeIds = [];
    applySplitPoolFullPoolPercentToUi(DEFAULT_SPLIT_POOL_FULL_POOL_PCT);
    applySplitPoolLineupDupStagesToUi(window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES || [0, 1, 2]);
  }

  function syncSplitPoolsWithSelection() {
    ensureSplitPoolState();
    const sel = window.state.selectedPlayers;
    ["teamA", "teamB"].forEach((side) => {
      ["p1", "p2", "p3"].forEach((pk) => {
        window.state.splitPools[side][pk] = window.state.splitPools[side][pk].filter((id) => sel.has(id));
      });
    });
  }

  function franchiseSideForTeam(teamName) {
    const a = window.teamASelect?.value || "";
    if (teamName === a) {
      return "teamA";
    }
    return "teamB";
  }

  function movePlayerToSplitPool(playerId, side, poolKey) {
    ensureSplitPoolState();
    ["teamA", "teamB"].forEach((s) => {
      ["p1", "p2", "p3"].forEach((pk) => {
        window.state.splitPools[s][pk] = window.state.splitPools[s][pk].filter((id) => id !== playerId);
      });
    });
    if (side === "teamA" || side === "teamB") {
      if (poolKey === "p1" || poolKey === "p2" || poolKey === "p3") {
        window.state.splitPools[side][poolKey].push(playerId);
      }
    }
    persistSplitPools();
    renderSplitPoolPanel();
  }

  function autoFillSplitPoolsFromSelection() {
    const sel = [...window.state.selectedPlayers];
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    const pools = { teamA: emptyFranchisePools(), teamB: emptyFranchisePools() };
    sel.forEach((id) => {
      const sep = id.indexOf("::");
      const team = sep >= 0 ? id.slice(0, sep) : "";
      const player = sep >= 0 ? id.slice(sep + 2) : "";
      if (!team || !player) {
        return;
      }
      const side = team === teamA ? "teamA" : team === teamB ? "teamB" : null;
      if (!side) {
        return;
      }
      if (window.iplIsRawBowlOrArProfile(team, player)) {
        pools[side].p3.push(id);
      } else if (window.iplGetRawProfileRole(team, player) === "wicket_keeper") {
        pools[side].p1.push(id);
      } else {
        pools[side].p2.push(id);
      }
    });
    window.state.splitPools.fixtureKey = getSplitPoolFixtureKey();
    window.state.splitPools.teamA = pools.teamA;
    window.state.splitPools.teamB = pools.teamB;
    persistSplitPools();
    renderSplitPoolPanel();
  }

  function formatSplitPoolHintLine() {
    const sp = window.state.splitPools;
    const na = sp.teamA.p1.length + sp.teamA.p2.length + sp.teamA.p3.length;
    const nb = sp.teamB.p1.length + sp.teamB.p2.length + sp.teamB.p3.length;
    const nTeams = Number(document.getElementById("teamsPerStrategyInput")?.value) || 80;
    const fullPct = getSplitPoolFullPoolPercentFromUi();
    const nFull = window.iplComputeBatFirstFullPoolTeamCount(nTeams, fullPct);
    const nRed = Math.max(0, nTeams - nFull);
    const union = new Set(getSplitPoolUnionIds());
    const exSet = new Set(
      window.iplSanitizeBatReducedExcludeIds(sp.reducedExcludeIds, union)
    );
    const n1r = sp.teamA.p1.filter((id) => !exSet.has(id)).length;
    const n2r = sp.teamA.p2.filter((id) => !exSet.has(id)).length;
    const n3r = sp.teamA.p3.filter((id) => !exSet.has(id)).length;
    const m1r = sp.teamB.p1.filter((id) => !exSet.has(id)).length;
    const m2r = sp.teamB.p2.filter((id) => !exSet.has(id)).length;
    const m3r = sp.teamB.p3.filter((id) => !exSet.has(id)).length;
    const poolNote = `Team A P1/P2/P3 ${sp.teamA.p1.length}/${sp.teamA.p2.length}/${sp.teamA.p3.length}; Team B ${sp.teamB.p1.length}/${sp.teamB.p2.length}/${sp.teamB.p3.length}.`;
    const redNote =
      exSet.size > 0 || nRed > 0
        ? ` Full ${nFull} (~${fullPct}%), reduced ${nRed} (A ${n1r}+${n2r}+${n3r}, B ${m1r}+${m2r}+${m3r} after ${exSet.size} excl.).`
        : ` All ${nTeams} use full pools.`;
    const dup = getSplitPoolLineupDupStagesFromUi();
    const dupNote = dup.length ? ` Same-XI extra slots/pass: [${dup.join(", ")}].` : "";
    return `${poolNote} Lineup C1→C2→C3→C4; C/VC pools use the same profile id.${redNote}${dupNote}`;
  }

  function renderSplitPoolReducedExcludePanel() {
    const host = document.getElementById("splitPoolReducedExcludeHost");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    const head = document.createElement("h4");
    head.className = "bat-first-reduced-heading";
    head.textContent = "Reduced-pool exclusions (optional)";
    host.appendChild(head);
    const sub = document.createElement("p");
    sub.className = "subtitle bat-first-reduced-sub";
    sub.innerHTML =
      "For teams after the <strong>full pool %</strong> cutoff, tick players to remove from <strong>P1, P2, and P3</strong> on both franchises.";
    host.appendChild(sub);
    const ids = getSplitPoolUnionIds().sort((a, b) => {
      const pa = a.split("::")[1] || a;
      const pb = b.split("::")[1] || b;
      return pa.localeCompare(pb);
    });
    const union = new Set(ids);
    const exSet = new Set(
      window.iplSanitizeBatReducedExcludeIds(window.state.splitPools.reducedExcludeIds, union)
    );
    const grid = document.createElement("div");
    grid.className = "bat-first-reduced-grid";
    if (!ids.length) {
      const empty = document.createElement("p");
      empty.className = "subtitle";
      empty.textContent = "Fill split pools (Auto-fill) to choose exclusions.";
      grid.appendChild(empty);
    }
    ids.forEach((id) => {
      const sep = id.indexOf("::");
      const player = sep >= 0 ? id.slice(sep + 2) : id;
      const team = sep >= 0 ? id.slice(0, sep) : "";
      const label = document.createElement("label");
      label.className = "bat-first-reduced-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = exSet.has(id);
      cb.addEventListener("change", () => {
        const u = new Set(getSplitPoolUnionIds());
        const next = new Set(
          window.iplSanitizeBatReducedExcludeIds(window.state.splitPools.reducedExcludeIds, u)
        );
        if (cb.checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        window.state.splitPools.reducedExcludeIds = [...next];
        persistSplitPools();
        const hint = document.getElementById("splitPoolHint");
        if (hint) {
          hint.textContent = formatSplitPoolHintLine();
        }
      });
      const span = document.createElement("span");
      span.textContent = `${player}${team ? ` (${team})` : ""}`;
      label.appendChild(cb);
      label.appendChild(span);
      grid.appendChild(label);
    });
    host.appendChild(grid);
  }

  function renderSplitPoolPanel() {
    const grid = document.getElementById("splitPoolGrid");
    const hint = document.getElementById("splitPoolHint");
    if (!grid) {
      return;
    }
    loadSplitPoolsForFixture();
    syncSplitPoolsWithSelection();
    grid.innerHTML = "";
    const teamAName = window.teamASelect?.value || "Team A";
    const teamBName = window.teamBSelect?.value || "Team B";
    const blocks = [
      { side: "teamA", label: teamAName, keys: ["p1", "p2", "p3"], titles: ["P1 tops", "P2 middle", "P3 bowl/AR"] },
      { side: "teamB", label: teamBName, keys: ["p1", "p2", "p3"], titles: ["P1 tops", "P2 middle", "P3 bowl/AR"] },
    ];
    blocks.forEach(({ side, label, keys, titles }) => {
      const franchiseWrap = document.createElement("div");
      franchiseWrap.className = "split-pool-franchise";
      const fh = document.createElement("h4");
      fh.className = "split-pool-franchise-title";
      fh.textContent = label;
      franchiseWrap.appendChild(fh);
      const row = document.createElement("div");
      row.className = "split-pool-franchise-row";
      keys.forEach((pk, i) => {
        const wrap = document.createElement("div");
        wrap.className = "bat-pool-column";
        const h = document.createElement("h4");
        h.textContent = titles[i];
        wrap.appendChild(h);
        const ul = document.createElement("ul");
        ul.className = "bat-pool-list";
        window.state.splitPools[side][pk].forEach((id) => {
          const sep = id.indexOf("::");
          const player = sep >= 0 ? id.slice(sep + 2) : id;
          const li = document.createElement("li");
          li.className = "bat-pool-item";
          const meta = document.createElement("span");
          meta.className = "bat-pool-item-meta";
          meta.textContent = window.state.selectedPlayers.has(id) ? player : `${player} — not ticked`;
          const moves = document.createElement("div");
          moves.className = "bat-pool-moves";
          ["p1", "p2", "p3"].forEach((dest) => {
            if (dest === pk) {
              return;
            }
            const b = document.createElement("button");
            b.type = "button";
            b.className = "bat-pool-move-btn";
            b.textContent = dest.toUpperCase();
            b.addEventListener("click", () => movePlayerToSplitPool(id, side, dest));
            moves.appendChild(b);
          });
          const otherSide = side === "teamA" ? "teamB" : "teamA";
          const bx = document.createElement("button");
          bx.type = "button";
          bx.className = "bat-pool-move-btn";
          bx.textContent = side === "teamA" ? "→B" : "→A";
          bx.title = `Move to ${otherSide === "teamA" ? teamAName : teamBName} P1`;
          bx.addEventListener("click", () => movePlayerToSplitPool(id, otherSide, "p1"));
          moves.appendChild(bx);
          li.appendChild(meta);
          li.appendChild(moves);
          ul.appendChild(li);
        });
        wrap.appendChild(ul);
        row.appendChild(wrap);
      });
      franchiseWrap.appendChild(row);
      grid.appendChild(franchiseWrap);
    });
    renderSplitPoolReducedExcludePanel();
    if (hint) {
      hint.textContent = formatSplitPoolHintLine();
    }
  }

  function getSplitPoolOnlyBlockers() {
    syncSplitPoolsWithSelection();
    const reasons = [];
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    if (!teamA || !teamB) {
      reasons.push("Select both teams for split-pool mode.");
    }
    const ticked = window.state.selectedPlayers.size;
    if (ticked < 11) {
      reasons.push("Select at least 11 ticked players for split-pool mode.");
    }
    ["teamA", "teamB"].forEach((side, idx) => {
      const label = idx === 0 ? teamA : teamB;
      const p = window.state.splitPools[side];
      const n = p.p1.length + p.p2.length + p.p3.length;
      if (n < 4) {
        reasons.push(`${label || side}: need at least 4 players assigned to P1/P2/P3 pools.`);
      }
      if (p.p3.length < 1) {
        reasons.push(`${label || side}: need at least 1 player in P3.`);
      }
    });
    const cat = window.SplitPoolCatalog;
    if (!cat) {
      reasons.push("Split-pool catalog failed to load (split_pool_catalog.js).");
    }
    return reasons;
  }

  function rowsFromPoolIds(ids, keyToRow) {
    return ids.map((id) => keyToRow.get(id)).filter(Boolean);
  }

  function pickSplitPoolSubset(rows, k, appearanceCounts, tuning) {
    if (k <= 0) {
      return [];
    }
    if (!rows.length || rows.length < k) {
      return null;
    }
    if (rows.length === k) {
      return [...rows];
    }
    const fn = window.iplPickWeightedPoolSubset;
    if (typeof fn === "function") {
      return fn(rows, k, appearanceCounts, tuning);
    }
    const copy = [...rows];
    const out = [];
    for (let i = 0; i < k; i += 1) {
      const j = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(j, 1)[0]);
    }
    return out;
  }

  function fillP3Slots(teamName, pCount, needAr, poolIds, keyToRow, appearanceCounts, tuning) {
    if (pCount <= 0) {
      return [];
    }
    const rows = rowsFromPoolIds(poolIds, keyToRow).filter((r) => r.team === teamName);
    const arRows = rows.filter((r) => window.iplGetRawProfileRole(r.team, r.player) === "all_rounder");
    const bowlRows = rows.filter((r) => window.iplGetRawProfileRole(r.team, r.player) === "bowler");
    if (arRows.length + bowlRows.length < pCount) {
      return null;
    }
    const arPick = pickSplitPoolSubset(arRows, needAr, appearanceCounts, tuning);
    const bowlPick = pickSplitPoolSubset(bowlRows, pCount - needAr, appearanceCounts, tuning);
    if (!arPick || !bowlPick || arPick.length + bowlPick.length !== pCount) {
      return null;
    }
    return [...arPick, ...bowlPick];
  }

  function pickP3ForPair(pair, keyToRow, appearanceCounts, tuning, sp) {
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    const needAr = window.SplitPoolCatalog.arStar(pair.pA, pair.pB);
    const maxArA = Math.min(pair.pA, needAr);
    const order = [];
    for (let arA = 0; arA <= maxArA; arA += 1) {
      order.push(arA);
    }
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const arA of order) {
      const arB = needAr - arA;
      if (arB < 0 || arB > pair.pB) {
        continue;
      }
      const p3A = fillP3Slots(teamA, pair.pA, arA, sp.teamA.p3, keyToRow, appearanceCounts, tuning);
      const p3B = fillP3Slots(teamB, pair.pB, arB, sp.teamB.p3, keyToRow, appearanceCounts, tuning);
      if (p3A && p3B) {
        return { p3A, p3B };
      }
    }
    return null;
  }

  function buildXiFromPair(pair, keyToRow, appearanceCounts, tuning, poolOpts) {
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    const sp = effectiveSplitPoolsForBuild(poolOpts?.useReduced, poolOpts?.excludeSet);
    const p3 = pickP3ForPair(pair, keyToRow, appearanceCounts, tuning, sp);
    if (!p3) {
      return { error: "p3_fill" };
    }
    const p1A = pickSplitPoolSubset(
      rowsFromPoolIds(sp.teamA.p1, keyToRow).filter((r) => r.team === teamA),
      pair.tA,
      appearanceCounts,
      tuning
    );
    const p2A = pickSplitPoolSubset(
      rowsFromPoolIds(sp.teamA.p2, keyToRow).filter((r) => r.team === teamA),
      pair.rA,
      appearanceCounts,
      tuning
    );
    const p1B = pickSplitPoolSubset(
      rowsFromPoolIds(sp.teamB.p1, keyToRow).filter((r) => r.team === teamB),
      pair.tB,
      appearanceCounts,
      tuning
    );
    const p2B = pickSplitPoolSubset(
      rowsFromPoolIds(sp.teamB.p2, keyToRow).filter((r) => r.team === teamB),
      pair.rB,
      appearanceCounts,
      tuning
    );
    if (!p1A || !p2A || !p1B || !p2B) {
      return { error: "p1p2_fill" };
    }
    return { team: [...p1A, ...p2A, ...p3.p3A, ...p1B, ...p2B, ...p3.p3B] };
  }

  function generateSplitPoolTeamsForStrategy(
    pool,
    numTeams,
    seenKeys,
    recentLineupState,
    appearanceCounts,
    tuning,
    cvFair
  ) {
    const cat = window.SplitPoolCatalog;
    const counts = appearanceCounts || new Map();
    const t = tuning || window.DEFAULT_GENERATOR_TUNING;
    const keyToRow = window.iplMakeRowLookupByKey(pool);
    const teams = [];
    const profileCounts = { C1: 0, C2: 0, C3: 0, C4: 0 };
    const fullPoolTeamCount = window.iplComputeBatFirstFullPoolTeamCount(
      numTeams,
      getSplitPoolFullPoolPercentFromUi()
    );
    const poolUnion = new Set(getSplitPoolUnionIds());
    const excludePlayerSet = new Set(
      typeof window.iplSanitizeBatReducedExcludeIds === "function"
        ? window.iplSanitizeBatReducedExcludeIds(window.state.splitPools.reducedExcludeIds, poolUnion)
        : []
    );
    const lineupDupAllowanceStages = getSplitPoolLineupDupStagesFromUi();
    const lineupAcceptCounts = new Map();
    let attempts = 0;
    const hardAttemptCap = numTeams * window.ATTEMPTS_MULTIPLIER * SPLIT_POOL_ATTEMPTS_MULTIPLIER;
    const verboseLog = Boolean(document.getElementById("splitPoolVerboseLogCheckbox")?.checked);
    const rejectStats = {
      no_pair: 0,
      pair_psum: 0,
      pair_t33: 0,
      p3_fill: 0,
      p1p2_fill: 0,
      overlap_keys: 0,
      cvc_none: 0,
      dedupe_collision: 0,
      lineup_cooldown: 0,
      lineup_dup_cap: 0,
    };
    const invalidXiCounts = {};
    const rejectSamples = [];
    const maxRejectSamples = 35;
    const stageReports = [];
    const cvPairCounts = new Map();

    function recordSplitReject(code, extra = {}) {
      if (String(code).startsWith("xi_")) {
        invalidXiCounts[code] = (invalidXiCounts[code] || 0) + 1;
      } else if (rejectStats[code] != null) {
        rejectStats[code] += 1;
      }
      if (verboseLog && rejectSamples.length < maxRejectSamples) {
        rejectSamples.push({ code, ...extra });
      }
    }

    for (let stageIdx = 0; stageIdx < lineupDupAllowanceStages.length && teams.length < numTeams; stageIdx += 1) {
      const maxDupPerXi = lineupDupAllowanceStages[stageIdx];
      const maxEntriesPerXi = 1 + maxDupPerXi;
      let attemptsInStage = 0;
      const acceptedBeforeStage = teams.length;
      while (teams.length < numTeams && attemptsInStage < hardAttemptCap) {
        attempts += 1;
        attemptsInStage += 1;
        const profileId = cat.profileAtTeamIndex(teams.length);
        const segKey = cat.segmentForProfileTeam(profileId, profileCounts[profileId]);
        const pair = cat.pickPair(profileId, segKey);
        const pairLabel = pair ? `${pair.a}|${pair.b}` : "";
        if (!pair) {
          recordSplitReject("no_pair", { profileId, segKey, stage: maxDupPerXi });
          continue;
        }
        const prof = cat.PROFILES[profileId];
        if (prof.pSumMax != null && pair.pA + pair.pB > prof.pSumMax) {
          recordSplitReject("pair_psum", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        if (pair.tA === 3 && pair.tB === 3) {
          recordSplitReject("pair_t33", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        const useReduced = teams.length >= fullPoolTeamCount;
        const built = buildXiFromPair(pair, keyToRow, counts, t, {
          useReduced,
          excludeSet: excludePlayerSet,
        });
        if (built.error) {
          recordSplitReject(built.error, { profileId, segKey, pair: pairLabel, stage: maxDupPerXi, reduced: useReduced });
          continue;
        }
        const team = built.team;
        if (!team || team.length !== 11) {
          recordSplitReject("p1p2_fill", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi, gotLen: team?.length });
          continue;
        }
        const uniq = new Set(team.map(window.iplPoolPlayerKey));
        if (uniq.size !== 11) {
          recordSplitReject("overlap_keys", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        if (!window.iplIsValidGeneratedTeam(team)) {
          const xr =
            (typeof window.iplExplainInvalidGeneratedTeam === "function" &&
              window.iplExplainInvalidGeneratedTeam(team)) ||
            "xi_unknown";
          recordSplitReject(xr, { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        const scenarioId = profileId;
        const playersOut = team.map((row) => ({
          team: row.team,
          player: row.player,
          role: row.role,
        }));
        const lineupKey = window.iplBuildLineupOnlyKey(playersOut);
        if (window.iplIsLineupInCooldown(recentLineupState, lineupKey)) {
          recordSplitReject("lineup_cooldown", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        const lineupUsed = lineupAcceptCounts.get(lineupKey) || 0;
        if (lineupUsed >= maxEntriesPerXi) {
          recordSplitReject("lineup_dup_cap", {
            profileId,
            segKey,
            pair: pairLabel,
            stage: maxDupPerXi,
            lineupUsed,
            maxEntriesPerXi,
          });
          continue;
        }
        const cvc = window.iplChooseCaptainViceCaptain(team, t, cvFair, scenarioId, { seenKeys, playersOut }, {
          counts: cvPairCounts,
        });
        if (!cvc) {
          recordSplitReject("cvc_none", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        const { captain, viceCaptain } = cvc;
        const key = window.iplBuildTeamUniquenessKey(playersOut, captain, viceCaptain);
        if (seenKeys.has(key)) {
          recordSplitReject("dedupe_collision", {
            profileId,
            segKey,
            pair: pairLabel,
            stage: maxDupPerXi,
            captain,
            viceCaptain,
          });
          continue;
        }
        seenKeys.add(key);
        lineupAcceptCounts.set(lineupKey, lineupUsed + 1);
        window.iplRecordAcceptedLineup(recentLineupState, lineupKey);
        window.iplIncrementCvPairAcceptCounts(cvPairCounts, scenarioId, captain, viceCaptain, team);
        team.forEach((row) => {
          const k = window.iplPoolPlayerKey(row);
          counts.set(k, (counts.get(k) || 0) + 1);
        });
        profileCounts[profileId] += 1;
        teams.push({
          strategy: STRATEGY_ID_SPLIT_POOL,
          splitProfile: profileId,
          splitSegment: segKey,
          splitPair: pairLabel,
          highScoreScenario: scenarioId,
          players: playersOut,
          captain,
          viceCaptain,
        });
      }
      stageReports.push({
        stage: maxDupPerXi,
        maxEntriesPerXi,
        attempts: attemptsInStage,
        accepted: teams.length - acceptedBeforeStage,
        exhausted: attemptsInStage >= hardAttemptCap,
      });
    }

    if (verboseLog) {
      console.info("[split_pool_p1p2p3] reject summary", {
        attempts,
        accepted: teams.length,
        rejectStats,
        invalidXiCounts,
        stageReports,
      });
      if (rejectSamples.length) {
        console.info("[split_pool_p1p2p3] reject samples", rejectSamples);
      }
    }

    const rejectReport = {
      attempts,
      accepted: teams.length,
      rejectStats: { ...rejectStats },
      invalidXiCounts: { ...invalidXiCounts },
      samples: [...rejectSamples],
      verbose: verboseLog,
      stagedDupPolicy: [...stageReports],
      lineupDupStagesConfigured: [...lineupDupAllowanceStages],
      profileCounts: { ...profileCounts },
      teamsFromFullPool: fullPoolTeamCount,
      teamsFromReducedPool: Math.max(0, numTeams - fullPoolTeamCount),
      reducedExcludeCount: excludePlayerSet.size,
    };

    return {
      teams,
      targetTeams: numTeams,
      minFillMet: teams.length >= Math.floor(numTeams * window.HIGH_SCORING_MIN_QUOTA_FRAC),
      fullTargetMet: teams.length >= numTeams,
      attempts,
      splitPoolMeta: {
        rejectStats,
        profileCounts,
        teamsFromFullPool: fullPoolTeamCount,
        teamsFromReducedPool: Math.max(0, numTeams - fullPoolTeamCount),
        reducedExcludeCount: excludePlayerSet.size,
        rejectReport,
      },
    };
  }

  window.IPL_SPLIT_POOL = {
    STRATEGY_ID: STRATEGY_ID_SPLIT_POOL,
    ensureSplitPoolState,
    loadSplitPoolsForFixture,
    persistSplitPools,
    syncSplitPoolsWithSelection,
    renderSplitPoolPanel,
    autoFillSplitPoolsFromSelection,
    getSplitPoolOnlyBlockers,
    generateSplitPoolTeamsForStrategy,
    getSplitPoolFullPoolPercentFromUi,
    SPLIT_POOL_ATTEMPTS_MULTIPLIER,
    DEFAULT_SPLIT_POOL_FULL_POOL_PCT,
  };
})();
