import type pg from "pg";
import { withTenant } from "@kaenal/db";
import type { ActorKind } from "@kaenal/types";
import type { OutboxAction, OutboxEnvelope, OutboxEvent, OutboxHandler } from "../../outbox/outbox.types.js";

/**
 * The outbox drainer (Sequence 2). For one tenant, claim a batch of pending,
 * due events and deliver them, marking each `delivered` or rescheduling it with
 * backoff — dead-lettering (`failed`) once attempts are exhausted. This is the
 * consumer half of the transactional outbox: the write half persists events in
 * the mutation's tx (never lost, never for a rolled-back change); this half
 * delivers them at-least-once, so a delivery outage delays events but never
 * drops them.
 *
 * Runs inside `withTenant`, so every read/write is RLS-scoped — a drain for
 * tenant A can neither see nor touch tenant B's outbox, exactly like an HTTP
 * request. `FOR UPDATE SKIP LOCKED` lets multiple worker replicas drain the
 * same tenant concurrently without ever handing the same row to two of them.
 *
 * Delivery runs inside the claim transaction (the row stays locked until the
 * status update commits), which is right while delivery is in-process/instant;
 * when a real out-of-process webhook handler lands (next slice), a claim →
 * `processing` → deliver-outside-tx → finalize split avoids holding row locks
 * across a slow HTTP call. A handler that throws is caught PER ROW and never
 * propagates, so one bad event can't roll back its already-delivered batch mates.
 */

/** Give up after this many attempts and dead-letter the row (status `failed`). */
export const OUTBOX_MAX_ATTEMPTS = 8;

/** Rows claimed per drain pass — bounds how long one tenant holds a connection. */
const DEFAULT_BATCH_SIZE = 100;

/** last_error is diagnostic, not a payload — cap it so a huge stack can't bloat the row. */
const MAX_ERROR_LEN = 500;

interface OutboxRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly event_type: string;
  readonly entity_kind: string;
  readonly entity_id: string;
  readonly action: OutboxAction;
  readonly actor_id: string | null;
  readonly actor_kind: ActorKind;
  readonly payload: OutboxEnvelope;
  readonly attempts: number;
  readonly created_at: Date;
}

export interface OutboxDrainDeps {
  readonly handler: OutboxHandler;
  /** Model B routing: the tenant's dedicated pool, or undefined for the shared app pool. */
  readonly pool?: pg.Pool | undefined;
  readonly batchSize?: number;
}

export interface OutboxDrainResult {
  /** Rows claimed this pass (≤ batchSize). */
  readonly claimed: number;
  /** Delivered and marked `delivered`. */
  readonly delivered: number;
  /** Delivery failed but attempts remain — rescheduled with backoff. */
  readonly rescheduled: number;
  /** Delivery failed and attempts exhausted — dead-lettered (`failed`). */
  readonly deadLettered: number;
}

/**
 * Exponential backoff in seconds for the next retry, by the new attempt count.
 * 2^n capped at one hour, so a persistently failing endpoint is retried ever
 * less aggressively rather than hot-looping.
 */
export function outboxBackoffSeconds(attempts: number): number {
  return Math.min(2 ** attempts, 3600);
}

export async function drainOutboxForTenant(
  tenantId: string,
  deps: OutboxDrainDeps,
): Promise<OutboxDrainResult> {
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;

  return withTenant(
    tenantId,
    null,
    async (tx) => {
      const { rows } = await tx.query<OutboxRow>(
        `SELECT id, tenant_id, event_type, entity_kind, entity_id, action,
                actor_id, actor_kind, payload, attempts, created_at
           FROM outbox
          WHERE status = 'pending' AND available_at <= now()
          ORDER BY created_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [batchSize],
      );

      let delivered = 0;
      let rescheduled = 0;
      let deadLettered = 0;

      for (const row of rows) {
        const event: OutboxEvent = {
          id: row.id,
          tenantId: row.tenant_id,
          eventType: row.event_type,
          entityKind: row.entity_kind,
          entityId: row.entity_id,
          action: row.action,
          actorId: row.actor_id,
          actorKind: row.actor_kind,
          payload: row.payload,
          attempts: row.attempts,
          createdAt: row.created_at,
        };

        try {
          await deps.handler.deliver(event);
          await tx.query(
            `UPDATE outbox
                SET status = 'delivered', published_at = now(), last_error = NULL
              WHERE id = $1`,
            [row.id],
          );
          delivered += 1;
        } catch (err) {
          // Per-row guard: a delivery failure marks just this row for retry (or
          // dead-letters it) and never escapes to roll back the batch.
          const nextAttempts = row.attempts + 1;
          const message = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LEN);
          if (nextAttempts >= OUTBOX_MAX_ATTEMPTS) {
            await tx.query(
              `UPDATE outbox SET status = 'failed', attempts = $2, last_error = $3 WHERE id = $1`,
              [row.id, nextAttempts, message],
            );
            deadLettered += 1;
          } else {
            await tx.query(
              `UPDATE outbox
                  SET attempts = $2,
                      last_error = $3,
                      available_at = now() + make_interval(secs => $4)
                WHERE id = $1`,
              [row.id, nextAttempts, message, outboxBackoffSeconds(nextAttempts)],
            );
            rescheduled += 1;
          }
        }
      }

      return { claimed: rows.length, delivered, rescheduled, deadLettered };
    },
    deps.pool,
  );
}
