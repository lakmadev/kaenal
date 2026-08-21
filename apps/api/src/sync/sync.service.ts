import type { PoolClient } from "pg";
import type { InspectionSyncDelta, NcrSyncDelta } from "@kaenal/types";

import { INSPECTION_COLUMNS, toInspectionDto, type InspectionRow } from "../inspections/inspections.service.js";
import { NCR_COLUMNS, NCR_NAME_SUBSELECTS, toNcrDto, type NcrRow } from "../ncr/ncr.service.js";
import { pullDelta } from "./delta.js";

const DEFAULT_LIMIT = 100;

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
}
