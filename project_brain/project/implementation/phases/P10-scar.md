# P10 — SCAR & Chargebacks (end-to-end)

**Status:** Backend ✅ · FE ✅ — **both delivered (this branch)**; 8D/NCR cross-links reuse `entity_links`
**Design jsx:** `suppliers-ppap.jsx` (`ScarWorkflow`), `suppliers.jsx` (linked-events)
**Spec:** FEATURES §11.3 · **Code:** `SCAR-YYYY-NNNN`
**Value:** the supplier-facing corrective loop — an 8D run *with* a supplier, with cost recovery (chargebacks).

> **Reality check (corrected during build):** like `suppliers`/`ppap_submissions`, the `scars`
> table **already existed** (thin) since `0001_core.sql` — so `0021_scar.sql` EXTENDED it rather
> than creating a new one. Status was reconciled from 0001's generic
> `open/responded/accepted/rejected/closed` to the SCAR lifecycle
> `draft/open/responded/closed/rejected/cancelled`; the visual spec's `awaiting_d4`/`d5_review` are
> **derived display labels** (status + `current_d`), and `overdue` is **derived** (an active SCAR
> past its response/overall due date) — neither is a stored status. The opaque `chargeback` jsonb was
> replaced with explicit `chargeback_amount`/`_currency`/`_status` columns. History uses
> `audit_events` (`entity_kind = 'scar'`); `EntityKind` gained `scar` so NCR/8D cross-links reuse
> `entity_links` (the originating NCR also keeps the direct `ncr_id` column from 0001).

## 1. Feature scope (from jsx + data)
- **SCAR list** — title, supplier, severity (`minor|major|critical`), status (`awaiting_d4|d5_review|closed|overdue`, plus draft/ack), **currentD** (8D-style D1–D8 progress with the supplier), raised/due dates, days-open, supplier-response-due, **acknowledged** flag+date, **affected lots**, **linked NCR / 8D**, owner.
- **Chargebacks** — `chargeback_amount`, `chargeback_status` (`pending|debit_issued|closed`).

## 2. Backend — new build

### 2.1 Data model — migration `0021_scar.sql`
- **`scars`**: `tenant_id`, `id`, `code` (`SCAR-YYYY-NNNN`), `supplier_id` (composite FK), `title`, `severity`, `status`, `current_d` int (1–8), `raised_date`, `due_date`, `supplier_response_due`, `supplier_acknowledged` bool, `ack_date`, `affected_lots` int, `chargeback_amount` numeric, `chargeback_currency`, `chargeback_status`, `owner` (composite member FK), `lock_version`. Links to NCR/8D via **`entity_links`** (add `scar` to `EntityKind`). FORCED RLS, leading `tenant_id`, unique `(tenant_id, code)`.

### 2.2 API contract
- `GET /v1/scars` (cursor; filters supplier, status, severity, overdue, q) → `ScarDto`.
- `GET /v1/scars/:id` · `POST /v1/scars` · `POST /v1/scars/:id` (`lockVersion`).
- `POST /v1/scars/:id/advance` — move `current_d` forward one step (8D-style forward-only machine, mirrors [P05](P05-capa.md) advance/revert pattern); audited.
- `POST /v1/scars/:id/acknowledge` — supplier ack (sets `supplier_acknowledged`+`ack_date`).
- `POST /v1/scars/:id/chargeback` — set/transition chargeback status (`pending→debit_issued→closed`); audited (financial event → distinct audit action).

### 2.3 Services & rules
- **D-step machine** in `packages/core` (forward-only; overdue derived from `supplier_response_due`/`due_date`). Enums: `ScarSeverity`, `ScarStatus`, `ChargebackStatus`.
- Chargeback transitions audited separately (cost recovery is compliance-sensitive).
- Cursor pagination; `lockVersion`; foreign-tenant 404.

### 2.4 Tests
- RLS: `scars`. Core: D-step forward-only + overdue derivation + chargeback transition legality. API: advance honors machine + concurrency; chargeback transition audited; link to NCR/8D via entity-links; cross-tenant 404.

## 3. Frontend (maps to jsx)
- **Routes:** `/scars`, `/scars/[id]` (or a SCAR tab within Suppliers per jsx layout).
- **Components:** ScarTable (severity badge, **D-step mini-stepper**, overdue chip, chargeback amount+status), ScarDetail (8D-style step tracker with supplier, ack banner, affected-lots, linked NCR/8D, chargeback panel).
- **States:** overdue emphasis, awaiting-supplier, empty/loading/error.
- **Hooks/keys:** `apiQueries.scars.*`; reuse `entityLinks`.

## 4. Definition of Done
- [x] List + D-step stepper + chargeback status match `ScarWorkflow` in `suppliers-ppap.jsx`.
- [x] Advance forward-only (core-tested + verified in-browser); acknowledge + chargeback transitions audited.
- [x] Overdue derived; cross-tenant 404; RLS green (227). NCR link via `ncr_id`; 8D/other links via `entity_links`.

## Delivered this branch
**Backend:** migration `0021_scar.sql` (lock_version + bump trigger, title/severity/current_d/dates/
supplier_acknowledged/ack_date/affected_lots/owner composite-FK; explicit chargeback columns; status
CHECK reconciled); `packages/core/scar.ts` (8D `nextD` forward-only machine, `scarIsOverdue`,
`scarDaysOpen`, `canTransitionChargeback` ratchet, `scarStageLabel`; 31 unit tests); contract + DTOs;
`ScarService` (list/get/create-auto-codes/update/advance/acknowledge/chargeback — every mutation
`withAudit`, optimistic `version`→409, foreign-tenant→404, supplier + linked-NCR existence checks);
`scar:view`/`scar:manage` capabilities (view all roles; manage admin/manager/auditor);
`apiQueries.scars.*`. Tests: `apps/api/test/scar.test.ts` (10) + core (31); RLS 227.
**FE:** `apps/web/src/features/scar/` — `scar-bits.tsx` (status/severity/chargeback badges, 8-square
`DSteps` stepper, overdue chip, money formatter), `scar-list.tsx` (KPI strip, active/overdue/closed
tabs + chargeback ledger tab, 8D stepper + severity + overdue due-dates + chargeback), `scar-detail.tsx`
(header strip, ack banner + Record-acknowledgement, 8D discipline tracker with Advance, chargeback
panel with the pending→debit_issued→recovered ratchet, linked-records panel), `scar-create-dialog.tsx`
(supplier picker + chargeback amount). Routes `/scars` + `/scars/[id]`; nav link (`scar:view`).
**Verified in-browser:** list + KPIs + ledger tab, detail, and the full lifecycle — Advance 8D
(draft→open, D1→D2 with the stepper re-colouring), Record acknowledgement (banner turns green),
and the chargeback ratchet (pending→debit issued→recovered), all under optimistic concurrency.

## 5. Dependencies & open questions
- Depends on: [P08](P08-suppliers.md), [P02](P02-ncr.md)/[P03](P03-8d.md) (links).
- **Open (sign-off):** is SCAR a distinct entity or a supplier-scoped 8D variant? (Data model treats it distinct but 8D-shaped.) Chargeback currency handling.
