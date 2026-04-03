## Task
- Keep collection runs usable when individual lead crawl/upsert steps fail.

## Plan
- Confirm the current failure boundary in the per-lead crawl/upsert worker.
- Catch and log non-stop errors per lead so the rest of the run continues.
- Surface failed-lead counts in progress/completion messages and verify the API build.
