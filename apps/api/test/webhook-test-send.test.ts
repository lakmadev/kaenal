import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant, type Tx } from "@kaenal/db";
import { IntegrationsService } from "../src/integrations/integrations.service.js";
import type { SecretResolver } from "../src/tenant/secret-resolver.js";
import type { WebhookResponse, WebhookTransport } from "../src/outbox/webhook-transport.js";
import { signWebhook } from "../src/outbox/webhook-signing.js";
import type { AuditContext } from "../src/ncr/audit-context.js";

/**
 * "Send test event" (Sequence 2). An admin pings a webhook endpoint and gets the
 * real delivery outcome — the same signed path a live event takes. Pins: a
 * connected endpoint delivers + logs an `integration_events` row; a 5xx / missing
 * secret reports failure without faking success; a non-webhook endpoint is
 * rejected; a foreign/unknown id 404s (RLS).
 */

const ACME = "acme";
const GLOBEX = "globex";
const FIXED = new Date("2026-08-22T00:00:00.000Z");
const CTX: AuditContext = { requestId: null, ip: null, userAgent: null };

let control: pg.Pool;
let acmeId = "";
let globexId = "";
let actorId = "";

const fakeSecrets: SecretResolver = { resolve: (ref) => Promise.resolve(`secret-for:${ref}`) };

class FakeTransport implements WebhookTransport {
  readonly calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  status = 200;
  post(url: string, headers: Record<string, string>, body: string): Promise<WebhookResponse> {
    this.calls.push({ url, headers, body });
    return Promise.resolve({ status: this.status });
  }
}

function svcWith(transport: WebhookTransport): IntegrationsService {
  return new IntegrationsService(fakeSecrets, transport, () => FIXED);
}

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedIntegration(
  tenantId: string,
  opts: { provider?: string; url?: string; status?: string; credentialsRef?: string | null },
): Promise<string> {
  return withTenant(tenantId, null, async (tx) => {
    const config = opts.url === undefined ? {} : { url: opts.url };
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO integrations (tenant_id, provider, name, status, config, credentials_ref, connected_at)
       VALUES ($1, $2, 'Endpoint', $3, $4::jsonb, $5, now()) RETURNING id`,
      [
        tenantId,
        opts.provider ?? "generic_webhook",
        opts.status ?? "connected",
        JSON.stringify(config),
        opts.credentialsRef === undefined ? "env:HOOK" : opts.credentialsRef,
      ],
    );
    return rows[0]?.id ?? "";
  });
}

interface EventRow {
  direction: string;
  kind: string;
  status: string;
  detail: string | null;
}
async function events(tenantId: string, integrationId: string): Promise<EventRow[]> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<EventRow>(
      `SELECT direction, kind, status, detail FROM integration_events WHERE integration_id = $1`,
      [integrationId],
    );
    return rows;
  });
}

/** Invoke sendTest inside a committed tenant tx, mirroring the request lifecycle. */
async function sendTest(svc: IntegrationsService, tenantId: string, id: string): ReturnType<IntegrationsService["sendTest"]> {
  return withTenant(tenantId, actorId, (tx: Tx) => svc.sendTest(tx, tenantId, actorId, id, CTX));
}

describe("IntegrationsService.sendTest — webhook ping", () => {
  beforeAll(async () => {
    control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
    acmeId = await tid(ACME);
    globexId = await tid(GLOBEX);
    // A member to attribute the audited action to.
    const u = await control.query<{ id: string }>(
      `INSERT INTO control.users (email, name) VALUES ($1, 'Hook Tester') ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [`hook-tester-${randomUUID()}@acme.test`],
    );
    actorId = u.rows[0]?.id ?? "";
    await withTenant(acmeId, null, (tx) =>
      tx.query(`INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'admin','active')
                ON CONFLICT (tenant_id, user_id) DO NOTHING`, [acmeId, actorId]),
    );
  });

  afterAll(async () => {
    await control.query("DELETE FROM integrations WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
    await control.query("DELETE FROM memberships WHERE user_id = $1", [actorId]);
    await control.query("DELETE FROM control.users WHERE id = $1", [actorId]);
    await control.end();
  });

  afterEach(async () => {
    await control.query("DELETE FROM integrations WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  });

  it("delivers a signed ping and reports ok, logging an integration_events row", async () => {
    const id = await seedIntegration(acmeId, { url: "https://acme.example/hook" });
    const transport = new FakeTransport();

    const res = await sendTest(svcWith(transport), acmeId, id);

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.at).toBe(FIXED.toISOString());
    expect(transport.calls).toHaveLength(1);
    const call = transport.calls[0]!;
    expect(call.url).toBe("https://acme.example/hook");
    expect(call.headers["x-kaenal-event"]).toBe("webhook.ping");
    expect(call.headers["x-kaenal-signature"]).toBe(
      `sha256=${signWebhook("secret-for:env:HOOK", FIXED.toISOString(), call.body)}`,
    );

    const log = await events(acmeId, id);
    expect(log).toContainEqual(expect.objectContaining({ direction: "out", kind: "webhook.ping", status: "ok" }));
  });

  it("reports failure (not fake success) on a 5xx and logs it", async () => {
    const id = await seedIntegration(acmeId, { url: "https://acme.example/hook" });
    const transport = new FakeTransport();
    transport.status = 502;

    const res = await sendTest(svcWith(transport), acmeId, id);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(502);
    expect(res.detail).toBe("HTTP 502");
    expect((await events(acmeId, id)).some((e) => e.status === "failed")).toBe(true);
  });

  it("fails when the endpoint has no signing secret (never sends unsigned)", async () => {
    const id = await seedIntegration(acmeId, { url: "https://acme.example/hook", credentialsRef: null });
    const transport = new FakeTransport();
    const res = await sendTest(svcWith(transport), acmeId, id);
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/signing secret/);
    expect(transport.calls).toHaveLength(0);
  });

  it("rejects a non-webhook integration", async () => {
    const id = await seedIntegration(acmeId, { provider: "slack", url: "https://slack.example" });
    await expect(sendTest(svcWith(new FakeTransport()), acmeId, id)).rejects.toThrow(/webhook endpoints/);
  });

  it("404s an unknown id", async () => {
    await expect(sendTest(svcWith(new FakeTransport()), acmeId, randomUUID())).rejects.toThrow();
  });

  it("404s another tenant's endpoint (RLS) and never delivers to it", async () => {
    const globexHook = await seedIntegration(globexId, { url: "https://globex.example/hook" });
    const transport = new FakeTransport();
    await expect(sendTest(svcWith(transport), acmeId, globexHook)).rejects.toThrow();
    expect(transport.calls).toHaveLength(0);
  });
});
