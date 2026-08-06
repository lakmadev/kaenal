import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, from, type Observable } from "rxjs";
import type { Request } from "express";
import type pg from "pg";
import { withTenant } from "@kaenal/db";
import { authorize, isPartner, type Capability } from "@kaenal/core";
import { ApiError, tenantNotFound } from "./errors.js";
import { runWithContext } from "./context.js";
import { slugFromHost, TenantRegistry } from "./tenant/registry.js";
import type { TenantPoolManager } from "./tenant/pool-manager.js";
import { IS_ANONYMOUS, IS_INTERNAL, IS_PUBLIC, REQUIRED_CAPABILITY } from "./decorators.js";
import { AUTHENTICATOR, ENV, RATE_LIMITER, TENANT_POOLS, TENANT_REGISTRY } from "./tokens.js";
import type { Authenticator, Session } from "./auth/authenticator.js";
import { USER_LIMIT, type RateLimiter } from "./http/rate-limit.js";
import type { Env } from "./env.js";

/**
 * The 01 §3.3 request lifecycle, in order:
 *
 *   1. resolve tenant   → unknown/suspended = 404, never 403
 *   2. authenticate     → verify membership in THIS tenant, mismatch = 404
 *   3. scoped transaction (SET LOCAL app.tenant_id / app.user_id)
 *   4. RBAC guard
 *   5. handler
 *
 * Deliberately ONE interceptor rather than a middleware + two guards.
 *
 * Nest runs guards before interceptors, so a conventional split would put
 * authentication and RBAC *outside* the transaction that scopes them — the
 * membership lookup in step 2 would then run unscoped, on a connection with no
 * `app.tenant_id`, which is precisely the read RLS exists to constrain. Keeping
 * the whole chain inside `withTenant` means every query this request makes,
 * including the ones that decide whether the request is allowed, is subject to
 * the same tenant policy. The ordering is a security property, not a style
 * preference.
 */
@Injectable()
export class RequestLifecycleInterceptor implements NestInterceptor {
  constructor(
    @Inject(TENANT_REGISTRY) private readonly registry: TenantRegistry,
    @Inject(ENV) private readonly env: Env,
    @Inject(AUTHENTICATOR) private readonly authenticator: Authenticator,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiter,
    @Inject(TENANT_POOLS) private readonly pools: TenantPoolManager,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const controller = context.getClass();

    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, controller]) ?? false;

    if (isPublic) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const required = this.reflector.getAllAndOverride<Capability | undefined>(REQUIRED_CAPABILITY, [
      handler,
      controller,
    ]);
    const allowAnonymous =
      this.reflector.getAllAndOverride<boolean>(IS_ANONYMOUS, [handler, controller]) ?? false;
    const internalOnly =
      this.reflector.getAllAndOverride<boolean>(IS_INTERNAL, [handler, controller]) ?? false;

    return from(this.run(req, next, required, allowAnonymous, internalOnly));
  }

  private async run(
    req: Request,
    next: CallHandler<unknown>,
    required: Capability | undefined,
    allowAnonymous: boolean,
    internalOnly: boolean,
  ): Promise<unknown> {
    // --- 1. Resolve tenant ------------------------------------------------
    // Subdomain for web; X-Tenant-Id header for the mobile app (01 §3.3).
    const headerSlug = req.header("x-tenant-id");
    const slug = headerSlug ?? slugFromHost(req.header("host"), this.env.TENANT_ROOT_DOMAIN);

    if (slug === null || slug === undefined || slug === "") throw tenantNotFound();

    const tenant = await this.registry.resolveBySlug(slug);
    if (tenant === null) throw tenantNotFound();

    // --- 3a. Route to the tenant's database (01 §3.1 / §3.3 step 3) -------
    // Model A tenants share `@kaenal/db`'s appPool (withTenant's default);
    // Model B tenants each get their own pool, keyed on the registry's secret
    // ref. A dedicated tenant with no secret ref is a corrupt registry row and
    // must fail loudly — never fall through to the shared pool, which would put
    // its data in the wrong database. (The schema CHECK makes this unreachable,
    // but the guard keeps the invariant local to where it matters.)
    let pool: pg.Pool | undefined;
    if (tenant.model === "dedicated") {
      if (tenant.databaseUrlSecretRef === null) {
        throw new ApiError("INTERNAL", "Dedicated tenant is missing its connection secret");
      }
      pool = await this.pools.poolFor(tenant.id, tenant.databaseUrlSecretRef);
    }

    req.tenant = { id: tenant.id, slug: tenant.slug };

    // --- 3b. Scoped transaction -------------------------------------------
    // Opened before authentication so that step 2's membership query is itself
    // tenant-scoped. userId is null at this point and set inside, once known.
    // RLS applies on the dedicated pool exactly as on the shared one.
    return withTenant(tenant.id, null, async (tx) => {
      // --- 2. Authenticate ------------------------------------------------
      // On an explicitly-anonymous route (sign-in, accept-invite) a stale or
      // otherwise unresolvable session cookie must NOT block the request: there
      // is no protected resource to downgrade, and a user whose session expired
      // has to be able to sign in again while the old cookie is still in the jar.
      // Authenticated routes still surface the error (default-deny below).
      let session: Session | null;
      try {
        session = await this.authenticator.authenticate(req, tx);
      } catch (err) {
        if (allowAnonymous && err instanceof ApiError && err.code === "UNAUTHENTICATED") {
          session = null;
        } else {
          throw err;
        }
      }

      // Default-deny. Anything not marked @Public or @AllowAnonymous requires
      // a session, whether or not it declares a capability — so forgetting
      // @RequireCapability on a new route yields a 401, not an open endpoint.
      if (session === null && !allowAnonymous) {
        throw new ApiError("UNAUTHENTICATED", "Authentication required");
      }

      if (session !== null) {
        // Bind app.user_id now that we have one. Same transaction, so it is
        // still SET LOCAL and still cannot outlive the request.
        await tx.query("SELECT set_config('app.user_id', $1, true)", [session.userId]);

        // Per-user request cap (03 §9). Enforced after authentication because
        // it is keyed on the user; a rejection here rolls back the (so far
        // empty) transaction. Per-IP login limiting lives on the auth routes,
        // which are anonymous and so never reach this branch.
        if (this.env.RATE_LIMIT_ENABLED) {
          await this.rateLimiter.enforce(
            `user:${tenant.id}:${session.userId}`,
            USER_LIMIT.limit,
            USER_LIMIT.windowMs,
          );
        }
      }

      // Internal-only routes refuse an external partner even with a valid
      // session (e.g. `/v1/files/*`, which carry no capability). A partner's
      // sanctioned file path is the portal-scoped `/v1/portal/files/*`.
      if (internalOnly && session !== null && isPartner(session.membership.role)) {
        throw new ApiError("FORBIDDEN", "This endpoint is not available to supplier-portal accounts");
      }

      // --- 4. RBAC --------------------------------------------------------
      if (required !== undefined) {
        // A capability requirement always implies a session, even on a route
        // that also permits anonymous access.
        if (session === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
        const decision = authorize(session.membership, required);
        if (!decision.ok) throw ApiError.from(decision);
      }

      // --- 5. Handler -----------------------------------------------------
      return runWithContext(
        {
          requestId: req.requestId ?? "unknown",
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          userId: session?.userId ?? null,
          membership: session?.membership ?? null,
          tx,
          pool,
          ip: req.ip ?? null,
          userAgent: req.header("user-agent") ?? null,
        },
        () => firstValueFrom(next.handle()),
      );
    }, pool);
  }
}
