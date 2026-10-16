-- Owner overview tests.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner1@test.local', '{"account_type":"owner","full_name":"Owner One"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'owner2@test.local', '{"account_type":"owner"}');
insert into public.listings (id, name, address, accommodation_type, monthly_rental_label, rent_exact, owner_id, status)
values
  ('20000000-0000-0000-0000-000000000001', 'Owner Place', 'Guadalupe', 'Boarding house', '', 2800, '00000000-0000-0000-0000-0000000000c1', 'published'),
  ('20000000-0000-0000-0000-000000000002', 'Owner Draft', 'Guadalupe', 'Boarding house', '', 2800, '00000000-0000-0000-0000-0000000000c1', 'draft');

select tests.expect_error($$update public.listings set draft_step = 9 where id = '20000000-0000-0000-0000-000000000002'$$, '%draft_step%');

-- Views: one per viewer per day; owners' own views and drafts don't count
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select public.record_listing_view('20000000-0000-0000-0000-000000000001');
select public.record_listing_view('20000000-0000-0000-0000-000000000001');
select public.record_listing_view('20000000-0000-0000-0000-000000000002');
create temp table convo as select public.start_conversation('20000000-0000-0000-0000-000000000001', 'Hi! Available?') as id;
grant all on convo to authenticated;
select tests.expect_count($$select count(*) from public.listing_views$$, 0, 'views are not readable directly');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
select public.record_listing_view('20000000-0000-0000-0000-000000000001');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select public.record_listing_view('20000000-0000-0000-0000-000000000001');
reset role;
select tests.logout();
insert into public.listing_views (listing_id, viewer_id, viewed_on) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', current_date - 40);
select tests.expect_count($$select count(*) from public.listing_views$$, 3, 'deduped views (2 today + 1 older)');

-- Owner reply after 2 hours
update public.messages set created_at = now() - interval '3 hours' where conversation_id = (select id from convo);
insert into public.messages (conversation_id, sender_id, body, created_at)
select id, '00000000-0000-0000-0000-0000000000c1', 'Yes!', now() - interval '1 hour' from convo;

select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
create temp table o as select public.owner_overview() as v;
select tests.expect_count($$select (v ->> 'views_30d')::bigint from o$$, 2, 'views last 30 days');
select tests.expect_count($$select (v ->> 'views_prev_30d')::bigint from o$$, 1, 'views previous 30 days');
select tests.expect_count($$select (v ->> 'avg_reply_minutes')::bigint from o$$, 120, 'average first reply minutes');
select tests.expect_count($$select (v ->> 'new_inquiries')::bigint from o$$, 0, 'trusted insert does not change status (owner reply came from SQL)');
select tests.expect_count($$select jsonb_array_length(v -> 'listings') from o$$, 2, 'per-listing rows include drafts');
select tests.expect_count($$select (e ->> 'inquiries')::bigint from o, jsonb_array_elements(v -> 'listings') e where e ->> 'id' = '20000000-0000-0000-0000-000000000001'$$, 1, 'inquiries per listing');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select tests.expect_error($$select public.owner_overview()$$, '%Owners only%');
reset role;

-- Another owner sees zeros
select tests.login('00000000-0000-0000-0000-0000000000c2');
set local role authenticated;
select tests.expect_count($$select (public.owner_overview() ->> 'views_30d')::bigint$$, 0, 'other owner has no views');
reset role;

rollback;
