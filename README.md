# CISO Configurator

Last updated: 2026-02-23

This repository contains the static configurator app used to generate customer dashboard pages.

## What This Repo Does

- Runs a browser-based configurator (`index.html` + JS/CSS).
- Builds a dynamic customer dashboard HTML from thread/profile data.
- Curates "Recommended for you" cards from reconciled Webflow CSV data.
- Curates "What's new" from RSS (with fallback data).
- Exports a downloadable customer dashboard HTML file.

## Source Of Truth

- App shell: `/Users/will.bloor/Documents/Configurator/index.html`
- Main logic: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- Styles: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
- Collaboration record schema: `/Users/will.bloor/Documents/Configurator/schemas/workspace-record.v2.schema.json`

The generated customer dashboard is created in code (not from a static HTML file) by:

- `customerTemplateModelFromCandidate(candidate)`
- `customerTemplateHtmlFromModel(modelInput)`

Both functions live in `/Users/will.bloor/Documents/Configurator/assets/js/app.js`.

## Current Template Snapshot Files

Reference snapshots are stored in:

- `/Users/will.bloor/Documents/Configurator/landing-pages/customer-dashboard-template-Pioneer-Cloud-2026-02-22.html`
- `/Users/will.bloor/Documents/Configurator/landing-pages/CISO Configurator Launchpad Edition - Dashboard Shell.html`

These are review snapshots only. The generator in `assets/js/app.js` is canonical.

## Current Dashboard Behavior (Implemented)

### Hero

- Full-bleed image fills the entire hero card.
- Hero text is white for readability.
- Hero primary CTA points to `#recommended-for-you`.
- Hero secondary CTA points to `#contact-your-team`.

### Structure

Current section order in generated output:

1. Hero
2. Top outcomes
3. Meeting context details
4. Centered "Our understanding of your needs"
5. Overlapping Prove / Improve / Report cards
6. Product tour card
7. Recommended next actions
8. Recommended for you
9. What's new
10. Contact your team

### Removed / Changed

- "Recommended resources" section was removed from output and preview.
- Any `site:immersivelabs.com` Google-search fallback links were removed.
- Content links are now first-party/direct where possible.

## Collaboration + Account Plumbing (Implemented)

### Record model + local persistence

- Canonical record metadata includes:
  - `recordId`
  - `workspaceId`
  - `version`
  - `updatedBy`
  - `updatedById`
  - `updatedByEmail`
  - `updatedAt`
  - `lockOwner`
  - `lockExpiresAt`
  - `shareAccess`
  - `collaborators[]`
- Record schema source:
  - `/Users/will.bloor/Documents/Configurator/schemas/workspace-record.v2.schema.json`
- Local persistence is wrapped via `recordStore` in:
  - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- Cross-tab sync is wired via `window.storage` events on:
  - `THREAD_STORAGE_KEY = immersive.launchpad.savedThreads.v1`

### Roles and permission matrix (frontend guards)

Roles currently enforced in UI guards (backend enforcement deferred):

1. `admin`
   - Can edit records
   - Can add/remove collaborators
   - Can set collaborator roles
   - Can set general link access
   - Can manage workspace users
2. `owner`
   - Can edit records
   - Can add/remove collaborators
   - Can set collaborator roles
   - Can set general link access
3. `editor` (collaborator)
   - Can edit records
   - Can add viewers
   - Cannot remove collaborators or elevate roles
4. `viewer`
   - Read-only for record editing
   - Can add viewers
   - Cannot change access levels

Permission constants and guards are in:

- `COLLAB_PERMISSION_MATRIX`
- `actorPermissionsForThread(thread)`
- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

### Locking and concurrency behavior

- Edit lock model:
  - `RECORD_LOCK_TTL_MS = 45000`
  - `RECORD_LOCK_HEARTBEAT_MS = 15000`
- If another collaborator holds the lock, configurator enters read-only mode and shows status.
- Save flow increments record `version`, updates `updatedBy*` and `updatedAt`, and releases lock until edit resumes.
- Collaboration status banner is rendered in configurator header:
  - `/Users/will.bloor/Documents/Configurator/index.html` (`#collabStatus`)

### Update visibility (unseen changes)

- Dashboard rows now show an unread indicator (small green dot) to the left of `Date modified`.
- Dot appears only when:
  - Date column mode is `modified`, and
  - Record `version` is newer than `state.recordSeenVersions[recordId]`.
- Dot clears once the record is opened (overview/configurator marks current version as seen).
- Implementation:
  - `threadHasUnseenUpdate(thread)` in `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
  - Date-cell dot styles in `/Users/will.bloor/Documents/Configurator/assets/css/app.css` (`.dash-createdDot`)

### Sharing UX + request access flow

- Share modal includes:
  - Add collaborators by email
  - Per-user role assignment
  - General access level (`workspace-viewer` / `workspace-editor`)
  - Copy-link action
  - Save sharing action
  - Request-access action for blocked users
- Access requests are persisted in:
  - `ACCESS_REQUESTS_STORAGE_KEY = cfg_record_access_requests_v1`
- Share modal source:
  - `/Users/will.bloor/Documents/Configurator/index.html` (`#shareModal`)

### My Account + Settings information architecture

- My Account now includes a dedicated left-hand nav with:
  - `Profile defaults`
  - `Your preferences · General`
  - `Your preferences · Notifications`
  - `Workspace profiles`
  - `Settings` (theme/display/test data + layout reset)
- Save model:
  - Explicit `Save changes` button
  - Dirty/saved state pill (`Unsaved changes` / `Saved HH:MM`)
  - `Apply to current record` action
- Account-level settings persisted in:
  - `ACCOUNT_PROFILE_STORAGE_KEY = cfg_shell_account_profile_v1`
- Shell settings persisted in:
  - `cfg_shell_tone`
  - `cfg_shell_density`
  - `cfg_shell_font_scale`
  - `cfg_shell_dummy_mode`
- Layout widths persisted in:
  - `cfg_shell_lhn_w`
  - `cfg_shell_right_w`
- Dashboard column widths persisted in:
  - `cfg_dashboard_col_widths_v1`

### Permission testing modes (for QA)

Available account test modes:

- `live`
- `force-admin`
- `force-owner`
- `force-editor`
- `force-viewer`

These modes alter effective UI role for guard testing without backend changes.

### Routing support

Hash routes supported for major states:

- `#/dashboard`
- `#/archived`
- `#/account`
- `#/records/:recordId/overview`
- `#/records/:recordId/configure?step=1..6`
- `#/records/:recordId/recommendations`

### Current deliberate UI choices

- Workspace LHN cards remain decluttered:
  - collaborator avatar stacks are intentionally not shown in the LHN card list.
- Collaborator avatars remain in:
  - configurator header
  - dashboard/archived table company cell

## Content And RSS System

### Runtime Content Sources

The app merges:

- `window.immersiveContentCatalog` from `/Users/will.bloor/Documents/Configurator/assets/js/content-catalog.js`
- Runtime RSS rows from configured feed URLs
- RSS fallback from `/Users/will.bloor/Documents/Configurator/assets/js/official-blog-rss-fallback.js`

### Freshness Rules

Defined in `/Users/will.bloor/Documents/Configurator/assets/js/app.js`:

- `CONTENT_MAX_AGE_DAYS = 365 * 3` (exclude content older than 3 years)
- `CONTENT_FRESH_PRIORITY_DAYS = 365`
- `CONTENT_RECENT_PRIORITY_DAYS = 365 * 2`

### URL Rules

`canonicalizeContentUrlByFormat` + `inferredContentUrl` enforce direct Immersive paths by format:

- `blog-post` -> `/resources/blog/<slug>/`
- `c7-blog` -> `/resources/c7-blog/<slug>/`
- `case-study` -> `/resources/case-study/<slug>/`
- `ebook` -> `/resources/ebook/<slug>/`
- `webinar` -> `/resources/webinars/<slug>/`

If slug is missing, `inferredContentSlug(row)` derives it from title.

### Image Rules

Card image resolution order:

1. Direct image fields on the row (`imageUrl`, `thumbnail`, `heroImage`, etc.)
2. Matched image via lookup by slug/title/url tail
3. Final fallback image:
   - `IMMERSIVE_DEFAULT_IMAGE_URL`

No `picsum` placeholders are used in runtime generator logic.

## Build Theatre (Preview UX)

The preview "build theatre" (loader/sequence) is controlled in:

- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
  - `ensureCustomerPreviewBuildOverlay`
  - `runCustomerPreviewBuildTheatre`
  - `clearCustomerPreviewBuildTheatre`
- `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

It is designed to play during explicit customer preview generation.

## Data Pipelines

### 1) Reconcile master content catalog

Script:

- `/Users/will.bloor/Documents/Configurator/scripts/reconcile_content_csvs.mjs`

Default output:

- `/Users/will.bloor/Documents/Configurator/assets/data/immersive-content-master.csv`
- `/Users/will.bloor/Documents/Configurator/assets/js/content-catalog.js`

Run:

```bash
cd "/Users/will.bloor/Documents/Configurator"
node scripts/reconcile_content_csvs.mjs
```

Notes:

- Uses default desktop CSV input paths unless `--inputs` is provided.
- Applies 3-year age filtering.
- Reconciles canonical URLs and images.

### 2) Sync official blog RSS fallback

Script:

- `/Users/will.bloor/Documents/Configurator/scripts/sync_official_blog_rss_curated.mjs`

Run:

```bash
cd "/Users/will.bloor/Documents/Configurator"
curl -L -s 'https://api.allorigins.win/raw?url=https%3A%2F%2Fwww.immersivelabs.com%2Fresources%2Fblog%2Frss.xml' \
  | node scripts/sync_official_blog_rss_curated.mjs
```

Outputs:

- `/Users/will.bloor/Documents/Configurator/assets/data/official-blog-rss-curated.csv`
- `/Users/will.bloor/Documents/Configurator/assets/js/official-blog-rss-fallback.js`

### 3) Reconcile operations records

Script:

- `/Users/will.bloor/Documents/Configurator/scripts/reconcile_operations_csvs.mjs`

Output:

- `/Users/will.bloor/Documents/Configurator/assets/data/operations-records-master.csv`

## Local Run

No build step required.

Open directly:

- `/Users/will.bloor/Documents/Configurator/index.html`

Or run a static server:

```bash
cd "/Users/will.bloor/Documents/Configurator"
python3 -m http.server 8080
```

## Deploy (Vercel)

- Framework preset: `Other`
- Build command: empty
- Output directory: empty
- Entry: `index.html`

## Handoff Checklist (Use After Each Push)

1. Update this README with any structural/template logic changes.
2. If content logic changed, regenerate:
   - `assets/js/content-catalog.js`
   - `assets/js/official-blog-rss-fallback.js` (if RSS-related)
3. Keep a fresh visual snapshot in `landing-pages/` when output structure changes.
4. Ensure hero anchors still resolve to real section IDs.
5. Confirm no Google search fallback URLs and no placeholder image URLs in generated output.

## Quick Validation Commands

```bash
# no Google fallback links
rg -n "google\.com/search\?q=site%3Aimmersivelabs\.com" assets/js/app.js landing-pages/customer-dashboard-template-Pioneer-Cloud-2026-02-22.html

# no placeholder picsum links
rg -n "picsum\.photos" assets/js/app.js landing-pages/customer-dashboard-template-Pioneer-Cloud-2026-02-22.html

# JS syntax check
node --check assets/js/app.js

# all browser JS files syntax check
for f in assets/js/*.js; do node --check "$f"; done

# scripts syntax check
for f in scripts/*.mjs; do node --check "$f"; done

# schema JSON parse check
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('schemas/workspace-record.v2.schema.json','utf8'));"

# no unresolved merge markers
rg -n "^(<<<<<<<|=======|>>>>>>>)" -g '!*.csv' .
```
