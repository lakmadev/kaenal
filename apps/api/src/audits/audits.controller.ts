import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  AdvanceAuditBody,
  AuditPhase,
  AuditType,
  CreateAuditBody,
  CreateAuditFindingBody,
  PageQuery,
  RaiseCapaFromFindingBody,
  RaiseNcrFromFindingBody,
  type AuditDto,
  type AuditFindingDto,
  type CapaDto,
  type NcrDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { AUDITS_SERVICE } from "../tokens.js";
import type { AuditsService } from "./audits.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  status: AuditPhase.optional(),
  type: AuditType.optional(),
  plantId: uuid.optional(),
});

/**
 * Audit routes (03 §1, §3). `audit:view` reads (everyone); `audit:manage`
 * (admin/manager/auditor) schedules, advances phases, records findings, and
 * raises NCRs/CAPAs from them. Audits are plant-scoped by the service.
 */
@Controller()
export class AuditsController {
  constructor(@Inject(AUDITS_SERVICE) private readonly audits: AuditsService) {}

  @Get("v1/audits")
  @RequireCapability("audit:view")
  async list(@Query() query: unknown): Promise<Page<AuditDto>> {
    const q = parse(ListQuery, query);
    return this.audits.list(currentTx(), membershipOf(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.type !== undefined ? { type: q.type } : {}),
      ...(q.plantId !== undefined ? { plantId: q.plantId } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/audits")
  @RequireCapability("audit:manage")
  async create(@Body() body: unknown): Promise<AuditDto> {
    const input = parse(CreateAuditBody, body);
    return this.audits.create(currentTx(), currentContext().tenantId, membershipOf(), actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/audits/:id")
  @RequireCapability("audit:view")
  async get(@Param("id") id: string): Promise<AuditDto> {
    return this.audits.get(currentTx(), membershipOf(), parse(uuid, id));
  }

  @Post("v1/audits/:id/advance")
  @HttpCode(200)
  @RequireCapability("audit:manage")
  async advance(@Param("id") id: string, @Body() body: unknown): Promise<AuditDto> {
    const input = parse(AdvanceAuditBody, body);
    return this.audits.advance(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Get("v1/audits/:id/findings")
  @RequireCapability("audit:view")
  async listFindings(@Param("id") id: string, @Query() query: unknown): Promise<Page<AuditFindingDto>> {
    const q = parse(PageQuery, query);
    return this.audits.listFindings(currentTx(), membershipOf(), parse(uuid, id), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/audits/:id/findings")
  @RequireCapability("audit:manage")
  async createFinding(@Param("id") id: string, @Body() body: unknown): Promise<AuditFindingDto> {
    const input = parse(CreateAuditFindingBody, body);
    return this.audits.createFinding(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/audit-findings/:id/raise-ncr")
  @RequireCapability("audit:manage")
  async raiseNcr(@Param("id") id: string, @Body() body: unknown): Promise<NcrDto> {
    const input = parse(RaiseNcrFromFindingBody, body);
    return this.audits.raiseNcr(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/audit-findings/:id/raise-capa")
  @RequireCapability("audit:manage")
  async raiseCapa(@Param("id") id: string, @Body() body: unknown): Promise<CapaDto> {
    const input = parse(RaiseCapaFromFindingBody, body);
    return this.audits.raiseCapa(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }
}
