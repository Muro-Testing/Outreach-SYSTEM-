# Task

Legacy lead keyword backfill

# Script Path

`scripts/backfill-lead-keywords.ts`

# Inputs

- Existing `lead_sources` rows with `source_name = google` and `matched_keyword is null`
- Historical `search_queries` per run
- Campaign `niche_keywords`

# Output Location

- `runs/lead-keyword-backfill/2026-03-26T13-18-00Z.json`

# Output Summary

- Scanned 164 legacy Google lead source rows with null `matched_keyword`
- No rows could be assigned a single exact keyword safely from run history or single-keyword campaigns
- Remaining ambiguous rows stay null in DB, but the API now falls back to campaign keywords for display/filtering so legacy leads still show keyword chips immediately

# Success (Yes/No)

Yes

# Errors

None during script execution

# Reproducibility (Confirmed/Not Confirmed)

Confirmed

# Notes

- This is intentionally conservative; ambiguous multi-keyword legacy rows are not force-assigned an arbitrary exact keyword
- Run artifact: `runs/lead-keyword-backfill/2026-03-26T13-18-00Z.json`
