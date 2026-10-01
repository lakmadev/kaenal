-- ===========================================================================
-- 0074_entitlements — Sprint 07 P1 (entitlement store + framework-aware
-- resolver's storage). SPRINT-07-entitlements-onboarding.md §3.1, P1 AC4-AC6.
--
-- Widens the existing `entitlements` table (0001_core.sql:618, already
-- forced-RLS and in the apply_tenant_rls loop) with the columns a real write
-- path needs: `source` (who/what activated the pack), `lock_version`
-- (optimistic concurrency, P4's bundle-apply race fix) and a CHECK pinning
-- `pack_id` to the 9 real ids. Composite member FKs are added by ALTER on the
-- existing `created_by`/`updated_by` columns (AR28) rather than re-adding
-- them — they are bare `uuid` since 0001.
--
-- New table `entitlement_trials` (P5): PK `(tenant_id, pack_id)` IS the
-- once-per-pack rule; `id` is a separate uuid for the audit `entity_id`
-- (audit_events.entity_id is uuid NOT NULL, so the natural composite PK
-- cannot serve that role); `expiry_processed_at` makes the trials job's
-- one-time expiry event exactly-once (AR28).
--
-- Backfill (P1 AC5): every tenant that exists when this migration runs gets
-- all 9 packs `active=true, source='grandfathered'` — "nothing that works
-- today stops working." The tenant universe is read from `memberships`
-- (every tenant has at least one, seeded at provisioning), not from
-- `control.tenants` — this migration also runs, via `migrate-tenants`, on a
-- dedicated tenant's own database, where `memberships` holds exactly that
-- tenant's rows and `control.tenants` may hold a stale full copy.
-- ===========================================================================

-- --- 1. `entitlements` widening -----------------------------------------------

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operator'
  CHECK (source IN ('operator', 'self_service', 'bundle', 'grandfathered'));

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS entitlements_bump_lock_version ON entitlements;
CREATE TRIGGER entitlements_bump_lock_version BEFORE UPDATE ON entitlements
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE entitlements DROP CONSTRAINT IF EXISTS entitlements_pack_id_ck;
ALTER TABLE entitlements ADD CONSTRAINT entitlements_pack_id_ck CHECK (
  pack_id IN ('intelligence', 'supplier', 'qe', 'platform', 'security',
              'multiplant', 'mobile', 'standards', 'support')
);

-- Defensive: any created_by/updated_by that does not resolve to a membership
-- of the SAME tenant is cleared before the FK is added, so a pre-existing bad
-- value cannot block the migration (reported via RAISE NOTICE, not silently).
DO $$
DECLARE
  cleared_created int;
  cleared_updated int;
BEGIN
  WITH bad AS (
    UPDATE entitlements e SET created_by = NULL
    WHERE e.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM memberships m WHERE m.tenant_id = e.tenant_id AND m.user_id = e.created_by
      )
    RETURNING 1
  )
  SELECT count(*) INTO cleared_created FROM bad;

  WITH bad AS (
    UPDATE entitlements e SET updated_by = NULL
    WHERE e.updated_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM memberships m WHERE m.tenant_id = e.tenant_id AND m.user_id = e.updated_by
      )
    RETURNING 1
  )
  SELECT count(*) INTO cleared_updated FROM bad;

  IF cleared_created > 0 OR cleared_updated > 0 THEN
    RAISE NOTICE 'entitlements: cleared % created_by and % updated_by value(s) that did not '
                 'resolve to a membership of the same tenant', cleared_created, cleared_updated;
  END IF;
END $$;

ALTER TABLE entitlements DROP CONSTRAINT IF EXISTS entitlements_created_by_member_fk;
ALTER TABLE entitlements ADD CONSTRAINT entitlements_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE entitlements DROP CONSTRAINT IF EXISTS entitlements_updated_by_member_fk;
ALTER TABLE entitlements ADD CONSTRAINT entitlements_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- --- 2. `entitlement_trials` --------------------------------------------------

CREATE TABLE IF NOT EXISTS entitlement_trials (
  id                   uuid NOT NULL DEFAULT uuidv7(),
  tenant_id            uuid NOT NULL,
  pack_id              text NOT NULL
                         CHECK (pack_id IN ('intelligence', 'supplier', 'qe', 'platform', 'security',
                                             'multiplant', 'mobile', 'standards', 'support')),
  started_at           timestamptz NOT NULL DEFAULT now(),
  ends_at              timestamptz NOT NULL,
  started_by           uuid,
  -- Set once by the trials job (P5 AC2) so the expiry audit event is written
  -- exactly once; never mutated by anything else. NULL while open.
  expiry_processed_at  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- The PK *is* the once-per-pack rule.
  PRIMARY KEY (tenant_id, pack_id),
  UNIQUE (id)
);

ALTER TABLE entitlement_trials ADD CONSTRAINT entitlement_trials_started_by_member_fk
  FOREIGN KEY (tenant_id, started_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

SELECT apply_tenant_rls('entitlement_trials');

-- --- 3. Backfill (P1 AC5) -----------------------------------------------------

INSERT INTO entitlements (tenant_id, pack_id, active, source, activated_at)
SELECT t.tenant_id, p.pack_id, true, 'grandfathered', now()
FROM (SELECT DISTINCT tenant_id FROM memberships) t
CROSS JOIN (
  VALUES ('intelligence'), ('supplier'), ('qe'), ('platform'), ('security'),
         ('multiplant'), ('mobile'), ('standards'), ('support')
) AS p (pack_id)
ON CONFLICT (tenant_id, pack_id) DO UPDATE SET active = true;
