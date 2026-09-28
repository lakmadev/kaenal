-- ===========================================================================
-- 0062_risk_predictions — Sprint 03 Part B (predictive risk) backend build.
--
-- New table only — SPRINT-03-graph-predictive.md §3B (user-approved
-- 2026-09-28). One row per (subject, horizon): a production line (`areas`
-- row) or a supplier (`suppliers` row), scored by the nightly
-- `predict-risk.compute` job from a v1 trend + seasonal-naive statistical
-- baseline (packages/core/forecast.ts). `subject_id` is polymorphic
-- (areas.id | suppliers.id depending on subject_kind) — enforced at the
-- service layer, not a DB-level FK, mirroring how `entity_links`/`comments`
-- already handle polymorphic references (02 §2, no CHECK-constraint-level
-- conditional FK is practical in Postgres for this shape).
--
-- No `lock_version`: rows are job-only writes (upsert on re-run), never
-- user-edited, so optimistic concurrency has nothing to protect here.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS risk_predictions (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL,
  subject_kind    text NOT NULL CHECK (subject_kind IN ('line', 'supplier')),
  subject_id      uuid NOT NULL,
  -- Calendar-period label, e.g. '2026-11' (month), '2026-Q4' (quarter),
  -- '2026-H2' (two-quarter/half-year) — see packages/core/forecast.ts
  -- `horizonLabel`.
  horizon         text NOT NULL,
  predicted_value numeric NOT NULL,
  confidence      int NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  band_low        numeric NOT NULL,
  band_high       numeric NOT NULL,
  -- Last 6 periods' actual NC counts, oldest first — feeds ForecastSpark's
  -- solid line and the trailing-average risk-bucket threshold on read.
  history         numeric[] NOT NULL,
  reasoning       text NOT NULL DEFAULT '',
  model_version   text NOT NULL,
  generated_at    timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  deleted_at      timestamptz
);

-- A re-run replaces (upsert), never accumulates duplicate rows per horizon.
CREATE UNIQUE INDEX IF NOT EXISTS risk_predictions_uq
  ON risk_predictions (tenant_id, subject_kind, subject_id, horizon)
  WHERE deleted_at IS NULL;

-- Leading-tenant_id index (rule 2); also supports the ranked list endpoint
-- (`ORDER BY predicted_value DESC` within a tenant/subject_kind).
CREATE INDEX IF NOT EXISTS risk_predictions_tenant_idx
  ON risk_predictions (tenant_id, subject_kind, predicted_value DESC);

-- Composite member FK on the generating actor (mirrors entity_links'
-- created_by — jobs write as the `system` actor's audit event, but the row
-- itself still records which member's tenant-scoped job run produced it when
-- the caller is known; NULL for a pure system run with no attributable user).
ALTER TABLE risk_predictions DROP CONSTRAINT IF EXISTS risk_predictions_created_by_member_fk;
ALTER TABLE risk_predictions ADD CONSTRAINT risk_predictions_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- Tenant isolation (02 §1). check-rls.ts enumerates tenant tables dynamically,
-- so this table is in scope by default and would fail CI without the policy.
SELECT apply_tenant_rls('risk_predictions');

-- The current ranked lines+suppliers forecast, rendered to PDF (§2B P4,
-- `predictive.jsx` "Forecast pack") — distinct from the `risk_predictions`
-- table dump; a caller-scoped snapshot like `audit_report`.
ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_resource_check;
ALTER TABLE exports ADD CONSTRAINT exports_resource_check
  CHECK (resource IN ('ncrs', 'inspections', 'capas', 'audits', 'ai_reply', 'audit_report',
                       'predictive_forecast_pack'));
