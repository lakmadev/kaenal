-- ===========================================================================
-- 0013_audit_action_purged — add the `purged` audit action.
--
-- `deleted` already means the user-facing SOFT delete (sets `deleted_at`, still
-- recoverable). The nightly housekeeping job (06 §1 `purgeSoftDeleted`) performs
-- the permanent, irreversible hard delete once retention has elapsed and no
-- legal hold protects the row — a compliance-distinct event that deserves its
-- own action so the trail can tell "moved to trash" from "erased forever".
--
-- Mirrors AuditAction in packages/types/src/enums.ts exactly (01 §4).
-- ===========================================================================

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_ck;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_ck CHECK (
  action IN (
    'created',
    'updated',
    'status_changed',
    'assigned',
    'commented',
    'file_attached',
    'file_downloaded',
    'signed',
    'exported',
    'deleted',
    'restored',
    'purged',
    'signed_in',
    'sign_in_failed',
    'signed_out',
    'role_changed',
    'settings_changed',
    'entitlement_changed',
    'ai_draft_accepted',
    'support_accessed'
  )
);
