import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateEightDBody,
  EightDStatus,
  PageQuery,
  TransitionEightDBody,
  UpdateEightDStepBody,
  type EightDDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { EIGHT_D_SERVICE } from "../tokens.js";
import type { EightDService } from "./eight-d.service.js";

const uuid = z.string().uuid();
const stepParam = z.coerce.number().int().min(1).max(8);
const ListQuery = PageQuery.extend({
  status: EightDStatus.optional(),
  ncrId: uuid.optional(),
});

/**
 * 8D routes (03 §1, §10). An 8D is the deep problem-solving on an NCR, so it
 * rides the NCR capabilities: `ncr:view` to read, `ncr:manage` to run the
 * disciplines and open/close it.
 */
@Controller()
export class EightDController {
  constructor(@Inject(EIGHT_D_SERVICE) private readonly eightDs: EightDService) {}

  @Get("v1/eight-ds")
  @RequireCapability("ncr:view")
  async list(@Query() query: unknown): Promise<Page<EightDDto>> {
    const q = parse(ListQuery, query);
    return this.eightDs.list(currentTx(), {
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.ncrId !== undefined ? { ncrId: q.ncrId } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Post("v1/eight-ds")
  @RequireCapability("ncr:manage")
  async create(@Body() body: unknown): Promise<EightDDto> {
    const input = parse(CreateEightDBody, body);
    return this.eightDs.create(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }

  @Get("v1/eight-ds/:id")
  @RequireCapability("ncr:view")
  async get(@Param("id") id: string): Promise<EightDDto> {
    return this.eightDs.get(currentTx(), parse(uuid, id));
  }

  @Post("v1/eight-ds/:id/steps/:step")
  @HttpCode(200)
  @RequireCapability("ncr:manage")
  async updateStep(
    @Param("id") id: string,
    @Param("step") step: string,
    @Body() body: unknown,
  ): Promise<EightDDto> {
    const input = parse(UpdateEightDStepBody, body);
    return this.eightDs.updateStep(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      parse(stepParam, step),
      input,
      auditCtxOf(),
    );
  }

  @Post("v1/eight-ds/:id/transition")
  @HttpCode(200)
  @RequireCapability("ncr:manage")
  async transition(@Param("id") id: string, @Body() body: unknown): Promise<EightDDto> {
    const input = parse(TransitionEightDBody, body);
    return this.eightDs.transition(
      currentTx(),
      currentContext().tenantId,
      actorIdOf(),
      parse(uuid, id),
      input,
      auditCtxOf(),
    );
  }
}
