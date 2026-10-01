-- ===========================================================================
-- 0075_control_plane_plans — Sprint 07 P8/O3. SPRINT-07-entitlements-
-- onboarding.md §3.1, P8 AC1, O3 AC1.
--
-- Two control-plane tables, neither tenant-owned:
--   control.tenant_plans       — the commercial contract record per tenant
--                                 (self-service flag, contract value, CSM
--                                 fields). The app reads it (never writes it
--                                 here — 07C's platform role gets UPDATE).
--   control.workspace_requests — the public "request a workspace" intake
--                                 (O3). The public API path may only INSERT:
--                                 it can add a request but never read, list
--                                 or update one (enumeration-proof by grant);
--                                 the migrator-role provisioning script, and
--                                 later 07C's platform role, read them.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS control.tenant_plans (
  tenant_id                 uuid PRIMARY KEY REFERENCES control.tenants (id),
  -- D1 DECIDED: new tenants default to request mode.
  self_service              boolean NOT NULL DEFAULT false,
  contract_renews_on        date,
  contract_value_annual     numeric(12, 2),
  contract_currency         text NOT NULL DEFAULT 'USD',
  csm_name                  text,
  csm_email                 citext,
  csm_booking_url           text CHECK (csm_booking_url IS NULL OR csm_booking_url ~ '^https://'),
  csm_chat_url              text CHECK (csm_chat_url IS NULL OR csm_chat_url ~ '^https://'),
  lock_version              int NOT NULL DEFAULT 0,
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_reason            text,
  updated_by_platform_user  uuid
);

DROP TRIGGER IF EXISTS tenant_plans_touch ON control.tenant_plans;
CREATE TRIGGER tenant_plans_touch BEFORE UPDATE ON control.tenant_plans
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- The API can read (billing & plan, the self-service flag, the resolver) but
-- never write here — the same boundary as control.tenants. 07C's platform
-- role gets UPDATE in its own migration.
GRANT SELECT ON control.tenant_plans TO kaenal_app;

CREATE TABLE IF NOT EXISTS control.workspace_requests (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  company_name         text NOT NULL CHECK (char_length(company_name) <= 120),
  work_email           citext NOT NULL CHECK (char_length(work_email) <= 254),
  -- Catalog key, text, no CHECK — validated against the active catalog at
  -- insert time by the API (U-D4: an industry staff add today is accepted
  -- today, with no migration).
  industry             text,
  industry_label       text,
  plant_size           text CHECK (plant_size IN ('50-200', '200-1000', '1000-5000', '5000+', 'unspecified')),
  frameworks           text[] NOT NULL DEFAULT '{}',
  custom_frameworks    text[] NOT NULL DEFAULT '{}',
  status               text NOT NULL DEFAULT 'new'
                         CHECK (status IN ('new', 'provisioned', 'declined', 'spam')),
  provisioned_tenant_id uuid REFERENCES control.tenants (id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- Salted hash, never the raw IP (CLAUDE.md "never log/store PII beyond
  -- what's needed"; this is for abuse triage only).
  request_ip_hash      text
);

CREATE INDEX IF NOT EXISTS workspace_requests_status_idx
  ON control.workspace_requests (status, created_at DESC);

-- Enumeration-proof by grant: the public path (served by the kaenal_public
-- pool, like GET /v1/public/onboarding-catalog) can only INSERT. It can never
-- SELECT its own or anyone else's row back, so no response can confirm
-- whether an email/company already requested (O3 UC "no enumeration").
-- kaenal_app deliberately gets NOTHING here: only the migrator-role
-- provisioning script (`--from-request`) and, from 07C, the platform role
-- read or update these rows.
GRANT INSERT ON control.workspace_requests TO kaenal_public;
