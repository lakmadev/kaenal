-- ===========================================================================
-- 0035 — Multi-factor authentication (TOTP) state.
--
-- Control-plane, because the factor secures a control-plane credential (the
-- person's login), not any one tenant. `control.users.mfa_secret` already
-- exists (0003) and holds the ACTIVE, encrypted TOTP secret. Two things are
-- added here:
--
--   * a PENDING secret + an enrolment timestamp, so enrolment is two steps —
--     generate a secret (pending), then activate it only once the user proves
--     they can produce a valid code. An unactivated enrolment never gates login.
--   * recovery codes: single-use argon2-hashed fallbacks for a lost
--     authenticator, so a user is never permanently locked out of their own
--     account.
--
-- Secrets are stored ENCRYPTED (AES-256-GCM, apps/api/src/auth/mfa-crypto.ts);
-- recovery codes are stored HASHED (argon2), never in plaintext. The columns
-- are text because both are opaque encoded blobs.
-- ===========================================================================

ALTER TABLE control.users ADD COLUMN IF NOT EXISTS mfa_pending_secret text;
ALTER TABLE control.users ADD COLUMN IF NOT EXISTS mfa_enrolled_at    timestamptz;

CREATE TABLE IF NOT EXISTS control.mfa_recovery_codes (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid NOT NULL REFERENCES control.users (id) ON DELETE CASCADE,
  code_hash  text NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lookups are always "the unused codes for this user".
CREATE INDEX IF NOT EXISTS control_mfa_recovery_codes_user_idx
  ON control.mfa_recovery_codes (user_id) WHERE used_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON control.mfa_recovery_codes TO kaenal_app;
