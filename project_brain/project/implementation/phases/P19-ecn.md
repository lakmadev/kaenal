# P19 — Engineering Change Notices (ECN) (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `qms-modules.jsx` (`ECNWorkbench`, `ECNList`, `ECNKanban`)
**Spec:** FEATURES §12 — **designed here, needs sign-off** · **Code:** `ECN-YYYY-NNNN`
**Value:** controls design/process/tooling changes with **multi-stage approval** and auto-revises affected documents — change control is an IATF core process.

## 1. Feature scope (from jsx)
- **List** + **Kanban** views (view toggle). ECN = design/process/tooling change with a **multi-stage approval workflow**; "auto-revises affected documents." Links to affected parts, suppliers, documents.

## 2. Backend — `PROPOSED`, migration `0029_ecn.sql`
- **`ecns`**: `tenant_id`, `id`, `code` (`ECN-YYYY-NNNN`), `title`, `change_type` (`design|process|tooling`), `description`, `status` (`draft|under_review|approved|rejected|implemented`), `stage` (current approval stage), `owner` (member FK), `effective_date`, `lock_version`. FORCED RLS, leading `tenant_id`, unique `(tenant_id, code)`.
- **`ecn_approvals`**: `tenant_id`, `ecn_id`, `stage` int, `role_required`, `approver` (member FK, nullable), `decision` (`pending|approved|rejected`), `decided_at`, `comment`. Ordered multi-stage; advancing requires the current stage approved (four-eyes: approver ≠ owner).
- Affected docs/parts/suppliers via **`entity_links`** (add `ecn` to `EntityKind`).
- **Approval machine** in `packages/core` (stages advance only when current approved; reject halts; mirror the four-eyes + forward-only patterns already proven for NCR/CAPA).
- Contract: `GET /v1/ecns` (filters type/status/stage), `GET/POST /v1/ecns(/:id)`, `POST /v1/ecns/:id/approvals/:stage` (approve/reject stage), `POST /v1/ecns/:id/link` (affected doc/part). Mutations `withAudit`.
- **Auto-revise affected documents:** on `implemented`, bump linked controlled-documents to a new version (reuse [P06](P06-documents.md) version flow) — audited. Start behind a flag; confirm scope.
- Enums: `EcnChangeType`, `EcnStatus`, `ApprovalDecision`.

## 3. Frontend (maps to jsx)
- **Route:** `/ecn`.
- **Components:** view Segmented (List/Kanban), **ECNList** table (type chip, stage/status, effective date), **ECNKanban** (columns by status, drag-to-advance with optimistic `lockVersion`), ECN detail (multi-stage **approval tracker**, affected-records via entity-links), New-ECN dialog.
- **States:** stage progress, rejected emphasis, empty/loading/error.

## 4. Definition of Done
- [ ] List + Kanban + multi-stage approval tracker match `ECNWorkbench`.
- [ ] Stage advance is forward-only + four-eyes (core-tested); reject halts; audited.
- [ ] Affected documents link (+ optional auto-revise on implement); RLS green; cross-tenant 404.

## 5. Dependencies & open questions
- Relates to: [P06](P06-documents.md) (auto-revise), [P08](P08-suppliers.md) (supplier change — `linkedEcns`), [P13](P13-fmea.md).
- **Open (sign-off):** number/identity of approval stages (fixed vs configurable); is document auto-revision in scope for v1 or link-only?
