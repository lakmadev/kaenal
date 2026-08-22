import { Logger } from "@nestjs/common";
import type { OutboxEvent, OutboxHandler } from "./outbox.types.js";

/**
 * Default delivery handler for the outbox drainer (Sequence 2, slice 1).
 *
 * The durable core of the outbox — write-in-tx, claim, deliver, mark, retry — is
 * complete and independent of WHERE an event goes; that destination (a
 * per-tenant webhook POST, an internal consumer) is the next slice. Until then
 * the drainer runs with this handler, which records the event to the log and
 * returns success, so the pipeline is exercised end to end (rows drain to
 * `delivered`) without a delivery target yet configured. Swapping in the real
 * webhook handler changes only this seam — nothing in the drainer or the write
 * path moves.
 */
export class LoggingOutboxHandler implements OutboxHandler {
  private readonly logger = new Logger("Outbox");

  deliver(event: OutboxEvent): Promise<void> {
    this.logger.log(
      `deliver ${event.eventType} tenant=${event.tenantId} entity=${event.entityKind}:${event.entityId} (attempt ${event.attempts + 1})`,
    );
    return Promise.resolve();
  }
}
