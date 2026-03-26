# Task

Speed up large collection runs, explain the visible count mismatch between enrichment and current campaign leads, and revise outreach generation to follow the provided email standards.

# Script Path

Validation commands:
- `npm run build`
- `npm test`

# Inputs

- `findings/email-standarts.md`
- Existing collection runner and outreach generation services

# Output Location

- `runs/crawl-optimization-and-email-standards/2026-03-26T15-44-52Z.json`

# Output Summary

- Parallelized candidate crawl/upsert work in the collection runner.
- Reused crawl results between email discovery and later enrichment to avoid crawling the same site twice.
- Deduplicated enrichment jobs by canonical lead ID so progress and enrichment status reflect unique leads rather than repeated source hits.
- Revised outreach prompts and fallbacks toward plain-text, short, company-addressed cold emails with no invented first-name placeholders.

# Success

Yes

# Errors

None during verification.

# Reproducibility

Confirmed

# Notes

- The earlier count mismatch came from the run log counting enrichment jobs, while the lead table shows unique canonical leads.
- The new progress and enrichment messages are now based on unique lead IDs, which should better match what the user sees in the campaign lead table for future runs.
