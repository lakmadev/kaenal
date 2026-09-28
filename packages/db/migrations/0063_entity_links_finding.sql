-- ===========================================================================
-- 0063_entity_links_finding — Sprint 03 Part A (G1 AC4): `finding` becomes a
-- first-class node in the cross-module linkage graph.
--
-- `findings` (0001) already exists and is exactly the jsx's `finding` node
-- type, but `entity_links` (0018) never allowed `finding` on either side of an
-- edge. This widens both CHECK constraints so an inspection->finding edge (at
-- finding creation) and a finding->ncr edge (when an NCR is raised from a
-- finding) can be written like every other entity_links row.
--
-- Numbered 0063, not the architecture review's provisional 0062: Part B's
-- `feat/s3-predictive-backend` (0062_risk_predictions.sql) landed first —
-- exactly the collision correction #4 warned about — so this took the next
-- free number instead of renumbering Part B.
-- ===========================================================================

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_from_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_from_kind_check
  CHECK (from_kind IN ('inspection','ncr','eight_d','audit','capa','document','supplier','finding'));

ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS entity_links_to_kind_check;
ALTER TABLE entity_links ADD CONSTRAINT entity_links_to_kind_check
  CHECK (to_kind IN ('inspection','ncr','eight_d','audit','capa','document','supplier','finding'));
