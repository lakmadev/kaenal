# P01 — Inspections (end-to-end)

**Status:** Backend ✅ done · FE 🟡 partial
**Design jsx:** `inspections.jsx`, `createwizard.jsx`, `template-editor.jsx`, `schedule.jsx`, `mobile-inspector.jsx`
**Spec:** 02 §2, 03 §2, 04 §4, FEATURES §4 · **Code:** `INS-YYYY-NNNN`
**Value:** the field-data entry point of the whole QMS — every finding, NCR, and 8D starts here.

## 1. Feature scope (from jsx — the fidelity contract)
- **List** (`inspections.jsx`): sortable/filterable table **+ Grid view**; filters status/type/inspector/date-range/risk/location/template; columns ID, Title, Template, Inspector, Status, Risk, Findings, Due, Completed, actions menu; bulk actions; pagination; export; empty state.
- **Detail**: two-column (content + metadata sidebar). Tabs **Overview** (rendered checklist, scoring gauge, signature, summary) · **Findings** (cards, create-NCR per finding + bulk-create) · **Media** (gallery + lightbox, GPS, ZIP download) · **History** (audit trail). Sidebar: status dropdown, inspector, template, location, scheduled/started/completed, duration, risk, score w/ progress, findings, linked NCRs, tags.
- **Create/Edit wizard** (`createwizard.jsx`): Setup → Perform → Review & Submit; auto-save; section nav; signature capture.
- **Dynamic form engine**: renders checklist from JSON schema. Field types: pass/fail, yes/no, score, text, textarea, number, select, multi-select, date, datetime, photo, signature, section header, info text; conditional logic; scoring; finding triggers.
- **Template manager + editor** (`template-editor.jsx`): list w/ version+usage; drag-drop sections/items, per-item property panel, preview, versioning, import/export JSON, duplicate.
- **Schedule** (`schedule.jsx`): calendar month/week/day, color by status, recurring setup, filters.
- **Mobile inspector** (`mobile-inspector.jsx`): Phase 3 (see 05-MOBILE-APP).

## 2. Backend — ✅ done
`apps/api/src/inspections/*`, `packages/db` migrations, `packages/types` (contract + DTOs), `packages/core` (form engine, scoring, codes). Already in place:
- Tables: `inspections`, `inspection_templates`, `inspection_responses`, `findings` — all tenant-scoped, FORCED RLS, leading `tenant_id` index; composite member FKs on inspector/owner.
- State machine (`InspectionStatus`), scoring + finding-trigger logic in `packages/core`.
- Cursor-paginated list with the filter set above; create idempotent; writes `lockVersion`.
- Findings → **raise-NCR** seam (single + bulk); recurring schedule via the `scheduling` job (RRULE expansion, DST-safe) already shipped.
- Media = **Files** slice (see [P06](P06-documents.md)); AV-scan gate applies.
- Audit events on every mutation.

**No backend work remains** unless the FE surfaces a filter/field the contract doesn't expose — if so, extend the contract first, then the UI.

## 3. Frontend (maps to jsx)
- **Routes:** `/inspections` (list), `/inspections/[id]` (detail), `/inspections/new` + `/inspections/[id]/edit` (wizard), `/inspections/schedule`, `/settings/templates/inspections` (+ editor).
- **Done (per PROGRESS):** list/grid with status filter, PageHeader copy verbatim, badges, empty/skeleton states.
- **Remaining FE (🟡):**
  - Full filter bar (type/inspector/date-range/risk/location/template) — not just status.
  - Detail **tabs**: Overview rendered-form viewer + scoring gauge; Findings cards w/ per-finding & bulk create-NCR; Media gallery+lightbox+ZIP; History audit trail (reuse the built access-log/`audit-events` API).
  - **Create/Edit wizard** with the dynamic **form engine renderer** (all field types) + auto-save + signature capture.
  - **Template editor** (drag-drop builder, property panel, preview, versioning, import/export).
  - **Schedule** calendar view (the calendar shell already exists for recurrence — bind inspection occurrences).
- **Hooks/keys:** extend `apiQueries.inspections.*`; reuse `use-files.ts` for media, `apiQueries.auditEvents` for History.

## 4. Definition of Done
- [ ] List filters + grid/list + export + bulk actions match `inspections.jsx`.
- [ ] Detail 4 tabs render real data; per-finding & bulk **create-NCR** works and links back.
- [ ] Wizard renders every `FormItemType`, auto-saves, captures signature, submits → detail.
- [ ] Template editor round-trips JSON import/export and versions a template.
- [ ] Schedule calendar shows occurrences color-coded by status; recurrence create works.
- [ ] Empty/loading/error/permission states present; audit History populated.

## 5. Dependencies & open questions
- Depends on: [P06](P06-documents.md) (media/files), [P02](P02-ncr.md) (raise-NCR target).
- Mobile inspector is Phase 3 (05-MOBILE-APP) — out of this phase's DoD.
