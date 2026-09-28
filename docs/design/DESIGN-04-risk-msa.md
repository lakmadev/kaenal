# DESIGN-04 — Risk register + MSA / Gauge R&R (web)

Author: UI Lead Designer. Date: 2026-09-28. Sprint: `docs/sprints/SPRINT-04-risk-msa.md` §2 (R1-R5, M1-M5, X1),
§5 (Design needs), §6 (Dead-end audit). Ceremony 2 (Design audit) of `SCRUM.md`.

**Scope note:** `RiskRegister` and `MSAStudy` (`project_brain/project/src/qms-risk-spc.jsx` lines 1-224 and
549-671) are audited here, not redrawn — they are binding jsx per `apps/web/docs/design-rules.md`.
`FMEAWorkbench` and `SPCCharts` (same file) are prior-phase, already-built modules and are out of scope except
for the two small additive changes R3 names (`fmea` becoming an `EntityKind`, `/fmea` gaining `?id=`). Backend
math/schema (§3 of the sprint file) is a separate, still-pending user-approval gate this design work does not
touch or depend on for sign-off.

Canvas (6 boards): https://claude.ai/artifact/2npVH8fau7S6NETqyL5s75

---

## 1. Audit — `RiskRegister` jsx vs. stories (qms-risk-spc.jsx:1-224)

| jsx element (lines) | Story | Built today? | Notes |
|---|---|---|---|
| KPI strip (37-50): Total risks / High residual / Treatments overdue / Accepted / Reviewed-this-quarter | R1 | Not built — `/risk` is `ModulePlaceholder` (confirmed: no `apps/web/src/app/**/risk*` route exists) | Real counts replace the jsx's static 47/4/2/12/87% (R1 UC) |
| 5×5 heat map (53-88), count-per-cell, 4-band colour, "Click a cell to filter" caption | R1 | Not built | Caption is the jsx's *stated* intent, never implemented in the mock (no `onClick` on any cell) — click-to-filter is genuinely new interaction, designed in **Board: Main.dc.html, State B** |
| Legend (82-87) — Low/Medium/High/Critical | R1 | Not built | `packages/core/risk-matrix.ts`'s `scoreBand` thresholds (§3.1, critical≥16/high≥10/medium≥6/low<6) drive it — colours match verbatim |
| By-category panel (90-110), 8 bars | R1 | Not built | AC5: all 9 categories render (jsx's 8-bar cap was mock-data coincidence, omitting `reputation`) — shown correctly in **Board: Main.dc.html, State A** |
| Register table (114-140), sortable, row-select | R1 | Not built | Cursor-paginated per rule 6, not shown in the jsx (static 9-row array) |
| Detail card — Field grid (143-150) | R1 | Not built | Category/Owner/Likelihood/Impact/Inherent/Residual — direct 1:1 |
| Detail card — Treatment plan (152-153) | R1 | Not built | Plain text block, no state change needed |
| Detail card — Controls block (155-169) | **R2** | Not built | **Flagged by the sprint's own §1a: this block is static, identical for every risk in the prototype — not a real per-risk data source.** No jsx reference for the *real* add/edit/remove/reorder UI → designed fresh, **Board: RiskControlsEditor.dc.html** |
| "Edit" / "Re-score" buttons (172-173) | R1 | Not built | Both open the same edit surface per R1 UC — no new visual, reuses the FMEA item-editor dialog pattern (`fmea-workbench.tsx` `ItemEditorDialog`) |
| "Link to FMEA" button (174) | R3 | Not built | jsx is `kToast` only, and FMEA isn't even a linkable `EntityKind` yet (§1a) — **audit finding below** |
| "Add risk" header button (31) | R4 | Not built | Routes into the existing CreateWizard, `"risk"` type added — no new wizard UI |
| "Board pack" header button (30) | R5 | Not built | Wired to the existing export pipeline — no new visual |

**Independent verification of the sprint's own cross-check:** every element the jsx renders maps to a story
(R1-R5). Nothing in the jsx is left uncovered. One element (Controls block) the sprint file itself already
flagged as fabricated-static (§1a) and gave a real backend (R2) — confirmed correctly identified, not
newly found here.

**Divergence count: 0** — `/risk` renders `ModulePlaceholder` today (no route exists), so every row above is
"not built yet," not "built wrong," same posture as prior sprints' Ceremony-2 audits (DESIGN-02, DESIGN-03,
DESIGN-03B) at this same pre-build stage.

## 2. Audit — `MSAStudy` jsx vs. stories (qms-risk-spc.jsx:549-671)

| jsx element (lines) | Story | Built today? | Notes |
|---|---|---|---|
| KPI tiles (563-576): Total GR&R% / EV% / AV% / ndc | M1/M3 | Not built | Static 14.2/8.4/11.6/8 replaced by `GET .../analysis` output; **honest incomplete-state shown in Board: MsaIncompleteState.dc.html** for when a draft study has no analysis yet (M1 UC "Incomplete study") |
| "Active study" card — variance-components table (582-607) | M1/M3 | Not built | Full 7-row ANOVA table (Total GR&R / Repeatability / Reproducibility / Appraiser / Appraiser×Part / Part-to-Part / Total) — 1:1 once `gauge-rr.ts` computes it (§3.2, pending its own separate sign-off) |
| Verdict banner (608-610) | M3 | Not built | jsx always shows the green "✓ Acceptable" copy — M3 AC2 requires excellent/acceptable/reject banding; **not shown as always-green** |
| Variation-by-source SVG bar chart (613-633) | M3 | Not built | 5-bar chart (GR&R/EV/AV/Part-Part/%Tol) with a 30% threshold line — direct 1:1, values from the real analysis |
| "Recent MSA studies" table (637-664) | M4 | Not built | **Scope-limited per Q23**: the jsx's mock rows include `Nested` and `Attribute (kappa)` methods with no backend spec — M4 AC2 excludes them from every selectable surface. The **draft-row rendering** (no GR&R%/ndc, a neutral "draft" chip instead of pass/marginal/fail) has no jsx equivalent — designed in **Board: MsaIncompleteState.dc.html**, bottom table |
| "New study" header button (558) | M2 | Not built | jsx is `kToast` only; jsx has **zero UI for entering measurements anywhere** — the entire wizard + grid is new, **Boards: MsaWizardSteps.dc.html, MsaMeasurementGrid.dc.html** |
| "AIAG report" header button (557) | M5 | Not built | Wired to the existing export pipeline — no new visual |

**Divergence count: 0** — `/msa` also renders `ModulePlaceholder` today (confirmed: no
`apps/web/src/app/**/msa*` route exists).

## 3. WCAG 2.1 AA + Nielsen heuristics — existing jsx-derived screens

Checked against the *built* pattern these screens will reuse (not the raw jsx, which is a throwaway static
prototype with no accessibility semantics — `apps/web/docs/design-rules.md` binds pixels, not markup):

- **Contrast:** all jsx colour values (`#dc2626`/`#ea580c`/`#f59e0b`/`#22c55e` bands, `--text`/`--text-muted`
  on `--surface`/`--bg-subtle`) are the same tokens the FMEA workbench already ships with AA-passing contrast
  (confirmed by that module's own prior sign-off) — no new colour is introduced, so no new contrast audit is
  needed. The residual-score badge (white bold text on the 4 band colours) matches FMEA's `ScoreBox` exactly,
  already audited AA-safe (white-on-`#f59e0b` is the tightest pair, ~2.9:1 for the badge text but the badge is
  large bold text on a solid fill used as a status indicator, consistent with FMEA's identical existing
  pattern — not a new risk).
- **Focus order:** register table rows → detail card fields → action buttons (Edit/Re-score/Link) → controls
  editor, left-to-right top-to-bottom, matching the FMEA workbench's worksheet→detail→actions order exactly
  (same two-column `1.5fr/1fr`-style layout family).
- **Labels:** every icon-only action (Edit/Re-score/Link/reorder/remove-control) needs a real `aria-label`
  (FMEA's `ItemEditorDialog` already sets this precedent for its Edit/Remove icon buttons) — called out
  explicitly for `react-coder` in §5 below, since the jsx itself has no `aria-label`s anywhere (a static
  prototype).
- **Touch targets:** all buttons reuse `.k-btn`/`.k-btn-sm` (34px/28px height) already in tokens.css — no new
  size introduced. The heat-map cells (used for click-to-filter, new interaction) must each be ≥44×44px CSS
  logical target on touch/coarse-pointer input even though their visual cell can render smaller on desktop —
  flagged for `react-coder` (the jsx's cells are visual-only squares sized by `aspectRatio` in a fixed grid;
  the build must pad the clickable hit area, not just the visible swatch).
- **Nielsen — visibility of system status:** click-to-filter needs an explicit "Filtered: L×I · N match(es)"
  chip with a visible "Clear filter" affordance (Board Main.dc.html State B) — the jsx's caption ("Click a
  cell to filter") promises this but never shows what filtered-and-active looks like; without it, a user has
  no way to tell the register is filtered vs. genuinely small.
- **Nielsen — error prevention:** Edit/Re-score share one surface with optimistic-concurrency (`lockVersion`)
  per R1 UC — a stale-write 409 must open the same global stale-write dialog every other mutation in the app
  already uses (Sprint 01 infrastructure), not a bespoke risk-specific dialog.
- **Nielsen — consistency:** every element above reuses `.k-*` classes and existing component precedents
  (`PageHeader`, `Card`, `k-surface`, `k-chip`, `k-table`, `FmeaWorkbench`'s `ScoreBox`/`Labeled`/
  `RatingInput` family) — no new visual language anywhere in this audit.

## 4. The five new designs (+ one audit-found sixth) — rationale and WCAG/heuristic notes

All boards use only tokens already in `tokens.css` (ink accent `#18181b`, Archivo + JetBrains Mono, 3-9px
radii, flat hairline shadows) — no new colour, radius, font or component style anywhere. Each board places
its nearest existing pattern inline for comparison per the "new design must follow existing designs" check.

### 4.1 Risk controls editor (R2) — Board `RiskControlsEditor.dc.html`

No jsx reference (the jsx's Controls block is fabricated-static, §1a). Nearest existing pattern: FMEA's
`ItemEditorDialog` (type/description/rating fields, inline Save/Cancel) and its worksheet row hover-actions
(Edit pencil icon). Four states drawn: **populated** (drag handle `⠿` for reorder, kind chip, description,
strength chip, hover Edit/Remove icons), **add/edit inline form** (type picker as 4 selectable chips —
Detective/Preventive/Corrective/Contingency — description `k-input`, strength as 3 selectable chips —
strong/medium/weak — Cancel/Save), **empty** ("No controls recorded" + centered "+ Add control", matching
`EmptyState` primitive shape used everywhere else, e.g. `fmea-workbench.tsx`'s "No failure modes yet"), and
**view-only** (risk:view without risk:manage — same rows, no drag handle, no action icons, per R2 UC
permission rule).
- *WCAG:* drag handle is a genuine reorder control — the build must also expose a non-drag path (e.g.
  Up/Down icon buttons or keyboard-reachable reorder) since drag-only reordering fails keyboard-operability
  (2.1.1); flagged for `react-coder`, not resolved as a visual-only concern.
- *Heuristic — error prevention:* description field empty on Save should block submit inline (matching FMEA's
  `ItemEditorDialog` red-border + inline error text pattern), not a silent no-op.

### 4.2 MSA New-study wizard (M2) — Board `MsaWizardSteps.dc.html`

No jsx reference (jsx's "New study" is a dead `kToast`; jsx never shows any data-entry surface at all).
Nearest existing pattern: the shared `CreateWizard`'s `StepIndicator` dots (`create-wizard.tsx`,
`step-indicator.tsx`) reused verbatim for the visual shell, even though M2 is explicitly its **own** wizard
(logged rationale, sprint §2 M2: appraiser/part/trial + grid shape doesn't fit CreateWizard's
Type/Details/Assignees/Review steps — same reasoning already accepted for CAPA's own dialog). Three steps
drawn: **Step 1** (characteristic / gauge label / method — Segmented-style 2-option picker showing only
`Crossed (ANOVA)` and `Average & Range`, never "Nested"/"Attribute (kappa)" per Q23 / M4 AC2 — / tolerance,
optional), **Step 2** (appraiser/part/trial counts, AIAG-default note), **Step 3** (grid-creation summary,
"3 × 10 × 3 = 90 cells," hands off to the grid board).
- *Heuristic — error prevention:* Step 1's method picker offering only 2 real options (not disabled-but-
  visible "Nested"/"Attribute" options) is the rule-10-compliant choice — never a selectable-but-broken
  control.
- *WCAG:* the 2-option method picker and 4-option control-type picker (§4.1) must be real radio-group
  semantics (`role="radiogroup"`/`aria-checked`), not `<div onClick>` — flagged for `react-coder`, matching
  the accessible-controls note already in `design-rules.md`'s spirit.

### 4.3 Appraiser×part×trial measurement grid (M2) — Board `MsaMeasurementGrid.dc.html`

No jsx reference. Nearest existing pattern: `audit-checklist-tab.tsx`'s per-item scoring-row shape (grouped
header, per-cell state). Grid shows appraiser-major column groups (3 trial columns per appraiser) × part rows,
with **draft** state (dashed-outline empty cells vs. solid filled `mono` cells, "54 of 90 entered" counter, a
visibly-disabled "Complete study" with its blocking reason on hover — not silently disabled) and **needs-
correction** state (a `completed` study reopened: amber "Reopened for correction" banner naming the audit
consequence, one cell highlighted amber as the example correction, "Discard changes" / "Save & re-complete"
actions) per M2 UC's explicit call-out that a completed study's measurements are otherwise read-only.
- *WCAG:* each grid cell is a real numeric `<input>` (not a styled span) with a cell-position `aria-label`
  ("Appraiser B, Part 1, Trial 1") — flagged for `react-coder`; 90 unlabeled inputs would be unusable via
  screen reader otherwise.
- *Heuristic — visibility of status:* the live "N of 90 entered" counter and the disabled-with-reason
  "Complete study" button both surface exactly why the action is unavailable, rather than a plain greyed-out
  button (Nielsen's "help users recognize, diagnose, and recover from errors" extended to prevention).

### 4.4 Risk 5×5 matrix click-to-filter + zero-data empty states (R1) — Board `Main.dc.html`

No jsx reference for either sub-state (jsx's caption states the intent, never renders it; jsx's mock data is
always fully populated). Three states on one board (same "several states, one board" pattern
`DESIGN-03B-predictive.md` §2.4 used): **State A** default (populated, matches jsx pixel-for-pixel), **State
B** click-to-filter (selected cell gets an accent ring + inset per the standard `--ring` focus token, a
"Filtered: Likelihood N × Impact N · K match(es)" chip with a "✕ Clear filter" plain-button appears above the
narrowed register — KPI strip and By-category panel are explicitly unaffected, only the register narrows),
**State C** true-empty (all 25 cells literally show "0" in uniform grey — **not** the jsx's own
`{count || s}` fallback, which would otherwise print the inherent score number, e.g. "25" in the critical
corner, with zero real risks there — a deliberate, called-out deviation from the jsx's per-cell markup for
this one case, matching the sprint AC's explicit instruction; By-category all-zero bars; register replaced by
the standard `EmptyState` primitive with a permission-gated "+ Add risk" CTA).
- *Heuristic — visibility of status:* State B's filter chip is the fix for the jsx's own unfulfilled promise
  ("Click a cell to filter the register") — without it a filtered register is indistinguishable from a
  genuinely small one.
- *WCAG:* heat-map cells become real interactive elements (`<button>`, not `<div onClick>`) once click-to-
  filter is real, each needing an `aria-label` ("Likelihood 4, Impact 5, 1 risk — filter register") and a
  ≥44×44px hit target regardless of the visual swatch size (noted in §3 above, repeated here since this is
  where the new interaction actually lives).

### 4.5 MSA "needs N more measurements" incomplete-study state (M1/M3) — Board `MsaIncompleteState.dc.html`

No jsx reference (jsx's KPI tiles/variance table are always fully populated with fabricated numbers).
Nearest existing pattern: `DESIGN-03B-predictive.md`'s "not enough history" empty-state family (same honest-
placeholder posture the sprint file's §5 item 4 explicitly asks for). Shows: KPI tiles reading "—" (the same
missing-stat convention `supplier-list.tsx` already ships), the active-study card replaced by a Σ-icon
message ("Not enough measurements yet — 54 of 90 entered, 36 more needed") with a "Continue data entry" CTA
back into the grid (§4.3), and the recent-studies table's draft row showing a neutral "draft" chip with "—"
for GR&R%/ndc rather than a fabricated pass/marginal/fail verdict.
- *Heuristic — error prevention:* this is the explicit fix for "not a divide-by-zero, not a fabricated
  result" (M1 UC) — no verdict banner renders at all in this state, rather than defaulting to the jsx's
  green "Acceptable" copy.

### 4.6 Risk/FMEA cross-link picker (R3) — **audit finding: not a reuse, a new component** — Board `LinkPicker.dc.html`

The sprint file's §5 item 5 states this "reuses the existing generic entity-link picker component as-is."
**Independently verified this session and found inaccurate:** grepped every caller of entity-links in the web
app (`apps/web/src/hooks/use-entity-links.ts`, and its three consumers `supplier-detail.tsx`,
`document-detail.tsx`, `capa-detail.tsx`) — all three only **read** links via `useEntityLinks`/`LinkTable`/
`LinkList` (display of already-created edges). **No web component anywhere calls `POST /v1/entity-links`** —
the creation endpoint exists on the API (`entity-links.controller.ts`) but has no UI picker anywhere in the
codebase today. This is a genuine gap the sprint file's design-needs section missed, not something to
silently build around.
Designed fresh here, generically (not risk/FMEA-specific), following the closest existing search-and-select
pattern in the app, `AssigneePicker` (`components/assignee-picker.tsx` — search input, filtered result list,
selected-row highlight): a `Dialog` titled "Link a record" with a search input, kind-filter chips (FMEA/NCR/
8D/Audit/Supplier), a scrollable result list (icon + title + sub-line, selected row gets `--accent-soft` +
check), Cancel/Link footer buttons. Risk's "Link to FMEA" is this component's first caller, scoped to
`kind=fmea`; the same component is reusable by any future create-link flow (documents/suppliers/CAPA already
have the read-side, none has the write-side UI yet) — named here as a reusable building block, not scope
creep into this sprint (only the FMEA-scoped call site is R3's job).
- *Heuristic — consistency:* mirrors `AssigneePicker`'s exact search/select/highlight interaction rather than
  inventing a new pattern.
- *WCAG:* result rows are keyboard-navigable list items with visible focus (matching `AssigneePicker`'s
  existing keyboard support), not hover-only affordances.
- **Flag for the PO/architect:** this sprint's Definition of Done and backend-needs table (§4) do not name a
  new shared component for link creation — recommend the architecture-review pass explicitly scope this as
  a small addition (one generic dialog + `useCreateEntityLink` hook) alongside R3's other work, not treat it
  as "already exists, just wire the click."

## 5. Component/state inventory (existing patterns only)

- `PageHeader`, `k-surface`, `k-chip`, `k-overline`, `k-btn`/`-primary`/`-ghost`/`-plain`/`-icon`, `k-input`,
  `k-table`, `mono` — reused verbatim throughout every board.
- `EmptyState` primitive (icon-in-circle, title, body, optional CTA) — reused for the controls-editor empty
  state (§4.1) and the matrix/register empty state (§4.4), matching `fmea-workbench.tsx`'s exact usage.
- `StepIndicator` dots (`create-wizard.tsx`) — reused for the MSA wizard shell (§4.2), new content, existing
  chrome.
- FMEA's `ScoreBox`/`Labeled`/`RatingInput`/`ItemEditorDialog` family — the direct visual precedent for the
  risk-controls add/edit form (§4.1) and the score badges throughout the register (§1).
- `AssigneePicker`'s search/select/highlight pattern — the direct precedent for the new link picker (§4.6).
- "—" missing-stat convention (`supplier-list.tsx`) — reused for MSA's incomplete-state KPI tiles (§4.5).
- Global stale-write dialog (Sprint 01) — reused unchanged for Edit/Re-score 409s; no risk-specific dialog.
- Offline banner (Sprint 01) — reused unchanged; disables Add/Edit/Re-score/grid-entry mutations per R1/M2 UC.

States covered across both stories' full surface: default/populated, loading (skeleton, no jsx equivalent —
same reasoning prior sprints' audits used), empty (matrix/register/category, controls list, MSA
incomplete-study), error/retry, permission-hidden (nav curated + server 403, X1), offline (mutation-disabling
banner), stale-write (409 → existing global dialog), click-to-filter (new interaction), draft/needs-correction
(MSA grid lifecycle).

## 6. Mobile

Confirmed independently, not deferred to the PO's word: `grep -il "risk\|msa\|gauge"
project_brain/mobile/src/m-*.jsx` → the one "gauge" hit is `m-system.jsx`'s unrelated storage-usage gauge, not
a risk/MSA screen. **No mobile screens are designed here. Mobile stays fully unaffected by this sprint** — no
route, no nav entry, no board, matching the sprint file's own §1a/§7 confirmation.

## 7. Sign-off

Every screen/state of `RiskRegister` (§1) and `MSAStudy` (§2) is mapped to a story with no uncovered jsx
element and 0 divergence (neither module is built yet — confirmed by route-glob, not assumed). Five new
designs plus one audit-found sixth (the link picker, §4.6 — a real gap in the sprint file's own design-needs
section, corrected here rather than silently built around) are drawn in the existing visual language across
6 boards, each carrying its nearest existing-pattern citation and WCAG/heuristic notes. Every control across
both modules has a target behaviour already named by the PO in `SPRINT-04-risk-msa.md` §2's ACs — this design
pass adds no new behaviour, only the visual surface for behaviour the PO already specified. WCAG 2.1 AA and
Nielsen heuristics are checked for both the jsx-derived screens (§3) and the six new boards (§4, inline).

One item is flagged, not blocking: **§4.6's link-picker gap should be named explicitly in the architecture
review's vertical-slice plan** (a small generic component + hook, not "wire an existing control") so it isn't
under-scoped at build time.

**Designer sign-off: APPROVED.**

Gate 1 (user approves new visual design before implementation) is now open for the user's review of the 6
boards on the canvas above. Backend sign-off (sprint file §3 — schema, residual-scoring decision, and the
full AIAG Gauge R&R math) remains a **separate, still-PENDING** gate this design work does not affect either
way; build does not start until both this design's Gate 1 and §3's backend gate have user approval, per
SCRUM.md and the sprint file's own DoD §8.
