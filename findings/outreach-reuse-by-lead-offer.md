# Findings: Outreach Reuse By Lead And Offer

## Task
Reuse already-generated outreach emails when the same `lead_id + offer_id` pair is requested again, so repeated generation across outreach lists or campaigns does not spend tokens unnecessarily.

## Script Path
No standalone validation script. Verified through workspace builds and Docker rebuild.

## Inputs
- Lead source: campaign or outreach list
- Offer ID
- Existing `lead_outreach` rows keyed by `(lead_id, offer_id)`

## Output Location
- API route: `POST /api/outreach/generate`
- Web UI: generation summary after successful outreach generation

## Output Summary
- The generation route now loads cached `lead_outreach` rows for the requested offer before calling the model.
- Only leads missing a cached row are sent to `generateEmailsForLeads(...)`.
- The saved batch history still contains all selected leads, whether reused or newly generated.
- New response metadata:
  - `generated`: total leads in the returned batch
  - `generatedNew`: leads that required fresh generation
  - `reusedExisting`: leads served from cached `lead_outreach`
- The web UI now shows whether a batch generated new emails, reused existing ones, or both.

## Success (Yes/No)
Yes

## Errors
- None during build.

## Reproducibility (Confirmed / Not Confirmed)
Confirmed for build and deploy. Runtime reuse behavior will activate automatically whenever matching cached rows exist.

## Notes
- Cached rows are matched strictly by `lead_id + offer_id`.
- Reused rows are not re-upserted; existing cache entries remain unchanged.
- Batch history entries still save the full row set so exports and reopen-from-history continue to work.
