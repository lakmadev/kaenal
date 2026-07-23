-- 0015_audit_partitioning.sql
--
-- Convert audit_events to declarative monthly RANGE partitioning (07 §1, 06 §1
-- `housekeeping` → `auditEventPartitionRoll`). Partitioning makes the trail
-- manageable at scale AND enables the nightly tamper check: per-partition row
-- counts that must only ever grow (a shrink = a delete on an append-only table
-- = a tampering signal).
--
-- A plain table cannot be turned partitioned in place, so this recreates it: the
-- existing table is renamed aside, a partitioned parent is built with the same
-- shape, existing rows are copied in, and isolation/immutability are re-applied.
--
-- Ordering is load-bearing: rows are copied BEFORE `apply_tenant_rls`, because
-- FORCE ROW LEVEL SECURITY applies even to the table owner — an owner INSERT
-- after RLS is enabled would fail the WITH CHECK with `app.tenant_id` unset.
--
-- The partition key (created_at) must be part of every unique key, so the PK
-- becomes composite (id, created_at). Nothing references audit_events by FK, so
-- widening the PK is safe.

-- --- 1. Move the existing table + its indexes aside --------------------------
ALTER TABLE audit_events RENAME TO audit_events_legacy;
ALTER INDEX audit_events_entity_idx RENAME TO audit_events_legacy_entity_idx;
ALTER INDEX audit_events_tenant_created_idx RENAME TO audit_events_legacy_tenant_created_idx;

-- --- 2. The partitioned parent ---------------------------------------------
CREATE TABLE audit_events (
  id          uuid NOT NULL DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  actor_id    uuid,
  actor_kind  text NOT NULL,
  entity_kind text NOT NULL,
  entity_id   uuid NOT NULL,
  action      text NOT NULL,
  before      jsonb,
  after       jsonb,
  reason      text,
  request_id  uuid,
  ip          inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- CHECK constraints carried over from 0001/0002/0013.
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_kind_ck
  CHECK (actor_kind IN ('user','system','api_key','support'));
ALTER TABLE audit_events ADD CONSTRAINT audit_events_support_reason_ck
  CHECK (actor_kind <> 'support' OR reason IS NOT NULL);
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_ck CHECK (
  action IN (
    'created','updated','status_changed','assigned','commented','file_attached',
    'file_downloaded','signed','exported','deleted','restored','purged','signed_in',
    'sign_in_failed','signed_out','role_changed','settings_changed','entitlement_changed',
    'ai_draft_accepted','support_accessed'
  )
);

-- Indexes on the parent become partitioned indexes, auto-created on every
-- partition (present and future). The tenant_created index leads with tenant_id
-- (rule 2), which is what the RLS lint verifies.
CREATE INDEX audit_events_entity_idx
  ON audit_events (tenant_id, entity_kind, entity_id, created_at DESC);
CREATE INDEX audit_events_tenant_created_idx
  ON audit_events (tenant_id, created_at DESC);

-- --- 3. Partitions: a default safety net + explicit monthly partitions ------
-- The default partition guarantees an INSERT never fails for want of a partition
-- (a QMS must never drop an audit write); the nightly roll job keeps explicit
-- monthly partitions provisioned ahead so the default stays empty in practice.
CREATE TABLE audit_events_default PARTITION OF audit_events DEFAULT;

-- Cover every month from the earliest existing row through next month, so the
-- copy below routes each row into its month and the default receives nothing.
DO $$
DECLARE
  lo date;
  hi date := (date_trunc('month', now()) + interval '2 month')::date;
  m  date;
BEGIN
  SELECT date_trunc('month', min(created_at))::date INTO lo FROM audit_events_legacy;
  IF lo IS NULL THEN
    lo := date_trunc('month', now())::date;
  END IF;
  m := lo;
  WHILE m < hi LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
      'audit_events_' || to_char(m, 'YYYY_MM'),
      m::timestamptz,
      (m + interval '1 month')::timestamptz
    );
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;

-- --- 4. Copy existing rows (BEFORE RLS is enabled) --------------------------
INSERT INTO audit_events
  (id, tenant_id, actor_id, actor_kind, entity_kind, entity_id, action,
   before, after, reason, request_id, ip, user_agent, created_at)
SELECT id, tenant_id, actor_id, actor_kind, entity_kind, entity_id, action,
       before, after, reason, request_id, ip, user_agent, created_at
FROM audit_events_legacy;

-- --- 5. Re-apply isolation + append-only immutability -----------------------
-- apply_tenant_rls also GRANTs SELECT/INSERT/UPDATE/DELETE to kaenal_app; the
-- REVOKE + trigger below then restore the append-only guarantee (02 §3, 07 §1).
SELECT apply_tenant_rls('audit_events');

REVOKE UPDATE, DELETE ON audit_events FROM kaenal_app;

DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- --- 6. Drop the old table --------------------------------------------------
DROP TABLE audit_events_legacy;

-- --- 7. Tamper-check ledger (control plane, not tenant-owned) ----------------
-- The roll job records the high-water row count per partition here; a later
-- count below the stored value is the tampering signal (07 §1). Lives in the
-- control schema because partitions span all tenants — it is not tenant data.
CREATE TABLE IF NOT EXISTS control.audit_partition_stats (
  partition_name text PRIMARY KEY,
  row_count      bigint NOT NULL CHECK (row_count >= 0),
  tamper_seen_at timestamptz,
  checked_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON control.audit_partition_stats TO kaenal_app;
