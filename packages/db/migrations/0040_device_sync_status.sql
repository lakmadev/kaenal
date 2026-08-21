-- ===========================================================================
-- 0040 — Device sync telemetry (05 §M5).
--
-- The mobile offline engine is client-only, so the admin dashboard's "Failed
-- syncs" tile had no server data source and honestly rendered "—". This is that
-- source: each device reports its current sync health (parked/failed writes) for
-- the workspace it is signed into, and the tile sums it across the tenant.
--
-- One row per (tenant, user, device): a person may carry several devices, and
-- the same phone reports independently for each workspace it signs into. Reports
-- are last-write-wins upserts — this is a live gauge, not an event log — so no
-- lock_version/optimistic concurrency is needed. `reported_at` lets the dashboard
-- ignore stale devices that have gone quiet.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS device_sync_status (
  tenant_id      uuid NOT NULL,
  user_id        uuid NOT NULL,
  device_id      text NOT NULL,
  failed         int  NOT NULL DEFAULT 0 CHECK (failed       >= 0),
  needs_review   int  NOT NULL DEFAULT 0 CHECK (needs_review >= 0),
  last_synced_at timestamptz,
  reported_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, device_id)
);

-- The PK already leads with tenant_id (rule 2), so RLS scans stay tenant-local.

-- A report always belongs to an active membership in this tenant (composite FK,
-- the settled cross-tenant user-reference pattern).
ALTER TABLE device_sync_status DROP CONSTRAINT IF EXISTS device_sync_status_member_fk;
ALTER TABLE device_sync_status ADD CONSTRAINT device_sync_status_member_fk
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;

SELECT apply_tenant_rls('device_sync_status');
