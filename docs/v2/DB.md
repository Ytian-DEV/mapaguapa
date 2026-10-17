# MAPAGUAPA v2 — Database changes

All v2 schema work is in `web/supabase/migrations/` (run in filename order). **Nothing here has been run against Supabase.** It was tested on a local PostgreSQL 18 database, using a stub of the Supabase pieces it depends on and a copy of the v1 schema built from prod's real functions, triggers and policies (see "How it was tested").

## Apply order

Run these 6 files after the four existing v1 migrations (`20260526…` to `20260610…`), which are already live:

| # | File | What it does |
|---|---|---|
| 1 | `20261016010000_v2_roles.sql` | Roles become `student/owner/admin` (`user` rows are changed to `student`). A trigger on `auth.users` creates each profile using the sign-up `account_type`. Users can't change their own role or status. Adds the private `app` schema helpers and the `profile_cards` view. |
| 2 | `20261016020000_v2_listings.sql` | Adds the listing status workflow, owner columns, and price fields (`rent_exact`, which sets `price_band`). Replaces the RLS on listings, photos and the archive. Adds a storage policy so owners can upload. Rewrites `archive_listing()` and `restore_listing()` with the same arguments. |
| 3 | `20261016030000_v2_messaging.sql` | Adds conversations, messages, visit requests, owner notes, saved replies, the `inbox` view, the messaging RPCs, a private `message-attachments` bucket, and Realtime publication. |
| 4 | `20261016040000_v2_moderation.sql` | Adds reports, owner verifications (with a private `owner-verifications` bucket), and `activity_log` with the triggers that fill it. |
| 5 | `20261016050000_v2_admin.sql` | Adds `pg_trgm`, the `listing_rows` view, and the RPCs `admin_overview()`, `admin_users()`, `admin_set_role/active()`, `admin_merge_users()`, `similar_listings()` and `touch_last_active()`. |
| 6 | `20261016060000_v2_owner_stats.sql` | Adds `listing_views` (one per viewer per listing per day) with `record_listing_view()`, the `owner_overview()` stats RPC (frame O1) and `listings.draft_step`. |
| 7 | `20261016070000_v2_cleanup.sql` | Drops the unused v1 enum types `user_role` and `listing_status` (only if nothing depends on them; never CASCADE). The legacy `user` → `student` role rewrite stays, so browsers still on the cached v1 bundle can sign up on deploy day. |

How to apply (deploy day, production only; there is no staging project):

1. Back up the database (Database → Backups, or `pg_dump`).
2. Open the SQL editor and paste each `20261016…` file **in the order above**, running one at a time. Every file can be run again safely.
3. Check that each run finishes with "Success" before pasting the next one.

The four `202605…`/`202606…` migrations are already in production (the 2026-10-16 check showed their columns and tables), so skip them.

> **Deploy coupling:** after migration 2, v1 listings are stored as `published` / `archived`. The live v1 app filters on `status = 'active'`, so **apply the migrations and deploy v2 in the same window**. This was agreed on 2026-10-16. `develop` already reads `published`, so local dev against an unmigrated project will show no listings. That is expected until deploy day.

## Checked against production (2026-10-16)

You ran the read-only check queries on prod. The migrations and the test copy of v1 (`tests/01_v1_baseline.sql`) now match what they returned:

| Prod has | How v2 handles it |
|---|---|
| `listings.status` is the enum `listing_status` (`active`, `deleted`), and the policies `listings_select_active_or_admin` and `listing_photos_select_active_listing_or_admin` reference it | Migration 2 drops the v1 policies on `listings`, `listing_photos` and `deleted_listings` **before** converting the column to text. Without that order, Postgres refuses the type change. The old `listing_status` type is left in place unused. |
| No check constraints on `profiles` or `listings` | Nothing to drop. If `profiles.role` is an enum, migration 1 converts it to text the same way, after dropping the profiles policies. |
| `protect_profile_system_fields` trigger (blocks non-admin role / active / email changes) | Dropped in migration 1. `app.profiles_guard` now does the same job, including the email rule, but still accepts emails synced from `auth.users`. |
| `handle_new_user` upserts email, name and avatar | Kept as an upsert. v2 also sets `role` from the sign-up `account_type`, but only on the first insert. |
| `sync_profile_email_from_auth`, `set_updated_at` triggers, `set_listing_audit_fields` | Left as they are. They run after the v2 triggers and don't conflict. |
| `archive_listing` snapshot is `{listing, photos}`; `restore_listing` keeps the `deleted_listings` row | Kept as in v1, using the v2 status values. |
| `public.is_admin()`, used by the 4 storage policies on `listing-photos` | Not touched. Those storage policies stay, and the v2 storage policies are added next to them. |
| Every policy is `to authenticated` (no signed-out access) | v2 keeps this: listings, photos, `profile_cards` and `listing_rows` all need sign-in. |

To check prod again, run each query **on its own** (the SQL editor only shows the last result):

```sql
select t.tgname, p.proname, pg_get_functiondef(p.oid) as definition
from pg_trigger t join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and t.tgrelid in ('auth.users'::regclass, 'public.profiles'::regclass, 'public.listings'::regclass);
```
```sql
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname in ('public', 'storage') order by 1, 2;
```
```sql
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in ('public.profiles'::regclass, 'public.listings'::regclass) and contype = 'c';
```
```sql
select oid::regprocedure as signature, pg_get_functiondef(oid) as definition
from pg_proc where proname in ('archive_listing', 'restore_listing', 'handle_new_user', 'is_admin') and pronamespace = 'public'::regnamespace;
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
2. Loads `01_v1_baseline.sql` (v1 schema with prod's enum, functions, triggers and policies) and `02_v1_seed.sql`.
3. Applies every migration **twice** to prove they can be re-run.
4. Runs `*.test.sql`. These tests sign in as different users through the JWT claim settings and check every RLS rule, guard, trigger and RPC above. That is 139 assertions, including that students only see `published` listings, owners can't self-publish, only participants read conversations, and admins-only RPCs refuse other users.

After changing a migration, regenerate the TypeScript types:

```bash
cd web && PSQL="C:/Program Files/PostgreSQL/18/bin/psql.exe" PGPORT=54329 node scripts/gen-db-types.mjs
```

## Behaviour notes for the app features

- **Listing status:** owners may only move `draft → in_review` (or back to `draft`), and `changes_requested → in_review`. Any owner edit to a `published` listing, including its photos, moves it back to `in_review`.
- **Price fields:** `price_band`, `monthly_rent_min/max` and `monthly_rental_label` are derived values. Write `rent_exact` (and `room_types[].rent`).
- **Messages:** send by inserting into `messages` (`kind` `text` or `image`). Everything else goes through the RPCs: `start_conversation`, `mark_conversation_read`, `set_inquiry_status`, `set_conversation_blocked`, `request_visit` and `respond_visit`.
- **Attachments:** message files go in `message-attachments/<conversation_id>/…`. Verification documents go in `owner-verifications/<owner_id>/…`.
- **Owner sign-up with Google:** OAuth can't carry the account type, so the app calls `become_owner()` after the first sign-in. It only works for student accounts less than 24 hours old.
- **Profile names:** read other people's names and badges from `profile_cards`. `profiles` itself only returns your own row (or every row for admins).
