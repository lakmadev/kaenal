-- ===========================================================================
-- 0031_report_definitions — saved reports & dashboards (Data Platform B3;
-- reports.jsx `ReportBuilder`).
--
-- A report definition is a persisted JSON document: a set of tiles, each binding
-- one query-engine `Query` (0030-era engine lives in packages/core/query.ts) to
-- a visualization (datatable/repeater/kpi/bar/pie/line). The builder edits this
-- JSON; render is the engine, so nothing about a chart is hardcoded — a tile is
-- data + a viz choice. Built-in dashboards ship as code constants
-- (packages/core report-dashboards.ts) and are NOT rows here; only user-authored
-- reports persist.
--
-- One tenant-scoped table, soft-deletable + optimistic (rule 6), audited in the
-- service (rule 3). RLS enforced by the catalog-driven check-rls lint, so it
-- needs the policy + leading-tenant_id index + composite member FKs.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS report_definitions (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  -- The report document: { filters, branding?, tiles:[{id,title,viz,query,layout}] }.
  -- Validated by Zod in packages/types on every write; stored verbatim.
  definition   jsonb NOT NULL DEFAULT '{}'::jsonb,
  lock_version int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS report_definitions_tenant_idx
  ON report_definitions (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS report_definitions_bump_lock_version ON report_definitions;
CREATE TRIGGER report_definitions_bump_lock_version BEFORE UPDATE ON report_definitions
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE report_definitions DROP CONSTRAINT IF EXISTS report_definitions_created_by_member_fk;
ALTER TABLE report_definitions ADD CONSTRAINT report_definitions_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE report_definitions DROP CONSTRAINT IF EXISTS report_definitions_updated_by_member_fk;
ALTER TABLE report_definitions ADD CONSTRAINT report_definitions_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('report_definitions');
