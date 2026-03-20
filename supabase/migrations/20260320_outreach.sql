-- Offers: structured offer library
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  offer_name text not null,
  offer_summary text not null,
  target_problem text not null,
  key_outcome text not null,
  call_to_action text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lead outreach: generated emails per lead+offer pair
create table if not exists lead_outreach (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  offer_id uuid not null references offers(id) on delete cascade,
  opener_subject text not null default '',
  opener_body text not null default '',
  followup1_subject text not null default '',
  followup1_body text not null default '',
  followup2_subject text not null default '',
  followup2_body text not null default '',
  style_tone text not null default 'friendly-professional',
  model_version text not null default '',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, offer_id)
);
