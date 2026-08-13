-- ===========================================================================
-- 0027_session_settings — widen tenant_settings for the 'session' namespace
-- (04 §Settings > Security > Session policies; identity-advanced.jsx
-- `SessionPolicies`).
--
-- Phase C reuses the 0025 tenant_settings store for the per-tenant session
-- policy (web idle/absolute timeout, mobile idle, max concurrent, remember-device,
-- step-up window). The only schema change is admitting the new namespace; the
-- policy shape is a Zod schema at the API edge, like branding. Enforcement of the
-- absolute timeout (session expires_at) and max-concurrent (revoke oldest) lives
-- in AuthService.signIn.
-- ===========================================================================

ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_namespace_check;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_namespace_check
  CHECK (namespace IN ('branding', 'session'));
