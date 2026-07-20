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
import { withTenant } from "@kaenal/db";
import { authorize, type Capability } from "@kaenal/core";
import { ApiError, tenantNotFound } from "./errors.js";
import { runWithContext } from "./context.js";
import { slugFromHost, TenantRegistry } from "./tenant/registry.js";
import { IS_PUBLIC, REQUIRED_CAPABILITY } from "./decorators.js";
import { AUTHENTICATOR, ENV, TENANT_REGISTRY } from "./tokens.js";
import type { Authenticator } from "./auth/authenticator.js";
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

    return from(this.run(req, next, required));
  }

  private async run(
    req: Request,
    next: CallHandler<unknown>,
    required: Capability | undefined,
  ): Promise<unknown> {
    // --- 1. Resolve tenant ------------------------------------------------
    // Subdomain for web; X-Tenant-Id header for the mobile app (01 §3.3).
    const headerSlug = req.header("x-tenant-id");
    const slug = headerSlug ?? slugFromHost(req.header("host"), this.env.TENANT_ROOT_DOMAIN);

    if (slug === null || slug === undefined || slug === "") throw tenantNotFound();

    const tenant = await this.registry.resolveBySlug(slug);
    if (tenant === null) throw tenantNotFound();

    if (tenant.model === "dedicated") {
      // Model B routes to a per-tenant pool (01 §3.1). Not implemented, and it
      // must fail loudly rather than fall through to the shared pool, which
      // would put a dedicated tenant's data in the shared database.
      throw new ApiError("INTERNAL", "Dedicated-instance routing is not implemented");
    }

    req.tenant = { id: tenant.id, slug: tenant.slug };

    // --- 3. Scoped transaction --------------------------------------------
    // Opened before authentication so that step 2's membership query is itself
    // tenant-scoped. userId is null at this point and set inside, once known.
    return withTenant(tenant.id, null, async (tx) => {
      // --- 2. Authenticate ------------------------------------------------
      const session = await this.authenticator.authenticate(req, tx);

      // Default-deny. Anything not explicitly marked @Public requires a
      // session, whether or not it declares a capability — so forgetting
      // @RequireCapability on a new route yields a 401, not an open endpoint.
      if (session === null) {
        throw new ApiError("UNAUTHENTICATED", "Authentication required");
      }

      // Bind app.user_id now that we have one. Same transaction, so it is
      // still SET LOCAL and still cannot outlive the request.
      await tx.query("SELECT set_config('app.user_id', $1, true)", [session.userId]);

      // --- 4. RBAC --------------------------------------------------------
      if (required !== undefined) {
        const decision = authorize(session.membership, required);
        if (!decision.ok) throw ApiError.from(decision);
      }

      // --- 5. Handler -----------------------------------------------------
      return runWithContext(
        {
          requestId: req.requestId ?? "unknown",
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          userId: session.userId,
          membership: session.membership,
          tx,
          ip: req.ip ?? null,
          userAgent: req.header("user-agent") ?? null,
        },
        () => firstValueFrom(next.handle()),
      );
    });
  }
}
