# CISO Configurator

Last updated: 2026-02-24

This repository contains the static configurator app used to generate customer dashboard pages.

## What This Repo Does

- Runs a browser-based configurator (`index.html` + JS/CSS).
- Builds a dynamic customer dashboard HTML from thread/profile data.
- Curates "Recommended for you" cards from reconciled Webflow CSV data.
- Curates "What's new" from RSS (with fallback data).
- Exports a downloadable customer dashboard HTML file.

## Security Sweep (2026-02-24)

Implemented hardening in this repo:

1. Removed eval-style Firebase config parsing
   - Replaced `new Function(...)` parsing path with strict JSON/object-literal normalization + `JSON.parse`.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

2. Added CSV injection protection for all exports
   - Applied formula-injection guards (Excel/Sheets) to:
     - high-fidelity record CSV
     - HubSpot export CSV
     - Salesforce export CSV
     - one-row report CSV
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

3. Sanitized collaborator avatar color input
   - Restricts collaborator color values to safe CSS color formats (`#hex`, `rgb[a]`, `hsl[a]`) with deterministic fallback.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

4. Added browser-side security policy headers via HTML meta tags
   - Added CSP + strict referrer policy in app shell.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`

5. Added Firestore least-privilege baseline rules file
   - New rules only allow a signed-in user to read/write their own `/healthchecks/{uid}` doc.
   - Default deny for all other documents.
   - File: `/Users/will.bloor/Documents/Configurator/firestore.rules`

6. Added import guardrail for large CSV uploads
   - Rejects CSV imports over 5 MB to avoid browser lockups and unsafe oversized local ingestion.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

## Adversarial Hardening Pass (2026-02-24)

Additional hardening applied after a second attack-vector sweep:

1. Hardened all dynamic link rendering paths
   - Added strict URL sanitizers:
     - `safeLinkHref(...)` for `http/https` (and optional `#anchor`) only
     - `safeMailtoHref(...)` for validated email links only
   - Applied to generated customer pages, recommendations view links, email-builder links, and preview CTA links.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

2. Removed raw URL fallback in content-card mapping
   - Content-card URLs now pass through canonicalization + sanitizer only (no unsanitized fallback path).
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

3. Added CSV parser resilience limits (DoS hardening)
   - Enforced caps during CSV parse:
     - max rows: `5000`
     - max columns per row: `300`
     - max chars per cell: `20000`
   - Parser now fails fast on malformed unterminated quoted values.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

4. Added deployment-time HTTP security headers for Vercel
   - Added `/Users/will.bloor/Documents/Configurator/vercel.json` with:
     - CSP (Firebase auth iframe-compatible allowlist)
     - Referrer policy
     - MIME sniffing protection
     - Frame embedding protection
     - Permissions policy
     - COOP for popup auth compatibility

Note:
- CSP was adjusted to allow Firebase auth iframe/popup flows (`*.firebaseapp.com`, `*.web.app`, Google auth domains). A strict `frame-src 'none'` policy will break Firebase sign-in.

Manual Firebase console action required:

- In Firebase Console > Firestore > Rules, replace permissive sandbox rules with the content from `/Users/will.bloor/Documents/Configurator/firestore.rules` and publish.
- Do this in sandbox now; replicate to work dev/prod projects when IT provisions them.

## Authorization Hardening Pass (2026-02-24)

Additional RBAC and identity safeguards applied:

1. Bound actor identity to Firebase UID when backend mode is on
   - When backend connection is enabled and a user is signed in, record/lock actor identity now uses:
     - `userId = uid:<firebase uid>`
     - Firebase email / display name
   - This prevents editable profile fields from acting as auth identity in backend-connected sessions.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

2. Disabled force-role test overrides in non-dev runtime
   - `force-admin`, `force-owner`, `force-editor`, `force-sdr`, `force-viewer` are now:
     - accepted only when explicitly enabled for local dev (`window.__ENABLE_PERMISSION_ROLE_TEST_MODES__ = true`) or localhost-style hostnames
     - always suppressed when backend connection is on
   - UI select options for force modes are hidden/disabled when not allowed.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

3. Treated CSV authority fields as untrusted on import
   - Import now strips authority-bearing metadata from both row-based CSV payloads and `record_json` payloads:
     - `shareAccess`
     - `collaborators`
     - `lockOwner`
     - `lockExpiresAt`
     - `updatedById`
     - `updatedByEmail`
     - `workspaceId` is reset to local default for sandbox import safety
   - This prevents privilege injection through crafted CSVs.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

Scope note:
- These changes do not force sign-in for normal local-only use (`Backend connection off`), and keep current sandbox workflows intact.

## Go-Live Readiness Checklist (Firebase + SSO + Controlled CRM Export)

Use this as the release gate before storing real customer data.

### 1) Ownership, environments, and access

- [ ] Create ring-fenced Firebase/GCP projects: `configurator-dev` and `configurator-prod`.
- [ ] Confirm project owners in IT/security and engineering (named individuals).
- [ ] Confirm Hatch access model (least privilege, scoped to required repos/projects only).
- [ ] Confirm GitHub org access path via One Login and required labs/training completion.

### 2) Authentication and SSO

- [ ] Enable Firebase Authentication providers for non-prod (Google) and production target (One Login via SAML/OIDC).
- [ ] Ensure backend-connected sessions bind actor identity to Firebase UID (not editable profile fields).
- [ ] Disable force-role test modes in production runtime.
- [ ] Verify sign-in/sign-out flow on Vercel production URL and custom domain URL.

### 3) Authorization (RBAC) and server enforcement

- [ ] Define canonical roles and permissions: `owner`, `admin`, `editor`, `sdr`, `viewer`.
- [ ] Move all write-critical auth checks to backend/API and Firestore Rules.
- [ ] Ensure frontend role checks are UX-only and never the sole control.
- [ ] Add record-level ACL checks for read/write/share actions.

### 4) Firestore and data safety

- [ ] Publish strict Firestore rules (default deny; explicit allow by UID + role + record membership).
- [ ] Validate rules with emulator tests for positive and negative access cases.
- [ ] Keep imported CSV authority fields untrusted (`shareAccess`, collaborators, lock metadata, updater IDs).
- [ ] Confirm no sensitive contractual/final pricing data is stored at this phase.

### 5) Backend and integration controls

- [ ] Introduce backend API service for record CRUD, sharing actions, publish/export actions.
- [ ] Add immutable audit fields (`createdBy`, `updatedBy`, timestamps, version).
- [ ] Implement idempotent export jobs (manual push model first; no automatic bi-directional sync yet).
- [ ] Define HubSpot/Salesforce export mappings and required custom fields with owners.

### 6) Security controls and resilience

- [ ] Keep CSP/security headers active in Vercel (`vercel.json`) and verify on deployed responses.
- [ ] Enable App Check / abuse controls as backend usage increases.
- [ ] Add request timeouts/retries around external dependencies (RSS/proxies/integrations).
- [ ] Ensure backup/restore approach for Firestore and exported artifacts is documented.

### 7) Operations, legal, and launch readiness

- [ ] Define data retention window and deletion process for discovery records.
- [ ] Complete DPIA/security review with Phil/security stakeholders.
- [ ] Add monitoring dashboards and alerting (auth failures, permission denials, API errors).
- [ ] Run UAT with named pilot users (SDR + AE + Manager) and capture sign-off.
- [ ] Prepare rollback plan (disable backend toggle, freeze writes, revert deployment).

### 8) Go/No-Go gate

Only proceed with real customer data when all are true:

- [ ] SSO is active and tested end-to-end.
- [ ] Server-side RBAC is enforced and tested.
- [ ] Firestore rules are strict and validated.
- [ ] Audit logging and rollback paths are in place.
- [ ] Security/IT stakeholders provide explicit approval.

## UI Boot Paint Fix (2026-02-24)

Low-stakes UX polish deployed:

1. Removed initial configurator flash on refresh
   - Added a boot class on `<body>` to hide `main.wrap` until route/view classes are fully applied.
   - Removed boot class after initialization on next animation frame.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`
   - File: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

2. Added no-JS fallback for visibility
   - Added `noscript` style to ensure main content remains visible if JavaScript is disabled.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`

## Favicon Update (2026-02-24)

Branding polish deployed:

1. Added Immersive favicon and Apple webclip links in app head
   - Added:
     - `rel="icon"`
     - `rel="shortcut icon"`
     - `rel="apple-touch-icon"`
   - Uses Immersive official favicon/webclip CDN assets.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`

## Permission Mode Dropdown Fix (2026-02-24)

Behavior correction deployed:

1. Restored permission testing role options when backend connection is off
   - `force-admin`, `force-owner`, `force-editor`, `force-sdr`, and `force-viewer` are available again for local workflow testing.
   - These force-role overrides remain disabled when backend connection is on.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

## Backend Configuration Page Split (2026-02-24)

Navigation and IA cleanup deployed:

1. Moved backend controls off `My account` into a dedicated page
   - Backend connection controls (`#accountBackendConnection`) now live in a separate `#backendConfigView`.
   - New route: `#/account/backend-configurations`.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - File: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

2. Replaced bottom-left `My settings` dock item with `Backend config`
   - Removed duplicate settings entry in dock to reduce confusion with in-page account settings.
   - Added a dedicated dock nav item that opens backend configuration view directly.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

3. Added backend-aware routing, breadcrumb, and view-state handling
   - Hash routing now parses and emits backend path.
   - Workspace breadcrumb now supports `Dashboard / My account / Backend configurations`.
   - Body view classes/CSS visibility rules now include `is-backend-view`.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - File: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## HubSpot-First CRM Export UX (2026-02-24)

Export workflow simplification deployed:

1. Made HubSpot the explicit default handoff path
   - CRM export subtitle and runtime hint now prioritize manual HubSpot import first.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

2. Moved Salesforce actions into Advanced UI
   - Salesforce CSV button is now under a collapsed `Advanced: Salesforce template` control.
   - Salesforce mapping preview is now under a collapsed `Advanced preview` section.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`
   - File: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## Workspace Profiles Advanced Cleanup (2026-02-24)

Account page declutter deployed:

1. Moved secondary workspace profile actions under `Advanced settings`
   - `Open CRM export` and `Export high-fidelity CSV` are now inside a collapsed advanced block within `Workspace profiles`.
   - Primary day-to-day actions remain visible: demo profile loads and profile CSV upload.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`
   - File: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## Snapshot Header Final Alignment (2026-02-24)

Layout adjustment to match approved reference (supersedes interim snapshot-header iterations):

1. Top row now combines snapshot title and collaborator controls
   - `YOUR SNAPSHOT` sits on the left.
   - Collaborator `+` and avatar stack sit on the right.
   - File: `/Users/will.bloor/Documents/Configurator/index.html`
   - File: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

2. Capture-count pill moved back to package header row
   - `x/14 captured` now appears on the `Package` row (not in the top header row).
   - File: `/Users/will.bloor/Documents/Configurator/index.html`

## New Record Validation Deferral (2026-02-24)

Create-flow behavior refinement deployed:

1. Brand-new records now open in a neutral state
   - Draft records (`id = current`) no longer show red incomplete styling in the left rail or field outlines on first open.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

2. First saved session stays neutral until reopen
   - When a new record is saved for the first time, incomplete highlighting remains deferred during that same live configurator session.
   - Once the user leaves that record context and reopens it, normal required/incomplete highlighting resumes.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

3. Completion ticks remain strict while red warnings are deferred
   - Step checkmarks now continue to reflect true completion state and are no longer incorrectly shown as complete during first-use deferral.
   - Deferral now affects only red incomplete styling (field outlines/section incomplete state), not completion truth.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

## Source Of Truth

- App shell: `/Users/will.bloor/Documents/Configurator/index.html`
- Main logic: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- Styles: `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
- Firebase config shim: `/Users/will.bloor/Documents/Configurator/assets/js/firebase-config.js`
- Firestore security baseline rules: `/Users/will.bloor/Documents/Configurator/firestore.rules`
- Vercel deploy-time security headers: `/Users/will.bloor/Documents/Configurator/vercel.json`
- Collaboration record schema: `/Users/will.bloor/Documents/Configurator/schemas/workspace-record.v2.schema.json`
- Question bank source CSV: `/Users/will.bloor/Documents/Configurator/assets/data/question-bank.v1.csv`
- Generated question bank runtime file: `/Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`

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

### Record creation + save UX

- `Create new` opens directly into configurator Step 0 (form-first flow), not the interstitial overview.
- Draft records remain `current` until first save.
- Header and step save labels:
  - `Save` on Steps 0–4
  - `Save & return` on `Review` only
  - `Saving...`
  - `Saved`
- Save behavior:
  - Steps 0–4 save in place (stay in configurator)
  - Review save returns to record overview
- Review step no longer shows a direct `Book my consultation` CTA in the step header.

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
4. `sdr`
   - Can edit records
   - Can add viewers
   - Cannot remove collaborators or elevate roles
5. `viewer`
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
- New records (`version <= 1`) stay unlocked by default after initial save.

### Default role mix for seeded workspace data

- For local/demo seed sets, actor role membership is auto-balanced to:
  - majority `owner`
  - a couple `editor`
  - remaining `viewer`
- This is applied on initial load/profile import for realistic permission testing.

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
  - Per-user role assignment (`viewer` / `sdr` / `editor` / `owner` / `admin`, permission-gated by actor role)
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
- Workspace profiles actions currently include:
  - `Load AE demo profile`
  - `Load CS demo profile`
  - `Upload profile CSV`
  - `Open CRM export`
  - `Export high-fidelity CSV`
- Workspace left-nav account entry (`My account`) now shows an explicit active highlight when account view is open.
- Desktop left-nav active state now fills the full row without cropped/gapped highlight seams.
- Save model:
  - Explicit `Save changes` button
  - Save button animation now mirrors record save UX (`Saving...` -> `Saved` -> `Save changes`)
  - Dirty/saved state pill (`Unsaved changes` / `Saved HH:MM`)
  - `Apply to current record` action
- Font size scale options now include:
  - `90%`, `100%`, `110%`, `120%`, `130%`, `140%`, `150%`
- Configurator mode control:
  - mode select includes `SDR`, `Guided`, `Advanced`
  - dedicated `SDR mode` on/off toggle maps directly to mode selection and now lives in `Settings > Test data`
- Test data controls now include:
  - `Dummy account on/off`
  - `SDR mode on/off`
  - `Prefill new records` / `Manual start for new records`
  - `ROI estimate visibility` on/off for side snapshot summary blocks
- Backend sandbox connection controls now include:
  - Firebase web config JSON paste/save/clear
  - Google sign-in / sign-out
  - Firestore write/read healthcheck (`healthchecks/{uid}`)
  - Runtime source indicator (`window` config vs localStorage config)
- Account-level settings persisted in:
  - `ACCOUNT_PROFILE_STORAGE_KEY = cfg_shell_account_profile_v1`
  - `FIREBASE_WEB_CONFIG_STORAGE_KEY = cfg_firebase_web_config_v1`
- Shell settings persisted in:
  - `cfg_shell_tone`
  - `cfg_shell_density`
  - `cfg_shell_font_scale`
  - `cfg_shell_dummy_mode`
- Layout widths persisted in:
  - `cfg_shell_lhn_w`
  - `cfg_shell_right_w`
- Dashboard column widths persisted in:
  - `cfg_dashboard_col_widths_v2`

### Question bank + configurator modes (foundation)

- Question requirements are now externalized to a CSV-backed bank:
  - source: `/Users/will.bloor/Documents/Configurator/assets/data/question-bank.v1.csv`
  - generated runtime file: `/Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
  - generator script: `/Users/will.bloor/Documents/Configurator/scripts/generate_question_bank_js.mjs`
  - step rail label field: `step_label` (in the source CSV)
- Supported configurator modes:
  - `sdr-lite` (labelled as `SDR` in UI)
  - `guided`
  - `advanced`
- Mode behavior currently implemented:
  - requirement/gap/completion engine uses mode-filtered requirement rows
  - account `SDR` mode is now session-authoritative for required-question logic and progress rail rendering, including existing saved records
  - mode is persisted per record snapshot as `snapshot.fieldMode`
  - CSV export/import includes `config_mode`
  - SDR mode requires 8 of 22 question requirements (~36.4%) via `rq_fit_scope` now required in SDR
- Step rail behavior currently implemented:
  - progress chips are rendered from question-bank step metadata (not static HTML)
  - `step_label` drives the visible chip labels after regenerating `assets/js/question-bank.js`
  - in SDR mode, non-required steps are grouped under an `Optional` rail heading
  - optional steps are shown as optional (not auto-marked complete), using neutral hollow-circle markers
  - optional steps now show a tick once all questions for that optional step are completed
  - optional heading is left-aligned to the rail chip start and no longer renders a top divider rule
  - current content-step skeleton remains `1..5` plus `Review` (UI section structure is still fixed)

### View-state action bar syncing

- Global dashboard/interstitial action buttons are now synchronized even on `setView(..., { render:false })` transitions.
- This prevents stale interstitial actions (`View record`/`Share`) from persisting when returning to dashboard.
- Current intentional constraint:
  - question UI remains fully visible for now; mode changes required-question logic and progress math first (safe migration path before full dynamic rendering)

### Dashboard table sorting + resizing behavior

- Sort controls:
  - `Company`
  - `Completion`
  - `Tier`
  - `Status`
  - date (`Date modified` / `Date created`)
- Column resizing now behaves as boundary resizing:
  - resizing a column adjusts that column against its immediate neighbor
  - unrelated columns (including select checkbox column) stay stable
  - min/max width bounds enforced for both columns involved
- Resize interactions are guarded so drag does not trigger row open/sort clicks.

### Record lifecycle actions

- Active records:
  - can be archived/unarchived from interstitial/global record action
  - cannot be permanently deleted directly from active views
- Archived record overview:
  - interstitial action bar switches to restore-only mode
  - primary CTA becomes `Unarchive` (no edit/share/recommendations/consultation actions)
  - archived records are blocked from configurator edit/share/recommendation/booking flows until restored
- Dashboard bulk action:
  - `Archive selected` becomes visually prominent (blue) when actionable rows are selected
- Archive view bulk actions:
  - `Unarchive selected`
  - `Delete selected` (red, permanent delete path)
- Permanent delete is restricted to archived records and uses confirmation modal flow.

### Permission testing modes (for QA)

Available account test modes:

- `live`
- `force-admin`
- `force-owner`
- `force-editor`
- `force-sdr`
- `force-viewer`

These modes alter effective UI role for guard testing without backend changes.

### Routing support

Hash routes supported for major states:

- `#/dashboard`
- `#/archived`
- `#/account`
- `#/export`
- `#/records/:recordId/overview`
- `#/records/:recordId/configure?step=1..6`
- `#/records/:recordId/recommendations`
- `#/records/:recordId/export`

### CRM export workflow (manual, integration-ready)

- Dedicated export page:
  - `#crmExportView`
- Entry points:
  - `My account > Workspace profiles > Open CRM export`
  - Recommendations header `CRM export` button
- Export scopes:
  - `Active record`
  - `Selected record`
  - `All saved records`
- Export templates:
  - `HubSpot CSV` (contact/company-oriented columns)
  - `Salesforce CSV` (lead-oriented columns with custom-field API name placeholders)
- Canonical mapping layer in:
  - `crmExportCanonicalRows(threads)` in `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
  - `hubspotRowsFromCanonical(rows)` in `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
  - `salesforceRowsFromCanonical(rows)` in `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- Intentional architecture:
  - Manual CRM push remains fast now, while preserving a stable canonical field contract that can later map directly to Firestore + backend sync endpoints without reworking frontend capture logic.

### Current deliberate UI choices

- Workspace LHN cards intentionally do **not** include collaborator avatars (reduced visual clutter in nav).
- Collaborator avatars remain in:
  - configurator header
  - dashboard/archived table company cell
- Configurator right-side snapshot now includes a dedicated top bar:
  - top-right collaborator controls (add-user + avatar stack)
  - right-aligned profile summary (`Role`, `Name`, `Company`, `Country`, `Size`)
- The `About` accordion in `YOUR ANSWERS` now starts at `Outcome discovery`; organisation/profile rows were moved into the new top bar.
- Side snapshot header label `Your snapshot` was removed; captured count pill now sits in the `Package` card header for denser vertical layout.
- Side `YOUR ANSWERS` no longer uses an internal fixed-height scroll viewport. Nested max-height/overflow locking was removed so the panel scrolls naturally with the page.
- Collaborator stack ordering:
  - active user appears first
  - if the active user has access through general/workspace sharing (but is not explicitly listed in `collaborators[]`), the UI injects the active user avatar in first position for clarity

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
- `file:///Users/will.bloor/Documents/Configurator/index.html#/dashboard` (no local server required)

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

## Implementation Roadmap (Proposed Backend Migration)

### Recommended direction

Use a Google-first stack with minimal rewrite:

- Frontend: keep the current SPA.
- Auth: Firebase Authentication (Google sign-in / workspace SSO).
- Data: Firestore for records, profiles, memberships, and page metadata.
- Backend: Cloud Run API for business logic and all CRM writes.
- Async jobs: Cloud Tasks for retries and idempotent sync.
- Pages: Firebase Hosting + Cloud Storage for published landing pages.

Inference from the current codebase: this is the lowest-risk path because the app is currently local-first state plus static page generation, not API-driven persistence yet.

### Why this is needed (from current code)

- Records persist in browser `localStorage` (`THREAD_STORAGE_KEY` read/write in `/Users/will.bloor/Documents/Configurator/assets/js/app.js:311`, `/Users/will.bloor/Documents/Configurator/assets/js/app.js:405`, `/Users/will.bloor/Documents/Configurator/assets/js/app.js:443`).
- View navigation is still state-driven via `setView(...)` with optional hash syncing, not backend resource routing (`/Users/will.bloor/Documents/Configurator/assets/js/app.js:2981`).
- Landing pages are generated and downloaded as local HTML artifacts (`downloadCustomerPageTemplate` and `downloadText` in `/Users/will.bloor/Documents/Configurator/assets/js/app.js:11076`, `/Users/will.bloor/Documents/Configurator/assets/js/app.js:11111`).
- CRM handoff is still placeholder UX copy in the consultation flow (`/Users/will.bloor/Documents/Configurator/assets/js/app.js:15318`).

### Implementation plan

1. Phase 0: Data contract first (2-3 days)
   Define canonical entities and IDs: `user`, `workspace`, `membership`, `record`, `record_version`, `landing_page`, `crm_link`, `sync_job`. Reuse the existing record schema as base contract (`/Users/will.bloor/Documents/Configurator/schemas/workspace-record.v2.schema.json`).
2. Phase 1: User profiles with one logic (3-4 days)
   Implement a single profile resolution rule:
   `effective_profile = workspace_defaults + user_defaults + record_overrides`
   Store all three layers in Firestore. Keep current My Account defaults UX, but persist server-side instead of local-only.
3. Phase 2: Backend foundation on Google (1 week)
   Create a Cloud Run service with auth-validated CRUD for records/profiles/pages, plus audit fields (`createdBy`, `updatedBy`, timestamps, `version`). Add Firestore Security Rules for client access and IAM-only service access for admin operations.
4. Phase 3: URL + routing model (3-4 days)
   Add shareable URLs for major states:
   `/app/dashboard`
   `/app/records/:recordId/overview`
   `/app/records/:recordId/configure?step=1..6`
   `/app/records/:recordId/recommendations`
   `/app/records/:recordId/landing-pages/:pageId`
   Keep URL as location/context only, not full form payload.
5. Phase 4: Landing page publish flow (4-5 days)
   Keep current generator logic, but publish through backend:
   generate HTML from saved record/version, store HTML in Cloud Storage, store metadata/slug/status in Firestore, return public/internal URL, support Draft vs Published with republish history.
6. Phase 5: HubSpot + Salesforce integration layer (1-2 weeks)
   Implement integrations in backend only:
   workspace OAuth connection, field mapping table, idempotent outbound sync via Cloud Tasks, persisted external IDs in `crm_link`, manual `Sync now`, and job status. Then add optional inbound webhooks for bi-directional sync.
7. Phase 6: Collaborators + permissions (4-5 days)
   Add `workspace_memberships` roles:
   Owner: admin + integration settings
   Editor: edit records/pages
   Viewer: read-only
   Add invite-by-email flow and record-level permission checks in API.
8. Phase 7: Cutover + hardening (3-5 days)
   Migrate existing local records to Firestore, add activity log, monitoring, retry dashboards, and rollback plan.

### Direct answers

- Do we need URLs for each page/state?
  Yes for major views and record context. No for every form field.
- Can we add collaborators?
  Yes, but not safely with localStorage-only architecture. You need backend auth + memberships + ACL.
- Google backend?
  Yes. Firebase + Cloud Run + Cloud Tasks is a strong fit for this app shape.
- Frontend work required?
  Yes. Main areas:
  auth/session handling, API-backed data layer, router/deep links, role-based UI gating, publish/sync status UI, optimistic save + conflict handling.

### IT planning answers (for internal ticket)

- What does "ring-fenced Firebase project" mean?
  A dedicated Firebase/GCP project for this app only, separate from other systems, with isolated `dev` and `prod` environments and scoped access controls.
- How will users share and collaborate on records?
  Use one-login auth plus workspace membership roles (`owner`, `admin`, `editor`, `sdr`, `viewer`). Record writes are permission-checked by role and record access scope. Version/lock metadata remains in the record model to prevent overwrite conflicts.
- How will content catalog + RSS feeds run automatically?
  Run scheduled jobs (Cloud Scheduler -> Cloud Run) to execute the existing catalog/RSS scripts and write refreshed catalog data to storage/database. Keep fallback catalog data available if feeds fail.
- What are scalability assumptions for user data?
  Initial planning target: ~500 users, ~100 concurrent, ~100k records.
  Growth target: ~5,000 users, ~500 concurrent, ~1M records.
  Data model should keep records scoped by workspace and use append-only version history for audit and rollback.
- What is the CRM operating model?
  Manual push remains the current workflow (HubSpot/Salesforce CSV templates). Backend sync can be added later without remapping capture fields because export mapping is centralized through one canonical record mapping layer.

### External references

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore overview](https://firebase.google.com/docs/firestore)
- [Firestore Security Rules conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Cloud Run documentation](https://cloud.google.com/run/docs)
- [Cloud Tasks documentation](https://cloud.google.com/tasks/docs)
- [Firebase Hosting custom domain](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase Hosting preview/deploy flow](https://firebase.google.com/docs/hosting/test-preview-deploy)
- [HubSpot OAuth](https://developers.hubspot.com/docs/apps/legacy-apps/authentication/oauth/working-with-oauth)
- [HubSpot Contacts API](https://developers.hubspot.com/docs/api-reference/crm-contacts-v3/guide)
- [HubSpot Webhooks API](https://developers.hubspot.com/docs/api-reference/webhooks-webhooks-v3/guide)
- [Salesforce OAuth/connected app overview](https://developer.salesforce.com/docs/industries/communications/guide/authorization.html)
- [Salesforce external client app setup example](https://developer.salesforce.com/docs/industries/loyalty/guide/authorization.html)
- [Salesforce REST/composite API guidance](https://developer.salesforce.com/blogs/2024/04/accessing-object-data-with-salesforce-platform-apis)

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

# regenerate question bank runtime file from CSV
node scripts/generate_question_bank_js.mjs

# schema JSON parse check
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('schemas/workspace-record.v2.schema.json','utf8'));"

# no unresolved merge markers
rg -n "^(<<<<<<<|=======|>>>>>>>)" -g '!*.csv' .
```
