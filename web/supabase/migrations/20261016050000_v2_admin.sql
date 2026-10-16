-- MAPAGUAPA v2 — admin and owner read models + admin RPCs
-- * listing_rows view: listings with photo count, cover and owner name (RLS applies).
-- * admin_overview(): every number on A1 and the sidebar counts in one call.
-- * admin_users(): server-side paginated users (A4) with duplicate flag.
-- * admin_set_role / admin_set_active / admin_merge_users: guarded, logged.
-- * similar_listings(): review-queue auto-check (same owner + barangay, or similar name).
-- * touch_last_active(): lets the client record "last active".
-- Requires all earlier v2 migrations. Safe to re-run.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Barangay / area label from a free-text address (first comma segment).
-- ---------------------------------------------------------------------------
create or replace function app.area_of(p_address text) returns text
language sql immutable
as $$
  select coalesce(nullif(trim(split_part(coalesce(p_address, ''), ',', 1)), ''), 'Baybay City')
$$;

create index if not exists listings_area_idx on public.listings(app.area_of(address));
create index if not exists listings_name_trgm_idx on public.listings using gin (lower(name) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- listing_rows: one row per visible listing for tables and cards.
-- security_invoker so listings/photos RLS still decides what the caller sees.
-- ---------------------------------------------------------------------------
create or replace view public.listing_rows
with (security_invoker = true)
as
select
  l.id,
  l.name,
  l.address,
  app.area_of(l.address) as area,
  l.accommodation_type,
  l.exclusivity,
  l.status,
  l.price_band,
  l.rent_exact,
  l.monthly_rental_label,
  l.monthly_rent_min,
  l.monthly_rent_max,
  l.rooms_total,
  l.rooms_available,
  l.owner_id,
  owner.full_name as owner_name,
  owner.is_verified_owner as owner_is_verified,
  case when l.owner_id is null then 'admin' else 'owner' end as added_by,
  l.review_note,
  l.submitted_at,
  l.published_at,
  l.created_at,
  l.updated_at,
  l.deleted_at as archived_at,
  l.location_lat,
  l.location_lng,
  coalesce(photos.photo_count, 0)::integer as photo_count,
  cover.storage_bucket as cover_bucket,
  cover.storage_path as cover_path
from public.listings l
left join public.profile_cards owner on owner.id = l.owner_id
left join lateral (
  select count(*) as photo_count from public.listing_photos p where p.listing_id = l.id
) photos on true
left join lateral (
  select p.storage_bucket, p.storage_path
  from public.listing_photos p
  where p.listing_id = l.id
  order by p.is_cover desc, p.sort_order asc, p.created_at asc
  limit 1
) cover on true;

revoke all on public.listing_rows from anon;
grant select on public.listing_rows to authenticated;

-- ---------------------------------------------------------------------------
-- Duplicate detection: same normalised name, different email.
-- ---------------------------------------------------------------------------
create or replace function app.normalised_name(p_name text) returns text
language sql immutable
as $$
  select nullif(regexp_replace(lower(trim(coalesce(p_name, ''))), '\s+', ' ', 'g'), '')
$$;

create index if not exists profiles_normalised_name_idx on public.profiles(app.normalised_name(full_name));

-- ---------------------------------------------------------------------------
-- admin_overview
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not app.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  with
    listing_counts as (
      select
        count(*) filter (where status = 'published') as published,
        count(*) filter (where status = 'in_review') as in_review,
        count(*) filter (where status = 'changes_requested') as changes_requested,
        count(*) filter (where status = 'draft') as drafts,
        count(*) filter (where status = 'archived') as archived,
        min(submitted_at) filter (where status = 'in_review') as oldest_in_review_at,
        count(*) filter (where status = 'published' and not exists (
          select 1 from listing_photos p where p.listing_id = listings.id
        )) as published_without_photos
      from listings
    ),
    bands as (
      select jsonb_object_agg(band, coalesce(c, 0)) as by_band
      from (values ('under_1000'), ('1000_1999'), ('2000_2999'), ('3000_plus')) b(band)
      left join (
        select price_band, count(*) as c from listings where status = 'published' group by price_band
      ) counts on counts.price_band = b.band
    ),
    user_counts as (
      select
        count(*) as total,
        count(*) filter (where role = 'student' and is_active) as students,
        count(*) filter (where role = 'owner' and is_active) as owners,
        count(*) filter (where role = 'admin' and is_active) as admins,
        count(*) filter (where not is_active) as deactivated
      from profiles
    ),
    duplicates as (
      select count(distinct p.id) as duplicate_accounts
      from profiles p
      join profiles q
        on app.normalised_name(q.full_name) = app.normalised_name(p.full_name)
       and q.id <> p.id
       and lower(coalesce(q.email, '')) <> lower(coalesce(p.email, ''))
      where app.normalised_name(p.full_name) is not null and p.merged_into is null and q.merged_into is null
    ),
    report_counts as (
      select
        count(*) filter (where status = 'open') as open_reports,
        (select r.reason from reports r where r.status = 'open' order by r.created_at desc limit 1) as latest_open_reason
      from reports
    ),
    verification_counts as (
      select count(*) filter (where status = 'pending') as pending_verifications from owner_verifications
    )
  select jsonb_build_object(
    'listings', jsonb_build_object(
      'published', lc.published,
      'in_review', lc.in_review,
      'changes_requested', lc.changes_requested,
      'drafts', lc.drafts,
      'archived', lc.archived,
      'oldest_in_review_at', lc.oldest_in_review_at,
      'published_without_photos', lc.published_without_photos
    ),
    'photos', (select count(*) from listing_photos p join listings l on l.id = p.listing_id where l.status <> 'archived'),
    'price_bands', b.by_band,
    'users', jsonb_build_object(
      'total', uc.total,
      'students', uc.students,
      'owners', uc.owners,
      'admins', uc.admins,
      'deactivated', uc.deactivated,
      'possible_duplicates', d.duplicate_accounts
    ),
    'reports', jsonb_build_object('open', rc.open_reports, 'latest_open_reason', rc.latest_open_reason),
    'verifications', jsonb_build_object('pending', vc.pending_verifications)
  )
  into v_result
  from listing_counts lc, bands b, user_counts uc, duplicates d, report_counts rc, verification_counts vc;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_users: one page of users plus the total for pagination
-- p_tab: all | student | owner | admin | deactivated
-- p_sort: newest | oldest | name | last_active
-- ---------------------------------------------------------------------------
create or replace function public.admin_users(
  p_search text default null,
  p_tab text default 'all',
  p_sort text default 'newest',
  p_page integer default 0,
  p_page_size integer default 20
)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  is_active boolean,
  is_verified_owner boolean,
  possible_duplicate boolean,
  merged_into uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  total_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
begin
  if not app.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select p.*
    from profiles p
    where (
        coalesce(p_tab, 'all') = 'all'
        or (p_tab = 'deactivated' and not p.is_active)
        or (p_tab in ('student', 'owner', 'admin') and p.role = p_tab and p.is_active)
      )
      and (
        v_search is null
        or p.full_name ilike '%' || v_search || '%'
        or p.email ilike '%' || v_search || '%'
      )
  )
  select
    f.id,
    f.email,
    f.full_name,
    f.avatar_url,
    f.role,
    f.is_active,
    f.verified_owner_at is not null,
    f.merged_into is null and exists (
      select 1 from profiles q
      where q.id <> f.id
        and q.merged_into is null
        and app.normalised_name(q.full_name) = app.normalised_name(f.full_name)
        and lower(coalesce(q.email, '')) <> lower(coalesce(f.email, ''))
    ),
    f.merged_into,
    f.created_at,
    f.last_active_at,
    count(*) over ()
  from filtered f
  order by
    case when p_sort = 'name' then lower(f.full_name) end asc nulls last,
    case when p_sort = 'oldest' then f.created_at end asc,
    case when p_sort = 'last_active' then f.last_active_at end desc nulls last,
    f.created_at desc,
    f.id
  offset greatest(coalesce(p_page, 0), 0) * v_size
  limit v_size;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role / active changes (the profiles trigger writes the activity log)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not app.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if p_role not in ('student', 'owner', 'admin') then
    raise exception 'Unknown role %.', p_role using errcode = '22023';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin role.' using errcode = '42501';
  end if;
  update profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_set_active(p_user_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not app.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() and not p_active then
    raise exception 'You cannot deactivate your own account.' using errcode = '42501';
  end if;
  update profiles
  set is_active = p_active,
      deactivated_at = case when p_active then null else now() end
  where id = p_user_id;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Moves everything from p_duplicate_id onto p_keep_id, then deactivates the duplicate.
create or replace function public.admin_merge_users(p_keep_id uuid, p_duplicate_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_keep profiles;
  v_dup profiles;
begin
  if not app.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  if p_keep_id = p_duplicate_id then
    raise exception 'Pick two different accounts.' using errcode = '22023';
  end if;
  if p_duplicate_id = auth.uid() then
    raise exception 'You cannot merge away your own account.' using errcode = '42501';
  end if;

  select * into v_keep from profiles where id = p_keep_id;
  select * into v_dup from profiles where id = p_duplicate_id;
  if v_keep.id is null or v_dup.id is null then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  if v_dup.merged_into is not null then
    raise exception 'That account was already merged.' using errcode = '22023';
  end if;

  -- Saved listings (skip ones the kept account already saved)
  update saved_listings s set user_id = p_keep_id
  where s.user_id = p_duplicate_id
    and not exists (select 1 from saved_listings k where k.user_id = p_keep_id and k.accommodation_id = s.accommodation_id);
  delete from saved_listings where user_id = p_duplicate_id;

  -- Conversations as student (skip listings the kept account already talks about)
  update conversations c set student_id = p_keep_id
  where c.student_id = p_duplicate_id
    and c.owner_id <> p_keep_id
    and not exists (select 1 from conversations k where k.student_id = p_keep_id and k.listing_id = c.listing_id);
  update conversations set owner_id = p_keep_id where owner_id = p_duplicate_id and student_id <> p_keep_id;

  update listings set owner_id = p_keep_id where owner_id = p_duplicate_id;
  update reports set reporter_id = p_keep_id where reporter_id = p_duplicate_id;
  update owner_verifications set owner_id = p_keep_id where owner_id = p_duplicate_id and status <> 'pending';
  update saved_replies set owner_id = p_keep_id where owner_id = p_duplicate_id;

  -- The kept account takes the higher role and keeps any verification.
  update profiles
  set role = case
        when 'admin' in (v_keep.role, v_dup.role) then 'admin'
        when 'owner' in (v_keep.role, v_dup.role) then 'owner'
        else 'student'
      end,
      verified_owner_at = coalesce(v_keep.verified_owner_at, v_dup.verified_owner_at),
      full_name = coalesce(v_keep.full_name, v_dup.full_name),
      phone = coalesce(v_keep.phone, v_dup.phone)
  where id = p_keep_id;

  update profiles
  set is_active = false, deactivated_at = now(), merged_into = p_keep_id
  where id = p_duplicate_id;

  perform app.log_activity('user.merged', 'user', p_keep_id, coalesce(v_keep.full_name, v_keep.email),
    jsonb_build_object('merged_id', p_duplicate_id, 'merged_email', v_dup.email));
end;
$$;

-- ---------------------------------------------------------------------------
-- Review queue auto-check
-- ---------------------------------------------------------------------------
create or replace function public.similar_listings(p_listing_id uuid)
returns table (id uuid, name text, area text, status text, owner_id uuid, reason text, score real)
language plpgsql stable security definer set search_path = public, extensions, pg_temp
as $$
declare
  v_listing listings;
begin
  if not app.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;
  select * into v_listing from listings where listings.id = p_listing_id;
  if not found then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;

  return query
  select
    l.id,
    l.name,
    app.area_of(l.address),
    l.status,
    l.owner_id,
    case
      when v_listing.owner_id is not null and l.owner_id = v_listing.owner_id
        and app.area_of(l.address) ilike app.area_of(v_listing.address) then 'same_owner_and_area'
      else 'similar_name'
    end,
    similarity(lower(l.name), lower(v_listing.name))
  from listings l
  where l.id <> v_listing.id
    and (
      (v_listing.owner_id is not null and l.owner_id = v_listing.owner_id
        and app.area_of(l.address) ilike app.area_of(v_listing.address))
      or similarity(lower(l.name), lower(v_listing.name)) >= 0.45
    )
  order by 7 desc
  limit 10;
end;
$$;

-- ---------------------------------------------------------------------------
-- Last active (called by the client at most every few minutes)
-- ---------------------------------------------------------------------------
create or replace function public.touch_last_active() returns void
language sql security definer set search_path = public, pg_temp
as $$
  update profiles set last_active_at = now()
  where id = auth.uid() and (last_active_at is null or last_active_at < now() - interval '5 minutes');
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_users(text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
revoke all on function public.admin_set_active(uuid, boolean) from public, anon;
revoke all on function public.admin_merge_users(uuid, uuid) from public, anon;
revoke all on function public.similar_listings(uuid) from public, anon;
revoke all on function public.touch_last_active() from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_users(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;
grant execute on function public.admin_merge_users(uuid, uuid) to authenticated;
grant execute on function public.similar_listings(uuid) to authenticated;
grant execute on function public.touch_last_active() to authenticated;
grant execute on function app.area_of(text), app.normalised_name(text) to anon, authenticated, service_role;
