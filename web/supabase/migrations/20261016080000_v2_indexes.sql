-- MAPAGUAPA v2 — indexes for lookups the app and RLS actually make
-- * reports(conversation_id): the admin read policies on conversations and
--   messages run `exists (select 1 from reports where conversation_id = …)`
--   for every row an admin reads.
-- * reports(reporter_id): "reports: read own or admin" (reporter_id = auth.uid()).
-- * reports(reported_user_id): "N other reports about this person" on a report.
-- Other unindexed foreign keys are audit columns (created_by, reviewed_by, …)
-- that are only scanned when an account is deleted; indexing them would only
-- slow down writes. Requires migration 4. Safe to re-run.

create index if not exists reports_conversation_idx on public.reports(conversation_id) where conversation_id is not null;
create index if not exists reports_reporter_idx on public.reports(reporter_id, created_at desc);
create index if not exists reports_reported_user_idx on public.reports(reported_user_id) where reported_user_id is not null;
