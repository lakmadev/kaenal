import { AsyncLocalStorage } from "node:async_hooks";
import type pg from "pg";
import type { Tx } from "@kaenal/db";
import type { Membership } from "@kaenal/core";

/**
 * Per-request context (01 §3.3).
 *
 * Held in AsyncLocalStorage rather than passed down through every signature,
 * so that a repository cannot accidentally be handed a different transaction
 * than the one the request's `SET LOCAL app.tenant_id` was applied to. There
 * is exactly one way to get a transaction — `currentTx()` — and it is always
 * the tenant-scoped one.
 */

export interface RequestContext {
  readonly requestId: string;
  readonly tenantId: string;
  readonly tenantSlug: string;
  /** Null on public routes (health, auth start, invite accept). */
  readonly userId: string | null;
  readonly membership: Membership | null;
  readonly tx: Tx;
  /**
   * The tenant's database pool (Model B) — undefined for shared tenants. Present
   * so out-of-request-tx work (the AI gateway opens its own short transactions)
   * can route to the same database this request's tx runs on.
   */
  readonly pool: pg.Pool | undefined;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentContext(): RequestContext {
  const ctx = storage.getStore();
  if (ctx === undefined) {
    // Reaching here means a handler ran outside the scoped transaction, i.e.
    // outside RLS. Loud failure is the only safe response.
    throw new Error(
      "No request context — this code ran outside the tenant-scoped transaction (01 §3.3)",
    );
  }
  return ctx;
}

export function currentTx(): Tx {
  return currentContext().tx;
}

/** The tenant's pool (Model B), or undefined for a shared tenant (default pool). */
export function currentPool(): pg.Pool | undefined {
  return currentContext().pool;
}

/**
 * The authenticated actor. Throws on public routes, which is intended: if a
 * handler asks for the actor, it must be behind the auth guard.
 */
export function currentActorId(): string {
  const { userId } = currentContext();
  if (userId === null) {
    throw new Error("No authenticated user in context — route is public but handler expects one");
  }
  return userId;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      tenant?: { id: string; slug: string };
    }
  }
}
