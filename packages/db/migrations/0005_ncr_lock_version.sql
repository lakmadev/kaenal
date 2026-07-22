-- 0005_ncr_lock_version.sql
--
-- Optimistic concurrency (03 §6) for the NCR slice, same pattern as 0004:
-- a `lock_version` column bumped by the shared `bump_lock_version()` trigger, so
-- no path can move an NCR or a corrective action without advancing its token.
-- NCRs especially need this — several people work one NCR at once, and a stale
-- transition (verify a resolution that was already bounced back) must be caught.

ALTER TABLE ncrs        ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;
ALTER TABLE ncr_actions ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS ncrs_bump_lock_version ON ncrs;
CREATE TRIGGER ncrs_bump_lock_version BEFORE UPDATE ON ncrs
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

DROP TRIGGER IF EXISTS ncr_actions_bump_lock_version ON ncr_actions;
CREATE TRIGGER ncr_actions_bump_lock_version BEFORE UPDATE ON ncr_actions
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();
