-- ===========================================================================
-- 0079_support_access — Sprint 07C C3/C10 (Shared foundation; the security-
-- critical core of the staff console). SPRINT-07C-staff-console.md §3
-- SD5-SD7 + the AM3/AR/AR2/AR3/AR4 reconciliation, §3.1, C3 AC2-AC4, C10
-- AC1-AC2a.
--
-- This migration redefines `apply_tenant_rls()` (0000_foundation.sql) so
-- that, in addition to the existing `tenant_isolation` policy, EVERY tenant
-- table it is applied to — past and future — also carries two new
-- RESTRICTIVE policies, one per support role:
--   support_reader_grant_active    TO kaenal_support_reader  (scope `content`)
--   support_commercial_grant_active TO kaenal_support        (scope `commercial`)
-- EXCEPT `audit_events`, which never gets the generic commercial policy
-- (RESTRICTIVE policies AND together, so a second one can never "supersede" a
-- first one that already blocks a statement) and instead gets two dedicated,
-- command-scoped policies defined at the bottom of this file.
--
-- Both policies are backed by ONE function, `support_content_grant_active
-- (expected_scope)`, which re-derives validity from the PERSISTED grant row
-- on every statement (via an uncorrelated subquery -> a Postgres InitPlan,
-- evaluated once per statement, not once per row) — never from a value an
-- apphandler computed and could get wrong. This is the DB-level backstop:
-- even if the application check (`SupportAccess`/`SupportViewAuthenticator`)
-- is buggy or bypassed, an expired, ended, or wrong-tenant/wrong-scope grant
-- reads/writes NOTHING, because `kaenal_support`/`kaenal_support_reader` have
-- no privilege the RESTRICTIVE policies don't additionally gate.
--
-- Three new DB roles, all NOLOGIN (AR29 — see 0078's header for why):
--   kaenal_support         — commercial scope, used by the platform API only.
--   kaenal_support_reader  — content scope (support view), tenant API only.
--   kaenal_support_gate    — the tenant API's narrow read of grants/sessions/
--                             platform-user status for the support-view
--                             hand-off; never touches tenant business data.
-- ===========================================================================

-- --- 1. Shared/dedicated marker ----------------------------------------------
-- One migration, run identically everywhere by `migrate-tenants`; the
-- backstop function's single body branches on this row to decide whether it
-- checks `control.support_grants` directly (primary) or the local
-- `control.support_grant_backstop` mirror (dedicated) — Postgres cannot join
-- across physical databases.

CREATE TABLE IF NOT EXISTS control.database_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  kind      text NOT NULL DEFAULT 'primary' CHECK (kind IN ('primary', 'dedicated'))
);
INSERT INTO control.database_identity (singleton, kind) VALUES (true, 'primary')
  ON CONFLICT DO NOTHING;

GRANT SELECT ON control.database_identity TO kaenal_platform;

-- Roles are created HERE, before anything below names them in a CREATE
-- POLICY — including the redefined apply_tenant_rls() and its retroactive
-- loop over every existing tenant table. All three are NOLOGIN (AR29): LOGIN
-- and a real credential are set outside migrations by provisioning/ops, never
-- baked into a migration that `migrate-tenants` replicates everywhere.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaenal_support') THEN
    CREATE ROLE kaenal_support NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaenal_support_reader') THEN
    CREATE ROLE kaenal_support_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaenal_support_gate') THEN
    CREATE ROLE kaenal_support_gate NOLOGIN;
  END IF;
END
$$;

-- --- 2. Role -> scope matrix, as data (mirrors packages/core's matrix; a
-- drift test asserts the two agree, AR15) -------------------------------------

CREATE OR REPLACE FUNCTION control.platform_scope_roles(scope text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE scope
    WHEN 'content'    THEN ARRAY['platform_support', 'platform_admin']
    WHEN 'commercial' THEN ARRAY['platform_support', 'platform_sales', 'platform_admin']
    ELSE ARRAY[]::text[]
  END;
$$;

-- --- 3. Support grants (control plane) ---------------------------------------

CREATE TABLE IF NOT EXISTS control.support_grants (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  platform_user_id  uuid NOT NULL REFERENCES control.platform_users (id),
  tenant_id         uuid NOT NULL REFERENCES control.tenants (id),
  reason            text NOT NULL CHECK (char_length(reason) >= 10),
  reference         text CHECK (reference IS NULL OR char_length(reference) <= 120),
  scope             text NOT NULL CHECK (scope IN ('commercial', 'content')),
  -- A content grant exposes every tenant record, so it always needs a
  -- traceable ticket/incident reference (§3 SD7).
  CONSTRAINT support_grants_content_reference_ck CHECK (scope <> 'content' OR reference IS NOT NULL),
  granted_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  CONSTRAINT support_grants_expiry_ck CHECK (expires_at = granted_at + interval '4 hours'),
  ended_at          timestamptz,
  end_reason        text CHECK (end_reason IS NULL OR end_reason IN
                               ('ended_by_user', 'expired', 'user_deactivated', 'role_changed',
                                'activation_failed')),
  idempotency_key   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Backs the composite FK from the two support-view tables below (AR14): a
  -- support-view session/exchange-token can reference only a CONTENT-scope
  -- grant, which a plain FK on `id` alone cannot express.
  UNIQUE (id, scope)
);

CREATE INDEX IF NOT EXISTS support_grants_tenant_idx ON control.support_grants (tenant_id);
CREATE INDEX IF NOT EXISTS support_grants_platform_user_idx
  ON control.support_grants (platform_user_id, scope) WHERE ended_at IS NULL;

-- --- 4. Dedicated-database mirror (used only where control.database_identity
-- reports 'dedicated' — Postgres cannot join across physical databases) ------

CREATE TABLE IF NOT EXISTS control.support_grant_backstop (
  grant_id          uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL,
  platform_user_id  uuid NOT NULL,
  scope             text NOT NULL CHECK (scope IN ('commercial', 'content')),
  expires_at        timestamptz NOT NULL,
  ended_at          timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- --- 5. Platform audit log (append-only; SD5's intent/outcome shape) --------

CREATE TABLE IF NOT EXISTS control.platform_audit_events (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  platform_user_id  uuid REFERENCES control.platform_users (id),
  actor_label       text,
  action            text NOT NULL,
  tenant_id         uuid REFERENCES control.tenants (id),
  grant_id          uuid,
  target_kind       text,
  target_id         text,
  before            jsonb,
  after             jsonb,
  reason            text,
  request_id        uuid,
  ip                inet,
  user_agent        text,
  -- SD5: a mutation is never "updated to ok/failed" (the table is
  -- append-only, trigger below) — it is always TWO appended rows: an
  -- `intent` (before the tenant-side transaction runs) and an `outcome`
  -- (after it commits or fails), or a `single` row for anything with no
  -- tenant side at all.
  phase             text NOT NULL DEFAULT 'single' CHECK (phase IN ('single', 'intent', 'outcome')),
  intent_id         uuid REFERENCES control.platform_audit_events (id),
  outcome           text CHECK (outcome IS NULL OR outcome IN ('ok', 'failed')),
  CONSTRAINT platform_audit_events_intent_id_ck
    CHECK ((phase = 'outcome') = (intent_id IS NOT NULL)),
  CONSTRAINT platform_audit_events_outcome_ck
    CHECK ((phase = 'intent') = (outcome IS NULL)),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_events_tenant_idx
  ON control.platform_audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_user_idx
  ON control.platform_audit_events (platform_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_intent_idx
  ON control.platform_audit_events (intent_id) WHERE intent_id IS NOT NULL;

-- Append-only: even the owner (kaenal_platform) cannot UPDATE/DELETE, the
-- same two-net discipline as the tenant `audit_events` table.
REVOKE UPDATE, DELETE ON control.platform_audit_events FROM kaenal_platform;
DROP TRIGGER IF EXISTS platform_audit_events_immutable ON control.platform_audit_events;
CREATE TRIGGER platform_audit_events_immutable
  BEFORE UPDATE OR DELETE ON control.platform_audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

GRANT SELECT, INSERT ON control.support_grants TO kaenal_platform;
GRANT SELECT, INSERT ON control.platform_audit_events TO kaenal_platform;
GRANT SELECT, UPDATE (ended_at) ON control.support_grant_backstop TO kaenal_platform;
GRANT INSERT ON control.support_grant_backstop TO kaenal_platform;

-- --- 6. Support-view sessions / exchange tokens (C10 AC1, content scope) ----

CREATE TABLE IF NOT EXISTS control.support_view_sessions (
  token_hash   text UNIQUE NOT NULL,
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  grant_id     uuid NOT NULL,
  grant_scope  text NOT NULL DEFAULT 'content' CHECK (grant_scope = 'content'),
  CONSTRAINT support_view_sessions_grant_fk
    FOREIGN KEY (grant_id, grant_scope) REFERENCES control.support_grants (id, scope),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  ip           inet,
  user_agent   text
);

CREATE INDEX IF NOT EXISTS support_view_sessions_grant_idx ON control.support_view_sessions (grant_id);

CREATE TABLE IF NOT EXISTS control.support_view_exchange_tokens (
  token_hash   text PRIMARY KEY,
  grant_id     uuid NOT NULL,
  grant_scope  text NOT NULL DEFAULT 'content' CHECK (grant_scope = 'content'),
  CONSTRAINT support_view_exchange_tokens_grant_fk
    FOREIGN KEY (grant_id, grant_scope) REFERENCES control.support_grants (id, scope),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Neither is ever readable by the tenant-facing or public roles — the tenant
-- API validates them only through the narrow `kaenal_support_gate` role below.
REVOKE ALL ON control.support_view_sessions FROM kaenal_app, kaenal_public;
REVOKE ALL ON control.support_view_exchange_tokens FROM kaenal_app, kaenal_public;

-- ===========================================================================
-- 7. The DB-level backstop: ONE function backing TWO RESTRICTIVE policies.
-- ===========================================================================

CREATE OR REPLACE FUNCTION support_content_grant_active(expected_scope text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, control
AS $$
DECLARE
  v_grant_id   uuid;
  v_tenant_id  uuid;
  db_kind      text;
  is_active    boolean;
BEGIN
  -- Two-argument, non-throwing form wrapped in NULLIF: a connection reused
  -- from a pool can read back '' rather than throwing, and NULLIF turns that
  -- into NULL, which the checks below then reject the same way they reject a
  -- genuinely unset variable.
  v_grant_id  := NULLIF(current_setting('app.grant_id', true), '')::uuid;
  v_tenant_id := NULLIF(current_setting('app.tenant_id', true), '')::uuid;

  IF v_grant_id IS NULL OR v_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT kind INTO db_kind FROM control.database_identity LIMIT 1;

  IF db_kind = 'dedicated' THEN
    SELECT EXISTS (
      SELECT 1
      FROM control.support_grant_backstop b
      WHERE b.grant_id = v_grant_id
        AND b.tenant_id = v_tenant_id
        AND b.scope = expected_scope
        AND b.ended_at IS NULL
        AND clock_timestamp() < b.expires_at
    ) INTO is_active;
    RETURN coalesce(is_active, false);
  END IF;

  -- Primary database: check the real grant row AND the platform user's
  -- CURRENT status/role (never a value cached at grant-creation or sign-in
  -- time, AR15) — a demotion or deactivation mid-session is effective on the
  -- very next statement.
  SELECT EXISTS (
    SELECT 1
    FROM control.support_grants g
    JOIN control.platform_users u ON u.id = g.platform_user_id
    WHERE g.id = v_grant_id
      AND g.tenant_id = v_tenant_id
      AND g.scope = expected_scope
      AND g.ended_at IS NULL
      AND clock_timestamp() < g.expires_at
      AND u.status = 'active'
      AND u.role = ANY (control.platform_scope_roles(expected_scope))
  ) INTO is_active;
  RETURN coalesce(is_active, false);
END;
$$;

REVOKE ALL ON FUNCTION support_content_grant_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION support_content_grant_active(text) TO kaenal_support, kaenal_support_reader;

-- ===========================================================================
-- 8. Redefine apply_tenant_rls() — every tenant table it is (re-)applied to,
-- past and future, gets the two RESTRICTIVE policies automatically.
-- ===========================================================================

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

  -- [0079] Support-role RESTRICTIVE backstop (§3 SD7/SR1, C10 AC2a). ANDed
  -- with tenant_isolation above (RESTRICTIVE policies AND together), so a row
  -- is visible/writable to a support role only under BOTH a matching tenant
  -- AND a persisted, live grant of the right scope — independent of any
  -- application-layer check.
  EXECUTE format('DROP POLICY IF EXISTS support_reader_grant_active ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY support_reader_grant_active ON %s
       AS RESTRICTIVE FOR ALL TO kaenal_support_reader
       USING ((SELECT support_content_grant_active(''content'')))
       WITH CHECK ((SELECT support_content_grant_active(''content'')))', tbl);

  -- audit_events is the one named exception: it carries two dedicated,
  -- command-scoped policies instead (created separately, below, outside this
  -- function) because the generic FOR-ALL policy would refuse the one
  -- content-grant transparency-row INSERT it must admit (C3 AC3/AC6).
  IF tname <> 'audit_events' THEN
    EXECUTE format('DROP POLICY IF EXISTS support_commercial_grant_active ON %s', tbl);
    EXECUTE format(
      'CREATE POLICY support_commercial_grant_active ON %s
         AS RESTRICTIVE FOR ALL TO kaenal_support
         USING ((SELECT support_content_grant_active(''commercial'')))
         WITH CHECK ((SELECT support_content_grant_active(''commercial'')))', tbl);
  END IF;

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

-- Retroactively apply the redefined function to every table that already
-- carries tenant_isolation — schema-driven (every `pg_policy` row named
-- tenant_isolation in `public`), so nothing is forgotten by a hand list.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT DISTINCT c.oid::regclass AS tbl
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'tenant_isolation' AND n.nspname = 'public'
  LOOP
    PERFORM apply_tenant_rls(t.tbl);
  END LOOP;
END
$$;

-- apply_tenant_rls()'s generic final GRANT re-added UPDATE/DELETE on
-- audit_events to kaenal_app for every table it just re-processed (including
-- audit_events itself, since it already carried tenant_isolation). Restore
-- the append-only invariant 0001_core.sql established (the two independent
-- nets: privilege absence here, the reject_mutation() trigger regardless).
REVOKE UPDATE, DELETE ON audit_events FROM kaenal_app;

-- ===========================================================================
-- 9. audit_events — dedicated policies (replace the generic commercial
-- policy on this one table, C3 AC3/AC6, AR3 D1a/D1b).
-- ===========================================================================

-- Read: only the 7 commercial entity kinds, and only under a LIVE commercial
-- grant (AR3 D1b — the entity-kind filter alone is not a liveness check: an
-- expired grant, or a platform user holding only a content grant, must not
-- be able to read these rows even if SupportAccess's application check were
-- bypassed).
DROP POLICY IF EXISTS support_commercial_audit_scope ON audit_events;
CREATE POLICY support_commercial_audit_scope ON audit_events
  AS RESTRICTIVE FOR SELECT TO kaenal_support
  USING (
    entity_kind IN ('entitlement', 'entitlement_trial', 'plan_request', 'support_grant',
                     'workspace_profile', 'onboarding_state', 'billing_settings')
    AND (SELECT support_content_grant_active('commercial'))
  );

-- Write: a live commercial grant may write anything (its normal commercial
-- audit rows), OR — by name, and only this one case — a content grant's own
-- "opened read-only access" transparency row (C3 AC6's recordGrantStart).
DROP POLICY IF EXISTS support_audit_write_scope ON audit_events;
CREATE POLICY support_audit_write_scope ON audit_events
  AS RESTRICTIVE FOR INSERT TO kaenal_support
  WITH CHECK (
    (SELECT support_content_grant_active('commercial'))
    OR (
      action = 'support_accessed'
      AND entity_kind = 'support_grant'
      AND entity_id = NULLIF(current_setting('app.grant_id', true), '')::uuid
      AND (SELECT support_content_grant_active('content'))
    )
  );

-- Column-level: kaenal_support may read every audit_events column except the
-- two that carry network/client identifiers (AR13).
GRANT SELECT (id, tenant_id, actor_id, actor_kind, entity_kind, entity_id, action,
              before, after, reason, request_id, created_at)
  ON audit_events TO kaenal_support;
GRANT INSERT ON audit_events TO kaenal_support;

-- The reader's content-scope SELECT on audit_events (its own "viewed record"
-- trail, and reading the tenant's audit log read-only) is unaffected by the
-- exception above — it is granted by the generic reader loop (step 8) plus
-- the plain table grant below.
GRANT SELECT ON audit_events TO kaenal_support_reader;
GRANT INSERT ON audit_events TO kaenal_support_reader;

-- DB-proves attribution: every row a support role inserts must be stamped
-- `actor_kind='support'` with the reason the active grant opened under (C3
-- AC4), and a kaenal_support_reader row may only ever be `support_accessed`
-- (C10 AC2 — the reader's only write is its own "viewed" trail).
CREATE OR REPLACE FUNCTION enforce_support_audit_attribution() RETURNS trigger AS $$
BEGIN
  IF current_user IN ('kaenal_support', 'kaenal_support_reader') THEN
    IF NEW.actor_kind <> 'support' THEN
      RAISE EXCEPTION 'support-role audit rows must have actor_kind = support'
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.reason IS NULL OR NEW.reason <> current_setting('app.support_reason', true) THEN
      RAISE EXCEPTION 'support-role audit rows must carry the active support reason'
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF current_user = 'kaenal_support_reader' AND NEW.action <> 'support_accessed' THEN
      RAISE EXCEPTION 'kaenal_support_reader may only write support_accessed audit rows'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_support_attribution ON audit_events;
CREATE TRIGGER audit_events_support_attribution BEFORE INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION enforce_support_audit_attribution();

-- ===========================================================================
-- 10. Role kaenal_support (commercial scope; platform API process only).
-- Role already created above (before the policy-creating sections); this is
-- its grant list.
-- ===========================================================================

GRANT USAGE ON SCHEMA public TO kaenal_support;
GRANT USAGE ON SCHEMA control TO kaenal_support;

GRANT SELECT, INSERT, UPDATE ON entitlements TO kaenal_support;
GRANT SELECT, DELETE ON entitlement_trials TO kaenal_support;

-- A trial reset (07C C5 AC6) may only ever remove an ENDED trial — never one
-- still running.
CREATE OR REPLACE FUNCTION reject_unexpired_trial_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.ends_at > now() THEN
    RAISE EXCEPTION 'cannot delete an entitlement_trials row before it has ended'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entitlement_trials_reject_unexpired_delete ON entitlement_trials;
CREATE TRIGGER entitlement_trials_reject_unexpired_delete
  BEFORE DELETE ON entitlement_trials
  FOR EACH ROW EXECUTE FUNCTION reject_unexpired_trial_delete();

GRANT SELECT, UPDATE (status, resolved_at, resolution_note, lock_version) ON plan_requests TO kaenal_support;

GRANT SELECT ON tenant_settings TO kaenal_support;
DROP POLICY IF EXISTS support_tenant_settings_namespace_scope ON tenant_settings;
CREATE POLICY support_tenant_settings_namespace_scope ON tenant_settings
  AS RESTRICTIVE FOR ALL TO kaenal_support
  USING (namespace IN ('profile', 'onboarding', 'billing'));

-- Counts only — never a name, email or content column (commercial scope must
-- never see QMS or member identity content).
GRANT SELECT (tenant_id, user_id, role, status) ON memberships TO kaenal_support;
-- plants has no status column; deleted_at IS NULL is its "active" signal.
GRANT SELECT (tenant_id, id, deleted_at) ON plants TO kaenal_support;
GRANT SELECT (tenant_id, id, status) ON suppliers TO kaenal_support;

-- Per-module "open record" counts for the downgrade-impact endpoint (Sprint
-- 07 P4 AC5's named examples) — column-scoped, never title/description/
-- content. FMEA, SPC and the portal are deliberately excluded (no
-- status/stage column at all, PO decision R2b).
GRANT SELECT (tenant_id, id, status) ON risks TO kaenal_support;
GRANT SELECT (tenant_id, id, stage) ON ecns TO kaenal_support;
GRANT SELECT (tenant_id, id, status) ON msa_studies TO kaenal_support;
GRANT SELECT (tenant_id, id, status) ON scars TO kaenal_support;
GRANT SELECT (tenant_id, id, status) ON ppap_submissions TO kaenal_support;

-- notifications: INSERT plus a column-scoped SELECT(id) ONLY — notify()'s
-- `INSERT ... RETURNING id` needs SELECT on the returned column, but a bare
-- row SELECT would expose notification bodies, which can carry real QMS
-- content. notifyMinimal() (application layer) is the only writer this role
-- is meant to use.
GRANT INSERT ON notifications TO kaenal_support;
GRANT SELECT (id) ON notifications TO kaenal_support;
GRANT SELECT ON notification_prefs TO kaenal_support;

GRANT INSERT ON outbox TO kaenal_support;

-- Dedicated-tenant mirror: inserted as part of grant activation (step 2,
-- C3 AC6), ended_at updated by the async end-propagation job. Unused, but
-- still granted, on the primary (a dedicated-only table in practice).
GRANT SELECT, INSERT, UPDATE (ended_at) ON control.support_grant_backstop TO kaenal_support;

-- ===========================================================================
-- 11. Role kaenal_support_reader (content scope / support view; tenant API
-- process only). SELECT on every tenant table except the finalized denylist
-- (§3.4 R4); INSERT on audit_events only (already granted above). Role
-- already created above.
-- ===========================================================================

GRANT USAGE ON SCHEMA public TO kaenal_support_reader;

DO $$
DECLARE
  t record;
  -- §3.4 R4's finalized table-level denylist.
  denylist text[] := ARRAY['sessions', 'api_keys', 'webhook_endpoints', 'integrations',
                            'integration_events', 'outbox', 'exports', 'notifications',
                            'notification_prefs', 'user_preferences', 'device_sync_status'];
  cols text;
BEGIN
  FOR t IN
    SELECT DISTINCT c.relname AS tname
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'tenant_isolation' AND n.nspname = 'public'
  LOOP
    IF t.tname = ANY (denylist) THEN
      CONTINUE;
    ELSIF t.tname = 'invitations' THEN
      -- Column-level exclusion: a live invitation link is a bearer
      -- credential (token_hash); the invitation's existence, recipient and
      -- status are ordinary workspace content (§3.4 R4).
      SELECT string_agg(quote_ident(column_name), ', ') INTO cols
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invitations'
        AND column_name <> 'token_hash';
      EXECUTE format('GRANT SELECT (%s) ON invitations TO kaenal_support_reader', cols);
    ELSIF t.tname = 'audit_events' THEN
      -- Already granted a full-row SELECT above (audit_events carries no
      -- reader-side secret column — its own dedicated policies govern
      -- kaenal_support, not kaenal_support_reader).
      CONTINUE;
    ELSE
      EXECUTE format('GRANT SELECT ON %I TO kaenal_support_reader', t.tname);
    END IF;
  END LOOP;
END
$$;

-- ===========================================================================
-- 12. Role kaenal_support_gate (tenant API process; the narrow hand-off read
-- for the support-view exchange — never a tenant table, never a platform-
-- user credential column, C10 AC1). Role already created above.
-- ===========================================================================

GRANT USAGE ON SCHEMA control TO kaenal_support_gate;

GRANT SELECT ON control.support_grants TO kaenal_support_gate;
GRANT SELECT, INSERT, UPDATE (revoked_at) ON control.support_view_sessions TO kaenal_support_gate;
GRANT SELECT, UPDATE (used_at) ON control.support_view_exchange_tokens TO kaenal_support_gate;
GRANT SELECT (id, status, role) ON control.platform_users TO kaenal_support_gate;
GRANT INSERT ON control.platform_audit_events TO kaenal_support_gate;
