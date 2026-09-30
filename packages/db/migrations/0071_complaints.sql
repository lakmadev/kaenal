-- ===========================================================================
-- 0071_complaints — Sprint 06 (C1/C2/C3/C4; P18 backend, finally built).
-- SPRINT-06-complaints-ecn.md §3.1 (user-approved 2026-09-30, re-approved
-- per §0's amendment) + §2 C1 AC1, C2 AC1, C4 AC1/AC2.
--
-- One new tenant-scoped table (`complaints`) plus its attachment join table
-- (`complaint_attachments`), the composite-FK prerequisites `eight_ds`/`capas`
-- were still missing (`ncrs`/`files` already got theirs in 0067), two new
-- unconstrained columns on `eight_ds` (`source`/`source_id`, mirroring
-- `ncrs.source`/`source_id`'s loose pattern) so a complaint can raise an 8D
-- directly, and a widening of `entity_links`'s CHECK constraints so `complaint`
-- becomes a real graph node.
--
-- Composite FKs, not plain (§0 S1 — supersedes the original plan to reuse
-- `audit_findings.ncr_id`/`capa_id`'s plain-FK precedent): C4's "link to an
-- existing NCR" (§0 B8c) accepts a client-supplied `existingNcrId`, and a
-- plain FK can't be trusted to have already scoped that id — Postgres FK
-- checks bypass RLS. `complaints` therefore gets its own `UNIQUE (tenant_id,
-- id)` (self-consistency, so `complaint_attachments` can composite-FK into
-- it), and `eight_ds`/`capas` each need the same prerequisite added here,
-- confirmed missing today (§1a).
--
-- No `customer_color` column (§0 S6) — a cheap, derivable display value is
-- computed on read by `packages/core/customer-color.ts`, never stored,
-- matching this codebase's own established norm (`rbac.ts`'s carried-over
-- C1a comment). No `plant_id` column — a customer complaint is not tied to
-- one physical plant (mirrors document/capa/supplier precedent). SLA targets
-- (`sla_target_hours`/`sla_close_target_days`) ARE real, stored, denormalized
-- columns — copied from the severity's fixed SLA-matrix config (a
-- `packages/core` lookup, not a DB table — P18 doesn't ask for
-- tenant-configurability) at creation time, mirroring Sprint 05 T1 AC1's
-- `training_records.valid_months` denormalization precedent exactly: a later
-- change to the matrix must never retroactively alter an existing complaint's
-- own due dates.
-- ===========================================================================

-- --- Composite-FK prerequisites: eight_ds / capas didn't have one yet -------
-- (`ncrs`/`files` already got theirs in 0067_composite_fk_prereqs.sql.)

ALTER TABLE eight_ds DROP CONSTRAINT IF EXISTS eight_ds_tenant_id_uq;
ALTER TABLE eight_ds ADD CONSTRAINT eight_ds_tenant_id_uq UNIQUE (tenant_id, id);

ALTER TABLE capas DROP CONSTRAINT IF EXISTS capas_tenant_id_uq;
ALTER TABLE capas ADD CONSTRAINT capas_tenant_id_uq UNIQUE (tenant_id, id);

-- --- eight_ds gains a loose "source" pair (§2 C4 AC1) -----------------------
-- Unconstrained, matching ncrs.source/source_id's own loose pattern — always
-- set internally by ComplaintsService.convert, never a client-supplied field.

ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE eight_ds ADD COLUMN IF NOT EXISTS source_id uuid;

-- --- Complaints --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS complaints (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id              uuid NOT NULL,
  -- COM-YYYY-NNNN, sequenced per-tenant-per-year via the `counters` table
  -- (packages/core/src/codes.ts `CodeKind: "complaint"`) — never client-supplied.
  code                   text NOT NULL,
  -- Free text — P18 §2 defines no customer master table; a customer is
  -- whatever string the loggist types. `customerColor` is derived from this
  -- on read, never stored (§0 S6).
  customer               text NOT NULL,
  -- Single free-text field (e.g. "Magnus Eriksson · Quality Manager") —
  -- matches the list's own display format; not split into name/title columns.
  contact                text NOT NULL,
  -- The jsx's own 5 `via` display values, exactly (§2 C1 AC1).
  channel                text NOT NULL
                           CHECK (channel IN ('portal', 'email_parsed', 'web_form', 'edi', 'phone')),
  severity               text NOT NULL
                           CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status                 text NOT NULL DEFAULT 'triage'
                           CHECK (status IN ('triage', 'investigation', '8d', 'capa', 'closed')),
  subject                text NOT NULL,
  description            text NOT NULL DEFAULT '',
  -- Free text — the jsx's own 'multiple' value for one row proves this isn't
  -- a single-batch identifier format.
  batch_ref              text,
  received_at            timestamptz NOT NULL DEFAULT now(),
  acknowledged_at        timestamptz,
  closed_at              timestamptz,
  -- Captured later via edit, never at intake — no cost field is drawn in
  -- IntakeForm, and real cost is rarely known at the moment a complaint is
  -- logged.
  cost_usd               numeric(12, 2) CHECK (cost_usd IS NULL OR cost_usd >= 0),
  -- Denormalized at creation from the severity's SLA-matrix config at that
  -- moment (§3.1's fixed 1h/4h/24h/48h ack, 14/21/45/90d close table) — a
  -- later change to the matrix must never retroactively alter an existing
  -- complaint's own due dates (mirrors training_records.valid_months, T1 AC1).
  sla_target_hours       int NOT NULL,
  sla_close_target_days  int NOT NULL,
  -- Frozen: no route reassigns it this sprint (§0 S4) — not PATCHable.
  owner                  uuid NOT NULL,
  -- Composite FKs (§0 S1), all NULL until C4's convert route sets them
  -- one-time via a `WHERE ... IS NULL` guard. A complaint can carry more than
  -- one for traceability (converting to a chronologically-behind target does
  -- not clear an already-set one).
  ncr_id                 uuid,
  eight_d_id             uuid,
  capa_id                uuid,
  search_vector          tsvector GENERATED ALWAYS AS (
                           setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
                           setweight(to_tsvector('english', coalesce(subject, '')), 'B') ||
                           setweight(to_tsvector('english', coalesce(customer, '')), 'B') ||
                           setweight(to_tsvector('english', coalesce(description, '')), 'C')
                         ) STORED,
  lock_version           int NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_by             uuid,
  deleted_at             timestamptz,
  -- Composite-FK target so complaint_attachments references a complaint
  -- inside the same tenant (self-consistency, C2 AC1).
  UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS complaints_tenant_code_uq ON complaints (tenant_id, code);

-- General leading-tenant_id index (rule 2 / 02 §6 lint); also the register's
-- own natural read pattern (§2 C1 UC — "sorted by received_at desc").
CREATE INDEX IF NOT EXISTS complaints_tenant_received_idx
  ON complaints (tenant_id, received_at DESC);

-- Supports the 4 filter tabs' counts and the register's status filter.
CREATE INDEX IF NOT EXISTS complaints_tenant_status_idx ON complaints (tenant_id, status);

-- Supports the "Mine" tab (owner = caller's membership id).
CREATE INDEX IF NOT EXISTS complaints_tenant_owner_idx ON complaints (tenant_id, owner);

CREATE INDEX IF NOT EXISTS complaints_search_idx ON complaints USING gin (search_vector);

DROP TRIGGER IF EXISTS complaints_bump_lock_version ON complaints;
CREATE TRIGGER complaints_bump_lock_version BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- Every user reference is a composite FK to memberships(tenant_id, user_id),
-- never a plain FK to control.users (settled architecture decision).
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_owner_member_fk;
ALTER TABLE complaints ADD CONSTRAINT complaints_owner_member_fk
  FOREIGN KEY (tenant_id, owner) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_created_by_member_fk;
ALTER TABLE complaints ADD CONSTRAINT complaints_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_updated_by_member_fk;
ALTER TABLE complaints ADD CONSTRAINT complaints_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

-- Composite FKs to the convert targets (§0 S1) — required, not optional,
-- because C4's "link to an existing NCR" accepts a client-supplied id.
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_ncr_fk;
ALTER TABLE complaints ADD CONSTRAINT complaints_ncr_fk
  FOREIGN KEY (tenant_id, ncr_id) REFERENCES ncrs (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_eight_d_fk;
ALTER TABLE complaints ADD CONSTRAINT complaints_eight_d_fk
  FOREIGN KEY (tenant_id, eight_d_id) REFERENCES eight_ds (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_capa_fk;
ALTER TABLE complaints ADD CONSTRAINT complaints_capa_fk
  FOREIGN KEY (tenant_id, capa_id) REFERENCES capas (tenant_id, id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('complaints');

-- --- Complaint attachments (§2 C2 AC1) ---------------------------------------
-- Attachments can be added only at creation this sprint (§0 S5) — no separate
-- "add attachment later" route exists, so this table is written once, in the
-- same transaction as the complaint insert.

CREATE TABLE IF NOT EXISTS complaint_attachments (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id     uuid NOT NULL,
  complaint_id  uuid NOT NULL,
  file_id       uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  -- Prevents a duplicate attachment row (§0 S5).
  UNIQUE (tenant_id, complaint_id, file_id)
);

-- Leading-tenant_id (isolation contract) AND the detail panel's own
-- per-complaint attachment-list read pattern.
CREATE INDEX IF NOT EXISTS complaint_attachments_tenant_complaint_idx
  ON complaint_attachments (tenant_id, complaint_id);

ALTER TABLE complaint_attachments DROP CONSTRAINT IF EXISTS complaint_attachments_complaint_fk;
ALTER TABLE complaint_attachments ADD CONSTRAINT complaint_attachments_complaint_fk
  FOREIGN KEY (tenant_id, complaint_id) REFERENCES complaints (tenant_id, id) ON DELETE CASCADE;
-- `files` already has UNIQUE (tenant_id, id) from Sprint 05's
-- 0067_composite_fk_prereqs.sql — no prerequisite needed here.
ALTER TABLE complaint_attachments DROP CONSTRAINT IF EXISTS complaint_attachments_file_fk;
ALTER TABLE complaint_attachments ADD CONSTRAINT complaint_attachments_file_fk
  FOREIGN KEY (tenant_id, file_id) REFERENCES files (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE complaint_attachments DROP CONSTRAINT IF EXISTS complaint_attachments_created_by_member_fk;
ALTER TABLE complaint_attachments ADD CONSTRAINT complaint_attachments_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('complaint_attachments');

-- --- entity_links: complaint becomes a real graph node -----------------------
-- Mirrors 0064_risk_register.sql's exact pattern for `risk`/`fmea`. Last
-- widened by 0064 — no sprint since has touched this constraint (§1a).

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_from_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_from_kind_check
  CHECK (from_kind IN ('inspection', 'ncr', 'eight_d', 'audit', 'capa', 'document', 'supplier',
                        'finding', 'risk', 'fmea', 'complaint'));

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_to_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_to_kind_check
  CHECK (to_kind IN ('inspection', 'ncr', 'eight_d', 'audit', 'capa', 'document', 'supplier',
                      'finding', 'risk', 'fmea', 'complaint'));
