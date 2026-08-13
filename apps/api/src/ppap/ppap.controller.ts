import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreatePpapBody,
  PageQuery,
  PpapDecisionBody,
  PpapStatus,
  UpdatePpapBody,
  UpdatePpapElementBody,
  type Page,
  type PpapSubmissionDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { PPAP_SERVICE } from "../tokens.js";
import type { PpapService } from "./ppap.service.js";

const uuid = z.string().uuid();
const elementNo = z.coerce.number().int().min(1).max(18);
const ListQuery = PageQuery.extend({
  supplierId: z.string().uuid().optional(),
  status: PpapStatus.optional(),
  customer: z.string().optional(),
  level: z.coerce.number().int().optional(),
  q: z.string().optional(),
});

/**
 * PPAP routes (FEATURES §11.2). `ppap:view` reads; `ppap:manage`
 * (admin/manager/auditor) creates submissions, edits elements, and decides.
 * Approve is refused server-side while any non-N/A element is unapproved (the
 * `packages/core` completeness rule).
 */
@Controller()
export class PpapController {
  constructor(@Inject(PPAP_SERVICE) private readonly ppap: PpapService) {}

  @Get("v1/ppap")
  @RequireCapability("ppap:view")
  async list(@Query() query: unknown): Promise<Page<PpapSubmissionDto>> {
    const q = parse(ListQuery, query);
    return this.ppap.list(currentTx(), {
      ...(q.supplierId !== undefined ? { supplierId: q.supplierId } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.customer !== undefined ? { customer: q.customer } : {}),
      ...(q.level !== undefined ? { level: q.level } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/ppap")
  @RequireCapability("ppap:manage")
  async create(@Body() body: unknown): Promise<PpapSubmissionDto> {
    const input = parse(CreatePpapBody, body);
    return this.ppap.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/ppap/:id")
  @RequireCapability("ppap:view")
  async get(@Param("id") id: string): Promise<PpapSubmissionDto> {
    return this.ppap.get(currentTx(), parse(uuid, id));
  }

  @Post("v1/ppap/:id")
  @HttpCode(200)
  @RequireCapability("ppap:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<PpapSubmissionDto> {
    const input = parse(UpdatePpapBody, body);
    return this.ppap.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/ppap/:id/elements/:no")
  @HttpCode(200)
  @RequireCapability("ppap:manage")
  async updateElement(
    @Param("id") id: string,
    @Param("no") no: string,
    @Body() body: unknown,
  ): Promise<PpapSubmissionDto> {
    const input = parse(UpdatePpapElementBody, body);
    return this.ppap.updateElement(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(elementNo, no),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/ppap/:id/decision")
  @HttpCode(200)
  @RequireCapability("ppap:manage")
  async decide(@Param("id") id: string, @Body() body: unknown): Promise<PpapSubmissionDto> {
    const input = parse(PpapDecisionBody, body);
    return this.ppap.decide(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }
}
