-- 0004_optimistic_concurrency.sql
--
-- Optimistic concurrency (03 §6) for the entities that have update endpoints so
-- far. A client sends the `lock_version` it last read; the service does a
-- compare-and-set (`WHERE id = $ AND lock_version = $expected`) and maps a
-- zero-row result to STALE_WRITE. The counter is bumped by a trigger rather
-- than by every UPDATE statement, so no code path — service, job, or support
-- tool — can move a row without advancing its version.
--
-- NOTE: `inspection_templates.version` already exists and means the published
-- template version (1, 2, 3 …) used by the name+version unique index. That is a
-- different concept from a concurrency token, so this adds a separate
-- `lock_version` column rather than overloading it.

ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;
ALTER TABLE inspections          ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION bump_lock_version() RETURNS trigger AS $$
BEGIN
  -- Only advance when something other than the counter itself changed, so a
  -- no-op UPDATE does not spuriously invalidate another client's token.
  IF NEW IS DISTINCT FROM OLD THEN
    NEW.lock_version := OLD.lock_version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS templates_bump_lock_version ON inspection_templates;
CREATE TRIGGER templates_bump_lock_version BEFORE UPDATE ON inspection_templates
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

DROP TRIGGER IF EXISTS inspections_bump_lock_version ON inspections;
CREATE TRIGGER inspections_bump_lock_version BEFORE UPDATE ON inspections
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();
