-- Admin RPC and read-model tests.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner1@test.local', '{"account_type":"owner","full_name":"Owner One"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'paolo.lim@test.local', '{"full_name":"Paolo  Lim"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'plim.vsu@test.local', '{"full_name":"paolo lim"}');
insert into public.listings (id, name, address, accommodation_type, monthly_rental_label, rent_exact, owner_id, status)
values
  ('20000000-0000-0000-0000-000000000001', 'Love Joys BH', 'Guadalupe, Baybay', 'Boarding house', '', 3200, '00000000-0000-0000-0000-0000000000c1', 'in_review'),
  ('20000000-0000-0000-0000-000000000002', 'Love Joys Annex', 'Guadalupe, Baybay', 'Boarding house', '', 2500, '00000000-0000-0000-0000-0000000000c1', 'published'),
  ('20000000-0000-0000-0000-000000000003', 'Sunrise Dorm', 'Marcos, Baybay', 'Dormitory', '', 900, null, 'published');
insert into public.listing_photos (listing_id, storage_path, sort_order) values
  ('20000000-0000-0000-0000-000000000002', 'owner/a.jpg', 1),
  ('20000000-0000-0000-0000-000000000002', 'owner/b.jpg', 0);
insert into public.saved_listings (user_id, accommodation_id) values
  ('00000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-000000000003');

-- Non-admins are refused everywhere
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select tests.expect_error($$select public.admin_overview()$$, '%Admins only%');
select tests.expect_error($$select * from public.admin_users()$$, '%Admins only%');
select tests.expect_error($$select public.admin_set_role('00000000-0000-0000-0000-0000000000c1', 'admin')$$, '%Admins only%');
select tests.expect_error($$select * from public.similar_listings('20000000-0000-0000-0000-000000000001')$$, '%Admins only%');
-- listing_rows respects RLS: owner sees own in-review + all published
select tests.expect_count($$select count(*) from public.listing_rows where id::text like '20000000%'$$, 3, 'owner listing_rows');
select tests.expect_count($$select count(*) from public.listing_rows where id = '20000000-0000-0000-0000-000000000002' and photo_count = 2 and cover_path = 'owner/b.jpg' and owner_name = 'Owner One' and area = 'Guadalupe'$$, 1, 'listing_rows fields');
select public.touch_last_active();
reset role;
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000c1' and last_active_at is not null$$, 1, 'last active recorded');

select tests.logout();
set local role anon;
select tests.expect_count($$select count(*) from public.listing_rows where id::text like '20000000%'$$, 2, 'anon listing_rows published only');
reset role;

-- Admin overview numbers
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
create temp table overview as select public.admin_overview() as o;
select tests.expect_count($$select (o #>> '{listings,in_review}')::bigint from overview$$, 1, 'in review count');
select tests.expect_count($$select (o #>> '{listings,published}')::bigint from overview$$, 6, 'published count (4 fixture + 2)');
select tests.expect_count($$select (o #>> '{price_bands,under_1000}')::bigint from overview$$, 2, 'band distribution');
select tests.expect_count($$select (o #>> '{users,possible_duplicates}')::bigint from overview$$, 2, 'duplicate accounts');
select tests.expect_count($$select (o #>> '{users,admins}')::bigint from overview$$, 1, 'admin count');

-- Users page: search, tabs, duplicate flag, pagination total
select tests.expect_count($$select count(*) from public.admin_users('paolo') where possible_duplicate$$, 2, 'duplicate flag');
select tests.expect_count($$select max(total_count) from public.admin_users(null, 'all', 'newest', 0, 2)$$, 6, 'total count across pages');
select tests.expect_count($$select count(*) from public.admin_users(null, 'all', 'newest', 0, 2)$$, 2, 'page size');
select tests.expect_count($$select count(*) from public.admin_users(null, 'owner')$$, 1, 'owner tab');

-- Role and active changes are guarded and logged
select tests.expect_error($$select public.admin_set_role('00000000-0000-0000-0000-00000000000a', 'student')$$, '%own admin role%');
select tests.expect_error($$select public.admin_set_active('00000000-0000-0000-0000-00000000000a', false)$$, '%own account%');
select public.admin_set_role('00000000-0000-0000-0000-0000000000b1', 'owner');
select public.admin_set_active('00000000-0000-0000-0000-0000000000b2', false);
select tests.expect_count($$select count(*) from public.activity_log where action in ('user.role_changed', 'user.deactivated')$$, 2, 'changes logged');

-- Merge moves saved listings without duplicates and deactivates the copy
select public.admin_merge_users('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');
reset role;
select tests.logout();
-- saved_listings is private to each student, so check as the service context
select tests.expect_count($$select count(*) from public.saved_listings where user_id = '00000000-0000-0000-0000-0000000000d1'$$, 2, 'saved listings merged');
select tests.expect_count($$select count(*) from public.saved_listings where user_id = '00000000-0000-0000-0000-0000000000d2'$$, 0, 'duplicate has nothing left');
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select tests.expect_count($$select count(*) from public.profiles where id = '00000000-0000-0000-0000-0000000000d2' and not is_active and merged_into = '00000000-0000-0000-0000-0000000000d1'$$, 1, 'duplicate deactivated');
select tests.expect_count($$select count(*) from public.admin_users('paolo') where possible_duplicate$$, 0, 'flag cleared after merge');
select tests.expect_error($$select public.admin_merge_users('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')$$, '%already merged%');

-- Similar listings: same owner + area, and similar names
select tests.expect_count($$select count(*) from public.similar_listings('20000000-0000-0000-0000-000000000001') where id = '20000000-0000-0000-0000-000000000002' and reason = 'same_owner_and_area'$$, 1, 'same owner and area');
select tests.expect_count($$select count(*) from public.similar_listings('20000000-0000-0000-0000-000000000001') where id = '20000000-0000-0000-0000-000000000003'$$, 0, 'unrelated listing not flagged');
reset role;

rollback;
