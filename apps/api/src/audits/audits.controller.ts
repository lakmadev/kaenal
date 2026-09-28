import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query } from "@nestjs/common";
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
  UpdateAuditChecklistItemBody,
  type AuditDto,
  type AuditFindingDto,
  type AuditFrequencyResult,
  type AuditStatsDto,
  type CapaDto,
  type NcrDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { AUDITS_SERVICE, IDEMPOTENCY } from "../tokens.js";
import type { AuditsService } from "./audits.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  status: z.union([AuditPhase, z.enum(["active", "completed"])]).optional(),
  type: AuditType.optional(),
  plantId: uuid.optional(),
  q: z.string().min(1).max(200).optional(),
  mine: z.coerce.boolean().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * Audit routes (03 §1, §3, Sprint 02). `audit:view` reads (everyone); `audit:manage`
 * (admin/manager/auditor) schedules, advances phases, scores the checklist,
 * records findings, and raises NCRs/CAPAs from them. Audits are plant-scoped
 * by the service. `frequency`/`stats` are declared before `:id` so they are
 * matched first.
 */
@Controller()
export class AuditsController {
  constructor(
    @Inject(AUDITS_SERVICE) private readonly audits: AuditsService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/audits")
  @RequireCapability("audit:view")
  async list(@Query() query: unknown): Promise<Page<AuditDto>> {
    const q = parse(ListQuery, query);
    return this.audits.list(currentTx(), membershipOf(), actorIdOf(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.type !== undefined ? { type: q.type } : {}),
      ...(q.plantId !== undefined ? { plantId: q.plantId } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.mine !== undefined ? { mine: q.mine } : {}),
      ...(q.from !== undefined ? { from: q.from } : {}),
      ...(q.to !== undefined ? { to: q.to } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/audits/frequency")
  @RequireCapability("audit:view")
  async frequency(): Promise<AuditFrequencyResult> {
    return this.audits.frequency(currentTx(), membershipOf());
  }

  @Get("v1/audits/stats")
  @RequireCapability("audit:view")
  async stats(): Promise<AuditStatsDto> {
    return this.audits.stats(currentTx(), membershipOf());
  }

  @Post("v1/audits")
  @RequireCapability("audit:manage")
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<AuditDto> {
    const input = parse(CreateAuditBody, body);
    const ctx = currentContext();
    const { result } = await this.idempotency.run(`${ctx.tenantId}:create-audit`, idempotencyKey, () =>
      this.audits.create(currentTx(), ctx.tenantId, membershipOf(), actorIdOf(), input, auditCtxOf()),
    );
    return result;
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

  @Patch("v1/audits/:id/checklist/:itemId")
  @HttpCode(200)
  @RequireCapability("audit:manage")
  async updateChecklistItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ): Promise<AuditDto> {
    const input = parse(UpdateAuditChecklistItemBody, body);
    return this.audits.updateChecklistItem(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      parse(uuid, itemId),
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
