# Outreach SYSTEM - Phase 1

Internal lead intelligence system for manual campaign runs.

## Stack
- Web: React + Vite + TypeScript
- API: Node + Express + TypeScript
- DB: Supabase PostgreSQL
- Shared contracts: Zod + TypeScript

## Monorepo layout
- `apps/web` - internal admin UI
- `apps/api` - collection pipeline + API
- `packages/contracts` - shared request/response schemas and types
- `supabase/migrations` - SQL schema

## Quick start
1. Copy `.env.example` to `.env` and set keys.
2. Run `npm install`.
3. Apply migration in Supabase SQL editor from `supabase/migrations/20260313_phase1.sql`.
4. Run API: `npm run dev -w @outreach/api`
5. Run web: `npm run dev -w @outreach/web`
