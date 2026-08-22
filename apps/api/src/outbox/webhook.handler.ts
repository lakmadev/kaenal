import { Logger } from "@nestjs/common";
import type { Tx } from "@kaenal/db";
import type { SecretResolver } from "../tenant/secret-resolver.js";
import type { OutboxEvent, OutboxHandler } from "./outbox.types.js";
import type { WebhookTransport } from "./webhook-transport.js";
import { WEBHOOK_HEADERS, payloadDigest, signatureHeader, webhookSubscribes } from "./webhook-signing.js";

/**
 * The real outbox delivery handler (Sequence 2, delivery slice): fan an outbox
 * event out to the tenant's subscribed webhook endpoints, HMAC-signed, and log
 * every attempt.
 *
 * Reuses the ONE connector substrate (0032) rather than a bespoke table: an
 * endpoint is a `generic_webhook` row in `integrations` — non-secret `config`
 * (`url` + `events`), the signing secret behind `credentials_ref` (a pointer
 * into the secret manager, never in the DB), and `integration_events` as the
 * per-delivery log the settings UI already renders.
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

    const body = JSON.stringify(buildEnvelope(event));
    const digest = payloadDigest(body);
    const failures: string[] = [];

    for (const target of targets) {
      const url = target.config["url"] as string;
      try {
        // Signed delivery is non-negotiable: an endpoint with no resolvable
        // signing secret is a misconfiguration, not an unsigned send.
        if (target.credentials_ref === null || target.credentials_ref === "") {
          throw new Error("no signing secret configured (credentials_ref unset)");
        }
        const secret = await this.secrets.resolve(target.credentials_ref);
        const timestamp = this.clock().toISOString();
        const res = await this.transport.post(
          url,
          {
            "content-type": "application/json",
            [WEBHOOK_HEADERS.event]: event.eventType,
            [WEBHOOK_HEADERS.eventId]: event.id,
            [WEBHOOK_HEADERS.timestamp]: timestamp,
            [WEBHOOK_HEADERS.signature]: signatureHeader(secret, timestamp, body),
          },
          body,
        );
        const ok = res.status >= 200 && res.status < 300;
        await this.log(tx, event, target.id, ok ? "ok" : "failed", digest, ok ? null : `HTTP ${res.status}`);
        if (ok) {
          await this.markOk(tx, target.id);
        } else {
          await this.markError(tx, target.id, `HTTP ${res.status}`);
          failures.push(`${target.id}: HTTP ${res.status}`);
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        await this.log(tx, event, target.id, "failed", digest, detail);
        await this.markError(tx, target.id, detail);
        failures.push(`${target.id}: ${detail}`);
      }
    }

    if (failures.length > 0) {
      // Surface to the drainer → reschedule with backoff. Endpoint ids only,
      // never the payload or the secret.
      throw new Error(`webhook delivery failed for ${failures.length} endpoint(s): ${failures.join("; ")}`);
    }
    this.logger.log(`delivered ${event.eventType} (${event.id}) to ${targets.length} endpoint(s)`);
  }

  /** One `integration_events` row per attempt — the delivery ledger. */
  private async log(
    tx: Tx,
    event: OutboxEvent,
    integrationId: string,
    status: "ok" | "failed",
    digest: string,
    detail: string | null,
  ): Promise<void> {
    await tx.query(
      `INSERT INTO integration_events
         (tenant_id, integration_id, direction, kind, payload_digest, status, attempts, detail)
       VALUES ($1, $2, 'out', $3, $4, $5, $6, $7)`,
      [event.tenantId, integrationId, event.eventType, digest, status, event.attempts + 1, detail],
    );
  }

  private async markOk(tx: Tx, integrationId: string): Promise<void> {
    await tx.query(`UPDATE integrations SET last_ok_at = now(), last_error = NULL WHERE id = $1`, [integrationId]);
  }

  private async markError(tx: Tx, integrationId: string, detail: string): Promise<void> {
    await tx.query(`UPDATE integrations SET last_error = $2 WHERE id = $1`, [integrationId, detail.slice(0, 500)]);
  }
}

/** The signed request body — identity envelope only, never business data. */
function buildEnvelope(event: OutboxEvent): Record<string, unknown> {
  return {
    id: event.id,
    type: event.eventType,
    tenantId: event.tenantId,
    entity: { kind: event.entityKind, id: event.entityId },
    action: event.action,
    actor: { id: event.actorId, kind: event.actorKind },
    occurredAt: event.payload.at,
  };
}
