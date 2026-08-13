# P12 — Risk Register (end-to-end)

**Status:** Backend 🔴 `PROPOSED` · FE 🔴
**Design jsx:** `qms-risk-spc.jsx` (`RiskRegister`, `RISKS`)
**Spec:** FEATURES §12 — **no 02/03/08 backend; designed here, needs sign-off** · **Code:** `R-NNN`
**Value:** the ISO 9001 §6.1 risk-based-thinking ledger — links risks to mitigations, 8Ds, audits.

## 1. Feature scope (from jsx + `RISKS`)
- Register table: `id`, category (Supply/Process/Compliance/Cyber/People/Quality/Environmental/Financial/Reputation), title, owner, **likelihood 1–5**, **impact 1–5**, **trend** (up/down/flat), **treatment** (mitigate/accept/transfer/avoid), **residual score**, **status** (active/monitoring/accepted), mitigation **plan**.
- 5×5 risk matrix heat view; trend arrows; residual vs inherent.

## 2. Backend — `PROPOSED`, migration `0022_risk_register.sql`
- **`risks`**: `tenant_id`, `id`, `code` (`R-NNN`), `category` (enum), `title`, `owner` (composite member FK), `likelihood` int 1–5, `impact` int 1–5, `inherent_score` (= L×I, generated), `treatment` (enum), `residual_score` int, `trend` (enum up/down/flat), `status` (enum active/monitoring/accepted), `plan` text, `review_due` date, `lock_version`. FORCED RLS, leading `tenant_id`, unique `(tenant_id, code)`.
- Links to NCR/8D/audit/supplier via **`entity_links`** (add `risk` to `EntityKind`).
- Enums → `packages/types`: `RiskCategory`, `RiskTreatment`, `RiskTrend`, `RiskRegisterStatus`.
- **`packages/core/risk-matrix.ts`** (pure): score bands (L×I → low/medium/high/critical), matrix cell placement — unit-tested.
- Contract: `GET /v1/risks` (cursor; filters category/status/treatment/owner), `GET/POST /v1/risks(/:id)` (`lockVersion`), soft-delete. All mutations `withAudit`.

## 3. Frontend (maps to jsx)
- **Route:** `/risk-register`.
- **Components:** RiskTable (L/I cells, trend arrow ↑↓, treatment chip, residual badge, status), 5×5 **RiskMatrix heat grid** (click cell → filter), Risk detail/drawer (plan, linked records via entity-links), New-risk dialog.
- **States:** empty/loading/error/permission.

## 4. Definition of Done
- [ ] Register + 5×5 matrix + trend arrows match `qms-risk-spc.jsx`.
- [ ] Inherent (L×I) + residual scoring is pure core logic, unit-tested.
- [ ] Links to NCR/8D/audit/supplier via entity-links; mutations audited; RLS green; cross-tenant 404.

## 5. Dependencies & open questions
- **Open (sign-off):** confirm category set + scoring bands; is residual entered or derived from treatment effectiveness? review cadence reminder job wanted?
