import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateNcrActionBody,
  CreateNcrBody,
  NcrPriority,
  NcrStatus,
  PageQuery,
  TransitionNcrBody,
  UpdateNcrActionStatusBody,
  VerifyNcrBody,
  type NcrActionDto,
  type NcrDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { NCR_SERVICE } from "../tokens.js";
import type { NcrService } from "./ncr.service.js";
import { actorIdOf, auditCtxOf, membershipOf } from "./handler-ctx.js";

const uuid = z.string().uuid();
const ListQuery = PageQuery.extend({
  status: NcrStatus.optional(),
  priority: NcrPriority.optional(),
  plantId: uuid.optional(),
});

/**
 * NCR routes (03 §1, §3). Capabilities follow the 03 §3 matrix: raising needs
 * `ncr:create`, the manager-side transitions need `ncr:manage`, and verify has
 * its own `ncr:verify` (which auditors hold but managers-who-can't-manage do
 * not) so it is reachable by exactly the roles allowed to be the second pair of
 * eyes.
 */
@Controller()
export class NcrController {
  constructor(@Inject(NCR_SERVICE) private readonly ncrs: NcrService) {}

  @Get("v1/ncrs")
  @RequireCapability("ncr:view")
  async list(@Query() query: unknown): Promise<Page<NcrDto>> {
    const q = parse(ListQuery, query);
    return this.ncrs.list(currentTx(), membershipOf(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.priority !== undefined ? { priority: q.priority } : {}),
      ...(q.plantId !== undefined ? { plantId: q.plantId } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/ncrs")
  @RequireCapability("ncr:create")
  async create(@Body() body: unknown): Promise<NcrDto> {
    const input = parse(CreateNcrBody, body);
    return this.ncrs.create(currentTx(), currentContext().tenantId, membershipOf(), actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/ncrs/:id")
  @RequireCapability("ncr:view")
  async get(@Param("id") id: string): Promise<NcrDto> {
    return this.ncrs.get(currentTx(), membershipOf(), parse(uuid, id));
  }

  @Post("v1/ncrs/:id/transition")
  @HttpCode(200)
  @RequireCapability("ncr:manage")
  async transition(@Param("id") id: string, @Body() body: unknown): Promise<NcrDto> {
    const input = parse(TransitionNcrBody, body);
    return this.ncrs.transition(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/ncrs/:id/verify")
  @HttpCode(200)
  @RequireCapability("ncr:verify")
  async verify(@Param("id") id: string, @Body() body: unknown): Promise<NcrDto> {
    const input = parse(VerifyNcrBody, body);
    return this.ncrs.verify(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input.version,
      input.reason ?? null,
      auditCtxOf(),
    );
  }

  @Get("v1/ncrs/:id/actions")
  @RequireCapability("ncr:view")
  async listActions(@Param("id") id: string, @Query() query: unknown): Promise<Page<NcrActionDto>> {
    const q = parse(PageQuery, query);
    return this.ncrs.listActions(currentTx(), membershipOf(), parse(uuid, id), {
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/ncrs/:id/actions")
  @RequireCapability("ncr:manage")
  async createAction(@Param("id") id: string, @Body() body: unknown): Promise<NcrActionDto> {
    const input = parse(CreateNcrActionBody, body);
    return this.ncrs.createAction(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/ncr-actions/:id/status")
  @HttpCode(200)
  @RequireCapability("ncr:manage")
  async updateActionStatus(@Param("id") id: string, @Body() body: unknown): Promise<NcrActionDto> {
    const input = parse(UpdateNcrActionStatusBody, body);
    return this.ncrs.updateActionStatus(
      currentTx(),
      currentContext().tenantId,
      membershipOf(),
      actorIdOf(),
      parse(uuid, id),
      input.status,
      input.version,
      auditCtxOf(),
    );
  }
}
