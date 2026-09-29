-- ===========================================================================
-- 0067_composite_fk_prereqs — Sprint 05 Slice 2 prerequisite for 0068-0070.
-- SPRINT-05-calibration-training.md §3.1 items 1/2 (B2, Round 2 amendment).
--
-- `plants`, `areas`, `ncrs`, `files` carry no `UNIQUE (tenant_id, id)` today —
-- independently confirmed this session via `\d plants`/`\d areas`/`\d ncrs`/
-- `\d files` against the live Postgres 16 instance (not just grepping
-- 0001_core.sql): `plants` only has `plants_tenant_code_uq`, `areas` has no
-- unique constraint at all beyond its bare `id` PK, `ncrs` only has
-- `ncrs_tenant_code_uq`, and `files` only has `files_tenant_bucket_key_uq`.
-- None of them can be the target of a composite FK `(tenant_id, id)`, which
-- every new table in this sprint needs:
--   - instruments.plant_id / instruments.area_id -> plants / areas
--   - calibration_events.certificate_file_id, training_records.evidence_file_id
--     -> files
--   - calibration_events.ncr_id -> ncrs
--
-- This migration adds nothing else — no data change, additive constraint
-- only. Every migration in this sprint's range after this one depends on it
-- (0067 is a real dependency, not just numbering — it must apply first).
-- ===========================================================================

ALTER TABLE plants DROP CONSTRAINT IF EXISTS plants_tenant_id_uq;
ALTER TABLE plants ADD CONSTRAINT plants_tenant_id_uq UNIQUE (tenant_id, id);

ALTER TABLE areas DROP CONSTRAINT IF EXISTS areas_tenant_id_uq;
ALTER TABLE areas ADD CONSTRAINT areas_tenant_id_uq UNIQUE (tenant_id, id);

ALTER TABLE ncrs DROP CONSTRAINT IF EXISTS ncrs_tenant_id_uq;
ALTER TABLE ncrs ADD CONSTRAINT ncrs_tenant_id_uq UNIQUE (tenant_id, id);

ALTER TABLE files DROP CONSTRAINT IF EXISTS files_tenant_id_uq;
ALTER TABLE files ADD CONSTRAINT files_tenant_id_uq UNIQUE (tenant_id, id);
