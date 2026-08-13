-- ===========================================================================
-- 0028_compliance_legal_hold_dlp — compliance registers (04 §Settings >
-- Compliance & Privacy; compliance-extra.jsx `LegalHold` + `DLPPolicies`).
--
--   legal_holds — the litigation/audit hold register already exists (0001) and
--     is ENFORCED: the nightly purge job refuses to permanently erase any
--     soft-deleted row an active hold's `scope` covers (packages/core/purge.ts,
--     07 §5). Here we extend it with the human-facing register fields the
--     settings UI needs (a reference code, a title, the matter line), plus
--     optimistic concurrency, and make `reason` optional so the register can use
--     `name` as the primary label. `status` is NOT stored — it is derived from
--     `released_at` (NULL = active), keeping the purge index meaningful and a
--     single source of truth. A soft `deleted_at` lets an admin retract a
--     mistaken hold; `remove` also releases it so a hidden row can never keep
--     silently blocking purge.
--
--   dlp_policies — a NEW tenant-scoped register (compliance-extra.jsx
--     `DLPPolicies`): pattern + action + surface, toggleable. Pre-egress
--     interception, hit metrics, and the "recent events" table need an
--     interception layer + event log that don't exist yet (flagged in TODO), so
--     this register is stored + listed + audited only, not enforced at runtime.
--
-- Both are optimistic (rule 6) + audited (rule 3, in the service). RLS on
-- dlp_policies is enforced by the catalog-driven check-rls lint; legal_holds
-- already carries its 0001 policy + index.
-- ===========================================================================

-- --- Legal holds: extend the existing 0001 table ---------------------------
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS name         text NOT NULL DEFAULT '';
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS matter       text NOT NULL DEFAULT '';
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS reference    text NOT NULL DEFAULT '';
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS lock_version int  NOT NULL DEFAULT 0;
ALTER TABLE legal_holds ADD COLUMN IF NOT EXISTS deleted_at   timestamptz;
-- `reason` was NOT NULL with no default (0001); the register uses `name` as the
-- label and `reason` for optional notes, so let inserts omit it.
ALTER TABLE legal_holds ALTER COLUMN reason SET DEFAULT '';

DROP TRIGGER IF EXISTS legal_holds_bump_lock_version ON legal_holds;
CREATE TRIGGER legal_holds_bump_lock_version BEFORE UPDATE ON legal_holds
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- --- DLP policies: new register --------------------------------------------
CREATE TABLE IF NOT EXISTS dlp_policies (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  name         text NOT NULL,
  -- The detector/pattern descriptor (e.g. "PII patterns", a regex, a label).
  pattern      text NOT NULL DEFAULT '',
  action       text NOT NULL
                 CHECK (action IN ('block', 'warn', 'watermark', 'quarantine', 'notify')),
  -- Where the policy applies (e.g. "Email, download") — free text for now.
  surface      text NOT NULL DEFAULT '',
  note         text NOT NULL DEFAULT '',
  enabled      boolean NOT NULL DEFAULT true,
  lock_version int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS dlp_policies_tenant_idx
  ON dlp_policies (tenant_id, enabled);

DROP TRIGGER IF EXISTS dlp_policies_bump_lock_version ON dlp_policies;
CREATE TRIGGER dlp_policies_bump_lock_version BEFORE UPDATE ON dlp_policies
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE dlp_policies DROP CONSTRAINT IF EXISTS dlp_policies_created_by_member_fk;
ALTER TABLE dlp_policies ADD CONSTRAINT dlp_policies_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE dlp_policies DROP CONSTRAINT IF EXISTS dlp_policies_updated_by_member_fk;
ALTER TABLE dlp_policies ADD CONSTRAINT dlp_policies_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

SELECT apply_tenant_rls('dlp_policies');
