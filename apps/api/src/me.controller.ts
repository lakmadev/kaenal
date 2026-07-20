import { Controller, Get } from "@nestjs/common";
import { capabilitiesFor, type Capability } from "@kaenal/core";
import { currentContext } from "./context.js";
import { ApiError } from "./errors.js";

/**
 * `GET /v1/me` (03 §3) — who the caller is and what their role permits.
 *
 * The capability list is what the UI uses to hide controls the role cannot
 * use. It is a rendering hint only: every one of these capabilities is
 * re-checked server-side on the route that uses it, because a client is free
 * to ignore what this returns.
 *
 * Exists now, ahead of the auth module, as the first route that proves the
 * lifecycle end to end: it resolves a tenant and runs inside the scoped
 * transaction, and today always 401s because nothing can authenticate yet.
 */
@Controller("v1")
export class MeController {
  @Get("me")
  me(): {
    userId: string;
    tenantSlug: string;
    role: string;
    capabilities: readonly Capability[];
  } {
    const ctx = currentContext();

    if (ctx.userId === null || ctx.membership === null) {
      throw new ApiError("UNAUTHENTICATED", "Authentication required");
    }

    return {
      userId: ctx.userId,
      tenantSlug: ctx.tenantSlug,
      role: ctx.membership.role,
      capabilities: capabilitiesFor(ctx.membership.role),
    };
  }
}
