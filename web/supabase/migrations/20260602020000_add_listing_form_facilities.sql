alter table public.listings
  add column if not exists bills_included text,
  add column if not exists has_refrigerator boolean,
  add column if not exists has_television boolean,
  add column if not exists other_amenities text,
  add column if not exists visitor_time text,
  add column if not exists smoking_allowed boolean,
  add column if not exists has_emergency_exit boolean,
  add column if not exists has_fire_alarm boolean,
  add column if not exists has_emergency_lights boolean,
  add column if not exists has_fire_extinguisher boolean,
  add column if not exists has_smoke_detector boolean,
  add column if not exists has_sprinkler boolean;
