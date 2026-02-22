# CISO Configurator (Launchpad Dashboard Shell)

Static HTML app for the Launchpad dashboard + configurator flow.

## Project Structure

- `index.html` - app markup
- `assets/css/app.css` - styles extracted from inline CSS
- `assets/js/app.js` - app logic extracted from inline JS
- `CISO Configurator Launchpad Edition - Dashboard Shell.html` - legacy filename redirect to `index.html`

## Run Locally

Open `index.html` directly in a browser, or serve with any static server.

Example:

```bash
cd "/Users/will.bloor/Documents/Configurator"
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Workspace Profile Import / Export

- Open **My account** in the left nav.
- In **Workspace profiles**:
  - `Load AE demo profile` or `Load CS demo profile` swaps in demo records.
  - `Upload profile CSV` imports records from a CSV (client-side in browser).
  - `Export high-fidelity CSV` downloads all records including `record_json`.
- A ready sample file is included at:
  - `workspace-profile-sample.csv`

## RSS / Content Freshness

- `What's new` now pulls from the official Immersive blog RSS feed.
- Recency rules in the app:
  - hard cutoff: older than 3 years is excluded
  - prioritization: content newer than 1 year is ranked first
- If live RSS fetch fails, the app falls back to:
  - `assets/js/official-blog-rss-fallback.js`

### Refresh Curated RSS CSV + Fallback JS

```bash
cd "/Users/will.bloor/Documents/Configurator"
curl -L -s 'https://api.allorigins.win/raw?url=https%3A%2F%2Fwww.immersivelabs.com%2Fresources%2Fblog%2Frss.xml' \
  | node scripts/sync_official_blog_rss_curated.mjs
```

This regenerates:

- `assets/data/official-blog-rss-curated.csv`
- `assets/js/official-blog-rss-fallback.js`

### Clean Any Content CSV by Recency

```bash
cd "/Users/will.bloor/Documents/Configurator"
node scripts/clean_content_csv_by_recency.mjs <input.csv> <output.csv>
```

- Keeps only rows with parseable publish dates.
- Drops rows older than 3 years by default (`MAX_AGE_DAYS=1095`).
- Adds `freshnessBucket` (`<1y`, `1-2y`, `2-3y`) and sorts newest-first.

### Reconcile Webflow Content CSVs (Master Catalog)

Build one canonical content catalog from the Webflow exports (blogs, C7 blogs, case studies, ebooks, media coverage, webinars), reconcile URLs/images, and regenerate the JS catalog used by the app.

```bash
cd "/Users/will.bloor/Documents/Configurator"
node scripts/reconcile_content_csvs.mjs
```

Outputs:

- `assets/data/immersive-content-master.csv`
- `assets/js/content-catalog.js`
- Template: `assets/data/templates/immersive-content-master-template.csv`
- Prompt for fresh chats: `docs/content-master-update-prompt.md`

Behavior:

- Drops content older than 3 years (`MAX_AGE_DAYS=1095` by default).
- Keeps newest content first and prioritizes `<1y`.
- Reconciles canonical + external URLs.
- Ensures every row has an image URL (CDN match or Immersive fallback image).

#### Incremental update flow (new posts only)

1. In a fresh chat, use:
   - `docs/content-master-update-prompt.md`
2. Save the returned CSV (new rows) anywhere, e.g. `/Users/will.bloor/Desktop/CSV/new-content-batch.csv`
3. Reconcile master + new batch:

```bash
cd "/Users/will.bloor/Documents/Configurator"
node scripts/reconcile_content_csvs.mjs --inputs \
  "/Users/will.bloor/Documents/Configurator/assets/data/immersive-content-master.csv" \
  "/Users/will.bloor/Desktop/CSV/new-content-batch.csv"
```

This regenerates:

- `assets/data/immersive-content-master.csv`
- `assets/js/content-catalog.js`

### Reconcile High-Fidelity Operations CSVs (Master Records)

Build one canonical operations dataset from configurator high-fidelity exports.

```bash
cd "/Users/will.bloor/Documents/Configurator"
node scripts/reconcile_operations_csvs.mjs
```

Output:

- `assets/data/operations-records-master.csv`
- Template: `assets/data/templates/operations-records-master-template.csv`

Behavior:

- Preserves operational fields used by the configurator (including JSON snapshot/module/viz payloads).
- Normalizes key fields (`record_id`, `completion_pct`, `created_at`, `updated_at`).
- Dedupe strategy keeps the latest row per record id.
- Default recency cutoff is 10 years (`OPS_MAX_AGE_DAYS=3650`) and can be tightened via env var.

## Deploy (Vercel)

- Framework preset: `Other`
- Build command: _(empty)_
- Output directory: _(empty)_
- Entry page: `index.html`

## Git Workflow

```bash
git add .
git commit -m "Describe change"
git push
```

## Customer Dashboard Template (Dynamic)

The customer dashboard page is generated dynamically in:

- `assets/js/app.js`
  - `customerTemplateModelFromCandidate(candidate)`
  - `customerTemplateHtmlFromModel(modelInput)`

The file below is a rendered snapshot for review/demo, not the source of truth:

- `customer-dashboard-template-Pioneer-Cloud-2026-02-22.html`

### Current baseline behavior (template output)

- Hero uses Labs image:
  - `https://cdn.prod.website-files.com/6735fba9a631272fb4513263/678646ce52898299cc1134be_HERO%20IMAGE%20LABS.webp`
- Hero CTAs are in-page anchors:
  - `#recommended-resources`
  - `#contact-your-team`
- Recommendation card titles are linkable with hover affordance.
- Recommendation link label is standardized to `Read more`.
- `Our understanding of your needs` is centered text-only:
  - subheading: `Measuring cyber readiness with Immersive`
  - short paragraph: `For <Company>, this means defensible evidence...`
- The old readiness narrative/image block has been removed.
- The overlapping prove/improve/report cards start immediately after the centered understanding text.
- A contact section is included at the bottom:
  - section id: `contact-your-team`
  - team cards + simple mailto form submission.

### Anchor IDs in generated template

- `recommended-resources`
- `recommended-for-you`
- `whats-new`
- `contact-your-team`

## New Chat Handoff (Configurator)

When starting a new chat, tell it to treat `assets/js/app.js` as canonical for template behavior.
If a static template HTML is present, it should be used only as a visual snapshot/reference.

Recommended bootstrap prompt:

```text
Project path: /Users/will.bloor/Documents/Configurator
Source of truth for customer dashboard template: assets/js/app.js
Key functions: customerTemplateModelFromCandidate + customerTemplateHtmlFromModel
Rendered snapshot reference: customer-dashboard-template-Pioneer-Cloud-2026-02-22.html
Please read README.md first, then continue from the latest template baseline and requested changes.
```

## Post-Push Handoff Routine (Do After Every Deployment)

Run this after every `git push` to keep future chats aligned.

1. Update `README.md` with:
   - latest template behavior changes
   - changed source-of-truth files
   - any new anchors, IDs, or schema fields.
2. Update `SESSION_HANDOFF.md` if architecture, branch flow, or startup prompt changed.
3. If RSS/content data changed, regenerate artifacts and note it in README:
   - `assets/data/official-blog-rss-curated.csv`
   - `assets/js/official-blog-rss-fallback.js`
   - `assets/js/content-catalog.js`
4. Ensure a rendered HTML snapshot exists for QA/reference when template output changed.
5. In commit message, include a short scope marker, e.g.:
   - `template: hero + links + understanding section`
   - `content: rss reconciliation + catalog refresh`
