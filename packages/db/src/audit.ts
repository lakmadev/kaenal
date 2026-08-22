import type { ActorKind, AuditAction } from "@kaenal/types";
import type { Tx } from "./client.js";

/**
 * Audit trail writing (02 §3, 07 §1).
 *
 * Non-negotiable rule 3: every mutation writes an audit event in the SAME
 * transaction. `withAudit` is the only sanctioned way to mutate tenant data —
 * it wraps the mutation so that the event and the change commit or roll back
 * together. There is deliberately no exported "just write an event" function
 * that services could call out of band, because an audit trail that can drift
 * from the data is worse than none: it looks authoritative and isn't.
 */

export interface AuditEventInput {
  /** Null for system/job actors. */
  readonly actorId: string | null;
  readonly actorKind: ActorKind;
  readonly entityKind: string;
  readonly entityId: string;
  readonly action: AuditAction;
  /** Changed fields only — never whole rows (02 §3). */
  readonly before?: Readonly<Record<string, unknown>> | null;
  readonly after?: Readonly<Record<string, unknown>> | null;
  /** Required for support-role actions and overrides; a DB CHECK enforces it. */
  readonly reason?: string | null;
  readonly requestId?: string | null;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
}

/**
 * Field names whose values must never reach the audit trail. The trail is
 * widely readable — every tenant admin sees it in the History tab — so a
 * credential captured in a diff is a credential disclosed.
 */
const REDACTED_KEY_PATTERN =
  /password|secret|token|hash|mfa|api_key|apikey|authorization|credential/i;

export const REDACTED = "[redacted]";

/**
 * Optional side-observer notified of each audit event AFTER it is written (still
 * inside the mutation's transaction). The DB layer stays deliberately ignorant
 * of what an observer does — the API registers one to buffer realtime
 * cache-invalidation signals (Phase R2), so that *every* audited mutation, by
 * construction, produces a signal without each service having to remember to
 * emit. An observer should read only the event's non-sensitive identity
 * (entityKind / entityId / action), never before/after payloads. It is
 * best-effort and guarded below — observation must never break a mutation or the
 * audit write it rode in on.
 */
export type AuditObserver = (event: AuditEventInput, tenantId: string) => void;

let auditObserver: AuditObserver | undefined;

export function setAuditObserver(fn: AuditObserver | undefined): void {
  auditObserver = fn;
}

/**
 * Transactional side-observer — a SECOND, deliberately different hook from the
 * best-effort `AuditObserver` above. It receives the mutation's own `tx` and is
 * `await`ed **without a guard**, so its work commits or rolls back atomically
 * with the mutation and its audit event. The API registers one to write a
 * transactional-outbox row (Sequence 2): the event that must reach the outside
 * world is persisted in the same transaction as the change that produced it, so
 * it can never be lost after a commit nor sent for a change that rolled back.
 *
 * The asymmetry is intentional. The plain `AuditObserver` buffers a realtime
 * cache-invalidation hint — losing one is harmless, so it is swallowed and must
 * never break a mutation. A missed outbox write is NOT harmless (a dropped
 * webhook/consumer event is exactly what the outbox exists to prevent), so its
 * failure is allowed to fail the transaction. Like the plain observer it should
 * read only the event's non-sensitive identity, never before/after payloads.
 */
export type TxAuditObserver = (
  tx: Tx,
  event: AuditEventInput,
  tenantId: string,
) => Promise<void>;

let txAuditObserver: TxAuditObserver | undefined;

export function setTxAuditObserver(fn: TxAuditObserver | undefined): void {
  txAuditObserver = fn;
}

/** Replaces sensitive values while preserving the shape of the diff. */
export function redact(input: Readonly<Record<string, unknown>>): Record<string, unknown>;
export function redact(
  input: Readonly<Record<string, unknown>> | null | undefined,
): Record<string, unknown> | null;
export function redact(
  input: Readonly<Record<string, unknown>> | null | undefined,
): Record<string, unknown> | null {
  if (input == null) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = REDACTED_KEY_PATTERN.test(key) ? REDACTED : value;
  }
  return out;
}

/**
 * Reduces a before/after pair to just the fields that actually changed.
 *
 * Storing whole rows would bloat the trail and bury the one field a reviewer
 * cares about under thirty unchanged ones.
 */
export function diffFields(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[key];
    const a = after[key];
    if (!valuesEqual(b, a)) {
      changedBefore[key] = b;
      changedAfter[key] = a;
    }
  }

  return { before: changedBefore, after: changedAfter };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  // Dates arrive from pg as Date and from request bodies as ISO strings.
  if (a instanceof Date && typeof b === "string") return a.toISOString() === b;
  if (b instanceof Date && typeof a === "string") return b.toISOString() === a;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a === "object" && typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Runs a mutation and records its audit events atomically.
 *
 * Ordering matters: the mutation runs first so the events can reference rows
 * it created (an insert's generated id), and both are inside the caller's
 * transaction, so a failure in either rolls back the other. A service that
 * mutates without going through here is a bug — rule 3 exists because
 * regulated customers are audited on the completeness of this trail, not on
 * whether the feature worked.
 */
export async function withAudit<T>(
  tx: Tx,
  tenantId: string,
  audit: AuditEventInput | readonly AuditEventInput[],
  mutation: (tx: Tx) => Promise<T>,
): Promise<T> {
  const result = await mutation(tx);

  const events = toEventList(audit);
  if (events.length === 0) {
    throw new Error(
      "withAudit was called with no events — every mutation must record at least one (rule 3)",
    );
  }

  for (const event of events) {
    if (event.actorKind === "support" && (event.reason == null || event.reason.trim() === "")) {
      // Also a DB CHECK; caught here so the caller gets a clear message rather
      // than a constraint violation (07 §7 — support access is always reasoned).
      throw new Error("Support-actor audit events require a reason");
    }

    await tx.query(
      `INSERT INTO audit_events
         (tenant_id, actor_id, actor_kind, entity_kind, entity_id, action,
          before, after, reason, request_id, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        tenantId,
        event.actorId,
        event.actorKind,
        event.entityKind,
        event.entityId,
        event.action,
        jsonOrNull(redact(event.before)),
        jsonOrNull(redact(event.after)),
        event.reason ?? null,
        event.requestId ?? null,
        event.ip ?? null,
        event.userAgent ?? null,
      ],
    );

    // Transactional side-observation (Sequence 2 outbox bridge). Runs on the
    // mutation's own tx and is NOT guarded: a failed outbox write must roll the
    // mutation back, because the whole point of the outbox is that its event
    // can never diverge from the change that produced it. Runs before the
    // best-effort observer so a genuine persistence failure surfaces first.
    if (txAuditObserver !== undefined) {
      await txAuditObserver(tx, event, tenantId);
    }

    // Best-effort side-observation (Phase R2 realtime bridge). Guarded so a
    // buggy observer can never break the mutation or its audit write.
    if (auditObserver !== undefined) {
      try {
        auditObserver(event, tenantId);
      } catch {
        /* observation is not allowed to affect the transaction */
      }
    }
  }

  return result;
}

/**
 * Normalises the one-or-many argument.
 *
 * `Array.isArray` cannot narrow a `T | readonly T[]` union — its signature
 * asserts `any[]`, which silently widened every field access at the INSERT
 * site below to `any`. A hand-written predicate keeps the event fields typed,
 * so a renamed or misspelled field fails to compile rather than writing a
 * malformed event into an append-only table.
 */
function toEventList(
  audit: AuditEventInput | readonly AuditEventInput[],
): readonly AuditEventInput[] {
  return Array.isArray(audit) ? (audit as readonly AuditEventInput[]) : [audit as AuditEventInput];
}

function jsonOrNull(value: Record<string, unknown> | null): string | null {
  return value === null ? null : JSON.stringify(value);
}
