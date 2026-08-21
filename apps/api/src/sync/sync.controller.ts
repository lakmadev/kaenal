import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SyncQuery, type InspectionSyncDelta, type NcrSyncDelta } from "@kaenal/types";

import { currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { SYNC_SERVICE } from "../tokens.js";
import type { SyncService } from "./sync.service.js";

/**
 * Delta-sync endpoints (05 §2.1) — the mobile offline mirror's read path.
 *
 * `GET /v1/sync/ncr` and `/v1/sync/inspections` return rows changed since an
 * opaque cursor plus tombstoned ids, gated on the module's own `*:view`
 * capability (the same roles that may list the entity). Tenant isolation is RLS
 * inside the request tx; a foreign-tenant cursor simply returns the caller's own
 * rows — it can never surface another tenant's data.
 */
@Controller()
export class SyncController {
  constructor(@Inject(SYNC_SERVICE) private readonly sync: SyncService) {}

  @Get("v1/sync/ncr")
  @RequireCapability("ncr:view")
  async ncr(@Query() query: unknown): Promise<NcrSyncDelta> {
    const q = parse(SyncQuery, query);
    return this.sync.ncr(currentTx(), q.cursor, q.limit);
  }

  @Get("v1/sync/inspections")
  @RequireCapability("inspection:view")
  async inspections(@Query() query: unknown): Promise<InspectionSyncDelta> {
    const q = parse(SyncQuery, query);
    return this.sync.inspections(currentTx(), q.cursor, q.limit);
  }
}
