# P09 — PPAP Submissions (end-to-end)

**Status:** Backend ✅ · FE ✅ — **both delivered (this branch)**; AI prediction is job-fed (P21), stubbed for now
**Design jsx:** `suppliers-ppap.jsx`
**Spec:** FEATURES §11.2 · **Code:** `PPAP-YYYY-NNNN`
**Value:** Production Part Approval Process is the gate for new/changed parts — the core Tier-1↔OEM quality artifact.

> **Reality check (corrected during build):** like `suppliers`, the `ppap_submissions`
> table **already existed** (thin) since `0001_core.sql`, WITH an `elements jsonb` column — so
> this EXTENDED it and stores the 18 elements **inline in jsonb** (the same "raw structure in
> jsonb, rules in packages/core" choice as `suppliers.scorecard`), **superseding** this doc's
> original `ppap_elements` / `ppap_history` table proposal. History uses `audit_events`
> (`entity_kind = 'ppap_submission'`). `codes.ts` gained `ppap`→`PPAP`. `PpapStatus` was
> reconciled from 0001's generic `draft/submitted/…` to the review workflow
> `pending/in_review/interim/approved/rejected`.

## 1. Feature scope (from jsx + data)
- **List** — submissions with supplier, part+rev, program, level (1–5), customer (OEM), status (`pending|in_review|approved|rejected`), submitted/due dates, days-open, **AI deadline prediction**.
- **Detail** — the **18 PPAP elements** each with status (`pending|approved|changes_requested|n_a`), reviewer, and per-element comment; **PSW** (Part Submission Warrant) as element 18; submission **history** timeline; **AI prediction** (confidence, will-miss-deadline, days-likely-over, reasoning).

## 2. Backend — new build

### 2.1 Data model — migration `0020_ppap.sql`
- **`ppap_submissions`**: `tenant_id`, `id`, `code` (`PPAP-YYYY-NNNN`), `supplier_id` (composite FK to suppliers via `(tenant_id, supplier_id)`), `part_no`, `part_rev`, `program_name`, `level` int (1–5), `customer`, `status`, `submitted_date`, `due_date`, `approved_date`, `owner` (composite member FK), `ai_prediction` jsonb (`confidence`, `will_miss_deadline`, `days_likely_over`, `reasoning`), `lock_version`. FORCED RLS, leading `tenant_id`, unique `(tenant_id, code)`.
- **`ppap_elements`**: `tenant_id`, `submission_id`, `element_no` int (1–18), `name`, `status` (`pending|approved|changes_requested|n_a`), `reviewer` (composite member FK, nullable), `comment`. Unique `(tenant_id, submission_id, element_no)`. The canonical 18-element names seed from `packages/core/ppap-elements.ts`.
- **`ppap_history`**: append-only-ish activity (`actor`, `action`, `at`) — or reuse `audit-events` for actor actions + a lightweight system-note. Prefer **audit-events** for actor actions; add a `ppap` `EntityKind`.

### 2.2 API contract
- `GET /v1/ppap` (cursor; filters supplier, status, customer, level, q) → `PpapSubmissionDto`.
- `GET /v1/ppap/:id` → detail (+ 18 elements + history via audit-events).
- `POST /v1/ppap` (create; auto-seeds 18 elements as `pending`) · `POST /v1/ppap/:id` (update, `lockVersion`).
- `POST /v1/ppap/:id/elements/:no` — set element status/comment/reviewer (audited `updated`).
- `POST /v1/ppap/:id/decision` — overall approve/reject (guard: cannot **approve** while any element is `pending`/`changes_requested`; four-eyes: decider ≠ sole reviewer where policy requires). Audited; writes `approved_date`.

### 2.3 Services & rules
- **Completeness rule** in `packages/core` (pure): a submission is approvable only when every non-`n_a` element is `approved` — mirrors the jsx "auto-checked element completeness 17/18".
- `days_open` derived (now − submitted). AI prediction written by the predictive job ([P21]) / AI gateway — never hand-edited.
- Enums added to `packages/types/src/enums.ts`: `PpapStatus`, `PpapElementStatus`.

### 2.4 Tests
- RLS suite: `ppap_submissions`, `ppap_elements`.
- Core: completeness/approvability matrix; days-open math.
- API: create seeds 18 elements; element update audited; **approve-blocked-while-incomplete**; cross-tenant 404.

## 3. Frontend (maps to jsx)
- **Routes:** `/ppap`, `/ppap/[id]`.
- **Components:** PpapTable (status badge, level chip, days-open, **AI-prediction pill** with confidence), PpapDetail (18-element checklist grid w/ per-element status+reviewer+comment, PSW row highlighted, decision buttons), AIPrediction card (Trust `ConfidenceMeter`), history timeline.
- **States:** changes-requested emphasis, overdue vs due-date, empty/loading/error.
- **Hooks/keys:** `apiQueries.ppap.*`.

## 4. Definition of Done
- [x] List + AI-prediction pill + detail 18-element grid match `suppliers-ppap.jsx`.
- [x] Element status/reviewer/comment editable + audited; PSW is element 18.
- [x] Overall approve blocked until all non-N/A elements approved (core-tested + verified in-browser).
- [x] Cross-tenant 404; RLS green (227). *(History timeline from audit-events deferred with the activity UI.)*

## Delivered this branch
**Backend:** migration `0020_ppap.sql` (lock_version + bump trigger, part_rev/program_name/customer/
dates/owner composite-FK/ai_prediction jsonb; status CHECK reconciled); `packages/core/ppap.ts`
(canonical 18 elements + `ppapCompleteness`/`isPpapApprovable`/`ppapDaysOpen`, 15 unit tests);
contract + DTOs; `PpapService` (list/get/create-seeds-18/update/updateElement/decide with the
approvability guard; every mutation `withAudit`, optimistic `version`→409, foreign-tenant→404);
`ppap:view`/`ppap:manage` capabilities (view all roles; manage admin/manager/auditor);
`apiQueries.ppap.*`. Tests: `apps/api/test/ppap.test.ts` (8) + core (15); RLS 227.
**FE:** `apps/web/src/features/ppap/` — `ppap-bits.tsx` (submission/element badges, level chip,
AI-prediction pill, element marker), `ppap-list.tsx` (KPI strip, active/approved/rejected/all tabs,
AI pill, element count), `ppap-detail.tsx` (completeness progress, AI banner, 18-element grid with
per-element status select + comment editor, Approve gated on `completeness.approvable` + Reject),
`ppap-create-dialog.tsx` (supplier picker). Routes `/ppap` + `/ppap/[id]`; nav link (`ppap:view`).
**Verified in-browser:** list + AI pill, detail grid, element edits, and the full gate → approve
flow (Approve disabled at 12/17, enabled at 17/17, approve stamps the date + flips to read-only).

## 5. Dependencies & open questions
- Depends on: [P08](P08-suppliers.md) (supplier FK), [P21](P21-predictive-risk.md) (AI prediction source).
- **Open (sign-off):** four-eyes on final PPAP decision? per-customer element requirement variations (level-driven N/A)?
