import "reflect-metadata";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant, type Tx } from "@kaenal/db";
import type { SecretResolver } from "../src/tenant/secret-resolver.js";
import { WebhookOutboxHandler } from "../src/outbox/webhook.handler.js";
import type { WebhookResponse, WebhookTransport } from "../src/outbox/webhook-transport.js";
import { payloadDigest, signWebhook, signatureHeader, webhookSubscribes } from "../src/outbox/webhook-signing.js";
import type { OutboxEvent } from "../src/outbox/outbox.types.js";

/**
 * Webhook delivery (Sequence 2, delivery slice). Pins the signed fan-out of an
 * outbox event to the tenant's subscribed `generic_webhook` endpoints (the 0032
 * integrations substrate): correct HMAC signing, subscription filtering, the
 * per-delivery `integration_events` ledger, retry-on-failure surfaced to the
 * drainer, and — the load-bearing guarantee — a tenant's events reach ONLY that
 * tenant's endpoints (RLS).
 */

// ─── Pure signing + subscription (no DB) ────────────────────────────────────

describe("signWebhook", () => {
  it("is deterministic and keyed by the secret + timestamp + body", () => {
    const a = signWebhook("s3cret", "2026-08-22T00:00:00.000Z", `{"x":1}`);
    expect(a).toBe(signWebhook("s3cret", "2026-08-22T00:00:00.000Z", `{"x":1}`));
    expect(a).not.toBe(signWebhook("other", "2026-08-22T00:00:00.000Z", `{"x":1}`));
    expect(a).not.toBe(signWebhook("s3cret", "2026-08-22T00:00:01.000Z", `{"x":1}`));
    expect(a).not.toBe(signWebhook("s3cret", "2026-08-22T00:00:00.000Z", `{"x":2}`));
    expect(a).toMatch(/^[0-9a-f]{64}$/); // hex sha256
  });
  it("signs over timestamp.body so a body cannot be replayed under a new time", () => {
    // The receiver recomputes over `${ts}.${body}`; a mismatched ts fails.
    const ts = "2026-08-22T00:00:00.000Z";
    const body = `{"id":"e1"}`;
    const expected = createHmac("sha256", "k").update(`${ts}.${body}`).digest("hex");
    expect(signWebhook("k", ts, body)).toBe(expected);
    expect(signatureHeader("k", ts, body)).toBe(`sha256=${expected}`);
  });
  it("payloadDigest is the sha256 of the body", () => {
    expect(payloadDigest("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(payloadDigest("abc")).toBe(payloadDigest("abc"));
    expect(payloadDigest("abc")).not.toBe(payloadDigest("abd"));
  });
});

describe("webhookSubscribes", () => {
  it("empty / * subscribes to everything", () => {
    expect(webhookSubscribes(undefined, "ncr.created")).toBe(true);
    expect(webhookSubscribes("", "ncr.created")).toBe(true);
    expect(webhookSubscribes("*", "anything.updated")).toBe(true);
  });
  it("matches exact names and domain wildcards", () => {
    expect(webhookSubscribes("ncr.created,capa.updated", "capa.updated")).toBe(true);
    expect(webhookSubscribes("ncr.*", "ncr.deleted")).toBe(true);
    expect(webhookSubscribes(" ncr.* , capa.created ", "ncr.updated")).toBe(true);
  });
  it("rejects unsubscribed events", () => {
    expect(webhookSubscribes("ncr.created", "ncr.updated")).toBe(false);
    expect(webhookSubscribes("capa.*", "ncr.created")).toBe(false);
  });
});

// ─── Real-DB delivery through the integrations substrate ─────────────────────

const ACME = "acme";
const GLOBEX = "globex";
const FIXED_TS = "2026-08-22T00:00:00.000Z";

let control: pg.Pool;
let acmeId = "";
let globexId = "";

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

/** Fake secret manager: a stable secret per ref, so signatures are checkable. */
const fakeSecrets: SecretResolver = { resolve: (ref) => Promise.resolve(`secret-for:${ref}`) };

class FakeTransport implements WebhookTransport {
  readonly calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  status = 200;
  post(url: string, headers: Record<string, string>, body: string): Promise<WebhookResponse> {
    this.calls.push({ url, headers, body });
    return Promise.resolve({ status: this.status });
  }
}

function handlerWith(transport: WebhookTransport): WebhookOutboxHandler {
  return new WebhookOutboxHandler(fakeSecrets, transport, () => new Date(FIXED_TS));
}

async function seedEndpoint(
  tenantId: string,
  opts: {
    url: string;
    events?: string;
    status?: "connected" | "disconnected";
    provider?: string;
    credentialsRef?: string | null;
    deleted?: boolean;
  },
): Promise<string> {
  return withTenant(tenantId, null, async (tx) => {
    const config: Record<string, string> = { url: opts.url };
    if (opts.events !== undefined) config["events"] = opts.events;
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO integrations
         (tenant_id, provider, name, status, config, credentials_ref, connected_at, deleted_at)
       VALUES ($1, $2, 'Endpoint', $3, $4::jsonb, $5, now(), $6)
       RETURNING id`,
      [
        tenantId,
        opts.provider ?? "generic_webhook",
        opts.status ?? "connected",
        JSON.stringify(config),
        opts.credentialsRef === undefined ? "env:HOOK_SECRET" : opts.credentialsRef,
        opts.deleted === true ? new Date() : null,
      ],
    );
    return rows[0]?.id ?? "";
  });
}

interface DeliveryRow {
  direction: string;
  kind: string;
  status: string;
  attempts: number;
  detail: string | null;
  payload_digest: string | null;
}

async function deliveries(tenantId: string, integrationId: string): Promise<DeliveryRow[]> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<DeliveryRow>(
      `SELECT direction, kind, status, attempts, detail, payload_digest
         FROM integration_events WHERE integration_id = $1 ORDER BY created_at`,
      [integrationId],
    );
    return rows;
  });
}

function eventFor(tenantId: string, eventType: string, attempts = 0): OutboxEvent {
  const entityId = randomUUID();
  return {
    id: randomUUID(),
    tenantId,
    eventType,
    entityKind: eventType.split(".")[0] ?? "ncr",
    entityId,
    action: "created",
    actorId: null,
    actorKind: "system",
    payload: { entityId, at: FIXED_TS },
    attempts,
    createdAt: new Date(FIXED_TS),
  };
}

/**
 * Run the handler exactly as the drainer does: its throw is caught PER ROW so the
 * tx still COMMITS (the failed-delivery log the handler wrote must persist — the
 * drainer only reschedules the outbox row, it never rolls the delivery log back),
 * then the error is re-surfaced so `rejects.toThrow` can assert on it.
 */
async function deliver(handler: WebhookOutboxHandler, event: OutboxEvent): Promise<void> {
  let thrown: Error | undefined;
  await withTenant(event.tenantId, null, async (tx: Tx) => {
    try {
      await handler.deliver(tx, event);
    } catch (err) {
      thrown = err instanceof Error ? err : new Error("non-error thrown");
    }
  });
  if (thrown !== undefined) throw thrown;
}

describe("WebhookOutboxHandler — signed fan-out through integrations", () => {
  beforeAll(async () => {
    control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
    acmeId = await tid(ACME);
    globexId = await tid(GLOBEX);
  });

  afterAll(async () => {
    await control.query("DELETE FROM integrations WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
    await control.end();
  });

  afterEach(async () => {
    // Cascades to integration_events (FK ON DELETE CASCADE).
    await control.query("DELETE FROM integrations WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  });

  it("POSTs a correctly-signed envelope and logs an 'ok' delivery", async () => {
    const id = await seedEndpoint(acmeId, { url: "https://acme.example/hook", events: "*" });
    const transport = new FakeTransport();
    const event = eventFor(acmeId, "ncr.created");

    await deliver(handlerWith(transport), event);

    expect(transport.calls).toHaveLength(1);
    const call = transport.calls[0]!;
    expect(call.url).toBe("https://acme.example/hook");
    expect(call.headers["x-kaenal-event"]).toBe("ncr.created");
    expect(call.headers["x-kaenal-event-id"]).toBe(event.id);
    expect(call.headers["x-kaenal-timestamp"]).toBe(FIXED_TS);
    // Signature verifies against the resolved secret + the exact body sent.
    const expected = `sha256=${signWebhook("secret-for:env:HOOK_SECRET", FIXED_TS, call.body)}`;
    expect(call.headers["x-kaenal-signature"]).toBe(expected);
    // Envelope carries identity only, never row data.
    const env = JSON.parse(call.body) as Record<string, unknown>;
    expect(env).toMatchObject({ id: event.id, type: "ncr.created", action: "created" });

    const log = await deliveries(acmeId, id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ direction: "out", kind: "ncr.created", status: "ok", attempts: 1 });
    expect(log[0]?.payload_digest).toBe(payloadDigest(call.body));
  });

  it("only delivers to endpoints subscribed to the event type", async () => {
    await seedEndpoint(acmeId, { url: "https://acme.example/capa-only", events: "capa.*" });
    const transport = new FakeTransport();
    await deliver(handlerWith(transport), eventFor(acmeId, "ncr.created"));
    expect(transport.calls).toHaveLength(0); // not subscribed → no-op, no throw
  });

  it("fans out to multiple subscribed endpoints", async () => {
    await seedEndpoint(acmeId, { url: "https://a.example/hook", events: "ncr.*" });
    await seedEndpoint(acmeId, { url: "https://b.example/hook", events: "*" });
    await seedEndpoint(acmeId, { url: "https://c.example/hook", events: "capa.created" }); // filtered out
    const transport = new FakeTransport();
    await deliver(handlerWith(transport), eventFor(acmeId, "ncr.created"));
    expect(transport.calls.map((c) => c.url).sort()).toEqual(["https://a.example/hook", "https://b.example/hook"]);
  });

  it("skips disconnected, soft-deleted, and non-webhook integrations", async () => {
    await seedEndpoint(acmeId, { url: "https://off.example", events: "*", status: "disconnected" });
    await seedEndpoint(acmeId, { url: "https://gone.example", events: "*", deleted: true });
    await seedEndpoint(acmeId, { url: "https://slack.example", events: "*", provider: "slack" });
    const transport = new FakeTransport();
    await deliver(handlerWith(transport), eventFor(acmeId, "ncr.created"));
    expect(transport.calls).toHaveLength(0);
  });

  it("throws on a non-2xx response (→ drainer retries) and logs 'failed'", async () => {
    const id = await seedEndpoint(acmeId, { url: "https://acme.example/hook", events: "*" });
    const transport = new FakeTransport();
    transport.status = 500;

    await expect(deliver(handlerWith(transport), eventFor(acmeId, "ncr.created"))).rejects.toThrow(/HTTP 500/);

    const log = await deliveries(acmeId, id);
    expect(log[0]).toMatchObject({ status: "failed", detail: "HTTP 500" });
    // The endpoint's health reflects the failure.
    const err = await withTenant(acmeId, null, async (tx) => {
      const { rows } = await tx.query<{ last_error: string | null }>(
        `SELECT last_error FROM integrations WHERE id = $1`,
        [id],
      );
      return rows[0]?.last_error;
    });
    expect(err).toBe("HTTP 500");
  });

  it("fails an endpoint with no signing secret (never sends unsigned)", async () => {
    const id = await seedEndpoint(acmeId, { url: "https://acme.example/hook", events: "*", credentialsRef: null });
    const transport = new FakeTransport();
    await expect(deliver(handlerWith(transport), eventFor(acmeId, "ncr.created"))).rejects.toThrow(/signing secret/);
    expect(transport.calls).toHaveLength(0); // nothing sent
    expect((await deliveries(acmeId, id))[0]).toMatchObject({ status: "failed" });
  });

  it("never delivers a tenant's event to another tenant's endpoints (RLS)", async () => {
    await seedEndpoint(globexId, { url: "https://globex.example/hook", events: "*" });
    const transport = new FakeTransport();
    // Deliver an ACME event: the handler runs in acme's tx and cannot see globex's endpoint.
    await deliver(handlerWith(transport), eventFor(acmeId, "ncr.created"));
    expect(transport.calls).toHaveLength(0);
  });
});
