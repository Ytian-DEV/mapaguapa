-- Messaging tests. Owners c1 (owns listing 20..01) and c2; students b1, b2.
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner1@test.local', '{"account_type":"owner","full_name":"Owner One"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'owner2@test.local', '{"account_type":"owner"}');
insert into public.listings (id, name, address, accommodation_type, monthly_rental_label, rent_exact, owner_id, status)
values
  ('20000000-0000-0000-0000-000000000001', 'Owner Place', 'Guadalupe', 'Boarding house', '', 2800, '00000000-0000-0000-0000-0000000000c1', 'published'),
  ('20000000-0000-0000-0000-000000000002', 'Owner Draft', 'Guadalupe', 'Boarding house', '', 2800, '00000000-0000-0000-0000-0000000000c1', 'draft');

create temp table ids (conversation_id uuid);
create temp table visit1 (id uuid);
create temp table visit2 (id uuid);
grant all on ids, visit1, visit2 to authenticated;

-- Student starts a conversation (idempotent) with a first message
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
insert into ids select public.start_conversation('20000000-0000-0000-0000-000000000001', 'Is there a room for 2?', 'Room for 2', '2nd semester', 2);
select tests.expect_count($$select count(*) from ids i where public.start_conversation('20000000-0000-0000-0000-000000000001') = i.conversation_id$$, 1, 'start_conversation is idempotent');
select tests.expect_error($$select public.start_conversation('20000000-0000-0000-0000-000000000002')$$, '%Listing not found%');
select tests.expect_error($$select public.start_conversation('10000000-0000-0000-0000-000000000001')$$, '%managed by MAPAGUAPA%');
select tests.expect_count($$select count(*) from public.inbox where my_side = 'student' and other_name = 'Owner One' and unread_count = 0 and last_message_preview = 'Is there a room for 2?'$$, 1, 'student inbox row');
select tests.expect_error($$insert into public.messages (conversation_id, kind, body) select conversation_id, 'system', 'fake' from ids$$, '%System messages%');
select tests.expect_error($$select app.begin_internal_write()$$, '%permission denied%');
reset role;

-- Owners cannot start conversations; outsiders can't see or post
select tests.login('00000000-0000-0000-0000-0000000000c2');
set local role authenticated;
select tests.expect_error($$select public.start_conversation('20000000-0000-0000-0000-000000000001')$$, '%Only students%');
select tests.expect_count($$select count(*) from public.conversations$$, 0, 'outsider sees no conversations');
select tests.expect_count($$select count(*) from public.messages$$, 0, 'outsider sees no messages');
select tests.expect_error($$insert into public.messages (conversation_id, body) select conversation_id, 'hi' from ids$$, '%row-level security%');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
select tests.expect_count($$select count(*) from public.messages$$, 0, 'other student sees no messages');
reset role;

-- Owner sees unread, replies (status -> replied), notes are private
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select tests.expect_count($$select count(*) from public.inbox where my_side = 'owner' and unread_count = 1 and inquiry_status = 'new' and party_size = 2$$, 1, 'owner sees 1 unread');
insert into public.messages (conversation_id, body, sender_id) select conversation_id, 'Yes, one room left.', '00000000-0000-0000-0000-0000000000b1' from ids;
select tests.expect_count($$select count(*) from public.messages where body = 'Yes, one room left.' and sender_id = '00000000-0000-0000-0000-0000000000c1'$$, 1, 'spoofed sender rewritten to caller');
select tests.expect_count($$select count(*) from public.inbox where inquiry_status = 'replied' and unread_count = 0$$, 1, 'owner reply marks replied and read');
insert into public.conversation_notes (conversation_id, owner_id, note) select conversation_id, '00000000-0000-0000-0000-0000000000c1', 'Seems serious' from ids;
insert into public.saved_replies (owner_id, body) values ('00000000-0000-0000-0000-0000000000c1', 'Yes, still available');
select public.set_inquiry_status(conversation_id, 'closed') from ids;
select public.set_inquiry_status(conversation_id, 'replied') from ids;
select tests.expect_error($$select public.set_inquiry_status(conversation_id, 'bogus') from ids$$, '%check constraint%');
reset role;

-- Student: unread 1, can't read notes, can't change status; visit flow
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select tests.expect_count($$select count(*) from public.inbox where unread_count = 1$$, 1, 'student sees owner reply unread');
select public.mark_conversation_read(conversation_id) from ids;
select tests.expect_count($$select count(*) from public.inbox where unread_count = 0$$, 1, 'mark read');
select tests.expect_count($$select count(*) from public.conversation_notes$$, 0, 'notes hidden from student');
select tests.expect_count($$select count(*) from public.saved_replies$$, 0, 'saved replies hidden from student');
select tests.expect_error($$select public.set_inquiry_status(conversation_id, 'closed') from ids$$, '%Only the owner%');
insert into visit1 select public.request_visit(conversation_id, now() + interval '3 days', 'Saturday morning?') from ids;
select tests.expect_error($$select public.respond_visit(id, 'confirm') from visit1$$, '%Wait for the other person%');
select tests.expect_error($$select public.request_visit(conversation_id, now() - interval '1 day') from ids$$, '%future%');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
insert into visit2 select public.respond_visit(id, 'reschedule', now() + interval '4 days') from visit1;
reset role;
select tests.expect_count($$select count(*) from public.visit_requests v join visit1 on v.id = visit1.id where v.status = 'rescheduled'$$, 1, 'original rescheduled');

select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select public.respond_visit(id, 'confirm') from visit2;
select tests.expect_count($$select count(*) from public.inbox where inquiry_status = 'visit_scheduled' and has_open_visit$$, 1, 'visit confirmed');
select tests.expect_count($$select count(*) from public.messages where kind = 'system' and body = 'Visit confirmed.'$$, 1, 'system message');
-- Block stops new messages; only the blocker can unblock
select public.set_conversation_blocked(conversation_id, true) from ids;
select tests.expect_error($$insert into public.messages (conversation_id, body) select conversation_id, 'hello?' from ids$$, '%blocked%');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select public.set_conversation_blocked(conversation_id, false) from ids;
select tests.expect_count($$select count(*) from public.inbox where is_blocked$$, 1, 'non-blocker cannot unblock');
select tests.expect_error($$insert into public.messages (conversation_id, body) select conversation_id, 'hello?' from ids$$, '%blocked%');
reset role;

-- Attachments: participants only, and the path check tolerates other buckets
insert into storage.objects (bucket_id, name) values ('listing-photos', 'admin/x/y.jpg');
select tests.login('00000000-0000-0000-0000-0000000000c2');
set local role authenticated;
select tests.expect_error($$insert into storage.objects (bucket_id, name) select 'message-attachments', conversation_id || '/x.jpg' from ids$$, '%row-level security%');
select tests.expect_count($$select count(*) from storage.objects$$, 1, 'non-uuid folders do not break the policy');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
insert into storage.objects (bucket_id, name) select 'message-attachments', conversation_id || '/x.jpg' from ids;
select tests.expect_count($$select count(*) from storage.objects where bucket_id = 'message-attachments'$$, 1, 'participant reads attachment');
reset role;

rollback;
