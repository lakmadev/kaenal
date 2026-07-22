-- 0006_capa_lock_version.sql
--
-- Optimistic concurrency (03 §6) for the CAPA slice, same pattern as 0004/0005:
-- a `lock_version` column bumped by the shared `bump_lock_version()` trigger, so
-- no path can advance (or revert) a CAPA phase without advancing its token. A
-- CAPA is worked by several people over weeks — a stale phase advance, or an
-- advance racing a revert, must be caught.

ALTER TABLE capas        ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;
ALTER TABLE capa_actions ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS capas_bump_lock_version ON capas;
CREATE TRIGGER capas_bump_lock_version BEFORE UPDATE ON capas
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

DROP TRIGGER IF EXISTS capa_actions_bump_lock_version ON capa_actions;
CREATE TRIGGER capa_actions_bump_lock_version BEFORE UPDATE ON capa_actions
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();
