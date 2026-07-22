-- 0012_inspection_recurrence.sql
--
-- Scheduling / recurrence (02 §2, 06 `schedule`). `inspections.recurrence` (a
-- jsonb rule) already exists; this adds the two columns the materialiser needs
-- to turn a recurring "series head" into concrete occurrence rows:
--
--   * series_id      — an occurrence points back at its head (same table, same
--                      tenant, so a plain intra-tenant FK, not a member FK).
--   * occurrence_date— the occurrence's calendar date, which together with
--                      series_id is the idempotency key the `schedule` job dedupes
--                      on: re-running the hourly sweep must never double-book a day.

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS series_id       uuid;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS occurrence_date date;

ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_series_fk;
ALTER TABLE inspections ADD CONSTRAINT inspections_series_fk
  FOREIGN KEY (series_id) REFERENCES inspections(id) ON DELETE RESTRICT;

-- The idempotency key (06 §1: "skip existing occurrence keys (seriesId, date)").
-- A unique index makes double-materialisation structurally impossible — the
-- job's INSERT ... ON CONFLICT DO NOTHING collapses a re-run to a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS inspections_series_occurrence_uq
  ON inspections (tenant_id, series_id, occurrence_date)
  WHERE series_id IS NOT NULL;

-- The sweep scans only series heads (recurrence set, not soft-deleted); a
-- partial index keeps that scan off the full inspections table.
CREATE INDEX IF NOT EXISTS inspections_recurrence_idx
  ON inspections (tenant_id)
  WHERE recurrence IS NOT NULL AND deleted_at IS NULL;

-- No lock_version change: occurrences are created by the system job (not a
-- user-contended edit), and the head's recurrence is edited through the normal
-- optimistic-concurrency path the inspections table already has (0004).
