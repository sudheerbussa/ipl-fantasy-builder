#!/usr/bin/env node
/**
 * Headless C4 XI build dry-run against localhost web app (needs http.server on :8000).
 * Usage: node scripts/debug_c4_build.mjs
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import http from "http";
import vm from "vm";

const BASE = "http://127.0.0.1:8000/web";
const require = createRequire(import.meta.url);

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode !== 200) reject(new Error(`${url} ${res.statusCode}`));
          else resolve(data);
        });
      })
      .on("error", reject);
  });
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function makePoolRows(profiles, squads) {
  const rows = [];
  for (const [team, players] of Object.entries(profiles.teams || {})) {
    for (const player of Object.keys(players)) {
      const prof = players[player];
      const role = prof.is_wicket_keeper
        ? "wicket_keeper"
        : prof.primary_role === "bowler"
          ? "bowler"
          : prof.primary_role === "all_rounder"
            ? "all_rounder"
            : "batsman";
      rows.push({ team, player, role });
    }
  }
  return rows;
}

function pickIds(rows, team, n, filterFn) {
  return rows
    .filter((r) => r.team === team && filterFn(r))
    .slice(0, n)
    .map((r) => `${r.team}::${r.player}`);
}

async function main() {
  const [catalogJs, implJs] = await Promise.all([
    fetchText(`${BASE}/split_pool_catalog.js`),
    fetchText(`${BASE}/split_pool_impl.js`),
  ]);
  const profiles = loadJson(
    new URL("../data/ipl2026_player_profiles.json", import.meta.url).pathname
  );
  const pool = makePoolRows(profiles, {});
  const KKR = "Kolkata Knight Riders";
  const DC = "Delhi Capitals";

  const isBowlOrAr = (r) => r.role === "bowler" || r.role === "all_rounder";
  const isBat = (r) => r.role === "batsman" || r.role === "wicket_keeper";

  function disjointPools(team, p1n, p2n, p3n) {
    const used = new Set();
    const take = (n, filterFn) => {
      const ids = [];
      for (const r of pool) {
        if (r.team !== team || !filterFn(r)) continue;
        const id = `${r.team}::${r.player}`;
        if (used.has(id)) continue;
        used.add(id);
        ids.push(id);
        if (ids.length >= n) break;
      }
      return ids;
    };
    return {
      p1: take(p1n, isBat),
      p2: take(p2n, () => true),
      p3: take(p3n, isBowlOrAr),
    };
  }

  const sp = {
    teamA: disjointPools(KKR, 3, 4, 5),
    teamB: disjointPools(DC, 3, 4, 5),
  };

  const dom = { window: {}, document: { getElementById: () => null } };
  const ctx = {
    window: dom.window,
    document: dom.document,
    console,
    Math,
    Set,
    Map,
    Array,
    Object,
    JSON,
    parseInt,
    Number,
    String,
    Boolean,
    Error,
  };
  ctx.window = ctx.window;
  ctx.window.state = { splitPools: sp };
  ctx.window.teamASelect = { value: KKR };
  ctx.window.teamBSelect = { value: DC };
  ctx.window.DEFAULT_GENERATOR_TUNING = {};
  ctx.window.DEFAULT_SPLIT_POOL_LINEUP_DUP_STAGES = [0, 1, 2];
  ctx.window.iplPoolPlayerKey = (r) => `${r.team}::${r.player}`;
  ctx.window.iplMakeRowLookupByKey = (rows) => {
    const m = new Map();
    rows.forEach((r) => {
      m.set(ctx.window.iplPoolPlayerKey(r), r);
      if (r.team === KKR) {
        m.set(`KKR_ALT::${r.player}`, r);
      }
    });
    return m;
  };
  ctx.window.iplGetRawProfileRole = (team, player) => {
    const row = pool.find((r) => r.team === team && r.player === player);
    if (!row) return "batsman";
    if (row.role === "wicket_keeper") return "wicket_keeper";
    return row.role;
  };
  ctx.window.iplIsRawBowlOrArProfile = (team, player) => {
    const r = ctx.window.iplGetRawProfileRole(team, player);
    return r === "bowler" || r === "all_rounder";
  };
  ctx.window.iplPickWeightedPoolSubset = (rows, k) => {
    const copy = [...rows];
    const out = [];
    for (let i = 0; i < k && copy.length; i += 1) {
      const j = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(j, 1)[0]);
    }
    return out;
  };

  vm.createContext(ctx);
  vm.runInContext(catalogJs, ctx);
  vm.runInContext(implJs, ctx);

  function scenario(name, sp) {
    ctx.window.state.splitPools = sp;
    const ktr = ctx.window.iplMakeRowLookupByKey(pool);
    const d = ctx.window.IPL_SPLIT_POOL.diagnoseC4PoolBuild(ktr, {
      useReduced: false,
      excludeSet: new Set(),
    });
    console.log(
      `\n[${name}] cross=${d.crossPoolDuplicates} uniq=${d.uniqA}/${d.uniqB}`,
      d.pairResults
        .map((r) =>
          r.ok ? `${r.pair}:OK` : `${r.pair}:${r.error}@${r.fillSlot || "-"} len=${r.gotLen ?? "?"} hint=${r.hint || "-"}`
        )
        .join(" | ")
    );
  }

  scenario("disjoint 3+4+5", sp);
  scenario("P1/P2 same keys different ids", {
    teamA: {
      p1: ["Kolkata Knight Riders::Ajinkya Rahane", "Kolkata Knight Riders::Angkrish Raghuvanshi", "Kolkata Knight Riders::Manish Pandey"],
      p2: [
        "KKR_ALT::Ajinkya Rahane",
        "KKR_ALT::Angkrish Raghuvanshi",
        "KKR_ALT::Manish Pandey",
        "Kolkata Knight Riders::Rahul Tripathi",
      ],
      p3: disjointPools(KKR, 3, 4, 5).p3,
    },
    teamB: disjointPools(DC, 3, 4, 5),
  });

  scenario("P3 bats only", {
    teamA: {
      p1: disjointPools(KKR, 3, 4, 5).p1,
      p2: disjointPools(KKR, 3, 4, 5).p2,
      p3: pickIds(pool, KKR, 5, (r) => r.role === "batsman"),
    },
    teamB: {
      p1: disjointPools(DC, 3, 4, 5).p1,
      p2: disjointPools(DC, 3, 4, 5).p2,
      p3: pickIds(pool, DC, 5, (r) => r.role === "batsman"),
    },
  });

  const keyToRow = ctx.window.iplMakeRowLookupByKey(pool);
  const diag = ctx.window.IPL_SPLIT_POOL?.diagnoseC4PoolBuild?.(keyToRow, {
    useReduced: false,
    excludeSet: new Set(),
  });
  if (!diag) {
    console.error("IPL_SPLIT_POOL.diagnoseC4PoolBuild not available");
    process.exit(1);
  }
  const tries = 500;
  const errCounts = {};
  for (let i = 0; i < tries; i += 1) {
    const d = ctx.window.IPL_SPLIT_POOL.diagnoseC4PoolBuild(keyToRow, {
      useReduced: false,
      excludeSet: new Set(),
    });
    d.pairResults.forEach((r) => {
      const c = r.ok ? "ok" : r.error || "unknown";
      errCounts[c] = (errCounts[c] || 0) + 1;
    });
  }

  console.log("crossPoolDuplicates", diag.crossPoolDuplicates, "uniq", diag.uniqA, diag.uniqB);
  console.log(
    "preflight:",
    diag.pairResults.map((r) => `${r.pair}:${r.ok ? "OK" : r.error}`).join(" | ")
  );
  console.log(`random ${tries}×4 builds:`, errCounts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
