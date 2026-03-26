-- Add query fingerprint to collection_runs for deduplication
alter table collection_runs add column if not exists query_fingerprint text;

create index if not exists idx_runs_query_fingerprint
  on collection_runs(query_fingerprint)
  where status = 'completed';
