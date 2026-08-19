import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { WEB_SESSION_TTL_MS } from "@kaenal/core";
import { SwitchWorkspaceBody, type WorkspaceDto, type WorkspacesDto } from "@kaenal/types";
import { currentContext } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { AUTH_SERVICE, ENV } from "../tokens.js";
import type { Env } from "../env.js";
import type { AuthService } from "./auth.service.js";
import { CSRF_COOKIE, SESSION_COOKIE } from "./session.authenticator.js";
import { generateToken } from "./passwords.js";
import { actorIdOf } from "../ncr/handler-ctx.js";

/**
 * The workspace switcher (shell.jsx profile menu). Both routes are authenticated
 * — the caller must have a valid session in their current workspace — and both
 * scope strictly to that caller's own memberships. `@Internal`: the multi-
 * workspace switcher is internal-app chrome; the portal is single-supplier.
 */
@Internal()
@Controller("v1/me")
export class WorkspaceController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get("workspaces")
  async list(): Promise<WorkspacesDto> {
    const ctx = currentContext();
    const items = await this.auth.listWorkspaces(actorIdOf(), ctx.tenantSlug);
    return { items };
  }

  @Post("switch-workspace")
  @HttpCode(200)
  async switch(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WorkspaceDto> {
    const { slug } = parse(SwitchWorkspaceBody, body);
    const ctx = currentContext();
    const result = await this.auth.switchWorkspace(actorIdOf(), slug, {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    // Bearer clients (mobile) hold the session in SecureStore (05 §3): return the
    // target-tenant token in the body and set no cookies. The client stores it and
    // re-scopes its next requests to the new workspace.
    if (req.header("x-auth-mode")?.toLowerCase() === "bearer") {
      return { ...result.workspace, sessionToken: result.sessionToken };
    }

    // Web: issue the target-tenant session + a fresh CSRF token as httpOnly cookies.
    // The client updates its readable workspace cookie (kaenal_tenant) and reloads,
    // so the next request rides the new session into the new workspace.
    const secure = this.env.NODE_ENV === "production";
    res.cookie(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: WEB_SESSION_TTL_MS,
      path: "/",
    });
    res.cookie(CSRF_COOKIE, generateToken(), {
      httpOnly: false,
      secure,
      sameSite: "lax",
      maxAge: WEB_SESSION_TTL_MS,
      path: "/",
    });

    return result.workspace;
  }
}
