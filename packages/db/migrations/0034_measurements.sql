-- ===========================================================================
-- 0034_measurements — SPC measurement data (Data Platform B5; qms-risk-spc.jsx
-- `SPCCharts`).
--
-- The canonical source for statistical process control: one row per measured
-- value, grouped into subgroups. `/v1/spc` reads these, groups by subgroup, and
-- computes X̄/R control limits + Western-Electric runs rules + capability
-- (packages/core/spc.ts). Per the settled decision this is a real table, not a
-- projection of inspection responses — SPC needs its own subgrouped, high-rate
-- source (numeric inspection responses can feed it later, flagged).
--
-- Tenant-scoped with the full isolation contract (rule 2): tenant_id NOT NULL,
-- forced RLS, leading-tenant_id index, lock_version + bump trigger, composite
-- member FKs. Ingest is audited (rule 3).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS measurements (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL,
  -- What was measured. `characteristic` is the SPC series key (e.g. "Weld
  -- penetration"); `part` scopes it to a part/product.
  part           text NOT NULL,
  characteristic text NOT NULL,
  value          numeric NOT NULL,
  -- Rational subgroup index (measurements sharing a subgroup are one point on the
  -- X̄/R chart). A monotonically increasing integer per characteristic.
  subgroup       int  NOT NULL,
  unit           text,
  -- Optional spec limits (characteristic-level, denormalised onto each row so a
  -- single ingest carries them): drive Cp/Cpk when present.
  usl            numeric,
  lsl            numeric,
  target         numeric,
  -- Where the value came from (manual, a gauge, an inspection, a connector).
  source         text NOT NULL DEFAULT 'manual',
  taken_at       timestamptz NOT NULL DEFAULT now(),
  lock_version   int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  deleted_at     timestamptz,
  UNIQUE (tenant_id, id)
);

-- Leading tenant_id (isolation contract) + the read pattern: a characteristic's
-- points in subgroup/time order.
CREATE INDEX IF NOT EXISTS measurements_tenant_idx
  ON measurements (tenant_id, characteristic, subgroup, taken_at);

DROP TRIGGER IF EXISTS measurements_bump_lock_version ON measurements;
CREATE TRIGGER measurements_bump_lock_version BEFORE UPDATE ON measurements
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_created_by_member_fk;
ALTER TABLE measurements ADD CONSTRAINT measurements_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_updated_by_member_fk;
ALTER TABLE measurements ADD CONSTRAINT measurements_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('measurements');
