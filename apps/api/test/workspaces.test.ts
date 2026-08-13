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
 * The workspace switcher (shell.jsx profile menu / P07 identity).
 *
 * `GET /v1/me/workspaces` lists every workspace the signed-in person belongs to;
 * `POST /v1/me/switch-workspace` mints a session in a target tenant the caller
 * is already a member of. Both are scoped to the caller: switching to a tenant
 * you do not belong to is a 404, never a 403 — no cross-tenant existence leak.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let bothUserId = "";
let acmeOnlyId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function ensureUser(email: string): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  return rows[0]?.id ?? "";
}

async function addMembership(tenantId: string, userId: string, role: string): Promise<void> {
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tenantId, userId, role],
    );
  });
}

/** The session token from a sign-in / switch response's Set-Cookie. */
function sessionToken(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

async function signIn(slug: string, email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}@${slug}: ${res.status}`);
  return sessionToken(res);
}

function authed(method: "get" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  bothUserId = await ensureUser("ws-both@acme.test");
  await addMembership(acmeId, bothUserId, "admin");
  await addMembership(globexId, bothUserId, "manager");

  acmeOnlyId = await ensureUser("ws-acme@acme.test");
  await addMembership(acmeId, acmeOnlyId, "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  const ids = [bothUserId, acmeOnlyId];
  await control.query("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  await control.end();
  await app.close();
});

describe("listing workspaces", () => {
  it("lists every workspace the person belongs to, marking the active one", async () => {
    const tok = await signIn(ACME, "ws-both@acme.test");
    const res = await authed("get", "/v1/me/workspaces", ACME, tok);
    expect(res.status).toBe(200);
    const items = res.body.items as { tenantSlug: string; role: string; active: boolean }[];
    expect(items.length).toBe(2);
    const acme = items.find((w) => w.tenantSlug === ACME);
    const globex = items.find((w) => w.tenantSlug === GLOBEX);
    expect(acme?.active).toBe(true);
    expect(acme?.role).toBe("admin");
    expect(globex?.active).toBe(false);
    expect(globex?.role).toBe("manager");
  });

  it("lists only the current workspace for a single-tenant person", async () => {
    const tok = await signIn(ACME, "ws-acme@acme.test");
    const res = await authed("get", "/v1/me/workspaces", ACME, tok);
    const items = res.body.items as { tenantSlug: string }[];
    expect(items.length).toBe(1);
    expect(items[0]?.tenantSlug).toBe(ACME);
  });
});

describe("switching workspace", () => {
  it("mints a session in the target tenant, carrying the target-tenant role", async () => {
    const acmeTok = await signIn(ACME, "ws-both@acme.test");

    const sw = await authed("post", "/v1/me/switch-workspace", ACME, acmeTok).send({ slug: GLOBEX });
    expect(sw.status).toBe(200);
    expect(sw.body.tenantSlug).toBe(GLOBEX);
    expect(sw.body.active).toBe(true);

    // The response carries a fresh session cookie for globex; use it there.
    const globexTok = sessionToken(sw);
    expect(globexTok).not.toBe("");

    const me = await authed("get", "/v1/me", GLOBEX, globexTok).send();
    expect(me.status).toBe(200);
    expect(me.body.tenantSlug).toBe(GLOBEX);
    expect(me.body.role).toBe("manager"); // the globex role, not the acme admin one
  });

  it("404s a switch to a workspace the caller does not belong to (no leak)", async () => {
    const tok = await signIn(ACME, "ws-acme@acme.test"); // acme-only member
    const res = await authed("post", "/v1/me/switch-workspace", ACME, tok).send({ slug: GLOBEX });
    expect(res.status).toBe(404);
  });

  it("404s a switch to an unknown workspace", async () => {
    const tok = await signIn(ACME, "ws-both@acme.test");
    const res = await authed("post", "/v1/me/switch-workspace", ACME, tok).send({ slug: "no-such-tenant" });
    expect(res.status).toBe(404);
  });
});
