import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { CreateEntityLinkBody, EntityRefQuery, type EntityLinkDto, type Page } from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { ENTITY_LINKS_SERVICE } from "../tokens.js";
import type { EntityLinksService } from "./entity-links.service.js";

const uuid = z.string().uuid();

/**
 * Related-records routes (FEATURES §329). No `@RequireCapability`: a link only
 * relates records the caller can already see (the service resolves both
 * endpoints in-tenant, 404 otherwise), and every link/unlink is audited on the
 * `from` record. Session-gated by default-deny like the other collab routes.
 * `@Internal`: cross-linking records is not a supplier-portal capability.
 */
@Internal()
@Controller()
export class EntityLinksController {
  constructor(@Inject(ENTITY_LINKS_SERVICE) private readonly links: EntityLinksService) {}

  @Get("v1/entity-links")
  async list(@Query() query: unknown): Promise<Page<EntityLinkDto>> {
    const q = parse(EntityRefQuery, query);
    return this.links.list(currentTx(), q.entityKind, q.entityId);
  }

  @Post("v1/entity-links")
  async create(@Body() body: unknown): Promise<EntityLinkDto> {
    const input = parse(CreateEntityLinkBody, body);
    return this.links.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Post("v1/entity-links/:id/delete")
  @HttpCode(200)
  async remove(@Param("id") id: string): Promise<EntityLinkDto> {
    return this.links.remove(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }
}
