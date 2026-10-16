-- MAPAGUAPA v2 — messaging (frames 04 Messages and O3 Inquiries)
-- * One conversation per (listing, student), started with start_conversation().
-- * Only the two participants can read a conversation and its messages.
-- * Messages are inserted directly (Realtime friendly) and are immutable.
-- * State changes (read markers, inquiry status, block, visits) go through RPCs.
-- * Owner private notes live in their own table so students can never read them.
-- * Image attachments go to the private bucket message-attachments/<conversation_id>/...
-- Requires the roles and listings migrations. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  inquiry_status text not null default 'new',
  interest_room text,
  move_in_label text,
  party_size integer,
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_id uuid references public.profiles(id) on delete set null,
  student_last_read_at timestamptz,
  owner_last_read_at timestamptz,
  blocked_by uuid references public.profiles(id) on delete set null,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_status_check check (inquiry_status in ('new', 'replied', 'visit_scheduled', 'closed')),
  constraint conversations_party_size_check check (party_size is null or party_size between 1 and 20),
  constraint conversations_distinct_people check (student_id <> owner_id),
  constraint conversations_listing_student_key unique (listing_id, student_id)
);

create table if not exists public.visit_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  proposed_at timestamptz not null,
  note text,
  status text not null default 'pending',
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  replaced_by uuid references public.visit_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint visit_requests_status_check check (status in ('pending', 'confirmed', 'declined', 'rescheduled', 'cancelled')),
  constraint visit_requests_note_length check (note is null or char_length(note) <= 500)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'text',
  body text,
  attachment_path text,
  visit_request_id uuid references public.visit_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint messages_kind_check check (kind in ('text', 'image', 'visit', 'system')),
  constraint messages_body_length check (body is null or char_length(body) between 1 and 4000),
  constraint messages_has_content check (body is not null or attachment_path is not null or visit_request_id is not null)
);

create table if not exists public.conversation_notes (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint conversation_notes_length check (char_length(note) <= 2000)
);

create table if not exists public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint saved_replies_body_length check (char_length(body) between 1 and 1000)
);

create index if not exists conversations_student_idx on public.conversations(student_id, last_message_at desc);
create index if not exists conversations_owner_idx on public.conversations(owner_id, last_message_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists visit_requests_conversation_idx on public.visit_requests(conversation_id, created_at);
create index if not exists saved_replies_owner_idx on public.saved_replies(owner_id, sort_order);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function app.is_participant(p_conversation_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and auth.uid() in (c.student_id, c.owner_id)
  )
$$;

-- Loads a conversation the caller participates in, or raises.
create or replace function app.my_conversation(p_conversation_id uuid) returns public.conversations
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if not found or auth.uid() is null or auth.uid() not in (v_conversation.student_id, v_conversation.owner_id) then
    raise exception 'Conversation not found.' using errcode = 'P0002';
  end if;
  return v_conversation;
end;
$$;

-- RPCs below insert visit/system messages on the caller's behalf; they set this
-- transaction-local flag right before that insert and the insert guard
-- consumes it, so it never applies to a later client insert.
create or replace function app.begin_internal_write() returns void
language sql
as $$
  select set_config('app.internal_write', 'on', true);
$$;

create or replace function app.is_internal_write() returns boolean
language sql stable
as $$
  select coalesce(current_setting('app.internal_write', true), '') = 'on'
$$;

-- Storage helper: first folder of an object path as a conversation id.
create or replace function app.is_participant_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return app.is_participant(v_folder::uuid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Message side effects: conversation summary, read marker, auto status
-- ---------------------------------------------------------------------------
create or replace function app.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;

  if app.is_internal_write() then
    -- One-shot: each RPC writes exactly one message, so consume the flag.
    perform set_config('app.internal_write', 'off', true);
  elsif not app.is_trusted_context() then
    new.sender_id := auth.uid();
    new.created_at := clock_timestamp();
    if v_conversation.blocked_at is not null then
      raise exception 'This conversation is blocked.' using errcode = '42501';
    end if;
    if new.kind = 'system' then
      raise exception 'System messages are created by the app.' using errcode = '42501';
    end if;
    if new.attachment_path is not null and new.attachment_path not like new.conversation_id::text || '/%' then
      raise exception 'Attachments must be stored under the conversation folder.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations;
  v_preview text;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;

  v_preview := case
    when new.kind = 'image' then 'Sent a photo'
    when new.kind = 'visit' then 'Visit request'
    else left(coalesce(new.body, ''), 140)
  end;

  update public.conversations
  set last_message_at = new.created_at,
      last_message_preview = v_preview,
      last_message_sender_id = new.sender_id,
      student_last_read_at = case when new.sender_id = student_id then new.created_at else student_last_read_at end,
      owner_last_read_at = case when new.sender_id = owner_id then new.created_at else owner_last_read_at end,
      inquiry_status = case
        when new.sender_id = owner_id and inquiry_status = 'new' then 'replied'
        else inquiry_status
      end,
      updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
for each row execute function app.messages_before_insert();

drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
for each row execute function app.messages_after_insert();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.visit_requests enable row level security;
alter table public.conversation_notes enable row level security;
alter table public.saved_replies enable row level security;

drop policy if exists "conversations: participants read" on public.conversations;
create policy "conversations: participants read"
on public.conversations for select to authenticated
using (auth.uid() in (student_id, owner_id));
-- No insert/update/delete policies: use start_conversation() and the RPCs below.

drop policy if exists "messages: participants read" on public.messages;
create policy "messages: participants read"
on public.messages for select to authenticated
using (app.is_participant(conversation_id));

drop policy if exists "messages: participants send" on public.messages;
create policy "messages: participants send"
on public.messages for insert to authenticated
with check (app.is_participant(conversation_id) and sender_id = auth.uid() and kind in ('text', 'image'));

drop policy if exists "visit_requests: participants read" on public.visit_requests;
create policy "visit_requests: participants read"
on public.visit_requests for select to authenticated
using (app.is_participant(conversation_id));

drop policy if exists "conversation_notes: owner only" on public.conversation_notes;
create policy "conversation_notes: owner only"
on public.conversation_notes for all to authenticated
using (owner_id = auth.uid())
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and c.owner_id = auth.uid())
);

drop policy if exists "saved_replies: owner only" on public.saved_replies;
create policy "saved_replies: owner only"
on public.saved_replies for all to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid() and app.is_owner());

-- ---------------------------------------------------------------------------
-- Inbox view: one row per conversation for the caller, with unread count and
-- the other participant's public card. security_invoker keeps the RLS above.
-- ---------------------------------------------------------------------------
create or replace view public.inbox
with (security_invoker = true)
as
select
  c.id,
  c.listing_id,
  l.name as listing_name,
  c.student_id,
  c.owner_id,
  case when c.student_id = auth.uid() then 'student' else 'owner' end as my_side,
  case when c.student_id = auth.uid() then c.owner_id else c.student_id end as other_id,
  other.full_name as other_name,
  other.avatar_url as other_avatar_url,
  other.is_verified_owner as other_is_verified_owner,
  c.inquiry_status,
  c.interest_room,
  c.move_in_label,
  c.party_size,
  c.last_message_at,
  c.last_message_preview,
  c.last_message_sender_id,
  c.blocked_at is not null as is_blocked,
  c.blocked_by,
  c.created_at,
  (
    select count(*)
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_id is distinct from auth.uid()
      and m.created_at > coalesce(case when c.student_id = auth.uid() then c.student_last_read_at else c.owner_last_read_at end, '-infinity')
  )::integer as unread_count,
  exists (
    select 1 from public.visit_requests v where v.conversation_id = c.id and v.status in ('pending', 'confirmed')
  ) as has_open_visit
from public.conversations c
left join public.listings l on l.id = c.listing_id
left join public.profile_cards other on other.id = case when c.student_id = auth.uid() then c.owner_id else c.student_id end;

grant select on public.inbox to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.start_conversation(
  p_listing_id uuid,
  p_message text default null,
  p_interest_room text default null,
  p_move_in_label text default null,
  p_party_size integer default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_id uuid;
begin
  if v_uid is null or coalesce(app.current_role(), '') <> 'student' then
    raise exception 'Only students can message owners.' using errcode = '42501';
  end if;

  select * into v_listing from public.listings where id = p_listing_id and status = 'published';
  if not found then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;
  if v_listing.owner_id is null then
    raise exception 'This listing is managed by MAPAGUAPA; please use the contact number.' using errcode = 'P0001';
  end if;

  insert into public.conversations (listing_id, student_id, owner_id, interest_room, move_in_label, party_size)
  values (p_listing_id, v_uid, v_listing.owner_id, p_interest_room, p_move_in_label, p_party_size)
  on conflict (listing_id, student_id) do update
    set interest_room = coalesce(excluded.interest_room, conversations.interest_room),
        move_in_label = coalesce(excluded.move_in_label, conversations.move_in_label),
        party_size = coalesce(excluded.party_size, conversations.party_size)
  returning id into v_id;

  if nullif(trim(coalesce(p_message, '')), '') is not null then
    insert into public.messages (conversation_id, sender_id, kind, body)
    values (v_id, v_uid, 'text', trim(p_message));
  end if;

  return v_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations := app.my_conversation(p_conversation_id);
begin
  update public.conversations
  set student_last_read_at = case when v_conversation.student_id = auth.uid() then clock_timestamp() else student_last_read_at end,
      owner_last_read_at = case when v_conversation.owner_id = auth.uid() then clock_timestamp() else owner_last_read_at end
  where id = p_conversation_id;
end;
$$;

create or replace function public.set_inquiry_status(p_conversation_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations := app.my_conversation(p_conversation_id);
begin
  if v_conversation.owner_id <> auth.uid() then
    raise exception 'Only the owner can change the inquiry status.' using errcode = '42501';
  end if;
  update public.conversations set inquiry_status = p_status, updated_at = now() where id = p_conversation_id;
end;
$$;

create or replace function public.set_conversation_blocked(p_conversation_id uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations := app.my_conversation(p_conversation_id);
begin
  if p_blocked then
    update public.conversations
    set blocked_by = auth.uid(), blocked_at = now(), updated_at = now()
    where id = p_conversation_id and blocked_at is null;
  else
    -- Only whoever blocked can unblock.
    update public.conversations
    set blocked_by = null, blocked_at = null, updated_at = now()
    where id = p_conversation_id and blocked_by = auth.uid();
  end if;
end;
$$;

create or replace function public.request_visit(p_conversation_id uuid, p_at timestamptz, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations := app.my_conversation(p_conversation_id);
  v_id uuid;
begin
  if v_conversation.blocked_at is not null then
    raise exception 'This conversation is blocked.' using errcode = '42501';
  end if;
  perform app.begin_internal_write();
  if p_at < now() then
    raise exception 'Pick a time in the future.' using errcode = '22023';
  end if;

  -- A new proposal supersedes any open one.
  update public.visit_requests
  set status = 'cancelled', responded_by = auth.uid(), responded_at = now()
  where conversation_id = p_conversation_id and status = 'pending';

  insert into public.visit_requests (conversation_id, proposed_by, proposed_at, note)
  values (p_conversation_id, auth.uid(), p_at, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  insert into public.messages (conversation_id, sender_id, kind, visit_request_id)
  values (p_conversation_id, auth.uid(), 'visit', v_id);

  return v_id;
end;
$$;

-- p_action: 'confirm' | 'decline' | 'reschedule' (needs p_new_at) | 'cancel' (proposer only)
create or replace function public.respond_visit(p_visit_id uuid, p_action text, p_new_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_visit public.visit_requests;
  v_conversation public.conversations;
  v_new_id uuid;
begin
  select * into v_visit from public.visit_requests where id = p_visit_id for update;
  if not found then
    raise exception 'Visit request not found.' using errcode = 'P0002';
  end if;
  v_conversation := app.my_conversation(v_visit.conversation_id);
  if v_conversation.blocked_at is not null then
    raise exception 'This conversation is blocked.' using errcode = '42501';
  end if;
  perform app.begin_internal_write();

  if p_action = 'cancel' then
    if v_visit.proposed_by <> auth.uid() or v_visit.status not in ('pending', 'confirmed') then
      raise exception 'You can only cancel your own open visit request.' using errcode = '42501';
    end if;
    update public.visit_requests set status = 'cancelled', responded_by = auth.uid(), responded_at = now() where id = p_visit_id;
    insert into public.messages (conversation_id, sender_id, kind, body, visit_request_id)
    values (v_visit.conversation_id, null, 'system', 'Visit cancelled.', p_visit_id);
    return p_visit_id;
  end if;

  if v_visit.status <> 'pending' then
    raise exception 'This visit request was already answered.' using errcode = '22023';
  end if;
  if v_visit.proposed_by = auth.uid() then
    raise exception 'Wait for the other person to answer your request.' using errcode = '42501';
  end if;

  if p_action = 'confirm' then
    update public.visit_requests set status = 'confirmed', responded_by = auth.uid(), responded_at = now() where id = p_visit_id;
    update public.conversations set inquiry_status = 'visit_scheduled', updated_at = now() where id = v_visit.conversation_id;
    insert into public.messages (conversation_id, sender_id, kind, body, visit_request_id)
    values (v_visit.conversation_id, null, 'system', 'Visit confirmed.', p_visit_id);
    return p_visit_id;
  elsif p_action = 'decline' then
    update public.visit_requests set status = 'declined', responded_by = auth.uid(), responded_at = now() where id = p_visit_id;
    insert into public.messages (conversation_id, sender_id, kind, body, visit_request_id)
    values (v_visit.conversation_id, null, 'system', 'Visit declined.', p_visit_id);
    return p_visit_id;
  elsif p_action = 'reschedule' then
    if p_new_at is null or p_new_at < now() then
      raise exception 'Pick a new time in the future.' using errcode = '22023';
    end if;
    insert into public.visit_requests (conversation_id, proposed_by, proposed_at)
    values (v_visit.conversation_id, auth.uid(), p_new_at)
    returning id into v_new_id;
    update public.visit_requests
    set status = 'rescheduled', responded_by = auth.uid(), responded_at = now(), replaced_by = v_new_id
    where id = p_visit_id;
    insert into public.messages (conversation_id, sender_id, kind, visit_request_id)
    values (v_visit.conversation_id, auth.uid(), 'visit', v_new_id);
    return v_new_id;
  end if;

  raise exception 'Unknown action %.', p_action using errcode = '22023';
end;
$$;

revoke all on function public.start_conversation(uuid, text, text, text, integer) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.set_inquiry_status(uuid, text) from public, anon;
revoke all on function public.set_conversation_blocked(uuid, boolean) from public, anon;
revoke all on function public.request_visit(uuid, timestamptz, text) from public, anon;
revoke all on function public.respond_visit(uuid, text, timestamptz) from public, anon;
grant execute on function public.start_conversation(uuid, text, text, text, integer) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.set_inquiry_status(uuid, text) to authenticated;
grant execute on function public.set_conversation_blocked(uuid, boolean) to authenticated;
grant execute on function public.request_visit(uuid, timestamptz, text) to authenticated;
grant execute on function public.respond_visit(uuid, text, timestamptz) to authenticated;
grant execute on all functions in schema app to anon, authenticated, service_role;
-- The internal-write switch must only be reachable from inside the RPCs above.
revoke execute on function app.begin_internal_write() from public, anon, authenticated;
grant select, insert, update, delete on public.conversations, public.messages, public.visit_requests,
  public.conversation_notes, public.saved_replies to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private message attachments, readable by participants only
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

drop policy if exists "v2 message attachments: participants read" on storage.objects;
create policy "v2 message attachments: participants read"
on storage.objects for select to authenticated
using (bucket_id = 'message-attachments' and app.is_participant_path(objects.name));

drop policy if exists "v2 message attachments: participants upload" on storage.objects;
create policy "v2 message attachments: participants upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'message-attachments' and app.is_participant_path(objects.name));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach v_table in array array['conversations', 'messages', 'visit_requests'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end
$$;
