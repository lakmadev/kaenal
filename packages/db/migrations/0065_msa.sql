-- ===========================================================================
-- 0065_msa — Sprint 04 Slice 1 (M1/M2; P15 backend, finally built).
-- SPRINT-04-risk-msa.md §3.2 (user-approved 2026-09-28) + §3-Addendum
-- (`completed_at` delta-approved) + §2 M1/M2.
--
-- Two new tenant-scoped tables: `msa_studies` (the study header — dimensions,
-- method, status) and `msa_measurements` (one row per appraiser/part/trial
-- grid cell). The AIAG variance-component math itself lives in
-- `packages/core/gauge-rr.ts` (pure, unit-tested) and is NEVER stored
-- pre-computed — `GET /v1/msa-studies/:id/analysis` always recomputes from
-- these rows so a measurement edit is always reflected (M1 AC3).
--
-- `gauge_label` is plain free text this sprint, not an FK: P15's own draft
-- named an `instrument_id -> calibration [P16]` FK, but P16 (Sprint 05) does
-- not exist yet. Building a fake FK or a stub calibration table would be
-- scope creep into a module three sprints away (§3.2's named deviation).
--
-- `n_appraisers`/`n_parts`/`n_trials` bounds: the DB only enforces the shared
-- sanity floor (all three > 0). The method-dependent bounds (average_range:
-- trials/appraisers in {2,3}, parts in [2,10]; crossed_anova: all >= 2; both
-- methods: <= 10/50/10) are NOT expressible as a clean CHECK ("if method=X
-- then range Y, if method=Z then range W") and are enforced in the shared
-- packages/types Zod schema + MsaService (M1 AC4/AC5, M2 AC4) — this is a
-- deliberate DB/app split, not an oversight.
-- ===========================================================================

-- --- MSA studies --------------------------------------------------------

CREATE TABLE IF NOT EXISTS msa_studies (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id      uuid NOT NULL,
  -- MSA-YYYY-NNNN, sequenced per-tenant-per-year via the `counters` table
  -- (packages/core/src/codes.ts `CodeKind: "msa"`) — never client-supplied.
  code           text NOT NULL,
  -- The measured characteristic, which also serves as the study's display
  -- title (the sprint's own M2 AC3 immutable-fields list names only
  -- `characteristic`, not a separate `title` — one column, not two).
  characteristic text NOT NULL,
  -- Free-text instrument name (e.g. "Zeiss Contura") — not a linked record
  -- this sprint (§3.2's named FK deviation, above).
  gauge_label    text NOT NULL,
  method         text NOT NULL CHECK (method IN ('crossed_anova', 'average_range')),
  n_appraisers   int  NOT NULL,
  n_parts        int  NOT NULL,
  n_trials       int  NOT NULL,
  -- Drives %Tolerance; NULL when the study declares no tolerance (renders "—").
  tolerance      numeric,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  -- Set on first draft->completed transition; overwritten (not cleared) on a
  -- later reopen + re-complete cycle (§3-Addendum rules 1-3; M2 AC3/AC5).
  completed_at   timestamptz,
  owner          uuid NOT NULL,
  lock_version   int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  deleted_at     timestamptz,
  -- DB-level sanity floor only (see header note); method-dependent bounds and
  -- the shared upper cap (10/50/10) are enforced in packages/types + MsaService.
  CHECK (n_appraisers > 0 AND n_parts > 0 AND n_trials > 0),
  -- Composite-FK target so msa_measurements references a study inside the same tenant.
  UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS msa_studies_tenant_code_uq ON msa_studies (tenant_id, code);

-- General leading-tenant_id index (rule 2 / 02 §6 lint); also the list's
-- natural read pattern (M4 — most-recent studies first).
CREATE INDEX IF NOT EXISTS msa_studies_tenant_idx ON msa_studies (tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS msa_studies_bump_lock_version ON msa_studies;
CREATE TRIGGER msa_studies_bump_lock_version BEFORE UPDATE ON msa_studies
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE msa_studies DROP CONSTRAINT IF EXISTS msa_studies_owner_member_fk;
ALTER TABLE msa_studies ADD CONSTRAINT msa_studies_owner_member_fk
  FOREIGN KEY (tenant_id, owner) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE msa_studies DROP CONSTRAINT IF EXISTS msa_studies_created_by_member_fk;
ALTER TABLE msa_studies ADD CONSTRAINT msa_studies_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE msa_studies DROP CONSTRAINT IF EXISTS msa_studies_updated_by_member_fk;
ALTER TABLE msa_studies ADD CONSTRAINT msa_studies_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('msa_studies');

-- --- MSA measurements (grid cells) ------------------------------------------

CREATE TABLE IF NOT EXISTS msa_measurements (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL,
  study_id   uuid NOT NULL,
  appraiser  int  NOT NULL,
  part       int  NOT NULL,
  trial      int  NOT NULL,
  value      numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  -- One value per grid cell. Index-range and completed-study guards are
  -- app-level (M2 AC2(b)) since they need the parent study's own row, not
  -- just this table's shape.
  UNIQUE (tenant_id, study_id, appraiser, part, trial)
);

-- Leading-tenant_id (isolation contract); also the natural per-study read
-- pattern for rebuilding the grid / recomputing the analysis.
CREATE INDEX IF NOT EXISTS msa_measurements_tenant_idx ON msa_measurements (tenant_id, study_id);

ALTER TABLE msa_measurements DROP CONSTRAINT IF EXISTS msa_measurements_study_fk;
ALTER TABLE msa_measurements ADD CONSTRAINT msa_measurements_study_fk
  FOREIGN KEY (tenant_id, study_id) REFERENCES msa_studies (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE msa_measurements DROP CONSTRAINT IF EXISTS msa_measurements_created_by_member_fk;
ALTER TABLE msa_measurements ADD CONSTRAINT msa_measurements_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE msa_measurements DROP CONSTRAINT IF EXISTS msa_measurements_updated_by_member_fk;
ALTER TABLE msa_measurements ADD CONSTRAINT msa_measurements_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('msa_measurements');
