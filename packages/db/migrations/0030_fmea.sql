-- ===========================================================================
-- 0030_fmea — FMEA workbench (04 §FMEA; qms-risk-spc.jsx `FMEAWorkbench`).
--
-- A new QMS module (Tier-2 P13). An FMEA is a per-part worksheet (PFMEA or
-- DFMEA); its rows are failure modes, each carrying the three AIAG/VDA ratings
-- Severity / Occurrence / Detection (1–10). RPN (S×O×D) and Action Priority
-- (H/M/L) are DERIVED in `packages/core/fmea.ts`, never stored, so a rating edit
-- always re-scores consistently (CLAUDE.md rule 5 — logic lives in core).
--
-- Two tenant-scoped tables, soft-deletable + optimistic (rule 6), audited in the
-- service (rule 3). RLS enforced by the catalog-driven check-rls lint, so each
-- needs the policy + leading-tenant_id index + composite member FKs.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS fmeas (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  fmea_type    text NOT NULL DEFAULT 'pfmea' CHECK (fmea_type IN ('pfmea', 'dfmea')),
  part_code    text NOT NULL,
  part_name    text NOT NULL,
  revision     int  NOT NULL DEFAULT 1,
  lock_version int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz,
  -- Composite-FK target so items reference an FMEA inside the same tenant.
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS fmeas_tenant_idx ON fmeas (tenant_id, part_code);

DROP TRIGGER IF EXISTS fmeas_bump_lock_version ON fmeas;
CREATE TRIGGER fmeas_bump_lock_version BEFORE UPDATE ON fmeas
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE fmeas DROP CONSTRAINT IF EXISTS fmeas_created_by_member_fk;
ALTER TABLE fmeas ADD CONSTRAINT fmeas_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE fmeas DROP CONSTRAINT IF EXISTS fmeas_updated_by_member_fk;
ALTER TABLE fmeas ADD CONSTRAINT fmeas_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('fmeas');

-- --- Failure modes (worksheet rows) ----------------------------------------
CREATE TABLE IF NOT EXISTS fmea_items (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL,
  fmea_id            uuid NOT NULL,
  seq                int  NOT NULL DEFAULT 0,
  process_function   text NOT NULL DEFAULT '',
  failure_mode       text NOT NULL,
  effect             text NOT NULL DEFAULT '',
  severity           int  NOT NULL DEFAULT 1 CHECK (severity   BETWEEN 1 AND 10),
  cause              text NOT NULL DEFAULT '',
  occurrence         int  NOT NULL DEFAULT 1 CHECK (occurrence BETWEEN 1 AND 10),
  prevention_control text NOT NULL DEFAULT '',
  detection_control  text NOT NULL DEFAULT '',
  detection          int  NOT NULL DEFAULT 1 CHECK (detection  BETWEEN 1 AND 10),
  recommended_action text NOT NULL DEFAULT '',
  lock_version       int  NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_by         uuid,
  deleted_at         timestamptz
);

CREATE INDEX IF NOT EXISTS fmea_items_tenant_idx ON fmea_items (tenant_id, fmea_id);

DROP TRIGGER IF EXISTS fmea_items_bump_lock_version ON fmea_items;
CREATE TRIGGER fmea_items_bump_lock_version BEFORE UPDATE ON fmea_items
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE fmea_items DROP CONSTRAINT IF EXISTS fmea_items_fmea_fk;
ALTER TABLE fmea_items ADD CONSTRAINT fmea_items_fmea_fk
  FOREIGN KEY (tenant_id, fmea_id) REFERENCES fmeas (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE fmea_items DROP CONSTRAINT IF EXISTS fmea_items_created_by_member_fk;
ALTER TABLE fmea_items ADD CONSTRAINT fmea_items_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE fmea_items DROP CONSTRAINT IF EXISTS fmea_items_updated_by_member_fk;
ALTER TABLE fmea_items ADD CONSTRAINT fmea_items_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('fmea_items');
