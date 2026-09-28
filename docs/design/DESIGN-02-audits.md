# DESIGN-02 — Audits module (web)

Author: UI Lead Designer. Date: 2026-09-27. Sprint: `docs/sprints/SPRINT-02-audits.md`.
Canvas (5 genuinely undesigned items → 4 new boards): https://claude.ai/artifact/N7JxTGuoZD48hD5iuzQmnx

This audit re-verified every "no binding jsx" claim in the PO's sprint doc against
`project_brain/project/src/*.jsx`, `project_brain/mobile/src/m-*.jsx`, and the built codebase myself —
the PO is not authoritative on design. All five claims held up; findings and citations below.

## 1. Audit table — screen/state → existing jsx or new board

| Story | Screen / state | Existing jsx (cite exact lines) | New board | Divergence (built vs jsx) |
|---|---|---|---|---|
| S2-1 | Audit list (KPI strip, filters, cards) | `audits.jsx` `AuditList` 23-118, `AuditCard` 120-177 | — | `/audits` is `ModulePlaceholder` today (`apps/web/src/app/(app)/audits/page.tsx`) — 100% divergent, not yet built |
| S2-1 | Audit frequency chart | `audits.jsx` `AuditFrequencyChart` 179-208 | — | Not built (placeholder) |
| S2-1 | Schedule view (`?view=schedule`) | **None.** `audits.jsx:51`'s "Schedule view" button calls `setRoute('inspections-schedule')` — verified myself, it is a copy-paste artifact pointing at the INSPECTIONS schedule, not an audit screen | **Board: "S2-1 — Audit schedule view"** | Not built; nav child already exists and is dead (`navigation.ts:123`) |
| S2-2 | Detail header, phase tracker, sidebar | `audits.jsx` `AuditDetail` 213-374, `DetailRow`/`SummaryStat` 376-392 | — | Not built |
| S2-2 | Team & Plan tab | `audits.jsx` `AuditTeamTab` 529-567 | — | Not built |
| S2-2 | Evidence tab | `audits.jsx` `AuditEvidenceTab` 569-600 | — | Not built. Backend reuse only (`FilesService`); no existing web component renders this exact multi-file table shape yet — closest precedent is the single-attachment `FileDrop` (`apps/web/src/features/documents/file-drop.tsx`), not a match, so this table is newly *built* from the jsx even though the jsx itself is the binding design (no new board needed) |
| S2-2 | Report tab | `audits.jsx` `AuditReportTab`/`ReportSection` 602-655 | — | Not built. "Send to auditee" explicitly out of scope (Q10) |
| S2-3 | Create Audit dialog | **None.** Verified: `createwizard.jsx` `ENTITY_TYPES` (grepped, line 6 on) has no `audit` key — its one `audit` string (line 30) is an NCR source-selector label ("Audit finding"), not a wizard entry. `packages/core/src/create-wizard.ts:23` confirms `WizardType = "inspection" \| "ncr" \| "8d" \| "document"` — audit is not one | **Board: "S2-3 — Create Audit dialog"** | Not built |
| S2-4 | Checklist tab | `audits.jsx` `AuditChecklist` 403-492, `CHECKLIST_STATUS` 394-401 | — | Not built |
| S2-5 | Findings tab (list, linked chips) | `audits.jsx` `AuditFindingsTab` 494-527 | — | Not built |
| S2-5 | Raise NCR / Raise CAPA from finding | **None** — `audits.jsx`'s Findings tab renders only existing findings, no raise-action markup at all | **Board: "S2-5 — Raise NCR/CAPA from finding"** | Not built |
| S2-5 | Manual "Add finding" form | **None** — no add-affordance anywhere in `audits.jsx` | **Board: "S2-5 — Manual Add finding form"** | Not built |
| S2-6 | Search/palette/notification click-through, dead-nav retirement | No screen (infrastructure) | — | `entityHref("audit", id)` → `null` today (`entity-routes.ts:38`), confirmed |

Counts: **10 existing-jsx screens/sub-views audited** (S2-1 list+chart, S2-2 detail+3 tabs, S2-4 checklist,
S2-5 findings list) · **4 new boards published** · **0 diverged** (nothing is built yet for this module — every
row above is "not built", not "built-wrong"; the whole module is currently `ModulePlaceholder`, so there is no
existing implementation to diverge from). This is a pure "build from spec" sprint, not a fix-divergence one.

## 2. Verification of the PO's 5 "no design" claims (my own re-check, not deference)

1. **Create Audit form** — confirmed no `ENTITY_TYPES`/`WizardType` entry exists (citations above). I checked
   the CAPA precedent directly: `apps/web/src/features/capa/capa-create-dialog.tsx` is a `Dialog`-based create
   flow for a type that was *also* never added to `WizardType` (CAPA is a per-entity dialog "Q1 decision" —
   `apps/web/src/components/shell/quick-create.tsx:16`). Audit should follow this exact precedent, not invent a
   new pattern. Designed as a modal dialog (see board), not a wizard step.
2. **Schedule view** — confirmed `audits.jsx:51` navigates to `inspections-schedule`. I read
   `apps/web/src/features/inspections/schedule-view.tsx` in full; its own doc-comment (line 18) already says
   *"Audits share this calendar in the prototype, but that module isn't built yet, so this is inspections-only"*
   — independent confirmation this was always meant to be shared/extended, not a one-off. Designed the audit
   schedule board directly on this file's month-grid structure (day cells, event pills, nav controls, Today
   button), swapping the inspections status-legend (scheduled/completed/overdue) for an **audit-type legend**
   (Internal/Supplier/Customer/Certification/Gap, `AUDIT_TYPES` hex values) since the sprint doc calls for
   type-coloring and every other audits.jsx surface (cards, phase bars) colors by type, not status. I also
   dropped the recurring-series indicators (`Repeat` icon, "Occurrence" chip) — audits have no
   `recurrence`/`seriesId` concept in this sprint's schema, so porting them would be a fabricated affordance.
3. **Raise-NCR/Raise-CAPA mini forms** — confirmed no dialog is drawn in `audits.jsx`. I found the real seam to
   mirror: `apps/web/src/features/inspections/inspection-detail.tsx`'s `FindingsTab` (`raiseNcr`, lines 272-282)
   raises an NCR from an inspection finding today — but as a **zero-form single click** (priority silently
   defaulted from severity, title sliced from description). That precedent does NOT fully fit here: the audit
   endpoints' bodies (`RaiseNcrFromFindingBody`/`RaiseCapaFromFindingBody`, `packages/types/src/dto.ts:921-933`)
   require an explicit `priority` and, for CAPA, an explicit `type` (`corrective`/`preventive`) with no natural
   default to infer silently. So I designed a **small inline mini-form** (not a modal — matching this app's
   existing convention of expanding forms in place, e.g. the same file's "Record finding" toggle) that opens
   under the finding card: Type (CAPA only) + Priority (pre-filled from severity, still changeable) + optional
   title override, Cancel/Submit. One shared shape for both raise flows, differing only by the Type field and
   button label. The board also shows the already-linked state (no buttons, just the reference — the backend's
   existing 409-on-double-raise guard is surfaced, not re-invented, per the sprint doc).
4. **Manual "Add finding" form** — confirmed `AuditFindingsTab` only renders existing findings. Designed as a
   direct mirror of the same file's "Record finding" toggle-form pattern (`inspection-detail.tsx:251,289-309`):
   a header toggle button that expands an inline `k-surface` form (Clause, Kind, Due date, Description →
   "Record finding"), not a new modal pattern.
5. **Audit icon glyph** — decided **against** porting the custom SVG (`audits.jsx:17`, a clipboard+check shape).
   That shape is visually identical to lucide's `ClipboardCheck`, which `entity-routes.ts:47` already assigns to
   `inspection` — reusing it for `audit` would make two different entity kinds render the same glyph in search
   results and notifications. Instead: `entityIcon("audit")` → lucide **`ShieldCheck`**, which is *already* the
   icon the current `/audits` `ModulePlaceholder` page uses (`apps/web/src/app/(app)/audits/page.tsx:2,8`) —
   zero new icons introduced, maximum reuse of an existing, already-shipped decision. (Note for the record, not
   a blocker: `navigation.ts:118` currently gives the Audits sidebar entry `ClipboardList`, which is also CAPA's
   `entityIcon` — a pre-existing minor inconsistency, out of scope to fix in this sprint since it isn't part of
   any story here.)

## 3. Component/state inventory (existing `.k-*` patterns reused, nothing new introduced)

`k-surface`, `k-btn`/`k-btn-primary`/`k-btn-ghost`/`k-btn-sm`, `k-chip`, `k-input`, `k-table`, `k-link`, `mono`
(JetBrains Mono), Archivo body font, ink accent `#18181b`, 3-9px radii (`--r-sm`…`--r-2xl`), flat hairline
shadows — all four new boards use only these, per tokens.css (verified against the file directly). States
covered per board:

- **Create Audit dialog**: default/filled form only (a dialog has no loading/empty state of its own); validation
  and permission-gating are behavioural, not visual — engineer wires `Field` error text exactly as
  `capa-create-dialog.tsx` does.
- **Schedule view**: populated month grid shown; loading/error/empty states are NOT re-designed here because
  `schedule-view.tsx` already defines them (`Skeleton`, `EmptyState` "Nothing scheduled", `EmptyState` "Couldn't
  load the schedule") — the audit schedule reuses that file's states verbatim, only the data source and legend
  change.
- **Raise-from-finding**: three states on one board — raisable (buttons), mid-raise (expanded mini-form),
  already-linked (reference only, no buttons). Permission-hidden state = the raise buttons simply absent for
  `audit:view`-only roles (same pattern as `inspection-detail.tsx`'s `canRaiseNcr` gate) — no new visual needed.
- **Add finding**: collapsed (toggle button) and expanded (form) states shown together on the board.

Loading/empty/error/offline/stale-write states for the list, detail, and checklist screens are **not** newly
designed — they reuse existing generic primitives (`Skeleton`, `EmptyState`, the Sprint 01 offline banner and
stale-write reconcile dialog) exactly as the sprint doc's UC sections specify; no jsx or board needed for a
generic primitive already in the system.

## 4. Mobile — verified, not deferred to the PO's word

Grepped `project_brain/mobile/src/m-*.jsx` for "audit" myself:

- `m-oversight.jsx` / `m-home.jsx`: the tenant-wide **audit LOG** ("Audit highlights", "audit trail") — an
  unrelated oversight/compliance-log feature, already built as `apps/mobile/src/app/(app)/audit.tsx` (its own
  comment: "the admin's read-only audit-log feed").
- `m-ncr.jsx`: "Auditor verification" — a capability label on NCR verification, not this module.
- `m-work.jsx`, `m-tablet.jsx`, `m-auth-extra.jsx`: incidental uses of the word "audit" (a work-item title, a
  role name), none of them screens for this QMS audits module.

No `m-audits.jsx` or equivalent exists anywhere. **Confirmed: mobile is genuinely unaffected by this sprint.**
No mobile board is needed, and none was made.

## 5. Sign-off

Every screen/state of every story on the web surface is now either mapped to existing binding jsx (10 screens,
table in §1) or has an approved-pending board (4 new boards, canvas above). Mobile requires nothing this sprint
(verified in §4). One open technical question for the architect (§6) does not block design sign-off — it is a
build-sequencing question, not a visual one.

**Designer sign-off: APPROVED** (pending the user's visual sign-off on the 4 new boards before Gate 1, per
SCRUM.md — the boards are ready for that review now).

**Gate 2 confirmation (2026-09-28): APPROVED — built screens match the approved boards.** One minor,
non-blocking divergence found and logged in §6a (Add-finding toggle button doesn't flip its label/icon
to "Cancel" when expanded, unlike the board and its cited precedent). Everything else — Create Audit
dialog, Schedule view (incl. the 5-series legend), and all 3 Raise-NCR/CAPA states — reproduces the
approved boards exactly, with no new colours, radii, fonts or component patterns introduced.

## 6a. Gate 2 — built-vs-approved-boards confirmation (2026-09-28)

Re-read all 4 approved boards from the canvas (`CreateAuditDialog.dc.html`, `AuditSchedule.dc.html`,
`RaiseFromFinding.dc.html`, `AddFinding.dc.html`) and diffed each against its built component. A
web-fidelity-reviewer already ran the pixel/WCAG pass against `audits.jsx` itself (one dead-button
bug, now fixed) — not re-derived here; this pass is scoped to my own 4 boards only.

| Board | Built component | Result |
|---|---|---|
| Create Audit dialog | `apps/web/src/features/audits/audit-create-dialog.tsx` | Matches: dialog (not wizard), Title/Type/Standard/Plant/Location/Description, repeatable Scope chips, Start/End date, Lead auditor, Team + Auditees chip-multiselects, Cancel/Create audit footer. No new pattern introduced. |
| Schedule view | `apps/web/src/features/audits/audit-schedule-view.tsx` | Matches: Prev/Today/Next, Month/Week/List segmented control, 5-type legend (incl. `gap`, per §7 addendum), month grid with type-coloured pills, no recurring-series affordances (per §2.2). Loading/empty/error reuse `Skeleton`/`EmptyState` as specified. |
| Raise NCR/CAPA from finding | `apps/web/src/features/audits/finding-raise-ncr-dialog.tsx`, `finding-raise-capa-dialog.tsx`, wired in `audit-findings-tab.tsx` | Matches all 3 board states: raisable (buttons), mid-raise (inline mini-form, Type only for CAPA, Priority pre-filled from finding kind, optional title override, Cancel/Submit), already-linked (`LinkChip` reference, no buttons — the 409 guard is server-side as specified). |
| Manual Add finding form | `AddFindingForm` in `audit-findings-tab.tsx` | Fields match (Clause, Kind, Due date, Description, Cancel/Record finding). **One minor divergence found:** the board's header toggle button reads "Cancel" with an X icon when the form is expanded, mirroring the cited precedent (`inspection-detail.tsx:290`, `{adding ? "Cancel" : "Record finding"}`). The built toggle (`audit-findings-tab.tsx:54-55`) stays a static "Add finding" + `Plus` icon in both collapsed and expanded states — it does not flip to "Cancel". Functionally harmless (the inline form has its own Cancel button and the same header button still collapses it on a second click), but it is a real, avoidable inconsistency with both the approved board and the precedent pattern the board explicitly cites. **Flagged, not blocking**: small enough to fix inline in the next audits touch, not worth reopening Gate 2 for. |

**Counts (Gate 2 scope, my 4 boards only): 4 boards reviewed · 4 built · 3 exact-match · 1 with one
minor, non-blocking label/icon divergence** (Add finding toggle button text/icon).

## 6. Flag for the architect (`planner`) — S2-3 wizard-vs-dialog hook-in

Technically sound as scoped, but two things the architecture review should weigh in on explicitly, since they
affect *how* S2-3 is built, not what it looks like:

1. The sprint doc's Web section for S2-3 says `WizardType` is **not** extended and audit stays a dialog — I
   agree with this (§2.1 above), but flag that `quick-create.ts`'s `QuickCreateTarget` union
   (`"inspection" | "ncr" | "8d" | "document" | "capa"`) will need `"audit"` added, with an entry shaped exactly
   like CAPA's (`{ id: "audit", labelKey: "newAudit", icon: ShieldCheck, capability: "audit:manage", href:
   "/audits?new=1" }`) — the architect should confirm the `?new=1` query-param-opens-dialog convention is the
   right wiring (it's CAPA's existing convention, `quick-create.ts:22` + `/capa?new=1`) rather than a bespoke
   audit-only mechanism.
2. `apps/web/src/components/shell/quick-create.tsx:16`'s comment says CAPA is deliberately excluded from *that*
   menu ("CAPA is a per-entity dialog … so it is never in this menu") — the architect should confirm whether
   audit follows CAPA into that same exclusion (probably yes, for consistency) or needs to appear there too,
   since the sprint doc's AC1 says "list header AND command-palette quick actions" but doesn't mention this
   specific shell menu by name. Small, but worth the architect naming explicitly rather than an engineer
   guessing mid-build.

## 7. Addendum (architecture-review gap) — frequency chart's 5th series (`gap`)

Flagged by the `planner`: `audits.jsx`'s `AuditFrequencyChart` (179-208) only stacks 4 series —
`internal`/`supplier`/`customer`/`certification` (`colors` map, line 183) — but the sprint's corrected
`AuditType` enum (S2-3 AC3) is 5 values: it drops `process` and adds both `customer` *and* `gap`. `customer`
was already accounted for in the jsx's `colors` map; `gap` genuinely has no series anywhere in the existing
chart design.

**Decision: add a 5th stacked series for `gap`, not exclude it.**

Rationale: excluding a real, storable audit type from the one chart whose whole job is showing audit-frequency
completeness would misrepresent the programme's actual audit load — the opposite of what an IATF/ISO
frequency report is for. Every other audits.jsx surface (cards, phase-progress bars, list-filter dropdown)
already treats all 5 types uniformly; carving `gap` out of just the chart would be a new, undocumented
inconsistency, not a simplification. "Gap audits are rare/informal" is not a defensible reason to omit them —
rare series are exactly what a stacked bar handles fine (a thin or absent segment some months), and if gap
audits are genuinely too infrequent to plot, that shows up correctly in the data, not by hiding the category.

**Token used — no new colour introduced:** `AUDIT_TYPES.gap.color` in `audits.jsx:9` is already `#475569`,
which is exactly tokens.css's `--slate-600` (`project_brain/project/styles/tokens.css:47`). This is the same
value I already used for the "Gap Analysis" legend swatch on the new Schedule-view board (§1), so the 5th
series is consistent both with the existing jsx's own colour choice and with this sprint's one new board that
already renders a 5-type legend. Engineer adds `gap: '#475569'` to the chart's `colors` map and includes it in
the `items` stack alongside the other 4 — no new board, no new token, no visual redesign needed.
