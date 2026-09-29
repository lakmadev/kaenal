-- ===========================================================================
-- 0064_risk_register — Sprint 04 Slice 1 (R1/R2/R3; P12 backend, finally
-- built). SPRINT-04-risk-msa.md §3.1 (user-approved 2026-09-28) + §2 R1/R2/R3.
--
-- Two new tenant-scoped tables (`risks`, `risk_controls`) plus a widening of
-- `entity_links`'s CHECK constraints so `risk` and `fmea` become real graph
-- nodes (R3 AC1/AC2) — mirrors migration 0063's exact pattern for `finding`.
--
-- `risks.code` uses the corrected `RISK-YYYY-NNNN` format (packages/core's one
-- established `PREFIX-YYYY-NNNN` pattern via `codes.ts`/`counters`), not the
-- jsx's mock `R-NNN`. `residual_score` is independently entered by the risk
-- owner (§3.1's settled judgment call), not derived from `inherent_score`;
-- `inherent_score` itself IS derived (`likelihood * impact`, GENERATED ALWAYS
-- AS ... STORED) so it can never drift from its inputs.
--
-- `risk_controls` mirrors `fmea_items`' child-table precedent exactly
-- (0030_fmea.sql): tenant_id, composite FK to the parent scoped by tenant,
-- CASCADE delete, lock_version + bump trigger, composite member FKs on the
-- audit actor columns.
-- ===========================================================================

-- --- Risks ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS risks (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id       uuid NOT NULL,
  -- RISK-YYYY-NNNN, sequenced per-tenant-per-year via the `counters` table
  -- (packages/core/src/codes.ts `CodeKind: "risk"`) — never client-supplied.
  code            text NOT NULL,
  category        text NOT NULL
                    CHECK (category IN ('supply', 'process', 'compliance', 'cyber', 'people',
                                         'quality', 'environmental', 'financial', 'reputation')),
  title           text NOT NULL,
  -- Composite member FK below: the risk owner, one person, one column — this
  -- is why risk skips the wizard's shared multi-role Assignees step (R4 AC1).
  owner           uuid NOT NULL,
  likelihood      int  NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact          int  NOT NULL CHECK (impact BETWEEN 1 AND 5),
  -- Always likelihood * impact; never independently written, so it can never
  -- disagree with its own inputs (rule 5 logic still lives in packages/core
  -- for score BANDING — this column only derives the raw product).
  inherent_score  int  GENERATED ALWAYS AS (likelihood * impact) STORED,
  -- Independently entered by the risk owner (§3.1) — NOT derived from
  -- inherent_score or treatment. No cross-field check against inherent; a
  -- residual > inherent is a soft UI warning, never a DB/API block.
  residual_score  int  NOT NULL CHECK (residual_score BETWEEN 1 AND 25),
  trend           text NOT NULL DEFAULT 'flat' CHECK (trend IN ('up', 'down', 'flat')),
  treatment       text NOT NULL CHECK (treatment IN ('mitigate', 'accept', 'transfer', 'avoid')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'accepted')),
  plan            text NOT NULL DEFAULT '',
  review_due      date,
  lock_version    int  NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  updated_by      uuid,
  deleted_at      timestamptz,
  -- Composite-FK target so risk_controls references a risk inside the same tenant.
  UNIQUE (tenant_id, id)
);

-- Human-facing code is unique per tenant (leading tenant_id — isolation contract).
CREATE UNIQUE INDEX IF NOT EXISTS risks_tenant_code_uq ON risks (tenant_id, code);

-- General leading-tenant_id index (rule 2 / 02 §6 lint).
CREATE INDEX IF NOT EXISTS risks_tenant_idx ON risks (tenant_id, id);

-- The register list's cursor sort (planner's round-1 finding, §2 R1 AC1):
-- "sorted by residual score desc" needs a tenant-led index matching that order.
CREATE INDEX IF NOT EXISTS risks_tenant_residual_idx
  ON risks (tenant_id, residual_score DESC, id DESC);

DROP TRIGGER IF EXISTS risks_bump_lock_version ON risks;
CREATE TRIGGER risks_bump_lock_version BEFORE UPDATE ON risks
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_owner_member_fk;
ALTER TABLE risks ADD CONSTRAINT risks_owner_member_fk
  FOREIGN KEY (tenant_id, owner) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_created_by_member_fk;
ALTER TABLE risks ADD CONSTRAINT risks_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE risks DROP CONSTRAINT IF EXISTS risks_updated_by_member_fk;
ALTER TABLE risks ADD CONSTRAINT risks_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('risks');

-- --- Risk controls (R2 — new: no schema existed for this designed panel) ----
-- The jsx's "Controls" block was a fixed four-row mock, identical for every
-- risk (§1a gap) — this table gives it a real, per-risk backing store.

CREATE TABLE IF NOT EXISTS risk_controls (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  risk_id      uuid NOT NULL,
  kind         text NOT NULL
                 CHECK (kind IN ('detective', 'preventive', 'corrective', 'contingency')),
  description  text NOT NULL,
  strength     text NOT NULL CHECK (strength IN ('strong', 'medium', 'weak')),
  seq          int  NOT NULL DEFAULT 0,
  lock_version int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS risk_controls_tenant_idx ON risk_controls (tenant_id, risk_id, seq);

DROP TRIGGER IF EXISTS risk_controls_bump_lock_version ON risk_controls;
CREATE TRIGGER risk_controls_bump_lock_version BEFORE UPDATE ON risk_controls
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE risk_controls DROP CONSTRAINT IF EXISTS risk_controls_risk_fk;
ALTER TABLE risk_controls ADD CONSTRAINT risk_controls_risk_fk
  FOREIGN KEY (tenant_id, risk_id) REFERENCES risks (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE risk_controls DROP CONSTRAINT IF EXISTS risk_controls_created_by_member_fk;
ALTER TABLE risk_controls ADD CONSTRAINT risk_controls_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE risk_controls DROP CONSTRAINT IF EXISTS risk_controls_updated_by_member_fk;
ALTER TABLE risk_controls ADD CONSTRAINT risk_controls_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('risk_controls');

-- --- entity_links: risk + fmea become real graph nodes (R3 AC1/AC2) --------
-- Mirrors 0063_entity_links_finding.sql's exact pattern for `finding`.

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_from_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_from_kind_check
  CHECK (from_kind IN ('inspection', 'ncr', 'eight_d', 'audit', 'capa', 'document', 'supplier',
                        'finding', 'risk', 'fmea'));

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_to_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_to_kind_check
  CHECK (to_kind IN ('inspection', 'ncr', 'eight_d', 'audit', 'capa', 'document', 'supplier',
                      'finding', 'risk', 'fmea'));
