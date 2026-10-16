# MAPAGUAPA v2 — Implementation Plan

Status: **approved 2026-10-16** — MapTiler confirmed, migrations + v2 deploy in one window confirmed, schema dump to arrive before feature 2.

---

## 1. What I found

### Stack
| Area | Today |
|---|---|
| Location | App lives in `web/` (repo root holds only `README.md`, `.gitignore`). Vercel root dir = `web`. |
| Framework | Vite 5 + React 18.3 + TypeScript 5.9 (strict). |
| Routing | **None.** `App.tsx` reads `window.location.pathname` and switches between Auth / User / Admin / About pages by role. |
| Styling | Plain global CSS per area (`mapaguapa-user.css` 2.6k lines, `mapaguapa-admin.css` 2k, `mapaguapa-auth.css` 1k). v1 tokens in `index.css` (emerald/mint, Inter + Agoma from CDNs). No Tailwind. |
| Components | Three giant page components: `MapaguapaUserPage.tsx` (1.5k lines), `MapaguapaAdminPage.tsx` (1.9k), `MapaguapaAuthPage.tsx`. Shared: `PropertyMap`, `HouseMark`, `usePointerGlow` (glow effect — conflicts with v2 "no glows" rule). |
| Data layer | `lib/supabase.ts` (single client, default auth flow = **implicit**, hence `#access_token` in URL), `lib/database.ts` (hand-written types), `lib/listingService.ts` (queries, filters, pagination, saved listings), `lib/imageCompression.ts`. |
| Maps | Leaflet + react-leaflet 4, CARTO Voyager raster tiles (the "API KEY REQUIRED" watermark). Default centre 10.746, 124.793. |
| Quality gates | Only `npm run build` (`tsc -b && vite build`). **No lint script, no tests.** |
| Local DB | No Supabase CLI, no Docker on this machine → migrations can't be run locally. |

### Database (as visible from code)
- `profiles` — `role: "user" | "admin"`, `is_active`. Profile row is inserted **client-side** in `App.tsx` (`ensureProfile`) with `role: "user"`.
- `listings` — ~70 columns (wide boolean amenity model), `status: "active" | "deleted"`, price as **text** `monthly_rental_label` + `monthly_rent_min/max`, `rooms_available`, `created_by/updated_by/deleted_by`, `location_lat/lng`.
- `listing_photos` (bucket/path, `sort_order`, `is_cover`), `deleted_listings` (snapshot archive), `saved_listings` (RLS by `user_id`).
- RPCs `archive_listing(p_listing_id, p_delete_reason)` and `restore_listing(p_listing_id)`.
- **Only 4 incremental migrations are in the repo.** The base tables, their RLS policies, `archive_listing()`, `restore_listing()` and storage policies were created in the Supabase dashboard and are **not in source control**.

### Figma
- File has one page ("Student app") containing all frames. Screens render fine via the Figma MCP; no Figma variables are defined, so tokens come from the Foundations frame (matches section 3 of the brief).
- Admin sidebar in the design includes **Settings** (not in the feature list) and the A2 table shows a derived **"Needs photos"** badge.

---

## 2. Decisions / adjustments to the feature list

1. **Paths.** Migrations go in the existing `web/supabase/migrations/` (not a new root `supabase/`). Docs live in `docs/v2/` at repo root.
2. **Add `react-router-dom` (v6)** in `feature/design-system`. v2 has ~30 routes (`/listing/:id`, `/messages/:id`, `/owner/listings/:id/edit/:step`, `/admin/review/:id`…); hand-rolled pathname switching won't scale. `vercel.json` SPA rewrite already supports it.
3. **No Tailwind.** Tokens become CSS custom properties in `src/styles/tokens.css` (+ a typed `tokens.ts` for map pins / JS use). Components use CSS Modules-style co-located `.css` files with BEM class names, matching the current idiom. Avoids a new build dependency and a styling-paradigm switch mid-project.
4. **Fonts self-hosted** via `@fontsource-variable/fraunces`, `@fontsource-variable/geist`, `@fontsource/geist-mono` (removes the cdnfonts/Google CSS imports).
5. **Add ESLint** (`npm run lint`) and `npm run typecheck` in `feature/design-system` so every branch has lint + type-check + build gates as the brief requires.
6. **Role value.** Brief says `student | owner | admin`; DB has `user | admin`. Plan: migrate `user → student`, but the check constraint temporarily accepts `user` too and a trigger normalises `user → student` on insert, so the **live v1 app keeps working** if the migration lands before the v2 deploy. A later cleanup migration (feature 15) drops `user`.
7. **Listing status.** `active → published`, `deleted → archived`. Same compatibility concern: v1 queries `status = 'active'`. Rather than a fragile shim, I'll flag this: **apply migrations 2 + deploy v2 together** (see section 4). I'll list it as a breaking change in the PR.
8. **Price bands.** Add `price_band` enum column (`under_1000 | 1000_1999 | 2000_2999 | 3000_plus`) generated from `rent_exact` (falls back to parsing existing `monthly_rent_min/max` for legacy rows via a one-off backfill). `monthly_rental_label` is kept and also derived, so old labels still render.
9. **Profile creation moves server-side** (`handle_new_user` trigger on `auth.users`) so the chosen role from sign-up (`student` / `owner`) is applied without letting clients write `role` themselves. Clients will no longer be allowed to set `role` or `is_active` on their own profile (RLS + column check) — today that likely isn't enforced, which is a privilege-escalation risk.
10. **Archive flow.** `archive_listing()` must keep working; v2 will call it from the admin listings table and it will also set `status = 'archived'`. Because I can't see its current body, I need it (see "Blockers").
11. **Admin "Settings"** from the sidebar: out of scope unless you want it — I'll render the nav item linking to a simple placeholder page in feature 10.
12. **"Needs photos"** is shown as a derived badge (published + 0 photos) in A2 and in the A1 "Needs your attention" list; not a DB status.
13. **Reports table** is created in feature 2 (with the rest of the schema); messaging's "report" action in feature 7 writes to it; feature 14 builds the student report form on listings + the admin Reports pages.
14. **Dead v1 code removal** happens incrementally: each feature deletes the v1 component it replaces (Auth in 3, User page in 4/6, Admin page in 10–13), so `develop` never carries two UIs for long. `usePointerGlow` goes in feature 1.
15. Order unchanged.

---

## 3. DB changes (feature 2: `feature/db-v2-schema`)

One migration file per concern, timestamped after `20260610040000`:

| # | File | Contents |
|---|---|---|
| 0 | `…_baseline_snapshot.sql` | **Only if you send me the schema dump** — `create table if not exists` / `create or replace function` for the existing base objects so the repo is reproducible. No-ops on prod. |
| 1 | `…_v2_roles.sql` | `profiles.role` → `student/owner/admin` (+ temporary `user`), `user→student` backfill, `is_admin()`/`is_owner()` `security definer` helpers, `handle_new_user` trigger reading `raw_user_meta_data.account_type`, RLS: users read/update own profile minus `role`/`is_active`; admins read/update all. Add `profiles.verified_owner boolean`, `deactivated_at`. |
| 2 | `…_v2_listings.sql` | Add `owner_id`, `status` (new check: `draft/in_review/changes_requested/published/archived`, backfill `active→published`, `deleted→archived`), `review_note`, `submitted_at`, `published_at`, `rent_exact`, `advance_deposit`, `rooms_total`, `room_types jsonb`, `price_band`; trigger `listings_derive_price` (band + label from `rent_exact`); trigger `listings_guard_status` (non-admins can only move `draft ↔ in_review`; editing a `published` listing as owner flips it to `in_review`). RLS: anon/students select `published`; owners select/insert/update own (non-archived); admins all. Same visibility rules on `listing_photos` + storage policy for owners on `listing-photos/{listing_id}/…`. Update `archive_listing()` / `restore_listing()` to set the new statuses (same signatures). Indexes on `(status, price_band)`, `(owner_id)`. |
| 3 | `…_v2_messaging.sql` | `conversations` (listing_id, student_id, owner_id, status `new/replied/visit_scheduled/closed`, owner_note, last_message_at, unread counters or `last_read_at` per side, blocked_by), `messages` (conversation_id, sender_id, body, kind `text/visit/system`, created_at), `visit_requests` (conversation_id, proposed_at, status `pending/confirmed/declined/rescheduled`, counter_at), `saved_replies` (owner_id, body). RLS: participants only; admins read for report resolution. Added to `supabase_realtime` publication. RPC `start_conversation(listing_id)` (idempotent per student+listing). |
| 4 | `…_v2_moderation.sql` | `reports` (reporter_id, target_type `listing/message/user`, target_id, reason, details, status `open/resolved/dismissed`, resolved_by, resolution_note), `owner_verifications` (owner_id, document path in private bucket `owner-verifications`, status `pending/approved/rejected`, reviewer, note) + private bucket policies, `activity_log` (actor_id, action, entity_type, entity_id, meta jsonb, created_at; insert via `log_activity()` + triggers on listing status / role changes; admin-read only). |
| 5 | `…_v2_admin_rpcs.sql` | `admin_overview_stats()`, `admin_users_page(search, role, page)` with duplicate flag (same normalised full_name, different email), `admin_set_role()`, `admin_set_active()`, `admin_merge_users()` — all `security definer` + `is_admin()` check + activity log. |

Testing: no local Supabase here. I'll write the SQL defensively (idempotent `if not exists`, `drop policy if exists`) and syntax-check it; you apply them to a **staging/branch project** first. I will never run anything against production.

---

## 4. Blockers / things I need from you

1. **Schema dump (strongly recommended before feature 2).** Please run one of these and drop the file at `web/supabase/schema-dump.sql` (DDL only, no secrets — fine to commit as the baseline):
   ```bash
   npx supabase db dump --linked --schema public,storage -f web/supabase/schema-dump.sql
   ```
   or paste from the SQL editor the definitions of `archive_listing`, `restore_listing`, and the output of `select * from pg_policies where schemaname in ('public','storage');`. Without it I'll write `archive_listing()` changes blind.
2. **Map tiles.** Recommend **MapTiler** (free tier, key restricted by HTTP referrer) via `VITE_MAPTILER_KEY`, falling back to OSM standard tiles when the key is absent (dev only). Alternative: Stadia Maps. Tell me if you prefer another.
3. **Deploy coupling.** Migration 2 (listing status rename) breaks the live v1 app. Confirm you're OK applying migrations and deploying v2 in the same window (I'll put exact steps in the PR description).
4. **Supabase dashboard change for PKCE:** none required for email/OAuth, but the redirect URL list must include `/auth/callback` (new route). I'll document it.

---

## 5. Route map (target)

| Area | Routes |
|---|---|
| Public/auth | `/sign-in`, `/sign-up`, `/auth/callback`, `/reset-password`, `/about`, `*` 404 |
| Student | `/` browse, `/map`, `/saved`, `/listing/:id`, `/messages`, `/messages/:conversationId` |
| Owner | `/owner`, `/owner/listings`, `/owner/listings/new`, `/owner/listings/:id/edit/:step`, `/owner/inquiries[/:id]`, `/owner/verification`, `/owner/profile` |
| Admin | `/admin`, `/admin/review[/:id]`, `/admin/listings`, `/admin/listings/new`, `/admin/listings/:id/edit/:step`, `/admin/users`, `/admin/reports[/:id]`, `/admin/settings` |

`/dashboard` (old OAuth redirect) redirects to the role home.

---

## 6. Proposed source layout

```
web/src/
  app/            router.tsx, RequireRole.tsx, AuthProvider.tsx
  styles/         tokens.css, base.css, fonts.ts
  ui/             Button, Badge, Chip, Input, Select, Stepper, Card, Avatar, Tabs,
                  DataTable, Pagination, Sidebar, TopNav, EmptyState, Skeleton, Dialog, Drawer, Toast
  features/
    auth/ browse/ listing/ map/ messaging/ owner/ wizard/ admin/ reports/
  lib/            supabase.ts, database.ts (regenerated types), services/*.ts
```
