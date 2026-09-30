import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  AcknowledgeComplaintBody,
  CloseComplaintBody,
  ComplaintConvertBody,
  ComplaintListQuery,
  CreateComplaintBody,
  UpdateComplaintBody,
  type ComplaintConvertResult,
  type ComplaintDto,
  type ComplaintSummaryDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { COMPLAINTS_SERVICE, IDEMPOTENCY } from "../tokens.js";
import type { ComplaintsService } from "./complaints.service.js";

const uuid = z.string().uuid();

/**
 * Customer complaints routes (SPRINT-06 C1-C4). `/v1/complaints/summary` is
 * registered before `/v1/complaints/:id` so the literal path is never
 * shadowed by the param route.
 */
@Controller()
export class ComplaintsController {
  constructor(
    @Inject(COMPLAINTS_SERVICE) private readonly complaints: ComplaintsService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/complaints")
  @RequireCapability("complaint:view")
  async list(@Query() query: unknown): Promise<Page<ComplaintDto>> {
    const q = parse(ComplaintListQuery, query);
    return this.complaints.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.severity !== undefined ? { severity: q.severity } : {}),
      ...(q.channel !== undefined ? { channel: q.channel } : {}),
      ...(q.owner !== undefined ? { owner: q.owner } : {}),
      ...(q.unlinked !== undefined ? { unlinked: q.unlinked } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/complaints/summary")
  @RequireCapability("complaint:view")
  async summary(): Promise<ComplaintSummaryDto> {
    return this.complaints.summary(currentTx(), actorIdOf());
  }

  @Post("v1/complaints")
  @RequireCapability("complaint:manage")
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<ComplaintDto> {
    const input = parse(CreateComplaintBody, body);
    const ctx = currentContext();
    const actorId = actorIdOf();
    const { result } = await this.idempotency.run(`${ctx.tenantId}:create-complaint`, idempotencyKey, () =>
      this.complaints.create(currentTx(), ctx.tenantId, actorId, input, auditCtxOf()),
    );
    return result;
  }

  @Get("v1/complaints/:id")
  @RequireCapability("complaint:view")
  async get(@Param("id") id: string): Promise<ComplaintDto> {
    return this.complaints.get(currentTx(), parse(uuid, id));
  }

  @Patch("v1/complaints/:id")
  @RequireCapability("complaint:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<ComplaintDto> {
    const input = parse(UpdateComplaintBody, body);
    return this.complaints.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/complaints/:id/acknowledge")
  @RequireCapability("complaint:manage")
  async acknowledge(@Param("id") id: string, @Body() body: unknown): Promise<ComplaintDto> {
    const input = parse(AcknowledgeComplaintBody, body);
    return this.complaints.acknowledge(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input.lockVersion, auditCtxOf());
  }

  @Post("v1/complaints/:id/close")
  @RequireCapability("complaint:manage")
  async close(@Param("id") id: string, @Body() body: unknown): Promise<ComplaintDto> {
    const input = parse(CloseComplaintBody, body);
    return this.complaints.close(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input.lockVersion, auditCtxOf());
  }

  @Post("v1/complaints/:id/convert")
  @RequireCapability("complaint:manage")
  async convert(@Param("id") id: string, @Body() body: unknown): Promise<ComplaintConvertResult> {
    const input = parse(ComplaintConvertBody, body);
    return this.complaints.convert(currentTx(), currentContext().tenantId, membershipOf(), actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }
}
