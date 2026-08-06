import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import {
  AcceptAiSummaryBody,
  AiDraftRequest,
  type AiDraftDto,
  type AiSummaryDto,
} from "@kaenal/types";
import { currentContext, currentPool, currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf } from "../ncr/handler-ctx.js";
import { AI_SERVICE } from "../tokens.js";
import type { AiService } from "./ai.service.js";

/**
 * AI routes (06 §3). Any authenticated member may request a draft or accept one;
 * the gateway itself enforces entitlement, data controls, and budget, so no
 * capability decorator is needed. `draft` runs the gateway (which manages its
 * own transactions); `accept` is a document mutation in the request transaction.
 * `@Internal`: the AI gateway is an internal-staff tool, not a portal feature.
 */
@Internal()
@Controller()
export class AiController {
  constructor(@Inject(AI_SERVICE) private readonly ai: AiService) {}

  @Post("v1/ai/drafts")
  @HttpCode(200)
  async draft(@Body() body: unknown): Promise<AiDraftDto> {
    const input = parse(AiDraftRequest, body);
    return this.ai.draft(currentContext().tenantId, actorIdOf(), input, currentPool());
  }

  @Post("v1/ai/summaries/accept")
  @HttpCode(200)
  async acceptSummary(@Body() body: unknown): Promise<AiSummaryDto> {
    const input = parse(AcceptAiSummaryBody, body);
    return this.ai.acceptSummary(currentTx(), currentContext().tenantId, actorIdOf(), input, auditCtxOf());
  }
}
