-- ===========================================================================
-- 0037 — NCR: units_affected.
--
-- The mobile NCR design (m-ncr.jsx: review + detail) surfaces an affected-unit
-- count ("14 units affected", "High · 12 units"). The existing `impact jsonb`
-- column has no defined shape, so rather than guess a key we model the count as
-- a first-class, nullable integer. Additive only: existing rows stay NULL and
-- the UI omits the "· N units" fragment when absent — no web behaviour changes.
--
-- No RLS/index/lock_version changes: `ncrs` already carries all of those; this
-- is a plain nullable column on an existing tenant table.
-- ===========================================================================

ALTER TABLE ncrs ADD COLUMN IF NOT EXISTS units_affected integer
  CHECK (units_affected IS NULL OR units_affected >= 0);
