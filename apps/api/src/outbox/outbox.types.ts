import type { ActorKind } from "@kaenal/types";

/**
 * Transactional-outbox shared types (Sequence 2).
 *
 * The outbox carries an event's IDENTITY, never business data (the same
 * pointer-not-payload discipline as the realtime bus): a consumer refetches
 * through the RLS-scoped API. `payload` is only the envelope below.
 */

/** The three lifecycle actions a consumer distinguishes (the DB CHECK matches). */
export type OutboxAction = "created" | "updated" | "deleted";

/** The minimal event envelope stored in `outbox.payload` — ids + timestamp only. */
export interface OutboxEnvelope {
  readonly entityId: string;
  readonly at: string;
}

/**
 * What the audit→outbox mapping produces and the writer persists — the columns
 * of a not-yet-inserted `outbox` row.
 */
export interface OutboxRecord {
  readonly tenantId: string;
  /** Public event name, e.g. `ncr.created` — the webhook/consumer contract. */
  readonly eventType: string;
  readonly entityKind: string;
  readonly entityId: string;
  readonly action: OutboxAction;
  /** Null for system/job actors. */
  readonly actorId: string | null;
  readonly actorKind: ActorKind;
  readonly payload: OutboxEnvelope;
}

/**
 * A persisted, claimed outbox row handed to a delivery handler by the drainer.
 * Adds the id + delivery bookkeeping the mapping doesn't know.
 */
export interface OutboxEvent extends OutboxRecord {
  readonly id: string;
  /** Delivery attempts already made (0 on the first try). */
  readonly attempts: number;
  readonly createdAt: Date;
}

/**
 * Delivery strategy — the seam between the durable outbox core (this slice) and
 * how an event actually reaches the outside world (webhook HTTP POST, an
 * internal consumer, …), which is the next slice. A handler either returns
 * (delivered — the drainer marks the row `delivered`) or throws (the drainer
 * records the error and reschedules with backoff, or dead-letters it once
 * attempts are exhausted). Handlers must be idempotent-friendly: at-least-once
 * delivery means the same event id can be delivered more than once.
 */
export interface OutboxHandler {
  deliver(event: OutboxEvent): Promise<void>;
}
