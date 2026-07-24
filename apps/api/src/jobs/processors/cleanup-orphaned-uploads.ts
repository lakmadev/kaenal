import type pg from "pg";
import { withTenant, withAudit } from "@kaenal/db";
import type { Storage } from "../../files/storage.js";
import type { CleanupOrphanedUploadsJob } from "../job-types.js";

/**
 * Orphaned-upload cleanup (06 §1 `files`, 03 §7). A presign creates a `pending`
 * `files` row and hands the client a short-TTL PUT URL; if the client never
 * calls `complete`, that row lingers forever (and its object, if the client
 * uploaded but didn't complete, is abandoned garbage). This nightly job garbage-
 * collects those: `pending` rows with no `sha256` (never completed) older than
 * the grace window (03 §7: >24h). A completed-but-unscanned file keeps its
 * `sha256`, so it is never mistaken for an orphan.
 *
 * Safety:
 *  - Rows are locked `FOR UPDATE` before deletion, so a `complete` racing at the
 *    grace boundary blocks and then fails cleanly (its row is gone) rather than
 *    resurrecting a row this job is deleting.
 *  - The object is deleted only AFTER the DB commit — a rolled-back cleanup never
 *    orphans a live row from its bytes; a failed object delete is logged and left
 *    for a later run, never fatal.
 *  - Each deletion writes a `purged` audit event (system actor), closing the
 *    trail that `presign` opened with `created`.
 */

/** How stale a never-completed pending upload must be before it is collected (03 §7). */
const ORPHAN_GRACE_HOURS = 24;

export async function cleanupOrphanedUploadsForTenant(
  payload: CleanupOrphanedUploadsJob,
  deps: { storage: Storage; now?: Date; graceHours?: number; pool?: pg.Pool | undefined },
): Promise<{ cleaned: number }> {
  const now = deps.now ?? new Date();
  const graceHours = deps.graceHours ?? ORPHAN_GRACE_HOURS;
  const cutoff = new Date(now.getTime() - graceHours * 60 * 60 * 1000);

  const keys = await withTenant(payload.tenantId, null, async (tx) => {
    // Lock the candidates so a concurrent `complete` on a boundary row blocks
    // until this transaction commits (then finds the row gone). RLS scopes the
    // read to the tenant; never-completed uploads are unreferenced, so there is
    // no FK to fight.
    const { rows } = await tx.query<{ id: string; key: string }>(
      `SELECT id, key FROM files
        WHERE scan_status = 'pending' AND sha256 IS NULL AND deleted_at IS NULL
          AND created_at < $1
        ORDER BY created_at
        FOR UPDATE`,
      [cutoff],
    );

    const deletedKeys: string[] = [];
    for (const row of rows) {
      await withAudit(
        tx,
        payload.tenantId,
        { actorId: null, actorKind: "system", entityKind: "file", entityId: row.id, action: "purged" },
        (t) => t.query("DELETE FROM files WHERE id = $1", [row.id]),
      );
      deletedKeys.push(row.key);
    }
    return deletedKeys;
  }, deps.pool);

  // Delete the abandoned objects after commit (idempotent; a missing key is a
  // no-op). A failure just leaves an orphan object for the next run.
  for (const key of keys) {
    try {
      await deps.storage.delete(key);
    } catch (err) {
      console.error(`cleanup: failed to delete orphaned object '${key}' (will retry next run):`, err);
    }
  }

  return { cleaned: keys.length };
}
