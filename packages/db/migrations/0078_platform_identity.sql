-- ===========================================================================
-- 0078_platform_identity — Sprint 07C C1/C2 (Shared foundation).
-- SPRINT-07C-staff-console.md §3 SD1-SD4, §3.1, C1 AC1-AC2, C2 AC1.
--
-- A platform user is a SEPARATE identity from `control.users` (never a
-- tenant member by virtue of being a platform user, never appears in any
-- tenant member list — SD2). Mirrors 0003_shared_identity's own pattern:
-- control-plane, exempt from the RLS lint by schema, its own explicit access
-- tests (the `control-identity.test.ts` precedent), MFA mandatory (SD4,
-- enforced by a DB CHECK, not only application logic).
--
-- `kaenal_platform` is created NOLOGIN here (AR29): `migrate-tenants` fans
-- every migration out to every dedicated database, so a role created
-- LOGIN-with-a-default-password in a migration would exist, with that
-- password, on every customer's dedicated database. LOGIN and a real
-- per-environment credential are set outside migrations entirely — by
-- `provision-tenant`/`migrate-tenants` from the secret manager, or locally by
-- a dev-only `pnpm db:dev-roles` (not built in this migrations-only slice).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS control.platform_users (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  email             citext NOT NULL UNIQUE CHECK (char_length(email) <= 254),
  display_name      text NOT NULL CHECK (char_length(display_name) <= 80),
  role              text NOT NULL CHECK (role IN ('platform_support', 'platform_sales', 'platform_admin')),
  status            text NOT NULL DEFAULT 'pending_setup'
                      CHECK (status IN ('pending_setup', 'active', 'deactivated')),
  password_hash     text,
  mfa_secret_enc    text,
  mfa_enabled_at    timestamptz,
  failed_attempts   int NOT NULL DEFAULT 0,
  locked_until      timestamptz,
  last_sign_in_at   timestamptz,
  lock_version      int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- SD4: an active platform account without MFA is impossible at the database
-- level, not only enforced by the sign-in flow.
ALTER TABLE control.platform_users DROP CONSTRAINT IF EXISTS platform_users_mfa_required_ck;
ALTER TABLE control.platform_users ADD CONSTRAINT platform_users_mfa_required_ck CHECK (
  status <> 'active' OR (password_hash IS NOT NULL AND mfa_enabled_at IS NOT NULL)
);

DROP TRIGGER IF EXISTS platform_users_touch ON control.platform_users;
CREATE TRIGGER platform_users_touch BEFORE UPDATE ON control.platform_users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX IF NOT EXISTS platform_users_locked_idx
  ON control.platform_users (locked_until) WHERE locked_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS control.platform_setup_tokens (
  token_hash        text PRIMARY KEY,
  platform_user_id  uuid NOT NULL REFERENCES control.platform_users (id) ON DELETE CASCADE,
  purpose           text NOT NULL CHECK (purpose IN ('setup', 'reset')),
  expires_at        timestamptz NOT NULL,
  used_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_setup_tokens_user_idx
  ON control.platform_setup_tokens (platform_user_id);

CREATE TABLE IF NOT EXISTS control.platform_mfa_recovery_codes (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  platform_user_id  uuid NOT NULL REFERENCES control.platform_users (id) ON DELETE CASCADE,
  code_hash         text NOT NULL,
  used_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_mfa_recovery_codes_uq
  ON control.platform_mfa_recovery_codes (platform_user_id, code_hash);

CREATE TABLE IF NOT EXISTS control.platform_sessions (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  token_hash          text NOT NULL UNIQUE,
  platform_user_id    uuid NOT NULL REFERENCES control.platform_users (id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  idle_expires_at     timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at          timestamptz,
  ip                  inet,
  user_agent          text
);

CREATE INDEX IF NOT EXISTS platform_sessions_user_idx
  ON control.platform_sessions (platform_user_id) WHERE revoked_at IS NULL;

-- Backs `POST /platform/v1/auth/step-up` (C2 AC5), consumed by content-scope
-- support-grant creation (C3 AC8, §3 SD10). Single-use, 5-minute expiry.
CREATE TABLE IF NOT EXISTS control.platform_step_up_tokens (
  token_hash        text PRIMARY KEY,
  platform_user_id  uuid NOT NULL REFERENCES control.platform_users (id) ON DELETE CASCADE,
  expires_at        timestamptz NOT NULL,
  used_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_step_up_tokens_user_idx
  ON control.platform_step_up_tokens (platform_user_id);

-- Reserved tenant slugs (CX AC2a): a tenant can never claim "staff" or
-- "platform" as its subdomain, since those hosts are reserved for the
-- platform surface (SD1).
CREATE OR REPLACE FUNCTION control.reject_reserved_tenant_slug() RETURNS trigger AS $$
BEGIN
  IF NEW.slug IN ('staff', 'platform') THEN
    RAISE EXCEPTION 'tenant slug "%" is reserved for the platform surface', NEW.slug
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_reject_reserved_slug ON control.tenants;
CREATE TRIGGER tenants_reject_reserved_slug BEFORE INSERT OR UPDATE ON control.tenants
  FOR EACH ROW EXECUTE FUNCTION control.reject_reserved_tenant_slug();

-- --- Role: kaenal_platform (control plane, platform API process only) -------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaenal_platform') THEN
    CREATE ROLE kaenal_platform NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA control TO kaenal_platform;
GRANT SELECT, INSERT, UPDATE ON control.platform_users TO kaenal_platform;
GRANT SELECT, INSERT, UPDATE ON control.platform_setup_tokens TO kaenal_platform;
GRANT SELECT, INSERT, UPDATE ON control.platform_mfa_recovery_codes TO kaenal_platform;
GRANT SELECT, INSERT, UPDATE ON control.platform_sessions TO kaenal_platform;
GRANT SELECT, INSERT, UPDATE ON control.platform_step_up_tokens TO kaenal_platform;
-- The directory read (C4) and every grant-scoped tenant read (C3) start here.
GRANT SELECT ON control.tenants TO kaenal_platform;

-- Neither tenant-facing role may ever see a platform identity or its
-- credentials (grant test precedent: control-identity.test.ts).
REVOKE ALL ON control.platform_users FROM kaenal_app, kaenal_public;
REVOKE ALL ON control.platform_setup_tokens FROM kaenal_app, kaenal_public;
REVOKE ALL ON control.platform_mfa_recovery_codes FROM kaenal_app, kaenal_public;
REVOKE ALL ON control.platform_sessions FROM kaenal_app, kaenal_public;
REVOKE ALL ON control.platform_step_up_tokens FROM kaenal_app, kaenal_public;
