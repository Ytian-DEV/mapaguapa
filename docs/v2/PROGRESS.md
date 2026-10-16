# MAPAGUAPA v2 — Progress

**Current branch:** `feature/design-system`
**Status:** Plan approved. Feature 1 in progress.
**Next step:** Add design tokens, fonts and base styles (web/src/styles).

Resume protocol: read this file → `git status` → check out the branch above → finish uncommitted work → continue from the first unchecked item.

Gates before the last commit of each feature (from `web/`): `npm run lint`, `npm run typecheck`, `npm run build`.

---

## 0. Setup
- [x] chore(docs): add v2 plan and progress

## 1. `feature/design-system`
- [x] chore(deps): add react-router-dom, fontsource fonts, eslint
- [x] chore(lint): add eslint config, lint and typecheck scripts
- [ ] feat(ui): add design tokens and base styles
- [ ] feat(ui): add Button, Badge, Chip, Input, Select
- [ ] feat(ui): add Card, Avatar, Tabs, Stepper
- [ ] feat(ui): add DataTable, Pagination, EmptyState, Skeleton
- [ ] feat(ui): add Sidebar, TopNav, Dialog, Drawer, Toast
- [ ] feat(app): add router shell and role guards (v1 pages mounted unchanged)
- [ ] feat(dev): add /dev/components preview page
- [ ] chore: remove pointer-glow hook; merge to develop

## 2. `feature/db-v2-schema`
- [ ] chore(db): baseline snapshot of existing schema (if dump provided)
- [ ] chore(db): add v2 roles migration
- [ ] chore(db): add v2 listings status, pricing and RLS migration
- [ ] chore(db): add conversations, messages, visit requests migration
- [ ] chore(db): add reports, owner verifications, activity log migration
- [ ] chore(db): add admin RPCs migration
- [ ] feat(types): regenerate database types and service helpers
- [ ] docs(db): document apply order; merge to develop

## 3. `feature/auth-v2`
- [ ] fix(auth): switch Supabase client to PKCE and add /auth/callback
- [ ] feat(auth): redesign sign-in (frame 01)
- [ ] feat(auth): sign-up with student/owner choice
- [ ] feat(auth): password reset flow on new design
- [ ] feat(auth): role-based home routing; remove v1 auth page; merge

## 4. `feature/student-browse`
- [ ] feat(browse): browse service with server-side filters and price bands
- [ ] feat(browse): top nav, header, search and filter selects
- [ ] feat(browse): quick chips and result count
- [ ] feat(browse): listing card grid with show-more pagination
- [ ] feat(browse): saved listings (heart) and /saved page
- [ ] feat(browse): mobile layout; merge

## 5. `feature/map-v2`
- [ ] feat(map): switch tile provider with env key
- [ ] feat(map): price-band pins and VSU landmark marker
- [ ] feat(map): search as I move the map (bounds filter)
- [ ] feat(map): map on browse (desktop split, mobile toggle) and /map; merge

## 6. `feature/listing-detail-v2`
- [ ] feat(listing): detail route, gallery and show-all-photos
- [ ] feat(listing): key facts, about, amenities, bills and fees
- [ ] feat(listing): house rules, safety badges, location map
- [ ] feat(listing): sticky contact card and verified badge
- [ ] feat(listing): report listing link; remove v1 user page; merge

## 7. `feature/messaging`
- [ ] feat(messaging): conversation service and start-from-listing
- [ ] feat(messaging): student inbox and thread (frame 04)
- [ ] feat(messaging): realtime updates and unread counts
- [ ] feat(messaging): quick questions and saved replies
- [ ] feat(messaging): visit requests propose/confirm/suggest
- [ ] feat(messaging): owner inquiries view with statuses and notes (frame O3)
- [ ] feat(messaging): block and report; merge

## 8. `feature/owner-portal`
- [ ] feat(owner): owner layout and sidebar
- [ ] feat(owner): overview stats, listings, inquiries, visits, reminder
- [ ] feat(owner): my listings page
- [ ] feat(owner): verification upload
- [ ] feat(owner): profile page; merge

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
