import { Body, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { InternalRole } from "@kaenal/types";
import { WEB_SESSION_TTL_MS, PASSWORD_RESET_TTL_MS, INVITATION_TTL_MS } from "@kaenal/core";
import { currentContext, currentTx } from "../context.js";
import { AllowAnonymous, Public, RequireCapability } from "../decorators.js";
import { ApiError } from "../errors.js";
import { AUTH_SERVICE, ENV, JOB_PRODUCER, RATE_LIMITER } from "../tokens.js";
import type { JobProducer } from "../jobs/producer.js";
import { renderPasswordReset, renderInvite } from "../providers/email/index.js";
import { LOGIN_LIMIT, type RateLimiter } from "../http/rate-limit.js";
import type { Env } from "../env.js";
import type { AuthService } from "./auth.service.js";
import { CSRF_COOKIE, SESSION_COOKIE } from "./session.authenticator.js";
import { generateToken } from "./passwords.js";

/**
 * Auth routes (03 §2).
 *
 * Sign-in is `@Public` because it must run before a session exists — but it
 * still needs the tenant, which it resolves itself rather than inheriting from
 * the lifecycle. Everything else here goes through the normal chain.
 */

const SignInBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(256),
  /** TOTP or recovery code — present only on the second step of an MFA sign-in. */
  code: z.string().min(1).max(64).optional(),
});

const AcceptInviteBody = z.object({
  token: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
});

const InviteBody = z.object({
  email: z.string().email().max(320),
  // Internal roles only — a `partner` is onboarded through the (separate)
  // supplier-scoped portal invite, never the staff invite, so this endpoint can
  // never mint an un-scoped external membership.
  role: InternalRole,
  plantIds: z.array(z.string().uuid()).optional(),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

const ForgotBody = z.object({ email: z.string().email().max(320) });

const ResetBody = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(1).max(256),
});

/** Whether the caller wants a bearer session (mobile) instead of the cookie flow. */
function wantsBearer(req: Request): boolean {
  return req.header("x-auth-mode")?.toLowerCase() === "bearer";
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError("VALIDATION_FAILED", "Request body is invalid", {
      issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

@Controller("v1/auth")
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
    @Inject(JOB_PRODUCER) private readonly jobs: JobProducer,
  ) {}

  /**
   * Per-IP throttle for the credential endpoints (03 §9). This is the limit
   * that matters against credential stuffing: account lockout caps guesses at
   * one account, but an attacker spreading five guesses each across a thousand
   * accounts never trips a per-account lock — only a per-IP cap does.
   */
  private async throttleLogin(ip: string | null): Promise<void> {
    if (!this.env.RATE_LIMIT_ENABLED) return;
    await this.rateLimiter.enforce(`login:${ip ?? "unknown"}`, LOGIN_LIMIT.limit, LOGIN_LIMIT.windowMs);
  }

  @AllowAnonymous()
  @Post("sign-in")
  async signIn(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | { userId: string; role: string; expiresAt: string; sessionToken?: string }
    | { mfaRequired: true }
  > {
    const { email, password, code } = parse(SignInBody, body);
    const ctx = currentContext();
    await this.throttleLogin(ctx.ip);

    const outcome = await this.auth.signIn(currentTx(), ctx.tenantId, email, password, code ?? null, {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    // Password accepted, second factor still needed: no cookies, no session.
    if (outcome.kind === "mfa_required") return { mfaRequired: true };

    const base = {
      userId: outcome.result.userId,
      role: outcome.result.role,
      expiresAt: outcome.result.expiresAt.toISOString(),
    };

    // Bearer clients (the mobile app) have no cookie jar and hold the session in
    // SecureStore (05 §3). When they opt in via `X-Auth-Mode: bearer` we return the
    // raw token in the body and set NO cookies. The session authenticator already
    // accepts `Authorization: Bearer <token>`, so nothing else changes. Web clients
    // send no such header and keep the httpOnly-cookie + double-submit-CSRF path
    // untouched — the token is never exposed to browser JS.
    if (wantsBearer(req)) return { ...base, sessionToken: outcome.result.sessionToken };

    const csrfToken = generateToken();
    this.setCookies(res, outcome.result.sessionToken, csrfToken);
    return base;
  }

  @Post("sign-out")
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const ctx = currentContext();
    const token = this.sessionToken(req);

    if (token !== null && ctx.userId !== null) {
      await this.auth.signOut(currentTx(), ctx.tenantId, token, ctx.userId);
    }

    this.clearCookies(res);
    return { ok: true };
  }

  /**
   * Change the signed-in user's password (07 §2). Authenticated, so it runs the
   * normal chain (CSRF-checked on the cookie). The current session survives; every
   * other session is revoked by the service.
   */
  @Post("change-password")
  async changePassword(@Body() body: unknown, @Req() req: Request): Promise<{ ok: true }> {
    const { currentPassword, newPassword } = parse(ChangePasswordBody, body);
    const ctx = currentContext();
    if (ctx.userId === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");

    await this.auth.changePassword(
      currentTx(),
      ctx.tenantId,
      ctx.userId,
      currentPassword,
      newPassword,
      this.sessionToken(req),
      { ip: ctx.ip, userAgent: ctx.userAgent, requestId: ctx.requestId },
    );
    return { ok: true };
  }

  @AllowAnonymous()
  @Post("accept-invite")
  async acceptInvite(@Body() body: unknown): Promise<{ ok: true }> {
    // Unauthenticated by definition, but tenant-scoped: an invitation belongs
    // to one tenant. @AllowAnonymous runs the lifecycle's tenant resolution and
    // opens the scoped transaction, so this reads and writes tenant rows under
    // RLS without a session — no hand-rolled tenant lookup.
    const { token, name, password } = parse(AcceptInviteBody, body);
    const ctx = currentContext();

    await this.auth.acceptInvitation(currentTx(), ctx.tenantId, token, name, password);

    return { ok: true };
  }

  @Post("invite")
  @RequireCapability("members:manage")
  async invite(@Body() body: unknown): Promise<{ email: string; expiresAt: string; token?: string }> {
    const { email, role, plantIds } = parse(InviteBody, body);
    const ctx = currentContext();
    if (ctx.userId === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");

    const { token, expiresAt } = await this.auth.invite(
      currentTx(),
      ctx.tenantId,
      ctx.userId,
      email,
      role,
      plantIds ?? [],
    );

    // Email the invitee their acceptance link. `?workspace=` carries the slug the
    // accept-invite page needs as X-Tenant-Id. Enqueued so the admin's request
    // returns without waiting on the mail provider.
    const url = `${this.env.APP_BASE_URL}/invite/${encodeURIComponent(token)}?workspace=${encodeURIComponent(ctx.tenantSlug)}`;
    await this.jobs.sendEmail({
      message: {
        to: email,
        ...renderInvite({
          url,
          workspaceName: ctx.tenantSlug,
          expiresHours: Math.round(INVITATION_TTL_MS / 3_600_000),
        }),
      },
    });

    // The token is returned only outside production, where there is no mail
    // delivery yet. In production it must reach the invitee by email and
    // nobody else — an admin who can read it can impersonate the invitee.
    return this.env.NODE_ENV === "production"
      ? { email, expiresAt: expiresAt.toISOString() }
      : { email, expiresAt: expiresAt.toISOString(), token };
  }

  @Public()
  @Post("forgot-password")
  async forgotPassword(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ ok: true; token?: string }> {
    await this.throttleLogin(req.ip ?? null);
    const { email } = parse(ForgotBody, body);
    const token = await this.auth.requestPasswordReset(email);

    // Send the email only when the account exists — but the HTTP response is
    // identical either way, so this is not an enumeration oracle. Enqueued (not
    // sent inline) so the response isn't gated on the mail provider.
    if (token !== null) {
      const url = `${this.env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
      await this.jobs.sendEmail({
        message: {
          to: email,
          ...renderPasswordReset({ url, expiresMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60_000) }),
        },
      });
    }

    // Always `ok: true`, whether or not the address is known. Anything else is
    // an unauthenticated account-enumeration endpoint.
    return this.env.NODE_ENV === "production" || token === null ? { ok: true } : { ok: true, token };
  }

  @Public()
  @Post("reset-password")
  async resetPassword(@Body() body: unknown, @Req() req: Request): Promise<{ ok: true }> {
    await this.throttleLogin(req.ip ?? null);
    const { token, password } = parse(ResetBody, body);
    await this.auth.completePasswordReset(token, password);
    return { ok: true };
  }

  private sessionToken(req: Request): string | null {
    const header = req.header("cookie") ?? "";
    for (const part of header.split(";")) {
      const [k, ...rest] = part.split("=");
      if (k?.trim() === SESSION_COOKIE) return decodeURIComponent(rest.join("=").trim());
    }
    const auth = req.header("authorization");
    return auth?.startsWith("Bearer ") === true ? auth.slice(7) : null;
  }

  private setCookies(res: Response, sessionToken: string, csrfToken: string): void {
    const secure = this.env.NODE_ENV === "production";

    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true, // unreadable from JS, so XSS cannot exfiltrate the session
      secure,
      sameSite: "lax", // blocks cross-site POSTs while keeping normal navigation
      maxAge: WEB_SESSION_TTL_MS,
      path: "/",
    });

    // Readable by design: the client must echo it in a header for the
    // double-submit check. It authorises nothing on its own.
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      maxAge: WEB_SESSION_TTL_MS,
      path: "/",
    });
  }

  private clearCookies(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.clearCookie(CSRF_COOKIE, { path: "/" });
  }
}
