import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Connector registry slice (`/v1/integrations`, tables 0032). Pins: the whole
 * surface is admin-only (`integration:manage`); connect records a credential
 * *pointer* and the DTO never exposes it; disconnect/delete purge it; the event
 * log records deliveries; and no tenant sees another's connectors (RLS).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let adminTok = "";
let mgrTok = "";
let globexAdminTok = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(tenantId: string, email: string, role: string): Promise<void> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tenantId, userId, role],
    );
  });
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

async function cleanup(): Promise<void> {
  await control.query("DELETE FROM integration_events WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  await control.query("DELETE FROM integrations WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  await seedMember(acmeId, "integ-admin@acme.test", "admin");
  await seedMember(acmeId, "integ-mgr@acme.test", "manager");
  await seedMember(globexId, "integ-admin@globex.test", "admin");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token(ACME, "integ-admin@acme.test");
  mgrTok = await token(ACME, "integ-mgr@acme.test");
  globexAdminTok = await token(GLOBEX, "integ-admin@globex.test");
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'integ-%@%.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

async function newSap(): Promise<string> {
  const res = await authed("post", "/v1/integrations", ACME, adminTok).send({ provider: "sap", name: "SAP QM" });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe("disconnected");
  expect(res.body.hasCredentials).toBe(false);
  return res.body.id as string;
}

describe("connector lifecycle", () => {
  it("creates, exposes a schema, connects (pointer only), disconnects, and deletes", async () => {
    const id = await newSap();

    // The declared field schema is available (adapter listSchema()).
    const schema = await authed("get", `/v1/integrations/${id}/schema`, ACME, adminTok);
    expect(schema.status).toBe(200);
    expect((schema.body.fields as { key: string }[]).some((f) => f.key === "scrapQty")).toBe(true);

    // Connect: status flips, a credential is stored — but never returned.
    const connected = await authed("post", `/v1/integrations/${id}/connect`, ACME, adminTok).send({});
    expect(connected.status).toBe(200);
    expect(connected.body.status).toBe("connected");
    expect(connected.body.hasCredentials).toBe(true);
    expect(connected.body.credentialsRef).toBeUndefined();
    expect(connected.body.credentials_ref).toBeUndefined();

    // The connect is in the delivery log.
    const events = await authed("get", `/v1/integrations/${id}/events`, ACME, adminTok);
    expect((events.body.items as { kind: string }[]).some((e) => e.kind === "connect")).toBe(true);

    // Disconnect purges the credential pointer.
    const off = await authed("post", `/v1/integrations/${id}/disconnect`, ACME, adminTok).send({});
    expect(off.body.status).toBe("disconnected");
    expect(off.body.hasCredentials).toBe(false);

    expect((await authed("post", `/v1/integrations/${id}/delete`, ACME, adminTok).send({})).status).toBe(200);
    const list = await authed("get", "/v1/integrations", ACME, adminTok);
    expect((list.body.items as { id: string }[]).some((r) => r.id === id)).toBe(false);
  });

  it("edits name under optimistic concurrency", async () => {
    const id = await newSap();
    const upd = await authed("put", `/v1/integrations/${id}`, ACME, adminTok).send({ name: "SAP S/4", version: 0 });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe("SAP S/4");
    const stale = await authed("put", `/v1/integrations/${id}`, ACME, adminTok).send({ name: "x", version: 0 });
    expect(stale.status).toBe(409);
    await authed("post", `/v1/integrations/${id}/delete`, ACME, adminTok).send({});
  });
});

describe("RBAC + tenancy", () => {
  it("is admin-only — a manager is 403 on read and write", async () => {
    expect((await authed("get", "/v1/integrations", ACME, mgrTok)).status).toBe(403);
    expect((await authed("post", "/v1/integrations", ACME, mgrTok).send({ provider: "slack", name: "no" })).status).toBe(403);
  });

  it("does not leak one tenant's connectors into another (RLS)", async () => {
    const id = await newSap();
    const other = await authed("get", "/v1/integrations", GLOBEX, globexAdminTok);
    expect((other.body.items as { id: string }[]).some((r) => r.id === id)).toBe(false);
    expect((await authed("get", `/v1/integrations/${id}`, GLOBEX, globexAdminTok)).status).toBe(404);
    await authed("post", `/v1/integrations/${id}/delete`, ACME, adminTok).send({});
  });
});
