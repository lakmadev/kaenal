import { Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { currentContext, currentTx } from "../context.js";
import { ApiError } from "../errors.js";
import { AUTH_SERVICE } from "../tokens.js";
import type { AuthService } from "./auth.service.js";
import { SESSION_COOKIE } from "./session.authenticator.js";

/**
 * Self-service session management (07 §7). Authenticated, capability-free — every
 * user sees and controls their own devices. Sessions are tenant-scoped, so this
 * lists only the caller's live sessions in the current workspace; the session the
 * request is made from is flagged `current` and can't be signed out from the list
 * (use sign-out for that). Revocations are audited in the tenant's trail.
 */
const SessionId = z.string().uuid();

export interface SessionSummary {
  readonly id: string;
  readonly current: boolean;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly signedInAt: string;
  readonly expiresAt: string;
}

@Controller("v1/auth/sessions")
export class SessionsController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  @Get()
  async list(@Req() req: Request): Promise<{ sessions: SessionSummary[] }> {
    const sessions = await this.auth.listSessions(currentTx(), this.userId(), this.currentToken(req));
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        current: s.current,
        ip: s.ip,
        userAgent: s.userAgent,
        signedInAt: s.signedInAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    };
  }

  /** Sign out one other device. */
  @Post(":id/revoke")
  async revoke(@Param("id") id: string): Promise<{ ok: true }> {
    const parsed = SessionId.safeParse(id);
    if (!parsed.success) throw new ApiError("NOT_FOUND", "Session not found");
    const ctx = currentContext();
    await this.auth.revokeSession(currentTx(), ctx.tenantId, this.userId(), parsed.data, {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    return { ok: true };
  }

  /** Sign out every other device, keeping the one this request came from. */
  @Post("revoke-others")
  async revokeOthers(@Req() req: Request): Promise<{ revoked: number }> {
    const ctx = currentContext();
    const revoked = await this.auth.revokeOtherSessions(
      currentTx(),
      ctx.tenantId,
      this.userId(),
      this.currentToken(req),
      { ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId },
    );
    return { revoked };
  }

  private userId(): string {
    const id = currentContext().userId;
    if (id === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
    return id;
  }

  /** The token this request authenticated with — cookie (web) or bearer (mobile). */
  private currentToken(req: Request): string | null {
    for (const part of (req.header("cookie") ?? "").split(";")) {
      const [k, ...rest] = part.split("=");
      if (k?.trim() === SESSION_COOKIE) return decodeURIComponent(rest.join("=").trim());
    }
    const auth = req.header("authorization");
    return auth?.startsWith("Bearer ") === true ? auth.slice(7).trim() : null;
  }
}
