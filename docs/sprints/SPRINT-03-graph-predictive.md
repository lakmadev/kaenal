# SPRINT-03 — Knowledge Graph Explorer + Predictive Risk

Author: Product Owner. Date: 2026-09-28. Part of the multi-sprint programme in `ROADMAP.md` (Wave 3 of 13).
Governing rules: CLAUDE.md rules 0, 1-8, 9, 10, 11 and `SCRUM.md`. Design fidelity is a completion gate.
Builds on Sprint 01 (shell) + Sprint 02 (audits, merged) — not touched here.

**This sprint has TWO PARTS with different approval status (ROADMAP §0 Q2):**

| Part | Gate | Story range |
|---|---|---|
| **A — Graph explorer** | No approval gate. Read-only bounded query over an existing table. | G1-G4 |
| **B — Predictive risk** | **APPROVAL GATE.** New table + a scoring methodology that did not exist before this sprint. **The user must approve §3B (scoring method, inputs, weights) before any predictive code is written.** | P1-P5 |

The scrum lead presents **§3B alone** for that approval — not the whole sprint file — per the task that opened
this sprint.

---

## 1. Goal and roles served

**Part A.** Replace the `/graph` `ModulePlaceholder` with a query-first knowledge-graph explorer: pan/zoom
canvas over the cross-module linkage graph (`entity_links`), seed records, click-to-expand neighbours,
4 canned analytical queries, clustering for high-degree nodes — everything `graph-explorer.jsx` (616 lines,
read in full) and FEATURES §10.1 specify.

**Part B.** Replace the `/predictive` `ModulePlaceholder` with forward-looking NC-volume forecasts for
production lines and suppliers (ranked lists, sparkline + confidence band), plus wiring the existing
`ppap_submissions.ai_prediction` stub to a real job instead of the permanent `{}` default it has shipped
with since migration 0020 — everything `predictive.jsx` (326 lines, read in full) and FEATURES §10.2 specify,
**except** the jsx's third panel ("Recurring failure modes" — cross-tenant anonymized industry-cohort
analytics), which is **out of scope this sprint** (§7, Q17) because it requires cross-tenant data aggregation
that CLAUDE.md's tenant-isolation rules (2, 8) do not have a designed exception for, and no spec section
(P21, FEATURES §10.2) mentions it at all — it exists only in the jsx mock. Flagged honestly, not silently
built or silently dropped.

Roles served: admin, manager, auditor — `apps/web/src/config/rbac.ts` `ROLE_NAV` already lists `graph` and
`predictive` for exactly these three roles (not inspector/viewer, not partner). This sprint must add the
matching **capabilities** (`graph:view`, `prediction:view`) to `packages/core/src/rbac.ts` so the UI curation
and the server's `@RequireCapability` enforcement agree — today neither capability exists, so the routes
would be reachable to anyone with a session once built (a real gap, not a hypothetical one).

## 1a. Verified current state (grepped this session, not assumed — CLAUDE.md rule 10)

| Fact | Evidence |
|---|---|
| `entity_links` exists: directed edges over `inspection/ncr/eight_d/audit/capa/document/supplier`, no `finding` or `scar` kind in its CHECK constraint | `packages/db/migrations/0018_entity_links.sql:45-50` |
| `GET/POST /v1/entity-links`, `POST /v1/entity-links/:id/delete` exist (per-entity related-records list, capped `LINK_CAP=200`, no cursor) — **NOT** a bounded multi-hop graph-query endpoint | `apps/api/src/collab/entity-links.controller.ts`, `entity-links.service.ts`; contract `packages/types/src/contract.ts:876-890` |
| No `GET /v1/graph` or any graph-traversal route anywhere in the contract or `apps/api/src/**/*.controller.ts` | `grep -n "graph" packages/types/src/contract.ts` → 0 hits outside entity-links comments |
| `risk_predictions` table does **not exist** in any migration; `grep -rn "risk_predictions"` across the repo hits only `ROADMAP.md` and `P21-predictive-risk.md` (the proposal itself) | `find packages/db/migrations` — no match |
| P21's own filename hint ("migration `0030_predictions.sql`") is stale — `0030` is already `fmeas`/`fmea_items` (P13, shipped). Next free migration number is **0062** (`0061_audits_module.sql` is the last one on disk) | `packages/db/migrations/0030_fmea.sql`; `ls packages/db/migrations \| sort` |
| `ppap_submissions.ai_prediction jsonb NOT NULL DEFAULT '{}'` exists (migration 0020) with a documented shape (`confidence`/`willMissDeadline`/`daysLikelyOver`/`reasoning`) and is read by `ppap-list.tsx`/`ppap-detail.tsx`/`ppap.service.ts` — but **nothing anywhere writes it**; every submission renders the empty-prediction state today | `packages/db/migrations/0020_ppap.sql:11-14,59`; `grep -rn "ai_prediction"` finds only the read path, no writer |
| `scars` has **no** equivalent prediction column — the "PPAP/SCAR prediction stubs" note in `ROADMAP.md`/PROGRESS.md refers to PPAP only; SCAR has none to wire | `grep -n "ai_prediction\|prediction" packages/db/migrations/0021_scar.sql` → no hits |
| `findings` (inspection findings: `item_ref`, `severity`, `description`, `ncr_id`) is a real, existing, tenant-scoped table — matches the jsx's `finding` node type (`window.FINDINGS`: `itemId`/`severity`/`observation`/`ncrId`) field-for-field, but is **not** an `EntityKind` and has no `entity_links` rows | `packages/db/migrations/0001_core.sql:175-189` vs `graph-explorer.jsx:16,59` |
| "Production line" (`FORECAST_LINES`: `L4`, `S3B`, `L1`...) is **not a modeled entity** anywhere — no `lines`/`production_lines` table exists. `areas` (per-plant, `tenant_id, plant_id, name`) already exists and is exactly this shape (`ncrs.area_id`/`inspections.area_id` already FK it) | `packages/db/migrations/0001_core.sql:93-104,152-153,210-211`; `grep -rln "production_line\|CREATE TABLE.*lines\b"` → no hits |
| No `graph:view`/`prediction:view` capability exists; `ROLE_NAV` in `apps/web/src/config/rbac.ts` already curates `graph`/`predictive` to `admin`/`manager`/`auditor` only, ahead of any backend enforcement existing | `packages/core/src/rbac.ts:18-82` (no `graph`/`prediction` entries); `apps/web/src/config/rbac.ts:29-46` |
| Plant-scoping precedent for a multi-kind fan-out query already exists: `SearchService` federates `inspection/ncr/capa/document/audit`, filtering `inspection`/`ncr`/`audit` by `plant_id = ANY(caller's plants)` and leaving `capa`/`document` unscoped, matching each table's actual schema (`capas`/`documents`/`eight_ds`/`suppliers` carry no `plant_id`) | `apps/api/src/search/search.service.ts:18-24,68-80` |
| `assertEntityVisible`/`tableFor` (`apps/api/src/collab/entity-ref.ts`) already give a closed, injection-safe `EntityKind → table` map reusable by a graph service | `apps/api/src/collab/entity-ref.ts` |
| Background jobs already write audited rows with `actorKind: "system"` inside `withAudit`, the pattern a nightly `predict-risk` job reuses | `apps/api/src/jobs/processors/sla.ts:67-100` |
| A per-tenant fan-out "sweep" job pattern (`*.sweep` enqueues one job per active tenant) already exists 5 times (`sla`, `files`, `schedule`, `docs`, `housekeeping`) — `predict-risk` is the 6th | `apps/api/src/jobs/job-types.ts:23-53` |
| `packages/core` has no `forecast.ts`/`graph-layout.ts` yet; `fmea.ts`/`spc.ts`/`audit-checklist.ts` are the existing precedent for "pure scoring/aggregation logic lives in core, tested against a reference example" | `ls packages/core/src` |
| `ExportResource` enum has no forecast/graph value; `audit_report` (Sprint 02) is the direct precedent for a single-resource PDF export | `packages/types/src/enums.ts:316-326` |
| `/graph` and `/predictive` are both `ModulePlaceholder`s today; both are already in the placeholder ledger (`"page:graph": 3`, `"page:predictive": 3`) and in `navigation.ts` with no `children` (single-page modules, unlike `capa`/`audits`) | `apps/web/src/app/(app)/graph/page.tsx`, `apps/web/src/app/(app)/predictive/page.tsx`, `apps/web/src/config/placeholder-ledger.ts:26-27`, `navigation.ts:138-139` |
| Mobile: no `m-*.jsx` file mentions graph or predictive anywhere. `grep -il "graph\|predictive" project_brain/mobile/src/m-*.jsx` → 0 hits | grepped this session |

---

# PART A — Graph explorer (no approval gate)

## 2A. Stories

### G1 — Bounded graph-query endpoint

**Design:** `graph-explorer.jsx` `buildCore`/`layoutNodes`/query functions (`qSupplierD8`, `qBlocking`,
`qDocsImpacted`, `qOpenCapas`, lines 175-233), `G_TYPES` (13-22).

**Important nuance the P20 phase doc's `GET /v1/graph?seed=&depth=&types=&status=` framing glosses over:**
the jsx does **not** implement one generic parameterized traversal. It implements two distinct primitives,
both bounded:
1. **Node expand** — click a node → reveal its immediate neighbours grouped by type, capped at
   `NEIGHBOR_CAP=6` per type with a "+N more" cluster continuation (`CLUSTER_REVEAL=12` per further click).
2. **4 fixed named analytical queries** — each a specific, hard-coded bounded traversal (supplier→NC→8D
   escalation path; what's blocking a case from closing; documents impacted downstream of an anchor; open
   CAPAs + their triggers), each capped at `QUERY_CAP=60` total nodes and each returning a deterministic
   `steps` narrative (a "Why these results" explanation) that is **computed data, not an LLM call** — the
   steps are plain string interpolation over the query's own intermediate result, no AI/model involved.

The free-text query box (`Ask`) does **keyword matching** client-side (`matchTyped`) to route typed text to
one of the 4 named queries — not NLP, no backend parsing needed; this sprint reproduces that keyword router
as-is, not a smarter one (no spec asks for real NLP here).

UC
- Happy (expand): open `/graph` empty state → click a seed chip (Weld porosity NC, `8D-2026-0015`,
  a supplier, `IATF re-cert audit`) → canvas shows that node + its immediate neighbours, clusters where a
  type exceeds 6.
- Happy (named query): click one of the 4 query chips (or type matching text + Enter) → canvas repaints to
  exactly that query's bounded result set; matched nodes/edges highlighted, non-matched dimmed; "Why these
  results" panel shows the steps.
- Happy (click-through): click a non-synthetic node's detail-panel "Open full record" → navigates to that
  entity's real detail route (`ENTITY_ROUTE` map, reusing the same pattern as document detail's linked
  records).
- Empty: no `entity_links` rows exist yet for the tenant → canvas empty state exactly as jsx (`shownCount
  === 0`), not a bare error.
- Error/offline: query endpoint fails → retry affordance; offline banner disables the query bar (reuse
  S1-5 infrastructure).
- Permission: `graph:view` required; a role without it never sees the nav entry (`ROLE_NAV`, already
  curated) and a direct deep-link 403s (existing route-guard pattern from Sprint 02 S2-1).
- Cap/perf: a query or expand that would exceed its cap truncates and shows the jsx's "showing first N —
  refine to narrow" chip, never silently drops without saying so.
- Cross-tenant: a seed id from another tenant → the seed resolves to nothing (RLS-scoped query) → same
  empty-result affordance, not a 404 leak of "this id exists elsewhere" (rule 8; the seed selector itself
  only offers ids the caller's tenant seed/search can find, so this is a defense-in-depth case, not a normal
  path).

AC
1. `GET /v1/graph/expand?seed=<kind>:<id>` returns `{center, neighbors: {[type]: {items: NodeDto[], total,
   remaining}}}` — items capped at 6 per type server-side (mirrors `NEIGHBOR_CAP`), `remaining` count exact
   (not "many"); a second call with `after` cursor semantics per type reveals the next 12 (mirrors
   `CLUSTER_REVEAL`) — cursor-paginated per rule 6.
2. `GET /v1/graph/query/:queryId` (`queryId` one of `supplier-nc-8d`, `blocking`, `docs-impacted`,
   `open-capas`, closed enum — not a free string) with an optional `focus`/`anchor` param per query, returns
   `{nodes: NodeDto[], edgeKeys: string[], truncated, summary, steps}` capped at `QUERY_CAP=60` nodes,
   computed inside `packages/core/graph-queries.ts` (pure, unit-tested against a small fixture graph) called
   by the service with real rows.
3. Every `NodeDto` carries the same "card" shape the jsx's `ensInsp`/`ensAudit`/etc. builders construct —
   title, status, 2-4 key fields, summary — sourced from a real row read (join into the entity's own table),
   never fabricated.
4. `finding` becomes a first-class node type: `EntityKind` gains `"finding"`, `entity_links`'s CHECK
   constraint gains `finding`, `ENTITY_TABLES` maps it to `findings`; inspection→finding→NCR edges are
   backfilled/written going forward the same way other entity links are (a finding's creation already knows
   its inspection and optional NCR — write the two `entity_links` rows in the same transaction as finding
   creation, audited as `linked` like every other link).
5. Layout/geometry (`layoutNodes`, `edgeGeometry`, barycenter layer-ordering) lives in
   `packages/core/graph-layout.ts` as pure, unit-tested functions — the API returns raw `{nodes, edges}`
   only, per P20 "clustering/layout is a client concern," but the *algorithm* (not the DOM/canvas rendering)
   is written once in core so both the layout math and its tests are shared, not duplicated if mobile or a
   report ever needs the same geometry.
6. Cross-tenant seed/anchor id → empty result (RLS), not an error that reveals existence (rule 8).
7. `graph:view` capability required on both routes; foreign-tenant/plant-out-of-scope nodes never appear in
   results (plant filter applied per-kind exactly like `SearchService`: `inspection`/`ncr`/`audit`/
   `finding` (via its parent inspection) plant-scoped, `eight_d`/`capa`/`document`/`supplier` not).

**Web/Mobile/Shared**
- **Web:** `GraphCanvas` (SVG pan/zoom per jsx), `NodeCard`, cluster "+N more" button, type legend/filter,
  query bar (4 chips + typed keyword router), seed picker, detail drawer (fields + connections + "Open full
  record"), empty/loading/error states. New feature dir `apps/web/src/features/graph/`.
- **Mobile:** **not built.** No `m-*.jsx` designs a mobile graph screen (confirmed §1a); ROADMAP §5 states
  none designed. Mobile stays fully unaffected — no route, no nav entry, no shared-type consumption beyond
  what's additive in `packages/types` (mobile typecheck must stay green, nothing more).
- **Shared:** `EntityKind` gains `finding` (`packages/types/src/enums.ts`); `NodeDto`/`GraphExpandResult`/
  `GraphQueryResult` Zod schemas in `packages/types`; `packages/core/graph-layout.ts` +
  `packages/core/graph-queries.ts` (pure, unit-tested); `graph:view` capability in
  `packages/core/src/rbac.ts`.

### G2 — Seed selector + entity click-through

**Design:** `graph-explorer.jsx` `SEEDS` (242-247), `openRecord` (342-355).

UC
- Happy: the 4 documented seed chips (a real weld-porosity NC, an 8D case, a supplier, an audit) resolve to
  real tenant records seeded for the demo login, matching the design's example ids in spirit (the exact
  codes are prototype fixtures; this sprint's seed data picks the tenant's own equivalent records, not the
  literal `NCR-2026-0089` string, since that id doesn't exist in the real demo dataset).
- Empty: a seed type has zero live data (e.g. tenant has no 8D cases yet) → that seed chip is omitted, not
  shown-then-broken.
- Click-through: clicking a real (non-synthetic — see G3) node's "Open full record" navigates to its actual
  detail page for every one of the 8 kinds (`inspection`, `finding`→ its inspection detail with the finding
  highlighted, `nc`→NCR, `eightd`, `capa`, `supplier`, `audit`, `document`).

AC
1. Seed list is computed from real data (a small query per kind: "give me one recent record"), not
   hard-coded ids.
2. `openRecord` maps every one of the 8 node types to its real route; no node type click-through is a dead
   end (§5).

**Web/Mobile/Shared:** Web only (see G1). Shared: none beyond G1's types.

### G3 — No synthetic-mass demo data in production graph

**Design:** `graph-explorer.jsx` `buildStore`'s `mulberry32`-seeded synthetic generator (71-119) — the
prototype pads the graph with ~12,000 fake records (30 suppliers, 60 audits, 300 documents, 1500 8Ds, 2500
CAPAs, 8000 NCs) "so scale behaviour is real."

UC
- The real backend has real record counts (whatever the tenant's actual data is) — this sprint does **not**
  port the synthetic-mass generator into the product. It exists in the jsx purely to demo pan/zoom/cluster
  behaviour at scale; the bounded caps (G1 AC1/2) are what make the real UI behave correctly regardless of
  how many real records exist, so no synthetic padding is needed for the feature to work.
- Permission/empty: a small real tenant (a handful of records) sees a small real graph — not artificially
  bulked up. This is explicitly named so nobody mistakes the sparse real-data look for a bug relative to the
  jsx screenshot.

AC
1. No synthetic/demo-scale record generator ships in `apps/api` or `apps/web` for this module.
2. The empty/small-graph state is verified against real seeded demo data, not the jsx's synthetic count.

**Web/Mobile/Shared:** N/A — a scope clarification, not a build item with its own surface.

### G4 — Cross-cutting: nav retirement, capability wiring

UC
- `/graph` resolves to the real explorer for `admin`/`manager`/`auditor`; a direct deep-link from
  `inspector`/`viewer` 403s (server) and the nav entry stays hidden (client, already curated).
- Command palette: no new quick-action needed (graph has no "create" verb); confirm the existing nav-search
  entry for "Knowledge graph" still routes correctly once the placeholder is gone.

AC
1. `packages/core/src/rbac.ts` gains `graph:view`, assigned to admin (all), manager, auditor — matching
   `ROLE_NAV`'s existing web curation exactly (no role gets the nav entry without the capability or vice
   versa).
2. `GraphController` routes carry `@RequireCapability("graph:view")`.
3. Placeholder ledger entry `"page:graph"` removed once `/graph` is real.

**Web/Mobile/Shared:** Web + Shared (capability). Mobile unaffected.

## 2A-review. Architecture review (planner, 2026-09-28) — GATE 1 CLOSED, READY

4-slice plan (schema+enum → contract/core/service → isolation+gate → web UI), agents `db-migrations` →
`api-engineer` → `test-engineer` → `react-coder`. Combined smaller than Sprint 02's per-entity pattern
since this is one query surface over one existing table (`entity_links`), not N independent CRUD entities.

Four corrections against code already read (not new scope), resolved directly (each had one fully
determined fix, per SCRUM.md's token-economy rule — no PO round-trip needed):

1. **AC4 write-timing, G1.** `findings.service.ts` create() only ever sets `inspection_id`; `ncr_id` is
   NULL until `ncr.service.ts:368` sets it inside the raise-NCR-from-finding transaction. **Resolved:**
   the inspection↔finding `entity_links` row is written at finding creation; the finding↔ncr row is
   written inside the raise-NCR transaction at `ncr.service.ts:368`, not at finding creation.
2. **AC1 cursor shape, G1.** Up to 8 independently-paginated node types inside one `/expand` response
   don't fit a single flat cursor. **Resolved:** `GET /v1/graph/expand?seed=&type=&after=` — a
   per-(seed,type) cursor, since the UI only ever reveals one type at a time (one cluster click).
3. **`findings` has no `plant_id`, G1/AC7.** Plant-scoping requires a JOIN to `inspections.plant_id`, not
   a direct column filter. **Resolved:** api-engineer joins through `inspections`, does not assume a
   column that doesn't exist.
4. **Migration numbering.** Provisional; take next-free at build time. Part B's `0062_risk_predictions.sql`
   is reserved in this doc but not yet real — Part A must not collide with it if Part B lands first.

**Build starts now on Part A** per the 4-slice plan above.

---

# PART B — Predictive risk — **APPROVAL GATE (ROADMAP §0 Q2) — USER APPROVED (2026-09-28)**

**User approved §3B as proposed** (schema, v1 trend+seasonal-naive method, risk thresholds 2×/1.5×/1.1×,
corrected non-fabricated banner copy) — asked for the full methodology detail first, then approved as
proposed without changes. Architecture review for Part B follows before build.

## 2B. Stories

### P1 — `risk_predictions` table + nightly scoring job

**Design:** `predictive.jsx` `FORECAST_LINES`/`FORECAST_SUPPLIERS` (90-104), KPI strip (174-180), model
banner (213-237).

See **§3B for the full scoring methodology — this is the part requiring sign-off.**

UC
- Happy: a nightly job computes a forecast per subject (production line = `areas` row, supplier =
  `suppliers` row) from that tenant's own historical NCR volume, writes one `risk_predictions` row per
  subject per horizon.
- Not-enough-history (empty state per P21 DoD): a subject with fewer than the minimum history points (see
  §3B) gets **no** row written for it that run — the UI shows "not enough history yet" for that subject, not
  a fabricated confident number from thin data.
- Offline/job-failure: a run that errors for one tenant does not block other tenants' fan-out (mirrors the
  existing `*.sweep` → per-tenant job isolation pattern).

AC
1. `risk_predictions` (see §3B for exact columns) forced RLS, leading `tenant_id` index, composite
   `created_by`/`updated_by` member FKs on the generating actor (`system`).
2. `predict-risk.sweep` (fan-out) + `predict-risk.compute` (per-tenant) jobs registered in `job-types.ts`
   alongside the existing 5 sweep pairs; the per-tenant job runs inside a tenant-scoped transaction (jobs are
   not an RLS bypass — CLAUDE.md job-payload rule already documented in `job-types.ts`'s file header).
3. Every write goes through `withAudit` (`actorKind: "system"`, action `"created"`), in the same transaction
   as the insert (rule 3).
4. Baseline algorithm lives in `packages/core/forecast.ts`, pure, unit-tested against a hand-computed
   reference series (mirrors `fmea.ts`/`spc.ts`'s "tested vs AIAG reference" precedent — here tested against
   a hand-computed trend+band example, not AIAG since this isn't an AIAG method).

**Web/Mobile/Shared**
- **Web:** none directly (P3 consumes the read API).
- **Mobile:** not designed; unaffected.
- **Shared:** `risk_predictions` migration, `RiskPredictionDto` in `packages/types`, `packages/core/forecast.ts`.

### P2 — Read-only predictions API

**Design:** `predictive.jsx` `LeadRow`/`ForecastSpark` (14-62, 117-159).

UC
- Happy: `GET /v1/predictions?subjectKind=line|supplier&horizon=...&order=predicted_value` returns the
  ranked, cursor-paginated list the two `LeadRow` panels render.
- Detail: `GET /v1/predictions/:subjectKind/:id` returns one subject's full history+forecast+band for the
  spark.
- Permission: `prediction:view`.
- Cross-tenant: foreign-tenant subject id → 404 (rule 8).
- No mutations: this is a read-only surface end to end — no `POST`/`PATCH` route exists for predictions (the
  job owns the data, per P21).

AC
1. Both routes exist in the ts-rest contract, cursor-paginated (rule 6) on the list.
2. `model_version` and `generated_at` are always present on every returned row (P21 DoD: "model/version +
   generated-at disclosure" — predictions are advisory, never presented as unattributed fact).
3. Cross-tenant 404, mutation-tested.

**Web/Mobile/Shared:** Shared only (contract + service). Web consumes in P3; mobile unaffected.

### P3 — Predictive risk page (lines + suppliers)

**Design:** `predictive.jsx` `PredictiveRisk` (164-254), `ForecastSpark`, `LeadRow`, KPI strip, model banner.

UC
- Happy: `/predictive` shows the KPI strip (predicted NCs next-horizon, lines/suppliers flagged, model
  confidence, backtest accuracy — see §3B for which of these are honestly computable this sprint vs which
  the jsx invents), the model banner, horizon segmented control (month/quarter/2Q), two ranked panels
  (production lines, suppliers) with `ForecastSpark` + confidence + delta, click-through to
  `/spc`-or-supplier-detail per the jsx's `openLine`/`openSupplier`.
- Empty (tenant-wide "not enough history"): fewer than the minimum data points anywhere → the P21 DoD's
  named empty state, not two empty panels with no explanation.
- Partial-empty: one panel has data, the other doesn't (e.g. suppliers scored, lines not) → each panel has
  its own empty state independently.
- Permission: `prediction:view`; role without it → hidden nav (already curated) + 403 deep-link.
- Error/offline: fetch fails → retry; offline banner disables nothing mutable (page is fully read-only, so
  offline only affects the initial fetch, not a "disabled write" state).

AC
1. All jsx panels present **except** "Recurring failure modes" (§7 Q17, explicitly out of scope, not
   silently dropped — the page states nothing where that panel would be, no half-built placeholder for it).
2. `ForecastSpark` (history solid, forecast dashed, confidence-band fill) built once as a shared component
   using the same math the jsx uses (band width scales with horizon distance) fed by real
   `history`/`predicted_value`/`band_low`/`band_high` from the API — not the jsx's synthetic arrays.
3. "Forecast pack" export button wired to the real export pipeline (see P4) — not `kToast`.
4. "Tune model" button — see P5.
5. Horizon segmented control re-queries `GET /v1/predictions?horizon=`.

**Web/Mobile/Shared:** Web (`apps/web/src/features/predictive/`). Mobile: not designed, unaffected. Shared:
none beyond P2's types.

### P4 — Forecast pack export

**Design:** `predictive.jsx` line 192 (`kToast('Export started — forecast-pack.pdf')` — dead in the
prototype).

UC
- Happy: click "Forecast pack" → real export enqueued (existing `reports.export` pipeline, `run-export.ts`
  pattern), downloadable when ready — same UX the S2-2 `audit_report` export already established (progress
  toast → notification → download), not a fire-and-forget fake toast.

AC
1. `ExportResource` gains `"predictive_forecast_pack"`.
2. `run-export.ts` gains a branch rendering the current ranked lines+suppliers (as scoped/visible to the
   requesting caller) to PDF.
3. `prediction:view` required to request it (mirrors `audit:view` → `audit_report` precedent).

**Web/Mobile/Shared:** Shared (export resource + run-export branch) + Web (wire the button).

### P5 — "Tune model" button — honest scope

**Design:** `predictive.jsx` line 193 (`kToast('Model tuning requires the Intelligence admin role — request
sent')` — a fake permission-gated action in the prototype).

UC
- No spec (P21, FEATURES §10.2) describes a model-tuning surface, and §3B's v1 is a fixed statistical
  baseline with no tunable parameters exposed to end users (a real "tune model" UI implies hyperparameter
  or weight editing, which doesn't exist yet — see §3B open questions).

AC
1. This sprint does **not** build a real tune-model flow (no spec, no design beyond a toast).
2. The button is **not shipped** as a dead click: replaced with a static "governance" disclosure line
   (model name/version, retrain cadence, feature list — the same info the jsx's model banner already shows)
   instead of an interactive button that fakes a permission check. This is the smallest change that removes
   the dead control without inventing an unspecced admin flow (CLAUDE.md rule 10: never fake a feature).
3. Logged in §7 (Q18) as a real gap for a future settings-driven "AI governance" sprint (already on
   ROADMAP as Sprint 10) to pick up for real, not silently forgotten.

**Web/Mobile/Shared:** Web only (remove the fake-toast button).

### P6 — Wire the PPAP `ai_prediction` stub to the real job

**Design:** no jsx change — `ppap-list.tsx`/`ppap-detail.tsx`/`AiPredictionPill` already render this field;
today it is always `{}` (empty).

UC
- Happy: the nightly predict-risk job (P1) also scores in-flight PPAP submissions' deadline risk
  (`willMissDeadline`/`confidence`/`daysLikelyOver`/`reasoning`) and writes `ppap_submissions.ai_prediction`
  — the column and its Zod shape already exist (migration 0020), so this is a **writer**, not a schema
  change.
- A submission with no due date or too little history → `ai_prediction` stays `{}` (matches the existing
  nullable-field UI handling already shipped — `willMissDeadline == null` already renders as "no
  prediction" in `ppap-list.tsx`, confirmed by reading the component).

AC
1. `PpapRiskScoring` (in `packages/core/forecast.ts` or a small sibling, pure, unit-tested) computes the 4
   fields from `submitted_date`/`due_date`/element-completion-rate (already derivable — `packages/core/ppap.ts`
   already computes completeness).
2. The job writes it via a plain `UPDATE ppap_submissions SET ai_prediction = $1` inside the same
   tenant-scoped job transaction, audited (`updated`, `actorKind: "system"`) — no new column.
3. `AiPredictionPill` in the web UI needs no change (it already renders whatever's in the field);
   browser-verify it now shows real, non-empty values for at-risk demo submissions.

**Web/Mobile/Shared:** Shared (job + core scoring fn). Web: verification only, no component change needed.

---

## 3B. Predictive scoring methodology — PROPOSED, NEEDS EXPLICIT USER SIGN-OFF

*(This is the section the scrum lead extracts and presents alone for approval, per ROADMAP §0 Q2.)*

### Schema — `risk_predictions` (migration `0062_risk_predictions.sql`)

Per P21 §2, corrected against real schema names found this session:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid NOT NULL | forced RLS, leading index (rule 2) |
| `subject_kind` | text CHECK IN (`'line'`, `'supplier'`) | **`'ncr'` from P21's draft is dropped** — the jsx forecasts *lines* and *suppliers* only; NCR-level forecasting isn't in the jsx or FEATURES §10.2 (FEATURES says "suppliers / NCRs" but the jsx builds lines+suppliers, not per-NCR forecasts — jsx wins per CLAUDE.md's visual-spec precedence for what actually gets built. NCR-level forecasting is logged as Q19 in §7, not silently added or silently ignored). |
| `subject_id` | uuid NOT NULL | for `line`: an `areas.id` (composite FK `(tenant_id, subject_id) → areas(tenant_id, id)` when `subject_kind='line'`); for `supplier`: a `suppliers.id`. Enforced at the service layer (a CHECK-constraint-level conditional FK isn't practical in Postgres for a polymorphic column — mirrors how `entity_links`/`comments` already handle polymorphic references without a DB-level FK, validated in the service instead). |
| `horizon` | text | e.g. `2026-Q4` (calendar quarter string) — matches the jsx's "next month / next quarter / next 2Q" selector by computing 3 horizon rows per subject per run, not just one |
| `predicted_value` | numeric NOT NULL | forecast NC count for that horizon |
| `confidence` | int NOT NULL CHECK 0-100 | |
| `band_low`, `band_high` | numeric NOT NULL | 80% band (matches the jsx's legend "80% band") |
| `history` | numeric[] NOT NULL | last 6 periods' actual counts (feeds `ForecastSpark`'s solid line) |
| `reasoning` | text NOT NULL DEFAULT '' | short driver string (mirrors the jsx's `driver` field, e.g. "Cpk 0.84 ↓ · WE runs-rule active") |
| `model_version` | text NOT NULL | e.g. `nc-forecast-v1-baseline` (deliberately NOT `v3 gradient-boosted` — see below, the jsx's copy is aspirational fiction for a model that doesn't exist) |
| `generated_at` | timestamptz NOT NULL | |
| standard audit columns | `lock_version` not needed (job-only writes, no user edits — rows are append/replace, not user-mutated) | `created_at`/`created_by`(`system` actor)/`deleted_at` |

Unique on `(tenant_id, subject_kind, subject_id, horizon)` — a re-run replaces (upsert), doesn't accumulate
duplicate rows per horizon.

### Method — v1 statistical baseline (per P21 §2: "v1 = transparent statistical baseline... pure +
unit-tested; a real ML/AI model is a later swap behind the same table")

**What the jsx claims vs. what this sprint proposes to actually build** — stated explicitly because the gap
matters for the approval decision:

- The jsx's model banner says **"NC-Forecast v3 · gradient-boosted... Retrained weekly · features: SPC
  drift, PPM trend, audit findings, calibration-due, operator churn"** and a KPI tile claims **"Forecast
  accuracy 91% · MAPE 9% · last 4Q backtest."** None of that exists or can exist yet: there is no ML
  pipeline, no calibration-due tracking (Sprint 05, not built), no operator-churn data source anywhere in
  the schema, and "last 4Q backtest" requires 4 quarters of the *forecast itself* already having run, which
  is impossible for a v1 launch. Copying those claims into a real product screen would be **fabricating
  a capability** (CLAUDE.md rule 10) — a compliance-software customer reading "91% backtested accuracy" for
  a system that has never produced a forecast before is materially misleading.
- **Proposed v1, honestly:** a **trend + seasonal-naive linear-regression baseline with a fixed-width
  confidence band**, computed from each subject's own last 6 periods of actual NC counts (already real data
  — `ncrs` joined through `area_id` for lines, `ncrs.supplier_id` for suppliers, whichever exists on the NCR
  row; if NCRs aren't linked to an area/supplier the subject is skipped, not guessed).
  - **Inputs (v1, per subject):** the trailing 6 periods' NCR count for that `area_id` (line) or
    `supplier_id` (supplier) — count only, no SPC/PPM/audit/calibration features (those either don't exist
    yet as queryable series, or belong to modules not built until later sprints — see Known issues below).
  - **Formula:** ordinary least-squares linear trend over the 6 points → next-period point forecast;
    band = trend residual standard deviation × 1.28 (≈80% band under a normal-error assumption) scaled by
    √(periods ahead), matching the jsx's band-widens-with-distance visual behaviour.
  - **Confidence score (0-100):** derived from the trend's R² and the series length (more history + a
    cleaner trend → higher confidence) — a deterministic function of the same 6 numbers, not a
    separately-tuned "ML confidence."
  - **Minimum history:** a subject needs at least 4 of the last 6 periods with ≥1 NCR to be scored at all;
    below that, no row is written (P21 DoD's "not enough history" empty state, §2B P1 UC).
  - **Model banner text this sprint actually ships:** *"NC-Forecast v1 · statistical baseline (trend +
    seasonal-naive) · recomputed nightly · feature: trailing NC volume by area/supplier."* No "gradient-
    boosted," no invented feature list, no backtest-accuracy claim until there's real backtest history to
    report (tracked as Q19/Q20 below).
  - **KPI strip this sprint ships (5 tiles → 3, honestly):** "Predicted NCs next horizon" (real sum),
    "Lines flagged" / "Suppliers flagged" (real counts above a risk threshold — proposed threshold:
    `predicted_value` in the top confidence-weighted quartile, or `level` derived from `predicted_value`
    vs. the subject's own trailing average, thresholds below), "Model confidence" (real average). "Forecast
    accuracy 91% / MAPE 9%" is **dropped** until a real backtest exists (Q20).
  - **Risk level buckets** (drives `PRED_LEVELS` colors in the jsx: critical/high/medium/low): proposed
    thresholds — `critical` if `predicted_value ≥ 2× trailing average` AND `confidence ≥ 60`; `high` if
    `≥ 1.5×`; `medium` if `≥ 1.1×`; else `low`. (Open to adjustment — flagged as part of this sign-off, not
    a silent implementation detail.)
- **Reasoning/driver string (v1):** a short deterministic sentence built from which inputs moved the trend
  (e.g. "NC count rose 3→7 over 6 periods" ) — not the jsx's invented domain narratives ("Cpk 0.84 ↓ ·
  WE runs-rule active", "3 senior CMM operators retiring Q3"), which reference SPC/HR data this sprint does
  not wire in. Real SPC-driven reasoning becomes possible once `measurements`/`spc.ts` output is joined in —
  flagged as a natural v2 enhancement (Q20), not built now.
- **"Production line" subject resolution:** `areas` (existing table) stands in for "line" — an area's
  `name` is already exactly this shape in the seed data ("Line 4", "Assembly", "Stamping" etc. per the
  existing `apps/api` seed/provisioning). This resolves P21's own open question ("is production line a
  modeled entity yet") without inventing a new table.
- **Explicitly excluded from v1 (this sprint), logged not silently dropped:**
  - Cross-tenant "Recurring failure modes" panel (§7 Q17) — no privacy/anonymization design exists anywhere
    in the spec; a k-anonymity ≥5 + differential-privacy cross-tenant aggregation is a serious architectural
    undertaking (a new data-sharing consent model, a new aggregation pipeline outside per-tenant RLS
    entirely) that deserves its own sprint and its own explicit approval, not a rider on this one.
  - NCR-level (`subject_kind: 'ncr'`) forecasting (Q19).
  - Any SPC/calibration/operator-churn feature input (those modules don't exist yet or aren't wired to a
    time series usable here).
  - Real backtest accuracy reporting (Q20 — needs the model to have run for several historical periods
    first; this sprint can begin accumulating that history but cannot report it honestly on day one).
  - A real "tune model" admin surface (P5 — button removed, not faked).

**What the user is being asked to approve:** the `risk_predictions` schema above, the v1 trend+seasonal-
naive baseline method (inputs = trailing 6-period NCR counts by area/supplier only), the risk-level
thresholds, and the corrected (non-fabricated) model-banner/KPI copy — in place of the jsx's aspirational
"v3 gradient-boosted / 91% backtested" claims, which this sprint will NOT reproduce as real product copy.

---

## 4. Backend needs

| Story | Migration | Contract / REST route | Service | Audit events | RBAC | Tenant isolation |
|---|---|---|---|---|---|---|
| G1 | `entity_links` CHECK gains `'finding'`; `EntityKind` gains `finding` (Zod) | `GET /v1/graph/expand`, `GET /v1/graph/query/:queryId` (new) | `GraphService.expand`/`.query`, calling `packages/core/graph-queries.ts` | read-only, no new event; `findings.service.ts`'s existing create path gains 2 `entity_links` inserts (audited as `linked`, existing action) | `graph:view` (new) | plant filter per-kind mirrors `SearchService`; RLS scopes tenant; cross-tenant seed → empty result |
| G1 | none | `NodeDto`/`GraphExpandResult`/`GraphQueryResult` in `packages/types` | `packages/core/graph-layout.ts` (pure), `graph-queries.ts` (pure) | n/a | n/a | n/a |
| G4 | none | none | none | none | `graph:view` added to `packages/core/src/rbac.ts` for admin/manager/auditor | n/a |
| P1 | `0062_risk_predictions.sql` (new table, §3B) | none (job-only writer) | `PredictRiskProcessor` + `packages/core/forecast.ts` (pure) | `created`, `actorKind: "system"`, in-tx with the insert | job runs inside tenant-scoped tx (no capability — not an HTTP route) | forced RLS on `risk_predictions`; job fan-out mirrors existing `*.sweep` pattern, one tenant tx per subject batch |
| P2 | none | `GET /v1/predictions`, `GET /v1/predictions/:subjectKind/:id` (new) | `PredictionsService` — cursor list + single read | read-only | `prediction:view` (new) | cross-tenant subject id → 404; RLS scopes tenant |
| P4 | none | `ExportResource` gains `"predictive_forecast_pack"` | `run-export.ts` new branch | existing export-created event | `prediction:view` | scoped to caller's visible predictions before enqueue (mirrors `audit_report`'s pre-enqueue 404) |
| P6 | none (reuses 0020's `ai_prediction` column) | none | `PredictRiskProcessor` also updates `ppap_submissions.ai_prediction` | `updated`, `actorKind: "system"`, in-tx | n/a (job) | tenant-scoped job tx |
| G4/P3 | none | none | none | none | `prediction:view` added to `packages/core/src/rbac.ts` for admin/manager/auditor (mirrors `graph:view`) | n/a |

Every mutation runs inside `withAudit` in the same transaction (rule 3); the predictions list is
cursor-paginated (rule 6); all new Zod schemas live in `packages/types` (rule 4); layout math, query
traversal, and forecast scoring are `packages/core` pure functions, not business logic in controllers or
components (rule 5).

## 5. Design needs

**Existing binding jsx — designer AUDITS these against the built screens, does not redraw them:**
- `GraphExplorer`, `GraphCanvas`, node cards, cluster nodes, query bar, detail drawer, "why these results"
  panel, legend/filter — `graph-explorer.jsx` (full file, 616 lines, G1-G4).
- `PredictiveRisk`, `ForecastSpark`, `MiniTrend`, `LeadRow`, KPI strip, model banner — `predictive.jsx`
  (full file, 326 lines, P1-P5) — **with the corrected v1 copy from §3B substituted for the jsx's
  fabricated "v3 gradient-boosted / 91% backtest" text**, and the "Recurring failure modes" panel and its
  table/privacy-note **omitted** (out of scope, §7 Q17).

**NO existing jsx — designer must draw these, in the existing visual language, before Gate 1:**
1. **"Not enough history" empty state** (P1/P3) — the jsx has no such state (its mock data is always
   populated); needs a real empty-state design distinct from the zero-tenant-data empty state.
2. **Model governance disclosure replacing the "Tune model" button** (P5) — a small static panel (model
   name/version/cadence/feature list), not an interactive control; needs a visual treatment consistent with
   the existing model banner's styling but without an actionable-looking button.
3. **Graph node-type icon for `finding`** — the jsx already has one (`icon: 'search'`, cyan `#0891b2`);
   confirm the existing lucide `Search` icon matches, or note if it collides with another module's search
   iconography (small decision, same category as Sprint 02's audit-icon item).

## 6. Dead-end audit

| Control | Current state | This sprint |
|---|---|---|
| Sidebar "Knowledge graph" (`/graph`) | `ModulePlaceholder` | Real bounded explorer (G1-G4) |
| `graph-explorer.jsx` seed chips | No backend | Real seeds from live data (G2) |
| `graph-explorer.jsx` query chips (4) + typed "Ask" | No backend | Real bounded queries (G1) |
| `graph-explorer.jsx` node click → "Open full record" | No backend, no route for `finding` | Real click-through, `finding` becomes real (G1 AC4, G2) |
| Sidebar "Predictive risk" (`/predictive`) | `ModulePlaceholder` | Real ranked forecasts (P1-P3) — **contingent on §3B approval** |
| `predictive.jsx` "Forecast pack" button | `kToast` only | Real export (P4) |
| `predictive.jsx` "Tune model" button | `kToast` fake-permission-check | **Removed**, replaced by static disclosure — not a dead button, an honestly-scoped non-control (P5) |
| `predictive.jsx` lead-row click-through (lines→`/spc`, suppliers→supplier detail) | No backend | Real (P3, reuses existing `/spc` and supplier-detail routes) |
| `predictive.jsx` "Recurring failure modes" table + its "Review" buttons | No backend, no design spec | **NOT built** — no privacy/aggregation design exists; explicitly out of scope, listed in §7 Q17, not silently dropped, not half-built |
| PPAP list/detail `AiPredictionPill` | Renders permanently-empty `{}` | Real values via P6 (component itself unchanged, its data source becomes real) |

No new "coming soon" text, no new dead button. The two controls this sprint explicitly does NOT wire
("Tune model", "Recurring failure modes") are removed/omitted rather than left clickable-but-fake — CLAUDE.md
rule 10 is "never stub," not "never say no."

## 7. Out of scope / open questions

- **Q17 (new).** "Recurring failure modes" cross-tenant anonymized panel (`predictive.jsx` third section) —
  no spec, no privacy/consent design, and a real architectural undertaking (differential privacy,
  k-anonymity ≥5, cross-tenant aggregation outside per-tenant RLS). Not built this sprint. If wanted, it
  needs its own PO story + a security-reviewer pass + explicit user approval as its own gate — flagged here,
  not silently dropped or silently attempted.
- **Q18 (new).** "Tune model" real admin flow — no spec exists; P5 removes the fake button rather than
  building an unspecced one. A real version belongs with Sprint 10 (AI Governance), which already owns
  "models & routing" per ROADMAP §5.
- **Q19 (new).** `subject_kind: 'ncr'` forecasting — FEATURES §10.2's prose says "suppliers / NCRs" but the
  binding jsx only builds lines + suppliers. This sprint follows the jsx (CLAUDE.md's visual-fidelity
  precedent). If NCR-level forecasting is still wanted, it needs its own story next.
  next.
- **Q20 (new).** Real backtest-accuracy reporting for the model banner — impossible to report honestly until
  the v1 baseline has run for several real historical periods. Once P1 has been live a few horizons, a
  follow-up story can compute and surface a real MAPE.
- **Q21 (new).** Risk-level thresholds proposed in §3B (2×/1.5×/1.1× trailing average) are a first cut, not
  validated against real tenant data distributions — worth revisiting after the job has run against live
  demo/tenant data for a few cycles.
- Mobile: confirmed no `m-*.jsx` designs either module; both stay fully unaffected this sprint (no route, no
  nav, `pnpm --filter @kaenal/mobile typecheck` must stay green on the additive shared-type changes only).

## 8. Definition of Done

**Part A (no gate — can close independently of Part B):**
- [ ] `entity_links` CHECK + `EntityKind` gain `finding`; migration applied; `pnpm db:check` green;
      `pnpm test:rls` green including the new kind.
- [ ] Contract gains `GET /v1/graph/expand`, `GET /v1/graph/query/:queryId`; `graph:view` capability added
      to `packages/core/src/rbac.ts` and enforced via `@RequireCapability`.
- [ ] `packages/core/graph-layout.ts` + `graph-queries.ts` unit-tested (layout geometry, all 4 named
      queries against a fixture graph, cap/truncation behaviour).
- [ ] Web `/graph` fully real: seed chips, 4 query chips + typed router, expand/cluster, detail drawer,
      click-through for all 8 node kinds (incl. `finding`), empty/error/offline states — browser-verified
      side-by-side against `graph-explorer.jsx`.
- [ ] No synthetic-mass generator shipped (G3).
- [ ] Full gate green: `pnpm typecheck && pnpm lint`, `pnpm test`, `pnpm test:rls`, `pnpm db:check`.
- [ ] Demo login re-seeded and proven 201 after the suite run (rule 12).
- [ ] `PROGRESS.md` updated; `progress_mobile.md` gets an explicit "Sprint 03 Part A — mobile unaffected"
      line (not silently skipped, per Sprint 02's own DoD lesson).

**Part B (gated — cannot start until §3B is approved):**
- [ ] User has explicitly approved §3B (schema, v1 method, thresholds, corrected model-banner copy) —
      recorded here with a date once given.
- [ ] Migration `0062_risk_predictions.sql` (or next free number after Part A's migrations land) applied;
      `pnpm db:check`/`pnpm test:rls` green.
- [ ] `predict-risk.sweep`/`predict-risk.compute` jobs registered, tested (unit + integration against a
      seeded NCR history fixture), audited.
- [ ] `packages/core/forecast.ts` unit-tested against a hand-computed reference series.
- [ ] Contract gains the 2 read-only prediction routes + `predictive_forecast_pack` export resource;
      `prediction:view` capability enforced.
- [ ] Web `/predictive` real: KPI strip (3 honest tiles, not 5 fabricated ones), model banner (corrected
      copy), horizon control, both ranked panels with real `ForecastSpark`, forecast-pack export,
      "not enough history" empty state, governance disclosure replacing "Tune model" — browser-verified
      against `predictive.jsx` **minus** the excluded failure-modes panel.
- [ ] `ppap_submissions.ai_prediction` shows real values for at-risk demo PPAP submissions (P6),
      browser-verified in `ppap-list.tsx`/`ppap-detail.tsx`.
- [ ] Full gate green (same commands as Part A, run again after Part B lands).
- [ ] Demo login re-seeded and proven 201 (rule 12).
- [ ] `PROGRESS.md` updated (Decisions log: v1 baseline vs jsx's fabricated v3 claim, `areas`-as-"line"
      resolution, `subject_kind` scope cut to line/supplier); `progress_mobile.md` "Part B — mobile
      unaffected" line.

---

**PO use-case sign-off: APPROVED** — every use case (happy/error/empty/permission/offline/cross-tenant)
across G1-G4 and P1-P6 maps to a story with testable acceptance criteria and an explicit Web/Mobile/Shared
split; the dead-end audit (§6) accounts for every control either jsx introduces, with the two honestly
excluded (§7 Q17, Q18) named rather than faked. This sign-off covers **use-case coverage only**, per the
process this role follows at sprint open. It does **not** constitute approval to write Part B's code: per
ROADMAP §0 Q2, Part B (P1-P6) additionally requires the **user's** explicit approval of §3B's scoring
methodology (schema, v1 baseline method, risk-level thresholds, corrected model-banner/KPI copy) before any
predictive code is written — that is a separate gate from this sign-off, tracked in §8's Part B DoD, and
still **PENDING** as of this writing. Part A (graph explorer, G1-G4) carries no such gate and may proceed
through design audit (Gate 1) and build once the designer signs off.
