# DESIGN-03B — Predictive risk (web, Sprint 03 Part B)

Author: UI Lead Designer. Date: 2026-09-28. Sprint: `docs/sprints/SPRINT-03-graph-predictive.md` §2B (P1-P6),
§3B (user-approved scoring methodology, approved 2026-09-28).

**Scope note:** this audit covers Part B (predictive risk, P1-P6, `predictive.jsx`) only. Part A (graph
explorer, G1-G4) was audited separately in `docs/design/DESIGN-03-graph.md` (designer `APPROVED`) — not
re-litigated here, including its one open item (the `finding` node-type icon), which is **confirmed closed**:
`DESIGN-03-graph.md` §2 resolved it (lucide `Search`, cyan `#0891b2`, no collision) and §5 recorded that
resolution under an `APPROVED` sign-off. Nothing in Part B touches the graph module.

Canvas (2 new boards): https://claude.ai/artifact/6VfDRfYgWGngfRVCbjgj6d

## 1. Audit table — screen/state → existing jsx or new board

| Story | Screen / state | Existing jsx (cite exact lines) | New board | Divergence (built vs jsx) |
|---|---|---|---|---|
| P3 | `ForecastSpark` (history solid, forecast dashed, 80% band fill, "now" divider) | `predictive.jsx` 14-62 | — | Not built (`/predictive` is `ModulePlaceholder` today) — fed by real `history`/`predicted_value`/`band_low`/`band_high` per P3 AC2, not the jsx's synthetic arrays |
| P3 | `LeadRow` (identity + driver, spark, predicted figure + delta + confidence) | `predictive.jsx` 117-159 | — | Not built |
| P3 | Risk-level chip vocabulary (Critical / High / Watch / Stable) | `predictive.jsx` `PRED_LEVELS` 80-85 | — | Not built. **Component decision in §2.1** — reuses `k-chip` inline with a local label map (jsx's exact wording), not the shared `RiskBadge` |
| P1/P3 | Risk-level **thresholds** that decide which bucket a subject falls in | N/A — jsx hard-codes `level` per mock row; no computation exists in the prototype | — | Behavioural, not visual — §3B's `2×`/`1.5×`/`1.1×` trailing-average thresholds (user-approved) drive which of the 4 existing chip colours renders; no new chip states |
| P3 | KPI strip (identity of the 5→3-tile reduction) | `predictive.jsx` 174-180, grid 200-211 | — | **Component decision in §2.2** — same `k-surface` stat-tile shape, `repeat(3,1fr)` in place of `repeat(5,1fr)`, "Forecast accuracy" tile dropped, "Lines flagged"/"Suppliers flagged" merged into one combined tile per §3B's explicit "3, honestly" |
| P3 | Model banner (name/version, cadence/feature line) + predicted-vs-actual/band/now legend | `predictive.jsx` 213-237 | — | Not built. **Copy corrected per §3B** — ships `"NC-Forecast v1 · statistical baseline"` / `"Recomputed nightly · feature: trailing NC volume by area/supplier"` in place of the jsx's literal `"NC-Forecast v3 · gradient-boosted"` / `"Retrained weekly · features: SPC drift, PPM trend, audit findings, calibration-due, operator churn"` — layout, icon, legend markup unchanged |
| P3 | Header actions — Horizon `Segmented` (month/quarter/2Q) | `predictive.jsx` 189-191 | — | Not built |
| P3/P4 | Header actions — "Forecast pack" export button | `predictive.jsx` 192 | — | Not built. Wired to the real export pipeline (P4) instead of `kToast` — same `k-btn-ghost` markup |
| P5 | Header actions — "Tune model" button | `predictive.jsx` 193 | **Board: "P5 — Governance disclosure (replaces Tune model)"** | **Removed, not built and not reproduced** — a fake permission-gated `kToast` (CLAUDE.md rule 10). Board shows the before/after header and the replacement panel — see §2.3 |
| P3 | "Leading indicators" overline | `predictive.jsx` 240-242 | — | Not built |
| P3 | Two ranked panels (`Card` "Production lines" / "Suppliers") | `predictive.jsx` 243-254 | — | Not built |
| P1/P3 | **"Not enough history" — row-level** (one subject in an otherwise-populated ranked list has <4 of 6 periods scored) | No jsx state — the prototype's mock data is always fully populated | **Board: "P1/P3 — Not enough history states", State A** | New — see §2.4 |
| P3 | **"Not enough history" — panel-level** (one whole subject kind, e.g. all suppliers, has zero scored subjects; the other panel has data — P3 UC "partial-empty") | No jsx state | **Board: "P1/P3 — Not enough history states", State B** | New — see §2.4 |
| P1/P3 | **"Not enough history" — page-level** (tenant-wide, nothing scored anywhere — P21 DoD's named empty state, P3 UC "empty") | No jsx state | **Board: "P1/P3 — Not enough history states", State C** | New — see §2.4 |
| P3 | `openLine`/`openSupplier` click-through (lines→`/spc`, suppliers→supplier detail) | `predictive.jsx` 167-172 | — | Not built. Reuses existing `/spc` and supplier-detail routes, no new routing |
| P3 | Recurring failure modes panel (header, privacy-note banner, `MiniTrend`, table, "Review" click-through) | `predictive.jsx` 106-112, 64-78 (`MiniTrend`), 256-320 | — | **OMITTED — out of scope, §7 Q17.** Cross-tenant anonymized aggregation has no privacy/consent design anywhere in the spec (rule 2/8 tenant isolation gives no designed exception); not audited as a gap, not built, not silently dropped — the page states nothing where this panel would sit, per the sprint doc's explicit instruction |
| P6 | PPAP `AiPredictionPill` | No jsx change — component already built and already renders whatever's in `ppap_submissions.ai_prediction` | — | **Already built**, data source becomes real (P6 is a writer, not a UI change). Verification only, not a design item |
| P2/P3 | Permission-hidden (no `prediction:view`) | No screen — infra | — | Nav entry already curated (`ROLE_NAV`); direct deep-link 403 reuses the S2-1/G4 route-guard precedent — no new visual |
| P2/P3 | Error/offline (fetch fails; page is fully read-only so offline only affects initial fetch) | No jsx state (static prototype) | — | Reuses existing generic primitives — see §3, same posture as DESIGN-03 Part A |

Counts: **13 existing-jsx screens/sub-views audited** (spark, lead row, risk chips, KPI strip, model banner +
legend, horizon control, forecast-pack button, overline, two ranked panels, click-through map) · **2 new
boards published** (covering 3 not-enough-history states + the governance-disclosure replacement) · **1
existing built component reused as-is, no design change** (`AiPredictionPill`, P6) · **1 panel/section
omitted per explicit out-of-scope decision** (Recurring failure modes, Q17) · **0 diverged** — `/predictive`
is `ModulePlaceholder` today (confirmed: `apps/web/src/app/(app)/predictive/page.tsx` renders
`ModulePlaceholder` with `LineChart`), so every row is "not built," not "built-wrong," same posture as
DESIGN-02 and DESIGN-03 Part A.

## 2. Decisions

### 2.1 Risk-level chip — local label map, not the shared `RiskBadge`

The app already has a generic `RiskBadge` (`apps/web/src/components/ui/badge.tsx:45-53,77-85`) whose
`RISK_STYLES` colours (`critical #b91c1c` / `high #c2410c` / `medium #b45309` / `low #15803d`) are **already
pixel-identical** to the jsx's `PRED_LEVELS` `fg` values — confirming no new colour is needed. But
`RiskBadge`'s labels are generic ("Medium", "Low"); the jsx's own labels are domain-specific ("Watch",
"Stable", `predictive.jsx:83-84`), and rule 9 (design fidelity) binds the jsx's exact wording, not a
paraphrase. The jsx itself doesn't call any shared badge component here either — `LeadRow` renders a raw
`k-chip` with `background: lv.bg, color: lv.fg` inline (`predictive.jsx:135`), the same pattern
`graph-explorer.jsx` and other modules use for a screen-local vocabulary.

**Decision: reuse `k-chip` directly with a local `PRED_LEVELS`-equivalent label/colour map (Critical / High /
Watch / Stable), matching `RISK_STYLES`' colours exactly but not calling the shared `RiskBadge` component.**
No new chip variant, no new colour — same reasoning as DESIGN-03's `finding`-icon decision (a closed,
screen-local vocabulary, not a cross-module one).

### 2.2 KPI strip — 5 tiles → 3, resolved as a merged tile

§3B is explicit: *"KPI strip this sprint ships (5 tiles → 3, honestly)."* Naming the three, its prose lists
"Predicted NCs", "Lines flagged / Suppliers flagged", and "Model confidence" — the slash-joined middle item
is ambiguous between "2 tiles described together" and "1 merged tile." The jsx's own KPI tile
(`predictive.jsx` 200-211) is a `k-surface` with a label, a mono value, an optional delta, and a sub-line —
nothing about the shape prevents the value line from holding two related numbers.

**Decision: honour §3B's literal "3" — merge "Lines flagged" and "Suppliers flagged" into one tile** (label
"Lines / suppliers flagged", value e.g. `"3 / 4"`, sub "of 9 lines · 11 suppliers"), using the exact same
`k-surface` tile shape with `grid-template-columns: repeat(3, 1fr)` in place of the jsx's `repeat(5, 1fr)` —
no new component, a smaller instance of the one that exists. Recorded here per CLAUDE.md's "smallest
reasonable choice, log it" rule rather than round-tripped back to the PO, since §3B's own text already commits
to the count; only the one-tile-or-two ambiguity needed resolving. Shown in the new board's State C (§2.4).

### 2.3 "Tune model" removal (P5)

No spec describes a tuning surface; §3B confirms v1 has no tunable parameters. Per P5 AC2, the button is
**removed from the header actions entirely**, not disabled/greyed (a disabled-looking button implies "a
control exists, you lack access" — false, since nobody has this control). The replacement lives in the page
**body**, not the header: a static "Model governance" panel using the audits module's own
`DetailRow`/`SummaryStat` label-over-value pattern (`audits.jsx:376-392`) — 4 fields (Model & version, Retrain
cadence, Inputs, Tunable parameters: "None"), no button, no chevron, no hover state, a neutral "Read-only"
`k-chip`. Placed directly below the existing (copy-corrected) model banner so the two read as one family. Full
before/after and the panel itself are on the board (§2.4 canvas).

### 2.4 New boards (canvas above)

1. **"P1/P3 — Not enough history states"** (1180×1560) — three states on one board, same "several states, one
   board" pattern DESIGN-02 used for its Raise-from-finding board:
   - **State A (row-level):** the exact `LeadRow` grid (identity | spark | figure), dashed border instead of
     solid, muted dot, no risk-coloured chip (this isn't a risk level) — a neutral "Insufficient history"
     `k-chip`, spark slot replaced by a period-count readout ("2 of 6 periods logged"), figure slot shows
     "—" / "not scored". Not clickable — nothing to open.
   - **State B (panel-level):** one panel populated, the sibling panel (same `Card` shell) shows the **built**
     `EmptyState` primitive — exactly the pattern `audit-frequency-chart.tsx:32` already uses inline inside a
     chart panel (icon + title + body, no action, since the job runs nightly with no user step). No new
     component.
   - **State C (page-level):** the tenant-wide case — KPI strip in its "—" fallback shape (the same
     missing-stat convention already shipped in `supplier-list.tsx:295` — `value > 0 ? … : "—"`), the model
     banner unchanged (it describes the model, not current data), and **one** page-wide `EmptyState` in place
     of both ranked panels — not two separately-empty panels, per the P3 UC's explicit call-out.
2. **"P5 — Governance disclosure (replaces Tune model)"** (1180×1180) — before/after header comparison, the
   unchanged model banner for context, and the new governance panel per §2.3.

Both boards use only tokens already in `tokens.css` (ink accent `#18181b`, Archivo + JetBrains Mono, 3-9px
radii, flat hairline shadows) — no new colour, radius, font, or component style anywhere.

## 3. Component/state inventory (existing patterns only)

- **`k-surface`, `k-btn`/`-primary`/`-ghost`, `k-chip`, `k-overline`, `mono`, `Segmented`, `Card`
  (`settings.jsx:163-174` — header title/desc + body, the same shell `predictive.jsx`'s two ranked panels
  already use)** — reused verbatim.
- **`EmptyState`** (`apps/web/src/components/ui/empty-state.tsx`) — the built version matches the simple
  `primitives.jsx` shape (icon-in-circle, title, body, optional action), not the richer `tone`/`illustration`
  variant in `realtime-empty-skel.jsx` (that variant isn't what's actually built in the app, so the new boards
  don't use it either — consistent with what's really in the codebase, not the prototype's fuller gallery).
- **`k-chip` risk-level map** — see §2.1, screen-local, colours already match `RISK_STYLES`.
- **"—" missing-stat convention** — `supplier-list.tsx:295,300` precedent, reused for KPI tiles with nothing
  to show yet (§2.4 State C).
- **Route-guard / permission-hidden** — reuses the S2-1/G4 precedent (`ROLE_NAV` curation + server 403); no
  new visual.
- **Offline banner / error-retry** — Sprint 01 infrastructure, reused as-is; the jsx has no such state to
  audit (static prototype), same category DESIGN-02 §3 and DESIGN-03 §3 both called out.
- **`ForecastSpark`** — genuinely new *code* (no existing chart draws a solid-actual/dashed-forecast/band
  combination), but not new *design*: `predictive.jsx:14-62` is pixel-complete and binding; per rule 9 this is
  implementation work for `react-coder`, not a design gap.

States covered (P1-P3's UC list): default (populated), row/panel/page-level not-enough-history (§2.4),
loading (reuses `Skeleton`, no jsx equivalent — same reasoning as the offline bullet), error/offline,
permission-hidden, cross-tenant (P2's 404 on a foreign subject id — no visual, matches rule 8). Stale-write
does not apply — P2/P3 are read-only end to end (no mutation route exists for predictions, per P21).

## 4. Mobile

**Confirmed independently, not deferred to the PO's word.** `grep -il "predictive"
project_brain/mobile/src/m-*.jsx` → 0 hits. No `m-predictive.jsx` or equivalent exists anywhere in the mobile
design set. The sprint doc states the same (§1a, §2B every story's "Web/Mobile/Shared" row: "Mobile: not
designed; unaffected"). **No mobile screens are designed here. Mobile stays fully unaffected by Part B** — no
route, no nav entry, no board.

## 5. Sign-off

Every screen/state of every Part-B story (P1-P6) is now either mapped to existing binding jsx with §3B's
corrected copy substituted and the out-of-scope panel named rather than silently dropped (13 screens, §1), or
has an approved-pending board (2 new boards, canvas above, covering the 3 not-enough-history granularities and
the governance-disclosure replacement). Two component-reuse decisions (§2.1 risk-chip vocabulary, §2.2 KPI
tile merge) and one control-removal decision (§2.3) are recorded, not left implicit. The Part A `finding`-icon
question is confirmed already closed in `DESIGN-03-graph.md`, not re-opened here. Mobile requires nothing this
sprint (§4, verified independently).

**Designer sign-off: APPROVED** for Part B (P1-P6) — pending the user's visual sign-off on the 2 new boards
before Gate 1 build starts, per SCRUM.md. Engineering may proceed to the architecture review once
product-owner sign-off (already `APPROVED` for use-case coverage) and this design sign-off are both green and
the 2 boards are approved.
