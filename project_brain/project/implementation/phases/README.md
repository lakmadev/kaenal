# Kaenal — Feature Delivery Roadmap (backend → FE, per feature)

> **Purpose.** One file per **value-delivering feature**, each specified **end-to-end**: backend
> (schema → contract → service → jobs → tests → audit) **first**, then the FE that consumes it,
> mapped screen-for-screen to the `project_brain/project/src/*.jsx` visual spec. A phase is "done"
> only when backend **and** its FE match the jsx.
>
> This roadmap does not replace the canonical spec in `implementation/` (01–09). It sequences it
> and fills the gaps the spec leaves open. Where a feature has **no backend defined** in 02/03/08,
> the phase doc carries a **`PROPOSED`** backend I designed from the jsx + QMS domain practice —
> those sections need your sign-off before build (per the "no invented scope" rule).

## How to read a phase doc

Every `PNN-*.md` follows the same shape:

1. **Status** — Backend / FE state, design source jsx, spec refs, one-line value.
2. **Feature scope (from jsx)** — what the screens actually do (the fidelity contract).
3. **Backend** — data model (tables/RLS/indexes), API contract, services & rules, jobs, tests.
4. **Frontend** — routes, components, states, data hooks — each tied to the jsx.
5. **Definition of Done** — an end-to-end checklist binding backend + FE to the jsx.
6. **Dependencies & open questions.**

## Status legend

| Mark | Meaning |
|------|---------|
| ✅ | Built, tested, in `main`/feature branch |
| 🟡 | Partially built — gaps listed in the doc |
| 🔴 | Not started |
| `PROPOSED` | Backend designed here, **not** in canonical spec 02/03/08 — needs sign-off |

## Non-negotiables every phase inherits (from `CLAUDE.md`)

- TS strict, no `any`. Zod DTOs in `packages/types`, shared API/web/mobile.
- Every tenant table: `tenant_id` + **FORCED RLS** via `apply_tenant_rls('<table>')` + leading
  `tenant_id` index. Run the RLS suite on every schema change.
- Every mutation writes an audit event in the **same** transaction (`withAudit`).
- Every user reference is a **composite FK** `(tenant_id, col) → memberships(tenant_id, user_id)`.
- Every list endpoint cursor-paginated; every create idempotency-safe; writes use `lockVersion`.
- Foreign-tenant ids → **404, not 403**. No business logic in UI — it lives in `packages/core` or API.
- Entity codes via `packages/core/src/codes.ts` (`XXX-YYYY-NNNN`).
- **Next free migration number: `0024`** (last shipped is `0023_portal_writes.sql`).

---

## The roadmap

### Part A — Core QMS loop (backend ✅ done; finish FE fidelity to jsx)

| # | Feature | Backend | FE | Design jsx |
|---|---------|---------|----|-----------|
| [P01](P01-inspections.md) | Inspections (list, detail, wizard, form engine, schedule, templates) | ✅ | 🟡 | `inspections.jsx`, `createwizard.jsx`, `template-editor.jsx`, `schedule.jsx`, `mobile-inspector.jsx` |
| [P02](P02-ncr.md) | Non-Conformities (list, kanban, investigation, actions, SLA) | ✅ | 🟡 | `ncr.jsx` |
| [P03](P03-8d.md) | 8D Problem Solving (D1–D8, AI copilot, templates, PDF) | ✅ | 🟡 | `eightd.jsx`, `eightd-agentic.jsx`, `eightd-templates.jsx`, `eightd-pdf.jsx` |
| [P04](P04-audits.md) | Audits (list, schedule, detail, findings→NCR/CAPA) | ✅ | 🟡 | `audits.jsx` |
| [P05](P05-capa.md) | CAPA (phased workflow, advance/revert, links) | ✅ | ✅ | `capa.jsx` |
| [P06](P06-documents.md) | Documents, Compliance & Files (library, detail, upload, compliance matrix) | ✅ | 🟡 | `documents.jsx`, `upload-flow.jsx`, `compliance-extra.jsx` |
| [P07](P07-platform-core.md) | Dashboard, Shell, Search, Notifications, ⌘K, Live mode | ✅/🟡 | 🟡 | `dashboard.jsx`, `shell.jsx`, `notifications*.jsx` |

### Part B — Supply Chain (new backend + FE)

| # | Feature | Backend | FE | Design jsx |
|---|---------|---------|----|-----------|
| [P08](P08-suppliers.md) | Suppliers (list, scorecards, risk matrix, detail) | 🟡 (entity slice ✅) | ✅ | `suppliers.jsx`, `suppliers-data.js` |
| [P09](P09-ppap.md) | PPAP submissions (18-element package, review, AI prediction) | ✅ | ✅ | `suppliers-ppap.jsx` |
| [P10](P10-scar.md) | SCAR & chargebacks (8D-style supplier CAR) | ✅ | ✅ | `suppliers-ppap.jsx` (`ScarWorkflow`) |
| [P11](P11-supplier-portal.md) | Supplier Portal (external-facing) | ✅ (evidence upload deferred) | ✅ | `supplier-portal.jsx` |

### Part C — Quality Engineering (`PROPOSED` backend + FE)

| # | Feature | Backend | FE | Design jsx |
|---|---------|---------|----|-----------|
| [P12](P12-risk-register.md) | Risk Register (5×5 matrix, treatment, residual) | 🔴 `PROPOSED` | 🔴 | `qms-risk-spc.jsx` |
| [P13](P13-fmea.md) | FMEA Workbench (AIAG-VDA PFMEA/DFMEA, Action Priority) | 🔴 `PROPOSED` | 🔴 | `qms-risk-spc.jsx` |
| [P14](P14-spc.md) | SPC Charts (X̄/R, I-MR, p, c; Western Electric rules) | 🔴 `PROPOSED` | 🔴 | `qms-risk-spc.jsx` |
| [P15](P15-msa.md) | MSA / Gauge R&R (AIAG long-form, %StudyVar, ndc) | 🔴 `PROPOSED` | 🔴 | `qms-risk-spc.jsx` |
| [P16](P16-calibration.md) | Calibration (instruments, due tracking, certificates) | 🔴 `PROPOSED` | 🔴 | `qms-modules.jsx` |
| [P17](P17-training.md) | Training & Competency (matrix, expiry) | 🔴 `PROPOSED` | 🔴 | `qms-modules.jsx` |
| [P18](P18-complaints.md) | Customer Complaints (intake → NCR/8D/CAPA) | 🔴 `PROPOSED` | 🔴 | `qms-modules.jsx` |
| [P19](P19-ecn.md) | Engineering Change Notices (multi-stage approval) | 🔴 `PROPOSED` | 🔴 | `qms-modules.jsx` |

### Part D — Intelligence, Reporting & AI

| # | Feature | Backend | FE | Design jsx |
|---|---------|---------|----|-----------|
| [P20](P20-knowledge-graph.md) | Knowledge Graph Explorer (entity graph, bounded query) | 🟡 (links ✅) | 🔴 | `graph-explorer.jsx` |
| [P21](P21-predictive-risk.md) | Predictive Risk (supplier/line/NCR forecasts) | 🔴 `PROPOSED` | 🔴 | `predictive.jsx` |
| [P22](P22-reporting-bi.md) | Reporting & BI (prebuilt dashboards, builder, exports) | 🟡 (exports ✅) | 🔴 | `reports.jsx`, `prebuilt-dashboards.jsx` |
| [P23](P23-ai-assistant.md) | AI Assistant (chat drawer, agentic drafting, governance) | 🟡 (gateway ✅) | 🔴 | `ai.jsx`, `ai-governance.jsx`, `eightd-agentic.jsx` |
| [P24](P24-pdf-designer.md) | PDF Template Designer & branded reports | 🔴 `PROPOSED` | 🔴 | `pdf-designer.jsx`, `eightd-pdf.jsx` |

## Explicitly out of scope of this roadmap (mock-only / platform-admin)

These jsx screens are marketing/admin mockups with no QMS value loop and no spec backend; they are
**not** given phase docs here (tracked in PROGRESS Known-issues instead): `pricing.jsx`,
`trust-center.jsx`/`trust-components.jsx`, `dev-platform.jsx`, `multi-tenancy.jsx`,
`identity-advanced.jsx`, `settings*.jsx`, `adoption.jsx`, `operations.jsx`. Raise one to a phase
doc only on an explicit decision to build it.

## Suggested delivery order

A is largely built — finish its FE first (fastest value). Then **B (Supply Chain)** as the biggest
net-new value block with a real spec-grade data model already in `suppliers-data.js`. Then **C**
one module at a time (each needs a `PROPOSED`-backend sign-off). D last (depends on A–C data).
