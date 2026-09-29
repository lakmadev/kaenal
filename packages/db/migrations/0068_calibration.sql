-- ===========================================================================
-- 0068_calibration — Sprint 05 Slice 2 (C1/C2/C3; P16 backend, finally built).
-- SPRINT-05-calibration-training.md §3.1 (user-approved 2026-09-29) + §2
-- C1 AC1/AC2, C2 AC1/AC2, C3 AC1. Depends on 0067 (composite-FK prereqs on
-- plants/areas/ncrs/files).
--
-- Two new tenant-scoped tables (`instruments`, `calibration_events`) plus a
-- widening of `ncrs.source`'s CHECK constraint so a real NCR can be raised
-- from an out-of-tolerance calibration event (C3 AC1).
--
-- `instruments.code` uses the `CAL-YYYY-NNNN` format via `codes.ts`/`counters`
-- (`CodeKind: "instrument"`, already added in Slice 1). `next_due` is a
-- GENERATED column driven by `make_interval(months => interval_months)`, NOT
-- a text-cast interval — the text-cast form throws "generation expression is
-- not immutable" on Postgres 16 (§3.1 item 13, B1). `last_result` always
-- mirrors the newest calibration event's own result (ordered by
-- `(performed_at DESC, created_at DESC)`, C2 AC2's exact tie-break, §3.1 item
-- 14) and drives `instrumentDueStatus`'s unconditional `overdue` override for
-- a `fail` — a `fail` never advances `last_calibrated`/`next_due` (B3, the
-- real IATF 7.1.5 correctness fix this sprint centers on).
--
-- `owner` is nullable: C5 AC1's `calibration-due` job explicitly "notifies
-- owner (skip if null)", mirroring `document-expiry`'s own "no one to remind"
-- skip — an instrument can exist before an owner is assigned.
-- ===========================================================================

-- --- Instruments -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS instruments (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id        uuid NOT NULL,
  -- CAL-YYYY-NNNN, sequenced per-tenant-per-year via the `counters` table
  -- (packages/core/src/codes.ts `CodeKind: "instrument"`) — never client-supplied.
  code             text NOT NULL,
  name             text NOT NULL,
  type             text NOT NULL
                     CHECK (type IN ('cmm', 'comparator', 'profilometer', 'ndt', 'caliper',
                                      'torque', 'laser_tracker')),
  -- Every physical instrument belongs to one plant; area is an optional finer
  -- location (must belong to plant_id when set — enforced in the service, not
  -- here, since it needs a cross-row check C4 AC2 also relies on).
  plant_id         uuid NOT NULL,
  area_id          uuid,
  -- Free text — accreditation-body/vendor names are open-ended (§3.1 item 4);
  -- no structured vendor table this sprint.
  method           text NOT NULL,
  -- Free text display string (e.g. "±1.7μm") — units vary by instrument type
  -- and nothing ever computes against it, unlike MSA's numeric tolerance.
  tolerance        text NOT NULL,
  interval_months  int  NOT NULL CHECK (interval_months > 0),
  last_calibrated  date,
  -- `make_interval` takes only integer arguments and is genuinely IMMUTABLE
  -- (unlike `(col || ' months')::interval`, which depends on the session's
  -- DateStyle/IntervalStyle and cannot be proven immutable — §3.1 item 13).
  -- NULL propagates when last_calibrated is NULL (a never-calibrated new
  -- instrument has no due date yet, C6). Postgres's own date+interval
  -- month-end clamping (confirmed against a real Postgres 16 instance, not
  -- assumed) must agree exactly with packages/core/calibration.ts's
  -- `nextDueDate` — this is the "SQL and core function agree" DoD line.
  next_due         date GENERATED ALWAYS AS
                     ((last_calibrated + make_interval(months => interval_months))::date) STORED,
  -- Always the newest calibration event's own result (by the C2 AC2 tie-break
  -- order), written in the same transaction as every event-recording call
  -- regardless of outcome — unlike last_calibrated, which only advances on
  -- pass/adjusted (B3/§3.1 item 14).
  last_result      text CHECK (last_result IN ('pass', 'adjusted', 'fail')),
  -- Nullable: C5 AC1's job explicitly skips notifying when owner is null,
  -- mirroring document-expiry's own "no one to remind" skip.
  owner            uuid,
  -- Register lifecycle status (active/retired) — distinct from the *due
  -- status* (ok/warn/overdue/unscheduled), which is never stored (C1 AC2).
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  lock_version     int  NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  updated_by       uuid,
  deleted_at       timestamptz,
  -- Composite-FK target so calibration_events references an instrument
  -- inside the same tenant (self-consistency, B2).
  UNIQUE (tenant_id, id)
);

-- Human-facing code is unique per tenant (leading tenant_id — isolation contract).
CREATE UNIQUE INDEX IF NOT EXISTS instruments_tenant_code_uq ON instruments (tenant_id, code);

-- General leading-tenant_id index (rule 2 / 02 §6 lint); also the register's
-- natural read pattern (most-recently-added first).
CREATE INDEX IF NOT EXISTS instruments_tenant_idx ON instruments (tenant_id, created_at DESC);

-- Supports the plant-scope visibility filter (C1's UC "Plant scope", §3.1 item 3).
CREATE INDEX IF NOT EXISTS instruments_tenant_plant_idx ON instruments (tenant_id, plant_id);

DROP TRIGGER IF EXISTS instruments_bump_lock_version ON instruments;
CREATE TRIGGER instruments_bump_lock_version BEFORE UPDATE ON instruments
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

ALTER TABLE instruments DROP CONSTRAINT IF EXISTS instruments_plant_fk;
ALTER TABLE instruments ADD CONSTRAINT instruments_plant_fk
  FOREIGN KEY (tenant_id, plant_id) REFERENCES plants (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE instruments DROP CONSTRAINT IF EXISTS instruments_area_fk;
ALTER TABLE instruments ADD CONSTRAINT instruments_area_fk
  FOREIGN KEY (tenant_id, area_id) REFERENCES areas (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE instruments DROP CONSTRAINT IF EXISTS instruments_owner_member_fk;
ALTER TABLE instruments ADD CONSTRAINT instruments_owner_member_fk
  FOREIGN KEY (tenant_id, owner) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE instruments DROP CONSTRAINT IF EXISTS instruments_created_by_member_fk;
ALTER TABLE instruments ADD CONSTRAINT instruments_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE instruments DROP CONSTRAINT IF EXISTS instruments_updated_by_member_fk;
ALTER TABLE instruments ADD CONSTRAINT instruments_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('instruments');

-- --- Calibration events -------------------------------------------------------

CREATE TABLE IF NOT EXISTS calibration_events (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL,
  instrument_id       uuid NOT NULL,
  performed_at        date NOT NULL,
  result              text NOT NULL CHECK (result IN ('pass', 'adjusted', 'fail')),
  -- Free text — the jsx shows external lab names ("A2LA Cal Labs"), not
  -- always an internal member; consistent with `method` being free text on
  -- the parent instrument.
  performed_by        text NOT NULL,
  notes               text NOT NULL DEFAULT '',
  -- Sole, authoritative link to a certificate (§3.1 item 16, B7) —
  -- files.entity_kind/entity_id is informational only, never read to resolve
  -- "the certificate". ON DELETE RESTRICT: the files-purge job must never be
  -- able to silently orphan a calibration event (§3.1 item 16, SHOULD-FIX 4).
  certificate_file_id uuid,
  -- Set by C3's raise-NCR route only, one-time via `WHERE ncr_id IS NULL`.
  ncr_id              uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz
);

-- Leading-tenant_id (isolation contract) AND the exact newest-event query
-- pattern C2 AC2/§3.1 item 14 requires: `(performed_at DESC, created_at DESC)`
-- per instrument — this single index serves both the history list ("last 5" /
-- "View all", C4 AC1) and the newest-event tie-break lookup.
CREATE INDEX IF NOT EXISTS calibration_events_tenant_instrument_idx
  ON calibration_events (tenant_id, instrument_id, performed_at DESC, created_at DESC);

ALTER TABLE calibration_events DROP CONSTRAINT IF EXISTS calibration_events_instrument_fk;
ALTER TABLE calibration_events ADD CONSTRAINT calibration_events_instrument_fk
  FOREIGN KEY (tenant_id, instrument_id) REFERENCES instruments (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE calibration_events DROP CONSTRAINT IF EXISTS calibration_events_certificate_file_fk;
ALTER TABLE calibration_events ADD CONSTRAINT calibration_events_certificate_file_fk
  FOREIGN KEY (tenant_id, certificate_file_id) REFERENCES files (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE calibration_events DROP CONSTRAINT IF EXISTS calibration_events_ncr_fk;
ALTER TABLE calibration_events ADD CONSTRAINT calibration_events_ncr_fk
  FOREIGN KEY (tenant_id, ncr_id) REFERENCES ncrs (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE calibration_events DROP CONSTRAINT IF EXISTS calibration_events_created_by_member_fk;
ALTER TABLE calibration_events ADD CONSTRAINT calibration_events_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE calibration_events DROP CONSTRAINT IF EXISTS calibration_events_updated_by_member_fk;
ALTER TABLE calibration_events ADD CONSTRAINT calibration_events_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('calibration_events');

-- --- ncrs.source gains "calibration" (C3 AC1) ---------------------------------
-- Mirrors 0064_risk_register.sql's entity_links CHECK-widening pattern for a
-- new enum member — confirmed additive/safe: no exhaustive NcrSource consumer
-- breaks (unlike EntityKind's own widening risk elsewhere in the codebase).

ALTER TABLE ncrs DROP CONSTRAINT IF EXISTS ncrs_source_check;
ALTER TABLE ncrs ADD CONSTRAINT ncrs_source_check
  CHECK (source IN ('inspection', 'manual', 'complaint', 'audit', 'calibration'));
