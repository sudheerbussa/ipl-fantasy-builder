/**
 * Split-pool generator (P1/P2/P3). Requires split_pool_catalog.js and app.js globals.
 * Patches generation when mode split_pool_p1p2p3 is selected.
 */
(function () {
  const STRATEGY_ID_SPLIT_POOL = "split_pool_p1p2p3";
  const SPLIT_POOL_STORAGE_KEY = "ipl2026_split_pools_v1";
  const SPLIT_POOL_ATTEMPTS_MULTIPLIER = 3;
  const DEFAULT_SPLIT_POOL_FULL_POOL_PCT = 50;
  const SPLIT_PROFILE_PCT_INPUT_IDS = {
    C1: "splitPoolProfileC1PctInput",
    C2: "splitPoolProfileC2PctInput",
    C3: "splitPoolProfileC3PctInput",
    C4: "splitPoolProfileC4PctInput",
  };

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
        profilePercents: {
          ...(window.SplitPoolCatalog?.DEFAULT_SPLIT_PROFILE_PERCENTS || {
            C1: 25,
            C2: 25,
            C3: 25,
            C4: 25,
          }),
        },
        reducedExcludeIds: [],
        lineupDupStages: [...(window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES || [0, 1, 2])],
      };
    }
    if (!window.state.splitPools.profilePercents) {
      window.state.splitPools.profilePercents = {
        ...(window.SplitPoolCatalog?.DEFAULT_SPLIT_PROFILE_PERCENTS || {
          C1: 25,
          C2: 25,
          C3: 25,
          C4: 25,
        }),
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

  function migrateSplitProfilePercents(raw) {
    const cat = window.SplitPoolCatalog;
    const fallback = cat?.DEFAULT_SPLIT_PROFILE_PERCENTS || { C1: 25, C2: 25, C3: 25, C4: 25 };
    if (raw && typeof raw === "object") {
      return cat?.sanitizeSplitProfilePercents
        ? cat.sanitizeSplitProfilePercents(raw, fallback)
        : fallback;
    }
    return { ...fallback };
  }

  function getSplitPoolProfilePercentsFromUi() {
    const cat = window.SplitPoolCatalog;
    const fallback =
      window.state.splitPools?.profilePercents ||
      cat?.DEFAULT_SPLIT_PROFILE_PERCENTS || { C1: 25, C2: 25, C3: 25, C4: 25 };
    const raw = {};
    (cat?.PROFILE_ORDER || ["C1", "C2", "C3", "C4"]).forEach((id) => {
      const el = document.getElementById(SPLIT_PROFILE_PCT_INPUT_IDS[id]);
      raw[id] = el?.value ?? fallback[id];
    });
    return cat?.sanitizeSplitProfilePercents
      ? cat.sanitizeSplitProfilePercents(raw, fallback)
      : fallback;
  }

  function applySplitPoolProfilePercentsToUi(percents) {
    const cat = window.SplitPoolCatalog;
    const p = migrateSplitProfilePercents(percents);
    (cat?.PROFILE_ORDER || ["C1", "C2", "C3", "C4"]).forEach((id) => {
      const el = document.getElementById(SPLIT_PROFILE_PCT_INPUT_IDS[id]);
      if (el) {
        el.value = String(Math.round(p[id]));
      }
    });
    window.state.splitPools.profilePercents = { ...p };
  }

  function formatSplitProfilePercentSummary(numTeams) {
    const cat = window.SplitPoolCatalog;
    const p = getSplitPoolProfilePercentsFromUi();
    const pctLine = (cat?.PROFILE_ORDER || ["C1", "C2", "C3", "C4"])
      .map((id) => `${id} ${Math.round(p[id])}%`)
      .join(" · ");
    const nTeams = Math.max(0, Math.floor(Number(numTeams) || 0));
    if (!nTeams || !cat?.computeSplitProfileEnds) {
      return pctLine;
    }
    const plan = cat.buildSplitProfileRoundRobinSequence
      ? cat.buildSplitProfileRoundRobinSequence(nTeams, p)
      : cat.computeSplitProfileEnds(nTeams, p);
    const countLine = (cat.PROFILE_ORDER || ["C1", "C2", "C3", "C4"])
      .map((id) => `${id} ${plan.counts[id] || 0}`)
      .join(" · ");
    const previewLen = Math.min(16, nTeams);
    const orderPreview = (plan.sequence || []).slice(0, previewLen).join("→");
    const orderNote = orderPreview
      ? `; round-robin order: ${orderPreview}${nTeams > previewLen ? "…" : ""}`
      : "";
    return `${pctLine} (normalized to 100%) → ${countLine}${orderNote}`;
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
    window.state.splitPools.profilePercents = getSplitPoolProfilePercentsFromUi();
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
          profilePercents: window.state.splitPools.profilePercents,
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
            profilePercents: migrateSplitProfilePercents(o.profilePercents),
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
          applySplitPoolProfilePercentsToUi(window.state.splitPools.profilePercents);
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
    window.state.splitPools.profilePercents = migrateSplitProfilePercents(null);
    window.state.splitPools.reducedExcludeIds = [];
    applySplitPoolFullPoolPercentToUi(DEFAULT_SPLIT_POOL_FULL_POOL_PCT);
    applySplitPoolProfilePercentsToUi(window.state.splitPools.profilePercents);
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
    const profNote = ` Profile mix (round-robin C1→C2→C3→C4): ${formatSplitProfilePercentSummary(nTeams)}; C/VC pools use the same profile id.`;
    return `${poolNote}${profNote}${redNote}${dupNote}`;
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
    if (!getSplitPoolFixtureKey()) {
      applySplitPoolProfilePercentsToUi(window.state.splitPools.profilePercents);
    }
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
      return reasons;
    }
    if (!teamA || !teamB) {
      return reasons;
    }
    let wk = 0;
    let bat = 0;
    let profileAr = 0;
    let bowl = 0;
    const countRoles = (side, franchise) => {
      ["p1", "p2", "p3"].forEach((pk) => {
        window.state.splitPools[side][pk].forEach((id) => {
          const sep = id.indexOf("::");
          const tn = sep >= 0 ? id.slice(0, sep) : "";
          const pl = sep >= 0 ? id.slice(sep + 2) : "";
          if (tn !== franchise || !pl) {
            return;
          }
          const raw = window.iplGetRawProfileRole(tn, pl);
          if (raw === "wicket_keeper") {
            wk += 1;
          }
          if (raw === "batsman") {
            bat += 1;
          }
          if (raw === "all_rounder") {
            profileAr += 1;
          }
          if (raw === "bowler") {
            bowl += 1;
          }
        });
      });
    };
    countRoles("teamA", teamA);
    countRoles("teamB", teamB);
    if (wk < 1) {
      reasons.push("Split pools: need at least 1 wicket-keeper (usually in P1).");
    }
    if (bat < 1) {
      reasons.push("Split pools: need at least 1 batsman in P1/P2.");
    }
    if (profileAr < 1) {
      reasons.push("Split pools: need at least 1 all-rounder (P3 or moved from P3).");
    }
    if (bowl < 1) {
      reasons.push("Split pools: need at least 1 bowler in P3.");
    }
    const teamAName = window.teamASelect?.value || "";
    const teamBName = window.teamBSelect?.value || "";
    const poolForCheck =
      typeof window.iplBuildGeneratorPoolForMode === "function"
        ? window.iplBuildGeneratorPoolForMode(STRATEGY_ID_SPLIT_POOL)
        : [];
    const keyToRow = window.iplMakeRowLookupByKey(poolForCheck);
    const sp = window.state.splitPools;
    const feasible = buildFeasiblePairMap(cat, sp, teamAName, teamBName, keyToRow);
    const counts = summarizeFeasiblePairs(feasible);
    (cat.PROFILE_ORDER || ["C1", "C2", "C3", "C4"]).forEach((id) => {
      if ((counts[id] || 0) === 0) {
        reasons.push(
          `${id}: no triplet pair fits your P1/P2/P3 pools (per-pool counts and unique players per franchise). C4 needs many picks from P2+P3 on the same side — avoid listing the same player in both P2 and P3.`
        );
      }
    });
    const cross = splitPoolCrossPoolDuplicates(sp);
    if (cross.length) {
      reasons.push(
        `Split pools: ${cross.length} player(s) appear in more than one pool on the same franchise (e.g. P2+P3). C4 needs 5–6 unique names per side — move each player to a single pool.`
      );
    }
    const poolForKeys =
      typeof window.iplBuildGeneratorPoolForMode === "function"
        ? window.iplBuildGeneratorPoolForMode(STRATEGY_ID_SPLIT_POOL)
        : [];
    const keyToRowBlock = window.iplMakeRowLookupByKey(poolForKeys);
    const crossKeys = splitPoolCrossPoolKeyDuplicates(sp, keyToRowBlock);
    if (crossKeys.length) {
      reasons.push(
        `Split pools: ${crossKeys.length} player(s) are assigned to multiple pools under different ids (same person in P1 and P2). C4 needs 3 separate P2 picks after P1 — use one pool per player (move buttons).`
      );
    }
    return reasons;
  }

  function rowsFromPoolIds(ids, keyToRow) {
    return ids.map((id) => keyToRow.get(id)).filter(Boolean);
  }

  function franchisePoolRows(sp, side, poolKey, franchise, keyToRow) {
    const seen = new Set();
    const out = [];
    rowsFromPoolIds(sp[side][poolKey], keyToRow)
      .filter((r) => r.team === franchise)
      .forEach((r) => {
        const k = window.iplPoolPlayerKey(r);
        if (seen.has(k)) {
          return;
        }
        seen.add(k);
        out.push(r);
      });
    return out;
  }

  /** Unique ticked players across P1+P2+P3 on one franchise (same id in two pools counts once). */
  function uniqueFranchisePoolCount(sp, side, franchise, keyToRow) {
    const seen = new Set();
    ["p1", "p2", "p3"].forEach((poolKey) => {
      franchisePoolRows(sp, side, poolKey, franchise, keyToRow).forEach((r) => {
        seen.add(window.iplPoolPlayerKey(r));
      });
    });
    return seen.size;
  }

  function pairMeetsUniqueXiCapacity(pair, sp, teamA, teamB, keyToRow) {
    const needA = pair.tA + pair.rA + pair.pA;
    const needB = pair.tB + pair.rB + pair.pB;
    return (
      uniqueFranchisePoolCount(sp, "teamA", teamA, keyToRow) >= needA &&
      uniqueFranchisePoolCount(sp, "teamB", teamB, keyToRow) >= needB
    );
  }

  function franchisePoolKeySet(sp, side, poolKey, franchise, keyToRow) {
    const keys = new Set();
    franchisePoolRows(sp, side, poolKey, franchise, keyToRow).forEach((r) => {
      keys.add(window.iplPoolPlayerKey(r));
    });
    return keys;
  }

  /**
   * P1 is filled before P2 on each franchise; picks must be distinct player keys.
   * Per-pool counts alone are insufficient when the same name is in P1 and P2 (different ids).
   */
  function sideMeetsSequentialP1P2(sp, side, franchise, keyToRow, tNeed, rNeed) {
    const t = Math.max(0, Math.floor(Number(tNeed) || 0));
    const r = Math.max(0, Math.floor(Number(rNeed) || 0));
    if (r <= 0) {
      return t <= 0 || franchisePoolRows(sp, side, "p1", franchise, keyToRow).length >= t;
    }
    if (t <= 0) {
      return franchisePoolRows(sp, side, "p2", franchise, keyToRow).length >= r;
    }
    const p1Keys = franchisePoolKeySet(sp, side, "p1", franchise, keyToRow);
    const p2Keys = [...franchisePoolKeySet(sp, side, "p2", franchise, keyToRow)];
    if (p1Keys.size < t || p2Keys.length < r) {
      return false;
    }
    const union = new Set([...p1Keys, ...p2Keys]);
    if (union.size < t + r) {
      return false;
    }
    const overlap = p2Keys.filter((k) => p1Keys.has(k)).length;
    const maxP2Loss = Math.min(t, overlap);
    return p2Keys.length - maxP2Loss >= r;
  }

  /** Nominal P1/P2 capacity (per-pool counts + sequential distinct-key fill). */
  function pairMeetsP1P2Capacity(pair, sp, teamA, teamB, keyToRow) {
    return (
      sideMeetsSequentialP1P2(sp, "teamA", teamA, keyToRow, pair.tA, pair.rA) &&
      sideMeetsSequentialP1P2(sp, "teamB", teamB, keyToRow, pair.tB, pair.rB)
    );
  }

  /** Nominal P3 capacity (bowler + AR counts) for a pair. */
  function pairMeetsP3Capacity(pair, sp, teamA, teamB, keyToRow) {
    const cat = window.SplitPoolCatalog;
    const needAr = Math.max(
      cat.arStar(pair.pA, pair.pB),
      minProfileArForXi(pair, sp, keyToRow)
    );
    let arBudget = needAr;
    const sides = [
      { side: "teamA", franchise: teamA, p: pair.pA },
      { side: "teamB", franchise: teamB, p: pair.pB },
    ];
    for (const { side, franchise, p } of sides) {
      if (p <= 0) {
        continue;
      }
      const rows = franchisePoolRows(sp, side, "p3", franchise, keyToRow);
      const ar = rows.filter(
        (r) => window.iplGetRawProfileRole(r.team, r.player) === "all_rounder"
      ).length;
      const bowl = rows.filter(
        (r) => window.iplGetRawProfileRole(r.team, r.player) === "bowler"
      ).length;
      if (rows.length < p) {
        return false;
      }
      const arTake = Math.min(ar, arBudget, p);
      arBudget -= arTake;
      if (p - arTake > bowl) {
        return false;
      }
    }
    return true;
  }

  function pairMeetsPoolCapacity(pair, sp, teamA, teamB, keyToRow) {
    return (
      pairMeetsP1P2Capacity(pair, sp, teamA, teamB, keyToRow) &&
      pairMeetsP3Capacity(pair, sp, teamA, teamB, keyToRow) &&
      pairMeetsUniqueXiCapacity(pair, sp, teamA, teamB, keyToRow)
    );
  }

  function splitPoolCrossPoolDuplicates(sp) {
    const dups = [];
    ["teamA", "teamB"].forEach((side) => {
      const idToPools = new Map();
      ["p1", "p2", "p3"].forEach((pk) => {
        (sp[side][pk] || []).forEach((id) => {
          if (!idToPools.has(id)) {
            idToPools.set(id, []);
          }
          idToPools.get(id).push(pk);
        });
      });
      idToPools.forEach((pools, id) => {
        const uniq = [...new Set(pools)];
        if (uniq.length > 1) {
          dups.push({ side, id, pools: uniq });
        }
      });
    });
    return dups;
  }

  /** Same player key listed in multiple pools (different ids) — breaks sequential P1→P2 fill. */
  function splitPoolCrossPoolKeyDuplicates(sp, keyToRow) {
    const dups = [];
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    ["teamA", "teamB"].forEach((side) => {
      const franchise = side === "teamA" ? teamA : teamB;
      const keyToPools = new Map();
      ["p1", "p2", "p3"].forEach((pk) => {
        franchisePoolRows(sp, side, pk, franchise, keyToRow).forEach((r) => {
          const k = window.iplPoolPlayerKey(r);
          if (!keyToPools.has(k)) {
            keyToPools.set(k, []);
          }
          keyToPools.get(k).push(pk);
        });
      });
      keyToPools.forEach((pools, key) => {
        const uniq = [...new Set(pools)];
        if (uniq.length > 1) {
          dups.push({ side, key, pools: uniq });
        }
      });
    });
    return dups;
  }

  /** profileId → segmentKey → feasible pair strings for current pools. */
  function buildFeasiblePairMap(cat, sp, teamA, teamB, keyToRow) {
    const out = {};
    (cat.PROFILE_ORDER || ["C1", "C2", "C3", "C4"]).forEach((profileId) => {
      out[profileId] = {};
      const segs = cat.PROFILES[profileId]?.segments || [];
      segs.forEach((segKey) => {
        const feasible = (cat.listPairStrings(profileId, segKey) || []).filter((pairStr) => {
          const pair = cat.parsePair(pairStr);
          return pairMeetsPoolCapacity(pair, sp, teamA, teamB, keyToRow);
        });
        out[profileId][segKey] = feasible;
      });
    });
    return out;
  }

  function profileHasFeasiblePair(feasibleMap, profileId) {
    const segs = feasibleMap[profileId];
    if (!segs) {
      return false;
    }
    return Object.values(segs).some((list) => list.length > 0);
  }

  /**
   * Round-robin a feasible pair for the target profile slot; alternate segment;
   * if target profile has no feasible pairs (e.g. C4 needs 3×P2), use next profile with capacity.
   */
  function selectRotatingFeasiblePair(
    cat,
    targetProfileId,
    profileCounts,
    feasibleMap,
    pairRotationCounts
  ) {
    const order = cat.PROFILE_ORDER || ["C1", "C2", "C3", "C4"];
    const startIdx = Math.max(0, order.indexOf(targetProfileId));
    for (let o = 0; o < order.length; o += 1) {
      const profileId = order[(startIdx + o) % order.length];
      if (!profileHasFeasiblePair(feasibleMap, profileId)) {
        continue;
      }
      const prof = cat.PROFILES[profileId];
      const primarySeg = cat.segmentForProfileTeam(profileId, profileCounts[profileId]);
      const segOrder = [primarySeg, ...(prof?.segments || []).filter((s) => s !== primarySeg)];
      for (const segKey of segOrder) {
        const list = feasibleMap[profileId]?.[segKey] || [];
        if (!list.length) {
          continue;
        }
        const rotKey = `${profileId}:${segKey}`;
        const rotIdx = pairRotationCounts[rotKey] || 0;
        pairRotationCounts[rotKey] = rotIdx + 1;
        return {
          profileId,
          segKey,
          pair: cat.parsePair(list[rotIdx % list.length]),
          substituted: profileId !== targetProfileId,
          targetProfileId,
        };
      }
    }
    return null;
  }

  function summarizeFeasiblePairs(feasibleMap) {
    const counts = {};
    Object.keys(feasibleMap || {}).forEach((profileId) => {
      let n = 0;
      Object.values(feasibleMap[profileId] || {}).forEach((list) => {
        n += list.length;
      });
      counts[profileId] = n;
    });
    return counts;
  }

  function uniformPickSubset(rows, k) {
    const copy = [...rows];
    const picked = [];
    for (let i = 0; i < k && copy.length; i += 1) {
      const j = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(j, 1)[0]);
    }
    return picked.length === k ? picked : null;
  }

  function pickSplitPoolSubset(rows, k, appearanceCounts, tuning, excludeKeys) {
    const need = Math.max(0, Math.floor(Number(k) || 0));
    if (excludeKeys && excludeKeys.size) {
      rows = rows.filter((r) => !excludeKeys.has(window.iplPoolPlayerKey(r)));
    }
    if (need <= 0) {
      return [];
    }
    if (!rows.length || rows.length < need) {
      return null;
    }
    if (rows.length === need) {
      return [...rows];
    }
    const fn = window.iplPickWeightedPoolSubset;
    let picked = null;
    if (typeof fn === "function") {
      picked = fn(rows, need, appearanceCounts, tuning);
    }
    if (!picked || picked.length !== need) {
      picked = uniformPickSubset(rows, need);
    }
    return picked;
  }

  function fillP3Slots(teamName, pCount, needAr, poolIds, keyToRow, appearanceCounts, tuning, excludeKeys) {
    if (pCount <= 0) {
      return [];
    }
    const seen = new Set();
    let rows = [];
    rowsFromPoolIds(poolIds, keyToRow)
      .filter((r) => r.team === teamName)
      .forEach((r) => {
        const k = window.iplPoolPlayerKey(r);
        if (excludeKeys && excludeKeys.has(k)) {
          return;
        }
        if (seen.has(k)) {
          return;
        }
        seen.add(k);
        rows.push(r);
      });
    const arRows = rows.filter((r) => window.iplGetRawProfileRole(r.team, r.player) === "all_rounder");
    const bowlRows = rows.filter((r) => window.iplGetRawProfileRole(r.team, r.player) === "bowler");
    if (arRows.length + bowlRows.length < pCount) {
      return null;
    }
    const localUsed = new Set(excludeKeys || []);
    const arPick = pickSplitPoolSubset(arRows, needAr, appearanceCounts, tuning, localUsed);
    if (!arPick) {
      return null;
    }
    arPick.forEach((r) => localUsed.add(window.iplPoolPlayerKey(r)));
    const bowlPick = pickSplitPoolSubset(bowlRows, pCount - needAr, appearanceCounts, tuning, localUsed);
    if (!bowlPick || arPick.length + bowlPick.length !== pCount) {
      return null;
    }
    return [...arPick, ...bowlPick];
  }

  function countProfileArInP3(sp, keyToRow, franchise) {
    const ids = [...(sp.teamA.p3 || []), ...(sp.teamB.p3 || [])];
    return rowsFromPoolIds(ids, keyToRow).filter(
      (r) =>
        r.team === franchise && window.iplGetRawProfileRole(r.team, r.player) === "all_rounder"
    ).length;
  }

  function minProfileArForXi(pair, sp, keyToRow) {
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    const arA = countProfileArInP3(sp, keyToRow, teamA);
    const arB = countProfileArInP3(sp, keyToRow, teamB);
    if (arA + arB < 1) {
      return 0;
    }
    return Math.min(1, pair.pA + pair.pB);
  }

  function pickP3ForPair(pair, keyToRow, appearanceCounts, tuning, sp, excludeKeys) {
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    const needAr = Math.max(
      window.SplitPoolCatalog.arStar(pair.pA, pair.pB),
      minProfileArForXi(pair, sp, keyToRow)
    );
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
      const p3A = fillP3Slots(
        teamA,
        pair.pA,
        arA,
        sp.teamA.p3,
        keyToRow,
        appearanceCounts,
        tuning,
        excludeKeys
      );
      const p3B = fillP3Slots(
        teamB,
        pair.pB,
        arB,
        sp.teamB.p3,
        keyToRow,
        appearanceCounts,
        tuning,
        excludeKeys
      );
      if (p3A && p3B) {
        return { p3A, p3B };
      }
    }
    return null;
  }

  function poolFillDiag(sp, side, poolKey, franchise, keyToRow, excludeKeys) {
    let rows = franchisePoolRows(sp, side, poolKey, franchise, keyToRow);
    const total = rows.length;
    if (excludeKeys && excludeKeys.size) {
      rows = rows.filter((r) => !excludeKeys.has(window.iplPoolPlayerKey(r)));
    }
    return { assigned: sp[side][poolKey].length, resolved: total, available: rows.length };
  }

  function formatPickLabels(rows) {
    return (rows || []).map((r) => `${r.player} (${r.team})`);
  }

  /** Append picks to XI; detect duplicate player keys immediately with slot label. */
  function appendPicks(team, slotLabel, picked, usedKeys, needK) {
    if (picked === null) {
      return {
        error: "p1p2_fill",
        fillSlot: slotLabel,
        need: needK,
      };
    }
    if (needK > 0 && picked.length !== needK) {
      return {
        error: "p1p2_fill",
        fillSlot: slotLabel,
        need: needK,
        got: picked.length,
        hint: "pick_returned_short",
      };
    }
    const duplicatePicks = [];
    for (const r of picked) {
      const k = window.iplPoolPlayerKey(r);
      if (usedKeys.has(k)) {
        duplicatePicks.push({ slot: slotLabel, key: k, player: r.player, team: r.team });
      } else {
        usedKeys.add(k);
        team.push(r);
      }
    }
    if (duplicatePicks.length) {
      return {
        error: "xi_overlap",
        fillSlot: slotLabel,
        need: needK,
        got: picked.length,
        duplicatePicks,
        teamLen: team.length,
        unique: usedKeys.size,
        hint: "player_already_used_in_another_pool_slot",
      };
    }
    return {
      ok: true,
      labels: formatPickLabels(picked),
    };
  }

  function buildXiFromPair(pair, keyToRow, appearanceCounts, tuning, poolOpts, traceOut) {
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    const sp = effectiveSplitPoolsForBuild(poolOpts?.useReduced, poolOpts?.excludeSet);
    const usedKeys = new Set();
    const team = [];
    const trace = traceOut || null;
    const pairLabel = `${pair.a}|${pair.b}`;

    if (trace) {
      trace.pair = pairLabel;
      trace.need = { tA: pair.tA, rA: pair.rA, pA: pair.pA, tB: pair.tB, rB: pair.rB, pB: pair.pB };
      trace.steps = [];
      trace.crossPoolDups = splitPoolCrossPoolDuplicates(sp).length;
    }

    const stepDefs = [
      ["p1A", "teamA", "p1", teamA, pair.tA],
      ["p2A", "teamA", "p2", teamA, pair.rA],
      ["p1B", "teamB", "p1", teamB, pair.tB],
      ["p2B", "teamB", "p2", teamB, pair.rB],
    ];

    for (const [slot, side, poolKey, franchise, needK] of stepDefs) {
      const need = Math.max(0, Math.floor(Number(needK) || 0));
      const poolRows = franchisePoolRows(sp, side, poolKey, franchise, keyToRow);
      const picked = pickSplitPoolSubset(poolRows, need, appearanceCounts, tuning, usedKeys);
      const append = appendPicks(team, slot, picked, usedKeys, need);
      if (trace) {
        const afterEx =
          usedKeys && usedKeys.size
            ? poolRows.filter((r) => !usedKeys.has(window.iplPoolPlayerKey(r)))
            : poolRows;
        trace.steps.push({
          slot,
          need,
          diag: poolFillDiag(sp, side, poolKey, franchise, keyToRow, usedKeys),
          poolRows: poolRows.length,
          eligible: afterEx.length,
          pickedLen: picked ? picked.length : null,
          ...(append.ok ? { picks: append.labels } : append),
        });
      }
      if (!append.ok) {
        if (append.error === "p1p2_fill") {
          append.diag = poolFillDiag(sp, side, poolKey, franchise, keyToRow, usedKeys);
        }
        return append;
      }
    }

    const p3 = pickP3ForPair(pair, keyToRow, appearanceCounts, tuning, sp, usedKeys);
    if (!p3) {
      if (trace) {
        trace.steps.push({ slot: "p3", error: "p3_fill", needAr: window.SplitPoolCatalog.arStar(pair.pA, pair.pB) });
      }
      return { error: "p3_fill" };
    }

    for (const [slot, picked, needK] of [
      ["p3A", p3.p3A, pair.pA],
      ["p3B", p3.p3B, pair.pB],
    ]) {
      const append = appendPicks(team, slot, picked, usedKeys, needK);
      if (trace) {
        trace.steps.push({
          slot,
          need: needK,
          ...(append.ok ? { picks: append.labels } : append),
        });
      }
      if (!append.ok) {
        return append;
      }
    }

    if (team.length !== 11 || usedKeys.size !== 11) {
      return {
        error: "xi_size_mismatch",
        gotLen: team.length,
        unique: usedKeys.size,
        hint:
          team.length !== usedKeys.size
            ? "duplicate_player_in_xi"
            : team.length < 11
              ? "pick_returned_short"
              : "too_many_picks",
        trace,
      };
    }
    if (trace) {
      trace.ok = true;
      trace.teamLen = team.length;
      trace.unique = usedKeys.size;
    }
    return { team };
  }

  /** Dry-run all C4 whitelist pairs against live pools (preflight for UI / logs). */
  function diagnoseC4PoolBuild(keyToRow, poolOpts) {
    const cat = window.SplitPoolCatalog;
    const teamA = window.teamASelect?.value || "";
    const teamB = window.teamBSelect?.value || "";
    const sp = effectiveSplitPoolsForBuild(poolOpts?.useReduced, poolOpts?.excludeSet);
    const cross = splitPoolCrossPoolDuplicates(sp);
    const crossKeys = splitPoolCrossPoolKeyDuplicates(sp, keyToRow);
    const rows = [];
    ["65", "56"].forEach((segKey) => {
      (cat.listPairStrings("C4", segKey) || []).forEach((pairStr) => {
        const pair = cat.parsePair(pairStr);
        const trace = { segment: segKey };
        const built = buildXiFromPair(pair, keyToRow, new Map(), window.DEFAULT_GENERATOR_TUNING || {}, poolOpts, trace);
        rows.push({
          segment: segKey,
          pair: pairStr,
          ok: Boolean(built.team),
          error: built.error || null,
          fillSlot: built.fillSlot,
          got: built.got,
          gotLen: built.gotLen,
          unique: built.unique,
          hint: built.hint,
          duplicatePicks: built.duplicatePicks,
          traceSteps: trace.steps,
        });
      });
    });
    return {
      teamA,
      teamB,
      crossPoolDuplicates: cross.length,
      cross,
      crossPoolKeyDuplicates: crossKeys.length,
      crossKeys,
      uniqA: uniqueFranchisePoolCount(sp, "teamA", teamA, keyToRow),
      uniqB: uniqueFranchisePoolCount(sp, "teamB", teamB, keyToRow),
      pairResults: rows,
    };
  }

  async function generateSplitPoolTeamsForStrategy(
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
    /** Per profile+segment round-robin index for triplet pairs (not random). */
    const pairRotationCounts = {};
    const profilePlan = cat.buildSplitProfileRoundRobinSequence(
      numTeams,
      getSplitPoolProfilePercentsFromUi()
    );
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
    const c4Verbose = Boolean(document.getElementById("splitPoolC4VerboseCheckbox")?.checked);
    const teamAName = window.teamASelect?.value || "";
    const teamBName = window.teamBSelect?.value || "";
    const c4DebugLog = [];
    const c4Preflight = diagnoseC4PoolBuild(keyToRow, {
      useReduced: false,
      excludeSet: excludePlayerSet,
    });
    if (c4Verbose) {
      console.info("[split_pool C4 preflight]", c4Preflight);
    }
    const rejectStats = {
      no_pair: 0,
      no_feasible_pair: 0,
      pair_psum: 0,
      pair_t33: 0,
      p3_fill: 0,
      p1p2_fill: 0,
      xi_overlap: 0,
      xi_size_mismatch: 0,
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
    let feasibleMapFull = null;
    let feasibleMapReduced = null;
    let profileSubstitutions = 0;

    function feasibleMapForBuild(useReduced) {
      const sp = effectiveSplitPoolsForBuild(useReduced, excludePlayerSet);
      if (useReduced) {
        if (!feasibleMapReduced) {
          feasibleMapReduced = buildFeasiblePairMap(cat, sp, teamAName, teamBName, keyToRow);
        }
        return feasibleMapReduced;
      }
      if (!feasibleMapFull) {
        feasibleMapFull = buildFeasiblePairMap(cat, sp, teamAName, teamBName, keyToRow);
      }
      return feasibleMapFull;
    }

    function recordSplitReject(code, extra = {}) {
      if (String(code).startsWith("xi_")) {
        invalidXiCounts[code] = (invalidXiCounts[code] || 0) + 1;
      } else if (rejectStats[code] != null) {
        rejectStats[code] += 1;
      }
      if (verboseLog && rejectSamples.length < maxRejectSamples) {
        rejectSamples.push({ code, ...extra });
      }
      if (
        c4Verbose &&
        c4DebugLog.length < 20 &&
        (extra.profileId === "C4" || extra.targetProfileId === "C4")
      ) {
        c4DebugLog.push({ code, ...extra });
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
        if (typeof window.iplMaybeYieldGenerationProgress === "function") {
          await window.iplMaybeYieldGenerationProgress(
            STRATEGY_ID_SPLIT_POOL,
            attempts,
            teams.length,
            numTeams,
            { attemptCap: hardAttemptCap, phase: `dup pass ${stageIdx + 1}` }
          );
        }
        const targetProfileId = cat.profileAtTeamIndex(teams.length, profilePlan);
        const useReduced = teams.length >= fullPoolTeamCount;
        const feasibleMap = feasibleMapForBuild(useReduced);
        const picked = selectRotatingFeasiblePair(
          cat,
          targetProfileId,
          profileCounts,
          feasibleMap,
          pairRotationCounts
        );
        if (!picked) {
          recordSplitReject("no_feasible_pair", {
            targetProfileId,
            stage: maxDupPerXi,
            reduced: useReduced,
          });
          continue;
        }
        const { profileId, segKey, pair, substituted } = picked;
        if (substituted) {
          profileSubstitutions += 1;
        }
        const pairLabel = `${pair.a}|${pair.b}`;
        const prof = cat.PROFILES[profileId];
        if (prof.pSumMax != null && pair.pA + pair.pB > prof.pSumMax) {
          recordSplitReject("pair_psum", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        if (pair.tA === 3 && pair.tB === 3) {
          recordSplitReject("pair_t33", { profileId, segKey, pair: pairLabel, stage: maxDupPerXi });
          continue;
        }
        const buildTrace =
          c4Verbose && (profileId === "C4" || targetProfileId === "C4") ? {} : null;
        const built = buildXiFromPair(
          pair,
          keyToRow,
          counts,
          t,
          {
            useReduced,
            excludeSet: excludePlayerSet,
          },
          buildTrace
        );
        if (built.error) {
          recordSplitReject(built.error, {
            profileId,
            targetProfileId,
            segKey,
            pair: pairLabel,
            stage: maxDupPerXi,
            reduced: useReduced,
            fillSlot: built.fillSlot,
            need: built.need,
            diag: built.diag,
            gotLen: built.gotLen,
            unique: built.unique,
            duplicatePicks: built.duplicatePicks,
            hint: built.hint,
            c4Trace: buildTrace,
          });
          if (c4Verbose && buildTrace && c4DebugLog.length < 20) {
            console.info("[split_pool C4 build fail]", {
              pair: pairLabel,
              error: built.error,
              fillSlot: built.fillSlot,
              duplicatePicks: built.duplicatePicks,
              trace: buildTrace,
            });
          }
          continue;
        }
        const team = built.team;
        if (!team || team.length !== 11) {
          recordSplitReject("xi_size_mismatch", {
            profileId,
            segKey,
            pair: pairLabel,
            stage: maxDupPerXi,
            gotLen: team?.length,
            hint: "built_team_wrong_length",
          });
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
          splitProfileTarget: substituted ? targetProfileId : undefined,
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
      profileTargetCounts: { ...(profilePlan.counts || {}) },
      profilePercents: { ...(profilePlan.percents || getSplitPoolProfilePercentsFromUi()) },
      feasiblePairsFull: summarizeFeasiblePairs(feasibleMapFull),
      feasiblePairsReduced: feasibleMapReduced
        ? summarizeFeasiblePairs(feasibleMapReduced)
        : null,
      profileSubstitutions,
      c4Preflight,
      c4DebugLog: [...c4DebugLog],
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
    diagnoseC4PoolBuild,
    getSplitPoolFullPoolPercentFromUi,
    getSplitPoolProfilePercentsFromUi,
    applySplitPoolProfilePercentsToUi,
    formatSplitProfilePercentSummary,
    SPLIT_POOL_ATTEMPTS_MULTIPLIER,
    DEFAULT_SPLIT_POOL_FULL_POOL_PCT,
  };
})();
