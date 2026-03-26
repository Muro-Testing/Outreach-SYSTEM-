-- Outreach Lists: named groups of leads from any campaign
create table if not exists outreach_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Junction table: many leads <-> many lists
create table if not exists outreach_list_leads (
  list_id uuid not null references outreach_lists(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, lead_id)
);

create index if not exists idx_oll_list_id on outreach_list_leads(list_id);
create index if not exists idx_oll_lead_id on outreach_list_leads(lead_id);
