-- ===========================================================================
-- 0076_plan_requests_settings — Sprint 07 P6/P7/P9/O1. SPRINT-07-entitlements-
-- onboarding.md §3.1, P6 AC1, O1 AC2, P9 AC3, P7 AC1, X1 AC... (outbox audience).
--
-- Four independent, small widenings bundled in one migration because they all
-- land in wave B alongside the sales hand-off:
--   1. `plan_requests` — the member->admin / admin->sales request table.
--   2. `tenant_settings` namespace CHECK widened to `profile`, `onboarding`,
--      `billing` (O1/P9), with the `onboarding` backfill for existing
--      tenants (no forced first-run, rule 12 — protects the demo sign-in).
--   3. `exports.resource` CHECK widened for `plan_quote` (P7).
--   4. `outbox.audience` (AR22) — internal, ids-only events
--      (`plan_request.changed`, `tenant_commercial.changed`) are a SEPARATE
--      audience from the customer-webhook channel, so a wildcard webhook
--      subscription can never receive one.
-- ===========================================================================

-- --- 1. `plan_requests` -------------------------------------------------------

CREATE TABLE IF NOT EXISTS plan_requests (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id          uuid NOT NULL,
  kind               text NOT NULL
                       CHECK (kind IN ('member_access', 'add_pack', 'remove_pack', 'apply_bundle',
                                       'enterprise_inquiry', 'contact_sales', 'confirm_subscription')),
  pack_id            text
                       CHECK (pack_id IS NULL OR pack_id IN
                              ('intelligence', 'supplier', 'qe', 'platform', 'security',
                               'multiplant', 'mobile', 'standards', 'support')),
  tier               text CHECK (tier IS NULL OR tier IN ('core', 'pro', 'ent')),
  -- Snapshot of effective packs + estimate at request time (P6 UC).
  composition        jsonb NOT NULL DEFAULT '{}'::jsonb,
  note               text CHECK (note IS NULL OR char_length(note) <= 1000),
  status             text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'fulfilled', 'declined', 'withdrawn')),
  requested_by       uuid NOT NULL,
  resolved_at        timestamptz,
  resolution_note    text,
  linked_request_id  uuid,
  lock_version       int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_by         uuid,
  UNIQUE (tenant_id, id)
);

-- At most one OPEN request per (requester, kind, pack/tier) — re-requesting
-- returns the existing row instead of creating a duplicate (P6 UC dedupe).
CREATE UNIQUE INDEX IF NOT EXISTS plan_requests_open_uq
  ON plan_requests (tenant_id, requested_by, kind, coalesce(pack_id, ''), coalesce(tier, ''))
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS plan_requests_tenant_status_idx
  ON plan_requests (tenant_id, status, created_at DESC);

ALTER TABLE plan_requests ADD CONSTRAINT plan_requests_requested_by_member_fk
  FOREIGN KEY (tenant_id, requested_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE plan_requests ADD CONSTRAINT plan_requests_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE plan_requests ADD CONSTRAINT plan_requests_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- Self composite FK (member -> sales forwarding): a linked request must be
-- another plan_requests row of the SAME tenant.
ALTER TABLE plan_requests ADD CONSTRAINT plan_requests_linked_request_fk
  FOREIGN KEY (tenant_id, linked_request_id) REFERENCES plan_requests (tenant_id, id)
  ON DELETE RESTRICT;

DROP TRIGGER IF EXISTS plan_requests_bump_lock_version ON plan_requests;
CREATE TRIGGER plan_requests_bump_lock_version BEFORE UPDATE ON plan_requests
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

SELECT apply_tenant_rls('plan_requests');

-- --- 2. `tenant_settings` namespaces ------------------------------------------

ALTER TABLE tenant_settings DROP CONSTRAINT IF EXISTS tenant_settings_namespace_check;
ALTER TABLE tenant_settings ADD CONSTRAINT tenant_settings_namespace_check
  CHECK (namespace IN ('branding', 'session', 'chargeback', 'profile', 'onboarding', 'billing'));

-- O1 AC4: every existing tenant gets onboarding `dismissed` (no forced
-- first-run for a tenant that already exists, including the demo — rule 12)
-- and an empty profile document. New tenants default to `not_started`
-- (the application's own default on first read; nothing to backfill there).
INSERT INTO tenant_settings (tenant_id, namespace, doc)
SELECT DISTINCT m.tenant_id, 'onboarding',
       jsonb_build_object('status', 'dismissed', 'startedAt', NULL, 'completedAt', NULL,
                           'dismissedAt', now(), 'ownerId', NULL)
FROM memberships m
ON CONFLICT (tenant_id, namespace) DO NOTHING;

INSERT INTO tenant_settings (tenant_id, namespace, doc)
SELECT DISTINCT m.tenant_id, 'profile', '{}'::jsonb
FROM memberships m
ON CONFLICT (tenant_id, namespace) DO NOTHING;

-- --- 3. `exports.resource` widening (P7) --------------------------------------

ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_resource_check;
ALTER TABLE exports ADD CONSTRAINT exports_resource_check
  CHECK (resource IN ('ncrs', 'inspections', 'capas', 'audits', 'ai_reply', 'audit_report',
                       'predictive_forecast_pack', 'risk_board_pack', 'gauge_rr_aiag_report',
                       'calibration_audit_pack', 'skill_gap_report', 'plan_quote'));

-- `plan_quote` cites the price-book version it was priced from (P7 AC4), so a
-- regenerated quote after a republish stays attributable to its own numbers.
ALTER TABLE exports ADD COLUMN IF NOT EXISTS price_book_version_id uuid;

-- --- 4. `outbox.audience` (AR22) ----------------------------------------------
-- The customer-webhook channel is `webhook` (the existing, unchanged
-- behaviour: default + backfill). `internal` rows (`plan_request.changed`,
-- `tenant_commercial.changed`) carry an ids-only payload and are never
-- delivered to a customer endpoint — the webhook handler skips them outright
-- (application-layer; this column is what it switches on) and 07C's drainer
-- routes them to the internal-projection handler instead (SD11).

ALTER TABLE outbox ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'webhook'
  CHECK (audience IN ('webhook', 'internal'));

CREATE INDEX IF NOT EXISTS outbox_tenant_audience_idx
  ON outbox (tenant_id, audience, status, available_at);
