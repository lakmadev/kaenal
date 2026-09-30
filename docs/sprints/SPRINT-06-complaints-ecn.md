# SPRINT-06 — Customer Complaints + Engineering Change Notices (ECN)

Author: Product Owner. Date: 2026-09-30. Part of the multi-sprint programme in `ROADMAP.md` (Wave 6 of 13).
Governing rules: CLAUDE.md rules 0, 1-8, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprints 01-05 (shell, audits, graph+predictive, risk+MSA, calibration+training) — all merged, not
touched here except the small, named, additive cross-cutting config edits every sprint in this programme makes
(ROADMAP §8 rule 2).

**This sprint carries an APPROVAL GATE (ROADMAP §0 Q2).** Both modules' backends are `PROPOSED` (P18, P19)
with no `02-DATABASE`/`03-API` spec beyond the phase docs' own sketches, and both phase docs name their own
open sign-off questions. This sprint file's §3 is the backend design the user must approve before any code is
written. **NO BUILD MAY START until the user has explicitly approved §3** — complaint schema + SLA design +
convert-to-NCR/8D/CAPA mechanism; ECN schema + the canonical stage/approval machine (which corrects two real
inconsistencies found between the jsx's own `ECNList` and `ECNKanban` mocks, detailed in §3.2); and the
document auto-revision mechanism. This mirrors exactly how Sprints 03/04/05 gated their own §3/§3B before
those sprints' builds started.

---

## 1. Goal and roles served

Replace the `/complaints` and `/ecn` `ModulePlaceholder`s (served today via `PLANNED_MODULES["complaints"]`/
`PLANNED_MODULES["ecn"]`, ledger entries `planned:complaints`/`planned:ecn`) with two real, backend-complete
quality-system modules:

- **Customer complaints** (IATF 16949 §9.1.2/§10.2.1, customer satisfaction & feedback): an OEM-facing
  intake record with severity/SLA tracking, and a real conversion path into NCR/8D/CAPA — everything
  `CustomerComplaints`/`IntakeForm` in `qms-modules.jsx` (lines 322-523, read in full) and FEATURES §12/P18
  specify.
- **Engineering Change Notices (ECN)** (IATF 16949 §8.5.6, change control): a design/process/tooling/material
  change record with a real multi-stage approval workflow (four-eyes, forward-only, audited) and a genuine
  "auto-revises affected documents" mechanism on implementation — everything `ECNWorkbench`/`ECNList`/
  `ECNKanban` in `qms-modules.jsx` (lines 526-635, read in full) and FEATURES §12/P19 specify.

Roles served: **admin, manager, auditor** (module administration: log/triage/convert complaints, author and
manage ECNs); **admin, manager only** additionally hold **ECN approval authority** (`ecn:approve` — mirrors
`document:approve`, which is also admin/manager-only, not auditor, confirmed by reading `packages/core/src/
rbac.ts` in full this session); **viewer** gets read-only visibility of both (broad-oversight precedent,
matches viewer's existing grant for every other module); **inspector does NOT get either module this sprint**
— unlike calibration/training (Sprint 05 B9), no jsx or phase doc makes an inspector an owner, approver, or
subject of a complaint or ECN, so the "a notification about you must not 404 for you" forcing function that
justified inspector's calibration/training access does not apply here; this is a deliberate, reasoned
decision, not an oversight (§7). No `m-*.jsx` design shows any complaints or ECN screen (§1a) — **mobile is
unaffected by this sprint**, proven by `pnpm --filter @kaenal/mobile typecheck` staying green on the additive
shared-type changes only.

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| No `complaints`, `ecns`, or `ecn_approvals` table exists anywhere; no `apps/api/src/complaints` or `apps/api/src/ecn` directory exists | `grep -rn "CREATE TABLE" packages/db/migrations/*.sql` — no match; `ls apps/api/src` — 33 existing feature dirs, no `complaints`/`ecn` |
| `implementation/phases/P18-complaints.md` and `P19-ecn.md` exist, both marked `Backend 🔴 PROPOSED · FE 🔴`, and both name their own open sign-off questions: P18 — "email/EDI auto-intake in scope now or manual-only first? SLA clock on complaints?"; P19 — "number/identity of approval stages (fixed vs configurable)? is document auto-revision in scope for v1 or link-only?" — this sprint's §3 resolves each explicitly | both files read in full this session |
| Next free migration number is **0071** — `0070_calibration_training_exports.sql` (Sprint 05) is the last file on disk; no file numbered 0071 exists despite Sprint 05's own text reserving it as a "buffer" (it was never actually created). ROADMAP §4's guess of "06: 0050-0052" is stale (written before Sprints 02-05 landed 0061-0070) | `ls packages/db/migrations \| sort \| tail` |
| **Composite-FK prereq check (explicitly performed, per this sprint's own instructions): NOT NEEDED.** This sprint's real cross-references (complaint → NCR/8D/CAPA) reuse the exact **plain-FK, loosely-typed "source" pattern** `audit_findings.ncr_id`/`audit_findings.capa_id` already establish (`uuid REFERENCES ncrs(id) ON DELETE RESTRICT`, `uuid REFERENCES capas(id) ON DELETE RESTRICT` — confirmed by reading `0001_core.sql` lines 333-334 and the whole `audit_findings` table definition) — a plain, non-composite FK to the target's bare `id`, relying on RLS (not a composite key) to keep it tenant-safe, exactly like `raiseNcr`/`raiseCapa` in `audits.service.ts` already do. **No new table this sprint needs to reference `ncrs`/`documents`/`capas`/`files` via a *composite* `(tenant_id, id)` FK** — the one place a composite FK genuinely is needed (`complaint_attachments.file_id` → `files(tenant_id, id)`) already has its prerequisite: `files` gained `UNIQUE (tenant_id, id)` in Sprint 05's `0067_composite_fk_prereqs.sql` (confirmed: `grep -n "files_tenant_id_uq" packages/db/migrations/0067*.sql` → present). `complaints`/`ecns` themselves get their own `UNIQUE (tenant_id, id)` in their own new migrations (self-consistency, same as every prior sprint's new parent tables) so `complaint_attachments`/`ecn_approvals` can composite-FK into them without a separate prereq step | `packages/db/migrations/0001_core.sql:242-260,333-341`; `packages/db/migrations/0067_composite_fk_prereqs.sql:33` |
| `NcrSource` (`packages/types/src/enums.ts:107-118`) **already includes `"complaint"`** (present since the original schema, `0001_core.sql`'s `ncrs.source` CHECK already allows `'complaint'`) — unlike Sprint 05's `calibration` addition, **no migration or enum widening is needed** for complaint→NCR conversion's `source` value | `packages/types/src/enums.ts:107-118`; `packages/db/migrations/0001_core.sql:199-200` (`ncrs.source` CHECK) |
| `apps/api/src/audits/audits.service.ts` `raiseNcr` (line 655) and `raiseCapa` (line 708) are the established, direct, twice-proven precedent for "convert a source record into a real NCR/CAPA": load the source, call the target module's own `.create()` with `source`/`sourceId` (NCR) or `sourceKind`/`sourceId` (CAPA), then one-time-link the source row back with a `WHERE <fk> IS NULL` guard preventing a double-raise. This sprint's complaint→NCR/8D/CAPA conversion reuses this exact mechanism (not a new one) — extended to a **third** target, 8D, since no prior sprint's "raise" flow has targeted `eight_ds` directly yet | both methods read in full this session |
| `apps/api/src/documents/documents.service.ts` `documentMachine` (`packages/core/src/state-machines/document.ts`, read in full) is a **single-stage** `draft → pending → approved|rejected` machine with a four-eyes guard (`forbidsSelfApproval`) restricting approval to `admin`/`manager` only (`requiresApproverRole`) — **this is NOT a multi-stage approval engine**, confirmed by reading the whole file: there is no concept of "stage" anywhere in it. ROADMAP §5's phrase "reusing the documents approval engine" is corrected here: this sprint reuses the **pattern** (`defineMachine`, a role-gated four-eyes guard, forward-only transitions, `status_changed` audit action) for ECN's own new, genuinely multi-stage machine — it does not, and cannot, reuse the single-stage `documentMachine` object itself, which has no stage dimension to extend | `packages/core/src/state-machines/document.ts` (full file, 79 lines) |
| `documents.service.ts`'s `newVersion` method (lines 358-409) is a real, working, callable mechanism: given an `approved` document, it opens a new draft version (`document_versions` insert + `documents.status/version` update), audited `updated`. **This is the real backend ECN's "auto-revises affected documents" reuses** — confirmed callable, not aspirational; its own guard (`row.status !== "approved"` → `INVALID_TRANSITION`) is a real constraint this sprint's auto-revise call must handle per-document (§3.2), not ignore | `apps/api/src/documents/documents.service.ts:358-409` |
| `EntityKind` (`packages/types/src/enums.ts:375-391`) has 11 members (`inspection, ncr, eight_d, audit, capa, document, supplier, scar, finding, risk, fmea`) — no `complaint`, no `ecn`, no `part` (there is **no `parts` table or `EntityKind` anywhere in this codebase**, confirmed by reading the full `ENTITY_TABLES` map in `entity-ref.ts` — P19's "affected parts" linking is therefore **not buildable** this sprint; only affected documents/suppliers are real, existing link targets) | `packages/types/src/enums.ts:375-391`; `apps/api/src/collab/entity-ref.ts:16-27` (full `ENTITY_TABLES` map) |
| `entity_links_from_kind_check`/`_to_kind_check` (widened again in `0064`) do not include `complaint` or `ecn` | `packages/db/migrations/0064_risk_register.sql:131-139` |
| Three **total** `Record<EntityKind, …>` maps that TypeScript will force to widen the moment `EntityKind` gains two members: `ENTITY_TABLES` (`entity-ref.ts`), `ENTITY_SPECS` (`chat.ts`), `GRAPH_KINDS` (`apps/web/src/features/graph/graph-kinds.ts`) — confirmed by reading all three in full. `apps/api/src/graph/graph.service.ts` keeps its own separate, literal `GRAPH_KINDS: readonly EntityKind[]` render array that Sprint 04 (R3/Q27) deliberately did **not** widen for `risk`/`fmea` either — this sprint makes the same judgment call for `complaint`/`ecn` (§7, mirrors Q27, not a new gap) | `apps/api/src/collab/entity-ref.ts`, `apps/api/src/ai/chat.ts:25-46`, `apps/web/src/features/graph/graph-kinds.ts` (all read in full) |
| `SearchEntityKind` (`packages/types/src/dto.ts:676`) still has only its original 5 members (`inspection, ncr, capa, document, audit`) — **Sprints 04 and 05 did not add `risk`/`msa`/`instrument`/`competency` to search**, confirmed by grep. This sprint makes its own judgment call (§3.1/§4) to add `complaint`/`ecn` (free-text subject/title search is a real, named use case for both — "search complaints/ECNs by keyword" — unlike the more numeric/tabular risk/MSA/calibration/training records), not a retroactive fix of the prior sprints' choice | `packages/types/src/dto.ts:676-677`; `apps/api/src/search/search.service.ts:19-24` (current `KINDS` map, full) |
| `RealtimeTopic` (`packages/types/src/realtime.ts:16-36`) and `ENTITY_TOPIC` (`apps/api/src/realtime/audit-signal.ts`) likewise were **not** widened by Sprints 04/05 for their own new modules (no `risk`/`msa`/`calibration`/`training` topic exists) — confirmed by grep. This sprint wires its own two new modules in (§4), since the audit-signal bridge is explicitly documented as "free" (any audited mutation gets a signal for no extra service code) and both new modules are genuinely multi-person, collaborative workflows (a second approver's screen should refresh when the first approves an ECN stage) — not a retroactive fix of Sprints 04/05's own choice | `packages/types/src/realtime.ts`; `apps/api/src/realtime/audit-signal.ts` (`ENTITY_TOPIC` map, full) |
| `apps/web/src/config/navigation.ts` already has real nav entries: `{ id: "complaints", label: "Customer complaints", href: "/complaints", icon: MessageSquare }`, `{ id: "ecn", label: "Engineering changes", href: "/ecn", icon: GitBranch }`; `planned-modules.ts` and `placeholder-ledger.ts` ("planned:complaints": 6, "planned:ecn": 6) already correctly point at this sprint | `apps/web/src/config/navigation.ts:162-163`; `planned-modules.ts:28-29`; `placeholder-ledger.ts:15-16` |
| `apps/web/src/config/rbac.ts` `ROLE_NAV`: admin = all, manager = all-minus-platform (both already cover `complaints`/`ecn` once built). Auditor's explicit `Set` does not include `complaints`/`ecn` (it does include `risk`/`msa`/`fmea`/`calibration`/`training` from Sprints 04/05) — this sprint adds both. Inspector's and viewer's `Set`s also don't include them yet; per this sprint's §1/role decision, **viewer** gains both, **inspector** gains neither | `apps/web/src/config/rbac.ts:32-68` (full file read this session) |
| No `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/`ecn:approve` capability exists in `packages/core/src/rbac.ts`. `document:approve` **does** exist and is granted to admin/manager only, not auditor (confirmed lines 140-142, 179) — the direct, real precedent this sprint's `ecn:approve` grant mirrors | `grep -n "complaint:\|ecn:" packages/core/src/rbac.ts` → 0 hits; `packages/core/src/rbac.ts:140-142,179` |
| No `m-*.jsx` mentions a complaints or ECN screen at all (0 hits for "complaint"/"ECN"/"change notice") | `grep -il "complaint\|ecn\b\|change notice" project_brain/mobile/src/m-*.jsx` → no matches |
| `qms-modules.jsx`'s `ECNList` and `ECNKanban` **disagree with each other and with P19's own status enum** — a real, provable mock inconsistency this sprint's §3.2 resolves with one canonical machine (not silently reproduced as two contradictory views): `ECNList` names 4 distinct labeled stages ("Risk review" step 3/6, "CAB approval" step 4/6, "Doc revision" step 5/6, "Pilot run" step 6/6) against a flat "of 6" counter; `ECNKanban` names 7 columns (draft, feasibility, risk-review, cab, pilot, impl, closed) with no "Doc revision" column and no "rejected" column at all despite the header text's own claim of a "multi-stage approval workflow" (which implies a reject path must exist somewhere); P19 §2 separately proposes a 5-value `status` enum (`draft\|under_review\|approved\|rejected\|implemented`) that matches neither jsx view | `qms-modules.jsx:549-633` read closely; `P19-ecn.md` §2 |
| `qms-modules.jsx`'s `ECNList` mock's `tp` (type) column uses **4** distinct values across its 5 rows — Design, Process, Process, Tooling, **Material** (`ECN-2026-0180`, a supplier-change ECN) — but P19 §2 proposes only 3 `change_type` values (`design\|process\|tooling`), omitting `material` entirely. P19 §5 itself separately lists "Relates to: P08 (supplier change — `linkedEcns`)" as a real dependency, confirming supplier/material-change ECNs are genuinely in scope, not a mock-only fixture coincidence | `qms-modules.jsx:558-562`; `P19-ecn.md` §2, §5 |
| `qms-modules.jsx`'s `CustomerComplaints` `IntakeForm` (the actual drawn create dialog, lines 477-523) captures **customer, severity, batch/serial, subject, detail, attachments** — it does **not** capture **contact** or **channel**, even though P18 §1 explicitly lists both as fields the intake flow must capture, and the list view's own columns display both (`c.contact`, `c.via`) for every row. A real, provable gap between what the drawn dialog collects and what the list/filters/P18 need it to have collected | `qms-modules.jsx:477-523` (full `IntakeForm`, no contact/channel field anywhere) vs `qms-modules.jsx:325-330` (`COMPLAINTS` fixture, both fields populated) and `P18-complaints.md` §1 |
| `qms-modules.jsx`'s `CustomerComplaints` "Intake channels" card (5 external channels: public web form, customer portal/EDI, email parser, phone, customer extranet API, all shown `Active` with volumes) and its "Public intake form" header button (`kToast` link-copy) are the **exact** subject of P18's own open sign-off question ("email/EDI auto-intake in scope now or manual-only first?") — none of the 5 channels has a real integration, parser, or public-facing unauthenticated endpoint anywhere in this codebase; ROADMAP's own instruction for this sprint ("portal intake channel ONLY if the jsx shows it as a real screen") is not met — the jsx shows a decorative status card and a link-copy button, not a working public screen | `qms-modules.jsx:349,422-443` read closely; confirmed no `apps/api/src/portal` route or `apps/web` page implements customer-facing complaint intake (`grep -rn "complaint" apps/api/src/portal` → 0 hits) |
| `qms-modules.jsx`'s complaint list rows carry `style={{ cursor: 'pointer' }}` with **no `onClick` handler anywhere** — a genuine dead affordance in the mock itself (rule 10 applies even to what the mock already got wrong): clicking a row does nothing. No complaint-detail board/drawer is drawn anywhere in the file | `qms-modules.jsx:383` (`<tr key={c.id} style={{ cursor: 'pointer' }}>`, no `onClick`) |
| `ECNWorkbench`'s "New ECN" button and `CustomerComplaints`'s row click each have no drawn create/detail dialog (ECN) or detail board (both) — unlike Sprint 04's risk (which got a CreateWizard extension) or Sprint 05's instrument (dedicated small form, `qms-modules.jsx:202`'s own kToast at least named the fields to ask for). Flagged in §5 for the UI Lead Designer, not invented here | `qms-modules.jsx:538` (New ECN, bare kToast, no field list at all, unlike the instrument precedent) |
| `packages/core/src/sla.ts`'s `computeDueAt`/`SlaConfigByPriority`/`BusinessHours` (business-hours-aware due-date math, used by NCR's respond/resolve SLA) and `packages/types`'s `SlaState` (`on_track\|at_risk\|breached`, confirmed generic — not an NCR-only type, `import type { ..., SlaState } from "@kaenal/types"` in `sla.ts` itself) are the established, direct, reusable precedent for complaint SLA tracking — this sprint reuses the type and the business-hours machinery, not a new mechanism (§3.1) | `packages/core/src/sla.ts` (full file read this session) |
| `packages/core/src/rbac.ts`'s own comment (Sprint 05's C1a note, carried over) states the established design norm this codebase already follows: "pure, unit-tested derivation functions in `packages/core`, never a stored 'status' column computed against `now()`" (`scoreBand`, `instrumentDueStatus`, `competencyCellState` are the cited precedents) — this sprint's `sla_state`/`ecnStageIndex` follow the same norm: computed on read, never stored, unlike `ncrs.sla_state`'s own pre-existing stored column (a different, earlier design choice this sprint does not disturb or imitate) | prior-sprint precedent, re-confirmed this session |

---

## 2. Stories

### C1 — Complaint register: schema, list, KPI strip, tabs

**Design:** `CustomerComplaints` (`qms-modules.jsx:332-475`) — KPI strip (5 tiles), 4 filter tabs, register
table, "Intake channels"/"SLA matrix" reference cards.

UC
- Happy: open `/complaints` → KPI strip (real counts/percentages, not the jsx's static 84/4/92%/18d/$4,280),
  4 tabs with real counts in their own labels (`All (N open)`, `Critical (N)`, `Not linked to NCR (N)`,
  `Mine (N)`), register table sorted by `received_at` desc, each row's customer chip colored deterministically
  from the customer name (never a user-picked color — P18 defines no `customers` master table, §3.1).
- Empty: tenant has zero complaints → KPI strip and tabs show `0`/`—` (never a fabricated percentage or a
  division-by-zero `NaN`), table shows "No complaints logged yet."
- Permission: `complaint:view` required for the page; a role without it never sees the nav entry (curated,
  §4) and a direct deep-link 403s server-side (partner) or is client-blocked (nothing else lacks the
  capability per §1/role decision — inspector holds neither `:view` nor `:manage` this sprint, so `/complaints`
  is both nav-hidden and server-403'd for inspector, unlike calibration/training's view-only inspector grant).
- Error/offline: list/summary fetch fails → retry affordance; offline banner disables Log complaint/
  Acknowledge/Convert/Close mutations (reuse S1-5 infrastructure).

AC
1. Migration `0071_complaints.sql`: `complaints` — `tenant_id`, `id`, `code` (`COM-YYYY-NNNN` via `codes.ts`'s
   `counters` mechanism; `CodeKind` gains `"complaint"` → prefix `COM`), `customer` text NOT NULL (free text —
   P18 §2 defines no customer master table; a customer is whatever string the loggist types), `customer_color`
   text NOT NULL, **server-computed, never user-chosen** — a new pure `packages/core/src/customer-color.ts`
   `customerColor(name: string): string` deterministically hashes `customer` to one of a fixed 10-color
   palette (the jsx's own 5 literal hex values — `#003c64`, `#1c1c1c`, `#cc0000`, `#0066b1`, `#0a8541` — plus 5
   more chosen for WCAG-AA contrast against white text, all as literal design tokens per `design-rules.md`'s
   per-entity-kind-color convention), so the same customer name always renders the same chip color without a
   customer table (unit-tested for determinism, not randomness), `contact` text NOT NULL (single free-text
   field, e.g. "Magnus Eriksson · Quality Manager" — matches the list's own display format exactly; **not**
   split into name/title columns, since nothing in the jsx or P18 shows them as separate fields — see §3.1 for
   why this field exists at all despite not being in the drawn `IntakeForm`), `channel` enum (`portal\|
   email_parsed\|web_form\|edi\|phone` — the jsx's own 5 `via` display values, exactly; see §3.1 for why this
   field is captured via a form field the drawn `IntakeForm` doesn't show), `severity` enum (`critical\|high\|
   medium\|low`), `status` enum (`triage\|investigation\|8d\|capa\|closed`) DEFAULT `triage`, `subject` text
   NOT NULL, `description` text NOT NULL DEFAULT `''` (the drawn "Detail" textarea), `batch_ref` text NULL
   (free text — the jsx's own `'multiple'` value for one row proves this isn't a single-batch identifier
   format), `received_at` timestamptz NOT NULL DEFAULT `now()`, `acknowledged_at` timestamptz NULL,
   `closed_at` timestamptz NULL, `cost_usd` numeric(12,2) NULL CHECK (`cost_usd IS NULL OR cost_usd >= 0`) —
   captured later via edit, never at intake (no cost field is drawn in `IntakeForm`, and real cost is rarely
   known at the moment a complaint is logged), `sla_target_hours` int NOT NULL, `sla_close_target_days` int NOT
   NULL — **both denormalized at creation from the severity's SLA-matrix config at that moment** (mirrors
   Sprint 05 T1 AC1's `training_records.valid_months` denormalization precedent exactly — a later change to the
   SLA matrix must never retroactively alter an existing complaint's own due dates), `owner` (composite member
   FK, NOT NULL, defaults to the creating actor), `ncr_id` uuid REFERENCES `ncrs(id)` ON DELETE RESTRICT NULL,
   `eight_d_id` uuid REFERENCES `eight_ds(id)` ON DELETE RESTRICT NULL, `capa_id` uuid REFERENCES `capas(id)`
   ON DELETE RESTRICT NULL — **plain FKs, the `audit_findings.ncr_id`/`capa_id` pattern, not composite** (§1a),
   `search_vector` generated tsvector over `subject`/`description`/`customer` (mirrors `0008_search_vectors.sql`
   exactly), `lock_version`, standard audit columns. Forced RLS, leading `tenant_id` index, unique
   `(tenant_id, code)`, `UNIQUE (tenant_id, id)` (self-consistency — target for `complaint_attachments`' composite
   FK, C2 AC1). Also in `0071`: `complaint_attachments` (`tenant_id`, `id`, `complaint_id` composite FK →
   `complaints(tenant_id, id)` ON DELETE CASCADE, `file_id` composite FK → `files(tenant_id, id)` ON DELETE
   RESTRICT — `files` already has this unique constraint from Sprint 05's `0067`, §1a — `created_by`,
   `created_at`). `EntityKind` gains `"complaint"`; `entity_links_from_kind_check`/`_to_kind_check` widened
   (mirrors `0064`'s pattern).
2. `GET /v1/complaints` (cursor, rule 6; filters `status`/`severity`/`channel`/`owner`/`unlinked`(bool, `ncr_id
   IS NULL`)/`q` free-text over `search_vector`), `POST /v1/complaints` (`complaint:manage`, `Idempotency-Key`
   header, mirrors every other sprint's create-route pattern), `GET /v1/complaints/:id` (`complaint:view`),
   `PATCH /v1/complaints/:id` (`lockVersion`, `complaint:manage` — edits customer/contact/channel/severity/
   subject/description/batch/cost; never `status`/`ncr_id`/`eight_d_id`/`capa_id`/`acknowledged_at`/
   `closed_at` directly — those change only via C3/C4/C5's own dedicated actions). Not plant-scoped (no
   `plant_id` column — a customer complaint is not tied to one physical plant, mirrors document/capa/supplier
   precedent). All mutations `withAudit` in the same transaction (rule 3).
3. `GET /v1/complaints/summary` (`complaint:view`) — one round trip returning every KPI/tab count below,
   mirroring the `GET /v1/risks/summary`/`GET /v1/instruments/summary` precedent exactly (cursor-paginated
   lists can't compute tenant-wide totals client-side):
   - **Open** = `count(*) where status <> 'closed'`.
   - **Critical** = `count(*) where status <> 'closed' and severity = 'critical'`.
   - **< 24h response %** — a cohort metric, not a lifetime average: over complaints whose `received_at` falls
     in the trailing 30 days (tenant timezone, "now" computed server-side) **and** are old enough to judge
     (either already acknowledged, or `received_at <= now() - interval '24 hours'` — a complaint received 3
     hours ago that hasn't been acknowledged yet is excluded from both numerator and denominator, not counted
     as a failure prematurely): numerator = acknowledged within 24h of receipt; denominator = every judgeable
     complaint in the cohort. Returns `null` (renders "—") when the denominator is 0, never `NaN` or `0%`.
   - **Avg time to close (days)** = `avg(extract(epoch from (closed_at - received_at)) / 86400)` over every
     complaint ever closed (all-time, not quarter-scoped — the jsx's own tile carries no time-window label);
     `null` (renders "—") when zero complaints have ever been closed.
   - **Avg cost / complaint** = `avg(cost_usd)` over complaints where `cost_usd IS NOT NULL` (all-time);
     `null` (renders "—", never "$0") when zero complaints carry a recorded cost.
   - **Tab counts**: `all` = Open (above); `critical` = Critical (above); `no-link` = `count(*) where status <>
     'closed' and ncr_id IS NULL` (matches the tab's own literal label, "Not linked to **NCR**" — deliberately
     not also checking `eight_d_id`/`capa_id`, since the drawn label names NCR specifically); `mine` =
     `count(*) where status <> 'closed' and owner = <caller's membership id>`.
4. Cross-tenant complaint id → 404, not 403 (rule 8), mutation-tested against RLS.
5. `sla_state` (`SlaState` — reused type, `on_track\|at_risk\|breached`, §1a) is **computed on every read**,
   never stored, via a new pure `packages/core/src/complaint-sla.ts` `complaintSlaState(input: { slaTargetHours:
   number; receivedAt: string; acknowledgedAt: string | null; now: string }): SlaState`: if `acknowledgedAt` is
   set, the state is fixed forever at whichever it resolved to at that moment (`on_track` if acknowledged
   within `slaTargetHours` of receipt, else `breached` — a late first response stays permanently `breached`
   for this leg, regardless of what happens after); if not yet acknowledged, `breached` when elapsed hours
   exceed `slaTargetHours`, `at_risk` when elapsed hours are ≥ 75% of `slaTargetHours`, else `on_track`. Takes
   ISO strings, never JS `Date` objects (mirrors Sprint 05 B4's deliberate deviation for the same `pg`
   timezone-shift reason). Unit-tested including the 75% boundary and the "acknowledged late, stays breached
   forever" rule.

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/complaints/` — `ComplaintsPage` (KPI strip, 4 tabs w/ real counts, register
  table w/ customer color chip/severity badge/status chip/linked-record link or "Convert" affordance/received
  relative-time, "Intake channels"/"SLA matrix" reference cards reproduced as static reference content — see
  §3.1 for why these two cards are real but non-interactive this sprint), empty/loading/error/offline states.
- **Mobile:** not built — no `m-*.jsx` design (confirmed §1a); no route, no nav entry; `pnpm --filter
  @kaenal/mobile typecheck` must stay green on the additive shared-type changes only.
- **Shared:** migration `0071` (`complaints`, `complaint_attachments`, `EntityKind`/`entity_links` widening);
  `ComplaintDto`/`ComplaintListQuery`/`CreateComplaintBody`/`UpdateComplaintBody`/`ComplaintSummaryDto` +
  `ComplaintChannel`/`ComplaintSeverity`/`ComplaintStatus` enums in `packages/types`;
  `packages/core/customer-color.ts` + `packages/core/complaint-sla.ts` (pure, unit-tested);
  `complaint:view`/`complaint:manage` in `packages/core/src/rbac.ts`.

### C2 — Log a complaint (IntakeForm) + attachments

**Design:** `IntakeForm` (`qms-modules.jsx:477-523`) — the fully drawn intake dialog.

UC
- Happy: "Log complaint" opens the drawn dialog (Customer, Severity, Batch/serial, Subject, Detail,
  Attachments) **plus two necessary additions, flagged, not invented decoration** — Contact and Channel (§1a
  gap: the drawn dialog is missing fields the list/filters require it to have captured) — submitting creates a
  real complaint at `status: 'triage'`, `received_at: now()`, the severity's SLA targets denormalized in
  (C1 AC1), navigates to the new complaint's detail panel (C3).
- Attachments: the drop-zone accepts multiple files (photos, customer emails, 8D PDFs — matches the drawn
  copy exactly); each is presigned with `entityKind: "complaint"` and `entityId` **omitted** (no complaint
  exists yet at presign time), uploaded, then linked via `attachmentFileIds: string[]` in the `POST
  /v1/complaints` body once the complaint is created — mirrors Sprint 05's Round-3 fix for training evidence
  exactly (B7/BLOCKING-2, `entity_kind` set at presign, `entityId` omitted, linked after the fact), including
  its closed bypass: the link-time check requires the file's `entity_kind` to exactly equal `"complaint"` and
  `deleted_at IS NULL` before accepting it.
- Empty/error: a submission with zero attachments is valid (attachments are optional, matching the drawn
  dialog showing no "required" marker on that field); an upload failure keeps the dialog open with a retry
  affordance, never silently drops the file from the submission.
- Permission: `complaint:manage` required to open the dialog.

AC
1. `POST /v1/complaints` (C1 AC2) accepts `{ customer, contact, channel, severity, subject, description,
   batchRef?, attachmentFileIds?: string[] }`. Each id in `attachmentFileIds` is server-verified: belongs to
   this tenant, `entity_kind = 'complaint'`, `deleted_at IS NULL`, `sha256 IS NOT NULL` (fully uploaded) —
   exactly the double-check Sprint 05 closed its own presign-bypass gap with (B7/Round-3). A `complaint_
   attachments` row is inserted per verified id, in the same transaction as the complaint insert.
2. `Idempotency-Key` header required, same pattern as every other sprint's create route.
3. Created complaint gets a real `COM-YYYY-NNNN` code, sequence-generated via `codes.ts` + `counters`, never
   client-supplied.
4. Future-dated `receivedAt` is not accepted as a client input at all — `received_at` is always server-set to
   `now()` at creation (the drawn form has no date field; a complaint is always logged as received "now,"
   matching the jsx's own relative-time display convention — "2 hours ago," never a picked date).

**Web/Mobile/Shared:** Web (`IntakeForm`-derived dialog, contact/channel fields added per §1a, attachment
drop-zone wired to the files pipeline). Mobile: unaffected. Shared: none beyond C1's types + the files
pipeline's existing `entityKind` capability-check extension (`complaint` added to whatever allow-list `POST
/v1/files/presign` uses per `FilesService.presign`, mirroring Sprint 05's own extension of that same
mechanism for `calibration_event`/`training_batch`).

### C3 — Complaint detail panel: view, Acknowledge, edit, Close

**Design:** **No jsx board exists for this** — the mock's list rows are clickable but wired to nothing (§1a).
Flagged for the UI Lead Designer (§5); this story's AC describe the real backend + an interim detail panel
reusing this codebase's established `KvField`/detail-card visual language (the same pattern Sprint 04's risk
detail card and Sprint 05's instrument detail card already use), not a newly invented layout.

UC
- Happy: clicking a complaint row opens a detail panel showing every field the list's own `COMPLAINTS` object
  already carries (customer, contact, channel, severity, status, subject, description, batch, received/
  acknowledged/closed timestamps, SLA state chip, cost if set, attachments list, owner) plus real actions:
  Edit, Acknowledge (only while `acknowledged_at IS NULL`), Convert to NCR/8D/CAPA (C4), Close.
- Acknowledge: sets `acknowledged_at = now()` once; a second attempt 422s ("already acknowledged"), never
  silently overwrites the timestamp (an SLA response-time record must not be re-writable after the fact).
- Close: an explicit action, allowed from any non-`closed` status (a complaint can be closed with or without
  ever being converted — the jsx's own `COM-2026-0080` example closes *after* being linked to an NCR, proving
  closing isn't gated on having converted first); sets `closed_at = now()`, `status = 'closed'`; 422 if already
  closed.
- Permission: `complaint:view` reads the panel; `complaint:manage` for Edit/Acknowledge/Convert/Close.
- Offline: all four actions disabled under the offline banner (S1-5 infrastructure).

AC
1. `POST /v1/complaints/:id/acknowledge` (`complaint:manage`, `lockVersion`) — 422 if `acknowledged_at` is
   already set; audited `updated`.
2. `POST /v1/complaints/:id/close` (`complaint:manage`, `lockVersion`) — 422 if `status = 'closed'` already;
   sets `status = 'closed'`, `closed_at = now()`; audited `status_changed` (a real status transition, matching
   the CAPA/NCR/SCAR/8D/audits/inspections/MSA/document precedent for status transitions specifically, not
   `PATCH`'s generic `updated`).
3. Both routes 409 on a stale `lockVersion` (rule 6), mirroring every other mutation in this sprint's design.
4. Cross-tenant complaint id on either sub-route → 404, not 403 (rule 8).

**Web/Mobile/Shared:** Web (interim detail panel, flagged §5, reusing the existing `KvField`/detail-card
visual pattern). Mobile: unaffected. Shared: none beyond C1's types.

### C4 — Convert a complaint to NCR / 8D / CAPA

**Design:** `qms-modules.jsx:411-413` — the "Link / Create NCR" button (currently `kToast('NCR drafted from
complaint — review & submit')`, dead in the prototype) and the "→ NCR-2026-0140" linked-record display for
already-converted rows.

UC
- Happy: from an unconverted complaint (any of `ncr_id`/`eight_d_id`/`capa_id` still NULL for the chosen
  target), "Convert to NCR" (or 8D, or CAPA) creates a real target record, links it back, and advances
  `status` forward (never backward — a complaint already at `8d` that converts to CAPA moves to `capa`; one
  already at `capa` that "converts to NCR" is rejected, since NCR is chronologically upstream of the ECN's
  existing progress — see AC2's exact rule). Matches the jsx's own fixture directly: `COM-2026-0082` (status
  `8d`) and `COM-2026-0081` (status `capa`) each show only **one** linked record despite plausibly having
  passed through an earlier stage — proving a complaint need not visibly retain every intermediate link, and
  confirming direct triage→8D or triage→CAPA conversion (skipping NCR entirely) is a real, intended path, not
  a gap.
- Already converted: a target that's already linked (e.g., `ncr_id` already set) can't be converted to that
  same target again — 409, with the existing linked record's id in the error payload (mirrors `raiseNcr`'s
  own "That finding already has an NCR" 409 exactly).
- Permission: `complaint:manage` to convert (the parallel `ncr:create`/whichever target capability is also
  checked, defense-in-depth, mirroring Sprint 05 C3's own stated pattern — every role holding `complaint:
  manage` already holds `ncr:create`/`capa:manage`, so this is redundant-but-harmless, not an independent
  gate).

AC
1. `POST /v1/complaints/:id/convert` (`complaint:manage`) body `{ target: "ncr" | "eight_d" | "capa", title?,
   priority? }` — reuses `NcrsService.create`/`EightDService.create`/`CapasService.create` directly (not a new
   parallel creation path), passing `source: "complaint"` (NCR — already a valid `NcrSource` value, §1a, no
   migration needed) / `sourceKind: "complaint"` (CAPA) / a new, equally minimal `source`-style field for 8D
   (8D's own schema, `0001_core.sql:264-286`, has no `source`/`source_id` columns at all today — this sprint
   adds them, migration `0071`: `eight_ds.source text NULL`, `eight_ds.source_id uuid NULL`, unconstrained,
   matching the loose pattern `ncrs.source_id`/`capas.source_id` already use, not a CHECK-constrained enum
   this sprint since 8D currently has no other `source` value to enumerate against), `sourceId: <complaint
   id>`. Sets the corresponding `complaints.ncr_id`/`eight_d_id`/`capa_id` in the same transaction with a
   `WHERE <fk> IS NULL` guard (409 on a concurrent double-convert, mirrors `raiseNcr`'s exact pattern).
2. **Status-advance rule, exact:** `complaintMachine` (new, `packages/core/src/state-machines/complaint.ts`)
   assigns each status a rank (`triage=0, investigation=1, 8d=2, capa=3, closed=4`, terminal). Converting to
   `ncr` sets `status = max(current, investigation)`; to `eight_d` sets `status = max(current, "8d")`; to
   `capa` sets `status = max(current, "capa")` — status only ever advances or stays put, never regresses.
   Converting to a target chronologically *behind* the complaint's current status (e.g., "convert to NCR" on a
   complaint already at `8d`) still creates the NCR and links it (a complaint can gain an NCR link after the
   fact for traceability) but does **not** move `status` backward — `status` stays at its current, more
   advanced value. Audited `status_changed` only when `status` actually changes; the NCR/8D/CAPA creation
   itself is always audited `created` on the new record via its own `withAudit` call (rule 3), regardless of
   whether `status` moved.
3. Cross-tenant complaint id → 404, not 403 (rule 8); RLS mutation-tested for the double-convert race (two
   concurrent converts to the same target, exactly one wins with 200, the other gets 409).

**Web/Mobile/Shared:** Web (Convert action in C3's detail panel + the register table's inline "Link / Create
NCR"-equivalent affordance for unconverted rows, a target picker (NCR/8D/CAPA)). Mobile: unaffected. Shared:
migration `0071`'s `eight_ds.source`/`source_id` addition; `ComplaintConvertBody`/`ComplaintConvertTarget` in
`packages/types`; `packages/core/state-machines/complaint.ts` (pure, unit-tested against every status-rank
transition including the "converts backward, status doesn't move" case).

### E1 — ECN schema, canonical stage machine, List view

**Design:** `ECNWorkbench`/`ECNList` (`qms-modules.jsx:528-591`) — segmented List/Kanban toggle, list table.
**See §3.2 for the canonical stage machine this AC implements — the jsx's own two views disagree with each
other and with P19, and §3.2 resolves the conflict; this is part of what needs sign-off.**

UC
- Happy: open `/ecn` (List view, the default) → table of ECNs with type chip, a progress bar reading "step X
  of 6" against the canonical 6-stage pipeline (§3.2), risk chip, owner avatar, target (effective) date — real
  data, not the jsx's 5 static rows.
- Empty: zero ECNs → "No engineering change notices yet — New ECN."
- Permission: `ecn:view` required for the page; nav-curated (§4), server-403 for a role without it.
- Error/offline: list fetch fails → retry; offline banner disables New ECN/approve/reject/link mutations.

AC
1. Migration `0072_ecn.sql`: `ecns` — `tenant_id`, `id`, `code` (`ECN-YYYY-NNNN`; `CodeKind` gains `"ecn"` →
   prefix `ECN`), `title`, `change_type` enum (`design\|process\|tooling\|material` — **4 values, corrected
   from P19's proposed 3** to match the jsx's own `ECNList` fixture's real 4th value and P19 §5's own
   confirmed supplier-change dependency, §1a), `description` text NOT NULL DEFAULT `''`, `change_risk` enum
   (`low\|medium\|high` — the jsx's `risk` field; captured at creation, editable via `PATCH` **only while
   `stage = 'draft'`**, frozen once the approval pipeline begins — a change's risk assessment shouldn't shift
   after reviewers have started signing off against it), `stage` enum (`draft\|feasibility\|risk_review\|
   cab_approval\|pilot\|implementation\|closed\|rejected` — the canonical machine, §3.2) DEFAULT `draft`,
   `owner` (composite member FK, NOT NULL, defaults to the creating actor), `effective_date` date NULL,
   `search_vector` generated tsvector over `title`/`description` (mirrors `0008_search_vectors.sql`),
   `lock_version`, standard audit columns. Forced RLS, leading `tenant_id` index, unique `(tenant_id, code)`,
   `UNIQUE (tenant_id, id)` (self — target for `ecn_approvals`' composite FK). Not plant-scoped (no `plant_id`
   — an engineering change is tenant-wide, mirrors document/capa precedent). `EntityKind` gains `"ecn"`;
   `entity_links` CHECK constraints widened.
2. `packages/core/src/state-machines/ecn.ts` (pure): `ECN_STAGE_ORDER = ["draft", "feasibility",
   "risk_review", "cab_approval", "pilot", "implementation"]` (6 entries — `closed`/`rejected` are terminal,
   excluded from the "of 6" count, matching the jsx's own `of:6` convention); `ecnStageIndex(stage): number |
   null` returns 1-6 for the 6 ordered stages, `null` for `closed`/`rejected`. `ecnMachine` (`defineMachine`)
   transitions: `draft → [feasibility, rejected]`, `feasibility → [risk_review, rejected]`, `risk_review → [
   cab_approval, rejected]`, `cab_approval → [pilot, rejected]`, `pilot → [implementation, rejected]`,
   `implementation → [closed]`, `closed → []`, `rejected → []` — every pre-implementation stage can be
   rejected (closing the jsx's own missing "Rejected" Kanban column, §1a/§3.2); guards mirror
   `documentMachine`'s `requiresApproverRole` (only `admin`/`manager` may approve/reject any of the 4 gated
   stages, §3.2) and `forbidsSelfApproval` (approver ≠ `ecns.owner`).
3. `GET /v1/ecns` (cursor, rule 6; filters `changeType`/`stage`/`changeRisk`/`owner`/`q` over `search_vector`),
   `POST /v1/ecns` (`ecn:manage`, `Idempotency-Key`), `GET /v1/ecns/:id` (`ecn:view`), `PATCH /v1/ecns/:id`
   (`lockVersion`, `ecn:manage` — edits `title`/`description`/`effectiveDate`/`owner` always; `changeType`/
   `changeRisk` only while `stage = 'draft'`, 422 otherwise; never `stage` directly, which only changes via
   E4's approval route). All mutations `withAudit` in the same transaction (rule 3).
4. Cross-tenant ECN id → 404, not 403 (rule 8), mutation-tested against RLS.

**Web/Mobile/Shared**
- **Web:** `apps/web/src/features/ecn/` — `EcnListPage` (segmented toggle default `list`, table w/ type chip,
  progress bar, risk chip, owner avatar, effective date), empty/loading/error/offline states.
- **Mobile:** not built — no `m-*.jsx` design; unaffected; `pnpm --filter @kaenal/mobile typecheck` stays
  green.
- **Shared:** migration `0072` (`ecns`, `EntityKind`/`entity_links` widening); `EcnDto`/`EcnListQuery`/
  `CreateEcnBody`/`UpdateEcnBody` + `EcnChangeType`/`EcnChangeRisk`/`EcnStage` enums in `packages/types`;
  `packages/core/state-machines/ecn.ts` (pure, unit-tested — every legal/illegal transition, the four-eyes
  guard, the admin/manager-only guard); `ecn:view`/`ecn:manage`/`ecn:approve` in `packages/core/src/rbac.ts`.

### E2 — Kanban view

**Design:** `ECNKanban` (`qms-modules.jsx:593-633`) — 7 columns, drag-to-advance implied by the header's "CAB
approval" progress-bar concept. **Corrected to 8 columns** (adds "Rejected," §1a/§3.2).

UC
- Happy: Kanban view shows 8 columns (Draft, Feasibility, Risk review, CAB approval, Pilot, Implementation,
  Closed, Rejected) with real per-column counts and cards; dragging a card to the *immediately next* column
  performs the same stage-advance as E4's approve action (drag = approve, for a user who already holds
  `ecn:approve`); dragging to any non-adjacent column, or to "Rejected" without the reject confirmation, is
  rejected client-side before the API call (the API is the real guard regardless, via `ecnMachine`).
- Permission: viewing the board needs `ecn:view`; dragging (advancing) needs `ecn:approve` — a viewer/auditor
  can see the board but cards are not draggable for them (no drag handle rendered, not merely visually
  disabled — rule 10, no control that looks interactive but silently 403s).
- Empty: a column with zero cards renders its header with `0` and no card list, never omitted entirely (all 8
  columns always render, matching the jsx's own "closed: []" empty-array precedent for its own mock).

AC
1. No new route — drag-to-advance calls the same `POST /v1/ecns/:id/approvals/:stage` route E4 defines,
   `lockVersion`-guarded exactly as a click-to-approve would be; a 409 (stale lockVersion — someone else moved
   it first) snaps the card back to its server-confirmed column with a toast, never leaves it optimistically
   misplaced.
2. Column counts come from `GET /v1/ecns/summary` (new, `ecn:view`) — `count(*) group by stage`, all 8 values
   always present (0 for an empty stage), mirroring the KPI-summary precedent every prior sprint's module
   uses for the same "cursor list can't total itself" reason.

**Web/Mobile/Shared:** Web (`EcnKanbanPage`, drag-and-drop reusing whatever DnD primitive the codebase already
uses elsewhere — none currently exists for a kanban board in this app; if no existing DnD library is already a
dependency, this sprint adds one, capability-gated so a non-approver sees a real, non-interactive board, not a
broken drag handle). Mobile: unaffected. Shared: `EcnSummaryDto` in `packages/types`.

### E3 — Create an ECN via the CreateWizard

**Design:** ROADMAP §0 Q1 ("CreateWizard replaces the create dialogs everywhere; CAPA keeps its dialog");
`qms-modules.jsx:538` "New ECN" button (bare `kToast`, no field list drawn at all — unlike risk's precedent,
which at least implied its fields via other evidence; ECN's Details-step fields below are inferred entirely
from `ecns`' own schema, §5 flags the board as needed).

UC
- Happy: "New ECN" opens `/create/ecn` (Type pre-selected → Details → Review, a 3-step branch — ECN's single
  `owner` column doesn't fit the shared multi-role Assignees step, exactly mirroring risk's R4 precedent) →
  creates a real ECN at `stage: 'draft'`, navigates to `/ecn?id=<uuid>`.
- Not a dedicated wizard (unlike MSA's or the instrument form's exception, §1a of Sprints 04/05): ECN's fields
  (`title`, `changeType`, `description`, `changeRisk`, `effectiveDate`, `owner`) are flat, single-entity, no
  cascading-select — the exact shape that already fit CreateWizard for risk (Sprint 04 R4). No blocking reason
  exists to make ECN an exception the way MSA/instrument were.

AC
1. Details-step fields: `changeType` (required select, 4 values), `title` (required text), `description`
   (textarea, optional at create, defaults `''`), `changeRisk` (required select, 3 values), `effectiveDate`
   (optional date picker), `owner` (single-select, captured in this same step — skips the shared Assignees
   step, mirroring risk's R4 precedent exactly for the same reason: a single-column `owner`, not a multi-role
   assignee set).
2. `ecn` is a real entry in `packages/core/src/create-wizard.ts`'s `WizardType` union, `WIZARD_TYPE_ORDER`, and
   `WIZARD_TYPES` map (capability `ecn:manage`, `hasPriorityAndDue: false`, `templates: []`) — a real 6th
   option in both the global quick-create menu and the Type-step card grid (mirrors risk's exact precedent).
   `WIZARD_ICON`/`WIZARD_COLOR` gain a 6th entry — icon `GitBranch` (matches `navigation.ts`'s existing ECN nav
   glyph) and a color from the existing wizard palette, distinct from the other 5 cards.
3. Created ECN gets a real `ECN-YYYY-NNNN` code, sequence-generated via `codes.ts` + `counters`.

**Web/Mobile/Shared:** Web only (wizard extension, Details-step fields, 3-step branch for `ecn`). Mobile:
unaffected. Shared: none beyond E1's types (`WizardType` union lives in `packages/core` but has no mobile
consumer this sprint).

### E4 — Multi-stage approval: approve, reject, four-eyes

**Design:** the "multi-stage approval workflow" the `ECNWorkbench` header text names; the progress bar in
`ECNList`; the implied but undrawn detail view P19 §3 itself calls for ("ECN detail: multi-stage approval
tracker, affected-records via entity-links"). **No jsx board exists for this detail view** — flagged §5,
mirrors C3's exact situation.

UC
- Happy: an ECN at one of its 4 gated stages (`feasibility`/`risk_review`/`cab_approval`/`pilot`) shows an
  approval tracker (4 rows: stage name, decision, approver, decided-at) in its detail view; an `admin`/
  `manager` who is not the ECN's `owner` approves the current stage, advancing `stage` to the next one in
  `ECN_STAGE_ORDER` (§3.2) — reaching `implementation` triggers E5's auto-revise mechanism in the same
  transaction.
- Reject: any of the 4 gated stages can be rejected instead of approved, moving `stage` to `rejected`
  (terminal) — the ECN's Kanban card lands in the new "Rejected" column (E2's correction).
- Self-approval blocked: the ECN's own `owner` attempting to approve/reject any stage gets 403 (four-eyes,
  matches `documentMachine`'s `forbidsSelfApproval` exactly).
- Wrong stage: approving/rejecting a stage that isn't the ECN's *current* stage 422s ("stage X is not the
  current pending stage") — you cannot approve stage 3 while the ECN sits at stage 2, and cannot re-approve an
  already-decided stage.
- Permission: `ecn:approve` required (admin/manager only — mirrors `document:approve`'s exact grant, §1a);
  `ecn:manage` alone (auditor) can view the tracker but gets 403 attempting to decide, matching how auditor
  holds `document:view` but not `document:approve` today.

AC
1. `ecn_approvals` (migration `0072`): `tenant_id`, `id`, `ecn_id` composite FK → `ecns(tenant_id, id)` ON
   DELETE CASCADE, `stage` enum (the 4 gated values only — `feasibility\|risk_review\|cab_approval\|pilot`),
   `role_required` text NOT NULL — **stored as the literal constant `"admin_or_manager"` for every row this
   sprint** (P19's own open question, "fixed vs configurable" stages, is resolved as **fixed and uniform**
   this sprint, mirroring `documentMachine`'s own admin/manager-only rule, the closest real precedent this
   codebase has for "who approves a controlled artifact" — the column exists for a future sprint's per-stage
   configurability, not yet interpreted beyond this one value), `decision` enum (`pending\|approved\|rejected`)
   DEFAULT `pending`, `approver` (composite member FK, NULL until decided), `decided_at` timestamptz NULL,
   `comment` text NULL, standard audit columns. Forced RLS, leading `tenant_id` index, unique `(tenant_id,
   ecn_id, stage)`. All 4 rows are pre-created (all `pending`) in the same transaction as `POST /v1/ecns`
   (E3), so "what stage is this ECN on" is always answerable by joining `ecns.stage` to its matching row.
2. `POST /v1/ecns/:id/approvals/:stage` (`ecn:approve`, `lockVersion` on the parent `ecns` row) body
   `{ decision: "approve" | "reject", comment? }`. Guards, in order: (a) `:stage` must equal `ecns.stage`
   (422 otherwise — "not the current stage"); (b) actor ≠ `ecns.owner` (403 — four-eyes); (c) actor role ∈
   {`admin`,`manager`} (403 otherwise — the `role_required` check). On `approve`: updates the `ecn_approvals`
   row (`decision='approved'`, `approver`, `decided_at`), advances `ecns.stage` to the next value in
   `ECN_STAGE_ORDER` (or to `implementation` from `pilot`, triggering E5 in the same transaction). On
   `reject`: updates the row (`decision='rejected'`, `approver`, `decided_at`, `comment` required — a rejection
   must carry a reason), sets `ecns.stage = 'rejected'` (terminal). Both audited `status_changed` on the
   `ecns` row (the stage transition) **and** `updated` on the `ecn_approvals` row (the decision itself) — a
   real two-entity audit split, not a single ambiguous event.
3. 409 on a stale `lockVersion` (rule 6); cross-tenant ECN id → 404, not 403 (rule 8).
4. `GET /v1/ecns/:id/approvals` (`ecn:view`) — the 4-row tracker, read-only, for the detail view.

**Web/Mobile/Shared:** Web (interim ECN detail view w/ approval tracker, flagged §5; approve/reject actions,
capability-gated visibly not just server-side). Mobile: unaffected. Shared: migration `0072`'s `ecn_approvals`
table; `EcnApprovalDto`/`DecideEcnApprovalBody` in `packages/types`.

### E5 — Affected documents/suppliers + real auto-revision on implementation

**Design:** `ECNWorkbench` header text, "auto-revises affected documents"; `ECNList`'s `eff` column ("18
docs," etc. — an affected-record count).

UC
- Happy: an ECN's detail view lets an author (`ecn:manage`, only while `stage` is pre-`implementation`) link
  affected documents and suppliers via the existing `entity_links` mechanism (reuses R3's `LinkPicker`
  component from Sprint 04, generic over `kind`, scoped here to `document`/`supplier` — **not** `part`, since
  no `parts` table/`EntityKind` exists anywhere in this codebase, §1a; "affected parts" is not buildable this
  sprint and is not silently faked as a picker that links to nothing real).
- Auto-revise, real mechanism (not hand-waved, CLAUDE.md rule 0/10): the moment E4's approval route advances
  an ECN's `stage` to `implementation` (from `pilot`, the last gated stage), in the **same transaction**, for
  every `document`-kind `entity_links` row attached to this ECN, the service calls
  `DocumentsService.newVersion` for real (the existing, confirmed-callable method, §1a) — `fileId: null` (no
  new file is auto-attached; the revision is a formal version bump, matching P19's own "auto-revise," not a
  content change nobody wrote), `nextVersion` computed by a new pure `packages/core/src/version-bump.ts`
  `bumpMinorVersion(version: string): string` (parses a numeric-dot `"X.Y"` string and increments `Y` by 1 —
  unit-tested, including the malformed-input case below), `changelog: "Auto-revised by ${ecn.code}
  implementation"`.
- Partial-failure honesty (rule 0/10 — never a silent partial success): `newVersion`'s own guard rejects a
  document that isn't currently `status: 'approved'` (§1a), and `bumpMinorVersion` rejects a `version` string
  that isn't in the expected `"X.Y"` numeric-dot format (rare/legacy data). Neither case aborts the whole
  transaction — the ECN's own `stage` advance to `implementation` still succeeds — but each skipped document
  is collected into the response and surfaced as a real, visible warning ("2 of 3 affected documents were
  auto-revised; 1 was skipped — Document DOC-2026-0031 is not currently approved, revise it manually"), never
  silently dropped.
- Permission: linking needs `ecn:manage`; the auto-revise itself runs as a side effect of E4's `ecn:approve`
  action, not a separately callable route.

AC
1. `POST /v1/ecns/:id/link` (`ecn:manage`) body `{ kind: "document" | "supplier", targetId }` — writes a real
   `entity_links` row (`from_kind='ecn'`, `to_kind=kind`), audited `linked` (existing action, no new enum
   value). 422 once `stage` has passed `pilot` (no new links after implementation has already run — the
   affected-set is frozen at the moment auto-revision fires, so a link added after the fact can't retroactively
   claim to have been auto-revised).
2. `GET /v1/ecns/:id/links` (`ecn:view`) — the affected-records list, reusing the existing `entity_links` read
   pattern + label resolution (Sprint 04 R3's `label` field).
3. The `implementation`-transition auto-revise logic lives in `EcnService`, calling `DocumentsService.
   newVersion` directly (real reuse, not a reimplementation) for each linked, currently-`approved` document
   with a parseable version string; each outcome (revised / skipped-not-approved / skipped-bad-version-format)
   is collected and returned in the approval response's `autoRevise: { revised: string[]; skipped: {
   documentId: string; reason: string }[] }` field.
4. Cross-tenant target id on `POST /v1/ecns/:id/link` → 404, not 403 (rule 8) — the existing `assertEntityVisible`
   pattern, unchanged.

**Web/Mobile/Shared:** Web (`LinkPicker` reused at a new ECN call site, scoped to `document`/`supplier`; the
approval response's `autoRevise` result rendered as a real toast/banner, not swallowed). Mobile: unaffected.
Shared: `packages/core/version-bump.ts` (pure, unit-tested); `EcnLinkBody`/`AutoReviseResult` in
`packages/types`.

### X1 — Cross-cutting wiring (RBAC, nav, search, graph, realtime, notifications)

**Design:** ROADMAP §8's standing rules — every new module wires into `navigation.ts` (already present, §1a),
`rbac.ts`, palette nav, `entity-routes.ts`, search KINDS, realtime topics, notifications, audit events, graph
node kinds.

UC
- An admin/manager/auditor sees `Customer complaints`/`Engineering changes` in the sidebar and command
  palette; a viewer sees both, read-only; an inspector sees neither (§1 role decision). Search hits for a
  complaint/ECN by subject/title keyword appear in the command palette. A second approver's ECN Kanban board
  refreshes live when a colleague approves a stage. Notifications fire for SLA risk/breach (complaints) and
  pending-approval reminders (ECN).

AC
1. `packages/core/src/rbac.ts` `Capability` gains `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/
   `ecn:approve`. Grants: admin/manager = all 5; auditor = `complaint:view`/`complaint:manage`/`ecn:view`/
   `ecn:manage` (**not** `ecn:approve`, mirrors `document:approve`'s admin/manager-only grant exactly);
   inspector = none of the 5 (§1 role decision, reasoned, not an oversight); viewer = `complaint:view`/
   `ecn:view` only; partner = none.
2. `apps/web/src/config/rbac.ts` `ROLE_NAV`: auditor's `Set` gains `complaints`/`ecn`; viewer's `Set` gains
   `complaints`/`ecn`; inspector's `Set` is **not** changed (deliberate).
3. `apps/web/src/lib/entity-routes.ts` `entityHref`/`entityIcon`/`entityLabel` gain `complaint` →
   `/complaints?id=` (icon: `MessageSquare`, matching `navigation.ts`'s existing complaints glyph) and `ecn` →
   `/ecn?id=` (icon: `GitBranch`, matching `navigation.ts`'s existing ECN glyph).
4. `apps/api/src/collab/entity-ref.ts` `ENTITY_TABLES` gains `complaint: "complaints"`, `ecn: "ecns"`.
   `apps/api/src/ai/chat.ts` `ENTITY_SPECS` gains both, wired to `complaint:view`/`ecn:view`, `plantScoped:
   false` (neither table has a `plant_id` column). `apps/web/src/features/graph/graph-kinds.ts` `GRAPH_KINDS`
   gains both (TS-forced total-map completeness) but **neither renders in the graph explorer** —
   `apps/api/src/graph/graph.service.ts`'s own separate literal array is not widened this sprint, mirroring
   Sprint 04's Q27 judgment call exactly (logged §7, not silently claimed as done).
5. `packages/types/src/dto.ts` `SearchEntityKind` gains `complaint`/`ecn`; `apps/api/src/search/search.
   service.ts` `KINDS` gains `complaint: { table: "complaints", plantScoped: false }` and `ecn: { table:
   "ecns", plantScoped: false }`; `AUDIT_HIDDEN_ROLES`-style role exclusion is **not** needed for either (no
   role holds `:view` but is nav-hidden from the module the way audits' inspector/viewer split required —
   inspector holds neither capability at all here, so it never reaches `queryKind` for these two kinds in the
   first place).
6. `packages/types/src/realtime.ts` `RealtimeTopic` gains `complaint`/`ecn`; `apps/api/src/realtime/audit-
   signal.ts` `ENTITY_TOPIC` gains `complaint: { topic: "complaint", capability: "complaint:view" }`,
   `complaint_attachment: { topic: "complaint", capability: "complaint:view" }`, `ecn: { topic: "ecn",
   capability: "ecn:view" }`, `ecn_approval: { topic: "ecn", capability: "ecn:view" }`.
7. Notifications: a new daily job `complaint-sla` (mirrors `document-expiry.ts`/Sprint 05's `calibration-due`
   job pattern exactly) notifies a complaint's `owner` when `complaintSlaState` crosses into `at_risk` or
   `breached` for the still-unacknowledged response leg, cycle-tied dedupe key
   `complaint-sla:<complaintId>:<slaState>` (mirrors Sprint 05 B4's cycle-tied dedupe fix — re-notifies once
   per state transition, not forever-silent after the first). ECN approval-pending notifications are
   **synchronous, not a sweep**: the moment `ecns.stage` advances to a new gated stage (E4 AC2's `approve`
   path, and at creation for the first `feasibility` stage), every member holding `ecn:approve` in the tenant
   is notified (a broadcast, since "who approves" is role-based, not a named individual — `role_required` is
   `admin_or_manager`, not a specific person, §1a/E4 AC1) — reuses the existing `NotificationsService`, not a
   new mechanism.
8. `placeholder-ledger.ts` loses `"planned:complaints"`/`"planned:ecn"`; both removed from `PLANNED_MODULES`.

**Web/Mobile/Shared:** Shared (rbac.ts, entity-ref.ts, chat.ts, graph-kinds.ts, dto.ts, search.service.ts,
realtime.ts, audit-signal.ts, jobs/worker.ts new `complaint-sla` job) + Web (rbac.ts ROLE_NAV, placeholder
ledger, planned-modules). Mobile: unaffected; `pnpm --filter @kaenal/mobile typecheck` stays green (every
touched shared type is additive).

---

## 3. Backend design — PROPOSED, NEEDS EXPLICIT USER SIGN-OFF (P18 + P19)

*(This is the section to extract and present alone for approval, per ROADMAP §0 Q2 — mirrors Sprints 03/04/05's
own practice. NO code for either module is written until this is approved.)*

### 3.1 Customer complaints (P18) — resolving both of P18's own open questions

**P18's open question 1 — "email/EDI auto-intake in scope now, or manual-only first?" Proposed: manual-only.**
None of the jsx's 5 "Intake channels" (public web form, customer portal/EDI, email parser, phone, customer
extranet API) has any real integration, parser, or public-facing endpoint anywhere in this codebase (§1a), and
building even one (an unauthenticated public complaint-submission form needs rate-limiting, CAPTCHA/abuse
protection, and a genuine customer-portal auth story none of which is specified anywhere) is exactly the class
of vendor/external-infra work ROADMAP Q5 defers to Sprint 13 — mirrors Sprint 05's own LMS-connector exclusion
(§1a of that sprint) precisely. **Proposed:** this sprint builds **manual intake only** — an authenticated
tenant user (admin/manager/auditor) logs a complaint on the customer's behalf via `IntakeForm`, selecting which
`channel` the complaint actually arrived through (portal/email/web-form/EDI/phone — the enum still models all
5 real-world channels; only the *automated ingestion* of 4 of them is out of scope, not the data model). The
"Intake channels" card and "Public intake form" button are reproduced as **honest, real, non-interactive
reference content** — a static status card the tenant's admin can see today's manual-only posture on — rather
than either a fake "Connect" button (rule 10) or silently dropping the drawn card (rule 9). This is flagged
plainly as a real exclusion, not disguised (§7).

**P18's open question 2 — "SLA clock on complaints?" Proposed: yes**, reusing `packages/core/src/sla.ts`'s
existing `SlaState` type and business-hours-aware philosophy (not a new mechanism, §1a) — but with the SLA
matrix's own two distinct target *shapes*, both taken as fixed config this sprint (not yet tenant-configurable
— P18 doesn't ask for configurability, and no settings screen exists yet to hold it):

| Severity | Acknowledge target (`sla_target_hours`) | Close target (`sla_close_target_days`) |
|---|---|---|
| Critical | 1 | 14 |
| High | 4 | 21 |
| Medium | 24 | 45 |
| Low | 48 | 90 |

The **acknowledge** target drives `complaintSlaState` (C1 AC5) — a plain elapsed-hours comparison, not routed
through `computeDueAt`'s business-hours machinery, because the SLA matrix names the acknowledge target in
plain hours with no stated business-hours qualifier (unlike NCR's `respondHours`, which *is* explicitly
business-hours-scoped in 03 §10) — a critical field-failure complaint doesn't stop its 1-hour clock overnight.
The **close** target is a plain calendar-day count (`received_at + N days`), shown as a KvField in the detail
panel and used only for display, not a hard block on anything this sprint (P18 names no "auto-escalate on
close-breach" behavior, so none is invented). The SLA matrix's own "8D required" column is reproduced as
**informational display copy only** this sprint (e.g., "Critical: 8D suggested within 4h") — not an enforced
gate (nothing blocks a critical complaint from staying un-8D'd), since P18 doesn't ask for enforcement and none
of NCR/CAPA/8D has a comparable "you must open one of these" hard rule to mirror.

**The one field this sprint adds beyond what `IntakeForm` draws, flagged plainly (not invented decoration):**
`contact` (a single free-text field) and `channel` (a required select) are added to the intake dialog because
P18 §1 names both as required intake data and the list view's own columns display both for every row — the
drawn dialog simply omits inputs for data it needs to have collected (§1a). This mirrors Sprint 04 B1's own
precedent (adding `owner` to risk's undrawn Details step) exactly — a minimal, evidenced, necessary addition,
not scope invention.

**What the user is being asked to approve:** the `complaints`/`complaint_attachments` schema (§2 C1 AC1); the
plain-FK (not composite) convert-link mechanism reusing `audit_findings.ncr_id`/`capa_id`'s exact precedent,
extended to a third target (8D) via two new, unconstrained `eight_ds.source`/`source_id` columns (§2 C4 AC1);
manual-only intake this sprint, with the 4 automated channels and the public/portal screens explicitly
excluded (not built, not faked); the SLA table above (1h/4h/24h/48h ack, 14/21/45/90d close) as fixed config;
the cohort-based "< 24h response %" formula (§2 C1 AC3); and the `contact`/`channel` fields added to the
intake dialog.

### 3.2 ECN (P19) — the canonical stage/approval machine, resolving the jsx's own internal conflict

**The problem, stated plainly (§1a):** `ECNList` implies a 6-step numbered pipeline with 4 named labels
("Risk review" 3/6, "CAB approval" 4/6, "Doc revision" 5/6, "Pilot run" 6/6); `ECNKanban` implies a 7-column
pipeline (draft, feasibility, risk-review, cab, pilot, impl, closed) with no "Doc revision" column and no
reject path; P19 §2 proposes a 5-value `status` enum matching neither. These three sources cannot all be
literally correct at once, and P19 §5 itself explicitly asks "number/identity of approval stages: fixed vs
configurable?" as an open sign-off question — this section proposes the resolution, using the more complete
of the two jsx sources (`ECNKanban`'s named, structural column set) as the backbone, reconciling `ECNList`'s
"Doc revision" label, and closing the missing reject path.

**Proposed canonical pipeline** (`packages/core/src/state-machines/ecn.ts`, §2 E1 AC2):

`draft → feasibility → risk_review → cab_approval → pilot → implementation → closed`, with **every** pre-
`implementation` stage able to move to a terminal `rejected` state instead of advancing.

**Reconciling `ECNList`'s "Doc revision" label:** this is **not** a genuine 7th human-approval stage — it is
`ECNList`'s own inaccurate depiction of what is actually the **auto-revise-documents side effect** (E5) that
fires automatically the moment `implementation` is reached. An ECN doesn't sit in a manual "Doc revision"
holding stage waiting for a person to act; the system revises the affected documents itself, in the same
transaction, the instant the pipeline reaches `implementation`. `ECNList`'s mock numbering was simply wrong to
show it as a 5th of 6 human steps — this is stated here as a found-and-corrected mock defect (same class as
Sprint 04's `R-NNN` code-format correction), not a silent reproduction of an inaccurate label.

**Human approval gates, exactly 4:** `feasibility`, `risk_review`, `cab_approval`, `pilot` — each backed by
one `ecn_approvals` row (§2 E4 AC1). **Every gate requires the same role, `admin` or `manager`** (fixed and
uniform this sprint, resolving P19's "fixed vs configurable" question as **fixed**, mirroring `documentMachine`'s
own admin/manager-only rule — the only real precedent this codebase has for "who signs off a controlled
change." A configurable, stage-specific role (e.g., "CAB requires admin only," "Pilot requires the plant
manager") is a real, named future enhancement (§7), not silently built now with no UI to configure it.

**Four-eyes:** approver ≠ `ecns.owner`, exactly mirroring `documentMachine`'s `forbidsSelfApproval` (no
stronger "no two stages decided by the same person" rule — not asked for by P19, not built).

**`change_type` widened to 4 values (`design\|process\|tooling\|material`):** P19 §2 proposes only 3, but the
jsx's own `ECNList` fixture uses a 4th ("Material," `ECN-2026-0180`, a supplier bushing swap) and P19 §5 itself
independently confirms supplier-change ECNs are a real dependency ("Relates to: P08 — supplier change,
`linkedEcns`"). Proposed: `material` is added as a genuine 4th value, not silently dropped to match P19's
narrower list nor silently invented without justification.

**Reject path added (`ECNKanban` corrected to 8 columns, adding "Rejected"):** the header text's own claim of
a "multi-stage approval workflow" necessarily implies a stage can be *rejected*, not only approved — the jsx's
Kanban simply never drew that column. Flagged for the designer (§5) as a real, evidenced addition to the
board, not an invented one.

**"Auto-revises affected documents" — the real mechanism (§2 E5), stated plainly for sign-off:** on the
`pilot → implementation` transition, for every `entity_links` row of kind `document` attached to the ECN, the
service calls the **existing, confirmed-callable** `DocumentsService.newVersion` (§1a) with `fileId: null` and
a minor-bumped version string. A document that isn't currently `approved`, or whose version string isn't a
parseable `"X.Y"` format, is **skipped with a named reason returned in the response**, never silently
swallowed or silently blocking the ECN's own stage advance. This is proposed as real, working, transactional
behavior — not a stub, not a "link-only" fallback — resolving P19's own second open question ("is document
auto-revision in scope for v1, or link-only?") as **yes, in scope, real**.

**"Affected parts" is not buildable this sprint:** no `parts` table or `EntityKind` exists anywhere in this
codebase (§1a) — only `document`/`supplier` linking ships; a parts master table is out-of-scope invention this
sprint doesn't introduce.

**What the user is being asked to approve:** the `ecns`/`ecn_approvals` schema (§2 E1 AC1, E4 AC1); the
canonical 6-stage-plus-rejected machine above, replacing both jsx views' own inconsistent numbering; the
fixed, uniform admin/manager-only approval-role rule; the 4-value `change_type` enum (adding `material`); the
real `DocumentsService.newVersion`-based auto-revision mechanism with its named partial-failure behavior; and
the exclusion of "affected parts" linking (no real target exists to link to).

---

## 4. Backend needs

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| C1 | `0071_complaints.sql` (`complaints`, `complaint_attachments`, `EntityKind`/`entity_links` widening) | `GET/POST /v1/complaints`, `GET/PATCH /v1/complaints/:id`, `GET /v1/complaints/summary` | `ComplaintsService` + `packages/core/customer-color.ts` + `complaint-sla.ts` (pure) | `created`/`updated`, in-tx | `complaint:view`/`complaint:manage` | forced RLS; cross-tenant id → 404 |
| C2 | none (uses C1's table) | `POST /v1/complaints` gains `attachmentFileIds` | `ComplaintsService.create`, `FilesService.presign` extended for `entityKind: "complaint"` | `created`, in-tx | `complaint:manage` | file link verified tenant+entity_kind+sha256, mirrors Sprint 05 B7 |
| C3 | none | `POST /v1/complaints/:id/acknowledge`, `POST /v1/complaints/:id/close` | `ComplaintsService` | `updated` (acknowledge); `status_changed` (close) | `complaint:manage` | forced RLS; 404; 409 on stale lockVersion |
| C4 | `0071` also (`eight_ds.source`/`source_id`, unconstrained) | `POST /v1/complaints/:id/convert` | `ComplaintsService.convert` reusing `NcrsService.create`/`EightDService.create`/`CapasService.create` + `packages/core/state-machines/complaint.ts` (pure) | `created` (target record); `status_changed` (complaint, only when status moves) | `complaint:manage` (+ redundant target capability, defense-in-depth) | forced RLS; 404; 409 on double-convert race |
| E1 | `0072_ecn.sql` (`ecns`, `EntityKind`/`entity_links` widening) | `GET/POST /v1/ecns`, `GET/PATCH /v1/ecns/:id` | `EcnService` + `packages/core/state-machines/ecn.ts` (pure) | `created`/`updated`, in-tx | `ecn:view`/`ecn:manage` | forced RLS; cross-tenant id → 404 |
| E2 | none | reuses E4's approve route; `GET /v1/ecns/summary` (new) | `EcnService.summary` | none (read-only) | `ecn:view` (read); `ecn:approve` (drag/advance) | RLS-scoped |
| E3 | none | CreateWizard's existing create route, `"ecn"` type added | `EcnService.create` (shared with E1) | `created` | `ecn:manage` | forced RLS |
| E4 | `0072` also (`ecn_approvals`) | `POST /v1/ecns/:id/approvals/:stage`, `GET /v1/ecns/:id/approvals` | `EcnService.decideApproval` | `status_changed` (ecn); `updated` (ecn_approvals row) | `ecn:approve` (decide); `ecn:view` (read tracker) | forced RLS; cross-tenant id → 404; 409 on stale lockVersion |
| E5 | none | `POST /v1/ecns/:id/link`, `GET /v1/ecns/:id/links` | `EcnService.link`, auto-revise call into `DocumentsService.newVersion` (existing) + `packages/core/version-bump.ts` (pure) | `linked` (entity_links row) | `ecn:manage` (link); side-effect of `ecn:approve` (auto-revise) | existing `assertEntityVisible` (rule 8), unchanged |
| X1 | none | none | `apps/api/src/collab/entity-ref.ts`, `chat.ts`'s `ENTITY_SPECS`, `apps/web/.../graph-kinds.ts`, `search.service.ts`'s `KINDS`, `audit-signal.ts`'s `ENTITY_TOPIC`, new `complaint-sla` daily job (`apps/api/src/jobs/processors/`) | none new | `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/`ecn:approve` added to `packages/core/src/rbac.ts` per §2 X1 AC1 | n/a |

Every mutation runs inside `withAudit` in the same transaction (rule 3); both list endpoints are cursor-
paginated (rule 6); all new Zod schemas live in `packages/types` (rule 4); the complaint and ECN state
machines are `packages/core` pure functions (rule 5), never computed in a controller or a React component.
Reserved migration range for this sprint: **`0071`-`0072`** (0071 complaints + complaint_attachments + 8D
source columns + EntityKind/entity_links widening, 0072 ecns + ecn_approvals + EntityKind/entity_links
widening); `0073` held as buffer for a build-time correction, mirroring Sprints 04/05's own convention —
Sprint 07 takes `0074` onward.

## 5. Design needs

**Existing binding jsx — designer audits these against the built screens, does not redraw them:**
- `CustomerComplaints` (KPI strip, 4 tabs, register table, Intake channels/SLA matrix cards) — `qms-
  modules.jsx` lines 332-475.
- `IntakeForm` (the drawn create dialog) — `qms-modules.jsx` lines 477-523.
- `ECNList` (list table) — `qms-modules.jsx` lines 549-591.
- `ECNKanban` (7-column board) — `qms-modules.jsx` lines 593-633, **with the corrected 8th "Rejected" column
  the designer must add** (§3.2).

**NO existing jsx — designer must draw these, in the existing visual language, before Gate 1:**
1. **Complaint detail panel** (C3) — no board exists at all; the list rows are clickable but wired to nothing
   in the mock. Needs: field grid (KvField pattern, matching risk/instrument detail-card precedent), SLA state
   chip, attachments list, Acknowledge/Edit/Convert/Close actions.
2. **Complaint intake dialog's added fields** (C2) — `Contact` and `Channel` need a placement in the existing
   `IntakeForm` layout (a 2-column grid already exists; these fit as two more fields, likely alongside
   Customer/Severity at the top).
3. **ECN detail view w/ approval tracker** (E4) — no board exists at all; P19 §3 calls for one but the jsx
   never draws it. Needs: field grid, 4-row approval tracker (stage/decision/approver/decided-at), affected-
   records panel (reusing `LinkPicker`'s existing visual pattern from Sprint 04), Approve/Reject actions
   (visibly disabled, not merely 403'd, for a non-approver).
4. **ECN Kanban's 8th "Rejected" column** (§3.2) — a small, evidenced addition to the existing `ECNKanban`
   board, same visual treatment as the other 7 columns.
5. **ECN create-wizard Details step board** — no jsx anywhere shows ECN's Details-step fields (changeType/
   title/description/changeRisk/effectiveDate/owner) or the 3-step branch; a new board in the existing
   CreateWizard visual language, mirroring risk's R4 precedent board.
6. **6th CreateWizard Type-step card** — icon `GitBranch` (reuse, already established by `navigation.ts`), a
   color from the existing wizard palette distinct from the other 5 cards.
7. **Complaint register's convert-target picker** — the jsx's single "Link / Create NCR" button becomes a
   3-way choice (NCR/8D/CAPA); needs a small dropdown/menu affordance in the existing visual language, not a
   new full dialog.
8. **Kanban drag-and-drop visual states** (E2) — a draggable-card affordance for `ecn:approve` holders vs. a
   static (non-draggable, visibly so, not silently disabled) card for everyone else; no existing drag-and-drop
   precedent exists anywhere else in this codebase's board views to reference, so this is genuinely new
   interaction design, not a reskin.

## 6. Dead-end audit

| Control | Current state | This sprint |
|---|---|---|
| Sidebar "Customer complaints" (`/complaints`) | `PLANNED_MODULES["complaints"]` placeholder | Real register + KPIs + tabs (C1) |
| Sidebar "Engineering changes" (`/ecn`) | `PLANNED_MODULES["ecn"]` placeholder | Real List + Kanban (E1/E2) |
| `CustomerComplaints` "Log complaint" button | Opens `IntakeForm`, which submits nothing | Real create (C2) |
| `CustomerComplaints` row click (`cursor: pointer`, no `onClick`) | Dead in the mock itself | Real detail panel (C3, flagged §5) |
| `CustomerComplaints` "Link / Create NCR" button | `kToast` only | Real 3-way convert (C4) |
| `CustomerComplaints` "Public intake form" button | `kToast` (fake link-copy) | **Not built** — honestly excluded (§3.1), button removed/replaced with the real manual-intake-only reference card, never left as a fake copy action |
| `CustomerComplaints` "Intake channels" card's 4 non-manual "Active" channels | Fully fabricated status (no real integration exists, rule 10) | Reproduced as an honest, static, non-interactive reference card describing this tenant's manual-only posture — never a fake "Active"/"Connected" badge |
| `ECNWorkbench` "New ECN" button | `kToast` only | Real create via CreateWizard (E3) |
| `ECNList`/`ECNKanban` rows | No detail click-through drawn or wired | Real ECN detail view (E4, flagged §5) |
| `ECNKanban` cards | Static, no drag | Real drag-to-advance for `ecn:approve` holders (E2) |
| ECN "auto-revises affected documents" (header claim) | No mechanism anywhere | Real, transactional, `DocumentsService.newVersion`-based (E5) |
| ECN "Doc revision" stage (`ECNList` mock) | A mislabeled manual step that never existed as such | Corrected: it is the real, automatic auto-revise side effect (§3.2), not a 5th human stage |
| ECN reject path | Not drawn anywhere (`ECNKanban` has no "Rejected" column despite claiming "approval workflow") | Real, added: every gated stage can reject (E4), Kanban gains an 8th column (§3.2/§5) |
| "Affected parts" linking (P19's own text) | No `parts` table/`EntityKind` anywhere | **Not built** — honestly excluded (§1a/§3.2), no picker offers a fake "part" kind |

No new "coming soon" text, no new dead button. The two controls this sprint explicitly does **not** wire in
full (automated intake channels; parts linking) are each either removed/replaced with honest reference content
or omitted from their picker entirely, never left selectable-but-broken — CLAUDE.md rule 10 is "never stub,"
not "never say no."

## 7. Out of scope / open questions

- **Q28 (new).** Automated complaint-intake channels (public web form submission, customer-portal/EDI
  ingestion, email parsing, a customer extranet OAuth API) are not built this sprint — no vendor, no parser
  spec, no unauthenticated-endpoint security design exists anywhere (§3.1). This is the direct successor to
  Sprint 05's own LMS-connector exclusion (Q-T1) and Sprint 05's B9-adjacent reasoning: real vendor/external-
  facing work belongs to the ROADMAP Q5 wave (Sprint 13) or a dedicated future sprint with its own sign-off on
  auth, rate-limiting, and abuse protection — not silently built here, not silently dropped either (named
  here, in the dead-end audit, and in the DoD).
- **Q29 (new).** "Affected parts" linking on ECN is not built — no `parts` table or `EntityKind` exists
  anywhere in this codebase (§1a). A future sprint that introduces a real parts/BOM master table can extend
  ECN's `LinkPicker` to a third kind at that point; not invented here.
- **Q30 (new).** ECN's `role_required` per-stage approval gate is fixed and uniform (`admin`/`manager` at
  every one of the 4 gates) this sprint, resolving P19's own "fixed vs configurable" question as fixed
  (§3.2). Per-stage-distinct roles (e.g., "CAB requires admin only," "Pilot requires the plant manager") is a
  real, named future enhancement once a settings surface exists to configure it (Sprint 07's Workspace/Process
  settings wave is the natural home) — not silently built now with no UI, and not silently promised either.
- **Q31 (new).** `apps/web/src/features/graph/graph-kinds.ts`'s `GRAPH_KINDS` map gains real `complaint`/`ecn`
  entries purely to satisfy TypeScript's exhaustiveness check (widening `EntityKind` forces it), but neither
  kind will actually render in the knowledge-graph explorer this sprint — `apps/api/src/graph/graph.service.ts`
  keeps its own separate literal array, unchanged. This mirrors Sprint 04's own Q27 judgment call exactly (not
  a new inconsistency this sprint introduces) — wiring complaint/ECN into the graph explorer for real is a
  named future story, not silently started or silently claimed done here.
- **Q32 (new).** Sprint 04's own auditor-`ROLE_NAV` gap for `spc` (Q24, left open) and any other pre-existing
  RBAC-nav inconsistency from prior sprints are **not** touched or fixed here — this sprint only adds its own
  two new modules to auditor's/viewer's `Set`s, per the standing per-sprint pattern, and does not audit or
  retrofit earlier sprints' own nav grants.
- **Complaint cost tracking** (`cost_usd`) has no source-of-truth beyond manual entry this sprint (no
  integration with any finance/ERP system) — a future sprint could add a real cost-rollup mechanism (e.g.,
  summing linked NCR/CAPA action costs) if FEATURES ever specifies one; not invented here.
- Mobile: confirmed no `m-*.jsx` designs either module; both stay fully unaffected this sprint (no route, no
  nav, `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes only).
- **Merge-conflict hot spots (ROADMAP §4):** this sprint touches `packages/types/src/contract.ts`,
  `packages/types/src/enums.ts`, `packages/types/src/dto.ts`, `packages/types/src/realtime.ts`,
  `apps/web/src/config/navigation.ts` (no structural change, ids already exist), `planned-modules.ts`,
  `placeholder-ledger.ts`, `entity-routes.ts`, `apps/web/src/config/rbac.ts`, `apps/api/src/collab/
  entity-ref.ts`, `apps/api/src/ai/chat.ts`, `apps/api/src/realtime/audit-signal.ts`,
  `apps/api/src/search/search.service.ts` — one owner, rebase before PR, per the standing rule.

## 8. Definition of Done

- [ ] **User has explicitly approved §3** (complaints: schema, manual-only intake decision, SLA table, convert
      mechanism, added contact/channel fields; ECN: schema, the canonical 7-value stage machine replacing both
      jsx views' own inconsistent numbering, the fixed admin/manager-only approval role, the 4-value
      `change_type` enum, the real `newVersion`-based auto-revise mechanism and its partial-failure behavior,
      the "affected parts" exclusion) — build does not start before this.
- [ ] Migrations `0071_complaints.sql` (`complaints`, `complaint_attachments`, `eight_ds.source`/`source_id`,
      `EntityKind`/`entity_links` widening) and `0072_ecn.sql` (`ecns`, `ecn_approvals`, `EntityKind`/
      `entity_links` widening) applied; `pnpm db:check` green; `pnpm test:rls` green including both new
      tables and the widened `entity_links` kinds.
- [ ] `packages/core/customer-color.ts`, `complaint-sla.ts`, `state-machines/complaint.ts`,
      `state-machines/ecn.ts`, `version-bump.ts` all unit-tested — including `complaintSlaState`'s 75% boundary
      and "acknowledged late, stays breached forever" rule; `complaintMachine`'s "converts backward, status
      doesn't move" case; `ecnMachine`'s every legal/illegal transition, the four-eyes guard, the admin/
      manager-only guard, and every gated stage's ability to reject; `bumpMinorVersion`'s malformed-input case.
- [ ] `packages/core/src/codes.ts` gains `"complaint"`→`COM` and `"ecn"`→`ECN` `CodeKind` entries, unit-tested;
      created complaints/ECNs get real `COM-YYYY-NNNN`/`ECN-YYYY-NNNN` codes via the `counters` table.
- [ ] C1's summary formulas (Open, Critical, < 24h response % cohort rule, avg time to close, avg cost, all 4
      tab counts) are unit-tested against seeded fixtures, not eyeballed against the UI — including the
      zero-denominator "—" cases for each.
- [ ] Contract gains all routes in §4; `complaint:view`/`complaint:manage`/`ecn:view`/`ecn:manage`/
      `ecn:approve` enforced via `@RequireCapability`; RBAC grant matrix matches §2 X1 AC1 exactly (mobile RBAC
      config, if any, stays untouched since neither module reaches mobile).
- [ ] C2's attachment presign-then-link flow tested for the exact Sprint-05-precedented bypass case: a
      presign with `entity_kind` omitted must not be linkable via `attachmentFileIds` later (the `entity_kind`
      exact-match + `deleted_at IS NULL` double-check, §2 C2 AC1).
- [ ] C4's convert route tested for: the double-convert race (409, exactly one winner), the "converts to a
      chronologically earlier target" case (link created, status does not regress), and the 3-target coverage
      (NCR/8D/CAPA all real, reusing each module's own `.create()`, not a parallel mechanism).
- [ ] E4's approval route tested for: wrong-stage 422, self-approval 403, non-admin/manager 403, 409 on stale
      lockVersion, reject requiring a comment, and the two-entity audit split (ecn `status_changed` + ecn_
      approvals `updated`).
- [ ] E5's auto-revise tested end to end: an ECN with 3 linked documents (one `approved` with a clean "X.Y"
      version, one `approved` with a malformed version string, one not `approved`) reaching `implementation`
      real-calls `DocumentsService.newVersion` for the clean one only, and the approval response's
      `autoRevise.skipped` names the other two with their real reasons — browser-verified, not just unit-
      tested, since this is the sprint's own headline "not hand-waved" claim (CLAUDE.md rule 0).
- [ ] Web `/complaints` fully real: KPI strip (real formulas), 4 tabs (real counts), register table, intake
      dialog (incl. added Contact/Channel fields + attachments), detail panel (Acknowledge/Edit/Convert/Close),
      Intake-channels/SLA-matrix reference cards (honest, non-interactive), all empty/error/offline/permission
      states — browser-verified side-by-side against `qms-modules.jsx`'s `CustomerComplaints`/`IntakeForm`.
- [ ] Web `/ecn` fully real: List + Kanban (8 columns incl. Rejected) toggle, ECN detail view w/ approval
      tracker + affected-records panel, CreateWizard `ecn` type (3-step branch), drag-to-advance for
      `ecn:approve` holders (static, visibly non-draggable for everyone else), all empty/error/offline/
      permission states — browser-verified against `qms-modules.jsx`'s `ECNWorkbench`/`ECNList`/`ECNKanban`.
- [ ] Auditor's/viewer's web nav includes `complaints`/`ecn`; inspector's does not (browser-verified for all
      three roles, confirming inspector gets a client + server 403, not merely a hidden nav entry).
- [ ] `complaint`/`ecn` real search hits appear in the command palette for a subject/title keyword match,
      role-scoped correctly (inspector never sees a hit for either kind, since inspector holds neither
      capability at all).
- [ ] A second browser session's ECN Kanban board updates live when the first approves/rejects a stage
      (realtime topic wiring, X1 AC6), browser-verified with two sessions side by side.
- [ ] Placeholder ledger entries `"planned:complaints"`/`"planned:ecn"` removed; both removed from
      `PLANNED_MODULES`.
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded and proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` updated (Current status + Decisions log: manual-only intake exclusion and why, the SLA
      table values, the canonical 7-value ECN stage machine replacing both jsx views' inconsistent numbering,
      the `material` change-type addition, the fixed admin/manager-only approval role, the real `newVersion`-
      based auto-revise mechanism, the "affected parts" exclusion, the `customer_color` hash mechanism, the
      plain-FK (not composite) convert-link pattern, Q28-Q32) and `progress_mobile.md` gets an explicit
      "Sprint 06 — mobile unaffected" line.

## 9. Out-of-scope confirmation

No scope beyond P18/P19 + FEATURES §12 + `qms-modules.jsx`'s `CustomerComplaints`/`IntakeForm`/`ECNWorkbench`/
`ECNList`/`ECNKanban` components is introduced. `TrainingMatrix` and `CalibrationManagement` (the other two
components in the same jsx file) are already built (Sprint 05) and are not touched here except the standing
per-sprint config wiring (§2 X1) does not name them. NCR/8D/CAPA gain no new UI this sprint — they gain two new
loose columns (`eight_ds.source`/`source_id`) and a new caller (`ComplaintsService.convert`) into their
already-existing `.create()` methods, never a new parallel creation path or a reshaped existing route.
Documents gain no new UI or route either — `DocumentsService.newVersion` is called exactly as it already
exists, with no signature change. Automated complaint-intake channels (Q28) and ECN "affected parts" (Q29) are
named, explicit exclusions, not silently dropped scope.

---

**PO use-case sign-off: SIGNED.** Every use case (happy/error/empty/permission/offline/cross-tenant) across
C1-C4 (register/list/KPI, intake+attachments, detail+acknowledge+close, convert), E1-E5 (schema+list, Kanban,
CreateWizard, approval, affected-docs+auto-revise), and X1 (cross-cutting wiring) — **10 stories in total** —
maps to a story with testable acceptance criteria and an explicit Web/Mobile/Shared split. The dead-end audit
(§6) accounts for every control the jsx introduces,
including the mock's own pre-existing dead affordances (the complaint row's inert `onClick`, the ECN Kanban's
missing reject column); two designed-but-unbuildable elements (automated intake channels, ECN parts-linking)
are named and honestly excluded rather than faked. This covers **use-case coverage only** — it does **not**
constitute approval to write any code. §3's backend design and Gate 1 (UI Lead Designer audit + `planner`
architecture review) remain pending before any implementation may begin, per `SCRUM.md`'s ordering.
