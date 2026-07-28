-- ===========================================================================
-- 0018_entity_links — cross-module "related records" (FEATURES §329, §9).
--
-- The linkage graph relates records across modules: a document is cited by an
-- NCR, sampled in an audit, referenced by an inspection. Nothing in the schema
-- expressed that directly, so this adds a generic directed edge between two
-- top-level records. The detail view of a record queries edges touching it on
-- EITHER side, so a link is stored once and read from both ends.
--
-- Also registers the `linked`/`unlinked` audit actions (01 §4 — every audited
-- action is a closed enum), mirroring AuditAction in packages/types.
-- ===========================================================================

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_ck;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_ck CHECK (
  action IN (
    'created',
    'updated',
    'status_changed',
    'assigned',
    'commented',
    'file_attached',
    'file_downloaded',
    'signed',
    'exported',
    'deleted',
    'restored',
    'purged',
    'linked',
    'unlinked',
    'signed_in',
    'sign_in_failed',
    'signed_out',
    'role_changed',
    'settings_changed',
    'entitlement_changed',
    'ai_draft_accepted',
    'support_accessed'
  )
);

CREATE TABLE IF NOT EXISTS entity_links (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id  uuid NOT NULL,
  from_kind  text NOT NULL
               CHECK (from_kind IN ('inspection','ncr','eight_d','audit','capa','document','supplier')),
  from_id    uuid NOT NULL,
  to_kind    text NOT NULL
               CHECK (to_kind IN ('inspection','ncr','eight_d','audit','capa','document','supplier')),
  to_id      uuid NOT NULL,
  relation   text NOT NULL DEFAULT 'linked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  -- A record cannot link to itself.
  CONSTRAINT entity_links_no_self CHECK (NOT (from_kind = to_kind AND from_id = to_id))
);

-- One live edge per (from, to, relation); a re-link after removal is allowed
-- because the unique index ignores soft-deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS entity_links_uq
  ON entity_links (tenant_id, from_kind, from_id, to_kind, to_id, relation)
  WHERE deleted_at IS NULL;

-- Both directions need a leading-tenant_id index (rule 2): the detail view of a
-- record reads edges where it is the `from` OR the `to`.
CREATE INDEX IF NOT EXISTS entity_links_from_idx ON entity_links (tenant_id, from_kind, from_id);
CREATE INDEX IF NOT EXISTS entity_links_to_idx   ON entity_links (tenant_id, to_kind, to_id);

-- Composite member FK (created after 0003, so wired by hand like exports).
ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_created_by_member_fk;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_created_by_member_fk
  FOREIGN KEY (tenant_id, created_by) REFERENCES memberships (tenant_id, user_id)
  ON DELETE RESTRICT;

-- Tenant isolation (02 §1). check-rls.ts enumerates tenant tables dynamically,
-- so this table is in scope by default and would fail CI without the policy.
SELECT apply_tenant_rls('entity_links');
