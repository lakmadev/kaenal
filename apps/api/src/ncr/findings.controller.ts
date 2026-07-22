import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { CreateFindingBody, PageQuery, type FindingDto, type Page } from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { FINDINGS_SERVICE } from "../tokens.js";
import type { FindingsService } from "./findings.service.js";
import { actorIdOf, auditCtxOf, membershipOf } from "./handler-ctx.js";

/**
 * Findings live under their inspection (`/v1/inspections/:id/findings`).
 * Recording one needs `inspection:perform`; reading needs `inspection:view`.
 */
@Controller()
export class FindingsController {
  constructor(@Inject(FINDINGS_SERVICE) private readonly findings: FindingsService) {}

  @Get("v1/inspections/:id/findings")
  @RequireCapability("inspection:view")
  async list(@Param("id") id: string, @Query() query: unknown): Promise<Page<FindingDto>> {
    const inspectionId = parse(z.string().uuid(), id);
    const q = parse(PageQuery, query);
    return this.findings.list(currentTx(), membershipOf(), inspectionId, {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/inspections/:id/findings")
  @RequireCapability("inspection:perform")
  async create(@Param("id") id: string, @Body() body: unknown): Promise<FindingDto> {
    const inspectionId = parse(z.string().uuid(), id);
    const input = parse(CreateFindingBody, body);
    const ctx = currentContext();
    return this.findings.create(
      currentTx(),
      ctx.tenantId,
      membershipOf(),
      actorIdOf(),
      inspectionId,
      input,
      auditCtxOf(),
    );
  }
}
