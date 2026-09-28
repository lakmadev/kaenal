# DESIGN-03 — Knowledge graph explorer (web, Sprint 03 Part A only)

Author: UI Lead Designer. Date: 2026-09-28. Sprint: `docs/sprints/SPRINT-03-graph-predictive.md` §2A (G1-G4).

**Scope note:** this audit covers Part A (graph explorer, G1-G4) only, per the task that opened it. Part B
(predictive risk, P1-P6, `predictive.jsx`) is under a separate user approval gate (§3B of the sprint doc) not
yet given, and is explicitly **not** designed here — no board, no audit row, nothing below references it.

**Path correction:** the task named `docs/design/tokens.css` as the token source; no such file exists. The
real, single source of visual truth is `project_brain/project/styles/tokens.css`, ported verbatim into
`apps/web/src/styles/tokens.css` (diffed byte-for-byte identical on the semantic/token block; the web copy
only adds a header comment and one extra token, `--ai-gradient`, unrelated to this module). Audited against
the real file.

Canvas: **no new boards published** — see §1/§5, the jsx is fully binding for every G1-G4 screen/state; only
one small, non-visual decision is recorded (§2).

## 1. Audit table — screen/state → existing jsx or new board

| Story | Screen / state | Existing jsx (cite exact lines) | New board | Divergence (built vs jsx) |
|---|---|---|---|---|
| G1 | Empty canvas (no query/seed run yet) | `graph-explorer.jsx` `GraphExplorer` return, `shownCount === 0` branch, 413-426 | — | `/graph` is `ModulePlaceholder` today (`apps/web/src/app/(app)/graph/page.tsx`) — not built |
| G1 | Query bar (search input, Ask button, 4 query chips, "Try" row) | `graph-explorer.jsx` 364-406 | — | Not built |
| G1 | Query-active state (interpreted chips, summary, truncated chip, Why-these-results toggle, Clear) | `graph-explorer.jsx` 396-406 | — | Not built |
| G1 | Canvas — node card, edge paths/arrowheads, relation-label pill on hover/match | `graph-explorer.jsx` 428-491 (nodes), 434-456 (edges) | — | Not built |
| G1 | Cluster "+N more" node | `graph-explorer.jsx` 462-474 | — | Not built |
| G1 | Zoom controls (+/−/fit) | `graph-explorer.jsx` 496-502 | — | Not built |
| G1 | Legend & filters popover (type list, click-to-hide) | `graph-explorer.jsx` 504-526 | — | Not built |
| G1 | "Why these results" panel | `graph-explorer.jsx` 528-544 | — | Not built |
| G1 | Detail drawer (header, fields grid, connections list, footer CTA) | `graph-explorer.jsx` 546-606 | — | Not built |
| G1 | Detail drawer — synthetic-record footer state (`"Demo-scale record — no detail page"`) | `graph-explorer.jsx` 598-599 | — | **N/A this sprint** — see §2 divergence-from-spec note: no synthetic data ships (G3), so this branch of the jsx never renders in the real product; the footer's only reachable state is the real "Open full record" button (601) |
| G2 | Seed chips (empty-state "Start from a record" row) | `graph-explorer.jsx` `SEEDS`, 242-247, rendered 419-424 | — | Not built |
| G2 | `openRecord` click-through map (8 node kinds) | `graph-explorer.jsx` 342-355 | — | Not built |
| G4 | Permission-hidden (no `graph:view`) | No screen — infra | — | Nav entry already curated (`ROLE_NAV`, `apps/web/src/config/rbac.ts:40`); a direct deep-link 403 reuses the existing route-guard pattern (S2-1 precedent) — no new visual |
| G1 | Error/offline state (query fails; offline disables query bar) | No jsx state (jsx is a static prototype, always "loaded") | — | Reuses existing generic primitives — see §3, no new design needed |
| G1 (AC4) | `finding` node-type icon | `graph-explorer.jsx` `G_TYPES.finding`, line 16 (`icon: 'search'`, `#0891b2`) | — | **Decision recorded in §2** — confirmed, no board needed |

Counts: **13 existing-jsx screens/sub-views audited** (empty state, query bar default + active, canvas
node/edge/cluster rendering, zoom controls, legend, why-panel, detail drawer + its synthetic-footer
sub-state, seed chips, click-through map) · **0 new boards published** · **0 diverged** (nothing is built yet
for `/graph`; it is `ModulePlaceholder` today, so every row is "not built," not "built-wrong" — a pure
build-from-spec sprint, same posture as DESIGN-02).

**No mobile screens** — confirmed independently, not deferred to the PO's word. `grep -il "graph"
project_brain/mobile/src/m-*.jsx` returns zero hits; no `m-graph.jsx` or equivalent exists anywhere in the
mobile design set. The PO's sprint doc (§1a, §2A "Web/Mobile/Shared" for G1/G2/G4) states the same. Mobile
stays fully unaffected this sprint — no board, no screen, none needed.

## 2. The one open item — `finding` node-type icon (jsx line 16)

The sprint doc (§5.3) asks the designer to confirm the jsx's `icon: 'search'` for the `finding` node type
against the existing lucide `Search` icon, or flag a collision (the precedent being DESIGN-02's audit-icon
decision, where reusing `ClipboardCheck` for both `inspection` and `audit` would have made two entity kinds
render identically in shared surfaces).

**Checked against `project_brain/project/src/primitives.jsx`'s `ICONS` map (the jsx's own SVG path
dictionary, the ground truth for what each `icon:` string actually draws):**

- `search` (line 27: `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>`) is
  path-for-path lucide's `Search` (magnifying glass) — no ambiguity in what to reproduce.
- **No collision.** Unlike the audit/inspection case, `lucide-react`'s `Search` is already used pervasively
  in this codebase (`command-palette.tsx:260`, every list's search field, `topbar.tsx`, etc.) but always as a
  **functional affordance glyph** ("search this list"), never as an **entity-type glyph** anywhere
  (`entity-routes.ts`'s `ICONS` map has no `search` entry for any kind). The graph module's `G_TYPES` icon set
  (`clipboard`/`truck`/`search`/`shieldCheck`/`alert`/`brain`/`doc`/`tool`) is its own closed vocabulary,
  rendered only inside `GraphCanvas`, the legend popover, and the detail drawer — it never appears in the
  command palette, notifications, or any other cross-module surface the way `entityIcon()` does. So there is
  no risk of two different record kinds rendering the same glyph in the *same* list, which is what made the
  audit case a real problem.

**Decision: use lucide `Search`, cyan `#0891b2` (jsx's own soft/solid pair), exactly as drawn. No board
needed — this is a direct 1:1 icon reproduction, not a design gap.**

**Related observation, not a blocker (recorded for the record, same spirit as DESIGN-02 §2.5's audit-icon
note):** the jsx's `capa` node-type icon (`icon: 'tool'`, line 21) is, per the same `primitives.jsx` path
dictionary (line 72), path-for-path lucide's `Wrench` — **not** `ClipboardList`, which is what
`entity-routes.ts` already uses as CAPA's `entityIcon()` everywhere else in the app (list rows, command
palette, notifications). This is a real inconsistency between the graph module's own self-contained legend
and the rest of the app's CAPA glyph, but it is the jsx's own explicit choice for this screen (design
fidelity rule: reproduce the jsx exactly, not "improve" it), and — per the no-collision reasoning above — the
graph's icon set never renders alongside `entity-routes.ts`'s CAPA glyph in the same view, so there is no
literal on-screen clash, only a cross-module vocabulary mismatch a careful eye might notice later. Flagged
here so it isn't silently reconciled or silently ignored; not blocking Part A design sign-off.

## 3. Component/state inventory (existing patterns only — nothing new introduced)

All colour/type/radius/shadow values below resolve through `tokens.css` (ink accent `#18181b`, Archivo +
JetBrains Mono, 3-9px radii, flat hairline shadows) — no new colour, radius, font, or component style is
introduced anywhere in this module.

- **`k-surface`, `k-btn`/`k-btn-primary`/`k-btn-ghost`/`k-btn-plain`, `k-chip`, `k-input`, `k-overline`,
  `mono`** — the query bar, chips (canned queries, "Showing N", "showing first N — refine to narrow", record
  count), zoom/legend buttons, and detail-drawer field labels reuse these verbatim, exactly as every other
  module does.
- **`StatusBadge`** (`apps/web/src/components/ui/badge.tsx:59`, backed by `STATUS_STYLES`) — already covers
  every normalized status the graph's `normStatus()` produces (`open`, `in_progress`, `resolved`, `verified`,
  `closed`, `scheduled`, `active`, `overdue`, …), confirmed by direct comparison against `badge.tsx`'s
  `STATUS_STYLES` map (itself already ported from this same prototype's `primitives.jsx` `STATUS_STYLES`,
  line 226). The node card's status dot and the detail drawer's status badge are the same component,
  full reuse — no new status vocabulary needed.
- **`entityHref`/`entityIcon`** (`apps/web/src/lib/entity-routes.ts`) — 7 of the 8 node kinds' click-through
  routes already exist (`inspection`, `ncr`→`/ncrs/:id`, `capa`, `document`, `8d`/`eight_d`/`eightd`,
  `supplier`, `audit`); only `finding` has no entry, and per G2's own UC it doesn't need one — a finding click
  navigates to its parent inspection's detail route with the finding highlighted (jsx `openRecord`,
  `case 'finding'`), reusing `inspection`'s existing route, not a new one.
- **Route-guard / permission-hidden pattern** — reuses the existing S2-1 precedent (nav entry already curated
  in `ROLE_NAV`, `apps/web/src/config/rbac.ts:40-41`; a direct deep-link 403s server-side). No new visual.
- **Offline banner / stale-write / error-retry** — `apps/web/src/components/shell/offline-banner.tsx` and the
  Sprint 01 offline infrastructure are reused as-is for "query endpoint fails → retry" and "offline disables
  the query bar." The jsx itself has no error/offline state to audit (it's a static, always-loaded prototype
  over an in-memory store) — this is exactly the same category DESIGN-02 §3 called out ("generic primitives
  already in the system, no jsx or board needed").
- **Canvas/pan-zoom/SVG edge-drawing** — genuinely new *code* (no existing web feature has an SVG pan/zoom
  canvas), but **not new design**: the jsx's `GraphCanvas` markup (428-491), `edgeGeometry` (123-131), and
  `layoutNodes` (132-145) are pixel-complete and are what gets reproduced; per rule 9 this is implementation
  work for `react-coder`, not a design gap.

States covered (per the sprint's UC list, G1): default (populated canvas), empty (`shownCount === 0`,
zero-seed/zero-result), query-active (matched/dimmed nodes + "Why these results"), loading (new — reuses
`Skeleton`, no jsx equivalent since the prototype has no network round-trip; same reasoning as the
error/offline bullet above), error/offline, permission-hidden, cap/truncation (`"showing first N — refine to
narrow"` chip, jsx line 402), cross-tenant/empty-seed (same empty-state affordance, no leak). Stale-write
does not apply — G1's routes are read-only (no mutation on this module).

## 4. Mobile

**Confirmed independently: no mobile screens exist or are designed for this sprint.** `grep -il "graph"
project_brain/mobile/src/m-*.jsx` → 0 hits. No `m-graph.jsx`. The PO's sprint doc states the same
(§2A G1/G2/G4 "Web/Mobile/Shared" rows: "Mobile: not built... ROADMAP §5 states none designed"). Stated
explicitly per the task's instruction — this is not an oversight, mobile is simply out of this sprint's
surface.

## 5. Sign-off

Every screen and state of every Part-A story (G1-G4) maps to existing binding jsx (13 screens/sub-views,
§1) — no new board was required because the jsx is pixel-complete for this module, including its
loading/empty/query-active/cap-truncation states; the two genuinely-missing states (network error, offline)
reuse existing generic primitives already in the system (§3), same posture as DESIGN-02's list/detail/
checklist screens. The one open decision the sprint doc flagged (`finding` icon, §5.3) is resolved in §2 with
no collision found, and one adjacent minor inconsistency (CAPA's `tool`/`Wrench` glyph inside the graph's own
legend vs. `ClipboardList` elsewhere) is recorded, not blocking. Mobile is confirmed out of scope (§4).

**Designer sign-off: APPROVED** for Part A (G1-G4) — engineering may proceed straight to the architecture
review / build gate for the graph explorer once product-owner and (if required) architect review are also
green. Part B (predictive risk, P1-P6) remains undesigned and ungated here, pending the user's §3B approval,
per the task's explicit instruction not to design ahead of it.
