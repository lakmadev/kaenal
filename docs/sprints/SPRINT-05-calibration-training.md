# SPRINT-05 — Calibration Management + Training & Competency

Author: Product Owner. Date: 2026-09-29. Part of the multi-sprint programme in `ROADMAP.md` (Wave 5 of 13).
Governing rules: CLAUDE.md rules 0, 1-8, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprints 01-04 (shell, audits, graph+predictive, risk+MSA) — all merged, not touched here except the
small, named, additive cross-cutting config edits every sprint in this programme makes (ROADMAP §8 rule 2).

**This sprint carries an APPROVAL GATE (ROADMAP §0 Q2).** Both modules' backends are `PROPOSED` (P16, P17)
with no existing `02-DATABASE`/`03-API` spec beyond the phase docs' own sketches — this sprint file's §3 is
the backend design the user must approve before any code is written. **NO BUILD MAY START until the user has
explicitly approved §3** (instrument register + calibration-event schema, the raise-NCR link, the due/overdue
math; the training-record-as-history-table schema, the mandatory-gap cell rule, the expiry math; both
due-soon/expiry job designs; the certificate/evidence attachment pattern via Files; and the one exclusion
this sprint proposes, the vendor LMS panel). This mirrors exactly how Sprint 03 gated §3B and Sprint 04 gated
§3 (through 5 amendment rounds) before those sprints' builds started.

---

## 1. Goal and roles served

Replace the `/calibration` and `/training` `ModulePlaceholder`s (served today via
`PLANNED_MODULES["calibration"]`/`PLANNED_MODULES["training"]`, ledger entries `planned:calibration`/
`planned:training`) with two real, backend-complete quality-system modules:

- **Calibration management** (IATF 16949 §7.1.5, measurement-equipment control): an instrument register with
  due-date tracking, a calibration-event history per instrument, certificate attachment, an out-of-tolerance
  finding path into a real NCR, and due/overdue notifications — everything `CalibrationManagement` in
  `qms-modules.jsx` (lines 176-319, read in full) and FEATURES §12/§224 specify.
- **Training & competency** (IATF 16949 §7.2, competence): a tenant-defined competency catalog, a
  member-by-competency matrix with certified/expiring/gap/N-A cell states, per-member training history with
  evidence, mandatory-gap and expiring reports, and expiry notifications — everything `TrainingMatrix` in
  `qms-modules.jsx` (lines 1-174, read in full) and FEATURES §12/§223 specify.

Roles served: **admin, manager, auditor** (module administration: add/retire instruments, record
calibrations/training, raise NCRs, export reports); **inspector, viewer** get read-only visibility of the same
two capabilities (mirrors exactly how `risk:view`/`msa:view`/`fmea:view` are already granted broadly while the
standalone module nav stays narrower to admin/manager/auditor, §1a). No `m-*.jsx` design shows an actual
calibration-status or training-status UI control (§1a) — **mobile is unaffected by this sprint**, proven by
`pnpm --filter @kaenal/mobile typecheck` staying green on the additive shared-type changes only.

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| No `instruments`, `calibration_events`, `competencies`, or `training_records` table exists anywhere; no `apps/api/src/calibration` or `apps/api/src/training` directory exists | `grep -rn "CREATE TABLE" packages/db/migrations/*.sql` — no match; `ls apps/api/src` — 32 existing feature dirs (`risk`, `msa`, `audits`, `fmea`, `spc`, `files`, `notifications`, `jobs`, … — no `calibration`/`training`) |
| `implementation/02-DATABASE.md`/`03-API.md` define no calibration/training tables; the phase docs `phases/P16-calibration.md` and `P17-training.md` are marked `Status: Backend 🔴 PROPOSED · FE 🔴` and both name their own **open sign-off questions** (P16: warn-window days, external-lab vendor tracking, block-inspections-on-overdue-gauge; P17: catalog seeded per-tenant vs global, expiring-window days, role-requirement auto-gap) — this sprint's §3 resolves each explicitly rather than leaving them implicit | both phase files read in full this session |
| Next free migration number is **0067** — `0066_risk_msa_exports.sql` (Sprint 04) is the last one on disk; no branch (local or remote) has a migration past 0066. ROADMAP §4's guess of "05: 0047-0049" is stale (written before Sprints 02-04 landed 0061-0066) | `ls packages/db/migrations \| sort \| tail`; confirmed no gap-fill migrations exist between 0042 and 0050 either (0043-0049 were never used, also stale ROADMAP numbering, not this sprint's concern) |
| `apps/web/src/config/navigation.ts` already has real nav entries: `{ id: "training", href: "/training", icon: Award }`, `{ id: "calibration", href: "/calibration", icon: Wrench }` | `apps/web/src/config/navigation.ts:160-161` |
| `apps/web/src/config/planned-modules.ts` still lists both (`training: { title: "Training & competency", icon: Award }`, `calibration: { title: "Calibration", icon: Wrench }`); `placeholder-ledger.ts` still carries `"planned:calibration": 5` / `"planned:training": 5` (correctly pointing at this sprint) | `apps/web/src/config/planned-modules.ts:29-30`; `placeholder-ledger.ts:14-15` |
| `apps/web/src/config/rbac.ts` `ROLE_NAV`: admin = all, manager = all-minus-platform (both already cover `training`/`calibration` once built — neither id is in `PLATFORM_ROOTS`), but **auditor's explicit allow-list does not include `training` or `calibration`** (it lists `risk`/`msa`/`fmea` from Sprint 04, but not these two) — this sprint adds both, same reasoning Sprint 04 used for `risk`/`msa` (auditor is Kaenal's elevated QMS role, not a read-only reviewer) | `apps/web/src/config/rbac.ts:32-47` |
| No `calibration:view`/`calibration:manage`/`training:view`/`training:manage` capability exists in `packages/core/src/rbac.ts` | `grep -n "calibration:\|training:" packages/core/src/rbac.ts` → 0 hits |
| `plants`/`areas` are real tables (`0001_core.sql`, `plants(tenant_id, code, …)`, `areas(tenant_id, plant_id, name, …)`) with an established plant-scope pattern: `packages/core/src/rbac.ts`'s `authorizePlant`/`isPlantScoped`, and `apps/api/src/members/members.service.ts:35-40` already filters the members list by `membership.plantIds` overlap for a plant-scoped role. This sprint reuses both patterns directly rather than inventing a free-text "area" field (the jsx's `area: 'Pune-1 / Metrology'` string is a mock display concatenation, not a designed data-model constraint — same class of correction Sprint 04 made for `RiskCategory`/code formats) | `packages/db/migrations/0001_core.sql:85-104`; `apps/api/src/members/members.service.ts:35-40`; `packages/core/src/rbac.ts:238-285` |
| `memberships.title text` already exists (added `0003_shared_identity.sql`) — this is exactly the free-text job-title field the training matrix's "role" column needs ("Quality Manager", "CMM Specialist"); **no new column needed** | `packages/db/migrations/0003_shared_identity.sql:109` |
| `apps/api/src/jobs/processors/document-expiry.ts` + `packages/core/src/document-expiry.ts` (`activeExpiryThreshold`, `EXPIRY_THRESHOLDS = [90,30,7]`, idempotent `dedupeKey`) is the established, direct precedent for "a daily per-tenant sweep notifies an owner at a threshold, never re-sending" — this sprint's `calibration-due`/`training-expiry` jobs are the same shape, not a new mechanism | `apps/api/src/jobs/processors/document-expiry.ts` read in full; `apps/api/src/jobs/worker.ts:225-240` (the `docs` queue's daily per-tenant enqueue) |
| `apps/api/src/audits/audits.service.ts:655-676` (`raiseNcr`) is the established, direct precedent for "an out-of-spec finding in one module creates a real NCR": loads the source row, calls `NcrsService.create(... source, sourceId, plantId)`, then one-time links the source row back (`ncr_id IS NULL` guard preventing a double-raise) | read in full this session |
| `NcrSource` enum (`packages/types/src/enums.ts:107-113`) currently has `inspection\|manual\|complaint\|audit` — no `calibration` member; `ncrs.source` carries a literal `CHECK` constraint (`0001_core.sql`), so adding `calibration` needs a migration `ALTER … DROP/ADD CONSTRAINT`, the same class of change Sprint 04 made to `entity_links`'s CHECK for `risk`/`fmea` | `packages/db/migrations/0001_core.sql` (ncrs table); `packages/types/src/enums.ts:107-113` |
| `ExportResource` enum + `export_jobs.resource` CHECK have been widened once per new single-module export in every sprint so far (`audit_report` S02, `predictive_forecast_pack` S03, `risk_board_pack`+`gauge_rr_aiag_report` S04, each via its own migration `ALTER`) — same pattern this sprint reuses for `calibration_audit_pack`/`skill_gap_report` | `packages/db/migrations/0061_audits_module.sql:69`, `0062_risk_predictions.sql:70`, `0066_risk_msa_exports.sql:15` |
| `files.entity_kind`/`entity_id` are **free-text**, not constrained to `EntityKind` (only `create_wizard`'s own child table has a literal CHECK) — a certificate/evidence file can attach to `entity_kind = 'calibration_event'` or `'training_record'` today with **no schema change to `files`** | `packages/db/migrations/0001_core.sql:410-419` (no CHECK on `files.entity_kind`); `apps/api/src/files/files.service.ts` (accepts any string) |
| No `m-*.jsx` shows an actual calibration-status or training-status UI element. The only string hits are incidental: `m-oversight.jsx:20` is a mock **document** notification titled "Calibration schedule Q3" (a document, not a calibration-module control); `m-work.jsx:24` is a mock **inspection** titled "Monthly calibration audit"; `m-work.jsx:134/139` is inspection-checklist copy ("Torque wrench calibrated (cert current)") inside one specific inspection's own instructions — none of these render an instrument register, a due-date badge, or a training-gap indicator. ROADMAP §5's own conditional ("only if a jsx shows it") is confirmed **not met** | `grep -in "calibrat\|gauge\|instrument" project_brain/mobile/src/m-*.jsx`, all 5 hits read in context this session |
| `inspections.jsx`/`ncr.jsx` (the binding web designs for those two already-built modules) show **no** instrument-picker field, no calibration-status badge, and no training-gate control anywhere — the only hit is one mock activity-feed line, `inspections.jsx:703`, "generated Finding #2 on torque wrench calibration" (decorative comment-feed text, not a UI control) | `grep -in "calibrat\|instrument\|gauge" project_brain/project/src/inspections.jsx project_brain/project/src/ncr.jsx` |
| `qms-modules.jsx`'s calibration overdue banner (`CalibrationManagement`, lines 255-263) reads: *"Measurements with this instrument are blocked at inspection sign-off. All inspections recorded with it since {last} require traceability review."* This is a real operational claim about the **Inspections module**, which has no instrument field at all (row above) — building the actual block would mean adding an instrument-selection field and a sign-off gate to Inspections, a module this sprint does not own and which has no jsx showing that field (rule 0 "no invented scope" / rule 9 governs *this sprint's* two jsx components, not a third module's). Flagged as **Q-C1** (§7) and the banner text is corrected in this sprint's build (§3.1), not silently reproduced as a false claim | `qms-modules.jsx:255-263` read closely |
| `qms-modules.jsx`'s "Linked e-learning" card (`TrainingMatrix`, lines 147-166) shows Cornerstone and SAP SuccessFactors as already `Connected`, and Litmos/Custom-SCORM-upload with a `Connect` button. The existing `integrations` table's `provider` CHECK (`0032_integrations.sql:22`) whitelists `slack, ms_teams, ms365, google, smtp, …` — **no LMS vendor is in that list**, and no `implementation/09-INTEGRATIONS.md` section names one. Building a real Cornerstone/SuccessFactors/Litmos OAuth connector is exactly the class of external-vendor work ROADMAP Q5 defers to Sprint 13 (no vendor decision, no credentials, no spec) — flagged as **Q-T1** (§7) for exclusion this sprint, not silently faked as "Connected" (rule 10) | `qms-modules.jsx:147-166`; `packages/db/migrations/0032_integrations.sql:22` |
| `packages/core/src/spc.ts`/`risk-matrix.ts`/`gauge-rr.ts` establish the precedent this sprint follows: pure, unit-tested derivation functions in `packages/core`, never a stored "status" column computed against `now()` | read in prior sprints, confirmed still the pattern |

---

## 2. Stories

### C1 — Instrument register: schema, list, detail

**Design:** `CalibrationManagement` (`qms-modules.jsx:190-310`) — KPI strip, instrument register table with
search/segmented filter, detail card (overdue banner, field grid, history table).

UC
- Happy: open `/calibration` → KPI strip (real counts), register table (search by ID/name/area, filter
  All/Due soon/Overdue), clicking a row selects it and populates the detail card (fields, last-5 history).
- Overdue: an overdue instrument's detail card shows the warning banner with days-overdue and last-calibrated
  date — text corrected per §1a/Q-C1 (no false "blocked at inspection sign-off" claim).
- Empty: tenant has zero instruments → register/KPI strip show a real empty state ("0" everywhere, "No
  instruments yet — Add instrument"), not the jsx's populated mock.
- Permission: `calibration:view` required for the page; a role without it never sees the nav entry (curated,
  §4) and a direct deep-link 403s (server-side, for `partner`) or is client-blocked (inspector/viewer, mirrors
  X1's risk/msa precedent exactly).
- Plant scope: a plant-scoped role (inspector, if ever plant-scoped — confirmed today only via
  `membership.plantIds`) sees only instruments in their own plant(s), mirroring `members.service.ts`'s
  existing filter; a direct-id fetch of an out-of-scope-plant instrument 404s (never 403 — rule 8).
- Error/offline: list fetch fails → retry affordance; offline banner disables Add/Record/Retire/Transfer
  mutations (reuse S1-5 infrastructure).

AC
1. Migration `0067_calibration.sql`: `instruments` — `tenant_id`, `id`, `code` (`CAL-YYYY-NNNN` via
   `codes.ts`'s `counters` mechanism — the jsx's `CAL-001` mock format is corrected to the one established
   `PREFIX-YYYY-NNNN` pattern, exactly as Sprint 04 corrected `R-NNN`/`MSA-NNN`; `CodeKind` gains
   `"instrument"` → prefix `CAL`), `name`, `type` enum (`cmm|comparator|profilometer|ndt|caliper|torque|
   laser_tracker` — the 7 distinct types the jsx's `INSTRUMENTS` fixture actually uses), `plant_id` (FK →
   `plants(tenant_id,id)`, NOT NULL — every physical instrument belongs to one plant), `area_id` (FK →
   `areas(tenant_id,id)`, NULL — optional finer location, must belong to `plant_id` when set, checked in the
   service not the DB), `method` text NOT NULL (free text — "Internal — ISO 10360", "External — NABL
   accredited"; not an enum, since accreditation-body names are open-ended and the jsx never caps the set),
   `tolerance` text NOT NULL (free text display string, e.g. "±1.7μm" — not a numeric column, since units vary
   by instrument type and no calculation ever reads it, unlike MSA's numeric `tolerance`), `interval_months`
   int NOT NULL CHECK > 0, `last_calibrated` date NULL, `next_due` date **GENERATED ALWAYS AS
   (last_calibrated + (interval_months || ' months')::interval) STORED** (NULL when `last_calibrated` is
   NULL — a never-calibrated new instrument has no due date yet, see C6), `owner` (composite member FK),
   `status` enum (`active|retired`) DEFAULT `active` (the register's own lifecycle status — distinct from the
   *due-status* `ok|warn|overdue`, which is never stored, see AC2), `lock_version`, standard audit columns.
   Forced RLS, leading `tenant_id` index, unique `(tenant_id, code)`.
2. `packages/core/calibration.ts` (pure): `instrumentDueStatus(nextDue: Date | null, now: Date):
   "ok"|"warn"|"overdue"|"unscheduled"` — `unscheduled` when `nextDue` is null (never calibrated), `overdue`
   when `nextDue < now`, `warn` when `nextDue` is within the warn window (**30 days**, §3.1 — resolves P16's
   own open "warn-window days" question), else `ok`. Unit-tested including the boundary days.
3. `GET /v1/instruments` (cursor, rule 6; filters `type`/`status`/`dueStatus`(`due_soon`|`overdue`)/`plantId`;
   plant-scoped for a plant-scoped role per §1a), `POST /v1/instruments` (`calibration:manage`), `GET
   /v1/instruments/:id` (`calibration:view`), `PATCH /v1/instruments/:id` (`lockVersion`,
   `calibration:manage` — edits name/type/plant/area/method/tolerance/interval/owner; never `last_calibrated`/
   `next_due` directly, those only change via C2's calibration-event route). All mutations `withAudit` in the
   same transaction (rule 3).
4. Cross-tenant instrument id → 404, not 403 (rule 8); cross-plant (for a plant-scoped role) → 404, not 403
   (mirrors the `assertEntityVisible` plant-scope pattern, §1a), both mutation-tested against RLS.
5. KPI strip, exact formulas (mirrors Sprint 04 R1 AC6's precedent of stating every formula, not eyeballing):
   - **Instruments tracked** = `count(*) where status='active'`.
   - **Due < 30 days** = `count(*) where status='active' and instrumentDueStatus(next_due, now) = 'warn'`.
   - **Overdue** = `count(*) where status='active' and instrumentDueStatus(next_due, now) = 'overdue'`.
   - **Out-of-tol findings (YTD)** = `count(*) from calibration_events where result in ('adjusted','fail') and
     performed_at in the tenant's current calendar year` (an "out-of-tolerance finding" is any event where the
     instrument was found out of tolerance at check time — `adjusted` means it was out of tolerance and then
     corrected, `fail` means it remains out of tolerance; `pass` never counts). Sub-stat "N led to NCR" =
     `count(*) from calibration_events where result in ('adjusted','fail') and ncr_id is not null and
     performed_at in the current calendar year` (C3).

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/calibration/` — `CalibrationPage` (KPI strip, register table w/
  search+segmented filter, detail card w/ overdue banner (corrected text), field grid, history table (last 5,
  "View all" → C4's full list)), empty/loading/error/permission/offline states, deep-link `/calibration?id=
  <uuid>`.
- **Mobile:** not built — no `m-*.jsx` design (confirmed §1a); no route, no nav entry;
  `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes only.
- **Shared:** migration `0067` (instruments table); `InstrumentDto`/`InstrumentListQuery`/`CreateInstrumentBody`/
  `UpdateInstrumentBody` + `InstrumentType`/`InstrumentLifecycleStatus` enums in `packages/types`;
  `packages/core/calibration.ts` (pure, unit-tested); `calibration:view`/`calibration:manage` in
  `packages/core/src/rbac.ts`; `CodeKind` gains `"instrument"`.

### C2 — Record a calibration event + certificate attachment

**Design:** `qms-modules.jsx:300-301` "Record calibration" / "Upload cert" buttons (`kToast` only in the
prototype); history table (`qms-modules.jsx:283-296`).

UC
- Happy: "Record calibration" opens a dialog (result: pass/adjusted/fail, performed-by, notes, optional
  certificate upload) → creates a real `calibration_events` row, advances `last_calibrated`/`next_due` on the
  instrument, and the detail card's history table shows the new row immediately.
- Certificate: "Upload cert" attaches a PDF/image to the **most recent** calibration event (or, if recording a
  new event in the same dialog, to that new event) via the existing Files presign→PUT→complete pipeline
  (`entity_kind='calibration_event'`), AV-scan-gated for download exactly like every other evidence upload in
  this codebase.
- Permission: `calibration:manage` to record; `calibration:view` to read history + download a clean certificate.
- Offline: recording/upload disabled by the offline banner (S1-5).

AC
1. Migration `0067` also creates `calibration_events`: `tenant_id`, `id`, `instrument_id` (composite FK →
   `instruments(tenant_id, id)` ON DELETE CASCADE), `performed_at` date NOT NULL, `result` enum
   (`pass|adjusted|fail`), `performed_by` text NOT NULL (free text — the jsx shows external lab names like
   "A2LA Cal Labs", not always an internal member; an internal calibration can still name the technician as
   free text, consistent with "method" being free text on the parent), `notes` text NOT NULL DEFAULT '',
   `certificate_file_id` (nullable FK → `files(id)`), `ncr_id` (nullable FK → `ncrs(tenant_id, id)`, set by C3
   only), standard audit columns. Forced RLS, leading `tenant_id` index (mirrors `msa_measurements`'/
   `risk_controls`' child-table precedent).
2. `POST /v1/instruments/:id/calibration-events` (`calibration:manage`, `lockVersion` on the parent
   instrument, 409 on stale — same optimistic-concurrency rule every mutation in this programme follows,
   rule 6) creates the event **and**, in the same transaction, updates the parent instrument's
   `last_calibrated = performed_at` (only when `performed_at` is the instrument's newest event — an
   out-of-order backfill entry does not regress the due date) and recomputes `next_due` (the generated
   column follows automatically). Audited `updated` on the instrument (parent), in-tx.
3. `GET /v1/instruments/:id/calibration-events` (cursor, rule 6) — the full history; the detail card's "last 5"
   is this same route with `limit=5`, not a separate endpoint.
4. Certificate attach reuses the existing `POST /v1/files/presign` → PUT → `POST /v1/files/:id/complete` flow
   with `entityKind: "calibration_event"`, `entityId: <event id>` — no schema change to `files` (§1a). A
   not-yet-clean (AV pending/failed) certificate cannot be downloaded, reusing the existing gate.

**Web/Mobile/Shared:** Web (`apps/web/src/features/calibration/` — Record-calibration dialog + certificate
upload, no jsx precedent for the dialog itself, flagged §5). Mobile: unaffected. Shared: table addition to
C1's migration; `CalibrationEventDto`/`CreateCalibrationEventBody`/`CalibrationResult` in `packages/types`; no
new capability (reuses `calibration:view`/`calibration:manage`).

### C3 — Out-of-tolerance calibration → raise a real NCR

**Design:** the KPI's own "N led to NCR" sub-stat (`qms-modules.jsx:212`, "2 led to NCR") names a real
capability the mock never shows a button for, but which must be real for that number to be honest (rule 10 —
an un-backed KPI count is exactly the class of defect Sprint 04's R2 (Controls block) was written to close).

UC
- Happy: on an `adjusted`/`fail` calibration event with no NCR yet, an admin/manager/auditor can "Raise NCR"
  → creates a real NCR (`source: "calibration"`, `sourceId: <event id>`, pre-filled title, `plantId` from the
  instrument), and links it back to the event (`ncr_id`), one-time only (mirrors `audits.service.ts`'s
  `raiseNcr` exactly — loads the event, 409/CONFLICT if already linked, creates the NCR, `UPDATE … WHERE
  ncr_id IS NULL` guard against a concurrent double-raise).
- Already linked: the button is replaced by a real link to the existing NCR (`entityHref("ncr", id)`), never a
  second "Raise NCR" affordance once one exists.
- Permission: `calibration:manage` **and** `ncr:create` (mirrors the audit-finding raise-NCR route's own dual
  capability check).

AC
1. `NcrSource` gains `"calibration"` (`packages/types/src/enums.ts`); `ncrs.source` CHECK constraint widened
   (migration `0067`, mirrors Sprint 04's `entity_links` CHECK-widening pattern for a new enum member).
2. `POST /v1/instruments/:instrumentId/calibration-events/:eventId/raise-ncr` (`calibration:manage` +
   `ncr:create`) — 422 if the event's `result = 'pass'` (only an out-of-tolerance finding can raise an NCR —
   never a fabricated finding from a passing check), 409/CONFLICT if `ncr_id` is already set, else creates the
   NCR via `NcrsService.create` and links it, audited (the NCR's own `created` event; the event row's
   `UPDATE` is part of the same transaction, no separate audit action needed, same as the audit precedent).
3. Cross-tenant event/instrument id → 404 (rule 8).

**Web/Mobile/Shared:** Web (a real "Raise NCR" action on a qualifying history row, replacing nothing in the
jsx — this is new, honest backing for an existing KPI number, not a UI change to the mock). Mobile: unaffected.
Shared: `NcrSource` enum + `ncrs.source` CHECK widening (folded into `0067`); no new capability.

### C4 — Instrument lifecycle: retire, transfer, full history

**Design:** `qms-modules.jsx:302` the register row/detail-card "⋯" button (`kToast('Instrument options —
history, retire, transfer')` — three named actions, dead in the prototype).

UC
- Happy: the "⋯" menu offers exactly the three actions the mock's own toast text names — **View full
  history** (opens C2's full `GET /v1/instruments/:id/calibration-events` list, unpaged in the mock's "last
  5" but real cursor-paginated here), **Retire** (a real status transition, `active → retired`, audited
  `status_changed`, `lockVersion`-guarded, 409 on stale — retired instruments drop out of the due-tracking KPI
  strip and the default register filter, but stay readable for history), **Transfer** (opens the same edit
  surface as C1's `PATCH`, focused on `plant_id`/`area_id` — not a new backend concept, the existing edit
  route with those two fields pre-focused, exactly how Sprint 04 R1's "Re-score" was the same `PATCH` as
  "Edit" with different fields pre-focused).
- Retired instrument re-activation: **[flagged §7 Q-C2]** the mock names no "un-retire" action; this sprint
  does not build one (a genuinely retired instrument is assumed permanently out of service) — if wanted, a
  future story adds a symmetric `active` transition.

AC
1. `PATCH /v1/instruments/:id/retire` (`calibration:manage`, `lockVersion`, 409 on stale) — `active → retired`
   only; retiring an already-`retired` instrument is 422 (no-op transition, mirrors Sprint 04's reopen/complete
   precedent for one-way status routes). Audited `status_changed`, not generic `updated`.
2. Transfer is `PATCH /v1/instruments/:id` (C1 AC3) with only `plantId`/`areaId` in the body — no new route.
3. Retired instruments are excluded from C1 AC5's KPI formulas and from the default `GET /v1/instruments`
   filter (a `status=retired` filter value still finds them, for history/audit purposes).

**Web/Mobile/Shared:** Web (the "⋯" menu, wired to the three real actions — no jsx precedent for the menu
itself beyond its toast text, flagged §5). Mobile: unaffected. Shared: none beyond C1's schema/types.

### C5 — Calibration due/overdue notifications + audit-pack export

**Design:** `qms-modules.jsx:201` "Audit pack" button (`kToast('Export started — calibration-audit-pack.pdf')`
— dead in the prototype); the KPI strip's "Due < 30 days"/"Overdue" tiles imply the underlying due/overdue
state must actually notify someone, per P16's own feature-scope line ("Due-soon / overdue emphasis").

UC
- Happy (job): each active instrument that has crossed the 30-day warn window or gone overdue notifies its
  `owner` once per threshold (never re-sent on the next day's sweep), exactly like `document-expiry`'s
  existing dedupe-by-threshold behaviour.
- Happy (export): "Audit pack" → real export enqueued via the existing `reports.export`/`run-export.ts`
  pipeline (same UX as `audit_report`/`risk_board_pack`): progress toast → notification → download.

AC
1. New daily per-tenant job `calibration-due` (mirrors `document-expiry`'s exact shape: `packages/core/src/
   calibration.ts` exports the same kind of `activeCalibrationThreshold(nextDue, now): 30|7|0|null` helper —
   **thresholds 30/7/0 days** (0 = "now overdue", fired once on crossing), unit-tested; the job queries active
   instruments whose `next_due` has entered a reminder window, notifies `owner` (skip if null, mirrors
   `document-expiry`'s own "no one to remind" skip), `dedupeKey: "cal-due:<instrumentId>:<threshold>"`,
   `entityKind: "instrument"`. Registered on the existing `docs` queue's daily sweep (or an equally-shaped new
   `calibration` queue — an implementation-time choice, not a design difference; either way it runs once daily
   per active tenant, same cron cadence as the existing sweep).
2. `ExportResource` gains `"calibration_audit_pack"`; `run-export.ts` gains a branch rendering the register
   (KPI strip + full instrument table + each instrument's last calibration date/result) to PDF, scoped to the
   caller's tenant (and plant scope, if plant-scoped).
3. `calibration:view` required to request the export (mirrors `risk_board_pack`'s "viewing is enough to
   export" precedent, not the stricter `:manage`).

**Web/Mobile/Shared:** Shared (job + export resource + `run-export.ts` branch) + Web (wire the button).

### C6 — Add instrument via a dedicated create form

**Design:** `qms-modules.jsx:202` "Add instrument" button (`kToast('New instrument form opened — enter asset
tag to begin')` — dead in the prototype).

UC
- Happy: "Add instrument" opens a form (name, type, plant, area, method, tolerance, interval-months, owner) →
  creates a real instrument with `last_calibrated = NULL`/`next_due = NULL` (a brand-new instrument has never
  been calibrated yet — `instrumentDueStatus` returns `unscheduled`, not a fabricated "ok"), navigates to the
  new instrument's detail card.
- **Not** the shared CreateWizard (**design decision, logged, not gated**): the wizard's 4-step Type/Details/
  Assignees/Review shape doesn't fit an 8-field single-entity form with a plant→area cascade the wizard's
  generic Details step doesn't support, and — unlike risk (Sprint 04 R4), which *was* folded into the wizard —
  an instrument's fields don't reduce to the wizard's flat-field model without inventing a plant/area
  cascading-select primitive the wizard doesn't have. This mirrors the same reasoning Q1 already accepted for
  CAPA's own dialog and Sprint 04 M2's own MSA-study wizard: smallest-reasonable-choice, a small dedicated
  form, not a wizard extension.

AC
1. `POST /v1/instruments` (C1 AC3) — no new route, this story just wires the form to the already-specified
   create route.
2. Created instrument gets a real `CAL-YYYY-NNNN` code (C1 AC1), sequence-generated via `codes.ts` + `counters`.
3. `status` defaults to `active`; `last_calibrated`/`next_due` are `NULL` until the first C2 event.

**Web/Mobile/Shared:** Web only (`apps/web/src/features/calibration/` — a small dedicated form, no jsx
precedent, flagged §5). Mobile: unaffected. Shared: none beyond C1.

### T1 — Competency catalog + training-record history + the matrix

**Design:** `TrainingMatrix` full component (`qms-modules.jsx:30-170`) — KPI strip, competency matrix
(members × competencies, sticky first column, Legend), "Expiring & overdue" list.

UC
- Happy: open `/training` → KPI strip (real counts), competency matrix (members rows × competency columns,
  cell states **Certified (green ok) / Expiring (amber warn) / Overdue-or-gap (red fail) / N-A (gray —)**,
  filter by name/role, segmented All/Mandatory-only/Gaps), clicking a cell shows that member's history for
  that competency.
- Cell-state derivation (**the one real design decision this sprint's §3 needs sign-off on**, resolving P17's
  own open question about mandatory-gap semantics): for each (member, competency) pair —
  - no training record **and** `competency.mandatory = true` → **gap** (red — a required certification never
    taken is exactly the "mandatory-gap highlighting" P17's own feature-scope line names);
  - no training record **and** `competency.mandatory = false` → **N/A** (gray — never assigned, not required);
  - a record exists and `expires_at < today` → **overdue** (red);
  - a record exists and `expires_at` is within the warn window (**30 days**, matching the KPI tile) →
    **expiring** (amber);
  - a record exists and `expires_at` is null or beyond the warn window → **ok** (green).
  This is a correction, flagged and reasoned in §3.1, of an apparent inconsistency in the jsx's own fixture
  data (one mock row shows a mandatory competency as "—" for one member) — treated as mock-data coincidence,
  the same class of correction Sprint 04 made repeatedly (residual-score judgment call, KPI bands, verdict
  color).
- Empty: a brand-new tenant with no competency catalog seeded yet → matrix shows "No competencies defined —
  add one" (never the jsx's 9-column mock), and zero members → "No members tracked yet."
- Permission: `training:view` required for the page; role-without curated identically to risk/msa (§4).
- Plant scope: the matrix's member rows are filtered by the caller's plant scope exactly like `GET
  /v1/members` already does (§1a) — no new plant-scoping mechanism.

AC
1. Migration `0068_training.sql`: `competencies` — `tenant_id`, `id`, `code` text NOT NULL (a short
   tenant-chosen slug, e.g. `iatf`/`fmea`/`msa` — **not** a `counters`-sequenced code; a competency catalog
   entry is authored once by an admin, not incident-sequenced like an NCR, so this mirrors how `inspection_
   templates`/`sla_configs` already use a plain author-supplied identifier, not `codes.ts`), `name` text NOT
   NULL, `mandatory` bool NOT NULL DEFAULT false, `valid_months` int NULL (NULL = never expires — some
   competencies, like a one-time awareness course, may have no renewal cadence; the jsx's own catalog always
   sets one, but the column must allow none for a competency type the jsx doesn't happen to show), `seq` int
   (matrix column order), `lock_version`, standard audit columns. Forced RLS, unique `(tenant_id, code)`.
   `training_records` — `tenant_id`, `id`, `member_id` (composite FK → `memberships(tenant_id, user_id)`),
   `competency_id` (composite FK → `competencies(tenant_id, id)`), `completed_at` date NOT NULL, `expires_at`
   date **GENERATED ALWAYS AS (CASE WHEN valid_months IS NULL THEN NULL ELSE completed_at + (valid_months ||
   ' months')::interval END) STORED** — **[flagged §3.1 for sign-off]** this requires `valid_months` to be
   denormalized onto `training_records` at insert time (copied from the competency, not looked up live), since
   a generated column cannot reference another table; the copy is intentional (a later change to the catalog's
   `valid_months` must not retroactively reinterpret a past completion's expiry — the record captures the
   rule that was in effect when it was recorded, which is the correct historical behaviour, not a shortcut),
   `evidence_file_id` (nullable FK → `files(id)`), standard audit columns. Forced RLS, leading `tenant_id`
   index, **no** unique `(tenant_id, member_id, competency_id)` constraint — **[deviation from P16's own draft,
   flagged §3.1 for sign-off]**: this sprint proposes a real per-completion history table (one row per
   recorded training event, newest = current), not P17's own draft "unique latest row, history in
   `audit_events`" — because the FE spec's own "member drawer (records + evidence)" needs multiple historical
   rows with their own evidence files, which generic `audit_events` diffs cannot reconstruct (they hold
   before/after field diffs, not a structured evidence-file reference per past event); this also matches
   `calibration_events`' own precedent in this same sprint (a real history table, not a single mutable row).
2. `packages/core/competency.ts` (pure): `competencyCellState(record: {expiresAt: Date|null} | null,
   mandatory: boolean, now: Date): "ok"|"warn"|"overdue"|"gap"|"na"` implementing the exact rule above —
   unit-tested for all five outcomes plus the warn-window boundary.
3. `GET /v1/competencies` (cursor, rule 6; `competency:view`... **[correction — see X1 AC1, capability is
   `training:view`/`training:manage`, not a separate `competency:*` pair]**), `POST /v1/competencies`
   (`training:manage`), `GET/PATCH /v1/competencies/:id` (`lockVersion`).
4. `GET /v1/training/matrix` (cursor over **members**, not competencies — a tenant's competency count is small
   and bounded, members are the potentially-large axis; filters `mandatoryOnly`/`gapsOnly`/`search`) — computes
   each cell live via a `DISTINCT ON (member_id, competency_id) … ORDER BY completed_at DESC` join per member
   page, applying AC2's pure function per cell; plant-scoped identically to `GET /v1/members`.
5. Cross-tenant / cross-plant competency or member id → 404, not 403 (rule 8).
6. **Catalog seeding (resolves P17's own "seeded per-tenant or global template?" open question):** the catalog
   is **tenant-owned** (each tenant's admin authors their own `competencies` rows; RLS-scoped like every other
   tenant table) — `provision-tenant` seeds the jsx's own 9 example rows (`COMPETENCIES`, `qms-modules.jsx:8-
   18`) as **starting defaults** a tenant can edit/delete/add to, exactly like the demo-seed pattern other
   catalogs (inspection templates, SLA configs) already use. No cross-tenant shared/global template table is
   built (that would be new multi-tenant-shared-catalog infrastructure with no spec anywhere).
7. KPI strip, exact formulas: **Members tracked** = `count(distinct member_id)` visible to the caller (plant-
   scoped); **Coverage** = `100 × (count of (member, mandatory-competency) pairs in state 'ok'+'warn') /
   count of all (member, mandatory-competency) pairs` (the jsx's "of mandatory certs" label, read literally —
   only mandatory competencies count toward the denominator; a "warn"/expiring-but-not-yet-lapsed cert still
   counts as covered, only `overdue`/`gap` do not); **Expiring < 30 days** = `count(*) where cell state =
   'warn'` across all (member, competency) pairs, not mandatory-only (the jsx's own KPI card carries no
   "mandatory" qualifier, unlike Coverage's); **Overdue** = `count(*) where cell state in ('overdue','gap')`
   (blocking, matches the jsx's "blocked from sign-off" sub-label — see Q-C1/§7 for why the *blocking* itself
   is not enforced elsewhere this sprint; the **count** is real, the cross-module enforcement is not).

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/training/` — `TrainingMatrixPage` (KPI strip, matrix grid w/ sticky column +
  Legend + search + segmented filter, member drawer on cell/row click), empty/loading/error/permission/offline
  states.
- **Mobile:** not built — no `m-*.jsx` design (confirmed §1a); `pnpm --filter @kaenal/mobile typecheck` stays
  green on the additive shared-type changes only.
- **Shared:** migration `0068` (`competencies`, `training_records`); `CompetencyDto`/`TrainingRecordDto`/
  `TrainingMatrixQuery`/`CreateCompetencyBody`/`CreateTrainingRecordBody` in `packages/types`;
  `packages/core/competency.ts` (pure, unit-tested); `training:view`/`training:manage` in
  `packages/core/src/rbac.ts`.

### T2 — Record training (assign + complete) + evidence

**Design:** `qms-modules.jsx:39` "Assign training" button (`kToast('Training assignment drafted — pick
employees & course')`); `qms-modules.jsx:140` per-row "Schedule" button on the Expiring & overdue list
(`kToast('Refresher scheduled…')`) — both dead in the prototype.

UC
- Happy: "Assign training" opens the **same** record-training dialog (pick member(s) + competency + completion
  date + evidence) the jsx's own toast text describes ("pick employees & course") — **[resolved interpretation,
  flagged for sign-off §3.1]** this sprint does not build a separate "assigned, not yet completed" pending
  state (no jsx cell shows a fifth visual state for it); "Assign training" and completing it are the same
  action — a manager who wants to *track* an upcoming requirement without a completion date yet is not
  supported this sprint (see §7 Q-T2).
- "Schedule" (on an expiring/overdue row): opens the same dialog pre-filled with that member+competency, for
  recording the refresher.
- Permission: `training:manage` to record; `training:view` to read.

AC
1. `POST /v1/training/records` (`training:manage`) — body `{ memberId, competencyId, completedAt,
   evidenceFileId? }`, creates one new history row (T1 AC1); supports batch-creation for multiple `memberId`s
   in one call (matches "Assign training" picking several employees at once) — each member gets its own row,
   one audit event each (not batched into one, since these are genuinely independent facts about different
   people, unlike MSA's single-study measurement batch).
2. Evidence attach reuses the existing Files presign→complete flow, `entityKind: "training_record"` (§1a — no
   schema change to `files`), AV-gated on download.
3. Cross-tenant/cross-plant member or competency id → 404 (rule 8).

**Web/Mobile/Shared:** Web (Record-training dialog, no jsx precedent for the dialog itself, flagged §5).
Mobile: unaffected. Shared: none beyond T1.

### T3 — Gaps/expiring view + skill-gap report export

**Design:** `qms-modules.jsx:120-145` "Expiring & overdue" card; `qms-modules.jsx:38` "Skill gap report"
button (`kToast('Export started — skill-gap-report.pdf')` — dead in the prototype).

UC
- Happy: the "Expiring & overdue" card lists real gap/overdue/expiring rows (member, competency, days-left or
  "BLOCKED"), sourced from the same `GET /v1/training/gaps` the matrix's Gaps filter uses — not a separately
  hard-coded top-5 like the jsx's fixed mock list.
- Happy (export): "Skill gap report" → real export (existing pipeline), rendering every mandatory gap +
  every expiring-within-30-days record, tenant/plant-scoped to the caller.

AC
1. `GET /v1/training/gaps` (cursor, rule 6; `training:view`) — returns every (member, competency) pair in
   state `gap`, `overdue`, or `warn`, sorted worst-first (`gap`/`overdue` before `warn`, then soonest-expiring
   first) — this is the same query T1 AC4's matrix uses with the equivalent filter, exposed as its own route
   because the "Expiring & overdue" card and the export both need it without paginating the full matrix.
2. `ExportResource` gains `"skill_gap_report"`; `run-export.ts` gains a branch rendering AC1's full result set
   to PDF.
3. `training:view` required to request the export (mirrors `risk_board_pack`, not the stricter `:manage`).

**Web/Mobile/Shared:** Shared (route + export resource + `run-export.ts` branch) + Web (wire both).

### T4 — Training expiry notifications

**Design:** implied by P17's feature scope ("Expiry-driven warnings") and the KPI/gap-list's own real-time
framing — no dedicated jsx button, this is the job side of T1/T3's read surfaces.

UC
- Happy (job): each `warn`/`overdue`/`gap` cell (T1 AC2) notifies the affected **member** once per threshold
  (30/7/0 days before/at expiry for a record that has one; a `gap` — never trained on a mandatory competency —
  notifies once, re-notified only if the gap persists past a fixed re-notify window, mirroring the "escalating
  reminder that doesn't spam" shape `document-expiry` already establishes).

AC
1. New daily per-tenant job `training-expiry` (same shape as `calibration-due`, C5 AC1): iterates each
   tenant's `(member, mandatory-or-recorded competency)` pairs, computes state via `competencyCellState`
   (T1 AC2), notifies the member (not just an "owner" — training is about the individual), `dedupeKey:
   "training-expiry:<memberId>:<competencyId>:<threshold>"`, `entityKind: "training_record"` when a record
   exists, else a `entityKind: "competency"` reference for a pure `gap` notification (no record to point at).

**Web/Mobile/Shared:** Shared only (job + notification wiring); no new web surface beyond T1/T3 reading the
same underlying state.

### X1 — Cross-cutting: nav retirement, capability wiring, placeholder ledger

UC
- `/calibration` and `/training` resolve to the real modules for `admin`/`manager`/`auditor`. `inspector` and
  `viewer` hold `calibration:view`/`training:view` (AC1's grant matrix) — a direct deep-link from either role
  does **not** 403 at the API; what blocks them is the same client-side web route guard (`roleSeesNavRoot`)
  Sprint 04's X1 already established for `risk`/`msa` — a UI-curation gate, not a security boundary. `partner`
  holds neither capability, so a partner deep-link **does** 403 server-side.

AC
1. `packages/core/src/rbac.ts` gains `calibration:view`, `calibration:manage`, `training:view`,
   `training:manage`. Grant matrix (mirrors `risk`/`msa`'s exact distribution, §2 X1 AC1 of Sprint 04, for the
   same reasoning): **admin** all four; **manager** all four; **auditor** all four (elevated QMS role, same
   precedent); **inspector** `calibration:view`, `training:view` only; **viewer** `calibration:view`,
   `training:view` only; **partner** neither.
2. `apps/web/src/config/rbac.ts` `ROLE_NAV`: `calibration` and `training` added to auditor's explicit `Set`
   (admin/manager already cover both structurally) — same reasoning Sprint 04 used to add `risk`/`msa` there.
3. `InstrumentsController`/`CalibrationEventsController`/`CompetenciesController`/`TrainingController` routes
   carry `@RequireCapability` per §4's table.
4. Placeholder ledger entries `"planned:calibration"`/`"planned:training"` removed from `PLACEHOLDER_LEDGER`,
   and `calibration`/`training` removed from `PLANNED_MODULES`.

**Web/Mobile/Shared:** Web + Shared (capability + nav config). Mobile unaffected.

---

## 3. Backend design — PROPOSED, NEEDS EXPLICIT USER SIGN-OFF (P16 + P17)

*(This is the section to extract and present alone for approval, per ROADMAP §0 Q2. NO code for either module
is written until this is approved.)*

### 3.1 The real design decisions in this sprint, each resolving a phase doc's own open question

1. **Calibration warn window = 30 days** (resolves P16 §5's "warn-window days" question) — matches the jsx's
   own "Due < 30 days" KPI label exactly; not a number this sprint invented.
2. **Instrument `plant_id` (required) / `area_id` (optional), reusing the real `plants`/`areas` tables**, not
   a free-text "area" string — the jsx's display string is a UI concatenation of two real fields the codebase
   already models structurally (§1a); this also makes plant-scoped visibility (item 3) possible without a new
   mechanism.
3. **Instruments and the training matrix are plant-scoped for plant-scoped roles**, reusing the existing
   `authorizePlant`/`members.service.ts` pattern verbatim — no new isolation mechanism.
4. **External-lab vendor tracking** (P16 §5's other open question) — resolved as: `method` stays free text
   (e.g. "External — A2LA"); no structured vendor/accreditation-body table is proposed (no spec names one, and
   the jsx never filters or reports by vendor identity, only displays the string).
5. **Calibration due/overdue does NOT block Inspections sign-off this sprint** (resolves P16 §5's third open
   question, and closes Q-C1 from §1a) — no jsx for the Inspections module shows an instrument-picker or a
   sign-off gate, and building one would be new scope on a module this sprint does not own. The calibration
   module's own overdue banner text is corrected from the jsx's literal claim to an accurate one: *"Out of
   calibration — overdue N days. Review any inspections that may have used this instrument since it was last
   in calibration."* (a call to action, not a claim of an enforced block that doesn't exist). Named as a
   follow-up (§7 Q-C1) for a future sprint that would add an `instrument_id` field to Inspections and a real
   sign-off gate — exactly the same treatment Sprint 04 gave MSA's `instrument_id`-to-calibration FK (its own
   named Q22 follow-up, now itself informed by this sprint actually shipping `instruments`).
6. **Training catalog is tenant-owned, seeded with the jsx's 9 example competencies as editable defaults**
   (resolves P17 §5's "seeded per-tenant or global template?" question) — no shared/global cross-tenant
   catalog table is proposed.
7. **Mandatory-gap cell rule** (resolves P17 §5's "mandatory-gap" ambiguity and corrects an apparent
   inconsistency in the jsx's own mock data, §2 T1): no record + mandatory → **gap** (red); no record +
   optional → **N/A** (gray); this is the literal, honest reading of the single `mandatory` boolean the schema
   carries — **no per-role required-competency mapping is built** (P17 §5's "link competencies to role
   requirements" question is left open, §7 Q-T3, since no spec defines what a role even requires per
   competency).
8. **`training_records` is a real per-completion history table**, not P17's own draft "unique latest row, +
   `audit_events` for history" — reasoning in §2 T1 AC1. This is the one genuine schema deviation from the
   phase doc's own draft, and is flagged here for explicit approval the same way Sprint 04 flagged `gauge_
   label` as text-not-FK.
9. **Certificate/evidence attachment reuses the existing Files pipeline unchanged** (`entity_kind` is
   free-text, §1a) — no new upload mechanism, no new `files` schema.
10. **Training does NOT block NCR/other actions this sprint** — same reasoning and disposition as item 5;
    the KPI/gap counts (T1 AC7, "BLOCKED" sub-label) are real numbers, the enforcement itself is not built.
11. **The "Linked e-learning" vendor panel (Cornerstone/SAP SuccessFactors/Litmos/Custom SCORM) is EXCLUDED
    this sprint** (§1a Q-T1) — no vendor decision, no credentials, no spec; the existing `integrations` table's
    provider whitelist has no LMS entry. **Proposed:** the panel is simply not built (omitted from the page,
    not shown with a fake "Connected"/"Available" state per rule 10) — this is the one designed panel this
    sprint does not reproduce, named here for explicit approval rather than silently dropped (mirrors how
    Sprint 04 named the MSA "Nested"/"Attribute (kappa)" methods as an honest, flagged exclusion rather than a
    silent one). If the user wants a placeholder acknowledging the gap instead of an omission, that is a
    one-line change at build time, but this sprint proposes omission as the cleaner, more honest default.
12. **Code formats corrected to the established pattern**: `CAL-YYYY-NNNN` for instruments (via `codes.ts`/
    `counters`, mirrors Sprint 04's `RISK-YYYY-NNNN`/`MSA-YYYY-NNNN` correction of the jsx's `CAL-001`/`R-NNN`
    mocks); competency `code` stays a plain author-chosen slug (not sequence-generated — item 6's reasoning).

### 3.2 Schema recap (full detail already in §2's ACs; not repeated verbatim here)

- `instruments` (C1 AC1), `calibration_events` (C2 AC1) — migration `0067_calibration.sql`. Plus, in the same
  migration: `ncrs.source` CHECK widened to add `"calibration"` (C3 AC1), `NcrSource` enum gains it.
- `competencies`, `training_records` (T1 AC1) — migration `0068_training.sql`.
- `export_jobs.resource` CHECK widened to add `"calibration_audit_pack"`/`"skill_gap_report"` — migration
  `0069_calibration_training_exports.sql` (mirrors Sprint 04's combined `0066_risk_msa_exports.sql` pattern).
- Migration `0070` held as buffer for a build-time correction (mirrors Sprint 04's own buffer practice);
  Sprint 06 takes `0071` onward.

**What the user is being asked to approve:** all 12 decisions in §3.1 above (the 30-day warn window; the
plant/area FK design; plant-scoping reuse; free-text vendor/method tracking; the deliberate non-enforcement of
calibration/training gates elsewhere in the product, with the corrected banner text; the tenant-owned seeded
catalog; the mandatory-gap cell rule; the per-completion history table for training; the Files-pipeline reuse
for evidence; the exclusion of the LMS vendor panel; and the `CAL-YYYY-NNNN` code correction) — together with
the full schemas in §2's ACs, which will be built exactly as specified, never adjusted for cosmetic effect.

---

## 4. Backend needs

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| C1 | `0067_calibration.sql` (`instruments`) | `GET/POST /v1/instruments`, `GET/PATCH /v1/instruments/:id` | `InstrumentsService` + `packages/core/calibration.ts` (pure) | `created`/`updated`, in-tx | `calibration:view` / `calibration:manage` | forced RLS; plant-scope filter; cross-tenant/plant id → 404 |
| C2 | `0067` also (`calibration_events`) | `POST/GET /v1/instruments/:id/calibration-events` | `InstrumentsService.recordCalibration` | `updated` (parent instrument advance), in-tx | `calibration:manage` (write) / `calibration:view` (read) | forced RLS, cascades with parent |
| C3 | `0067` also (`ncrs.source` CHECK widened; `NcrSource` gains `calibration`) | `POST /v1/instruments/:instrumentId/calibration-events/:eventId/raise-ncr` | `InstrumentsService.raiseNcr` (mirrors `audits.service.ts:raiseNcr`) + `NcrsService.create` | `created` (new NCR), in-tx | `calibration:manage` + `ncr:create` | forced RLS; cross-tenant id → 404; one-time-link guard |
| C4 | none | `PATCH /v1/instruments/:id/retire`, `PATCH /v1/instruments/:id` (transfer = existing edit route) | `InstrumentsService.retire` | `status_changed` (retire) / `updated` (transfer) | `calibration:manage` | forced RLS |
| C5 | none (job + `export_jobs.resource` widened in `0069`) | `ExportResource` gains `"calibration_audit_pack"` | `run-export.ts` new branch; new `calibration-due` job processor | existing export-created event; notifications write no audit event (mirrors `document-expiry`) | `calibration:view` (export) | scoped to caller's tenant/plant before enqueue |
| C6 | none | reuses C1's `POST /v1/instruments` | `InstrumentsService.create` (shared with C1) | `created` | `calibration:manage` | forced RLS |
| T1 | `0068_training.sql` (`competencies`, `training_records`) | `GET/POST /v1/competencies`, `GET/PATCH /v1/competencies/:id`, `GET /v1/training/matrix` | `CompetenciesService`, `TrainingService` + `packages/core/competency.ts` (pure) | `created`/`updated`, in-tx | `training:view` / `training:manage` | forced RLS; plant-scope filter on matrix members; cross-tenant/plant id → 404 |
| T2 | none | `POST /v1/training/records` | `TrainingService.recordTraining` | `created` per member row, in-tx | `training:manage` (write) / `training:view` (read) | forced RLS |
| T3 | none (`export_jobs.resource` widened in `0069`) | `GET /v1/training/gaps`; `ExportResource` gains `"skill_gap_report"` | `TrainingService.gaps`; `run-export.ts` new branch | read-only / existing export-created event | `training:view` | RLS + plant-scoped |
| T4 | none | none (job only) | new `training-expiry` job processor | notifications write no audit event (mirrors `document-expiry`) | n/a | scoped per tenant |
| X1 | none | `@RequireCapability` on all four new controllers | none | none | `calibration:view`/`calibration:manage`/`training:view`/`training:manage` added to `packages/core/src/rbac.ts` per §2 X1 AC1; `calibration`/`training` added to auditor's web `ROLE_NAV` `Set` | n/a |

Every mutation runs inside `withAudit` in the same transaction (rule 3); both list/matrix endpoints are
cursor-paginated (rule 6); all new Zod schemas live in `packages/types` (rule 4); calibration and competency
status-derivation math are `packages/core` pure functions (rule 5), never computed in a controller or a React
component. **Reserved migration range for this sprint: `0067`-`0070`** (0067 instruments + calibration_events
+ NcrSource widening, 0068 competencies + training_records, 0069 export-resource widening, 0070 held as
buffer — Sprint 06 takes `0071` onward).

## 5. Design needs

**Existing binding jsx — designer audits these against the built screens, does not redraw them:**
- `CalibrationManagement` (KPI strip, register table, detail card w/ overdue banner and history) —
  `qms-modules.jsx` lines 176-319.
- `TrainingMatrix` (KPI strip, competency matrix w/ Legend, Expiring & overdue card) — `qms-modules.jsx`
  lines 1-174, **minus** the "Linked e-learning" card (§3.1 item 11, excluded this sprint).

**NO existing jsx — designer must draw these, in the existing visual language, before Gate 1:**
1. **Record-calibration dialog** (C2) — result/performed-by/notes/certificate-upload form; no jsx shows any
   data-entry surface for calibration, only pre-computed display.
2. **Add-instrument form** (C6) — name/type/plant/area(cascading)/method/tolerance/interval/owner fields.
3. **Instrument "⋯" menu** (C4) — three real actions (View full history / Retire / Transfer), plus a confirm
   step for Retire (a real, if reversible-by-future-story, lifecycle change).
4. **Record-training dialog** (T2) — member picker (multi-select for "Assign training"), competency picker,
   completion date, evidence upload.
5. **Training matrix cell/member drawer** (T1) — the jsx never shows a click-through state for a matrix cell
   or a member's own history list; needs a design pass in the existing detail-drawer visual language.
6. **Calibration/training empty states** (C1/T1) — zero-instrument and zero-competency states, consistent with
   Sprint 02/03/04's own empty-state precedent.
7. **Corrected overdue-banner copy** (§3.1 item 5) — same visual treatment as the jsx's banner, new text; a
   one-line copy edit for the designer to carry into the board.

## 6. Dead-end audit

| Control | Current state | This sprint |
|---|---|---|
| Sidebar "Calibration" (`/calibration`) | `PLANNED_MODULES["calibration"]` placeholder | Real register + detail (C1) |
| Sidebar "Training & competency" (`/training`) | `PLANNED_MODULES["training"]` placeholder | Real matrix (T1) |
| `CalibrationManagement` "Add instrument" button | `kToast` only | Real create form (C6) |
| `CalibrationManagement` "Audit pack" button | `kToast` only | Real export (C5) |
| `CalibrationManagement` "Record calibration" button | `kToast` only | Real dialog + event (C2) |
| `CalibrationManagement` "Upload cert" button | `kToast` only | Real Files-pipeline upload (C2) |
| `CalibrationManagement` "⋯" menu | `kToast` only | Real View history / Retire / Transfer (C4) |
| `CalibrationManagement` out-of-tol KPI's implied "N led to NCR" | No button anywhere; an un-backed number | Real "Raise NCR" action + real count (C3) |
| `TrainingMatrix` "Assign training" button | `kToast` only | Real record-training dialog (T2) |
| `TrainingMatrix` "Skill gap report" button | `kToast` only | Real export (T3) |
| `TrainingMatrix` "Schedule" button (Expiring & overdue row) | `kToast` only | Real pre-filled record-training dialog (T2) |
| `TrainingMatrix` "Connect" buttons (Litmos, Custom SCORM) | `kToast` only, fake "Connected" badges on the other two | **NOT built** — panel excluded this sprint (§3.1 item 11), named not faked |

No new "coming soon" text, no new dead button beyond the one named exclusion (the LMS panel), which is omitted
entirely rather than left selectable-but-broken — CLAUDE.md rule 10 is "never stub," not "never say no,"
exactly Sprint 04's own closing note for its one exclusion (Nested/Attribute-kappa MSA).

## 7. Out of scope / open questions

- **Q-C1 (new).** Calibration's "auto-block measurement use" / "blocked at inspection sign-off" claim (the
  jsx's own banner text) is not enforced anywhere this sprint — no Inspections jsx shows an instrument field
  or a sign-off gate. The banner text is corrected (§3.1 item 5) rather than reproduced as a false claim.
  Wiring a real block (an `instrument_id` field on inspections + a sign-off-time check) is a named future
  story on the Inspections module, not started or silently dropped here.
- **Q-C2 (new).** No "un-retire" action is built for `instruments` (C4) — the mock names no such control. A
  future story can add a symmetric `retired → active` transition if wanted.
- **Q-T1 (new).** The "Linked e-learning" vendor panel (Cornerstone/SAP SuccessFactors/Litmos/Custom SCORM) is
  excluded this sprint (§3.1 item 11) — no vendor decision, no credentials, no spec, same class of deferral as
  ROADMAP Q5's SSO/SCIM/BYOK. Revisit at a future wave once a vendor is chosen.
- **Q-T2 (new).** "Assign training" and "record a completion" are the same action this sprint (§2 T2) — there
  is no "assigned, not yet completed, tracked as upcoming" pending state, since no jsx cell shows a fifth
  visual state for it. If a real assignment-tracking workflow (distinct from a completion record) is wanted,
  it needs its own design pass and its own sign-off.
- **Q-T3 (new).** No per-role required-competency mapping is built (P17's own open question, §3.1 item 7) — a
  competency's `mandatory` flag applies tenant-wide, not per role/position. Auto-deriving "this role needs
  these certs" is a future story once a role-requirements model is designed.
- **Sprint 04's own follow-up, now informed by this sprint:** Sprint 04's Q22 named `msa_studies.gauge_label`
  as free text pending a real `instrument_id` FK once calibration ships. **This sprint does not add that FK
  or backfill** — it is explicitly deferred again, one sprint further, to a small follow-up story that adds
  `msa_studies.instrument_id` (composite FK → `instruments(tenant_id, id)`, nullable to preserve existing
  free-text-only studies) plus a best-effort backfill matching existing `gauge_label` strings to instrument
  names where they coincide. Reason for not folding it into this sprint: MSA is Sprint 04's own closed module
  and touching its schema here would reopen a sprint already Gate-2-accepted and merged (PR #34); a dedicated
  small follow-up keeps that boundary clean. **Not silently dropped** — logged here as the direct continuation
  of Q22, to be scheduled explicitly (a future mini-sprint or folded into Sprint 06's kickoff), not assumed.
- Mobile: confirmed no `m-*.jsx` designs either module (§1a); both stay fully unaffected this sprint (no
  route, no nav, `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes
  only).
- **Merge-conflict hot spots (ROADMAP §4):** this sprint touches `packages/types/src/contract.ts`,
  `packages/types/src/enums.ts` (`NcrSource`, `ExportResource`, new `InstrumentType`/`CalibrationResult`
  enums — no `EntityKind` change, since neither module becomes a linked-record kind), `planned-modules.ts`,
  `placeholder-ledger.ts`, and `apps/web/src/config/rbac.ts` — one owner, rebase before PR, per the standing
  rule. `navigation.ts` needs no structural change (both ids already exist, §1a). This sprint does not touch
  `entity-routes.ts`, `entity-ref.ts`, or `graph-kinds.ts` at all (neither module gains cross-links this
  sprint), so it does not intersect Sprint 04's own touch-points there.
- **Existing unpushed branches:** `git branch -a`/`git log --all` confirm **`feat/partner-invite-mfa`** and
  **`feat/webhook-config-form`** are **already merged** (both appear only as merge-commit messages into
  `integration/sprint-01-phase-a`, already on `main`'s history) — ROADMAP §4's mention of them as "still
  unpushed" is **stale**; no caution needed, this sprint does not intersect either area
  (`sections/integrations.tsx`, portal contacts) regardless.

## 8. Definition of Done

- [ ] **User has explicitly approved §3** (all 12 named decisions in §3.1, plus the full schemas in §2's ACs)
      — **NO BUILD STARTS BEFORE THIS.**
- [ ] Migrations `0067_calibration.sql`, `0068_training.sql`, `0069_calibration_training_exports.sql` applied;
      `pnpm db:check` green; `pnpm test:rls` green including all four new tables.
- [ ] `packages/core/calibration.ts` and `packages/core/competency.ts` unit-tested (status/cell-state
      derivation, all boundary days, all five training cell states).
- [ ] `packages/core/src/codes.ts` gains `"instrument"` → `CAL`, unit-tested; created instruments get real
      `CAL-YYYY-NNNN` codes via the `counters` table.
- [ ] Contract gains all routes in §4; `calibration:view`/`calibration:manage`/`training:view`/
      `training:manage` enforced via `@RequireCapability`; RBAC grant matrix matches §2 X1 AC1 exactly.
- [ ] Web `/calibration` fully real: KPI strip (real formulas, §2 C1 AC5), register table w/ search + segmented
      filter, detail card w/ corrected overdue banner + Record-calibration dialog + certificate upload +
      Raise-NCR action + "⋯" menu (history/retire/transfer), Add-instrument form, audit-pack export, all
      empty/error/offline/permission states — browser-verified side-by-side against `qms-modules.jsx`'s
      `CalibrationManagement` (minus the corrected banner text, named and reasoned in §3.1).
- [ ] Web `/training` fully real: KPI strip (real formulas, §2 T1 AC7), competency matrix w/ Legend + sticky
      column + search + segmented filter + member drawer, Expiring & overdue card sourced from the real gaps
      route, Record-training dialog (assign + schedule), skill-gap-report export, all empty/error/offline/
      permission states — browser-verified against `TrainingMatrix` (minus the excluded "Linked e-learning"
      card, named and reasoned in §3.1 item 11).
- [ ] An out-of-tolerance calibration event's "Raise NCR" action creates a real NCR with `source: "calibration"`
      and round-trips to it; a second raise attempt on the same event is rejected (409), browser-verified.
- [ ] `calibration-due` and `training-expiry` jobs fire real notifications at the 30/7/0-day thresholds,
      idempotent (dedupe key), tested against seeded fixtures.
- [ ] Placeholder ledger entries `"planned:calibration"`/`"planned:training"` removed; both removed from
      `PLANNED_MODULES`.
- [ ] Auditor's web nav includes `calibration`/`training`; browser-verified.
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded and proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` updated (Current status + Decisions log: the mandatory-gap cell rule, the training-history-
      table deviation from P17's draft, the plant/area FK design, the LMS-panel exclusion, the corrected
      overdue-banner copy, the `CAL-YYYY-NNNN` code format, the deferred MSA `instrument_id` follow-up) and
      `progress_mobile.md` gets an explicit "Sprint 05 — mobile unaffected" line (per Sprint 02/03/04's own
      DoD lesson, not silently skipped).

## 9. Out-of-scope confirmation

No scope beyond P16/P17 + FEATURES §12/§223/§224 + `qms-modules.jsx`'s `CalibrationManagement`/
`TrainingMatrix` components is introduced, with two named, reasoned exceptions this sprint does **not** build
(§3.1 items 5/10/11, §7 Q-C1/Q-T1): the cross-module Inspections/NCR enforcement the jsx's copy implies, and
the LMS vendor panel. `CustomerComplaints`/`ECNWorkbench` (the other two components in the same `qms-modules.
jsx` file) are Sprint 06's scope and are not touched here. No change to Sprints 01-04's own modules beyond the
standing, named cross-cutting config edits (nav/rbac/placeholder-ledger) every sprint in this programme makes.

---

**PO use-case sign-off: PENDING — awaiting the UI Lead Designer's audit (Gate 1) and, for the backend design in
§3, the user's explicit approval before any build work starts.**

Every use case (happy/error/empty/permission/offline/cross-tenant/plant-scope) across C1-C6, T1-T4, and X1 maps
to a story with testable acceptance criteria and an explicit Web/Mobile/Shared split; the dead-end audit (§6)
accounts for every control the jsx introduces, with the one honestly excluded panel (Q-T1, LMS vendors) named
rather than faked, and one previously-undetected gap closed (the calibration KPI's un-backed "N led to NCR"
number, now a real capability, C3). This file itself introduces no product code and spawns no other agent, per
this ceremony's instructions — the next steps are the `ui-lead-designer` audit and the user's §3 approval.
