-- ===========================================================================
-- 0033_import — bulk-import pipeline (Data Platform B4; operations.jsx
-- `BulkImport`, 09-INTEGRATIONS §6).
--
-- Two tenant-scoped tables:
--   • import_profiles — a REUSABLE mapping: target entity + field mapping +
--     value transforms + a duplicate policy. Saved so a recurring drop
--     (SFTP/S3/connector) re-imports with the same rules ("Save as job").
--   • import_runs — ONE execution: the parsed source rows, a mapping snapshot,
--     and — as it moves Source→Validate→Dry-run→Commit — the row-level result
--     and the roll-up counts. Nothing is written to the target until commit, and
--     commit is idempotent by the target's natural key.
--
-- Both carry the full isolation contract (rule 2): tenant_id NOT NULL, forced
-- RLS via apply_tenant_rls, a leading-tenant_id index, lock_version + bump
-- trigger (rule 6), composite member FKs (settled architecture). Every mutation
-- is audited in the service (rule 3).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS import_profiles (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  name          text NOT NULL,
  -- The Kaenal entity these rows land in (whitelisted in packages/core import
  -- target registry; the CHECK is a coarse guard, the registry is the authority).
  target_entity text NOT NULL CHECK (target_entity IN ('suppliers')),
  -- { targetField: sourceColumn } — which incoming column feeds each target field.
  mapping       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Optional per-field value maps: { targetField: { fromValue: toValue } }.
  transform     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- What to do when a row's natural key already exists in the workspace.
  dedupe_policy text NOT NULL DEFAULT 'update'
                  CHECK (dedupe_policy IN ('skip','update','create')),
  -- Optional pointer to the recurring source (a connector id / object key). Never
  -- a secret — the connector's credential lives behind the integrations registry.
  source_ref    text,
  lock_version  int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  deleted_at    timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS import_profiles_tenant_idx
  ON import_profiles (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS import_profiles_bump_lock_version ON import_profiles;
CREATE TRIGGER import_profiles_bump_lock_version BEFORE UPDATE ON import_profiles
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE import_profiles DROP CONSTRAINT IF EXISTS import_profiles_created_by_member_fk;
ALTER TABLE import_profiles ADD CONSTRAINT import_profiles_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE import_profiles DROP CONSTRAINT IF EXISTS import_profiles_updated_by_member_fk;
ALTER TABLE import_profiles ADD CONSTRAINT import_profiles_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('import_profiles');

CREATE TABLE IF NOT EXISTS import_runs (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  -- Nullable: an ad-hoc run need not come from a saved profile. Composite FK so a
  -- profile reference can never cross tenants (settled architecture).
  profile_id    uuid,
  target_entity text NOT NULL CHECK (target_entity IN ('suppliers')),
  -- pending → the run exists, rows staged, not yet validated.
  -- validated → validate + dry-run done, counts populated, NOTHING written.
  -- committing → commit in progress (claimed).
  -- completed / failed → terminal.
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','validated','committing','completed','failed')),
  mapping       jsonb NOT NULL DEFAULT '{}'::jsonb,
  transform     jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_policy text NOT NULL DEFAULT 'update'
                  CHECK (dedupe_policy IN ('skip','update','create')),
  -- The staged source rows (array of {column: value}). Capped at 50k rows/run in
  -- the service (09 §6). For very large migrations this becomes an object-store
  -- pointer instead — see PROGRESS decisions.
  source_rows   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Roll-up: { total, valid, errors, warnings, created, updated, skipped }.
  counts        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Row-level results: [{ row, key, status, errors[], warnings[] }] (capped sample).
  result        jsonb NOT NULL DEFAULT '[]'::jsonb,
  error         text,
  lock_version  int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  deleted_at    timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS import_runs_tenant_idx
  ON import_runs (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS import_runs_bump_lock_version ON import_runs;
CREATE TRIGGER import_runs_bump_lock_version BEFORE UPDATE ON import_runs
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE import_runs DROP CONSTRAINT IF EXISTS import_runs_profile_fk;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_profile_fk
  FOREIGN KEY (tenant_id, profile_id) REFERENCES import_profiles (tenant_id, id) ON DELETE SET NULL;
ALTER TABLE import_runs DROP CONSTRAINT IF EXISTS import_runs_created_by_member_fk;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE import_runs DROP CONSTRAINT IF EXISTS import_runs_updated_by_member_fk;
ALTER TABLE import_runs ADD CONSTRAINT import_runs_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('import_runs');
