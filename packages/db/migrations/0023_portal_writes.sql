-- ===========================================================================
-- 0023_portal_writes — admit `partner` as an audit actor kind (P11 slice 2).
--
-- Slice 1 gave external suppliers read-only portal access. Slice 2 adds their
-- narrow, audited WRITES (respond to a SCAR, re-submit a PPAP). Every such write
-- must be attributable to an EXTERNAL actor in the audit trail, distinct from
-- internal staff (`user`), the system, api keys, or support — so `partner`
-- joins the `audit_events.actor_kind` domain.
--
-- audit_events is the RANGE-partitioned table from 0015; the CHECK lives on the
-- parent and covers every partition, so widening it here is enough.
-- ===========================================================================

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_actor_kind_ck;
ALTER TABLE audit_events ADD CONSTRAINT audit_events_actor_kind_ck
  CHECK (actor_kind IN ('user','system','api_key','support','partner'));
