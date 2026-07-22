import type { Membership } from "@kaenal/core";
import { currentContext } from "../context.js";
import { ApiError } from "../errors.js";
import type { AuditContext } from "./audit-context.js";

/**
 * The three things every capability-gated handler pulls off the request context.
 * A route that declares a capability always has a session (the lifecycle
 * enforces it), so these never legitimately return null — the guards document
 * that invariant and fail loudly if it is ever violated.
 */

export function membershipOf(): Membership {
  const { membership } = currentContext();
  if (membership === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
  return membership;
}

export function actorIdOf(): string {
  const { userId } = currentContext();
  if (userId === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
  return userId;
}

export function auditCtxOf(): AuditContext {
  const { requestId, ip, userAgent } = currentContext();
  return { requestId, ip, userAgent };
}
