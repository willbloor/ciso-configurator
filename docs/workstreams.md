# Workstream Coordination Board

Last updated (UTC): 2026-02-27 18:24

This file is the live coordination source for parallel chats.  
`README.md` remains the canonical shipped-change log; this board is the active ownership and handoff tracker.

## Usage Rules (Required)

1. Before editing files, claim or update a workstream row below.
2. One workstream per branch: `codex/<workstream-id>`.
3. If a change touches shared files (`/assets/js/app.js`, `/assets/css/app.css`, `/index.html`, `/README.md`), note cross-surface impact in both this file and `README.md`.
4. Update status + timestamp at handoff, before merge, and before push/deploy requests.
5. Do not rename another chat's workstream. If scope changes, add a handoff note first.

## Status Legend

- `planned`: scoped but not actively being edited
- `in-progress`: active edits in current chat
- `blocked`: waiting on decision/dependency
- `ready-for-merge`: complete and validated in workstream branch
- `merged`: integrated into release branch

## Active Workstreams

| Workstream | Branch | Primary scope | Status | Last update (UTC) | Next gate |
| --- | --- | --- | --- | --- | --- |
| `bug-fixes` | `codex/bug-fixes` | Runtime regressions and correctness in `/assets/js/app.js`, `/assets/css/app.css`, `/index.html` | `planned` | 2026-02-26 11:18 | Claim exact bug list + update status |
| `wss` | `codex/wss` | Widget/self-service flow in `/landing-pages/customer-self-service-widget-prototype.html`, `/assets/js/customer-self-service-widget-prototype.js`, `/vercel.json` route behavior | `planned` | 2026-02-26 11:18 | Confirm widget scope lock + update status |
| `content` | `codex/content` | Content catalogs/data sync in `/assets/data/immersive-content-master.csv`, `/assets/data/official-blog-rss-curated.csv`, `/assets/js/content-catalog.js`, `/assets/js/official-blog-rss-fallback.js` | `planned` | 2026-02-26 11:18 | Confirm feed/catalog scope + update status |
| `release-gate` | `codex/release-gate` | README/code reconciliation, security/logic checks, deploy checklist, final push gate | `in-progress` | 2026-02-27 18:24 | Finalize main push after story-mapping readiness checks |
| `copy-rules` | `codex/copy-rules` | Structured copy-rules layer and on-brand generation wiring across landing page, email builder, and follow-up email flows | `merged` | 2026-02-26 17:58 | Track post-merge feedback only |
| `default-contact` | `codex/default-contact-fallbacks` | Ensure all records have fallback name + business email defaults in snapshot normalization and storage hydration paths | `merged` | 2026-02-26 21:13 | Track synthetic-contact fallback usage and post-merge feedback |
| `capability-priority-landing` | `codex/capability-priority-landing` | Add structured capability-priority model from research taxonomy and surface record-priority capabilities in generated customer landing output | `ready-for-merge` | 2026-02-27 08:41 | Merge after landing-preview spot-check on real records |

## File Claim Log

Use one line per claim/update so overlaps are explicit.

| Date (UTC) | Workstream | Files claimed | Reason | Owner/chat note |
| --- | --- | --- | --- | --- |
| 2026-02-26 11:18 | `release-gate` | `/docs/workstreams.md`, `/README.md` | Initialize coordination board + enforce protocol hook | Chat: push/release gate |
| 2026-02-26 12:13 | `release-gate` | `/assets/data/immersive-content-master.csv`, `/README.md`, `/docs/workstreams.md` | Reconcile runtime catalog with source CSV age-window and record validation gates | Chat: push/release gate |
| 2026-02-26 14:22 | `copy-rules` | `/assets/js/app.js`, `/assets/data/*copy-rules*`, `/README.md`, `/docs/workstreams.md` | Add centralized messaging/tone rules and wire generation surfaces to audience/context-aware output | Chat: messaging system integration |
| 2026-02-26 14:27 | `copy-rules` | `/assets/js/copy-rules.js`, `/assets/js/app.js`, `/assets/js/customer-self-service-widget-prototype.js`, `/index.html`, `/landing-pages/customer-self-service-widget-prototype.html`, `/README.md`, `/docs/workstreams.md` | Finalize rules layer, wire generation surfaces, and log validation + handoff state | Chat: messaging system integration |
| 2026-02-26 17:49 | `copy-rules` | `/README.md`, `/docs/workstreams.md` | Run full release-gate checklist (syntax, parity, security, config) and log compliance evidence before handoff | Chat: push process enforcement |
| 2026-02-26 17:58 | `release-gate` | `/README.md`, `/docs/workstreams.md` | Merge `codex/copy-rules` into `main`, rerun release gate on merged state, and record push readiness | Chat: main promotion |
| 2026-02-26 19:54 | `default-contact` | `/assets/js/app.js`, `/README.md`, `/docs/workstreams.md` | Add deterministic fallback full name + business email for records missing contact identity | Chat: data completeness hardening |
| 2026-02-26 21:13 | `release-gate` | `/README.md`, `/docs/workstreams.md` | Merge `codex/default-contact-fallbacks` into `main`, rerun release checks on merged state, and record push readiness | Chat: main promotion |
| 2026-02-27 08:37 | `capability-priority-landing` | `/assets/js/app.js`, `/README.md`, `/docs/workstreams.md` | Convert IO research taxonomy into structured capability-priority layer and wire it into generated landing-page output | Chat: capability-priority surfacing |
| 2026-02-27 12:22 | `release-gate` | `/assets/js/app.js`, `/assets/css/app.css`, `/index.html`, `/api/publish-customer-page.js`, `/api/customer-page.js`, `/vercel.json`, `/package.json`, `/README.md`, `/docs/workstreams.md` | Reconcile latest local publish + PIBR changes against README, harden API endpoints, and run pre-push release checks | Chat: push/release gate |
| 2026-02-27 12:54 | `release-gate` | `/api/customer-page.js`, `/assets/js/app.js`, `/index.html`, `/README.md`, `/docs/workstreams.md` | Apply preview-link UX/routing tweak, reconcile docs, and rerun quick pre-push checks | Chat: push/release gate |
| 2026-02-27 18:24 | `release-gate` | `/assets/js/app.js`, `/assets/css/app.css`, `/index.html`, `/assets/data/readiness-pyramid-model.v1.csv`, `/assets/js/readiness-pyramid-model.js`, `/scripts/generate_readiness_pyramid_model_js.mjs`, `/README.md`, `/docs/workstreams.md` | Reconcile story-mapping/readiness-pyramid rollout changes with README and run release checks before push | Chat: push/release gate |

## Handoff Notes

- Add newest note at top.
- Include: what changed, what is left, known risks, and links to related commits/PRs.
- 2026-02-27 18:24 UTC (`release-gate`): Validated readiness-pyramid/story-mapping rollout set (new CSV + generator + runtime model + app/index/css integration), confirmed syntax/security checks on new runtime/generator files, and prepared main push with README entries 50-52 documenting scope and residual route-smoke risk.
- 2026-02-27 12:54 UTC (`release-gate`): Applied small preview-link update across `/api/customer-page.js`, `/assets/js/app.js`, and `/index.html` (button label now `View preview link`; deterministic `/customer-pages/<slug>` route fallback; server-side HTML proxy response in resolver endpoint), appended README entry 48, and reran syntax/security checks before push.
- 2026-02-27 12:22 UTC (`release-gate`): Reconciled local dirty state with README entries 44-46 plus added entry 47 for the live publish API surface, hardened `/api/publish-customer-page` (JSON-only + same-origin + host/proto sanitization) and `/api/customer-page` (exact-path slug match only, no prefix fallback), and queued final syntax/security/release checks before main push.
- 2026-02-27 08:41 UTC (`capability-priority-landing`): Added structured capability-priority taxonomy/scoring in `/assets/js/app.js` (`capabilityPriorityCatalog`, `capabilityPriorityCardsForGate`) and wired generated customer landing output to render a new `#priority-capabilities` section with ranked module cards, rationale, and proof points. Hero primary CTA now targets this section when available. Validation: `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`. Remaining risk: heuristic ranking weights should be tuned against live record combinations.
- 2026-02-26 21:13 UTC (`release-gate`): Merged `codex/default-contact-fallbacks` into local `main`, reran merged-state release checks (syntax, path audit, security patterns, config/header checks all PASS), and marked `default-contact` as merged pending `origin/main` push.
- 2026-02-26 19:57 UTC (`default-contact`): Added deterministic fallback contact identity in `/assets/js/app.js` normalization path (`normalizeThreadModel`) so all records hydrate/save with `snapshot.fullName` and valid `snapshot.email`; fallback values are `Primary Contact` and `contact.<company-or-record-token>@example.invalid`. Also unified follow-up email validation to shared helper. Validation: `node --check /Users/will.bloor/Documents/Configurator/assets/js/app.js`. Remaining risk: synthetic defaults should be replaced with verified customer identity before external sends.
- 2026-02-26 17:58 UTC (`release-gate`): Merged `codex/copy-rules` into local `main`, reran full release-gate checks on merged state (all PASS), and marked `copy-rules` workstream as merged pending push to `origin/main`.
- 2026-02-26 17:49 UTC (`copy-rules`): Re-ran full release gate on branch `codex/copy-rules` (node syntax checks, README-path audit, catalog/question/RSS parity, secrets/eval scan, CSP/header verification) with all checks PASS; branch remains ready-for-merge.
- 2026-02-26 14:27 UTC (`copy-rules`): Added centralized `/assets/js/copy-rules.js` from messaging docs and wired landing-page model copy, content email builder, and follow-up email builders (interstitial + widget) to audience/context-aware generators with safe fallback; syntax checks PASS, pending browser phrasing spot-check.
- 2026-02-26 12:13 UTC (`release-gate`): Completed release-gate validation (syntax/parity/security/config checks all PASS), reconciled content CSV/runtime parity (313/313 IDs), and prepared commit/push on `main`.
