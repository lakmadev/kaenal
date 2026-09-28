-- ===========================================================================
-- 0042 — Session scope: enrolment-only sessions for first-login MFA (P11).
--
-- A partner (external supplier contact) must have TOTP before receiving a full
-- session, but cannot enrol without being authenticated. Resolution: after a
-- correct password and with no factor configured, sign-in mints a short-lived
-- session with scope 'mfa_enrol'. The request lifecycle refuses it everywhere
-- except the MFA enrol/activate/status + sign-out routes; a successful
-- activation (a verified TOTP code) promotes it to 'full'.
--
-- Existing rows and every ordinary sign-in are 'full'. sessions is already a
-- tenant-owned table with forced RLS + a tenant-leading index; this only adds a
-- column, so no policy or index change is needed.
-- ===========================================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'full';
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_scope_check;
ALTER TABLE sessions
  ADD CONSTRAINT sessions_scope_check CHECK (scope IN ('full', 'mfa_enrol'));
