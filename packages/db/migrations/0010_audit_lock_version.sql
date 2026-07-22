-- 0010_audit_lock_version.sql
--
-- Optimistic concurrency (03 §6) for the Audits slice. The `audits` row moves
-- through its phases (planned → … → closed) and carries progress, so a stale
-- phase advance must be caught. `audit_findings` link to an NCR/CAPA via a
-- `WHERE ncr_id IS NULL` compare-and-set (like inspection findings), so they
-- need no token of their own.

ALTER TABLE audits ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS audits_bump_lock_version ON audits;
CREATE TRIGGER audits_bump_lock_version BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();
