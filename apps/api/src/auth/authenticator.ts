import type { Request } from "express";
import type { Tx } from "@kaenal/db";
import type { Membership } from "@kaenal/core";

/**
 * Step 2 of the request lifecycle (01 §3.3), behind an interface.
 *
 * The seam keeps the lifecycle independent of HOW a request is authenticated:
 * the production implementation is `SessionAuthenticator` (cookie / bearer),
 * and tests swap in a stub to drive the rest of the chain without weakening
 * the real one. Implementations run INSIDE the tenant-scoped transaction, so
 * their membership lookup is itself subject to RLS.
 */

export interface Session {
  readonly userId: string;
  readonly membership: Membership;
}

export interface Authenticator {
  /**
   * Returns null when the request carries no credentials at all. Throws
   * UNAUTHENTICATED when it carries one that fails to verify.
   *
   * A credential belonging to another tenant must return null or throw
   * UNAUTHENTICATED — never a distinguishable error, which would confirm the
   * account exists elsewhere (rule 8).
   */
  authenticate(req: Request, tx: Tx): Promise<Session | null>;
}
