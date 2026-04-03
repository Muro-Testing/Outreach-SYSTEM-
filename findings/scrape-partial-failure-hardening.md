## Task
- Keep collection runs moving when individual lead crawl/upsert steps fail.

## Script Path
- N/A. Existing API pipeline hardening in `apps/api/src/services/collection.ts`.

## Inputs
- Collection run candidates from Google, Yelp, and Apify.
- Per-lead crawl, dedupe, insert/update, and `lead_sources` writes.

## Output Location
- Runtime events and errors in `collection_runs` / `run_errors`.

## Output Summary
- Added per-lead failure isolation around the crawl/upsert worker.
- Non-stop lead errors now log against the lead source and produce an info event that the lead was skipped.
- Progress and completion messages now include skipped-lead counts.

## Success (Yes/No)
- Yes

## Errors
- No build errors.

## Reproducibility (Confirmed/Not Confirmed)
- Confirmed

## Notes
- Verified with `npm run build -w @outreach/api`.
- Rebuilt the Docker app with `docker compose up --build -d`.
- This hardens lead-level failures; it does not change source-level behavior, which already used `Promise.allSettled`.
