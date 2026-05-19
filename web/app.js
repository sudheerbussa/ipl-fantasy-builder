const SQUADS_PATH = "../data/ipl2026_squads.json";
const FORM_PATH = "../data/ipl2026_recent_form.json";
const PROFILES_PATH = "../data/ipl2026_player_profiles.json";
const BATTING_SLOTS_PATH = "../data/ipl2026_batting_slots.json";
const C_VC_POOLS_PATH = "../data/c_vc_pools.json";
const TUNING_PRESETS_PATH = "../data/generator_tuning_presets.json";
const TEAM_ABBREV_PATH = "../data/team_abbreviations.json";
const CV_POOLS_STORAGE_KEY = "ipl2026_c_vc_pools_user_v3";
const CV_POOLS_STORAGE_KEY_LEGACY = "ipl2026_c_vc_pools_user_v2";
/** Max captain-pool size per franchise (top-order batsmen rule). */
const STORAGE_KEY = "ipl2026_selected_players";
const BAT_POOLS_STORAGE_KEY = "ipl2026_bat_first_pools_v1";
const SECOND_INNINGS_POOLS_STORAGE_KEY = "ipl2026_second_innings_pools_v1";
const DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT = 50;
const DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC = "0-3-2,0-2-3,1-2-2,1-1-3";
const DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC = "0-2-3,1-1-3,2-0-3,1-2-2";
/** Prior app defaults — localStorage with these is upgraded on load (custom specs unchanged). */
const SECOND_INNINGS_LEGACY_CHASE_COMBO_SPECS = [
  "1-3-1,0-4-1",
  "0-4-1,1-3-1",
  "0-3-2,0-2-3,1-3-1,1-2-2",
  "0-3-2,0-2-3,1-2-2",
];
const SECOND_INNINGS_LEGACY_BOWL_COMBO_SPECS = [
  "0-1-4,0-2-3",
  "0-2-3,0-1-4",
  "0-2-3,1-1-3,0-1-4,1-0-4,2-0-3",
];
/** Max XI draws for bat_first_pool_xi (lighter than high_scoring multi-cell quotas). */
const BAT_FIRST_ATTEMPTS_MULTIPLIER = 3;
/** Per-scenario 5-player draws for second_innings_pool_5 (chase + bowl blocks). */
const SECOND_INNINGS_ATTEMPTS_MULTIPLIER = 4;
/** If C(n,k) exceeds this, skip full enumeration and draw pool subsets at random. */
const BAT_POOL_COMBO_ENUM_CAP = 20000;
/** Bat-first segment A: 6 bat-side + 5 bowl/AR picks (sums to 11). */
const BAT_FIRST_SEG_A = { p1: 6, p2: 5 };
/** Bat-first segment B: 5 + 6 (sums to 11). */
const BAT_FIRST_SEG_B = { p1: 5, p2: 6 };
/** Default % of teams that draw from the full P1∪P2 set; remainder use pools minus user exclusions. */
const DEFAULT_BAT_FIRST_FULL_POOL_PCT = 70;
/** Default split between segment A (6+5) and B (5+6) within full-pool or reduced-pool runs. */
const DEFAULT_BAT_FIRST_SEGMENT_PERCENTS = { segA: 50, segB: 50 };
/** Per iteration: max *extra* accepts with the same 11 players (beyond the first). 0 = strict unique XI for that pass. Three passes total. */
const DEFAULT_BAT_FIRST_LINEUP_DUP_STAGES = [0, 1, 2];
/** Default: franchise 7–4 cap on; persisted `split74Quota` and the UI checkbox override. */
const DEFAULT_BAT_FIRST_SPLIT74_QUOTA = true;
/** Bat-first optional cap: at most this fraction of accepted teams may have 7 from one franchise and 4 from the other (4+7 counts the same). */
const BAT_FIRST_FRANCHISE_74_MAX_FRAC = 1 / 5;
/** Default % of split-pool teams using full P1/P2/P3 before reduced exclusions apply. */
const DEFAULT_SPLIT_POOL_FULL_POOL_PCT = 50;
/** Same-XI extra accepts per pass (0 → strict unique XIs in pass 1). */
const DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES = [0, 1, 2];

function coalesceStoredBatFirstSplit74Quota(raw) {
  return raw != null && typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "split74Quota")
    ? Boolean(raw.split74Quota)
    : DEFAULT_BAT_FIRST_SPLIT74_QUOTA;
}
/** Browser-local "DB" for post-match fantasy points (per fixture). */
const POSTMATCH_POINTS_DB_KEY = "ipl2026_postmatch_points_db_v1";
const CANDIDATE_NAMES_STORAGE_KEY = "ipl2026_candidate_names_v1";
/** Last active generator sub-step (squad | pools | run) within the Generator tab. */
const GENERATOR_UI_STEP_STORAGE_KEY = "ipl2026_generator_ui_step_v1";
/** Default operators; editable in UI. Order maps to batch 1, 2, 3, … */
const DEFAULT_CANDIDATE_NAMES = ["Akshay", "Sudhir", "Lakshmi", "Mahendra", "Biru"];
/** Fixed cap for teams assigned per person per match (business rule). */
const MAX_TEAMS_PER_CANDIDATE = 40;
/** Generation loop stops after at most numTeams × this many iterations (each iteration = one random draw + checks). */
const ATTEMPTS_MULTIPLIER = 500;
/**
 * Pre-toss high-scoring catalog: fixed 6-cell set — see docs/high_scoring_games_beginner_scenarios.md §8.
 * Rule: each active cell should reach at least this fraction of a fair per-cell split.
 */
const HIGH_SCORING_MIN_QUOTA_FRAC = 0.8;
/** Extra attempt budget multiplier for high_scoring_games (quotas + dedupe). */
const HIGH_SCORING_ATTEMPTS_MULTIPLIER = 4;
/** Allow same XI later, but block immediate-repeat clusters in accepted order. */
const LINEUP_REPEAT_COOLDOWN = 3;
/** Soft C/VC pair spread across `(scenario, captain, vice)` during batch generation: `weight ∝ score × (1/(ε+n))^β`; unseen pairs get extra boost. */
const CV_PAIR_FAIRNESS_BETA = 0.55;
const CV_PAIR_COUNT_EPS = 1;
const CV_PAIR_ZERO_UNSEEN_BOOST = 1.65;
/** Below this many legal (C,VC) options for the current XI+scenario, skip pair nudge and use legacy pick. */
const CV_PAIR_MIN_LEGAL_FOR_NUDGE = 6;
/**
 * Pull C/VC picks toward equal usage across everyone in the captain / vice pools (selected pool ∩ JSON pools).
 * Applies to all strategies. Higher = stronger equalisation vs raw projection / order score.
 */
const CV_FAIRNESS_LAMBDA = 5.4421;
/** Soft floor for quality summary: min captain (or VC) slots ≈ this × teams ÷ pool size (separate from scenario-cell quotas). */
const CV_POOL_SOFT_QUOTA_FRAC = 0.8;

/** Fixed pre-toss set: A1 × {B1, B2a, B3} per α/β branch — omits A1–B2b (death-decided chase). */
const HIGH_SCORING_SCENARIO_IDS_BATTING_HEAVY_6 = ["α1", "α2", "α4", "β1", "β2", "β4"];
const HIGH_SCORING_SCENARIO_PROFILES = {
  batting_heavy_6: HIGH_SCORING_SCENARIO_IDS_BATTING_HEAVY_6,
};
const DEFAULT_SCENARIO_PROFILE = "batting_heavy_6";
/**
 * C/VC pool tick hints by chase phase (suffix 1=B1, 2=B2a, 4=B3). {F}/{Ch} → franchise abbrev at runtime.
 * α: F = Team A, Ch = Team B; β: F = Team B, Ch = Team A (see chaserFranchiseForScenario).
 */
const HIGH_SCORING_SCENARIO_CV_HINT_TEMPLATES = {
  1: {
    captain: "{Ch} or {F} top-order batter",
    vice: "{Ch} 2nd top-order batter; {F} #2–3 batter; {Ch} batting all-rounder",
  },
  2: {
    captain: "{Ch} middle-order batter (~#4–6) / middle anchor",
    vice: "{F} middle-overs bowler; {F} top-order batter; {Ch} all-rounder",
  },
  4: {
    captain: "{F} bowler or {F} top-order batter",
    vice: "{F} 2nd bowler or batter; {Ch} chase anchor batter; {Ch} all-rounder with bat",
  },
};
/** One-line match story for section headers (batting-heavy 6-cell set uses A1 first dig). */
const HIGH_SCORING_SCENARIO_OUTCOME_TEMPLATES = {
  1: "{F} top-order sets a big total; {Ch} win the chase comfortably",
  2: "{F} top-order total; middle overs decide the chase ({Ch} middle-heavy)",
  4: "{F} top-order total holds; {Ch} chase falls short ({F} defend)",
};
const ROLE_PRIORS = {
  wicket_keeper: 34,
  all_rounder: 38,
  bowler: 32,
  batsman: 30,
};
/** Defaults for generator tuning (overridden by Generator “Tuning” inputs when present). */
const DEFAULT_GENERATOR_TUNING = {
  repeatLambda: 1.6705,
  cvUniformBlend: 0.604,
  lineupCeilingNudge: 0.1734,
  lowerMiddleBatWeight: 0.4312,
  cvFairnessLambda: CV_FAIRNESS_LAMBDA,
  blendProjWeight: 0.5324,
  blendCeilingWeight: 0.3719,
  blendRoleStabilityWeight: 0.0957,
};

function parseTuningNumber(id, fallback, min, max) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!el || el.value === "") {
    return fallback;
  }
  let v = Number(el.value);
  if (Number.isNaN(v)) {
    return fallback;
  }
  if (min != null) {
    v = Math.max(min, v);
  }
  if (max != null) {
    v = Math.min(max, v);
  }
  return v;
}

function defaultTuningSnakeCase() {
  return {
    repeat_lambda: DEFAULT_GENERATOR_TUNING.repeatLambda,
    cv_uniform_blend: DEFAULT_GENERATOR_TUNING.cvUniformBlend,
    lineup_ceiling_nudge: DEFAULT_GENERATOR_TUNING.lineupCeilingNudge,
    lower_middle_bat_weight: DEFAULT_GENERATOR_TUNING.lowerMiddleBatWeight,
    cv_fairness_lambda: DEFAULT_GENERATOR_TUNING.cvFairnessLambda,
    blend_proj_weight: DEFAULT_GENERATOR_TUNING.blendProjWeight,
    blend_ceiling_weight: DEFAULT_GENERATOR_TUNING.blendCeilingWeight,
    blend_role_stability_weight: DEFAULT_GENERATOR_TUNING.blendRoleStabilityWeight,
  };
}

/** Map legacy preset / CSV tuning keys to the current single-strategy schema. */
function migrateLegacyTuningSnakeCase(raw) {
  const o = { ...raw };
  if (o.repeat_lambda == null && o.repeat_lambda_balanced != null) {
    o.repeat_lambda = o.repeat_lambda_balanced;
  }
  if (o.cv_uniform_blend == null && o.balanced_cv_uniform_blend != null) {
    o.cv_uniform_blend = o.balanced_cv_uniform_blend;
  }
  if (o.lineup_ceiling_nudge == null && o.balanced_lineup_ceiling_nudge != null) {
    o.lineup_ceiling_nudge = o.balanced_lineup_ceiling_nudge;
  }
  if (o.lower_middle_bat_weight == null && o.lower_middle_bat_weight_balanced != null) {
    o.lower_middle_bat_weight = o.lower_middle_bat_weight_balanced;
  }
  if (o.cv_fairness_lambda == null) {
    o.cv_fairness_lambda = CV_FAIRNESS_LAMBDA;
  }
  if (o.blend_proj_weight == null) {
    o.blend_proj_weight = DEFAULT_GENERATOR_TUNING.blendProjWeight;
  }
  if (o.blend_ceiling_weight == null) {
    o.blend_ceiling_weight = DEFAULT_GENERATOR_TUNING.blendCeilingWeight;
  }
  if (o.blend_role_stability_weight == null) {
    o.blend_role_stability_weight = DEFAULT_GENERATOR_TUNING.blendRoleStabilityWeight;
  }
  return o;
}

function setTuningInputsFromSnakeCase(t) {
  const normalized = migrateLegacyTuningSnakeCase({ ...defaultTuningSnakeCase(), ...t });
  const map = [
    ["repeat_lambda", "tuningRepeatLambda"],
    ["lineup_ceiling_nudge", "tuningLineupCeilingNudge"],
    ["cv_uniform_blend", "tuningCvUniformBlend"],
    ["cv_fairness_lambda", "tuningCvFairnessLambda"],
    ["lower_middle_bat_weight", "tuningLowerMiddleBatWeight"],
    ["blend_proj_weight", "tuningBlendProjWeight"],
    ["blend_ceiling_weight", "tuningBlendCeilingWeight"],
    ["blend_role_stability_weight", "tuningBlendRoleStabilityWeight"],
  ];
  map.forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (el && normalized[k] != null && normalized[k] !== "") {
      el.value = String(normalized[k]);
    }
  });
}

function applyGeneratorTuningPresetById(presetId) {
  if (!presetId) {
    setTuningInputsFromSnakeCase(defaultTuningSnakeCase());
    updateGeneratorAttemptsHint();
    return;
  }
  const row = (state.generatorTuningPresets || []).find((p) => p.id === presetId);
  if (!row || !row.tuning) {
    return;
  }
  setTuningInputsFromSnakeCase({ ...defaultTuningSnakeCase(), ...row.tuning });
  updateGeneratorAttemptsHint();
}

function populateTuningPresetSelect() {
  const sel = document.getElementById("tuningPresetSelect");
  if (!sel) {
    return;
  }
  sel.innerHTML = "";
  const base = document.createElement("option");
  base.value = "";
  base.textContent = "Default (app)";
  sel.appendChild(base);
  (state.generatorTuningPresets || []).forEach((p) => {
    if (!p || !p.id || p.id === "default") {
      return;
    }
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label || p.id;
    sel.appendChild(opt);
  });
}

function clearTuningPresetSelect() {
  const sel = document.getElementById("tuningPresetSelect");
  if (sel) {
    sel.value = "";
  }
}

function getGeneratorTuningFromUi() {
  const out = {
    repeatLambda: parseTuningNumber(
      "tuningRepeatLambda",
      DEFAULT_GENERATOR_TUNING.repeatLambda,
      0,
      3
    ),
    cvUniformBlend: parseTuningNumber(
      "tuningCvUniformBlend",
      DEFAULT_GENERATOR_TUNING.cvUniformBlend,
      0,
      1
    ),
    lineupCeilingNudge: parseTuningNumber(
      "tuningLineupCeilingNudge",
      DEFAULT_GENERATOR_TUNING.lineupCeilingNudge,
      0,
      0.5
    ),
    lowerMiddleBatWeight: parseTuningNumber(
      "tuningLowerMiddleBatWeight",
      DEFAULT_GENERATOR_TUNING.lowerMiddleBatWeight,
      0.05,
      1
    ),
    cvFairnessLambda: parseTuningNumber(
      "tuningCvFairnessLambda",
      DEFAULT_GENERATOR_TUNING.cvFairnessLambda,
      0,
      25
    ),
    blendProjWeight: parseTuningNumber(
      "tuningBlendProjWeight",
      DEFAULT_GENERATOR_TUNING.blendProjWeight,
      0,
      1
    ),
    blendCeilingWeight: parseTuningNumber(
      "tuningBlendCeilingWeight",
      DEFAULT_GENERATOR_TUNING.blendCeilingWeight,
      0,
      1
    ),
    blendRoleStabilityWeight: parseTuningNumber(
      "tuningBlendRoleStabilityWeight",
      DEFAULT_GENERATOR_TUNING.blendRoleStabilityWeight,
      0,
      1
    ),
  };
  const tot =
    out.blendProjWeight + out.blendCeilingWeight + out.blendRoleStabilityWeight;
  if (tot > 0) {
    out.blendProjWeight /= tot;
    out.blendCeilingWeight /= tot;
    out.blendRoleStabilityWeight /= tot;
  } else {
    out.blendProjWeight = DEFAULT_GENERATOR_TUNING.blendProjWeight;
    out.blendCeilingWeight = DEFAULT_GENERATOR_TUNING.blendCeilingWeight;
    out.blendRoleStabilityWeight = DEFAULT_GENERATOR_TUNING.blendRoleStabilityWeight;
  }
  return out;
}

/** One-line echo of effective tuning after a successful generate (matches getGeneratorTuningFromUi). */
function formatTuningSnapshotLine(tuning) {
  const t = tuning;
  return (
    "Tuning snapshot: " +
    `λ=${t.repeatLambda} · ceiling=${t.lineupCeilingNudge} · C/VC blend=${t.cvUniformBlend} · ` +
    `C/VC fair λ=${t.cvFairnessLambda} · bat≥6×=${t.lowerMiddleBatWeight} · ` +
    `blend[p=${t.blendProjWeight.toFixed(2)}, c=${t.blendCeilingWeight.toFixed(2)}, r=${t.blendRoleStabilityWeight.toFixed(2)}]`
  );
}

/** Down-weight pure batsmen / WK at typical slot 6+ (fewer balls faced). Matches UI “Bat slot ≥6 weight”. */
function lowerMiddleBatsmanDrawFactor(row, tuning) {
  const t = tuning || DEFAULT_GENERATOR_TUNING;
  const role = row.role;
  if (role !== "batsman" && role !== "wicket_keeper") {
    return 1;
  }
  const s = row.typicalSlot != null ? row.typicalSlot : 5;
  if (s < 6) {
    return 1;
  }
  const w =
    t.lowerMiddleBatWeight != null ? t.lowerMiddleBatWeight : DEFAULT_GENERATOR_TUNING.lowerMiddleBatWeight;
  return Math.max(0.05, Math.min(1, w));
}

/** C/VC pool score: mean form + a slice of ceiling upside. */
function blendedPlayerScore(row, tuning = DEFAULT_GENERATOR_TUNING) {
  const proj = Number(row.proj) || 0;
  const cap = Math.min(Number(row.ceiling) || 0, proj + 28);
  const rs = Math.max(0, Math.min(1, Number(row.roleStability) || 0));
  return (
    (tuning.blendProjWeight ?? DEFAULT_GENERATOR_TUNING.blendProjWeight) * proj +
    (tuning.blendCeilingWeight ?? DEFAULT_GENERATOR_TUNING.blendCeilingWeight) * cap +
    (tuning.blendRoleStabilityWeight ?? DEFAULT_GENERATOR_TUNING.blendRoleStabilityWeight) * (proj * rs)
  );
}

/** C/VC pool score: blended projection, upside, and role stability. */
function balancedCvScore(row, tuning = DEFAULT_GENERATOR_TUNING) {
  const cap = Math.min(Number(row.ceiling) || 0, (Number(row.proj) || 0) + 28);
  return blendedPlayerScore({ ...row, ceiling: cap }, tuning);
}

/** Chasing franchise for α/β (see docs/c_vc_scenario_combinations.md). */
function chaserFranchiseForScenario(scenarioId, teamAName, teamBName) {
  const s = String(scenarioId || "");
  if (s.startsWith("α")) {
    return teamBName;
  }
  if (s.startsWith("β")) {
    return teamAName;
  }
  return null;
}

/** Last digit of scenario id: 1=B1, 2=B2a, 4=B3 in the 6-cell set. */
function scenarioChaseSuffix(scenarioId) {
  const t = String(scenarioId || "").trim();
  const last = t.slice(-1);
  return /^[1-8]$/.test(last) ? last : "";
}

/**
 * Starter hard rules for C/VC pair vs scenario. Returns violation codes (empty = ok).
 * See docs/c_vc_scenario_combinations.md §4.
 */
function getCvScenarioLayerViolations(withSlot, captainName, viceName, scenarioId, layerOpts = null) {
  const teamA = teamASelect?.value || "";
  const teamB = teamBSelect?.value || "";
  const cRow = withSlot.find((r) => r.player === captainName);
  const vRow = withSlot.find((r) => r.player === viceName);
  if (!cRow || !vRow) {
    return ["missing_cvc_row"];
  }
  const violations = [];
  const skipDualBowler =
    layerOpts?.skipDualBowlerRule ||
    (layerOpts?.secondInningsFivePlayer && withSlot.length <= 5);
  if (!skipDualBowler && cRow.role === "bowler" && vRow.role === "bowler" && cRow.team === vRow.team) {
    violations.push("same_franchise_dual_bowler_cvc");
  }
  const ch = chaserFranchiseForScenario(scenarioId, teamA, teamB);
  const suf = scenarioChaseSuffix(scenarioId);
  if (ch && (suf === "1" || suf === "4")) {
    if (vRow.team === ch && vRow.role === "bowler") {
      violations.push("vc_chase_team_bowler_b1_b3");
    }
  }
  if (ch && suf === "4" && cRow.team === ch && cRow.role === "bowler") {
    violations.push("captain_chase_team_bowler_b3");
  }
  return violations;
}

/**
 * B3 cells (suffix 4): drop chasing-team bowlers from captain pool when possible (doc §9).
 * If that would empty the pool, keep the original list so a captain can still be chosen.
 */
function filterCaptainPoolForB3Scenario(capPool, scenarioId) {
  if (scenarioChaseSuffix(scenarioId) !== "4") {
    return capPool;
  }
  const teamA = teamASelect?.value || "";
  const teamB = teamBSelect?.value || "";
  const ch = chaserFranchiseForScenario(scenarioId, teamA, teamB);
  if (!ch) {
    return capPool;
  }
  const filtered = capPool.filter((r) => !(r.team === ch && r.role === "bowler"));
  return filtered.length ? filtered : capPool;
}

/**
 * Fallback when stochastic pick + VC repair fails: try captains in score order, then vices (same score formulas as primary pick).
 */
function findCaptainViceByRankedSearch(
  withSlot,
  capPool,
  vcPool,
  scenarioId,
  tuning,
  cvFair,
  dedupe,
  playersOut
) {
  const capRanked = [...capPool]
    .map((r) => ({
      r,
      score:
        balancedCvScore(r, tuning) * scenarioCvMultiplier(r, scenarioId, "captain") +
        captainFairnessBonus(r, tuning, cvFair),
    }))
    .sort((a, b) => b.score - a.score || poolPlayerKey(a.r).localeCompare(poolPlayerKey(b.r)));

  for (let i = 0; i < capRanked.length; i += 1) {
    const captain = capRanked[i].r.player;
    const rankedVc = vcPool
      .filter((r) => r.player !== captain)
      .map((r) => ({
        r,
        score:
          balancedCvScore(r, tuning) * scenarioCvMultiplier(r, scenarioId, "vice_captain") +
          viceFairnessBonus(r, tuning, cvFair),
      }))
      .sort((a, b) => b.score - a.score || poolPlayerKey(a.r).localeCompare(poolPlayerKey(b.r)));

    for (let j = 0; j < rankedVc.length; j += 1) {
      const viceCaptain = rankedVc[j].r.player;
      if (getCvScenarioLayerViolations(withSlot, captain, viceCaptain, scenarioId, dedupe?.cvLayerOpts).length) {
        continue;
      }
      if (dedupe?.seenKeys) {
        const key = dedupe.useSecondInningsKey
          ? buildSecondInningsUniquenessKey(playersOut, captain, viceCaptain, dedupe.secondInningsScenarioTag || "")
          : buildTeamUniquenessKey(playersOut, captain, viceCaptain);
        if (dedupe.seenKeys.has(key)) {
          continue;
        }
      }
      return { captain, viceCaptain };
    }
  }
  return null;
}

function normalizeTeamRowsForCv(team) {
  return team.map((r) => {
    const profile = getPlayerProfile(r.team, r.player);
    const typicalSlot =
      r.typicalSlot != null ? r.typicalSlot : resolveTypicalBattingSlot(r.team, r.player, profile);
    const role = getEffectiveLineupRole(r.team, r.player);
    return { ...r, typicalSlot, role };
  });
}

function buildCvPoolsFromNormalizedTeam(withSlot, cvPoolOpts = null, scenarioId = "α1") {
  const capKeys = cvPoolOpts?.capKeys;
  const vcKeys = cvPoolOpts?.vcKeys;
  if (capKeys instanceof Set && vcKeys instanceof Set && capKeys.size >= 1 && vcKeys.size >= 1) {
    let capPool = withSlot.filter((r) => capKeys.has(poolPlayerKey(r)));
    let vcPool = withSlot.filter((r) => vcKeys.has(poolPlayerKey(r)));
    if (cvPoolOpts?.secondInningsRelaxTeamIntersect) {
      const union = withSlot.filter(
        (r) => capKeys.has(poolPlayerKey(r)) || vcKeys.has(poolPlayerKey(r))
      );
      if (!capPool.length && union.length) {
        capPool = [...union];
      }
      if (!vcPool.length && union.length) {
        vcPool = [...union];
      }
      if ((!capPool.length || !vcPool.length) && withSlot.length >= 2) {
        capPool = capPool.length ? capPool : [...withSlot];
        vcPool = vcPool.length ? vcPool : [...withSlot];
      }
    }
    if (!capPool.length || !vcPool.length) {
      return null;
    }
    return { capPool, vcPool };
  }
  const unifiedEligibleKeySet = cvPoolOpts?.unifiedEligibleKeys ?? cvPoolOpts;
  if (unifiedEligibleKeySet instanceof Set && unifiedEligibleKeySet.size >= 2) {
    const eligible = withSlot.filter((r) => unifiedEligibleKeySet.has(poolPlayerKey(r)));
    if (eligible.length < 2) {
      return null;
    }
    return { capPool: eligible, vcPool: eligible };
  }
  let capPool = withSlot.filter((r) => rowAllowedByCvNamePool(r, "captain", scenarioId));
  const capHeavyFranchise = getFranchiseWithSevenPlayers(withSlot);
  if (capHeavyFranchise) {
    const fromHeavy = capPool.filter((r) => r.team === capHeavyFranchise);
    if (!fromHeavy.length) {
      return null;
    }
    capPool = fromHeavy;
  }
  if (!capPool.length) {
    return null;
  }
  const vcAll = withSlot.filter((r) => rowAllowedByCvNamePool(r, "vice_captain", scenarioId));
  const fourPlayerFranchise = getFranchiseWithFourOppositeSeven(withSlot);
  let vcPool = vcAll;
  if (fourPlayerFranchise) {
    vcPool = vcAll.filter((r) => !(r.team === fourPlayerFranchise && r.role === "bowler"));
  }
  if (!vcPool.length) {
    return null;
  }
  return { capPool, vcPool };
}

/**
 * If primary C/VC fails scenario layer, try other VCs (same C). Optionally reject VCs that duplicate seenKeys.
 * Returns { captain, viceCaptain } or null.
 */
function applyCvScenarioVerificationLayer(
  withSlot,
  vcPool,
  captain,
  viceCaptain,
  scenarioId,
  tuning,
  cvFair,
  dedupe
) {
  function pairAcceptable(vcPlayer) {
    if (getCvScenarioLayerViolations(withSlot, captain, vcPlayer, scenarioId, dedupe?.cvLayerOpts).length) {
      return false;
    }
    if (dedupe?.seenKeys && dedupe?.playersOut) {
      const key = dedupe.useSecondInningsKey
        ? buildSecondInningsUniquenessKey(
            dedupe.playersOut,
            captain,
            vcPlayer,
            dedupe.secondInningsScenarioTag || ""
          )
        : buildTeamUniquenessKey(dedupe.playersOut, captain, vcPlayer);
      if (dedupe.seenKeys.has(key)) {
        return false;
      }
    }
    return true;
  }

  if (pairAcceptable(viceCaptain)) {
    return { captain, viceCaptain };
  }

  const rankedVc = vcPool
    .filter((r) => r.player !== captain)
    .map((r) => ({
      r,
      score:
        balancedCvScore(r, tuning) * scenarioCvMultiplier(r, scenarioId, "vice_captain") +
        viceFairnessBonus(r, tuning, cvFair),
    }))
    .sort((a, b) => b.score - a.score);

  for (let i = 0; i < rankedVc.length; i += 1) {
    const cand = rankedVc[i].r.player;
    if (pairAcceptable(cand)) {
      return { captain, viceCaptain: cand };
    }
  }
  return null;
}

/** Expect `row.role` = getEffectiveLineupRole (top-order AR slot ≤5 counts as batsman for C/VC). */
function scenarioCvMultiplier(row, scenarioId, poolKind) {
  const role = String(row.role || "");
  const slot = Number(row.typicalSlot != null ? row.typicalSlot : 5);
  let phase = 1;
  const tail = String(scenarioId || "").slice(-1);
  if (/^[1-8]$/.test(tail)) {
    phase = Number(tail);
  }
  const isCap = poolKind === "captain";
  let m = 1;

  if (phase <= 2) {
    // Top-order batting heavy cells.
    if ((role === "batsman" || role === "wicket_keeper") && slot <= 3) {
      m *= isCap ? 1.18 : 1.1;
    }
    if (role === "bowler") {
      m *= isCap ? 0.92 : 0.96;
    }
  } else if (phase <= 4) {
    // Stable all-round balance cells.
    if (role === "all_rounder") {
      m *= 1.16;
    } else if (role === "bowler") {
      m *= isCap ? 1.02 : 1.06;
    }
  } else if (phase <= 6) {
    // Bowling-influence cells.
    if (role === "bowler") {
      m *= isCap ? 1.1 : 1.18;
    }
    if (role === "batsman" && slot >= 6) {
      m *= 0.92;
    }
  } else {
    // Mixed variance cells.
    if (role === "all_rounder" || role === "wicket_keeper") {
      m *= 1.1;
    }
    if (role === "batsman" && slot >= 3 && slot <= 5) {
      m *= 1.06;
    }
  }
  return Math.max(0.75, Math.min(1.35, m));
}

function buildCvPairStatKey(scenarioId, capRow, vcRow) {
  return `${String(scenarioId)}::${poolPlayerKey(capRow)}::${poolPlayerKey(vcRow)}`;
}

function incrementCvPairAcceptCounts(counts, scenarioId, captain, viceCaptain, team) {
  if (!counts) {
    return;
  }
  const cRow = team.find((r) => r.player === captain);
  const vRow = team.find((r) => r.player === viceCaptain);
  if (!cRow || !vRow) {
    return;
  }
  const k = buildCvPairStatKey(scenarioId, cRow, vRow);
  counts.set(k, (counts.get(k) || 0) + 1);
}

function enumerateLegalCvPairsForScenario(withSlot, capPool, vcPool, scenarioId, dedupeCtx) {
  const pairs = [];
  for (let i = 0; i < capPool.length; i += 1) {
    const capRow = capPool[i];
    for (let j = 0; j < vcPool.length; j += 1) {
      const vcRow = vcPool[j];
      if (capRow.player === vcRow.player) {
        continue;
      }
      if (
        getCvScenarioLayerViolations(withSlot, capRow.player, vcRow.player, scenarioId, dedupeCtx?.cvLayerOpts)
          .length
      ) {
        continue;
      }
      if (dedupeCtx?.seenKeys && dedupeCtx?.playersOut) {
        const uniqKey = dedupeCtx.useSecondInningsKey
          ? buildSecondInningsUniquenessKey(
              dedupeCtx.playersOut,
              capRow.player,
              vcRow.player,
              dedupeCtx.secondInningsScenarioTag || ""
            )
          : buildTeamUniquenessKey(dedupeCtx.playersOut, capRow.player, vcRow.player);
        if (dedupeCtx.seenKeys.has(uniqKey)) {
          continue;
        }
      }
      pairs.push({ capRow, vcRow });
    }
  }
  return pairs;
}

function pickCaptainViceByFairnessAmongLegal(legalPairs, scenarioId, pairCounts, tuning, cvFair) {
  if (!legalPairs.length) {
    return null;
  }
  const beta = CV_PAIR_FAIRNESS_BETA;
  const eps = CV_PAIR_COUNT_EPS;
  const unseenBoost = CV_PAIR_ZERO_UNSEEN_BOOST;
  const weights = legalPairs.map(({ capRow, vcRow }) => {
    const capS =
      balancedCvScore(capRow, tuning) * scenarioCvMultiplier(capRow, scenarioId, "captain") +
      captainFairnessBonus(capRow, tuning, cvFair);
    const vcS =
      balancedCvScore(vcRow, tuning) * scenarioCvMultiplier(vcRow, scenarioId, "vice_captain") +
      viceFairnessBonus(vcRow, tuning, cvFair);
    const joint = Math.max(1e-9, capS) * Math.max(1e-9, vcS);
    const statKey = buildCvPairStatKey(scenarioId, capRow, vcRow);
    const n = pairCounts?.get(statKey) || 0;
    let fair = 1 / (eps + n);
    if (n === 0) {
      fair *= unseenBoost;
    }
    return Math.max(1e-12, joint * fair ** beta);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < legalPairs.length; i += 1) {
    r -= weights[i];
    if (r <= 0) {
      return { captain: legalPairs[i].capRow.player, viceCaptain: legalPairs[i].vcRow.player };
    }
  }
  const last = legalPairs[legalPairs.length - 1];
  return { captain: last.capRow.player, viceCaptain: last.vcRow.player };
}

function pickBalancedScenarioCaptainVice(capPool, vcAll, tuning, cvFair, scenarioId) {
  const blend =
    tuning.cvUniformBlend != null ? tuning.cvUniformBlend : DEFAULT_GENERATOR_TUNING.cvUniformBlend;
  const captainRow = weightedPickByScoreWithUniformBlend(
    capPool,
    (r) =>
      balancedCvScore(r, tuning) * scenarioCvMultiplier(r, scenarioId, "captain") +
      captainFairnessBonus(r, tuning, cvFair),
    blend
  );
  if (!captainRow) {
    return null;
  }
  const vcCandidates = vcAll.filter((r) => r.player !== captainRow.player);
  if (!vcCandidates.length) {
    return null;
  }
  const viceCaptainRow = weightedPickByScoreWithUniformBlend(
    vcCandidates,
    (r) =>
      balancedCvScore(r, tuning) * scenarioCvMultiplier(r, scenarioId, "vice_captain") +
      viceFairnessBonus(r, tuning, cvFair),
    blend
  );
  return { captain: captainRow.player, viceCaptain: viceCaptainRow.player };
}

/** Picks one row: mix uniform (everyone in pool has a chance) with score-weighted mass. */
function weightedPickByScoreWithUniformBlend(rows, scoreFn, uniformBlend) {
  if (!rows || !rows.length) {
    return null;
  }
  const u = Math.min(1, Math.max(0, uniformBlend));
  const scores = rows.map((r) => Math.max(1e-9, scoreFn(r)));
  const maxS = Math.max(...scores);
  const n = rows.length;
  const weights = scores.map((s) => (1 - u) * (s / maxS) + u * (1 / n));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < rows.length; i += 1) {
    r -= weights[i];
    if (r <= 0) {
      return rows[i];
    }
  }
  return rows[rows.length - 1];
}

const state = {
  teamsByName: new Map(),
  formByTeam: {},
  profilesByTeam: {},
  /** teamName -> playerName -> { typical_slot } from `ipl2026_batting_slots.json` */
  battingSlotsByTeam: {},
  selectedPlayers: new Set(),
  generatedTeams: [],
  probableSeededTeams: new Set(),
  swapSourceTeams: [],
  swappedTeams: [],
  swapReportRows: [],
  postMatchSourceTeams: [],
  lastGeneratorConfig: { strategies: [], teamsPerStrategy: 200 },
  /** Loaded from `c_vc_pools.json`. */
  cvPoolsBase: null,
  /** Per-scenario, per-team C/VC overrides; persisted in localStorage (`byScenario`). */
  cvPoolsEdited: { byScenario: {} },
  /** Full team name -> short code (e.g. CSK). */
  teamAbbreviations: {},
  /** Last post-match scored rows (for PDF re-open). */
  lastPostMatchScored: null,
  /** Display names for each batch slot (index 0 = first candidate). */
  candidateNames: [...DEFAULT_CANDIDATE_NAMES],
  /** From `data/generator_tuning_presets.json` (optional). */
  generatorTuningPresets: [],
  /** Two pools for `bat_first_pool_xi`; pick counts follow fixed batch phases. */
  batPools: {
    fixtureKey: "",
    p1: [],
    p2: [],
    split74Quota: DEFAULT_BAT_FIRST_SPLIT74_QUOTA,
    lineupDupStages: [...DEFAULT_BAT_FIRST_LINEUP_DUP_STAGES],
    /** Split of 6+5 vs 5+6 among teams that use full P1+P2. */
    fullSegmentPercents: { ...DEFAULT_BAT_FIRST_SEGMENT_PERCENTS },
    /** Split of 6+5 vs 5+6 among teams that use reduced pools (after exclusions). */
    reducedSegmentPercents: { ...DEFAULT_BAT_FIRST_SEGMENT_PERCENTS },
    /** 0–100: first N teams use full pools; others exclude `reducedExcludeIds`. */
    fullPoolPercent: DEFAULT_BAT_FIRST_FULL_POOL_PCT,
    /** Player ids (`team::name`) removed from P1/P2 only in the reduced segment. */
    reducedExcludeIds: [],
  },
  splitPools: {
    fixtureKey: "",
    teamA: { p1: [], p2: [], p3: [] },
    teamB: { p1: [], p2: [], p3: [] },
    /** First N generated teams use full P1/P2/P3; rest exclude `reducedExcludeIds`. */
    fullPoolPercent: DEFAULT_SPLIT_POOL_FULL_POOL_PCT,
    reducedExcludeIds: [],
    lineupDupStages: [...DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES],
  },
  secondInningsPools: {
    fixtureKey: "",
    chasingTeam: "",
    p1Top: [],
    p1Rest: [],
    p2: [],
    /** % of generated teams built with chase-middle combos (remainder use first-innings bowl combos). */
    chaseScenarioPercent: DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT,
    /** Top–Rest–P2 counts per variant (sum 5); rotation across teams. */
    chaseComboSpec: DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC,
    bowlComboSpec: DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC,
    /** Per-scenario captain / vice pools (`team::name` ids). */
    scenarioCv: {
      chase: { captainPool: [], viceCaptainPool: [] },
      bowl: { captainPool: [], viceCaptainPool: [] },
    },
  },
};

const teamASelect = document.getElementById("teamA");
const teamBSelect = document.getElementById("teamB");
const teamATitle = document.getElementById("teamATitle");
const teamBTitle = document.getElementById("teamBTitle");
const teamAPlayers = document.getElementById("teamAPlayers");
const teamBPlayers = document.getElementById("teamBPlayers");
const selectedCount = document.getElementById("selectedCount");
const selectedTeams = document.getElementById("selectedTeams");
const resetBtn = document.getElementById("resetBtn");
const generateTeamsBtn = document.getElementById("generateTeamsBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const generatorStatus = document.getElementById("generatorStatus");
const generatorTuningSnapshot = document.getElementById("generatorTuningSnapshot");
const qualitySummary = document.getElementById("qualitySummary");
const teamsPerStrategyInput = document.getElementById("teamsPerStrategyInput");
const scenarioProfileSelect = document.getElementById("scenarioProfileSelect");
const generatorAttemptsHint = document.getElementById("generatorAttemptsHint");
const swapCsvInput = document.getElementById("swapCsvInput");
const addSwapRuleBtn = document.getElementById("addSwapRuleBtn");
const applySwapsBtn = document.getElementById("applySwapsBtn");
const downloadSwappedCsvBtn = document.getElementById("downloadSwappedCsvBtn");
const downloadSwapReportBtn = document.getElementById("downloadSwapReportBtn");
const swapRulesContainer = document.getElementById("swapRulesContainer");
const swapStatus = document.getElementById("swapStatus");
const swapPreview = document.getElementById("swapPreview");
const tabGeneratorBtn = document.getElementById("tabGeneratorBtn");
const tabSwapBtn = document.getElementById("tabSwapBtn");
const tabPostMatchBtn = document.getElementById("tabPostMatchBtn");
const generatorPanel = document.getElementById("generatorPanel");
const swapPanel = document.getElementById("swapPanel");
const postMatchPanel = document.getElementById("postMatchPanel");
const postMatchCsvInput = document.getElementById("postMatchCsvInput");
const postMatchPlayersInputs = document.getElementById("postMatchPlayersInputs");
const topTeamPointsInput = document.getElementById("topTeamPointsInput");
const analyzePostMatchBtn = document.getElementById("analyzePostMatchBtn");
const postMatchStatus = document.getElementById("postMatchStatus");
const postMatchSummary = document.getElementById("postMatchSummary");
const postMatchDateInput = document.getElementById("postMatchDateInput");
const cvcPoolTeamA = document.getElementById("cvcPoolTeamA");
const cvcPoolTeamB = document.getElementById("cvcPoolTeamB");
const secondInningsChasingTeamSelect = document.getElementById("secondInningsChasingTeamSelect");
const batFirstFullSegAPctInput = document.getElementById("batFirstFullSegAPctInput");
const batFirstFullSegBPctInput = document.getElementById("batFirstFullSegBPctInput");
const batFirstReducedSegAPctInput = document.getElementById("batFirstReducedSegAPctInput");
const batFirstReducedSegBPctInput = document.getElementById("batFirstReducedSegBPctInput");
const batFirstFullPoolPctInput = document.getElementById("batFirstFullPoolPctInput");
const batFirstReducedExcludeHost = document.getElementById("batFirstReducedExcludeHost");
const batFirstDupStage1Input = document.getElementById("batFirstDupStage1Input");
const batFirstDupStage2Input = document.getElementById("batFirstDupStage2Input");
const batFirstDupStage3Input = document.getElementById("batFirstDupStage3Input");

async function fetchJson(path) {
  // Avoid stale JSON when editing data/*.json during local dev (browser HTTP cache).
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

function loadStoredSelection() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((p) => state.selectedPlayers.add(p));
    }
  } catch (error) {
    console.warn("Could not parse stored selection", error);
  }
}

function persistSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.selectedPlayers)));
}

/** Drop picks that are not on either current match squad (stale IDs from other fixtures in localStorage). */
function pruneSelectionToCurrentMatch() {
  const a = teamASelect?.value;
  const b = teamBSelect?.value;
  if (!a || !b) {
    return;
  }
  const allowed = new Set();
  [a, b].forEach((teamName) => {
    buildRoster(teamName).forEach((row) => {
      allowed.add(playerId(teamName, row.name));
    });
  });
  Array.from(state.selectedPlayers).forEach((id) => {
    if (!allowed.has(id)) {
      state.selectedPlayers.delete(id);
    }
  });
}

function allHighScoringScenarioIdsForMigration() {
  const ids = new Set();
  Object.values(HIGH_SCORING_SCENARIO_PROFILES).forEach((arr) => {
    (arr || []).forEach((id) => ids.add(id));
  });
  return [...ids];
}

function isLegacyCvPoolsFlatShape(obj) {
  if (!obj || typeof obj !== "object" || obj.byScenario) {
    return false;
  }
  return Object.values(obj).some(
    (v) => v && typeof v === "object" && (Array.isArray(v.captain_pool) || Array.isArray(v.vice_captain_pool))
  );
}

function migrateLegacyCvPoolsFlatToByScenario(flat) {
  const byScenario = {};
  allHighScoringScenarioIdsForMigration().forEach((scenarioId) => {
    byScenario[scenarioId] = {};
    Object.keys(flat).forEach((teamName) => {
      const entry = flat[teamName];
      if (entry && typeof entry === "object") {
        byScenario[scenarioId][teamName] = sanitizeCvPoolsEntry(entry);
      }
    });
  });
  return { byScenario };
}

function ensureCvPoolsEditedShape() {
  if (!state.cvPoolsEdited || typeof state.cvPoolsEdited !== "object") {
    state.cvPoolsEdited = { byScenario: {} };
    return;
  }
  if (state.cvPoolsEdited.byScenario && typeof state.cvPoolsEdited.byScenario === "object") {
    return;
  }
  if (isLegacyCvPoolsFlatShape(state.cvPoolsEdited)) {
    state.cvPoolsEdited = migrateLegacyCvPoolsFlatToByScenario(state.cvPoolsEdited);
    return;
  }
  state.cvPoolsEdited = { byScenario: {} };
}

function loadCvPoolOverrides() {
  const parseStored = (raw) => {
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  };
  try {
    let parsed = parseStored(localStorage.getItem(CV_POOLS_STORAGE_KEY));
    if (!parsed) {
      parsed = parseStored(localStorage.getItem(CV_POOLS_STORAGE_KEY_LEGACY));
      if (parsed) {
        if (isLegacyCvPoolsFlatShape(parsed)) {
          parsed = migrateLegacyCvPoolsFlatToByScenario(parsed);
        } else if (!parsed.byScenario) {
          parsed = { byScenario: {} };
        }
        try {
          localStorage.setItem(CV_POOLS_STORAGE_KEY, JSON.stringify(parsed));
        } catch {
          /* ignore */
        }
      }
    }
    if (!parsed) {
      return { byScenario: {} };
    }
    if (parsed.byScenario && typeof parsed.byScenario === "object") {
      return { byScenario: parsed.byScenario };
    }
    if (isLegacyCvPoolsFlatShape(parsed)) {
      return migrateLegacyCvPoolsFlatToByScenario(parsed);
    }
    return { byScenario: {} };
  } catch (error) {
    console.warn("Could not parse C/VC pool overrides", error);
    return { byScenario: {} };
  }
}

function persistCvPools() {
  ensureCvPoolsEditedShape();
  localStorage.setItem(CV_POOLS_STORAGE_KEY, JSON.stringify(state.cvPoolsEdited));
}

function getCvPoolsEditedBucketForScenario(scenarioId) {
  ensureCvPoolsEditedShape();
  const sid = String(scenarioId || "").trim();
  if (!sid) {
    return {};
  }
  if (!state.cvPoolsEdited.byScenario[sid]) {
    state.cvPoolsEdited.byScenario[sid] = {};
  }
  return state.cvPoolsEdited.byScenario[sid];
}

function getEffectiveCvPoolsForScenario(scenarioId) {
  const basePools = state.cvPoolsBase?.pools || {};
  const edited = getCvPoolsEditedBucketForScenario(scenarioId);
  const out = {};
  state.teamsByName.forEach((_t, teamName) => {
    const b = basePools[teamName] || { captain_pool: [], vice_captain_pool: [] };
    const e = edited[teamName];
    const merged = e
      ? {
          captain_pool: Array.isArray(e.captain_pool) ? [...e.captain_pool] : [...b.captain_pool],
          vice_captain_pool: Array.isArray(e.vice_captain_pool)
            ? [...e.vice_captain_pool]
            : [...b.vice_captain_pool],
        }
      : { captain_pool: [...b.captain_pool], vice_captain_pool: [...b.vice_captain_pool] };
    out[teamName] = sanitizeCvPoolsEntry(merged);
  });
  return out;
}

/** @deprecated Use getEffectiveCvPoolsForScenario; kept for callers without a scenario id. */
function getEffectiveCvPools(scenarioId = null) {
  const sid = scenarioId || getActiveHighScoringScenarioIds()[0] || "α1";
  return getEffectiveCvPoolsForScenario(sid);
}

function getFirstInningsAndChaseAbbrevsForScenario(scenarioId) {
  const a = teamASelect?.value || "";
  const b = teamBSelect?.value || "";
  const isBeta = String(scenarioId || "").startsWith("β");
  const fFull = isBeta ? b : a;
  const chFull = isBeta ? a : b;
  return {
    F: getTeamAbbrev(fFull),
    Ch: getTeamAbbrev(chFull),
  };
}

function fillScenarioCvHintTemplate(template, abbrevs) {
  return String(template || "")
    .replace(/\{F\}/g, abbrevs.F || "F")
    .replace(/\{Ch\}/g, abbrevs.Ch || "Ch");
}

function getScenarioCvPoolTitle(scenarioId) {
  const sid = String(scenarioId || "").trim();
  if (isSplitPoolProfileScenarioId(sid)) {
    const tpl = SPLIT_POOL_CV_HINT_TEMPLATES[sid];
    const abbrevs = getSplitPoolAbbrevs();
    return `Profile ${sid} — ${abbrevs.A} vs ${abbrevs.B}`;
  }
  const { F, Ch } = getFirstInningsAndChaseAbbrevsForScenario(sid);
  return `Scenario ${sid} — ${F} bat first, ${Ch} chase`;
}

function getScenarioCvPoolOutcomeLine(scenarioId) {
  const sid = String(scenarioId || "").trim();
  if (isSplitPoolProfileScenarioId(sid)) {
    const tpl = SPLIT_POOL_CV_HINT_TEMPLATES[sid];
    return tpl?.story ? `Lineup shape: ${tpl.story}` : "";
  }
  const suf = scenarioChaseSuffix(scenarioId);
  const tpl = HIGH_SCORING_SCENARIO_OUTCOME_TEMPLATES[suf];
  if (!tpl) {
    return "";
  }
  const abbrevs = getFirstInningsAndChaseAbbrevsForScenario(scenarioId);
  return `Expected outcome: ${fillScenarioCvHintTemplate(tpl, abbrevs)}`;
}

function getScenarioCvPoolHint(scenarioId) {
  const sid = String(scenarioId || "").trim();
  if (isSplitPoolProfileScenarioId(sid)) {
    const tpl = SPLIT_POOL_CV_HINT_TEMPLATES[sid];
    const abbrevs = getSplitPoolAbbrevs();
    if (!tpl) {
      return `**C / VC:** Tick players who fit profile ${sid} (use P1/P2/P3 bands).`;
    }
    const cap = fillSplitPoolCvHintTemplate(tpl.captain, abbrevs);
    const vc = fillSplitPoolCvHintTemplate(tpl.vice, abbrevs);
    return `**C:** ${cap}. **VC:** ${vc}.`;
  }
  const suf = scenarioChaseSuffix(sid);
  const abbrevs = getFirstInningsAndChaseAbbrevsForScenario(sid);
  const tpl = HIGH_SCORING_SCENARIO_CV_HINT_TEMPLATES[suf];
  if (!tpl) {
    return `**C / VC:** Tick batters, bowlers, or all-rounders who fit scenario ${sid} for this match.`;
  }
  const cap = fillScenarioCvHintTemplate(tpl.captain, abbrevs);
  const vc = fillScenarioCvHintTemplate(tpl.vice, abbrevs);
  return `**C:** ${cap}. **VC:** ${vc}.`;
}

/** 2nd-innings C/VC role guide ({F} = team that batted first, {Ch} = chasing team). */
const SECOND_INNINGS_CV_HINT_TEMPLATES = {
  si_chase_middle: {
    captain: "Chase Top or Rest pool",
    vice: "Chase Rest or first-innings P2 pool",
  },
  si_first_innings_bowl: {
    captain: "First-innings P2 pool only",
    vice: "Chase Top, Rest, or P2 pool",
  },
};

const SECOND_INNINGS_CV_PDF_HINT_TEMPLATES = SECOND_INNINGS_CV_HINT_TEMPLATES;

const SECOND_INNINGS_OUTCOME_PDF = {
  si_chase_middle: "{Ch} chase-middle · 5 from {Ch} top/rest + {F} P2",
  si_first_innings_bowl: "{F} bowl-heavy · 5 with more {F} P2 bowlers/AR",
};

function getSecondInningsAbbrevsForPdf() {
  const chaseFull = getSecondInningsChasingTeamFromUi();
  const a = teamASelect?.value || "";
  const b = teamBSelect?.value || "";
  const firstFull = a === chaseFull ? b : a;
  return {
    F: getTeamAbbrev(firstFull),
    Ch: getTeamAbbrev(chaseFull),
    FFull: firstFull,
    ChFull: chaseFull,
  };
}

function getSecondInningsScenarioCvHintText(scenarioTag) {
  const tag = scenarioTag === "si_first_innings_bowl" ? "si_first_innings_bowl" : "si_chase_middle";
  const abbrevs = getSecondInningsAbbrevsForPdf();
  const tpl = SECOND_INNINGS_CV_HINT_TEMPLATES[tag];
  if (!tpl) {
    return "";
  }
  const cap = fillScenarioCvHintTemplate(tpl.captain, abbrevs);
  const vc = fillScenarioCvHintTemplate(tpl.vice, abbrevs);
  return `**C:** ${cap}. **VC:** ${vc}.`;
}

/** Compact outcome + C/VC guide for fantasy team PDF cards (last-minute edits). */
function getTeamPdfScenarioGuideHtml(row) {
  const hss = String(row.highScoreScenario || "").trim();
  if (!hss) {
    return "";
  }
  let label = "";
  let outcome = "";
  let capGuide = "";
  let vcGuide = "";

  if (hss === "si_chase_middle" || hss === "si_first_innings_bowl") {
    const abbrevs = getSecondInningsAbbrevsForPdf();
    label =
      hss === "si_chase_middle"
        ? `2nd inns · chase-middle · ${abbrevs.Ch} chase, ${abbrevs.F} bat 1st`
        : `2nd inns · bowl-first · ${abbrevs.F} P2-heavy, ${abbrevs.Ch} chase`;
    const outTpl = SECOND_INNINGS_OUTCOME_PDF[hss];
    outcome = outTpl ? fillScenarioCvHintTemplate(outTpl, abbrevs) : "";
    const cvTpl = SECOND_INNINGS_CV_HINT_TEMPLATES[hss];
    if (cvTpl) {
      capGuide = fillScenarioCvHintTemplate(cvTpl.captain, abbrevs);
      vcGuide = fillScenarioCvHintTemplate(cvTpl.vice, abbrevs);
    }
  } else if (hss.startsWith("α") || hss.startsWith("β")) {
    const { F, Ch } = getFirstInningsAndChaseAbbrevsForScenario(hss);
    const suf = scenarioChaseSuffix(hss);
    const abbrevs = getFirstInningsAndChaseAbbrevsForScenario(hss);
    label = `${hss} · ${F} bat, ${Ch} chase`;
    const outcomeTpl = HIGH_SCORING_SCENARIO_OUTCOME_TEMPLATES[suf];
    const cvTpl = HIGH_SCORING_SCENARIO_CV_HINT_TEMPLATES[suf];
    if (outcomeTpl) {
      outcome = fillScenarioCvHintTemplate(outcomeTpl, abbrevs);
    }
    if (cvTpl) {
      capGuide = fillScenarioCvHintTemplate(cvTpl.captain, abbrevs);
      vcGuide = fillScenarioCvHintTemplate(cvTpl.vice, abbrevs);
    }
  } else if (isSplitPoolProfileScenarioId(hss)) {
    const abbrevs = getSplitPoolAbbrevs();
    const tpl = SPLIT_POOL_CV_HINT_TEMPLATES[hss];
    label = `Split profile ${hss} · ${abbrevs.A} vs ${abbrevs.B}`;
    outcome = tpl?.story ? `Lineup: ${tpl.story}` : "";
    if (tpl) {
      capGuide = fillSplitPoolCvHintTemplate(tpl.captain, abbrevs);
      vcGuide = fillSplitPoolCvHintTemplate(tpl.vice, abbrevs);
    }
  } else {
    return "";
  }

  const parts = [
    `<div class="team-card-scenario-line"><strong>${escapeHtmlLite(label)}</strong>${outcome ? ` · ${escapeHtmlLite(outcome)}` : ""}</div>`,
  ];
  if (capGuide || vcGuide) {
    parts.push(
      `<div class="team-card-scenario-line"><strong>C:</strong> ${escapeHtmlLite(capGuide)} · <strong>VC:</strong> ${escapeHtmlLite(vcGuide)}</div>`
    );
  }
  return `<div class="team-card-scenario-hint">${parts.join("")}</div>`;
}

const FANTASY_TEAMS_PRINT_CARD_CSS = `
      .team-card { border: 1px solid #ccc; border-radius: 8px; padding: 10px; margin-bottom: 8px; page-break-inside: avoid; }
      h3 { margin: 0 0 6px; font-size: 14px; }
      .team-card-cvc { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 14px; }
      .team-card-scenario-hint { margin-top: 8px; padding: 6px 8px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 11px; line-height: 1.4; color: #334155; }
      .team-card-scenario-line { margin: 0 0 4px; }
      .team-card-scenario-line:last-child { margin-bottom: 0; }
`;

function getCvPlayerShape(teamName, playerName) {
  const profile = getPlayerProfile(teamName, playerName);
  const role = getEffectiveLineupRole(teamName, playerName);
  const rawRole = getRawProfileRole(teamName, playerName);
  const slot = resolveTypicalBattingSlot(teamName, playerName, profile);
  return {
    role,
    rawRole,
    slot: slot != null && Number.isFinite(Number(slot)) ? Number(slot) : 99,
  };
}

function isTopOrderBatterShape(shape) {
  if (shape.role === "wicket_keeper") {
    return true;
  }
  return shape.role === "batsman" && shape.slot <= 3;
}

function isMiddleOrderBatterShape(shape) {
  if (shape.role === "bowler") {
    return false;
  }
  if (shape.role === "batsman" && shape.slot >= 4) {
    return true;
  }
  return shape.role === "all_rounder" && shape.slot >= 4 && shape.slot <= 7;
}

function isBattingSlot23Shape(shape) {
  return (
    (shape.role === "batsman" || shape.role === "wicket_keeper") && shape.slot >= 2 && shape.slot <= 3
  );
}

function isBowlerShape(shape) {
  return shape.role === "bowler" || shape.rawRole === "bowler";
}

function isBattingAllRounderShape(shape) {
  if (shape.rawRole !== "all_rounder") {
    return false;
  }
  if (shape.role === "batsman") {
    return true;
  }
  return shape.slot <= 7;
}

function isChaseAnchorBatterShape(teamName, shape, chTeam) {
  if (teamName !== chTeam || shape.role === "bowler") {
    return false;
  }
  if (shape.role === "batsman" && shape.slot >= 4) {
    return true;
  }
  return shape.rawRole === "all_rounder" && shape.slot >= 4;
}

function getFirstAndChaseTeamsForScenario(scenarioId) {
  const teamA = teamASelect?.value || "";
  const teamB = teamBSelect?.value || "";
  const chTeam = chaserFranchiseForScenario(scenarioId, teamA, teamB);
  const fTeam = chTeam === teamA ? teamB : teamA;
  return { fTeam, chTeam };
}

/** Which ticked players belong in C / VC pools for a high-scoring scenario cell (by role + slot + F/Ch side). */
function classifyTickedPlayerForHighScoringCv(scenarioId, teamName, playerName) {
  const { fTeam, chTeam } = getFirstAndChaseTeamsForScenario(scenarioId);
  const suf = scenarioChaseSuffix(scenarioId);
  const shape = getCvPlayerShape(teamName, playerName);
  const onF = teamName === fTeam;
  const onCh = teamName === chTeam;
  let captain = false;
  let vice = false;

  if (suf === "1") {
    if (onCh && isTopOrderBatterShape(shape)) {
      captain = true;
      vice = true;
    }
    if (onF && isTopOrderBatterShape(shape)) {
      captain = true;
    }
    if (onF && isBattingSlot23Shape(shape)) {
      vice = true;
    }
    if (onCh && isBattingAllRounderShape(shape)) {
      vice = true;
    }
  } else if (suf === "2") {
    if (onCh && isMiddleOrderBatterShape(shape)) {
      captain = true;
    }
    if (onF && isBowlerShape(shape)) {
      vice = true;
    }
    if (onF && isTopOrderBatterShape(shape)) {
      vice = true;
    }
    if (onCh && shape.rawRole === "all_rounder") {
      vice = true;
    }
  } else if (suf === "4") {
    if (onF && (isBowlerShape(shape) || isTopOrderBatterShape(shape))) {
      captain = true;
    }
    if (onF && isBowlerShape(shape)) {
      vice = true;
    }
    if (onF && (shape.role === "batsman" || shape.role === "wicket_keeper" || isBattingAllRounderShape(shape))) {
      vice = true;
    }
    if (onCh && isChaseAnchorBatterShape(teamName, shape, chTeam)) {
      vice = true;
    }
    if (onCh && isBattingAllRounderShape(shape)) {
      vice = true;
    }
  }
  return { captain, vice };
}

/** Which 2nd-innings lineup pool holds this player (`top` | `rest` | `p2`), or null. */
function getSecondInningsPoolKindForPlayerId(playerId) {
  if ((state.secondInningsPools.p1Top || []).includes(playerId)) {
    return "top";
  }
  if ((state.secondInningsPools.p1Rest || []).includes(playerId)) {
    return "rest";
  }
  if ((state.secondInningsPools.p2 || []).includes(playerId)) {
    return "p2";
  }
  return null;
}

/**
 * Pool-based C/VC eligibility (not role-based).
 * Chase-middle: C ∈ Top∪Rest, VC ∈ Rest∪P2.
 * First-innings bowl: C ∈ P2, VC ∈ Top∪Rest∪P2.
 */
function getSecondInningsPoolBasedCvIds(scenarioKey, eligibleIdSet) {
  const top = state.secondInningsPools.p1Top || [];
  const rest = state.secondInningsPools.p1Rest || [];
  const p2 = state.secondInningsPools.p2 || [];
  const capIds = [];
  const vcIds = [];
  const allow = (id) => eligibleIdSet.has(id);

  if (scenarioKey === "bowl") {
    p2.forEach((id) => {
      if (allow(id)) {
        capIds.push(id);
      }
    });
    [...top, ...rest, ...p2].forEach((id) => {
      if (allow(id) && !vcIds.includes(id)) {
        vcIds.push(id);
      }
    });
  } else {
    [...top, ...rest].forEach((id) => {
      if (allow(id)) {
        capIds.push(id);
      }
    });
    [...rest, ...p2].forEach((id) => {
      if (allow(id) && !vcIds.includes(id)) {
        vcIds.push(id);
      }
    });
  }
  return { capIds, vcIds };
}

function classifyTickedPlayerForSecondInningsCv(scenarioKey, teamName, playerName) {
  const playerId = `${teamName}::${playerName}`;
  const pool = getSecondInningsPoolKindForPlayerId(playerId);
  if (!pool) {
    return { captain: false, vice: false };
  }
  if (scenarioKey === "bowl") {
    return {
      captain: pool === "p2",
      vice: pool === "top" || pool === "rest" || pool === "p2",
    };
  }
  return {
    captain: pool === "top" || pool === "rest",
    vice: pool === "rest" || pool === "p2",
  };
}

/** Ticked players whose roles match this scenario’s C/VC suggestions (per team). */
function getSuggestedCvPlayerNamesForHighScoringScenario(teamName, scenarioId) {
  const out = new Set();
  getCvEligiblePlayerNamesForTeam(teamName).forEach((playerName) => {
    const { captain, vice } = classifyTickedPlayerForHighScoringCv(scenarioId, teamName, playerName);
    if (captain || vice) {
      out.add(playerName);
    }
  });
  return out;
}

/** Player ids in chase/P2 pools whose roles match this 2nd-innings scenario’s C/VC suggestions. */
function getSuggestedSecondInningsCvPlayerIds(scenarioKey) {
  const out = new Set();
  getSecondInningsUnionPlayerIds().forEach((id) => {
    if (!state.selectedPlayers.has(id)) {
      return;
    }
    const sep = id.indexOf("::");
    const teamName = sep >= 0 ? id.slice(0, sep) : "";
    const playerName = sep >= 0 ? id.slice(sep + 2) : "";
    if (!teamName || !playerName) {
      return;
    }
    const { captain, vice } = classifyTickedPlayerForSecondInningsCv(scenarioKey, teamName, playerName);
    if (captain || vice) {
      out.add(id);
    }
  });
  return out;
}

function suggestCvPoolsForHighScoringScenario(scenarioId) {
  const teams = [teamASelect?.value, teamBSelect?.value].filter(Boolean);
  const out = {};
  teams.forEach((teamName) => {
    out[teamName] = { captain_pool: [], vice_captain_pool: [] };
    getCvEligiblePlayerNamesForTeam(teamName).forEach((playerName) => {
      const { captain, vice } = classifyTickedPlayerForHighScoringCv(scenarioId, teamName, playerName);
      if (captain) {
        out[teamName].captain_pool.push(playerName);
      }
      if (vice) {
        out[teamName].vice_captain_pool.push(playerName);
      }
    });
    out[teamName].captain_pool.sort((a, b) => a.localeCompare(b));
    out[teamName].vice_captain_pool.sort((a, b) => a.localeCompare(b));
  });
  return out;
}

function suggestSecondInningsScenarioCvIds(scenarioKey) {
  const captainPool = [];
  const viceCaptainPool = [];
  const union = new Set(getSecondInningsUnionPlayerIds());
  union.forEach((id) => {
    if (!state.selectedPlayers.has(id)) {
      return;
    }
    const sep = id.indexOf("::");
    const teamName = sep >= 0 ? id.slice(0, sep) : "";
    const playerName = sep >= 0 ? id.slice(sep + 2) : "";
    if (!teamName || !playerName) {
      return;
    }
    const { captain, vice } = classifyTickedPlayerForSecondInningsCv(scenarioKey, teamName, playerName);
    if (captain) {
      captainPool.push(id);
    }
    if (vice) {
      viceCaptainPool.push(id);
    }
  });
  return { captainPool, viceCaptainPool };
}

function applySuggestedCvPoolsToHighScoringScenario(scenarioId, suggestedByTeam) {
  const bucket = getCvPoolsEditedBucketForScenario(scenarioId);
  Object.keys(suggestedByTeam).forEach((teamName) => {
    bucket[teamName] = sanitizeCvPoolsEntry(suggestedByTeam[teamName]);
  });
}

/** Prefill C/VC ticks from scenario role rules (ticked squad only). Replaces existing ticks per scenario. */
function autoFillCvPoolsFromScenarioRoles() {
  const mode = getGeneratorModeFromUi();
  if (mode === STRATEGY_ID_SECOND_INNINGS) {
    ensureSecondInningsScenarioCvShape();
    ["chase", "bowl"].forEach((sk) => {
      const suggested = suggestSecondInningsScenarioCvIds(sk);
      state.secondInningsPools.scenarioCv[sk] = {
        captainPool: [...suggested.captainPool],
        viceCaptainPool: [...suggested.viceCaptainPool],
      };
    });
    persistSecondInningsPools();
    renderSecondInningsPoolPanel();
    return;
  }
  if (mode === STRATEGY_ID_SPLIT_POOL) {
    SPLIT_POOL_PROFILE_IDS.forEach((profileId) => {
      applySuggestedCvPoolsToHighScoringScenario(
        profileId,
        suggestCvPoolsForSplitPoolProfile(profileId)
      );
    });
  } else {
    getActiveHighScoringScenarioIds().forEach((scenarioId) => {
      applySuggestedCvPoolsToHighScoringScenario(scenarioId, suggestCvPoolsForHighScoringScenario(scenarioId));
    });
  }
  persistCvPools();
  renderCvPoolPanels();
}

/** Pool names for one kind (captain/vice) ∩ eligible names. */
function getCvPoolNameSetForTeam(teamName, poolKind, scenarioId) {
  const entry = getEffectiveCvPoolsForScenario(scenarioId)[teamName];
  if (!entry) {
    return new Set();
  }
  const eligible = getCvEligiblePlayerNamesForTeam(teamName);
  const arr =
    poolKind === "captain"
      ? entry.captain_pool || []
      : entry.vice_captain_pool || [];
  const out = new Set();
  arr.forEach((n) => {
    if (eligible.has(n)) {
      out.add(n);
    }
  });
  return out;
}

/** Names that may appear in C/VC pools: ticked squad players for this match only. */
function getCvEligiblePlayerNamesForTeam(teamName) {
  const roster = buildRoster(teamName);
  const rosterSet = new Set(roster.map((r) => r.name));
  const ticked = getSelectedPlayerNamesForTeam(teamName);
  const effective = new Set();
  ticked.forEach((n) => {
    if (rosterSet.has(n)) {
      effective.add(n);
    }
  });
  return effective;
}

function sanitizeCvPoolsEntry(entry) {
  if (!entry) {
    return { captain_pool: [], vice_captain_pool: [] };
  }
  const cap = [...new Set(entry.captain_pool || [])].sort((a, b) => a.localeCompare(b));
  const vc = [...new Set(entry.vice_captain_pool || [])].sort((a, b) => a.localeCompare(b));
  return { captain_pool: cap, vice_captain_pool: vc };
}

function getSelectedPlayerNamesForTeam(teamName) {
  const out = new Set();
  state.selectedPlayers.forEach((id) => {
    const [t, p] = id.split("::");
    if (t === teamName && p) {
      out.add(p);
    }
  });
  return out;
}

/** C/VC selection: player must appear in the requested pool kind for their franchise (per scenario). */
function rowAllowedByCvNamePool(row, poolKind, scenarioId) {
  const kind = poolKind === "captain" ? "captain" : "vice_captain";
  return getCvPoolNameSetForTeam(row.team, kind, scenarioId).has(row.player);
}

function xiModeCvPoolsValidForScenario(pool, scenarioId) {
  const capRows = pool.filter((row) => rowAllowedByCvNamePool(row, "captain", scenarioId));
  const vcRows = pool.filter((row) => rowAllowedByCvNamePool(row, "vice_captain", scenarioId));
  if (!capRows.length || !vcRows.length) {
    return false;
  }
  const capKeys = new Set(capRows.map((r) => poolPlayerKey(r)));
  for (let i = 0; i < vcRows.length; i += 1) {
    if (!capKeys.has(poolPlayerKey(vcRows[i]))) {
      return true;
    }
  }
  return capRows.length >= 2 || vcRows.length >= 2;
}

function getTeamAbbrev(fullTeamName) {
  const map = state.teamAbbreviations || {};
  if (map[fullTeamName]) {
    return map[fullTeamName];
  }
  return String(fullTeamName || "TM")
    .split(/\s+/)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 5) || "TM";
}

function getFixtureFileBaseAbbrev() {
  const a = getTeamAbbrev(teamASelect.value);
  const b = getTeamAbbrev(teamBSelect.value);
  return `${a}_vs_${b}`;
}

function getFixtureTitleAbbrev() {
  return `${getTeamAbbrev(teamASelect.value)} vs ${getTeamAbbrev(teamBSelect.value)}`;
}

function loadCandidateNames() {
  try {
    const raw = localStorage.getItem(CANDIDATE_NAMES_STORAGE_KEY);
    if (!raw) {
      state.candidateNames = [...DEFAULT_CANDIDATE_NAMES];
      return;
    }
    const p = JSON.parse(raw);
    if (!Array.isArray(p) || !p.length) {
      state.candidateNames = [...DEFAULT_CANDIDATE_NAMES];
      return;
    }
    state.candidateNames = p.map((x) => String(x).trim()).filter(Boolean);
    if (!state.candidateNames.length) {
      state.candidateNames = [...DEFAULT_CANDIDATE_NAMES];
    }
  } catch {
    state.candidateNames = [...DEFAULT_CANDIDATE_NAMES];
  }
}

function persistCandidateNames() {
  localStorage.setItem(CANDIDATE_NAMES_STORAGE_KEY, JSON.stringify(state.candidateNames));
}

function parseCandidateNamesFromText(text) {
  return String(text || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCandidateNamesList() {
  if (Array.isArray(state.candidateNames) && state.candidateNames.length) {
    return state.candidateNames;
  }
  return [...DEFAULT_CANDIDATE_NAMES];
}

/** slot is 1-based (matches candidate_slot). */
function getCandidateLabel(slot) {
  const names = getCandidateNamesList();
  const i = slot - 1;
  if (i >= 0 && i < names.length) {
    return names[i];
  }
  return `Candidate ${slot}`;
}

function sanitizeFilePart(name) {
  return String(name || "x")
    .replace(/[^\w\u0080-\uFFFF\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 48);
}

function getCandidateChunkSizeFromUi() {
  const el = document.getElementById("candidateChunkInput");
  const n = Number(el?.value ?? MAX_TEAMS_PER_CANDIDATE);
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > MAX_TEAMS_PER_CANDIDATE) return MAX_TEAMS_PER_CANDIDATE;
  return Math.floor(n);
}

function hydrateCandidateNamesInput() {
  const el = document.getElementById("candidateNamesInput");
  if (!el) {
    return;
  }
  el.value = getCandidateNamesList().join("\n");
}

function resolveTeamForPlayerName(playerName, teamAName, teamBName) {
  const inA = teamAName && buildRoster(teamAName).some((r) => r.name === playerName);
  const inB = teamBName && buildRoster(teamBName).some((r) => r.name === playerName);
  if (inA && !inB) return teamAName;
  if (inB && !inA) return teamBName;
  return teamAName || teamBName || "";
}

function abbrevToFullTeam(abbrev) {
  const map = state.teamAbbreviations || {};
  const up = String(abbrev || "").trim().toUpperCase();
  const hit = Object.entries(map).find(([, v]) => v.toUpperCase() === up);
  return hit ? hit[0] : "";
}

function tagRowsWithCandidateMeta(rows, chunkSize) {
  rows.forEach((row, idx) => {
    row.globalIndex = idx + 1;
    row.candidateSlot = Math.floor(idx / chunkSize) + 1;
    row.candidateName = getCandidateLabel(row.candidateSlot);
  });
}

function buildTeamCardsInnerHtml(rows) {
  return rows
    .map((row, idx) => {
      const groupedByTeam = new Map();
      row.players.forEach((p) => {
        if (!groupedByTeam.has(p.team)) {
          groupedByTeam.set(p.team, []);
        }
        groupedByTeam.get(p.team).push({
          player: p.player,
          role: getRoleForPlayer(p.team, p.player),
        });
      });
      const teamOrder = [teamASelect?.value, teamBSelect?.value].filter(Boolean);
      const leftoverTeams = [...groupedByTeam.keys()].filter((t) => !teamOrder.includes(t)).sort();
      const orderedTeams = [...teamOrder, ...leftoverTeams];
      const teamLines = orderedTeams
        .map((teamName) => {
          const players = (groupedByTeam.get(teamName) || [])
            .slice()
            .sort((a, b) => {
              const byRole = roleOrder(a.role) - roleOrder(b.role);
              if (byRole !== 0) {
                return byRole;
              }
              return a.player.localeCompare(b.player);
            });
          if (!players.length) {
            return "";
          }
          const orderedNames = players.map((p) => p.player);
          const short = (state.teamAbbreviations && state.teamAbbreviations[teamName]) || teamName;
          return `<div><strong>${short}:</strong> ${orderedNames.join(", ")}</div>`;
        })
        .filter(Boolean)
        .join("");
      const gi = row.globalIndex != null ? row.globalIndex : idx + 1;
      const cn = row.candidateName || getCandidateLabel(row.candidateSlot);
      const meta = row.candidateSlot != null ? ` · ${cn}` : "";
      const scen =
        row.highScoreScenario != null && String(row.highScoreScenario).trim()
          ? ` · ${escapeHtmlLite(String(row.highScoreScenario).trim())}`
          : "";
      const splitMeta =
        row.splitProfile != null && String(row.splitProfile).trim()
          ? ` · ${escapeHtmlLite(String(row.splitProfile).trim())}/${escapeHtmlLite(String(row.splitSegment || "").trim())} · ${escapeHtmlLite(String(row.splitPair || "").trim())}`
          : "";
      const scenarioGuide = getTeamPdfScenarioGuideHtml(row);
      return `
        <div class="team-card">
          <h3>#${gi}${meta} · ${escapeHtmlLite(row.strategy)}${scen}${splitMeta}</h3>
          ${teamLines}
          <div class="team-card-cvc"><strong>C:</strong> ${escapeHtmlLite(row.captain)} · <strong>VC:</strong> ${escapeHtmlLite(row.viceCaptain)}</div>
          ${scenarioGuide}
        </div>
      `;
    })
    .join("");
}

function buildFantasyTeamsPrintHtml(rows, options = {}) {
  const pageHeading = options.pageHeading || "Fantasy Teams";
  const subHeading = options.subHeading || "";
  const documentTitle = options.documentTitle || pageHeading;

  const teamsHtml = buildTeamCardsInnerHtml(rows);

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${documentTitle.replace(/</g, "")}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 14px; }
      h1 { margin: 0 0 8px; font-size: 18px; }
      .hint { margin: 0 0 12px; color: #444; font-size: 13px; }
      .sub { margin: 0 0 14px; color: #555; font-size: 13px; }
      ${FANTASY_TEAMS_PRINT_CARD_CSS}
      .candidate-section { margin-top: 18px; }
      .candidate-section.first { margin-top: 0; }
      @media print { .no-print { display: none; } }
    </style>
  </head>
  <body>
    <h1>${pageHeading}</h1>
    ${subHeading ? `<p class="sub">${subHeading}</p>` : ""}
    <p class="hint">Use <strong>Print → Save as PDF</strong>. Filename: use your browser’s suggested name or rename to match batch. Green boxes show <strong>expected outcome</strong> and <strong>C/VC</strong> ideas if you edit at the last minute.</p>
    <button class="no-print" type="button" onclick="window.print()">Print / Save PDF</button>
    ${teamsHtml}
  </body>
</html>`;
}

function openPdfWindowWithHtml(html) {
  const win = window.open("", "_blank");
  if (!win) {
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

function openPdfView(rows) {
  const html = buildFantasyTeamsPrintHtml(rows, {
    pageHeading: `${getFixtureTitleAbbrev()} — ${rows.length} teams`,
    documentTitle: `${getFixtureFileBaseAbbrev()}_all_${rows.length}teams`,
  });
  if (!openPdfWindowWithHtml(html)) {
    generatorStatus.textContent = "Popup blocked — allow pop-ups for this site, or use “One PDF (all batches)”.";
  }
}

function openPdfByCandidateSeparateTabs(allRows) {
  const chunk = state.lastGeneratorConfig?.candidateChunkSize || getCandidateChunkSizeFromUi();
  const base = getFixtureFileBaseAbbrev();
  const n = Math.ceil(allRows.length / chunk) || 1;
  let opened = 0;
  for (let c = 0; c < n; c += 1) {
    const slice = allRows.slice(c * chunk, (c + 1) * chunk);
    if (!slice.length) continue;
    const start = c * chunk + 1;
    const end = c * chunk + slice.length;
    const slot = c + 1;
    const label = getCandidateLabel(slot);
    const html = buildFantasyTeamsPrintHtml(slice, {
      pageHeading: `${getFixtureTitleAbbrev()} — ${label}`,
      subHeading: `${slice.length} teams · max ${MAX_TEAMS_PER_CANDIDATE} per person`,
      documentTitle: `${base}_${sanitizeFilePart(label)}_${slice.length}teams`,
    });
    setTimeout(() => {
      const w = window.open("", `_blank_cand_${c}`);
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
        opened += 1;
      }
    }, c * 400);
  }
  if (!n) {
    generatorStatus.textContent = "No teams to print.";
  } else {
    const total = allRows.length;
    const perTab = chunk;
    generatorStatus.textContent = `Opening ${n} browser tab(s) for printing — ${total} team(s) total (${perTab} per tab max, last tab may be shorter). Allow pop-ups. Operators: ${getCandidateNamesList().slice(0, n).join(", ")}.`;
  }
}

function openPdfByCandidateOneDocument(allRows, meta = {}) {
  const postSwap = meta.variant === "postSwap";
  const chunk = state.lastGeneratorConfig?.candidateChunkSize || getCandidateChunkSizeFromUi();
  const base = getFixtureFileBaseAbbrev();
  const n = Math.ceil(allRows.length / chunk) || 1;
  const parts = [];
  for (let c = 0; c < n; c += 1) {
    const slice = allRows.slice(c * chunk, (c + 1) * chunk);
    if (!slice.length) continue;
    const start = c * chunk + 1;
    const end = c * chunk + slice.length;
    const slot = c + 1;
    const label = getCandidateLabel(slot);
    parts.push(`<section class="candidate-section" style="page-break-before:${c > 0 ? "always" : "auto"}">
      <h2 style="font-size:16px;margin:0 0 10px;">${label}</h2>
      <p class="sub" style="margin:0 0 12px;color:#555;font-size:13px;">Teams ${start}–${end} · max ${MAX_TEAMS_PER_CANDIDATE} teams per person</p>
      ${buildTeamCardsInnerHtml(slice)}
    </section>`);
  }
  const mainTitle = postSwap
    ? `${getFixtureTitleAbbrev()} — Swapped teams · by operator (${n} batches)`
    : `${getFixtureTitleAbbrev()} — All operators (${n} batches)`;
  const hint = postSwap
    ? "After last-minute swaps. Print → Save as PDF. One file with an operator section per page break."
    : "Print → Save as PDF. Use page ranges to split per operator, or print all at once.";
  const docTitle = postSwap ? `${base}_after_swap_by_operator` : `${base}_all_batches`;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 14px; }
    h1 { margin: 0 0 8px; font-size: 18px; }
    .hint { margin: 0 0 12px; color: #444; font-size: 13px; }
    ${FANTASY_TEAMS_PRINT_CARD_CSS}
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${mainTitle}</h1>
  <p class="hint">${hint}</p>
  <button class="no-print" type="button" onclick="window.print()">Print / Save PDF</button>
  ${parts.join("")}
</body>
</html>`;
  if (!openPdfWindowWithHtml(html)) {
    const msg = "Popup blocked — allow pop-ups for this site.";
    if (postSwap) {
      swapStatus.textContent = msg;
    } else {
      generatorStatus.textContent = msg;
    }
  }
}

function openSwappedTeamsPdfSingle() {
  if (!state.swappedTeams?.length) {
    swapStatus.textContent = "Apply swaps first to build swapped teams.";
    return;
  }
  openPdfByCandidateOneDocument(state.swappedTeams, { variant: "postSwap" });
  swapStatus.textContent =
    "Opened single PDF (operator sections with page breaks). Print → Save as PDF — suggest filename " +
    `${getFixtureFileBaseAbbrev()}_after_swap_by_operator.pdf`;
}

const STRATEGY_ID = "high_scoring_games";
const STRATEGY_ID_BAT_POOLS = "bat_first_pool_xi";
const STRATEGY_ID_SECOND_INNINGS = "second_innings_pool_5";
const STRATEGY_ID_SPLIT_POOL = "split_pool_p1p2p3";
/** Lineup-shape profiles — also used as C/VC pool keys in split_pool_p1p2p3 mode. */
const SPLIT_POOL_PROFILE_IDS = ["C1", "C2", "C3", "C4"];
/** C/VC tick hints per lineup profile (§4 stories). {A}/{B} = franchise abbrev. */
const SPLIT_POOL_CV_HINT_TEMPLATES = {
  C1: {
    story: "Both sides top-heavy (H·L·L | H·L·L)",
    captain: "{A} or {B} top-order batter in P1 (slot 1–3)",
    vice: "Other franchise top-order (P1); middle batter from P2 on either side",
  },
  C2: {
    story: "A tops + bowl (H·L·H) · B middle (L·H·L)",
    captain: "{A} P1 top-order batter or {A} P3 strike bowler / bowling AR",
    vice: "{B} P2 middle-order batter; {A} P3 bowler or batting AR",
  },
  C3: {
    story: "A middle (L·H·L) · B tops + bowl (H·L·H)",
    captain: "{B} P1 top-order batter or {B} P3 strike bowler / bowling AR",
    vice: "{A} P2 middle-order batter; {B} P3 bowler or batting AR",
  },
  C4: {
    story: "Both middle + bowl (L·H·H | L·H·H)",
    captain: "{A} or {B} P2 middle anchor or P3 strike bowler",
    vice: "P3 bowling AR; second middle-order from P2; avoid dual same-team bowlers",
  },
};

/** Map legacy CSV strategy names to the single supported strategy. */
function normalizeStrategyName(raw) {
  const s = String(raw || "").trim();
  if (s === STRATEGY_ID_BAT_POOLS) {
    return STRATEGY_ID_BAT_POOLS;
  }
  if (s === STRATEGY_ID_SECOND_INNINGS) {
    return STRATEGY_ID_SECOND_INNINGS;
  }
  if (s === STRATEGY_ID_SPLIT_POOL) {
    return STRATEGY_ID_SPLIT_POOL;
  }
  if (s === STRATEGY_ID || s === "batting_order_xi" || s === "balanced_scenarios") {
    return STRATEGY_ID;
  }
  if (s === "core_safe" || s === "aggressive_differential") {
    return STRATEGY_ID;
  }
  return STRATEGY_ID;
}

function getGeneratorModeFromUi() {
  const el = document.getElementById("generatorModeSelect");
  const v = el ? String(el.value || "").trim() : "";
  if (v === STRATEGY_ID_BAT_POOLS) {
    return STRATEGY_ID_BAT_POOLS;
  }
  if (v === STRATEGY_ID_SECOND_INNINGS) {
    return STRATEGY_ID_SECOND_INNINGS;
  }
  if (v === STRATEGY_ID_SPLIT_POOL) {
    return STRATEGY_ID_SPLIT_POOL;
  }
  return STRATEGY_ID;
}

function getSelectedStrategiesFromUi() {
  return [getGeneratorModeFromUi()];
}

function getTeamsPerStrategyFromUi() {
  const n = Number(teamsPerStrategyInput?.value ?? 200);
  if (Number.isNaN(n) || n < 1) return 1;
  if (n > 500) return 500;
  return Math.floor(n);
}

/** When fewer teams are saved than requested, explain dedupe + pool limits (not a bug in the target count). */
function explainUniqueTeamShortfall(poolSize, got, target, attempts, unionCvPoolSize) {
  if (got >= target) {
    return "";
  }
  const att = typeof attempts === "number" ? attempts.toLocaleString() : String(attempts ?? "");
  const parts = [
    `Only ${got} of ${target} unique teams were found (${att} random draws).`,
    "Each team is deduped by the full XI plus captain and vice, so a tiny ticked pool (often only ~11 names) caps out after a few valid captain/vice pairs.",
  ];
  if (poolSize <= 13) {
    parts.push("Fix: tick more players from both squads (well above 11) so many different valid XIs exist.");
  } else if (poolSize <= 20) {
    parts.push("Fix: keep growing the ticked pool toward ~22+ players for hundreds of distinct lineups.");
  } else {
    parts.push(
      "Fix: broaden captain/vice pools vs your ticks, or uncheck “Restrict C/VC pool picks to ticked squad players only” so C/VC filters stop shrinking valid pairs."
    );
  }
  if (unionCvPoolSize > 0 && unionCvPoolSize < 10) {
    parts.push(
      `Captain/vice “union” pool is only ${unionCvPoolSize} names after filters — that alone can limit distinct C/VC pairs per XI.`
    );
  }
  return parts.join(" ");
}

function getActiveScenarioProfile() {
  const raw = String(scenarioProfileSelect?.value || DEFAULT_SCENARIO_PROFILE).trim();
  return HIGH_SCORING_SCENARIO_PROFILES[raw] ? raw : DEFAULT_SCENARIO_PROFILE;
}

function getActiveHighScoringScenarioIds() {
  return HIGH_SCORING_SCENARIO_PROFILES[getActiveScenarioProfile()] || HIGH_SCORING_SCENARIO_IDS_BATTING_HEAVY_6;
}

/** C/VC UI + autofill scenario list: split-pool uses C1–C4; other modes use high-scoring cells. */
function getActiveCvScenarioIdsForUi() {
  if (getGeneratorModeFromUi() === STRATEGY_ID_SPLIT_POOL) {
    return SPLIT_POOL_PROFILE_IDS;
  }
  return getActiveHighScoringScenarioIds();
}

function isSplitPoolProfileScenarioId(scenarioId) {
  return SPLIT_POOL_PROFILE_IDS.includes(String(scenarioId || "").trim());
}

function getSplitPoolAbbrevs() {
  const a = teamASelect?.value || "";
  const b = teamBSelect?.value || "";
  return { A: getTeamAbbrev(a), B: getTeamAbbrev(b) };
}

function fillSplitPoolCvHintTemplate(template, abbrevs) {
  return String(template || "")
    .replace(/\{A\}/g, abbrevs.A || "A")
    .replace(/\{B\}/g, abbrevs.B || "B");
}

function getPlayerSplitPoolBands(teamName, playerName) {
  const teamA = teamASelect?.value || "";
  const side = teamName === teamA ? "teamA" : "teamB";
  const id = playerId(teamName, playerName);
  const sp = state.splitPools;
  if (!sp?.[side]) {
    return { p1: false, p2: false, p3: false };
  }
  return {
    p1: sp[side].p1.includes(id),
    p2: sp[side].p2.includes(id),
    p3: sp[side].p3.includes(id),
  };
}

function classifyTickedPlayerForSplitPoolCv(profileId, teamName, playerName) {
  const teamA = teamASelect?.value || "";
  const onA = teamName === teamA;
  const bands = getPlayerSplitPoolBands(teamName, playerName);
  const shape = getCvPlayerShape(teamName, playerName);
  let captain = false;
  let vice = false;

  if (profileId === "C1") {
    if (bands.p1 && isTopOrderBatterShape(shape)) {
      captain = true;
      vice = true;
    }
    if ((bands.p1 || bands.p2) && (isTopOrderBatterShape(shape) || isMiddleOrderBatterShape(shape))) {
      vice = true;
    }
  } else if (profileId === "C2") {
    if (onA && bands.p1 && isTopOrderBatterShape(shape)) {
      captain = true;
    }
    if (onA && bands.p3 && (isBowlerShape(shape) || isBattingAllRounderShape(shape))) {
      captain = true;
    }
    if (!onA && bands.p2 && isMiddleOrderBatterShape(shape)) {
      vice = true;
    }
    if (onA && bands.p3) {
      vice = true;
    }
    if (!onA && bands.p1 && isTopOrderBatterShape(shape)) {
      vice = true;
    }
  } else if (profileId === "C3") {
    if (!onA && bands.p1 && isTopOrderBatterShape(shape)) {
      captain = true;
    }
    if (!onA && bands.p3 && (isBowlerShape(shape) || isBattingAllRounderShape(shape))) {
      captain = true;
    }
    if (onA && bands.p2 && isMiddleOrderBatterShape(shape)) {
      vice = true;
    }
    if (!onA && bands.p3) {
      vice = true;
    }
    if (onA && bands.p1 && isTopOrderBatterShape(shape)) {
      vice = true;
    }
  } else if (profileId === "C4") {
    if (bands.p2 && isMiddleOrderBatterShape(shape)) {
      captain = true;
      vice = true;
    }
    if (bands.p3 && isBowlerShape(shape)) {
      captain = true;
    }
    if (bands.p3 && isBattingAllRounderShape(shape)) {
      vice = true;
    }
    if (bands.p2 && (shape.role === "batsman" || shape.role === "wicket_keeper")) {
      vice = true;
    }
  }
  return { captain, vice };
}

function getSuggestedCvPlayerNamesForSplitPoolProfile(teamName, profileId) {
  const out = new Set();
  getCvEligiblePlayerNamesForTeam(teamName).forEach((playerName) => {
    const { captain, vice } = classifyTickedPlayerForSplitPoolCv(profileId, teamName, playerName);
    if (captain || vice) {
      out.add(playerName);
    }
  });
  return out;
}

function suggestCvPoolsForSplitPoolProfile(profileId) {
  const teams = [teamASelect?.value, teamBSelect?.value].filter(Boolean);
  const out = {};
  teams.forEach((teamName) => {
    out[teamName] = { captain_pool: [], vice_captain_pool: [] };
    getCvEligiblePlayerNamesForTeam(teamName).forEach((playerName) => {
      const { captain, vice } = classifyTickedPlayerForSplitPoolCv(profileId, teamName, playerName);
      if (captain) {
        out[teamName].captain_pool.push(playerName);
      }
      if (vice) {
        out[teamName].vice_captain_pool.push(playerName);
      }
    });
    out[teamName].captain_pool.sort((a, b) => a.localeCompare(b));
    out[teamName].vice_captain_pool.sort((a, b) => a.localeCompare(b));
  });
  return out;
}

function updateGeneratorAttemptsHint() {
  if (!generatorAttemptsHint) return;
  const n = getTeamsPerStrategyFromUi();
  const baseCap = n * ATTEMPTS_MULTIPLIER;
  const scenarioIds = getActiveHighScoringScenarioIds();
  if (getGeneratorModeFromUi() === STRATEGY_ID_BAT_POOLS) {
    const cap = baseCap * BAT_FIRST_ATTEMPTS_MULTIPLIER;
    generatorAttemptsHint.innerHTML =
      `Bat-first mode max attempts: <strong>${cap.toLocaleString()}</strong> (teams × ${ATTEMPTS_MULTIPLIER} × ${BAT_FIRST_ATTEMPTS_MULTIPLIER}). Two pools P1/P2; segments <strong>6+5</strong> and <strong>5+6</strong>; scenarios assigned <strong>round-robin</strong> (${scenarioIds.join(" → ")} → repeat).`;
    const batHint = document.getElementById("batPoolHint");
    if (batHint) {
      batHint.textContent = formatBatPoolHintLine();
    }
    return;
  }
  if (getGeneratorModeFromUi() === STRATEGY_ID_SECOND_INNINGS) {
    const cap = baseCap * SECOND_INNINGS_ATTEMPTS_MULTIPLIER;
    generatorAttemptsHint.innerHTML =
      `2nd-innings max attempts per scenario block: <strong>${cap.toLocaleString()}</strong> (teams × ${ATTEMPTS_MULTIPLIER} × ${SECOND_INNINGS_ATTEMPTS_MULTIPLIER}). Chase and bowl use <strong>separate</strong> dedupe keys (same XI+C/VC allowed across scenarios). See diagnostics after Generate.`;
    const hint = document.getElementById("secondInningsPoolHint");
    if (hint) {
      hint.textContent = formatSecondInningsHintLine();
    }
    return;
  }
  if (getGeneratorModeFromUi() === STRATEGY_ID_SPLIT_POOL) {
    const mult = window.IPL_SPLIT_POOL?.SPLIT_POOL_ATTEMPTS_MULTIPLIER ?? 3;
    const cap = baseCap * mult;
    const cvIds = getActiveCvScenarioIdsForUi();
    const fullPct =
      window.IPL_SPLIT_POOL?.getSplitPoolFullPoolPercentFromUi?.() ?? DEFAULT_SPLIT_POOL_FULL_POOL_PCT;
    generatorAttemptsHint.innerHTML =
      `Split-pool max attempts: <strong>${cap.toLocaleString()}</strong> (teams × ${ATTEMPTS_MULTIPLIER} × ${mult}). Lineup profiles <strong>C1→C2→C3→C4</strong> round-robin; C/VC pools keyed to the <strong>same profile</strong> (${cvIds.join(" → ")}). First ~<strong>${fullPct}%</strong> teams use full P1/P2/P3; rest use reduced pools (exclusions below).`;
    const hint = document.getElementById("splitPoolHint");
    if (hint && window.IPL_SPLIT_POOL) {
      window.IPL_SPLIT_POOL.renderSplitPoolPanel();
    }
    return;
  }
  const hsCap = baseCap * HIGH_SCORING_ATTEMPTS_MULTIPLIER;
  generatorAttemptsHint.innerHTML =
    `Max attempts (hard cap): <strong>${hsCap.toLocaleString()}</strong> (teams × ${ATTEMPTS_MULTIPLIER} × ${HIGH_SCORING_ATTEMPTS_MULTIPLIER}). Scenarios assigned <strong>round-robin</strong> (${scenarioIds.join(" → ")} → repeat) so each block of ${scenarioIds.length} teams has one per cell; then dedupe rules apply.`;
}

function postMatchCompositeKey(team, player) {
  return `${String(team || "").trim()}::${String(player || "").trim()}`.toLowerCase();
}

function loadPostMatchPointsDb() {
  try {
    const raw = localStorage.getItem(POSTMATCH_POINTS_DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePostMatchPointsDb(db) {
  localStorage.setItem(POSTMATCH_POINTS_DB_KEY, JSON.stringify(db));
}

function getPostMatchFixtureKey() {
  const a = teamASelect?.value || "";
  const b = teamBSelect?.value || "";
  if (!a || !b) return "";
  const teams = [a, b].sort().join("||");
  const dateRaw = postMatchDateInput?.value || "";
  const datePart = dateRaw || "__no_date__";
  return `${teams}|${datePart}`;
}

function getSavedPostMatchFixture() {
  const fk = getPostMatchFixtureKey();
  if (!fk) return null;
  return loadPostMatchPointsDb()[fk] || null;
}

let postMatchSaveTimer = null;

function persistPostMatchPointsEntry() {
  const fk = getPostMatchFixtureKey();
  if (!fk) return;
  const players = {};
  postMatchPlayersInputs.querySelectorAll("input[data-team][data-player]").forEach((input) => {
    const t = String(input.dataset.team || "").trim();
    const pl = String(input.dataset.player || "").trim();
    if (!t || !pl || input.value.trim() === "") return;
    const v = Number(input.value);
    if (Number.isNaN(v)) return;
    players[postMatchCompositeKey(t, pl)] = v;
  });
  const db = loadPostMatchPointsDb();
  const topRaw = topTeamPointsInput.value.trim();
  const topContest =
    topRaw === "" ? null : Number(topRaw);
  db[fk] = {
    players,
    topContestPoints: topContest !== null && !Number.isNaN(topContest) ? topContest : null,
    updatedAt: new Date().toISOString(),
  };
  savePostMatchPointsDb(db);
  updatePostMatchPersistHint();
}

function schedulePersistPostMatchPoints() {
  clearTimeout(postMatchSaveTimer);
  postMatchSaveTimer = setTimeout(() => persistPostMatchPointsEntry(), 450);
}

function updatePostMatchPersistHint() {
  const el = document.getElementById("postMatchPersistHint");
  if (!el) return;
  const fk = getPostMatchFixtureKey();
  const saved = getSavedPostMatchFixture();
  if (!fk) {
    el.textContent = "";
    return;
  }
  if (saved?.updatedAt) {
    const n = saved.players ? Object.keys(saved.players).length : 0;
    const d = new Date(saved.updatedAt);
    el.textContent = `Saved locally for this fixture (${n} player rows). Last updated: ${d.toLocaleString()}.`;
  } else {
    el.textContent = "No saved points for this team pair / date yet — they save as you type or when you analyze.";
  }
}

function buildRoster(teamName) {
  const team = state.teamsByName.get(teamName);
  if (!team) {
    return [];
  }

  // Captain is kept separate in squads data; include for UI selection.
  const seen = new Set();
  const rows = [];
  if (team.captain && !seen.has(team.captain)) {
    rows.push({ name: team.captain, isCaptain: true });
    seen.add(team.captain);
  }
  team.players.forEach((name) => {
    if (seen.has(name)) {
      return;
    }
    rows.push({ name, isCaptain: false });
    seen.add(name);
  });
  return rows;
}

function getPlayerForm(teamName, playerName) {
  const teamForm = state.formByTeam[teamName] || {};
  return teamForm[playerName] || null;
}

function getPlayerProfile(teamName, playerName) {
  const teamProfiles = state.profilesByTeam[teamName] || {};
  return (
    teamProfiles[playerName] || {
      primary_role: "unknown",
      is_wicket_keeper: false,
      tags: [],
    }
  );
}

function getBattingSlotFromFile(teamName, playerName) {
  const teamMap = state.battingSlotsByTeam?.[teamName];
  if (!teamMap) {
    return null;
  }
  const ent = teamMap[playerName];
  if (!ent || typeof ent.typical_slot !== "number") {
    return null;
  }
  const s = Math.floor(ent.typical_slot);
  if (s < 1 || s > 11) {
    return null;
  }
  return s;
}

function inferBattingSlotFromProfile(teamName, playerName, profile) {
  void teamName;
  void playerName;
  const tags = profile.tags || [];
  const role = profile.primary_role;
  if (role === "bowler") {
    return 9;
  }
  if (role === "all_rounder") {
    if (tags.includes("top_order")) {
      return 3;
    }
    if (tags.includes("finisher")) {
      return 6;
    }
    return 7;
  }
  if (role === "wicket_keeper") {
    if (tags.includes("finisher")) {
      return 6;
    }
    if (tags.includes("top_order")) {
      return 2;
    }
    return 4;
  }
  if (tags.includes("top_order")) {
    return 2;
  }
  if (tags.includes("middle_order")) {
    return 5;
  }
  if (tags.includes("finisher")) {
    return 6;
  }
  if (tags.includes("anchor")) {
    return 3;
  }
  return 5;
}

function resolveTypicalBattingSlot(teamName, playerName, profile) {
  const fromFile = getBattingSlotFromFile(teamName, playerName);
  if (fromFile != null) {
    return fromFile;
  }
  return inferBattingSlotFromProfile(teamName, playerName, profile);
}

function poolPlayerKey(row) {
  return `${row.team}::${row.player}`;
}

function repeatPenaltyFactor(row, appearanceCounts, repeatLambda) {
  const lam = repeatLambda ?? DEFAULT_GENERATOR_TUNING.repeatLambda;
  const c = appearanceCounts.get(poolPlayerKey(row)) || 0;
  return 1 / (1 + lam * c);
}

const HIGH_SCORING_DRAW_PARAMS = { temperature: 1.14, noise: 0.24 };

function buildBowlerArFairnessState(pool) {
  const bowlerKeys = [];
  const arKeys = [];
  const seenB = new Set();
  const seenA = new Set();
  pool.forEach((row) => {
    const k = poolPlayerKey(row);
    if (row.role === "bowler" && !seenB.has(k)) {
      seenB.add(k);
      bowlerKeys.push(k);
    }
    if (row.role === "all_rounder" && !seenA.has(k)) {
      seenA.add(k);
      arKeys.push(k);
    }
  });
  return {
    bowlerKeys,
    arKeys,
    gBowlers: Math.max(1, bowlerKeys.length),
    gAr: Math.max(1, arKeys.length),
    teamsBuilt: 0,
    totalBowlerSlots: 0,
    totalArSlots: 0,
    bowlerPickCounts: new Map(),
    arPickCounts: new Map(),
  };
}

/** Spread XI picks across distinct bowlers / all-rounders (batch fairness), similar spirit to C/VC λ. */
function bowlerArFairnessBonus(row, fair, tuning, roleKind) {
  if (!fair || !tuning) {
    return 0;
  }
  if (roleKind === "bowler" && row.role !== "bowler") {
    return 0;
  }
  if (roleKind === "all_rounder" && row.role !== "all_rounder") {
    return 0;
  }
  const lam = tuning.cvFairnessLambda ?? DEFAULT_GENERATOR_TUNING.cvFairnessLambda;
  const k = poolPlayerKey(row);
  const counts = roleKind === "bowler" ? fair.bowlerPickCounts : fair.arPickCounts;
  const g = roleKind === "bowler" ? fair.gBowlers : fair.gAr;
  const total = roleKind === "bowler" ? fair.totalBowlerSlots : fair.totalArSlots;
  const teams = fair.teamsBuilt;
  const expectedNext = teams > 0 ? total / teams : 1;
  const ideal = (total + expectedNext) / g;
  const have = counts.get(k) || 0;
  return lam * (ideal - have);
}

function computeRowDrawWeight(row, params, appearanceCounts, tuning, bowlerArFair) {
  const t = tuning || DEFAULT_GENERATOR_TUNING;
  const repLambda = t.repeatLambda ?? DEFAULT_GENERATOR_TUNING.repeatLambda;
  const rep = repeatPenaltyFactor(row, appearanceCounts, repLambda);
  const batSlot = lowerMiddleBatsmanDrawFactor(row, t);
  const baseProj = blendedPlayerScore(row, t);
  const ceilingGap = Math.max(0, (Number(row.ceiling) || 0) - baseProj);
  const lift = Math.min(0.55, ceilingGap / 48);
  const nudge = t.lineupCeilingNudge ?? DEFAULT_GENERATOR_TUNING.lineupCeilingNudge;
  let fairBoost = 0;
  if (bowlerArFair) {
    fairBoost += bowlerArFairnessBonus(row, bowlerArFair, t, "bowler");
    fairBoost += bowlerArFairnessBonus(row, bowlerArFair, t, "all_rounder");
  }
  const base = Math.max(0.05, baseProj * (1 + nudge * lift) + fairBoost);
  const noisyProj = base * (1 + (Math.random() * 2 - 1) * params.noise);
  return Math.max(0.01, Math.pow(Math.max(0.1, noisyProj), params.temperature) * rep * batSlot);
}

function playerId(teamName, playerName) {
  return `${teamName}::${playerName}`;
}

function createPlayerRow(teamName, playerName, isCaptain) {
  const row = document.createElement("label");
  row.className = "player-row";

  const left = document.createElement("div");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = state.selectedPlayers.has(playerId(teamName, playerName));

  checkbox.addEventListener("change", (event) => {
    const id = playerId(teamName, playerName);
    if (event.target.checked) {
      state.selectedPlayers.add(id);
    } else {
      state.selectedPlayers.delete(id);
    }
    persistSelection();
    syncBatPoolsWithSelection();
    persistBatPools();
    renderSelectedPlayers();
    renderStatus();
    renderCvPoolPanels();
    renderBatPoolPanel();
    if (getGeneratorModeFromUi() === STRATEGY_ID_SPLIT_POOL) {
      window.IPL_SPLIT_POOL?.renderSplitPoolPanel?.();
    }
    refreshSwapRuleOutOptions();
  });

  const nameText = document.createElement("span");
  nameText.textContent = ` ${playerName}`;
  left.appendChild(checkbox);
  left.appendChild(nameText);

  const right = document.createElement("div");
  right.className = "meta";

  if (isCaptain) {
    right.appendChild(makeBadge("Captain", "badge"));
  }

  const profile = getPlayerProfile(teamName, playerName);
  right.appendChild(makeBadge(profile.primary_role, "badge role"));
  (profile.tags || []).filter((tag) => tag !== "probable_xi").forEach((tag) => {
    right.appendChild(makeBadge(tag, "badge"));
  });

  const form = getPlayerForm(teamName, playerName);
  if (Array.isArray(form?.last_fantasy_points) && form.last_fantasy_points.length > 0) {
    const avg =
      form.last_fantasy_points.reduce((a, b) => a + b, 0) / form.last_fantasy_points.length;
    right.appendChild(makeBadge(`Avg FP ${avg.toFixed(1)}`, "badge points"));
  }

  row.appendChild(left);
  row.appendChild(right);
  return row;
}

function enableProbableXiDefaults(teamName) {
  if (state.probableSeededTeams.has(teamName)) {
    return;
  }
  const roster = buildRoster(teamName);
  roster.forEach((p) => {
    const form = getPlayerForm(teamName, p.name);
    if (form?.probable_xi) {
      state.selectedPlayers.add(playerId(teamName, p.name));
    }
  });
  state.probableSeededTeams.add(teamName);
}

function makeBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = text;
  return badge;
}

function renderTeamPlayers(teamName, targetEl, titleEl) {
  targetEl.innerHTML = "";
  titleEl.textContent = `${teamName} Squad`;
  const roster = buildRoster(teamName);
  roster.forEach((p) => {
    targetEl.appendChild(createPlayerRow(teamName, p.name, p.isCaptain));
  });
}

function renderSelectedPlayers() {
  /* Selection is visible on squad tick boxes and in the status bar count. */
}

function renderStatus() {
  selectedCount.textContent = `Selected: ${state.selectedPlayers.size}`;
  selectedTeams.textContent = `Teams: ${teamASelect.value} vs ${teamBSelect.value}`;
}

function weightedAverage(values) {
  if (!values.length) {
    return 0;
  }
  const weights = values.map((_, idx) => idx + 1);
  const weighted = values.reduce((acc, value, idx) => acc + value * weights[idx], 0);
  const total = weights.reduce((acc, value) => acc + value, 0);
  return weighted / total;
}

function computeRoleStabilityFromForm(pointHistory, typicalSlot, probableXi) {
  if (!Array.isArray(pointHistory) || pointHistory.length === 0) {
    return probableXi ? 0.55 : 0.4;
  }
  const mean = weightedAverage(pointHistory.map(Number));
  const variance =
    pointHistory.reduce((acc, x) => acc + Math.pow(Number(x) - mean, 2), 0) / pointHistory.length;
  const std = Math.sqrt(Math.max(0, variance));
  const cv = mean > 1 ? std / mean : 1.5;
  const consistency = Math.max(0, Math.min(1, 1 - cv));
  const slotBonus = typicalSlot <= 3 ? 0.12 : typicalSlot <= 5 ? 0.06 : 0;
  const xiBonus = probableXi ? 0.08 : 0;
  return Math.max(0, Math.min(1, consistency + slotBonus + xiBonus));
}

function weightedSampleWithoutReplacement(items, count) {
  const pool = [...items];
  const picked = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    const totalWeight = pool.reduce((acc, row) => acc + Math.max(0.01, row.weight), 0);
    let cursor = Math.random() * totalWeight;
    let idx = 0;
    while (idx < pool.length) {
      cursor -= Math.max(0.01, pool[idx].weight);
      if (cursor <= 0) {
        break;
      }
      idx += 1;
    }
    picked.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return picked;
}

/** Exact duplicate means same 11 and same C/VC pair. */
function buildTeamUniquenessKey(players, captain, viceCaptain) {
  const lineup = [...players]
    .map((p) => `${p.team}::${p.player}`)
    .sort()
    .join("|");
  return `${lineup}#${captain}#${viceCaptain}`;
}

/** Chase-middle vs bowl-first are different products — same XI+C/VC may appear in both. */
function buildSecondInningsUniquenessKey(playersOut, captain, viceCaptain, scenarioTag) {
  return `${buildTeamUniquenessKey(playersOut, captain, viceCaptain)}|${scenarioTag}`;
}

/** XI-only key for short-term cooldown (independent of C/VC). */
function buildLineupOnlyKey(players) {
  return [...players]
    .map((p) => `${p.team}::${p.player}`)
    .sort()
    .join("|");
}

function isLineupInCooldown(recentLineupState, lineupKey) {
  if (!recentLineupState || !lineupKey) {
    return false;
  }
  return recentLineupState.keySet.has(lineupKey);
}

function recordAcceptedLineup(recentLineupState, lineupKey) {
  if (!recentLineupState || !lineupKey) {
    return;
  }
  const windowSize = Math.max(1, Number(recentLineupState.windowSize) || LINEUP_REPEAT_COOLDOWN);
  recentLineupState.queue.push(lineupKey);
  recentLineupState.keySet.add(lineupKey);
  if (recentLineupState.queue.length > windowSize) {
    const evicted = recentLineupState.queue.shift();
    if (evicted != null) {
      recentLineupState.keySet.delete(evicted);
    }
  }
}

/** Distinct captain / vice keys in the current selection that intersect C/VC pools (for fairness targets). */
function buildCvFairnessState(pool) {
  const capKeys = [];
  const vcKeys = [];
  const unionKeys = [];
  const seenC = new Set();
  const seenV = new Set();
  const seenU = new Set();
  const scenarioIds = getActiveHighScoringScenarioIds();
  pool.forEach((row) => {
    const k = poolPlayerKey(row);
    let inCap = false;
    let inVc = false;
    scenarioIds.forEach((sid) => {
      if (rowAllowedByCvNamePool(row, "captain", sid)) {
        inCap = true;
      }
      if (rowAllowedByCvNamePool(row, "vice_captain", sid)) {
        inVc = true;
      }
    });
    if (inCap && !seenC.has(k)) {
      seenC.add(k);
      capKeys.push(k);
      if (!seenU.has(k)) {
        seenU.add(k);
        unionKeys.push(k);
      }
    }
    if (inVc && !seenV.has(k)) {
      seenV.add(k);
      vcKeys.push(k);
      if (!seenU.has(k)) {
        seenU.add(k);
        unionKeys.push(k);
      }
    }
  });
  return {
    capKeys,
    vcKeys,
    unionKeys,
    capKeySet: new Set(capKeys),
    gCap: Math.max(1, capKeys.length),
    gVc: Math.max(1, vcKeys.length),
    gUnion: Math.max(1, unionKeys.length),
    teamsBuilt: 0,
    captainCounts: new Map(),
    viceCounts: new Map(),
  };
}

function captainFairnessBonus(row, tuning, cvFair) {
  if (!cvFair) {
    return 0;
  }
  const lam =
    tuning.cvFairnessLambda != null ? tuning.cvFairnessLambda : DEFAULT_GENERATOR_TUNING.cvFairnessLambda;
  const k = poolPlayerKey(row);
  const ideal = (cvFair.teamsBuilt + 1) / cvFair.gCap;
  const have = cvFair.captainCounts.get(k) || 0;
  const idealTotal = (2 * (cvFair.teamsBuilt + 1)) / cvFair.gUnion;
  const haveTotal = (cvFair.captainCounts.get(k) || 0) + (cvFair.viceCounts.get(k) || 0);
  const unionBonus = lam * (idealTotal - haveTotal);
  return lam * (ideal - have) + unionBonus;
}

function viceFairnessBonus(row, tuning, cvFair) {
  if (!cvFair) {
    return 0;
  }
  const lam =
    tuning.cvFairnessLambda != null ? tuning.cvFairnessLambda : DEFAULT_GENERATOR_TUNING.cvFairnessLambda;
  const k = poolPlayerKey(row);
  const ideal = (cvFair.teamsBuilt + 1) / cvFair.gVc;
  const have = cvFair.viceCounts.get(k) || 0;
  const idealTotal = (2 * (cvFair.teamsBuilt + 1)) / cvFair.gUnion;
  const haveTotal = (cvFair.captainCounts.get(k) || 0) + (cvFair.viceCounts.get(k) || 0);
  const unionBonus = lam * (idealTotal - haveTotal);
  // Extra VC-only boost: helps players who can only appear via VC catch up in total C+VC exposure.
  const vcOnlyBonus = cvFair.capKeySet.has(k) ? 0 : 0.75 * lam * (idealTotal - haveTotal);
  return lam * (ideal - have) + unionBonus + vcOnlyBonus;
}

function recordCvFairnessAssignment(cvFair, captainTeam, captainName, viceTeam, viceName) {
  if (!cvFair) {
    return;
  }
  const ck = playerId(captainTeam, captainName);
  const vk = playerId(viceTeam, viceName);
  cvFair.captainCounts.set(ck, (cvFair.captainCounts.get(ck) || 0) + 1);
  cvFair.viceCounts.set(vk, (cvFair.viceCounts.get(vk) || 0) + 1);
  cvFair.teamsBuilt += 1;
}

function isValidGeneratedTeam(team) {
  if (team.length !== 11) {
    return false;
  }
  const playerKeys = new Set();
  const teamCount = {};
  const roleCount = {
    wicket_keeper: 0,
    batsman: 0,
    bowler: 0,
    all_rounder: 0,
  };
  let profileAllRoundersInXi = 0;
  team.forEach((row) => {
    if (!row?.team || !row?.player) {
      return;
    }
    playerKeys.add(playerId(row.team, row.player));
    teamCount[row.team] = (teamCount[row.team] || 0) + 1;
    const r = getEffectiveLineupRole(row.team, row.player);
    if (roleCount[r] !== undefined) {
      roleCount[r] += 1;
    }
    if (getRawProfileRole(row.team, row.player) === "all_rounder") {
      profileAllRoundersInXi += 1;
    }
  });
  if (Object.keys(teamCount).length < 2) {
    return false;
  }
  if (playerKeys.size !== 11) {
    return false;
  }
  const MIN_PER_TEAM = 4;
  for (const t of Object.keys(teamCount)) {
    if (teamCount[t] < MIN_PER_TEAM) {
      return false;
    }
  }
  return (
    roleCount.wicket_keeper >= 1 &&
    roleCount.batsman >= 1 &&
    roleCount.bowler >= 1 &&
    profileAllRoundersInXi >= 1
  );
}

/**
 * First failing rule for `isValidGeneratedTeam` (stable codes for bat-first logs).
 * Returns `null` when the XI passes all checks.
 */
function explainInvalidGeneratedTeam(team) {
  if (!Array.isArray(team) || team.length !== 11) {
    return `xi_size_${team?.length ?? 0}_not_11`;
  }
  const teamCount = {};
  const playerKeys = new Set();
  const roleCount = {
    wicket_keeper: 0,
    batsman: 0,
    bowler: 0,
    all_rounder: 0,
  };
  let profileAllRoundersInXi = 0;
  for (let i = 0; i < team.length; i += 1) {
    const row = team[i];
    if (!row?.team || !row?.player) {
      return `xi_row_missing_team_or_player_at_${i}`;
    }
    const pk = playerId(row.team, row.player);
    if (playerKeys.has(pk)) {
      return `xi_duplicate_player_${pk}`;
    }
    playerKeys.add(pk);
    teamCount[row.team] = (teamCount[row.team] || 0) + 1;
    const r = getEffectiveLineupRole(row.team, row.player);
    if (roleCount[r] !== undefined) {
      roleCount[r] += 1;
    }
    if (getRawProfileRole(row.team, row.player) === "all_rounder") {
      profileAllRoundersInXi += 1;
    }
  }
  if (Object.keys(teamCount).length < 2) {
    return "xi_single_franchise_only";
  }
  const MIN_PER_TEAM = 4;
  for (const t of Object.keys(teamCount)) {
    if (teamCount[t] < MIN_PER_TEAM) {
      return `xi_min_4_per_franchise_violation_${t}_${teamCount[t]}`;
    }
  }
  if (roleCount.wicket_keeper < 1) {
    return "xi_min_1_wk";
  }
  if (roleCount.batsman < 1) {
    return "xi_min_1_bat";
  }
  if (roleCount.bowler < 1) {
    return "xi_min_1_bowl";
  }
  if (profileAllRoundersInXi < 1) {
    return "xi_min_1_profile_ar";
  }
  return null;
}

function pickRandomRow(rows) {
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[Math.floor(Math.random() * rows.length)];
}

/** If the XI has 7 from one franchise (4–7 split), captain must be from that franchise. */
function getFranchiseWithSevenPlayers(rows) {
  const counts = {};
  rows.forEach((r) => {
    const t = r.team;
    counts[t] = (counts[t] || 0) + 1;
  });
  const keys = Object.keys(counts);
  for (let i = 0; i < keys.length; i += 1) {
    if (counts[keys[i]] === 7) {
      return keys[i];
    }
  }
  return null;
}

/** In a strict 7–4 XI split across two franchises, returns the franchise with 4 players; else null. */
function getFranchiseWithFourOppositeSeven(rows) {
  const counts = {};
  rows.forEach((r) => {
    const t = r.team;
    counts[t] = (counts[t] || 0) + 1;
  });
  const keys = Object.keys(counts);
  if (keys.length !== 2) {
    return null;
  }
  const [a, b] = keys;
  const ca = counts[a];
  const cb = counts[b];
  if (ca === 7 && cb === 4) {
    return b;
  }
  if (cb === 7 && ca === 4) {
    return a;
  }
  return null;
}

/** 7 vs 4 franchise split (unordered): same bucket for A=7/B=4 and A=4/B=7. */
function isFranchiseSplit74ForFixture(team, teamAName, teamBName) {
  if (!teamAName || !teamBName || !Array.isArray(team) || team.length !== 11) {
    return false;
  }
  let ca = 0;
  let cb = 0;
  let other = 0;
  for (let i = 0; i < team.length; i += 1) {
    const fr = team[i]?.team;
    if (fr === teamAName) {
      ca += 1;
    } else if (fr === teamBName) {
      cb += 1;
    } else {
      other += 1;
    }
  }
  if (other > 0) {
    return false;
  }
  return (ca === 7 && cb === 4) || (ca === 4 && cb === 7);
}

function chooseCaptainViceCaptain(
  team,
  tuning = getGeneratorTuningFromUi(),
  cvFair = null,
  scenarioId = "α1",
  dedupe = null,
  cvPairStats = null,
  cvRuntimeOpts = null
) {
  const withSlot = normalizeTeamRowsForCv(team);
  const hasSplitPools =
    cvRuntimeOpts?.capKeys instanceof Set &&
    cvRuntimeOpts?.vcKeys instanceof Set &&
    cvRuntimeOpts.capKeys.size >= 1 &&
    cvRuntimeOpts.vcKeys.size >= 1;
  const unifiedKeys =
    !hasSplitPools &&
    cvRuntimeOpts?.unifiedEligibleKeys instanceof Set &&
    cvRuntimeOpts.unifiedEligibleKeys.size >= 2
      ? { unifiedEligibleKeys: cvRuntimeOpts.unifiedEligibleKeys }
      : hasSplitPools
        ? {
            capKeys: cvRuntimeOpts.capKeys,
            vcKeys: cvRuntimeOpts.vcKeys,
            secondInningsRelaxTeamIntersect: Boolean(cvRuntimeOpts.secondInningsRelaxTeamIntersect),
          }
        : null;
  const pools = buildCvPoolsFromNormalizedTeam(withSlot, unifiedKeys, scenarioId);
  if (!pools) {
    return null;
  }
  const capPool = filterCaptainPoolForB3Scenario(pools.capPool, scenarioId);
  const { vcPool } = pools;
  if (!capPool.length) {
    return null;
  }
  const playersOut =
    dedupe?.playersOut ||
    team.map((row) => ({
      team: row.team,
      player: row.player,
      role: row.role,
    }));
  const cvLayerOpts =
    dedupe?.cvLayerOpts ||
    (cvRuntimeOpts?.secondInningsRelaxTeamIntersect
      ? { skipDualBowlerRule: true, secondInningsFivePlayer: withSlot.length <= 5 }
      : null);
  const dedupeCtx = dedupe?.seenKeys
    ? {
        seenKeys: dedupe.seenKeys,
        playersOut,
        useSecondInningsKey: dedupe.useSecondInningsKey,
        secondInningsScenarioTag: dedupe.secondInningsScenarioTag,
        cvLayerOpts,
      }
    : null;
  const dedupeForSearch = dedupe
    ? { ...dedupe, playersOut, cvLayerOpts: dedupe.cvLayerOpts || cvLayerOpts }
    : null;

  const pairCounts = cvPairStats?.counts;
  if (pairCounts && dedupeCtx) {
    const legal = enumerateLegalCvPairsForScenario(withSlot, capPool, vcPool, scenarioId, dedupeCtx);
    if (legal.length >= CV_PAIR_MIN_LEGAL_FOR_NUDGE) {
      const fairPick = pickCaptainViceByFairnessAmongLegal(
        legal,
        scenarioId,
        pairCounts,
        tuning,
        cvFair
      );
      if (fairPick) {
        return fairPick;
      }
    }
  }

  let captain;
  let viceCaptain;
  const out = pickBalancedScenarioCaptainVice(capPool, vcPool, tuning, cvFair, scenarioId);
  if (out) {
    captain = out.captain;
    viceCaptain = out.viceCaptain;
  } else {
    const capSorted = [...capPool].sort((a, b) => b.proj - a.proj);
    const captainRow = capSorted[0];
    const vcCandidates = vcPool.filter((r) => r.player !== captainRow.player);
    if (!vcCandidates.length) {
      return findCaptainViceByRankedSearch(
        withSlot,
        capPool,
        vcPool,
        scenarioId,
        tuning,
        cvFair,
        dedupeForSearch,
        playersOut
      );
    }
    const vcSorted = [...vcCandidates].sort((a, b) => b.proj - a.proj);
    captain = captainRow.player;
    viceCaptain = vcSorted[0].player;
  }
  const repaired = applyCvScenarioVerificationLayer(
    withSlot,
    vcPool,
    captain,
    viceCaptain,
    scenarioId,
    tuning,
    cvFair,
    dedupeCtx
  );
  if (repaired) {
    return repaired;
  }
  return findCaptainViceByRankedSearch(
    withSlot,
    capPool,
    vcPool,
    scenarioId,
    tuning,
    cvFair,
    dedupeForSearch,
    playersOut
  );
}

function buildPoolForSelectedMatch() {
  const teamNames = [teamASelect.value, teamBSelect.value];
  const pool = [];
  teamNames.forEach((teamName) => {
    const roster = buildRoster(teamName);
    roster.forEach((row) => {
      pool.push(buildProjectionRowForPlayer(teamName, row.name));
    });
  });
  return pool;
}

function buildProjectionRowForPlayer(teamName, playerName) {
  const profile = getPlayerProfile(teamName, playerName);
  const form = getPlayerForm(teamName, playerName) || {};
  const role = getEffectiveLineupRole(teamName, playerName);
  const pointHistory = Array.isArray(form.last_fantasy_points) ? form.last_fantasy_points : [];
  const proj = pointHistory.length ? weightedAverage(pointHistory.map(Number)) : ROLE_PRIORS[role];
  const ceiling = pointHistory.length ? Math.max(...pointHistory) : proj + 12;
  const floor = pointHistory.length ? Math.min(...pointHistory) : Math.max(0, proj - 12);
  const ownershipProxy = Math.min(0.95, Math.max(0.05, proj / 70));
  const typicalSlot = resolveTypicalBattingSlot(teamName, playerName, profile);
  const roleStability = computeRoleStabilityFromForm(
    pointHistory,
    typicalSlot,
    Boolean(form?.probable_xi)
  );
  return {
    team: teamName,
    player: playerName,
    role,
    proj,
    ceiling,
    floor,
    ownershipProxy,
    typicalSlot,
    roleStability,
  };
}

function buildPoolFromCurrentSelection() {
  const teamNames = new Set([teamASelect.value, teamBSelect.value]);
  const pool = [];
  Array.from(state.selectedPlayers).forEach((id) => {
    const [teamName, playerName] = id.split("::");
    if (!teamNames.has(teamName) || !playerName) {
      return;
    }
    pool.push(buildProjectionRowForPlayer(teamName, playerName));
  });
  return pool;
}

/** Match pool passed to generators: bat-first includes every P1/P2 id so unticked squad picks get projections. */
function buildGeneratorPoolForMode(mode) {
  const pool = buildPoolFromCurrentSelection();
  if (mode === STRATEGY_ID_SECOND_INNINGS) {
    syncSecondInningsPoolsWithSelection();
    const keys = new Set(pool.map((r) => poolPlayerKey(r)));
    const teamNames = new Set([teamASelect.value, teamBSelect.value].filter(Boolean));
    const si = state.secondInningsPools;
    [...new Set([...(si.p1Top || []), ...(si.p1Rest || []), ...(si.p2 || [])])].forEach((id) => {
      const sep = id.indexOf("::");
      const teamName = sep >= 0 ? id.slice(0, sep) : "";
      const playerName = sep >= 0 ? id.slice(sep + 2) : "";
      if (!teamNames.has(teamName) || !playerName) {
        return;
      }
      const k = poolPlayerKey({ team: teamName, player: playerName });
      if (keys.has(k)) {
        return;
      }
      keys.add(k);
      pool.push(buildProjectionRowForPlayer(teamName, playerName));
    });
    return pool;
  }
  if (mode === STRATEGY_ID_SPLIT_POOL) {
    window.IPL_SPLIT_POOL?.ensureSplitPoolState?.();
    window.IPL_SPLIT_POOL?.syncSplitPoolsWithSelection?.();
    const keys = new Set(pool.map((r) => poolPlayerKey(r)));
    const teamNames = new Set([teamASelect.value, teamBSelect.value].filter(Boolean));
    const sp = state.splitPools;
    [...new Set([...sp.teamA.p1, ...sp.teamA.p2, ...sp.teamA.p3, ...sp.teamB.p1, ...sp.teamB.p2, ...sp.teamB.p3])].forEach(
      (id) => {
        const sep = id.indexOf("::");
        const teamName = sep >= 0 ? id.slice(0, sep) : "";
        const playerName = sep >= 0 ? id.slice(sep + 2) : "";
        if (!teamNames.has(teamName) || !playerName) {
          return;
        }
        const k = poolPlayerKey({ team: teamName, player: playerName });
        if (keys.has(k)) {
          return;
        }
        keys.add(k);
        pool.push(buildProjectionRowForPlayer(teamName, playerName));
      }
    );
    return pool;
  }
  if (mode !== STRATEGY_ID_BAT_POOLS) {
    return pool;
  }
  syncBatPoolsWithSelection();
  const keys = new Set(pool.map((r) => poolPlayerKey(r)));
  const teamNames = new Set([teamASelect.value, teamBSelect.value].filter(Boolean));
  [...new Set([...state.batPools.p1, ...state.batPools.p2])].forEach((id) => {
    const sep = id.indexOf("::");
    const teamName = sep >= 0 ? id.slice(0, sep) : "";
    const playerName = sep >= 0 ? id.slice(sep + 2) : "";
    if (!teamNames.has(teamName) || !playerName) {
      return;
    }
    const k = poolPlayerKey({ team: teamName, player: playerName });
    if (keys.has(k)) {
      return;
    }
    keys.add(k);
    pool.push(buildProjectionRowForPlayer(teamName, playerName));
  });
  return pool;
}

function getGenerationBlockingReasons(pool) {
  const reasons = [];
  const mode = getGeneratorModeFromUi();
  const minPoolSize = mode === STRATEGY_ID_SECOND_INNINGS ? 5 : 11;
  if (pool.length < minPoolSize) {
    const hint =
      mode === STRATEGY_ID_BAT_POOLS
        ? `Need at least ${minPoolSize} ticked players, all assigned to P1 or P2 (use Auto-fill after ticking).`
        : mode === STRATEGY_ID_SPLIT_POOL
        ? `Need at least ${minPoolSize} ticked players in split pools (Auto-fill after ticking).`
        : `Select at least ${minPoolSize} players.`;
    reasons.push(hint);
    return reasons;
  }
  if (mode === STRATEGY_ID_SECOND_INNINGS) {
    return reasons;
  }
  if (mode === STRATEGY_ID_SPLIT_POOL) {
    return reasons;
  }

  const roleCounts = {
    wicket_keeper: 0,
    batsman: 0,
    all_rounder: 0,
    bowler: 0,
  };
  const teamCounts = {};
  let profileAllRounderCount = 0;
  pool.forEach((row) => {
    const r = getEffectiveLineupRole(row.team, row.player);
    if (roleCounts[r] !== undefined) {
      roleCounts[r] += 1;
    }
    if (getRawProfileRole(row.team, row.player) === "all_rounder") {
      profileAllRounderCount += 1;
    }
    teamCounts[row.team] = (teamCounts[row.team] || 0) + 1;
  });

  const teamNames = [teamASelect.value, teamBSelect.value].filter(Boolean);
  const MIN_PER_TEAM = 4;
  const poolScope =
    mode === STRATEGY_ID_BAT_POOLS ? "generator pool (ticks + P1∪P2)" : "selected players";
  if (Object.keys(teamCounts).length < 2) {
    reasons.push(
      mode === STRATEGY_ID_BAT_POOLS
        ? "Generator pool must include both teams."
        : "Selected players must include both teams."
    );
  }
  teamNames.forEach((tn) => {
    if ((teamCounts[tn] || 0) < MIN_PER_TEAM) {
      reasons.push(`Need at least ${MIN_PER_TEAM} players from ${tn} in ${poolScope} (for 4–7 split in XI).`);
    }
  });
  if (roleCounts.wicket_keeper < 1) {
    reasons.push(`Need at least 1 wicket-keeper in ${poolScope}.`);
  }
  if (roleCounts.batsman < 1) {
    reasons.push(`Need at least 1 batsman in ${poolScope}.`);
  }
  if (profileAllRounderCount < 1) {
    reasons.push(`Need at least 1 all-rounder in ${poolScope}.`);
  }
  if (roleCounts.bowler < 1) {
    reasons.push(`Need at least 1 bowler in ${poolScope}.`);
  }

  if (mode !== STRATEGY_ID_SECOND_INNINGS) {
    const scenarioIds = getActiveHighScoringScenarioIds();
    scenarioIds.forEach((sid) => {
      if (!xiModeCvPoolsValidForScenario(pool, sid)) {
        reasons.push(
          `Scenario ${sid}: tick at least one **C** and one **VC** in the XI pool (see hint under that scenario). Need two different players if only one name per pool.`
        );
      }
    });
  }
  return reasons;
}

function getBatPoolFixtureKey() {
  const a = teamASelect?.value || "";
  const b = teamBSelect?.value || "";
  if (!a || !b) {
    return "";
  }
  return [a, b].sort().join("||");
}

/** Franchise 7–4 cap: driven by `state.batPools.split74Quota` (checkbox is kept in sync; do not read DOM elsewhere — avoids form-restore / timing clearing the default). */
function isBatFirstSplit74QuotaEnabledFromUi() {
  return Boolean(state.batPools.split74Quota);
}

function syncBatFirstSplit74CheckboxFromState() {
  const el = document.getElementById("batFirstSplit74QuotaCheckbox");
  if (el) {
    el.checked = Boolean(state.batPools.split74Quota);
  }
}

function getSecondInningsFixtureKey() {
  return getBatPoolFixtureKey();
}

function getSecondInningsChasingTeamFromUi() {
  const raw = String(secondInningsChasingTeamSelect?.value || state.secondInningsPools.chasingTeam || "").trim();
  if (raw === teamASelect?.value || raw === teamBSelect?.value) {
    return raw;
  }
  return teamASelect?.value || "";
}

function getSecondInningsChaseUnionIds() {
  return [...new Set([...(state.secondInningsPools.p1Top || []), ...(state.secondInningsPools.p1Rest || [])])];
}

function getSecondInningsUnionPlayerIds() {
  return [...new Set([...getSecondInningsChaseUnionIds(), ...(state.secondInningsPools.p2 || [])])];
}

/** All ticked squad players for the current match (may include names outside chase/P2 pools). */
function getSecondInningsCvEligiblePlayerIds() {
  const teamSet = new Set([teamASelect?.value, teamBSelect?.value].filter(Boolean));
  return [...state.selectedPlayers].filter((id) => {
    const sep = id.indexOf("::");
    const team = sep >= 0 ? id.slice(0, sep) : "";
    return teamSet.has(team);
  });
}

function emptySecondInningsScenarioCvEntry() {
  return { captainPool: [], viceCaptainPool: [] };
}

function sanitizeSecondInningsScenarioCvEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return emptySecondInningsScenarioCvEntry();
  }
  const cap = [...new Set(Array.isArray(entry.captainPool) ? entry.captainPool : [])];
  const vc = [...new Set(Array.isArray(entry.viceCaptainPool) ? entry.viceCaptainPool : [])];
  return { captainPool: cap, viceCaptainPool: vc };
}

function ensureSecondInningsScenarioCvShape() {
  if (!state.secondInningsPools.scenarioCv || typeof state.secondInningsPools.scenarioCv !== "object") {
    state.secondInningsPools.scenarioCv = {
      chase: emptySecondInningsScenarioCvEntry(),
      bowl: emptySecondInningsScenarioCvEntry(),
    };
  }
  state.secondInningsPools.scenarioCv.chase = sanitizeSecondInningsScenarioCvEntry(
    state.secondInningsPools.scenarioCv.chase
  );
  state.secondInningsPools.scenarioCv.bowl = sanitizeSecondInningsScenarioCvEntry(
    state.secondInningsPools.scenarioCv.bowl
  );
}

function migrateLegacySecondInningsScenarioCv(o) {
  if (o.scenarioCv && typeof o.scenarioCv === "object") {
    return {
      chase: sanitizeSecondInningsScenarioCvEntry(o.scenarioCv.chase),
      bowl: sanitizeSecondInningsScenarioCvEntry(o.scenarioCv.bowl),
    };
  }
  const legacy = Array.isArray(o.unifiedCvPool) ? [...o.unifiedCvPool] : [];
  if (o.useUnifiedCvPool && legacy.length) {
    return {
      chase: { captainPool: [...legacy], viceCaptainPool: [...legacy] },
      bowl: { captainPool: [...legacy], viceCaptainPool: [...legacy] },
    };
  }
  return {
    chase: emptySecondInningsScenarioCvEntry(),
    bowl: emptySecondInningsScenarioCvEntry(),
  };
}

function secondInningsCvScenarioKeyFromTag(highScoreScenarioTag) {
  return highScoreScenarioTag === "si_first_innings_bowl" ? "bowl" : "chase";
}

function secondInningsScenarioCvPoolsValid(capIds, vcIds) {
  const cap = new Set(capIds || []);
  const vc = new Set(vcIds || []);
  if (!cap.size || !vc.size) {
    return false;
  }
  if (cap.size >= 2 || vc.size >= 2) {
    return true;
  }
  const [c] = cap;
  const [v] = vc;
  return c !== v;
}

function addPlayerToSecondInningsScenarioCvPools(playerId) {
  ensureSecondInningsScenarioCvShape();
  ["chase", "bowl"].forEach((sk) => {
    const entry = state.secondInningsPools.scenarioCv[sk];
    const cap = new Set(entry.captainPool);
    const vc = new Set(entry.viceCaptainPool);
    cap.add(playerId);
    vc.add(playerId);
    entry.captainPool = [...cap];
    entry.viceCaptainPool = [...vc];
  });
}

function removePlayerFromSecondInningsScenarioCvPools(playerId) {
  ensureSecondInningsScenarioCvShape();
  ["chase", "bowl"].forEach((sk) => {
    const entry = state.secondInningsPools.scenarioCv[sk];
    entry.captainPool = entry.captainPool.filter((id) => id !== playerId);
    entry.viceCaptainPool = entry.viceCaptainPool.filter((id) => id !== playerId);
  });
}

function syncSecondInningsScenarioCvWithUnion() {
  ensureSecondInningsScenarioCvShape();
  const sel = state.selectedPlayers;
  ["chase", "bowl"].forEach((sk) => {
    const entry = state.secondInningsPools.scenarioCv[sk];
    entry.captainPool = entry.captainPool.filter((id) => sel.has(id));
    entry.viceCaptainPool = entry.viceCaptainPool.filter((id) => sel.has(id));
  });
}

function applySecondInningsScenarioCvCheckboxChange(scenarioKey, playerId, kind, checked) {
  ensureSecondInningsScenarioCvShape();
  const entry = state.secondInningsPools.scenarioCv[scenarioKey];
  if (!entry) {
    return;
  }
  const listKey = kind === "captain" ? "captainPool" : "viceCaptainPool";
  const cur = new Set(entry[listKey] || []);
  if (checked) {
    cur.add(playerId);
  } else {
    cur.delete(playerId);
  }
  entry[listKey] = [...cur];
  persistSecondInningsPools();
  const hint = document.getElementById("secondInningsPoolHint");
  if (hint) {
    hint.textContent = formatSecondInningsHintLine();
  }
}

function isSecondInningsChaseTopOrderBat(teamName, playerName, chasingTeam) {
  if (!chasingTeam || teamName !== chasingTeam) {
    return false;
  }
  const role = getEffectiveLineupRole(teamName, playerName);
  if (role === "wicket_keeper") {
    return true;
  }
  if (role === "batsman") {
    const profile = getPlayerProfile(teamName, playerName) || {};
    const typicalSlot =
      getBattingSlotFromFile(teamName, playerName) || inferBattingSlotFromProfile(teamName, playerName, profile);
    return typeof typicalSlot === "number" && typicalSlot > 0 && typicalSlot <= 3;
  }
  return false;
}

function migrateLegacySecondInningsP1ToTopRest(p1Ids, chasingTeam) {
  const p1Top = [];
  const p1Rest = [];
  (p1Ids || []).forEach((id) => {
    const sep = id.indexOf("::");
    const team = sep >= 0 ? id.slice(0, sep) : "";
    const player = sep >= 0 ? id.slice(sep + 2) : id;
    if (!team || !player) {
      return;
    }
    if (isSecondInningsChaseTopOrderBat(team, player, chasingTeam)) {
      p1Top.push(id);
    } else {
      p1Rest.push(id);
    }
  });
  return { p1Top, p1Rest };
}

function normalizeSecondInningsComboSpecKey(spec) {
  return String(spec || "")
    .trim()
    .split(",")
    .map((s) => s.trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .join(",");
}

function upgradeSecondInningsComboSpecIfLegacyAppDefault(spec, kind) {
  const key = normalizeSecondInningsComboSpecKey(spec);
  const legacy =
    kind === "chase" ? SECOND_INNINGS_LEGACY_CHASE_COMBO_SPECS : SECOND_INNINGS_LEGACY_BOWL_COMBO_SPECS;
  const legacyKeys = legacy.map((s) => normalizeSecondInningsComboSpecKey(s));
  if (legacyKeys.includes(key)) {
    return kind === "chase" ? DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC : DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC;
  }
  return String(spec || "").trim();
}

function migrateLegacyPairComboToTripleDefaults(oldComboSpec) {
  const pairs = parseSecondInningsComboSpec(oldComboSpec);
  if (!pairs.length) {
    return { chase: DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC, bowl: DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC };
  }
  const { p1, p2 } = pairs[0];
  return {
    chase: `0-${p1}-${p2}`,
    bowl: DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC,
  };
}

function parseSecondInningsTripleComboSpec(raw) {
  const src = String(raw || "").trim();
  const tokens = src
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  tokens.forEach((tk) => {
    const m = tk.match(/^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)$/);
    if (!m) {
      return;
    }
    const top = Number(m[1]);
    const rest = Number(m[2]);
    const p2 = Number(m[3]);
    if (
      !Number.isInteger(top) ||
      !Number.isInteger(rest) ||
      !Number.isInteger(p2) ||
      top < 0 ||
      rest < 0 ||
      p2 < 0 ||
      top + rest + p2 !== 5
    ) {
      return;
    }
    const key = `${top}-${rest}-${p2}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({ top, rest, p2 });
  });
  return out;
}

function getSecondInningsChaseCombosFromUi() {
  const el = document.getElementById("secondInningsChaseComboInput");
  const fromState = state.secondInningsPools.chaseComboSpec;
  const combos = parseSecondInningsTripleComboSpec(el?.value ?? fromState);
  if (combos.length) {
    return combos;
  }
  return parseSecondInningsTripleComboSpec(DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC);
}

function getSecondInningsBowlCombosFromUi() {
  const el = document.getElementById("secondInningsBowlComboInput");
  const fromState = state.secondInningsPools.bowlComboSpec;
  const combos = parseSecondInningsTripleComboSpec(el?.value ?? fromState);
  if (combos.length) {
    return combos;
  }
  return parseSecondInningsTripleComboSpec(DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC);
}

function getSecondInningsChaseScenarioPercentFromUi() {
  const el = document.getElementById("secondInningsChaseScenarioPctInput");
  let v = Number(el?.value ?? state.secondInningsPools.chaseScenarioPercent ?? DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT);
  if (!Number.isFinite(v)) {
    v = DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT;
  }
  return Math.min(100, Math.max(0, Math.round(v)));
}

function applySecondInningsChaseScenarioPercentToUi(v) {
  const el = document.getElementById("secondInningsChaseScenarioPctInput");
  let n = Math.round(Number(v));
  if (!Number.isFinite(n)) {
    n = DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT;
  }
  n = Math.min(100, Math.max(0, n));
  if (el) {
    el.value = String(n);
  }
  state.secondInningsPools.chaseScenarioPercent = n;
}

function parseSecondInningsComboSpec(raw) {
  const src = String(raw || "").trim();
  const tokens = src
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  tokens.forEach((tk) => {
    const m = tk.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) {
      return;
    }
    const p1 = Number(m[1]);
    const p2 = Number(m[2]);
    if (!Number.isInteger(p1) || !Number.isInteger(p2) || p1 < 0 || p2 < 0 || p1 + p2 !== 5) {
      return;
    }
    const key = `${p1}-${p2}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({ p1, p2 });
  });
  return out;
}

function persistSecondInningsPools() {
  const fk = getSecondInningsFixtureKey();
  if (!fk) {
    return;
  }
  state.secondInningsPools.fixtureKey = fk;
  state.secondInningsPools.chasingTeam = getSecondInningsChasingTeamFromUi();
  state.secondInningsPools.chaseScenarioPercent = getSecondInningsChaseScenarioPercentFromUi();
  const chaseEl = document.getElementById("secondInningsChaseComboInput");
  const bowlEl = document.getElementById("secondInningsBowlComboInput");
  state.secondInningsPools.chaseComboSpec = String(
    chaseEl?.value ?? state.secondInningsPools.chaseComboSpec ?? DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC
  );
  state.secondInningsPools.bowlComboSpec = String(
    bowlEl?.value ?? state.secondInningsPools.bowlComboSpec ?? DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC
  );
  try {
    localStorage.setItem(
      SECOND_INNINGS_POOLS_STORAGE_KEY,
      JSON.stringify({
        fixture: fk,
        chasingTeam: state.secondInningsPools.chasingTeam,
        p1Top: state.secondInningsPools.p1Top || [],
        p1Rest: state.secondInningsPools.p1Rest || [],
        p2: state.secondInningsPools.p2,
        chaseScenarioPercent: state.secondInningsPools.chaseScenarioPercent,
        chaseComboSpec: state.secondInningsPools.chaseComboSpec,
        bowlComboSpec: state.secondInningsPools.bowlComboSpec,
        scenarioCv: state.secondInningsPools.scenarioCv,
      })
    );
  } catch {
    /* ignore */
  }
}

function syncSecondInningsPoolsWithSelection() {
  const sel = state.selectedPlayers;
  state.secondInningsPools.p1Top = (state.secondInningsPools.p1Top || []).filter((id) => sel.has(id));
  state.secondInningsPools.p1Rest = (state.secondInningsPools.p1Rest || []).filter((id) => sel.has(id));
  state.secondInningsPools.p2 = state.secondInningsPools.p2.filter((id) => sel.has(id));
  syncSecondInningsScenarioCvWithUnion();
}

function movePlayerToSecondInningsPool(playerId, targetPool) {
  state.secondInningsPools.p1Top = (state.secondInningsPools.p1Top || []).filter((id) => id !== playerId);
  state.secondInningsPools.p1Rest = (state.secondInningsPools.p1Rest || []).filter((id) => id !== playerId);
  state.secondInningsPools.p2 = state.secondInningsPools.p2.filter((id) => id !== playerId);
  if (targetPool === 0) {
    removePlayerFromSecondInningsScenarioCvPools(playerId);
  }
  if (targetPool === 1) {
    state.secondInningsPools.p1Top.push(playerId);
  } else if (targetPool === 2) {
    state.secondInningsPools.p1Rest.push(playerId);
  } else if (targetPool === 3) {
    state.secondInningsPools.p2.push(playerId);
  }
  if (targetPool === 1 || targetPool === 2 || targetPool === 3) {
    addPlayerToSecondInningsScenarioCvPools(playerId);
  }
  persistSecondInningsPools();
  renderSecondInningsPoolPanel();
}

function autoFillSecondInningsPoolsFromSelection() {
  const sel = [...state.selectedPlayers];
  const chasingTeam = getSecondInningsChasingTeamFromUi();
  const firstBatTeam = teamASelect.value === chasingTeam ? teamBSelect.value : teamASelect.value;
  const p1Top = [];
  const p1Rest = [];
  const p2 = [];
  sel.forEach((id) => {
    const sep = id.indexOf("::");
    const team = sep >= 0 ? id.slice(0, sep) : "";
    const player = sep >= 0 ? id.slice(sep + 2) : id;
    if (!team || !player) {
      return;
    }
    if (team === chasingTeam) {
      if (isSecondInningsChaseTopOrderBat(team, player, chasingTeam)) {
        p1Top.push(id);
      } else {
        p1Rest.push(id);
      }
      return;
    }
    const role = getEffectiveLineupRole(team, player);
    const rawRole = getRawProfileRole(team, player);
    if (team === firstBatTeam && (role === "bowler" || rawRole === "all_rounder")) {
      p2.push(id);
    }
  });
  state.secondInningsPools.fixtureKey = getSecondInningsFixtureKey();
  state.secondInningsPools.chasingTeam = chasingTeam;
  state.secondInningsPools.p1Top = p1Top;
  state.secondInningsPools.p1Rest = p1Rest;
  state.secondInningsPools.p2 = p2;
  state.secondInningsPools.scenarioCv = {
    chase: suggestSecondInningsScenarioCvIds("chase"),
    bowl: suggestSecondInningsScenarioCvIds("bowl"),
  };
  persistSecondInningsPools();
  renderSecondInningsPoolPanel();
}

function formatSecondInningsHintLine() {
  const nT = (state.secondInningsPools.p1Top || []).length;
  const nR = (state.secondInningsPools.p1Rest || []).length;
  const n2 = state.secondInningsPools.p2.length;
  const chaseCombos = getSecondInningsChaseCombosFromUi();
  const bowlCombos = getSecondInningsBowlCombosFromUi();
  const chaseBits = chaseCombos.map((c) => `(${c.top}-${c.rest}-${c.p2})`).join(", ");
  const bowlBits = bowlCombos.map((c) => `(${c.top}-${c.rest}-${c.p2})`).join(", ");
  const pct = getSecondInningsChaseScenarioPercentFromUi();
  const n = getTeamsPerStrategyFromUi();
  const nChase = computeBatFirstFullPoolTeamCount(n, pct);
  const nBowl = Math.max(0, n - nChase);
  ensureSecondInningsScenarioCvShape();
  const chaseCv = state.secondInningsPools.scenarioCv.chase;
  const bowlCv = state.secondInningsPools.scenarioCv.bowl;
  const cvLine = ` C/VC chase: ${chaseCv.captainPool.length}C/${chaseCv.viceCaptainPool.length}VC; bowl: ${bowlCv.captainPool.length}C/${bowlCv.viceCaptainPool.length}VC.`;
  return `2nd-innings: chase Top=${nT}, chase Rest=${nR}, 1st-inns P2=${n2}. Chase-middle combos ${chaseBits || "(none)"}; first-innings-bowl combos ${bowlBits || "(none)"}. ~${pct}% chase (${nChase} team(s)) / ${100 - pct}% bowl (${nBowl} team(s)); output interleaves chase then bowl.${cvLine}`;
}

function renderSecondInningsScenarioCvColumn(container, scenarioKey, heading) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  ensureSecondInningsScenarioCvShape();
  const entry = state.secondInningsPools.scenarioCv[scenarioKey] || emptySecondInningsScenarioCvEntry();
  const capSet = new Set(entry.captainPool || []);
  const vcSet = new Set(entry.viceCaptainPool || []);

  const h = document.createElement("h4");
  h.className = "cvc-pool-team-title";
  h.textContent = heading;
  container.appendChild(h);

  const allTicked = getSecondInningsCvEligiblePlayerIds();
  const suggestedSet = getSuggestedSecondInningsCvPlayerIds(scenarioKey);
  const displayed = [...new Set([...suggestedSet, ...capSet, ...vcSet])]
    .filter((id) => state.selectedPlayers.has(id))
    .sort((a, b) => {
      const pa = a.includes("::") ? a.slice(a.indexOf("::") + 2) : a;
      const pb = b.includes("::") ? b.slice(b.indexOf("::") + 2) : b;
      return pa.localeCompare(pb);
    });
  if (!allTicked.length) {
    const hint = document.createElement("p");
    hint.className = "cvc-pool-hint";
    hint.textContent = "Tick squad players in step 1, then assign C / VC here.";
    container.appendChild(hint);
    return;
  }

  const scenarioTag = scenarioKey === "bowl" ? "si_first_innings_bowl" : "si_chase_middle";
  const abbrevs = getSecondInningsAbbrevsForPdf();
  const outcomeTpl = SECOND_INNINGS_OUTCOME_PDF[scenarioTag];
  if (outcomeTpl) {
    const outcomeEl = document.createElement("p");
    outcomeEl.className = "cvc-pool-scenario-outcome";
    outcomeEl.textContent = `Expected lineup: ${fillScenarioCvHintTemplate(outcomeTpl, abbrevs)}`;
    container.appendChild(outcomeEl);
  }
  const roleHint = document.createElement("p");
  roleHint.className = "cvc-pool-scenario-hint";
  roleHint.innerHTML = getSecondInningsScenarioCvHintText(scenarioTag);
  container.appendChild(roleHint);

  const hint = document.createElement("p");
  hint.className = "cvc-pool-hint";
  hint.textContent =
    "Suggested roles for this scenario are listed below. Use Add other ticked players for anyone else.";
  container.appendChild(hint);

  const grid = document.createElement("div");
  grid.className = "cvc-tick-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", `${heading} captain and vice-captain pools`);

  const header = document.createElement("div");
  header.className = "cvc-tick-header";
  const colName = document.createElement("span");
  colName.className = "cvc-tick-col cvc-tick-col-name";
  colName.textContent = "Player";
  const colC = document.createElement("span");
  colC.className = "cvc-tick-col cvc-tick-col-c";
  colC.textContent = "C";
  colC.title = "Captain pool";
  const colVc = document.createElement("span");
  colVc.className = "cvc-tick-col cvc-tick-col-vc";
  colVc.textContent = "VC";
  colVc.title = "Vice-captain pool";
  header.appendChild(colName);
  header.appendChild(colC);
  header.appendChild(colVc);
  grid.appendChild(header);

  displayed.forEach((id) => {
    const sep = id.indexOf("::");
    const teamNm = sep >= 0 ? id.slice(0, sep) : "";
    const playerNm = sep >= 0 ? id.slice(sep + 2) : id;
    const row = document.createElement("div");
    row.className = "cvc-tick-row";

    const nameSpan = document.createElement("span");
    nameSpan.className = suggestedSet.has(id) ? "cvc-tick-name" : "cvc-tick-name cvc-tick-name-extra";
    nameSpan.textContent = teamNm
      ? `${playerNm} (${teamNm})${suggestedSet.has(id) ? "" : " · added"}`
      : playerNm;

    const mkCell = (kind, isChecked, ariaLabel) => {
      const wrap = document.createElement("div");
      wrap.className = "cvc-tick-cell";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isChecked;
      cb.setAttribute("aria-label", `${ariaLabel}: ${playerNm}`);
      cb.addEventListener("change", () => {
        applySecondInningsScenarioCvCheckboxChange(scenarioKey, id, kind, cb.checked);
      });
      wrap.appendChild(cb);
      return wrap;
    };

    row.appendChild(nameSpan);
    row.appendChild(mkCell("captain", capSet.has(id), "Captain pool"));
    row.appendChild(mkCell("vice_captain", vcSet.has(id), "Vice-captain pool"));
    grid.appendChild(row);
  });

  container.appendChild(grid);
  const cvItems = allTicked
    .filter((id) => !suggestedSet.has(id))
    .map((id) => {
      const sep = id.indexOf("::");
      const teamNm = sep >= 0 ? id.slice(0, sep) : "";
      const playerNm = sep >= 0 ? id.slice(sep + 2) : id;
      return {
        key: id,
        label: teamNm ? `${playerNm} (${teamNm})` : playerNm,
      };
    });
  appendCvPoolAddMissingControls(container, cvItems, capSet, vcSet, (playerId) => {
    addPlayerToSecondInningsScenarioCvPoolsBoth(scenarioKey, playerId);
    renderSecondInningsScenarioCvUi();
  });
}

function renderSecondInningsScenarioCvUi() {
  renderSecondInningsScenarioCvColumn(
    document.getElementById("secondInningsChaseCvHost"),
    "chase",
    "Chase-middle — C / VC pools"
  );
  renderSecondInningsScenarioCvColumn(
    document.getElementById("secondInningsBowlCvHost"),
    "bowl",
    "First-innings bowl — C / VC pools"
  );
}

function renderSecondInningsPoolPanel() {
  const grid = document.getElementById("secondInningsPoolGrid");
  const hint = document.getElementById("secondInningsPoolHint");
  if (!grid) {
    return;
  }
  syncSecondInningsPoolsWithSelection();
  grid.innerHTML = "";
  const titles = [
    "Chase — top order (WK + bat slot ≤3)",
    "Chase — rest (all other ticked chase players)",
    "Pool 3 — first-innings BOWL/AR",
  ];
  const poolKeys = ["p1Top", "p1Rest", "p2"];
  const poolNum = { p1Top: 1, p1Rest: 2, p2: 3 };
  for (let col = 0; col < 3; col += 1) {
    const wrap = document.createElement("div");
    wrap.className = "bat-pool-column";
    const h = document.createElement("h4");
    h.textContent = titles[col];
    wrap.appendChild(h);
    const ul = document.createElement("ul");
    ul.className = "bat-pool-list";
    const pk = poolKeys[col];
    (state.secondInningsPools[pk] || []).forEach((id) => {
      const sep = id.indexOf("::");
      const player = sep >= 0 ? id.slice(sep + 2) : id;
      const li = document.createElement("li");
      li.className = "bat-pool-item";
      const meta = document.createElement("span");
      meta.className = "bat-pool-item-meta";
      meta.textContent = player;
      const moves = document.createElement("div");
      moves.className = "bat-pool-moves";
      [1, 2, 3, 0].forEach((toPool) => {
        if (toPool === poolNum[pk]) {
          return;
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bat-pool-move-btn";
        b.textContent = toPool === 0 ? "OUT" : toPool === 1 ? "P1T" : toPool === 2 ? "P1R" : "P2";
        b.title = toPool === 0 ? "Remove from pools" : `Move to pool ${toPool === 1 ? "top" : toPool === 2 ? "rest" : "P2"}`;
        b.addEventListener("click", () => movePlayerToSecondInningsPool(id, toPool));
        moves.appendChild(b);
      });
      li.appendChild(meta);
      li.appendChild(moves);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    grid.appendChild(wrap);
  }
  if (hint) {
    hint.textContent = formatSecondInningsHintLine();
  }
  renderSecondInningsScenarioCvUi();
}

function updateGeneratorModePanels() {
  const mode = getGeneratorModeFromUi();
  const batSection = document.getElementById("batPoolSection");
  const splitSection = document.getElementById("splitPoolSection");
  const secondSection = document.getElementById("secondInningsPoolSection");
  const cvcSection = document.querySelector(".cvc-pool-section");
  if (batSection) {
    batSection.style.display = mode === STRATEGY_ID_BAT_POOLS ? "" : "none";
  }
  if (splitSection) {
    splitSection.style.display = mode === STRATEGY_ID_SPLIT_POOL ? "" : "none";
  }
  if (secondSection) {
    secondSection.style.display = mode === STRATEGY_ID_SECOND_INNINGS ? "" : "none";
  }
  if (cvcSection) {
    cvcSection.style.display = mode === STRATEGY_ID_SECOND_INNINGS ? "none" : "";
  }
  const scenarioProfileBlock = scenarioProfileSelect?.closest(".generator-option-block");
  if (scenarioProfileBlock) {
    scenarioProfileBlock.style.display = mode === STRATEGY_ID_SPLIT_POOL ? "none" : "";
  }
  if (mode === STRATEGY_ID_SPLIT_POOL && window.IPL_SPLIT_POOL) {
    window.IPL_SPLIT_POOL.loadSplitPoolsForFixture();
    window.IPL_SPLIT_POOL.renderSplitPoolPanel();
    renderCvPoolPanels();
  }
}

function getSecondInningsPoolOnlyBlockers() {
  syncSecondInningsPoolsWithSelection();
  const reasons = [];
  const nT = (state.secondInningsPools.p1Top || []).length;
  const nR = (state.secondInningsPools.p1Rest || []).length;
  const n2 = state.secondInningsPools.p2.length;
  const chasingTeam = getSecondInningsChasingTeamFromUi();
  if (!chasingTeam) {
    reasons.push("Select chasing team for 2nd-innings mode.");
  }
  if (nT + nR + n2 < 5) {
    reasons.push("Need at least 5 players across chase top, chase rest, and first-innings pools.");
  }
  const chaseCombos = getSecondInningsChaseCombosFromUi();
  const bowlCombos = getSecondInningsBowlCombosFromUi();
  if (!chaseCombos.length) {
    reasons.push("Enter at least one valid chase combo (Top-Rest-P2, three numbers summing to 5), e.g. 0-3-2.");
  }
  if (!bowlCombos.length) {
    reasons.push("Enter at least one valid bowl combo (Top-Rest-P2, sum 5), e.g. 1-2-2.");
  }
  chaseCombos.forEach((c) => {
    if (c.top > nT || c.rest > nR || c.p2 > n2) {
      reasons.push(
        `Chase combo ${c.top}-${c.rest}-${c.p2} needs Top≥${c.top}, Rest≥${c.rest}, P2≥${c.p2}; currently ${nT}/${nR}/${n2}.`
      );
    }
  });
  bowlCombos.forEach((c) => {
    if (c.top > nT || c.rest > nR || c.p2 > n2) {
      reasons.push(
        `Bowl combo ${c.top}-${c.rest}-${c.p2} needs Top≥${c.top}, Rest≥${c.rest}, P2≥${c.p2}; currently ${nT}/${nR}/${n2}.`
      );
    }
  });
  ensureSecondInningsScenarioCvShape();
  const eligibleCv = new Set(getSecondInningsCvEligiblePlayerIds());
  const n = getTeamsPerStrategyFromUi();
  const chasePct = getSecondInningsChaseScenarioPercentFromUi();
  const nChase = computeBatFirstFullPoolTeamCount(n, chasePct);
  const nBowl = Math.max(0, n - nChase);
  const checkScenario = (label, sk, teamCount) => {
    if (teamCount <= 0) {
      return;
    }
    const poolBased = getSecondInningsPoolBasedCvIds(sk, eligibleCv);
    const entry = state.secondInningsPools.scenarioCv[sk];
    const capTicked = (entry?.captainPool || []).filter((id) => eligibleCv.has(id));
    const vcTicked = (entry?.viceCaptainPool || []).filter((id) => eligibleCv.has(id));
    const cap =
      capTicked.filter((id) => poolBased.capIds.includes(id)).length > 0
        ? capTicked.filter((id) => poolBased.capIds.includes(id))
        : poolBased.capIds;
    const vc =
      vcTicked.filter((id) => poolBased.vcIds.includes(id)).length > 0
        ? vcTicked.filter((id) => poolBased.vcIds.includes(id))
        : poolBased.vcIds;
    if (!secondInningsScenarioCvPoolsValid(cap, vc)) {
      reasons.push(
        `${label}: tick at least one C and one VC (different players if only one name per pool).`
      );
    }
  };
  checkScenario("Chase-middle C/VC", "chase", nChase);
  checkScenario("First-innings bowl C/VC", "bowl", nBowl);
  return reasons;
}

function applySecondInningsPoolsForCurrentFixture() {
  const fk = getSecondInningsFixtureKey();
  if (!fk) {
    state.secondInningsPools.fixtureKey = "";
    renderSecondInningsPoolPanel();
    return;
  }
  const a = teamASelect?.value || "";
  const b = teamBSelect?.value || "";
  if (secondInningsChasingTeamSelect) {
    secondInningsChasingTeamSelect.innerHTML = "";
    [a, b]
      .filter(Boolean)
      .forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        secondInningsChasingTeamSelect.appendChild(option);
      });
  }
  const defaultChaseTeam = a;
  try {
    const raw = localStorage.getItem(SECOND_INNINGS_POOLS_STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      const hasNewShape = o.fixture === fk && (Array.isArray(o.p1Top) || Array.isArray(o.p1Rest) || Array.isArray(o.p1));
      if (hasNewShape) {
        const chasing = o.chasingTeam === b || o.chasingTeam === a ? o.chasingTeam : defaultChaseTeam;
        let p1Top = Array.isArray(o.p1Top) ? [...o.p1Top] : [];
        let p1Rest = Array.isArray(o.p1Rest) ? [...o.p1Rest] : [];
        const p2 = Array.isArray(o.p2) ? [...o.p2] : [];
        const mergedChase = new Set([...p1Top, ...p1Rest]);
        if (Array.isArray(o.p1) && o.p1.length && mergedChase.size === 0) {
          const mig = migrateLegacySecondInningsP1ToTopRest(o.p1, chasing);
          p1Top = mig.p1Top;
          p1Rest = mig.p1Rest;
        }
        const chasePct =
          o.chaseScenarioPercent != null && Number.isFinite(Number(o.chaseScenarioPercent))
            ? Math.min(100, Math.max(0, Math.round(Number(o.chaseScenarioPercent))))
            : DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT;
        let chaseComboSpec = String(o.chaseComboSpec || "").trim();
        let bowlComboSpec = String(o.bowlComboSpec || "").trim();
        if (!chaseComboSpec || !bowlComboSpec) {
          const migC = migrateLegacyPairComboToTripleDefaults(String(o.comboSpec || ""));
          if (!chaseComboSpec) {
            chaseComboSpec = migC.chase;
          }
          if (!bowlComboSpec) {
            bowlComboSpec = migC.bowl;
          }
        }
        const chaseBefore = chaseComboSpec;
        const bowlBefore = bowlComboSpec;
        chaseComboSpec = upgradeSecondInningsComboSpecIfLegacyAppDefault(chaseComboSpec, "chase");
        bowlComboSpec = upgradeSecondInningsComboSpecIfLegacyAppDefault(bowlComboSpec, "bowl");
        const combosUpgraded = chaseComboSpec !== chaseBefore || bowlComboSpec !== bowlBefore;
        state.secondInningsPools = {
          fixtureKey: fk,
          chasingTeam: chasing,
          p1Top,
          p1Rest,
          p2,
          chaseScenarioPercent: chasePct,
          chaseComboSpec: chaseComboSpec || DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC,
          bowlComboSpec: bowlComboSpec || DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC,
          scenarioCv: migrateLegacySecondInningsScenarioCv(o),
        };
        syncSecondInningsPoolsWithSelection();
        ensureSecondInningsScenarioCvShape();
        if (combosUpgraded) {
          persistSecondInningsPools();
        }
      }
    }
  } catch {
    /* ignore */
  }
  if (!state.secondInningsPools.fixtureKey || state.secondInningsPools.fixtureKey !== fk) {
    state.secondInningsPools = {
      fixtureKey: fk,
      chasingTeam: defaultChaseTeam,
      p1Top: [],
      p1Rest: [],
      p2: [],
      chaseScenarioPercent: DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT,
      chaseComboSpec: DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC,
      bowlComboSpec: DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC,
      scenarioCv: {
        chase: emptySecondInningsScenarioCvEntry(),
        bowl: emptySecondInningsScenarioCvEntry(),
      },
    };
  }
  if (secondInningsChasingTeamSelect) {
    secondInningsChasingTeamSelect.value = state.secondInningsPools.chasingTeam || defaultChaseTeam;
  }
  applySecondInningsChaseScenarioPercentToUi(state.secondInningsPools.chaseScenarioPercent);
  const chaseComboInput = document.getElementById("secondInningsChaseComboInput");
  if (chaseComboInput) {
    chaseComboInput.value = state.secondInningsPools.chaseComboSpec || DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC;
  }
  const bowlComboInput = document.getElementById("secondInningsBowlComboInput");
  if (bowlComboInput) {
    bowlComboInput.value = state.secondInningsPools.bowlComboSpec || DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC;
  }
  renderSecondInningsPoolPanel();
}

function isRawBowlOrArProfile(teamName, playerName) {
  const r = getRawProfileRole(teamName, playerName);
  return r === "bowler" || r === "all_rounder";
}

function migrateLegacyBatPoolP3IntoTwoPools(p1In, p2In, p3In) {
  const p1 = [...(p1In || [])];
  const p2 = [...(p2In || [])];
  const have = new Set([...p1, ...p2]);
  (p3In || []).forEach((id) => {
    if (have.has(id)) {
      return;
    }
    const sep = id.indexOf("::");
    const team = sep >= 0 ? id.slice(0, sep) : "";
    const player = sep >= 0 ? id.slice(sep + 2) : "";
    if (!team || !player) {
      return;
    }
    if (isRawBowlOrArProfile(team, player)) {
      p2.push(id);
    } else {
      p1.push(id);
    }
    have.add(id);
  });
  return { p1, p2 };
}

function sanitizeBatReducedExcludeIds(rawIds, poolUnionSet) {
  const out = [];
  const seen = new Set();
  (rawIds || []).forEach((id) => {
    if (!id || seen.has(id) || !poolUnionSet.has(id)) {
      return;
    }
    seen.add(id);
    out.push(id);
  });
  return out;
}

function getBatFirstFullPoolPercentFromUi() {
  const el = batFirstFullPoolPctInput;
  let v = Number(el?.value ?? state.batPools.fullPoolPercent ?? DEFAULT_BAT_FIRST_FULL_POOL_PCT);
  if (!Number.isFinite(v)) {
    v = DEFAULT_BAT_FIRST_FULL_POOL_PCT;
  }
  return Math.min(100, Math.max(0, Math.round(v)));
}

function applyBatFirstFullPoolPercentToUi(pct) {
  let v = Number(pct);
  if (!Number.isFinite(v)) {
    v = DEFAULT_BAT_FIRST_FULL_POOL_PCT;
  }
  v = Math.min(100, Math.max(0, Math.round(v)));
  if (batFirstFullPoolPctInput) {
    batFirstFullPoolPctInput.value = String(v);
  }
  state.batPools.fullPoolPercent = v;
}

/** First `lenFull` accepted teams (by `teams.length` before accept) use full pools; rest use reduced. */
function computeBatFirstFullPoolTeamCount(numTeams, fullPoolPercent) {
  const n = Math.max(0, Math.floor(Number(numTeams) || 0));
  const p = Math.max(0, Math.min(100, Number(fullPoolPercent) || 0));
  if (!n) {
    return 0;
  }
  const exactFull = (n * p) / 100;
  let lenFull = Math.floor(exactFull);
  if (exactFull - lenFull >= 0.5 && lenFull < n) {
    lenFull += 1;
  }
  return lenFull;
}

function filterBatPoolRowsByExcludedIds(rows, excludeSet) {
  if (!excludeSet || excludeSet.size === 0) {
    return rows;
  }
  return rows.filter((row) => !excludeSet.has(poolPlayerKey(row)));
}

function persistBatPools() {
  const fk = getBatPoolFixtureKey();
  if (!fk) {
    return;
  }
  state.batPools.fullSegmentPercents = getBatFirstFullSegmentPercentsFromUi();
  state.batPools.reducedSegmentPercents = getBatFirstReducedSegmentPercentsFromUi();
  state.batPools.lineupDupStages = getBatFirstLineupDupStagesFromUi();
  state.batPools.fullPoolPercent = getBatFirstFullPoolPercentFromUi();
  state.batPools.fixtureKey = fk;
  const union = new Set([...state.batPools.p1, ...state.batPools.p2]);
  state.batPools.reducedExcludeIds = sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, union);
  try {
    localStorage.setItem(
      BAT_POOLS_STORAGE_KEY,
      JSON.stringify({
        fixture: fk,
        p1: state.batPools.p1,
        p2: state.batPools.p2,
        split74Quota: Boolean(state.batPools.split74Quota),
        fullSegmentPercents: state.batPools.fullSegmentPercents,
        reducedSegmentPercents: state.batPools.reducedSegmentPercents,
        lineupDupStages: state.batPools.lineupDupStages,
        fullPoolPercent: state.batPools.fullPoolPercent,
        reducedExcludeIds: state.batPools.reducedExcludeIds,
      })
    );
  } catch {
    /* ignore quota */
  }
}

function syncBatPoolsWithSelection() {
  const sel = state.selectedPlayers;
  state.batPools.p2 = state.batPools.p2.filter((id) => sel.has(id));
  state.batPools.p1 = state.batPools.p1.filter((id) => sel.has(id));
  window.IPL_SPLIT_POOL?.syncSplitPoolsWithSelection?.();
}

function getBatFirstPoolOnlyBlockers() {
  syncBatPoolsWithSelection();
  const reasons = [];
  const sel = [...state.selectedPlayers];
  if (state.batPools.p1.length + state.batPools.p2.length === 0) {
    reasons.push("Set up P1/P2 pools (Auto-fill or add players) before generating.");
    return reasons;
  }
  const seen = new Set();
  ["p1", "p2"].forEach((poolKey) => {
    state.batPools[poolKey].forEach((id) => {
      if (seen.has(id)) {
        const short = id.split("::")[1] || id;
        reasons.push(`Duplicate bat-pool assignment: ${short}.`);
      }
      seen.add(id);
    });
  });
  for (const id of sel) {
    if (!seen.has(id)) {
      const short = id.split("::")[1] || id;
      reasons.push(`${short} is not in any bat-first pool (Auto-fill or move buttons).`);
    }
  }
  const n1 = state.batPools.p1.length;
  const n2 = state.batPools.p2.length;
  const targetN = getBatFirstTargetTeamCountHint();
  const needP1 = Math.max(BAT_FIRST_SEG_A.p1, BAT_FIRST_SEG_B.p1);
  const needP2 = Math.max(BAT_FIRST_SEG_A.p2, BAT_FIRST_SEG_B.p2);
  if (n1 < needP1) {
    reasons.push(`Pool 1 needs at least ${needP1} players for current bat-first variant mix — currently ${n1}.`);
  }
  if (n2 < needP2) {
    reasons.push(`Pool 2 needs at least ${needP2} players for current bat-first variant mix — currently ${n2}.`);
  }
  const fullPct = getBatFirstFullPoolPercentFromUi();
  const lenReduced = Math.max(0, targetN - computeBatFirstFullPoolTeamCount(targetN, fullPct));
  if (lenReduced > 0) {
    const union = new Set([...state.batPools.p1, ...state.batPools.p2]);
    const ex = new Set(sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, union));
    const n1r = state.batPools.p1.filter((id) => !ex.has(id)).length;
    const n2r = state.batPools.p2.filter((id) => !ex.has(id)).length;
    if (n1r < needP1 || n2r < needP2) {
      reasons.push(
        `Reduced-pool segment (${lenReduced} team(s), ${100 - fullPct}% approx.): after exclusions, P1=${n1r} P2=${n2r} but phases need up to ${needP1}/${needP2}. Remove exclusions or grow pools.`
      );
    }
  }
  return reasons;
}

function applyBatPoolsForCurrentFixture() {
  const fk = getBatPoolFixtureKey();
  if (!fk) {
    state.batPools.fixtureKey = "";
    syncBatFirstSplit74CheckboxFromState();
    renderBatPoolPanel();
    return;
  }
  if (
    state.batPools.fixtureKey === fk &&
    state.batPools.p1.length + state.batPools.p2.length > 0
  ) {
    syncBatPoolsWithSelection();
    syncBatFirstSplit74CheckboxFromState();
    state.batPools.fullSegmentPercents = sanitizeBatFirstSegmentPair(
      state.batPools.fullSegmentPercents || DEFAULT_BAT_FIRST_SEGMENT_PERCENTS
    );
    state.batPools.reducedSegmentPercents = sanitizeBatFirstSegmentPair(
      state.batPools.reducedSegmentPercents || DEFAULT_BAT_FIRST_SEGMENT_PERCENTS
    );
    applyBatFirstSegmentPercentsToUi(state.batPools.fullSegmentPercents, state.batPools.reducedSegmentPercents);
    state.batPools.lineupDupStages = sanitizeBatFirstLineupDupStages(
      state.batPools.lineupDupStages ?? DEFAULT_BAT_FIRST_LINEUP_DUP_STAGES
    );
    applyBatFirstLineupDupStagesToUi(state.batPools.lineupDupStages);
    applyBatFirstFullPoolPercentToUi(state.batPools.fullPoolPercent ?? DEFAULT_BAT_FIRST_FULL_POOL_PCT);
    const u0 = new Set([...state.batPools.p1, ...state.batPools.p2]);
    state.batPools.reducedExcludeIds = sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, u0);
    renderBatPoolPanel();
    return;
  }
  try {
    const raw = localStorage.getItem(BAT_POOLS_STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o.fixture === fk && Array.isArray(o.p1)) {
        const merged = migrateLegacyBatPoolP3IntoTwoPools(o.p1, o.p2, o.p3);
        state.batPools = {
          fixtureKey: fk,
          p1: merged.p1,
          p2: merged.p2,
          split74Quota: coalesceStoredBatFirstSplit74Quota(o),
          fullSegmentPercents: migrateBatFirstSegmentPercents(o.fullSegmentPercents),
          reducedSegmentPercents: migrateBatFirstSegmentPercents(o.reducedSegmentPercents),
          lineupDupStages: sanitizeBatFirstLineupDupStages(
            o.lineupDupStages || DEFAULT_BAT_FIRST_LINEUP_DUP_STAGES
          ),
          fullPoolPercent:
            o.fullPoolPercent != null && Number.isFinite(Number(o.fullPoolPercent))
              ? Math.min(100, Math.max(0, Math.round(Number(o.fullPoolPercent))))
              : DEFAULT_BAT_FIRST_FULL_POOL_PCT,
          reducedExcludeIds: Array.isArray(o.reducedExcludeIds) ? o.reducedExcludeIds : [],
        };
        syncBatPoolsWithSelection();
        const u = new Set([...state.batPools.p1, ...state.batPools.p2]);
        state.batPools.reducedExcludeIds = sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, u);
        syncBatFirstSplit74CheckboxFromState();
        applyBatFirstSegmentPercentsToUi(
          state.batPools.fullSegmentPercents,
          state.batPools.reducedSegmentPercents
        );
        applyBatFirstLineupDupStagesToUi(state.batPools.lineupDupStages);
        applyBatFirstFullPoolPercentToUi(state.batPools.fullPoolPercent);
        renderBatPoolPanel();
        return;
      }
    }
  } catch {
    /* ignore */
  }
  state.batPools = {
    fixtureKey: fk,
    p1: [],
    p2: [],
    split74Quota: DEFAULT_BAT_FIRST_SPLIT74_QUOTA,
    fullSegmentPercents: { ...DEFAULT_BAT_FIRST_SEGMENT_PERCENTS },
    reducedSegmentPercents: { ...DEFAULT_BAT_FIRST_SEGMENT_PERCENTS },
    lineupDupStages: [...DEFAULT_BAT_FIRST_LINEUP_DUP_STAGES],
    fullPoolPercent: DEFAULT_BAT_FIRST_FULL_POOL_PCT,
    reducedExcludeIds: [],
  };
  syncBatFirstSplit74CheckboxFromState();
  applyBatFirstSegmentPercentsToUi(state.batPools.fullSegmentPercents, state.batPools.reducedSegmentPercents);
  applyBatFirstLineupDupStagesToUi(state.batPools.lineupDupStages);
  applyBatFirstFullPoolPercentToUi(state.batPools.fullPoolPercent);
  renderBatPoolPanel();
}

function sanitizeBatFirstLineupDupStages(raw) {
  const clampSlot = (v, fallbackIdx) => {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) {
      return DEFAULT_BAT_FIRST_LINEUP_DUP_STAGES[fallbackIdx];
    }
    return Math.min(50, Math.max(0, n));
  };
  const src = Array.isArray(raw) ? raw : [];
  return [0, 1, 2].map((idx) => clampSlot(src[idx], idx));
}

function getBatFirstLineupDupStagesFromUi() {
  return sanitizeBatFirstLineupDupStages([
    batFirstDupStage1Input?.value ?? state.batPools.lineupDupStages?.[0],
    batFirstDupStage2Input?.value ?? state.batPools.lineupDupStages?.[1],
    batFirstDupStage3Input?.value ?? state.batPools.lineupDupStages?.[2],
  ]);
}

function applyBatFirstLineupDupStagesToUi(stages) {
  const s = sanitizeBatFirstLineupDupStages(stages);
  if (batFirstDupStage1Input) {
    batFirstDupStage1Input.value = String(s[0]);
  }
  if (batFirstDupStage2Input) {
    batFirstDupStage2Input.value = String(s[1]);
  }
  if (batFirstDupStage3Input) {
    batFirstDupStage3Input.value = String(s[2]);
  }
}

function binomialCoefficientLoose(n, k) {
  if (k < 0 || k > n) {
    return 0;
  }
  let kk = Math.min(k, n - k);
  let c = 1;
  for (let i = 1; i <= kk; i += 1) {
    c = (c * (n - kk + i)) / i;
  }
  return Math.round(c);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function enumerateCombinations(items, k) {
  const n = items.length;
  if (k < 0 || k > n) {
    return [];
  }
  if (k === 0) {
    return [[]];
  }
  const out = [];
  const path = [];
  function dfs(start) {
    if (path.length === k) {
      out.push([...path]);
      return;
    }
    const need = k - path.length;
    for (let i = start; i <= n - need; i += 1) {
      path.push(items[i]);
      dfs(i + 1);
      path.pop();
    }
  }
  dfs(0);
  return out;
}

function preparePoolComboSchedule(rows, k) {
  const n = rows.length;
  const total = binomialCoefficientLoose(n, k);
  if (total === 0) {
    return { total: 0, combos: [], mode: "none" };
  }
  if (total <= BAT_POOL_COMBO_ENUM_CAP) {
    const combos = enumerateCombinations(rows, k);
    shuffleInPlace(combos);
    return { total, combos, mode: "enumerate" };
  }
  return { total, combos: [], mode: "random" };
}

function pickFromComboSchedule(schedule, successIndex, rows, k) {
  if (schedule.mode === "enumerate" && successIndex < schedule.combos.length) {
    return schedule.combos[successIndex];
  }
  if (rows.length <= k) {
    return [...rows];
  }
  const copy = [...rows];
  const out = [];
  for (let i = 0; i < k; i += 1) {
    const j = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(j, 1)[0]);
  }
  return out;
}

function migrateBatFirstSegmentPercents(raw) {
  if (raw && (raw.segA != null || raw.segB != null)) {
    return sanitizeBatFirstSegmentPair(raw);
  }
  return { ...DEFAULT_BAT_FIRST_SEGMENT_PERCENTS };
}

function sanitizeBatFirstSegmentPair(raw, fallback = DEFAULT_BAT_FIRST_SEGMENT_PERCENTS) {
  const toNum = (v, fb) => {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      return fb;
    }
    return Math.max(0, n);
  };
  let a = toNum(raw?.segA, fallback.segA);
  let b = toNum(raw?.segB, fallback.segB);
  if (a + b <= 0) {
    a = fallback.segA;
    b = fallback.segB;
  }
  const sum = a + b;
  return {
    segA: (a / sum) * 100,
    segB: (b / sum) * 100,
  };
}

function computeBatFirstTwoSegmentEnds(numTeams, segPercents) {
  const n = Math.max(0, Math.floor(Number(numTeams) || 0));
  const p = segPercents || DEFAULT_BAT_FIRST_SEGMENT_PERCENTS;
  const exactA = (n * p.segA) / 100;
  const exactB = (n * p.segB) / 100;
  let lenA = Math.floor(exactA);
  let lenB = Math.floor(exactB);
  let rem = n - lenA - lenB;
  const fracOrder = [
    { key: "A", frac: exactA - lenA },
    { key: "B", frac: exactB - lenB },
  ].sort((x, y) => y.frac - x.frac);
  let idx = 0;
  while (rem > 0) {
    const k = fracOrder[idx % 2].key;
    if (k === "A") lenA += 1;
    else lenB += 1;
    rem -= 1;
    idx += 1;
  }
  return { n, lenA, lenB, endA: lenA, segPercents: p };
}

function getBatFirstFullSegmentPercentsFromUi() {
  return sanitizeBatFirstSegmentPair({
    segA: batFirstFullSegAPctInput?.value ?? state.batPools.fullSegmentPercents?.segA,
    segB: batFirstFullSegBPctInput?.value ?? state.batPools.fullSegmentPercents?.segB,
  });
}

function getBatFirstReducedSegmentPercentsFromUi() {
  return sanitizeBatFirstSegmentPair({
    segA: batFirstReducedSegAPctInput?.value ?? state.batPools.reducedSegmentPercents?.segA,
    segB: batFirstReducedSegBPctInput?.value ?? state.batPools.reducedSegmentPercents?.segB,
  });
}

function applyBatFirstSegmentPercentsToUi(fullPerc, reducedPerc) {
  const f = sanitizeBatFirstSegmentPair(fullPerc || DEFAULT_BAT_FIRST_SEGMENT_PERCENTS);
  const r = sanitizeBatFirstSegmentPair(reducedPerc || DEFAULT_BAT_FIRST_SEGMENT_PERCENTS);
  if (batFirstFullSegAPctInput) {
    batFirstFullSegAPctInput.value = String(Math.round(f.segA));
  }
  if (batFirstFullSegBPctInput) {
    batFirstFullSegBPctInput.value = String(Math.round(f.segB));
  }
  if (batFirstReducedSegAPctInput) {
    batFirstReducedSegAPctInput.value = String(Math.round(r.segA));
  }
  if (batFirstReducedSegBPctInput) {
    batFirstReducedSegBPctInput.value = String(Math.round(r.segB));
  }
  state.batPools.fullSegmentPercents = f;
  state.batPools.reducedSegmentPercents = r;
}

/**
 * Which P1/P2 pick counts to use for this accepted team index.
 * Full-pool teams (first `fullPoolTeamCount`) use `fullSegmentPercents`; the rest use `reducedSegmentPercents`.
 */
function getBatFirstBatchPicksForAcceptedIndex(acceptedIndex, numTeams) {
  const fullN = computeBatFirstFullPoolTeamCount(numTeams, getBatFirstFullPoolPercentFromUi());
  const fullSeg = getBatFirstFullSegmentPercentsFromUi();
  const redSeg = getBatFirstReducedSegmentPercentsFromUi();
  if (acceptedIndex < fullN) {
    const { endA } = computeBatFirstTwoSegmentEnds(fullN, fullSeg);
    return acceptedIndex < endA ? { ...BAT_FIRST_SEG_A } : { ...BAT_FIRST_SEG_B };
  }
  const redTotal = Math.max(0, numTeams - fullN);
  const sub = acceptedIndex - fullN;
  const { endA } = computeBatFirstTwoSegmentEnds(redTotal, redSeg);
  return sub < endA ? { ...BAT_FIRST_SEG_A } : { ...BAT_FIRST_SEG_B };
}

function getBatFirstTargetTeamCountHint() {
  const raw = Number(teamsPerStrategyInput?.value ?? 200);
  if (Number.isNaN(raw)) {
    return 200;
  }
  return Math.min(500, Math.max(1, Math.floor(raw)));
}

function pickWeightedPoolSubset(rows, k, appearanceCounts, tuning) {
  if (k <= 0 || !rows.length) {
    return [];
  }
  if (rows.length <= k) {
    return [...rows];
  }
  const weighted = rows.map((row) => {
    const rep = repeatPenaltyFactor(row, appearanceCounts, tuning.repeatLambda);
    const bat = lowerMiddleBatsmanDrawFactor(row, tuning);
    return { ...row, weight: Math.max(0.02, rep * bat) };
  });
  return weightedSampleWithoutReplacement(weighted, k);
}

function makeRowLookupByKey(pool) {
  const m = new Map();
  pool.forEach((r) => {
    m.set(poolPlayerKey(r), r);
  });
  return m;
}

function autoFillBatPoolsFromSelection() {
  const sel = [...state.selectedPlayers];
  if (!sel.length) {
    state.batPools.fixtureKey = getBatPoolFixtureKey();
    state.batPools.p1 = [];
    state.batPools.p2 = [];
    const u = new Set();
    state.batPools.reducedExcludeIds = sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, u);
    persistBatPools();
    renderBatPoolPanel();
    return;
  }
  const p2 = [];
  const p1 = [];
  sel.forEach((id) => {
    const sep = id.indexOf("::");
    const team = sep >= 0 ? id.slice(0, sep) : "";
    const player = sep >= 0 ? id.slice(sep + 2) : id;
    if (!team || !player) {
      return;
    }
    if (isRawBowlOrArProfile(team, player)) {
      p2.push(id);
    }
  });
  sel.forEach((id) => {
    if (p2.includes(id)) {
      return;
    }
    const sep = id.indexOf("::");
    const team = sep >= 0 ? id.slice(0, sep) : "";
    const player = sep >= 0 ? id.slice(sep + 2) : id;
    if (!team || !player) {
      return;
    }
    p1.push(id);
  });
  state.batPools.fixtureKey = getBatPoolFixtureKey();
  state.batPools.p1 = p1;
  state.batPools.p2 = p2;
  const u = new Set([...p1, ...p2]);
  state.batPools.reducedExcludeIds = sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, u);
  persistBatPools();
  renderBatPoolPanel();
}

function movePlayerToBatPool(playerId, poolNum) {
  state.batPools.p1 = state.batPools.p1.filter((id) => id !== playerId);
  state.batPools.p2 = state.batPools.p2.filter((id) => id !== playerId);
  if (poolNum === 1) {
    state.batPools.p1.push(playerId);
  } else {
    state.batPools.p2.push(playerId);
  }
  const u = new Set([...state.batPools.p1, ...state.batPools.p2]);
  state.batPools.reducedExcludeIds = sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, u);
  persistBatPools();
  renderBatPoolPanel();
}

function formatBatPoolHintLine() {
  const n1 = state.batPools.p1.length;
  const n2 = state.batPools.p2.length;
  const N = getBatFirstTargetTeamCountHint();
  const fullPct = getBatFirstFullPoolPercentFromUi();
  const nFull = computeBatFirstFullPoolTeamCount(N, fullPct);
  const nRed = Math.max(0, N - nFull);
  const fullSeg = getBatFirstFullSegmentPercentsFromUi();
  const redSeg = getBatFirstReducedSegmentPercentsFromUi();
  const fEnd = computeBatFirstTwoSegmentEnds(nFull, fullSeg);
  const rEnd = nRed > 0 ? computeBatFirstTwoSegmentEnds(nRed, redSeg) : { lenA: 0, lenB: 0 };
  const union = new Set([...state.batPools.p1, ...state.batPools.p2]);
  const exSet = new Set(sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, union));
  const exn = exSet.size;
  const n1red = state.batPools.p1.filter((id) => !exSet.has(id)).length;
  const n2red = state.batPools.p2.filter((id) => !exSet.has(id)).length;
  const fcNote = isBatFirstSplit74QuotaEnabledFromUi()
    ? " 7–4 franchise cap on."
    : "";
  const dup = getBatFirstLineupDupStagesFromUi();
  const dupNote = dup.length ? ` Same-XI extra slots/pass: [${dup.join(", ")}].` : "";
  const segNote =
    exn > 0 || nFull < N
      ? `Full ${nFull} (~${fullPct}%): ${fEnd.lenA}×6+5 + ${fEnd.lenB}×5+6 (${fullSeg.segA.toFixed(0)}/${fullSeg.segB.toFixed(0)}%). Reduced ${nRed}: ${rEnd.lenA}×6+5 + ${rEnd.lenB}×5+6 (${redSeg.segA.toFixed(0)}/${redSeg.segB.toFixed(0)}%); P1/P2 ${n1red}/${n2red} (${exn} excl.).`
      : `All ${N} full pool: ${fEnd.lenA}×6+5 + ${fEnd.lenB}×5+6 (${fullSeg.segA.toFixed(0)}/${fullSeg.segB.toFixed(0)}%).`;
  return `P1/P2 ${n1}/${n2}. ${segNote}${fcNote}${dupNote}`;
}

function renderBatFirstReducedExcludePanel() {
  const host = batFirstReducedExcludeHost;
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
    "For the <strong>reduced</strong> segment (see full-pool % above), tick players to remove from P1/P2. Full-pool teams still use everyone in both pools.";
  host.appendChild(sub);
  const ids = [...new Set([...state.batPools.p1, ...state.batPools.p2])].sort((a, b) => {
    const pa = a.split("::")[1] || a;
    const pb = b.split("::")[1] || b;
    return pa.localeCompare(pb);
  });
  const exSet = new Set(state.batPools.reducedExcludeIds || []);
  const grid = document.createElement("div");
  grid.className = "bat-first-reduced-grid";
  if (!ids.length) {
    const empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "Fill P1/P2 (Auto-fill) to choose exclusions.";
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
      const u = new Set([...state.batPools.p1, ...state.batPools.p2]);
      const next = new Set(sanitizeBatReducedExcludeIds(state.batPools.reducedExcludeIds, u));
      if (cb.checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      state.batPools.reducedExcludeIds = [...next];
      persistBatPools();
      const hint = document.getElementById("batPoolHint");
      if (hint) {
        hint.textContent = formatBatPoolHintLine();
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

function renderBatPoolPanel() {
  const grid = document.getElementById("batPoolGrid");
  const hint = document.getElementById("batPoolHint");
  if (!grid) {
    return;
  }
  syncBatFirstSplit74CheckboxFromState();
  syncBatPoolsWithSelection();
  grid.innerHTML = "";
  const titles = [
    "Pool 1 — ticked batsmen / WK (profile: not bowler or AR)",
    "Pool 2 — ticked bowlers + all-rounders (profile)",
  ];
  const poolKeys = ["p1", "p2"];
  for (let col = 0; col < 2; col += 1) {
    const wrap = document.createElement("div");
    wrap.className = "bat-pool-column";
    const h = document.createElement("h4");
    h.textContent = titles[col];
    wrap.appendChild(h);
    const ul = document.createElement("ul");
    ul.className = "bat-pool-list";
    const pk = poolKeys[col];
    state.batPools[pk].forEach((id) => {
      const sep = id.indexOf("::");
      const player = sep >= 0 ? id.slice(sep + 2) : id;
      const li = document.createElement("li");
      li.className = "bat-pool-item";
      const meta = document.createElement("span");
      meta.className = "bat-pool-item-meta";
      if (!state.selectedPlayers.has(id)) {
        meta.textContent = `${player} — not ticked`;
        meta.style.color = "#b45309";
      } else {
        meta.textContent = player;
      }
      const moves = document.createElement("div");
      moves.className = "bat-pool-moves";
      const currentPool = col + 1;
      for (let t = 1; t <= 2; t += 1) {
        if (t === currentPool) {
          continue;
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bat-pool-move-btn";
        b.textContent = `P${t}`;
        b.title = `Move to pool ${t}`;
        b.addEventListener("click", () => movePlayerToBatPool(id, t));
        moves.appendChild(b);
      }
      li.appendChild(meta);
      li.appendChild(moves);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    grid.appendChild(wrap);
  }
  renderBatFirstReducedExcludePanel();
  if (hint) {
    hint.textContent = formatBatPoolHintLine();
  }
}

function generateBatFirstPoolTeamsForStrategy(
  pool,
  numTeams,
  seenKeys,
  recentLineupState,
  appearanceCounts,
  tuning,
  cvFair
) {
  const counts = appearanceCounts || new Map();
  const t = tuning || DEFAULT_GENERATOR_TUNING;
  const keyToRow = makeRowLookupByKey(pool);
  const bc = state.batPools;
  const franchise74Cap = isBatFirstSplit74QuotaEnabledFromUi();
  const capFranchise74 = franchise74Cap ? Math.floor(numTeams * BAT_FIRST_FRANCHISE_74_MAX_FRAC) : 0;
  let countFranchise74 = 0;
  const teamAName = teamASelect?.value || "";
  const teamBName = teamBSelect?.value || "";
  const fullPoolTeamCount = computeBatFirstFullPoolTeamCount(numTeams, getBatFirstFullPoolPercentFromUi());
  const poolUnion = new Set([...bc.p1, ...bc.p2]);
  const excludePlayerSet = new Set(sanitizeBatReducedExcludeIds(bc.reducedExcludeIds, poolUnion));
  const baseP1Rows = bc.p1.map((id) => keyToRow.get(id)).filter(Boolean);
  const baseP2Rows = bc.p2.map((id) => keyToRow.get(id)).filter(Boolean);
  const redP1Rows = filterBatPoolRowsByExcludedIds(baseP1Rows, excludePlayerSet);
  const redP2Rows = filterBatPoolRowsByExcludedIds(baseP2Rows, excludePlayerSet);
  function makeBatFirstSchedules(p1r, p2r) {
    return {
      s65: {
        p1: preparePoolComboSchedule(p1r, BAT_FIRST_SEG_A.p1),
        p2: preparePoolComboSchedule(p2r, BAT_FIRST_SEG_A.p2),
      },
      s56: {
        p1: preparePoolComboSchedule(p1r, BAT_FIRST_SEG_B.p1),
        p2: preparePoolComboSchedule(p2r, BAT_FIRST_SEG_B.p2),
      },
    };
  }
  const schedFull = makeBatFirstSchedules(baseP1Rows, baseP2Rows);
  const schedRed = makeBatFirstSchedules(redP1Rows, redP2Rows);
  const scenarioIds = getActiveHighScoringScenarioIds();
  const { minPer, fairPerCell } = computeHighScoringMinPerCell(numTeams, scenarioIds.length);
  const scenarioCounts = new Array(scenarioIds.length).fill(0);
  const teams = [];
  const lineupAcceptCounts = new Map();
  const lineupDupAllowanceStages = getBatFirstLineupDupStagesFromUi();
  let attempts = 0;
  const hardAttemptCap = numTeams * ATTEMPTS_MULTIPLIER * BAT_FIRST_ATTEMPTS_MULTIPLIER;
  const bowlerArFair = buildBowlerArFairnessState(pool);
  const cvPairCounts = new Map();
  const verboseBatLog = Boolean(document.getElementById("batFirstVerboseLogCheckbox")?.checked);
  const rejectStats = {
    bad_length: 0,
    overlap_keys: 0,
    franchise_74_quota: 0,
    cvc_none: 0,
    dedupe_collision: 0,
    lineup_dup_cap: 0,
  };
  const invalidXiCounts = {};
  const rejectSamples = [];
  const maxRejectSamples = 35;
  const stageReports = [];
  function recordBatFirstReject(code, extra = {}) {
    if (String(code).startsWith("xi_")) {
      invalidXiCounts[code] = (invalidXiCounts[code] || 0) + 1;
    } else if (rejectStats[code] != null) {
      rejectStats[code] += 1;
    }
    if (verboseBatLog && rejectSamples.length < maxRejectSamples) {
      rejectSamples.push({ code, ...extra });
    }
  }

  for (let stageIdx = 0; stageIdx < lineupDupAllowanceStages.length && teams.length < numTeams; stageIdx += 1) {
    const maxDupPerXi = lineupDupAllowanceStages[stageIdx];
    const maxEntriesPerXi = 1 + maxDupPerXi;
    let attemptsInStage = 0;
    let consecutiveFailures = 0;
    const acceptedBeforeStage = teams.length;
    while (teams.length < numTeams && attemptsInStage < hardAttemptCap) {
      attempts += 1;
      attemptsInStage += 1;
      const si = getRoundRobinScenarioIndex(teams.length, scenarioIds.length);
      const scenarioId = scenarioIds[si];
      const targetRank = teams.length;
      const { p1: k1Now, p2: k2Now } = getBatFirstBatchPicksForAcceptedIndex(targetRank, numTeams);
      const useFullPool = targetRank < fullPoolTeamCount;
      const S = useFullPool ? schedFull : schedRed;
      const p1Rows = useFullPool ? baseP1Rows : redP1Rows;
      const p2Rows = useFullPool ? baseP2Rows : redP2Rows;
      const segSched = k1Now === BAT_FIRST_SEG_A.p1 ? S.s65 : S.s56;
      const activeSched1 = segSched.p1;
      const activeSched2 = segSched.p2;
      const rot1 =
        activeSched1.mode === "enumerate" && activeSched1.combos.length > 0
          ? (targetRank + consecutiveFailures) % activeSched1.combos.length
          : targetRank;
      const rot2 =
        activeSched2.mode === "enumerate" && activeSched2.combos.length > 0
          ? (targetRank + consecutiveFailures) % activeSched2.combos.length
          : targetRank;
      const slice1 = pickFromComboSchedule(activeSched1, rot1, p1Rows, k1Now);
      const slice2 = pickFromComboSchedule(activeSched2, rot2, p2Rows, k2Now);
      const team = [...slice1, ...slice2];
      if (team.length !== 11) {
        recordBatFirstReject("bad_length", { scenarioId, pool1Idx: rot1, pool2Idx: rot2, gotLen: team.length, stage: maxDupPerXi });
        consecutiveFailures += 1;
        continue;
      }
      const uniq = new Set(team.map(poolPlayerKey));
      if (uniq.size !== 11) {
        recordBatFirstReject("overlap_keys", { scenarioId, pool1Idx: rot1, pool2Idx: rot2, uniq: uniq.size, stage: maxDupPerXi });
        consecutiveFailures += 1;
        continue;
      }
      if (!isValidGeneratedTeam(team)) {
        const xr = explainInvalidGeneratedTeam(team) || "xi_unknown";
        recordBatFirstReject(xr, { scenarioId, pool1Idx: rot1, pool2Idx: rot2, stage: maxDupPerXi });
        consecutiveFailures += 1;
        continue;
      }
      if (
        franchise74Cap &&
        isFranchiseSplit74ForFixture(team, teamAName, teamBName) &&
        countFranchise74 >= capFranchise74
      ) {
        recordBatFirstReject("franchise_74_quota", { scenarioId, pool1Idx: rot1, pool2Idx: rot2, stage: maxDupPerXi });
        consecutiveFailures += 1;
        continue;
      }
      const playersOut = team.map((row) => ({
        team: row.team,
        player: row.player,
        role: row.role,
      }));
      const lineupKey = buildLineupOnlyKey(playersOut);
      if (isLineupInCooldown(recentLineupState, lineupKey)) {
        recordBatFirstReject("dedupe_collision", {
          scenarioId,
          pool1Idx: rot1,
          pool2Idx: rot2,
          reason: "lineup_cooldown",
          stage: maxDupPerXi,
        });
        consecutiveFailures += 1;
        continue;
      }
      const lineupUsed = lineupAcceptCounts.get(lineupKey) || 0;
      if (lineupUsed >= maxEntriesPerXi) {
        recordBatFirstReject("lineup_dup_cap", {
          scenarioId,
          pool1Idx: rot1,
          pool2Idx: rot2,
          stage: maxDupPerXi,
          lineupUsed,
          maxEntriesPerXi,
        });
        consecutiveFailures += 1;
        continue;
      }
      const cvc = chooseCaptainViceCaptain(team, t, cvFair, scenarioId, { seenKeys, playersOut }, {
        counts: cvPairCounts,
      });
      if (!cvc) {
        recordBatFirstReject("cvc_none", { scenarioId, pool1Idx: rot1, pool2Idx: rot2, stage: maxDupPerXi });
        consecutiveFailures += 1;
        continue;
      }
      const { captain, viceCaptain } = cvc;
      const key = buildTeamUniquenessKey(playersOut, captain, viceCaptain);
      if (seenKeys.has(key)) {
        recordBatFirstReject("dedupe_collision", {
          scenarioId,
          pool1Idx: rot1,
          pool2Idx: rot2,
          captain,
          viceCaptain,
          stage: maxDupPerXi,
        });
        consecutiveFailures += 1;
        continue;
      }
      seenKeys.add(key);
      lineupAcceptCounts.set(lineupKey, lineupUsed + 1);
      recordAcceptedLineup(recentLineupState, lineupKey);
      incrementCvPairAcceptCounts(cvPairCounts, scenarioId, captain, viceCaptain, team);
      team.forEach((row) => {
        const k = poolPlayerKey(row);
        counts.set(k, (counts.get(k) || 0) + 1);
        if (row.role === "bowler") {
          bowlerArFair.bowlerPickCounts.set(k, (bowlerArFair.bowlerPickCounts.get(k) || 0) + 1);
          bowlerArFair.totalBowlerSlots += 1;
        }
        if (row.role === "all_rounder") {
          bowlerArFair.arPickCounts.set(k, (bowlerArFair.arPickCounts.get(k) || 0) + 1);
          bowlerArFair.totalArSlots += 1;
        }
      });
      bowlerArFair.teamsBuilt += 1;
      const capRow = team.find((row) => row.player === captain);
      const vcRow = team.find((row) => row.player === viceCaptain);
      recordCvFairnessAssignment(cvFair, capRow?.team, captain, vcRow?.team, viceCaptain);
      const projectedPoints =
        team.reduce((acc, row) => acc + row.proj, 0) +
        (team.find((row) => row.player === captain)?.proj || 0) +
        0.5 * (team.find((row) => row.player === viceCaptain)?.proj || 0);
      scenarioCounts[si] += 1;
      consecutiveFailures = 0;
      if (franchise74Cap && isFranchiseSplit74ForFixture(team, teamAName, teamBName)) {
        countFranchise74 += 1;
      }
      teams.push({
        strategy: STRATEGY_ID_BAT_POOLS,
        captain,
        viceCaptain,
        projectedPoints: Number(projectedPoints.toFixed(2)),
        players: playersOut,
        highScoreScenario: scenarioId,
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
  if (verboseBatLog) {
    console.info("[bat_first_pool_xi] reject summary", {
      attempts,
      accepted: teams.length,
      ...rejectStats,
      invalidXiCounts,
    });
    if (rejectSamples.length) {
      console.info("[bat_first_pool_xi] reject samples", rejectSamples);
    }
  }
  const minAcross = scenarioCounts.length ? Math.min(...scenarioCounts) : 0;
  const cellsBelowMinQuota = scenarioCounts.filter((c) => c < minPer).length;
  return {
    teams,
    attempts,
    minTeams: minPer,
    targetTeams: numTeams,
    minFillMet: minPer === 0 || minAcross >= minPer,
    fullTargetMet: teams.length >= numTeams,
    highScoringQuota: {
      minPerCell: minPer,
      fairPerCell,
      scenarioCounts: [...scenarioCounts],
      minAcross,
      cellsBelowMinQuota,
    },
    batPoolMeta: (() => {
      const rejectReport = {
        attempts,
        accepted: teams.length,
        rejectStats: { ...rejectStats },
        invalidXiCounts: { ...invalidXiCounts },
        samples: [...rejectSamples],
        verbose: verboseBatLog,
        stagedDupPolicy: [...stageReports],
        lineupDupStagesConfigured: [...lineupDupAllowanceStages],
      };
      const fullN = fullPoolTeamCount;
      const redN = Math.max(0, numTeams - fullN);
      const fullSegSan = sanitizeBatFirstSegmentPair(getBatFirstFullSegmentPercentsFromUi());
      const redSegSan = sanitizeBatFirstSegmentPair(getBatFirstReducedSegmentPercentsFromUi());
      const fullSplit = computeBatFirstTwoSegmentEnds(fullN, fullSegSan);
      const redSplit = computeBatFirstTwoSegmentEnds(redN, redSegSan);
      const schedMeta = (sched) => ({
        s65: {
          p1: { mode: sched.s65.p1.mode, total: sched.s65.p1.total },
          p2: { mode: sched.s65.p2.mode, total: sched.s65.p2.total },
        },
        s56: {
          p1: { mode: sched.s56.p1.mode, total: sched.s56.p1.total },
          p2: { mode: sched.s56.p2.mode, total: sched.s56.p2.total },
        },
      });
      return {
        batchSegments: {
          segA: { ...BAT_FIRST_SEG_A },
          segB: { ...BAT_FIRST_SEG_B },
          full: {
            teamCount: fullN,
            lenSegA: fullSplit.lenA,
            lenSegB: fullSplit.lenB,
            perc: { ...fullSegSan },
          },
          reduced: {
            teamCount: redN,
            lenSegA: redSplit.lenA,
            lenSegB: redSplit.lenB,
            perc: { ...redSegSan },
          },
        },
        franchise74Cap: franchise74Cap
          ? { cap: capFranchise74, accepted74: countFranchise74 }
          : null,
        fullPoolSegment: {
          fullPoolPercent: getBatFirstFullPoolPercentFromUi(),
          teamsFromFullPool: fullPoolTeamCount,
          teamsFromReducedPool: Math.max(0, numTeams - fullPoolTeamCount),
          reducedExcludeCount: excludePlayerSet.size,
        },
        schedulesFull: schedMeta(schedFull),
        schedulesReduced: fullPoolTeamCount >= numTeams ? null : schedMeta(schedRed),
        pool2DrawPolicy: "enumerate_rotate_on_reject_when_enumerated",
        rejectReport,
      };
    })(),
  };
}

function formatBatFirstRejectReportHtml(meta) {
  const r = meta?.rejectReport;
  if (!r) {
    return "";
  }
  const parts = [];
  parts.push(
    `<p class="bat-first-log-title"><strong>Bat-first draw diagnostics</strong> (${r.accepted} accepted / ${r.attempts.toLocaleString()} attempts)</p>`
  );
  if (Array.isArray(r.lineupDupStagesConfigured) && r.lineupDupStagesConfigured.length) {
    const dsc = r.lineupDupStagesConfigured;
    parts.push(
      `<p><strong>Same-XI duplicate allowance</strong> (three passes): extra accepts per identical 11 beyond the first → <code>[${dsc.join(", ")}]</code>. In pass <em>i</em>, total accepts per XI ≤ <code>1 + value<sub>i</sub></code> (use <code>0</code> for strict unique elevens in that pass).</p>`
    );
  }
  if (meta.franchise74Cap) {
    const s = meta.franchise74Cap;
    parts.push(
      `<p><strong>Franchise 7–4 cap</strong>: at most <code>${s.cap}</code> accepted teams with 7 from one franchise / 4 from the other (unordered). Observed <code>${s.accepted74}</code>.</p>`
    );
  }
  parts.push("<p><strong>Reject counts (non–XI rules)</strong></p><ul>");
  parts.push(`<li><code>bad_length</code> (pool draw did not produce 11 unique rows): ${r.rejectStats.bad_length.toLocaleString()}</li>`);
  parts.push(`<li><code>overlap_keys</code> (same player twice across pools): ${r.rejectStats.overlap_keys.toLocaleString()}</li>`);
  if (meta.franchise74Cap) {
    parts.push(
      `<li><code>franchise_74_quota</code> (7/4 franchise split over cap): ${(r.rejectStats.franchise_74_quota ?? 0).toLocaleString()}</li>`
    );
  }
  parts.push(`<li><code>cvc_none</code> (no valid C/VC for scenario + dedupe): ${r.rejectStats.cvc_none.toLocaleString()}</li>`);
  parts.push(`<li><code>dedupe_collision</code> (XI+C+VC already seen): ${r.rejectStats.dedupe_collision.toLocaleString()}</li>`);
  parts.push(`<li><code>lineup_dup_cap</code> (current phase disallowed more repeats of same XI): ${(r.rejectStats.lineup_dup_cap ?? 0).toLocaleString()}</li>`);
  parts.push("</ul>");
  const xiKeys = Object.keys(r.invalidXiCounts || {}).sort((a, b) => r.invalidXiCounts[b] - r.invalidXiCounts[a]);
  if (xiKeys.length) {
    parts.push("<p><strong>XI rule rejects</strong> (first failing check in <code>isValidGeneratedTeam</code>)</p><ul>");
    xiKeys.slice(0, 24).forEach((k) => {
      parts.push(`<li><code>${k}</code>: ${r.invalidXiCounts[k].toLocaleString()}</li>`);
    });
    if (xiKeys.length > 24) {
      parts.push(`<li>… +${xiKeys.length - 24} more codes</li>`);
    }
    parts.push("</ul>");
  }
  if (r.verbose && r.samples?.length) {
    parts.push("<p><strong>Sample rejects</strong> (verbose)</p><ol>");
    r.samples.forEach((s) => {
      parts.push(
        `<li><code>${s.code}</code> · scen ${s.scenarioId ?? "-"} · p1 ${s.pool1Idx ?? "-"} · p2 ${s.pool2Idx ?? "-"}${s.captain ? ` · C ${s.captain}` : ""}</li>`
      );
    });
    parts.push("</ol>");
  }
  parts.push(
    `<p class="bat-first-log-note">Bat-first: two pools P1+P2; only <strong>6+5</strong> and <strong>5+6</strong>. Set segment % separately for <strong>full-pool</strong> teams vs <strong>reduced-pool</strong> (exclusions), default 50/50 each. Same-XI duplicate caps per pass are in the bat-first toolbar.</p>`
  );
  return parts.join("");
}

function formatSplitPoolRejectReportHtml(meta) {
  const r = meta?.rejectReport;
  if (!r) {
    return "";
  }
  const parts = [];
  parts.push(
    `<p class="bat-first-log-title"><strong>Split-pool draw diagnostics</strong> (${r.accepted} accepted / ${r.attempts.toLocaleString()} total iterations)</p>`
  );
  if (Array.isArray(r.lineupDupStagesConfigured) && r.lineupDupStagesConfigured.length) {
    const dsc = r.lineupDupStagesConfigured;
    parts.push(
      `<p><strong>Same-XI duplicate allowance</strong> (three passes): extra accepts per identical 11 beyond the first → <code>[${dsc.join(", ")}]</code>. Pass 1 = <code>0</code> extra (strict unique XIs); pass 2 allows <code>1</code> repeat; pass 3 allows <code>2</code> repeats (total ≤ <code>1 + cap</code> per XI in that pass).</p>`
    );
  }
  if (Array.isArray(r.stagedDupPolicy) && r.stagedDupPolicy.length) {
    parts.push("<p><strong>Per-pass summary</strong></p><ul>");
    r.stagedDupPolicy.forEach((s) => {
      parts.push(
        `<li>Pass cap <code>${s.stage}</code>: ${s.accepted} accepted in ${s.attempts.toLocaleString()} iterations${s.exhausted ? " (hit attempt cap)" : ""}</li>`
      );
    });
    parts.push("</ul>");
  }
  if (r.teamsFromFullPool != null) {
    parts.push(
      `<p><strong>Pools</strong>: ${r.teamsFromFullPool} teams from full P1/P2/P3; ${r.teamsFromReducedPool} from reduced pools (${r.reducedExcludeCount ?? 0} players excluded).</p>`
    );
  }
  const pc = r.profileCounts || {};
  parts.push(
    `<p><strong>Profiles accepted</strong>: C1 ${pc.C1 || 0} · C2 ${pc.C2 || 0} · C3 ${pc.C3 || 0} · C4 ${pc.C4 || 0}</p>`
  );
  parts.push("<p><strong>Reject counts</strong></p><ul>");
  const rs = r.rejectStats || {};
  const lines = [
    ["no_pair", "no whitelist pair for profile/segment"],
    ["pair_psum", "C1/C4 P3 sum cap on pair"],
    ["pair_t33", "forbidden t=3 on both franchises"],
    ["p3_fill", "could not fill P3 (AR* / bowler slots)"],
    ["p1p2_fill", "could not fill P1/P2 counts from pools"],
    ["overlap_keys", "duplicate player in XI draw"],
    ["cvc_none", "no valid C/VC for profile pools"],
    ["dedupe_collision", "XI+C+VC already seen"],
    ["lineup_cooldown", "XI in recent cooldown window"],
    ["lineup_dup_cap", "same XI over cap for current pass"],
  ];
  lines.forEach(([code, label]) => {
    const n = rs[code] ?? 0;
    if (n > 0) {
      parts.push(`<li><code>${code}</code> (${label}): ${n.toLocaleString()}</li>`);
    }
  });
  parts.push("</ul>");
  const xiKeys = Object.keys(r.invalidXiCounts || {}).sort(
    (a, b) => (r.invalidXiCounts[b] || 0) - (r.invalidXiCounts[a] || 0)
  );
  if (xiKeys.length) {
    parts.push("<p><strong>XI rule rejects</strong></p><ul>");
    xiKeys.slice(0, 20).forEach((k) => {
      parts.push(`<li><code>${k}</code>: ${r.invalidXiCounts[k].toLocaleString()}</li>`);
    });
    parts.push("</ul>");
  }
  if (r.verbose && r.samples?.length) {
    parts.push("<p><strong>Sample rejects</strong></p><ol>");
    r.samples.forEach((s) => {
      parts.push(
        `<li><code>${s.code}</code> · ${s.profileId || "-"} / ${s.segKey || "-"} · pass ${s.stage ?? "-"}${s.pair ? ` · ${s.pair}` : ""}</li>`
      );
    });
    parts.push("</ol>");
  }
  return parts.join("");
}

function formatSecondInningsRejectReportHtml(meta) {
  const r = meta?.rejectReport;
  if (!r) {
    return "";
  }
  const parts = [];
  parts.push(
    `<p class="bat-first-log-title"><strong>2nd-innings draw diagnostics</strong> (${r.accepted} accepted / ${r.attempts.toLocaleString()} total iterations)</p>`
  );
  parts.push(
    `<p>Pools resolved: Top <strong>${r.poolSizes?.top ?? 0}</strong> · Rest <strong>${r.poolSizes?.rest ?? 0}</strong> · P2 <strong>${r.poolSizes?.p2 ?? 0}</strong>. Uniqueness is per scenario tag (chase vs bowl can share the same XI+C/VC).</p>`
  );
  const chase = r.chase || {};
  const bowl = r.bowl || {};
  parts.push(
    `<p><strong>Chase-middle</strong> target ${chase.target ?? 0} → got ${chase.got ?? 0} (${(chase.attempts ?? 0).toLocaleString()} iterations${chase.exhausted ? ", hit cap" : ""})</p>`
  );
  parts.push(
    `<p><strong>First-innings bowl</strong> target ${bowl.target ?? 0} → got ${bowl.got ?? 0} (${(bowl.attempts ?? 0).toLocaleString()} iterations${bowl.exhausted ? ", hit cap" : ""})</p>`
  );
  const renderRejects = (label, rs) => {
    if (!rs) {
      return "";
    }
    const lines = [
      ["bad_length", "Top+Rest+P2 draw ≠ 5 (pool too small for combo?)"],
      ["overlap_keys", "duplicate player in draw"],
      ["lineup_cooldown", "XI in short cooldown window"],
      ["cvc_none", "no legal C/VC for this 5 and scenario pools"],
      ["dedupe_collision", "XI+C+VC already used in this scenario"],
      ["cv_pools_missing", "C/VC pools empty or invalid for this scenario"],
    ];
    let html = `<p><strong>${label} rejects</strong></p><ul>`;
    let any = false;
    lines.forEach(([code, desc]) => {
      const n = rs[code] ?? 0;
      if (n > 0) {
        any = true;
        html += `<li><code>${code}</code> (${desc}): ${n.toLocaleString()}</li>`;
      }
    });
    html += any ? "</ul>" : "<li>(none logged)</li></ul>";
    return html;
  };
  parts.push(renderRejects("Chase", chase.rejectStats));
  parts.push(renderRejects("Bowl", bowl.rejectStats));
  if (r.verbose && r.samples?.length) {
    parts.push("<p><strong>Sample rejects</strong></p><ol>");
    r.samples.forEach((s) => {
      parts.push(`<li><code>${s.code}</code> · ${s.scenario || "-"}${s.combo ? ` · ${s.combo}` : ""}</li>`);
    });
    parts.push("</ol>");
  }
  parts.push(
    '<p class="bat-first-log-note">C/VC follow <strong>pool rules</strong> (chase: C∈Top∪Rest, VC∈Rest∪P2; bowl: C∈P2, VC∈Top∪Rest∪P2). <code>cvc_none</code> → check pool assignment or combo vs pool sizes. Re-run <strong>Auto-fill</strong> after moving players.</p>'
  );
  return parts.join("");
}

/** Captain / vice pools for second innings (separate C and VC lists per scenario). */
function getSecondInningsCvRuntimeOptsForGeneration(highScoreScenarioTag) {
  ensureSecondInningsScenarioCvShape();
  const sk = secondInningsCvScenarioKeyFromTag(highScoreScenarioTag);
  const entry = state.secondInningsPools.scenarioCv[sk];
  const eligible = new Set(getSecondInningsCvEligiblePlayerIds());
  const poolBased = getSecondInningsPoolBasedCvIds(sk, eligible);
  const capTicked = (entry?.captainPool || []).filter((id) => eligible.has(id));
  const vcTicked = (entry?.viceCaptainPool || []).filter((id) => eligible.has(id));
  const capPoolSet = new Set(poolBased.capIds);
  const vcPoolSet = new Set(poolBased.vcIds);
  let capIds = capTicked.filter((id) => capPoolSet.has(id));
  let vcIds = vcTicked.filter((id) => vcPoolSet.has(id));
  if (!capIds.length) {
    capIds = poolBased.capIds;
  }
  if (!vcIds.length) {
    vcIds = poolBased.vcIds;
  }
  if (!secondInningsScenarioCvPoolsValid(capIds, vcIds)) {
    return null;
  }
  return {
    capKeys: new Set(capIds),
    vcKeys: new Set(vcIds),
    secondInningsRelaxTeamIntersect: true,
  };
}

/** α/β + suffix for C/VC scoring; avoid B3 suffix-4 layer (blocks many Ch bowlers on 5-player bowl lineups). */
function getSecondInningsCvLayerScenarioId(highScoreScenarioTag) {
  const chaseTeam = getSecondInningsChasingTeamFromUi();
  const teamA = teamASelect?.value || "";
  const prefix = chaseTeam === teamA ? "β" : "α";
  const suf = highScoreScenarioTag === "si_first_innings_bowl" ? "5" : "2";
  return `${prefix}${suf}`;
}

function buildSecondInningsTripleSchedules(combos, topRows, restRows, p2Rows) {
  const schedTop = new Map();
  const schedRest = new Map();
  const schedP2 = new Map();
  combos.forEach((c) => {
    if (!schedTop.has(c.top)) {
      schedTop.set(c.top, preparePoolComboSchedule(topRows, c.top));
    }
    if (!schedRest.has(c.rest)) {
      schedRest.set(c.rest, preparePoolComboSchedule(restRows, c.rest));
    }
    if (!schedP2.has(c.p2)) {
      schedP2.set(c.p2, preparePoolComboSchedule(p2Rows, c.p2));
    }
  });
  return { schedTop, schedRest, schedP2 };
}

function generateSecondInningsScenarioBlock(
  numTeamsTarget,
  combos,
  topRows,
  restRows,
  p2Rows,
  seenKeys,
  recentLineupState,
  counts,
  tuning,
  cvFair,
  highScoreScenarioTag,
  rejectReport
) {
  const t = tuning || DEFAULT_GENERATOR_TUNING;
  const { schedTop, schedRest, schedP2 } = buildSecondInningsTripleSchedules(combos, topRows, restRows, p2Rows);
  const teams = [];
  let attempts = 0;
  let consecutiveFailures = 0;
  const cap = Math.max(numTeamsTarget * ATTEMPTS_MULTIPLIER * SECOND_INNINGS_ATTEMPTS_MULTIPLIER, 1);
  const verboseLog = Boolean(document.getElementById("secondInningsVerboseLogCheckbox")?.checked);
  const rejectStats = rejectReport?.rejectStats || {
    bad_length: 0,
    overlap_keys: 0,
    lineup_cooldown: 0,
    cvc_none: 0,
    dedupe_collision: 0,
    cv_pools_missing: 0,
  };
  const rejectSamples = rejectReport?.samples || [];
  const maxRejectSamples = 35;
  const recordReject = (code, extra = {}) => {
    if (rejectStats[code] != null) {
      rejectStats[code] += 1;
    }
    if (verboseLog && rejectSamples.length < maxRejectSamples) {
      rejectSamples.push({ code, scenario: highScoreScenarioTag, ...extra });
    }
  };
  const cvOpts = getSecondInningsCvRuntimeOptsForGeneration(highScoreScenarioTag);
  if (!cvOpts) {
    recordReject("cv_pools_missing");
    return { teams: [], attempts: 0, cvPoolsMissing: true, rejectStats };
  }
  const cvLayerScenarioId = getSecondInningsCvLayerScenarioId(highScoreScenarioTag);
  const dedupeCtx = {
    seenKeys,
    useSecondInningsKey: true,
    secondInningsScenarioTag: highScoreScenarioTag,
    cvLayerOpts: { skipDualBowlerRule: true, secondInningsFivePlayer: true },
  };
  while (teams.length < numTeamsTarget && attempts < cap) {
    attempts += 1;
    const targetRank = teams.length;
    const combo = combos[targetRank % combos.length];
    const sT = schedTop.get(combo.top);
    const sR = schedRest.get(combo.rest);
    const s2 = schedP2.get(combo.p2);
    const rotT =
      sT?.mode === "enumerate" && sT.combos.length ? (targetRank + consecutiveFailures) % sT.combos.length : targetRank;
    const rotR =
      sR?.mode === "enumerate" && sR.combos.length ? (targetRank + consecutiveFailures) % sR.combos.length : targetRank;
    const rot2 =
      s2?.mode === "enumerate" && s2.combos.length ? (targetRank + consecutiveFailures) % s2.combos.length : targetRank;
    const sliceT = pickFromComboSchedule(sT, rotT, topRows, combo.top);
    const sliceR = pickFromComboSchedule(sR, rotR, restRows, combo.rest);
    const slice2 = pickFromComboSchedule(s2, rot2, p2Rows, combo.p2);
    const team = [...sliceT, ...sliceR, ...slice2];
    if (team.length !== 5) {
      recordReject("bad_length", { combo: `${combo.top}-${combo.rest}-${combo.p2}`, gotLen: team.length });
      consecutiveFailures += 1;
      continue;
    }
    const uniq = new Set(team.map(poolPlayerKey));
    if (uniq.size !== 5) {
      recordReject("overlap_keys", { combo: `${combo.top}-${combo.rest}-${combo.p2}` });
      consecutiveFailures += 1;
      continue;
    }
    const playersOut = team.map((row) => ({ team: row.team, player: row.player, role: row.role }));
    const lineupKey = buildLineupOnlyKey(playersOut);
    if (isLineupInCooldown(recentLineupState, lineupKey)) {
      recordReject("lineup_cooldown", { combo: `${combo.top}-${combo.rest}-${combo.p2}` });
      consecutiveFailures += 1;
      continue;
    }
    const cvc = chooseCaptainViceCaptain(
      team,
      t,
      cvFair,
      cvLayerScenarioId,
      { ...dedupeCtx, playersOut },
      null,
      cvOpts
    );
    if (!cvc) {
      recordReject("cvc_none", { combo: `${combo.top}-${combo.rest}-${combo.p2}` });
      consecutiveFailures += 1;
      continue;
    }
    const { captain, viceCaptain } = cvc;
    const key = buildSecondInningsUniquenessKey(playersOut, captain, viceCaptain, highScoreScenarioTag);
    if (seenKeys.has(key)) {
      recordReject("dedupe_collision", { combo: `${combo.top}-${combo.rest}-${combo.p2}`, captain, viceCaptain });
      consecutiveFailures += 1;
      continue;
    }
    seenKeys.add(key);
    recordAcceptedLineup(recentLineupState, lineupKey);
    team.forEach((row) => {
      const k = poolPlayerKey(row);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const capRow = team.find((row) => row.player === captain);
    const vcRow = team.find((row) => row.player === viceCaptain);
    recordCvFairnessAssignment(cvFair, capRow?.team, captain, vcRow?.team, viceCaptain);
    const projectedPoints =
      team.reduce((acc, row) => acc + row.proj, 0) +
      (team.find((row) => row.player === captain)?.proj || 0) +
      0.5 * (team.find((row) => row.player === viceCaptain)?.proj || 0);
    teams.push({
      strategy: STRATEGY_ID_SECOND_INNINGS,
      captain,
      viceCaptain,
      projectedPoints: Number(projectedPoints.toFixed(2)),
      players: playersOut,
      highScoreScenario: highScoreScenarioTag,
    });
    consecutiveFailures = 0;
  }
  if (verboseLog) {
    console.info(`[${highScoreScenarioTag}] reject summary`, { attempts, accepted: teams.length, ...rejectStats });
  }
  return { teams, attempts, rejectStats, exhausted: attempts >= cap };
}

function generateSecondInningsPoolTeamsForStrategy(
  pool,
  numTeams,
  seenKeys,
  recentLineupState,
  appearanceCounts,
  tuning,
  cvFair
) {
  const counts = appearanceCounts || new Map();
  const keyToRow = makeRowLookupByKey(pool);
  const p1TopRows = (state.secondInningsPools.p1Top || []).map((id) => keyToRow.get(id)).filter(Boolean);
  const p1RestRows = (state.secondInningsPools.p1Rest || []).map((id) => keyToRow.get(id)).filter(Boolean);
  const p2Rows = state.secondInningsPools.p2.map((id) => keyToRow.get(id)).filter(Boolean);
  const chaseCombos = getSecondInningsChaseCombosFromUi();
  const bowlCombos = getSecondInningsBowlCombosFromUi();
  const chasePct = getSecondInningsChaseScenarioPercentFromUi();
  const nChase = computeBatFirstFullPoolTeamCount(numTeams, chasePct);
  const nBowl = Math.max(0, numTeams - nChase);
  const chaseLineupState = { queue: [], keySet: new Set(), windowSize: LINEUP_REPEAT_COOLDOWN };
  const bowlLineupState = { queue: [], keySet: new Set(), windowSize: LINEUP_REPEAT_COOLDOWN };
  const chaseSeenKeys = new Set();
  const bowlSeenKeys = new Set();
  const chaseReject = {
    rejectStats: {
      bad_length: 0,
      overlap_keys: 0,
      lineup_cooldown: 0,
      cvc_none: 0,
      dedupe_collision: 0,
      cv_pools_missing: 0,
    },
    samples: [],
  };
  const bowlReject = {
    rejectStats: {
      bad_length: 0,
      overlap_keys: 0,
      lineup_cooldown: 0,
      cvc_none: 0,
      dedupe_collision: 0,
      cv_pools_missing: 0,
    },
    samples: [],
  };
  const chaseBlock =
    nChase > 0 && chaseCombos.length
      ? generateSecondInningsScenarioBlock(
          nChase,
          chaseCombos,
          p1TopRows,
          p1RestRows,
          p2Rows,
          chaseSeenKeys,
          chaseLineupState,
          counts,
          tuning,
          cvFair,
          "si_chase_middle",
          chaseReject
        )
      : { teams: [], attempts: 0, rejectStats: chaseReject.rejectStats };
  const bowlBlock =
    nBowl > 0 && bowlCombos.length
      ? generateSecondInningsScenarioBlock(
          nBowl,
          bowlCombos,
          p1TopRows,
          p1RestRows,
          p2Rows,
          bowlSeenKeys,
          bowlLineupState,
          counts,
          tuning,
          cvFair,
          "si_first_innings_bowl",
          bowlReject
        )
      : { teams: [], attempts: 0, rejectStats: bowlReject.rejectStats };
  const topUpScenario = (block, reject, lineupState, localSeen, target, combos, tag) => {
    const short = target - block.teams.length;
    if (short <= 0 || !combos.length || block.cvPoolsMissing) {
      return;
    }
    const extra = generateSecondInningsScenarioBlock(
      short,
      combos,
      p1TopRows,
      p1RestRows,
      p2Rows,
      localSeen,
      lineupState,
      counts,
      tuning,
      cvFair,
      tag,
      reject
    );
    block.teams.push(...extra.teams);
    block.attempts = (block.attempts || 0) + (extra.attempts || 0);
    block.exhausted = Boolean(extra.exhausted);
  };
  topUpScenario(
    chaseBlock,
    chaseReject,
    chaseLineupState,
    chaseSeenKeys,
    nChase,
    chaseCombos,
    "si_chase_middle"
  );
  topUpScenario(
    bowlBlock,
    bowlReject,
    bowlLineupState,
    bowlSeenKeys,
    nBowl,
    bowlCombos,
    "si_first_innings_bowl"
  );
  chaseSeenKeys.forEach((k) => seenKeys.add(k));
  bowlSeenKeys.forEach((k) => seenKeys.add(k));
  const teams = [];
  let i = 0;
  let j = 0;
  while (i < chaseBlock.teams.length || j < bowlBlock.teams.length) {
    if (i < chaseBlock.teams.length) {
      teams.push(chaseBlock.teams[i]);
      i += 1;
    }
    if (j < bowlBlock.teams.length) {
      teams.push(bowlBlock.teams[j]);
      j += 1;
    }
  }
  const attempts = chaseBlock.attempts + bowlBlock.attempts;
  return {
    teams,
    attempts,
    minTeams: 0,
    targetTeams: numTeams,
    minFillMet: true,
    fullTargetMet: teams.length >= numTeams,
    highScoringQuota: null,
    batPoolMeta: null,
    secondInningsMeta: {
      nChaseTarget: nChase,
      nBowlTarget: nBowl,
      nChaseGot: chaseBlock.teams.length,
      nBowlGot: bowlBlock.teams.length,
      chaseCvPoolsMissing: Boolean(chaseBlock.cvPoolsMissing),
      bowlCvPoolsMissing: Boolean(bowlBlock.cvPoolsMissing),
      rejectReport: {
        attempts: chaseBlock.attempts + bowlBlock.attempts,
        accepted: teams.length,
        chase: {
          target: nChase,
          got: chaseBlock.teams.length,
          attempts: chaseBlock.attempts || 0,
          exhausted: Boolean(chaseBlock.exhausted),
          rejectStats: { ...chaseReject.rejectStats },
        },
        bowl: {
          target: nBowl,
          got: bowlBlock.teams.length,
          attempts: bowlBlock.attempts || 0,
          exhausted: Boolean(bowlBlock.exhausted),
          rejectStats: { ...bowlReject.rejectStats },
        },
        samples: [...(chaseReject.samples || []), ...(bowlReject.samples || [])],
        verbose: Boolean(document.getElementById("secondInningsVerboseLogCheckbox")?.checked),
        poolSizes: {
          top: p1TopRows.length,
          rest: p1RestRows.length,
          p2: p2Rows.length,
        },
      },
    },
  };
}

function computeHighScoringMinPerCell(numTeams, scenarioCount) {
  const n = Math.max(1, Number(scenarioCount) || 1);
  const fairPerCell = numTeams / n;
  let minPer = Math.max(0, Math.floor(HIGH_SCORING_MIN_QUOTA_FRAC * fairPerCell));
  while (minPer > 0 && minPer * n > numTeams) {
    minPer -= 1;
  }
  return { minPer, fairPerCell };
}

function pickHighScoringScenarioIndex(scenarioCounts, minPer) {
  const under = [];
  for (let i = 0; i < scenarioCounts.length; i += 1) {
    if (scenarioCounts[i] < minPer) {
      under.push(i);
    }
  }
  if (under.length) {
    return under[Math.floor(Math.random() * under.length)];
  }
  return Math.floor(Math.random() * scenarioCounts.length);
}

/** Scenario for the next accepted team: strict round-robin over active scenario ids (0 → n−1 → 0 …). */
function getRoundRobinScenarioIndex(acceptedTeamCount, scenarioCount) {
  const n = Math.max(1, Number(scenarioCount) || 1);
  return acceptedTeamCount % n;
}

function generateHighScoringTeamsForStrategy(
  pool,
  numTeams,
  seenKeys,
  recentLineupState,
  appearanceCounts,
  tuning,
  cvFair
) {
  const counts = appearanceCounts || new Map();
  const t = tuning || DEFAULT_GENERATOR_TUNING;
  const params = HIGH_SCORING_DRAW_PARAMS;
  const scenarioIds = getActiveHighScoringScenarioIds();
  const { minPer, fairPerCell } = computeHighScoringMinPerCell(numTeams, scenarioIds.length);
  const scenarioCounts = new Array(scenarioIds.length).fill(0);
  const teams = [];
  let attempts = 0;
  const hardAttemptCap = numTeams * ATTEMPTS_MULTIPLIER * HIGH_SCORING_ATTEMPTS_MULTIPLIER;
  const bowlerArFair = buildBowlerArFairnessState(pool);
  const cvPairCounts = new Map();

  while (teams.length < numTeams && attempts < hardAttemptCap) {
    attempts += 1;
    const si = getRoundRobinScenarioIndex(teams.length, scenarioIds.length);
    const scenarioId = scenarioIds[si];
    const weightedPool = pool.map((row) => {
      const weight = computeRowDrawWeight(row, params, counts, t, bowlerArFair);
      return { ...row, weight };
    });
    const team = weightedSampleWithoutReplacement(weightedPool, 11);
    if (!isValidGeneratedTeam(team)) {
      continue;
    }
    const playersOut = team.map((row) => ({
      team: row.team,
      player: row.player,
      role: row.role,
    }));
    const lineupKey = buildLineupOnlyKey(playersOut);
    if (isLineupInCooldown(recentLineupState, lineupKey)) {
      continue;
    }
    const cvc = chooseCaptainViceCaptain(team, t, cvFair, scenarioId, { seenKeys, playersOut }, {
      counts: cvPairCounts,
    });
    if (!cvc) {
      continue;
    }
    const { captain, viceCaptain } = cvc;
    const key = buildTeamUniquenessKey(playersOut, captain, viceCaptain);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    recordAcceptedLineup(recentLineupState, lineupKey);
    incrementCvPairAcceptCounts(cvPairCounts, scenarioId, captain, viceCaptain, team);
    team.forEach((row) => {
      const k = poolPlayerKey(row);
      counts.set(k, (counts.get(k) || 0) + 1);
      if (row.role === "bowler") {
        bowlerArFair.bowlerPickCounts.set(k, (bowlerArFair.bowlerPickCounts.get(k) || 0) + 1);
        bowlerArFair.totalBowlerSlots += 1;
      }
      if (row.role === "all_rounder") {
        bowlerArFair.arPickCounts.set(k, (bowlerArFair.arPickCounts.get(k) || 0) + 1);
        bowlerArFair.totalArSlots += 1;
      }
    });
    bowlerArFair.teamsBuilt += 1;
    const capRow = team.find((row) => row.player === captain);
    const vcRow = team.find((row) => row.player === viceCaptain);
    recordCvFairnessAssignment(cvFair, capRow?.team, captain, vcRow?.team, viceCaptain);
    const projectedPoints =
      team.reduce((acc, row) => acc + row.proj, 0) +
      (team.find((row) => row.player === captain)?.proj || 0) +
      0.5 * (team.find((row) => row.player === viceCaptain)?.proj || 0);
    scenarioCounts[si] += 1;
    teams.push({
      strategy: STRATEGY_ID,
      captain,
      viceCaptain,
      projectedPoints: Number(projectedPoints.toFixed(2)),
      players: playersOut,
      highScoreScenario: scenarioId,
    });
  }
  const minAcross = scenarioCounts.length ? Math.min(...scenarioCounts) : 0;
  const cellsBelowMinQuota = scenarioCounts.filter((c) => c < minPer).length;
  return {
    teams,
    attempts,
    minTeams: minPer,
    targetTeams: numTeams,
    minFillMet: minPer === 0 || minAcross >= minPer,
    fullTargetMet: teams.length >= numTeams,
    highScoringQuota: {
      minPerCell: minPer,
      fairPerCell,
      scenarioCounts: [...scenarioCounts],
      minAcross,
      cellsBelowMinQuota,
    },
  };
}

function roleOrder(role) {
  if (role === "wicket_keeper") return 0;
  if (role === "batsman") return 1;
  if (role === "all_rounder") return 2;
  if (role === "bowler") return 3;
  return 4;
}

function formatRoleLabel(role) {
  if (role === "wicket_keeper") return "WK";
  if (role === "batsman") return "BAT";
  if (role === "all_rounder") return "AR";
  if (role === "bowler") return "BOWL";
  return role;
}

function downloadCsvFromTeams(rows) {
  const header = [
    "strategy",
    "high_score_scenario",
    "split_profile",
    "split_segment",
    "split_pair",
    "global_index",
    "candidate_slot",
    "candidate_name",
    "team_index",
    "captain",
    "vice_captain",
    "projected_points",
    "wk",
    "bat",
    "ar",
    "bowl",
    "players",
  ];
  const lines = [header.join(",")];
  const chunk = state.lastGeneratorConfig?.candidateChunkSize || getCandidateChunkSizeFromUi();

  rows.forEach((row, idx) => {
    const globalIndex = row.globalIndex != null ? row.globalIndex : idx + 1;
    const candidateSlot = row.candidateSlot != null ? row.candidateSlot : Math.floor(idx / chunk) + 1;
    const candidateName = row.candidateName || getCandidateLabel(candidateSlot);
    const counts = { wicket_keeper: 0, batsman: 0, all_rounder: 0, bowler: 0 };
    const players = [...row.players].sort(
      (a, b) =>
        roleOrder(getEffectiveLineupRole(a.team, a.player)) - roleOrder(getEffectiveLineupRole(b.team, b.player))
    );
    players.forEach((p) => {
      const r = getEffectiveLineupRole(p.team, p.player);
      if (counts[r] !== undefined) counts[r] += 1;
    });
    const playerString = players
      .map((p) => `${p.player} (${formatRoleLabel(getEffectiveLineupRole(p.team, p.player))})`)
      .join(" | ")
      .replace(/"/g, '""');
    const line = [
      row.strategy,
      row.highScoreScenario != null ? row.highScoreScenario : "",
      row.splitProfile != null ? row.splitProfile : "",
      row.splitSegment != null ? row.splitSegment : "",
      row.splitPair != null ? row.splitPair : "",
      globalIndex,
      candidateSlot,
      candidateName,
      idx + 1,
      row.captain,
      row.viceCaptain,
      row.projectedPoints,
      counts.wicket_keeper,
      counts.batsman,
      counts.all_rounder,
      counts.bowler,
      `"${playerString}"`,
    ].join(",");
    lines.push(line);
  });

  const csvBlob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const cfg = state.lastGeneratorConfig;
  const base = getFixtureFileBaseAbbrev();
  const fileName =
    cfg.strategies?.length && cfg.teamsPerStrategy
      ? `${base}_teams_${rows.length}total_${cfg.teamsPerStrategy}each_${cfg.strategies.length}strat.csv`
      : `${base}_teams_${rows.length}.csv`;
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderQualitySummary(rows) {
  if (!rows.length) {
    qualitySummary.innerHTML = "";
    return;
  }

  const totalTeams = rows.length;
  const playerCounts = {};
  const captainCounts = {};
  const vcCounts = {};
  const captainCountsByKey = {};
  const vcCountsByKey = {};
  const strategyCounts = {};

  rows.forEach((row) => {
    strategyCounts[row.strategy] = (strategyCounts[row.strategy] || 0) + 1;
    captainCounts[row.captain] = (captainCounts[row.captain] || 0) + 1;
    vcCounts[row.viceCaptain] = (vcCounts[row.viceCaptain] || 0) + 1;
    const captainRow = row.players.find((p) => p.player === row.captain);
    if (captainRow) {
      const capKey = `${captainRow.player} (${captainRow.team})`;
      captainCountsByKey[capKey] = (captainCountsByKey[capKey] || 0) + 1;
    }
    const vcRow = row.players.find((p) => p.player === row.viceCaptain);
    if (vcRow) {
      const vcKey = `${vcRow.player} (${vcRow.team})`;
      vcCountsByKey[vcKey] = (vcCountsByKey[vcKey] || 0) + 1;
    }
    row.players.forEach((p) => {
      const key = `${p.player} (${p.team})`;
      playerCounts[key] = (playerCounts[key] || 0) + 1;
    });
  });

  const topN = (obj, n) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  const sortAllByExposure = (obj) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const topPlayers = topN(playerCounts, 10);
  const allCaptains = sortAllByExposure(captainCounts);
  const allViceCaptains = sortAllByExposure(vcCounts);

  const maxPlayerExposure = topPlayers.length ? (topPlayers[0][1] / totalTeams) * 100 : 0;
  const maxCaptainExposure = allCaptains.length ? (allCaptains[0][1] / totalTeams) * 100 : 0;
  const maxVcExposure = allViceCaptains.length ? (allViceCaptains[0][1] / totalTeams) * 100 : 0;

  const meta = state.lastGeneratorConfig?.cvFairMeta;
  const capPoolSz = meta?.captainPoolSize || 0;
  const vcPoolSz = meta?.vicePoolSize || 0;
  const unionPoolSz = meta?.unionPoolSize || 0;
  const minCaptBand =
    capPoolSz > 0 ? Math.max(1, Math.floor((CV_POOL_SOFT_QUOTA_FRAC * totalTeams) / capPoolSz)) : 0;
  const minVcBand =
    vcPoolSz > 0 ? Math.max(1, Math.floor((CV_POOL_SOFT_QUOTA_FRAC * totalTeams) / vcPoolSz)) : 0;
  const captBelow = minCaptBand
    ? Object.entries(captainCounts).filter(([, c]) => c < minCaptBand)
    : [];
  const vcBelow = minVcBand ? Object.entries(vcCounts).filter(([, c]) => c < minVcBand) : [];
  const minUnionBand =
    unionPoolSz > 0
      ? Math.max(1, Math.floor((CV_POOL_SOFT_QUOTA_FRAC * (2 * totalTeams)) / unionPoolSz))
      : 0;
  const unionCounts = {};
  Object.keys(playerCounts).forEach((k) => {
    unionCounts[k] = (captainCountsByKey[k] || 0) + (vcCountsByKey[k] || 0);
  });
  const unionBelow = minUnionBand
    ? Object.entries(unionCounts).filter(([, c]) => c < minUnionBand)
    : [];

  const flags = [];
  if (maxPlayerExposure > 85) {
    flags.push(`High player concentration: ${topPlayers[0][0]} at ${maxPlayerExposure.toFixed(1)}%`);
  }
  if (maxCaptainExposure > 35) {
    flags.push(`High captain concentration: ${allCaptains[0][0]} at ${maxCaptainExposure.toFixed(1)}%`);
  }
  if (maxVcExposure > 40) {
    flags.push(`High vice-captain concentration: ${allViceCaptains[0][0]} at ${maxVcExposure.toFixed(1)}%`);
  }
  if (captBelow.length) {
    flags.push(
      `Captain pool equity: ${captBelow.length} name(s) below soft floor (~${minCaptBand}× as C for ${capPoolSz} pool names @ ${(CV_POOL_SOFT_QUOTA_FRAC * 100).toFixed(0)}% × teams/pool).`
    );
  }
  if (vcBelow.length) {
    flags.push(
      `Vice pool equity: ${vcBelow.length} name(s) below soft floor (~${minVcBand}× as VC for ${vcPoolSz} pool names).`
    );
  }
  if (unionBelow.length) {
    flags.push(
      `Combined C+VC equity: ${unionBelow.length} name(s) below soft floor (~${minUnionBand}× total C+VC slots for ${unionPoolSz} union pool names).`
    );
  }
  if (!flags.length) {
    flags.push("Exposure looks reasonably diversified for GL entry.");
  }

  const listHtml = (rowsList, total) =>
    `<ul>${rowsList
      .map(([name, cnt]) => `<li>${name}: ${cnt} (${((cnt / total) * 100).toFixed(1)}%)</li>`)
      .join("")}</ul>`;

  const hsMix = {};
  rows.forEach((row) => {
    if (
      (row.strategy === STRATEGY_ID || row.strategy === STRATEGY_ID_BAT_POOLS) &&
      row.highScoreScenario
    ) {
      hsMix[row.highScoreScenario] = (hsMix[row.highScoreScenario] || 0) + 1;
    }
  });
  const hsCard =
    Object.keys(hsMix).length > 0
      ? `<div class="quality-card">
        <p>Scenario cell mix (6-cell catalog)</p>
        <ul>${Object.entries(hsMix)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([cell, cnt]) => `<li>${cell}: ${cnt}</li>`)
          .join("")}</ul>
      </div>`
      : "";

  const lineupFreq = {};
  rows.forEach((row) => {
    const key = buildLineupOnlyKey(row.players);
    lineupFreq[key] = (lineupFreq[key] || 0) + 1;
  });
  const distinctElevens = Object.keys(lineupFreq).length;
  const duplicateXiExtraRows = totalTeams - distinctElevens;
  const lineupMultiplicityHistogram = {};
  Object.values(lineupFreq).forEach((c) => {
    lineupMultiplicityHistogram[c] = (lineupMultiplicityHistogram[c] || 0) + 1;
  });
  const repeatedLineupKinds = Object.entries(lineupFreq).filter(([, c]) => c > 1).length;
  const multiplicityLines = Object.entries(lineupMultiplicityHistogram)
    .map(([m, n]) => Number(m))
    .sort((a, b) => a - b)
    .map((m) => {
      const n = lineupMultiplicityHistogram[m];
      return `<li>Exactly <strong>${m}×</strong>: ${n} distinct XI(s)</li>`;
    })
    .join("");
  const duplicateXiCard = `<div class="quality-card">
        <p>Duplicate elevens (same 11 players; C/VC ignored)</p>
        <ul>
          <li>Distinct elevens: <strong>${distinctElevens}</strong> / ${totalTeams} teams</li>
          <li>Extra rows from XI repeats: <strong>${duplicateXiExtraRows}</strong>${
            duplicateXiExtraRows
              ? ' <span style="opacity:0.85;font-size:0.92em">(same player set exported again, often with different C/VC)</span>'
              : ""
          }</li>
          <li>Lineups appearing more than once: <strong>${repeatedLineupKinds}</strong> distinct XI(s)</li>
        </ul>
        <p style="margin: 0.35rem 0 0.15rem; opacity: 0.85; font-size: 0.92em">Repeat counts</p>
        <ul>${multiplicityLines}</ul>
      </div>`;

  const selectedLabels = Array.from(state.selectedPlayers)
    .map((id) => {
      const [team, player] = String(id).split("::");
      if (!team || !player) {
        return null;
      }
      if (team !== teamASelect.value && team !== teamBSelect.value) {
        return null;
      }
      return `${player} (${team})`;
    })
    .filter(Boolean);
  const uniqueSelectedLabels = Array.from(new Set(selectedLabels));
  const allSelectedRows = uniqueSelectedLabels
    .map((label) => {
      const teamCnt = playerCounts[label] || 0;
      const capCnt = captainCountsByKey[label] || 0;
      const vcCnt = vcCountsByKey[label] || 0;
      return [label, teamCnt, capCnt, vcCnt];
    })
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      if (b[2] !== a[2]) return b[2] - a[2];
      if (b[3] !== a[3]) return b[3] - a[3];
      return String(a[0]).localeCompare(String(b[0]));
    });
  const allSelectedCard = `<div class="quality-card">
        <p>All Selected Players (Team/C/VC exposure)</p>
        <ul>${allSelectedRows
          .map(
            ([label, teamCnt, capCnt, vcCnt]) =>
              `<li>${label}: Team ${teamCnt} (${((teamCnt / totalTeams) * 100).toFixed(1)}%) · C ${capCnt} (${((capCnt / totalTeams) * 100).toFixed(1)}%) · VC ${vcCnt} (${((vcCnt / totalTeams) * 100).toFixed(1)}%)</li>`
          )
          .join("")}</ul>
      </div>`;

  qualitySummary.innerHTML = `
    <h3>${totalTeams}-Team Quality Check</h3>
    <div class="quality-grid">
      <div class="quality-card">
        <p>Strategy Mix</p>
        ${listHtml(Object.entries(strategyCounts), totalTeams)}
      </div>
      ${duplicateXiCard}
      <div class="quality-card">
        <p>Top Player Exposure</p>
        ${listHtml(topPlayers, totalTeams)}
      </div>
      <div class="quality-card">
        <p>All Captain Exposure</p>
        ${listHtml(allCaptains, totalTeams)}
      </div>
      <div class="quality-card">
        <p>All Vice-Captain Exposure</p>
        ${listHtml(allViceCaptains, totalTeams)}
      </div>
      ${allSelectedCard}
      ${hsCard}
      ${
        capPoolSz || vcPoolSz
          ? `<div class="quality-card">
        <p>C/VC pool fairness (soft check)</p>
        <ul>
          <li>Captain-pool size (selected ∩ pool): <strong>${capPoolSz || "—"}</strong> · soft min ≈ <strong>${minCaptBand || "—"}</strong> captain slots each @ ${(CV_POOL_SOFT_QUOTA_FRAC * 100).toFixed(0)}% × teams ÷ pool</li>
          <li>Vice-pool size: <strong>${vcPoolSz || "—"}</strong> · soft min ≈ <strong>${minVcBand || "—"}</strong> VC slots each</li>
          <li>Union pool size: <strong>${unionPoolSz || "—"}</strong> · combined soft min ≈ <strong>${minUnionBand || "—"}</strong> total (C+VC) slots each @ ${(CV_POOL_SOFT_QUOTA_FRAC * 100).toFixed(0)}% × (2×teams) ÷ union</li>
        </ul>
      </div>`
          : ""
      }
    </div>
    <div class="quality-flags">${flags.join(" | ")}</div>
  `;
}

function combinedRosterOptions() {
  const teams = [teamASelect.value, teamBSelect.value];
  const out = [];
  const seen = new Set();
  teams.forEach((teamName) => {
    buildRoster(teamName).forEach((p) => {
      const key = `${teamName}::${p.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ team: teamName, player: p.name });
    });
  });
  return out;
}

/**
 * Swap OUT: union of (1) everyone who appears in loaded/generated teams for this fixture
 * and (2) ticked squad players. CSV-only workflow needs (1) so swaps work without generating now.
 */
function getSwapOutPlayerOptions() {
  const teamNames = new Set([teamASelect.value, teamBSelect.value]);
  const seen = new Set();
  const out = [];
  const add = (team, player) => {
    if (!teamNames.has(team) || !player) {
      return;
    }
    const key = `${team}::${player}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({ team, player });
  };

  const teamRows = [];
  if (state.swapSourceTeams?.length) {
    teamRows.push(...state.swapSourceTeams);
  } else if (state.generatedTeams?.length) {
    teamRows.push(...state.generatedTeams);
  }
  teamRows.forEach((row) => {
    row.players?.forEach((p) => add(p.team, p.player));
  });

  state.selectedPlayers.forEach((id) => {
    const [team, player] = id.split("::");
    add(team, player);
  });

  return out.sort((a, b) => {
    const ta = a.team.localeCompare(b.team);
    if (ta !== 0) return ta;
    return a.player.localeCompare(b.player);
  });
}

function refreshSwapRuleOutOptions() {
  if (!swapRulesContainer) {
    return;
  }
  const opts = getSwapOutPlayerOptions();
  swapRulesContainer.querySelectorAll(".swap-row").forEach((row) => {
    const sel = row.querySelector(".swap-out-select");
    if (!sel) {
      return;
    }
    const cur = sel.value;
    sel.innerHTML = "";
    const emptyOut = document.createElement("option");
    emptyOut.value = "";
    emptyOut.textContent = "Swap OUT player";
    sel.appendChild(emptyOut);
    if (!opts.length) {
      const dis = document.createElement("option");
      dis.value = "";
      dis.disabled = true;
      dis.textContent = "Upload swap CSV or generate teams (or tick squads)";
      sel.appendChild(dis);
    } else {
      opts.forEach((opt) => {
        const value = `${opt.team}::${opt.player}`;
        const o = document.createElement("option");
        o.value = value;
        o.textContent = `${opt.player} (${getTeamAbbrev(opt.team)})`;
        sel.appendChild(o);
      });
    }
    if ([...sel.options].some((o) => o.value === cur)) {
      sel.value = cur;
    }
  });
}

function refreshSwapRuleInOptions() {
  if (!swapRulesContainer) {
    return;
  }
  const inOpts = combinedRosterOptions();
  swapRulesContainer.querySelectorAll(".swap-row").forEach((row) => {
    const sel = row.querySelector(".swap-in-select");
    if (!sel) {
      return;
    }
    const cur = sel.value;
    sel.innerHTML = "";
    const emptyIn = document.createElement("option");
    emptyIn.value = "";
    emptyIn.textContent = "Swap IN (full squads)";
    sel.appendChild(emptyIn);
    inOpts.forEach((opt) => {
      const value = `${opt.team}::${opt.player}`;
      const o = document.createElement("option");
      o.value = value;
      o.textContent = `${opt.player} (${getTeamAbbrev(opt.team)})`;
      sel.appendChild(o);
    });
    if ([...sel.options].some((o) => o.value === cur)) {
      sel.value = cur;
    }
  });
}

function refreshSwapRuleDropdowns() {
  refreshSwapRuleOutOptions();
  refreshSwapRuleInOptions();
}

function addSwapRuleRow(outValue = "", inValue = "") {
  const row = document.createElement("div");
  row.className = "swap-row";
  const outOptions = getSwapOutPlayerOptions();
  const inOptions = combinedRosterOptions();

  const outSelect = document.createElement("select");
  const inSelect = document.createElement("select");
  outSelect.className = "swap-out-select";
  inSelect.className = "swap-in-select";

  const emptyOut = document.createElement("option");
  emptyOut.value = "";
  emptyOut.textContent = "Swap OUT player";
  outSelect.appendChild(emptyOut);

  const emptyIn = document.createElement("option");
  emptyIn.value = "";
  emptyIn.textContent = "Swap IN (full squads)";
  inSelect.appendChild(emptyIn);

  if (!outOptions.length) {
    const dis = document.createElement("option");
    dis.value = "";
    dis.disabled = true;
    dis.textContent = "Upload swap CSV or generate teams (or tick squads)";
    outSelect.appendChild(dis);
  } else {
    outOptions.forEach((opt) => {
      const value = `${opt.team}::${opt.player}`;
      const o1 = document.createElement("option");
      o1.value = value;
      o1.textContent = `${opt.player} (${getTeamAbbrev(opt.team)})`;
      outSelect.appendChild(o1);
    });
  }

  inOptions.forEach((opt) => {
    const value = `${opt.team}::${opt.player}`;
    const o2 = document.createElement("option");
    o2.value = value;
    o2.textContent = `${opt.player} (${getTeamAbbrev(opt.team)})`;
    inSelect.appendChild(o2);
  });

  outSelect.value = outValue;
  inSelect.value = inValue;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(outSelect);
  row.appendChild(inSelect);
  row.appendChild(removeBtn);
  swapRulesContainer.appendChild(row);
}

/** Split on first "::" only (team name must not contain "::"). */
function parseSwapKey(key) {
  const s = String(key || "").trim();
  const i = s.indexOf("::");
  if (i < 0) {
    return { team: "", player: "" };
  }
  return { team: s.slice(0, i).trim(), player: s.slice(i + 2).trim() };
}

function getSwapRules() {
  const rows = Array.from(swapRulesContainer.querySelectorAll(".swap-row"));
  return rows
    .map((row) => ({
      out: row.querySelector(".swap-out-select")?.value || "",
      in: row.querySelector(".swap-in-select")?.value || "",
    }))
    .filter((r) => r.out && r.in && r.out !== r.in);
}

function parseCsvLine(line) {
  const cols = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

function parsePlayersString(playersText, teamAName, teamBName) {
  return playersText
    .split(" | ")
    .map((chunk) => {
      const trimmed = chunk.trim();
      const three = trimmed.match(/^(.*) \((.+), (.+)\)$/);
      if (three) {
        const player = three[1].trim();
        const mid = three[2].trim();
        const roleRaw = three[3].trim();
        let team = mid;
        const fromAbbr = abbrevToFullTeam(mid);
        if (fromAbbr) {
          team = fromAbbr;
        }
        return { player, team, role: normalizeRole(roleRaw) };
      }
      const two = trimmed.match(/^(.*) \(([^)]+)\)$/);
      if (two) {
        const player = two[1].trim();
        const roleRaw = two[2].trim();
        const team = resolveTeamForPlayerName(player, teamAName, teamBName);
        return { player, team, role: normalizeRole(roleRaw) };
      }
      return null;
    })
    .filter(Boolean);
}

function parseTeamsCsv(text) {
  const lines = text.split(/\r?\n/).filter((x) => x.trim());
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]);
  const idx = {
    strategy: header.indexOf("strategy"),
    highScoreScenario: header.indexOf("high_score_scenario"),
    splitProfile: header.indexOf("split_profile"),
    splitSegment: header.indexOf("split_segment"),
    splitPair: header.indexOf("split_pair"),
    captain: header.indexOf("captain"),
    vice: header.indexOf("vice_captain"),
    proj: header.indexOf("projected_points"),
    players: header.indexOf("players"),
    globalIndex: header.indexOf("global_index"),
    candidateSlot: header.indexOf("candidate_slot"),
    candidateName: header.indexOf("candidate_name"),
  };
  if ([idx.strategy, idx.captain, idx.vice, idx.proj, idx.players].some((v) => v < 0)) return [];
  const teamAName = teamASelect.value;
  const teamBName = teamBSelect.value;
  return lines.slice(1).map((line) => {
    const c = parseCsvLine(line);
    const gi = idx.globalIndex >= 0 ? Number(c[idx.globalIndex]) : NaN;
    const cs = idx.candidateSlot >= 0 ? Number(c[idx.candidateSlot]) : NaN;
    const cname = idx.candidateName >= 0 ? String(c[idx.candidateName] || "").trim() : "";
    const hss =
      idx.highScoreScenario >= 0 ? String(c[idx.highScoreScenario] || "").trim() : "";
    const splitProfile =
      idx.splitProfile >= 0 ? String(c[idx.splitProfile] || "").trim() : "";
    const splitSegment =
      idx.splitSegment >= 0 ? String(c[idx.splitSegment] || "").trim() : "";
    const splitPair = idx.splitPair >= 0 ? String(c[idx.splitPair] || "").trim() : "";
    const rawPlayers = parsePlayersString(c[idx.players] || "", teamAName, teamBName);
    const players = rawPlayers.map((p) => ({
      ...p,
      role: getEffectiveLineupRole(p.team, p.player),
    }));
    return {
      strategy: normalizeStrategyName(c[idx.strategy]),
      captain: c[idx.captain],
      viceCaptain: c[idx.vice],
      projectedPoints: Number(c[idx.proj] || 0),
      players,
      globalIndex: !Number.isNaN(gi) ? gi : undefined,
      candidateSlot: !Number.isNaN(cs) ? cs : undefined,
      candidateName: cname || undefined,
      highScoreScenario: hss || undefined,
      splitProfile: splitProfile || undefined,
      splitSegment: splitSegment || undefined,
      splitPair: splitPair || undefined,
    };
  });
}

function normalizeRole(roleLabel) {
  const s = String(roleLabel ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (s === "wk" || s === "wicket_keeper") return "wicket_keeper";
  if (s === "bat" || s === "batsman") return "batsman";
  if (s === "ar" || s === "all_rounder" || s === "allrounder") return "all_rounder";
  if (s === "bowl" || s === "bowler") return "bowler";
  return "batsman";
}

/** Profile role (Dream11-style); not adjusted for lineup rules. */
function getRawProfileRole(teamName, playerName) {
  const profile = getPlayerProfile(teamName, playerName);
  if (profile?.is_wicket_keeper) {
    return "wicket_keeper";
  }
  return normalizeRole(profile.primary_role);
}

function getRoleForPlayer(teamName, playerName) {
  return getRawProfileRole(teamName, playerName);
}

/**
 * Role used for XI validation, caps, pool rows, and C/VC (scenario multipliers + suggested pools):
 * top-order all-rounders (typical slot ≤ 5) count as batsmen — same as max-AR exclusion, not “AR” for multipliers.
 */
function getEffectiveLineupRole(teamName, playerName) {
  const raw = getRawProfileRole(teamName, playerName);
  if (raw !== "all_rounder") {
    return raw;
  }
  const profile = getPlayerProfile(teamName, playerName);
  const slot = resolveTypicalBattingSlot(teamName, playerName, profile);
  if (slot != null && slot <= 5) {
    return "batsman";
  }
  return "all_rounder";
}

function reassignCaptainViceCaptain(players, scenarioId = "α1") {
  const withProjection = players.map((p) => {
    const form = getPlayerForm(p.team, p.player) || {};
    const points = Array.isArray(form.last_fantasy_points) ? form.last_fantasy_points : [];
    const role = getEffectiveLineupRole(p.team, p.player);
    const proj = points.length ? weightedAverage(points.map(Number)) : ROLE_PRIORS[role];
    const ceiling = points.length ? Math.max(...points) : proj + 12;
    const floor = points.length ? Math.min(...points) : Math.max(0, proj - 12);
    const profile = getPlayerProfile(p.team, p.player);
    const typicalSlot = resolveTypicalBattingSlot(p.team, p.player, profile);
    const roleStability = computeRoleStabilityFromForm(
      points,
      typicalSlot,
      Boolean(form?.probable_xi)
    );
    return {
      ...p,
      role,
      proj,
      ceiling,
      floor,
      typicalSlot,
      roleStability,
      ownershipProxy: Math.min(0.95, Math.max(0.05, proj / 70)),
    };
  });
  const picked = chooseCaptainViceCaptain(withProjection, getGeneratorTuningFromUi(), null, scenarioId);
  if (picked) {
    return picked;
  }
  const fallback = withProjection[0];
  return {
    captain: fallback?.player || "",
    viceCaptain: withProjection[1]?.player || fallback?.player || "",
  };
}

function applySwapsToTeams(sourceTeams) {
  const rules = getSwapRules();
  if (!rules.length) {
    swapStatus.textContent = "Add at least one valid swap rule.";
    return;
  }
  const report = [];
  const outTeams = sourceTeams.map((teamRow, idx) => {
    const beforeCaptain = teamRow.captain;
    const beforeViceCaptain = teamRow.viceCaptain;
    const next = {
      ...teamRow,
      players: teamRow.players.map((p) => ({ ...p, role: getEffectiveLineupRole(p.team, p.player) })),
      captain: teamRow.captain,
      viceCaptain: teamRow.viceCaptain,
    };
    const events = [];
    const appliedChanges = [];
    rules.forEach((rule) => {
      const { team: outTeam, player: outPlayer } = parseSwapKey(rule.out);
      const { team: inTeam, player: inPlayer } = parseSwapKey(rule.in);
      const outIdx = next.players.findIndex((p) => p.team === outTeam && p.player === outPlayer);
      if (outIdx < 0) {
        events.push(`${outPlayer}: not present`);
        return;
      }
      if (next.players.some((p) => p.team === inTeam && p.player === inPlayer)) {
        events.push(`${outPlayer}->${inPlayer}: skipped (duplicate)`);
        return;
      }
      next.players[outIdx] = {
        team: inTeam,
        player: inPlayer,
        role: getEffectiveLineupRole(inTeam, inPlayer),
      };
      events.push(`${outPlayer}->${inPlayer}: applied`);
      appliedChanges.push(`${outPlayer} -> ${inPlayer}`);
    });

    if (!appliedChanges.length) {
      report.push({
        teamIndex: idx + 1,
        action: "unchanged",
        details: events.join(" | "),
      });
      return teamRow;
    }

    if (!isValidGeneratedTeam(next.players)) {
      report.push({
        teamIndex: idx + 1,
        action: "invalid_after_swaps",
        details: events.join(" | "),
        beforeCaptain,
        beforeViceCaptain,
        afterCaptain: next.captain,
        afterViceCaptain: next.viceCaptain,
        appliedChanges: appliedChanges.join(", "),
      });
      return teamRow;
    }

    const needsCv =
      !next.players.some((p) => p.player === next.captain) ||
      !next.players.some((p) => p.player === next.viceCaptain);
    if (needsCv) {
      const cv = reassignCaptainViceCaptain(next.players, next.highScoreScenario || "α1");
      next.captain = cv.captain;
      next.viceCaptain = cv.viceCaptain;
      events.push("C/VC auto reassigned");
    }
    next.projectedPoints = Number(
      (
        next.players.length * 0 + // keep numeric coercion simple
        next.players.reduce((acc, p) => {
          const form = getPlayerForm(p.team, p.player) || {};
          const hist = Array.isArray(form.last_fantasy_points) ? form.last_fantasy_points : [];
          const role = getEffectiveLineupRole(p.team, p.player);
          const proj = hist.length ? weightedAverage(hist.map(Number)) : ROLE_PRIORS[role];
          return acc + proj;
        }, 0) +
        (() => {
          const cr = next.players.find((p) => p.player === next.captain);
          if (!cr) {
            return 0;
          }
          const cRole = getEffectiveLineupRole(cr.team, next.captain);
          return weightedAverage(
            (getPlayerForm(cr.team, next.captain)?.last_fantasy_points || [ROLE_PRIORS[cRole]]).map(Number)
          );
        })() +
        0.5 *
          (() => {
            const vr = next.players.find((p) => p.player === next.viceCaptain);
            if (!vr) {
              return 0;
            }
            const vRole = getEffectiveLineupRole(vr.team, next.viceCaptain);
            return weightedAverage(
              (getPlayerForm(vr.team, next.viceCaptain)?.last_fantasy_points || [ROLE_PRIORS[vRole]]).map(Number)
            );
          })()
      ).toFixed(2)
    );

    report.push({
      teamIndex: idx + 1,
      action: "updated",
      details: events.join(" | "),
      beforeCaptain,
      beforeViceCaptain,
      afterCaptain: next.captain,
      afterViceCaptain: next.viceCaptain,
      appliedChanges: appliedChanges.join(", "),
    });
    return next;
  });

  const chunk = state.lastGeneratorConfig?.candidateChunkSize || getCandidateChunkSizeFromUi();
  const tagged = outTeams.map((r) => ({ ...r }));
  tagRowsWithCandidateMeta(tagged, chunk);
  state.swappedTeams = tagged;
  state.swapReportRows = report;
  state.postMatchSourceTeams = [];
  const updated = report.filter((r) => r.action === "updated").length;
  const invalidCt = report.filter((r) => r.action === "invalid_after_swaps").length;
  const unchangedCt = report.filter((r) => r.action === "unchanged").length;
  let statusMsg = `Apply result: ${updated}/${outTeams.length} teams updated.`;
  if (updated < outTeams.length) {
    const parts = [];
    if (invalidCt) {
      parts.push(
        `${invalidCt} team(s) rejected after swap (XI must stay valid: ≥1 WK, BAT, AR, BOWL; max bowlers / max all-rounders from generator panel; 4–7 per franchise).`
      );
    }
    if (unchangedCt) {
      parts.push(
        `${unchangedCt} team(s) unchanged (swap OUT player not in that XI, or IN already in XI — see details below).`
      );
    }
    if (parts.length) {
      statusMsg += ` ${parts.join(" ")}`;
    }
    const firstIssue = report.find((r) => r.action !== "updated");
    if (firstIssue?.details) {
      statusMsg += ` Example: team #${firstIssue.teamIndex} — ${firstIssue.details.slice(0, 160)}${firstIssue.details.length > 160 ? "…" : ""}`;
    }
  } else {
    statusMsg += ` Batch/operator labels: ${chunk} per operator.`;
  }
  swapStatus.textContent = statusMsg;
  renderSwapPreview();
  renderPostMatchPlayerInputs();
}

function downloadSwapReportCsv() {
  if (!state.swapReportRows.length) {
    swapStatus.textContent = "No swap report available.";
    return;
  }
  const lines = ["team_index,action,details"];
  state.swapReportRows.forEach((row) => {
    lines.push(
      `${row.teamIndex},${row.action},"${String(row.details || "").replace(/"/g, '""')}"`
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "swap_report.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function teamPlayersCompact(players) {
  return [...players]
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role))
    .map((p) => `${formatRoleLabel(getEffectiveLineupRole(p.team, p.player))}:${p.player}`)
    .join(" | ");
}

function escapeHtmlLite(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSwapPreview() {
  if (!state.swapReportRows.length) {
    swapPreview.innerHTML = "";
    return;
  }
  const affected = state.swapReportRows.filter((r) => r.action === "updated");
  const invalid = state.swapReportRows.filter((r) => r.action === "invalid_after_swaps");
  const unchanged = state.swapReportRows.filter((r) => r.action === "unchanged");

  if (!affected.length) {
    const invBlock =
      invalid.length > 0
        ? `<div class="swap-preview-note"><p><strong>${invalid.length}</strong> team(s) rolled back: lineup invalid after swap (role mins, max bowlers / max AR from generator, 4–7 per team).</p><ul>${invalid
            .slice(0, 6)
            .map(
              (r) =>
                `<li>Team ${r.teamIndex}: ${escapeHtmlLite(r.appliedChanges || "")} — ${escapeHtmlLite(r.details || "")}</li>`
            )
            .join("")}</ul></div>`
        : "";
    const unchBlock =
      unchanged.length > 0
        ? `<div class="swap-preview-note"><p><strong>${unchanged.length}</strong> team(s) had no swap applied (OUT not in that XI, or IN duplicate).</p><ul>${unchanged
            .slice(0, 6)
            .map((r) => `<li>Team ${r.teamIndex}: ${escapeHtmlLite(r.details || "")}</li>`)
            .join("")}</ul></div>`
        : "";
    swapPreview.innerHTML = `<h3>Swap result</h3><p>No team kept changes. See reasons below or <strong>Download Swap Report</strong>.</p>${invBlock}${unchBlock}`;
    return;
  }

  const cards = affected
    .map((row) => {
      const cvcChanged =
        row.beforeCaptain !== row.afterCaptain ||
        row.beforeViceCaptain !== row.afterViceCaptain;
      return `
        <div class="swap-preview-card">
          <p><strong>Team ${row.teamIndex}</strong></p>
          <p><strong>Applied:</strong> ${row.appliedChanges || "-"}</p>
          <p class="muted">${
            cvcChanged
              ? `C/VC changed: ${row.beforeCaptain} / ${row.beforeViceCaptain} -> ${row.afterCaptain} / ${row.afterViceCaptain}`
              : "C/VC unchanged"
          }</p>
        </div>
      `;
    })
    .join("");

  const extra =
    invalid.length || unchanged.length
      ? `<p class="muted">Also: ${invalid.length} invalid after swap, ${unchanged.length} unchanged — use report CSV for full list.</p>`
      : "";
  swapPreview.innerHTML = `<h3>Affected Teams Preview (${affected.length})</h3>${extra}${cards}`;
}

function buildSwapChangesPrintHtml() {
  const report = state.swapReportRows || [];
  const teams = state.swappedTeams || [];
  const base = getFixtureFileBaseAbbrev();
  if (!report.length) {
    return "";
  }
  const updated = report.filter((r) => r.action === "updated");
  const invalid = report.filter((r) => r.action === "invalid_after_swaps");
  const unchanged = report.filter((r) => r.action === "unchanged");

  const bySlot = new Map();
  updated.forEach((r) => {
    const t = teams[r.teamIndex - 1];
    const slot = t?.candidateSlot ?? 1;
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push({ r, t });
  });
  const slots = [...bySlot.keys()].sort((a, b) => a - b);

  const sectionsHtml = slots
    .map((slot) => {
      const label = getCandidateLabel(slot);
      const rows = bySlot.get(slot).sort((a, b) => (a.t?.globalIndex ?? 0) - (b.t?.globalIndex ?? 0));
      const tableRows = rows
        .map(({ r, t }) => {
          const gi = t?.globalIndex ?? r.teamIndex;
          const cvcChanged =
            r.beforeCaptain !== r.afterCaptain || r.beforeViceCaptain !== r.afterViceCaptain;
          const cvc = cvcChanged
            ? `C ${escapeHtmlLite(r.afterCaptain)} · VC ${escapeHtmlLite(r.afterViceCaptain)} <span class="cvc-was">(was ${escapeHtmlLite(r.beforeCaptain)} / ${escapeHtmlLite(r.beforeViceCaptain)})</span>`
            : `C ${escapeHtmlLite(r.afterCaptain)} · VC ${escapeHtmlLite(r.afterViceCaptain)} <span class="cvc-was">unchanged</span>`;
          return `<tr><td>${gi}</td><td>${escapeHtmlLite(r.appliedChanges || "")}</td><td>${cvc}</td></tr>`;
        })
        .join("");
      return `<section class="ch-slot" style="page-break-inside: avoid;">
        <h3>${escapeHtmlLite(label)} <span class="batch-n">(operator batch ${slot})</span></h3>
        <table>
          <thead><tr><th>Team #</th><th>Swaps (OUT → IN)</th><th>C / VC</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>`;
    })
    .join("");

  const updatedIntro =
    updated.length > 0
      ? `<h2>Teams to update in your fantasy app</h2>${sectionsHtml}`
      : `<p class="none-updated"><strong>No teams kept a successful swap.</strong> See invalid / unchanged below, or adjust rules and apply again.</p>`;

  const invalidHtml =
    invalid.length > 0
      ? `<h2>Invalid after swap (rolled back — fix these lineups manually)</h2>
        <table>
          <thead><tr><th>Team #</th><th>Attempted swaps</th><th>Details</th></tr></thead>
          <tbody>${invalid
            .map(
              (r) =>
                `<tr><td>${r.teamIndex}</td><td>${escapeHtmlLite(r.appliedChanges || "")}</td><td class="small">${escapeHtmlLite(r.details || "")}</td></tr>`
            )
            .join("")}</tbody>
        </table>`
      : "";

  const unchangedNote =
    unchanged.length > 0
      ? `<p class="unch">${unchanged.length} team(s) were <strong>unchanged</strong> (OUT not in XI or duplicate IN). Use <strong>Download Swap Report</strong> CSV for the full list.</p>`
      : "";

  const docTitle = `${base}_swap_changes_checklist`;
  const mainTitle = `${getFixtureTitleAbbrev()} — Swap changes checklist`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${docTitle.replace(/</g, "")}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; padding: 14px; max-width: 920px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    h2 { font-size: 15px; margin: 14px 0 8px; border-bottom: 1px solid #ccc; }
    h3 { font-size: 14px; margin: 10px 0 6px; }
    .hint { color: #444; font-size: 13px; margin: 0 0 12px; }
    .sum { font-size: 14px; margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 13px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    .small { font-size: 12px; color: #333; }
    .batch-n { font-weight: normal; color: #555; font-size: 13px; }
    .cvc-was { color: #555; font-size: 12px; }
    .none-updated { padding: 10px; background: #fff7ed; border: 1px solid #fdba74; border-radius: 6px; }
    .unch { font-size: 13px; color: #334155; margin-top: 10px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${escapeHtmlLite(mainTitle)}</h1>
  <p class="sum">Summary: ${updated.length} updated · ${invalid.length} invalid · ${unchanged.length} unchanged</p>
  <p class="hint">Use <strong>Print → Save as PDF</strong>. Suggested filename: <code>${escapeHtmlLite(docTitle)}.pdf</code></p>
  <button class="no-print" type="button" onclick="window.print()">Print / Save PDF</button>
  ${updatedIntro}
  ${invalidHtml}
  ${unchangedNote}
</body>
</html>`;
}

function openSwapChangesPdf() {
  if (!state.swapReportRows?.length) {
    swapStatus.textContent = "Apply swaps first — nothing to export.";
    return;
  }
  const html = buildSwapChangesPrintHtml();
  if (!html) {
    swapStatus.textContent = "Nothing to export.";
    return;
  }
  if (!openPdfWindowWithHtml(html)) {
    swapStatus.textContent = "Popup blocked — allow pop-ups for this site.";
    return;
  }
  swapStatus.textContent =
    "Opened swap checklist. Print → Save as PDF — suggest filename " +
    `${getFixtureFileBaseAbbrev()}_swap_changes_checklist.pdf`;
}

function getStoredGeneratorUiStep() {
  try {
    const v = sessionStorage.getItem(GENERATOR_UI_STEP_STORAGE_KEY);
    if (v === "squad" || v === "pools" || v === "run") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "squad";
}

function openGeneratorUiStep(step) {
  if (!generatorPanel) {
    return;
  }
  const allowed = { squad: true, pools: true, run: true };
  const s = allowed[step] ? step : "squad";
  generatorPanel.querySelectorAll(".gen-step-btn").forEach((btn) => {
    const on = btn.dataset.genStep === s;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  generatorPanel.querySelectorAll(".gen-step-panel").forEach((el) => {
    const on =
      (s === "squad" && el.id === "genStepSquad") ||
      (s === "pools" && el.id === "genStepPools") ||
      (s === "run" && el.id === "genStepRun");
    el.classList.toggle("active", on);
  });
  try {
    sessionStorage.setItem(GENERATOR_UI_STEP_STORAGE_KEY, s);
  } catch {
    /* ignore */
  }
}

function openTab(tabName) {
  const map = {
    generator: { btn: tabGeneratorBtn, panel: generatorPanel },
    swap: { btn: tabSwapBtn, panel: swapPanel },
    postMatch: { btn: tabPostMatchBtn, panel: postMatchPanel },
  };
  Object.values(map).forEach((entry) => {
    entry.btn.classList.remove("active");
    entry.panel.classList.remove("active");
  });
  if (map[tabName]) {
    map[tabName].btn.classList.add("active");
    map[tabName].panel.classList.add("active");
    if (tabName === "generator") {
      openGeneratorUiStep(getStoredGeneratorUiStep());
    }
  }
}

function getUniquePostMatchPlayers() {
  const sourceTeams = getPostMatchTeamsSource();
  const seen = new Set();
  const players = [];
  sourceTeams.forEach((row) => {
    row.players.forEach((p) => {
      const key = `${p.player}::${p.team}`;
      if (seen.has(key)) return;
      seen.add(key);
      players.push({ player: p.player, team: p.team, key });
    });
  });
  return players.sort((a, b) => {
    if (a.team !== b.team) return a.team.localeCompare(b.team);
    return a.player.localeCompare(b.player);
  });
}

function renderPostMatchPlayerInputs() {
  const players = getUniquePostMatchPlayers();
  if (!players.length) {
    postMatchPlayersInputs.innerHTML = "<p>No team pool found yet. Generate/upload teams first.</p>";
    updatePostMatchPersistHint();
    return;
  }
  const saved = getSavedPostMatchFixture();
  postMatchPlayersInputs.innerHTML = "";
  players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "post-player-row";

    const name = document.createElement("div");
    name.className = "post-player-name";
    name.textContent = `${p.player} (${p.team})`;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.01";
    input.min = "0";
    input.placeholder = "Points";
    input.dataset.team = p.team;
    input.dataset.player = p.player;
    const k = postMatchCompositeKey(p.team, p.player);
    if (saved?.players && saved.players[k] !== undefined) {
      input.value = String(saved.players[k]);
    }

    input.addEventListener("input", schedulePersistPostMatchPoints);
    input.addEventListener("change", persistPostMatchPointsEntry);

    row.appendChild(name);
    row.appendChild(input);
    postMatchPlayersInputs.appendChild(row);
  });
  if (saved?.topContestPoints != null && !Number.isNaN(saved.topContestPoints)) {
    topTeamPointsInput.value = String(saved.topContestPoints);
  } else {
    topTeamPointsInput.value = "";
  }
  updatePostMatchPersistHint();
}

function collectActualPointsInput() {
  const pointsByComposite = {};
  const inputs = Array.from(
    postMatchPlayersInputs.querySelectorAll("input[data-team][data-player]")
  );
  inputs.forEach((input) => {
    const team = String(input.dataset.team || "").trim();
    const player = String(input.dataset.player || "").trim();
    if (input.value.trim() === "") return;
    const points = Number(input.value);
    if (!team || !player || Number.isNaN(points)) return;
    pointsByComposite[postMatchCompositeKey(team, player)] = points;
  });
  return pointsByComposite;
}

function getPostMatchTeamsSource() {
  if (state.postMatchSourceTeams?.length) return state.postMatchSourceTeams;
  if (state.swappedTeams.length) return state.swappedTeams;
  if (state.swapSourceTeams.length) return state.swapSourceTeams;
  return state.generatedTeams;
}

function findTeamForPlayerName(teamRow, name) {
  const pl = teamRow.players.find((p) => p.player === name);
  return pl ? pl.team : "";
}

function computeActualTeamPoints(teamRow, pointsByComposite) {
  const get = (team, player) => {
    const k = postMatchCompositeKey(team, player);
    if (pointsByComposite[k] !== undefined) return pointsByComposite[k];
    return Number(pointsByComposite[String(player || "").toLowerCase()] || 0);
  };
  let base = 0;
  teamRow.players.forEach((p) => {
    base += Number(get(p.team, p.player));
  });
  const cTeam = findTeamForPlayerName(teamRow, teamRow.captain);
  const vcTeam = findTeamForPlayerName(teamRow, teamRow.viceCaptain);
  const cPoints = Number(get(cTeam, teamRow.captain));
  const vcPoints = Number(get(vcTeam, teamRow.viceCaptain));
  return Number((base + cPoints + 0.5 * vcPoints).toFixed(2));
}

function buildPostMatchScoredRows(sourceTeams, pointsByPlayer) {
  const chunk = state.lastGeneratorConfig?.candidateChunkSize ?? getCandidateChunkSizeFromUi();
  const rows = sourceTeams.map((row, idx) => {
    const globalIndex = row.globalIndex != null ? row.globalIndex : idx + 1;
    const candidateSlot =
      row.candidateSlot != null ? row.candidateSlot : Math.floor(idx / chunk) + 1;
    const candidateName = row.candidateName || getCandidateLabel(candidateSlot);
    return {
      globalIndex,
      candidateSlot,
      candidateName,
      strategy: row.strategy,
      captain: row.captain,
      viceCaptain: row.viceCaptain,
      actualPoints: computeActualTeamPoints(row, pointsByPlayer),
    };
  });
  const overallSorted = [...rows].sort((a, b) => b.actualPoints - a.actualPoints);
  overallSorted.forEach((r, i) => {
    r.overallRank = i + 1;
  });
  const maxCand = rows.length ? Math.max(...rows.map((r) => r.candidateSlot)) : 0;
  for (let c = 1; c <= maxCand; c += 1) {
    const sub = rows
      .filter((r) => r.candidateSlot === c)
      .sort((a, b) => b.actualPoints - a.actualPoints);
    sub.forEach((r, i) => {
      r.rankInCandidate = i + 1;
    });
  }
  return rows;
}

function buildPostMatchStandingPrintHtml(scoredRows, options = {}) {
  const mode = options.mode || "combined";
  const fixture = getFixtureTitleAbbrev();
  const datePart = postMatchDateInput?.value || "";
  const chunk = state.lastGeneratorConfig?.candidateChunkSize ?? getCandidateChunkSizeFromUi();
  const topContestPoints = Number(topTeamPointsInput.value || 0);

  const overallSorted = [...scoredRows].sort((a, b) => b.actualPoints - a.actualPoints);
  const top20 = overallSorted.slice(0, 20);
  const top20Html = top20
    .map((r) => {
      const gap =
        topContestPoints > 0 ? (topContestPoints - r.actualPoints).toFixed(2) : "—";
      return `<tr><td>${r.overallRank}</td><td>${r.globalIndex}</td><td>${r.candidateName || getCandidateLabel(r.candidateSlot)}</td><td>${r.actualPoints.toFixed(2)}</td><td>${r.strategy}</td><td>${gap}</td></tr>`;
    })
    .join("");

  const byCand = {};
  scoredRows.forEach((r) => {
    if (!byCand[r.candidateSlot]) byCand[r.candidateSlot] = [];
    byCand[r.candidateSlot].push(r);
  });
  const candSections = Object.keys(byCand)
    .map(Number)
    .sort((a, b) => a - b)
    .map((slot) => {
      const list = byCand[slot].sort((a, b) => b.actualPoints - a.actualPoints);
      const best = list[0]?.actualPoints ?? 0;
      const avg = list.reduce((s, x) => s + x.actualPoints, 0) / list.length;
      const rowsHtml = list
        .slice(0, 15)
        .map(
          (r) =>
            `<tr><td>${r.rankInCandidate}</td><td>${r.globalIndex}</td><td>${r.actualPoints.toFixed(2)}</td><td>${r.strategy}</td><td>${r.captain}</td><td>${r.viceCaptain}</td></tr>`
        )
        .join("");
      const slotLabel = getCandidateLabel(slot);
      return `<section style="page-break-before:${slot > 1 ? "always" : "auto"};margin-top:12px;">
        <h2 style="font-size:15px;">${slotLabel} · ${list.length} teams (batch size ${chunk})</h2>
        <p style="font-size:12px;color:#444;">Best: ${best.toFixed(2)} pts · Avg: ${avg.toFixed(2)}</p>
        <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:12px;width:100%;">
          <tr><th>Rank in batch</th><th>Global #</th><th>Pts</th><th>Strategy</th><th>C</th><th>VC</th></tr>
          ${rowsHtml}
        </table>
      </section>`;
    })
    .join("");

  if (mode === "candidate" && options.candidateSlot != null) {
    const slot = options.candidateSlot;
    const list = scoredRows.filter((r) => r.candidateSlot === slot).sort((a, b) => b.actualPoints - a.actualPoints);
    const rowsHtml = list
      .map(
        (r) =>
          `<tr><td>${r.rankInCandidate}</td><td>${r.overallRank}</td><td>${r.globalIndex}</td><td>${r.actualPoints.toFixed(2)}</td><td>${r.strategy}</td><td>${r.captain}</td><td>${r.viceCaptain}</td></tr>`
      )
      .join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${fixture}_post_C${slot}</title>
      <style>body{font-family:Arial,sans-serif;padding:12px;font-size:13px;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ccc;padding:4px;}</style></head><body>
      <h1>${fixture} — Post-match · ${getCandidateLabel(slot)}</h1>
      <p>${datePart ? `Date: ${datePart}` : ""} · Batch size: ${chunk}</p>
      <table><tr><th>Batch rank</th><th>Overall rank</th><th>Global #</th><th>Pts</th><th>Strategy</th><th>C</th><th>VC</th></tr>${rowsHtml}</table>
      <p class="hint" style="margin-top:12px;">Print → Save as PDF. Filename: ${getFixtureFileBaseAbbrev()}_post_${sanitizeFilePart(getCandidateLabel(slot))}.pdf</p>
      <button type="button" onclick="window.print()">Print / Save PDF</button>
      </body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${getFixtureFileBaseAbbrev()}_post_all</title>
    <style>
      body{font-family:Arial,sans-serif;padding:12px;font-size:13px;}
      table{border-collapse:collapse;width:100%;max-width:900px;}
      th,td{border:1px solid #ccc;padding:4px;font-size:12px;}
      h1{font-size:17px;} .hint{color:#444;font-size:12px;}
    </style></head><body>
    <h1>${fixture} — Post-match standings (all batches)</h1>
    <p class="hint">${datePart ? `Date: ${datePart} · ` : ""}Batch size: ${chunk} · Use Print → Save as PDF</p>
    <button type="button" class="no-print" onclick="window.print()">Print / Save PDF</button>
    <h2 style="font-size:14px;">Overall top 20</h2>
    <table><tr><th>Overall</th><th>Global #</th><th>Operator</th><th>Pts</th><th>Strategy</th><th>Gap vs contest top</th></tr>${top20Html}</table>
    ${candSections}
    </body></html>`;
}

function openPostMatchPdfCombined() {
  if (!state.lastPostMatchScored?.rows?.length) {
    postMatchStatus.textContent = "Run Analyze Standing first.";
    return;
  }
  const html = buildPostMatchStandingPrintHtml(state.lastPostMatchScored.rows, { mode: "combined" });
  openPdfWindowWithHtml(html);
}

function openPostMatchPdfByCandidateTabs() {
  const scored = state.lastPostMatchScored?.rows;
  if (!scored?.length) {
    postMatchStatus.textContent = "Run Analyze Standing first.";
    return;
  }
  const slots = [...new Set(scored.map((r) => r.candidateSlot))].sort((a, b) => a - b);
  slots.forEach((slot, i) => {
    setTimeout(() => {
      const html = buildPostMatchStandingPrintHtml(scored, { mode: "candidate", candidateSlot: slot });
      const w = window.open("", `_post_cand_${slot}`);
      if (w) {
        w.document.open();
        w.document.write(html);
        w.document.close();
      }
    }, i * 400);
  });
  const labels = slots.map((s) => getCandidateLabel(s)).join(", ");
  postMatchStatus.textContent = `Opening ${slots.length} post-match print tabs: ${labels} (allow pop-ups).`;
}

function renderPostMatchAnalysis() {
  const sourceTeams = getPostMatchTeamsSource();
  if (!sourceTeams.length) {
    postMatchStatus.textContent = "Generate teams, apply swaps, or upload CSV first.";
    postMatchSummary.innerHTML = "";
    renderPostMatchPlayerInputs();
    return;
  }

  const pointsByPlayer = collectActualPointsInput();
  const providedPlayers = Object.keys(pointsByPlayer).length;
  if (!providedPlayers) {
    postMatchStatus.textContent = "Enter points beside at least one player name.";
    postMatchSummary.innerHTML = "";
    return;
  }

  const topContestPoints = Number(topTeamPointsInput.value || 0);
  const chunk = state.lastGeneratorConfig?.candidateChunkSize ?? getCandidateChunkSizeFromUi();
  const scoredRows = buildPostMatchScoredRows(sourceTeams, pointsByPlayer);
  state.lastPostMatchScored = { rows: scoredRows, chunk };

  const bestOur = scoredRows.reduce((m, r) => Math.max(m, r.actualPoints), 0);
  const avgOur = scoredRows.reduce((acc, row) => acc + row.actualPoints, 0) / scoredRows.length;
  const coverageSet = new Set();
  sourceTeams.forEach((row) =>
    row.players.forEach((p) => coverageSet.add(postMatchCompositeKey(p.team, p.player)))
  );
  const coveredPlayers = Object.keys(pointsByPlayer).filter((k) => coverageSet.has(k)).length;

  const overallSorted = [...scoredRows].sort((a, b) => b.actualPoints - a.actualPoints);
  const topRows = overallSorted.slice(0, 12);

  const listHtml = topRows
    .map((row) => {
      const contestGap = topContestPoints > 0 ? (topContestPoints - row.actualPoints).toFixed(2) : "-";
      const nm = row.candidateName || getCandidateLabel(row.candidateSlot);
      return `<li><strong>#${row.overallRank}</strong> overall · ${nm} (batch #${row.rankInCandidate}) · G${row.globalIndex} · ${row.actualPoints.toFixed(2)} pts · ${row.strategy} · C ${row.captain} · VC ${row.viceCaptain} · Gap ${contestGap}</li>`;
    })
    .join("");

  const byCand = {};
  scoredRows.forEach((r) => {
    if (!byCand[r.candidateSlot]) byCand[r.candidateSlot] = [];
    byCand[r.candidateSlot].push(r);
  });
  const candSummaryHtml = Object.keys(byCand)
    .map(Number)
    .sort((a, b) => a - b)
    .map((slot) => {
      const arr = byCand[slot];
      const best = Math.max(...arr.map((x) => x.actualPoints));
      const avg = arr.reduce((s, x) => s + x.actualPoints, 0) / arr.length;
      const bestOverall = Math.min(...arr.map((x) => x.overallRank));
      const nm = getCandidateLabel(slot);
      return `<li><strong>${nm}</strong> (${arr.length} teams): best ${best.toFixed(2)} pts · avg ${avg.toFixed(2)} · best overall rank #${bestOverall}</li>`;
    })
    .join("");

  postMatchStatus.textContent = `Analyzed ${sourceTeams.length} teams (${Math.ceil(sourceTeams.length / chunk) || 0} batches × ~${chunk}) using ${providedPlayers} player point rows. Use PDF buttons for printable reports.`;
  postMatchSummary.innerHTML = `
    <h3>Post-Match Standing</h3>
    <div class="quality-grid">
      <div class="quality-card"><p>Best Our Team</p><ul><li>${bestOur.toFixed(2)} pts</li></ul></div>
      <div class="quality-card"><p>Average Our Teams</p><ul><li>${avgOur.toFixed(2)} pts</li></ul></div>
      <div class="quality-card"><p>Coverage</p><ul><li>Mapped player rows: ${coveredPlayers}/${providedPlayers}</li></ul></div>
    </div>
    <div class="quality-card" style="margin-top:10px;">
      <p>By operator (batch size ${chunk})</p>
      <ul>${candSummaryHtml || "<li>No batch data</li>"}</ul>
    </div>
    <div class="quality-card" style="margin-top:10px;">
      <p>Top 12 Overall by Actual Points</p>
      <ul>${listHtml}</ul>
    </div>
  `;
  persistPostMatchPointsEntry();
}

function generateTeamsAndExports() {
  const mode = getGeneratorModeFromUi();
  const pool = buildGeneratorPoolForMode(mode);
  let blockers = getGenerationBlockingReasons(pool);
  if (mode === STRATEGY_ID_BAT_POOLS) {
    blockers = [...blockers, ...getBatFirstPoolOnlyBlockers()];
  }
  if (mode === STRATEGY_ID_SECOND_INNINGS) {
    blockers = [...blockers, ...getSecondInningsPoolOnlyBlockers()];
  }
  if (mode === STRATEGY_ID_SPLIT_POOL && window.IPL_SPLIT_POOL) {
    blockers = [...blockers, ...window.IPL_SPLIT_POOL.getSplitPoolOnlyBlockers()];
  }
  if (blockers.length) {
    generatorStatus.textContent = `Cannot generate teams: ${blockers.join(" ")}`;
    if (generatorTuningSnapshot) generatorTuningSnapshot.textContent = "";
    const batLogClear = document.getElementById("batFirstGenLog");
    if (batLogClear) {
      batLogClear.innerHTML = "";
    }
    const splitLogClear = document.getElementById("splitPoolGenLog");
    if (splitLogClear) {
      splitLogClear.innerHTML = "";
    }
    const siLogClear = document.getElementById("secondInningsGenLog");
    if (siLogClear) {
      siLogClear.innerHTML = "";
    }
    renderQualitySummary([]);
    return;
  }
  const strategies = getSelectedStrategiesFromUi();
  const teamsPerStrategy = getTeamsPerStrategyFromUi();
  const candidateChunkSize = getCandidateChunkSizeFromUi();
  const scenarioProfile = getActiveScenarioProfile();
  const activeScenarioIds = getActiveHighScoringScenarioIds();
  const generated = [];
  const seenKeys = new Set();
  const recentLineupState = { queue: [], keySet: new Set(), windowSize: LINEUP_REPEAT_COOLDOWN };
  const appearanceCounts = new Map();
  const tuning = getGeneratorTuningFromUi();
  const targetTotal = teamsPerStrategy;
  const cvFair = buildCvFairnessState(pool);
  const strategyFillReport = [];
  state.lastGeneratorConfig = {
    strategies: [...strategies],
    teamsPerStrategy,
    candidateChunkSize,
    tuning: { ...tuning },
    scenarioProfile,
    scenarioIds: [...activeScenarioIds],
    strategyFillReport,
    cvFairMeta: {
      captainPoolSize: cvFair.capKeys.length,
      vicePoolSize: cvFair.vcKeys.length,
      unionPoolSize: cvFair.unionKeys.length,
    },
  };
  strategies.forEach((strategy) => {
    const pack =
      strategy === STRATEGY_ID_BAT_POOLS
        ? generateBatFirstPoolTeamsForStrategy(
            pool,
            teamsPerStrategy,
            seenKeys,
            recentLineupState,
            appearanceCounts,
            tuning,
            cvFair
          )
        : strategy === STRATEGY_ID_SECOND_INNINGS
        ? generateSecondInningsPoolTeamsForStrategy(
            pool,
            teamsPerStrategy,
            seenKeys,
            recentLineupState,
            appearanceCounts,
            tuning,
            cvFair
          )
        : strategy === STRATEGY_ID_SPLIT_POOL && window.IPL_SPLIT_POOL
        ? window.IPL_SPLIT_POOL.generateSplitPoolTeamsForStrategy(
            pool,
            teamsPerStrategy,
            seenKeys,
            recentLineupState,
            appearanceCounts,
            tuning,
            cvFair
          )
        : generateHighScoringTeamsForStrategy(
            pool,
            teamsPerStrategy,
            seenKeys,
            recentLineupState,
            appearanceCounts,
            tuning,
            cvFair
          );
    strategyFillReport.push({
      strategy,
      got: pack.teams.length,
      target: pack.targetTeams,
      minFillMet: pack.minFillMet,
      fullTargetMet: pack.fullTargetMet,
      attempts: pack.attempts,
      highScoringQuota: pack.highScoringQuota,
      batPoolMeta: pack.batPoolMeta,
      splitPoolMeta: pack.splitPoolMeta,
      secondInningsMeta: pack.secondInningsMeta,
    });
    generated.push(...pack.teams);
  });
  tagRowsWithCandidateMeta(generated, candidateChunkSize);
  state.generatedTeams = generated;
  state.swapSourceTeams = generated;
  state.swappedTeams = [];
  state.swapReportRows = [];
  state.postMatchSourceTeams = [];
  const lastAttempts = strategyFillReport.length ? strategyFillReport[strategyFillReport.length - 1].attempts : 0;
  const unionCv = state.lastGeneratorConfig?.cvFairMeta?.unionPoolSize ?? 0;
  const shortfallExplain =
    generated.length < targetTotal
      ? mode === STRATEGY_ID_SECOND_INNINGS
        ? `Only ${generated.length} of ${targetTotal} unique 5-player teams were found (${lastAttempts} draws). Add more names in P1/P2 or expand combination mix.`
        : explainUniqueTeamShortfall(pool.length, generated.length, targetTotal, lastAttempts, unionCv)
      : "";
  const uniqNote =
    generated.length < targetTotal
      ? ` (${generated.length}/${targetTotal} unique teams saved — see note below)`
      : "";
  const cellCount = activeScenarioIds.length;
  const fillLines = strategyFillReport
    .map((r) => {
      if (
        (r.strategy === STRATEGY_ID || r.strategy === STRATEGY_ID_BAT_POOLS) &&
        r.highScoringQuota
      ) {
        const q = r.highScoringQuota;
        const tag = r.minFillMet ? `${cellCount}-cell min OK` : `below ${cellCount}-cell min`;
        const batEx =
          r.strategy === STRATEGY_ID_BAT_POOLS && r.batPoolMeta?.batchSegments
            ? (() => {
                const bs = r.batPoolMeta.batchSegments;
                const fc = r.batPoolMeta.franchise74Cap;
                const f = bs.full;
                const red = bs.reduced;
                const fcBit = fc
                  ? ` · franchise 7–4 cap ${fc.cap} → ${fc.accepted74} accepted with 7/4 split`
                  : "";
                const fullBit = `full ${f.lenSegA}×6+5+${f.lenSegB}×5+6 (${f.perc.segA.toFixed(0)}/${f.perc.segB.toFixed(0)}%)`;
                const redBit =
                  red.teamCount > 0
                    ? ` · reduced ${red.lenSegA}×6+5+${red.lenSegB}×5+6 (${red.perc.segA.toFixed(0)}/${red.perc.segB.toFixed(0)}%)`
                    : "";
                return ` · bat-first ${fullBit}${redBit}${fcBit}`;
              })()
            : "";
        return `${r.strategy}: ${r.got}/${r.target} · min/cell≥${q.minPerCell} (min observed ${q.minAcross}, ${q.cellsBelowMinQuota} cells < min) · ${tag}${batEx}`;
      }
      if (r.strategy === STRATEGY_ID_SPLIT_POOL && r.splitPoolMeta) {
        const m = r.splitPoolMeta;
        const rr = m.rejectReport || {};
        const pc = rr.profileCounts || m.profileCounts || {};
        const prof = `C1 ${pc.C1 || 0} · C2 ${pc.C2 || 0} · C3 ${pc.C3 || 0} · C4 ${pc.C4 || 0}`;
        const iters = (rr.attempts ?? r.attempts ?? 0).toLocaleString();
        const poolBit =
          (m.teamsFromReducedPool ?? rr.teamsFromReducedPool) > 0
            ? ` · full ${m.teamsFromFullPool ?? rr.teamsFromFullPool} / red ${m.teamsFromReducedPool ?? rr.teamsFromReducedPool}`
            : "";
        return `${r.strategy}: ${r.got}/${r.target} · ${iters} iterations · ${prof}${poolBit}${r.fullTargetMet ? "" : " (under target)"}`;
      }
      if (r.strategy === STRATEGY_ID_SECOND_INNINGS && r.secondInningsMeta) {
        const m = r.secondInningsMeta;
        const rr = m.rejectReport || {};
        const chaseBit = `chase ${m.nChaseGot}/${m.nChaseTarget}`;
        const bowlBit = `bowl ${m.nBowlGot}/${m.nBowlTarget}`;
        const iters = (rr.attempts ?? r.attempts ?? 0).toLocaleString();
        let warn = "";
        if (m.nBowlTarget > 0 && m.nBowlGot === 0) {
          warn = m.bowlCvPoolsMissing
            ? " · bowl: fix first-innings bowl C/VC pools"
            : " · bowl: 0 built (see diagnostics — often P2 too small or cvc_none)";
        }
        if (m.nChaseTarget > 0 && m.nChaseGot === 0) {
          warn += m.chaseCvPoolsMissing
            ? " · chase: fix chase-middle C/VC pools"
            : " · chase: 0 built";
        }
        return `${r.strategy}: ${r.got}/${r.target} · ${iters} iterations (${chaseBit}; ${bowlBit})${warn}${r.fullTargetMet ? "" : " (under target)"}`;
      }
      return `${r.strategy}: ${r.got}/${r.target}${r.fullTargetMet ? "" : " (under target)"}`;
    })
    .join(" · ");
  const batches = candidateChunkSize > 0 ? Math.ceil(generated.length / candidateChunkSize) : 0;
  const batchExplain =
    candidateChunkSize > 0 && generated.length > 0
      ? ` Batches: ${batches} operator group(s) × up to ${candidateChunkSize} teams (not the same as total teams).`
      : "";
  const shortfallBlock = shortfallExplain ? ` ${shortfallExplain}` : "";
  const csvPart = generated.length ? " CSV has one row per team." : "";
  generatorStatus.textContent = `Generated ${generated.length} teams${uniqNote} · ${fillLines} · ${batches} batch(es) of up to ${candidateChunkSize} (${getFixtureFileBaseAbbrev()}).${batchExplain}${csvPart}${shortfallBlock} Use PDF buttons for printable reports.`;
  const batLogEl = document.getElementById("batFirstGenLog");
  if (batLogEl) {
    const batRow = strategyFillReport.find((r) => r.strategy === STRATEGY_ID_BAT_POOLS);
    batLogEl.innerHTML =
      batRow?.batPoolMeta ? formatBatFirstRejectReportHtml(batRow.batPoolMeta) : "";
  }
  const splitLogEl = document.getElementById("splitPoolGenLog");
  if (splitLogEl) {
    const splitRow = strategyFillReport.find((r) => r.strategy === STRATEGY_ID_SPLIT_POOL);
    splitLogEl.innerHTML =
      splitRow?.splitPoolMeta ? formatSplitPoolRejectReportHtml(splitRow.splitPoolMeta) : "";
  }
  const siLogEl = document.getElementById("secondInningsGenLog");
  if (siLogEl) {
    const siRow = strategyFillReport.find((r) => r.strategy === STRATEGY_ID_SECOND_INNINGS);
    siLogEl.innerHTML =
      siRow?.secondInningsMeta ? formatSecondInningsRejectReportHtml(siRow.secondInningsMeta) : "";
  }
  if (generatorTuningSnapshot) {
    generatorTuningSnapshot.textContent = formatTuningSnapshotLine(tuning);
  }
  renderQualitySummary(generated);
  swapStatus.textContent = `Generated ${generated.length} teams ready for swap engine.`;
  renderSwapPreview();
  refreshSwapRuleDropdowns();
  renderPostMatchPlayerInputs();
  downloadCsvFromTeams(generated);
}

/** Single dropdown to add a ticked player to both C and VC pools. */
function appendCvPoolAddMissingControls(container, items, capSet, vcSet, onAddBoth) {
  if (!container || !items.length || typeof onAddBoth !== "function") {
    return;
  }
  const missing = items.filter((item) => !capSet.has(item.key) || !vcSet.has(item.key));
  if (!missing.length) {
    return;
  }

  const block = document.createElement("div");
  block.className = "cvc-pool-block cvc-pool-add-block";
  const label = document.createElement("p");
  label.className = "cvc-pool-label";
  label.textContent = "Add other ticked players (C and VC)";
  block.appendChild(label);

  const row = document.createElement("div");
  row.className = "cvc-add-row";
  const sel = document.createElement("select");
  sel.className = "cvc-pool-add-select";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose player…";
  sel.appendChild(placeholder);
  missing.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.key;
    opt.textContent = item.label;
    sel.appendChild(opt);
  });
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cvc-pool-add-btn";
  btn.textContent = "Add";
  btn.addEventListener("click", () => {
    const key = String(sel.value || "").trim();
    if (!key) {
      return;
    }
    onAddBoth(key);
  });
  row.appendChild(sel);
  row.appendChild(btn);
  block.appendChild(row);
  container.appendChild(block);
}

function addPlayerToHighScoringCvPoolsBoth(teamName, playerName, scenarioId) {
  const cur = getEffectiveCvPoolsForScenario(scenarioId)[teamName];
  if (!cur) {
    return;
  }
  const eligible = getCvEligiblePlayerNamesForTeam(teamName);
  if (!eligible.has(playerName)) {
    return;
  }
  const cap = new Set([...(cur.captain_pool || [])].filter((n) => eligible.has(n)));
  const vc = new Set([...(cur.vice_captain_pool || [])].filter((n) => eligible.has(n)));
  cap.add(playerName);
  vc.add(playerName);
  setCvPoolForTeam(
    teamName,
    {
      captain_pool: [...cap].sort((a, b) => a.localeCompare(b)),
      vice_captain_pool: [...vc].sort((a, b) => a.localeCompare(b)),
    },
    scenarioId
  );
}

function addPlayerToSecondInningsScenarioCvPoolsBoth(scenarioKey, playerId) {
  applySecondInningsScenarioCvCheckboxChange(scenarioKey, playerId, "captain", true);
  applySecondInningsScenarioCvCheckboxChange(scenarioKey, playerId, "vice_captain", true);
}

function setCvPoolForTeam(teamName, next, scenarioId) {
  const bucket = getCvPoolsEditedBucketForScenario(scenarioId);
  bucket[teamName] = sanitizeCvPoolsEntry({
    captain_pool: [...(next.captain_pool || [])],
    vice_captain_pool: [...(next.vice_captain_pool || [])],
  });
  persistCvPools();
  renderCvPoolPanels();
}

function applyCvPoolCheckboxChange(teamName, playerName, poolKind, checked, scenarioId) {
  const cur = getEffectiveCvPoolsForScenario(scenarioId)[teamName];
  if (!cur) {
    return;
  }
  const eligible = getCvEligiblePlayerNamesForTeam(teamName);
  let cap = new Set([...(cur.captain_pool || [])]);
  let vc = new Set([...(cur.vice_captain_pool || [])]);
  if (poolKind === "captain") {
    if (checked) {
      cap.add(playerName);
    } else {
      cap.delete(playerName);
    }
  } else if (checked) {
    vc.add(playerName);
  } else {
    vc.delete(playerName);
  }
  cap = new Set([...cap].filter((n) => eligible.has(n)));
  vc = new Set([...vc].filter((n) => eligible.has(n)));
  setCvPoolForTeam(
    teamName,
    {
      captain_pool: [...cap].sort((a, b) => a.localeCompare(b)),
      vice_captain_pool: [...vc].sort((a, b) => a.localeCompare(b)),
    },
    scenarioId
  );
}

function renderCvPoolColumn(teamName, container, scenarioId) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  if (!getEffectiveCvPoolsForScenario(scenarioId)[teamName]) {
    container.textContent = "Unknown team.";
    return;
  }

  const h = document.createElement("h4");
  h.className = "cvc-pool-team-title";
  h.textContent = teamName;
  container.appendChild(h);

  const eligibleNames = getCvEligiblePlayerNamesForTeam(teamName);
  if (eligibleNames.size === 0) {
    const hint = document.createElement("p");
    hint.className = "cvc-pool-hint";
    hint.textContent = "Tick players in step 1 (squad), then assign C / VC here.";
    container.appendChild(hint);
    return;
  }

  const hint = document.createElement("p");
  hint.className = "cvc-pool-hint";
  hint.textContent =
    "Suggested roles for this scenario are listed below. Use Add other ticked players for anyone else.";
  container.appendChild(hint);

  const suggestedSet = isSplitPoolProfileScenarioId(scenarioId)
    ? getSuggestedCvPlayerNamesForSplitPoolProfile(teamName, scenarioId)
    : getSuggestedCvPlayerNamesForHighScoringScenario(teamName, scenarioId);
  const capSet = getCvPoolNameSetForTeam(teamName, "captain", scenarioId);
  const vcSet = getCvPoolNameSetForTeam(teamName, "vice_captain", scenarioId);
  const names = [...new Set([...suggestedSet, ...capSet, ...vcSet])]
    .filter((n) => eligibleNames.has(n))
    .sort((a, b) => a.localeCompare(b));

  const grid = document.createElement("div");
  grid.className = "cvc-tick-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", `Captain and vice-captain eligibility for ${teamName}`);

  const header = document.createElement("div");
  header.className = "cvc-tick-header";
  const colName = document.createElement("span");
  colName.className = "cvc-tick-col cvc-tick-col-name";
  colName.textContent = "Player";
  const colC = document.createElement("span");
  colC.className = "cvc-tick-col cvc-tick-col-c";
  colC.textContent = "C";
  colC.title = "Captain pool";
  const colVc = document.createElement("span");
  colVc.className = "cvc-tick-col cvc-tick-col-vc";
  colVc.textContent = "VC";
  colVc.title = "Vice-captain pool";
  header.appendChild(colName);
  header.appendChild(colC);
  header.appendChild(colVc);
  grid.appendChild(header);

  names.forEach((playerName) => {
    const row = document.createElement("div");
    row.className = "cvc-tick-row";

    const nameSpan = document.createElement("span");
    nameSpan.className = suggestedSet.has(playerName)
      ? "cvc-tick-name"
      : "cvc-tick-name cvc-tick-name-extra";
    nameSpan.textContent = suggestedSet.has(playerName) ? playerName : `${playerName} · added`;

    const mkCell = (kind, isChecked, ariaLabel) => {
      const wrap = document.createElement("div");
      wrap.className = "cvc-tick-cell";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isChecked;
      cb.setAttribute("aria-label", `${ariaLabel}: ${playerName}`);
      cb.addEventListener("change", () => {
        applyCvPoolCheckboxChange(teamName, playerName, kind, cb.checked, scenarioId);
      });
      wrap.appendChild(cb);
      return wrap;
    };

    row.appendChild(nameSpan);
    row.appendChild(mkCell("captain", capSet.has(playerName), "Captain pool"));
    row.appendChild(mkCell("vice_captain", vcSet.has(playerName), "Vice-captain pool"));
    grid.appendChild(row);
  });

  container.appendChild(grid);
  const cvItems = [...eligibleNames]
    .filter((playerName) => !suggestedSet.has(playerName))
    .map((playerName) => ({ key: playerName, label: playerName }));
  appendCvPoolAddMissingControls(container, cvItems, capSet, vcSet, (playerName) => {
    addPlayerToHighScoringCvPoolsBoth(teamName, playerName, scenarioId);
  });
}

function renderCvPoolPanels() {
  const host = document.getElementById("cvcPoolScenarioHost");
  if (!host) {
    renderCvPoolColumn(teamASelect.value, cvcPoolTeamA, getActiveHighScoringScenarioIds()[0] || "α1");
    renderCvPoolColumn(teamBSelect.value, cvcPoolTeamB, getActiveHighScoringScenarioIds()[0] || "α1");
    return;
  }
  host.innerHTML = "";
  const scenarioIds = getActiveCvScenarioIdsForUi();
  const cvcSub = document.querySelector(".cvc-pool-sub");
  if (cvcSub) {
    cvcSub.innerHTML =
      getGeneratorModeFromUi() === STRATEGY_ID_SPLIT_POOL
        ? "In <strong>split_pool_p1p2p3</strong>, C/VC pools are named <strong>C1–C4</strong> (same as lineup profiles). Hints use P1/P2/P3 bands and §4 stories — not the batting-heavy α/β cells. <strong>Scenario profile</strong> (step 3) is ignored in this mode."
        : "Each scenario lists <strong>suggested</strong> C/VC picks by role. Use <strong>Add other ticked players</strong> for extras. Hints use franchise codes (e.g. CSK, MI) and who bats first vs chases for that cell.";
  }
  if (!scenarioIds.length) {
    host.innerHTML = '<p class="cvc-pool-hint">No active scenario profile.</p>';
    return;
  }
  scenarioIds.forEach((scenarioId) => {
    const section = document.createElement("section");
    section.className = "cvc-pool-scenario-block";
    const title = document.createElement("h4");
    title.className = "cvc-pool-scenario-title";
    title.textContent = getScenarioCvPoolTitle(scenarioId);
    section.appendChild(title);
    const outcome = getScenarioCvPoolOutcomeLine(scenarioId);
    if (outcome) {
      const outcomeEl = document.createElement("p");
      outcomeEl.className = "cvc-pool-scenario-outcome";
      outcomeEl.textContent = outcome;
      section.appendChild(outcomeEl);
    }
    const hint = document.createElement("p");
    hint.className = "cvc-pool-scenario-hint";
    hint.textContent = getScenarioCvPoolHint(scenarioId);
    section.appendChild(hint);
    const grid = document.createElement("div");
    grid.className = "cvc-pool-grid";
    const colA = document.createElement("div");
    colA.className = "cvc-pool-column";
    const colB = document.createElement("div");
    colB.className = "cvc-pool-column";
    grid.appendChild(colA);
    grid.appendChild(colB);
    section.appendChild(grid);
    host.appendChild(section);
    renderCvPoolColumn(teamASelect.value, colA, scenarioId);
    renderCvPoolColumn(teamBSelect.value, colB, scenarioId);
  });
}

function handleTeamChange() {
  if (teamASelect.value === teamBSelect.value) {
    const fallback = Array.from(state.teamsByName.keys()).find((team) => team !== teamASelect.value);
    teamBSelect.value = fallback || teamBSelect.value;
  }
  pruneSelectionToCurrentMatch();
  enableProbableXiDefaults(teamASelect.value);
  enableProbableXiDefaults(teamBSelect.value);
  persistSelection();
  renderTeamPlayers(teamASelect.value, teamAPlayers, teamATitle);
  renderTeamPlayers(teamBSelect.value, teamBPlayers, teamBTitle);
  renderSelectedPlayers();
  renderStatus();
  renderCvPoolPanels();
  applyBatPoolsForCurrentFixture();
  applySecondInningsPoolsForCurrentFixture();
  window.IPL_SPLIT_POOL?.loadSplitPoolsForFixture?.();
  updateGeneratorModePanels();
  refreshSwapRuleDropdowns();
}

function hydrateTeamDropdowns(teamNames) {
  [teamASelect, teamBSelect].forEach((select) => {
    select.innerHTML = "";
    teamNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
  });
  teamASelect.value = teamNames[0];
  teamBSelect.value = teamNames[1] || teamNames[0];
}

function bindEvents() {
  document.getElementById("tuningPresetSelect")?.addEventListener("change", (e) => {
    applyGeneratorTuningPresetById(String(e.target.value || ""));
  });
  scenarioProfileSelect?.addEventListener("change", () => {
    updateGeneratorAttemptsHint();
    renderCvPoolPanels();
  });
  document.getElementById("generatorModeSelect")?.addEventListener("change", () => {
    const mode = getGeneratorModeFromUi();
    if (mode === STRATEGY_ID_SECOND_INNINGS) {
      if (teamsPerStrategyInput && String(teamsPerStrategyInput.value || "").trim() === "200") {
        teamsPerStrategyInput.value = "80";
      }
      const candChunk = document.getElementById("candidateChunkInput");
      if (candChunk && String(candChunk.value || "").trim() === "40") {
        candChunk.value = "20";
      }
    }
    updateGeneratorModePanels();
    updateGeneratorAttemptsHint();
  });
  document.getElementById("batPoolAutoFillBtn")?.addEventListener("click", () => {
    if (!state.selectedPlayers.size) {
      return;
    }
    autoFillBatPoolsFromSelection();
  });
  document.getElementById("splitPoolAutoFillBtn")?.addEventListener("click", () => {
    if (!state.selectedPlayers.size) {
      return;
    }
    window.IPL_SPLIT_POOL?.autoFillSplitPoolsFromSelection?.();
  });
  document.getElementById("splitPoolFullPoolPctInput")?.addEventListener("change", () => {
    window.IPL_SPLIT_POOL?.persistSplitPools?.();
    const hint = document.getElementById("splitPoolHint");
    if (hint && window.IPL_SPLIT_POOL) {
      window.IPL_SPLIT_POOL.renderSplitPoolPanel();
    }
    updateGeneratorAttemptsHint();
  });
  ["splitPoolDupStage1Input", "splitPoolDupStage2Input", "splitPoolDupStage3Input"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      window.IPL_SPLIT_POOL?.persistSplitPools?.();
      updateGeneratorAttemptsHint();
    });
  });
  document.getElementById("cvPoolsAutoFillScenarioBtn")?.addEventListener("click", () => {
    if (!state.selectedPlayers.size) {
      return;
    }
    autoFillCvPoolsFromScenarioRoles();
  });
  document.getElementById("batFirstSplit74QuotaCheckbox")?.addEventListener("change", (e) => {
    const el = e.target;
    state.batPools.split74Quota = el instanceof HTMLInputElement ? Boolean(el.checked) : Boolean(state.batPools.split74Quota);
    persistBatPools();
    renderBatPoolPanel();
  });
  [batFirstFullSegAPctInput, batFirstFullSegBPctInput, batFirstReducedSegAPctInput, batFirstReducedSegBPctInput].forEach(
    (el) => {
      el?.addEventListener("input", () => {
        state.batPools.fullSegmentPercents = getBatFirstFullSegmentPercentsFromUi();
        state.batPools.reducedSegmentPercents = getBatFirstReducedSegmentPercentsFromUi();
        persistBatPools();
        renderBatPoolPanel();
      });
      el?.addEventListener("change", () => {
        state.batPools.fullSegmentPercents = getBatFirstFullSegmentPercentsFromUi();
        state.batPools.reducedSegmentPercents = getBatFirstReducedSegmentPercentsFromUi();
        persistBatPools();
        renderBatPoolPanel();
      });
    }
  );
  batFirstFullPoolPctInput?.addEventListener("input", () => {
    state.batPools.fullPoolPercent = getBatFirstFullPoolPercentFromUi();
    persistBatPools();
    renderBatPoolPanel();
  });
  batFirstFullPoolPctInput?.addEventListener("change", () => {
    state.batPools.fullPoolPercent = getBatFirstFullPoolPercentFromUi();
    persistBatPools();
    renderBatPoolPanel();
  });
  [batFirstDupStage1Input, batFirstDupStage2Input, batFirstDupStage3Input].forEach((el) => {
    el?.addEventListener("input", () => {
      state.batPools.lineupDupStages = getBatFirstLineupDupStagesFromUi();
      persistBatPools();
      renderBatPoolPanel();
    });
    el?.addEventListener("change", () => {
      state.batPools.lineupDupStages = getBatFirstLineupDupStagesFromUi();
      persistBatPools();
      renderBatPoolPanel();
    });
  });
  document.getElementById("secondInningsAutoFillBtn")?.addEventListener("click", () => {
    if (!state.selectedPlayers.size) {
      return;
    }
    autoFillSecondInningsPoolsFromSelection();
  });
  secondInningsChasingTeamSelect?.addEventListener("change", () => {
    state.secondInningsPools.chasingTeam = getSecondInningsChasingTeamFromUi();
    persistSecondInningsPools();
    renderSecondInningsPoolPanel();
  });
  const bumpSecondInningsPersist = () => {
    persistSecondInningsPools();
    renderSecondInningsPoolPanel();
    updateGeneratorAttemptsHint();
  };
  document.getElementById("secondInningsChaseScenarioPctInput")?.addEventListener("input", bumpSecondInningsPersist);
  document.getElementById("secondInningsChaseScenarioPctInput")?.addEventListener("change", bumpSecondInningsPersist);
  document.getElementById("secondInningsChaseComboInput")?.addEventListener("input", bumpSecondInningsPersist);
  document.getElementById("secondInningsChaseComboInput")?.addEventListener("change", bumpSecondInningsPersist);
  document.getElementById("secondInningsBowlComboInput")?.addEventListener("input", bumpSecondInningsPersist);
  document.getElementById("secondInningsBowlComboInput")?.addEventListener("change", bumpSecondInningsPersist);
  teamASelect.addEventListener("change", handleTeamChange);
  teamBSelect.addEventListener("change", handleTeamChange);
  resetBtn.addEventListener("click", () => {
    state.selectedPlayers.clear();
    persistSelection();
    state.batPools = {
      fixtureKey: "",
      p1: [],
      p2: [],
      split74Quota: DEFAULT_BAT_FIRST_SPLIT74_QUOTA,
      fullSegmentPercents: { ...DEFAULT_BAT_FIRST_SEGMENT_PERCENTS },
      reducedSegmentPercents: { ...DEFAULT_BAT_FIRST_SEGMENT_PERCENTS },
      lineupDupStages: [...DEFAULT_BAT_FIRST_LINEUP_DUP_STAGES],
      fullPoolPercent: DEFAULT_BAT_FIRST_FULL_POOL_PCT,
      reducedExcludeIds: [],
    };
    state.secondInningsPools = {
      fixtureKey: "",
      chasingTeam: "",
      p1Top: [],
      p1Rest: [],
      p2: [],
      chaseScenarioPercent: DEFAULT_SECOND_INNINGS_CHASE_SCENARIO_PCT,
      chaseComboSpec: DEFAULT_SECOND_INNINGS_CHASE_COMBO_SPEC,
      bowlComboSpec: DEFAULT_SECOND_INNINGS_BOWL_COMBO_SPEC,
      scenarioCv: {
        chase: emptySecondInningsScenarioCvEntry(),
        bowl: emptySecondInningsScenarioCvEntry(),
      },
    };
    syncBatFirstSplit74CheckboxFromState();
    applyBatFirstSegmentPercentsToUi(state.batPools.fullSegmentPercents, state.batPools.reducedSegmentPercents);
    applyBatFirstLineupDupStagesToUi(state.batPools.lineupDupStages);
    applyBatFirstFullPoolPercentToUi(state.batPools.fullPoolPercent);
    try {
      localStorage.removeItem(BAT_POOLS_STORAGE_KEY);
      localStorage.removeItem(SECOND_INNINGS_POOLS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    handleTeamChange();
    renderSelectedPlayers();
    state.generatedTeams = [];
    generatorStatus.textContent = "No generated teams yet.";
    const batLogReset = document.getElementById("batFirstGenLog");
    if (batLogReset) {
      batLogReset.innerHTML = "";
    }
    const splitLogReset = document.getElementById("splitPoolGenLog");
    if (splitLogReset) {
      splitLogReset.innerHTML = "";
    }
    const siLogReset = document.getElementById("secondInningsGenLog");
    if (siLogReset) {
      siLogReset.innerHTML = "";
    }
    if (generatorTuningSnapshot) generatorTuningSnapshot.textContent = "";
    renderQualitySummary([]);
    state.swapSourceTeams = [];
    state.swappedTeams = [];
    state.swapReportRows = [];
    state.postMatchSourceTeams = [];
    swapStatus.textContent = "No swap file loaded.";
    renderSwapPreview();
    postMatchStatus.textContent = "No post-match analysis yet.";
    postMatchSummary.innerHTML = "";
    postMatchPlayersInputs.innerHTML = "";
    topTeamPointsInput.value = "";
    postMatchCsvInput.value = "";
    if (postMatchDateInput) postMatchDateInput.value = "";
    if (teamsPerStrategyInput) teamsPerStrategyInput.value = "80";
    if (scenarioProfileSelect) scenarioProfileSelect.value = DEFAULT_SCENARIO_PROFILE;
    const genMode = document.getElementById("generatorModeSelect");
    if (genMode) genMode.value = STRATEGY_ID_SECOND_INNINGS;
    const candChunk = document.getElementById("candidateChunkInput");
    if (candChunk) candChunk.value = "20";
    setTuningInputsFromSnakeCase(defaultTuningSnakeCase());
    clearTuningPresetSelect();
    hydrateCandidateNamesInput();
    updateGeneratorModePanels();
    updateGeneratorAttemptsHint();
  });
  teamsPerStrategyInput?.addEventListener("input", updateGeneratorAttemptsHint);
  teamsPerStrategyInput?.addEventListener("change", updateGeneratorAttemptsHint);
  [
    "tuningRepeatLambda",
    "tuningLineupCeilingNudge",
    "tuningCvUniformBlend",
    "tuningCvFairnessLambda",
    "tuningLowerMiddleBatWeight",
    "tuningBlendProjWeight",
    "tuningBlendCeilingWeight",
    "tuningBlendRoleStabilityWeight",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    const bump = () => {
      clearTuningPresetSelect();
      updateGeneratorAttemptsHint();
    };
    el.addEventListener("change", bump);
    el.addEventListener("input", bump);
  });
  tabGeneratorBtn.addEventListener("click", () => openTab("generator"));
  generatorPanel?.addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target.closest("[data-gen-step]") : null;
    if (!t || !generatorPanel.contains(t)) {
      return;
    }
    const step = t.dataset.genStep;
    if (step === "squad" || step === "pools" || step === "run") {
      openGeneratorUiStep(step);
    }
  });
  tabSwapBtn.addEventListener("click", () => {
    openTab("swap");
    refreshSwapRuleDropdowns();
  });
  tabPostMatchBtn.addEventListener("click", () => {
    openTab("postMatch");
    renderPostMatchPlayerInputs();
  });
  if (postMatchDateInput) {
    postMatchDateInput.addEventListener("change", () => {
      renderPostMatchPlayerInputs();
    });
  }
  topTeamPointsInput.addEventListener("input", schedulePersistPostMatchPoints);
  topTeamPointsInput.addEventListener("change", persistPostMatchPointsEntry);
  generateTeamsBtn.addEventListener("click", generateTeamsAndExports);
  downloadPdfBtn.addEventListener("click", () => {
    if (!state.generatedTeams.length) {
      generatorStatus.textContent = "Please generate teams first.";
      return;
    }
    openPdfView(state.generatedTeams);
  });
  document.getElementById("downloadPdfByCandidateTabsBtn")?.addEventListener("click", () => {
    if (!state.generatedTeams.length) {
      generatorStatus.textContent = "Please generate teams first.";
      return;
    }
    openPdfByCandidateSeparateTabs(state.generatedTeams);
  });
  document.getElementById("downloadPdfByCandidateCombinedBtn")?.addEventListener("click", () => {
    if (!state.generatedTeams.length) {
      generatorStatus.textContent = "Please generate teams first.";
      return;
    }
    openPdfByCandidateOneDocument(state.generatedTeams);
  });
  document.getElementById("postMatchPdfCombinedBtn")?.addEventListener("click", openPostMatchPdfCombined);
  document.getElementById("postMatchPdfTabsBtn")?.addEventListener("click", openPostMatchPdfByCandidateTabs);
  const candNamesEl = document.getElementById("candidateNamesInput");
  if (candNamesEl) {
    const syncNames = () => {
      const names = parseCandidateNamesFromText(candNamesEl.value);
      state.candidateNames = names.length ? names : [...DEFAULT_CANDIDATE_NAMES];
      persistCandidateNames();
      hydrateCandidateNamesInput();
    };
    candNamesEl.addEventListener("change", syncNames);
    candNamesEl.addEventListener("blur", syncNames);
  }
  addSwapRuleBtn.addEventListener("click", () => addSwapRuleRow());
  applySwapsBtn.addEventListener("click", () => {
    const source = state.swapSourceTeams.length ? state.swapSourceTeams : state.generatedTeams;
    if (!source.length) {
      swapStatus.textContent = "Generate teams or upload CSV first.";
      return;
    }
    applySwapsToTeams(source);
  });
  downloadSwappedCsvBtn.addEventListener("click", () => {
    if (!state.swappedTeams.length) {
      swapStatus.textContent = "Apply swaps first.";
      return;
    }
    const chunk = state.lastGeneratorConfig?.candidateChunkSize || getCandidateChunkSizeFromUi();
    const exportRows = state.swappedTeams.map((r) => ({ ...r }));
    tagRowsWithCandidateMeta(exportRows, chunk);
    downloadCsvFromTeams(exportRows);
  });
  downloadSwapReportBtn.addEventListener("click", downloadSwapReportCsv);
  analyzePostMatchBtn.addEventListener("click", renderPostMatchAnalysis);
  postMatchCsvInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseTeamsCsv(text);
    if (!parsed.length) {
      postMatchStatus.textContent = "Could not parse CSV. Use generated teams CSV format.";
      return;
    }
    state.postMatchSourceTeams = parsed;
    postMatchStatus.textContent = `Loaded ${parsed.length} teams from CSV for post-match analysis.`;
    postMatchSummary.innerHTML = "";
    renderPostMatchPlayerInputs();
  });
  document.getElementById("swapChangesPdfBtn")?.addEventListener("click", openSwapChangesPdf);
  document.getElementById("swapPdfCombinedBtn")?.addEventListener("click", openSwappedTeamsPdfSingle);
  swapCsvInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    const parsed = parseTeamsCsv(text);
    if (!parsed.length) {
      swapStatus.textContent = "Could not parse CSV. Use generated teams CSV format.";
      return;
    }
    const chunk = state.lastGeneratorConfig?.candidateChunkSize || getCandidateChunkSizeFromUi();
    const tagged = parsed.map((r) => ({ ...r }));
    tagRowsWithCandidateMeta(tagged, chunk);
    state.swapSourceTeams = tagged;
    state.swappedTeams = [];
    state.swapReportRows = [];
    state.postMatchSourceTeams = [];
    swapStatus.textContent = `Loaded ${parsed.length} teams from CSV for swapping (batch/operator labels applied). Swap OUT list updated from this file.`;
    refreshSwapRuleDropdowns();
    renderSwapPreview();
    renderPostMatchPlayerInputs();
  });
}

async function init() {
  try {
    const [squads, form, profiles, cvPools, abbrevData, battingSlots, tuningPresetsFile] =
      await Promise.all([
        fetchJson(SQUADS_PATH),
        fetchJson(FORM_PATH),
        fetchJson(PROFILES_PATH),
        fetchJson(C_VC_POOLS_PATH).catch(() => ({ version: 1, pools: {} })),
        fetchJson(TEAM_ABBREV_PATH).catch(() => ({ abbreviations: {} })),
        fetchJson(BATTING_SLOTS_PATH).catch(() => ({ teams: {} })),
        fetchJson(TUNING_PRESETS_PATH).catch(() => ({ presets: [] })),
      ]);
    squads.teams.forEach((team) => state.teamsByName.set(team.team, team));
    state.formByTeam = form.player_form || {};
    state.profilesByTeam = profiles.teams || {};
    state.battingSlotsByTeam =
      battingSlots && typeof battingSlots === "object" && battingSlots.teams
        ? battingSlots.teams
        : {};
    state.cvPoolsBase = cvPools && typeof cvPools === "object" ? cvPools : { pools: {} };
    state.generatorTuningPresets = Array.isArray(tuningPresetsFile?.presets)
      ? tuningPresetsFile.presets
      : [];
    state.cvPoolsEdited = loadCvPoolOverrides();
    ensureCvPoolsEditedShape();
    state.teamAbbreviations =
      abbrevData && typeof abbrevData === "object" && abbrevData.abbreviations
        ? abbrevData.abbreviations
        : {};
    loadStoredSelection();
    loadCandidateNames();

    const teamNames = Array.from(state.teamsByName.keys()).sort();
    hydrateTeamDropdowns(teamNames);
    populateTuningPresetSelect();
    bindEvents();
    openTab("generator");
    addSwapRuleRow();
    hydrateCandidateNamesInput();
    handleTeamChange();
    updateGeneratorModePanels();
    renderSelectedPlayers();
    renderPostMatchPlayerInputs();
    updateGeneratorAttemptsHint();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = "<p>Failed to load data files. Start local server from project root.</p>";
  }
}

/** Exposed for split_pool_impl.js */
window.state = state;
window.teamASelect = teamASelect;
window.teamBSelect = teamBSelect;
window.iplPickWeightedPoolSubset = pickWeightedPoolSubset;
window.iplGetRawProfileRole = getRawProfileRole;
window.iplIsRawBowlOrArProfile = isRawBowlOrArProfile;
window.iplMakeRowLookupByKey = makeRowLookupByKey;
window.iplIsValidGeneratedTeam = isValidGeneratedTeam;
window.iplExplainInvalidGeneratedTeam = explainInvalidGeneratedTeam;
window.iplChooseCaptainViceCaptain = chooseCaptainViceCaptain;
window.iplBuildLineupOnlyKey = buildLineupOnlyKey;
window.iplIsLineupInCooldown = isLineupInCooldown;
window.iplRecordAcceptedLineup = recordAcceptedLineup;
window.iplIncrementCvPairAcceptCounts = incrementCvPairAcceptCounts;
window.iplBuildTeamUniquenessKey = buildTeamUniquenessKey;
window.iplPoolPlayerKey = poolPlayerKey;
window.iplGetRoundRobinScenarioIndex = getRoundRobinScenarioIndex;
window.iplGetActiveHighScoringScenarioIds = getActiveHighScoringScenarioIds;
window.iplComputeBatFirstFullPoolTeamCount = computeBatFirstFullPoolTeamCount;
window.iplSanitizeBatReducedExcludeIds = sanitizeBatReducedExcludeIds;
window.iplSanitizeBatFirstLineupDupStages = sanitizeBatFirstLineupDupStages;
window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES = DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES;
window.SPLIT_POOL_PROFILE_IDS = SPLIT_POOL_PROFILE_IDS;
window.DEFAULT_GENERATOR_TUNING = DEFAULT_GENERATOR_TUNING;
window.ATTEMPTS_MULTIPLIER = ATTEMPTS_MULTIPLIER;
window.HIGH_SCORING_MIN_QUOTA_FRAC = HIGH_SCORING_MIN_QUOTA_FRAC;

init();
