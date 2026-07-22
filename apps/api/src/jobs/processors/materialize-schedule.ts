import { withTenant } from "@kaenal/db";
import type { InspectionsService } from "../../inspections/inspections.service.js";
import type { MaterializeScheduleJob } from "../job-types.js";

/**
 * Schedule materialisation (06 §1 `schedule`). For one tenant, expand every
 * recurring inspection series head into occurrence inspections 14 days ahead,
 * idempotent on `(seriesId, date)` — the hourly re-run creates only the days
 * that have newly entered the window. Opens a tenant-scoped transaction, so the
 * expansion sees (and writes) only this tenant's rows under RLS.
 */
export async function materializeScheduleForTenant(
  payload: MaterializeScheduleJob,
  deps: { inspections: InspectionsService; now?: Date },
): Promise<{ created: number }> {
  const now = deps.now ?? new Date();
  return withTenant(payload.tenantId, null, (tx) =>
    deps.inspections.materializeDueOccurrences(tx, payload.tenantId, now),
  );
}
