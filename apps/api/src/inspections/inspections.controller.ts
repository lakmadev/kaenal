import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import {
  CompleteInspectionBody,
  CreateInspectionBody,
  InspectionStatus,
  PageQuery,
  StartInspectionBody,
  type InspectionDto,
  type Page,
} from "@kaenal/types";
import type { Membership } from "@kaenal/core";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { ApiError } from "../errors.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { IDEMPOTENCY, INSPECTIONS_SERVICE } from "../tokens.js";
import type { InspectionsService } from "./inspections.service.js";

const ListQuery = PageQuery.extend({
  status: InspectionStatus.optional(),
  plantId: z.string().uuid().optional(),
});

/**
 * Inspection routes (03 §1). Reads need `inspection:view`; scheduling and
 * running an inspection need `inspection:perform`. Plant scoping is applied
 * inside the service (a 404 for out-of-scope records), not here.
 */
@Controller()
export class InspectionsController {
  constructor(
    @Inject(INSPECTIONS_SERVICE) private readonly inspections: InspectionsService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/inspections")
  @RequireCapability("inspection:view")
  async list(@Query() query: unknown): Promise<Page<InspectionDto>> {
    const q = parse(ListQuery, query);
    const ctx = currentContext();
    return this.inspections.list(currentTx(), membership(ctx), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.plantId !== undefined ? { plantId: q.plantId } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/inspections/:id")
  @RequireCapability("inspection:view")
  async get(@Param("id") id: string): Promise<InspectionDto> {
    const uuid = parse(z.string().uuid(), id);
    const ctx = currentContext();
    return this.inspections.get(currentTx(), membership(ctx), uuid);
  }

  @Post("v1/inspections")
  @RequireCapability("inspection:perform")
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<InspectionDto> {
    const input = parse(CreateInspectionBody, body);
    const ctx = currentContext();
    // The mutation runs inside the request's tenant transaction; the
    // idempotency store only decides whether to run it or replay a prior result.
    const { result } = await this.idempotency.run(
      `${ctx.tenantId}:create-inspection`,
      idempotencyKey,
      () => this.inspections.create(currentTx(), ctx.tenantId, actorId(ctx), input, auditCtx(ctx)),
    );
    return result;
  }

  @Post("v1/inspections/:id/start")
  @HttpCode(200)
  @RequireCapability("inspection:perform")
  async start(@Param("id") id: string, @Body() body: unknown): Promise<InspectionDto> {
    const uuid = parse(z.string().uuid(), id);
    const { version } = parse(StartInspectionBody, body);
    const ctx = currentContext();
    return this.inspections.start(
      currentTx(),
      ctx.tenantId,
      membership(ctx),
      actorId(ctx),
      uuid,
      version,
      auditCtx(ctx),
    );
  }

  @Post("v1/inspections/:id/complete")
  @HttpCode(200)
  @RequireCapability("inspection:perform")
  async complete(@Param("id") id: string, @Body() body: unknown): Promise<InspectionDto> {
    const uuid = parse(z.string().uuid(), id);
    const { responses, version } = parse(CompleteInspectionBody, body);
    const ctx = currentContext();
    return this.inspections.complete(
      currentTx(),
      ctx.tenantId,
      membership(ctx),
      actorId(ctx),
      uuid,
      responses,
      version,
      auditCtx(ctx),
    );
  }
}

function membership(ctx: ReturnType<typeof currentContext>): Membership {
  if (ctx.membership === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
  return ctx.membership;
}

function actorId(ctx: ReturnType<typeof currentContext>): string {
  if (ctx.userId === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
  return ctx.userId;
}

function auditCtx(ctx: ReturnType<typeof currentContext>): {
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
} {
  return { requestId: ctx.requestId, ip: ctx.ip, userAgent: ctx.userAgent };
}
