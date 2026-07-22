-- 0011_exports.sql
--
-- Async exports (03 §8, 06 `reports` queue). A large CSV/XLSX/PDF is a job, not
-- a synchronous response: `POST /v1/exports` records a `queued` row and returns
-- 202; the `reports` worker renders server-side, uploads to object storage, and
-- flips the row to `completed` with the object's location; the client polls
-- `GET /v1/exports/:id` and downloads via a short-TTL presigned URL.
--
-- The rendered artifact lives on the row itself (`bucket`/`object_key`), NOT in
-- `files` — an export is system-generated output, not a user upload, so it must
-- bypass the AV-scan download gate that guards `files` (07 §3).
--
-- This is the first brand-new tenant table created after 0003, so its user
-- reference is a composite FK `(tenant_id, requested_by) -> memberships` by
-- hand — the auto-repoint in 0003 only ran over tables that existed then.

CREATE TABLE IF NOT EXISTS exports (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  resource     text NOT NULL
                 CHECK (resource IN ('ncrs','inspections','capas','audits')),
  format       text NOT NULL CHECK (format IN ('csv')),
  filters      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','processing','completed','failed')),
  row_count    int,
  bucket       text,
  object_key   text,
  byte_size    bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  error        text,
  requested_by uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz
);
-- Leading tenant_id index (rule 2). The list endpoint pages newest-first.
CREATE INDEX IF NOT EXISTS exports_tenant_created_idx ON exports (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exports_tenant_status_idx  ON exports (tenant_id, status);

-- Composite member FK: (tenant_id, requested_by) -> memberships(tenant_id, user_id).
ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_requested_by_member_fk;
ALTER TABLE exports ADD CONSTRAINT exports_requested_by_member_fk
  FOREIGN KEY (tenant_id, requested_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- Tenant isolation (02 §1). check-rls.ts enumerates tenant tables dynamically,
-- so this table is in scope by default and would fail CI without the policy.
SELECT apply_tenant_rls('exports');

-- The status transitions (queued → processing → completed/failed) are driven
-- only by the worker, never by concurrent user edits, so this table needs no
-- lock_version / bump trigger — there is no user-facing update path to race.
