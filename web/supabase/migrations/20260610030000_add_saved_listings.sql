create table if not exists public.saved_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  accommodation_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  constraint saved_listings_user_accommodation_key unique (user_id, accommodation_id)
);

alter table public.saved_listings enable row level security;

drop policy if exists "Students can select own saved listings" on public.saved_listings;
create policy "Students can select own saved listings"
on public.saved_listings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Students can insert own saved listings" on public.saved_listings;
create policy "Students can insert own saved listings"
on public.saved_listings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Students can delete own saved listings" on public.saved_listings;
create policy "Students can delete own saved listings"
on public.saved_listings
for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists saved_listings_user_id_idx on public.saved_listings(user_id);
create index if not exists saved_listings_accommodation_id_idx on public.saved_listings(accommodation_id);
