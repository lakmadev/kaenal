import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import {
  CreateTemplateBody,
  PageQuery,
  TemplateStatus,
  type Page,
  type TemplateDto,
} from "@kaenal/types";
import { z } from "zod";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { TEMPLATES_SERVICE } from "../tokens.js";
import type { TemplatesService } from "./templates.service.js";

const ListQuery = PageQuery.extend({ status: TemplateStatus.optional() });
const PublishBody = z.object({ version: z.number().int().nonnegative() });

/**
 * Inspection template routes (03 §1). Authoring a template is a
 * `settings:manage` action (admins and managers): templates define how the
 * whole plant inspects, so they are not something an individual inspector edits.
 * Viewing them only needs `inspection:view`.
 */
@Controller()
export class TemplatesController {
  constructor(@Inject(TEMPLATES_SERVICE) private readonly templates: TemplatesService) {}

  @Get("v1/inspection-templates")
  @RequireCapability("inspection:view")
  async list(@Query() query: unknown): Promise<Page<TemplateDto>> {
    const q = parse(ListQuery, query);
    return this.templates.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/inspection-templates")
  @RequireCapability("settings:manage")
  async create(@Body() body: unknown): Promise<TemplateDto> {
    const input = parse(CreateTemplateBody, body);
    const ctx = currentContext();
    return this.templates.create(currentTx(), ctx.tenantId, actorId(ctx), input, auditCtx(ctx));
  }

  @Post("v1/inspection-templates/:id/publish")
  @HttpCode(200)
  @RequireCapability("settings:manage")
  async publish(@Param("id") id: string, @Body() body: unknown): Promise<TemplateDto> {
    const { version } = parse(PublishBody, body);
    const uuid = parse(z.string().uuid(), id);
    const ctx = currentContext();
    return this.templates.publish(currentTx(), ctx.tenantId, actorId(ctx), uuid, version, auditCtx(ctx));
  }
}

// Shared little helpers — a controller always has a session here (every route
// declares a capability, which implies authentication), so the actor is never
// null; the assertion documents that invariant.
function actorId(ctx: ReturnType<typeof currentContext>): string {
  if (ctx.userId === null) throw new Error("capability route reached without a session");
  return ctx.userId;
}

function auditCtx(ctx: ReturnType<typeof currentContext>): {
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
} {
  return { requestId: ctx.requestId, ip: ctx.ip, userAgent: ctx.userAgent };
}
