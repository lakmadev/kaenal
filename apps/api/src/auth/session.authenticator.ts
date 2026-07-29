import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { Tx } from "@kaenal/db";
import { ApiError } from "../errors.js";
import { AUTH_SERVICE } from "../tokens.js";
import type { AuthService } from "./auth.service.js";
import type { Authenticator, Session } from "./authenticator.js";
import { safeEqual } from "./passwords.js";

export const SESSION_COOKIE = "kaenal_session";
export const CSRF_COOKIE = "kaenal_csrf";
export const CSRF_HEADER = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * The real step 2 (03 §2).
 *
 * Web requests carry an httpOnly session cookie; mobile carries the same token
 * as a bearer. Both resolve through the tenant-scoped transaction, so an
 * expired session, a revoked one, or one belonging to another tenant simply
 * does not resolve — RLS on `sessions` means the lookup cannot even see it.
 */
@Injectable()
export class SessionAuthenticator implements Authenticator {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  async authenticate(req: Request, tx: Tx): Promise<Session | null> {
    const token = this.extractToken(req);
    if (token === null) return null;

    // CSRF applies to cookie auth only. A bearer token is not attached
    // automatically by the browser, so it is not forgeable cross-site — and
    // demanding a CSRF header from the mobile app would be theatre.
    if (this.isCookieAuth(req) && !SAFE_METHODS.has(req.method)) {
      this.requireCsrf(req);
    }

    const resolved = await this.auth.resolveSession(tx, token);
    if (resolved === null) {
      // A token that does not resolve is indistinguishable from no token at
      // all in what it reveals, but it must NOT fall through to "anonymous" —
      // that would silently downgrade an expired session to a public request.
      throw new ApiError("UNAUTHENTICATED", "Your session has expired");
    }

    return {
      userId: resolved.userId,
      membership: {
        role: resolved.role,
        plantIds: resolved.plantIds,
        supplierScope: resolved.supplierScope,
      },
    };
  }

  private extractToken(req: Request): string | null {
    const auth = req.header("authorization");
    if (auth !== undefined && auth.startsWith("Bearer ")) {
      const token = auth.slice("Bearer ".length).trim();
      return token === "" ? null : token;
    }

    return this.cookie(req, SESSION_COOKIE);
  }

  private isCookieAuth(req: Request): boolean {
    return req.header("authorization") === undefined && this.cookie(req, SESSION_COOKIE) !== null;
  }

  /**
   * Double-submit CSRF (03 §2): the token is in both a readable cookie and a
   * header the browser will not set cross-origin. Compared in constant time —
   * a byte-by-byte early exit leaks the correct prefix.
   */
  private requireCsrf(req: Request): void {
    const cookie = this.cookie(req, CSRF_COOKIE);
    const header = req.header(CSRF_HEADER);

    if (cookie === null || header === undefined || !safeEqual(cookie, header)) {
      throw new ApiError("FORBIDDEN", "Missing or invalid CSRF token");
    }
  }

  /**
   * Minimal cookie parsing. Deliberately not `cookie-parser`: the API needs
   * exactly two names and adding middleware that parses every cookie on every
   * request is more attack surface than value.
   */
  private cookie(req: Request, name: string): string | null {
    const header = req.header("cookie");
    if (header === undefined) return null;

    for (const part of header.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      if (part.slice(0, eq).trim() !== name) continue;
      const value = part.slice(eq + 1).trim();
      return value === "" ? null : decodeURIComponent(value);
    }
    return null;
  }
}
