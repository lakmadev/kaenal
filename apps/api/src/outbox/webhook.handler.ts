import { Logger } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import type { SecretResolver } from "../tenant/secret-resolver.js";
import type { OutboxEvent, OutboxHandler } from "./outbox.types.js";
import type { WebhookTransport } from "./webhook-transport.js";
import { webhookSubscribes } from "./webhook-signing.js";
import { deliverToEndpoint } from "./webhook-deliver.js";

/**
 * The real outbox delivery handler (Sequence 2, delivery slice): fan an outbox
 * event out to the tenant's subscribed webhook endpoints, HMAC-signed, and log
 * every attempt.
 *
 * Reuses the ONE connector substrate (0032) rather than a bespoke table: an
 * endpoint is a `generic_webhook` row in `integrations` — non-secret `config`
 * (`url` + `events`), the signing secret behind `credentials_ref` (a pointer
 * into the secret manager, never in the DB), and `integration_events` as the
 * per-delivery log the settings UI already renders. The per-endpoint send lives
 * in {@link deliverToEndpoint}, shared with the "send test event" action so a
 * manual ping exercises the identical path.
 *
 * Runs inside the drainer's tenant-scoped tx, so the endpoint lookup and the
 * delivery log are RLS-scoped to the event's tenant automatically — a tenant's
 * events can only ever reach that tenant's endpoints. Delivery is at-least-once:
 * if ANY subscribed endpoint fails, the handler throws so the drainer reschedules
 * the whole event; endpoints that already succeeded are re-POSTed on the retry,
 * so receivers must dedupe on `x-kaenal-event-id` (a per-endpoint delivery ledger
 * that skips already-delivered endpoints is the next refinement).
 */

interface WebhookIntegrationRow {
  readonly id: string;
  readonly config: Record<string, string>;
  readonly credentials_ref: string | null;
}

export class WebhookOutboxHandler implements OutboxHandler {
  private readonly logger = new Logger("WebhookDelivery");

  constructor(
    private readonly secrets: SecretResolver,
    private readonly transport: WebhookTransport,
    /** Test seam for a deterministic signing timestamp. */
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async deliver(tx: Tx, event: OutboxEvent): Promise<void> {
    const { rows } = await tx.query<WebhookIntegrationRow>(
      `SELECT id, config, credentials_ref
         FROM integrations
        WHERE provider = 'generic_webhook' AND status = 'connected' AND deleted_at IS NULL`,
    );

    // Only endpoints that subscribe to this event type AND declare a URL.
    const targets = rows.filter(
      (r) => typeof r.config["url"] === "string" && webhookSubscribes(r.config["events"], event.eventType),
    );
    if (targets.length === 0) return; // nothing subscribed → a delivered no-op

    const failures: string[] = [];
    for (const target of targets) {
      const outcome = await deliverToEndpoint(
        tx,
        { id: target.id, url: target.config["url"] as string, credentialsRef: target.credentials_ref },
        event,
        { secrets: this.secrets, transport: this.transport, clock: this.clock },
      );
      if (!outcome.ok) failures.push(`${target.id}: ${outcome.detail ?? "failed"}`);
    }

    if (failures.length > 0) {
      // Surface to the drainer → reschedule with backoff. Endpoint ids only,
      // never the payload or the secret.
      throw new Error(`webhook delivery failed for ${failures.length} endpoint(s): ${failures.join("; ")}`);
    }
    this.logger.log(`delivered ${event.eventType} (${event.id}) to ${targets.length} endpoint(s)`);
  }
}
