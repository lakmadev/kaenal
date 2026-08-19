import { Body, Controller, Delete, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import { currentContext } from "../context.js";
import { ApiError } from "../errors.js";
import { PUSH_TOKENS_SERVICE } from "../tokens.js";
import type { PushTokensService } from "./push-tokens.service.js";

/**
 * Self-service device push-token registration (05 §3). Authenticated and
 * capability-free — every user registers their own device for the notifications
 * they already receive. NOT `@Internal`. The mobile app POSTs its Expo push token
 * after sign-in and DELETEs it on sign-out.
 */
const RegisterBody = z.object({
  token: z.string().min(1).max(512),
  platform: z.string().max(20).optional(),
});
const UnregisterBody = z.object({ token: z.string().min(1).max(512) });

@Controller("v1/push-tokens")
export class PushTokensController {
  constructor(@Inject(PUSH_TOKENS_SERVICE) private readonly svc: PushTokensService) {}

  @Post()
  async register(@Body() body: unknown): Promise<{ ok: true }> {
    const parsed = RegisterBody.safeParse(body);
    if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "A device token is required");
    await this.svc.register(this.userId(), parsed.data.token, parsed.data.platform ?? null);
    return { ok: true };
  }

  @Delete()
  async unregister(@Body() body: unknown): Promise<{ ok: true }> {
    const parsed = UnregisterBody.safeParse(body);
    if (!parsed.success) throw new ApiError("VALIDATION_FAILED", "A device token is required");
    await this.svc.unregister(parsed.data.token);
    return { ok: true };
  }

  private userId(): string {
    const id = currentContext().userId;
    if (id === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
    return id;
  }
}
