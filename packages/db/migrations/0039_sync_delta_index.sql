-- Delta-sync scan support (05 §2.1).
--
-- The mobile offline mirror pulls each synced entity through GET /v1/sync/<entity>
-- as an `updated_at` keyset scan: "rows whose (updated_at, id) is strictly after
-- the client's cursor, oldest-first". Backed by a leading-tenant_id index (rule 2)
-- on (tenant_id, updated_at, id) so the scan is an index range, not a table sweep,
-- and stays tenant-local. Soft-deleted rows are intentionally NOT excluded here —
-- a tombstone (deleted_at IS NOT NULL) must still surface so the client can drop
-- the row from its mirror; the endpoint splits changed vs deleted by that column.

CREATE INDEX IF NOT EXISTS ncrs_tenant_updated_idx
  ON ncrs (tenant_id, updated_at, id);

CREATE INDEX IF NOT EXISTS inspections_tenant_updated_idx
  ON inspections (tenant_id, updated_at, id);
