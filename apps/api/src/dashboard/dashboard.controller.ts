import { Controller, Get } from "@nestjs/common";
import type { DashboardDto } from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { ApiError } from "../errors.js";
import { buildDashboard } from "./dashboard.queries.js";

/**
 * `GET /v1/me/dashboard` (05 §M5) — the role-aware mobile home.
 *
 * Returns the dashboard shape for the caller's role (Inspector / Viewer /
 * Manager / Admin; auditor is served the viewer surface). Every metric is
 * computed live inside the request's tenant-scoped transaction, so RLS confines
 * it to the caller's workspace. Presentation is curation only — the same
 * capabilities are re-enforced on every underlying resource.
 *
 * `@Internal`: a supplier-portal `partner` has its own surface and never sees
 * internal QMS aggregates.
 */
@Internal()
@Controller("v1")
export class DashboardController {
  @Get("me/dashboard")
  async dashboard(): Promise<DashboardDto> {
    const ctx = currentContext();
    if (ctx.userId === null || ctx.membership === null) {
      throw new ApiError("UNAUTHENTICATED", "Authentication required");
    }
    return buildDashboard(currentTx(), ctx.membership.role, ctx.userId, ctx.membership.plantIds);
  }
}
