Task
- Add spreadsheet export options and webhook file delivery for generated outreach in Step 3.

Script Path
- Manual validation plus live Docker webhook smoke test.

Inputs
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/api/src/routes/outreach.ts`
- `apps/web/package.json`
- `apps/api/package.json`

Output Location
- `runs/outreach-export-webhook/2026-03-26T17-58-00Z.json`

Output Summary
- Step 3 now supports `CSV (Google Sheets)` and native `Excel (.xlsx)` export for generated outreach rows.
- A webhook URL field and send action were added to the bottom of Step 3.
- Webhook delivery is proxied through the API and sends the selected file as multipart form-data.
- Shared `xlsx` support was added to the web and API workspaces.
- Full app build passed.
- Docker was rebuilt successfully.
- A live dummy CSV was sent through `/api/outreach/export-webhook` to `https://httpbin.org/post` and returned `200`.

Success (Yes/No)
- Yes

Errors
- None in the final validation pass.

Reproducibility (Confirmed/Not Confirmed)
- Confirmed for build, Docker rebuild, and webhook smoke testing.

Notes
- The webhook smoke test used dummy CSV data, not real outreach rows.
- CSV is the Google Sheets-friendly option; `.xlsx` is the Excel-native option.
