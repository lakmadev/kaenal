// Push execution (05 §2.2) — turns a queued mutation into an HTTP call and
// normalises the response into a PushOutcome the pure conflict reducer understands.
//
// The kind→call mapping lives in a dispatch table that grows one entry per feature
// phase (inspection.answer in M6, ncr.create in M8, file.attach in M7, …). Each
// entry issues the real ts-rest call WITH the mutation id as `Idempotency-Key`
// (extraHeaders) so replays are safe, and passes the last-seen `version` in the body
// so the server can do its optimistic-concurrency compare (03 §6). Keeping the table
// external means new kinds are added without touching the engine.

import type { MutationRecord, PushOutcome } from "./types.js";

/** A ts-rest-style response: discriminated by numeric `status`. */
export interface HttpResult {
  status: number;
  body: unknown;
}

/** One dispatch entry: perform the write for a mutation kind, return the raw result. */
export type PushCall = (mutation: MutationRecord) => Promise<HttpResult>;

/** The function the engine calls per mutation. */
export type PushFn = (mutation: MutationRecord) => Promise<PushOutcome>;

function errorCode(body: unknown): string | undefined {
  if (body && typeof body === "object" && "code" in body) {
    const c = (body as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}
function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
function versioned(body: unknown): { updatedAt: string; version: number } | null {
  if (body && typeof body === "object" && "updatedAt" in body && "version" in body) {
    const b = body as { updatedAt?: unknown; version?: unknown };
    if (typeof b.updatedAt === "string" && typeof b.version === "number") {
      return { updatedAt: b.updatedAt, version: b.version };
    }
  }
  return null;
}

/**
 * Map an HTTP result to a PushOutcome (05 §2.3 wire mapping). Pure and unit-tested:
 *  200/201 → ok (reads back updatedAt/version); 409 STALE_WRITE → stale_write;
 *  other 409/422-conflict → conflict_transition; 404 → not_found;
 *  400/422 → validation; 401/403 → auth; 0/5xx/408/429 → transient.
 */
export function normalizeOutcome(res: HttpResult): PushOutcome {
  const { status, body } = res;
  if (status === 200 || status === 201) {
    const v = versioned(body);
    // A create/answer that returns no versioned row still succeeded; use epoch so the
    // engine records completion without a bogus mirror bump.
    return v
      ? { kind: "ok", serverUpdatedAt: v.updatedAt, serverVersion: v.version }
      : { kind: "ok", serverUpdatedAt: new Date(0).toISOString(), serverVersion: 0 };
  }
  if (status === 401 || status === 403) return { kind: "auth" };
  if (status === 404) return { kind: "not_found" };
  if (status === 409) {
    return errorCode(body) === "STALE_WRITE"
      ? { kind: "stale_write" }
      : { kind: "conflict_transition", message: errorMessage(body, "This record changed on the server.") };
  }
  if (status === 400 || status === 422) return { kind: "validation", message: errorMessage(body, "The server rejected this change.") };
  if (status === 0 || status === 408 || status === 429 || status >= 500) return { kind: "transient" };
  // Any other 4xx is a hard, non-retryable failure.
  return { kind: "validation", message: errorMessage(body, `Unexpected error (${status}).`) };
}

/**
 * Build the engine's PushFn from a kind→call dispatch table. Unknown kinds fail
 * loudly as validation errors (a bug, not a transient) rather than silently retrying.
 */
export function createPusher(dispatch: Record<string, PushCall>): PushFn {
  return async (mutation) => {
    const call = dispatch[mutation.kind];
    if (!call) return { kind: "validation", message: `No push handler for '${mutation.kind}'.` };
    try {
      return normalizeOutcome(await call(mutation));
    } catch {
      // Thrown = network/transport failure → transient (retryable).
      return { kind: "transient" };
    }
  };
}
