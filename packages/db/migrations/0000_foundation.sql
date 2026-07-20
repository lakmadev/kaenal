-- ===========================================================================
-- 0000_foundation — extensions, roles, control plane, RLS helper machinery.
--
-- Implements 01 §3.2 (tenant registry) and 02 §1 (roles & RLS foundation).
-- Idempotent: safe to re-run (02 §5).
-- ===========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_bytes for uuidv7()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email

-- ---------------------------------------------------------------------------
-- uuidv7(): time-ordered primary keys (01 §4).
--
-- Postgres 16 has no built-in uuidv7() — that arrives in PG18. This is a
-- spec-compliant (RFC 9562) implementation: 48-bit big-endian Unix epoch
-- milliseconds, 4-bit version 7, 2-bit variant 0b10, remainder random.
-- Time-ordering is what makes keyset pagination on (created_at, id) stable
-- and keeps B-tree inserts appending rather than fragmenting.
--
-- When the platform moves to PG18, drop this and the built-in takes over
-- with identical semantics.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid AS $$
DECLARE
  ts_ms bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  b bytea := gen_random_bytes(16);
BEGIN
  b := set_byte(b, 0, ((ts_ms >> 40) & 255)::int);
  b := set_byte(b, 1, ((ts_ms >> 32) & 255)::int);
  b := set_byte(b, 2, ((ts_ms >> 24) & 255)::int);
  b := set_byte(b, 3, ((ts_ms >> 16) & 255)::int);
  b := set_byte(b, 4, ((ts_ms >>  8) & 255)::int);
  b := set_byte(b, 5, ( ts_ms        & 255)::int);
  b := set_byte(b, 6, ((get_byte(b, 6) & 15) | 112));   -- version 7
  b := set_byte(b, 8, ((get_byte(b, 8) & 63) | 128));   -- variant 0b10
  RETURN encode(b, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ---------------------------------------------------------------------------
-- Roles (02 §1). Passwords are for local docker only; cloud uses IAM/secrets.
--   kaenal_migrator — owner, runs migrations. (The docker superuser.)
--   kaenal_app      — the API. NOT owner, NOT BYPASSRLS. RLS always applies.
--   kaenal_public   — unauthenticated routes. No tenant table access at all.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaenal_app') THEN
    CREATE ROLE kaenal_app LOGIN PASSWORD 'kaenal_local_pw';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaenal_public') THEN
    CREATE ROLE kaenal_public LOGIN PASSWORD 'kaenal_local_pw';
  END IF;
END
$$;

-- Neither app role may create objects in public; migrator owns everything.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO kaenal_app, kaenal_public;

-- ---------------------------------------------------------------------------
-- Control plane (01 §3.2) — the ONLY mapping from tenant to connection.
-- Not tenant-owned, so it is exempt from the RLS lint by design.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS control;
GRANT USAGE ON SCHEMA control TO kaenal_app;

CREATE TABLE IF NOT EXISTS control.tenants (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  slug                     text NOT NULL UNIQUE
                             CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name                     text NOT NULL,
  model                    text NOT NULL CHECK (model IN ('shared','dedicated')),
  database_url_secret_ref  text,
  region                   text NOT NULL DEFAULT 'us-east-1',
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','suspended','offboarding','provisioning_failed')),
  timezone                 text NOT NULL DEFAULT 'UTC',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Model B tenants must carry a connection ref; Model A must not.
ALTER TABLE control.tenants DROP CONSTRAINT IF EXISTS tenants_model_connection_ck;
ALTER TABLE control.tenants ADD CONSTRAINT tenants_model_connection_ck CHECK (
  (model = 'shared'    AND database_url_secret_ref IS NULL) OR
  (model = 'dedicated' AND database_url_secret_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS tenants_status_idx ON control.tenants (status);

-- The API reads the registry to resolve subdomain → tenant; it never writes it
-- (provisioning runs as the migrator role).
GRANT SELECT ON control.tenants TO kaenal_app;

-- ---------------------------------------------------------------------------
-- RLS machinery.
-- ---------------------------------------------------------------------------

-- Reads the tenant scope for the current transaction. Deliberately uses the
-- single-argument form of current_setting(), which THROWS when unset (02 §1):
-- a query that escaped its tenant-scoped transaction must fail loudly rather
-- than quietly returning nothing (or, worse, everything).
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT current_setting('app.tenant_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Defence in depth: the app always sets tenant_id explicitly, but if a code
-- path forgets, this fills it from the transaction scope rather than letting
-- a NOT NULL violation surface as a confusing 500.
CREATE OR REPLACE FUNCTION set_tenant_id() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Keeps updated_at honest without the app having to remember.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Blocks UPDATE/DELETE outright — used to make audit_events append-only (02 §3).
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- apply_tenant_rls(table) — the canonical pattern from 02 §1, applied through
-- one function so no table can drift from it or be forgotten. Every tenant
-- table calls this in the SAME migration that creates it (02 §5).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_tenant_rls(tbl regclass) RETURNS void AS $$
DECLARE
  tname text;
  has_updated_at boolean;
BEGIN
  SELECT relname INTO tname FROM pg_class WHERE oid = tbl;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);

  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s
       USING (tenant_id = current_setting(''app.tenant_id'')::uuid)
       WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::uuid)', tbl);

  EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', 'set_tenant_id_' || tname, tbl);
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT ON %s FOR EACH ROW EXECUTE FUNCTION set_tenant_id()',
    'set_tenant_id_' || tname, tbl);

  SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = tbl AND attname = 'updated_at' AND NOT attisdropped
  ) INTO has_updated_at;

  IF has_updated_at THEN
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', 'touch_' || tname, tbl);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      'touch_' || tname, tbl);
  END IF;

  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO kaenal_app', tbl);
END;
$$ LANGUAGE plpgsql;
