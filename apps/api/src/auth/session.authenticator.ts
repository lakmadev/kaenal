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

  async authenticate(req: Request, tx: Tx, allowAnonymous = false): Promise<Session | null> {
    const token = this.extractToken(req);
    if (token === null) return null;

    const resolved = await this.auth.resolveSession(tx, token);
    if (resolved === null) {
      // A token that does not resolve is indistinguishable from no token at
      // all in what it reveals, but it must NOT fall through to "anonymous" —
      // that would silently downgrade an expired session to a public request.
      //
      // It also must NOT be turned into a CSRF failure first (the check moved
      // below for exactly this reason): a stale `kaenal_session` still in the
      // browser jar would otherwise make sign-in — an @AllowAnonymous route —
      // throw FORBIDDEN, which the lifecycle interceptor does not forgive, so
      // the user is locked out of the one page that recovers the situation.
      // Raising UNAUTHENTICATED lets that route fall through to anonymous.
      throw new ApiError("UNAUTHENTICATED", "Your session has expired");
    }

    // CSRF applies to a *valid* cookie session on an unsafe method: the resolved
    // session is precisely the protected context double-submit CSRF exists to
    // guard, so enforcing it only once the session resolves does not weaken any
    // real authenticated mutation. A bearer token is not attached automatically
    // by the browser, so it is not forgeable cross-site — demanding a CSRF
    // header from the mobile app would be theatre.
    //
    // Anonymous routes are exempt: sign-in / accept-invite / reset act on their
    // own body credentials or token, never on this session, so CSRF guards
    // nothing here. Enforcing it would let a stale-but-valid `kaenal_session`
    // (user never signed out, session still alive) throw FORBIDDEN on sign-in —
    // which the interceptor does not forgive — locking the user out with the
    // misleading "check your workspace, email, and password". See TROUBLESHOOTING.md.
    if (!allowAnonymous && this.isCookieAuth(req) && !SAFE_METHODS.has(req.method)) {
      this.requireCsrf(req);
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
