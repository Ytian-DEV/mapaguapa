-- Index migration tests.
begin;
select tests.expect_count($$select count(*) from pg_indexes where schemaname = 'public'
  and indexname in ('reports_conversation_idx', 'reports_reporter_idx', 'reports_reported_user_idx')$$, 3, 'report lookup indexes exist');
rollback;
