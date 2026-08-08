-- ===========================================================================
-- 0025_tenant_settings — reusable per-tenant settings store (04 §Settings).
--
-- The admin/platform settings screens (white-label branding, session policies,
-- SLA overrides, …) each own a small JSON config document that is one-per-tenant
-- and edited rarely but read on the hot path (branding shows on every page). A
-- dedicated table per screen would be a lot of near-identical single-row tables,
-- so instead this is ONE table keyed by (tenant_id, namespace): each namespace
-- holds one JSONB `doc`, its shape validated by a Zod schema at the API edge
-- (packages/types). The first consumer is `branding` (Phase A); `session` and
-- others land with their own slice, each widening the namespace CHECK.
--
-- Optimistic concurrency (rule 6): `lock_version` + the shared bump trigger, so
-- two admins editing branding can't silently clobber each other. The composite
-- (tenant_id, updated_by) FK is the standard member reference (a member of
-- another tenant can never be stamped here).
--
-- RLS: check-rls.ts enumerates tenant tables from the catalog, so this table is
-- in scope by default and would fail CI without the policy. The PRIMARY KEY
-- (tenant_id, namespace) is itself the leading-tenant_id index the lint requires.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id    uuid NOT NULL,
  namespace    text NOT NULL CHECK (namespace IN ('branding')),
  doc          jsonb NOT NULL DEFAULT '{}'::jsonb,
  lock_version int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  PRIMARY KEY (tenant_id, namespace)
);

-- Optimistic concurrency (0004): bump lock_version on every UPDATE.
DROP TRIGGER IF EXISTS tenant_settings_bump_lock_version ON tenant_settings;
CREATE TRIGGER tenant_settings_bump_lock_version BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- Composite member FKs (created after 0003, so wired by hand like exports):
-- whoever created / last edited a settings doc is a member of THIS tenant.
ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_created_by_member_fk;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_updated_by_member_fk;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- Tenant isolation (02 §1).
SELECT apply_tenant_rls('tenant_settings');
