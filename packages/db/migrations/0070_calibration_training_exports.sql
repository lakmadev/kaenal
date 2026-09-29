-- ===========================================================================
-- 0070_calibration_training_exports — Sprint 05 Slice 2 (C5 AC2, T3 AC2).
-- SPRINT-05-calibration-training.md §4 (C5, T3 rows), §3.2.
--
-- `exports.resource`'s CHECK constraint (0011_exports.sql, last widened by
-- 0066_risk_msa_exports.sql) does not yet include the two new export
-- resources this sprint adds to `ExportResource` (packages/types/src/enums.ts,
-- a later slice): `calibration_audit_pack` (C5) and `skill_gap_report` (T3).
-- Mirrors Sprint 04's own combined `0066_risk_msa_exports.sql` pattern
-- exactly — the real table/constraint name is `exports`/`exports_resource_check`,
-- confirmed against the live database, not `export_jobs` (an earlier, wrong
-- name in this sprint file's own draft, corrected in Round 2).
-- ===========================================================================

ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_resource_check;
ALTER TABLE exports ADD CONSTRAINT exports_resource_check
  CHECK (resource IN ('ncrs', 'inspections', 'capas', 'audits', 'ai_reply', 'audit_report',
                       'predictive_forecast_pack', 'risk_board_pack', 'gauge_rr_aiag_report',
                       'calibration_audit_pack', 'skill_gap_report'));
