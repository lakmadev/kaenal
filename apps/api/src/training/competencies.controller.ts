import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import {
  ArchiveCompetencyBody,
  CompetencyListQuery,
  CreateCompetencyBody,
  ReorderCompetenciesBody,
  UnarchiveCompetencyBody,
  UpdateCompetencyBody,
  type CompetencyDto,
  type Page,
  type ReorderCompetenciesResult,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { COMPETENCIES_SERVICE } from "../tokens.js";
import type { CompetenciesService } from "./competencies.service.js";

const uuid = z.string().uuid();

/**
 * Competency catalog routes (Sprint 05 T1 AC1/AC3, T5). Reads need
 * `training:view`, writes `training:manage`. `/v1/competencies/order` is
 * registered before `/v1/competencies/:id` so the literal path is never
 * shadowed by the param route.
 */
@Controller()
export class CompetenciesController {
  constructor(@Inject(COMPETENCIES_SERVICE) private readonly competencies: CompetenciesService) {}

  @Get("v1/competencies")
  @RequireCapability("training:view")
  async list(@Query() query: unknown): Promise<Page<CompetencyDto>> {
    const q = parse(CompetencyListQuery, query);
    return this.competencies.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/competencies")
  @RequireCapability("training:manage")
  async create(@Body() body: unknown): Promise<CompetencyDto> {
    const input = parse(CreateCompetencyBody, body);
    return this.competencies.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Put("v1/competencies/order")
  @RequireCapability("training:manage")
  async reorder(@Body() body: unknown): Promise<ReorderCompetenciesResult> {
    const input = parse(ReorderCompetenciesBody, body);
    return this.competencies.reorder(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/competencies/:id")
  @RequireCapability("training:view")
  async get(@Param("id") id: string): Promise<CompetencyDto> {
    return this.competencies.get(currentTx(), parse(uuid, id));
  }

  @Patch("v1/competencies/:id")
  @RequireCapability("training:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<CompetencyDto> {
    return this.competencies.update(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(UpdateCompetencyBody, body),
      auditCtxOf(),
    );
  }

  @Patch("v1/competencies/:id/archive")
  @RequireCapability("training:manage")
  async archive(@Param("id") id: string, @Body() body: unknown): Promise<CompetencyDto> {
    return this.competencies.archive(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(ArchiveCompetencyBody, body),
      auditCtxOf(),
    );
  }

  @Patch("v1/competencies/:id/unarchive")
  @RequireCapability("training:manage")
  async unarchive(@Param("id") id: string, @Body() body: unknown): Promise<CompetencyDto> {
    return this.competencies.unarchive(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(UnarchiveCompetencyBody, body),
      auditCtxOf(),
    );
  }
}
