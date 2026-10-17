-- Cleanup migration tests.
begin;

select tests.expect_count($$select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname in ('user_role', 'listing_status')$$, 0, 'v1 enum types are dropped');

-- A cached v1 client can still sign up: 'user' is stored as 'student'.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'legacy@test.local', '{"full_name":"Legacy Client"}');
update public.profiles set role = 'user' where id = '00000000-0000-0000-0000-0000000000d1';
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d1' and role = 'student'$$, 1, 'legacy role is normalised');
select tests.expect_error($$update public.profiles set role = 'superuser' where id = '00000000-0000-0000-0000-0000000000d1'$$, '%profiles_role_check%');

rollback;
