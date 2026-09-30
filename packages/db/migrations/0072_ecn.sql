-- ===========================================================================
-- 0072_ecn — Sprint 06 (E1/E4/E5; P19 backend, finally built).
-- SPRINT-06-complaints-ecn.md §3.2/§3.2a (user-approved 2026-09-30, re-approved
-- per §0's amendment and decided by §0b's Amendment 2) + §2 E1 AC1, E4 AC1.
--
-- Two new tenant-scoped tables: `ecns` (the change record) and `ecn_approvals`
-- (one row per gated stage of the canonical 7-stage/5-gate machine). Depends
-- on 0071 (this migration's `entity_links` widening builds on 0071's, which
-- added `complaint`).
--
-- `stage` is the canonical 9-value machine (7 ordered pipeline stages plus the
-- two terminal outcomes `closed`/`rejected`), including the real `ppap` gate
-- decided in §0b D1 (`risk_review -> ppap -> cab_approval`) — corrected from
-- the originally-approved 6-stage/4-gate machine, which the jsx's own
-- `ECNList`/`ECNKanban` views disagreed about (§1a/§3.2). `ecn_approvals` has
-- no `role_required` column (§0 S8 — a dead field no service method reads;
-- the fixed, uniform admin/manager-only rule is enforced entirely in
-- `ecnMachine`'s guard). `auto_revise_result` is a real, persisted JSONB
-- column (§0 B3e) — E5's revise/skip outcome must be readable after the fact,
-- not only returned once in the approval response.
--
-- `linkedDocumentCount` (the jsx's "Affected" column) is deliberately NOT a
-- column here — it is computed on read from `entity_links` (§0 B8a), matching
-- this codebase's own norm of never storing a cheap, derivable display value
-- (the same norm `customer_color` follows in 0071, §0 S6). No `plant_id`
-- column — an engineering change is tenant-wide, mirrors document/capa
-- precedent.
-- ===========================================================================

-- --- ECNs --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ecns (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id           uuid NOT NULL,
  -- ECN-YYYY-NNNN, sequenced per-tenant-per-year via the `counters` table
  -- (packages/core/src/codes.ts `CodeKind: "ecn"`) — never client-supplied.
  code                text NOT NULL,
  title               text NOT NULL,
  -- 4 values, corrected from P19's proposed 3 (§3.2) — the jsx's own
  -- `ECNList` fixture uses a 4th ("Material," a supplier bushing swap) and
  -- P19 §5 itself confirms supplier-change ECNs are a real dependency.
  change_type         text NOT NULL
                        CHECK (change_type IN ('design', 'process', 'tooling', 'material')),
  description         text NOT NULL DEFAULT '',
  -- Captured at creation; editable via PATCH only while stage='draft', frozen
  -- once the approval pipeline begins (enforced in the service, not here).
  change_risk         text NOT NULL CHECK (change_risk IN ('low', 'medium', 'high')),
  -- The canonical 7-stage-plus-terminal machine (§3.2, §0b D1 adds `ppap`
  -- between `risk_review` and `cab_approval`) — 9 values total.
  stage               text NOT NULL DEFAULT 'draft'
                        CHECK (stage IN ('draft', 'feasibility', 'risk_review', 'ppap',
                                          'cab_approval', 'pilot', 'implementation',
                                          'closed', 'rejected')),
  -- NOT NULL, defaults to the creating actor (service-set). PATCHable only
  -- while stage='draft' (§0 B2), including a `draft` reached again via
  -- resubmission (§0b D3) — a stage-based rule, not a one-way freeze.
  owner               uuid NOT NULL,
  effective_date      date,
  -- Persisted revise/skip outcome from E5's auto-revise mechanism, set on the
  -- pilot->implementation transition (§0 B3e) — never only a one-time API
  -- response. Shape: { revised: string[]; skipped: { documentId, reason }[] }.
  auto_revise_result  jsonb,
  search_vector       tsvector GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
                        setweight(to_tsvector('english', coalesce(description, '')), 'C')
                      ) STORED,
  lock_version        int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz,
  -- Composite-FK target so ecn_approvals references an ECN inside the same
  -- tenant (self-consistency, E4 AC1).
  UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ecns_tenant_code_uq ON ecns (tenant_id, code);

-- General leading-tenant_id index (rule 2 / 02 §6 lint); also the List view's
-- natural read pattern.
CREATE INDEX IF NOT EXISTS ecns_tenant_created_idx ON ecns (tenant_id, created_at DESC);

-- Supports the Kanban's per-column counts/cards and GET /v1/ecns/summary
-- (E2 AC2 — count(*) group by stage).
CREATE INDEX IF NOT EXISTS ecns_tenant_stage_idx ON ecns (tenant_id, stage);

CREATE INDEX IF NOT EXISTS ecns_search_idx ON ecns USING gin (search_vector);

DROP TRIGGER IF EXISTS ecns_bump_lock_version ON ecns;
CREATE TRIGGER ecns_bump_lock_version BEFORE UPDATE ON ecns
  FOR EACH ROW EXECUTE FUNCTION bump_lock_version();

-- Every user reference is a composite FK to memberships(tenant_id, user_id),
-- never a plain FK to control.users (settled architecture decision).
ALTER TABLE ecns DROP CONSTRAINT IF EXISTS ecns_owner_member_fk;
ALTER TABLE ecns ADD CONSTRAINT ecns_owner_member_fk
  FOREIGN KEY (tenant_id, owner) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE ecns DROP CONSTRAINT IF EXISTS ecns_created_by_member_fk;
ALTER TABLE ecns ADD CONSTRAINT ecns_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE ecns DROP CONSTRAINT IF EXISTS ecns_updated_by_member_fk;
ALTER TABLE ecns ADD CONSTRAINT ecns_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('ecns');

-- --- ECN approvals (§2 E4 AC1) -----------------------------------------------
-- One row per gated stage, all 5 pre-created (pending) in the same
-- transaction as POST /v1/ecns (E3), so "what stage is this ECN on" is always
-- answerable by joining ecns.stage to its matching row.

CREATE TABLE IF NOT EXISTS ecn_approvals (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id    uuid NOT NULL,
  ecn_id       uuid NOT NULL,
  -- The 5 gated values (§0b D1 adds `ppap`) — never the 4 terminal/author-
  -- driven stages, which have no ecn_approvals row at all.
  stage        text NOT NULL
                 CHECK (stage IN ('feasibility', 'risk_review', 'ppap', 'cab_approval', 'pilot')),
  decision     text NOT NULL DEFAULT 'pending'
                 CHECK (decision IN ('pending', 'approved', 'rejected')),
  -- NULL until decided.
  approver     uuid,
  decided_at   timestamptz,
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  deleted_at   timestamptz,
  UNIQUE (tenant_id, ecn_id, stage)
);

-- Leading-tenant_id (isolation contract) AND the approval tracker's own
-- per-ECN read pattern (GET /v1/ecns/:id/approvals, E4 AC6).
CREATE INDEX IF NOT EXISTS ecn_approvals_tenant_ecn_idx ON ecn_approvals (tenant_id, ecn_id);

ALTER TABLE ecn_approvals DROP CONSTRAINT IF EXISTS ecn_approvals_ecn_fk;
ALTER TABLE ecn_approvals ADD CONSTRAINT ecn_approvals_ecn_fk
  FOREIGN KEY (tenant_id, ecn_id) REFERENCES ecns (tenant_id, id) ON DELETE CASCADE;
ALTER TABLE ecn_approvals DROP CONSTRAINT IF EXISTS ecn_approvals_approver_member_fk;
ALTER TABLE ecn_approvals ADD CONSTRAINT ecn_approvals_approver_member_fk
  FOREIGN KEY (tenant_id, approver) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE ecn_approvals DROP CONSTRAINT IF EXISTS ecn_approvals_created_by_member_fk;
ALTER TABLE ecn_approvals ADD CONSTRAINT ecn_approvals_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;
ALTER TABLE ecn_approvals DROP CONSTRAINT IF EXISTS ecn_approvals_updated_by_member_fk;
ALTER TABLE ecn_approvals ADD CONSTRAINT ecn_approvals_updated_by_member_fk
  FOREIGN KEY (tenant_id, updated_by) REFERENCES memberships (tenant_id, user_id) ON DELETE RESTRICT;

SELECT apply_tenant_rls('ecn_approvals');

-- --- entity_links: ecn becomes a real graph node ------------------------------
-- Mirrors 0071_complaints.sql's exact pattern (which mirrored 0064's, for
-- `risk`/`fmea`). Widens the list 0071 just widened to include `complaint`.

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_from_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_from_kind_check
  CHECK (from_kind IN ('inspection', 'ncr', 'eight_d', 'audit', 'capa', 'document', 'supplier',
                        'finding', 'risk', 'fmea', 'complaint', 'ecn'));

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_to_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_to_kind_check
  CHECK (to_kind IN ('inspection', 'ncr', 'eight_d', 'audit', 'capa', 'document', 'supplier',
                      'finding', 'risk', 'fmea', 'complaint', 'ecn'));
