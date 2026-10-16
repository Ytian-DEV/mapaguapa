-- MAPAGUAPA v2 — reports, owner verifications, activity log
-- * Students (any signed-in user) report listings, messages or users.
-- * Owners upload proof of ownership to the private owner-verifications bucket;
--   an admin approval sets profiles.verified_owner_at.
-- * activity_log is written only by triggers / security definer functions and
--   is readable by admins only.
-- Requires the roles, listings and messaging migrations. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_created_idx on public.activity_log(created_at desc);
create index if not exists activity_log_entity_idx on public.activity_log(entity_type, entity_id, created_at desc);

alter table public.activity_log enable row level security;
drop policy if exists "activity_log: admins read" on public.activity_log;
create policy "activity_log: admins read"
on public.activity_log for select to authenticated
using (app.is_admin());
-- No insert/update/delete policies: rows come from app.log_activity().

create or replace function app.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text default null,
  p_meta jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public, pg_temp
as $$
  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary, meta)
  values (
    (select id from public.profiles where id = auth.uid()),
    p_action, p_entity_type, p_entity_id, p_summary, coalesce(p_meta, '{}'::jsonb)
  );
$$;

revoke execute on function app.log_activity(text, text, uuid, text, jsonb) from public, anon, authenticated;

-- Listings: creation and every status change
create or replace function app.listings_log_activity() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity('listing.created', 'listing', new.id, new.name, jsonb_build_object('status', new.status));
  elsif new.status is distinct from old.status then
    perform app.log_activity(
      'listing.' || new.status,
      'listing',
      new.id,
      new.name,
      jsonb_build_object('from', old.status, 'to', new.status, 'review_note', new.review_note)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists listings_log_activity on public.listings;
create trigger listings_log_activity
after insert or update of status on public.listings
for each row execute function app.listings_log_activity();

-- Profiles: role and active-status changes
create or replace function app.profiles_log_activity() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    perform app.log_activity('user.role_changed', 'user', new.id, coalesce(new.full_name, new.email),
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.is_active is distinct from old.is_active then
    perform app.log_activity(case when new.is_active then 'user.reactivated' else 'user.deactivated' end,
      'user', new.id, coalesce(new.full_name, new.email), '{}'::jsonb);
  end if;
  if new.verified_owner_at is distinct from old.verified_owner_at then
    perform app.log_activity(case when new.verified_owner_at is null then 'user.unverified' else 'user.verified' end,
      'user', new.id, coalesce(new.full_name, new.email), '{}'::jsonb);
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_log_activity on public.profiles;
create trigger profiles_log_activity
after update on public.profiles
for each row execute function app.profiles_log_activity();

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  target_type text not null,
  listing_id uuid references public.listings(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  constraint reports_target_type_check check (target_type in ('listing', 'message', 'user')),
  constraint reports_reason_check check (reason in ('scam', 'wrong_info', 'unavailable', 'inappropriate', 'harassment', 'safety', 'other')),
  constraint reports_status_check check (status in ('open', 'resolved', 'dismissed')),
  constraint reports_details_length check (details is null or char_length(details) <= 2000),
  constraint reports_has_target check (
    (target_type = 'listing' and listing_id is not null)
    or (target_type = 'message' and message_id is not null)
    or (target_type = 'user' and reported_user_id is not null)
  )
);

create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create index if not exists reports_listing_idx on public.reports(listing_id);
create index if not exists reports_message_idx on public.reports(message_id);

-- Fill in context and make sure reporters only report what they can see.
create or replace function app.reports_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_message public.messages;
begin
  if tg_op = 'INSERT' then
    if not app.is_trusted_context() then
      new.reporter_id := auth.uid();
      new.status := 'open';
      new.resolved_by := null;
      new.resolved_at := null;
      new.resolution_note := null;
    end if;

    if new.target_type = 'message' then
      select * into v_message from public.messages where id = new.message_id;
      if not found or not (app.is_trusted_context() or app.is_participant(v_message.conversation_id)) then
        raise exception 'You can only report messages from your own conversations.' using errcode = '42501';
      end if;
      new.conversation_id := v_message.conversation_id;
      new.reported_user_id := v_message.sender_id;
      select listing_id into new.listing_id from public.conversations where id = v_message.conversation_id;
    elsif new.target_type = 'listing' then
      if not app.is_trusted_context()
        and not exists (select 1 from public.listings where id = new.listing_id and status = 'published') then
        raise exception 'Listing not found.' using errcode = 'P0002';
      end if;
      select owner_id into new.reported_user_id from public.listings where id = new.listing_id;
    end if;

    if new.reported_user_id = new.reporter_id then
      raise exception 'You cannot report yourself.' using errcode = '22023';
    end if;
    return new;
  end if;

  -- UPDATE: admins resolve
  if new.status is distinct from old.status and new.status in ('resolved', 'dismissed') then
    new.resolved_by := coalesce(auth.uid(), new.resolved_by);
    new.resolved_at := now();
  elsif new.status = 'open' then
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before insert or update on public.reports
for each row execute function app.reports_guard();

create or replace function app.reports_log_activity() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity('report.created', 'report', new.id, new.reason,
      jsonb_build_object('target_type', new.target_type, 'listing_id', new.listing_id, 'message_id', new.message_id));
  elsif new.status is distinct from old.status then
    perform app.log_activity('report.' || new.status, 'report', new.id, new.reason,
      jsonb_build_object('note', new.resolution_note));
  end if;
  return null;
end;
$$;

drop trigger if exists reports_log_activity on public.reports;
create trigger reports_log_activity after insert or update of status on public.reports
for each row execute function app.reports_log_activity();

alter table public.reports enable row level security;

drop policy if exists "reports: create own" on public.reports;
create policy "reports: create own"
on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

drop policy if exists "reports: read own or admin" on public.reports;
create policy "reports: read own or admin"
on public.reports for select to authenticated
using (reporter_id = auth.uid() or app.is_admin());

drop policy if exists "reports: admins update" on public.reports;
create policy "reports: admins update"
on public.reports for update to authenticated
using (app.is_admin())
with check (app.is_admin());

-- Admins may read a conversation (and its messages) only when it was reported.
drop policy if exists "conversations: admins read reported" on public.conversations;
create policy "conversations: admins read reported"
on public.conversations for select to authenticated
using (app.is_admin() and exists (select 1 from public.reports r where r.conversation_id = conversations.id));

drop policy if exists "messages: admins read reported conversations" on public.messages;
create policy "messages: admins read reported conversations"
on public.messages for select to authenticated
using (app.is_admin() and exists (select 1 from public.reports r where r.conversation_id = messages.conversation_id));

-- ---------------------------------------------------------------------------
-- Owner verifications
-- ---------------------------------------------------------------------------
create table if not exists public.owner_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  document_type text not null,
  document_paths text[] not null,
  note text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  constraint owner_verifications_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint owner_verifications_type_check check (document_type in ('land_title', 'tax_declaration', 'business_permit', 'barangay_certificate', 'lease_contract', 'other')),
  constraint owner_verifications_paths_check check (cardinality(document_paths) between 1 and 5)
);

create index if not exists owner_verifications_status_idx on public.owner_verifications(status, created_at);
create index if not exists owner_verifications_owner_idx on public.owner_verifications(owner_id, created_at desc);
create unique index if not exists owner_verifications_one_pending_idx on public.owner_verifications(owner_id) where status = 'pending';

create or replace function app.owner_verifications_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_path text;
begin
  if tg_op = 'INSERT' then
    if not app.is_trusted_context() then
      if not app.is_owner() then
        raise exception 'Only owner accounts can request verification.' using errcode = '42501';
      end if;
      new.owner_id := auth.uid();
      new.status := 'pending';
      new.reviewed_by := null;
      new.reviewed_at := null;
      new.review_note := null;
    end if;
    foreach v_path in array new.document_paths loop
      if v_path not like new.owner_id::text || '/%' then
        raise exception 'Documents must be uploaded to your own folder.' using errcode = '42501';
      end if;
    end loop;
    return new;
  end if;

  if new.status is distinct from old.status then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists owner_verifications_guard on public.owner_verifications;
create trigger owner_verifications_guard before insert or update on public.owner_verifications
for each row execute function app.owner_verifications_guard();

-- Approval flips the profile badge; logs both directions.
create or replace function app.owner_verifications_after() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform app.log_activity('verification.submitted', 'verification', new.id, new.document_type, jsonb_build_object('owner_id', new.owner_id));
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'approved' then
      update public.profiles set verified_owner_at = coalesce(verified_owner_at, now()) where id = new.owner_id;
    elsif old.status = 'approved' then
      update public.profiles set verified_owner_at = null where id = new.owner_id;
    end if;
    perform app.log_activity('verification.' || new.status, 'verification', new.id, new.document_type,
      jsonb_build_object('owner_id', new.owner_id, 'note', new.review_note));
  end if;
  return null;
end;
$$;

drop trigger if exists owner_verifications_after on public.owner_verifications;
create trigger owner_verifications_after after insert or update of status on public.owner_verifications
for each row execute function app.owner_verifications_after();

alter table public.owner_verifications enable row level security;

drop policy if exists "owner_verifications: owners create" on public.owner_verifications;
create policy "owner_verifications: owners create"
on public.owner_verifications for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists "owner_verifications: read own or admin" on public.owner_verifications;
create policy "owner_verifications: read own or admin"
on public.owner_verifications for select to authenticated
using (owner_id = auth.uid() or app.is_admin());

drop policy if exists "owner_verifications: admins decide" on public.owner_verifications;
create policy "owner_verifications: admins decide"
on public.owner_verifications for update to authenticated
using (app.is_admin())
with check (app.is_admin());

-- Private bucket: owner-verifications/<owner_id>/<file>
insert into storage.buckets (id, name, public)
values ('owner-verifications', 'owner-verifications', false)
on conflict (id) do nothing;

drop policy if exists "v2 owner verifications: owners upload own folder" on storage.objects;
create policy "v2 owner verifications: owners upload own folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'owner-verifications' and split_part(objects.name, '/', 1) = auth.uid()::text and app.is_owner());

drop policy if exists "v2 owner verifications: owners and admins read" on storage.objects;
create policy "v2 owner verifications: owners and admins read"
on storage.objects for select to authenticated
using (bucket_id = 'owner-verifications' and (split_part(objects.name, '/', 1) = auth.uid()::text or app.is_admin()));

grant select, insert, update on public.reports, public.owner_verifications to authenticated;
grant select on public.activity_log to authenticated;
grant execute on all functions in schema app to anon, authenticated, service_role;
revoke execute on function app.log_activity(text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function app.begin_internal_write() from public, anon, authenticated;
