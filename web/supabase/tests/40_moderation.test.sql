-- Reports, verifications and activity log tests.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner1@test.local', '{"account_type":"owner","full_name":"Owner One"}');
insert into public.listings (id, name, address, accommodation_type, monthly_rental_label, rent_exact, owner_id, status)
values ('20000000-0000-0000-0000-000000000001', 'Owner Place', 'Guadalupe', 'Boarding house', '', 2800, '00000000-0000-0000-0000-0000000000c1', 'published');

create temp table ids (conversation_id uuid, message_id uuid);
create temp table ver (id uuid);
grant all on ids, ver to authenticated;

-- A conversation with one owner message
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
insert into ids (conversation_id) select public.start_conversation('20000000-0000-0000-0000-000000000001', 'Hello');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
insert into public.messages (conversation_id, body) select conversation_id, 'Send the deposit first via GCash' from ids;
reset role;
update ids set message_id = (select id from public.messages where body like 'Send the deposit%');

-- Student reports the listing and the message
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
insert into public.reports (target_type, listing_id, reason, details) values ('listing', '20000000-0000-0000-0000-000000000001', 'wrong_info', 'Price is wrong');
insert into public.reports (target_type, message_id, reason, status) select 'message', message_id, 'scam', 'resolved' from ids;
select tests.expect_count($$select count(*) from public.reports where status = 'open' and reporter_id = '00000000-0000-0000-0000-0000000000b1'$$, 2, 'reports created as open');
select tests.expect_count($$select count(*) from public.reports where target_type = 'message' and reported_user_id = '00000000-0000-0000-0000-0000000000c1' and conversation_id is not null$$, 1, 'message report context filled');
select tests.expect_error($$insert into public.reports (target_type, listing_id, reason) values ('listing', '10000000-0000-0000-0000-000000000005', 'scam')$$, '%Listing not found%');
select tests.expect_count($$with u as (update public.reports set status = 'dismissed' returning 1) select count(*) from u$$, 0, 'reporter cannot resolve');
select tests.expect_count($$select count(*) from public.activity_log$$, 0, 'students cannot read activity');
reset role;

-- Another student can't report a message they can't see, nor read others' reports
select tests.login('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
select tests.expect_error($$insert into public.reports (target_type, message_id, reason) select 'message', message_id, 'scam' from ids$$, '%own conversations%');
select tests.expect_count($$select count(*) from public.reports$$, 0, 'cannot read others reports');
reset role;

-- Admin reads the reported conversation, resolves; activity is logged
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select tests.expect_count($$select count(*) from public.messages$$, 2, 'admin reads reported conversation messages');
update public.reports set status = 'resolved', resolution_note = 'Warned owner' where target_type = 'message';
select tests.expect_count($$select count(*) from public.reports where status = 'resolved' and resolved_by = '00000000-0000-0000-0000-00000000000a' and resolved_at is not null$$, 1, 'resolved');
select tests.expect_count($$select count(*) from public.activity_log where action in ('report.created', 'report.resolved')$$, 3, 'report activity logged');
reset role;

-- Owner verification: owners only, own folder, admin approval sets badge
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select tests.expect_error($$insert into public.owner_verifications (document_type, document_paths) values ('land_title', array['00000000-0000-0000-0000-0000000000b1/a.pdf'])$$, '%Only owner accounts%');
select tests.expect_error($$insert into storage.objects (bucket_id, name) values ('owner-verifications', '00000000-0000-0000-0000-0000000000b1/a.pdf')$$, '%row-level security%');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
insert into storage.objects (bucket_id, name) values ('owner-verifications', '00000000-0000-0000-0000-0000000000c1/title.pdf');
select tests.expect_error($$insert into storage.objects (bucket_id, name) values ('owner-verifications', '00000000-0000-0000-0000-0000000000b1/x.pdf')$$, '%row-level security%');
select tests.expect_error($$insert into public.owner_verifications (document_type, document_paths) values ('land_title', array['someone-else/a.pdf'])$$, '%own folder%');
with v as (
  insert into public.owner_verifications (document_type, document_paths, status)
  values ('land_title', array['00000000-0000-0000-0000-0000000000c1/title.pdf'], 'approved')
  returning id, status
)
insert into ver select id from v where v.status = 'pending';
select tests.expect_count($$select count(*) from ver$$, 1, 'owner cannot self-approve');
select tests.expect_error($$insert into public.owner_verifications (document_type, document_paths) values ('land_title', array['00000000-0000-0000-0000-0000000000c1/b.pdf'])$$, '%duplicate key%');
select tests.expect_count($$with u as (update public.owner_verifications set status = 'approved' returning 1) select count(*) from u$$, 0, 'owner cannot approve');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select tests.expect_count($$select count(*) from storage.objects where bucket_id = 'owner-verifications'$$, 1, 'admin reads documents');
update public.owner_verifications set status = 'approved', review_note = 'Title matches' where id = (select id from ver);
select tests.expect_count($$select count(*) from public.profile_cards where id = '00000000-0000-0000-0000-0000000000c1' and is_verified_owner$$, 1, 'owner badge set');
-- Listing status changes and role changes are logged
update public.listings set status = 'changes_requested', review_note = 'Fix price' where id = '20000000-0000-0000-0000-000000000001';
update public.profiles set role = 'owner' where id = '00000000-0000-0000-0000-0000000000b2';
select tests.expect_count($$select count(*) from public.activity_log where action = 'listing.changes_requested' and actor_id = '00000000-0000-0000-0000-00000000000a'$$, 1, 'listing status logged');
select tests.expect_count($$select count(*) from public.activity_log where action = 'user.role_changed'$$, 1, 'role change logged');
select tests.expect_count($$select count(*) from public.activity_log where action in ('verification.submitted', 'verification.approved', 'user.verified')$$, 3, 'verification logged');
select tests.expect_error($$insert into public.activity_log (action, entity_type) values ('fake', 'x')$$, '%row-level security%');
reset role;

rollback;
