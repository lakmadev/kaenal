# DESIGN-05 — Calibration management + Training & competency (web)

Author: UI Lead Designer. Date: 2026-09-29. Sprint: `docs/sprints/SPRINT-05-calibration-training.md`
§2 (C1-C6, T1-T4, X1), §5 (Design needs), §6 (Dead-end audit). Ceremony 2 (Design audit) of `SCRUM.md`.

**Scope note (mirrors DESIGN-04's own scope note):** `CalibrationManagement` and `TrainingMatrix`
(`project_brain/project/src/qms-modules.jsx` lines 176-319 and 1-174) are audited here, not redrawn —
they are binding jsx per `apps/web/docs/design-rules.md`. `CustomerComplaints` and `ECNWorkbench`
(same file) are Sprint 06's scope and are not touched. Backend math/schema (sprint file §3) is a
separate, still-**PENDING** user-approval gate this design work does not touch or depend on for
sign-off — no product code is written or changed by this pass.

Canvas (10 boards): **https://claude.ai/artifact/QW6WiXDaN7panCikLSRu2E**

---

## 0. Amendment follow-ups (2026-09-29, Ceremony 4 send-back response)

The product owner amended `SPRINT-05-calibration-training.md` (new "## 0. Amendment" section) to resolve
the `planner`'s architecture-review send-back (B1-B9). Two of the amendment's items were named as small
design follow-ups against this canvas, not new boards' worth of work (§5 items 8 and 9). Both are now
done, republished to the same canvas URL (version 4):

1. **§5 item 8 — Failed-calibration banner state (B3, C1).** B3's correctness fix means a `fail`
   calibration event overrides an instrument to `overdue` unconditionally, regardless of its computed
   `next_due` — so a failed-but-not-yet-date-overdue instrument can no longer share the plain
   date-overdue badge/banner without misreading as the lower-severity case. **Board 1 (`Main.dc.html`)
   gains State C**: a register-table legend contrasting all three severities (due-soon amber tint,
   date-overdue red **tint**, failed-overdue red **solid fill** — the same solid-danger treatment the
   board's own "Raise NCR" button already uses, so no colour outside `tokens.css` is introduced) and a
   solid-fill detail-card banner ("Failed its last calibration on {date} — out of service until
   recalibrated," with the explicit note that its own `next_due` does not apply while the latest result
   is a fail). Board height grew 1560→2000px; all boards stacked below it were shifted down by the same
   440px to keep the canvas's contiguous, non-overlapping layout (a purely mechanical move, no other
   board's content changed).
2. **§5 item 9 — Competency catalog admin surface, archive copy (B8, T5).** The amendment's new T5 story
   settled on `PATCH /v1/competencies/:id/archive`/`/unarchive` (a dedicated `archived_at` column, never
   a hard delete) — Board 9 (`CompetencyCatalogEditor.dc.html`), drawn before T5 existed, still showed a
   "Delete" action. Corrected in place: every row's destructive action is now **Archive** (plain
   `k-btn-ghost`, no danger-red styling — mirroring this codebase's own `document-detail.tsx` "Archive"
   transition control, the closest existing archive precedent, rather than `fmea-workbench.tsx`'s red
   "Delete this FMEA?" pattern, which is for a true irreversible delete); an archived-row example was
   added (muted row, "Archived" chip, "Un-archive" action, no confirm needed for reversing) so the
   symmetric un-archive path is visible, not just asserted. State C's confirm dialog copy was rewritten
   to state the exact, reversible consequence: *"Archive 'SPC fundamentals'? It stops appearing on the
   training matrix, coverage KPIs, gap calculations and due/expiry notifications from now on. 38
   members' existing training records against it are kept and stay visible in each member's own
   history — nothing is deleted. You can un-archive it at any time to bring it back."* — Cancel /
   **Archive competency** (neutral ink primary button, not danger-red, since this is not a destructive
   delete). Board height grew 900→1020px; only `TrainingEmptyState.dc.html` (the one board after it)
   shifted down to keep the stack contiguous.

No new colour, radius, font or component style was introduced by either change; both reuse patterns
already cited on this canvas or already built in `apps/web/src/features/documents/document-detail.tsx`
and `apps/web/src/features/fmea/fmea-workbench.tsx`. §4.9's original flag (the catalog editor itself
being a sprint-file design-needs omission) is now resolved: the amendment's new T5 story gives it a real
AC, so nothing about Board 9 remains conditional beyond this pass's own two copy/state corrections.

---

## 1. Audit — `CalibrationManagement` jsx vs. stories (qms-modules.jsx:176-319)

| jsx element (lines) | Story | Built today? | Notes |
|---|---|---|---|
| Header + "Audit pack"/"Add instrument" buttons (196-204) | C5/C6 | Not built — `/calibration` is `PLANNED_MODULES["calibration"]` (confirmed: `apps/web/src/config/planned-modules.ts:30` still lists it; no `apps/web/src/app/**/calibration*` route exists) | Both buttons are `kToast` only in the mock — real export (C5) and real create form (C6) replace them |
| KPI strip (207-219): Instruments tracked / Due<30d / Overdue / Out-of-tol findings YTD | C1 | Not built | Real counts replace the mock's static 184/12/3/4 (C1 AC5's exact formulas); the 4th tile's `#7c3aed` isn't a `tokens.css` value — substituted with `--slate-600` (`#475569`), same treatment DESIGN-04 gave the identical case (its Main.dc.html 4th KPI tile) |
| Instrument register (222-251): search + segmented All/Due soon/Overdue, table (ID/Instrument/Area/Next due/Status) | C1 | Not built | Cursor-paginated per rule 6, not shown in the static 8-row mock; plant-scope filter applies for a plant-scoped role (§1a) |
| Detail card — field grid (265-272) | C1 | Not built | Type/Area/Method/Tolerance/Last calibrated/Next due — direct 1:1 |
| Detail card — overdue banner (255-263) | C1 | Not built | **Audit finding, already named in SPRINT-05 §1a/§3.1 item 5 (Q-C1), independently reconfirmed this session** by grepping `inspections.jsx`/`ncr.jsx` for `calibrat\|instrument\|gauge`: zero UI controls in either, only one decorative activity-feed line (`inspections.jsx:703`). The banner's claim ("Measurements … are blocked at inspection sign-off") is not enforced anywhere and is corrected in-place on the board — **Board 1, State B** |
| Detail card — History table (274-297) | C1/C2 | Not built | Date/By/Result/Cert, 1:1; "last 5" is `GET .../calibration-events?limit=5`, not a separate endpoint (C2 AC3) |
| "Record calibration"/"Upload cert" buttons (300-301) | C2 | Not built | Both `kToast` only; the jsx has **zero** data-entry surface for calibration anywhere — new, **Board 2** |
| "⋯" button (302) | C4 | Not built | `kToast('Instrument options — history, retire, transfer')` — three named, real actions, none drawn — new, **Board 4** |
| Out-of-tol KPI's implied "N led to NCR" (212) | C3 | Not built | **Audit finding already named in the sprint file (§2 C3), reconfirmed here**: no button anywhere backs this sub-stat — an honest number with no control. New "Raise NCR" row action designed composed onto the existing history table, reusing `finding-raise-ncr-dialog.tsx`/`audit-findings-tab.tsx`'s expand-in-place → linked-chip pattern (independently verified in `apps/web/src/features/audits/` this session) — **Board 1, State B** |

**Independent verification of the sprint's own cross-check:** every jsx element maps to a story
(C1-C6). Nothing in the jsx is left uncovered. **Divergence count: 0** — `/calibration` renders
`ModulePlaceholder` today (no route exists), same pre-build posture as prior sprints' Ceremony-2
audits.

## 2. Audit — `TrainingMatrix` jsx vs. stories (qms-modules.jsx:1-174)

| jsx element (lines) | Story | Built today? | Notes |
|---|---|---|---|
| Header + "Skill gap report"/"Assign training" buttons (33-41) | T3/T2 | Not built — `/training` is `PLANNED_MODULES["training"]` (confirmed: `planned-modules.ts:29`; no route exists) | Both `kToast` only |
| KPI strip (44-56): Members tracked / Coverage / Expiring<30d / Overdue | T1 | Not built | Real formulas replace the mock (T1 AC7); "Overdue" tile keeps `#dc2626` (`--danger-600`, a real token) |
| Competency matrix (59-116): sticky member column, mandatory `*`, Legend, filter + segmented | T1 | Not built | Cell-state derivation is **corrected** per T1 AC2's mandatory-gap rule (§3.1 item 7) — reconfirmed this session by re-reading the mock's own `TRAINEES` array (lines 20-28): row `u3` shows `'—'` under the mandatory `8d` column (index 7), which under the corrected rule renders **gap (red)**, not the jsx's neutral grey dash. This is the one deliberate, sprint-approved pixel deviation from the raw jsx anywhere in this audit, reasoned in the sprint file and reproduced on **Board 6** |
| "Expiring & overdue" card (120-144) | T3 | Not built | Real rows from `GET /v1/training/gaps` replace the mock's fixed 5-row list (T3 AC1); "Schedule" button wired to T2's dialog, pre-filled |
| **"Linked e-learning" card (147-165)** | — | **Excluded** | Sprint file §3.1 item 11 / Q-T1: no vendor decision, no `integrations` provider whitelist entry (independently reconfirmed: `packages/db/migrations/0032_integrations.sql:22`'s CHECK has no LMS provider). Per rule 10, **omitted from the page**, not shown with a fake "Connected" badge — annotated on **Board 6**, not drawn as a real card |
| Matrix cell click-through / member history | T1 | Not built | **Audit finding already named in the sprint file (§5 item 5), reconfirmed**: the jsx has no click handler on any cell and no drawer anywhere in the file. New, full per-completion history + evidence — **Board 7** |
| Catalog CRUD (add/edit/delete a competency) | T1 (AC3/AC6) | Not built | **New audit finding, not named in SPRINT-05 §5's design-needs list** — see §4.9 below |

**Independent verification:** every jsx element maps to a story (T1-T4), with one card (Linked
e-learning) correctly excluded per an explicit, already-approved sprint decision, and one genuinely
new gap found beyond the sprint file's own §5 list (the catalog editor, §4.9). **Divergence count:
0** — `/training` also renders `ModulePlaceholder` today (confirmed: no route exists).

## 3. WCAG 2.1 AA + Nielsen heuristics — jsx-derived screens

Checked against the *built* pattern these screens will reuse (the raw jsx has no accessibility
semantics — it is a throwaway static prototype; `design-rules.md` binds pixels, not markup):

- **Contrast:** all colours are existing `tokens.css`/jsx values already AA-audited in FMEA/Risk
  (`ScoreBox`, chip family) — no new colour introduced (the one substitution, `#7c3aed` → `--slate-600`,
  is on-token, not new).
- **Focus order:** register table → detail card fields → history table row actions → footer buttons,
  matching `CalibrationManagement`'s own left-to-right layout; matrix → cell → drawer → footer CTA for
  `TrainingMatrix`, matching `GraphDetailDrawer`'s established order.
- **Labels:** every icon-only control (⋯ menu, ▲/▼ reorder buttons on Board 9, the drawer's close ✕)
  needs a real `aria-label` — the jsx has none anywhere (static prototype); called out per-board below
  for `react-coder`.
- **Touch targets:** all buttons reuse `.k-btn`/`.k-btn-sm` (34px/28px, already in `tokens.css`) — no
  new size. Matrix cells (22×24px visual swatches, unchanged from the jsx) must have their clickable
  hit area padded to ≥44×44px logical on touch/coarse-pointer input once they become real interactive
  elements (Board 6) — same flag DESIGN-04 raised for the risk heat-map cells, same underlying issue
  (a small decorative swatch becoming a real control).
- **Nielsen — visibility of system status:** the corrected overdue-banner copy (Board 1) and the
  matrix's real gap/expiring counts (replacing the mock's static numbers) are both direct fixes for
  the jsx's own unfulfilled or misleading claims (Q-C1's false "blocked" claim; the un-backed "N led to
  NCR" stat).
- **Nielsen — error prevention:** Retire (Board 4, State C) and catalog-delete (Board 9, State C) are
  both one-way/destructive actions and get an explicit confirm dialog naming the consequence, not a
  silent action; Raise-NCR (Board 1) gets the same treatment despite having no extra fields, since
  creating a real NCR is irreversible.
- **Nielsen — consistency:** every board reuses `.k-*` classes, `PageHeader`, `k-surface`, `k-chip`,
  `k-table`, the FMEA/Risk `ScoreBox`-family swatches, `GraphDetailDrawer`'s panel shell, and
  `AssigneePicker`'s search/select pattern — no new visual language anywhere in this sprint.

## 4. The nine new designs (+ one composed-onto-existing-jsx board) — rationale and WCAG/heuristic notes

All boards use only tokens already in `tokens.css` (ink accent `#18181b`, Archivo + JetBrains Mono,
3-9px radii, flat hairline shadows) — no new colour, radius, font or component style anywhere. Each
board places its nearest existing pattern's citation inline, per the "new design must follow existing
designs" check.

### 4.1 Calibration register + detail card, corrected banner + Raise-NCR (C1-C4) — Board `Main.dc.html`

State A reproduces the jsx pixel-for-pixel (KPI strip, register, detail card, default CAL-035
selection). State B composes the sprint's two approved changes onto the *same* detail-card layout
(not a separate screen): the corrected overdue-banner copy (§3.1 item 5) and the new "Raise NCR" row
action on a qualifying (`adjusted`/`fail`, no `ncr_id`) history row, plus the already-linked state
(a plain accent-coloured link replacing the button, mirroring the jsx's own "Cert" column
typography). Nearest existing pattern for Raise-NCR: `finding-raise-ncr-dialog.tsx` +
`audit-findings-tab.tsx`'s toggle-button → inline confirm → `LinkChip` sequence — simplified here to a
one-click confirm (no extra fields, matching C3 AC2's route contract, which takes none).
- *WCAG:* the register table's rows and the history table's action cells need real `<button>`/`<a>`
  elements (not styled `<div>`s), matching the jsx's own semantic gaps that every prior sprint's audit
  has flagged the same way.
- *Heuristic — error prevention:* Raise-NCR's confirm text names the exact consequence ("creates
  NCR-2026-XXXX … links it … can't be undone") before the irreversible write.

### 4.2 Record-calibration dialog + certificate upload (C2) — Board `CalibrationRecordDialog.dc.html`

No jsx reference — the jsx has zero data-entry UI for calibration (`kToast` only). Nearest existing
chrome: the same `qms-modules.jsx` file's own `IntakeForm` modal shape (rounded surface, grid fields,
Cancel/primary footer) plus the app's generic `Dialog` primitive. Four states: form, cert-uploading
(AV-scan-pending chip, matching the Files pipeline's existing gate), validation error (inline red
border + message), and offline (mutations disabled).
- *WCAG:* the Result field must be a real `role="radiogroup"` (pass/adjusted/fail), not a styled
  `<div>` segmented control — same note DESIGN-04 gave its own segmented pickers.

### 4.3 Add-instrument form (C6) — Board `InstrumentAddForm.dc.html`

No jsx reference (`kToast` only). Design decision already logged in the sprint file (C6, not gated): a
small dedicated modal, not the shared `CreateWizard` — mirrors the same reasoning already accepted for
CAPA's own create dialog and Sprint 04 M2's MSA wizard. Two states: the full 8-field form (name/type/
plant/area-cascade/method/tolerance/interval/owner) and the area-field's disabled-until-plant-chosen
state.
- *Heuristic — error prevention:* the disabled area select shows its blocking reason ("Choose a plant
  first") rather than a plain greyed-out control, matching DESIGN-04's MSA-grid precedent for the same
  pattern.

### 4.4 Instrument "⋯" menu — history / retire / transfer (C4) — Board `InstrumentOptionsMenu.dc.html`

No jsx reference beyond the single "⋯" button's toast text naming exactly three actions. Four states:
the menu itself, the full-history table (C2 AC3's unpaged route, paginated here), a Retire confirm
(destructive, named consequence, no "un-retire" per Q-C2), and Transfer (C1's own `PATCH` route with
plant/area pre-focused — no new backend concept, mirroring Sprint 04's "Re-score is the same PATCH as
Edit" precedent).
- *WCAG:* reorder/menu items are real list items with visible focus, not hover-only; the Retire confirm's
  destructive button needs `aria-describedby` pointing at the consequence text.

### 4.5 Calibration empty / loading / error / offline states (C1) — Board `CalibrationEmptyState.dc.html`

No jsx equivalent (always-populated mock). Four states: zero-instrument (`EmptyState` primitive,
matching `fmea-workbench.tsx`'s convention), loading skeleton, error/retry (matching
`risk-linked-records.tsx`'s inline pattern), and the offline banner (Sprint 01 infrastructure, reused
unchanged, disabling Add/Record/Retire/Transfer).

### 4.6 Training matrix + corrected mandatory-gap cells (T1/T3) — Board `TrainingMatrixBase.dc.html`

Reproduces the jsx pixel-for-pixel minus the excluded "Linked e-learning" card (§3.1 item 11, named
inline as an annotation, not drawn as a fake card) and with the mandatory-gap cell correction (§1's
audit finding above) applied. Adds the "Manage competencies" header button (new, §4.9) and a highlighted
cell showing the click-through affordance into Board 7.
- *WCAG:* matrix cells become real `<button>`s with a position+state `aria-label` ("S. Okafor, AIAG/VDA
  FMEA, gap — mandatory, never trained") once click-through is real — same class of fix DESIGN-04 made
  for the risk heat-map.
- *Heuristic — consistency:* the excluded LMS card leaves no visual gap — the remaining card keeps the
  jsx's own 2fr/1fr grid proportion rather than stretching to fill the missing slot, so the page reads
  as intentional, not broken.

### 4.7 Training matrix member drawer (T1) — Board `TrainingMemberDrawer.dc.html`

**The sprint's own headline new design.** No jsx reference — the mock has no click-through state for a
cell or a member's own history. Per the PO's explicit brief, this is a **full per-completion history
table**, not a single current-status row — the sprint file's own T1 AC1 reasoning ("the FE spec's own
'member drawer (records + evidence)' needs multiple historical rows with their own evidence files")
is the direct source of this board. Nearest patterns: `graph-detail-drawer.tsx`'s right-side slide-in
shell (header w/ icon+title+close, scrollable body, footer CTA), and — per the sprint file's own note
that `training_records` "matches `calibration_events`' own precedent in this same sprint" (§2 T1 AC1)
— the row shape is `CalibrationManagement`'s own History table verbatim (Date/…/evidence link),
grouped per competency with a state chip. Shows: gap (no record), expiring (two real history rows,
newest = current), certified (single row), and N/A (optional, unassigned) — all four of T1 AC2's cell
states represented in one member, plus a footer "Record training" CTA gated on `training:manage` and
a one-line empty variant (zero records at all).
- *WCAG:* the drawer traps focus and returns it to the triggering cell on close (matching
  `GraphDetailDrawer`'s existing behaviour); evidence links are real `<a>`s, not styled spans.
- *Heuristic — recognition over recall:* each competency group shows its current-state chip *and* its
  full history inline, so the user never has to remember why a cell is coloured the way it is.

### 4.8 Record-training dialog — assign + schedule (T2) — Board `TrainingRecordDialog.dc.html`

No jsx reference (`kToast` only, two call sites: "Assign training" and a row's "Schedule"). Per the
sprint's own resolved interpretation (§2 T2, flagged for sign-off): assign and record-a-completion are
the *same* dialog and action this sprint — no fifth "pending/assigned" cell state exists (Q-T2). State A
is the multi-member "Assign" variant, reusing `AssigneePicker`'s search/select/highlight pattern
(already this canvas's citation, first established in DESIGN-04 §4.6). State B is the pre-filled,
partially-locked "Schedule" variant opened from an Expiring/overdue row.
- *WCAG:* the member multi-select must be a real listbox with `aria-multiselectable`, not a styled div
  list — matching the note already given for `AssigneePicker`'s own accessibility posture.

### 4.9 Competency catalog editor — **audit finding, no sprint §5 mention** (T1 AC3/AC6) — Board `CompetencyCatalogEditor.dc.html`

**Independently found this session, not named in `SPRINT-05-calibration-training.md` §5's
design-needs list.** T1 AC3 specifies real `POST /v1/competencies` and `GET/PATCH /v1/competencies/:id`
routes, and T1 AC6 states the seeded 9-row catalog is tenant-owned and editable ("a tenant can
edit/delete/add to it") — but no jsx shows a catalog-management screen (`TrainingMatrix`'s columns are
read-only display of a hardcoded array) and the sprint file's own §5 list of six design-needs items
does not include one. Per rule 10, a specified create/edit/delete route with no UI caller anywhere is
exactly the same class of gap DESIGN-04 found with the entity-link-creation picker (§4.6 of that
doc) — **designed here, flagged for the PO/planner's disposition, not silently built around.** Entry
point: a new "Manage competencies" ghost button on the Training page header (Board 6), gated
`training:manage`. Nearest existing pattern: `risk-controls-editor.tsx` (R2) — inline add/edit rows,
chip-style mandatory toggle, Up/Down reorder buttons (not drag-only, per that board's own established
WCAG fix), empty state, and a delete-confirm naming the consequence for a competency with existing
training records.
- *WCAG:* reorder buttons need `aria-label`s ("Move IATF 16949 awareness up"); the mandatory toggle is
  a real 2-state control (`aria-pressed` or a radio pair), not a styled div.
- *Heuristic — error prevention:* deleting a competency with existing `training_records` shows the
  affected-member count and states explicitly that history is kept but the column drops from the
  matrix — never a bare "Are you sure?".
- **Flag for the PO/planner:** same disposition DESIGN-04 gave its own found gap (§4.6 there) —
  recommend the architecture-review pass explicitly scope a `CompetenciesEditor` component + its list/
  create/update hooks as part of this sprint's vertical slice, not assume "the routes exist, wiring is
  trivial."

### 4.10 Training empty / loading / error / offline / permission states (T1) — Board `TrainingEmptyState.dc.html`

No jsx equivalent. Five states: zero-competency-catalog, zero-members, loading skeleton, error/retry +
permission-hidden note (mirrors X1's risk/msa nav-curation precedent exactly), and offline + view-only
(training:view without training:manage — matrix/drawer stay fully readable, only Assign/Schedule/
Manage/Record affordances are hidden or disabled).

## 5. Component/state inventory (existing patterns only)

- `PageHeader`, `k-surface`, `k-chip`, `k-overline`, `k-btn`/`-primary`/`-ghost`/`-sm`, `k-input`,
  `k-table`, `mono` — reused verbatim throughout every board.
- `EmptyState` primitive (`fmea-workbench.tsx`'s convention) — Boards 5 and 10.
- `GraphDetailDrawer`'s right-side slide-in shell — Board 7 (the sprint's headline new design).
- `finding-raise-ncr-dialog.tsx` / `audit-findings-tab.tsx`'s toggle → confirm → linked-chip sequence —
  Board 1 State B (Raise NCR).
- `risk-controls-editor.tsx`'s inline add/edit row list + Up/Down reorder — Board 9 (competency
  catalog editor, this pass's own audit finding).
- `AssigneePicker`'s search/select/highlight pattern — Board 8 (multi-member assign).
- `CalibrationManagement`'s own History table shape, reused for the training member drawer's rows per
  the sprint file's own stated parallel (§2 T1 AC1) — Board 7.
- Global stale-write dialog (Sprint 01) — reused unchanged for every `lockVersion`-guarded mutation
  (PATCH/retire/record) across both modules; no calibration/training-specific dialog.
- Offline banner (Sprint 01) — reused unchanged; disables all mutation affordances per the UC tables.

States covered across both stories' full surface: default/populated, loading (skeleton), empty
(zero-instrument, zero-competency, zero-member), error/retry, permission-hidden (nav curated + server
403, X1), offline (mutation-disabling banner), stale-write (409 → existing global dialog), the five
training cell states (ok/warn/overdue/gap/na, all shown in Board 7), and destructive-action confirms
(retire, competency delete, raise-NCR).

## 6. Mobile

Confirmed independently, not deferred to the sprint file's own word: re-grepped
`project_brain/mobile/src/m-*.jsx` for `calibrat|gauge|instrument` this session — the five hits
(`m-oversight.jsx:20`, `m-work.jsx:24/134/139`) are all incidental mock copy inside unrelated document/
inspection screens, none rendering an instrument register, a due-date badge, or a training-gap
indicator. **No mobile screens are designed here. Mobile stays fully unaffected by this sprint** — no
route, no nav entry, no board, matching the sprint file's own §1a/§7 confirmation.

## 7. Sign-off

Every screen/state of `CalibrationManagement` (§1) and `TrainingMatrix` (§2) is mapped to a story with
no uncovered jsx element and 0 divergence (neither module is built yet — confirmed by route-glob and
`planned-modules.ts`, not assumed). **Ten boards** are drawn in the existing visual language: two audit
the binding jsx and compose the sprint's approved new interactions onto it (Boards 1 and 6), and eight
have no jsx precedent — seven named in the sprint file's own §5 design-needs list (Boards 2-5, 7-8, 10)
and **one found independently this session and not named in §5** (Board 9, the competency catalog
editor required by T1 AC3/AC6). Every control across both modules has a target behaviour already named
by the PO in `SPRINT-05-calibration-training.md` §2's ACs; this design pass adds no new behaviour, only
the visual surface for behaviour the PO already specified, plus the one flagged gap above. WCAG 2.1 AA
and Nielsen heuristics are checked for the jsx-derived screens (§3) and all ten boards (§4).

One item was flagged, not blocking, mirroring exactly how DESIGN-04 flagged its own found gap
(§4.6/§7 of that doc):

- **§4.9's competency-catalog-editor gap** — **now resolved.** The `planner`'s architecture review
  (Ceremony 4) sent the sprint file back and the PO's amendment (§0 above) added story **T5**, giving
  Board 9's archive/reorder controls real ACs (`archive`/`unarchive`/atomic `order` routes,
  `archived_at`, the shared `archived_at IS NULL` predicate everywhere). This pass (§0 above) corrected
  Board 9's copy to match T5's real actions (Archive, not Delete) and added the two small follow-ups
  the amendment itself named (§5 items 8-9). Nothing about Board 9 remains conditional.

**Designer sign-off: APPROVED**, unconditionally — every screen/state of both modules across all ten
boards is mapped to a story with a named target behaviour, the one prior flag is resolved by the PO's
own amendment, and this session's two follow-ups (failed-calibration banner state, archive confirm
copy) are done and republished to the same canvas URL.

Gate 1 (user approves new visual design before implementation) is open for the user's review of the
10-board canvas above. Backend sign-off (sprint file §3 — the instrument/calibration-event schema, the
training-record-as-history-table schema, the mandatory-gap cell rule, the due/overdue and expiry math,
the certificate/evidence attachment pattern, and the LMS-panel exclusion) remains a **separate,
still-PENDING** gate this design work does not affect either way. Build does not start until this
design's Gate 1, §3's backend gate, and (for anything non-trivial) the `planner` agent's
architecture-review pass — which should explicitly pick up the §4.9 flag — all have user approval, per
`SCRUM.md` and the sprint file's own DoD §8 and closing status line.
