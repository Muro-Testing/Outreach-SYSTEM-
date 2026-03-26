# Task

Global leads catalog + campaign archive

# Script Path

`scripts/validate-global-leads.ts`

# Inputs

- Sample deduped leads
- Sample lead source rows with exact Google matched keywords
- Search checks for keyword/text/location behavior

# Output Location

- `runs/global-leads/2026-03-26T13-13-00Z.json`

# Output Summary

- Aggregation preserved multiple matched keywords for one lead
- Campaign provenance included both active and archived campaigns
- Business text and location matching returned the expected lead IDs

# Success (Yes/No)

Yes

# Errors

None during validation script execution

# Reproducibility (Confirmed/Not Confirmed)

Confirmed

# Notes

- API tests and full workspace builds also passed after implementation
- This validation covers the pure aggregation/filter behavior behind the new all-leads view
