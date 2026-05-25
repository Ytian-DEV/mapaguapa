alter table public.listings
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

comment on column public.listings.location_lat is 'Latitude coordinate for the listing map pin.';
comment on column public.listings.location_lng is 'Longitude coordinate for the listing map pin.';
