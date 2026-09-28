-- ===========================================================================
-- 0061_audits_module — Sprint 02 (Audits) backend build B1.
--
-- Replaces the `/audits` placeholder's backend gaps (docs/sprints/SPRINT-02-
-- audits.md §3, architecture review §8/§8a):
--   * AuditType corrected to the binding design's 5 values
--     (internal/certification/supplier/customer/gap) — `process` is unused
--     (no seed row, no test referencing it); guarded with a RAISE if that ever
--     stops being true, rather than silently remapping data.
--   * audits gains description/location/scope/auditee_ids/next_activity/closed_at.
--   * audits.progress DROPPED — computed from the checklist in packages/core
--     instead (dead column since 0001, never written).
--   * audit_findings gains title/due_date.
--   * audits gains a generated search_vector + GIN index (mirrors 0008).
--   * exports gains the audit_report resource (a single audit's PDF report).
--   * audit_events gains the checklist_item_scored action.
-- Additive; existing rows keep working (new columns are nullable/defaulted).
-- ===========================================================================

DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT count(*) INTO bad_count FROM audits WHERE type = 'process';
  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'audits.type = ''process'' still has % row(s) — this migration removes that value from the '
      'AuditType enum. Resolve those rows (re-type them) before re-running; do not silently remap.',
      bad_count;
  END IF;
END
$$;

ALTER TABLE audits DROP CONSTRAINT IF EXISTS audits_type_check;
ALTER TABLE audits ADD CONSTRAINT audits_type_check
  CHECK (type IN ('internal', 'certification', 'supplier', 'customer', 'gap'));

ALTER TABLE audits ADD COLUMN IF NOT EXISTS description   text;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS location      text;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS scope         text[] NOT NULL DEFAULT '{}';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS auditee_ids   uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE audits ADD COLUMN IF NOT EXISTS next_activity text;
ALTER TABLE audits ADD COLUMN IF NOT EXISTS closed_at     timestamptz;

-- `progress` (numeric(5,2)) existed since 0001 but nothing ever wrote it
-- (verified: `audits.service.ts` only read `row.progress` in `toAuditDto`, no
-- INSERT/UPDATE column list ever included it) — dropped rather than kept as a
-- second, permanently-stale source of truth. `AuditDto.progress` is now
-- computed from `checklist` on every read (packages/core `auditChecklistProgress`).
ALTER TABLE audits DROP COLUMN IF EXISTS progress;

ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS title    text;
ALTER TABLE audit_findings ADD COLUMN IF NOT EXISTS due_date timestamptz;

-- Federated search (03 §1 `q`, 04 command palette) — mirrors 0008's pattern
-- exactly: code A, title B, description C.
ALTER TABLE audits ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS audits_search_idx ON audits USING gin (search_vector);

-- A single audit's PDF report (S2-2 AC5/6) — distinct from the existing
-- `audits` table-dump export resource.
ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_resource_check;
ALTER TABLE exports ADD CONSTRAINT exports_resource_check
  CHECK (resource IN ('ncrs', 'inspections', 'capas', 'audits', 'ai_reply', 'audit_report'));

-- A checklist clause scored (S2-4) — distinct from `status_changed` (phase advance).
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_ck;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_ck CHECK (
  action IN (
    'created', 'updated', 'status_changed', 'assigned', 'commented', 'file_attached',
    'file_downloaded', 'signed', 'exported', 'deleted', 'restored', 'purged', 'linked',
    'unlinked', 'signed_in', 'sign_in_failed', 'signed_out', 'role_changed',
    'settings_changed', 'entitlement_changed', 'ai_draft_accepted', 'ai_chat',
    'support_accessed', 'checklist_item_scored'
  )
);
