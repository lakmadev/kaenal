import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  AdvanceCapaBody,
  CapaPhase,
  CapaType,
  CreateCapaActionBody,
  CreateCapaBody,
  NcrPriority,
  PageQuery,
  RevertCapaBody,
  UpdateCapaActionStatusBody,
  type CapaActionDto,
  type CapaDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { CAPA_SERVICE } from "../tokens.js";
import type { CapaService } from "./capa.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  status: CapaPhase.optional(),
  type: CapaType.optional(),
  priority: NcrPriority.optional(),
});

/**
 * CAPA routes (03 §1, §3). Viewing needs `capa:view` (every role has it —
 * "View all modules"); every mutation needs `capa:manage` (admin/manager only).
 * `advance` and `revert` are deliberately separate endpoints: forward motion and
 * the audited backward exception must never share one control (02 §4).
 */
@Controller()
export class CapaController {
  constructor(@Inject(CAPA_SERVICE) private readonly capas: CapaService) {}

  @Get("v1/capas")
  @RequireCapability("capa:view")
  async list(@Query() query: unknown): Promise<Page<CapaDto>> {
    const q = parse(ListQuery, query);
    return this.capas.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.type !== undefined ? { type: q.type } : {}),
      ...(q.priority !== undefined ? { priority: q.priority } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/capas")
  @RequireCapability("capa:manage")
  async create(@Body() body: unknown): Promise<CapaDto> {
    const input = parse(CreateCapaBody, body);
    return this.capas.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/capas/:id")
  @RequireCapability("capa:view")
  async get(@Param("id") id: string): Promise<CapaDto> {
    return this.capas.get(currentTx(), parse(uuid, id));
  }

  @Post("v1/capas/:id/advance")
  @HttpCode(200)
  @RequireCapability("capa:manage")
  async advance(@Param("id") id: string, @Body() body: unknown): Promise<CapaDto> {
    const input = parse(AdvanceCapaBody, body);
    return this.capas.advance(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/capas/:id/revert")
  @HttpCode(200)
  @RequireCapability("capa:manage")
  async revert(@Param("id") id: string, @Body() body: unknown): Promise<CapaDto> {
    const input = parse(RevertCapaBody, body);
    return this.capas.revert(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Get("v1/capas/:id/actions")
  @RequireCapability("capa:view")
  async listActions(@Param("id") id: string, @Query() query: unknown): Promise<Page<CapaActionDto>> {
    const q = parse(PageQuery, query);
    return this.capas.listActions(currentTx(), parse(uuid, id), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/capas/:id/actions")
  @RequireCapability("capa:manage")
  async createAction(@Param("id") id: string, @Body() body: unknown): Promise<CapaActionDto> {
    const input = parse(CreateCapaActionBody, body);
    return this.capas.createAction(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/capa-actions/:id/status")
  @HttpCode(200)
  @RequireCapability("capa:manage")
  async updateActionStatus(@Param("id") id: string, @Body() body: unknown): Promise<CapaActionDto> {
    const input = parse(UpdateCapaActionStatusBody, body);
    return this.capas.updateActionStatus(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input.status,
      input.version,
      auditCtxOf(),
    );
  }
}
