import type pg from "pg";
import { withTenant } from "@kaenal/db";
import { activeExpiryThreshold } from "@kaenal/core";
import type { NotificationsService } from "../../notifications/notifications.service.js";
import type { DocumentExpiryJob } from "../job-types.js";

/**
 * Document expiry reminders (06 §1 `docs`). For one tenant, find approved
 * controlled documents whose `expires_at` has entered a reminder window (≤ 90
 * days out) and notify the owner at the threshold now in effect (90 → 30 → 7).
 * Idempotent: the notification dedupe key is `(document, threshold)`, so the
 * daily re-run never re-sends a reminder the owner already has, and a document
 * only escalates to the next window once. Notifications are a delivery artifact,
 * so — like the rest of the notifications path — this writes no audit events.
 */
export async function documentExpiryCheckForTenant(
  payload: DocumentExpiryJob,
  deps: { notifications: NotificationsService; now?: Date; pool?: pg.Pool | undefined },
): Promise<{ notified: number }> {
  const now = deps.now ?? new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  return withTenant(payload.tenantId, null, async (tx) => {
    // Only approved documents are "in effect" and worth a lapse warning; the
    // 90-day horizon keeps the scan on the (tenant_id, expires_at) index.
    const { rows } = await tx.query<{
      id: string;
      title: string;
      owner_id: string | null;
      expires_at: Date;
    }>(
      `SELECT id, title, owner_id, expires_at
         FROM documents
        WHERE status = 'approved' AND deleted_at IS NULL
          AND expires_at IS NOT NULL AND expires_at <= $1`,
      [horizon],
    );

    let notified = 0;
    for (const doc of rows) {
      if (doc.owner_id === null) continue; // no one to remind
      const threshold = activeExpiryThreshold(doc.expires_at, now);
      if (threshold === null) continue;

      const created = await deps.notifications.notify(tx, payload.tenantId, {
        userId: doc.owner_id,
        kind: "document_expiring",
        title: `Document "${doc.title}" expires within ${threshold} days`,
        entityKind: "document",
        entityId: doc.id,
        dedupeKey: `doc-expiry:${doc.id}:${threshold}`,
      });
      if (created !== null) notified += 1;
    }
    return { notified };
  }, deps.pool);
}
