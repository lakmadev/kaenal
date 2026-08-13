-- ===========================================================================
-- 0021_scar — flesh out the SCAR record for P10 (FEATURES §11.3).
--
-- 0001 created a deliberately thin `scars` table (supplier_id / ncr_id / a
-- generic status / a `chargeback` jsonb) alongside `suppliers` and
-- `ppap_submissions`. A Supplier Corrective Action Request is an 8D run *with*
-- the supplier plus cost recovery (chargebacks), so it needs more than the thin
-- table carries:
--
--   1. Optimistic concurrency — like `suppliers` (0019) and `ppap_submissions`
--      (0020), `scars` never got a `lock_version`, yet a SCAR is worked
--      D-step-by-D-step over weeks by several people. Rule 6: writes use
--      optimistic concurrency.
--   2. The descriptors the list + detail show and filter on: title, severity,
--      the 8D `current_d` step (1–8), raised / due / supplier-response-due dates,
--      the supplier acknowledgement, affected-lot count, and an optional owner.
--   3. Explicit chargeback columns (amount / currency / status) replacing the
--      opaque `chargeback` jsonb — cost recovery is compliance-sensitive and is
--      filtered/aggregated, so it earns real columns, not a blob.
--
-- The 8D progress lives in `current_d` (1–8); the forward-only step machine and
-- the overdue / days-open derivations live in `packages/core/scar.ts` (rules in
-- core, per CLAUDE.md rule 5). Links to the originating NCR keep the existing
-- `ncr_id` column; links to an 8D (and anything else) reuse `entity_links`
-- (0018) — `scar` is added to the `EntityKind` enum at the API edge.
--
-- Status is reconciled from 0001's generic open/responded/accepted/rejected/
-- closed to the SCAR lifecycle draft | open | responded | closed | rejected |
-- cancelled. The visual spec's `awaiting_d4` / `d5_review` are DERIVED display
-- labels (status + current_d), and `overdue` is DERIVED (a due date in the past
-- while still active) — neither is a stored status. Existing rows are migrated
-- before the new CHECK is applied.
--
-- RLS is already applied to `scars` via the 0001 `tenant_tables` loop; the
-- leading-tenant_id indexes (`scars_tenant_code_uq`, `scars_tenant_supplier_idx`)
-- already exist.
-- ===========================================================================

-- --- 1. Optimistic concurrency ---------------------------------------------
ALTER TABLE scars ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS scars_bump_lock_version ON scars;
CREATE TRIGGER scars_bump_lock_version BEFORE UPDATE ON scars
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- --- 2. SCAR descriptors ----------------------------------------------------
ALTER TABLE scars ADD COLUMN IF NOT EXISTS title                 text;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS severity              text NOT NULL DEFAULT 'major';
ALTER TABLE scars ADD COLUMN IF NOT EXISTS current_d             int  NOT NULL DEFAULT 1;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS raised_date           date;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS due_date              date;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS supplier_response_due date;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS supplier_acknowledged boolean NOT NULL DEFAULT false;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS ack_date              date;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS affected_lots         int;

ALTER TABLE scars DROP CONSTRAINT IF EXISTS scars_severity_check;
ALTER TABLE scars ADD CONSTRAINT scars_severity_check
  CHECK (severity IN ('minor','major','critical'));

ALTER TABLE scars DROP CONSTRAINT IF EXISTS scars_current_d_check;
ALTER TABLE scars ADD CONSTRAINT scars_current_d_check
  CHECK (current_d BETWEEN 1 AND 8);

-- Owner is a member — the composite-FK pattern (tenant_id, owner) so a member of
-- another tenant can never be referenced. Nullable, so unowned SCARs are fine.
ALTER TABLE scars ADD COLUMN IF NOT EXISTS owner uuid;
ALTER TABLE scars DROP CONSTRAINT IF EXISTS scars_owner_member_fk;
ALTER TABLE scars
  ADD CONSTRAINT scars_owner_member_fk
  FOREIGN KEY (tenant_id, owner) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- --- 3. Chargeback (cost recovery) — explicit columns -----------------------
-- Replace the opaque `chargeback` jsonb with filterable columns. A null
-- `chargeback_status` means no chargeback has been raised on this SCAR.
ALTER TABLE scars DROP COLUMN IF EXISTS chargeback;
ALTER TABLE scars ADD COLUMN IF NOT EXISTS chargeback_amount   numeric(14,2);
ALTER TABLE scars ADD COLUMN IF NOT EXISTS chargeback_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE scars ADD COLUMN IF NOT EXISTS chargeback_status   text;

ALTER TABLE scars DROP CONSTRAINT IF EXISTS scars_chargeback_status_check;
ALTER TABLE scars ADD CONSTRAINT scars_chargeback_status_check
  CHECK (chargeback_status IS NULL OR chargeback_status IN ('pending','debit_issued','closed'));

-- --- 4. Status reconciliation ----------------------------------------------
-- Migrate 0001's placeholder values into the SCAR lifecycle before re-CHECKing.
UPDATE scars SET status = 'closed' WHERE status = 'accepted';

ALTER TABLE scars ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE scars DROP CONSTRAINT IF EXISTS scars_status_check;
ALTER TABLE scars
  ADD CONSTRAINT scars_status_check
  CHECK (status IN ('draft','open','responded','closed','rejected','cancelled'));

-- --- 5. Filter index --------------------------------------------------------
-- Status is the primary list filter (active / overdue / closed tabs).
CREATE INDEX IF NOT EXISTS scars_tenant_status_idx ON scars (tenant_id, status);
