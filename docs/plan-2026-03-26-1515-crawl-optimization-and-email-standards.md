# Crawl Optimization And Email Standards Plan

Date: 2026-03-26 15:15

Task: Speed up collection crawling, align run status numbers with visible lead counts, and revise outreach generation to match the documented email standards.

Checklist:
- [x] Parallelize the lead crawl/upsert stage so large runs do not process candidates one by one.
- [x] Deduplicate enrichment work and reporting by canonical lead ID so run status is closer to what the user sees in the lead table.
- [x] Update outreach generation prompts and fallback copy to favor plain-text, short, personal company-level emails.
- [x] Verify with build/tests and save execution artifacts.
