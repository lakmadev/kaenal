-- 0007_document_lock_version.sql
--
-- Optimistic concurrency (03 §6) for the Documents slice, same pattern as
-- 0004–0006. The `documents` row is the controlled aggregate — its status,
-- current version pointer and approver all move together — so the token lives
-- there. `document_versions` is history written under the documents-row lock in
-- the same transaction (approve stamps the current version's row), so it needs
-- no token of its own.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS lock_version int NOT NULL DEFAULT 0;

DROP TRIGGER IF EXISTS documents_bump_lock_version ON documents;
CREATE TRIGGER documents_bump_lock_version BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();
