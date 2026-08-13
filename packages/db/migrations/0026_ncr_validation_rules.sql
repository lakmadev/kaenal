-- ===========================================================================
-- 0026_ncr_validation_rules — configurable NCR field validation (04 §Settings >
-- Process > Validation rules; operations.jsx `ValidationRules`).
--
-- An admin defines rules that gate NCR creation: "a rule FIRES when
-- `field <operator> value` holds, and applies `action` with `message`". The
-- enforcement point is `NcrService.create` (rules in core-adjacent SQL, the
-- throw in the service — CLAUDE.md rule 5). Only fields present on the create
-- payload are evaluable, so `field` is a closed set matching CreateNcrBody
-- (priority/source/title/description/plant/area). `action='block'` rejects the
-- create; `warn`/`escalate` are stored + listed but their runtime effect is a
-- later slice (there is no per-request warning channel / escalation job yet).
--
-- Soft-deletable + optimistic (rule 6); one row per rule. RLS is enforced by the
-- catalog-driven check-rls lint, so the table needs the policy + tenant_id index.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ncr_validation_rules (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  name         text NOT NULL,
  field        text NOT NULL
                 CHECK (field IN ('priority','source','title','description','plant','area')),
  operator     text NOT NULL
                 CHECK (operator IN ('is_empty','is_not_empty','equals','in')),
  -- Comma-separated set for `in`, a single token for `equals`, ignored for the
  -- emptiness operators.
  value        text NOT NULL DEFAULT '',
  action       text NOT NULL CHECK (action IN ('block','warn','escalate')),
  message      text NOT NULL,
  enabled      boolean NOT NULL DEFAULT true,
  lock_version int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz
);

-- Enforcement reads all enabled rules for the tenant; the leading-tenant_id index
-- (rule 2) also covers the settings list.
CREATE INDEX IF NOT EXISTS ncr_validation_rules_tenant_idx
  ON ncr_validation_rules (tenant_id, enabled);

DROP TRIGGER IF EXISTS ncr_validation_rules_bump_lock_version ON ncr_validation_rules;
CREATE TRIGGER ncr_validation_rules_bump_lock_version BEFORE UPDATE ON ncr_validation_rules
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE ncr_validation_rules DROP CONSTRAINT IF EXISTS ncr_validation_rules_created_by_member_fk;
ALTER TABLE ncr_validation_rules ADD CONSTRAINT ncr_validation_rules_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE ncr_validation_rules DROP CONSTRAINT IF EXISTS ncr_validation_rules_updated_by_member_fk;
ALTER TABLE ncr_validation_rules ADD CONSTRAINT ncr_validation_rules_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

SELECT apply_tenant_rls('ncr_validation_rules');
