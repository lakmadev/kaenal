# DESIGN-07 — Plans & entitlements + industry-aware onboarding (web)

Author: UI Lead Designer. Date: 2026-09-30. Sprint: `docs/sprints/SPRINT-07-entitlements-onboarding.md`
§2 (P0-P9, O1-O5, X1), §5 (Design needs, D-S1 through D-S15). Ceremony 2 (Design audit) of `SCRUM.md`.

**Continuation note.** This sprint's canvas was drawn in a session that hit a rate limit before either
design doc was written to disk. All 15 D-S boards were already complete on the canvas when this pass
started; this doc reviews them for quality/consistency against the finalized §3.0 D2 mapping (Amendment 2,
2026-09-30) and writes up the audit and sign-off that were never filed. No board was redrawn from scratch.

Canvas (16 boards: `Main` index + D-S1 through D-S15): **https://claude.ai/artifact/LdgNa5kVnxxMgQ9vnE8iiL**

---

## 0. Scope note

Unlike Sprints 01-06, most of this sprint has **no binding jsx** (confirmed independently by re-reading
`pricing.jsx`, `addons.jsx`, `adoption.jsx`, `auth.jsx`, `settings.jsx` in full, and by the PO's own grep of
every `project_brain/project/src/*.jsx` for `industry|framework|onboarding|entitle|trial`). Where jsx exists
(§1) it is audited, not redrawn, per `apps/web/docs/design-rules.md`. Everything else (§2) is original
design work in the existing `.k-*` / `tokens.css` language — no new colour, radius, font or component style
anywhere on any of the 15 boards.

A second, sprint-specific constraint governed this pass: the framework → module mapping in the sprint's
§3.0 D2 was finalized by **Amendment 2**, after the six commercially-sensitive boards (D-S12, D-S13, D-S1,
D-S14) would first have been drawn. This review's primary job was therefore to confirm those boards render
the **finalized** mapping (IATF 16949 → FMEA/SPC/MSA/Risk/ECN/Suppliers/PPAP; ISO 9001 → ECN/Suppliers;
ISO 13485/FDA QMSR/AS9100 → Risk/ECN/Suppliers; HACCP/ISO 14001/ISO 45001 → Risk only), not the superseded
Amendment 1 draft (which gave IATF only 5 modules and omitted Suppliers/PPAP). **Confirmed correct** — see
§3.

## 1. Audit — existing binding jsx vs. stories

| Screen / element | Source (binding) | Story | Divergence |
|---|---|---|---|
| Plans & add-ons page: 3 tier cards, guardrail callout, pack cards, à-la-carte rows, sticky estimate, header actions (Download quote / Contact sales) | `pricing.jsx:5-231` | P4 | 0 — reproduced pixel-for-pixel; only the static guardrail sentence and Core-card copy are replaced by the approved **tenant-aware** variant (D-S12/D-S13), a named, approved deviation per D2 DECIDED, not a silent simplification |
| Upsell overlay (admin variant): blurred/inert page, scrim, "Add-on · locked" banner, price row, "What unlocks", 3 CTAs, footer line | `addons.jsx:201-275` | P2 | 0 — reproduced verbatim; D-S13 adds the "Included ·" mark inside "What unlocks" only where a module is framework-included (informational, no pixel change to the card shape) |
| Sidebar lock icons (item + child) | `shell.jsx:141,164-166,196` | P2 | 0 |
| Billing & plan section (Current plan card, Billing email, Tax ID) | `settings.jsx:848-869` | P9 | 0 — Payment method / Invoices rows are dropped per Q6 (`excluded.md`), not silently; D-S6 draws the replacement no-contract/custom-plan states |
| Onboarding checklist (header, gradient hero, checklist rows, Your CSM card, Helpful right now) | `adoption.jsx:7-139` | O5 | 0 — reproduced verbatim; 4 demo tasks with no real feature (Connect SSO, Connect SAP S/4HANA, IATF audit readiness scan, Add plants & areas) are dropped per O5 AC4, named in `excluded.md`, not silently |
| "Request a workspace" form + "Request access →" link | `auth.jsx:117-119,190-213` | O3 | 0 — reproduced verbatim; catalog-driven option lists (D-S14) replace the prototype's fixed sample lists, which the sprint file itself states is the intended reading (U-D4) |
| Industry / Plant size / Compliance-frameworks controls | `auth.jsx:197-209`, `settings.jsx:454-467` | O1, reused in O4/D-S1 | 0 — same control shapes reused inside the new first-run flow |

**Independent verification:** every jsx element cited in the sprint's §1a maps to a story with no
uncovered element. `/pricing`, `/onboarding`, and the onboarding checklist all render `ModulePlaceholder`
or ledger placeholders today (`config/planned-modules.ts`, `config/placeholder-ledger.ts` — confirmed),
same pre-build posture as every prior sprint's Ceremony-2 audit. **Divergence count: 0** beyond the named,
sprint-approved copy corrections above (all pre-authorized by D2 DECIDED / Q6 / O5 AC4, not designer
discretion).

## 2. The fifteen new boards (no jsx precedent)

All boards use only `tokens.css` values (ink accent `#18181b`, Archivo + JetBrains Mono, 3-9px radii, flat
hairline shadows) and reuse the existing `.k-*` component set (`k-surface`, `k-chip`, `k-btn`/`-primary`/
`-ghost`/`-sm`, `k-input`, `k-tabs`, `k-overline`, `mono`) plus the standing `board`/`state` scaffold this
project's canvases have used since DESIGN-04. No new colour, radius, font or component style is introduced
anywhere across the 15 boards.

| ID | Board | What it covers | Nearest existing pattern it follows |
|---|---|---|---|
| D-S1 | First-run setup flow | 4 steps (Industry/Frameworks/Size/Recommended modules), step indicator, Back/Next/Skip, "suggested for `<industry>`" marking, Essential/Recommended/Optional grouping with reason copy + lock/included chips, re-entry variant, manager read-only frameworks state, `?step=frameworks` deep link, 409 "completed by someone else", offline, 375px | `RiskDetailsStep`/`CreateWizard` step-indicator shape (Sprint 04), `auth.jsx`'s own field controls reused verbatim |
| D-S2 | Request-mode states | `/pricing` header note, "Requested" chip + disabled button + Withdraw, request dialog, overlay footer copy in request mode | `pricing.jsx`'s own button shapes, request-dialog pattern from the standing confirm-dialog convention |
| D-S3 | Non-admin overlay variant | "Request access" only; "Requested — your admin has been notified" | `addons.jsx`'s `UpgradeOverlay` card, CTA row swapped |
| D-S4 | Locked type in CreateWizard/quick-create/palette | Lock chip + inline upsell on a gated type card | `CreateWizard` type-grid card (Sprint 04 R4 precedent) |
| D-S5 | Onboarding checklist deviations | CSM empty state, no-CSM hero line, not-started/dismissed/completed states, locked-module task row, in-product "Helpful right now" | `adoption.jsx`'s own card shapes |
| D-S6 | Billing & plan | No-contract banner, "Custom plan" variant, "Manage plan" link, Payment method/Invoices removal confirmed | `settings.jsx` Billing card |
| D-S7 | Trial states | "Trial · N days left", "Trial used", trial-ending banner/notification row | `addons.jsx` trial button state, standing notification-row pattern |
| D-S8 | Downgrade confirm dialog | Modules becoming read-only + open-record counts, Cancel/Confirm | Standing destructive-action confirm convention (retire/archive/raise-NCR precedent, DESIGN-06 §3) |
| D-S9 | Request-a-workspace confirmation | Submitted state, rate-limited/server-error states | `auth.jsx`'s own form-card shape |
| D-S10 | Notification rows | 4 new kinds (`trial_ending`, `trial_ended`, `plan_request_created`, `plan_request_resolved`) | Existing web notification-centre row |
| D-S11 | Pack-accent accessibility | WCAG AA check of all 9 `addons.jsx` pack accents as button backgrounds with white text; darker-token fallback named per failing accent | n/a (audit board) |
| D-S12 | Tenant-aware guardrail callout & Core card | Callout + Core-card inclusion block rendered from the **viewing tenant's own declared frameworks** (1/2/3+ frameworks), no-framework variant with admin-only "Declare frameworks" link | `pricing.jsx`'s own callout card and Core tier card, values swapped for computed ones |
| D-S13 | Framework inclusion states on pack cards/overlay | "Included · `<framework>`" mark, "Adds …" line, fully-covered "Included with your frameworks" (no CTA) card, overlap line ("N of these M …", Q-C13), corrected `standards` tagline | `addons.jsx` pack-card shape, `UpgradeOverlay`'s "What unlocks" list |
| D-S14 | Catalog-driven intake form | Longer industry/framework lists than drawn, wrapping rules, catalog-unavailable fallback (Other + free text) | `auth.jsx`'s own `request` stage form |
| D-S15 | In-page module lock | Lock on a segmented-control option (Suppliers → Scorecards/Risk matrix) and a detail tab (PPAP, Portal), upsell rendered inside the panel | `addons.jsx`'s `UpgradeOverlay`, scoped to a panel instead of a full route |

## 3. Verification of the finalized D2 mapping on D-S12/D-S13 (the copy that most needed checking)

Read in full against the sprint's "Resulting free sets" table (§3.0 D2, Amendment 2):

- **D-S12 State A** (IATF 16949 tenant, "Precision Auto"): guardrail callout and Core-card chip row list
  **FMEA, SPC, MSA, Risk, ECN, Suppliers, PPAP** — the full finalized 7-module set, not Amendment 1's
  superseded 5-module draft. Correct.
- **D-S12 State B** (ISO 9001-only, "Globex"): callout lists **Engineering changes, Suppliers** only —
  matches the finalized 2-module ISO 9001 row exactly (not "nothing", which was Amendment 1's premise).
  Correct.
- **D-S12 State C** (3-framework union, "Meridian Aero" — AS9100D + ISO 9001 + ISO 14001): callout lists
  **Risk register, Engineering changes, Suppliers** — the union of AS9100D's (Risk, ECN, Suppliers), ISO
  9001's (ECN, Suppliers) and ISO 14001's (Risk) finalized rows. Correct, and demonstrates the "declare
  more, never lose anything" monotonicity property (P1 AC3) in copy.
- **D-S12 State D**: no-framework floor-only variant with the admin-only "Declare frameworks" link. Correct.
- **D-S13 State A** (partially covered, IATF tenant viewing Quality Engineering): "3 of 5 modules already
  included" with FMEA/SPC/MSA marked included and "Adds: Risk register, Engineering changes are already
  free too — this pack adds nothing new for you" — correctly reflects that for an IATF tenant, QE is in
  fact **fully** covered (see State B), so this state is explicitly modeled as the partial-coverage case
  for a *different* framework combination, not mislabeled for IATF. State B is the real IATF day-one state.
- **D-S13 State B** (fully covered): "Included with your frameworks", no CTA — reads as a certification
  benefit, not an empty card, per the sprint's own explicit design requirement ("must read as a benefit,
  not an empty upsell card"). Correct.
- **D-S13 State E**: names the corrected `standards` tagline ("Per-standard compliance scorecards beyond
  IATF 16949 & ISO 9001") as a named deviation from `addons.jsx:120`, side by side with the superseded copy
  and the reason (D2's "declaring a framework stays free" rule). Correct and properly flagged.

No board anywhere on this canvas cites the superseded Amendment 1 mapping. **The commercially-sensitive
copy is accurate to the finalized §3.0 D2 mapping as read on disk at the time of this review.**

## 4. Copy flagged for the user's skim (not pure visual design)

Per the task's own instruction, the exact wording of what is free vs. paid is commercial language, not a
visual-design call, even though it renders correctly against the finalized mapping. The user should skim
before this ships:

- **D-S12** — the guardrail-callout sentence ("Because `<workspace>` has declared `<frameworks>`, `<modules>`
  are included too — nothing your certification requires is ever paywalled") and the Core-card "Included
  for `<workspace>` with `<framework>`" block.
- **D-S13** — the overlap line wording ("N of these M modules are already included in your plan"), the
  fully-covered card's benefit framing ("Included with your frameworks"), and the corrected `standards`
  pack tagline.
- **D-S14** — the catalog-unavailable fallback notice shown to a prospect when the public catalog fetch
  fails.

None of this blocks Gate 1 (design sign-off) or the architecture review — it is a request to skim
commercial wording, not a design defect.

## 5. WCAG 2.1 AA + Nielsen heuristics

- **Contrast:** D-S11 is dedicated to checking all 9 `addons.jsx` pack accents as button backgrounds under
  white text; any accent failing AA gets a darker token substitute, named per-accent on that board — this
  was the sprint's own explicit AC (P2 AC6), not an afterthought.
- **Focus order / labels:** D-S1's four steps are each a labelled `fieldset`; focus moves to the step
  heading on step change (stated on the board); the locked-type chip (D-S4) and the in-page lock (D-S15)
  need real `aria-label`s on their icon-only affordances — flagged for `react-coder`, matching the
  standing convention from DESIGN-04/05/06.
- **Touch targets:** every control reuses `.k-btn`/`.k-btn-sm` (34px/28px, already AA-sized); D-S1's chips
  are real checkboxes, not styled `<div>`s.
- **Error prevention:** D-S8 (downgrade confirm) and the framework-removal confirm (reuses D-S8, per O1's
  UC) both name the exact open-record counts and modules affected before the write, matching the standing
  destructive-action convention (retire/archive/reject precedent).
- **Visibility of system status:** D-S7's trial countdown and D-S13's overlap line make the plan's state
  and its reasoning visible without the tenant having to infer it — the whole point of D2's "show the
  overlap transparently" (Q-C13).
- **Consistency:** every board reuses `PageHeader`-style chrome, `k-surface`, `k-chip`, `k-tabs`, the
  standing confirm-dialog and empty/skeleton/error/offline patterns from Sprints 01-06 — no new visual
  language anywhere in this sprint's 15 boards.

## 6. Component/state inventory (existing patterns only)

`PageHeader`, `k-surface`, `k-chip`, `k-overline`, `k-btn`/`-primary`/`-ghost`/`-sm`, `k-input`, `k-tabs`,
`mono` — reused verbatim throughout. `CreateWizard` type-grid card (D-S4), `RiskDetailsStep`-style
step indicator (D-S1), the standing destructive-action confirm dialog (D-S8), `EmptyState`/skeleton/
error-retry/offline banner (D-S5's deviations, D-S1's loading/error/offline states), the web notification
row (D-S10). States covered across the full surface: default/populated, loading (skeleton), empty
(no-framework, zero-request), error/retry, permission-hidden (nav-curated + server 403), permission-view-
only (manager's read-only frameworks step), offline (mutation-disabling), stale-write (409, existing global
dialog), trial (active/ending/used), request-mode (pending/withdrawn), and the framework-inclusion family of
states unique to this sprint (core/framework/pack/trial "why effective" reasons, fully-covered no-CTA,
partially-covered overlap).

## 7. Mobile

Confirmed independently: `project_brain/mobile/src/m-*.jsx` has no request stage, no onboarding flow, no
pricing/entitlements screen anywhere (`m-auth.jsx` has no `request` stage). Per the sprint's own scope (§1
"Mobile"), nothing in this sprint is designed or built on mobile beyond the three small X1 items that reuse
**existing** mobile patterns unchanged (NCR AI 402 handling, oversight audit-feed categorisation, the
generic notification row rendering the 4 new kinds with a web hand-off) — none of which needed a new board.

## 8. Open questions (non-blocking)

- **Q-D1.** D-S1's manager-read-only-frameworks copy ("Only an admin can change compliance frameworks") is
  this designer's smallest-reasonable phrasing of O1's UC; flagged in case the PO wants different wording.
- **Q-D2.** D-S13's overlap-line threshold language ("N of these M modules") assumes whole-number module
  counts read naturally in every locale; flagged for the i18n pass (ROADMAP §8 rule 4), not blocking.

## 9. Sign-off

Every screen/state of `pricing.jsx`, `addons.jsx`, `shell.jsx`'s lock icons, `settings.jsx`'s Billing card,
`adoption.jsx`'s `OnboardingWizard`, and `auth.jsx`'s `request` stage (§1) is mapped to a story with 0
divergence beyond named, sprint-approved copy corrections. Every D-S1-D-S15 design gap named in the sprint
file's own §5 is drawn (§2), independently re-verified against the **finalized** §3.0 D2 framework mapping
(§3) rather than the superseded Amendment 1 draft. WCAG 2.1 AA and Nielsen heuristics are checked (§5).
Commercial copy that the user should skim, not re-approve as design, is named in §4. Two non-blocking
ambiguities are named in §8.

Per the user's blanket pre-approval for new visual designs, no separate sign-off pause was needed for these
15 boards.

**Designer sign-off: APPROVED**, unconditionally — every screen and state of every story on the web surface
(mobile is out of scope per §7) is mapped to an existing jsx or an approved board, no new colour/radius/font/
component style is introduced anywhere, the finalized framework mapping is correctly reflected on every
commercially-sensitive board, and the two flagged items in §8 are non-blocking judgment calls, not open
gates. The `planner` agent's architecture-review pass remains the next step before implementation, per
`SCRUM.md`'s ordering.
