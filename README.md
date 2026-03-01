# CISO Configurator

Last updated: 2026-02-28

This repository contains the static configurator app used to generate customer dashboard pages.

## What This Repo Does

- Runs a browser-based configurator (`index.html` + JS/CSS).
- Builds a dynamic customer dashboard HTML from thread/profile data.
- Curates "Recommended for you" cards from reconciled Webflow CSV data.
- Curates "What's new" from RSS (with fallback data).
- Exports a downloadable customer dashboard HTML file.
- Publishes a live customer dashboard URL via Vercel Blob (`/api/publish-customer-page`).

## Interstitial + Content UX Simplification (2026-02-27)

Implemented usability clean-up based on walkthrough feedback:

- Removed duplicate in-card breadcrumb trail from record interstitial header.
  - Top workspace breadcrumb remains the single navigation trail.
- Added `Back to overview` to the global action cluster (between archive and edit), shown only when a non-overview interstitial section is active.
- Simplified embedded content actions to a single action row in preview:
  - `Email customer`
  - `Publish customer page`
  - `Download current preview`
  - `View preview link` (shown after publish)
- Removed duplicated/secondary content actions:
  - `Open in email client`
  - `Copy email`
  - `Clear preview`
  - duplicate top content action strip
- Reduced left-nav `Dashboard` row height by ~30% and rebalanced icon/text spacing for desktop density.

Files:

- `/Users/will.bloor/Documents/Configurator/index.html`
- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## Story Mapping + Readability Tweaks (2026-02-28)

Implemented additional UI simplifications and readability defaults:

- Removed the `Meetings page` card from `Overview status` (the card no longer renders there).
- Updated default workspace font scale to `120%` (instead of `100%`) for first-run readability.
- Simplified interstitial `Content` section to landing-page preview only:
  - removed in-page content-overview blocks from the Content section surface
  - Content now renders only the customer landing-page preview area in this section
  - if landing-page preview cannot render for the active record, `Content is locked` dialog is shown
  - Content unlock threshold increased from `90%` to `100%` completion
- Simplified Story Mapping page framing:
  - removed subtitle copy: `Map discovery pain points through outcomes and PIBR capabilities.`
  - subtitle now uses mapped-signal language:
    - `Mapped from X/Y answered discovery signals, from pain themes through outcomes and PIBR capabilities.`
  - removed the extra `Your readiness pyramid mapping` wrapper/header container
  - story-mapping layers now render directly in the page body without the extra outlined parent card

Files:

- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- `/Users/will.bloor/Documents/Configurator/index.html`
- `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## Story Mapping Narrative Drawer (2026-02-28)

Added a natural-language story generator directly in Story Mapping:

- New `Generate story` button in the Story Mapping header.
- Button opens a dedicated right-hand drawer that generates account narrative copy from the same weighted story-mapping chain:
  - discovery signals -> pain themes -> outcomes -> PIBR capabilities -> platform/brand layers
- Drawer output includes:
  - executive story summary
  - why-now rationale bullets
  - prioritized outcomes/capabilities with percentages
  - draft customer-facing narrative paragraph
- Added `Copy story` action to copy the generated narrative text for reuse in landing page/email flows.
- Updated `Why this is prioritized now` narrative generation to be more human/tangible:
  - explains current pressure context in plain language
  - states what that pressure is elevating (pain themes)
  - states which outcomes those pressures are driving
  - avoids percentage-only or abstract phrasing
- Reframed generated-story structure to align with brand narrative flow:
  - `Challenges we identified` -> `Opportunities this creates` ->
    `Outcomes we recommend` -> `Why this PIBR constellation` ->
    `Why this helps you be ready`
  - explicitly names Prove / Improve / Benchmark / Report as the recommended operating constellation in Immersive One.
- Removed narrative metadata pills from the drawer header and switched generated narrative sections to full-text output (no ellipsis truncation).
- Extended customer-page language flow to reuse the same narrative structure:
  - hero subtitle now inherits the mapped executive story direction
  - added `Your readiness story` section to both preview and exported landing page, rendering:
    - challenges
    - opportunities
    - outcomes mapping
    - PIBR constellation rationale
    - be-ready framing
- Gated to the same completion threshold as Story Flow mode (90%+).

Files:

- `/Users/will.bloor/Documents/Configurator/index.html`
- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## Customer Readiness Story De-Densification (2026-02-28)

Reduced cognitive load in the `Your readiness story` panel in both preview and exported customer pages:

- Applied compact story formatting before render:
  - summary reduced to a concise lead sentence
  - long multi-sentence bullets reduced to concise first-sentence bullets
  - per-card bullet count reduced for the primary view
- Updated layout rhythm:
  - primary story cards now render in a calmer 2-column grid
  - secondary sections moved behind `Show full mapping rationale` disclosure
- Kept logic deterministic:
  - source remains story-mapping narrative outputs
  - no change to scoring or section selection logic, only presentation density

Files:

- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## Customer Readiness Story Externalization + Fourth Block (2026-02-28)

Refined `Your readiness story` for external, CISO-facing communication:

- Reframed story language away from internal model terms:
  - removed/rewrote internal phrasing in section copy (for example `% influence`, `fit`, `mapped signals`, `for this account`)
  - story summaries and section intros now use executive-ready, stakeholder-facing wording
- Preserved content structure while improving readability:
  - each section card includes a natural-language intro paragraph plus bullets
  - cards retain a content-first layout (no marketing framing)
- Added a fourth primary story card:
  - `Executive and stakeholder assurance`
  - focuses on board/regulator/customer confidence outcomes
- Primary story display now supports four cards (2x2), with remaining detail in expandable rationale.

Files:

- `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

## Vercel Live Publish Endpoint (2026-02-27)

Customer page publishing is now available directly from the Content view and Customer page preview:

- UI actions:
  - `Publish customer page`
  - `View preview link` (appears after a successful publish in the current session)
- API route:
  - `/api/publish-customer-page` (POST)
  - `/api/customer-page?slug=<slug>` (GET redirect target)
- Storage target:
  - Vercel Blob, deterministic key: `customer-pages/<slug>.html` (overwrite-on-republish)
- Public route:
  - `/customer-pages/<slug>` (rewrites to `/api/customer-page`)

Required environment variable in Vercel project settings:

- `BLOB_READ_WRITE_TOKEN`

## Platform Direction Update (2026-02-25)

Current delivery direction has moved to AWS-first infrastructure ownership:

- Cloud target: AWS (ring-fenced `dev` and `prod` accounts/environments).
- Identity target: OneLogin via SAML 2.0 federation.
- Application auth target: Amazon Cognito federated with OneLogin SAML.
- Shared data target: DynamoDB (or AppSync + DynamoDB) behind API enforcement.
- API/logic target: API Gateway + Lambda (or equivalent service-owned API layer).
- Async jobs target: EventBridge + SQS (retry/idempotent sync).

Note:
- Firebase sandbox tooling has been removed from active UI/runtime paths as of 2026-02-25. AWS + OneLogin SAML is now the only target direction documented here.
- Legacy Firebase compatibility helper functions remain in `/Users/will.bloor/Documents/Configurator/assets/js/app.js` as no-op/off-path code pending cleanup.

## Firebase Sandbox Removal (2026-02-25)

Removed from active runtime and configuration surface:

- Firebase backend configuration controls in `Backend configurations`.
- Firebase SDK script includes from `/Users/will.bloor/Documents/Configurator/index.html`.
- Firebase config shim file `/Users/will.bloor/Documents/Configurator/assets/js/firebase-config.js`.
- Firestore rules file `/Users/will.bloor/Documents/Configurator/firestore.rules`.

Current state:

- App remains local-first.
- Backend setup page now documents AWS/SAML target assumptions and current implementation status.

## Dashboard Status + Persona Testing Fixes (2026-02-25)

Updated dashboard status resolution and account testing controls:

- Dashboard `Status` now reflects the active testing persona context (or live mode), so role simulation is visible directly in the table when testing.
- Reframed account testing control from force-role labels to named personas:
  - `Admin (Will Bloor, VP)`
  - `Owner (Kirsten Foon, Director)`
  - `Editor (Tia Schwartz, Customer Success Manager)`
  - `SDR (Miranda Clark)`
  - `Viewer (Katie Price, Associate Customer Success Manager)`
- Added job-title annotations to account workspace-role controls and testing persona labels:
  - `Admin (VP)`
  - `Owner (Director)`
  - `Editor (Customer Success Manager)`
  - `SDR`
  - `Viewer (Associate Customer Success Manager)`
- Dashboard/share status labels remain canonical role statuses (`Admin`, `Owner`, `Editor`, `SDR`, `Viewer`) so permission state is explicit.
- Persona selection now applies identity + workspace-role presets in the account form, and SDR persona automatically switches configurator mode to SDR (`sdr-lite`) for consistent role/view testing.
- Added collaborator identity fallback matching by normalized display name and record `updatedBy` identity when `userId/email` are not available, so local actor mapping does not incorrectly collapse to `Viewer` for records owned by the same user.
- Removed stale Firebase/Google domain allowances from the in-document CSP meta tag to keep runtime policy aligned with AWS-only direction.
- Preserved self-service lifecycle metadata during record normalization so imports keep `submissionStatus`, `submittedAt`, `intentScore`, `intentBand`, and `ownerQueue` instead of dropping them on save/load.
- File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
- File: `/Users/will.bloor/Documents/Configurator/index.html`

## Recent Changes in Design Principles (2026-02-26)

Design and workflow updates deployed for self-service intake and dashboard follow-up:

### Record Overview Section Nav (2026-02-26)

- Record overview now includes a dedicated section nav rail:
  - `Overview`, `Gaps`, `Content`, `Meetings`, `Integrations`
- Record nav is now route-backed by section mode:
  - `/records/:id/overview`
  - `/records/:id/gaps`
  - `/records/:id/record-content`
  - `/records/:id/meetings`
  - `/records/:id/integrations`
- `Overview` is now a true summary page for the pages below (status rows + open actions), instead of a long mixed scroll.
- Icons are intentionally neutral (monogram style), not green success checkmarks.
- Header and section-nav/content are visually detached: section shell now has its own rounded container with spacing from the header for clearer hierarchy.
- Mobile behavior collapses this to a horizontal scrollable tab row.
- Removed duplicate configurator share trigger in the header; sharing/add-collaborator remains on the right snapshot rail only.
- Files:
  - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
  - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
  - `/Users/will.bloor/Documents/Configurator/index.html`

1. Added standalone customer self-service widget entrypoint
   - New page:
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
   - New widget logic:
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
   - Route rewrite:
     - `/widget` -> `/landing-pages/customer-self-service-widget-prototype.html`
   - File:
     - `/Users/will.bloor/Documents/Configurator/vercel.json`

2. Applied right-rail interaction model in widget
   - Widget now keeps core form on the left and live selection/recommendation context on the right.
   - `AE Queue Preview` is shown below as a separate full-width block.
   - Principle:
     - keep primary input density controlled and keep decision context visible.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`

3. Added dashboard-native follow-up selector in record overview gaps
   - Each customer-askable gap now supports a follow-up checkbox.
   - Follow-up composer is placed in a right rail within the same gaps card.
   - Generates customer follow-up email copy + dynamic follow-up form link.
   - Principle:
     - follow-up should be initiated from AE dashboard record context, not from customer intake surface.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

4. Tuned follow-up question selection thresholds
   - Hard cap is now `10` questions per follow-up send.
   - Recommended target is `3` questions.
   - When selection exceeds `3`, the composer shows an inline warning with an exclamation marker:
     - `More than 3 may reduce the likelihood of response.`
   - Selection pill still shows `X of Y` to keep limits explicit.
   - Principle:
     - keep a practical upper bound while guiding toward higher response probability.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

5. Added widget-to-dashboard record handoff and account-side import fallback
   - Widget submit syncs records into dashboard storage contract (`immersive.launchpad.savedThreads.v1`) for same-origin local testing.
   - Added account workspace import action for `self-service JSON` upload when direct same-origin storage handoff is not available.
   - Principle:
     - preserve one record lifecycle across customer intake and AE workflow, with a deterministic fallback path.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/index.html`

6. Added customer follow-up form mode on widget route
   - Follow-up links now carry `recordId` + selected question keys (`followup`) into `/widget`.
   - Widget renders requested follow-up questions and supports save of follow-up answers.
   - Principle:
     - request only missing context in targeted batches and keep customer interaction short.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`

7. Standardized customer-facing brand copy
   - Updated flow copy to `Immersive One`.
   - Principle:
     - enforce consistent brand naming in generated/customer-facing text.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`

8. Normalized snapshot labeling in record overview
   - Updated interstitial wording so snapshot framing is consistent across the full overview surface.
   - Renamed local card labels to reduce ambiguity:
     - `ROI snapshot` -> `ROI estimate`
     - `Snapshot` -> `Record summary`
   - Principle:
     - avoid one-off snapshot labels when the whole overview is a snapshot view.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

9. Reframed the recommendations surface as content
   - Updated content-view UI copy so the flow is consistently described as `content`:
     - `Resources for ...` -> `Content for ...`
     - `Recommendations are locked.` -> `Content is locked.`
     - unlock/help text now references content instead of recommendations/resources
     - recommendation card eyebrow now uses `Content N`
     - recommendation-email wording updated to `content email` / `content plan`
     - breadcrumb label in this view now shows `Content`
   - Principle:
     - treat this entire route as the content workflow, with consistent language across heading, gate state, cards, actions, and toasts.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

10. Converted overview summary rows into dashboard cards with visual metrics
   - Replaced the `Overview status` row list with KPI-style cards for:
     - `Gaps page`
     - `Content page`
     - `Meetings page`
   - Added data-visual treatment in each card:
     - completion ring
     - progress bar
     - macro metric callout (including oversized macro numeral for gaps count)
   - Standardized percentage display with explicit `%` symbols across overview card metrics/status signals.
   - Principle:
     - treat overview as a compact data-viz layer (GA-style scanability) rather than a plain status list.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

11. Aligned gaps follow-up rail with gap card stack
   - Removed the vertical offset that pushed the customer follow-up composer below the first gap card.
   - Updated sticky top alignment so the right rail starts flush with the first gap item row.
   - Principle:
     - maintain horizontal alignment between gap cards and follow-up actions for faster scanability.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

12. Reserved `/content` route for the Content page (with legacy recommendations alias)
   - Updated route generation so the content workflow now uses:
     - `#/records/:recordId/content`
   - Kept backward compatibility for existing links:
     - `#/records/:recordId/recommendations` still resolves to the same Content page.
   - Moved the interstitial section route segment for the record-content tab to:
     - `#/records/:recordId/record-content`
   - Principle:
     - keep URL semantics consistent by using `content` for the content workflow while avoiding collisions with interstitial section routing.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

13. Moved snapshot summary into Overview and removed Snapshot nav tab
   - The standalone `Snapshot` section in interstitial has been removed from the left nav.
   - Snapshot summary content now renders directly on `Overview`, under the overview dashboard/KPI area.
   - Legacy route handling is preserved:
     - `#/records/:recordId/snapshot` now resolves to `Overview`.
   - Principle:
     - reduce nav fragmentation by keeping high-level record summary with overview context.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

14. Expanded Overview to include full snapshot data blocks
   - `Overview` now renders the full snapshot data set (not summary-only):
     - `Organisation`
     - `Discovery & outcomes`
     - `Coverage & package fit`
     - `Context`
   - These blocks remain accessible via the `Content` section as well for continuity.
   - Principle:
     - keep the complete record snapshot visible on Overview for faster executive scan without section switching.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

15. Simplified overview cards to donut-only and promoted overall completion into the grid
   - Removed per-card horizontal progress bars from `Overview status` cards to avoid double-encoding metrics.
   - Kept donut/ring visualization as the single progress chart pattern for this panel.
   - Moved `Overall completion` from the top-right badge into the first card (top-left), so the overview card grid is fully occupied with no empty quadrant.
   - Principle:
     - use one chart type per panel and prioritize balanced card layout density.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

16. Follow-up email workflow status (current implementation baseline)
   - Current implemented behavior:
     - AE/SDR can select customer-askable gaps in record `Gaps` view.
     - Composer enforces selection limits (`Recommended 3`, `Max 10`) and warns when over recommended.
     - Generates:
       - subject/body draft text
       - copy-to-clipboard payload
       - `mailto:` link
       - customer follow-up form URL (`/widget?recordId=...&followup=...`)
   - Current limitations (not yet implemented):
     - no direct email send service integration (currently draft/copy/mailto pattern)
     - no delivery/open/reply tracking inside the app
     - no follow-up sequence history/timeline per record
     - no template/version library for follow-up copy variants
   - Principle:
     - preserve a reliable draft-and-link baseline while follow-up messaging and automation are iterated in a dedicated workstream.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

17. Removed interstitial header meta pills for cleaner record view
   - Removed the header pill row in record overview that repeated:
     - `Stage`
     - `Completion`
     - `Tier`
     - `Open gaps`
   - Principle:
     - reduce duplicate status noise where the same signals are already represented in the overview cards/dashboard context.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

18. Unified Content workflow into the interstitial `Content` subsection
   - `View content` now routes into the record interstitial `Content` subsection instead of keeping content as a separate standalone page context.
   - Existing content route handling (`#/records/:recordId/content` and legacy `#/records/:recordId/recommendations`) now lands the user in interstitial `Content`.
   - The existing content workspace UI (`contentRecommendationsView`) is mounted directly inside the interstitial content subsection so users see the same content controls in one place.
   - Snapshot data blocks are now overview-owned (not duplicated under the Content subsection).
   - Principle:
     - eliminate split-context navigation by co-locating content actions with the record subsection where users expect them.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

19. Normalized legacy content routes to avoid standalone content view fallback
   - Route parsing now resolves both:
     - `#/records/:recordId/content`
     - `#/records/:recordId/recommendations`
     directly to interstitial `Content` section mode.
   - Legacy internal `recommendations` view state now normalizes to interstitial `Content`, preventing split-page rendering when old links are opened.
   - Principle:
     - guarantee a single content surface regardless of legacy hash or entry path.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

20. Reduced overview card redundancy and tightened to a single desktop row
   - Overview status cards now use a concise single status line per card (removed duplicated status/detail/percent text blocks).
   - Desktop overview card grid now renders in one row of four cards:
     - `Overall completion`, `Gaps page`, `Content page`, `Meetings page`
   - Added responsive fallback to two columns on narrower desktop widths and one column on mobile.
   - Principle:
     - reduce duplicated signals and improve information density without losing page-level scanability.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

21. Added collapsible interstitial section nav rail (icon-first)
   - Record section rail (`Overview`, `Gaps`, `Content`, `Meetings`) now collapses to icon-only by default on desktop.
   - Rail expands on hover/focus and auto-collapses on mouse-off, reclaiming horizontal space for page content.
   - Added button `title`/`aria-label` so collapsed-state navigation remains discoverable and accessible.
   - Mobile behavior remains unchanged (horizontal nav row under the existing responsive breakpoint).
   - Principle:
     - prioritize content real estate while preserving fast section switching.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

22. Simplified content header controls and moved booking action to Meetings
   - Content subsection header now keeps only:
     - `Preview customer page`
     - `Download customer page`
   - Removed content header clutter:
     - completion pill
     - package/outcomes/company/RSS meta pills
     - `Generate email`
     - `CRM export`
     - `Back to overview`
   - Record top action bar in interstitial now shows only `Edit record` (removed duplicate share/content/consultation actions from that bar).
   - Added `Book consultation` button inside the `Meetings` section (`Elevator pitch` card) to localize that action to the meetings workflow.
   - Added `Integrations` section to the interstitial left nav and moved CRM handoff entry there (`Open CRM export`), removing CRM action buttons from the content header.
   - Fixed content-thread binding in interstitial content mode so the content header resolves to the active record context (prevents stale company labels like `Orchid Corp` when viewing `Blueharbor Logistics`).
   - Principle:
     - reduce duplicated controls and keep actions in the section where they are actually used.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

23. Scoped ROI and outcome weighting blocks to Overview only
   - `ROI estimate` and `Outcome weighting` blocks are now conditionally rendered only when the interstitial section is `Overview`.
   - They no longer render on `Gaps`, `Content`, `Meetings`, or `Integrations` (not merely hidden by attribute).
   - Principle:
     - keep section context clean by showing commercial summary widgets only on the overview surface.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`

24. Aligned interstitial and content surfaces to configurator visual language
   - Re-skinned interstitial record surfaces (`Overview`, `Gaps`, `Content`, `Meetings`, `Integrations`) to use the same card/question-block treatment as the configurator landing flow:
     - shared gradient card surfaces
     - shared border/radius/shadow depth
     - top accent bars on package, KPI, gap, and composer cards
   - Reduced bespoke interstitial tinting/alternate skin effects so the embedded record views now read as the same product system rather than a separate UI.
   - Updated embedded content shell/card styling to match the same shared card system for visual continuity when mounted inside interstitial `Content`.
   - Principle:
     - one visual system across intake and record workflows reduces cognitive switching and keeps dashboard subsections consistent with configurator styling.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`

25. Shifted visual alignment work to the customer follow-up widget and restored gaps treatment
   - Restored the previous `Gaps` card/follow-up rail visual treatment in interstitial (orange gap-card emphasis + prior composer styling) after regression feedback.
   - Applied configurator-style visual language directly to the customer follow-up widget (`/widget`):
     - card/question-block treatment with accent rails
     - consistent border/radius/shadow system
     - updated selection/controls styling to match configurator interaction patterns
   - Added follow-up-mode completion interactions in widget:
     - per-question `Missing/Complete` state chip on dynamic follow-up items
     - follow-up completion pill + progress bar for selected outstanding questions
   - Principle:
     - prioritize design consistency on the customer-facing follow-up form while preserving established AE-side gaps readability.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`

26. Matched follow-up cadence interaction to configurator card-choice pattern
   - Updated widget follow-up dynamic form so `Cyber resilience cadence today (best fit)` renders as two-column selectable cards (radio behavior) instead of a single dropdown.
   - Added cadence option copy to mirror configurator interaction language:
     - `Ad hoc`, `Quarterly`, `Monthly`, `Programmatic` with supporting helper lines.
   - Added card-layout styling hooks for follow-up items (`data-layout="cards"`) so dynamic follow-up controls match the established card interaction style.
   - Principle:
     - where the option set is compact and high-signal, use direct card selection over hidden dropdown choices for faster and clearer customer completion.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`

27. Unified widget option-paradigm with configurator card interactions
   - Added a shared select-to-card renderer in widget runtime and applied it to option-driven questions so they no longer mix dropdown and card paradigms for the same interaction class.
   - Widget base form now renders card-selection controls for key select questions (including `Role`, `Cadence`, and other package-fit/context selects) while preserving underlying source fields for payload compatibility.
   - Dynamic follow-up form now uses the same shared renderer for those same select-backed questions, so `Cadence today` and similar prompts match the configurator interaction style.
   - Principle:
     - enforce one interaction paradigm for option selection across widget and follow-up views to reduce UX inconsistency and repeated re-learning.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`

28. Canonicalized widget question copy/options to match configurator definitions
   - Updated customer widget base form question wording and answer sets to match configurator copy and taxonomy for:
     - pressure sources
     - urgent 90-day win
     - teams who need to be ready
     - risk environments
     - cadence, measurement, pain-point, and package-fit selectors
   - Expanded widget options to the full configurator set (for example: six urgent-win choices and full team coverage list) so widget and configurator no longer diverge by missing choices.
   - Updated follow-up dynamic form rendering to reuse option helper text from source controls, so follow-up cards now mirror the same question language and supporting descriptions.
   - Added legacy value alias normalization in widget runtime so older drafts/records map onto canonical IDs instead of dropping selections when option IDs changed.
   - Principle:
     - one canonical question model across intake and follow-up prevents semantic drift and keeps customer-visible prompts consistent with AE configurator workflows.
   - Cross-surface impact:
     - widget payloads now align to configurator canonical option IDs, reducing translation friction when records are opened in the dashboard/interstitial flow
     - previously saved legacy widget values remain readable via alias normalization during load/hydration
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`

29. Matched widget header to customer dashboard template hierarchy
   - Updated widget page shell to use the same dominant header pattern as `customer-dashboard-template-Pioneer-Cloud-2026-02-22.html`:
     - sticky top bar with Immersive logo + right-side CTA
     - hero card structure with the same class hierarchy and typographic pattern (`eyebrow`, large `h1`, supporting subtitle)
     - same hero background image treatment and overlay style
   - Kept the post-header layout as the requested two-column workbench:
     - left column: customer follow-up questions/form
     - right column: live snapshot of already answered questions
   - Principle:
     - customer-facing pages should share one recognizable header system so the follow-up flow feels like the same product surface as the dashboard templates.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`

25. Added launch-content structuring flow for integration releases and mapped it into gap logic + catalog outputs
   - Added a required `Context and tooling` gap question (`rq_stack`) so guided/advanced flows explicitly capture integration stack context.
   - Expanded stack options and outcome weighting to account for:
     - `MS Teams`
     - `REST API / automation`
     - `Workday Learning`
     - `SAP SuccessFactors`
     - `Cornerstone OnDemand`
   - Extended recommendation keyword/context mapping so integration signals influence content ranking for:
     - cyber workforce readiness
     - compliance evidence
     - secure enterprise outcomes
   - Cataloged the 2026-02-25 Immersive One integrated cyber readiness launch assets:
     - blog post
     - What’s New post
     - press release
   - Regenerated runtime content artifacts so catalog and RSS fallback include the launch material for recommendation surfaces.
   - Principle:
     - convert unstructured launch updates into deterministic schema fields/tags so content and gap workflows stay aligned per record.
   - Cross-surface impact:
     - affects guided/advanced question completion gating and record gap capture
     - affects recommendation/content selection and RSS fallback behavior in customer record flows
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/data/question-bank.v1.csv`
     - `/Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
     - `/Users/will.bloor/Documents/Configurator/assets/data/immersive-content-master.csv`
     - `/Users/will.bloor/Documents/Configurator/assets/js/content-catalog.js`
     - `/Users/will.bloor/Documents/Configurator/assets/data/official-blog-rss-curated.csv`
     - `/Users/will.bloor/Documents/Configurator/assets/js/official-blog-rss-fallback.js`

29. Added centralized workstream coordination board for parallel chats
   - Added a live branch/scope/status board:
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
   - Wired README coordination rules to require board updates before edits/handoff/push/deploy requests.
   - Principle:
     - keep ownership markers out of source code while giving all chats one shared operational context.
   - Cross-surface impact:
     - process-only change affecting all workstreams; no runtime behavior changes.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
     - `/Users/will.bloor/Documents/Configurator/README.md`

30. Aligned widget questions to configurator interaction patterns end-to-end
   - Updated widget question controls so Quick Discovery and follow-up mode use the same interaction paradigms as the configurator for high-signal fields:
     - `Role` now renders as chip-style selectable options (instead of a dropdown/select-card mismatch)
     - `Teams who need to be ready` now renders as chip-style multi-select in base widget and dynamic follow-up form
     - Card-based questions (for example `Cadence` and other select-backed fit/context prompts) continue to use the shared card renderer with consistent label/hint treatment
   - Simplified follow-up question header metadata:
     - removed stage badge-driven visual treatment in dynamic follow-up items
     - retained completion state chips (`Missing` / `Complete`) so customers still get progress feedback without conflicting paradigms
   - Updated widget chip/card styling tokens so the question blocks and right snapshot rail remain visually consistent with configurator language while preserving the widget two-column layout.
   - Principle:
     - one control paradigm per question type across configurator and widget reduces cognitive switching and removes visible "same question, different UI" regressions.
   - Cross-surface impact:
     - follow-up links from dashboard `Gaps` now open a customer follow-up form that matches configurator controls more closely, reducing interpretation drift between AE and customer views.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
   - Residual risk / follow-up:
     - browser `file://` sessions may cache old CSS/JS; hard refresh is required to verify latest control rendering.

31. Switched widget answer-card layout to row-first (no squeezed two-column cards)
   - Updated widget card-grid behavior so card-style options render as single-column rows instead of side-by-side columns.
   - Applied row-first layout to both:
     - static form card questions
     - dynamically rendered follow-up card questions
   - Fixed card internal layout so helper text sits below the option label (not compressed alongside it).
   - Principle:
     - prioritize readability and scannability over horizontal density; avoid card text compression at medium widths.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`

32. Added adaptive card density, follow-up accordion, and contact gating for gaps/follow-up
   - Updated widget card layout rules to match configurator density without over-long single-column flow:
     - card questions now render two columns when option count is greater than `3`
     - card questions with `3` or fewer options remain single-column
     - applied to static widget fields and dynamically rendered follow-up controls
   - Reduced follow-up-mode duplication in widget:
     - wrapped base questionnaire sections in a collapsible `Full questionnaire` accordion
     - in follow-up mode, this accordion is collapsed by default so the requested outstanding-question list is the primary focus
   - Added widget follow-up contact gate:
     - outstanding follow-up question controls are locked when `name` + valid `business email` are missing
     - inline error alert is shown in the follow-up panel until contact fields are present
   - Added dashboard gaps follow-up contact gate (AE/SDR side):
     - follow-up checkboxes/composer are disabled when contact `name` + `business email` are missing on the record snapshot
     - gaps list gets locked visual treatment and composer shows a blocking alert explaining mandatory fields
   - Principle:
     - preserve scanable two-column density for larger answer sets, avoid duplicate question surfaces in follow-up mode, and enforce minimum contact identity before customer follow-up workflows are enabled.
   - Cross-surface impact:
     - dashboard `Gaps` follow-up generation and `/widget?followup=...` completion now share the same mandatory-contact dependency, reducing dead-end follow-up links and mismatched behavior.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`

32. Release-gate reconciliation + security/logic validation sweep before push
   - Reconciled source/runtime content catalog drift:
     - removed two stale `blog-post:*` rows from `/Users/will.bloor/Documents/Configurator/assets/data/immersive-content-master.csv` that had aged out of runtime `content-catalog.js` by the 1095-day recency window.
     - result: source CSV and runtime catalog now contain the same `313` IDs.
   - Added/updated live coordination metadata for release-gate execution in:
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
   - Principle:
     - release decisions must be based on runtime-accurate data and explicit multi-chat ownership state.
   - Cross-surface impact:
     - content recommendation surfaces now have no source/runtime ID drift for the active catalog window.
     - no UI/runtime behavior change outside data consistency and process governance tracking.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/data/immersive-content-master.csv`
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/content-catalog.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/official-blog-rss-fallback.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/clean_content_csv_by_recency.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/generate_question_bank_js.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_content_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_operations_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/sync_official_blog_rss_curated.mjs`
     - generated-vs-checked sync:
       - `question-bank.v1.csv` ↔ `question-bank.js` (PASS)
       - `official-blog-rss-curated.csv` ↔ `official-blog-rss-fallback.js` (PASS)
       - `immersive-content-master.csv` ↔ `content-catalog.js` ID set parity (PASS after recency cleanup)
     - security sweep:
       - no secrets detected in repo pattern scan
       - no `eval`/`new Function` introduced in active runtime files
       - CSP/security headers present in `/Users/will.bloor/Documents/Configurator/vercel.json` and CSP/referrer meta present in `/Users/will.bloor/Documents/Configurator/index.html`
   - Residual risk / follow-up:
     - no headless browser E2E test harness is present in-repo, so route/render behavior is validated by static/runtime checks only.

33. Added structured copy-rules layer and wired generation outputs for on-brand language
   - Added a centralized runtime copy-rules module:
     - `/Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
   - Encoded messaging/tone structure from:
     - `Immersive Tone of Voice Guidelines - Approved Copy.docx`
     - `Immersive Master Messaging.docx`
   - Implemented audience/context-aware copy composition for:
     - landing page/dashboard template narrative (hero + summary + prove/improve/report card language)
     - content email builder subject/body framing
     - customer follow-up email builders (interstitial + widget)
   - Added safe fallback behavior:
     - if copy rules are unavailable, existing hardcoded generation copy remains active.
   - Wired copy-rules loading into both app surfaces:
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
   - Principle:
     - enforce consistent, audience-aware brand language across generated outputs using a single structured rules layer instead of duplicated string templates.
   - Cross-surface impact:
     - updates customer-facing generated language in dashboard-template output, content email drafts, and follow-up email drafts while preserving existing workflow logic.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
   - Residual risk / follow-up:
     - copy quality is now deterministic and consistent, but should be spot-checked in browser flows for final phrasing preferences by audience.

34. Tightened follow-up gating, removed fallback identity leakage, and defaulted ROI/outcomes to neutral until configured
   - Fixed customer follow-up contact source in dashboard `Gaps` composer:
     - follow-up contact now resolves from record snapshot contact fields only (`fullName`, `email`)
     - removed fallback to internal updater identity (`updatedBy`, `updatedByEmail`)
     - follow-up greeting now defaults to `Hi,` when no customer first name is available (never `Hi there`/internal actor fallback)
   - Strengthened and simplified `Gaps` follow-up composer UX:
     - generation remains blocked unless record has customer `name` + valid `business email`
     - swapped button order so primary action appears first:
       - `Create follow-up for customer` then `Clear`
     - removed duplicated recommendation/max pills; retained concise limit line and over-recommended warning only
     - relabeled composer context to `Email generator`
   - Adjusted overview signal defaults for low-input records:
     - ROI metrics now render as `—` until ROI assumptions differ from baseline/default model inputs
     - outcome fallback changed from `Outcome confidence pending 100%` to neutral `Awaiting outcome signals` at `0%`
   - Added mandatory business email capture into configurator identity section:
     - new `Business email` input in Step 0 (`About`) near name/company
     - readiness requirement row added for `email` so missing email appears as a gap
     - readiness context + requirement checks now validate business email format
     - new-record initialization no longer pre-fills customer `name`/`email` from account defaults
   - Re-scoped widget follow-up gate messaging:
     - removed widget-side blocking alert for missing contact details
     - gating message/disable behavior is now enforced on dashboard `Gaps` composer (AE workflow origin)
   - Principle:
     - prevent internal-user identity bleed into customer follow-up, enforce contact prerequisites at the source action, and avoid implying recommendation confidence from untouched default assumptions.
   - Cross-surface impact:
     - dashboard follow-up generation, customer follow-up email copy, and widget follow-up entry are now aligned to record-sourced customer contact semantics and cleaner neutral defaults.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/assets/data/question-bank.v1.csv`
     - `/Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `/Users/will.bloor/Documents/Configurator/landing-pages/customer-self-service-widget-prototype.html`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`

35. Validation sweep fix: persisted identity/contact fields on save + stabilized outcome-weighting bars (**Superseded in part by entry 36**)
   - Fixed a save-path reliability issue where record identity/contact/context edits could be missed if browser `input/change` events were not emitted predictably (for example autofill or edge timing interactions).
   - `saveActiveRecord(...)` now performs an explicit DOM-to-state sync immediately before commit for:
     - `fullName`
     - `company`
     - `companySize`
     - `operatingCountry`
     - `industry`
     - `region`
     - lead/contact fields (`businessEmail`, `email`, `phone`, `notes`, `optin`)
   - Expanded DOM-to-state sync to include card/radio/checkbox-driven question controls (role, pressure/risk/coverage/package-fit/context/tooling selections), and invoked it on step transitions (`Continue`/`Back`/step jumps) as well as save.
   - This ensures saved snapshot state is sourced from the currently rendered UI selections, even when browser/event timing causes state drift.
   - This keeps `thread.snapshot.fullName` / `thread.snapshot.email` aligned with saved form values, so `Gaps` follow-up gating reflects the latest saved record state.
   - Fixed interstitial `Outcome weighting` bar flicker:
     - added per-record/section animation IDs
     - bars animate once, then render at stable width on subsequent re-renders
   - Principle:
     - persist authoritative record values at save time and avoid repeated non-informative animations during routine re-renders.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Important:
     - The broad pre-save / pre-step DOM-to-state sync approach documented here caused a regression and is superseded by entry `36`.
     - Do not reintroduce this pattern.

36. Hotfix: rollback destructive pre-save/pre-step DOM sync that could wipe record state
   - Corrected a regression introduced in entry `35` where aggressive DOM-to-state synchronization on:
     - step transitions (`setActiveStep`)
     - save commit path (`saveActiveRecord`)
     could overwrite in-memory record state from partial/hidden DOM and lead to severe completion collapse after save/return.
   - Removed the pre-step and pre-save `syncRecordInputsFromDom()` calls and removed the helper entirely.
   - Hardened `syncLeadFromDOM()` so non-rendered views cannot clear persisted lead/contact fields:
     - values are now only pulled when the corresponding controls are present
     - missing DOM controls no longer zero-out `state.email`/lead values.
   - Principle:
     - state should remain event-driven and non-destructive; save/route paths must not infer authoritative data from partial DOM.
   - Cross-surface impact:
     - protects configurator save/return integrity, overview completion scoring, and gaps follow-up gating from false missing-field regressions caused by state overwrite.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `for f in /Users/will.bloor/Documents/Configurator/assets/js/*.js; do node --check \"$f\"; done`

37. Release-process compliance sweep for `codex/copy-rules` push/handoff
   - Executed full gate checks on branch state before handoff confirmation:
     - JS/runtime/script syntax checks (`node --check`) across app + widget + catalog + helper scripts
     - README absolute-path audit (with expected historical removals for Firebase artifacts)
     - generated artifact parity checks:
       - `question-bank.v1.csv` ↔ `question-bank.js`
       - `official-blog-rss-curated.csv` ↔ `official-blog-rss-fallback.js`
       - `immersive-content-master.csv` ↔ `content-catalog.js`
     - security checks:
       - secret-pattern scan (no hits)
       - `eval`/`new Function` scan (no active hits)
       - CSP/security header verification in `vercel.json` + CSP/referrer meta check in `index.html`
   - Updated workstream board status and handoff log for `copy-rules` with the completed gate evidence.
   - Principle:
     - pushes and handoffs must include explicit, repeatable validation evidence, not only a successful Git transport event.
   - Cross-surface impact:
     - process-only governance update; runtime behavior unchanged.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/README.md`
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/content-catalog.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/official-blog-rss-fallback.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/clean_content_csv_by_recency.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/generate_question_bank_js.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_content_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_operations_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/sync_official_blog_rss_curated.mjs`
   - Residual risk / follow-up:
     - no in-repo automated browser E2E suite exists; manual UI phrasing review still recommended before merge to shared branch.

38. Main-branch promotion of `copy-rules` with merged-state release gate rerun
   - Merged branch:
     - `codex/copy-rules` -> `main`
   - Re-ran full release gate on merged `main` state before push:
     - syntax checks (`node --check`) across app/widget/catalog/scripts
     - README path audit (allowing documented removed Firebase artifacts)
     - generated data parity checks (`question-bank`, `official RSS fallback`, `content catalog`)
     - security scans (secret patterns + `eval/new Function`)
     - config/header checks (`vercel.json` parse + CSP/security headers/meta presence)
   - Updated workstream board to mark `copy-rules` as `merged` and log main-promotion gate evidence.
   - Principle:
     - shared-branch promotion must be validated on the post-merge code graph, not inferred from workstream-branch checks.
   - Cross-surface impact:
     - promotes structured copy-rules behavior to shared branch while preserving previously validated logic/data/security posture.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/README.md`
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/content-catalog.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/official-blog-rss-fallback.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/clean_content_csv_by_recency.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/generate_question_bank_js.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_content_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_operations_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/sync_official_blog_rss_curated.mjs`
   - Residual risk / follow-up:
     - browser phrasing QA remains manual because there is no automated UI text-assertion suite in-repo.

39. Added deterministic fallback contact identity defaults for all records
   - Added shared contact normalization helpers in app runtime:
     - `emailLooksValid(...)`
     - `contactFallbackToken(...)`
     - `ensureSnapshotContactIdentity(...)`
   - `normalizeThreadModel(...)` now guarantees every record snapshot has:
     - `fullName` (fallback: `Primary Contact`)
     - valid `email` (fallback: `contact.<company-or-record-token>@example.invalid`)
   - This applies to both:
     - existing records loaded from storage (hydration/normalization path)
     - newly created/updated records that pass through normalization before persistence
   - Consolidated follow-up email validation to the same `emailLooksValid(...)` helper to keep one validation rule.
   - Principle:
     - enforce minimum contact identity completeness across the record lifecycle so downstream follow-up and content/email flows do not fail on missing fields.
   - Cross-surface impact:
     - dashboard `Gaps` follow-up composer and any generated email surfaces that depend on snapshot contact identity now receive deterministic fallback values instead of blanks.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Residual risk / follow-up:
     - fallback values are intentionally synthetic; operators should still overwrite with verified customer contact details before external sends.

40. Added archive icon action to record header (left of Edit record)
   - Enabled the existing icon-only archive control in the interstitial record action bar so it appears immediately left of `Edit record`.
   - Behavior:
     - visible on active record pages
     - hidden in archived-only mode (where `Edit record` becomes `Unarchive`)
     - disabled for non-owner/non-admin roles
     - disabled for unsaved `current` records (with save-first tooltip)
   - Principle:
     - make archive action discoverable at point-of-use while preserving role and record-state safeguards.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`

41. Main-branch promotion of `default-contact` with merged-state release checks
   - Merged branch:
     - `codex/default-contact-fallbacks` -> `main`
   - Re-ran release checks against merged `main` state before push:
     - `node --check` on app/widget/catalog/runtime scripts
     - README absolute-path reference audit (allowing documented removed Firebase artifacts)
     - secret-pattern scan and `eval`/`new Function` scan
     - `vercel.json` parse and security-header presence checks
     - CSP/referrer meta presence checks in `/Users/will.bloor/Documents/Configurator/index.html`
   - Updated workstream board to mark `default-contact` as `merged` and logged merged-state gate evidence.
   - Principle:
     - promotion to shared branch must be validated after merge, not inferred from feature-branch checks alone.
   - Cross-surface impact:
     - promotes deterministic fallback contact identity + archive action discoverability to shared branch without changing previously validated security/header posture.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/README.md`
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/content-catalog.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/official-blog-rss-fallback.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/question-bank.js`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/clean_content_csv_by_recency.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/generate_question_bank_js.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_content_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/reconcile_operations_csvs.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/sync_official_blog_rss_curated.mjs`
   - Residual risk / follow-up:
     - fallback contact values are synthetic by design and should be replaced with verified customer details before any external send workflow.

42. Save-before-leaving guard, test-email governance toggle, and self-service modules import fix (2026-02-27)
   - Added save-before-leaving behavior for configurator exits on saved records:
     - when leaving `configurator` for `dashboard`, `archived`, `account`, `backend`, `interstitial`, or `export`, unsaved changes are committed first
     - if save is already in progress, navigation is blocked with `Saving changes. Please wait a moment.`
     - if save fails (permissions/read-only/lock), navigation is blocked with `Unable to save changes right now. Please try again.`
   - Added targeted pre-save guards to flows that can mutate active record context before view switch:
     - `openThreadOverview(...)`
     - `openCrmExportView(...)`
   - Added account advanced setting `Allow test emails` (`on` by default):
     - when `off`, synthetic fallback emails (`@example.invalid`) are not treated as valid customer emails
     - snapshot contact fallback now leaves email blank instead of injecting synthetic addresses when test emails are disabled
     - follow-up/contact validation and consultation booking now use the same policy-aware validator
   - Fixed self-service import normalization bug for record modules:
     - `normalizeThreadModel(...)` now preserves object-shaped `modules` from imported/self-service records
     - generated modules are used only when import payload modules are absent
   - Principle:
     - prevent stale overview completion caused by unsaved configurator exits, keep synthetic test contacts explicitly controllable, and preserve imported record fidelity.
   - Cross-surface impact:
     - configurator-to-overview/export transitions now reflect deselections and completion changes immediately after leave
     - account advanced settings now directly influence follow-up/contact validity and booking prerequisites
     - imported widget/self-service records retain authored module content in dashboard/interstitial surfaces
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/customer-self-service-widget-prototype.js`
   - Residual risk / follow-up:
     - save-before-leaving behavior should be manually smoke-tested across all exit controls (left nav, breadcrumb, header actions, and route hash navigation) for toast timing/read-only messaging consistency.

43. Added structured capability-priority model and surfaced it in generated customer landing output (2026-02-27)
   - Added a structured capability taxonomy layer in runtime generation logic:
     - capability catalog includes pillars and modules aligned to Immersive One positioning (for example: `Prove`, `Improve`, `Benchmark & Report`, `Programs`, integration orchestration)
     - each capability carries outcome alignment, stack-signal matching keywords, and evidence/proof-point prompts
   - Added deterministic priority scoring for landing generation:
     - `capabilityPriorityCardsForGate(...)` scores capabilities using record outcome signals (`gate.topOutcomes`) and stack/tooling signals (`gate.stackSignals`)
     - output is a ranked capability list with `why now` rationale + proof points
   - Wired the capability layer into customer landing-page model/output:
     - `customerTemplateModelFromCandidate(...)` now adds `priorityCapabilities`
     - hero primary CTA now points to `#priority-capabilities` when capability priorities are available
     - generated HTML includes a new section:
       - `Priority capabilities your selections demand`
       - responsive card grid with pillar label, rationale, and proof points
   - Principle:
     - convert research/taxonomy intelligence into deterministic, per-record landing narrative that explains which capabilities should be prioritized and why.
   - Cross-surface impact:
     - customer landing pages now render capability-priority guidance directly from the same discovery/outcome/stack signals used in recommendations.
     - keeps generated copy anchored to selected record context instead of static generic capability messaging.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Residual risk / follow-up:
     - capability ranking is heuristic and should be spot-checked with real records to tune weighting/rationale phrasing for edge combinations.

44. Added in-app section "Your priority Immersive One features mapped to PIBR" in Content view (2026-02-27)
   - Added a dedicated capability-priority section directly in the `record-content` workspace:
     - section title: `Your priority Immersive One features mapped to PIBR`
     - rendered above mapped content cards in the Content view
   - Extended capability model payload returned by `capabilityPriorityCardsForGate(...)`:
     - added explicit `pibrTrack` mapping (`Prove`, `Improve`, `Benchmark & Report`, or `Cross-PIBR`)
     - added matched questionnaire outcome labels per capability (`outcomes`)
   - Wired the section to questionnaire outcomes + profile context:
     - uses `gate.topOutcomes` and selected stack signals to score/rank features
     - each feature card now shows:
       - PIBR mapping
       - Immersive One capability pillar
       - mapped outcomes from the questionnaire
       - rationale (`why now`) and proof focus
   - Updated generated customer-page wording to match this naming:
     - renamed capability section heading to `Your priority Immersive One features mapped to PIBR`
     - updated hero CTA label to `Priority features` when this section is available
   - Principle:
     - make capability recommendations explicit in the operator workspace, not only in generated customer-page output.
   - Cross-surface impact:
     - Content view now surfaces platform-feature priorities alongside content recommendations.
     - Existing customer-page generation keeps using the same capability-priority model, now with richer metadata.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Residual risk / follow-up:
     - `Cross-PIBR` mapping is intentional for integration/program orchestration features and may be tuned if a stricter single-pillar mapping is required in future copy.

45. Added CSV-driven natural-language rules for priority feature cards (2026-02-27)
   - Reworked priority feature card copy to be more natural and audience-ready:
     - cards now render fixed capability descriptions + `Why this matters to you` bullets
     - removed repetitive replay labels in the Content view card body
   - Added a configurable natural-language rule layer for copy permutations:
     - new source CSV: `/Users/will.bloor/Documents/Configurator/assets/data/capability-language-rules.v1.csv`
     - supports capability/outcome/signal-conditioned bullet templates with priority ordering
   - Added generation pipeline for runtime rules payload:
     - new script: `/Users/will.bloor/Documents/Configurator/scripts/generate_capability_language_rules_js.mjs`
     - generated runtime file: `/Users/will.bloor/Documents/Configurator/assets/js/capability-language-rules.js`
     - loaded in UI shell before app runtime
   - Runtime logic updates:
     - `capabilityPriorityCardsForGate(...)` now resolves rule-matched bullets first, then falls back to heuristic bullet generation
     - feature cards in both Content view and generated customer-page output now consume `description` + `whyBullets`
   - Principle:
     - move from hardcoded, repetitive rationale strings to editable copy rules that can scale with new questionnaire permutations.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/assets/data/capability-language-rules.v1.csv`
     - `/Users/will.bloor/Documents/Configurator/scripts/generate_capability_language_rules_js.mjs`
     - `/Users/will.bloor/Documents/Configurator/assets/js/capability-language-rules.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/capability-language-rules.js`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/generate_capability_language_rules_js.mjs`
   - Residual risk / follow-up:
     - copy quality is now data-driven; rule coverage should be expanded over time for niche signal combinations to reduce fallback usage.

46. Refined customer content preview build animation to section-by-section stagger (no opacity wash)
   - Reworked customer page preview build behavior to remove the clunky full-canvas loading/opacity effect.
   - New behavior:
     - no dark overlay theatre during preview build
     - each top-level preview section now fades in sequentially from top to bottom
     - reduced timing for faster, cleaner perceived load
   - Implementation details:
     - `runCustomerPreviewBuildTheatre(...)` now stages and reveals section blocks directly without loader overlay timing.
     - `customerPreviewBuildBlock` pending state now uses true fade-in (`opacity: 0 -> 1`) with slight vertical lift.
   - Principle:
     - make preview generation feel intentional and readable, not blocked or visually noisy.
   - File:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`

47. Added live customer-page publish flow on Vercel Blob with server-side guardrails (2026-02-27)
   - Added live publish actions in Content and preview workflows:
     - `Publish customer page` button in Content header and preview actions.
     - `Open live page` button in preview after successful publish.
   - Added backend publish/resolve endpoints:
     - `POST /api/publish-customer-page` writes deterministic blob keys (`customer-pages/<slug>.html`) with overwrite enabled.
     - `GET /api/customer-page?slug=<slug>` resolves exact blob pathname and redirects to the stored public blob URL.
   - Added Vercel route rewrites for public-friendly URLs:
     - `/customer-pages/:slug` and `/customer-pages/:slug/` -> `/api/customer-page?slug=:slug`
   - Added endpoint hardening for obvious abuse paths:
     - publish endpoint now requires `Content-Type: application/json`.
     - publish endpoint rejects cross-origin requests via host/origin validation.
     - publish endpoint sanitizes forwarded host/protocol before composing `liveUrl`.
     - resolve endpoint now requires exact pathname match (no prefix fallback redirect).
   - Added runtime dependency required by serverless endpoints:
     - `@vercel/blob` in `/Users/will.bloor/Documents/Configurator/package.json`
   - Principle:
     - allow controlled live sharing of generated customer pages while reducing trivial cross-origin publish abuse and ambiguous blob resolution.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/vercel.json`
     - `/Users/will.bloor/Documents/Configurator/api/publish-customer-page.js`
     - `/Users/will.bloor/Documents/Configurator/api/customer-page.js`
     - `/Users/will.bloor/Documents/Configurator/package.json`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/api/publish-customer-page.js`
     - `node --check /Users/will.bloor/Documents/Configurator/api/customer-page.js`
     - `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('/Users/will.bloor/Documents/Configurator/vercel.json','utf8')); console.log('vercel.json parse: PASS');"`
   - Residual risk / follow-up:
     - endpoint authorization is currently environment/perimeter-based; if this surface is exposed to broad/public traffic, add explicit authenticated actor controls and rate limiting before external rollout.

48. Preview-link behavior update for published customer pages (2026-02-27)
   - Updated preview/live link behavior in Content preview:
     - renamed action copy from `Open live page` to `View preview link`.
     - preview action now resolves deterministic customer-page route (`/customer-pages/<slug>`) from profile/company slug when available.
     - if a publish response URL exists, it still takes priority; otherwise the deterministic route is used.
   - Updated generated customer page top-bar action:
     - injected `View preview link` button that opens `/customer-pages/<slug>` when hosted over HTTP(S).
     - in non-hosted contexts, falls back to copying/opening the current URL.
   - Updated resolver endpoint behavior for `/api/customer-page`:
     - switched from redirecting to blob URL (`307 Location`) to fetching blob HTML server-side and returning `200 text/html`.
     - avoids exposing raw blob URL and keeps stable app-route URL semantics.
   - Principle:
     - keep customer-page links stable and user-readable while improving preview-link usability across hosted and local contexts.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/api/customer-page.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/api/customer-page.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`

49. Customer-facing landing language pass: removed internal package phrasing (2026-02-27)
   - Updated landing hero copy generation in `buildLandingCopy(...)`:
     - removed `This view is tuned for ... and aligned to ... package priorities.`
     - replaced with customer language: `Based on what you shared, this plan focuses on ...`
   - Updated customer landing model/preview labels:
     - hero stat changed from `Package` to `Readiness plan`
     - preview top-bar label changed from `Recommended package` to `Recommended readiness plan`
     - customer-facing plan title now uses external naming (`Foundation`, `Performance Readiness`, `Assurance`) instead of package labels.
   - Principle:
     - customer outputs should use outcome-led language and avoid internal packaging terminology.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/copy-rules.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`

50. Added readiness-pyramid mapping layer and wired it into Content view generation (2026-02-27)
   - Added and normalized the readiness pyramid data model:
     - new source file: `/Users/will.bloor/Documents/Configurator/assets/data/readiness-pyramid-model.v1.csv`
     - fixed malformed CSV rows and aligned all rows to the canonical 13-column schema
   - Hardened pyramid model generation:
     - updated `/Users/will.bloor/Documents/Configurator/scripts/generate_readiness_pyramid_model_js.mjs` to fail fast on malformed row column counts
     - regenerated runtime payload: `/Users/will.bloor/Documents/Configurator/assets/js/readiness-pyramid-model.js`
   - Wired runtime mapping in app logic:
     - added `readinessPyramidViewModel(...)` with layer-by-layer mapping from answered discovery signals:
       - pain points -> outcomes -> PIBR capabilities -> platform -> brand
     - uses thread snapshot selections, inferred top outcomes, and ranked priority capabilities to build mapped layer cards
   - Updated Content view rendering:
     - now renders:
       - `Your readiness pyramid mapping`
       - `Your priority Immersive One features mapped to PIBR`
       - mapped recommendation cards from catalog
     - added structured card renderers for recommendation cards, priority feature cards, and pyramid layer cards
   - Updated styles:
     - added dedicated pyramid section/card styles in `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - simplified priority feature cards to fixed capability description + "Why this matters to you" bullets
   - Principle:
     - make the content model explicit and customer-readable so outputs reflect a clear narrative chain from discovered pain to platform capability and brand promise.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/data/readiness-pyramid-model.v1.csv`
     - `/Users/will.bloor/Documents/Configurator/scripts/generate_readiness_pyramid_model_js.mjs`
     - `/Users/will.bloor/Documents/Configurator/assets/js/readiness-pyramid-model.js`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/scripts/generate_readiness_pyramid_model_js.mjs`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/readiness-pyramid-model.js`
   - Residual risk / follow-up:
     - layer relevance scoring is heuristic; tune row-level option mappings and score weights as real account permutations are reviewed.

51. Split pyramid mapping into a dedicated "Story mapping" record nav section (2026-02-27)
   - Added a new interstitial record section directly under `Content`:
     - label: `Story mapping`
     - route segment: `#/records/:recordId/record-story-mapping`
   - Moved readiness pyramid rendering out of the Content section:
     - removed `Your readiness pyramid mapping` block from embedded `record-content`
     - Content now focuses on:
       - `Your priority Immersive One features mapped to PIBR`
       - mapped content recommendation cards
       - customer page preview/publish actions
   - Added a dedicated Story Mapping surface and renderer:
     - new mounted view shell: `#storyMappingView`
     - gate behavior aligned with content readiness threshold (`>= 90%`)
     - renders readiness pyramid layers from:
       - pain points -> outcomes -> PIBR capabilities -> platform -> brand
   - Refined Story Mapping layer cards to explicit two-column narrative + evidence rows:
     - left column (`~70%`) now shows mapped theme descriptions with relative weighting by matched-signal score
     - right column (`~30%`) now lists explicit driving signals (question labels + captured values), replacing generic "backed by X signals" phrasing
     - evidence now includes concrete drivers such as:
       - pressure sources
       - urgent 90-day win
       - risk environment
       - measured baseline
       - coverage/tooling/regulatory context when matched
   - Reworked Story Mapping for dashboard scanability:
     - each layer now renders a 2-up grid of per-theme cards (instead of dense list blocks)
     - each theme card includes:
       - weighting ring visualization
       - theme title + description
       - compact signal evidence list inside the same card
     - preserves full mapping logic while reducing visual overload for high-theme layers.
   - Updated interstitial left-nav and overview summaries:
     - section rail now includes `Story mapping` beneath `Content`
     - overview status cards include a `Story mapping page` readiness row
   - Principle:
     - separate narrative mapping from content recommendation execution so both tracks can be worked in parallel without overloading the Content page.
   - Cross-surface impact:
     - deep links to content remain `record-content`
     - new story links route to `record-story-mapping` while preserving existing interstitial navigation flow.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/readiness-pyramid-model.js`
   - Residual risk / follow-up:
     - run a manual interstitial route smoke pass for both sections:
       - `#/records/:recordId/record-content`
       - `#/records/:recordId/record-story-mapping`
     - verify section-state persistence when switching quickly between `Content` and `Story mapping`.

52. Enriched Story Mapping brand layer with brand architecture signals (2026-02-27)
   - Updated brand-layer narrative content in Story Mapping to include explicit brand strategy anchors:
     - `Brand idea`: `Be ready`
     - `Purpose`: `To make the world ready for what's next`
     - `Positioning`: `We give organisations the human edge`
     - `Values`: `Driven`, `Resilience`, `Customer Delight`, `Inclusive`, `One Team`
     - `Personality`: `Intelligent`, `Pioneering`, `Empathetic`
   - Brand layer card output now combines:
     - static brand architecture signals above
     - mapped account context signals (pain themes, outcomes, capability proof points)
   - Added brand-specific narrative line in card description:
     - `Be Ready with Immersive means turning uncertainty into confident action through measurable human readiness.`
   - Principle:
     - keep the top-of-pyramid brand story explicit and consistent with brand strategy while still grounded in account-specific mapping context.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`

53. Story Flow UX overhaul: mode system, focus clarity, and full-bleed card-map (2026-02-28)
   - Added explicit Story Flow mode cycle in overlay controls:
     - `Sankey map` -> `Card map` -> `Narrative cards`
     - mode toggles now route through a single resolver/next-mode flow
   - Standardized viewport reset behavior:
     - switching Story Flow modes now always returns to reset viewport state
       (`zoom=1`, `panX=0`, `panY=0`, no fit carry-over)
     - manual `Reset` action now reuses the same shared reset helper
   - Improved path/card focus behavior for clarity:
     - selecting a node or path keeps related journey visible
     - non-related content is dimmed to low emphasis (`15%` for cards)
     - related cards are explicitly styled in blue to show membership in the selected story
   - Added card-map-specific vertical storytelling mode:
     - vertical layer rows using narrative card content (`What it is`, `Why it matters`, `Driven by`)
     - card-map now runs without connector lines by design (removed to reduce visual noise)
     - card-map switched to full-bleed presentation with no top inset gap
   - Simplified Story Flow visual noise:
     - removed bottom hint pill (`Node size and link width ...`) from display
     - moved verbose lower inspector context into a collapsible details block (`More context`)
   - Updated overlay layout and depth hierarchy:
     - Insights panel made materially thinner
     - stronger floating elevation/shadow on inspector
     - raised card and path surfaces with material-style shadows
   - Prevented panel overlap on first-stage cards:
     - Sankey layout now reserves a left inset based on inspector width
     - stage-1 cards default to start to the right of Insights panel
   - Principle:
     - prioritize immediate readability of story relationships over decorative density;
       selected journey should be obvious at first glance, non-selected context should recede.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/assets/css/app.css`
     - `/Users/will.bloor/Documents/Configurator/index.html`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Residual risk / follow-up:
     - run manual UX smoke on Story Flow across at least two records and all three modes:
       - verify mode cycle + reset behavior
       - verify card-map full-bleed in desktop + mobile breakpoints
       - verify selected journey highlight + 15% dimming behavior remains consistent after repeated mode switches.

54. README alignment pass for current generator + routing state (2026-02-28)
   - Corrected `Current Dashboard Behavior` hero CTA description:
     - primary CTA now documents conditional target behavior:
       - `#priority-capabilities` when priority capability cards exist
       - fallback to `#recommended-for-you` otherwise
   - Updated generated output section order to include:
     - `Priority capabilities (when present)` before narrative storyboard sections
   - Added missing route in `Routing support`:
     - `#/records/:recordId/record-story-mapping`
   - Principle:
     - README must reflect current runtime behavior and active route surface so deploy/handoff decisions are based on accurate docs.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - matched README updates against current runtime references in:
       - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`

55. Tuned package scoring to make Ultimate less over-gated and added $50bn+ revenue weighting (2026-02-28)
   - Updated `score()` tier logic to reduce aggressive Ultimate suppression:
     - relaxed non-obvious Ultimate penalties (smaller deductions when gate criteria are partially missing)
     - reduced low-pressure Ultimate penalty in borderline cases
     - replaced fixed Ultimate lead requirement (`1.2`) with a lower adaptive threshold (`0.6` when Ultimate is likely, `0.9` otherwise)
   - Added explicit high-revenue weighting using numeric `state.revenueB` (USD billions):
     - `>= 50` now adds a strong Ultimate/pressure boost and scale contribution
     - `>= 25` adds a smaller step-up boost
   - Expanded scale gating input:
     - `scaleSignal` now includes revenue-derived enterprise signal (`$25bn+`, `$50bn+`)
   - Added `ultLikely` runtime signal:
     - true when `ultObvious` is met, or when external accountability + large scale are present with `$50bn+` revenue
     - used for softer penalty/demotion behavior so large, externally-accountable accounts are not pushed back to Advanced too easily
   - Principle:
     - keep Ultimate selective, but avoid over-penalizing enterprise profiles where strategic scale and accountability are already clear.
   - Cross-surface impact:
     - configurator recommendation tier now promotes Ultimate more often for large-enterprise records, which flows through overview, exports, and generated summary/report outputs.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Residual risk / follow-up:
     - run quick manual scoring checks for small/medium records to confirm Core/Advanced recommendations remain sensible after the Ultimate uplift.

56. Removed `picsum.photos` capability-card image fallback to keep runtime output first-party only (2026-02-28)
   - Replaced `capabilityCardImageUrl(...)` placeholder image fallback:
     - removed seeded `https://picsum.photos/...` URL generation
     - now uses direct capability image URL when provided, otherwise falls back to `IMMERSIVE_DEFAULT_IMAGE_URL`
   - Principle:
     - generated customer-facing outputs should avoid placeholder-image services and use controlled first-party/default imagery.
   - Cross-surface impact:
     - priority capability cards in Content preview and generated customer-page output now never render `picsum.photos` images.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `rg -n "picsum\\.photos" /Users/will.bloor/Documents/Configurator/assets/js/app.js /Users/will.bloor/Documents/Configurator/landing-pages/customer-dashboard-template-Pioneer-Cloud-2026-02-22.html` (PASS)

57. Second-pass Ultimate tuning: stronger $50bn+ bias and lighter suppression thresholds (2026-02-28)
   - Increased explicit `$50bn+` enterprise weighting in `score()`:
     - reduced `Advanced` uplift at this tier
     - increased `Ultimate` uplift and pressure contribution so very large records can break through more reliably
   - Relaxed Ultimate suppression further when `ultObvious` is not strictly met:
     - reduced non-obvious penalty magnitudes again
     - reduced low-pressure penalty again
     - lowered final Ultimate lead requirement (`minUltLead`) to reduce near-tie fallback to Advanced
   - Expanded `ultLikely` behavior for enterprise records:
     - for `$50bn+` + large-scale records, either external accountability or strategic/service framing can qualify as `ultLikely`
     - non-obvious branch now adds a recovery uplift when this enterprise-likely condition is met
   - Principle:
     - keep Ultimate meaningful while reducing over-filtering for very large enterprise accounts.
   - Cross-surface impact:
     - recommendation tier in configurator/overview/report/export now promotes Ultimate more readily for top-end enterprise profiles.
   - Files:
     - `/Users/will.bloor/Documents/Configurator/assets/js/app.js`
     - `/Users/will.bloor/Documents/Configurator/README.md`
   - Validation performed:
     - `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`
   - Residual risk / follow-up:
     - run quick manual spot checks on mid-market records to confirm Advanced/Core recommendations remain sensible.

## State Sync Guardrails (Critical, 2026-02-26)

These are hard rules to prevent recurrence of the Tina Corp save-loss regression.

1. Never do broad DOM scraping before save or step navigation
   - Do **not** add catch-all DOM-to-state sync in `saveActiveRecord(...)` or `setActiveStep(...)`.
   - Hidden/partial DOM can overwrite valid in-memory state and collapse completion.

2. State is authoritative; DOM is a view
   - Persist from `state`, not from opportunistic DOM reads.
   - Keep field state updated through explicit control handlers (`input`/`change`/button handlers), not emergency pre-save scraping.

3. Any DOM read helper must be scoped and non-destructive
   - If a helper is required, it must:
     - read only controls guaranteed to exist for that view
     - never clear existing state when controls are absent
     - be limited to the smallest set of fields needed

4. Regression test scenario required before push
   - Must pass this manual flow:
     - create new record
     - complete all sections
     - `Save & return`
     - reopen via `Edit record`
     - verify completion and all captured values persist

5. Conflict/handoff rule for parallel chats
   - Any change touching save path, step navigation, or snapshot persistence in `/assets/js/app.js` is high-risk.
   - Chat must declare this in `/Users/will.bloor/Documents/Configurator/docs/workstreams.md` before editing and note cross-surface impact in README entry.

## README Update Working Rule (2026-02-25)

Team working rule for this repository:

1. Every material product/workflow change must be logged in `README.md` in the same dated schema used above.
   - Include:
     - what changed
     - why/principle
     - exact files touched

2. Cross-surface hooks must be explicitly documented
   - If a change in one surface affects another (widget -> dashboard, dashboard -> customer page, account -> import/export), document both ends.

3. Keep entries implementation-accurate
   - Do not log aspirational behavior as implemented.
   - Prefer concise, auditable statements tied to concrete paths/functions.

4. Multi-chat workstream coordination
   - Different chats may work in parallel on different UI/system areas (for example: follow-up emails, overview UX, widget intake, CRM export).
   - Each chat must append a numbered entry in the existing dated schema above before handoff.
   - If a chat changes shared files (`/assets/js/app.js`, `/assets/css/app.css`, `/index.html`, `/README.md`), it must explicitly note cross-surface impact so the next chat can merge safely.
   - Live ownership/status board is `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`; each chat must set scope/status there before edits and refresh it at handoff.

## README Update Protocol (Mandatory, 2026-02-26)

This section defines the required process for updates, handoffs, and deploys.

1. Hard gate before push/deploy
   - No push to shared branches and no deploy from shared branches unless `README.md` is updated in the same workstream.
   - The README update must describe the real shipped behavior, not planned behavior.

2. When README must be updated
   - After every material UX, logic, data, security, routing, or export change.
   - Before handoff to another chat/agent.
   - Before requesting commit/push.
   - After any hotfix that changes runtime behavior.

3. Required entry format (use the existing dated numbered schema)
   - Entry title with date.
   - What changed (user-visible and logic-level).
   - Why/principle.
   - Exact files touched (absolute paths).
   - Cross-surface impact (if any).
   - Validation performed (manual checks, `node --check`, tests run/not run).
   - Any residual risk or follow-up work.

4. Commit discipline
   - Keep code and README notes in the same commit whenever practical.
   - If multiple commits are used, the final commit before push must include an up-to-date README entry.
   - Do not mark anything as complete in README if not implemented in code.

5. Handoff discipline for new chats
   - New chat must read the latest README sections first.
   - New chat must continue the same numbered dated change log style.
   - New chat must preserve prior entries and append only; do not rewrite history unless correcting factual errors.

6. Workstream board discipline (parallel chats)
   - Before changing files, claim/update the relevant row in `/Users/will.bloor/Documents/Configurator/docs/workstreams.md`.
   - Before handoff, merge request, commit/push request, or deploy request, update status, timestamp, and current file claims.
   - If scope collides with another active row, log collision + dependency in the board before editing shared files.

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

5. Historical note (superseded by AWS pivot)
   - A temporary Firestore least-privilege baseline rules file existed during Firebase sandbox testing.
   - This file has been removed as part of the AWS direction change.

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
    - CSP (Firebase allowances removed after AWS pivot)
    - Referrer policy
    - MIME sniffing protection
    - Frame embedding protection
    - Permissions policy
    - COOP

## Authorization Hardening Pass (2026-02-24)

Additional RBAC and identity safeguards applied:

1. Historical note (superseded by AWS pivot)
   - Prior sandbox implementation bound actor identity to Firebase UID in backend test mode.
   - Firebase sandbox mode has now been removed; production identity target is OneLogin SAML claims via AWS auth infrastructure.
   - File: `/Users/will.bloor/Documents/Configurator/assets/js/app.js` (historical references pending cleanup)

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

## Go-Live Readiness Checklist (AWS + OneLogin SAML + Controlled CRM Export)

Use this as the release gate before storing real customer data.

### 1) Ownership, environments, and access

- [ ] Create ring-fenced AWS environments/accounts: `configurator-dev` and `configurator-prod`.
- [ ] Confirm project owners in IT/security and engineering (named individuals).
- [ ] Confirm Hatch access model (least privilege, scoped to required repos/projects only).
- [ ] Confirm GitHub org access path via One Login and required labs/training completion.

### 2) Authentication and SSO

- [ ] Configure Amazon Cognito with OneLogin federation (SAML 2.0) for non-prod and prod.
- [ ] Ensure backend-connected sessions bind actor identity to immutable IdP subject claims (not editable profile fields).
- [ ] Disable force-role test modes in production runtime.
- [ ] Verify sign-in/sign-out flow on Vercel production URL and custom domain URL.

### 3) Authorization (RBAC) and server enforcement

- [ ] Define canonical roles and permissions: `owner`, `admin`, `editor`, `sdr`, `viewer`.
- [ ] Move all write-critical auth checks to backend/API and AWS-side authorization policies.
- [ ] Ensure frontend role checks are UX-only and never the sole control.
- [ ] Add record-level ACL checks for read/write/share actions.

### 4) Shared data and data safety

- [ ] Enforce default-deny access for data reads/writes (DynamoDB + API policy controls by identity + role + record membership).
- [ ] Validate access policy behavior with positive and negative integration tests.
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
- [ ] Ensure backup/restore approach for DynamoDB/S3 and exported artifacts is documented.

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
- [ ] AWS authorization and data access controls are strict and validated.
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
- Hero primary CTA points to `#priority-capabilities` when priority capabilities are present; otherwise falls back to `#recommended-for-you`.
- Hero secondary CTA points to `#contact-your-team`.

### Structure

Current section order in generated output:

1. Hero
2. Top outcomes
3. Meeting context details
4. Priority capabilities (when present)
5. Centered "Our understanding of your needs"
6. Overlapping Prove / Improve / Report cards
7. Product tour card
8. Recommended next actions
9. Recommended for you
10. What's new
11. Contact your team

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
- Backend configuration page now includes:
  - Target platform assumption display (`AWS` + `OneLogin SAML` + Cognito federation)
  - Current implementation status (local-only runtime, backend not wired yet)
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
- `#/records/:recordId/content` (legacy alias: `#/records/:recordId/recommendations`)
- `#/records/:recordId/record-content` (interstitial section route)
- `#/records/:recordId/record-story-mapping` (interstitial section route)
- `#/records/:recordId/gaps`
- `#/records/:recordId/meetings`
- `#/records/:recordId/integrations`
- `#/records/:recordId/snapshot` (legacy alias to `#/records/:recordId/overview`)
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

Use an AWS-first stack with minimal rewrite:

- Frontend: keep the current SPA.
- Auth: Amazon Cognito federated with OneLogin SAML.
- Data: DynamoDB for records, profiles, memberships, and page metadata.
- Backend: API Gateway + Lambda API layer for business logic and all CRM writes.
- Async jobs: EventBridge + SQS for retries and idempotent sync.
- Pages: keep Vercel for app delivery; store published landing artifacts in S3.

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
   Store all three layers in DynamoDB. Keep current My Account defaults UX, but persist server-side instead of local-only.
3. Phase 2: Backend foundation on AWS (1 week)
   Create API endpoints with auth-validated CRUD for records/profiles/pages, plus audit fields (`createdBy`, `updatedBy`, timestamps, `version`). Enforce data access controls through AWS-side authorization and policy boundaries.
4. Phase 3: URL + routing model (3-4 days)
   Add shareable URLs for major states:
   `/app/dashboard`
   `/app/records/:recordId/overview`
   `/app/records/:recordId/configure?step=1..6`
   `/app/records/:recordId/content`
   `/app/records/:recordId/landing-pages/:pageId`
   Keep URL as location/context only, not full form payload.
5. Phase 4: Landing page publish flow (4-5 days)
   Keep current generator logic, but publish through backend:
   generate HTML from saved record/version, store HTML in S3, store metadata/slug/status in DynamoDB, return public/internal URL, support Draft vs Published with republish history.
6. Phase 5: HubSpot + Salesforce integration layer (1-2 weeks)
   Implement integrations in backend only:
   workspace OAuth connection, field mapping table, idempotent outbound sync via EventBridge/SQS workers, persisted external IDs in `crm_link`, manual `Sync now`, and job status. Then add optional inbound webhooks for bi-directional sync.
7. Phase 6: Collaborators + permissions (4-5 days)
   Add `workspace_memberships` roles:
   Owner: admin + integration settings
   Editor: edit records/pages
   Viewer: read-only
   Add invite-by-email flow and record-level permission checks in API.
8. Phase 7: Cutover + hardening (3-5 days)
   Migrate existing local records to DynamoDB, add activity log, monitoring, retry dashboards, and rollback plan.

### Direct answers

- Do we need URLs for each page/state?
  Yes for major views and record context. No for every form field.
- Can we add collaborators?
  Yes, but not safely with localStorage-only architecture. You need backend auth + memberships + ACL.
- AWS backend?
  Yes. Cognito + API Gateway/Lambda + DynamoDB (+ EventBridge/SQS) is a strong fit for this app shape.
- Frontend work required?
  Yes. Main areas:
  auth/session handling, API-backed data layer, router/deep links, role-based UI gating, publish/sync status UI, optimistic save + conflict handling.

### IT planning answers (for internal ticket)

- What does "ring-fenced AWS environment" mean?
  A dedicated AWS account/environment for this app only, separate from other systems, with isolated `dev` and `prod` and scoped IAM controls.
- How will users share and collaborate on records?
  Use one-login auth plus workspace membership roles (`owner`, `admin`, `editor`, `sdr`, `viewer`). Record writes are permission-checked by role and record access scope. Version/lock metadata remains in the record model to prevent overwrite conflicts.
- How will content catalog + RSS feeds run automatically?
  Run scheduled jobs (EventBridge Scheduler -> Lambda/worker) to execute the existing catalog/RSS scripts and write refreshed catalog data to storage/database. Keep fallback catalog data available if feeds fail.
- What are scalability assumptions for user data?
  Initial planning target: ~500 users, ~100 concurrent, ~100k records.
  Growth target: ~5,000 users, ~500 concurrent, ~1M records.
  Data model should keep records scoped by workspace and use append-only version history for audit and rollback.
- What is the CRM operating model?
  Manual push remains the current workflow (HubSpot/Salesforce CSV templates). Backend sync can be added later without remapping capture fields because export mapping is centralized through one canonical record mapping layer.

### External references

- [Amazon Cognito](https://docs.aws.amazon.com/cognito/)
- [Cognito SAML identity providers](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-saml-idp.html)
- [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/)
- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Amazon DynamoDB](https://docs.aws.amazon.com/dynamodb/)
- [Amazon EventBridge](https://docs.aws.amazon.com/eventbridge/)
- [Amazon SQS](https://docs.aws.amazon.com/sqs/)
- [Amazon S3](https://docs.aws.amazon.com/s3/)
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
