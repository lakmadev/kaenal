# P18 — Customer Complaints (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `qms-modules.jsx` (`CustomerComplaints`, `COMPLAINTS`, `IntakeForm`)
**Spec:** FEATURES §12 — **designed here, needs sign-off** · **Code:** `COM-YYYY-NNNN`
**Value:** the OEM-facing front door — complaints triage into NCR/8D/CAPA and drive the customer-satisfaction loop.

## 1. Feature scope (from jsx + `COMPLAINTS`)
- List: `id`, **customer** (+ brand color), contact, **received** (relative), **via** (portal/email-parsed/web-form/EDI/phone), **severity** (critical/high/medium/low), **status** (triage → investigation → 8d → capa → closed), subject, **batch**, **linked** record (NCR/8D/CAPA).
- **Intake form** — log a new complaint (customer, contact, channel, severity, subject, batch).
- Convert/link to NCR / 8D / CAPA.

## 2. Backend — `PROPOSED`, migration `0028_complaints.sql`
- **`complaints`**: `tenant_id`, `id`, `code` (`COM-YYYY-NNNN`), `customer`, `customer_color`, `contact` jsonb, `channel` (enum), `severity` (enum), `status` (enum), `subject`, `batch_ref`, `received_at`, `owner` (member FK), `lock_version`. FORCED RLS, leading `tenant_id`, unique `(tenant_id, code)`. Links to NCR/8D/CAPA via **`entity_links`** (add `complaint` to `EntityKind`).
- **Status machine** in `packages/core` (triage→investigation→8d→capa→closed; forward with audited exceptions, mirror NCR).
- Contract: `GET /v1/complaints` (filters customer/severity/status/channel/q), `GET/POST /v1/complaints(/:id)`, `POST /v1/complaints/:id/convert` (spawn linked NCR or 8D — reuses those create seams + entity-links). Mutations `withAudit`.
- Enums: `ComplaintChannel`, `ComplaintSeverity`, `ComplaintStatus`.

## 3. Frontend (maps to jsx)
- **Route:** `/complaints`.
- **Components:** ComplaintList (customer color chip, via icon, severity badge, status, linked-record link), **IntakeForm** dialog, complaint detail (convert-to-NCR/8D, linked records via entity-links).
- **States:** triage emphasis, empty/loading/error.

## 4. Definition of Done
- [ ] List + intake form + severity/status/channel match `CustomerComplaints`.
- [ ] Convert-to-NCR/8D creates a linked record (entity-links) and advances status; audited.
- [ ] RLS green; cross-tenant 404.

## 5. Dependencies & open questions
- Feeds: [P02](P02-ncr.md) (source `customer_complaint` already an `NcrSource`), [P03](P03-8d.md).
- **Open (sign-off):** email/EDI auto-intake (parsing) in scope now or manual-only first; SLA clock on complaints?
