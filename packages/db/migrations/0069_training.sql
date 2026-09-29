-- ===========================================================================
-- 0069_training — Sprint 05 Slice 2 (T1/T5; P17 backend, finally built).
-- SPRINT-05-calibration-training.md §3.1 (user-approved 2026-09-29) + §2
-- T1 AC1, T5 AC1/AC2/AC3. Depends on 0067 (composite-FK prereqs on files).
--
-- Two new tenant-scoped tables: `competencies` (the tenant-owned catalog) and
-- `training_records` (a real per-completion HISTORY table — one row per
-- recorded training event, newest = current — not P17's own draft "unique
-- latest row, history in audit_events"; §3.1 item 8, the one genuine schema
-- deviation from the phase doc's own draft, approved).
--
-- `competencies.code` is a plain author-chosen slug (`iatf`, `fmea`), NOT a
-- `counters`-sequenced code (§3.1 item 12) — a catalog entry is authored once,
-- not incident-sequenced like an NCR. `archived_at` is a DEDICATED column,
-- never the generic soft-delete `deleted_at` pattern (§3.1 item 17, B8): this
-- sprint's own purge job would otherwise eventually destroy real training
-- history tied to an archived competency. Code uniqueness is therefore a
-- PARTIAL unique index scoped to non-archived rows, so an archived code can
-- be reused (T5).
--
-- `training_records.expires_at` is GENERATED from `valid_months`, a real
-- denormalized STORED column copied from `competencies.valid_months` by the
-- service at insert time (never client-supplied, never re-derived from the
-- catalog later) — a later change to the catalog's `valid_months` must not
-- retroactively reinterpret a past completion's expiry (B1, Round 1's own
-- fix). Same `make_interval` IMMUTABLE fix as instruments.next_due (§3.1 item
-- 13). `member_id` is a composite FK to `memberships(tenant_id, user_id)`,
-- NOT to `control.users` — the settled architecture decision (CLAUDE.md,
-- 07 §7): identity is shared, but every tenant-table user reference resolves
-- through the tenant's own membership row, never a bare user id.
-- ===========================================================================

-- --- Competencies --------------------------------------------------------

CREATE TABLE IF NOT EXISTS competencies (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  -- Short, author-chosen slug (e.g. "iatf", "fmea") — NOT counters-sequenced
  -- (§3.1 item 12). Uniqueness is enforced below, scoped to non-archived rows.
  code         text NOT NULL,
  name         text NOT NULL,
  mandatory    boolean NOT NULL DEFAULT false,
  -- NULL = never expires (a one-time awareness course may have no renewal
  -- cadence).
  valid_months int,
  -- Matrix column order; a new/un-archived row is appended
  -- (`current_max_seq(non-archived) + 1`, T1 AC3 / T5 AC1(b)) by the service.
  seq          int  NOT NULL DEFAULT 0,
  -- Dedicated archival marker (T5) — NEVER the generic `deleted_at` purge
  -- pattern, since archiving must keep every historical training_records row
  -- that references this competency fully readable (§3.1 item 17).
  archived_at  timestamptz,
  lock_version int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz,
  -- Composite-FK target so training_records references a competency inside
  -- the same tenant (self-consistency, B2).
  UNIQUE (tenant_id, id)
);

-- An archived competency's code can be reused by a new one (T5) — a blanket
-- unique(tenant_id, code) would forbid that, so the constraint is partial.
CREATE UNIQUE INDEX IF NOT EXISTS competencies_tenant_code_uq
  ON competencies (tenant_id, code) WHERE archived_at IS NULL;

-- General leading-tenant_id index (rule 2 / 02 §6 lint); also the catalog's
-- and the matrix's natural column-order read pattern.
CREATE INDEX IF NOT EXISTS competencies_tenant_seq_idx ON competencies (tenant_id, seq);

DROP TRIGGER IF EXISTS competencies_bump_lock_version ON competencies;
CREATE TRIGGER competencies_bump_lock_version BEFORE UPDATE ON competencies
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE competencies DROP CONSTRAINT IF EXISTS competencies_created_by_member_fk;
ALTER TABLE competencies ADD CONSTRAINT competencies_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE competencies DROP CONSTRAINT IF EXISTS competencies_updated_by_member_fk;
ALTER TABLE competencies ADD CONSTRAINT competencies_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('competencies');

-- --- Training records (real per-completion history, §3.1 item 8) -----------

CREATE TABLE IF NOT EXISTS training_records (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL,
  -- Composite FK to memberships(tenant_id, user_id) — NOT to control.users
  -- (settled architecture decision). This column stores the same value as
  -- memberships.user_id, joined via that composite FK, never memberships.id.
  member_id      uuid NOT NULL,
  competency_id  uuid NOT NULL,
  completed_at   date NOT NULL,
  -- Real, denormalized, STORED column — copied from competencies.valid_months
  -- by the service at insert time (B1, Round 1 fix), never re-derived from
  -- the catalog later: a record captures the rule in effect when it was
  -- recorded, not a live join to the (possibly since-changed) competency.
  valid_months   int,
  -- Same IMMUTABLE make_interval fix as instruments.next_due (§3.1 item 13).
  -- NULL propagates when valid_months is NULL (never expires).
  expires_at     date GENERATED ALWAYS AS (
                    CASE WHEN valid_months IS NULL THEN NULL
                         ELSE (completed_at + make_interval(months => valid_months))::date
                    END
                  ) STORED,
  -- Sole, authoritative link to evidence (mirrors certificate_file_id's
  -- philosophy exactly). ON DELETE RESTRICT: the files-purge job must never
  -- silently orphan a training record (§3.1 item 16, SHOULD-FIX 4).
  evidence_file_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  deleted_at     timestamptz
  -- Deliberately NO unique(tenant_id, member_id, competency_id) — this is a
  -- real per-completion history table, not a single mutable "latest" row
  -- (§3.1 item 8, the approved deviation from P17's own draft).
);

-- Leading-tenant_id (isolation contract) AND the member-history read pattern
-- (GET /v1/training/records?memberId=, T1 AC9; the matrix's own per-member
-- DISTINCT ON ... ORDER BY completed_at DESC join, T1 AC4).
CREATE INDEX IF NOT EXISTS training_records_tenant_member_idx
  ON training_records (tenant_id, member_id, completed_at DESC);

ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_member_fk;
ALTER TABLE training_records ADD CONSTRAINT training_records_member_fk
  FOREIGN KEY (tenant_id, member_id) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_competency_fk;
ALTER TABLE training_records ADD CONSTRAINT training_records_competency_fk
  FOREIGN KEY (tenant_id, competency_id) REFERENCES competencies (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_evidence_file_fk;
ALTER TABLE training_records ADD CONSTRAINT training_records_evidence_file_fk
  FOREIGN KEY (tenant_id, evidence_file_id) REFERENCES files (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_created_by_member_fk;
ALTER TABLE training_records ADD CONSTRAINT training_records_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE training_records DROP CONSTRAINT IF EXISTS training_records_updated_by_member_fk;
ALTER TABLE training_records ADD CONSTRAINT training_records_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('training_records');
