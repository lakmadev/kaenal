# P10 — SCAR & Chargebacks (end-to-end)

**Status:** Backend 🔴 (new build; model in `suppliers-data.js` `SCARS`) · FE 🔴
**Design jsx:** `suppliers.jsx` (SCAR view)
**Spec:** FEATURES §11.3 · **Code:** `SCAR-YYYY-NNNN`
**Value:** the supplier-facing corrective loop — an 8D run *with* a supplier, with cost recovery (chargebacks).

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
- [ ] List + D-step stepper + chargeback status match the SCAR view in `suppliers.jsx`.
- [ ] Advance forward-only (core-tested); acknowledge + chargeback transitions audited.
- [ ] Linked NCR/8D via entity-links; overdue derived; cross-tenant 404; RLS green.

## 5. Dependencies & open questions
- Depends on: [P08](P08-suppliers.md), [P02](P02-ncr.md)/[P03](P03-8d.md) (links).
- **Open (sign-off):** is SCAR a distinct entity or a supplier-scoped 8D variant? (Data model treats it distinct but 8D-shaped.) Chargeback currency handling.
