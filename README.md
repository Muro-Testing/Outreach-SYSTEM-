# Outreach SYSTEM

Internal lead collection and enrichment system for manual outbound campaign runs.

## Quick Start

If you want to install the app on a new PC, follow this section first.

### 1. Install prerequisites

- Install `Git`
- Install `Docker Desktop`
- Start Docker Desktop before running the app

### 2. Download the repo

Option 1: clone with Git

```bash
git clone https://github.com/Muro-Testing/Outreach-SYSTEM-.git
cd Outreach-SYSTEM-
```

Option 2: download ZIP from GitHub

1. Open `https://github.com/Muro-Testing/Outreach-SYSTEM-`
2. Click `Code`
3. Click `Download ZIP`
4. Extract the ZIP
5. Open a terminal inside the extracted `Outreach-SYSTEM-` folder

### 3. Create Supabase

1. Go to `https://supabase.com`
2. Create a new project
3. Open your project settings
4. Copy:
   - `Project URL`
   - `service_role` key

### 4. Create `.env`

Copy `.env.example` to `.env`.

The file must stay in plain `KEY=value` format with no spaces around `=`.

Minimum required values:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
MISTRAL_API_KEY=your_mistral_api_key
```

### 5. Run Supabase migrations

Run these SQL files in the Supabase SQL editor in this exact order:

1. `supabase/migrations/20260313_phase1.sql`
2. `supabase/migrations/202603131510_phase1_enrichment.sql`
3. `supabase/migrations/20260320_outreach.sql`
4. `supabase/migrations/20260326_campaign_archive_and_lead_keywords.sql`
5. `supabase/migrations/20260326_outreach_history.sql`
6. `supabase/migrations/20260326_outreach_lists.sql`
7. `supabase/migrations/20260326_query_fingerprint.sql`
8. `supabase/migrations/20260326_search_queries.sql`

### 6. Start the app

```bash
docker compose up --build
```

After startup:
- Web app: `http://localhost:5173`
- API health: `http://localhost:8787/health`

### 7. Troubleshooting

- If Docker says the env file is invalid, check that `.env` uses `KEY=value` with no extra spaces.
- If the web app opens but data does not load, verify `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the migration order above.
- If startup fails because a port is busy, free ports `5173` and `8787` or change the mapped ports in `docker-compose.yml`.

Phase 1 focuses on a local-first internal workflow:
- create a campaign
- run collection against selected sources
- watch run activity live
- save leads into Supabase
- enrich saved leads
- review/export leads from the web app

## What It Does

Outreach SYSTEM gives you a simple operator UI for running lead collection jobs without wiring together APIs by hand.

Current Phase 1 capabilities:
- create campaigns with keywords, sub-niche, location, and offer context
- run manual collection jobs against Google, Yelp, and Apify toggles
- track run status, progress counters, and chronological activity events
- save leads, source payloads, run errors, and run metrics in Supabase
- enrich saved leads with extra summary/email discovery
- filter and export leads from the web UI

## Stack

- Web: React 18 + Vite + TypeScript
- API: Node.js + Express + TypeScript
- Database: Supabase PostgreSQL
- Shared validation/contracts: Zod + TypeScript

## System Diagram

```text
+---------------------------+
| Internal Operator         |
| React Web App             |
| http://localhost:5173     |
+-------------+-------------+
              |
              | HTTP
              v
+-------------+-------------+
| Express API               |
| http://localhost:8787     |
| - campaigns routes        |
| - runs routes             |
| - leads routes            |
+------+------+-------------+
       |      |
       |      +--------------------------------------+
       |                                             |
       v                                             v
+------+----------------+             +--------------+------------------+
| Collection Pipeline   |             | Supabase PostgreSQL             |
| - Google adapter      |             | - campaigns                     |
| - Yelp adapter        |             | - collection_runs               |
| - Apify adapter       |             | - leads                         |
| - normalize           |             | - lead_sources                  |
| - enrich              |             | - run_errors                    |
+------+----------------+             +--------------+------------------+
       |
       | outbound requests
       v
+------+---------------------------------------------------------------+
| External Services                                                    |
| - Google Maps / Places APIs                                         |
| - Yelp API                                                          |
| - Apify actors                                                      |
| - Website crawling / enrichment providers configured in .env        |
+----------------------------------------------------------------------+
```

## Monorepo Layout

```text
Outreach-SYSTEM-/
├─ apps/
│  ├─ api/                 # Express API + collection pipeline
│  └─ web/                 # Internal operator UI
├─ packages/
│  └─ contracts/           # Shared Zod schemas and TS types
├─ supabase/
│  └─ migrations/          # SQL schema and enrichment migration
├─ .env.example
├─ package.json
└─ run-app.bat             # Windows launcher for API + web
```

## Core Flow

```text
1. Operator creates/selects a campaign in the web UI
2. Web app calls POST /api/campaigns/:id/run
3. API creates a queued run in collection_runs
4. Background collection starts:
   - fetch candidates from enabled sources
   - normalize and dedupe
   - save leads + lead_sources
   - enrich saved leads
   - write run activity into run_errors as info/error events
5. Web app polls run status and renders:
   - progress
   - counters
   - chronological activity feed
6. Operator reviews leads and exports CSV
```

## Requirements

- Node.js 22+ recommended for manual installs
- npm for manual installs
- Docker Desktop + Docker Compose for the recommended install path
- Supabase project with SQL access
- At least one source credential configured

## Environment Variables

Copy `.env.example` to `.env`.
Keep the file in plain `KEY=value` format with no spaces around `=`.

Required for the app to function:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Common source keys:
- `GOOGLE_MAPS_API_KEY`
- `YELP_API_KEY`
- `APIFY_TOKEN`

Other supported integration keys:
- `APIFY_ACTOR_ID`
- `APIFY_GOOGLE_MAPS_ACTOR_ID`
- `APIFY_YELP_ACTOR_ID`
- `APIFY_LINKEDIN_ACTOR_ID`
- `FIRECRAWL_API_KEY`
- `TAVILY_API_KEY`
- `MISTRAL_API_KEY`
- `MISTRAL_BASE_URL`
- `MISTRAL_MODEL`

Runtime configuration:
- `PORT` default `8787`
- `CORS_ORIGIN` default `http://localhost:5173`

## Database Setup

Run these SQL files in Supabase in this exact order:
- `supabase/migrations/20260313_phase1.sql`
- `supabase/migrations/202603131510_phase1_enrichment.sql`
- `supabase/migrations/20260320_outreach.sql`
- `supabase/migrations/20260326_campaign_archive_and_lead_keywords.sql`
- `supabase/migrations/20260326_outreach_history.sql`
- `supabase/migrations/20260326_outreach_lists.sql`
- `supabase/migrations/20260326_query_fingerprint.sql`
- `supabase/migrations/20260326_search_queries.sql`

Main tables created by Phase 1:
- `campaigns`
- `collection_runs`
- `leads`
- `lead_sources`
- `run_errors`

## Recommended Install: Docker Compose

This is the easiest way to send the app to another person.

### Friend Setup Checklist

1. Create a free Supabase project at https://supabase.com
2. In Supabase, copy:
   - Project URL -> `SUPABASE_URL`
   - Service role key -> `SUPABASE_SERVICE_ROLE_KEY`
3. Create a `.env` file from `.env.example`
4. Add the minimum required keys:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_MAPS_API_KEY`
   - `MISTRAL_API_KEY`
5. Run every SQL migration listed in the `Database Setup` section inside the Supabase SQL editor
6. Start the app:

```bash
docker compose up --build
```

After startup:
- Web app: `http://localhost:5173`
- API health: `http://localhost:8787/health`

The Docker setup keeps Supabase external. Docker runs only the app services.

## Manual Install

If you do not want Docker, the existing manual path still works.

```bash
npm install
```

## Run Locally

### Option 1: Windows launcher

From the repo root:

```bat
run-app.bat
```

This opens two terminal windows:
- API on `http://localhost:8787`
- Web on `http://localhost:5173`

### Option 2: Start services manually

API:

```bash
npm run dev:api
```

Web:

```bash
npm run dev:web
```

## Docker Troubleshooting

### The containers start but the app cannot load campaigns or leads

Check:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- all migrations were applied in Supabase

### The web app loads but API calls fail

Check:
- `http://localhost:8787/health`
- Docker Compose logs for the `api` service
- required keys exist in `.env`

### The API container starts but Google or Mistral features fail

Check:
- `GOOGLE_MAPS_API_KEY`
- `MISTRAL_API_KEY`
- any provider-specific billing, model, or permission issues

### Browser shows CORS or bad API base URL issues

The Docker web container proxies `/api` and `/health` to the API container. If you changed ports or hostnames, update:
- `docker-compose.yml`
- `apps/web/nginx.conf`
- `CORS_ORIGIN` in `.env` if needed

## Build

```bash
npm run build
```

## Test

API tests:

```bash
npm run test
```

Current automated coverage includes:
- normalization rules
- summary generation
- Google adapter primary/fallback request paths

## Main API Routes

Campaigns:
- `GET /api/campaigns`
- `POST /api/campaigns`
- `GET /api/campaigns/:id/latest-run`
- `POST /api/campaigns/:id/run`

Runs:
- `GET /api/runs/:id`

Leads:
- `GET /api/leads`

Health:
- `GET /health`

## Web UI Features

The current operator UI supports:
- campaign creation
- campaign selection
- source toggles
- target lead count
- live run activity feed
- progress counters
- table filters
- CSV export
- expandable summaries

## Run Activity Behavior

During active runs the UI shows:
- run status
- progress counters
- latest live status line
- chronological activity entries such as:
  - run start
  - per-source target
  - source fetch start
  - source fetch complete
  - save progress
  - enrichment progress
  - completion

Info events are stored in `run_errors` with an `[info]` prefix and rendered in the UI as neutral activity entries. Actual failures remain visible as errors.

## Source Notes

### Google

The Google adapter uses the current Places Text Search path first and falls back to the legacy search endpoint when needed.

### Yelp

Yelp is supported behind its own API key and source toggle.

### Apify

Apify support is available through configured actors and token-based access.

## Troubleshooting

### The web app starts but no runs work

Check:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- database migrations applied

### Google returns no leads

Check:
- `GOOGLE_MAPS_API_KEY`
- Google billing
- API restrictions
- Places/Text Search permissions on the project

### The UI stays at 0% for a while

This can happen during long source-fetch phases before total candidates are finalized. The activity feed should still show live steps while the run is active.

### API port is already in use

The API startup tries to free the configured Windows port automatically before listening.

## Phase 1 Scope

Included in Phase 1:
- internal operator UI
- manual campaign execution
- Supabase persistence
- Google/Yelp/Apify source plumbing
- live run monitoring
- lead enrichment pass
- CSV export

Not yet included:
- auth/roles
- automated scheduling
- production deployment config
- multi-user audit features
- advanced campaign automation

## Developer Notes

- The API and web app both consume the same shared contract package.
- The web app talks to the API via `VITE_API_BASE_URL`, defaulting to `/api`.
- Local Vite dev proxies `/api` and `/health` to `http://localhost:8787`.
- Docker Compose serves the frontend through nginx and proxies API traffic to the API container.
- The committed project also includes generated `.js` files alongside `.ts/.tsx` source in the web app.

## Current Status

Phase 1 is functional as a manual lead collection and review system and is ready for operator testing and validation.
