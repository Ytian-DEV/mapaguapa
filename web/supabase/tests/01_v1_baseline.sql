-- Approximate reconstruction of the v1 production schema that is NOT in
-- migrations (it was created in the Supabase dashboard). Built from
-- web/src/lib/database.ts so the v2 migrations can be tested locally.
-- Replace with a real `supabase db dump` when available. Test fixture only.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
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
  status text not null default 'active' constraint listings_status_check check (status in ('active', 'deleted')),
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

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

create or replace function public.archive_listing(p_listing_id uuid, p_delete_reason text default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_listing public.listings;
  v_archive_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can archive listings.';
  end if;
  select * into v_listing from public.listings where id = p_listing_id and status = 'active';
  if not found then
    raise exception 'Listing not found.';
  end if;
  insert into public.deleted_listings (original_listing_id, listing_name, deleted_by, delete_reason, listing_snapshot)
  values (v_listing.id, v_listing.name, auth.uid(), p_delete_reason, to_jsonb(v_listing))
  returning id into v_archive_id;
  update public.listings set status = 'deleted', deleted_by = auth.uid(), deleted_at = now() where id = p_listing_id;
  return v_archive_id;
end;
$$;

create or replace function public.restore_listing(p_listing_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can restore listings.';
  end if;
  update public.listings set status = 'active', deleted_by = null, deleted_at = null where id = p_listing_id;
  delete from public.deleted_listings where original_listing_id = p_listing_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.deleted_listings enable row level security;

create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles self insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles admin update" on public.profiles for update to authenticated using (public.is_admin());
create policy "listings read active" on public.listings for select to anon, authenticated using (status = 'active' or public.is_admin());
create policy "listings admin write" on public.listings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "photos read" on public.listing_photos for select to anon, authenticated using (true);
create policy "photos admin write" on public.listing_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "deleted admin read" on public.deleted_listings for select to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', true) on conflict do nothing;
create policy "listing photos public read" on storage.objects for select to anon, authenticated using (bucket_id = 'listing-photos');
create policy "listing photos admin write" on storage.objects for all to authenticated
  using (bucket_id = 'listing-photos' and public.is_admin()) with check (bucket_id = 'listing-photos' and public.is_admin());

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
