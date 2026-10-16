-- MAPAGUAPA v2 — listings workflow, pricing and RLS
-- * status: draft | in_review | changes_requested | published | archived
--   (v1 'active' -> published, 'deleted' -> archived; legacy values written by
--   the v1 admin client are still accepted and mapped).
-- * Owners create/edit only their own listings and can't publish or archive.
--   Editing a published listing sends it back to in_review.
-- * rent_exact drives price_band, monthly_rent_min/max and monthly_rental_label.
-- * archive_listing() / restore_listing() keep their v1 signatures and
--   behaviour ({listing, photos} snapshot; restore keeps the archive record).
-- * Reads require sign-in, as in v1.
-- Prod (2026-10-16) has status as the enum `listing_status` and two policies
-- that reference it, so all v1 policies are dropped before the type change.
-- Requires 20261016010000_v2_roles.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Drop v1 policies first (they depend on listings.status)
-- ---------------------------------------------------------------------------
do $$
declare
  v_policy record;
begin
  for v_policy in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('listings', 'listing_photos', 'deleted_listings')
  loop
    execute format('drop policy %I on public.%I', v_policy.policyname, v_policy.tablename);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists rent_exact numeric(10, 2),
  add column if not exists advance_deposit text,
  add column if not exists rooms_total integer,
  add column if not exists room_types jsonb not null default '[]'::jsonb,
  add column if not exists price_band text;

comment on column public.listings.owner_id is 'Owner account that manages this listing; null for admin-created listings.';
comment on column public.listings.review_note is 'Admin note shown to the owner when changes are requested.';
comment on column public.listings.rent_exact is 'Monthly rent per person in PHP. Drives price_band and the v1 rent columns.';
comment on column public.listings.advance_deposit is 'Advance/deposit terms, e.g. "1 month advance + 1 month deposit".';
comment on column public.listings.room_types is 'Array of {label, capacity, rent, available} for listings with mixed room prices.';
comment on column public.listings.price_band is 'under_1000 | 1000_1999 | 2000_2999 | 3000_plus. Derived; do not write directly.';

do $$
declare
  v_type text;
  v_constraint record;
begin
  select data_type into v_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'listings' and column_name = 'status';

  if v_type = 'USER-DEFINED' then
    alter table public.listings alter column status drop default;
    alter table public.listings alter column status type text using status::text;
  end if;

  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'listings'
      and con.contype = 'c'
      and (pg_get_constraintdef(con.oid) ilike '%status%'
        or pg_get_constraintdef(con.oid) ilike '%price_band%'
        or pg_get_constraintdef(con.oid) ilike '%rent_exact%'
        or pg_get_constraintdef(con.oid) ilike '%room_types%'
        or pg_get_constraintdef(con.oid) ilike '%rooms_total%')
  loop
    execute format('alter table public.listings drop constraint %I', v_constraint.conname);
  end loop;
end
$$;

-- The guard trigger below does not exist yet on first run, so this is a plain update.
update public.listings set status = 'published' where status = 'active';
update public.listings set status = 'archived' where status = 'deleted';

alter table public.listings alter column status set default 'draft';
alter table public.listings
  add constraint listings_status_check
    check (status in ('draft', 'in_review', 'changes_requested', 'published', 'archived')),
  add constraint listings_price_band_check
    check (price_band is null or price_band in ('under_1000', '1000_1999', '2000_2999', '3000_plus')),
  add constraint listings_rent_exact_check check (rent_exact is null or rent_exact >= 0),
  add constraint listings_rooms_total_check check (rooms_total is null or rooms_total >= 0),
  add constraint listings_room_types_check check (jsonb_typeof(room_types) = 'array');

-- ---------------------------------------------------------------------------
-- Price band helpers
-- ---------------------------------------------------------------------------
create or replace function app.price_band_for(p_amount numeric) returns text
language sql immutable
as $$
  select case
    when p_amount is null then null
    when p_amount < 1000 then 'under_1000'
    when p_amount < 2000 then '1000_1999'
    when p_amount < 3000 then '2000_2999'
    else '3000_plus'
  end
$$;

create or replace function app.price_band_label(p_band text) returns text
language sql immutable
as $$
  select case p_band
    when 'under_1000' then 'Under ₱1,000'
    when '1000_1999' then '₱1,000–1,999'
    when '2000_2999' then '₱2,000–2,999'
    when '3000_plus' then '₱3,000+'
  end
$$;

-- Best-effort representative amount for legacy rows that only have v1 data.
create or replace function app.legacy_rent_amount(p_min numeric, p_max numeric, p_label text) returns numeric
language plpgsql immutable
as $$
declare
  v_number numeric;
begin
  if p_min is not null then
    return p_min;
  end if;
  if p_max is not null then
    return p_max;
  end if;
  v_number := nullif(regexp_replace(substring(coalesce(p_label, '') from '[0-9][0-9,]*'), ',', '', 'g'), '')::numeric;
  if v_number is not null and p_label ilike '%less than%' then
    v_number := v_number - 1;
  end if;
  return v_number;
end;
$$;

-- ---------------------------------------------------------------------------
-- Derive pricing columns (runs for everyone, before the guard)
-- ---------------------------------------------------------------------------
create or replace function app.listings_derive_price() returns trigger
language plpgsql
as $$
declare
  v_min numeric;
  v_max numeric;
begin
  if new.rent_exact is not null then
    select min(rent), max(rent)
      into v_min, v_max
    from (
      select new.rent_exact as rent
      union all
      select nullif(item ->> 'rent', '')::numeric
      from jsonb_array_elements(coalesce(new.room_types, '[]'::jsonb)) as item
    ) as rents
    where rent is not null;

    new.price_band := app.price_band_for(new.rent_exact);
    new.monthly_rent_min := v_min;
    new.monthly_rent_max := v_max;
    new.monthly_rental_label := app.price_band_label(new.price_band);
  else
    new.price_band := app.price_band_for(app.legacy_rent_amount(new.monthly_rent_min, new.monthly_rent_max, new.monthly_rental_label));
    new.monthly_rental_label := coalesce(nullif(new.monthly_rental_label, ''), app.price_band_label(new.price_band), 'Not specified');
  end if;

  return new;
end;
$$;

drop trigger if exists listings_10_derive_price on public.listings;
create trigger listings_10_derive_price
before insert or update on public.listings
for each row execute function app.listings_derive_price();

-- Backfill bands for existing rows (fires the derive trigger).
update public.listings set price_band = null where price_band is null;

-- ---------------------------------------------------------------------------
-- Workflow guard (runs after pricing; trigger names sort alphabetically)
-- ---------------------------------------------------------------------------
create or replace function app.listings_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- v1 admin client still writes 'active' / 'deleted'.
  if new.status = 'active' then
    new.status := 'published';
  elsif new.status = 'deleted' then
    new.status := 'archived';
  end if;

  new.updated_at := now();

  if app.is_trusted_context() or app.is_admin() then
    if tg_op = 'INSERT' then
      new.created_by := coalesce(new.created_by, v_uid);
    else
      new.updated_by := coalesce(v_uid, new.updated_by);
    end if;
    if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
      new.published_at := now();
      new.reviewed_at := now();
      new.reviewed_by := coalesce(v_uid, new.reviewed_by);
      new.review_note := null;
    elsif new.status = 'changes_requested' and (tg_op = 'INSERT' or old.status is distinct from 'changes_requested') then
      new.reviewed_at := now();
      new.reviewed_by := coalesce(v_uid, new.reviewed_by);
    end if;
    if new.status = 'in_review' and (tg_op = 'INSERT' or old.status is distinct from 'in_review') then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if not app.is_owner() then
    raise exception 'Only owners and admins can manage listings.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.owner_id := v_uid;
    new.created_by := v_uid;
    new.updated_by := v_uid;
    new.review_note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.published_at := null;
    new.deleted_at := null;
    new.deleted_by := null;
    if new.status not in ('draft', 'in_review') then
      raise exception 'New listings must start as a draft or be submitted for review.' using errcode = '42501';
    end if;
    new.submitted_at := case when new.status = 'in_review' then now() end;
    return new;
  end if;

  -- UPDATE by an owner
  if old.owner_id is distinct from v_uid or new.owner_id is distinct from old.owner_id then
    raise exception 'You can only edit your own listings.' using errcode = '42501';
  end if;
  if old.status = 'archived' then
    raise exception 'Archived listings can only be restored by an admin.' using errcode = '42501';
  end if;
  if new.status in ('published', 'archived', 'changes_requested') and new.status is distinct from old.status then
    raise exception 'Only an admin can publish, archive or request changes.' using errcode = '42501';
  end if;

  -- Admin-owned fields are not editable by owners.
  new.review_note := old.review_note;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  new.published_at := old.published_at;
  new.deleted_at := old.deleted_at;
  new.deleted_by := old.deleted_by;
  new.created_by := old.created_by;
  new.updated_by := v_uid;

  -- Any edit to a live listing goes back to the review queue.
  if old.status = 'published' then
    new.status := 'in_review';
  end if;

  if new.status = 'in_review' and old.status is distinct from 'in_review' then
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists listings_20_guard on public.listings;
create trigger listings_20_guard
before insert or update on public.listings
for each row execute function app.listings_guard();

create index if not exists listings_owner_id_idx on public.listings(owner_id);
create index if not exists listings_status_price_band_idx on public.listings(status, price_band);
create index if not exists listings_status_updated_at_idx on public.listings(status, updated_at desc);
create index if not exists listings_location_idx on public.listings(location_lat, location_lng) where status = 'published';

-- ---------------------------------------------------------------------------
-- RLS: listings, listing_photos, deleted_listings
-- (v1 policies were dropped at the top; drop-if-exists keeps re-runs working)
-- ---------------------------------------------------------------------------
drop policy if exists "listings: read published, own, or admin" on public.listings;
drop policy if exists "listings: owners and admins insert" on public.listings;
drop policy if exists "listings: owners update own, admins all" on public.listings;
drop policy if exists "listings: owners delete own drafts, admins all" on public.listings;
drop policy if exists "listing_photos: read with listing" on public.listing_photos;
drop policy if exists "listing_photos: owners and admins write" on public.listing_photos;
drop policy if exists "deleted_listings: admins read" on public.deleted_listings;

alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.deleted_listings enable row level security;

create policy "listings: read published, own, or admin"
on public.listings for select to authenticated
using (status = 'published' or owner_id = auth.uid() or app.is_admin());

create policy "listings: owners and admins insert"
on public.listings for insert to authenticated
with check ((app.is_owner() and owner_id = auth.uid()) or app.is_admin());

create policy "listings: owners update own, admins all"
on public.listings for update to authenticated
using ((owner_id = auth.uid() and status <> 'archived') or app.is_admin())
with check (owner_id = auth.uid() or app.is_admin());

create policy "listings: owners delete own drafts, admins all"
on public.listings for delete to authenticated
using ((owner_id = auth.uid() and status = 'draft') or app.is_admin());

-- Photos follow their listing's visibility (the subquery is itself filtered by RLS).
create policy "listing_photos: read with listing"
on public.listing_photos for select to authenticated
using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "listing_photos: owners and admins write"
on public.listing_photos for all to authenticated
using (
  app.is_admin()
  or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid() and l.status <> 'archived')
)
with check (
  app.is_admin()
  or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid() and l.status <> 'archived')
);

create policy "deleted_listings: admins read"
on public.deleted_listings for select to authenticated
using (app.is_admin());

-- Owner edits to photos also resubmit a published listing.
create or replace function app.listing_photos_touch_listing() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_listing_id uuid := coalesce(new.listing_id, old.listing_id);
begin
  if not app.is_trusted_context() and not app.is_admin() then
    update public.listings set status = 'in_review' where id = v_listing_id and status = 'published';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists listing_photos_touch_listing on public.listing_photos;
create trigger listing_photos_touch_listing
after insert or update or delete on public.listing_photos
for each row execute function app.listing_photos_touch_listing();

-- ---------------------------------------------------------------------------
-- Storage: owners upload to listing-photos/owner/<listing_id>/...
-- (existing admin policies are left in place; this one is additive)
-- ---------------------------------------------------------------------------
drop policy if exists "v2 listing photos: owners write own folder" on storage.objects;
create policy "v2 listing photos: owners write own folder"
on storage.objects for all to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(objects.name))[1] = 'owner'
  and exists (
    select 1 from public.listings l
    where l.id::text = (storage.foldername(objects.name))[2] and l.owner_id = auth.uid() and l.status <> 'archived'
  )
)
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(objects.name))[1] = 'owner'
  and exists (
    select 1 from public.listings l
    where l.id::text = (storage.foldername(objects.name))[2] and l.owner_id = auth.uid() and l.status <> 'archived'
  )
);

drop policy if exists "v2 listing photos: admins write" on storage.objects;
create policy "v2 listing photos: admins write"
on storage.objects for all to authenticated
using (bucket_id = 'listing-photos' and app.is_admin())
with check (bucket_id = 'listing-photos' and app.is_admin());

-- ---------------------------------------------------------------------------
-- archive_listing / restore_listing: v1 behaviour on the v2 statuses.
-- Dropped by name first so no stale overload can survive.
-- ---------------------------------------------------------------------------
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('archive_listing', 'restore_listing')
  loop
    execute format('drop function %s', v_fn.signature);
  end loop;
end
$$;

create function public.archive_listing(p_listing_id uuid, p_delete_reason text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_listing public.listings;
  v_snapshot jsonb;
  v_archive_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if not app.is_admin() then
    raise exception 'Only admins can archive listings.' using errcode = '42501';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;
  if v_listing.status = 'archived' then
    raise exception 'Listing is already archived.';
  end if;

  -- Same snapshot shape as v1.
  v_snapshot := jsonb_build_object(
    'listing', to_jsonb(v_listing),
    'photos', coalesce(
      (
        select jsonb_agg(to_jsonb(lp) order by lp.sort_order, lp.created_at)
        from public.listing_photos lp
        where lp.listing_id = v_listing.id
      ),
      '[]'::jsonb
    )
  );

  insert into public.deleted_listings (original_listing_id, listing_name, deleted_by, delete_reason, listing_snapshot)
  values (v_listing.id, v_listing.name, auth.uid(), p_delete_reason, v_snapshot)
  returning id into v_archive_id;

  update public.listings
  set status = 'archived', deleted_by = auth.uid(), deleted_at = now()
  where id = p_listing_id;

  return v_archive_id;
end;
$$;

create function public.restore_listing(p_listing_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if not app.is_admin() then
    raise exception 'Only admins can restore listings.' using errcode = '42501';
  end if;

  -- Like v1, the deleted_listings record is kept as history.
  update public.listings
  set status = 'published', deleted_by = null, deleted_at = null
  where id = p_listing_id and status = 'archived';

  if not found then
    raise exception 'Archived listing not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.archive_listing(uuid, text) from public, anon;
revoke all on function public.restore_listing(uuid) from public, anon;
grant execute on function public.archive_listing(uuid, text) to authenticated;
grant execute on function public.restore_listing(uuid) to authenticated;
grant execute on all functions in schema app to anon, authenticated, service_role;
