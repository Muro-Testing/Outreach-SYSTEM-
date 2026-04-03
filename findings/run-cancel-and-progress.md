# Findings: Collection Run Stop And Progress Visibility

## Task
Add a way to stop queued/running collection runs and expose much more granular live progress during lead collection so stalled stages are visible.

## Script Path
No standalone validation script. Verified through package builds, Docker rebuild, and a live stop request against an active run.

## Inputs
- Active collection run ID: `3a83952f-c7ce-4208-8cb0-7b4a2a1193cc`
- Existing collection pipeline with Google keyword expansion and website crawling

## Output Location
- API routes:
  - `POST /api/runs/:id/cancel`
  - `GET /api/runs/:id` now returns a larger event history window
- Web UI:
  - Run card stop button
  - Scrollable detailed run event list

## Output Summary
- Added a stop route that marks a queued/running run as stopped by user and returns the updated run payload.
- Collection pipeline now checks run status while it is working, so stop requests end the run instead of waiting for the whole pipeline to finish.
- Google adapter now emits per-keyword and per-prospect progress hooks.
- Google Places API and Place Details calls now have request timeouts so they cannot hang indefinitely without surfacing progress.
- Run event history size was increased so detailed progress remains visible in the UI.
- Run card now shows a dedicated stopped state when the latest run failure was user-requested.

## Success (Yes/No)
Yes

## Errors
- The already-running cleaning campaign could not resume with the new stop-aware code because rebuilding Docker restarts the API process. The run was explicitly stopped afterward through the new endpoint.

## Reproducibility (Confirmed / Not Confirmed)
Confirmed for build and stop flow.

## Notes
- Verified builds:
  - `npm run build -w @outreach/contracts`
  - `npm run build -w @outreach/api`
  - `npm run build -w @outreach/web`
- Verified Docker reload:
  - `docker compose up --build -d`
- Verified stop flow:
  - `POST /api/runs/3a83952f-c7ce-4208-8cb0-7b4a2a1193cc/cancel`
