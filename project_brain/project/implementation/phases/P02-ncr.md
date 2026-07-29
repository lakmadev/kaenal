# P02 — Non-Conformities (NCR) (end-to-end)

**Status:** Backend ✅ done · FE 🟡 partial
**Design jsx:** `ncr.jsx`
**Spec:** 02 §3, 03 §3, 04 §5, FEATURES §5 · **Code:** `NCR-YYYY-NNNN`
**Value:** the containment/corrective backbone — SLA-governed, four-eyes-verified, feeds 8D & CAPA.

## 1. Feature scope (from jsx)
- **List** + **My Assignments** + **Overdue/At-risk** smart views. Columns incl. Source, Priority, Owner, Status, Risk, Due, Age, Linked 8D. **Kanban view** with drag-between-columns status changes.
- **Detail** two-column, tabs:
  - **Details** — description, source link, evidence, impact assessment.
  - **Investigation** — Root cause (with **AI suggestion**), interactive **5 Whys** chain, **Fishbone/Ishikawa** (6 M's), contributing factors.
  - **Actions** — Containment / Corrective / Preventive lists; each with owner, due, status, verification, evidence.
  - **History** — audit trail, threaded comments, escalations, linkages.
  - Sidebar + **SLA indicator** (on-track / at-risk / breached).
- **Create NCR** — source (Inspection / Manual / Customer complaint), priority-based auto-due-dates, evidence upload, notify rules, tags.
- **Workflow** — Draft→Open→Assigned→In Progress→Resolved→Verified→Closed (+ Escalated / Reopened); auto-escalation.

## 2. Backend — ✅ done
`apps/api/src/ncr/*`. In place: `ncrs` + action tables, `NcrStatus`/`NcrPriority`/`NcrSource`/`NcrActionKind`/`SlaState` enums, FORCED RLS, composite member FKs (owner/assignee/verifier). **Four-eyes** verification (mutation-tested: verifier ≠ resolver). **SLA** computation in `packages/core/sla.ts`; auto-escalation via the `sla` BullMQ job (shipped). Priority→auto-due in core. Raise-from-finding + raise-CAPA seams. Cursor pagination; `lockVersion`; audit on every mutation. **Comments** + **access-log** + **entity-links** APIs shipped (P06/collab) — reuse for the History tab.

**Remaining backend (small):** the **Investigation** structured data (5 Whys chain, Fishbone 6-M nodes, contributing factors) — confirm whether the contract already persists these as structured JSON on the NCR or needs a small additive column/table. If not present: add `ncr_investigation` JSONB (schema-validated by Zod) in migration `0019`, audited on edit. **Verify before building** — do not duplicate an existing field.

## 3. Frontend (maps to jsx)
- **Routes:** `/ncrs`, `/ncrs/[id]`, `/ncrs/new`.
- **Done (per PROGRESS):** list with status filter, badges, four-eyes hide/show, PageHeader verbatim, empty/skeleton.
- **Remaining FE:**
  - **Kanban** board with drag-to-transition (optimistic w/ `lockVersion`, rollback on 409).
  - Smart views My Assignments / Overdue-At-risk; **SLA chip** (on-track/at-risk/breached from `SlaState`).
  - Detail tabs: Investigation (**5 Whys** interactive, **Fishbone** builder, AI root-cause suggestion via the AI gateway [P23]); Actions lists (containment/corrective/preventive) with verification; History (comments + `audit-events` + links).
  - Create dialog: source picker, evidence upload (`use-files.ts`), notify rules, tags.
- **Hooks/keys:** `apiQueries.ncrs.*`, reuse `comments`/`auditEvents`/`entityLinks`.

## 4. Definition of Done
- [ ] List + Kanban + smart views; drag transition honors state machine & concurrency.
- [ ] SLA indicator reflects `SlaState`; escalation visible in History.
- [ ] Investigation persists 5 Whys + Fishbone + contributing factors; AI suggestion accept/dismiss audited.
- [ ] Containment/Corrective/Preventive actions CRUD with verification & evidence.
- [ ] Create wires source→auto-due, evidence, notify, tags; four-eyes enforced in UI + API.

## 5. Dependencies & open questions
- Depends on: [P01](P01-inspections.md) (finding source), [P23](P23-ai-assistant.md) (root-cause suggestion), [P18](P18-complaints.md) (complaint source).
- **Open:** confirm whether structured Investigation data already has a home in the contract (avoid inventing a table).
