# Task

Persist outreach generation sessions so generated lead-email sets survive refresh and can be reopened and exported later without regenerating.

# Script Path

Validation commands:
- `npm run build`
- `npm test`
- `npx esbuild apps/web/src/App.tsx --format=esm --jsx=automatic --loader:.tsx=tsx --outfile=apps/web/src/App.js`

# Inputs

- Existing outreach generator route and Step 3 UI
- Supabase schema with `offers`, `lead_outreach`, `outreach_lists`, and `outreach_list_leads`

# Output Location

- `runs/outreach-history/2026-03-26T14-49-09Z.json`

# Output Summary

- Added `outreach_generations` and `outreach_generation_rows` tables for durable outreach history snapshots.
- `POST /api/outreach/generate` now saves a generation session and row snapshots before returning rows.
- Added `GET /api/outreach/history` and `GET /api/outreach/history/:id`.
- Step 3 now exposes saved history, can reopen a prior generation, and restores the last opened history after refresh.

# Success

Yes

# Errors

None during verification.

# Reproducibility

Confirmed

# Notes

- Existing `lead_outreach` remains in place as the latest-per-lead cache.
- The new history model preserves multiple generations for the same source and offer instead of overwriting them.
