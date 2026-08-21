import { Body, Controller, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { authorize } from "@kaenal/core";
import { CollabUpdateBody, PresenceEntity } from "@kaenal/types";
import { currentContext } from "../context.js";
import { ApiError } from "../errors.js";
import { parse } from "../http/validate.js";
import { PRESENCE_SERVICE, REALTIME } from "../tokens.js";
import type { PresenceService } from "./presence.service.js";
import type { RealtimeService } from "./realtime.service.js";

const FieldName = z.string().min(1).max(64);

/**
 * Collaborative editing relay (Phase R5).
 *
 * The server is a DUMB, authenticated relay — it never parses the CRDT. A client
 * POSTs an opaque base64 Yjs update for one entity field; the server broadcasts
 * it, over the R1 bus, to the entity's current presence viewers (R4's set is the
 * room audience). Each co-editor applies it to its local Yjs doc and converges.
 * Persistence stays on the entity's normal audited save path — this channel only
 * carries the live, in-flight text. Gated by the entity type's view capability;
 * the authoritative write is still gated by the save endpoint's manage capability.
 */
@Controller()
export class CollabController {
  constructor(
    @Inject(PRESENCE_SERVICE) private readonly presence: PresenceService,
    @Inject(REALTIME) private readonly realtime: RealtimeService,
  ) {}

  @Post("v1/collab/:type/:id/:field/update")
  @HttpCode(200)
  async relay(
    @Param("type") type: string,
    @Param("id") id: string,
    @Param("field") field: string,
    @Body() body: unknown,
  ): Promise<{ delivered: number }> {
    const entityType = parse(PresenceEntity, type);
    const fieldName = parse(FieldName, field);
    const { update } = parse(CollabUpdateBody, body);

    const ctx = currentContext();
    if (ctx.userId === null || ctx.membership === null) {
      throw new ApiError("UNAUTHENTICATED", "Authentication required");
    }
    const decision = authorize(ctx.membership, this.presence.requiredCapability(entityType));
    if (!decision.ok) throw ApiError.from(decision);

    // Broadcast to every current viewer (incl. the sender's other tabs — a Yjs
    // update you already hold is a harmless no-op, and same-user multi-tab is a
    // real co-editing case). Cross-instance fan-out rides the same Redis bus.
    const snapshot = await this.presence.snapshot(ctx.tenantId, entityType, id);
    const at = new Date().toISOString();
    for (const viewer of snapshot.viewers) {
      this.realtime.emit({
        tenantId: ctx.tenantId,
        userId: viewer.userId,
        event: {
          topic: "collab",
          action: "updated",
          entityType,
          entityId: id,
          field: fieldName,
          update,
          at,
        },
      });
    }
    return { delivered: snapshot.viewers.length };
  }
}
