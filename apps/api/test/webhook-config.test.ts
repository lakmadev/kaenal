import "reflect-metadata";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant, type Tx } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";
import { IntegrationsService } from "../src/integrations/integrations.service.js";
import { EnvSecretResolver } from "../src/tenant/secret-resolver.js";
import { WebhookSecretBox, WebhookSecretResolver } from "../src/outbox/webhook-secret-box.js";
import { FetchWebhookTransport, guardedLookup } from "../src/outbox/webhook-transport.js";
import { signWebhook } from "../src/outbox/webhook-signing.js";
import type { AuditContext } from "../src/ncr/audit-context.js";

/**
 * Webhook configuration form backend (Sequence 2): URL + events + signing secret.
 * Pins: SSRF validation at save AND at delivery; the secret is server-generated,
 * revealed once, sealed at rest, never returned by any read; rotating changes
 * the signature receivers see; "send test event" really lands on a live local
 * receiver and verifies under the revealed secret; optimistic concurrency, audit,
 * cross-tenant 404, RBAC.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const CTX: AuditContext = { requestId: null, ip: null, userAgent: null };

let control: pg.Pool;
let app: INestApplication;
let acmeId = "";
let globexId = "";
let adminTok = "";
let mgrTok = "";
let globexAdminTok = "";
let actorId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

// --- a real local receiver ---------------------------------------------------
interface Hit {
  headers: http.IncomingHttpHeaders;
  body: string;
}
let receiver: http.Server;
let hits: Hit[] = [];
let respondWith = 200;
let receiverUrl = "";

const box = new WebhookSecretBox({ authSecret: "test-auth-secret-for-webhook-config" });
const secrets = new WebhookSecretResolver(box, new EnvSecretResolver());
const dev = { allowPrivateTargets: true };
const strict = { allowPrivateTargets: false };

function svc(policy = dev): IntegrationsService {
  return new IntegrationsService(secrets, new FetchWebhookTransport({ policy }), () => new Date(), { policy, box });
}

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(tenantId: string, email: string, role: string): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tenantId, null, (tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tenantId, userId, role],
    ),
  );
  return userId;
}

async function token(slug: string, email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "put" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

async function newWebhookRow(tenantId: string): Promise<string> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO integrations (tenant_id, provider, name) VALUES ($1,'generic_webhook','Hook') RETURNING id`,
      [tenantId],
    );
    return rows[0]?.id ?? "";
  });
}

const inTx = <T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> => withTenant(tenantId, actorId, fn);

async function cleanup(): Promise<void> {
  await control.query("DELETE FROM integration_events WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  await control.query("DELETE FROM integrations WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
}

beforeAll(async () => {
  receiver = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      hits.push({ headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
      res.statusCode = respondWith;
      res.end("ok");
    });
  });
  await new Promise<void>((r) => receiver.listen(0, "127.0.0.1", r));
  receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hook`;

  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  actorId = await seedMember(acmeId, "whcfg-admin@acme.test", "admin");
  await seedMember(acmeId, "whcfg-mgr@acme.test", "manager");
  await seedMember(globexId, "whcfg-admin@globex.test", "admin");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  adminTok = await token(ACME, "whcfg-admin@acme.test");
  mgrTok = await token(ACME, "whcfg-mgr@acme.test");
  globexAdminTok = await token(GLOBEX, "whcfg-admin@globex.test");
});

afterAll(async () => {
  await cleanup();
  const ids = (await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'whcfg-%@%.test'")).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
  await new Promise<void>((r) => receiver.close(() => r()));
});

describe("configure + send test against a live local receiver (service level, flag on)", () => {
  it("reveals the secret once, seals it at rest, and a test event verifies under it", async () => {
    hits = [];
    respondWith = 200;
    const id = await newWebhookRow(acmeId);
    const s = svc();

    const cfg = await inTx(acmeId, (tx) =>
      s.configureWebhook(tx, acmeId, actorId, id, { url: receiverUrl, events: ["ncr.*", "webhook.ping"], rotateSecret: false, version: 0 }, CTX),
    );
    expect(cfg.signingSecret).toMatch(/^whsec_/);
    expect(cfg.integration.hasCredentials).toBe(true);
    expect(cfg.integration.config["url"]).toBe(receiverUrl);
    expect(cfg.integration.config["events"]).toBe("ncr.*,webhook.ping");
    expect(JSON.stringify(cfg.integration)).not.toContain(cfg.signingSecret ?? "never");

    // At rest: sealed, never plaintext.
    const raw = await control.query<{ credentials_ref: string }>("SELECT credentials_ref FROM integrations WHERE id=$1", [id]);
    expect(raw.rows[0]?.credentials_ref.startsWith("enc:v1:")).toBe(true);
    expect(raw.rows[0]?.credentials_ref).not.toContain(cfg.signingSecret ?? "never");

    // Connect (needs URL + secret), then ping the live receiver.
    await inTx(acmeId, (tx) => s.connect(tx, acmeId, actorId, id, {}, CTX));
    const res = await inTx(acmeId, (tx) => s.sendTest(tx, acmeId, actorId, id, CTX));
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(hits).toHaveLength(1);
    const hit = hits[0] as Hit;
    const ts = hit.headers["x-kaenal-timestamp"] as string;
    expect(hit.headers["x-kaenal-signature"]).toBe(`sha256=${signWebhook(cfg.signingSecret ?? "", ts, hit.body)}`);
  });

  it("rotating changes the signature: new secret verifies, old one no longer does", async () => {
    hits = [];
    const id = await newWebhookRow(acmeId);
    const s = svc();
    const first = await inTx(acmeId, (tx) =>
      s.configureWebhook(tx, acmeId, actorId, id, { url: receiverUrl, events: ["*"], rotateSecret: false, version: 0 }, CTX),
    );
    await inTx(acmeId, (tx) => s.connect(tx, acmeId, actorId, id, {}, CTX));
    const v1 = first.integration.lockVersion + 1; // connect bumped the version
    const rotated = await inTx(acmeId, (tx) =>
      s.configureWebhook(tx, acmeId, actorId, id, { url: receiverUrl, events: ["*"], rotateSecret: true, version: v1 }, CTX),
    );
    expect(rotated.signingSecret).not.toBeNull();
    expect(rotated.signingSecret).not.toBe(first.signingSecret);

    await inTx(acmeId, (tx) => s.sendTest(tx, acmeId, actorId, id, CTX));
    const hit = hits[0] as Hit;
    const ts = hit.headers["x-kaenal-timestamp"] as string;
    const sig = hit.headers["x-kaenal-signature"];
    expect(sig).toBe(`sha256=${signWebhook(rotated.signingSecret ?? "", ts, hit.body)}`);
    expect(sig).not.toBe(`sha256=${signWebhook(first.signingSecret ?? "", ts, hit.body)}`);
  });

  it("re-saving without rotate keeps the secret and reveals nothing", async () => {
    const id = await newWebhookRow(acmeId);
    const s = svc();
    await inTx(acmeId, (tx) => s.configureWebhook(tx, acmeId, actorId, id, { url: receiverUrl, events: ["*"], rotateSecret: false, version: 0 }, CTX));
    const before = await control.query<{ credentials_ref: string; lock_version: number }>("SELECT credentials_ref, lock_version FROM integrations WHERE id=$1", [id]);
    const again = await inTx(acmeId, (tx) =>
      s.configureWebhook(tx, acmeId, actorId, id, { url: receiverUrl, events: ["ncr.*"], rotateSecret: false, version: before.rows[0]?.lock_version ?? 0 }, CTX),
    );
    expect(again.signingSecret).toBeNull();
    const after = await control.query<{ credentials_ref: string }>("SELECT credentials_ref FROM integrations WHERE id=$1", [id]);
    expect(after.rows[0]?.credentials_ref).toBe(before.rows[0]?.credentials_ref);
  });

  it("stale version → 409 and a replayed rotate cannot re-reveal", async () => {
    const id = await newWebhookRow(acmeId);
    const s = svc();
    const body = { url: receiverUrl, events: ["*"], rotateSecret: true, version: 0 };
    await inTx(acmeId, (tx) => s.configureWebhook(tx, acmeId, actorId, id, body, CTX));
    await expect(inTx(acmeId, (tx) => s.configureWebhook(tx, acmeId, actorId, id, body, CTX))).rejects.toMatchObject({ code: "STALE_WRITE" });
  });

  it("writes an audit event that never contains the secret", async () => {
    const id = await newWebhookRow(acmeId);
    const cfg = await inTx(acmeId, (tx) =>
      svc().configureWebhook(tx, acmeId, actorId, id, { url: receiverUrl, events: ["*"], rotateSecret: false, version: 0 }, CTX),
    );
    const { rows } = await control.query<{ n: string; blob: string }>(
      `SELECT count(*)::text AS n, string_agg(before::text || after::text, '') AS blob FROM audit_events WHERE entity_id = $1`,
      [id],
    );
    expect(Number(rows[0]?.n)).toBeGreaterThan(0);
    expect(rows[0]?.blob).toContain("secretRotated");
    expect(rows[0]?.blob).not.toContain(cfg.signingSecret ?? "never");
  });

  it("connect refuses a webhook with no URL/secret (no bare pointer that can't sign)", async () => {
    const id = await newWebhookRow(acmeId);
    await expect(inTx(acmeId, (tx) => svc().connect(tx, acmeId, actorId, id, {}, CTX))).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("a foreign tenant's webhook id is 404", async () => {
    const id = await newWebhookRow(acmeId);
    await expect(
      inTx(globexId, (tx) => svc().configureWebhook(tx, globexId, actorId, id, { url: receiverUrl, events: ["*"], rotateSecret: false, version: 0 }, CTX)),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("SSRF guard at save and at delivery", () => {
  it("rejects private/loopback/metadata/http targets at save under the strict policy", async () => {
    const id = await newWebhookRow(acmeId);
    for (const url of [receiverUrl, "https://169.254.169.254/x", "https://[::1]/x", "https://localhost/x", "http://hooks.example.com/x", "file:///etc/passwd"]) {
      await expect(
        inTx(acmeId, (tx) => svc(strict).configureWebhook(tx, acmeId, actorId, id, { url, events: ["*"], rotateSecret: false, version: 0 }, CTX)),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
  });

  it("the transport itself refuses a private target even if a bad URL was stored", async () => {
    hits = [];
    const t = new FetchWebhookTransport({ policy: strict });
    await expect(t.post(receiverUrl, {}, "{}")).rejects.toThrow(/not allowed/);
    await expect(t.post("https://169.254.169.254/latest", {}, "{}")).rejects.toThrow(/not allowed/);
    expect(hits).toHaveLength(0);
  });

  it("the connect-time DNS guard refuses a name that resolves to loopback", async () => {
    // `localhost` resolves to 127.0.0.1/::1 via the system resolver, no network needed.
    const err = await new Promise<Error | null>((resolve) => {
      guardedLookup("localhost", {}, (e) => resolve(e));
    });
    expect(err?.message).toMatch(/private or reserved/);
  });

  it("does not follow redirects (a 3xx is a failed delivery)", async () => {
    const redirector = http.createServer((_q, r) => {
      r.statusCode = 302;
      r.setHeader("location", "http://169.254.169.254/latest");
      r.end();
    });
    await new Promise<void>((r) => redirector.listen(0, "127.0.0.1", r));
    try {
      const url = `http://127.0.0.1:${(redirector.address() as AddressInfo).port}/`;
      const res = await new FetchWebhookTransport({ policy: dev }).post(url, {}, "{}");
      expect(res.status).toBe(302);
    } finally {
      await new Promise<void>((r) => redirector.close(() => r()));
    }
  });
});

describe("HTTP surface: RBAC, validation, secret never returned", () => {
  it("manager is 403; admin gets the secret once and no GET ever returns it", async () => {
    const created = await authed("post", "/v1/integrations", ACME, adminTok).send({ provider: "generic_webhook", name: "Ops hook" });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const body = { url: "https://hooks.example.com/kaenal", events: ["ncr.*"], rotateSecret: false, version: created.body.lockVersion };

    expect((await authed("put", `/v1/integrations/${id}/webhook`, ACME, mgrTok).send(body)).status).toBe(403);

    const ok = await authed("put", `/v1/integrations/${id}/webhook`, ACME, adminTok).send(body);
    expect(ok.status).toBe(200);
    const secret = ok.body.signingSecret as string;
    expect(secret).toMatch(/^whsec_/);
    expect(ok.body.integration.hasCredentials).toBe(true);
    expect(ok.body.integration.credentialsRef).toBeUndefined();

    for (const path of ["/v1/integrations", `/v1/integrations/${id}`, `/v1/integrations/${id}/events`]) {
      const res = await authed("get", path, ACME, adminTok);
      expect(JSON.stringify(res.body)).not.toContain(secret);
      expect(JSON.stringify(res.body)).not.toContain("enc:v1:");
    }
  });

  it("rejects SSRF URLs and bad events with 422, stale versions with 409", async () => {
    const created = await authed("post", "/v1/integrations", ACME, adminTok).send({ provider: "generic_webhook", name: "Bad" });
    const id = created.body.id as string;
    const put = (b: object) => authed("put", `/v1/integrations/${id}/webhook`, ACME, adminTok).send(b);
    expect((await put({ url: "https://169.254.169.254/x", events: ["*"], version: 0 })).status).toBe(422);
    expect((await put({ url: "https://hooks.example.com/x", events: [], version: 0 })).status).toBe(422);
    expect((await put({ url: "https://hooks.example.com/x", events: ["Bad Event"], version: 0 })).status).toBe(422);
    expect((await put({ url: "https://hooks.example.com/x", events: ["*"], version: 5 })).status).toBe(409);
  });

  it("generic create/update also validate a webhook config (no back door around the form)", async () => {
    const bad = await authed("post", "/v1/integrations", ACME, adminTok).send({ provider: "generic_webhook", name: "Back door", config: { url: "https://10.0.0.1/x" } });
    expect(bad.status).toBe(422);
  });

  it("foreign tenant id is 404 over HTTP; policy endpoint reports strict", async () => {
    const created = await authed("post", "/v1/integrations", ACME, adminTok).send({ provider: "generic_webhook", name: "Mine" });
    const id = created.body.id as string;
    const res = await authed("put", `/v1/integrations/${id}/webhook`, GLOBEX, globexAdminTok).send({ url: "https://hooks.example.com/x", events: ["*"], version: 0 });
    expect(res.status).toBe(404);
    const policy = await authed("get", "/v1/integrations/webhook-policy", ACME, adminTok);
    expect(policy.status).toBe(200);
    expect(policy.body).toEqual({ allowPrivateTargets: false });
    expect((await authed("get", "/v1/integrations/webhook-policy", ACME, mgrTok)).status).toBe(403);
  });
});

