-- ===========================================================================
-- 0038 — AI ledger: allow the `ncr_photo_triage` vision feature.
--
-- The AI gateway now routes a vision feature ("Photo + AI" NCR triage). The
-- `ai_invocations` ledger's feature CHECK enumerates the allowed features, so it
-- must learn the new value or every vision invocation fails to record (and the
-- whole call 500s after the model already ran). Additive: existing rows and
-- features are untouched.
-- ===========================================================================

ALTER TABLE ai_invocations DROP CONSTRAINT IF EXISTS ai_invocations_feature_check;
ALTER TABLE ai_invocations ADD CONSTRAINT ai_invocations_feature_check
  CHECK (feature IN ('doc_summary','quicklog_structuring','root_cause',
                     'eightd_draft','compliance_qa','report_narrative',
                     'ncr_photo_triage'));
