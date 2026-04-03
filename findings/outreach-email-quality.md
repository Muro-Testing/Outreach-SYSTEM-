# Findings: Outreach Email Quality — Prompt Fixes & Refine Feature

## Task
Fix known quality issues in generated outreach emails (em dashes, possessive company names, long names used verbatim, inconsistent formatting) and add a Refine feature so existing email batches can be polished without regenerating from scratch.

## Script Path
No validation script — changes applied directly to service and route layer. Validated via Docker rebuild and live UI test.

## Inputs
- Existing `outreach_generations` history entry ID
- Optional free-text instructions (e.g. "make tone warmer", "shorten follow-up 2")
- Model choice (default/large/medium/small)

## Output Location
- New `outreach_generations` row with `model_version = "refined:<model>"`
- New `outreach_generation_rows` rows for the new generation
- Upserted `lead_outreach` rows (latest emails per lead+offer)

## Output Summary

### shortName() fix
- Problem: "1st Class Window Systems Ltd" → stripped to "1st Class Window Systems" (4 words, still clumsy)
- Fix: if > 3 words after suffix strip, take first 2 words → "1st Class"
- Also strips leading "The" (e.g. "The Window Company" → "Window Company")
- New legal suffixes added: Group, Holdings, International, Solutions, Services, Technologies, Consultancy, Contractors, Associates

### Prompt fixes
- Em dashes and en dashes now explicitly banned in both system and user prompt with instruction to use comma or full stop
- Possessive `'s` after company name explicitly banned; user prompt injects the exact pattern to avoid (e.g. `Never write 1st Class's`)
- All three emails required to open with `Hi [biz] team,` on its own line
- Body structure spelled out per email type in user prompt

### Refine feature
- New `refineEmailsForLead()` function: sends existing emails + lead name to Mistral with editor-mode prompt
- Temperature 0.3 (vs 0.65 for generation) — stays conservative, does not rewrite
- Concurrency 8 per batch (vs 4–6 for generation) — refine is a lighter operation
- For 102 emails: ~13 batches vs ~25 previously, significantly faster
- SSE streaming: frontend receives real-time progress events as each batch completes
- Original history entry is always preserved — refine creates a new entry

## Success (Yes/No)
Yes

## Errors
- None on rebuild or at runtime
- LF→CRLF line ending warnings on Windows git push — cosmetic only, no functional impact

## Reproducibility (Confirmed / Not Confirmed)
Confirmed — deterministic at temperature 0.3; fallback returns original emails unchanged if Mistral is unavailable

## Notes
- The refine prompt instructs the model NOT to rewrite from scratch — only fix specific issues. This prevents over-editing and preserves the original business-specific content.
- If instructions field is left blank, only the hard rules are applied (em dashes, possessives, greeting format)
- If instructions are provided, they are appended as a separate block after the hard rules
- The `"refined:"` prefix in `model_version` is used by the frontend to label entries in the history dropdown
- Commit: `ff2026b` on `main` — `Muro-Testing/Outreach-SYSTEM-`
