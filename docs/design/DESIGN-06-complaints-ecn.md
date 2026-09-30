# DESIGN-06 — Customer complaints + ECN (web)

Author: UI Lead Designer. Date: 2026-09-30 (touch-up pass same day, after Amendments 1+2). Sprint:
`docs/sprints/SPRINT-06-complaints-ecn.md` §2 (C1-C4, E1-E5, X1), §5 (Design needs). Ceremony 2
(Design audit) of `SCRUM.md`.

## 0. Touch-up pass (2026-09-30) — Amendments 1+2 fold-in

The sprint's own two amendment rounds (§0, §0b) changed the ECN backend after this doc's original
eight boards were drawn and signed off: the machine grew from 4 human gates/6 stages to **5 gates/7
stages** (a real `ppap` gate inserted `risk_review → ppap → cab_approval`, §0b D1), the Kanban grew
from 8 to **9 columns**, and a **`resubmit`** action was added (`rejected → draft`, resetting every
`ecn_approvals` row, §0b D3), alongside three author-driven routes the original boards never showed
(`submit`/`withdraw`/`close`, §0 B1), a persisted auto-revise result (§0 B3d) and an ECN-specific
unlink route (§0 B4). This is a **touch-up, not a redraw**: only the two affected boards were edited,
in place, on the same canvas — no new board, no new colour/radius/font/component style anywhere.

**Board `EcnKanbanDnD.dc.html`** (canvas, same file): the "Rejected" column (already added last pass)
is unchanged in kind; a 9th column, **PPAP**, is inserted between Risk review and CAB approval, same
dot/count-header/card visual treatment as the other 8 — its dot uses `--risk-info` (`#6366f1`), an
existing `tokens.css` token not yet spent elsewhere on this board, never a new colour. The thematically
fitting ECN-2026-0180 (the supplier/material-change row that already justified `ppap`'s placement,
§0b D1's own rationale) is shown sitting in the new PPAP column rather than CAB approval. Every
Rejected card now also carries an explicit **"↻ Resubmit"** button — distinct from, and in addition
to, the existing Rejected→Draft-only drag affordance — both call the same `resubmit` route; the button
is the real keyboard-operable equivalent the board's own WCAG note (§4.6 below) already flagged as
missing for drag generally. State B's caption now also states the two-tier capability split named in
the sprint's §5 item 8 (`ecn:manage` on Draft/Implementation/Rejected columns, `ecn:approve` on the 5
gated columns incl. PPAP) rather than treating "no approve capability" as a single on/off toggle.

**Board `EcnDetailApproval.dc.html`** (canvas, same file): the approval tracker (State A) gains its
**5th row, `ppap`**, in correct stage order between Risk review and CAB approval, same
stage/decision/approver/decided-at pattern as the other 4; the header chip's "step 4 of 6" is
corrected to "step 5 of 7" against the now-7-entry `ECN_STAGE_ORDER`. The affected-records panel
gains a per-row **unlink "×"** control (State A), live only while `ecn:manage` + stage draft-pilot,
removed entirely (not disabled) once frozen (State F, restated to also name unlink, not just link, as
frozen). State D (rejected) gains a visible **Resubmit** button plus a caption naming its exact
mechanics (manage-gated, not owner-restricted, resets all 5 approval rows, unfreezes `owner`). State
E's caption is restated to describe the auto-revise banner as **persisted** — read from
`EcnDto.autoReviseResult` on every visit, not a one-time post-transition toast. Two new states are appended,
matching the existing states' own visual weight exactly: **State G** (Draft — Submit/Withdraw actions)
and **State H** (Implementation — Close action), both named in the sprint's own §5 item 9 and not
previously drawn on this board.

No other board changed. `docs/design/DESIGN-06-complaints-ecn.md`'s §1-§8 below are the *original*
audit and sign-off, left as written — still accurate for every screen/state they cover; this §0
records the incremental delta on top of it, per the sprint's own instruction to update the design doc
in place rather than create a new one. Per the user's standing blanket pre-approval for new visual
designs, no separate sign-off pause was taken for this touch-up.

**Scope note (mirrors DESIGN-04/05's own scope note):** `CustomerComplaints`, `IntakeForm`, `ECNList`,
`ECNWorkbench`, `ECNKanban` (`project_brain/project/src/qms-modules.jsx` lines 332-475 and 526-633) are
audited here, not redrawn — they are binding jsx per `apps/web/docs/design-rules.md`. `TrainingMatrix`
and `CalibrationManagement` (same file) are Sprint 05's scope and are not touched. §3's backend design
(schema, canonical ECN stage machine, SLA table, auto-revise mechanism) was already approved by the
user on 2026-09-30 per the sprint file's own closing sign-off line — this design pass does not
re-litigate it; it only draws the visual surface for stories whose backend is already signed off. No
product code is written or changed by this pass, per the user's blanket pre-approval for new visual
designs, sign-off on the eight new boards below is recorded directly in §8, not deferred.

Canvas (8 boards): **https://claude.ai/artifact/4N5FUvJxgN2Pf9RCbVjdJ5**

---

## 1. Audit — `CustomerComplaints` + `IntakeForm` jsx vs. stories (`qms-modules.jsx:332-523`)

| jsx element (lines) | Story | Built today? | Notes |
|---|---|---|---|
| Header + "Public intake form"/"Log complaint" buttons (344-353) | C1/C2/§3.1 | Not built — `/complaints` is `PLANNED_MODULES["complaints"]` (confirmed: `apps/web/src/config/planned-modules.ts` still lists it; no `apps/web/src/app/**/complaints*` route exists) | "Log complaint" opens a real dialog (C2, corrected — Board `ComplaintIntakeCorrected.dc.html`); "Public intake form" is **not built** — reproduced as honest, non-interactive reference content per §3.1's approved manual-only-intake decision, not a fake link-copy action |
| KPI strip (355-368): Open / Critical / <24h response / Avg time to close / Avg cost | C1 | Not built | Real formulas replace the mock's static 84/4/92%/18d/$4,280 (C1 AC3). **Audit finding, same class as DESIGN-05's §1 row 2**: the jsx's "Avg time to close" tile uses `#7c3aed` — not a `tokens.css` value. Substituted with `--slate-600` (`#475569`), the identical fix DESIGN-04/05 already made for the same recurring mock defect. "Avg cost" tile's `#f59e0b` **is** a real token (`--warning-500`/`--risk-medium`) — kept as-is |
| 4 filter tabs (370-374) | C1 | Not built | Real counts in each tab's own label (`All (N open)`, `Critical (N)`, `Not linked to NCR (N)`, `Mine (N)`) replace the mock's static 84/4/7/12 — not redrawn, table/tab chrome is 1:1 |
| Register table (376-420) | C1 | Not built | ID/Customer(+contact/via)/Subject(+batch)/Severity/Status/Linked/Received — direct 1:1; customer color chip is now server-computed (`customerColor()`, deterministic hash, not user-picked) rather than the jsx's per-row hardcoded literal, per C1 AC1 |
| Row `style={{cursor:'pointer'}}`, no `onClick` (383) | C3 | **Dead in the mock itself** | No detail board exists anywhere in the jsx — genuinely new, drawn fresh (Board `Main.dc.html`, §4.1) |
| "Link / Create NCR" button (411-413) | C4 | `kToast` only, dead | Becomes a real 3-way NCR/8D/CAPA picker (Board `ComplaintConvertPicker.dc.html`, §4.3) |
| "Intake channels" card (422-443) | §3.1 | Not built | **Audit finding, already named in the sprint file's own §3.1/§6** — all 5 channels show a fabricated "Active" status with no real integration anywhere in this codebase. Reproduced as an honest, static, non-interactive reference card (Board `ComplaintIntakeCorrected.dc.html`'s caption documents the exclusion; the card's own pixels are unchanged from the jsx — only its badge language would need a build-time "manual-only" note, flagged for `react-coder`, not redrawn here since the jsx's own layout is already correct) |
| "SLA matrix" card (444-468) | §3.1 | Not built | Reproduced 1:1 — the 4-row table already matches C1's approved SLA config table exactly (1h/4h/24h/48h ack, 14/21/45/90d close); the "8D required" column stays informational-only text per §3.1 |
| `IntakeForm` dialog (477-523) | C2 | `onClose` only, no submit handler | Real create dialog — **missing `Contact`/`Channel` fields added** (Board `ComplaintIntakeCorrected.dc.html`, §4.2), attachments wired to the real presign-then-link pipeline |

**Independent verification:** every jsx element maps to a story (C1-C4), with two real fabricated-status
findings (the KPI tile's off-token purple, the Intake-channels card's fake "Active" badges) already
named in the sprint file itself and reconfirmed here, not newly discovered. **Divergence count: 0** —
`/complaints` renders `ModulePlaceholder` today (no route exists), same pre-build posture as every
prior sprint's own Ceremony-2 audit.

## 2. Audit — `ECNWorkbench` / `ECNList` / `ECNKanban` jsx vs. stories (`qms-modules.jsx:528-633`)

| jsx element (lines) | Story | Built today? | Notes |
|---|---|---|---|
| Header + List/Kanban segmented toggle + "New ECN" button (532-540) | E1/E2/E3 | Not built — `/ecn` is `PLANNED_MODULES["ecn"]` (confirmed) | "New ECN" is `kToast` only, dead — becomes the real CreateWizard `ecn` type (Board `EcnCreateWizard.dc.html`, §4.7) |
| `ECNList` table (549-591) | E1 | Not built | ID/Title/Type/Stage(progress bar)/Affected/Risk/Owner/Target — direct 1:1, **with the "of 6" progress-bar convention corrected to the canonical machine's 7 ordered stages** (§3.2, already approved; further corrected by §0 above to 7 stages/5 gates incl. `ppap`) rather than the mock's own inconsistent per-row `of:6` with a 5th "Doc revision" label that never was a real human stage |
| `ECNKanban` 7 columns (593-633) | E2 | Not built | Draft/Feasibility/Risk review/CAB approval/Pilot/Implementation/Closed reproduced 1:1, **plus the approved "Rejected" column** (§3.2's correction — the header's own "multi-stage approval workflow" claim implies a reject path the mock never draws) **— now the board's 9th column overall following §0 above's later `ppap` insertion, not the 8th** — Board `EcnKanbanDnD.dc.html`, §4.6 |
| `ECNKanban` cards (603-611) | E2 | Static, no drag anywhere | Real drag-to-advance for `ecn:approve` holders; visibly non-draggable (no grab handle at all, not merely disabled) for everyone else — genuinely new interaction, no precedent anywhere else in this app's board views (Board `EcnKanbanDnD.dc.html`, §4.6) |
| ECN detail / approval tracker (header text's own "multi-stage approval workflow" claim; P19 §3's own call for one) | E4 | **No board drawn anywhere in the jsx** | New (Board `EcnDetailApproval.dc.html`, §4.5) |
| "Auto-revises affected documents" (header text, 534) | E5 | No mechanism anywhere | Real, transactional `DocumentsService.newVersion`-based mechanism (§3.2, already approved); its partial-failure result is a real, visible banner on the ECN detail board (State E), never silently swallowed |

**Independent verification:** every jsx element maps to a story (E1-E5), with both of the sprint's own
named mock corrections (the "Doc revision" mislabeled stage, the missing "Rejected" column) applied on
the audited board itself, per the "new design must follow existing designs" check. **Divergence count:
0** — `/ecn` also renders `ModulePlaceholder` today (confirmed: no route exists).

## 3. WCAG 2.1 AA + Nielsen heuristics

Checked against the *built* pattern these screens will reuse (the raw jsx has no accessibility
semantics — a throwaway static prototype; `design-rules.md` binds pixels, not markup):

- **Contrast:** all colours are existing `tokens.css`/jsx values already AA-audited in FMEA/Risk/
  Calibration (chip family, `ScoreBox`-style swatches) — no new colour introduced anywhere in this
  pass. The one substitution (complaint KPI tile `#7c3aed` → `--slate-600`) is on-token, not new,
  mirroring DESIGN-04/05's identical fix for the identical recurring mock defect. The new 6th
  CreateWizard card's `#f59e0b` is likewise a real `tokens.css` value (`--warning-500`/`--risk-medium`),
  never spent by the other 5 cards.
- **Focus order:** complaint register → detail panel field grid → attachments → linked-record →
  actions, matching `CustomerComplaints`'s own left-to-right layout and the calibration/risk detail
  card precedent; ECN list/Kanban → detail panel → approval tracker → affected-records → actions,
  matching `GraphDetailDrawer`'s established order.
- **Labels:** every icon-only control (Convert's `▾` menu trigger, the Kanban drag handle `⠿`, the
  detail panel's `⋯`-equivalent actions) needs a real `aria-label` — the jsx has none anywhere (static
  prototype); called out per-board below for `react-coder`.
- **Touch targets:** all buttons reuse `.k-btn`/`.k-btn-sm` (34px/28px, already in `tokens.css`) — no
  new size anywhere. The Kanban drag handle (`⠿`, visually ~14px) must have its actual grab hit-area
  padded to ≥44×44px logical on touch/coarse-pointer input, same class of fix DESIGN-04/05 flagged for
  their own small interactive swatches.
- **Nielsen — visibility of system status:** the ECN detail board's real approval tracker (who decided
  what, when) and the auto-revise partial-failure banner (State E) are both direct fixes for the jsx's
  own unfulfilled claims — "multi-stage approval workflow" with no tracker drawn anywhere, and
  "auto-revises affected documents" with no mechanism behind it at all.
- **Nielsen — error prevention:** Reject (Board `EcnDetailApproval.dc.html`, State C) requires a
  comment and states the exact, irreversible consequence before the write, mirroring the standing
  convention every prior sprint's destructive-action confirm already uses (retire, archive, raise-NCR).
  Close (complaint detail) and Approve (ECN) are one-way-per-cycle actions but take no extra fields
  per their own AC, so no confirm dialog is added beyond the button's own explicit label — consistent
  with Acknowledge/Approve's own "no extra fields" contract.
- **Nielsen — consistency:** every board reuses `.k-*` classes, `PageHeader`-style chrome, `k-surface`,
  `k-chip`, `k-table`, the `KvField` detail-card pattern (Calibration/Risk precedent), `LinkPicker`'s
  exact visual pattern (Sprint 04 R3), and the `RiskDetailsStep`/`OwnerPicker` CreateWizard precedent
  (Sprint 04 R4) — no new visual language is introduced anywhere in this sprint's 8 boards.
- **One deliberate, named departure from an existing precedent** (not silently made — see §4.5): the
  ECN detail board's Approve/Reject buttons render **visibly disabled** for a non-approver, per the
  sprint's own §5 item 3 instruction — a different visual treatment from `document-detail.tsx`'s own
  established pattern, which *hides* Approve/Reject entirely and substitutes a plain "Awaiting review"
  status line for the same non-reviewer case. Both are legitimate WCAG-compliant patterns (a disabled
  control still needs `aria-disabled` + a reason, exactly as a hidden-and-replaced one needs the status
  text it substitutes) — flagged here as a real, if small, inconsistency this sprint's own instruction
  introduces against the closest existing precedent in this codebase, not an oversight.

## 4. The eight new designs — rationale and WCAG/heuristic notes

All boards use only tokens already in `tokens.css` (ink accent `#18181b`, Archivo + JetBrains Mono,
3-9px radii, flat hairline shadows) — no new colour, radius, font or component style anywhere. Each
board's own caption cites its nearest existing pattern inline, per the "new design must follow existing
designs" check.

### 4.1 Complaint detail panel (C3) — Board `Main.dc.html`

No jsx board exists at all (§1). Field grid reuses the `KvField` 2-column swatch pattern already
established by Calibration's (Sprint 05) and Risk's (Sprint 04) own detail cards. Five states: **A**
default/unacknowledged (Acknowledge/Edit/Convert/Close all live), **B** acknowledged + converted with
an SLA-breached chip and the "acknowledged late, stays breached forever" rule stated inline, **C**
closed/read-only (no actions render at all, matching C3's own "closed complaint is read-only" intent),
**D** `complaint:view`-only permission state (viewer — actions never rendered, not shown-then-403'd),
**E** offline (all four actions disabled under the standing banner). SLA chip reuses the existing,
generic `SlaState` 3-value palette (`on_track`/`at_risk`/`breached`) already used elsewhere for NCR's
own SLA chip — no new colour meaning invented.
- *WCAG:* attachment rows and the linked-record display need real `<a>`/`<button>` elements, not
  styled `<div>`s, same gap every prior sprint's audit has flagged identically.
- *Heuristic — error prevention:* Close's button stays primary/undecorated (no confirm) since C3 AC2
  takes no extra fields and is idempotent-guarded (422 if already closed) — consistent with
  Acknowledge's own no-confirm precedent elsewhere in this app.

### 4.2 Complaint intake dialog's added Contact/Channel fields (C2) — Board `ComplaintIntakeCorrected.dc.html`

Composes onto the *same* `IntakeForm` layout (§1a's flagged gap), not a new dialog — Contact and
Channel are inserted as a new row directly beneath the existing Customer field, ahead of
Severity/Batch, the smallest legible insertion point in the jsx's own 2-column grid. Four states: the
corrected default form, an attachment mid-upload (AV-scan-pending-style chip, mirroring the calibration
cert-upload precedent's own "Uploading…" chip), an upload failure with a real retry affordance (never a
silently dropped file, C2's own UC), and an inline validation error.
- *WCAG:* Channel must be a real `<select>` (already is), Contact a real labelled `<input>` — both
  already satisfied by reusing the jsx's own field shape unchanged.

### 4.3 Complaint register's convert-target picker (C4) — Board `ComplaintConvertPicker.dc.html`

The jsx's single "Link / Create NCR" button (`kToast` only, dead) becomes a 3-way choice. A small
dropdown menu in the existing visual language — same shape as any other row-action menu in this app —
not a new full dialog, since the route itself takes only `{ target, title?, priority? }`. Five states:
closed button, open menu (NCR/8D/CAPA), the jsx's own already-converted display (plain accent link,
unchanged), a partially-converted row (one target linked, the other two still offered — C4 AC2's
"converts backward, link still created" case made visible), and a 409 double-convert toast.
- *Heuristic — error prevention:* the 409 state names the record that already won the race, rather than
  a bare "conflict" error.

### 4.4 Complaint register/KPI/empty/error/offline/permission states (C1) — Board `ComplaintStates.dc.html`

No jsx equivalent (always-populated mock). Five states: zero-complaint (KPI strip renders `0`/`—`,
never a fabricated percentage or `NaN`, matching C1 AC3's exact zero-denominator rule), loading
skeleton, error/retry, the offline banner (Sprint 01 infrastructure, reused unchanged), and a
permission note for inspector (nav-hidden + server-403, §1 role decision).

### 4.5 ECN detail view + multi-stage approval tracker (E4) — Board `EcnDetailApproval.dc.html`

**This sprint's own headline new design**, mirroring C3's exact situation — P19 §3 itself calls for
this view but no jsx anywhere draws it. Field grid: same `KvField` pattern as the complaint detail
panel. Affected-records panel reuses `LinkPicker.tsx`'s exact visual pattern from Sprint 04 R3, scoped
to `document`/`supplier` only (never `part` — no such `EntityKind` exists, §1a/Q29, so the picker never
offers a kind it can't really link). Six states: **A** approver view at the current gate (Approve/Reject
live, four-eyes/role guards stated inline), **B** non-approver view (tracker fully readable,
Approve/Reject **visibly disabled** with the exact reason shown — see §3's flagged departure from
`document-detail.tsx`'s own hide-and-replace pattern), **C** the reject confirm dialog (comment
required, exact consequence named), **D** a rejected (terminal) ECN showing which gate rejected it and
why, **E** the real auto-revise partial-failure banner (2 of 3 documents revised, 1 named and skipped
with its real reason — never a silent partial success), **F** the affected-records panel frozen past
Pilot (E5 AC1's 422, "Link a record" rendered disabled with the reason stated, not merely absent).
- *WCAG:* the tracker's decision chips need `aria-label`s stating the full state ("CAB approval —
  pending, current stage"); the reject textarea needs a visible required-field marker, not colour alone.
- *Heuristic — visibility of system status:* every stage row shows decision + approver + decided-at
  together, so nobody has to infer why the ECN sits where it does.

### 4.6 ECN Kanban's "Rejected" column + drag-and-drop visual states (E2, §3.2) — Board `EcnKanbanDnD.dc.html`

Two items from the sprint's own §5 list, drawn on one board since both compose onto the same audited
`ECNKanban` layout. The Rejected column gets the exact same dot/count-header/card treatment as the
other columns (§3.2's correction; the board's `ppap` column, added by §0 above, is a separate later
addition to the same set) — no different visual weight for a terminal-failure column than for
"Closed," which is also terminal. Drag-and-drop has **no existing precedent anywhere else in this
app's board views** — genuinely new interaction design, not a reskin, per the sprint's own note. Three
states: **A** the full 8-column board for an `ecn:approve` holder (every card shows a `⠿` grab handle
and a lifted/rotated "dragging" treatment on the one mid-drag card; the one valid adjacent drop target
is outlined, matching E2 AC1's "immediately-next column only" rule — no other column highlights), **B**
the identical board for a non-approver (no grab handle rendered anywhere, not merely a disabled cursor
— rule 10 read for a drag affordance rather than a button), **C** the 409 snap-back (a card that lost
a concurrent race returns to its server-confirmed column with a toast naming who moved it first, never
left optimistically misplaced).
- *WCAG:* drag-and-drop needs a real keyboard-operable equivalent (a `role="button"` "Advance"/"Reject"
  action per card, not drag-only) — flagged for `react-coder`, since the jsx has no interaction to
  audit against and a mouse-only reorder control is a real accessibility gap this board doesn't want to
  silently reproduce.

### 4.7 ECN CreateWizard — 6th Type-step card + Details step (E3) — Board `EcnCreateWizard.dc.html`

No jsx shows either — `qms-modules.jsx:538`'s "New ECN" is a bare `kToast` with no field list at all
(unlike risk's own precedent, which at least implied its fields via other evidence). Mirrors risk's
exact R4 precedent: a flat, single-entity Details step with its own single-select `owner` field
(reusing `RiskDetailsStep`'s `OwnerPicker` component pattern verbatim, not a new picker) replacing the
shared multi-role Assignees step — Type→Details→Review, 3 steps, the same branch `create-wizard.ts`
already establishes via `stepsFor()`/`RISK_WIZARD_STEPS`. Two states: the 6-card Type grid (5 existing
+ the new ECN card, icon `GitBranch` per `navigation.ts`'s existing glyph, colour `#f59e0b` — a real
`tokens.css` token, `--warning-500`/`--risk-medium`, the one on-palette tint the other 5 cards don't
already spend), and the Details step itself (`changeType`/`title`/`description`/`changeRisk`/
`effectiveDate`/`owner`, with `changeRisk` drawn as a 3-option segmented control rather than a bare
`<select>`, mirroring the visual weight — if not the 1-5 numeric scale — of `RiskDetailsStep`'s own
`ScalePicker` component for a small enum choice).
- *WCAG:* the `changeRisk` segmented control must be a real `role="radiogroup"`, not styled `<div>`s —
  same note DESIGN-04 gave its own risk Likelihood/Impact pickers.

### 4.8 ECN list/Kanban/detail empty/error/offline/permission states (E1/E4) — Board `EcnStates.dc.html`

No jsx equivalent. Five states: zero-ECN (`EmptyState` primitive, matching the complaints board's own
convention), loading skeleton, error/retry, offline (New ECN/approve/reject/link all disabled, board
stays read-only-browsable), and a permission note contrasting viewer (`ecn:view` only — fully readable,
no create/approve anywhere) against inspector (neither capability — nav-hidden + server-403).

## 5. Component/state inventory (existing patterns only)

- `PageHeader`, `k-surface`, `k-chip`, `k-overline`, `k-btn`/`-primary`/`-ghost`/`-sm`, `k-input`,
  `k-table`, `mono` — reused verbatim throughout every board.
- `KvField`-style detail-card grid (Calibration/Risk precedent) — Boards `Main.dc.html` and
  `EcnDetailApproval.dc.html`.
- `LinkPicker.tsx`'s exact search/select pattern (Sprint 04 R3) — `EcnDetailApproval.dc.html`'s
  affected-records panel.
- `RiskDetailsStep`/`OwnerPicker`/`ScalePicker` (Sprint 04 R4, `create-wizard.ts`) — `EcnCreateWizard.
  dc.html`'s Details step and single-select owner field.
- `document-detail.tsx`'s Approve/Reject/RejectDialog shape — `EcnDetailApproval.dc.html`'s States A/C
  (reused for the *enabled* approver case and the reject-confirm dialog; State B's visibly-disabled
  treatment is the one named departure from this same file, §3).
- `EmptyState` primitive, loading skeleton, error/retry, offline banner (Sprint 01 infrastructure) —
  `ComplaintStates.dc.html`/`EcnStates.dc.html`, reused unchanged.
- Global stale-write (409) dialog/toast pattern (Sprint 01) — reused for every `lockVersion`-guarded
  mutation (PATCH/acknowledge/close/convert/approve/reject/Kanban drag) across both modules; no
  complaint/ECN-specific dialog invented.

States covered across both modules' full surface: default/populated, loading (skeleton), empty
(zero-complaint, zero-ECN), error/retry, permission-hidden (nav curated + server 403, both roles),
permission-view-only (viewer sees full content, no mutating affordances), offline (mutation-disabling
banner), stale-write (409, existing global dialog/toast), the complaint SLA's 3 states (on_track/
at_risk/breached, all shown), the ECN approval tracker's per-stage states (pending/approved/rejected,
all shown), and destructive/one-way-action confirms (ECN reject; complaint Acknowledge/Close take no
confirm per their own no-extra-fields AC, matching this app's existing no-confirm-when-no-fields norm).

## 6. Mobile

Confirmed independently, not deferred to the sprint file's own word: re-grepped
`project_brain/mobile/src/m-*.jsx` for `complaint|ECN|change notice` this session —**zero matches**, no
mobile screen names, implies, or references either module. **No mobile screens are designed here.
Mobile stays fully unaffected by this sprint** — no route, no nav entry, no board, matching the sprint
file's own §1a/§7 confirmation and X1's "mobile RBAC config, if any, stays untouched" note.

## 7. Open questions (genuine ambiguities, not blocking)

Per the sprint's own instruction, these are flagged rather than guessed silently, but none of them
blocks Gate 1 — each got the smallest reasonable call, stated below, and build may proceed on that call
unless the user says otherwise:

- **Q-D1 (new).** The complaint detail panel's **Edit** action has no drawn shape in the sprint file or
  the jsx beyond "PATCH exists" (C1 AC2/C3 UC). Smallest reasonable call, made on Board `Main.dc.html`'s
  own caption: Edit reuses the corrected `IntakeForm` dialog shape (Board `ComplaintIntakeCorrected.
  dc.html`), pre-filled with the complaint's current values, restricted to the fields C1 AC2 actually
  allows on `PATCH` (customer/contact/channel/severity/subject/description/batch/cost — never status or
  the link columns). Not drawn as a 12th board since it is pixel-identical to Board 2 pre-filled; flagged
  here in case the PO wants a lighter, non-modal inline-edit pattern instead.
- **Q-D2 (new).** §3's own flagged inconsistency (§3 above): the ECN detail board's Approve/Reject
  render visibly-disabled for a non-approver, per the sprint's explicit §5 item 3 instruction, while
  `document-detail.tsx`'s own established pattern for the identical "you can't approve this" case hides
  the buttons and substitutes status text. Both are real, WCAG-compliant patterns already in this
  codebase; this sprint follows the sprint file's explicit instruction for ECN specifically, not
  silently. Not blocking — flagged for the PO/planner in case a future cross-module pass wants one
  single convention for "insufficient role to decide" across documents and ECN.
- **Q-D3 (new).** Contact/Channel's exact placement in `IntakeForm`'s grid (directly under Customer, a
  new row ahead of Severity/Batch) is this designer's own smallest-reasonable read of the sprint's
  "likely alongside Customer/Severity at the top" phrasing, not a pixel position the sprint file states
  outright. Flagged in case the PO had a different placement in mind (e.g. Channel first, since it is
  P18 §1's more structurally required field of the two).

## 8. Sign-off

Every screen/state of `CustomerComplaints`/`IntakeForm` (§1) and `ECNWorkbench`/`ECNList`/`ECNKanban`
(§2) is mapped to a story with no uncovered jsx element and 0 divergence (neither module is built yet —
confirmed by route-glob and `planned-modules.ts`, not assumed). **Eight boards** are drawn in the
existing visual language, all eight named in the sprint file's own §5 design-needs list with no
additional undisclosed gap found this session (unlike DESIGN-05, which found one design-needs omission
independently — this sprint's own §5 list is complete against both jsx files' full surface). Every
control across both modules has a target behaviour already named by the PO in
`SPRINT-06-complaints-ecn.md` §2's ACs and §3's approved backend design; this design pass adds no new
behaviour, only the visual surface for behaviour the PO already specified. WCAG 2.1 AA and Nielsen
heuristics are checked for the jsx-derived screens (§3 above) and all eight boards (§4). Three genuine,
non-blocking ambiguities are named in §7, each already resolved by the smallest reasonable call so the
sprint is not blocked on them.

Per the user's blanket pre-approval for new visual designs ("For design, I give my approval now itself.
Don't ask again."), no separate sign-off pause is needed for these eight boards.

**Designer sign-off: APPROVED**, unconditionally — every screen/state of both modules across all eight
boards is mapped to a story with a named target behaviour, no new colour/radius/font/component style is
introduced anywhere, and the three flagged items in §7 are non-blocking, already-resolved judgment
calls, not open gates.

**Touch-up pass sign-off (2026-09-30, §0): APPROVED**, unconditionally — the ECN machine's growth to
5 gates/9 columns (`ppap`) and the new `resubmit` action (Amendments 1+2, §0/§0b) are now fully
reflected on `EcnKanbanDnD.dc.html` (9th column, Resubmit button on Rejected cards) and
`EcnDetailApproval.dc.html` (5-row tracker incl. `ppap`, Resubmit/Submit/Withdraw/Close actions, the
persisted auto-revise banner, the affected-records unlink control) — every screen and state of every
story on both surfaces is mapped to an existing jsx or an approved board, and every control (incl. the
newly added `submit`/`withdraw`/`close`/`resubmit`/unlink affordances) has a target behaviour already
named by the PO in the sprint file's §2/§4. No new colour/radius/font/component style was introduced;
the one new dot colour on the Kanban's PPAP column (`--risk-info`, `#6366f1`) is an existing
`tokens.css` token, not a new one. Per the user's blanket pre-approval, no separate sign-off pause was
taken.

Gate 1 (UI Lead Designer audit + design sign-off) is now satisfied for this sprint, including this
touch-up. §3's backend design (both amendments) was already approved by the user. The `planner` agent's
architecture re-review pass remains the one outstanding step before implementation may begin, per
`SCRUM.md`'s ordering and the sprint file's own DoD §8 first checklist item.
