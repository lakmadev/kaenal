import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateExportBody,
  ExportResource,
  ExportStatus,
  PageQuery,
  type ExportDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { EXPORTS_SERVICE } from "../tokens.js";
import type { ExportsService } from "./exports.service.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  resource: ExportResource.optional(),
  status: ExportStatus.optional(),
});

/**
 * Export routes (03 §8). Any authenticated member may request and read exports;
 * `create` additionally checks the requester may VIEW the resource (enforced in
 * the service, since the required capability depends on the body). Reads are
 * scoped to the requester by the service, so no capability decorator is needed —
 * an export you did not request is a 404.
 */
@Controller()
export class ExportsController {
  constructor(@Inject(EXPORTS_SERVICE) private readonly exports: ExportsService) {}

  @Get("v1/exports")
  async list(@Query() query: unknown): Promise<Page<ExportDto>> {
    const q = parse(ListQuery, query);
    return this.exports.list(currentTx(), actorIdOf(), {
      ...(q.resource !== undefined ? { resource: q.resource } : {}),
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/exports")
  @HttpCode(202)
  async create(@Body() body: unknown): Promise<ExportDto> {
    const input = parse(CreateExportBody, body);
    return this.exports.create(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      input,
      auditCtxOf(),
    );
  }

  @Get("v1/exports/:id")
  async get(@Param("id") id: string): Promise<ExportDto> {
    return this.exports.get(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), auditCtxOf());
  }
}
