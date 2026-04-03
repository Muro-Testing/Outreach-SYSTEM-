## Task
- Upgrade outreach email generation to a streaming model with visible progress and incremental rows.

## Plan
- Stream generation progress from the API instead of waiting for one blocking batch response.
- Persist reused and newly generated rows incrementally so the table can update while the run is in progress.
- Add a visible progress bar and counters in the web UI, then verify builds and rebuild Docker.
