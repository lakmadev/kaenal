-- ===========================================================================
-- 0019_supplier_profile — flesh out the supplier record for P08 (FEATURES §11.1).
--
-- 0001 created a deliberately thin `suppliers` table (name/code/status/risk_tier
-- + a `scorecard` jsonb for RAW metrics, with the weighted score computed in
-- packages/core). The Suppliers module needs three things that thin table lacks:
--
--   1. Optimistic concurrency — `suppliers` never got a `lock_version` (unlike
--      inspections/ncrs/capas/…), yet a supplier is edited by several people over
--      its lifetime. Rule 6: writes use optimistic concurrency. Add the column +
--      the shared bump trigger, same pattern as 0004–0010.
--   2. Queryable descriptors the list filters + derived flags need as real
--      columns (country/category/cert_expires/next_audit/flags/ai_risk_*), rather
--      than buried in jsonb where they can't be filtered or indexed.
--   3. A `profile` jsonb for the descriptive bulk that is displayed, not queried
--      (parts, spend, certificate text, contract dates, historical PPAP programs,
--      AI insights). `scorecard` stays as the RAW KPI metrics per 0001's design.
--
-- risk_tier / ai_risk_tier reuse the RiskLevel scale (low|medium|high|critical) —
-- the 4-tier A/B/C/D supplier grade in the visual spec maps A=low … D=critical,
-- so no new enum is introduced (CLAUDE.md: jsx is the visual spec only).
-- ===========================================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS suppliers_bump_lock_version ON suppliers;
CREATE TRIGGER suppliers_bump_lock_version BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- Descriptors used by list filters, sorting, and the nightly flag/insight job.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country      text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city         text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS category     text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cert_expires date;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_audit   date;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS next_audit   date;

-- AI-suggested risk tier + confidence — advisory only; `risk_tier` stays the
-- authoritative manual grade (both on the RiskLevel scale).
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ai_risk_tier text
  CHECK (ai_risk_tier IN ('low','medium','high','critical'));
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ai_risk_confidence int
  CHECK (ai_risk_confidence BETWEEN 0 AND 100);

-- Derived badges: cert-expiring / audit-overdue / ppm-breach / chargeback-high /
-- preferred / benchmark. Written by the app (and later the scorecard job).
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS flags text[] NOT NULL DEFAULT '{}';

-- Descriptive, display-only bulk (parts, spend, certs, contract dates, historical
-- PPAP programs, AI insights). Distinct from `scorecard` (raw KPI metrics).
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

-- A category filter is common on the list; index it under the tenant.
CREATE INDEX IF NOT EXISTS suppliers_tenant_category_idx ON suppliers (tenant_id, category);
