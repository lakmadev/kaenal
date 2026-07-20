-- ===========================================================================
-- 0002_audit_action_check — constrain audit_events.action to the enum list.
--
-- 0001 created `action` as free text, which let a typo'd or invented action
-- into an append-only table — where it can never be corrected. 01 §4 requires
-- every enum column to carry a CHECK generated from the same list as
-- packages/types; this closes that gap.
--
-- Value list mirrors AuditAction in packages/types/src/enums.ts exactly.
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
