import type { Request } from "express";
import type { Tx } from "@kaenal/db";
import type { Membership } from "@kaenal/core";
import { ApiError } from "../errors.js";

/**
 * Step 2 of the request lifecycle (01 §3.3), behind an interface.
 *
 * The seam exists so the auth module (03 §2) is a provider swap rather than
 * surgery on the lifecycle, and so tests can drive the rest of the chain with
 * a stub without weakening the real implementation. Implementations run
 * INSIDE the tenant-scoped transaction, so their membership lookup is itself
 * subject to RLS.
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

/**
 * The default until 03 §2 lands.
 *
 * No credential format exists yet and the seeded admin sits at
 * status='invited' with no password, so nothing is loginable by design. This
 * rejects any presented credential rather than ignoring it, so that a client
 * built against a half-finished API cannot appear to authenticate.
 */
export class NotImplementedAuthenticator implements Authenticator {
  authenticate(req: Request, _tx: Tx): Promise<Session | null> {
    const presentsCredential =
      req.header("authorization") !== undefined ||
      req.header("cookie")?.includes("kaenal_session") === true;

    if (presentsCredential) {
      throw new ApiError("UNAUTHENTICATED", "Authentication is not yet implemented");
    }

    return Promise.resolve(null);
  }
}
