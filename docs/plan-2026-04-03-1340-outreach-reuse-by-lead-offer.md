# Plan: Outreach Reuse By Lead And Offer

- [ ] Inspect current outreach generation flow and identify the best cache-reuse point.
- [ ] Reuse existing `lead_outreach` rows for matching `lead_id + offer_id` pairs during generation.
- [ ] Preserve full saved history/export behavior for mixed reused and newly generated batches.
- [ ] Update the web UI response handling if extra reuse metadata is returned.
- [ ] Build, rebuild Docker, and verify the updated generation flow.
