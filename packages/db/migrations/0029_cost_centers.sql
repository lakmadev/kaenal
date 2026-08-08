-- ===========================================================================
-- 0029_cost_centers — cost-center hierarchy + chargeback (04 §Settings >
-- Multi-tenancy > Cost centers; multi-tenancy.jsx `CostCenters`).
--
-- A tenant-scoped tree of cost centers (department → sub-department), each with
-- a human code (CC-XXXX). Memberships are assigned to a cost center, which makes
-- "seats per CC" a REAL count (COUNT of active memberships), the one usage
-- signal we can meter today. The chargeback report multiplies real seats by a
-- configurable rate and splits a shared platform fee across cost centers with a
-- conserved-total apportionment (`packages/core/chargeback.ts`); AI + storage
-- costs need a metering pipeline that doesn't exist yet and are reported as 0,
-- flagged (TODO), not faked.
--
-- Optimistic (rule 6) + audited (rule 3, in the service). RLS enforced by the
-- catalog-driven check-rls lint, so the table needs the policy + leading-
-- tenant_id index + composite member FKs.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS cost_centers (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  code         text NOT NULL,
  name         text NOT NULL,
  -- Self-referencing parent within the same tenant (composite FK below).
  parent_id    uuid,
  lock_version int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz,
  -- Composite-FK target: lets memberships + child rows reference a CC while
  -- staying inside the same tenant (mirrors the memberships composite-FK rule).
  UNIQUE (tenant_id, id)
);

-- Leading-tenant_id index (rule 2).
CREATE INDEX IF NOT EXISTS cost_centers_tenant_idx ON cost_centers (tenant_id, parent_id);
-- Codes are unique per tenant among live rows.
CREATE UNIQUE INDEX IF NOT EXISTS cost_centers_tenant_code_uq
  ON cost_centers (tenant_id, code) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS cost_centers_bump_lock_version ON cost_centers;
CREATE TRIGGER cost_centers_bump_lock_version BEFORE UPDATE ON cost_centers
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- Self parent, same tenant. RESTRICT on delete is safe: deletes are soft, and
-- the service refuses to soft-delete a CC that still has children.
ALTER TABLE cost_centers DROP CONSTRAINT IF EXISTS cost_centers_parent_fk;
ALTER TABLE cost_centers ADD CONSTRAINT cost_centers_parent_fk
  FOREIGN KEY (tenant_id, parent_id) REFERENCES cost_centers (tenant_id, id)
  ON DELETE RESTRICT;

ALTER TABLE cost_centers DROP CONSTRAINT IF EXISTS cost_centers_created_by_member_fk;
ALTER TABLE cost_centers ADD CONSTRAINT cost_centers_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE cost_centers DROP CONSTRAINT IF EXISTS cost_centers_updated_by_member_fk;
ALTER TABLE cost_centers ADD CONSTRAINT cost_centers_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

SELECT apply_tenant_rls('cost_centers');

-- --- Membership → cost center assignment -----------------------------------
-- Nullable: an unassigned member is billed to an "Unallocated" bucket. Composite
-- FK keeps the reference inside the tenant; SET NULL so soft-deleting a CC (which
-- also clears the column in the service) never dangles.
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS cost_center_id uuid;

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_cost_center_fk;
ALTER TABLE memberships ADD CONSTRAINT memberships_cost_center_fk
  FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers (tenant_id, id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS memberships_cost_center_idx
  ON memberships (tenant_id, cost_center_id) WHERE cost_center_id IS NOT NULL;

-- Chargeback allocation settings live in the reusable tenant_settings store
-- (0025) under a new namespace; admit it (same pattern as 0027's 'session').
ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_namespace_check;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_namespace_check
  CHECK (namespace IN ('branding', 'session', 'chargeback'));
