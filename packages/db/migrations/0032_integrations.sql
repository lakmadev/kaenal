-- ===========================================================================
-- 0032_integrations — the ONE connector substrate (09-INTEGRATIONS §1;
-- report-data.jsx `RB_CONNECTORS`, operations.jsx bulk-import sources,
-- settings → Integrations).
--
-- Every connector — Slack, an ERP, a warehouse, a REST endpoint, an uploaded
-- CSV — is a row here, never bespoke plumbing (09 §1). Report data sources,
-- Data-Warehouse-Sync destinations, bulk-import sources, and the Integrations
-- settings screen all read/write this one table. Secrets NEVER live in `config`
-- or anywhere in the DB: `credentials_ref` is a pointer into the secret manager
-- (KMS-encrypted), and disconnect purges the secret.
--
-- Two tenant-scoped tables, optimistic + audited in the service. RLS enforced by
-- the catalog-driven check-rls lint (policy + leading-tenant_id index + member
-- FKs). `integration_events` is the per-delivery log that powers the settings UI.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS integrations (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL,
  provider        text NOT NULL
                    CHECK (provider IN ('slack','ms_teams','ms365','google','smtp',
                                        'sap','snowflake','oracle','powerbi','sheets',
                                        'rest','csv','generic_webhook')),
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('connected','error','disconnected')),
  -- Non-secret settings only (channel ids, mappings, endpoint host). Secrets
  -- are forbidden here and live behind credentials_ref.
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_ref text,
  last_error      text,
  connected_at    timestamptz,
  last_ok_at      timestamptz,
  connected_by    uuid,
  lock_version    int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS integrations_tenant_idx ON integrations (tenant_id, provider);

DROP TRIGGER IF EXISTS integrations_bump_lock_version ON integrations;
CREATE TRIGGER integrations_bump_lock_version BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_created_by_member_fk;
ALTER TABLE integrations ADD CONSTRAINT integrations_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_updated_by_member_fk;
ALTER TABLE integrations ADD CONSTRAINT integrations_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('integrations');

-- --- Per-delivery event log -------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_events (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL,
  integration_id uuid NOT NULL,
  direction      text NOT NULL CHECK (direction IN ('out','in')),
  kind           text NOT NULL,
  payload_digest text,
  status         text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','failed','retrying')),
  attempts       int  NOT NULL DEFAULT 1,
  detail         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_events_tenant_idx
  ON integration_events (tenant_id, integration_id, created_at DESC);

ALTER TABLE integration_events DROP CONSTRAINT IF EXISTS integration_events_integration_fk;
ALTER TABLE integration_events ADD CONSTRAINT integration_events_integration_fk
  FOREIGN KEY (tenant_id, integration_id) REFERENCES integrations (tenant_id, id) ON DELETE CASCADE;

SELECT apply_tenant_rls('integration_events');
