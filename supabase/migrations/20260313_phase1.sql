create extension if not exists pgcrypto;

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  niche_keywords text[] not null,
  sub_niche text not null,
  location_scope text not null,
  offer_note text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists collection_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  total_candidates int not null default 0,
  inserted_count int not null default 0,
  updated_count int not null default 0,
  deduped_count int not null default 0,
  rejected_no_email_count int not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  last_run_id uuid references collection_runs(id) on delete set null,
  name text not null,
  email text not null,
  what_they_do_summary text,
  location_text text,
  phone text,
  website text,
  website_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_leads_website_domain
  on leads(website_domain)
  where website_domain is not null;

create table if not exists lead_sources (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  run_id uuid not null references collection_runs(id) on delete cascade,
  source_name text not null check (source_name in ('google', 'yelp', 'apify')),
  external_id text,
  external_url text,
  raw_payload_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists run_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references collection_runs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  source_name text not null,
  error_message text not null,
  error_detail text,
  retryable boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_collection_runs_campaign_created
  on collection_runs(campaign_id, created_at desc);

create index if not exists idx_leads_campaign_created
  on leads(campaign_id, created_at desc);

create index if not exists idx_leads_last_run
  on leads(last_run_id);

create index if not exists idx_leads_location_text
  on leads(location_text);

create index if not exists idx_run_errors_run_created
  on run_errors(run_id, created_at desc);
