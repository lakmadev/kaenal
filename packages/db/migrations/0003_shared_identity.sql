-- ===========================================================================
-- 0003_shared_identity — move `users` from the tenant schema to `control`.
--
-- Resolves the 02 §2 vs 07 §7 conflict in favour of 07 §7. 02 §2 made email
-- unique PER TENANT, so one person working with two customers was two
-- unrelated user rows with two passwords. 07 §7 requires the opposite: an
-- invite to an email that already belongs to another tenant is allowed, and
-- the person picks a workspace at sign-in. A per-tenant user row cannot do
-- that; a shared row degrades gracefully to the single-tenant case.
--
-- Shape after this migration:
--   control.users   — the PERSON: email (globally unique), credentials, MFA,
--                     lockout counters. Not tenant-owned, so exempt from RLS
--                     by design — and therefore covered by its own explicit
--                     access tests instead (see test/control-identity.test.ts).
--   memberships     — the PERSON IN A TENANT: role, plant scope, per-tenant
--                     profile and status. Tenant-owned, RLS-forced, unchanged.
--   sessions        — stays TENANT-OWNED. Sign-in happens at a tenant
--                     subdomain and 07 §4 gives Enterprise tenants their own
--                     session policy (max length, idle timeout, IP allowlist),
--                     which a single global session could not honour.
--
-- The important part is not the move itself but what replaces the guarantee
-- it costs. While `users` was tenant-owned, RLS made it impossible to
-- reference a user from another tenant: the row was simply invisible. With a
-- shared table an FK to control.users(id) would accept ANY user id on earth,
-- leaving 03 §10 ("validate all referenced ids resolve within the tenant") as
-- application-layer discipline — i.e. one forgotten check away from a
-- cross-tenant assignment.
--
-- So every user reference in a tenant table becomes a COMPOSITE foreign key
-- (tenant_id, <col>) -> memberships (tenant_id, user_id). The tenant_id in the
-- key comes from the referencing row itself, so the constraint can only be
-- satisfied by a member of that same tenant. The guarantee moves from RLS to
-- the FK graph, stays in the database, and still does not depend on any
-- handler remembering to check.
-- ===========================================================================

-- --- 1. The person ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS control.users (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  email         citext NOT NULL UNIQUE,
  name          text NOT NULL,
  locale        text NOT NULL DEFAULT 'en',
  timezone      text NOT NULL DEFAULT 'UTC',

  -- Credentials. Global, because the password is global: a brute-force attempt
  -- against one tenant's login form is an attempt against the person's account
  -- everywhere, so the lockout counter must be global too (03 §2).
  password_hash text,
  mfa_secret    text,
  failed_login_attempts int NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  last_login_at timestamptz,

  -- Platform-level state. Per-TENANT status lives on memberships: being
  -- deactivated at one customer says nothing about the other.
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','disabled')),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS control_users_locked_idx
  ON control.users (locked_until) WHERE locked_until IS NOT NULL;

DROP TRIGGER IF EXISTS control_users_touch ON control.users;
CREATE TRIGGER control_users_touch BEFORE UPDATE ON control.users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- The API authenticates and manages profiles, so unlike control.tenants
-- (SELECT only) it needs write access here. It still cannot reach another
-- tenant's DATA through this table — control.users holds no tenant-owned rows.
GRANT SELECT, INSERT, UPDATE ON control.users TO kaenal_app;

-- --- 2. Carry existing people across ---------------------------------------
-- Deduplicates by email: the same address in two tenants collapses to one
-- person, which is the entire point of the migration. The surviving row keeps
-- the earliest id so that FK repointing below has a stable target.

INSERT INTO control.users (id, email, name, locale, timezone, password_hash,
                           mfa_secret, failed_login_attempts, locked_until,
                           last_login_at, created_at)
SELECT DISTINCT ON (u.email)
       u.id, u.email, u.name, u.locale, u.timezone, u.password_hash,
       u.mfa_secret, u.failed_login_attempts, u.locked_until,
       u.last_login_at, u.created_at
  FROM users u
 WHERE u.deleted_at IS NULL
 ORDER BY u.email, u.created_at, u.id
ON CONFLICT (email) DO NOTHING;

-- Map every old per-tenant user id onto the surviving person id, so tenant
-- rows pointing at a deduplicated duplicate are repointed rather than orphaned.
CREATE TEMP TABLE user_id_map ON COMMIT DROP AS
SELECT u.id AS old_id, cu.id AS new_id, u.tenant_id
  FROM users u
  JOIN control.users cu ON cu.email = u.email;

-- --- 3. Per-tenant profile moves onto memberships --------------------------

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'invited';
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_status_ck;
ALTER TABLE memberships ADD CONSTRAINT memberships_status_ck
  CHECK (status IN ('active','invited','deactivated'));

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE memberships m
   SET status = u.status,
       title = u.title,
       avatar_url = u.avatar_url,
       user_id = map.new_id
  FROM users u
  JOIN user_id_map map ON map.old_id = u.id
 WHERE m.user_id = u.id AND m.tenant_id = u.tenant_id;

-- --- 4. Repoint every user reference to the membership ---------------------
-- Driven off pg_constraint rather than a hand-written list: a column added to
-- 0001 after this migration was written would otherwise be silently skipped,
-- and a missed one is exactly the cross-tenant hole this is closing.

DO $$
DECLARE
  r record;
  fk_name text;
BEGIN
  FOR r IN
    SELECT con.conname,
           cl.relname  AS tbl,
           att.attname AS col
      FROM pg_constraint con
      JOIN pg_class cl      ON cl.oid = con.conrelid
      JOIN pg_class ref     ON ref.oid = con.confrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid
                           AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND ref.relname = 'users'
       AND ref.relnamespace = 'public'::regnamespace
       AND cl.relnamespace  = 'public'::regnamespace
       AND cl.relname <> 'memberships'   -- handled separately: it IS the target
       AND array_length(con.conkey, 1) = 1
  LOOP
    -- Repoint the data before the constraint, or the new FK cannot validate.
    EXECUTE format(
      'UPDATE %I t SET %I = map.new_id
         FROM user_id_map map
        WHERE t.%I = map.old_id AND t.tenant_id = map.tenant_id',
      r.tbl, r.col, r.col);

    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, r.conname);

    fk_name := left(r.tbl || '_' || r.col || '_member_fk', 63);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I
         FOREIGN KEY (tenant_id, %I) REFERENCES memberships (tenant_id, user_id)
         ON DELETE RESTRICT',
      r.tbl, fk_name, r.col);

    RAISE NOTICE 'repointed %.% -> memberships(tenant_id, user_id)', r.tbl, r.col;
  END LOOP;
END $$;

-- memberships itself points at the person.
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_id_fkey;
ALTER TABLE memberships
  ADD CONSTRAINT memberships_user_fk
  FOREIGN KEY (user_id) REFERENCES control.users (id) ON DELETE RESTRICT;

-- --- 5. Retire the tenant users table --------------------------------------

DROP TABLE IF EXISTS users;

-- --- 6. Invitations (03 §2) ------------------------------------------------
-- Tenant-owned: an invitation is an offer to join THIS tenant, and admins must
-- only ever see their own. The invited email may already exist in
-- control.users (07 §7) — accepting links the existing person to a new
-- membership rather than creating a second account.

CREATE TABLE IF NOT EXISTS invitations (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  email         citext NOT NULL,
  role          text NOT NULL
                  CHECK (role IN ('admin','manager','auditor','inspector','viewer')),
  plant_ids     uuid[] NOT NULL DEFAULT '{}',
  -- SHA-256 of the token. The token itself is shown once, at creation, and is
  -- never stored — a leaked backup must not yield working invite links.
  token_hash    text NOT NULL,
  expires_at    timestamptz NOT NULL,
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  invited_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);

CREATE INDEX IF NOT EXISTS invitations_tenant_email_idx ON invitations (tenant_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_uq ON invitations (tenant_id, token_hash);
-- Re-inviting regenerates and invalidates the old token (03 §2), so at most
-- one invitation per email may be outstanding.
CREATE UNIQUE INDEX IF NOT EXISTS invitations_pending_uq
  ON invitations (tenant_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE invitations
  ADD CONSTRAINT invitations_invited_by_member_fk
  FOREIGN KEY (tenant_id, invited_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

SELECT apply_tenant_rls('invitations');

-- --- 7. Password reset tokens (03 §2) --------------------------------------
-- Control-plane, because the credential it resets is control-plane. Single
-- use, 30 minute TTL — both enforced by the service, the columns are here so
-- the enforcement is auditable.

CREATE TABLE IF NOT EXISTS control.password_resets (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid NOT NULL REFERENCES control.users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS control_password_resets_user_idx
  ON control.password_resets (user_id);

GRANT SELECT, INSERT, UPDATE ON control.password_resets TO kaenal_app;
