# P09 — PPAP Submissions (end-to-end)

**Status:** Backend 🔴 (new build; model in `suppliers-data.js` `PPAP_SUBMISSIONS`) · FE 🔴
**Design jsx:** `suppliers-ppap.jsx`
**Spec:** FEATURES §11.2 · **Code:** `PPAP-YYYY-NNNN`
**Value:** Production Part Approval Process is the gate for new/changed parts — the core Tier-1↔OEM quality artifact.

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
- [ ] List + AI-prediction pill + detail 18-element grid match `suppliers-ppap.jsx`.
- [ ] Element status/reviewer/comment editable + audited; PSW is element 18.
- [ ] Overall approve blocked until all non-N/A elements approved (core-tested).
- [ ] History timeline from audit-events; cross-tenant 404; RLS green.

## 5. Dependencies & open questions
- Depends on: [P08](P08-suppliers.md) (supplier FK), [P21](P21-predictive-risk.md) (AI prediction source).
- **Open (sign-off):** four-eyes on final PPAP decision? per-customer element requirement variations (level-driven N/A)?
