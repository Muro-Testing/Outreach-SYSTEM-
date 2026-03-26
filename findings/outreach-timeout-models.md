Task
- Reduce outreach-generation timeout risk while preserving email quality and adding explicit model choice.

Script Path
- Manual validation plus route smoke test through Docker Compose.

Inputs
- `apps/api/src/services/outreach.ts`
- `apps/api/src/routes/outreach.ts`
- `apps/web/src/App.tsx`
- `apps/web/nginx.conf`
- `apps/web/vite.config.ts`
- `.env.example`

Output Location
- `runs/outreach-timeout-models/2026-03-26T17-35-00Z.json`

Output Summary
- Outreach generation now supports `default`, `large`, `medium`, and `small` model choices from Step 3.
- Default outreach model is now dedicated and can be configured separately from the rest of the app.
- Per-lead Mistral calls now abort after a configurable timeout and fall back safely instead of hanging indefinitely.
- Docker nginx proxy timeouts were increased so long outreach requests do not hit the old gateway timeout as quickly.
- Build passed and the Docker stack rebuilt successfully.
- A no-credit smoke POST to `/api/outreach/generate` with `model=medium` returned a clean empty result for a dummy campaign UUID, confirming the new request contract and route wiring.

Success (Yes/No)
- Yes

Errors
- None in the final validation pass.

Reproducibility (Confirmed/Not Confirmed)
- Confirmed for build, Docker startup, and request-contract smoke testing.

Notes
- The smoke test intentionally used a dummy campaign UUID so it would not spend Mistral credits.
- Real outreach generation quality and speed now depend on the selected model and your configured `OUTREACH_MISTRAL_TIMEOUT_MS`.
