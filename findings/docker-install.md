Task
- Docker Compose packaging for Supabase-backed install.

Script Path
- `scripts/validate-docker-install.ps1`

Inputs
- `docker-compose.yml`
- temporary sanitized `.env` values for container startup validation
- local Docker Engine

Output Location
- `runs/docker-install/2026-03-26T16-55-00Z.json`

Output Summary
- Docker images for `api` and `web` built successfully.
- `docker compose up --build -d` started both services successfully with a sanitized temporary `.env`.
- API health endpoint returned `{"ok":true}` on `http://localhost:8787/health`.
- Web app responded with HTTP `200` on `http://localhost:5173`.

Success (Yes/No)
- Yes

Errors
- Initial local validation hit a malformed developer `.env` line with whitespace in a variable name and a stale container occupying port `5173`. Both were handled outside the committed app code.

Reproducibility (Confirmed/Not Confirmed)
- Confirmed for image build and service startup using the validation script.

Notes
- This validation covers packaging and startup only. Supabase-backed application flows still require a real user project, valid keys, and the documented migrations.
