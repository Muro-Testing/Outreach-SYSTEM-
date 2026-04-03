## Task
- Prevent Google keyword fetches from blocking the whole run and save completed keyword work immediately.

## Script Path
- N/A. Existing API pipeline refactor in `apps/api/src/adapters/google.ts` and `apps/api/src/services/collection.ts`.

## Inputs
- Google keyword list for a collection run.
- Google text search and place-details calls.
- Existing website crawl, dedupe, insert/update, and enrichment pipeline.

## Output Location
- Runtime progress in `collection_runs` and `run_errors`.

## Output Summary
- Added a Google-fetch-stage deadline per keyword.
- If Google retrieval for a keyword exceeds the deadline, the keyword is logged, skipped, and the run continues.
- Completed Google keywords are now processed and persisted immediately instead of waiting for the whole Google source task to finish.
- Website crawl and email extraction now happen after the Google stage, which matches the desired timeout boundary.

## Success (Yes/No)
- Yes

## Errors
- Initial API build failed because tests still referenced `fetchGoogleLeads`; restored a compatibility wrapper and rebuilt successfully.

## Reproducibility (Confirmed/Not Confirmed)
- Confirmed

## Notes
- Verified with `npm run build -w @outreach/api`.
- Rebuilt the Docker app with `docker compose up --build -d`.
- Current Google fetch-stage timeout is `120000` ms in `collection.ts`.
