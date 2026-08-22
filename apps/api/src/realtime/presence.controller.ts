import { Body, Controller, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { authorize } from "@kaenal/core";
import { PresenceEntity, PresenceHeartbeatBody, type PresenceSnapshot } from "@kaenal/types";
import { currentContext } from "../context.js";
import { ApiError } from "../errors.js";
import { parse } from "../http/validate.js";
import { PRESENCE_SERVICE } from "../tokens.js";
import type { PresenceService } from "./presence.service.js";

/**
 * Live presence (Phase R4). Two idempotent, side-effect-light routes — no
 * `@RequireCapability` because the capability depends on the `:type` param, so
 * it's resolved per request against the entity's view right (a member can only
 * join presence for a module it can see). Presence is ephemeral (Redis only),
 * so nothing here writes to the DB or the audit trail.
 */
@Controller()
export class PresenceController {
  constructor(@Inject(PRESENCE_SERVICE) private readonly presence: PresenceService) {}

  @Post("v1/presence/:type/:id/heartbeat")
  @HttpCode(200)
  async heartbeat(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<PresenceSnapshot> {
    const { entityType, entityId, userId } = this.resolve(type, id);
    const { editing } = parse(PresenceHeartbeatBody, body);
    return this.presence.heartbeat(currentContext().tenantId, entityType, entityId, userId, editing);
  }

  @Post("v1/presence/:type/:id/leave")
  @HttpCode(200)
  async leave(@Param("type") type: string, @Param("id") id: string): Promise<PresenceSnapshot> {
    const { entityType, entityId, userId } = this.resolve(type, id);
    return this.presence.leave(currentContext().tenantId, entityType, entityId, userId);
  }

  /** Validate the entity type, enforce the view capability, return the actor. */
  private resolve(
    type: string,
    id: string,
  ): { entityType: PresenceEntity; entityId: string; userId: string } {
    const entityType = parse(PresenceEntity, type);
    const ctx = currentContext();
    if (ctx.userId === null || ctx.membership === null) {
      throw new ApiError("UNAUTHENTICATED", "Authentication required");
    }
    const decision = authorize(ctx.membership, this.presence.requiredCapability(entityType));
    if (!decision.ok) throw ApiError.from(decision);
    return { entityType, entityId: id, userId: ctx.userId };
  }
}
