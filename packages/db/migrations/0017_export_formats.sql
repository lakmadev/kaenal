-- 0017_export_formats.sql
--
-- Widen exports.format to admit the XLSX + PDF renderers (03 §8, 06 `reports`).
-- 0011 shipped CSV only; the same async pipeline now renders XLSX (a minimal
-- OOXML sheet) and a simple tabular PDF server-side. Mirrors ExportFormat in
-- packages/types/src/enums.ts exactly (01 §4).

ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_format_check;
ALTER TABLE exports ADD CONSTRAINT exports_format_check
  CHECK (format IN ('csv','xlsx','pdf'));
