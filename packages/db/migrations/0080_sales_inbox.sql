-- ===========================================================================
-- 0080_sales_inbox — Sprint 07C C6/C7/C8 (control-plane projections + the
-- platform role's catalog/price-book/commercial write grants).
-- SPRINT-07C-staff-console.md §3 SD11, §3.1, C6 AC1, C4 AC2, C7 AC2, C8.
--
-- Two eventually-consistent projections, written ONLY by the worker's
-- `InternalProjectionHandler` (SD11) through a new, narrow `kaenal_projector`
-- role — never by `kaenal_app` (the drainer runs as kaenal_app inside a
-- TENANT transaction and cannot touch `control.*` at all) and never by
-- `kaenal_platform` (read-only here; it lists tenants, it does not maintain
-- the projection that backs the list).
--   control.sales_inbox              — plan-request rows, upserted from the
--                                       ids-only internal outbox event
--                                       `plan_request.changed` (Sprint 07
--                                       P6 AC6).
--   control.tenant_commercial_summary — tier / declared frameworks / active
--                                       packs per tenant, upserted from
--                                       `tenant_commercial.changed` (Sprint
--                                       07 X1 AC8). Read by the directory
--                                       list (C4 AC2) and the catalog-edit
--                                       impact preview (C7 AC1/AC3) with NO
--                                       grant and NO tenant-database read.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS control.sales_inbox (
  tenant_id        uuid NOT NULL REFERENCES control.tenants (id),
  request_id       uuid NOT NULL,
  kind             text NOT NULL,
  status           text NOT NULL,
  pack_id          text,
  tier             text,
  note             text,
  requester_name   text,
  requester_email  citext,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, request_id)
);

CREATE INDEX IF NOT EXISTS sales_inbox_status_idx ON control.sales_inbox (status, created_at DESC);

CREATE TABLE IF NOT EXISTS control.tenant_commercial_summary (
  tenant_id            uuid PRIMARY KEY REFERENCES control.tenants (id),
  tier                 text,
  declared_frameworks  text[] NOT NULL DEFAULT '{}',
  effective_packs      text[] NOT NULL DEFAULT '{}',
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- --- Role: kaenal_projector (worker process only; writes these two tables
-- and NOTHING else — AR29, NOLOGIN here, a real credential set outside
-- migrations). -----------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kaenal_projector') THEN
    CREATE ROLE kaenal_projector NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA control TO kaenal_projector;
GRANT SELECT, INSERT, UPDATE ON control.sales_inbox TO kaenal_projector;
GRANT SELECT, INSERT, UPDATE ON control.tenant_commercial_summary TO kaenal_projector;

-- kaenal_app (the drainer's own role) touches neither table — the projector
-- is a separate, narrower role precisely so the drainer's tenant-transaction
-- role never gains a control-plane write.
REVOKE ALL ON control.sales_inbox FROM kaenal_app, kaenal_public;
REVOKE ALL ON control.tenant_commercial_summary FROM kaenal_app, kaenal_public;

GRANT SELECT ON control.sales_inbox TO kaenal_platform;
GRANT SELECT ON control.tenant_commercial_summary TO kaenal_platform;

-- --- kaenal_platform's commercial write grants (C5/C6/C7/C8) -----------------
-- Never DELETE, except draft price-book rows (a discarded draft) — publishing
-- archives the previous version rather than deleting it.

GRANT INSERT, UPDATE ON control.catalog_packs TO kaenal_platform;
GRANT INSERT, UPDATE ON control.catalog_pack_modules TO kaenal_platform;
GRANT INSERT, UPDATE ON control.catalog_frameworks TO kaenal_platform;
GRANT INSERT, UPDATE ON control.catalog_industries TO kaenal_platform;
GRANT INSERT, UPDATE ON control.framework_module_rules TO kaenal_platform;
GRANT INSERT, UPDATE ON control.catalog_tiers TO kaenal_platform;
GRANT SELECT ON control.catalog_meta TO kaenal_platform;

GRANT INSERT, UPDATE, DELETE ON control.price_book_versions TO kaenal_platform;
GRANT INSERT, UPDATE, DELETE ON control.price_book_items TO kaenal_platform;

-- Plan administration (C5/C6): the full plan record, never DELETE.
GRANT UPDATE ON control.tenant_plans TO kaenal_platform;

-- Workspace-request triage (C6): status transitions only, never the content
-- columns (company/email/industry/etc. stay as submitted).
GRANT SELECT, UPDATE (status, provisioned_tenant_id) ON control.workspace_requests TO kaenal_platform;
