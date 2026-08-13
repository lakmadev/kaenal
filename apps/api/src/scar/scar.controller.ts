import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  AcknowledgeScarBody,
  AdvanceScarBody,
  AssignScarBody,
  CreateScarBody,
  PageQuery,
  ScarChargebackBody,
  ScarSeverity,
  ScarStatus,
  UpdateScarBody,
  type Page,
  type ScarDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { SCAR_SERVICE } from "../tokens.js";
import type { ScarService } from "./scar.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  supplierId: z.string().uuid().optional(),
  status: ScarStatus.optional(),
  severity: ScarSeverity.optional(),
  overdue: z.coerce.boolean().optional(),
  q: z.string().optional(),
});

/**
 * SCAR routes (FEATURES §11.3). `scar:view` reads; `scar:manage`
 * (admin/manager/auditor) raises SCARs, edits, advances the 8D, records
 * supplier acknowledgement, and transitions the chargeback. The forward-only D
 * machine and the chargeback ratchet are enforced server-side in `packages/core`.
 */
@Controller()
export class ScarController {
  constructor(@Inject(SCAR_SERVICE) private readonly scars: ScarService) {}

  @Get("v1/scars")
  @RequireCapability("scar:view")
  async list(@Query() query: unknown): Promise<Page<ScarDto>> {
    const q = parse(ListQuery, query);
    return this.scars.list(currentTx(), {
      ...(q.supplierId !== undefined ? { supplierId: q.supplierId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.severity !== undefined ? { severity: q.severity } : {}),
      ...(q.overdue !== undefined ? { overdue: q.overdue } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/scars")
  @RequireCapability("scar:manage")
  async create(@Body() body: unknown): Promise<ScarDto> {
    const input = parse(CreateScarBody, body);
    return this.scars.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/scars/:id")
  @RequireCapability("scar:view")
  async get(@Param("id") id: string): Promise<ScarDto> {
    return this.scars.get(currentTx(), parse(uuid, id));
  }

  @Post("v1/scars/:id")
  @HttpCode(200)
  @RequireCapability("scar:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<ScarDto> {
    const input = parse(UpdateScarBody, body);
    return this.scars.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/scars/:id/advance")
  @HttpCode(200)
  @RequireCapability("scar:manage")
  async advance(@Param("id") id: string, @Body() body: unknown): Promise<ScarDto> {
    const input = parse(AdvanceScarBody, body);
    return this.scars.advance(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/scars/:id/acknowledge")
  @HttpCode(200)
  @RequireCapability("scar:manage")
  async acknowledge(@Param("id") id: string, @Body() body: unknown): Promise<ScarDto> {
    const input = parse(AcknowledgeScarBody, body);
    return this.scars.acknowledge(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/scars/:id/chargeback")
  @HttpCode(200)
  @RequireCapability("scar:manage")
  async chargeback(@Param("id") id: string, @Body() body: unknown): Promise<ScarDto> {
    const input = parse(ScarChargebackBody, body);
    return this.scars.chargeback(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/scars/:id/assign")
  @HttpCode(200)
  @RequireCapability("scar:manage")
  async assign(@Param("id") id: string, @Body() body: unknown): Promise<ScarDto> {
    const input = parse(AssignScarBody, body);
    return this.scars.assign(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }
}
