# KAENAL — Implementation Package for Claude Code

This folder is the **canonical instruction set** for implementing Kaenal, a multi-tenant Quality & Safety Management System (QMS) for regulated manufacturing (IATF 16949 / ISO 9001). It is written to be executed by an AI coding agent (Claude Code) or a human engineer with no prior context.

## What Kaenal is
A B2B SaaS where manufacturers (tenants like "Precision Auto", "Bosch") run their quality operations: inspections, non-conformities (NCR), 8D problem solving, audits, CAPA, document control, supplier quality, SPC/FMEA, and AI-assisted root-cause analysis. Full feature inventory: `../FEATURES.md`. Stack decisions and rationale: `../TECH_STACK.md`.

## About the design reference
`../Kaenal.html` (+ `../src/*.jsx`, `../styles/tokens.css`) is a **high-fidelity HTML/React prototype** — a design reference, NOT production code. Do not copy it into the codebase. Recreate its screens in the real Next.js app using the patterns defined in these files. It runs in a browser and shows exact layouts, copy, colors, spacing, and interactions for every module. When a spec here and the prototype disagree on visuals, the prototype wins; on data/security/architecture, these files win.

> **Before any frontend work, read `00-FRONTEND-FIDELITY.md`.** It is the anti-hallucination contract for the UI: reproduce the prototype exactly, do not design your own. The system is monochrome **ink + Archivo** — there is no blue brand color and the font is not Inter.

## Files in this package — read in this order
| File | Contents |
|---|---|
| `00-FRONTEND-FIDELITY.md` | **Mandatory before any UI work.** How to reproduce the prototype exactly instead of inventing a design; token/type/class rules; screen→source map; remediation of already-built screens. |
| `01-ARCHITECTURE.md` | Monorepo layout, environments, tenancy models, request lifecycle, conventions |
| `02-DATABASE.md` | Full schema conventions, core tables, RLS policies (exact SQL), audit trail, migrations |
| `03-API.md` | Contract-first API, auth, RBAC matrix, error format, pagination, webhooks, idempotency |
| `04-WEB-APP.md` | Next.js app: routes, design tokens, component rules, module-by-module build spec |
| `05-MOBILE-APP.md` | Expo field-inspector app + offline sync protocol with conflict resolution |
| `06-JOBS-REALTIME-AI.md` | BullMQ jobs (SLA/escalation/reports), WebSockets, AI gateway + governance |
| `07-SECURITY-COMPLIANCE.md` | Audit-trail immutability, e-signatures, file integrity, DSAR, legal hold |
| `08-TESTING-AND-EDGE-CASES.md` | Test strategy, acceptance checklists, and the consolidated edge-case register |
| `09-INTEGRATIONS.md` | Integration framework + Slack, Microsoft (Entra SSO/SCIM, Teams, Outlook), Google, email, ERP import |
| `reference/` | Copies of `FEATURES.md`, `TECH_STACK.md`, and `tokens.css` so this folder is self-sufficient |

## Build order (phases — do not reorder)
1. **Phase 0 — Foundation:** monorepo scaffold, `packages/types` + `packages/db`, Postgres with RLS, tenant provisioning script, auth, audit-trail plumbing. *Nothing user-visible ships before RLS + audit trail work.*
2. **Phase 1 — Core loop:** Inspections → Findings → NCR → CAPA (list/detail/create/workflow), dashboard, documents. This is the IATF-compliance core and the MVP.
3. **Phase 2 — Depth:** 8D workflow, audits, notifications, reports, SPC/FMEA, scheduling.
4. **Phase 3 — Mobile + offline sync.**
5. **Phase 4 — Platform:** AI gateway + copilots, supplier portal, public API/webhooks, SSO/SCIM, add-on entitlements.

## Non-negotiable rules (apply to every phase)
1. **TypeScript strict everywhere.** No `any` in committed code.
2. **Every tenant-owned row has `tenant_id` + RLS policy.** CI fails if a table lacks one (see 02).
3. **Every mutation writes an audit event** in the same DB transaction (see 02/07).
4. **All input validation via Zod schemas in `packages/types`** — shared verbatim by web, mobile, and API.
5. **No business logic in UI components.** It lives in `packages/core` (pure functions) or the API.
6. **Every list endpoint is paginated; every write endpoint is idempotency-safe** (see 03).
7. **Feature = migration + API contract + UI + tests + audit events.** A feature missing any of these is not done.

## Definition of done for the MVP
- A new tenant can be provisioned by script in < 1 minute.
- An inspector completes an inspection with a failed item → creates an NCR → assigns owner → NCR escalates on SLA breach → CAPA closes it — all with a complete audit trail visible in the UI.
- A second tenant's user can never read the first tenant's data (proven by the RLS test suite in 08).
