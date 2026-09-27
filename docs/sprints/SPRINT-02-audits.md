# SPRINT-02 — Audits module (web)

Author: Product Owner. Date: 2026-09-27. Part of the multi-sprint programme in `ROADMAP.md` (Wave 2 of 13).
Governing rules: CLAUDE.md rules 0, 1-8, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprint 01 Phase A + Phase B (merged, PR #30) — that work is NOT touched here.

## 1. Goal and roles served

Replace the `/audits` `ModulePlaceholder` with the real IATF/ISO audit-programme module: schedule an
audit, run it through its fixed phase machine, score a clause checklist, record findings, and raise
linked NCRs/CAPAs from those findings — everything `audits.jsx` (657 lines, read in full) and
FEATURES.md §7 specify. Every nav child that already points at `/audits`, `/audits?view=mine`,
`/audits?view=schedule` must resolve to real behaviour, not the placeholder.

Roles served: admin, manager, auditor (create/manage — `audit:manage`), inspector/viewer (read-only —
`audit:view`, granted to everyone per `packages/core/src/rbac.ts`). Partners (portal) are not served —
audits are an internal-only module, no jsx or FEATURES bullet puts them in the supplier portal.

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| Backend module exists: list/create/get/advance-phase/findings/raise-NCR/raise-CAPA, plant-scoped, `audit:view`/`audit:manage`, audited, optimistic (`lockVersion`) | `apps/api/src/audits/audits.controller.ts` (137 lines), `audits.service.ts` (469 lines), contract `packages/types/src/contract.ts:564-625` |
| `audits` table ALREADY has a `checklist jsonb NOT NULL DEFAULT '[]'` column — but NO route, service method, or DTO reads or writes it | `packages/db/migrations/0001_core.sql:315`; grepped `AuditDto`/`AuditsService` — no `checklist` field anywhere in `packages/types/src/dto.ts` or the service |
| `AuditType` enum is `internal / certification / supplier / process` — the jsx's `AUDIT_TYPES` is `internal / supplier / customer / certification / gap` (Gap Analysis). `process` is unused anywhere (no seed, no test); `customer` and `gap` do not exist in the backend | `packages/types/src/enums.ts:163-169` vs `project_brain/project/src/audits.jsx:4-10` |
| `AuditDto`/`audits` table has NO `description`, `location`, `scope` (string array), or `nextActivity` fields that the jsx renders on every card and the detail sidebar | `packages/db/migrations/0001_core.sql:300-322`, `packages/types/src/dto.ts:859-877` vs `project_brain/project/src/data.js:281-286` (`AUDITS` mock: every row has `description`, `location`, `scope`, `nextActivity`) |
| `team` (audit team, incl. lead) and `auditeeIds` (the department/people being audited) are TWO DIFFERENT arrays in the design; the schema only has `team` — no `auditee_ids` column | `project_brain/project/src/data.js:281` (`auditTeam` + separate `auditeeIds`) vs `audits` table columns |
| `audit_findings` has NO `title` or `due_date` column — the jsx's `AUDIT_FINDINGS` mock has both, distinct from `description` | `packages/db/migrations/0001_core.sql:326-340` vs `project_brain/project/src/data.js:305-307` |
| Findings-breakdown counts (major/minor/opportunity), `capasOpen`/`capasTotal`, and the 6-month frequency chart are NOT computed anywhere in the service — no aggregation query exists | `audits.service.ts` (no `COUNT`/`GROUP BY` over findings or capas) |
| `/audits` is a placeholder; `apiQueries`/hooks for audits DO NOT EXIST on web (`use-audit-events.ts`/`use-audit-log.ts` are the unrelated tenant-wide audit LOG, not this module) | `apps/web/src/app/(app)/audits/page.tsx` (`ModulePlaceholder`); `grep -rn "audits" apps/web/src/lib` → nothing |
| `navigation.ts` already lists 3 children ("All Audits", "My Audits", "Schedule") all pointing at the placeholder route | `apps/web/src/config/navigation.ts:116-123` — **dead nav today** |
| Search federates only `inspection/ncr/capa/document` — `audit` is not searchable; `SearchEntityKind` enum lacks it; no `search_vector` column on `audits` | `apps/api/src/search/search.service.ts:19-23`, `packages/types/src/dto.ts:660-661`, `packages/db/migrations/0008_search_vectors.sql` (4 tables, not 5) |
| `entityHref("audit", id)` returns `null` — a search hit or notification for an audit is a dead, non-navigating row today | `apps/web/src/lib/entity-routes.ts:22-38` (`default: null`) |
| `AuditsService` never calls `NotificationsService` — creating an audit notifies nobody, unlike NCR/inspection/8D/SCAR assignment | `apps/api/src/audits/audits.service.ts` constructor (only `ncrs`, `capas`); `apps/api/src/ncr/ncr.service.ts` imports `NotificationsService` |
| `createwizard.jsx` has NO `audit` `ENTITY_TYPES` entry — its one `audit` string (line 30) is an NCR-source-selector label ("Audit finding"), not a wizard flow. No design anywhere shows a "Create Audit" form | `project_brain/project/src/createwizard.jsx:30`; `apps/web/src/features/create-wizard/wizard-meta.ts` (`WizardType` = inspection/ncr/8d/document only) |
| Files/evidence pipeline is already entity-agnostic (`entity_kind`/`entity_id` free columns, `EntityKind` enum already includes `"audit"`) | `apps/api/src/files/files.service.ts:20-38,194-202`; `packages/types/src/enums.ts:322-331` — **Evidence tab is a reuse, not new backend** |
| `RealtimeTopic` already includes `"audit"` | `packages/types/src/realtime.ts:23` — confirm it actually fires on audit mutations (`realtime/audit-signal.ts` pattern used elsewhere) rather than assume |
| Mobile: the `(app)/audit.tsx` "Audit" tab is the **oversight tenant-wide audit LOG** (`audit_events`), unrelated to this QMS module. No `m-*.jsx` designs this module for mobile | `apps/mobile/src/app/(app)/audit.tsx` (comment: "the admin's read-only audit-log feed"); `grep -iln audit project_brain/mobile/src/m-*.jsx` → only oversight/work/tablet/ncr/home files mention the unrelated audit LOG |
| `auditMachine` (forward-only planned→preparation→fieldwork→reporting→closed) matches `PHASE_ORDER` in the jsx exactly | `packages/core/src/state-machines/audit.ts` vs `project_brain/project/src/audits.jsx:12` |
| `audit:view`/`audit:manage` capabilities exist and are correctly assigned (view = everyone, manage = admin/manager/auditor) | `packages/core/src/rbac.ts:27-28,104-105,133-134,154,169` |

## 2. Stories

Notation: UC = use cases (happy / error / empty / permission / offline). AC = testable acceptance criteria.

### S2-1 Audit list + My Audits + Schedule views

**Design:** `project_brain/project/src/audits.jsx` `AuditList` (lines 23-118), `AuditCard` (120-177),
`AuditFrequencyChart` (179-208). Mock shapes: `project_brain/project/src/data.js:280-287` (`AUDITS`),
`310-316` (`AUDIT_FREQUENCY`).

UC
- Happy: `/audits` shows the KPI strip (active/planned-90d/completed-YTD/open-findings), filters
  (All/Active/Completed/My audits segmented control + type select + search), audit cards, and the
  6-month frequency chart; click a card opens the detail.
- Empty: no audits yet → `EmptyState` (no bare table).
- Filtered-empty: filters exclude everything → distinct "no audits match" message, not the same empty state.
- Permission: `audit:view` is granted to every role, so no role sees a 403 here; a plant-scoped
  inspector/viewer sees only audits in their plants (service already filters — verify web renders it,
  don't re-filter client-side).
- Error/offline: list fetch fails → retry affordance; offline banner disables "New audit" (reuse S1-5
  infrastructure), not silently queued.
- My Audits (`?view=mine`): audits where the caller is lead auditor OR in `team` OR in `auditeeIds`.
- Schedule (`?view=schedule`): **no binding jsx** — the prototype's "Schedule view" button
  (`audits.jsx:51`) actually navigates to `inspections-schedule`, a copy artifact, not a real audit
  schedule screen. FEATURES §7 still requires a "Schedule" view. Follows the existing
  `apps/web/src/features/inspections/schedule-view.tsx` visual pattern (calendar/timeline of dated
  records) restyled for audits (planned/preparation/fieldwork windows by date) — **flagged for the
  designer** (section 4).

AC
1. KPI strip, filters, cards, and frequency chart reproduce `audits.jsx` pixel-for-pixel (colors,
   phase-progress bar segments, chip styles per `AUDIT_TYPES`).
2. Cards show live counts: findings major/minor color-coded, phase progress bar, lead auditor avatar —
   all from real `GET /v1/audits` + a new aggregation (AC 6 below), never client-computed guesses.
3. Segmented filters (`all/active/completed/mine`) and the type select map to real query params; typing
   in search debounces and re-fetches (mirror the existing `use-search.ts` debounce pattern).
4. Frequency chart renders real last-6-months counts by type from a new endpoint (below), not mock data.
5. Cursor-paginated list (rule 6); a plant-scoped role never sees a foreign-plant audit (RLS + service
   filter, already built — add a web test asserting the UI doesn't leak a filtered-out row via any
   client-side cache bleed).
6. "New audit" button is capability-gated (`audit:manage`); hidden (not disabled-and-403-able) for
   inspector/viewer, matching the CreateWizard gating pattern from Sprint 01.

Web: new `app/(app)/audits/page.tsx` (replaces `ModulePlaceholder`), `app/(app)/audits/schedule/page.tsx`
(or a `?view=` branch — engineer's call, must have a real URL), `features/audits/audit-list.tsx`,
`audit-card.tsx`, `audit-frequency-chart.tsx`, `use-audits.ts` (TanStack Query hooks, `apiQueries.audits.*`).
Mobile: unaffected — no `m-*.jsx` design, mobile's own "Audit" tab is the unrelated audit log (see 1a).
Shared: none beyond the Backend needs in the table (§3).

### S2-2 Audit detail — header, phase tracker, sidebar, Team & Plan, Evidence, Report tabs

**Design:** `audits.jsx` `AuditDetail` (213-374), `DetailRow`/`SummaryStat` (376-392), `AuditTeamTab`
(529-567), `AuditEvidenceTab` (569-600), `AuditReportTab` (602-646).

UC
- Happy: `/audits/[id]` shows the header (type chip, code, status badge, title, description, Export +
  Continue-audit buttons), the 5-step phase tracker with real progress, and the sidebar (audit details,
  findings summary, audit team, scope). Tabs: Checklist (S2-4), Findings (S2-5), Team & Plan, Evidence,
  Report.
- Error/permission: unknown or foreign-tenant audit id → 404 (rule 8, already enforced by the service —
  verify the web 404 page, don't leak existence via a different error shape).
- Plant-scope: an inspector/viewer outside the audit's plant → 404 (service `assertInScope` already
  throws `notFound()` — verify, don't re-implement).
- Offline/stale: advancing phase while offline is disabled with tooltip; a stale `advance` (409) surfaces
  the reconcile dialog from Sprint 01 (reuse, don't rebuild).
- Empty: Evidence tab with no files → `EmptyState`, not a blank table.

AC
1. Header, phase tracker (28px circles, connector lines, done/current/future states), and all 3 sidebar
   cards (`DetailRow`/`SummaryStat`) reproduce the jsx exactly, driven by `GET /v1/audits/:id`.
2. "Continue audit" advances the phase via `POST /v1/audits/:id/advance` (existing endpoint) with the
   real `lockVersion`; a 409 opens the existing stale-write reconcile dialog.
3. Team & Plan tab renders real `leadAuditorId`/`team` (avatars, "Lead auditor" chip) and the schedule
   block (planned start/end, duration, location) — no mock users.
4. Evidence tab lists/uploads real files via the existing generic files pipeline scoped to
   `entityKind: "audit"` (reuse `FilesService.presign/complete/listByEntity` — no new backend route).
5. Report tab renders a REAL summary (title, standard, code, findings-summary stats, detailed findings
   list from `GET /v1/audits/:id/findings`) and "Export PDF" uses the EXISTING export pipeline (same
   pattern as the AI drawer's "Generate PDF", Sprint 01 Q7) — not a `kToast`-only mock action. "Send to
   auditee" is **not built** (no auditee-notification design or endpoint) — flagged, not faked (see §7).
6. "Export" button (header) also uses the existing export pipeline — same artifact as the Report tab's
   Export PDF, not a second, different code path.

Web: `app/(app)/audits/[id]/page.tsx`, `features/audits/audit-detail.tsx`, `audit-phase-tracker.tsx`,
`audit-team-tab.tsx`, `audit-report-tab.tsx` (reuses `features/files/*` upload/list components for Evidence).
Mobile: unaffected (no design).
Shared: none beyond §3.

### S2-3 Create Audit

**Design: NONE EXISTS.** `audits.jsx`'s "New audit" button calls `openCreate('audit')` into the app's
generic create dispatcher, but `createwizard.jsx` has no `audit` entry in `ENTITY_TYPES`/`WizardType` —
grepped and confirmed (§1a). This is a genuinely undesigned control the jsx nonetheless shows as
primary — CLAUDE.md rule 10 requires it be designed and built this sprint, not deferred.

UC
- Happy: "New audit" (list header or palette quick-action) opens a create form → fills required fields
  → submits → new audit in `planned` phase → navigates to its detail.
- Error: validation (e.g. end date before start date, empty title) surfaces inline.
- Permission: only shown to `audit:manage` holders.
- Cross-tenant: a `leadAuditorId`/`team`/`auditeeIds` member id from another tenant, or a `plantId` from
  another tenant → 404, never a 403 that reveals existence (rule 8; the service's `assertMember`
  currently returns a generic 422 "not an active member" for ANY invalid id — verify this doesn't leak a
  cross-tenant distinction; tighten to 404-shaped if it does).
- Idempotency: double-submit creates one audit (idempotency key, same pattern as the CreateWizard).

AC
1. A capability-gated "New audit" entry point exists on the list header AND the command-palette quick
   actions (parity with the other 5 quick-create types from Sprint 01 S1-2). It follows the CAPA
   precedent for the shell topbar "New" quick-create menu (`components/shell/quick-create.tsx`): CAPA
   is deliberately excluded from that menu because it's a per-entity dialog, not a `WizardType` step
   (`quick-create.tsx:16`) — audit, also a dialog-type entity (§4 designer note), follows the same
   exclusion for consistency. The exact wiring mechanism (a `QuickCreateTarget` entry with an
   `?new=1`-style href vs. a bespoke open-dialog call) is an implementation-sequencing detail for the
   architect (DESIGN-02-audits.md §6), not a change to this acceptance criterion's intent.
2. The form captures every field the detail screen renders: title, type (5 values, AC 2 below),
   standard, plantId (optional), location, description, scope (repeatable text list), planned start/end,
   lead auditor, team, auditees.
3. `AuditType` is corrected to the jsx's 5 values (`internal/supplier/customer/certification/gap`) —
   migration + Zod enum + any seed/test referencing the old `process` value (none found) removed.
4. Creating an audit notifies the lead auditor and every team member (reuse `NotificationsService`, the
   same substrate NCR/inspection/8D/SCAR assignment already use) — parity gap closed (§1a).
5. Created audit is idempotency-safe and audited (`created`, already true for the underlying endpoint).

Web: `features/audits/audit-create-dialog.tsx` (a dialog, matching the CAPA precedent for a type with no
wizard flow — Q1's exception extends naturally here since `audit` was never a `WizardType`), wired from
the list header, the palette quick action, and `quick-create.tsx`'s menu.
Mobile: unaffected (no design; mobile has no audit-creation surface in any `m-*.jsx`).
Shared: `CreateAuditBody` gains `location`/`description`/`scope`/`auditeeIds` (packages/types); `WizardType`
is NOT extended (audit stays a dialog, not a wizard step, per the CAPA precedent).

### S2-4 Audit checklist — score clauses, auto-link findings

**Design:** `audits.jsx` `AuditChecklist` (403-492), `CHECKLIST_STATUS` (394-401). Mock:
`data.js:289-302` (`AUDIT_CHECKLIST`, IATF clause bank).

UC
- Happy: Checklist tab lists clause items (§ number, section, question text); scoring a button
  (conformant/minor NC/major NC/opportunity/N/A) updates that item's status inline; a linked NC shows
  the finding/NCR reference.
- Scoring an item major_nc/minor_nc/opportunity with no existing linked finding auto-creates a matching
  `audit_findings` row (kind mirrors the checklist status, description defaults to the clause question
  text, clause carried over) so the Findings tab and the findings-breakdown stay consistent without a
  second manual step — this is the smallest-reasonable-choice reading of the mock data (every NC/
  opportunity checklist row already has a `findingId`); recorded in PROGRESS.md Decisions log at close.
- Re-scoring an already-linked item back to conformant/pending/N/A does NOT delete the finding it
  already spawned (findings are an audit trail, never silently vanish).
- Permission: scoring requires `audit:manage`; `audit:view`-only roles see the tab read-only (no buttons).
- Offline/stale: scoring while offline is disabled with tooltip; concurrent scoring conflict — this is a
  jsonb array on the audit row, so two staff scoring different items concurrently must not clobber each
  other's writes (see backend needs: item-level upsert inside the audit's optimistic-concurrency guard).
- Empty: an audit created before a checklist template existed → seeded with the standard IATF bank by
  default at creation (server-side default, not client-side).

AC
1. Checklist tab reproduces the jsx exactly: counts strip (conformant/NCs/pending), per-item clause/
   section/text, 5-button status row, notes callout, linked-NC line, evidence-count chip.
2. `PATCH /v1/audits/:id/checklist/:itemId` (new) updates one item's status/notes; version-checked
   against the audit's `lockVersion` (a checklist edit bumps it like any other audit mutation) so it's
   optimistic-concurrency-safe and audited.
3. Scoring a not-yet-linked item NC/opportunity creates the linked finding in the SAME transaction
   (`withAudit`, one commit) and stamps `findingId` back onto the checklist item.
4. A default IATF 16949 checklist (the 12-item bank from `data.js`) seeds every new audit's `checklist`
   column at creation — configurable templates (settings `8d-templates`-style editor) are OUT OF SCOPE
   this sprint (no jsx shows an audit-checklist template editor; flagged in §7).
5. `audit:view`-only role cannot call the PATCH (403), and a foreign-tenant/plant audit id 404s.

Web: `features/audits/audit-checklist-tab.tsx`, `use-audit-checklist.ts`.
Mobile: unaffected (no design).
Shared: `AuditChecklistItem` Zod schema in `packages/types` (id, clause, section, text, status, notes,
evidence count, findingId) shared by the API DTO and the web component.

### S2-5 Findings tab + Raise NCR/CAPA from a finding

**Design:** `audits.jsx` `AuditFindingsTab` (494-527). Backend already does the heavy lifting
(`raiseNcr`/`raiseCapa` seams, §1a) — this story is mostly UI wiring plus 2 small field additions.

UC
- Happy: Findings tab lists findings (severity color bar, clause, due date, title, description,
  linked-CAPA/NCR chips); "Raise NCR" / "Raise CAPA" buttons on a finding with neither yet linked open a
  small form (priority + optional title override) → creates the linked record → button set replaced by
  the real link.
- Already-linked: a finding with an NCR or CAPA already linked shows the reference, no raise button for
  that seam (the backend already 409s a double-raise — surface it, don't re-invent the guard).
- Empty: no findings yet → `EmptyState` ("Findings raised during fieldwork will appear here").
- Permission: raising requires `audit:manage`.
- Manual finding: "Add finding" (not directly in the jsx's Findings tab, but required by FEATURES §7 and
  the existing `POST /v1/audits/:id/findings` endpoint) — a small form for kind/clause/description outside
  the checklist flow (e.g. a fieldwork observation not tied to a checklist clause).

AC
1. Findings tab reproduces the jsx card layout (severity bar color, clause, due date, title/description,
   CAPA/NCR chips) exactly.
2. `audit_findings` gains `title` and `due_date` columns (migration) + `CreateAuditFindingBody`/`AuditFindingDto`
   fields, populated by both the manual "Add finding" form and the checklist auto-link (S2-4 AC3, which
   defaults `title` from the clause section name).
3. "Raise NCR"/"Raise CAPA" call the EXISTING endpoints; a second raise attempt surfaces the existing 409
   ("already has an NCR/CAPA") as a toast, not a silent no-op.
4. Findings-summary counts (major/minor/opportunity) on the detail sidebar (S2-2) and the list-page KPI
   strip (S2-1) come from one shared aggregation (backend need below), not two divergent client tallies.

Web: `features/audits/audit-findings-tab.tsx`, `finding-raise-ncr-dialog.tsx`, `finding-raise-capa-dialog.tsx`
(thin wrappers — reuse the NCR/CAPA priority-picker patterns already built for other raise-from flows,
e.g. inspection→NCR).
Mobile: unaffected.
Shared: none beyond the migration in §3.

### S2-6 Cross-cutting: search, notification/palette click-through, dead-nav retirement

Design: none (infrastructure wiring, not a screen). Required by ROADMAP §8 standing rule 2 ("every new
module adds itself to nav/rbac/palette/entity-routes/search/realtime/notifications/audit events") and
rule 1 (placeholder ledger shrinks).

UC
- A command-palette or global search hit of kind `audit` navigates to `/audits/:id` (today: dead row).
- A notification about an audit (once S2-3's create-notification fires) click-throughs to the audit.
- The placeholder ledger (`apps/web/src/config/placeholder-ledger.ts` if that's where S1-8 tracks it —
  confirm the exact file at build start) drops the `/audits`, `/audits/schedule` entries.

AC
1. `audits` gets a `search_vector` generated column + GIN index (migration, mirrors 0008's pattern
   exactly — code/title/description/standard weighted).
2. `SearchEntityKind` gains `"audit"`; `search.service.ts`'s `KINDS` map gains
   `audit: { table: "audits", plantScoped: true }`.
3. `entityHref("audit", id)` returns `/audits/${id}`; `entityIcon("audit")` gets a real glyph (the design's
   custom `audit` SVG path, `audits.jsx:17`, ported as a lucide-compatible icon or the closest existing
   lucide icon — designer's call if a custom SVG is warranted).
4. Command-palette quick actions gain "Schedule audit" (opens S2-3's create dialog) — the item Sprint 01
   S1-2 explicitly deferred pending this sprint (`docs/design/DESIGN-01-shell-foundations.md` O-1).
5. Ledger entry removed; no route under this sprint's scope still renders `ModulePlaceholder`.
6. Realtime: confirm (don't assume) that an audit create/advance/finding mutation actually publishes on
   the existing `"audit"` realtime topic — add the `audit-signal.ts`-pattern wiring if it's missing.

Web: `apps/web/src/lib/entity-routes.ts`, `apps/web/src/config/navigation.ts` (no change needed, already
correct), palette quick-actions list, placeholder ledger.
Mobile: unaffected — mobile does not federate this search or these notifications into any new surface.
Shared/Backend: migration (search_vector), `SearchEntityKind` enum, `KINDS` map, realtime wiring if missing.

## 3. Backend needs (one migration, `0061_audits_module.sql`)

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| S2-1 | none | new `getFrequency` query — `GET /v1/audits/frequency` (last 6 months, grouped by type) | `AuditsService.frequency()` — pure aggregation in `packages/core` (testable), SQL `GROUP BY` in the service | read-only, no audit event | `audit:view` | plant-scoped role filters as `list` already does; cross-tenant impossible (RLS) |
| S2-1/S2-2/S2-5 | none | `AuditDto` gains computed `findingsSummary {major,minor,opportunity}` + `capasOpen`/`capasTotal` on `get`/`list` | join/aggregate over `audit_findings`/`capas` in `AuditsService.get`/`list` (or a batched query to avoid N+1 on list) | none (read) | `audit:view` | same as above |
| S2-2 | none | none (reuses `FilesService` generic presign/complete/listByEntity, `entityKind: "audit"`) | none new | existing file audit events | existing file capability rules + `audit:view` to see the tab | existing files RLS |
| S2-3 | `AuditType` CHECK + Zod enum: `internal/certification/supplier/process` → `internal/certification/supplier/customer/gap`; `audits` gains `description text`, `location text`, `scope text[] NOT NULL DEFAULT '{}'`; `audits` gains `auditee_ids uuid[] NOT NULL DEFAULT '{}'` (service-level active-membership validation, same pattern as `team` — arrays can't carry a composite FK) | `CreateAuditBody` gains the new fields; `AuditDto` gains them for read | `AuditsService.create` validates `auditeeIds` like `team`; calls `NotificationsService` for lead + team on create | `created` (existing) — reason/context unchanged | `audit:manage` to create | foreign plantId/leadAuditorId/team/auditeeIds/member id → 404 (test: extend `audits.test.ts`) |
| S2-4 | `audits.checklist` already exists (0001) — no new column; add a checklist-seed constant (code, not schema) | `PATCH /v1/audits/:id/checklist/:itemId` (`UpdateAuditChecklistItemBody`: status, notes?, version) | `AuditsService.updateChecklistItem` — optimistic on `lockVersion`, creates a linked finding in the same tx when status transitions to major_nc/minor_nc/opportunity and no `findingId` yet | `checklist_item_scored` (new `AuditAction` value) + the auto-created finding's own `created` event | `audit:manage` | stale-write (409) on concurrent item edits; foreign audit 404 |
| S2-5 | `audit_findings` gains `title text`, `due_date timestamptz` | `CreateAuditFindingBody`/`AuditFindingDto` gain `title`/`dueDate` | `AuditsService.createFinding` accepts/persists them; checklist auto-link (S2-4) populates `title` from the clause section | existing `created` event, payload widened | `audit:manage` (create), `audit:view` (list) | existing (unchanged) |
| S2-6 | `audits` gains `search_vector tsvector GENERATED ALWAYS AS (...) STORED` + GIN index (mirrors 0008) | `SearchEntityKind` enum + `KINDS` map entry | `SearchService` — no new method, one more map entry | none (read) | inherits `audit:view`'s plant-scoping via the existing `isPlantScoped` branch | RLS scopes the tenant; plant filter mirrors `inspection`/`ncr` |
| S2-6 | none | none | confirm/wire `audit-signal.ts`-pattern realtime publish on audit mutations if missing | n/a | n/a | n/a |

Every mutation above runs inside `withAudit` in the SAME transaction (rule 3); every new list/aggregation
is cursor-paginated where it lists rows (rule 6, `frequency` returns a small fixed 6-row shape, not a
list, so no cursor needed); every new Zod schema lives in `packages/types` (rule 4); no business logic
in the web components — checklist auto-link, frequency aggregation, and findings-summary rollups are
service/`packages/core` logic (rule 5).

## 4. Design needs

**Existing binding jsx — designer AUDITS these against the built screens, does not redraw them:**
- `AuditList`/`AuditCard`/`AuditFrequencyChart` — `audits.jsx:23-208` (S2-1).
- `AuditDetail`/phase tracker/sidebar/`AuditTeamTab`/`AuditEvidenceTab`/`AuditReportTab` —
  `audits.jsx:213-646` (S2-2).
- `AuditChecklist`/`CHECKLIST_STATUS` — `audits.jsx:394-492` (S2-4).
- `AuditFindingsTab` — `audits.jsx:494-527` (S2-5).

**NO existing jsx — designer must draw these, in the existing visual language (tokens.css, k-surface/
k-chip/k-btn conventions), before Gate 1:**
1. **Create Audit form** (S2-3) — no `ENTITY_TYPES` wizard entry, no standalone dialog anywhere in
   `project_brain/project/src/*.jsx`. Needs: field layout for title/type/standard/plant/location/
   description/scope-list/dates/lead-auditor/team/auditees, matching the CAPA create dialog's visual
   weight (a modal, not a full wizard page, per the S2-3 rationale).
2. **Schedule view** (S2-1, `?view=schedule`) — the jsx's own "Schedule view" button navigates to the
   INSPECTIONS schedule by mistake (copy artifact, cited in §1a); FEATURES §7 still requires an audit
   schedule. Needs: a calendar/timeline view of planned+in-progress audits by date, following the visual
   language of `apps/web/src/features/inspections/schedule-view.tsx` (existing built pattern) restyled
   with `AUDIT_TYPES` colors.
3. **Raise-NCR / Raise-CAPA-from-finding mini forms** (S2-5) — not shown as their own component in
   `audits.jsx` (the buttons exist in the mock `AuditFindingsTab` markup style implied by FEATURES §7's
   "Create-NCR-from-finding linkage" bullet, but no dialog is drawn). Small forms (priority + optional
   title) — designer should confirm reusing the visual pattern of an equivalent existing raise-from-X
   dialog rather than a bespoke one.
4. **Manual "Add finding" form** (S2-5) — not drawn (the jsx's Findings tab only renders existing
   findings, no add-affordance), but the backend endpoint and FEATURES §7 require it.
5. **Audit icon glyph** (S2-6 AC3) — the jsx defines a custom inline SVG path (`audits.jsx:17`) for
   `ICONS.audit`; confirm whether an existing lucide icon is close enough or the custom path should be
   ported (small, but a real pixel decision, not a placeholder icon).

## 5. Dead-end audit

Grepped `apps/web/src/config/{navigation.ts,planned-modules.ts,excluded.md}` and the placeholder ledger:

| Control | Current state | This sprint |
|---|---|---|
| Sidebar "Audits" root (`/audits`) | Renders `ModulePlaceholder` | Real list (S2-1) |
| Sidebar "All Audits" child (`/audits`) | Same placeholder | Real list (S2-1) |
| Sidebar "My Audits" child (`/audits?view=mine`) | Same placeholder | Real filtered list (S2-1) |
| Sidebar "Schedule" child (`/audits?view=schedule`) | Same placeholder | Real schedule view (S2-1, new design) |
| `audits.jsx` "New audit" button | No wizard entry, no dialog anywhere | Real create dialog (S2-3) |
| `audits.jsx` "Schedule view" button (list header) | Points at `inspections-schedule` in the prototype (copy bug) | Wired to `/audits?view=schedule`, NOT the inspections schedule |
| `audits.jsx` detail "Export" button | `kToast` only in the prototype | Real export via existing pipeline (S2-2 AC6) |
| `audits.jsx` detail "Continue audit" button | `kToast` only in the prototype | Real `POST /v1/audits/:id/advance` (S2-2 AC2) |
| `audits.jsx` Report tab "Export PDF" | `kToast` only | Real export pipeline (S2-2 AC5) |
| `audits.jsx` Report tab "Send to auditee" | `kToast` only | **NOT built** — no auditee-notification design/endpoint exists; explicitly out of scope, listed in §7, not silently dropped |
| Checklist item status buttons | No backend at all | Real `PATCH .../checklist/:itemId` (S2-4) |
| Findings tab raise-NCR/raise-CAPA buttons | Backend exists, no UI | Wired to real endpoints (S2-5) |
| Command palette "Schedule audit" quick action | Deferred by Sprint 01 (no `/audits` yet) | Added, opens real create dialog (S2-6 AC4) |
| Search hits / notifications of kind `audit` | Dead, non-navigating row (`entityHref` → `null`) | Real navigation (S2-6 AC3) |

No new "coming soon" text, no new dead button, is introduced by this sprint. "Send to auditee" is the
one explicitly-scoped-out control — flagged honestly per rule 10, not disguised as done.

## 6. Definition of Done

- [ ] Migration `0061_audits_module.sql` applied; `pnpm db:check` green; RLS forced on `audits`/
      `audit_findings` (already forced — confirm unchanged); `pnpm test:rls` green including the new
      `auditee_ids`/`search_vector` columns.
- [ ] Contract (`packages/types/src/contract.ts`) gains `GET /v1/audits/frequency`,
      `PATCH /v1/audits/:id/checklist/:itemId`; existing routes' DTOs widened (backwards-compatible,
      additive fields only — mobile, which doesn't consume this module, stays green on
      `pnpm --filter @kaenal/mobile typecheck`).
- [ ] `AuditsService` unit/integration tests cover: frequency aggregation, checklist scoring + auto-link
      finding creation (in-tx, one commit), checklist stale-write 409, findings title/dueDate persistence,
      auditee validation (foreign/invalid → 404/422 as appropriate), notification-on-create, cross-tenant
      404 on every new route (mutation-tested where isolation is the point, per CLAUDE.md footer rule).
- [ ] Web: `/audits`, `/audits/[id]`, `/audits?view=mine`, `/audits?view=schedule` all real, no
      `ModulePlaceholder` remains for this module; every button in §5's table resolves to real behaviour
      or is honestly listed as out of scope.
- [ ] Browser-verified side-by-side against `audits.jsx` for every view/tab/state this sprint's stories
      cover (list default/empty/filtered-empty/error, detail all 5 tabs, create dialog happy/error/
      permission, checklist scoring incl. auto-link, raise-NCR/raise-CAPA, search hit → detail,
      notification → detail).
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded (`seed-demo.ts`) and a real sign-in proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` "Current status" + Decisions log (checklist auto-link decision, AuditType enum
      correction, `process`-value removal) updated in the same commit; no `progress_mobile.md` change
      needed (mobile genuinely unaffected — confirm and state so explicitly, don't silently skip it).
- [ ] `docs/design/DESIGN-02-audits.md` published by the designer covering §4's audit + new boards, and
      the 5 new-design items in §4 carry the user's visual sign-off before Gate 1.

## 7. Out of scope / open questions

- **Q10 (new).** "Send to auditee" (Report tab) has no design or recipient model (who is "the auditee" —
  a membership? a supplier contact? an email address typed ad hoc?) — needs a product decision before
  any design or backend work. Logged as a question, not silently dropped.
- **Q11 (new).** Configurable audit-checklist templates (a settings screen to edit/version the clause
  bank, analogous to the 8D/inspection template editors in Sprint 07) — FEATURES §7 doesn't ask for this
  explicitly and no jsx shows it; this sprint seeds ONE fixed IATF bank per new audit. If a second
  standard (ISO 14001, AS9100D — both appear in the mock data) needs a DIFFERENT clause bank, that's a
  template-management feature for a later sprint; flagged, not built here.
- **Q12 (new).** `lead_auditor_id` is a plain `REFERENCES users(id) ON DELETE RESTRICT` — NOT the
  settled-architecture composite `(tenant_id, col) → memberships (tenant_id, user_id)` pattern
  (`CLAUDE.md` "Settled architecture decisions"). This predates this sprint (migration 0001) and is
  unrelated to building the Audits screens; flagged as a pre-existing inconsistency for its own reviewed
  migration, not silently fixed as a side-effect here (a schema change to a referenced-by-default FK
  deserves its own test slice, per the same caution the RLS-suite `tenant_settings` gap was left alone
  under in Sprint 01 Phase D history).
- **Q13 (new).** Graph node kinds / "graph seeds" for audits (ROADMAP §8 standing rule 2) are explicitly
  Sprint 03's concern (the graph explorer doesn't exist yet) — this sprint's `entity-routes.ts`/search
  work is upstream-compatible with it but does not build the graph integration itself.
- Unresolved items above go to `PROGRESS.md` Known issues at sprint close, per SCRUM.md rule "never
  silently drop scope."

---

**PO use-case sign-off: APPROVED** — every use case in all 6 stories maps to either an existing binding
jsx screen/sub-view (10, audited independently by the designer in `DESIGN-02-audits.md` §1) or one of the
4 new boards (Create Audit dialog, Audit schedule view, Raise NCR/CAPA from finding, Manual Add finding
form) covering §4's 5 flagged gaps (items 1-4 map 1:1 to boards; item 5, the icon glyph, was resolved
without a new board — `ShieldCheck`, reusing the current placeholder's existing icon choice). Generic
states (loading/empty/error/offline/stale-write) reuse existing primitives per `DESIGN-02-audits.md` §3,
not re-designed. Mobile is independently confirmed unaffected (§4 of that file). S2-3's AC1 tightened
above to close the one ambiguity the designer's architect-flag surfaced (shell topbar quick-create menu
exclusion, mirroring CAPA) — the flag itself (§6 of that file) is an implementation-sequencing question
for the architect, not a use-case or scope gap.
**Design sign-off (ui-lead-designer): APPROVED** (pending the user's visual sign-off on the 4 new boards
listed above — `docs/design/DESIGN-02-audits.md` §5).
**User approval of new designs (§4 items 1-5): APPROVED (2026-09-27)** — all 4 boards on the canvas approved as-is.

**GATE 1 — READY.**
