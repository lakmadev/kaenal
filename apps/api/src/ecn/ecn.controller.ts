import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  CreateEcnBody,
  DecideEcnApprovalBody,
  EcnApprovalStage,
  EcnLifecycleBody,
  EcnLinkBody,
  EcnListQuery,
  UpdateEcnBody,
  type EcnApprovalDto,
  type EcnDto,
  type EcnLinkDto,
  type EcnSummaryDto,
  type Page,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { ECN_SERVICE, IDEMPOTENCY } from "../tokens.js";
import type { EcnService } from "./ecn.service.js";

const uuid = z.string().uuid();

/**
 * Engineering Change Notice routes (SPRINT-06 E1-E5). `/v1/ecns/summary` is
 * registered before `/v1/ecns/:id` so the literal path is never shadowed by
 * the param route.
 */
@Controller()
export class EcnController {
  constructor(
    @Inject(ECN_SERVICE) private readonly ecns: EcnService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  @Get("v1/ecns")
  @RequireCapability("ecn:view")
  async list(@Query() query: unknown): Promise<Page<EcnDto>> {
    const q = parse(EcnListQuery, query);
    return this.ecns.list(currentTx(), {
      ...(q.changeType !== undefined ? { changeType: q.changeType } : {}),
      ...(q.stage !== undefined ? { stage: q.stage } : {}),
      ...(q.changeRisk !== undefined ? { changeRisk: q.changeRisk } : {}),
      ...(q.owner !== undefined ? { owner: q.owner } : {}),
      ...(q.q !== undefined ? { q: q.q } : {}),
      ...(q.cursor !== undefined ? { cursor: q.cursor } : {}),
      limit: q.limit,
    });
  }

  @Get("v1/ecns/summary")
  @RequireCapability("ecn:view")
  async summary(): Promise<EcnSummaryDto> {
    return this.ecns.summary(currentTx());
  }

  @Post("v1/ecns")
  @RequireCapability("ecn:manage")
  async create(@Body() body: unknown, @Headers("idempotency-key") idempotencyKey: string | undefined): Promise<EcnDto> {
    const input = parse(CreateEcnBody, body);
    const ctx = currentContext();
    const actorId = actorIdOf();
    const { result } = await this.idempotency.run(`${ctx.tenantId}:create-ecn`, idempotencyKey, () =>
      this.ecns.create(currentTx(), ctx.tenantId, actorId, input, auditCtxOf()),
    );
    return result;
  }

  @Get("v1/ecns/:id")
  @RequireCapability("ecn:view")
  async get(@Param("id") id: string): Promise<EcnDto> {
    return this.ecns.get(currentTx(), parse(uuid, id));
  }

  @Patch("v1/ecns/:id")
  @RequireCapability("ecn:manage")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<EcnDto> {
    const input = parse(UpdateEcnBody, body);
    return this.ecns.update(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/ecns/:id/submit")
  @RequireCapability("ecn:manage")
  async submit(@Param("id") id: string, @Body() body: unknown): Promise<EcnDto> {
    const input = parse(EcnLifecycleBody, body);
    return this.ecns.submit(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input.lockVersion, auditCtxOf());
  }

  @Post("v1/ecns/:id/withdraw")
  @RequireCapability("ecn:manage")
  async withdraw(@Param("id") id: string, @Body() body: unknown): Promise<EcnDto> {
    const input = parse(EcnLifecycleBody, body);
    return this.ecns.withdraw(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input.lockVersion, auditCtxOf());
  }

  @Post("v1/ecns/:id/resubmit")
  @RequireCapability("ecn:manage")
  async resubmit(@Param("id") id: string, @Body() body: unknown): Promise<EcnDto> {
    const input = parse(EcnLifecycleBody, body);
    return this.ecns.resubmit(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input.lockVersion, auditCtxOf());
  }

  @Post("v1/ecns/:id/close")
  @RequireCapability("ecn:manage")
  async close(@Param("id") id: string, @Body() body: unknown): Promise<EcnDto> {
    const input = parse(EcnLifecycleBody, body);
    return this.ecns.close(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), input.lockVersion, auditCtxOf());
  }

  @Get("v1/ecns/:id/approvals")
  @RequireCapability("ecn:view")
  async listApprovals(@Param("id") id: string): Promise<EcnApprovalDto[]> {
    return this.ecns.listApprovals(currentTx(), parse(uuid, id));
  }

  @Post("v1/ecns/:id/approvals/:stage")
  @RequireCapability("ecn:approve")
  async decideApproval(@Param("id") id: string, @Param("stage") stage: string, @Body() body: unknown): Promise<EcnDto> {
    const input = parse(DecideEcnApprovalBody, body);
    const gatedStage = parse(EcnApprovalStage, stage);
    return this.ecns.decideApproval(
      currentTx(),
      currentContext().tenantId,
      membershipOf().role,
      actorIdOf(),
      parse(uuid, id),
      gatedStage,
      input,
      auditCtxOf(),
    );
  }

  @Get("v1/ecns/:id/links")
  @RequireCapability("ecn:view")
  async listLinks(@Param("id") id: string): Promise<EcnLinkDto[]> {
    return this.ecns.listLinks(currentTx(), parse(uuid, id));
  }

  @Post("v1/ecns/:id/link")
  @RequireCapability("ecn:manage")
  async link(@Param("id") id: string, @Body() body: unknown): Promise<EcnLinkDto> {
    const input = parse(EcnLinkBody, body);
    return this.ecns.link(currentTx(), currentContext().tenantId, membershipOf(), actorIdOf(), parse(uuid, id), input, auditCtxOf());
  }

  @Post("v1/ecns/:id/links/:linkId/delete")
  @HttpCode(200)
  @RequireCapability("ecn:manage")
  async unlink(@Param("id") id: string, @Param("linkId") linkId: string): Promise<EcnDto> {
    return this.ecns.unlink(currentTx(), currentContext().tenantId, actorIdOf(), parse(uuid, id), parse(uuid, linkId), auditCtxOf());
  }
}
