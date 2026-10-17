-- Reconstruction of the v1 production schema that is NOT in migrations (it was
-- created in the Supabase dashboard). Test fixture only.
--
-- Functions, triggers and RLS policies below are copied from production
-- (pg_get_functiondef / pg_policies output, 2026-10-16). Table columns come
-- from web/src/lib/database.ts. `listings.status` is the prod enum
-- `listing_status`; prod had no check constraints on profiles/listings, so
-- `profiles.role` is modelled as an enum too (the harder case to migrate).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type public.listing_status as enum ('active', 'deleted');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('user', 'admin');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role public.user_role not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  accommodation_type text not null,
  accommodation_type_other text,
  description text,
  is_fenced boolean,
  floors_label text,
  floor_count integer,
  rooms_available integer,
  exclusivity text,
  occupancy_label text,
  occupancy_min integer,
  occupancy_max integer,
  monthly_rental_label text not null,
  monthly_rent_min numeric,
  monthly_rent_max numeric,
  utilities_included boolean,
  bills_not_included text,
  has_additional_appliance_fee boolean,
  appliance_fee_label text,
  appliance_fee_amount numeric,
  has_laundry_area boolean,
  has_drying_area boolean,
  has_comfort_room_each_room boolean,
  comfort_rooms_separate_from_bathrooms boolean,
  comfort_room_count integer,
  bathroom_count integer,
  has_bathroom_each_floor boolean,
  has_charging_slots_each_room boolean,
  charging_station_count_label text,
  charging_station_count integer,
  has_electric_fans boolean,
  has_aircon boolean,
  aircon_room_count integer,
  has_common_kitchen boolean,
  has_study_area boolean,
  has_wifi boolean,
  cellular_signals_raw text,
  cellular_signals text[] not null default '{}',
  has_parking_area boolean,
  pets_allowed boolean,
  curfew text,
  visitors_allowed boolean,
  has_security_cctv boolean,
  contact_person text,
  contact_number text,
  other_contact_information text,
  raw_import_data jsonb not null default '{}'::jsonb,
  source_row_number integer,
  status public.listing_status not null default 'active',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  deleted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_bucket text not null default 'listing-photos',
  storage_path text not null,
  caption text,
  alt_text text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deleted_listings (
  id uuid primary key default gen_random_uuid(),
  original_listing_id uuid not null,
  listing_name text not null,
  deleted_by uuid references auth.users(id),
  delete_reason text,
  listing_snapshot jsonb not null,
  deleted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Functions (verbatim from prod)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$function$;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$function$;

create or replace function public.sync_profile_email_from_auth()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.profiles
  set
    email = new.email,
    updated_at = now()
  where id = new.id;

  return new;
end;
$function$;

create or replace function public.set_updated_at()
 returns trigger
 language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.protect_profile_system_fields()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change roles.';
    end if;

    if new.is_active is distinct from old.is_active then
      raise exception 'Only admins can change active status.';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Email must be changed through auth.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.set_listing_audit_fields()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null and auth.uid() is not null then
      new.created_by = auth.uid();
    end if;
  end if;

  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;

  return new;
end;
$function$;

create or replace function public.archive_listing(p_listing_id uuid, p_delete_reason text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  target_listing public.listings%rowtype;
  snapshot jsonb;
  archive_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not public.is_admin() then
    raise exception 'Only admins can archive listings.';
  end if;

  select *
  into target_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if target_listing.status = 'deleted' then
    raise exception 'Listing is already deleted.';
  end if;

  snapshot := jsonb_build_object(
    'listing', to_jsonb(target_listing),
    'photos', coalesce(
      (
        select jsonb_agg(to_jsonb(lp) order by lp.sort_order, lp.created_at)
        from public.listing_photos lp
        where lp.listing_id = target_listing.id
      ),
      '[]'::jsonb
    )
  );

  insert into public.deleted_listings (
    original_listing_id,
    listing_name,
    deleted_by,
    delete_reason,
    listing_snapshot
  )
  values (
    target_listing.id,
    target_listing.name,
    auth.uid(),
    p_delete_reason,
    snapshot
  )
  returning id into archive_id;

  update public.listings
  set
    status = 'deleted',
    deleted_at = now(),
    deleted_by = auth.uid(),
    updated_by = auth.uid()
  where id = target_listing.id;

  return archive_id;
end;
$function$;

create or replace function public.restore_listing(p_listing_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not public.is_admin() then
    raise exception 'Only admins can restore listings.';
  end if;

  update public.listings
  set
    status = 'active',
    deleted_at = null,
    deleted_by = null,
    updated_by = auth.uid()
  where id = p_listing_id;

  if not found then
    raise exception 'Listing not found.';
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Triggers (names and functions from prod)
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email on auth.users
for each row execute function public.sync_profile_email_from_auth();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists protect_profile_system_fields on public.profiles;
create trigger protect_profile_system_fields before update on public.profiles
for each row execute function public.protect_profile_system_fields();

drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at before update on public.listings
for each row execute function public.set_updated_at();

drop trigger if exists set_listing_audit_fields on public.listings;
create trigger set_listing_audit_fields before insert or update on public.listings
for each row execute function public.set_listing_audit_fields();

-- ---------------------------------------------------------------------------
-- RLS (verbatim from prod pg_policies)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.deleted_listings enable row level security;

create policy deleted_listings_insert_admin_only on public.deleted_listings for insert to authenticated with check (is_admin());
create policy deleted_listings_select_admin_only on public.deleted_listings for select to authenticated using (is_admin());
create policy listing_photos_delete_admin_only on public.listing_photos for delete to authenticated using (is_admin());
create policy listing_photos_insert_admin_only on public.listing_photos for insert to authenticated with check (is_admin());
create policy listing_photos_select_active_listing_or_admin on public.listing_photos for select to authenticated
  using (exists (select 1 from listings l where l.id = listing_photos.listing_id and (l.status = 'active'::listing_status or is_admin())));
create policy listing_photos_update_admin_only on public.listing_photos for update to authenticated using (is_admin()) with check (is_admin());
create policy listings_insert_admin_only on public.listings for insert to authenticated with check (is_admin());
create policy listings_select_active_or_admin on public.listings for select to authenticated using (status = 'active'::listing_status or is_admin());
create policy listings_update_admin_only on public.listings for update to authenticated using (is_admin()) with check (is_admin());
create policy profiles_insert_self_or_admin on public.profiles for insert to authenticated with check (id = auth.uid() or is_admin());
create policy profiles_select_own_or_admin on public.profiles for select to authenticated using (id = auth.uid() or is_admin());
create policy profiles_update_own_or_admin on public.profiles for update to authenticated using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', true) on conflict do nothing;
create policy storage_delete_listing_photos_admin_only on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos'::text and is_admin());
create policy storage_insert_listing_photos_admin_only on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos'::text and is_admin());
create policy storage_select_listing_photos on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos'::text);
create policy storage_update_listing_photos_admin_only on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos'::text and is_admin()) with check (bucket_id = 'listing-photos'::text and is_admin());

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
