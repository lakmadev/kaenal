import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateMsaStudyBody,
  MsaCompleteBody,
  MsaListQuery,
  MsaMeasurementBatchBody,
  MsaReopenBody,
  type MsaAnalysisResult,
  type MsaStudyDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { IDEMPOTENCY, MSA_SERVICE } from "../tokens.js";
import type { MsaService } from "./msa.service.js";

const uuid = z.string().uuid();

/**
 * MSA / Gauge R&R study routes (SPRINT-04 M1-M5). Reads need `msa:view`,
 * writes `msa:manage`. `analysis` is registered as its own literal sub-path
 * on `:id`, matching NestJS's own most-specific-first route matching used
 * elsewhere in this codebase (`audits/:id/…` sub-routes).
 */
@Controller()
export class MsaController {
  constructor(
    @Inject(MSA_SERVICE) private readonly msa: MsaService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/msa-studies")
  @RequireCapability("msa:view")
  async list(@Query() query: unknown): Promise<Page<MsaStudyDto>> {
    const q = parse(MsaListQuery, query);
    return this.msa.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.method !== undefined ? { method: q.method } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/msa-studies")
  @RequireCapability("msa:manage")
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<MsaStudyDto> {
    const input = parse(CreateMsaStudyBody, body);
    const ctx = currentContext();
    const actorId = actorIdOf();
    const { result } = await this.idempotency.run(`${ctx.tenantId}:create-msa-study`, idempotencyKey, () =>
      this.msa.create(currentTx(), ctx.tenantId, actorId, actorId, input, auditCtxOf()),
    );
    return result;
  }

  @Get("v1/msa-studies/:id")
  @RequireCapability("msa:view")
  async get(@Param("id") id: string): Promise<MsaStudyDto> {
    return this.msa.get(currentTx(), parse(uuid, id));
  }

  @Get("v1/msa-studies/:id/analysis")
  @RequireCapability("msa:view")
  async analysis(@Param("id") id: string): Promise<MsaAnalysisResult> {
    return this.msa.analysis(currentTx(), parse(uuid, id));
  }

  @Patch("v1/msa-studies/:id")
  @RequireCapability("msa:manage")
  async complete(@Param("id") id: string, @Body() body: unknown): Promise<MsaStudyDto> {
    return this.msa.complete(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(MsaCompleteBody, body),
      auditCtxOf(),
    );
  }

  @Patch("v1/msa-studies/:id/reopen")
  @RequireCapability("msa:manage")
  async reopen(@Param("id") id: string, @Body() body: unknown): Promise<MsaStudyDto> {
    return this.msa.reopen(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(MsaReopenBody, body),
      auditCtxOf(),
    );
  }

  @Post("v1/msa-studies/:id/measurements")
  @HttpCode(200)
  @RequireCapability("msa:manage")
  async recordMeasurements(@Param("id") id: string, @Body() body: unknown): Promise<MsaStudyDto> {
    return this.msa.recordMeasurements(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(MsaMeasurementBatchBody, body),
      auditCtxOf(),
    );
  }
}
