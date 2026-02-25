# Web Self-Service Configurator Blueprint

Last updated: 2026-02-25

## Objective

Turn the current configurator into a customer self-service entry point that:

- Captures high-intent discovery in minutes.
- Feeds AEs a structured, triage-ready record.
- Keeps customer + AE collaboration on one shared record.
- Starts with HubSpot-first handoff (manual CSV now, API sync later).

## What already exists (baseline in this repo)

- Step-based configurator with progressive depth:
  - modes: `sdr-lite`, `guided`, `advanced`
  - question bank source: `assets/data/question-bank.v1.csv`
  - runtime bank: `assets/js/question-bank.js`
- Current required counts by mode:
  - `guided`: 22/22
  - `advanced`: 22/22
  - `sdr-lite`: 8/22
- Record + lifecycle foundation:
  - saved records, lock/version metadata, overview/configure/recommendations/export routes
- HubSpot-first CSV export path:
  - canonical mapping: `crmExportCanonicalRows(...)`
  - HubSpot mapping: `hubspotRowsFromCanonical(...)`

This means the fastest MVP is to treat `sdr-lite` as customer self-serve discovery and add a submit/triage flow on top.

## Discovery Scope: how much is enough?

Use a two-threshold model:

- `Record-ready` (customer can continue later): 5 core fields.
- `AE-ready` (high-intent handoff): 8 discovery fields + business email.

### AE-ready initial discovery questions (MVP)

These should be enough to route ownership, prioritize urgency, and start a first meeting agenda.

| # | Question | Existing key | Required for AE-ready | Why |
|---|---|---|---|---|
| 1 | Which best describes your role? | `role` | Yes | Anchors buyer/persona and conversation path. |
| 2 | Your name | `fullName` | Yes | Contact ownership. |
| 3 | Company | `company` | Yes | Account identity + CRM join key. |
| 4 | Operating country | `operatingCountry` | Yes | Region/regulatory context at minimum. |
| 5 | Where is pressure coming from? (up to 3) | `pressureSources` | Yes | Strong urgency + intent signal. |
| 6 | Most urgent 90-day win | `urgentWin` | Yes | Defines immediate success criteria. |
| 7 | Teams in scope | `groups` | Yes | Scope sizing and solution footprint. |
| 8 | Scope requirement | `fitScope` | Yes | Distinguishes team vs enterprise motion. |
| 9 | Business email | `email` | Yes (submit gate) | Required for follow-up and CRM sync. |

Recommended rule:

- Do not ask budget in MVP.
- Do not require ROI step for initial handoff.
- Require `email` only at submit time (not first screen), to preserve flow.

## Progressive Disclosure Design

### Stage A: Quick discovery (2-3 minutes)

Goal: capture AE-ready intent with low abandonment.

- Required set: questions 1-8 above.
- UI behavior:
  - show progress against AE-ready threshold
  - allow save and return
  - CTA: `See initial recommendation`

### Stage B: Qualification depth (3-5 minutes, optional)

Goal: improve recommendation quality and meeting prep.

- Suggested fields:
  - `companySize`
  - `riskEnvs`
  - `measuredOn`
  - `orgPain`
  - `rhythm`
  - `measure`

### Stage C: Solution shaping (5-8 minutes, optional)

Goal: produce a higher-confidence package narrative.

- Suggested fields:
  - `fitRealism`
  - `fitToday`
  - `fitServices`
  - `fitRiskFrame`
  - `industry`
  - `region`
  - `regs`

### Stage D: Business case + handoff (optional, late stage)

Goal: prep consultation and commercial conversation.

- Optional depth:
  - ROI step (`roiVisited`, spend/team assumptions)
  - consultation notes (`phone`, `notes`, `optin`)
- Submit gate:
  - `email` mandatory
  - record status set to submitted

## Customer and AE collaboration model

### Recommended MVP model (fastest)

- Single shared record.
- Customer fills and submits.
- AE edits same record in internal workspace.
- Customer does not need full post-submit portal in MVP.
- Customer gets confirmation + reference link/token for continuation.

### Later model (phase 2+)

- Limited customer portal:
  - read-only recommendation summary
  - editable discovery answers only
  - no internal notes, no pricing/private fields

## Record lifecycle (target states)

- `draft_customer`
- `submitted_customer`
- `ae_triaged`
- `ae_in_progress`
- `shared_back_to_customer` (optional later)
- `closed_won` / `closed_lost` / `closed_no_fit`

Add these as record metadata fields (schema is currently permissive via `additionalProperties: true`).

## HubSpot handoff design (HubSpot-first)

### MVP (now)

- Keep manual CSV export from canonical mapper.
- Add submission discipline:
  - only submitted records go to AE queue
  - exported row includes status and intent fields

### Near-term enhancement

Add canonical fields for CRM routing:

- `submission_status`
- `intent_score`
- `intent_band` (`low`, `medium`, `high`)
- `submitted_at`
- `last_customer_activity_at`
- `record_url`
- `owner_queue` (optional)

These can flow through:

- `crmExportCanonicalRows(...)`
- `hubspotRowsFromCanonical(...)`

## Intent scoring (simple rubric)

Score `0..100` to rank AE queue:

- Completion score (0-40):
  - `% of AE-ready fields complete`
- Urgency score (0-30):
  - pressure includes `board/regulator/insurer`
  - urgent win indicates near-term executive outcome
- Scope score (0-20):
  - multi-team/enterprise scope
- Engagement score (0-10):
  - reviewed recommendations, visited ROI, opened consultation planner

Bands:

- `75+`: high intent (AE action same business day)
- `50-74`: medium intent (AE action within 1-2 days)
- `<50`: nurture/automation path

## Implementation plan (pragmatic)

### Phase 1: Customer self-serve MVP on current SPA (1-2 weeks)

1. Rebrand `sdr-lite` in UX as customer self-serve discovery.
2. Add explicit `Submit for review` action in review/consultation flow.
3. Enforce submit gate: 8 discovery fields + `email`.
4. Persist `submission_status` and timestamps in record snapshot/meta.
5. Add dashboard filter/view for submitted customer records.
6. Extend HubSpot CSV mapping with submission + intent columns.

### Phase 2: Shared record collaboration hardening (1-2 weeks)

1. Add separate customer-safe vs internal-only field visibility.
2. Add activity timeline (customer updates vs AE updates).
3. Add clearer ownership state and SLA indicators.

### Phase 3: Backend cutover (per README AWS roadmap)

1. Auth: Cognito + OneLogin SAML.
2. API-backed record CRUD + ACL.
3. Idempotent HubSpot sync jobs.
4. Event/audit logging for submission and state changes.

## File-level starting points in this repo

- Question requirements:
  - `assets/data/question-bank.v1.csv`
  - `scripts/generate_question_bank_js.mjs`
  - `assets/js/question-bank.js`
- Mode behavior + completion engine:
  - `assets/js/app.js` (`resolveConfiguratorFieldMode`, `requirementEnabledForMode`, `threadReadinessProgress`)
- Submit/consultation flow:
  - `index.html` (consultation + review actions)
  - `assets/js/app.js` (`action === 'book'` handler)
- CRM mapping/export:
  - `assets/js/app.js` (`crmExportCanonicalRows`, `hubspotRowsFromCanonical`)

## Product decisions to lock immediately

1. Keep MVP with no full customer portal after submit (recommended).
2. Treat `sdr-lite` as customer discovery mode.
3. Standardize AE-ready threshold as 8 discovery fields + email.
4. Use intent score bands for AE queue prioritization.
5. Keep HubSpot manual import until backend API layer is live.

