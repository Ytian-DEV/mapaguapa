-- MAPAGUAPA v2 — owner overview (frame O1)
-- * listing_views: one row per viewer per listing per day (no raw tracking).
-- * record_listing_view(): called by the listing page; ignores the owner's own views.
-- * owner_overview(): views (30 days + previous 30 for the trend), new / unread
--   inquiries, average first-reply time, and per-listing views / inquiries.
-- * listings.draft_step: last wizard step, for "Step 2 of 8" on drafts.
-- Requires all earlier v2 migrations. Safe to re-run.

alter table public.listings add column if not exists draft_step smallint;
alter table public.listings drop constraint if exists listings_draft_step_check;
alter table public.listings add constraint listings_draft_step_check check (draft_step is null or draft_step between 1 and 8);

-- Same view as the admin migration with draft_step appended (new columns must go last).
-- Dropped first so re-running older files never conflicts with newer columns.
drop view if exists public.listing_rows;
create view public.listing_rows
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
  app.vsu_distance_km(l.location_lat, l.location_lng) as distance_km,
  l.exclusivity_group,
  l.curfew,
  app.has_curfew(l.curfew) as has_curfew,
  l.has_wifi,
  l.has_study_area,
  l.has_laundry_area,
  l.has_parking_area,
  l.has_common_kitchen,
  l.has_aircon,
  l.pets_allowed,
  l.visitors_allowed,
  coalesce(photos.photo_count, 0)::integer as photo_count,
  cover.storage_bucket as cover_bucket,
  cover.storage_path as cover_path,
  l.draft_step
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

create table if not exists public.listing_views (
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_on date not null default current_date,
  primary key (listing_id, viewer_id, viewed_on)
);

create index if not exists listing_views_listing_day_idx on public.listing_views(listing_id, viewed_on);

alter table public.listing_views enable row level security;
-- No policies: written by record_listing_view(), read through owner_overview().

create or replace function public.record_listing_view(p_listing_id uuid) returns void
language sql security definer set search_path = public, pg_temp
as $$
  insert into listing_views (listing_id, viewer_id)
  select l.id, auth.uid()
  from listings l
  where l.id = p_listing_id
    and l.status = 'published'
    and auth.uid() is not null
    and l.owner_id is distinct from auth.uid()
  on conflict do nothing;
$$;

create or replace function public.owner_overview() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if not (app.is_owner() or app.is_admin()) then
    raise exception 'Owners only.' using errcode = '42501';
  end if;

  with
    mine as (
      select id from listings where owner_id = v_uid and status <> 'archived'
    ),
    views as (
      select
        v.listing_id,
        count(*) filter (where v.viewed_on > current_date - 30) as last_30,
        count(*) filter (where v.viewed_on <= current_date - 30 and v.viewed_on > current_date - 60) as prev_30
      from listing_views v
      join mine m on m.id = v.listing_id
      group by v.listing_id
    ),
    convos as (
      select c.*
      from conversations c
      where c.owner_id = v_uid
    ),
    per_listing as (
      select
        m.id,
        coalesce(v.last_30, 0) as views_30d,
        (select count(*) from convos c where c.listing_id = m.id) as inquiries
      from mine m
      left join views v on v.listing_id = m.id
    ),
    replies as (
      -- Time from the student's first message to the owner's first reply (last 90 days).
      select extract(epoch from (
        (select min(created_at) from messages x where x.conversation_id = c.id and x.sender_id = c.owner_id)
        - (select min(created_at) from messages x where x.conversation_id = c.id and x.sender_id = c.student_id)
      )) / 60 as minutes
      from convos c
      where c.created_at > now() - interval '90 days'
    )
  select jsonb_build_object(
    'views_30d', coalesce((select sum(last_30) from views), 0),
    'views_prev_30d', coalesce((select sum(prev_30) from views), 0),
    'new_inquiries', (select count(*) from convos where inquiry_status = 'new'),
    'unread', (
      select count(*) from convos c
      where exists (
        select 1 from messages m
        where m.conversation_id = c.id
          and m.sender_id is distinct from v_uid
          and m.created_at > coalesce(c.owner_last_read_at, '-infinity')
      )
    ),
    'avg_reply_minutes', (select round(avg(minutes)) from replies where minutes is not null and minutes >= 0),
    'listings', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'views_30d', views_30d, 'inquiries', inquiries)) from per_listing), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.record_listing_view(uuid) from public, anon;
revoke all on function public.owner_overview() from public, anon;
grant execute on function public.record_listing_view(uuid) to authenticated;
grant execute on function public.owner_overview() to authenticated;
