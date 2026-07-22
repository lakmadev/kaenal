-- 0009_eight_d_lock_version.sql
--
-- Optimistic concurrency (03 §6) for the 8D slice, same pattern as 0004–0007.
-- An 8D is worked by a whole team over weeks and its `steps` jsonb is edited
-- discipline by discipline, so a stale step update (two people completing
-- different disciplines off the same loaded state) must be caught.

ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS eight_ds_bump_lock_version ON eight_ds;
CREATE TRIGGER eight_ds_bump_lock_version BEFORE UPDATE ON eight_ds
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();
