alter table if exists campaigns
  drop constraint if exists campaigns_status_check;

alter table if exists campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'active', 'paused', 'archived'));

alter table if exists lead_sources
  add column if not exists matched_keyword text;

create index if not exists idx_lead_sources_campaign_id on lead_sources(campaign_id);
create index if not exists idx_lead_sources_lead_id on lead_sources(lead_id);
create index if not exists idx_lead_sources_matched_keyword on lead_sources(matched_keyword)
  where matched_keyword is not null;
