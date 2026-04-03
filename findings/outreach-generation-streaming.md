## Task
- Upgrade outreach generation to stream progress and rows during generation.

## Script Path
- N/A. Existing API route and web UI refactor in `apps/api/src/routes/outreach.ts`, `apps/api/src/services/outreach.ts`, and `apps/web/src/App.tsx`.

## Inputs
- Outreach source leads from a campaign or outreach list.
- Offer selection and model selection.
- Existing cached `lead_outreach` rows for the same `lead_id + offer_id`.

## Output Location
- Streamed API events from `/api/outreach/generate`.
- Incremental UI updates in the Outreach Generator table and banner.

## Output Summary
- `Generate Emails` now streams `start`, `progress`, `row`, and `done` events.
- Reused cached rows appear immediately.
- Newly generated rows are persisted and emitted as they complete.
- The UI now shows processed, new, reused, and failed counts while generation is running.

## Success (Yes/No)
- Yes

## Errors
- No build errors after implementation.

## Reproducibility (Confirmed/Not Confirmed)
- Confirmed

## Notes
- Verified with `npm run build -w @outreach/api` and `npm run build -w @outreach/web`.
- Docker rebuilt with `docker compose up --build -d`.
