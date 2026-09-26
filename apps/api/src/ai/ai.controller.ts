import { Body, Controller, Headers, HttpCode, Inject, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  AcceptAiSummaryBody,
  AiChatRequest,
  AiDraftRequest,
  type AiDraftDto,
  type AiSummaryDto,
} from "@kaenal/types";
import { currentContext, currentPool, currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { ApiError } from "../errors.js";
import type { IdempotencyStore } from "../http/idempotency.js";
import { parse } from "../http/validate.js";
import { actorIdOf, auditCtxOf, membershipOf } from "../ncr/handler-ctx.js";
import { AI_SERVICE, IDEMPOTENCY } from "../tokens.js";
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
  constructor(
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @Inject(IDEMPOTENCY) private readonly idempotency: IdempotencyStore,
  ) {}

  /**
   * SSE chat (S1-4). Like `/v1/events`: the handshake (auth, RBAC, entity
   * resolution, `ai_chat` audit) runs in the request tx, then the handler
   * returns so the tx commits and NO connection is held while the model runs;
   * the socket stays open via `@Res()`. A repeated `Idempotency-Key` is a 409
   * (no second model call or charge). Chat never writes business data.
   */
  @Post("v1/ai/chat")
  @RequireCapability("ai:use")
  async chat(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const input = parse(AiChatRequest, body);
    const ctx = currentContext();
    const userId = actorIdOf();
    const pool = currentPool();
    const { result: prepared, replayed } = await this.idempotency.run(
      `${ctx.tenantId}:ai-chat:${userId}`,
      idempotencyKey,
      () => this.ai.prepareChat(currentTx(), ctx.tenantId, membershipOf(), userId, input, auditCtxOf()),
    );
    if (replayed) throw new ApiError("CONFLICT", "This chat request was already processed - retry with a new idempotency key");

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    let open = true;
    res.on("close", () => {
      open = false;
    });
    void (async () => {
      try {
        for await (const chunk of this.ai.chatStream(ctx.tenantId, userId, prepared, pool)) {
          if (!open) return;
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      } catch {
        if (open) {
          const err = { type: "error", code: "AI_UNAVAILABLE", message: "AI is temporarily unavailable - please try again", requestId: prepared.requestId };
          res.write(`data: ${JSON.stringify(err)}\n\n`);
        }
      } finally {
        res.end();
      }
    })();
  }

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
