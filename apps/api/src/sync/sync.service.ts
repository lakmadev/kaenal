import type { PoolClient } from "pg";
import type { InspectionSyncDelta, NcrSyncDelta, SyncHealthBody } from "@kaenal/types";

import { INSPECTION_COLUMNS, toInspectionDto, type InspectionRow } from "../inspections/inspections.service.js";
import { NCR_COLUMNS, NCR_NAME_SUBSELECTS, toNcrDto, type NcrRow } from "../ncr/ncr.service.js";
import { pullDelta } from "./delta.js";

const DEFAULT_LIMIT = 100;

/** Devices quieter than this are treated as gone and excluded from the tile. */
const STALE_REPORT = "24 hours";

/** Tenant-wide count of parked writes across devices reporting recently. Feeds the
 *  admin dashboard's "Failed syncs" tile; RLS scopes it to the caller's tenant. */
export async function failedSyncsCount(tx: PoolClient): Promise<number> {
  const { rows } = await tx.query<{ n: number }>(
    `SELECT COALESCE(SUM(failed + needs_review), 0)::int AS n
       FROM device_sync_status
      WHERE reported_at > now() - interval '${STALE_REPORT}'`,
    [],
  );
  return rows[0]?.n ?? 0;
}

/**
 * Delta-sync read path (05 §2.1) — the server half of the mobile offline mirror.
 *
 * Each synced entity is one `pullDelta` call with the entity's own columns +
 * mapper (reused from its service, never re-shaped here). Tenant scoping is RLS:
 * the request tx already `SET LOCAL app.tenant_id`, so a pull only ever sees the
 * caller's tenant — cross-tenant rows are invisible, never 403'd.
 */
export class SyncService {
  async ncr(tx: PoolClient, cursor: string | undefined, limit?: number): Promise<NcrSyncDelta> {
    return pullDelta<NcrRow, NcrSyncDelta["changed"][number]>(
      tx,
      { table: "ncrs", columns: `${NCR_COLUMNS}${NCR_NAME_SUBSELECTS}`, map: toNcrDto },
      cursor,
      limit ?? DEFAULT_LIMIT,
    );
  }

  async inspections(tx: PoolClient, cursor: string | undefined, limit?: number): Promise<InspectionSyncDelta> {
    return pullDelta<InspectionRow, InspectionSyncDelta["changed"][number]>(
      tx,
      { table: "inspections", columns: INSPECTION_COLUMNS, map: toInspectionDto },
      cursor,
      limit ?? DEFAULT_LIMIT,
    );
  }

  /** Record a device's current sync health for the caller's workspace (05 §M5).
   *  Last-write-wins upsert keyed by (tenant, user, device) — a live gauge, not a
   *  log. The composite member FK stamps the row's tenant from the caller's own
   *  membership, so a device can only ever report against its signed-in tenant. */
  async reportHealth(tx: PoolClient, userId: string, body: SyncHealthBody): Promise<{ ok: boolean }> {
    await tx.query(
      `INSERT INTO device_sync_status (tenant_id, user_id, device_id, failed, needs_review, last_synced_at, reported_at)
       VALUES (current_setting('app.tenant_id')::uuid, $1, $2, $3, $4, $5, now())
       ON CONFLICT (tenant_id, user_id, device_id)
         DO UPDATE SET failed = EXCLUDED.failed, needs_review = EXCLUDED.needs_review,
           last_synced_at = EXCLUDED.last_synced_at, reported_at = now()`,
      [userId, body.deviceId, body.failed, body.needsReview, body.lastSyncedAt ?? null],
    );
    return { ok: true };
  }
}
