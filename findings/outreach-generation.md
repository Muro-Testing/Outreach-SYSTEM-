# Findings: Outreach Email Generation

## Task
Generate personalised outreach emails (opener + 2 follow-ups) for every lead in a selected campaign, using a structured offer from the Offer Library. Upsert results into `lead_outreach` table. Return and expose results for export.

## Script Path
`scripts/validate-outreach-generation.ts`

## Inputs
- `campaignId` — UUID of a campaign with at least 1 enriched lead
- `offerId` — UUID of a saved offer from the `offers` table

## Output Location
`runs/outreach-generation/<timestamp>.json`

## Output Summary
Each run file contains:
- `metadata` — script name, timestamp, inputs, API base
- `rawOutput` — full API response `{ generated: N, rows: [...] }`
- `success` — boolean
- `error` — null on success, error message on failure

Each `row` in the response contains:
- Lead fields: `lead_id`, `offer_id`, `name`, `email`, `phone`, `website`, `location_text`
- Email columns: `opener_subject`, `opener_body`, `followup1_subject`, `followup1_body`, `followup2_subject`, `followup2_body`

## Success (Yes/No)
Pending first run — execute validation script after DB migration and API restart.

## Errors
None logged yet. Potential failure points:
- DB tables `offers` and `lead_outreach` not yet created (run `supabase/migrations/20260320_outreach.sql`)
- Mistral API key not set → falls back to template emails (still succeeds)
- No leads in campaign → returns `{ generated: 0, rows: [] }` (not an error)

## Reproducibility (Confirmed / Not Confirmed)
Not yet confirmed — pending first execution.

## Notes
- Generation is synchronous in V1; for large campaigns (100+ leads), expect 20-60s with concurrency=5
- Overwrite policy: upsert on `(lead_id, offer_id)` unique constraint — re-running replaces previous emails
- Fallback templates are deterministic (no AI) — always reproducible when Mistral is unavailable
- Style: friendly-professional, pattern-interrupt subject/opening
- To run validation script:
  ```
  # 1. Start API server
  cd apps/api && npm run dev

  # 2. Get a valid campaignId and offerId from Supabase or the UI
  # 3. Run validation
  npx ts-node --esm scripts/validate-outreach-generation.ts <campaignId> <offerId>
  ```
