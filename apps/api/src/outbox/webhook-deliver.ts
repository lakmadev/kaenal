import type { Tx } from "@kaenal/db";
import type { SecretResolver } from "../tenant/secret-resolver.js";
import type { OutboxEvent } from "./outbox.types.js";
import type { WebhookTransport } from "./webhook-transport.js";
import { WEBHOOK_HEADERS, payloadDigest, signatureHeader } from "./webhook-signing.js";

/**
 * The single per-endpoint delivery unit — sign, POST, log, update endpoint
 * health — shared by the outbox fan-out handler AND the "send test event"
 * action, so a manual ping is byte-for-byte the same delivery a real event gets
 * (same signing, same headers, same `integration_events` ledger row). Isolating
 * it here is why the test button proves the actual delivery path, not a mock.
 *
 * Never throws: it returns the outcome so each caller decides what a failure
 * means (the fan-out aggregates and throws to trigger the drainer's retry; the
 * test action just reports it). Runs on the caller's tenant-scoped tx.
 */

export interface WebhookEndpoint {
  readonly id: string;
  readonly url: string;
  readonly credentialsRef: string | null;
}

export interface WebhookDeliveryDeps {
  readonly secrets: SecretResolver;
  readonly transport: WebhookTransport;
  /** Test seam for a deterministic signing timestamp. */
  readonly clock?: () => Date;
}

export interface DeliveryOutcome {
  readonly ok: boolean;
  /** HTTP status, or null when the request never completed (secret/transport error). */
  readonly status: number | null;
  readonly detail: string | null;
}

export async function deliverToEndpoint(
  tx: Tx,
  endpoint: WebhookEndpoint,
  event: OutboxEvent,
  deps: WebhookDeliveryDeps,
): Promise<DeliveryOutcome> {
  const clock = deps.clock ?? ((): Date => new Date());
  const body = JSON.stringify(buildEnvelope(event));
  const digest = payloadDigest(body);

  try {
    // Signed delivery is non-negotiable: an endpoint with no resolvable signing
    // secret is a misconfiguration, not an unsigned send.
    if (endpoint.credentialsRef === null || endpoint.credentialsRef === "") {
      throw new Error("no signing secret configured (credentials_ref unset)");
    }
    if (endpoint.url === "") {
      throw new Error("no destination URL configured (config.url unset)");
    }
    const secret = await deps.secrets.resolve(endpoint.credentialsRef);
    const timestamp = clock().toISOString();
    const res = await deps.transport.post(
      endpoint.url,
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
    const detail = ok ? null : `HTTP ${res.status}`;
    await logDelivery(tx, event, endpoint.id, ok ? "ok" : "failed", digest, detail);
    if (ok) await markOk(tx, endpoint.id);
    else await markError(tx, endpoint.id, detail as string);
    return { ok, status: res.status, detail };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await logDelivery(tx, event, endpoint.id, "failed", digest, detail);
    await markError(tx, endpoint.id, detail);
    return { ok: false, status: null, detail };
  }
}

/** The signed request body — identity envelope only, never business data. */
export function buildEnvelope(event: OutboxEvent): Record<string, unknown> {
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

/** One `integration_events` row per attempt — the delivery ledger. */
async function logDelivery(
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

async function markOk(tx: Tx, integrationId: string): Promise<void> {
  await tx.query(`UPDATE integrations SET last_ok_at = now(), last_error = NULL WHERE id = $1`, [integrationId]);
}

async function markError(tx: Tx, integrationId: string, detail: string): Promise<void> {
  await tx.query(`UPDATE integrations SET last_error = $2 WHERE id = $1`, [integrationId, detail.slice(0, 500)]);
}
