-- ===========================================================================
-- 0066_risk_msa_exports — Sprint 04 Slice 4 build-time correction (reserved
-- buffer migration, §4's "0066 held as buffer for a build-time correction").
--
-- `exports.resource`'s CHECK constraint (0011_exports.sql, last widened by
-- 0062_risk_predictions.sql) does not yet include the two new export
-- resources this slice adds to `ExportResource` (packages/types/src/enums.ts):
-- `risk_board_pack` (R5) and `gauge_rr_aiag_report` (M5). Discovered by the
-- exports test suite itself (a real `exports_resource_check` violation, not
-- a hypothetical) — the Zod enum alone does not reach the DB-level CHECK.
-- ===========================================================================

ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_resource_check;
ALTER TABLE exports ADD CONSTRAINT exports_resource_check
  CHECK (resource IN ('ncrs', 'inspections', 'capas', 'audits', 'ai_reply', 'audit_report',
                       'predictive_forecast_pack', 'risk_board_pack', 'gauge_rr_aiag_report'));
