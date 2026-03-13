# Outreach SYSTEM

Internal lead collection and enrichment system for manual outbound campaign runs.

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

- Node.js 22+ recommended
- npm
- Supabase project with SQL access
- At least one source credential configured

## Environment Variables

Copy `.env.example` to `.env`.

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

Apply the initial schema first:
- `supabase/migrations/20260313_phase1.sql`

Apply the enrichment migration after that:
- `supabase/migrations/202603131510_phase1_enrichment.sql`

Main tables created by Phase 1:
- `campaigns`
- `collection_runs`
- `leads`
- `lead_sources`
- `run_errors`

## Install

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
- The web app talks to the API via `VITE_API_BASE_URL`, defaulting to `http://localhost:8790` only if overridden in local env/build tooling.
- The committed project also includes generated `.js` files alongside `.ts/.tsx` source in the web app.

## Current Status

Phase 1 is functional as a manual lead collection and review system and is ready for operator testing and validation.
