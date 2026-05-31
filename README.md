# MAPAGUAPA

MAPAGUAPA is a responsive student accommodation discovery web app for browsing, saving, and managing boarding house and dormitory listings around the Visayas State University area. It provides a polished student-facing catalog, secure authentication, Google sign-in, map-based listing details, photo galleries, and an admin dashboard for maintaining listing records.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Authentication](#authentication)
- [Admin Workflow](#admin-workflow)
- [Responsive Design](#responsive-design)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Quality Checks](#quality-checks)
- [Troubleshooting](#troubleshooting)

## Overview

The app has two main experiences:

1. Student catalog
   - Browse active listings grouped by area.
   - Search by listing name, area, owner, or address.
   - Filter by stay type, budget, setup, amenities, and rules.
   - Open property detail modals with photos, highlights, amenities, contact details, and map directions.
   - Save listings locally on the current device.

2. Admin dashboard
   - View inventory, photo counts, archived records, and user totals.
   - Create listings with details, contact information, map coordinates, and images.
   - Edit listing content and photos.
   - Set cover photos, reorder gallery photos, and delete photos.
   - Archive listings through a protected archive flow instead of hard deletion.
   - Manage user roles and account status.

## Core Features

- Email/password authentication through Supabase Auth.
- Google OAuth sign-in.
- Email confirmation messaging for unverified accounts.
- Password reset flow.
- Role-based routing between user and admin interfaces.
- Active/inactive account enforcement.
- Supabase-backed listings, profiles, deleted listing archives, and listing photos.
- Supabase Storage support for listing images.
- Client-side image optimization before upload.
- Leaflet map integration with OpenStreetMap/CARTO tiles.
- Full-view photo viewer with close button, backdrop close, Escape support, and thumbnail switching.
- Responsive layouts for small phones, large phones, tablets, laptops, and desktops.
- Vercel SPA rewrite configuration for direct route and OAuth redirect support.

## Tech Stack

- React 18
- TypeScript
- Vite
- Supabase JS v2
- Supabase Auth
- Supabase Database and Storage
- Leaflet
- React Leaflet
- CSS modules/global component styles
- Vercel-compatible static deployment

## Project Structure

```text
mapaguapa/
  README.md
  web/
    index.html
    package.json
    vite.config.ts
    vercel.json
    .env.example
    src/
      App.tsx
      components/
        admin/
          MapaguapaAdminPage.tsx
          mapaguapa-admin.css
        auth/
          MapaguapaAuthPage.tsx
          mapaguapa-auth.css
        shared/
          HouseMark.tsx
          PropertyMap.tsx
          property-map.css
          usePointerGlow.ts
        user/
          MapaguapaUserPage.tsx
          mapaguapa-user.css
      lib/
        database.ts
        imageCompression.ts
        listingService.ts
        models.ts
        supabase.ts
    supabase/
      migrations/
        20260526010000_add_listing_coordinates.sql
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- Supabase project
- Supabase anon key

### Install

```bash
cd web
npm install
```

### Configure Environment

Copy the example file and fill in your project values:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### Run Locally

```bash
npm run dev
```

The local Vite app usually runs at:

```text
http://localhost:5173
```

## Environment Variables

Create `web/.env` with these values:

```env
VITE_APP_NAME=MAPAGUAPA
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_LISTING_PHOTOS_BUCKET=listing-photos
VITE_AUTH_REDIRECT_URL=http://localhost:5173/dashboard
VITE_PASSWORD_RESET_REDIRECT_URL=http://localhost:5173/dashboard
```

### Variable Reference

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_APP_NAME` | No | Display/app name. |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon public key. |
| `VITE_SUPABASE_LISTING_PHOTOS_BUCKET` | No | Storage bucket for listing photos. Defaults to `listing-photos`. |
| `VITE_AUTH_REDIRECT_URL` | Recommended | OAuth redirect URL. Use `/dashboard` for the app route. |
| `VITE_PASSWORD_RESET_REDIRECT_URL` | Recommended | Password reset redirect URL. |

Do not commit real `.env` secrets or project keys.

## Supabase Setup

MAPAGUAPA expects these Supabase resources:

### Auth

- Email/password provider enabled.
- Google provider enabled if using Google sign-in.
- Email confirmation enabled if you want users to verify email before login.
- Redirect URLs configured for local and production routes.

Recommended redirect URLs:

```text
http://localhost:5173/dashboard
https://your-production-domain.com/dashboard
```

For Vercel production, also set the Site URL to your deployed app URL.

### Database Tables

The TypeScript database model currently includes:

- `profiles`
  - User metadata, role, and active status.
- `listings`
  - Property details, pricing, amenities, contact info, status, and map coordinates.
- `listing_photos`
  - Storage-backed gallery images for each listing.
- `deleted_listings`
  - Archive records for removed listings.

### Database Functions

The app references these Supabase functions:

- `archive_listing`
  - Archives a listing and stores a deleted listing snapshot.
- `restore_listing`
  - Restores an archived listing.

### Storage

Create a bucket for listing photos:

```text
listing-photos
```

The bucket name can be changed with:

```env
VITE_SUPABASE_LISTING_PHOTOS_BUCKET=your-bucket-name
```

The app stores optimized listing photos in this bucket and references them through the `listing_photos` table.

### Migrations

The repository includes a migration for listing map coordinates:

```text
web/supabase/migrations/20260526010000_add_listing_coordinates.sql
```

It adds:

- `location_lat`
- `location_lng`

## Authentication

Authentication is handled in `web/src/App.tsx`.

The app supports:

- Email/password login.
- Email/password signup.
- Email confirmation prompts.
- Google OAuth login.
- Password reset email.
- Session persistence and auto refresh.
- Role-based page rendering.

Routing behavior:

- Signed-out users see the auth page.
- Signed-in users with `role = "user"` see the student catalog.
- Signed-in users with `role = "admin"` see the admin dashboard.
- Inactive profiles are signed out and shown an inactive account message.

## Admin Workflow

Admins can:

- Add listings.
- Upload listing photos during creation.
- Search map locations and save coordinates.
- Edit listing fields.
- Add more photos to existing listings.
- Set a cover photo.
- Drag non-cover photos to reorder the gallery.
- Delete individual photos.
- Archive listings after password confirmation.
- Review archived records.
- Activate/deactivate users.
- Promote/demote admin roles.

## Responsive Design

The UI is built to support:

- Small phones: 320px to 480px
- Large phones: 481px to 767px
- Tablets/iPads: 768px to 1024px
- Laptops/desktops: 1025px and above

Responsive patterns used across the app:

- Mobile-first stacking.
- Flexible card grids.
- `min-width: 0` overflow protection.
- Full-width mobile forms and buttons.
- Tighter mobile heading scales.
- Scroll-safe modals with `max-height` and internal overflow.
- Responsive map and image frames.
- Horizontal thumbnail strips for photo selection.

## Available Scripts

Run scripts from the `web/` directory.

### Development

```bash
npm run dev
```

Starts the Vite development server.

### Start

```bash
npm run start
```

Alias for the Vite development server.

### Build

```bash
npm run build
```

Runs TypeScript build checks and creates a production Vite build in `web/dist`.

### Preview

```bash
npm run preview
```

Serves the production build locally for verification.

## Deployment

The project is ready for Vercel-style static deployment from the `web/` directory.

Recommended Vercel settings:

| Setting | Value |
| --- | --- |
| Root Directory | `web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

The file `web/vercel.json` contains a rewrite that sends all app routes to `index.html`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This is required so direct visits and OAuth redirects such as `/dashboard` do not return `404: NOT_FOUND`.

After deploying, update Supabase Auth URL configuration:

- Site URL: your production domain
- Redirect URLs:
  - `https://your-production-domain.com/dashboard`
  - any local development URL you still use

## Quality Checks

Before opening a PR or deploying, run:

```bash
cd web
npm run build
```

This runs:

- TypeScript project build
- Vite production build

The project does not currently define a separate unit test script.

## Troubleshooting

### Google sign-in redirects to a Vercel 404

Check that:

- `web/vercel.json` is deployed.
- Vercel root directory is set to `web`.
- Supabase redirect URL points to your deployed `/dashboard` route.
- `VITE_AUTH_REDIRECT_URL` is set correctly for the environment.

### Supabase is not configured

Make sure `web/.env` exists and contains:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Restart the Vite dev server after changing `.env`.

### Photos do not load

Check that:

- The storage bucket exists.
- `VITE_SUPABASE_LISTING_PHOTOS_BUCKET` matches the bucket name.
- `listing_photos.storage_bucket` and `listing_photos.storage_path` are valid.
- Storage policies allow the app to read public listing images.

### Maps do not display correctly in modals

The map component automatically invalidates Leaflet size after mount and coordinate changes. If a map still appears clipped, check browser console errors and verify that listing coordinates are valid numbers.

### User cannot access the admin dashboard

The profile must have:

```text
role = admin
is_active = true
```

Inactive users are signed out automatically.

## License

No license file is currently included. Add a license before distributing or publishing this project outside its intended academic or organizational use.

