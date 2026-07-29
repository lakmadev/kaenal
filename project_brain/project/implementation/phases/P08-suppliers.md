# P08 — Suppliers (end-to-end)

**Status:** Backend 🟡 — **entity slice ✅ (this branch)**; scorecard job + risk-matrix endpoint pending · FE 🔴
**Design jsx:** `suppliers.jsx`, `suppliers-data.js`
**Spec:** FEATURES §11.1 · **Code:** `SUP-YYYY-NNNN` (via `packages/core/codes.ts`, which already registers `supplier`→`SUP`)
**Value:** supplier quality is the largest net-new value block — scorecards, risk tiers, and the hub every PPAP/SCAR/complaint/audit links to.

> **Reality check (corrected during build):** `suppliers`, `ppap_submissions`, and `scars` tables
> **already existed** (thin) since `0001_core.sql`, and `codes.ts` already registers `supplier`/`scar`
> — so this is *extend + build API*, **not** create-from-scratch. `0001`'s design note ("`scorecard`
> jsonb = RAW metrics; the weighted score is computed in packages/core") is honored exactly.

## 1. Feature scope (from jsx)
- **List** with risk tiers (A–D), scorecards, mini-sparklines (PPM/OTD trend), PPAP status badges, flags (`cert-expiring`, `audit-overdue`, `ppm-breach`, `chargeback-high`, `preferred`, `benchmark`).
- **Scorecards** — weighted score from **PPM / OTD / OQE / SCAR** with tweakable weights.
- **Risk matrix** — suppliers plotted by risk tier; **AI risk tier + confidence** vs manual tier.
- **Detail** — profile (logo/color, tier, category, parts, contact, certs+expiry, spend, contract dates), KPI trends, **AI insights**, linked NCRs/8Ds/audits/ECNs/complaints, chargebacks, PPAP programs, audit dates.

## 2. Backend

### 2.1 Data model — migration `0019_supplier_profile.sql` ✅ (extends `0001` `suppliers`)
Added to the existing table: `lock_version` (+ `bump_lock_version` trigger — rule 6, it had none),
`country`/`city`/`category`, `cert_expires`/`last_audit`/`next_audit` (date), `ai_risk_tier`
(RiskLevel CHECK) + `ai_risk_confidence` (0–100), `flags text[]`, and a `profile jsonb` for
display-only bulk (parts, spend, certs, contract dates, historical PPAP programs, AI insights).
`scorecard jsonb` stays as RAW KPI metrics (0001's design). `risk_tier`/`ai_risk_tier` reuse the
**RiskLevel** scale (A=low … D=critical in the visual spec) — no new enum. `+ tenant_id-led
category index`. RLS already applied via the `0001` `tenant_tables` loop; `(tenant_id, code)` unique
already present. **Time-series `supplier_kpis` + `supplier_insights` tables are deferred** — v1 stores
the 12-month trend arrays inline in `scorecard` (faithful to `suppliers-data.js`, no join for sparklines).

### 2.2 API contract ✅ (`packages/types/src/contract.ts`)
- `GET /v1/suppliers` (cursor; filters status/riskTier/tier/category/country/flag/q) → `SupplierDto`.
- `GET /v1/suppliers/:id` → detail (scorecard + profile + computed score/grade).
- `POST /v1/suppliers` (auto code via `counters`, or explicit for imports) · `POST /v1/suppliers/:id` (update, `version`).
- `GET /v1/supplier-scorecard?wPpm&wOtd&wOqe&wScar` → suppliers ranked by weighted score (weights are query params, never stored). Distinct path (not `/suppliers/scorecard`) to avoid the `:id` route.
- **Deferred:** `supplier_kpis` series + `risk-matrix` endpoint (the matrix is derivable client-side from the list's `riskTier`; promote to an endpoint only if needed).

### 2.3 Services & rules ✅
- **`packages/core/supplier-score.ts`** (pure, 8 unit tests): each KPI normalised to 0–100 goodness (PPM/SCAR lower-is-better, OTD/OQE higher-is-better), weighted average over *present* metrics (absent KPIs dropped, not zeroed → raw-material suppliers still score), letter grade bands. `DEFAULT_SCORE_WEIGHTS` = ppm .4 / otd .3 / oqe .2 / scar .1.
- `SuppliersService`: tenant-wide (not plant-scoped) — RLS is the only isolation; foreign-tenant id → 404. Every mutation `withAudit` (`created`/`updated`). Cursor pagination; optimistic concurrency (`version` → `STALE_WRITE`/409); duplicate code → `CONFLICT`/409. `supplier:view` (all roles) / `supplier:manage` (admin/manager).
- **Deferred:** server-side flag derivation (cert-expiring/audit-overdue/ppm-breach/chargeback-high) — currently flags are set explicitly; the nightly job below will derive them.

### 2.4 Jobs — deferred
- `supplier-scorecard` (nightly, per-tenant fan-out): recompute derived flags + refresh AI insights. Reuse the `housekeeping` fan-out pattern. Not built this slice.

### 2.5 Tests ✅
- **`apps/api/test/suppliers.test.ts` (8)**: create+auto-code+computed score, get, list + category/flag filters, viewer-cannot-manage (403), optimistic update + stale-version (409), scorecard ranking (strong supplier ranks ahead), unknown-id + **real cross-tenant (globex) 404**, `created` audit event.
- **`packages/core/test/supplier-score.test.ts` (8)**: weighting, weights sensitivity, absent-metric handling, grade bands — fixtures lifted from `suppliers-data.js`.
- RLS suite green (227) with the altered table; `pnpm -r typecheck` + client factories (`apiQueries.suppliers.*`) all green.

## 3. Frontend (maps to jsx)
- **Routes:** `/suppliers` (list + risk-matrix toggle + scorecard weighting panel), `/suppliers/[id]`.
- **Components:** SupplierTable (tier badge, PPM/OTD sparkline, PPAP badge, flags), RiskMatrix, ScorecardWeights (the Tweaks-panel PPM/OTD/OQE/SCAR sliders → `?weights=`), SupplierDetail (profile card, KPI trend charts, AISuggestion insights, linked-records tabs, PPAP programs table, chargebacks).
- **States:** empty/loading/error/permission; `benchmark`/`preferred` chips.
- **Hooks/keys:** new `apiQueries.suppliers.*`; reuse `entityLinks` for linked records.

## 4. Definition of Done
- [x] **Backend entity slice**: schema extension, DTO/contract, `SuppliersService` + controller, capabilities, `apiQueries.suppliers.*` client factories.
- [x] Scorecard weighting is pure core logic, unit-tested (8); ranking endpoint live.
- [x] RLS suite green with the altered table; mutations audited; optimistic concurrency; cross-tenant 404.
- [ ] Detail shows profile, KPI sparklines/trends, AI insights, linked NCR/8D/audit/ECN/complaint, PPAP programs, chargebacks. *(FE)*
- [ ] List + risk-matrix + scorecard (live weight sliders) match `suppliers.jsx`. *(FE)*
- [ ] Server-side flag derivation + AI insights via the nightly `supplier-scorecard` job. *(deferred)*

## 6. Delivered this branch / what's next
**Delivered:** the Suppliers backend vertical (extend schema → core scoring → contract → service →
capabilities → client factories → tests). **Next slices, in order:** (1) **FE** — `/suppliers` list
(tier/PPM sparkline/PPAP badge/flags), risk-matrix toggle, scorecard weight sliders (`?w*`), and the
detail screen, all against `apiQueries.suppliers.*`; (2) the nightly `supplier-scorecard` job (derive
flags + insights); (3) **[P09](P09-ppap.md)** and **[P10](P10-scar.md)** (their thin tables also
already exist in `0001` — same extend-and-build pattern as here).

## 5. Dependencies & open questions
- Feeds/depends: [P09](P09-ppap.md), [P10](P10-scar.md), [P11](P11-supplier-portal.md), [P20](P20-knowledge-graph.md), [P21](P21-predictive-risk.md).
- **Open (need sign-off):** exact flag thresholds; whether KPI data is imported (bulk-import) or entered; AI-tier is advisory only (manual tier authoritative) — confirm.
