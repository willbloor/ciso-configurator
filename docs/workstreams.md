# Workstream Coordination Board

Last updated (UTC): 2026-02-26 17:49

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
| `release-gate` | `codex/release-gate` | README/code reconciliation, security/logic checks, deploy checklist, final push gate | `ready-for-merge` | 2026-02-26 12:13 | Commit + push to `main` after gate pass |
| `copy-rules` | `codex/copy-rules` | Structured copy-rules layer and on-brand generation wiring across landing page, email builder, and follow-up email flows | `ready-for-merge` | 2026-02-26 17:49 | Open PR and merge after reviewer sign-off |

## File Claim Log

Use one line per claim/update so overlaps are explicit.

| Date (UTC) | Workstream | Files claimed | Reason | Owner/chat note |
| --- | --- | --- | --- | --- |
| 2026-02-26 11:18 | `release-gate` | `/docs/workstreams.md`, `/README.md` | Initialize coordination board + enforce protocol hook | Chat: push/release gate |
| 2026-02-26 12:13 | `release-gate` | `/assets/data/immersive-content-master.csv`, `/README.md`, `/docs/workstreams.md` | Reconcile runtime catalog with source CSV age-window and record validation gates | Chat: push/release gate |
| 2026-02-26 14:22 | `copy-rules` | `/assets/js/app.js`, `/assets/data/*copy-rules*`, `/README.md`, `/docs/workstreams.md` | Add centralized messaging/tone rules and wire generation surfaces to audience/context-aware output | Chat: messaging system integration |
| 2026-02-26 14:27 | `copy-rules` | `/assets/js/copy-rules.js`, `/assets/js/app.js`, `/assets/js/customer-self-service-widget-prototype.js`, `/index.html`, `/landing-pages/customer-self-service-widget-prototype.html`, `/README.md`, `/docs/workstreams.md` | Finalize rules layer, wire generation surfaces, and log validation + handoff state | Chat: messaging system integration |
| 2026-02-26 17:49 | `copy-rules` | `/README.md`, `/docs/workstreams.md` | Run full release-gate checklist (syntax, parity, security, config) and log compliance evidence before handoff | Chat: push process enforcement |

## Handoff Notes

- Add newest note at top.
- Include: what changed, what is left, known risks, and links to related commits/PRs.
- 2026-02-26 17:49 UTC (`copy-rules`): Re-ran full release gate on branch `codex/copy-rules` (node syntax checks, README-path audit, catalog/question/RSS parity, secrets/eval scan, CSP/header verification) with all checks PASS; branch remains ready-for-merge.
- 2026-02-26 14:27 UTC (`copy-rules`): Added centralized `/assets/js/copy-rules.js` from messaging docs and wired landing-page model copy, content email builder, and follow-up email builders (interstitial + widget) to audience/context-aware generators with safe fallback; syntax checks PASS, pending browser phrasing spot-check.
- 2026-02-26 12:13 UTC (`release-gate`): Completed release-gate validation (syntax/parity/security/config checks all PASS), reconciled content CSV/runtime parity (313/313 IDs), and prepared commit/push on `main`.
