-- ===========================================================================
-- 0020_ppap — flesh out the PPAP submission record for P09 (FEATURES §11.2).
--
-- 0001 created a deliberately thin `ppap_submissions` table (supplier_id /
-- part_number / level / status / an `elements` jsonb) alongside `suppliers` and
-- `scars`. The Production Part Approval Process module needs more than that thin
-- table carries:
--
--   1. Optimistic concurrency — like `suppliers` (0019), `ppap_submissions`
--      never got a `lock_version`, yet a submission is reviewed element-by-element
--      by several people over weeks. Rule 6: writes use optimistic concurrency.
--   2. The real submission descriptors the list + detail show and filter on:
--      part revision, program name, customer (OEM), the submitted / due / approved
--      dates, and an optional owner (a member).
--   3. An `ai_prediction` jsonb (confidence / will-miss-deadline / days-likely-over
--      / reasoning) written by the predictive job — never hand-edited.
--
-- The 18 PPAP elements stay INLINE in the existing `elements` jsonb (each with
-- status / reviewer / comment), the same "raw structure in jsonb, rules in
-- packages/core" choice 0001 made for `suppliers.scorecard` — the completeness /
-- approvability rule lives in `packages/core/ppap.ts`, not a query. So no separate
-- `ppap_elements` table (superseding the P09 doc's proposal — reality wins).
--
-- Status is reconciled to the review workflow the visual spec (`suppliers-ppap.jsx`)
-- and P09 use — pending | in_review | interim | approved | rejected — replacing
-- 0001's generic draft/submitted placeholder set. Existing rows are migrated
-- before the new CHECK is applied.
--
-- RLS is already applied to `ppap_submissions` via the 0001 `tenant_tables` loop;
-- the leading-tenant_id index (`ppap_tenant_supplier_idx`) already exists.
-- ===========================================================================

-- --- 1. Optimistic concurrency ---------------------------------------------
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS ppap_submissions_bump_lock_version ON ppap_submissions;
CREATE TRIGGER ppap_submissions_bump_lock_version BEFORE UPDATE ON ppap_submissions
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- --- 2. Submission descriptors ---------------------------------------------
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS part_rev       text;
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS program_name   text;
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS customer       text;
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS code           text;
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS submitted_date date;
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS due_date       date;
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS approved_date  date;

-- Owner is a member — the composite-FK pattern (tenant_id, owner) so a member of
-- another tenant can never be referenced. Nullable, so unowned submissions are fine.
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS owner uuid;
ALTER TABLE ppap_submissions DROP CONSTRAINT IF EXISTS ppap_submissions_owner_member_fk;
ALTER TABLE ppap_submissions
  ADD CONSTRAINT ppap_submissions_owner_member_fk
  FOREIGN KEY (tenant_id, owner) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- --- 3. AI deadline prediction (written by the predictive job, advisory) -----
ALTER TABLE ppap_submissions ADD COLUMN IF NOT EXISTS ai_prediction jsonb NOT NULL DEFAULT '{}'::jsonb;

-- --- 4. Status reconciliation ----------------------------------------------
-- Migrate 0001's placeholder values into the review workflow before re-CHECKing.
UPDATE ppap_submissions SET status = 'in_review' WHERE status = 'submitted';
UPDATE ppap_submissions SET status = 'pending'   WHERE status = 'draft';

ALTER TABLE ppap_submissions ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE ppap_submissions DROP CONSTRAINT IF EXISTS ppap_submissions_status_check;
ALTER TABLE ppap_submissions
  ADD CONSTRAINT ppap_submissions_status_check
  CHECK (status IN ('pending','in_review','interim','approved','rejected'));

-- --- 5. Uniqueness + filter index ------------------------------------------
-- Codes (PPAP-YYYY-NNNN) are unique within a tenant, like every other entity code.
CREATE UNIQUE INDEX IF NOT EXISTS ppap_submissions_tenant_code_uq
  ON ppap_submissions (tenant_id, code) WHERE code IS NOT NULL;
-- Status is the primary list filter.
CREATE INDEX IF NOT EXISTS ppap_submissions_tenant_status_idx ON ppap_submissions (tenant_id, status);
