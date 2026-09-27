-- ===========================================================================
-- 0060 — Full-page CreateWizard fields (Sprint 01 S1-1).
--
-- The wizard (createwizard.jsx) collects fields the create routes could not
-- persist. Nothing is dropped (rule 0):
--   * inspections / eight_ds : priority, description, area_label (free-text
--     "Area / Asset"); eight_ds also gets plant_id + template (8D template).
--   * ncrs                   : area_label.
--   * documents              : description, plant_id, area_label, template (the
--     wizard's Policy / Upload templates have no category of their own; the
--     category is derived in packages/core, the exact template kept here).
--   * entity_people          : the "Assignees & approvals" step — one row per
--     person + role (owner/reviewer/approver/watcher) on any of the four
--     entities. The user reference is a composite FK to memberships.
-- All new columns are nullable/optional so mobile and existing callers keep
-- working unchanged.
-- ===========================================================================

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS area_label text;
ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_priority_ck;
ALTER TABLE inspections ADD CONSTRAINT inspections_priority_ck
  CHECK (priority IS NULL OR priority IN ('low','medium','high','critical'));

ALTER TABLE ncrs ADD COLUMN IF NOT EXISTS area_label text;

ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS area_label text;
ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS template text;
ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES plants(id) ON DELETE RESTRICT;
ALTER TABLE eight_ds DROP CONSTRAINT IF EXISTS eight_ds_priority_ck;
ALTER TABLE eight_ds ADD CONSTRAINT eight_ds_priority_ck
  CHECK (priority IS NULL OR priority IN ('low','medium','high','critical'));
ALTER TABLE eight_ds DROP CONSTRAINT IF EXISTS eight_ds_template_ck;
ALTER TABLE eight_ds ADD CONSTRAINT eight_ds_template_ck
  CHECK (template IS NULL OR template IN ('auto','medical','aero','standard'));
CREATE INDEX IF NOT EXISTS eight_ds_tenant_plant_idx ON eight_ds (tenant_id, plant_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS area_label text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES plants(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS documents_tenant_plant_idx ON documents (tenant_id, plant_id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS template text;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_template_ck;
ALTER TABLE documents ADD CONSTRAINT documents_template_ck
  CHECK (template IS NULL OR template IN ('sop','wi','form','policy','manual','upload'));

CREATE TABLE IF NOT EXISTS entity_people (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  entity_kind  text NOT NULL CHECK (entity_kind IN ('inspection','ncr','eight_d','document')),
  entity_id    uuid NOT NULL,
  user_id      uuid NOT NULL,
  role         text NOT NULL CHECK (role IN ('owner','reviewer','approver','watcher')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid
);

-- Leading-tenant_id indexes (rule 2): one role per person per record.
CREATE UNIQUE INDEX IF NOT EXISTS entity_people_tenant_entity_user_uq
  ON entity_people (tenant_id, entity_kind, entity_id, user_id);
CREATE INDEX IF NOT EXISTS entity_people_tenant_user_idx ON entity_people (tenant_id, user_id);

ALTER TABLE entity_people DROP CONSTRAINT IF EXISTS entity_people_member_fk;
ALTER TABLE entity_people ADD CONSTRAINT entity_people_member_fk
  FOREIGN KEY (tenant_id, user_id) REFERENCES memberships (tenant_id, user_id) ON DELETE CASCADE;

SELECT apply_tenant_rls('entity_people');
