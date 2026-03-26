-- Log every keyword query made per collection run
create table if not exists search_queries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references collection_runs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  keyword text not null,
  location text not null,
  -- fingerprint of the original campaign intent (for duplicate detection)
  campaign_fingerprint text not null,
  -- how many raw candidates this keyword returned
  results_count int not null default 0,
  -- true = added by AI expansion, false = from original campaign keywords
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_sq_campaign_fingerprint
  on search_queries(campaign_fingerprint);

create index if not exists idx_sq_run_id
  on search_queries(run_id);
