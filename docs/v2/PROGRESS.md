# MAPAGUAPA v2 — Progress

**Current branch:** `develop`
**Status:** Features 1–8 merged into develop. 6 migrations tested locally, NOT applied to Supabase (deploy day; no staging). UI verified with dev fixtures (/dev/browse, /dev/listing, /dev/messages, /dev/owner).
**Next step:** Start feature/owner-listing-wizard from develop (frame O2).

Resume protocol: read this file → `git status` → check out the branch above → finish uncommitted work → continue from the first unchecked item.

Gates before the last commit of each feature (from `web/`): `npm run lint`, `npm run typecheck`, `npm run build`.

---

## 0. Setup
- [x] chore(docs): add v2 plan and progress

## 1. `feature/design-system`
- [x] chore(deps): add react-router-dom, fontsource fonts, eslint
- [x] chore(lint): add eslint config, lint and typecheck scripts
- [x] feat(ui): add design tokens and base styles
- [x] feat(ui): add Button, Badge, Chip, Input, Select
- [x] feat(ui): add Card, Avatar, Tabs, Stepper
- [x] feat(ui): add DataTable, Pagination, EmptyState, Skeleton
- [x] feat(ui): add Sidebar, TopNav, Dialog, Drawer, Toast
- [x] feat(app): add router shell and role guards (v1 pages mounted unchanged)
- [x] feat(dev): add /dev/components preview page
- [x] chore: gates and merge to develop (pointer-glow hook is removed with the v1 pages in features 3, 6, 13)

## 2. `feature/db-v2-schema`
- [x] test(db): local migration harness with Supabase stub and reconstructed v1 baseline (no dump yet)
- [ ] chore(db): baseline snapshot of existing schema (when dump provided)
- [x] chore(db): add v2 roles migration
- [x] chore(db): add v2 listings status, pricing and RLS migration
- [x] chore(db): add conversations, messages, visit requests migration
- [x] chore(db): add reports, owner verifications, activity log migration
- [x] chore(db): add admin RPCs migration
- [x] feat(types): regenerate database types and service helpers
- [x] docs(db): document apply order; merge to develop
- [x] fix(db): align migrations with prod schema (branch fix/db-v2-prod-alignment): enum status, v1 triggers/policies, archive behaviour, sign-in only

## 3. `feature/auth-v2`
- [x] chore(db): add become_owner() for Google owner sign-ups
- [x] fix(auth): switch Supabase client to PKCE and add /auth/callback
- [x] feat(auth): redesign sign-in (frame 01)
- [x] feat(auth): sign-up with student/owner choice
- [x] feat(auth): password reset flow on new design
- [x] feat(auth): role-based home routing; remove v1 auth page; merge
- [x] fix(auth): balance sign-in columns on wide screens (branch fix/auth-layout-balance)

## 4. `feature/student-browse`
- [x] chore(db): exclusivity group, curfew flag and VSU distance for browse filters
- [x] feat(browse): browse service with server-side filters and price bands
- [x] feat(browse): top nav, header, search and filter selects
- [x] feat(browse): quick chips and result count
- [x] feat(browse): listing card grid with show-more pagination
- [x] feat(browse): saved listings (heart) and /saved page
- [x] feat(browse): mobile layout; merge

## 5. `feature/map-v2`
- [x] feat(map): switch tile provider with env key
- [x] feat(map): price-band pins and VSU landmark marker
- [x] feat(map): search as I move the map (bounds filter)
- [x] feat(map): map on browse (desktop split, mobile toggle) and /map; merge

## 6. `feature/listing-detail-v2`
- [x] feat(listing): detail route, gallery and show-all-photos
- [x] feat(listing): key facts, about, amenities, bills and fees
- [x] feat(listing): house rules, safety badges, location map
- [x] feat(listing): sticky contact card and verified badge
- [x] feat(listing): report listing link; remove v1 user page; merge

## 7. `feature/messaging`
- [x] feat(messaging): conversation service and start-from-listing
- [x] feat(messaging): student inbox and thread (frame 04)
- [x] feat(messaging): realtime updates and unread counts
- [x] feat(messaging): quick questions and saved replies
- [x] feat(messaging): visit requests propose/confirm/suggest
- [x] feat(messaging): owner inquiries view with statuses and notes (frame O3)
- [x] feat(messaging): block and report; merge

## 8. `feature/owner-portal`
- [x] chore(db): listing views, owner_overview() and draft_step (migration 6)
- [x] feat(owner): owner layout and sidebar
- [x] feat(owner): overview stats, listings, inquiries, visits, reminder
- [x] feat(owner): my listings page
- [x] feat(owner): verification upload
- [x] feat(owner): profile page; merge

## 9. `feature/owner-listing-wizard`
- [ ] feat(wizard): wizard shell, stepper, autosave draft
- [ ] feat(wizard): steps 1–3 (basics, rooms & pricing, bills)
- [ ] feat(wizard): steps 4–5 (amenities, rules & safety)
- [ ] feat(wizard): step 6 location pin
- [ ] feat(wizard): step 7 photos upload, reorder, cover
- [ ] feat(wizard): step 8 review & submit, preview card, completeness
- [ ] feat(wizard): resubmit on edit; admin mode; merge

## 10. `feature/admin-shell-overview`
- [ ] feat(admin): admin layout, sidebar with counts
- [ ] feat(admin): overview stats and needs-attention list
- [ ] feat(admin): recent activity and listings by price range; merge

## 11. `feature/admin-listings`
- [ ] feat(admin): listings table with status tabs and server pagination
- [ ] feat(admin): search and filters
- [ ] feat(admin): bulk archive (password re-entry) and CSV export
- [ ] feat(admin): restore from archive; wire wizard create/edit
- [ ] chore(admin): remove v1 admin listing/archive pages; merge

## 12. `feature/admin-review-queue`
- [ ] feat(admin): review queue with next/previous navigator
- [ ] feat(admin): submission details, photo strip, checklist
- [ ] feat(admin): similar-listing auto-check
- [ ] feat(admin): approve & publish / request changes with templates
- [ ] feat(admin): owner verification approvals; merge

## 13. `feature/admin-users`
- [ ] feat(admin): users table, search, role tabs, server pagination
- [ ] feat(admin): row menu with confirm dialogs (role, deactivate)
- [ ] feat(admin): duplicate flag and merge
- [ ] chore(admin): remove v1 admin page; merge

## 14. `feature/reports`
- [ ] feat(reports): student report dialog for listings and messages
- [ ] feat(reports): admin reports list, detail and resolve; merge

## 15. `feature/v2-polish`
- [ ] feat(ui): skeletons, empty/error states, 404
- [ ] fix(a11y): contrast, focus rings, labels, keyboard nav
- [ ] fix(ui): responsive pass
- [ ] feat(seo): page titles and meta
- [ ] chore: remove dead v1 code and drop legacy role value migration; merge

## Final
- [ ] Full build on develop; PR text for develop → main
