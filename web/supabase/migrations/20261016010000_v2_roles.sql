-- MAPAGUAPA v2 — roles
-- * profiles.role becomes student | owner | admin ('user' rows become 'student';
--   a trigger keeps accepting 'user' from the v1 client and stores 'student').
-- * Profiles are created server-side from auth.users, taking the account type
--   chosen at sign-up (raw_user_meta_data.account_type = 'owner' | 'student').
-- * Users can no longer change their own role / active / verification / email.
--   This replaces the v1 trigger protect_profile_system_fields.
-- * Role helpers live in a private `app` schema (not exposed through the API).
-- Matches prod as of 2026-10-16 (see docs/v2/DB.md). Safe to re-run.

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Drop the v1 profiles policies and guard first: a policy that references
-- `role` would block the type change below. v2 versions are created further down.
-- ---------------------------------------------------------------------------
do $$
declare
  v_policy record;
begin
  for v_policy in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', v_policy.policyname);
  end loop;
end
$$;

drop trigger if exists protect_profile_system_fields on public.profiles;
drop function if exists public.protect_profile_system_fields();

-- ---------------------------------------------------------------------------
-- profiles.role: normalise type and values
-- ---------------------------------------------------------------------------
do $$
declare
  v_type text;
  v_constraint record;
begin
  select data_type into v_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'role';

  -- An enum would block the new values; plain text + check is easier to evolve.
  if v_type = 'USER-DEFINED' then
    alter table public.profiles alter column role drop default;
    alter table public.profiles alter column role type text using role::text;
  end if;

  -- Drop whatever check constraints currently restrict role (names unknown).
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', v_constraint.conname);
  end loop;
end
$$;

update public.profiles set role = 'student' where role = 'user' or role is null;

alter table public.profiles alter column role set default 'student';
alter table public.profiles alter column role set not null;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'owner', 'admin'));

alter table public.profiles
  add column if not exists verified_owner_at timestamptz,
  add column if not exists deactivated_at timestamptz,
  add column if not exists merged_into uuid references public.profiles(id) on delete set null,
  add column if not exists last_active_at timestamptz;

comment on column public.profiles.verified_owner_at is 'Set by an admin when an owner verification is approved.';
comment on column public.profiles.merged_into is 'When a duplicate account was merged, the profile it was merged into.';

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_full_name_lower_idx on public.profiles(lower(full_name));

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function app.current_role() returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(app.current_role() = 'admin', false)
$$;

create or replace function app.is_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(app.current_role() = 'owner', false)
$$;

-- JWT role of the current request: 'anon', 'authenticated', 'service_role',
-- or null for direct database sessions (SQL editor, migrations, triggers).
-- Reads the request settings directly because current_user is the function
-- owner inside security definer functions.
create or replace function app.request_role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

-- True for the service role and direct database sessions (no end-user JWT).
create or replace function app.is_trusted_context() returns boolean
language sql stable
as $$
  select coalesce(app.request_role(), 'service_role') = 'service_role'
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Guard: normalise legacy role, block self-escalation
-- ---------------------------------------------------------------------------
create or replace function app.profiles_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.role = 'user' then
    new.role := 'student';
  end if;

  if app.is_trusted_context() or app.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id is distinct from auth.uid() then
      raise exception 'You can only create your own profile.' using errcode = '42501';
    end if;
    if new.role not in ('student', 'owner') then
      new.role := 'student';
    end if;
    new.is_active := true;
    new.verified_owner_at := null;
    new.deactivated_at := null;
    new.merged_into := null;
  else
    if new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.verified_owner_at is distinct from old.verified_owner_at
      or new.deactivated_at is distinct from old.deactivated_at
      or new.merged_into is distinct from old.merged_into
      or new.id is distinct from old.id then
      raise exception 'Only an admin can change role, status or verification.' using errcode = '42501';
    end if;
    -- Email follows auth.users (synced by on_auth_user_updated); never set by hand.
    if new.email is distinct from old.email
      and new.email is distinct from (select u.email from auth.users u where u.id = new.id) then
      raise exception 'Email must be changed through auth.' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
before insert or update on public.profiles
for each row execute function app.profiles_guard();

-- ---------------------------------------------------------------------------
-- Create the profile when the auth user is created
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, avatar_url, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', '')),
    nullif(v_meta ->> 'avatar_url', ''),
    case when v_meta ->> 'account_type' = 'owner' then 'owner' else 'student' end,
    true
  )
  -- Same upsert as v1; role is only set on first insert.
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS (v1 policies were dropped at the top; this loop only matters on re-run)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', v_policy.policyname);
  end loop;
end
$$;

create policy "profiles: read own or admin"
on public.profiles for select to authenticated
using (id = auth.uid() or app.is_admin());

create policy "profiles: insert own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

create policy "profiles: update own or admin"
on public.profiles for update to authenticated
using (id = auth.uid() or app.is_admin())
with check (id = auth.uid() or app.is_admin());

-- Public-safe subset of a profile (names on listings, conversations, badges).
-- Runs with the view owner's rights on purpose, exposing only these columns.
create or replace view public.profile_cards as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.role,
  p.verified_owner_at is not null as is_verified_owner
from public.profiles p
where p.is_active;

revoke all on public.profile_cards from anon;
grant select on public.profile_cards to authenticated;
