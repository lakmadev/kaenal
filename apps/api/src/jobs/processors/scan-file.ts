import type pg from "pg";
import { withAudit, withTenant } from "@kaenal/db";
import type { ScanStatus } from "@kaenal/types";
import type { NotificationsService } from "../../notifications/notifications.service.js";
import type { ScanFileJob } from "../job-types.js";
import type { Scanner } from "../ports.js";

/**
 * AV scan (06 §1 `files`). Scans a completed upload and flips its `scan_status`;
 * an infected verdict notifies the uploader (07 §3 — infected files are never
 * downloadable, by anyone). Idempotent: a file already scanned (status not
 * `pending`) is skipped, so a retry cannot re-flip a verdict. The scan result
 * is audited as a `system` actor.
 */
export async function scanFile(
  payload: ScanFileJob,
  deps: { scanner: Scanner; notifications: NotificationsService; pool?: pg.Pool | undefined },
): Promise<{ status: ScanStatus }> {
  return withTenant(payload.tenantId, null, async (tx) => {
    const { rows } = await tx.query<{
      id: string;
      filename: string;
      key: string;
      scan_status: string;
      uploaded_by: string | null;
    }>(
      "SELECT id, filename, key, scan_status, uploaded_by FROM files WHERE id = $1 AND deleted_at IS NULL",
      [payload.fileId],
    );
    const file = rows[0];
    if (file === undefined) return { status: "pending" }; // deleted before the scan ran
    if (file.scan_status !== "pending") return { status: file.scan_status as ScanStatus }; // already scanned

    const verdict = await deps.scanner.scan({ filename: file.filename, key: file.key });

    await withAudit(
      tx,
      payload.tenantId,
      {
        actorId: null,
        actorKind: "system",
        entityKind: "file",
        entityId: file.id,
        action: "updated",
        before: { scanStatus: "pending" },
        after: { scanStatus: verdict },
      },
      (t) => t.query("UPDATE files SET scan_status = $2 WHERE id = $1", [file.id, verdict]),
    );

    if (verdict === "infected" && file.uploaded_by !== null) {
      await deps.notifications.notify(tx, payload.tenantId, {
        userId: file.uploaded_by,
        kind: "file_infected",
        title: `Upload "${file.filename}" failed a malware scan`,
        entityKind: "file",
        entityId: file.id,
        dedupeKey: `file-infected:${file.id}`,
      });
    }

    return { status: verdict };
  }, deps.pool);
}
