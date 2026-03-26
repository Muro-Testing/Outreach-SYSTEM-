# Outreach Timeout + Model Selection Plan

- Add a dedicated outreach model option to the request contract and Step 3 UI.
- Default outreach generation to a medium-quality Mistral model without changing other AI flows.
- Add per-request timeout guards and safe fallback behavior in outreach generation.
- Increase Docker nginx proxy timeouts for long-running outreach requests.
- Update local env/example docs for the new outreach model and timeout settings.
- Rebuild checked-in JS mirrors and validate with build plus Docker route checks.
