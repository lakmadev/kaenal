-- ===========================================================================
-- 0050_ai_chat — AI assistant chat (Sprint 01 S1-4).
--
--  * audit action `ai_chat` (every chat turn is audited, 01 §4 closed enum);
--  * ledger feature `chat` on ai_invocations (the gateway records every turn);
--  * export resource `ai_reply` + a `payload` jsonb on exports: an AI reply is
--    not a table dump, so the text + provenance the user asked to export is
--    frozen on the export row (the ledger stores no reply text by design).
-- Additive; existing rows are untouched.
-- ===========================================================================

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_ck;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_ck CHECK (
  action IN (
    'created','updated','status_changed','assigned','commented','file_attached',
    'file_downloaded','signed','exported','deleted','restored','purged','linked',
    'unlinked','signed_in','sign_in_failed','signed_out','role_changed',
    'settings_changed','entitlement_changed','ai_draft_accepted','ai_chat',
    'support_accessed'
  )
);

ALTER TABLE ai_invocations DROP CONSTRAINT IF EXISTS ai_invocations_feature_check;
ALTER TABLE ai_invocations ADD CONSTRAINT ai_invocations_feature_check
  CHECK (feature IN ('doc_summary','quicklog_structuring','root_cause',
                     'eightd_draft','compliance_qa','report_narrative',
                     'ncr_photo_triage','chat'));

ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_resource_check;
ALTER TABLE exports ADD CONSTRAINT exports_resource_check
  CHECK (resource IN ('ncrs','inspections','capas','audits','ai_reply'));
ALTER TABLE exports ADD COLUMN IF NOT EXISTS payload jsonb;
