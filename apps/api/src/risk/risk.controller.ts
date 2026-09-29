import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateRiskBody,
  RiskListQuery,
  UpdateRiskBody,
  type Page,
  type RiskDto,
  type RiskSummaryDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { IDEMPOTENCY, RISK_SERVICE } from "../tokens.js";
import type { RiskService } from "./risk.service.js";

const uuid = z.string().uuid();

/**
 * Risk register routes (SPRINT-04 R1-R5). Reads need `risk:view`, writes
 * `risk:manage`. `/v1/risks/summary` is registered BEFORE `/v1/risks/:id` so
 * the literal path is never shadowed by the param route.
 */
@Controller()
export class RiskController {
  constructor(
    @Inject(RISK_SERVICE) private readonly risks: RiskService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/risks")
  @RequireCapability("risk:view")
  async list(@Query() query: unknown): Promise<Page<RiskDto>> {
    const q = parse(RiskListQuery, query);
    return this.risks.list(currentTx(), {
      ...(q.category !== undefined ? { category: q.category } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.treatment !== undefined ? { treatment: q.treatment } : {}),
      ...(q.owner !== undefined ? { owner: q.owner } : {}),
      ...(q.likelihood !== undefined ? { likelihood: q.likelihood } : {}),
      ...(q.impact !== undefined ? { impact: q.impact } : {}),
      ...(q.ids !== undefined ? { ids: q.ids } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/risks/summary")
  @RequireCapability("risk:view")
  async summary(): Promise<RiskSummaryDto> {
    return this.risks.summary(currentTx());
  }

  @Post("v1/risks")
  @RequireCapability("risk:manage")
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<RiskDto> {
    const input = parse(CreateRiskBody, body);
    const ctx = currentContext();
    const { result } = await this.idempotency.run(`${ctx.tenantId}:create-risk`, idempotencyKey, () =>
      this.risks.create(currentTx(), ctx.tenantId, actorIdOf(), input, auditCtxOf()),
    );
    return result;
  }

  @Get("v1/risks/:id")
  @RequireCapability("risk:view")
  async get(@Param("id") id: string): Promise<RiskDto> {
    return this.risks.get(currentTx(), parse(uuid, id));
  }

  @Patch("v1/risks/:id")
  @RequireCapability("risk:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<RiskDto> {
    return this.risks.update(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(UpdateRiskBody, body),
      auditCtxOf(),
    );
  }
}
