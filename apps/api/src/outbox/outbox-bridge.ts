import { setTxAuditObserver } from "@kaenal/db";
import { outboxEventFor } from "./outbox-event.js";
import { writeOutbox } from "./outbox.writer.js";

/**
 * Wire the audit choke point to the transactional outbox (Sequence 2).
 *
 * Registers the TRANSACTIONAL observer (`setTxAuditObserver`, not the best-effort
 * `setAuditObserver` the realtime bridge uses): it receives the mutation's tx and
 * is awaited unguarded, so the outbox row is written in the same transaction as
 * the change and its audit event — committed together or not at all. Kinds the
 * mapping doesn't cover produce no row, so this is a no-op for internal churn.
 *
 * Called once at bootstrap; idempotent (replaces any prior tx observer).
 */
export function installOutboxBridge(): void {
  setTxAuditObserver(async (tx, event, tenantId) => {
    const record = outboxEventFor(event, tenantId);
    if (record !== null) await writeOutbox(tx, record);
  });
}

/** Remove the bridge (test teardown / shutdown hygiene). */
export function uninstallOutboxBridge(): void {
  setTxAuditObserver(undefined);
}
