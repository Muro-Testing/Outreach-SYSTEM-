# Outreach History Plan

Date: 2026-03-26 18:25

Task: Persist outreach generation sessions so generated lead-email sets survive refresh and can be reopened and exported without regenerating.

Checklist:
- [x] Add database tables for outreach generation history and row snapshots.
- [x] Extend shared contracts with history summary/detail types.
- [x] Update API generation flow to save a generation session and its rows.
- [x] Add API endpoints to list saved history and load a specific generation.
- [x] Update Step 3 UI to show saved history, reload a generation, and preserve export behavior.
- [x] Verify with build/tests and regenerate checked-in JS mirrors.
