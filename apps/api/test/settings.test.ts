import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Settings slice — white-label branding (`/v1/settings/branding`, table 0025).
 * Pins: an unbranded workspace reads schema defaults at version 0; a
 * settings:manage holder saves and the read reflects it with a bumped
 * lockVersion; optimistic concurrency rejects a stale write (409); a viewer
 * without the capability is refused the write but may read; and one tenant's
 * branding never leaks into another (RLS).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";

let mgrTok = ""; // manager — holds settings:manage
let viewerTok = ""; // viewer — no settings:manage
let globexMgrTok = ""; // manager in the other tenant

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

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
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tenantId, userId, role],
    );
  });
  return userId;
}

async function token(slug: string, email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "put", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

/** A complete, valid branding document (the PUT takes the whole doc + version). */
function brandingBody(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    displayName: "",
    shortName: "",
    primaryColor: "#18181b",
    bgColor: "#f4f4f5",
    domain: "",
    loginTagline: "",
    font: "Archivo",
    supportEmail: "",
    footer: "",
    fromName: "",
    fromEmail: "",
    version: 0,
    ...overrides,
  };
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  await seedMember(acmeId, "settings-mgr@acme.test", "manager");
  await seedMember(acmeId, "settings-viewer@acme.test", "viewer");
  await seedMember(globexId, "settings-mgr@globex.test", "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(ACME, "settings-mgr@acme.test");
  viewerTok = await token(ACME, "settings-viewer@acme.test");
  globexMgrTok = await token(GLOBEX, "settings-mgr@globex.test");
});

afterAll(async () => {
  // tenant_settings.updated_by → memberships is ON DELETE RESTRICT, so drop the
  // settings rows before the memberships that stamped them.
  await control.query("DELETE FROM tenant_settings WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'settings-%@%.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  } else {
    await control.query("SELECT $1::uuid", [randomUUID()]);
  }
  await control.end();
  await app.close();
});

describe("white-label branding", () => {
  it("reads schema defaults at version 0 when unbranded", async () => {
    const res = await authed("get", "/v1/settings/branding", ACME, viewerTok);
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("");
    expect(res.body.primaryColor).toBe("#18181b");
    expect(res.body.font).toBe("Archivo");
    expect(res.body.lockVersion).toBe(0);
  });

  it("saves branding (settings:manage) and reflects it with a bumped version", async () => {
    const save = await authed("put", "/v1/settings/branding", ACME, mgrTok).send(
      brandingBody({ displayName: "Acme Quality", shortName: "AQ", primaryColor: "#2563eb", version: 0 }),
    );
    expect(save.status).toBe(200);
    expect(save.body.displayName).toBe("Acme Quality");
    expect(save.body.primaryColor).toBe("#2563eb");
    expect(save.body.lockVersion).toBe(1);

    const read = await authed("get", "/v1/settings/branding", ACME, viewerTok);
    expect(read.body.displayName).toBe("Acme Quality");
    expect(read.body.shortName).toBe("AQ");
    expect(read.body.lockVersion).toBe(1);
  });

  it("rejects a stale write with 409", async () => {
    const stale = await authed("put", "/v1/settings/branding", ACME, mgrTok).send(
      brandingBody({ displayName: "Racing The Save", version: 0 }),
    );
    expect(stale.status).toBe(409);
  });

  it("refuses the write to a viewer (no settings:manage) but allows the read", async () => {
    const write = await authed("put", "/v1/settings/branding", ACME, viewerTok).send(
      brandingBody({ displayName: "Viewer Cannot", version: 1 }),
    );
    expect(write.status).toBe(403);

    const read = await authed("get", "/v1/settings/branding", ACME, viewerTok);
    expect(read.status).toBe(200);
  });

  it("rejects an invalid colour with 422", async () => {
    const bad = await authed("put", "/v1/settings/branding", ACME, mgrTok).send(
      brandingBody({ primaryColor: "not-a-hex", version: 1 }),
    );
    expect(bad.status).toBe(422);
  });

  it("never leaks one tenant's branding into another (RLS)", async () => {
    const other = await authed("get", "/v1/settings/branding", GLOBEX, globexMgrTok);
    expect(other.status).toBe(200);
    expect(other.body.displayName).toBe("");
    expect(other.body.lockVersion).toBe(0);
  });
});
