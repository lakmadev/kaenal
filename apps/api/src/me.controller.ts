import { Controller, Get } from "@nestjs/common";
import { capabilitiesFor } from "@kaenal/core";
import type { MeDto, MePlantDto } from "@kaenal/types";
import { currentContext, currentTx } from "./context.js";
import { Internal } from "./decorators.js";
import { ApiError } from "./errors.js";

/**
 * `GET /v1/me` (03 §3) — who the caller is and what their role permits.
 *
 * Assembles the session identity the shell renders: the shared-account profile
 * (name / email / MFA from `control.users`), the active workspace name, the
 * plants this membership is scoped to, and the caller's open-item counts. The
 * capability list is what the UI uses to hide controls the role cannot use — a
 * rendering hint only, since every capability is re-checked server-side.
 *
 * `control.users`/`control.tenants` are readable by the app role (03 §2), and
 * the plant/NCR/CAPA reads run inside the request's tenant transaction, so RLS
 * confines them to the caller's workspace.
 *
 * `@Internal`: the external portal has its own identity endpoint
 * (`/v1/portal/me`); a `partner` never gets the internal MeDto (plants, open
 * NCR/CAPA counts, internal capabilities).
 */
@Internal()
@Controller("v1")
export class MeController {
  @Get("me")
  async me(): Promise<MeDto> {
    const ctx = currentContext();
    if (ctx.userId === null || ctx.membership === null) {
      throw new ApiError("UNAUTHENTICATED", "Authentication required");
    }
    const tx = currentTx();
    const userId = ctx.userId;

    // The request transaction is a single connection, so these run in sequence
    // (pg cannot multiplex concurrent queries on one client).
    const profile = await tx.query<{
      name: string;
      email: string;
      mfa_secret: string | null;
      last_login_at: Date | null;
    }>("SELECT name, email, mfa_secret, last_login_at FROM control.users WHERE id = $1", [userId]);
    const u = profile.rows[0];
    if (u === undefined) throw new ApiError("UNAUTHENTICATED", "Authentication required");

    const tenant = await tx.query<{ name: string }>(
      "SELECT name FROM control.tenants WHERE id = $1",
      [ctx.tenantId],
    );

    const plants =
      ctx.membership.plantIds.length > 0
        ? (
            await tx.query<MePlantDto>(
              `SELECT id, name, code FROM plants
                WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY code`,
              [ctx.membership.plantIds],
            )
          ).rows
        : [];

    const openNcrs = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ncrs
        WHERE owner_id = $1 AND deleted_at IS NULL AND status NOT IN ('resolved','closed','verified')`,
      [userId],
    );
    const openCapas = await tx.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM capas
        WHERE owner_id = $1 AND deleted_at IS NULL AND status <> 'closed'`,
      [userId],
    );

    return {
      userId,
      tenantSlug: ctx.tenantSlug,
      tenantName: tenant.rows[0]?.name ?? ctx.tenantSlug,
      role: ctx.membership.role,
      capabilities: [...capabilitiesFor(ctx.membership.role)],
      name: u.name,
      email: u.email,
      mfaEnabled: u.mfa_secret !== null,
      lastLoginAt: u.last_login_at === null ? null : u.last_login_at.toISOString(),
      plants,
      openNcrs: openNcrs.rows[0]?.n ?? 0,
      openCapas: openCapas.rows[0]?.n ?? 0,
    };
  }
}
