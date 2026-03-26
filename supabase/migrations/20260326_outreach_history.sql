create table if not exists outreach_generations (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('campaign', 'list')),
  campaign_id uuid references campaigns(id) on delete set null,
  list_id uuid references outreach_lists(id) on delete set null,
  offer_id uuid not null references offers(id) on delete cascade,
  generated_count integer not null default 0,
  model_version text not null default '',
  created_at timestamptz not null default now(),
  check (
    (source_type = 'campaign' and campaign_id is not null and list_id is null)
    or
    (source_type = 'list' and list_id is not null and campaign_id is null)
  )
);

create index if not exists idx_outreach_generations_offer_created
  on outreach_generations(offer_id, created_at desc);

create index if not exists idx_outreach_generations_campaign_created
  on outreach_generations(campaign_id, created_at desc)
  where campaign_id is not null;

create index if not exists idx_outreach_generations_list_created
  on outreach_generations(list_id, created_at desc)
  where list_id is not null;

create table if not exists outreach_generation_rows (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references outreach_generations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  offer_id uuid not null references offers(id) on delete cascade,
  name text not null default '',
  email text,
  phone text,
  website text,
  location_text text,
  opener_subject text not null default '',
  opener_body text not null default '',
  followup1_subject text not null default '',
  followup1_body text not null default '',
  followup2_subject text not null default '',
  followup2_body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_outreach_generation_rows_generation_id
  on outreach_generation_rows(generation_id);
