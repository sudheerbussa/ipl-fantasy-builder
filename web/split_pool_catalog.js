/**
 * Split-pool (P1/P2/P3) profile catalog — mirrors docs/split_pool_p1p2p3_scenario_matrix.md §5.
 * Loaded before app.js; exposes `window.SplitPoolCatalog`.
 */
(function () {
  const SEGMENTS = {
    "65": { nA: 6, nB: 5 },
    "56": { nA: 5, nB: 6 },
    "74": { nA: 7, nB: 4 },
    "47": { nA: 4, nB: 7 },
  };

  const PROFILE_ORDER = ["C1", "C2", "C3", "C4"];
  const DEFAULT_SPLIT_PROFILE_PERCENTS = { C1: 25, C2: 25, C3: 25, C4: 25 };

  /** @type {Record<string, { segments: string[], pSumMax?: number, bandsA: object, bandsB: object }>} */
  const PROFILES = {
    C1: {
      segments: ["65", "56"],
      pSumMax: 4,
      bandsA: { tH: true, rH: false, pH: false },
      bandsB: { tH: true, rH: false, pH: false },
    },
    C2: {
      segments: ["65", "74"],
      bandsA: { tH: true, rH: false, pH: true },
      bandsB: { tH: false, rH: true, pH: false },
    },
    C3: {
      segments: ["56", "47"],
      bandsA: { tH: false, rH: true, pH: false },
      bandsB: { tH: true, rH: false, pH: true },
    },
    C4: {
      segments: ["65", "56", "74", "47"],
      pSumMax: 5,
      bandsA: { tH: false, rH: true, pH: true },
      bandsB: { tH: false, rH: true, pH: true },
    },
  };

  /** Whitelist (tier primary) + optional (tier secondary) pair strings "t-r-p|t-r-p". */
  const PAIRS = {
    C1: {
      65: {
        primary: ["3-1-2|2-1-2", "2-2-2|3-0-2", "2-2-2|3-1-1", "2-2-2|2-1-2"],
        secondary: [],
      },
      56: {
        primary: ["2-1-2|3-1-2", "2-1-2|2-2-2", "3-0-2|2-2-2", "3-1-1|2-2-2"],
        secondary: [],
      },
    },
    C2: {
      65: {
        primary: [
          "2-1-3|0-4-1",
          "2-1-3|1-3-1",
          "3-0-3|0-4-1",
          "3-0-3|1-3-1",
          "3-1-2|0-3-2",
          "3-1-2|0-4-1",
          "3-1-2|1-2-2",
          "3-1-2|1-3-1",
        ],
        secondary: ["2-1-3|0-3-2", "2-1-3|1-2-2", "3-0-3|0-3-2", "3-0-3|1-2-2"],
      },
      74: {
        primary: ["3-1-3|0-3-1", "3-1-3|1-2-1"],
        secondary: ["3-1-3|0-2-2"],
      },
    },
    C3: {
      56: {
        primary: [
          "0-3-2|3-1-2",
          "0-4-1|2-1-3",
          "0-4-1|3-0-3",
          "0-4-1|3-1-2",
          "1-2-2|3-1-2",
          "1-3-1|2-1-3",
          "1-3-1|3-0-3",
          "1-3-1|3-1-2",
        ],
        secondary: ["0-3-2|2-1-3", "0-3-2|3-0-3", "1-2-2|2-1-3", "1-2-2|3-0-3"],
      },
      47: {
        primary: ["0-3-1|3-1-3", "1-2-1|3-1-3"],
        secondary: ["0-2-2|3-1-3"],
      },
    },
    C4: {
      65: {
        primary: ["0-4-2|0-3-2", "0-4-2|1-2-2", "1-3-2|0-3-2", "1-3-2|1-2-2"],
        secondary: [
          "0-3-3|0-3-2",
          "0-3-3|1-2-2",
          "0-4-2|0-2-3",
          "1-2-3|0-3-2",
          "1-2-3|1-2-2",
          "1-3-2|0-2-3",
        ],
      },
      56: {
        primary: ["0-3-2|0-4-2", "0-3-2|1-3-2", "1-2-2|0-4-2", "1-2-2|1-3-2"],
        secondary: [
          "0-2-3|0-4-2",
          "0-2-3|1-3-2",
          "0-3-2|0-3-3",
          "0-3-2|1-2-3",
          "1-2-2|0-3-3",
          "1-2-2|1-2-3",
        ],
      },
      74: {
        primary: ["1-4-2|0-2-2"],
        secondary: ["0-4-3|0-2-2", "1-3-3|0-2-2"],
      },
      47: {
        primary: ["0-2-2|1-4-2"],
        secondary: ["0-2-2|0-4-3", "0-2-2|1-3-3"],
      },
    },
  };

  function parseTriplet(s) {
    const p = String(s).split("-").map(Number);
    return { t: p[0], r: p[1], p: p[2] };
  }

  function parsePair(pairStr) {
    const [a, b] = String(pairStr).split("|");
    const ta = parseTriplet(a);
    const tb = parseTriplet(b);
    return {
      a,
      b,
      tA: ta.t,
      rA: ta.r,
      pA: ta.p,
      tB: tb.t,
      rB: tb.r,
      pB: tb.p,
    };
  }

  function arStar(pA, pB) {
    return Math.max(0, pA + pB - 4);
  }

  function pickPair(profileId, segmentKey, rng) {
    const seg = PAIRS[profileId]?.[segmentKey];
    if (!seg) {
      return null;
    }
    const pool = [...seg.primary];
    if (seg.secondary.length && (rng ? rng() : Math.random()) < 0.35) {
      pool.push(...seg.secondary);
    }
    if (!pool.length) {
      return null;
    }
    const idx = Math.floor((rng ? rng() : Math.random()) * pool.length);
    return parsePair(pool[idx]);
  }

  function segmentForProfileTeam(profileId, profileTeamIndex) {
    const prof = PROFILES[profileId];
    if (!prof) {
      return "65";
    }
    const segs = prof.segments;
    if (profileId === "C2") {
      return profileTeamIndex % 10 === 9 ? "74" : "65";
    }
    if (profileId === "C3") {
      return profileTeamIndex % 10 === 9 ? "47" : "56";
    }
    if (profileId === "C4") {
      const heavy = profileTeamIndex % 10 === 9;
      if (heavy) {
        return profileTeamIndex % 20 === 9 ? "74" : "47";
      }
      return profileTeamIndex % 2 === 0 ? "65" : "56";
    }
    return segs[profileTeamIndex % segs.length];
  }

  function sanitizeSplitProfilePercents(raw, fallback = DEFAULT_SPLIT_PROFILE_PERCENTS) {
    let vals = PROFILE_ORDER.map((id) => {
      const n = Number(raw?.[id]);
      if (!Number.isFinite(n)) {
        return fallback[id];
      }
      return Math.max(0, n);
    });
    if (vals.reduce((a, b) => a + b, 0) <= 0) {
      vals = PROFILE_ORDER.map((id) => fallback[id]);
    }
    const sum = vals.reduce((a, b) => a + b, 0);
    const out = {};
    PROFILE_ORDER.forEach((id, i) => {
      out[id] = (vals[i] / sum) * 100;
    });
    return out;
  }

  /** Largest-remainder allocation of `numTeams` across C1–C4 using weight percents (sum 100). */
  function computeSplitProfileEnds(numTeams, percents) {
    const p = sanitizeSplitProfilePercents(percents);
    const n = Math.max(0, Math.floor(Number(numTeams) || 0));
    const exact = PROFILE_ORDER.map((id) => (n * p[id]) / 100);
    const lens = exact.map((x) => Math.floor(x));
    let rem = n - lens.reduce((a, b) => a + b, 0);
    const fracOrder = PROFILE_ORDER.map((id, i) => ({ id, frac: exact[i] - lens[i] })).sort(
      (a, b) => b.frac - a.frac
    );
    let fi = 0;
    while (rem > 0) {
      const pick = fracOrder[fi % fracOrder.length];
      const i = PROFILE_ORDER.indexOf(pick.id);
      lens[i] += 1;
      rem -= 1;
      fi += 1;
    }
    const counts = {};
    const ends = {};
    let acc = 0;
    PROFILE_ORDER.forEach((id, i) => {
      counts[id] = lens[i];
      acc += lens[i];
      ends[id] = acc;
    });
    return { n, counts, ends, percents: p };
  }

  function profileAtTeamIndex(teamIndex, profileEnds) {
    if (!profileEnds || profileEnds.n == null) {
      return PROFILE_ORDER[((teamIndex % PROFILE_ORDER.length) + PROFILE_ORDER.length) % PROFILE_ORDER.length];
    }
    const idx = Math.max(0, Math.floor(Number(teamIndex) || 0));
    for (const id of PROFILE_ORDER) {
      if (idx < profileEnds.ends[id]) {
        return id;
      }
    }
    return PROFILE_ORDER[PROFILE_ORDER.length - 1];
  }

  window.SplitPoolCatalog = {
    SEGMENTS,
    PROFILE_ORDER,
    DEFAULT_SPLIT_PROFILE_PERCENTS,
    PROFILES,
    PAIRS,
    parseTriplet,
    parsePair,
    arStar,
    pickPair,
    segmentForProfileTeam,
    sanitizeSplitProfilePercents,
    computeSplitProfileEnds,
    profileAtTeamIndex,
  };
})();
