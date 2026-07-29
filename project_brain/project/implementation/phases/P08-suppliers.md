# P08 — Suppliers (end-to-end)

**Status:** Backend 🔴 (new build; data model spec-grade in `suppliers-data.js`) · FE 🔴
**Design jsx:** `suppliers.jsx`, `suppliers-data.js`
**Spec:** FEATURES §11.1 (no tables in 02 yet — schema below follows house style) · **Code:** `SUP-NNNN`
**Value:** supplier quality is the largest net-new value block — scorecards, risk tiers, and the hub every PPAP/SCAR/complaint/audit links to.

## 1. Feature scope (from jsx)
- **List** with risk tiers (A–D), scorecards, mini-sparklines (PPM/OTD trend), PPAP status badges, flags (`cert-expiring`, `audit-overdue`, `ppm-breach`, `chargeback-high`, `preferred`, `benchmark`).
- **Scorecards** — weighted score from **PPM / OTD / OQE / SCAR** with tweakable weights.
- **Risk matrix** — suppliers plotted by risk tier; **AI risk tier + confidence** vs manual tier.
- **Detail** — profile (logo/color, tier, category, parts, contact, certs+expiry, spend, contract dates), KPI trends, **AI insights**, linked NCRs/8Ds/audits/ECNs/complaints, chargebacks, PPAP programs, audit dates.

## 2. Backend — new build (grounded in `suppliers-data.js`)

### 2.1 Data model — migration `0019_suppliers.sql`
- **`suppliers`**: `tenant_id`, `id` (uuid), `code` (`SUP-NNNN`), `name`, `short_code`, `color`, `country`, `city`, `tier` (`tier1|tier2|raw_material`), `category`, `contact` (jsonb: name/role/email), `spend_ytd` numeric, `spend_currency`, `iatf_cert`, `iso_cert`, `cert_expires` date, `contract_start` date, `first_shipment` date, `risk_tier` (`A|B|C|D`), `ai_risk_tier`, `ai_risk_confidence` int, `last_audit` date, `next_audit` date, `flags` text[], `status`, `lock_version`. FORCED RLS, leading `tenant_id` idx, unique `(tenant_id, code)`.
- **`supplier_parts`**: `tenant_id`, `supplier_id`, `part_no`, `description`, `parts_per_month`, `unit`.
- **`supplier_kpis`** (monthly, powers sparklines): `tenant_id`, `supplier_id`, `period` (YYYY-MM), `ppm`, `ppm_target`, `otd`, `otd_target`, `oqe`, `scar_hours`, `material_rejects_pct`. Unique `(tenant_id, supplier_id, period)`.
- **`supplier_insights`**: `tenant_id`, `supplier_id`, `kind` (`trend|anomaly|risk|similar|positive`), `text`, `generated_at` — written by an AI/analytics job, not hand-edited.
- Supplier links to other entities reuse the shipped **`entity_links`** table (`supplier` is already in `EntityKind`) — no new join tables for NCR/8D/audit/ECN/complaint associations.

### 2.2 API contract (`packages/types/src/contract.ts`)
- `GET /v1/suppliers` (cursor; filters tier, risk_tier, category, country, flag, q; sort) → `SupplierDto`.
- `GET /v1/suppliers/:id` → detail (+ parts, latest KPIs, insights, linked-record counts via entity-links).
- `POST /v1/suppliers` (idempotent) · `POST /v1/suppliers/:id` (update, `lockVersion`) · soft-delete.
- `GET /v1/suppliers/:id/kpis?from&to` → monthly series.
- `GET /v1/suppliers/scorecard?weights=ppm:.4,otd:.3,oqe:.2,scar:.1` → ranked scored list (weighting is a **pure `packages/core/supplier-score.ts`** function; weights are a query param, not stored).
- `GET /v1/suppliers/risk-matrix` → tier buckets for the matrix.

### 2.3 Services & rules
- Scorecard math in `packages/core` (pure, unit-tested): normalize each KPI to target, apply weights, derive letter tier bands. Flags derived (cert-expiring < 30d, audit-overdue past `next_audit`, ppm-breach vs target, chargeback-high threshold).
- Every mutation `withAudit` (`created`/`updated`/`deleted`); AI-tier changes audited distinctly.
- Cursor pagination; `lockVersion`; foreign-tenant id → 404.

### 2.4 Jobs
- `supplier-scorecard` (nightly, per-tenant fan-out): recompute derived tiers/flags from KPIs, refresh `supplier_insights`. Reuse the `housekeeping`/`scheduling` fan-out pattern.

### 2.5 Tests
- RLS suite gains `suppliers`/`supplier_parts`/`supplier_kpis`/`supplier_insights` (seed a fixture row each — mirror the entity_links fix).
- Core unit: scorecard weighting + flag derivation (table-driven from the `suppliers-data.js` numbers).
- API: list filters, scorecard ranking, risk-matrix bucketing, cross-tenant 404, audit on mutate.

## 3. Frontend (maps to jsx)
- **Routes:** `/suppliers` (list + risk-matrix toggle + scorecard weighting panel), `/suppliers/[id]`.
- **Components:** SupplierTable (tier badge, PPM/OTD sparkline, PPAP badge, flags), RiskMatrix, ScorecardWeights (the Tweaks-panel PPM/OTD/OQE/SCAR sliders → `?weights=`), SupplierDetail (profile card, KPI trend charts, AISuggestion insights, linked-records tabs, PPAP programs table, chargebacks).
- **States:** empty/loading/error/permission; `benchmark`/`preferred` chips.
- **Hooks/keys:** new `apiQueries.suppliers.*`; reuse `entityLinks` for linked records.

## 4. Definition of Done
- [ ] List + risk-matrix + scorecard (live weight sliders) match `suppliers.jsx`.
- [ ] Detail shows profile, KPI sparklines/trends, AI insights, linked NCR/8D/audit/ECN/complaint, PPAP programs, chargebacks.
- [ ] Scorecard weighting is pure core logic, unit-tested; flags derived server-side.
- [ ] RLS suite green with new tables; mutations audited; cross-tenant 404.

## 5. Dependencies & open questions
- Feeds/depends: [P09](P09-ppap.md), [P10](P10-scar.md), [P11](P11-supplier-portal.md), [P20](P20-knowledge-graph.md), [P21](P21-predictive-risk.md).
- **Open (need sign-off):** exact flag thresholds; whether KPI data is imported (bulk-import) or entered; AI-tier is advisory only (manual tier authoritative) — confirm.
