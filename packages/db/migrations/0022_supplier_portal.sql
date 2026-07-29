-- ===========================================================================
-- 0022_supplier_portal — the `partner` role + supplier-scope for P11 (FEATURES §17).
--
-- ⚠️ This is the one migration that opens the tenant trust boundary to EXTERNAL
-- users. A `partner` is a supplier contact who may see ONLY their own supplier's
-- SCARs / PPAP through the read-only `/v1/portal/*` namespace. The isolation is
-- enforced defense-in-depth: RLS scopes to the tenant (unchanged), and a new
-- supplier-scope check in the lifecycle interceptor's authorization layer scopes
-- a partner session to a single `supplier_id` — a foreign supplier id is 404,
-- mirroring the existing plant-scope 404 (rule 8, one level down).
--
-- Design (signed off P11): partners are still `control.users` with a normal
-- `membership`, so there is ONE identity/audit/MFA plane — not a second service
-- and datastore to keep in sync. What makes them safe is authorization, not a
-- separate schema: a `partner` gets a portal-only capability set (no internal
-- caps → 403 on /v1/ncrs etc.), and their queries are additionally filtered to
-- `supplier_scope`. Partner sessions are short-lived and MFA-gated (in the auth
-- service + core auth-policy).
-- ===========================================================================

-- --- 1. The partner role ----------------------------------------------------
-- Widen the memberships + invitations role CHECKs to admit 'partner'. Existing
-- rows are all internal roles, so no data migration is needed.
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_role_check;
ALTER TABLE memberships
  ADD CONSTRAINT memberships_role_check
  CHECK (role IN ('admin','manager','auditor','inspector','viewer','partner'));

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
ALTER TABLE invitations
  ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('admin','manager','auditor','inspector','viewer','partner'));

-- --- 2. Supplier scope ------------------------------------------------------
-- The single supplier a partner is bound to. Intra-tenant FK to suppliers (the
-- same shape as scars.supplier_id / ppap.supplier_id) — RLS keeps it in-tenant.
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS supplier_scope uuid
  REFERENCES suppliers (id) ON DELETE RESTRICT;

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS supplier_scope uuid
  REFERENCES suppliers (id) ON DELETE RESTRICT;

-- The coupling invariant, enforced in the DB (not just the app): a membership is
-- a partner IF AND ONLY IF it carries a supplier_scope. An internal role can
-- never carry one (it would silently narrow their access), and a partner can
-- never lack one (it would be an un-scoped external account — the exact failure
-- this whole phase exists to prevent).
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_partner_scope_ck;
ALTER TABLE memberships
  ADD CONSTRAINT memberships_partner_scope_ck
  CHECK ((role = 'partner') = (supplier_scope IS NOT NULL));

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_partner_scope_ck;
ALTER TABLE invitations
  ADD CONSTRAINT invitations_partner_scope_ck
  CHECK ((role = 'partner') = (supplier_scope IS NOT NULL));

-- Partners are looked up by (tenant, supplier) when a supplier is offboarded, and
-- the scope is read on every partner request; a partial index keeps it cheap
-- without burdening the far more common internal memberships.
CREATE INDEX IF NOT EXISTS memberships_tenant_supplier_scope_idx
  ON memberships (tenant_id, supplier_scope) WHERE supplier_scope IS NOT NULL;
