import { Body, Controller, Get, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { authorize } from "@kaenal/core";
import { CollabUpdateBody, PresenceEntity } from "@kaenal/types";
import { currentContext } from "../context.js";
import { ApiError } from "../errors.js";
import { parse } from "../http/validate.js";
import { COLLAB_SERVICE, PRESENCE_SERVICE, REALTIME } from "../tokens.js";
import { collabRoomKey, type CollabService } from "./collab.service.js";
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
    @Inject(COLLAB_SERVICE) private readonly collab: CollabService,
  ) {}

  /**
   * The room's live accumulated state for a late joiner (Phase R7). A client
   * seeds its local doc from the persisted text, then applies this to converge
   * with edits made before it arrived. `null` when no edits happened this
   * session (the persisted text is already current).
   */
  @Get("v1/collab/:type/:id/:field/state")
  state(
    @Param("type") type: string,
    @Param("id") id: string,
    @Param("field") field: string,
  ): { state: string | null } {
    const { entityType, entityId } = this.resolve(type, id);
    const fieldName = parse(FieldName, field);
    return {
      state: this.collab.state(
        collabRoomKey(currentContext().tenantId, entityType, entityId, fieldName),
      ),
    };
  }

  @Post("v1/collab/:type/:id/:field/update")
  @HttpCode(200)
  async relay(
    @Param("type") type: string,
    @Param("id") id: string,
    @Param("field") field: string,
    @Body() body: unknown,
  ): Promise<{ delivered: number }> {
    const { entityType, entityId } = this.resolve(type, id);
    const fieldName = parse(FieldName, field);
    const { update } = parse(CollabUpdateBody, body);
    const ctx = currentContext();

    // Broadcast to every current viewer (incl. the sender's other tabs — a Yjs
    // update you already hold is a harmless no-op, and same-user multi-tab is a
    // real co-editing case). Cross-instance fan-out rides the same Redis bus.
    const snapshot = await this.presence.snapshot(ctx.tenantId, entityType, entityId);
    const at = new Date().toISOString();
    for (const viewer of snapshot.viewers) {
      this.realtime.emit({
        tenantId: ctx.tenantId,
        userId: viewer.userId,
        event: {
          topic: "collab",
          action: "updated",
          entityType,
          entityId,
          field: fieldName,
          update,
          at,
        },
      });
    }
    return { delivered: snapshot.viewers.length };
  }

  /** Validate the entity type, enforce its view capability, return the actor's
   *  entity identity. Shared by the relay and the state read. */
  private resolve(type: string, id: string): { entityType: PresenceEntity; entityId: string } {
    const entityType = parse(PresenceEntity, type);
    const ctx = currentContext();
    if (ctx.userId === null || ctx.membership === null) {
      throw new ApiError("UNAUTHENTICATED", "Authentication required");
    }
    const decision = authorize(ctx.membership, this.presence.requiredCapability(entityType));
    if (!decision.ok) throw ApiError.from(decision);
    return { entityType, entityId: id };
  }
}
