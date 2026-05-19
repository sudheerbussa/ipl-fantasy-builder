# IPL 2026 Fantasy Builder (Starter)

This project now has:

- `data/ipl2026_squads.json` - team squads
- `data/ipl2026_recent_form.json` - starter database for recent player form and probable XI tags
- `data/ipl2026_player_profiles.json` - static player categories and wicket-keeper flags
- `data/match_inputs/sample_match.json` - sample match input payload
- `data/screenshots/` - drop zone for scorecard screenshots you share later
- `scripts/update_recent_form.py` - ingestion script to update recent form DB
- `scripts/init_player_profiles.py` - initialize static player category profiles
- `scripts/apply_online_profile_verification.py` - apply source-backed role verification overrides
- `scripts/check_profile_role_conflicts.py` - resolve players appearing in multiple online role buckets
- `scripts/backtest_gl_portfolio.py` - backtest GL portfolio strategies (40/60/80 teams)
- `scripts/query_match_points.py` - query match points by date and team names
- `scripts/fetch_match_data_online.py` - fetch scorecard pages and extract embedded JSON blobs
- `scripts/normalize_fetched_match_data.py` - normalize fetched artifacts into structured scorecard rows
- `scripts/convert_scorecard_to_fantasy.py` - convert normalized scorecard stats to Dream11-like fantasy points
- `scripts/run_ingestion_pipeline.py` - single command orchestration (fetch -> normalize -> convert -> optional backtest)
- `data/online_role_overrides.json` - curated online role data used for verification
- `data/online_profile_verification_report.json` - verification coverage summary
- `web/` - basic UI to choose players from two selected teams

## Run the web app

From project root:

```bash
python3 -m http.server 8000
```

Open:

http://localhost:8000/web/

## Current UI features

- Select Team A and Team B
- View each squad (captain included)
- See static player role category (batsman, bowler, all_rounder, wicket_keeper, unknown)
- See static tags (death_bowler, wicket_taker, etc.) when assigned
- See wicket-keeper summary for both selected teams
- Pick players with checkboxes
- See recent form badge (`Avg FP`) where available
- See `Probable XI` tag where available
- Persist selected players in browser local storage

## Build static categories once

```bash
python3 scripts/init_player_profiles.py
```

This creates/refreshes:

- `data/ipl2026_player_profiles.json`

Profile assignment logic:

- Known players with manual mapping -> fixed role/tags
- Remaining players -> auto inferred from `data/ipl2026_recent_form.json`
- If a player has no form data yet, fallback role is `batsman` with `auto_inferred` tag

## Verify/update profiles from online sources

```bash
python3 scripts/apply_online_profile_verification.py
```

This will:

- apply verified role overrides from `data/online_role_overrides.json`
- update matching players in `data/ipl2026_player_profiles.json`
- write summary report to `data/online_profile_verification_report.json`

## Resolve role conflicts before verification

```bash
python3 scripts/check_profile_role_conflicts.py
```

This will:

- detect players present in multiple role buckets in `data/online_role_overrides.json`
- resolve with precedence: `wicket_keeper > all_rounder > bowler > batsman`
- write audit report to `data/online_role_conflicts_report.json`

## GL Backtest (Dream11-oriented)

Historical files folder:

- `data/historical_matches/`
- `data/raw_scorecards/` (raw fetched artifacts)

Each match JSON should include:

- `match_id`, `date`, `team_a`, `team_b`
- `player_stats` entries with at least:
  - `team`, `player`, `fantasy_points`
  - optional: `runs`, `wickets`

Run 40-team backtest:

```bash
python3 scripts/backtest_gl_portfolio.py --num-teams 40
```

Output:

- `data/backtest_report.json`

Strategy (GL backtest script labels portfolios as `high_scoring_games`; see `docs/team_generation_strategy_guide.md` for the full app generator).

## Query one match by date and teams

```bash
python3 scripts/query_match_points.py --date 2026-04-14 --team-a "Chennai Super Kings" --team-b "Kolkata Knight Riders"
```

## Data ingestion note

- Live auto-fetch from web sources may be intermittent in this environment.
- Backtest system is ready now; once match-wise fantasy points are available in `data/historical_matches/`, it can evaluate strategy quality for 40+ GL teams.

## Online fetch mechanism

Fetch raw scorecard page and try extracting embedded data blobs:

```bash
python3 scripts/fetch_match_data_online.py --match-id IPL2026-021 --source cricbuzz --url "https://www.cricbuzz.com/live-cricket-scorecard/151752/srh-vs-rr-21st-match-ipl-2026"
```

This stores:

- `data/raw_scorecards/<match_id>__<source>.html`
- `data/raw_scorecards/<match_id>__<source>__blobs.json`
- `data/raw_scorecards/<match_id>__<source>__meta.json`

Normalize fetched artifacts:

```bash
python3 scripts/normalize_fetched_match_data.py --match-id IPL2026-021 --source cricbuzz --date 2026-04-13 --team-a "Sunrisers Hyderabad" --team-b "Rajasthan Royals"
```

Output:

- `data/normalized_scorecards/IPL2026-021.json`

## Convert normalized scorecard to fantasy points

Use template:

- `data/historical_matches/normalized_scorecard_template.json`

Convert to backtest-ready match file:

```bash
python3 scripts/convert_scorecard_to_fantasy.py --input data/normalized_scorecards/IPL2026-021.json --output data/historical_matches/IPL2026-021.json
```

Then re-run:

```bash
python3 scripts/backtest_gl_portfolio.py --num-teams 40
```

## One-command ingestion pipeline

```bash
python3 scripts/run_ingestion_pipeline.py \
  --match-id IPL2026-021 \
  --source cricbuzz \
  --url "https://www.cricbuzz.com/live-cricket-scorecard/151752/srh-vs-rr-21st-match-ipl-2026" \
  --date 2026-04-13 \
  --team-a "Sunrisers Hyderabad" \
  --team-b "Rajasthan Royals" \
  --run-backtest \
  --num-teams 40
```

## Next steps

- Add match-wise ingestion (scorecard to player points)
- Add role tags (BAT/BOWL/AR/WK)
- Add fantasy constraints (11 players, max per team, credits)
- Add captain/vice-captain optimization logic

## Ingest one completed match

Run from project root:

```bash
python3 scripts/update_recent_form.py --match-file data/match_inputs/sample_match.json
```

What this does:

- validates team/player names against `data/ipl2026_squads.json`
- appends a `match_history` entry
- increments `playing_xi_count`
- sets `probable_xi` (`true` once player appears in XI at least 2 times)
- updates rolling lists: `last_runs`, `last_wickets`, `last_fantasy_points`

After ingestion, refresh `http://localhost:8000/web/` to see updated badges in UI.

## Backfill all previous matches at once

1. Put one JSON file per completed match in `data/match_inputs/`.
2. Run bulk ingest:

```bash
python3 scripts/ingest_match_folder.py --skip-errors
```

Notes:

- Files are processed in filename order.
- `--skip-errors` continues even if one match file fails validation.
- Duplicate `match_id` will be skipped as failure (safe against double-ingestion).

## Screenshot workflow (for later)

- Put scorecard screenshots into `data/screenshots/`.
- I will convert them into structured JSON files in `data/match_inputs/`.
- Then run bulk ingest to update `data/ipl2026_recent_form.json`.

Important fixture note:

- The same two teams can play more than once in league stage.
- This is fully supported because each match uses a unique `match_id`.
