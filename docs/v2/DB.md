# MAPAGUAPA v2 — Database changes

All v2 schema work is in `web/supabase/migrations/` (run in filename order). **Nothing here has been run against Supabase.** It was tested on a local PostgreSQL 18 database, using a stub of the Supabase pieces it depends on and a reconstructed v1 schema (see "How it was tested").

## Apply order

Run these after the four existing v1 migrations (`20260526…` to `20260610…`), which are already live:

| # | File | What it does |
|---|---|---|
| 1 | `20261016010000_v2_roles.sql` | Roles become `student/owner/admin` (`user` rows are changed to `student`). A trigger on `auth.users` creates each profile using the sign-up `account_type`. Users can't change their own role or status. Adds the private `app` schema helpers and the `profile_cards` view. |
| 2 | `20261016020000_v2_listings.sql` | Adds the listing status workflow, owner columns, and price fields (`rent_exact`, which sets `price_band`). Replaces the RLS on listings, photos and the archive. Adds a storage policy so owners can upload. Rewrites `archive_listing()` and `restore_listing()` with the same arguments. |
| 3 | `20261016030000_v2_messaging.sql` | Adds conversations, messages, visit requests, owner notes, saved replies, the `inbox` view, the messaging RPCs, a private `message-attachments` bucket, and Realtime publication. |
| 4 | `20261016040000_v2_moderation.sql` | Adds reports, owner verifications (with a private `owner-verifications` bucket), and `activity_log` with the triggers that fill it. |
| 5 | `20261016050000_v2_admin.sql` | Adds `pg_trgm`, the `listing_rows` view, and the RPCs `admin_overview()`, `admin_users()`, `admin_set_role/active()`, `admin_merge_users()`, `similar_listings()` and `touch_last_active()`. |

How to apply (staging first):

```bash
# from the repo root, with the Supabase CLI linked to the target project
npx supabase db push --workdir web
```

You can also paste each file into the SQL editor, in order. Every file can be run again safely.

> **Deploy coupling:** after migration 2, v1 listings are stored as `published` / `archived`. The live v1 app filters on `status = 'active'`, so **apply the migrations and deploy v2 in the same window**. This was agreed on 2026-10-16. `develop` already reads `published`, so local dev against an unmigrated project will show no listings. Use a staging project that has the migrations.

## Things to check on the real database first

There is no schema dump yet. These points are based on `web/src/lib/database.ts` and the v1 code:

1. **`profiles.role` / `listings.status`.** The migrations drop *every* check constraint whose definition mentions these columns, and convert an enum column to text if there is one.
2. **Existing RLS policies on `profiles`, `listings`, `listing_photos`, `deleted_listings`.** These are **all dropped and replaced**, whatever they are called. Storage policies are **not** dropped; the v2 ones are added next to them.
3. **`archive_listing` / `restore_listing`.** All existing overloads are dropped and recreated, with `archive_listing(uuid, text) returns uuid` and `restore_listing(uuid) returns void`. Restoring sets the listing to `published` and deletes its `deleted_listings` row, which matches how the v1 Archive page works.
4. **`handle_new_user` / `on_auth_user_created`.** If prod already has these (the Supabase default names), they are replaced, not duplicated.
5. **Photo paths.** v1 admin uploads go to `admin/<listing_id>/…`. v2 owners upload to `owner/<listing_id>/…`.
6. **Public helpers.** Helpers live in the private `app` schema, so nothing in `public` (such as an existing `public.is_admin()`) is changed.

To check before applying, run this in the SQL editor and send me the output:

```sql
select tablename, policyname, cmd, qual from pg_policies where schemaname in ('public', 'storage') order by 1, 2;
select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.profiles'::regclass, 'public.listings'::regclass) and contype = 'c';
select oid::regprocedure, pg_get_functiondef(oid) from pg_proc where proname in ('archive_listing', 'restore_listing', 'handle_new_user', 'is_admin');
select tgname, tgrelid::regclass from pg_trigger where not tgisinternal and tgrelid in ('auth.users'::regclass, 'public.listings'::regclass, 'public.profiles'::regclass);
```

## Dashboard settings (not SQL)

- **Realtime:** migration 3 adds `conversations`, `messages` and `visit_requests` to `supabase_realtime`. Confirm they appear under Database → Replication.
- **Storage:** migrations 3 and 4 create the private buckets `message-attachments` and `owner-verifications`. Consider a 10 MB file limit and image/PDF MIME types in the dashboard.

## How it was tested

```bash
# any local Postgres 15+ (never Supabase: the script drops and recreates its database)
PSQL="C:/Program Files/PostgreSQL/18/bin/psql.exe" PGPORT=54329 bash web/supabase/tests/run.sh
```

`run.sh` runs these steps in order:

1. Builds `mapaguapa_test` from `tests/00_supabase_stub.sql`, which provides `auth.uid()`, `storage.objects`, roles and the realtime publication.
2. Loads `01_v1_baseline.sql` (reconstructed v1 schema, policies and functions) and `02_v1_seed.sql`.
3. Applies every migration **twice** to prove they can be re-run.
4. Runs `*.test.sql`. These tests sign in as different users through the JWT claim settings and check every RLS rule, guard, trigger and RPC above. That is 100+ assertions, including that students only see `published` listings, owners can't self-publish, only participants read conversations, and admins-only RPCs refuse other users.

After changing a migration, regenerate the TypeScript types:

```bash
cd web && PSQL="C:/Program Files/PostgreSQL/18/bin/psql.exe" PGPORT=54329 node scripts/gen-db-types.mjs
```

## Behaviour notes for the app features

- **Listing status:** owners may only move `draft → in_review` (or back to `draft`), and `changes_requested → in_review`. Any owner edit to a `published` listing, including its photos, moves it back to `in_review`.
- **Price fields:** `price_band`, `monthly_rent_min/max` and `monthly_rental_label` are derived values. Write `rent_exact` (and `room_types[].rent`).
- **Messages:** send by inserting into `messages` (`kind` `text` or `image`). Everything else goes through the RPCs: `start_conversation`, `mark_conversation_read`, `set_inquiry_status`, `set_conversation_blocked`, `request_visit` and `respond_visit`.
- **Attachments:** message files go in `message-attachments/<conversation_id>/…`. Verification documents go in `owner-verifications/<owner_id>/…`.
- **Profile names:** read other people's names and badges from `profile_cards`. `profiles` itself only returns your own row (or every row for admins).
