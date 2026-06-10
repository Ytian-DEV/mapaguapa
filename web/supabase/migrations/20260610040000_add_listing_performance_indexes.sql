create index if not exists listings_status_created_at_idx
on public.listings(status, created_at desc);

create index if not exists listings_status_accommodation_type_idx
on public.listings(status, accommodation_type);

create index if not exists listings_monthly_rent_min_idx
on public.listings(monthly_rent_min);

create index if not exists listings_monthly_rent_max_idx
on public.listings(monthly_rent_max);

create index if not exists listings_status_monthly_rent_range_idx
on public.listings(status, monthly_rent_min, monthly_rent_max);

create index if not exists listings_status_wifi_idx
on public.listings(status, has_wifi);

create index if not exists listings_status_study_area_idx
on public.listings(status, has_study_area);

create index if not exists listings_status_laundry_area_idx
on public.listings(status, has_laundry_area);

create index if not exists listings_status_parking_area_idx
on public.listings(status, has_parking_area);

create index if not exists listings_status_pets_allowed_idx
on public.listings(status, pets_allowed);

create index if not exists listings_status_visitors_allowed_idx
on public.listings(status, visitors_allowed);

create index if not exists listing_photos_listing_cover_sort_idx
on public.listing_photos(listing_id, is_cover, sort_order);

create index if not exists listing_photos_listing_id_idx
on public.listing_photos(listing_id);
