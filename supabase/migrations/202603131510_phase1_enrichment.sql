alter table if exists leads
  alter column email drop not null;

alter table if exists leads
  add column if not exists business_highlights text,
  add column if not exists crawl_pages_count int not null default 0,
  add column if not exists enrichment_status text not null default 'pending',
  add column if not exists last_enriched_at timestamptz;

alter table if exists leads
  add constraint leads_enrichment_status_check
  check (enrichment_status in ('pending', 'completed', 'failed', 'skipped'));

create index if not exists idx_leads_enrichment_status
  on leads(enrichment_status);
