-- ===========================================================================
-- 0024 — Notification surface extensions (notifications center, notifications.jsx)
--
-- The in-app notifications UI needs three things the base table (0001) did not
-- carry:
--   * starred    — the user can flag a notification to find it later.
--   * actor_id    — who caused the notification (an assigner), so the row can
--                   show their avatar. NULL for system/job notifications
--                   (document_expiring, export_ready, …) which have no actor.
--   * deleted_at  — dismissing a notification is a soft-delete, so it leaves the
--                   inbox without destroying the delivery record.
--
-- All three are plain columns on an existing RLS-forced table (notifications is
-- in the 0001 apply_tenant_rls list), so tenant isolation already covers them —
-- no new policy. actor_id is an unconstrained uuid like entity_id: the actor is
-- always a member of the same tenant and is resolved to a name client-side via
-- /v1/members, so no cross-schema FK is needed.
-- ===========================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS starred    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS actor_id   uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The starred inbox view is a small subset — a partial index keeps it cheap
-- without weighing on the common unread/all listing (served by
-- notifications_tenant_user_idx from 0001).
CREATE INDEX IF NOT EXISTS notifications_tenant_user_starred_idx
  ON notifications (tenant_id, user_id, created_at DESC)
  WHERE starred AND deleted_at IS NULL;
