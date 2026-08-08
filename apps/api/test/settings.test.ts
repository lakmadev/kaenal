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
let concUserId = ""; // dedicated user for the concurrent-session enforcement test

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

function authed(method: "get" | "put" | "post", path: string, slug: string, bearer: string) {
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

  // Start from a clean, unbranded slate (a prior run — or manual dev use — may
  // have left branding/rules behind; the branding tests assume version 0).
  await control.query("DELETE FROM ncrs WHERE title LIKE 'PHASEB%'");
  await control.query("DELETE FROM ncr_validation_rules WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  await control.query("DELETE FROM tenant_settings WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);

  await seedMember(acmeId, "settings-mgr@acme.test", "manager");
  await seedMember(acmeId, "settings-viewer@acme.test", "viewer");
  concUserId = await seedMember(acmeId, "settings-conc@acme.test", "viewer");
  await seedMember(globexId, "settings-mgr@globex.test", "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(ACME, "settings-mgr@acme.test");
  viewerTok = await token(ACME, "settings-viewer@acme.test");
  globexMgrTok = await token(GLOBEX, "settings-mgr@globex.test");
});

afterAll(async () => {
  // Composite (tenant_id, updated_by/created_by) → memberships FKs are ON DELETE
  // RESTRICT, so drop the settings rows + test NCRs before the memberships.
  await control.query("DELETE FROM ncrs WHERE title LIKE 'PHASEB%'");
  await control.query("DELETE FROM ncr_validation_rules WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
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

describe("NCR validation rules", () => {
  it("CRUD: create/list/update(optimistic)/delete under settings:manage", async () => {
    const created = await authed("post", "/v1/settings/ncr-validation-rules", ACME, mgrTok).send({
      name: "Description required",
      field: "description",
      operator: "is_empty",
      action: "block",
      message: "A description is required",
      enabled: true,
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(created.body.lockVersion).toBe(0);

    const list = await authed("get", "/v1/settings/ncr-validation-rules", ACME, viewerTok);
    expect(list.status).toBe(200);
    expect((list.body.items as { id: string }[]).some((r) => r.id === id)).toBe(true);

    // Optimistic update (disable it); version bumps.
    const upd = await authed("put", `/v1/settings/ncr-validation-rules/${id}`, ACME, mgrTok).send({
      name: "Description required",
      field: "description",
      operator: "is_empty",
      action: "block",
      message: "A description is required",
      enabled: false,
      version: 0,
    });
    expect(upd.status).toBe(200);
    expect(upd.body.enabled).toBe(false);
    expect(upd.body.lockVersion).toBe(1);

    // Stale update → 409.
    const stale = await authed("put", `/v1/settings/ncr-validation-rules/${id}`, ACME, mgrTok).send({
      name: "x",
      field: "description",
      operator: "is_empty",
      action: "block",
      message: "x",
      enabled: true,
      version: 0,
    });
    expect(stale.status).toBe(409);

    const removed = await authed("post", `/v1/settings/ncr-validation-rules/${id}/delete`, ACME, mgrTok).send({});
    expect(removed.status).toBe(200);
    const after = await authed("get", "/v1/settings/ncr-validation-rules", ACME, mgrTok);
    expect((after.body.items as { id: string }[]).some((r) => r.id === id)).toBe(false);
  });

  it("refuses rule writes to a viewer (no settings:manage)", async () => {
    const res = await authed("post", "/v1/settings/ncr-validation-rules", ACME, viewerTok).send({
      name: "nope",
      field: "title",
      operator: "is_not_empty",
      action: "warn",
      message: "nope",
      enabled: true,
    });
    expect(res.status).toBe(403);
  });

  it("enforces an enabled block rule on NCR create, and allows once satisfied", async () => {
    const rule = await authed("post", "/v1/settings/ncr-validation-rules", ACME, mgrTok).send({
      name: "Title cannot be the banned token",
      field: "title",
      operator: "equals",
      value: "PHASEB_BLOCK",
      action: "block",
      message: "That title is not allowed",
      enabled: true,
    });
    expect(rule.status).toBe(201);

    // A matching create is blocked with the rule's message.
    const blocked = await authed("post", "/v1/ncrs", ACME, mgrTok).send({ title: "PHASEB_BLOCK", priority: "major" });
    expect(blocked.status).toBe(422);
    expect(JSON.stringify(blocked.body)).toContain("not allowed");

    // A non-matching create succeeds.
    const ok = await authed("post", "/v1/ncrs", ACME, mgrTok).send({ title: "PHASEB_OK", priority: "major" });
    expect(ok.status).toBe(201);

    // Disabling the rule lets the previously-blocked title through.
    const disable = await authed("put", `/v1/settings/ncr-validation-rules/${rule.body.id}`, ACME, mgrTok).send({
      name: "Title cannot be the banned token",
      field: "title",
      operator: "equals",
      value: "PHASEB_BLOCK",
      action: "block",
      message: "That title is not allowed",
      enabled: false,
      version: 0,
    });
    expect(disable.status).toBe(200);
    const nowOk = await authed("post", "/v1/ncrs", ACME, mgrTok).send({ title: "PHASEB_BLOCK", priority: "major" });
    expect(nowOk.status).toBe(201);
  });

  it("does not leak one tenant's rules into another (RLS)", async () => {
    await authed("post", "/v1/settings/ncr-validation-rules", ACME, mgrTok).send({
      name: "acme-only rule",
      field: "title",
      operator: "is_not_empty",
      action: "warn",
      message: "x",
      enabled: true,
    });
    const other = await authed("get", "/v1/settings/ncr-validation-rules", GLOBEX, globexMgrTok);
    expect(other.status).toBe(200);
    expect((other.body.items as { name: string }[]).some((r) => r.name === "acme-only rule")).toBe(false);
  });
});

async function activeSessionCount(userId: string): Promise<number> {
  const { rows } = await control.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()",
    [userId],
  );
  return Number(rows[0]?.n ?? "0");
}

describe("session policy", () => {
  it("reads defaults, saves (settings:manage), and rejects a stale write", async () => {
    const def = await authed("get", "/v1/settings/session-policy", ACME, viewerTok);
    expect(def.status).toBe(200);
    expect(def.body.maxConcurrentSessions).toBe(3);
    expect(def.body.webAbsoluteHours).toBe(12);
    expect(def.body.lockVersion).toBe(0);

    const save = await authed("put", "/v1/settings/session-policy", ACME, mgrTok).send({
      ...def.body,
      maxConcurrentSessions: 1,
      webAbsoluteHours: 1,
      version: 0,
    });
    expect(save.status).toBe(200);
    expect(save.body.maxConcurrentSessions).toBe(1);
    expect(save.body.lockVersion).toBe(1);

    const stale = await authed("put", "/v1/settings/session-policy", ACME, mgrTok).send({
      ...def.body,
      version: 0,
    });
    expect(stale.status).toBe(409);

    const viewerWrite = await authed("put", "/v1/settings/session-policy", ACME, viewerTok).send({
      ...def.body,
      version: 1,
    });
    expect(viewerWrite.status).toBe(403);
  });

  it("enforces the absolute timeout and the max-concurrent cap at sign-in", async () => {
    // Ensure the policy is max 1 session / 1h absolute (the CRUD test above set
    // it, but read the live version to be order-independent).
    const cur = await authed("get", "/v1/settings/session-policy", ACME, mgrTok);
    await authed("put", "/v1/settings/session-policy", ACME, mgrTok).send({
      ...cur.body,
      maxConcurrentSessions: 1,
      webAbsoluteHours: 1,
      version: cur.body.lockVersion,
    });

    // First sign-in: session lifetime follows the 1h absolute timeout.
    await token(ACME, "settings-conc@acme.test");
    const { rows } = await control.query<{ expires_at: Date }>(
      "SELECT expires_at FROM sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [concUserId],
    );
    const ttlMs = (rows[0]?.expires_at.getTime() ?? 0) - Date.now();
    expect(ttlMs).toBeGreaterThan(55 * 60_000);
    expect(ttlMs).toBeLessThan(65 * 60_000);
    expect(await activeSessionCount(concUserId)).toBe(1);

    // Second sign-in: the cap of 1 revokes the older session.
    await token(ACME, "settings-conc@acme.test");
    expect(await activeSessionCount(concUserId)).toBe(1);
  });
});
