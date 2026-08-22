import type { Tx } from "@kaenal/db";
import type { OutboxRecord } from "./outbox.types.js";

/**
 * Persist one outbox row on the mutation's own transaction (Sequence 2).
 *
 * Called from the transactional audit observer, so it runs inside `withAudit`'s
 * tx — the row commits or rolls back atomically with the business change and its
 * audit event. The tx has already `SET LOCAL app.tenant_id`, so the insert is
 * subject to the outbox's RLS WITH CHECK exactly like any tenant write; the
 * record's `tenantId` is the same one the mutation is scoped to.
 *
 * Status/attempts/available_at take their table defaults (pending, 0, now) — a
 * fresh event is immediately eligible for the drainer.
 */
export async function writeOutbox(tx: Tx, record: OutboxRecord): Promise<void> {
  await tx.query(
    `INSERT INTO outbox
       (tenant_id, event_type, entity_kind, entity_id, action, actor_id, actor_kind, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      record.tenantId,
      record.eventType,
      record.entityKind,
      record.entityId,
      record.action,
      record.actorId,
      record.actorKind,
      JSON.stringify(record.payload),
    ],
  );
}
