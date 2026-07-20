-- ===========================================================================
-- 0001_core — all tenant-owned tables, per 02 §2.
--
-- House rules applied to every table here:
--   * id uuid PK default uuidv7(); tenant_id uuid NOT NULL
--   * created_at/updated_at timestamptz NOT NULL default now(); created_by/updated_by
--   * deleted_at where user-facing (soft delete is the only user-facing delete)
--   * CHECK constraints mirror packages/types/src/enums.ts verbatim
--   * FKs ON DELETE RESTRICT (02 §7) — nothing cascades out from under a record
--   * apply_tenant_rls() + a leading-tenant_id index on every table
-- ===========================================================================

-- --- Identity ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  email       citext NOT NULL,
  name        text NOT NULL,
  title       text,
  avatar_url  text,
  locale      text NOT NULL DEFAULT 'en',
  timezone    text NOT NULL DEFAULT 'UTC',
  status      text NOT NULL DEFAULT 'invited'
                CHECK (status IN ('active','invited','deactivated')),
  password_hash text,
  mfa_secret    text,
  failed_login_attempts int NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
-- Email is unique per tenant (02 §2), not globally: the same person at two
-- customers is two user rows, and sign-in resolves the workspace by email.
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_uq ON users (tenant_id, email);
CREATE INDEX IF NOT EXISTS users_tenant_status_idx ON users (tenant_id, status);

CREATE TABLE IF NOT EXISTS memberships (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role        text NOT NULL
                CHECK (role IN ('admin','manager','auditor','inspector','viewer')),
  plant_ids   uuid[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_tenant_uq ON memberships (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_tenant_role_idx ON memberships (tenant_id, role);

-- Refresh-token sessions, revocable per device (03 §2).
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  refresh_token_hash text NOT NULL,
  device_label    text,
  ip              inet,
  user_agent      text,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid
);
CREATE INDEX IF NOT EXISTS sessions_tenant_user_idx ON sessions (tenant_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_uq ON sessions (tenant_id, refresh_token_hash);

-- --- Sites ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plants (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  code        text NOT NULL,
  address     text,
  timezone    text NOT NULL DEFAULT 'UTC',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS plants_tenant_code_uq ON plants (tenant_id, code);

CREATE TABLE IF NOT EXISTS areas (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  plant_id    uuid NOT NULL REFERENCES plants(id) ON DELETE RESTRICT,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS areas_tenant_plant_idx ON areas (tenant_id, plant_id);

-- --- Inspections ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inspection_templates (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  version     int NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','archived')),
  schema      jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  usage_count int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
-- Publishing creates a NEW row at version+1; a published schema is immutable
-- (02 §7), enforced by the trigger below rather than by convention.
CREATE UNIQUE INDEX IF NOT EXISTS templates_tenant_name_version_uq
  ON inspection_templates (tenant_id, name, version);
CREATE INDEX IF NOT EXISTS templates_tenant_status_idx
  ON inspection_templates (tenant_id, status);

CREATE OR REPLACE FUNCTION reject_published_schema_edit() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'published' AND NEW.schema IS DISTINCT FROM OLD.schema THEN
    RAISE EXCEPTION 'cannot modify the schema of a published template (version it instead)'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS templates_schema_immutable ON inspection_templates;
CREATE TRIGGER templates_schema_immutable BEFORE UPDATE ON inspection_templates
  FOR EACH ROW EXECUTE FUNCTION reject_published_schema_edit();

CREATE TABLE IF NOT EXISTS inspections (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id         uuid NOT NULL,
  code              text NOT NULL,
  title             text NOT NULL,
  template_id       uuid NOT NULL REFERENCES inspection_templates(id) ON DELETE RESTRICT,
  template_version  int NOT NULL,
  inspector_id      uuid REFERENCES users(id) ON DELETE RESTRICT,
  plant_id          uuid REFERENCES plants(id) ON DELETE RESTRICT,
  area_id           uuid REFERENCES areas(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  risk              text CHECK (risk IN ('low','medium','high','critical')),
  scheduled_at      timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  score             numeric(6,2),
  responses         jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_file_id uuid,
  recurrence        jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid,
  updated_by        uuid,
  deleted_at        timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS inspections_tenant_code_uq ON inspections (tenant_id, code);
CREATE INDEX IF NOT EXISTS inspections_tenant_status_idx ON inspections (tenant_id, status);
CREATE INDEX IF NOT EXISTS inspections_tenant_created_idx ON inspections (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inspections_tenant_scheduled_idx ON inspections (tenant_id, scheduled_at);

CREATE TABLE IF NOT EXISTS findings (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE RESTRICT,
  item_ref      text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('minor','major','critical')),
  description   text NOT NULL,
  ncr_id        uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS findings_tenant_inspection_idx ON findings (tenant_id, inspection_id);

-- --- NCR --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ncrs (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  code        text NOT NULL,
  title       text NOT NULL,
  description text,
  source      text NOT NULL DEFAULT 'manual'
                CHECK (source IN ('inspection','manual','complaint','audit')),
  source_id   uuid,
  priority    text NOT NULL DEFAULT 'minor'
                CHECK (priority IN ('minor','major','critical')),
  risk        text CHECK (risk IN ('low','medium','high','critical')),
  category    text,
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','open','assigned','in_progress','resolved',
                                  'verified','closed','escalated','reopened')),
  owner_id    uuid REFERENCES users(id) ON DELETE RESTRICT,
  plant_id    uuid REFERENCES plants(id) ON DELETE RESTRICT,
  area_id     uuid REFERENCES areas(id) ON DELETE RESTRICT,
  due_at      timestamptz,
  sla_state   text NOT NULL DEFAULT 'on_track'
                CHECK (sla_state IN ('on_track','at_risk','breached')),
  eight_d_id  uuid,
  impact      jsonb,
  resolved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at timestamptz,
  verified_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz,
  closed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ncrs_tenant_code_uq ON ncrs (tenant_id, code);
CREATE INDEX IF NOT EXISTS ncrs_tenant_status_idx ON ncrs (tenant_id, status);
CREATE INDEX IF NOT EXISTS ncrs_tenant_due_idx ON ncrs (tenant_id, due_at);
CREATE INDEX IF NOT EXISTS ncrs_tenant_owner_idx ON ncrs (tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS ncrs_tenant_created_idx ON ncrs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ncrs_tenant_sla_idx ON ncrs (tenant_id, sla_state);

-- Four-eyes rule (02 §4): whoever verifies an NCR cannot be whoever resolved it.
-- Enforced in packages/core for a friendly 409, and here so no path can bypass it.
ALTER TABLE ncrs DROP CONSTRAINT IF EXISTS ncrs_four_eyes_ck;
ALTER TABLE ncrs ADD CONSTRAINT ncrs_four_eyes_ck CHECK (
  verified_by IS NULL OR resolved_by IS NULL OR verified_by <> resolved_by
);

CREATE TABLE IF NOT EXISTS ncr_actions (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  ncr_id      uuid NOT NULL REFERENCES ncrs(id) ON DELETE RESTRICT,
  kind        text NOT NULL CHECK (kind IN ('containment','corrective','preventive')),
  description text NOT NULL,
  owner_id    uuid REFERENCES users(id) ON DELETE RESTRICT,
  due_at      timestamptz,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','done','verified')),
  verified_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS ncr_actions_tenant_ncr_idx ON ncr_actions (tenant_id, ncr_id);

-- --- 8D ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS eight_ds (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  code          text NOT NULL,
  title         text NOT NULL,
  ncr_id        uuid REFERENCES ncrs(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','completed','cancelled')),
  team_lead_id  uuid REFERENCES users(id) ON DELETE RESTRICT,
  champion_id   uuid REFERENCES users(id) ON DELETE RESTRICT,
  member_ids    uuid[] NOT NULL DEFAULT '{}',
  started_at    timestamptz,
  target_at     timestamptz,
  current_step  int NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 8),
  steps         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS eight_ds_tenant_code_uq ON eight_ds (tenant_id, code);
CREATE INDEX IF NOT EXISTS eight_ds_tenant_status_idx ON eight_ds (tenant_id, status);

-- Deferred FK: ncrs.eight_d_id ↔ eight_ds.id is circular, so it is added once
-- both tables exist.
ALTER TABLE ncrs DROP CONSTRAINT IF EXISTS ncrs_eight_d_fk;
ALTER TABLE ncrs ADD CONSTRAINT ncrs_eight_d_fk
  FOREIGN KEY (eight_d_id) REFERENCES eight_ds(id) ON DELETE RESTRICT;

ALTER TABLE findings DROP CONSTRAINT IF EXISTS findings_ncr_fk;
ALTER TABLE findings ADD CONSTRAINT findings_ncr_fk
  FOREIGN KEY (ncr_id) REFERENCES ncrs(id) ON DELETE RESTRICT;

-- --- Audits -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audits (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL,
  code            text NOT NULL,
  title           text NOT NULL,
  standard        text,
  type            text NOT NULL DEFAULT 'internal'
                    CHECK (type IN ('internal','certification','supplier','process')),
  status          text NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','preparation','fieldwork','reporting','closed')),
  lead_auditor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  team            uuid[] NOT NULL DEFAULT '{}',
  plant_id        uuid REFERENCES plants(id) ON DELETE RESTRICT,
  start_at        timestamptz,
  end_at          timestamptz,
  checklist       jsonb NOT NULL DEFAULT '[]'::jsonb,
  progress        numeric(5,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS audits_tenant_code_uq ON audits (tenant_id, code);
CREATE INDEX IF NOT EXISTS audits_tenant_status_idx ON audits (tenant_id, status);

CREATE TABLE IF NOT EXISTS audit_findings (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  audit_id    uuid NOT NULL REFERENCES audits(id) ON DELETE RESTRICT,
  clause      text,
  kind        text NOT NULL CHECK (kind IN ('major_nc','minor_nc','opportunity')),
  description text NOT NULL,
  ncr_id      uuid REFERENCES ncrs(id) ON DELETE RESTRICT,
  capa_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS audit_findings_tenant_audit_idx ON audit_findings (tenant_id, audit_id);

-- --- CAPA -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS capas (
  id                    uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id             uuid NOT NULL,
  code                  text NOT NULL,
  title                 text NOT NULL,
  description           text,
  type                  text NOT NULL DEFAULT 'corrective'
                          CHECK (type IN ('corrective','preventive')),
  priority              text NOT NULL DEFAULT 'minor'
                          CHECK (priority IN ('minor','major','critical')),
  risk                  text CHECK (risk IN ('low','medium','high','critical')),
  owner_id              uuid REFERENCES users(id) ON DELETE RESTRICT,
  sponsor_id            uuid REFERENCES users(id) ON DELETE RESTRICT,
  status                text NOT NULL DEFAULT 'initiation'
                          CHECK (status IN ('initiation','root_cause','action_plan',
                                            'implementation','verification','effectiveness','closed')),
  source_kind           text,
  source_id             uuid,
  due_at                timestamptz,
  effectiveness_check_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid,
  updated_by            uuid,
  deleted_at            timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS capas_tenant_code_uq ON capas (tenant_id, code);
CREATE INDEX IF NOT EXISTS capas_tenant_status_idx ON capas (tenant_id, status);
CREATE INDEX IF NOT EXISTS capas_tenant_due_idx ON capas (tenant_id, due_at);

ALTER TABLE audit_findings DROP CONSTRAINT IF EXISTS audit_findings_capa_fk;
ALTER TABLE audit_findings ADD CONSTRAINT audit_findings_capa_fk
  FOREIGN KEY (capa_id) REFERENCES capas(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS capa_actions (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  capa_id     uuid NOT NULL REFERENCES capas(id) ON DELETE RESTRICT,
  description text NOT NULL,
  owner_id    uuid REFERENCES users(id) ON DELETE RESTRICT,
  due_at      timestamptz,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_progress','done','verified')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS capa_actions_tenant_capa_idx ON capa_actions (tenant_id, capa_id);

-- --- Files ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS files (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  bucket      text NOT NULL,
  key         text NOT NULL,
  filename    text NOT NULL,
  mime        text NOT NULL,
  size_bytes  bigint NOT NULL CHECK (size_bytes >= 0),
  sha256      text,
  uploaded_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  scan_status text NOT NULL DEFAULT 'pending'
                CHECK (scan_status IN ('pending','clean','infected')),
  entity_kind text,
  entity_id   uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS files_tenant_bucket_key_uq ON files (tenant_id, bucket, key);
CREATE INDEX IF NOT EXISTS files_tenant_entity_idx ON files (tenant_id, entity_kind, entity_id);
CREATE INDEX IF NOT EXISTS files_tenant_scan_idx ON files (tenant_id, scan_status);

ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_signature_file_fk;
ALTER TABLE inspections ADD CONSTRAINT inspections_signature_file_fk
  FOREIGN KEY (signature_file_id) REFERENCES files(id) ON DELETE RESTRICT;

-- --- Documents --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  code        text NOT NULL,
  title       text NOT NULL,
  category    text NOT NULL
                CHECK (category IN ('manual','sop','work_instruction','form','record',
                                    'audit_report','supplier','training')),
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','pending','approved','rejected','archived')),
  version     text NOT NULL DEFAULT '1.0',
  file_id     uuid REFERENCES files(id) ON DELETE RESTRICT,
  owner_id    uuid REFERENCES users(id) ON DELETE RESTRICT,
  approver_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  expires_at  timestamptz,
  frameworks  text[] NOT NULL DEFAULT '{}',
  ai_summary  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS documents_tenant_code_uq ON documents (tenant_id, code);
CREATE INDEX IF NOT EXISTS documents_tenant_status_idx ON documents (tenant_id, status);
CREATE INDEX IF NOT EXISTS documents_tenant_expires_idx ON documents (tenant_id, expires_at);

CREATE TABLE IF NOT EXISTS document_versions (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  version     text NOT NULL,
  file_id     uuid REFERENCES files(id) ON DELETE RESTRICT,
  changelog   text,
  approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS document_versions_uq
  ON document_versions (tenant_id, document_id, version);

-- --- Suppliers --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS suppliers (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  code        text NOT NULL,
  tier        int,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','probation','suspended','inactive')),
  risk_tier   text CHECK (risk_tier IN ('low','medium','high','critical')),
  contact     jsonb,
  -- Raw metrics only ({ppm, otd, oqe, scar_count}); the weighted score is
  -- computed in packages/core so the weighting stays testable and versionable.
  scorecard   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_tenant_code_uq ON suppliers (tenant_id, code);
CREATE INDEX IF NOT EXISTS suppliers_tenant_status_idx ON suppliers (tenant_id, status);

CREATE TABLE IF NOT EXISTS ppap_submissions (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  part_number text NOT NULL,
  level       int NOT NULL CHECK (level BETWEEN 1 AND 5),
  status      text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','submitted','interim','approved','rejected')),
  elements    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS ppap_tenant_supplier_idx ON ppap_submissions (tenant_id, supplier_id);

CREATE TABLE IF NOT EXISTS scars (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  code        text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  ncr_id      uuid REFERENCES ncrs(id) ON DELETE RESTRICT,
  status      text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','responded','accepted','rejected','closed')),
  chargeback  jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS scars_tenant_code_uq ON scars (tenant_id, code);
CREATE INDEX IF NOT EXISTS scars_tenant_supplier_idx ON scars (tenant_id, supplier_id);

-- --- Collaboration & config -------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind          text NOT NULL,
  title         text NOT NULL,
  body          text,
  entity_kind   text,
  entity_id     uuid,
  read_at       timestamptz,
  channels_sent text[] NOT NULL DEFAULT '{}',
  dedupe_key    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);
CREATE INDEX IF NOT EXISTS notifications_tenant_user_idx
  ON notifications (tenant_id, user_id, created_at DESC);
-- Jobs are re-runnable, so the dedupe key is what keeps a retry from
-- double-notifying (06 edge cases).
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_uq
  ON notifications (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS notification_prefs (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  matrix      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS notification_prefs_uq ON notification_prefs (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  entity_kind text NOT NULL,
  entity_id   uuid NOT NULL,
  author_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body        text NOT NULL,
  parent_id   uuid REFERENCES comments(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS comments_tenant_entity_idx
  ON comments (tenant_id, entity_kind, entity_id, created_at DESC);

-- Per-tenant, per-year sequence source for human-facing codes (NCR-2026-0142).
-- Incremented with INSERT ... ON CONFLICT DO UPDATE RETURNING so concurrent
-- creates serialize on the row lock rather than racing (02 §7).
CREATE TABLE IF NOT EXISTS counters (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  kind        text NOT NULL,
  year        int NOT NULL,
  value       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS counters_uq ON counters (tenant_id, kind, year);

CREATE TABLE IF NOT EXISTS sla_configs (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL,
  entity_kind      text NOT NULL,
  priority         text NOT NULL,
  respond_hours    int NOT NULL,
  resolve_hours    int NOT NULL,
  escalate_to_role text CHECK (escalate_to_role IN ('admin','manager','auditor','inspector','viewer')),
  business_hours   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_by       uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS sla_configs_uq ON sla_configs (tenant_id, entity_kind, priority);

CREATE TABLE IF NOT EXISTS entitlements (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  pack_id      text NOT NULL,
  active       boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_uq ON entitlements (tenant_id, pack_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  name         text NOT NULL,
  hash         text NOT NULL,   -- SHA-256 of the secret. The secret itself is never stored.
  prefix       text NOT NULL,   -- shown in the UI so a key is identifiable
  scopes       text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_uq ON api_keys (tenant_id, hash);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  url           text NOT NULL,
  secret        text NOT NULL,
  events        text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','disabled')),
  failure_count int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_tenant_idx ON webhook_endpoints (tenant_id, status);

-- --- Compliance (07) --------------------------------------------------------

CREATE TABLE IF NOT EXISTS signatures (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL,
  entity_kind    text NOT NULL,
  entity_id      uuid NOT NULL,
  signer_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  meaning        text NOT NULL CHECK (meaning IN ('performed','reviewed','approved')),
  signed_at      timestamptz NOT NULL DEFAULT now(),
  auth_method    text NOT NULL,
  -- Hash of the canonical JSON of the signed content at signing time. Any later
  -- edit changes the recomputed hash, so verification reports "content changed
  -- after signing" instead of silently accepting it (07 §2).
  content_sha256 text NOT NULL,
  stroke_file_id uuid REFERENCES files(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid
);
CREATE INDEX IF NOT EXISTS signatures_tenant_entity_idx
  ON signatures (tenant_id, entity_kind, entity_id);

CREATE TABLE IF NOT EXISTS legal_holds (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  scope       jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason      text NOT NULL,
  released_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);
CREATE INDEX IF NOT EXISTS legal_holds_tenant_active_idx
  ON legal_holds (tenant_id) WHERE released_at IS NULL;

-- --- Audit trail (02 §3, 07 §1) --------------------------------------------

CREATE TABLE IF NOT EXISTS audit_events (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  actor_id    uuid,                  -- null = system/job
  actor_kind  text NOT NULL CHECK (actor_kind IN ('user','system','api_key','support')),
  entity_kind text NOT NULL,
  entity_id   uuid NOT NULL,
  action      text NOT NULL,
  before      jsonb,                 -- changed fields only, secrets redacted
  after       jsonb,
  reason      text,                  -- required for support-role actions and overrides
  request_id  uuid,
  ip          inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx
  ON audit_events (tenant_id, entity_kind, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
  ON audit_events (tenant_id, created_at DESC);

-- Support access must always carry a reason — transparency is a feature (07 §7).
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_support_reason_ck;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_support_reason_ck CHECK (
  actor_kind <> 'support' OR reason IS NOT NULL
);

-- ===========================================================================
-- Apply the canonical RLS pattern to every tenant-owned table.
--
-- Driving this from one list (rather than repeating the DDL per table) is what
-- makes it structurally impossible for a table to ship without isolation.
-- check-rls.ts independently verifies the result against pg_policies, so a
-- table omitted from this list still fails CI (02 §6).
-- ===========================================================================
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'users','memberships','sessions','plants','areas',
    'inspection_templates','inspections','findings',
    'ncrs','ncr_actions','eight_ds',
    'audits','audit_findings','capas','capa_actions',
    'files','documents','document_versions',
    'suppliers','ppap_submissions','scars',
    'notifications','notification_prefs','comments','counters',
    'sla_configs','entitlements','api_keys','webhook_endpoints',
    'signatures','legal_holds','audit_events'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    PERFORM apply_tenant_rls(t::regclass);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Audit-trail immutability (02 §3). Two independent nets: the app role simply
-- lacks the privilege, and a trigger blocks it even if a privilege is ever
-- granted by mistake.
-- ---------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON audit_events FROM kaenal_app;

DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- The public role touches no tenant data at all (02 §1).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM kaenal_public;
