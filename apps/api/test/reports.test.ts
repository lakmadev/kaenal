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
 * Report definitions slice (`/v1/reports`, table 0031). Pins: report CRUD under
 * `report:manage` with optimistic concurrency; built-in dashboards are listed
 * but read-only; the A3 gap closure (a viewer holds `report:view` so it can read
 * a report but is 403 on authoring); and no tenant sees another's reports (RLS).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let mgrTok = "";
let viewerTok = "";
let globexMgrTok = "";

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
  await control.query("DELETE FROM report_definitions WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
}

const tile = {
  id: "t1",
  title: "Open NCRs",
  viz: "kpi",
  query: { sourceId: "ncr", agg: "count", filters: [{ field: "status", op: "≠", value: "closed" }] },
};

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  await seedMember(acmeId, "report-mgr@acme.test", "manager");
  await seedMember(acmeId, "report-viewer@acme.test", "viewer");
  await seedMember(globexId, "report-mgr@globex.test", "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(ACME, "report-mgr@acme.test");
  viewerTok = await token(ACME, "report-viewer@acme.test");
  globexMgrTok = await token(GLOBEX, "report-mgr@globex.test");
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'report-%@%.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("report CRUD", () => {
  it("creates, lists (with built-ins), gets, updates (optimistic), and deletes", async () => {
    const created = await authed("post", "/v1/reports", ACME, mgrTok).send({ name: "My NCR report", tiles: [tile] });
    expect(created.status).toBe(201);
    expect(created.body.builtin).toBe(false);
    expect(created.body.tiles).toHaveLength(1);
    const id = created.body.id as string;

    const list = await authed("get", "/v1/reports", ACME, mgrTok);
    const items = list.body.items as { id: string; builtin: boolean }[];
    expect(items.some((r) => r.id === id)).toBe(true);
    // The three built-in dashboards are listed and marked read-only.
    const builtins = items.filter((r) => r.builtin);
    expect(builtins).toHaveLength(3);
    expect(builtins.every((r) => r.id.startsWith("builtin-"))).toBe(true);

    const upd = await authed("put", `/v1/reports/${id}`, ACME, mgrTok).send({ name: "Renamed", tiles: [tile], version: 0 });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe("Renamed");
    expect(upd.body.lockVersion).toBe(1);

    const stale = await authed("put", `/v1/reports/${id}`, ACME, mgrTok).send({ name: "x", version: 0 });
    expect(stale.status).toBe(409);

    expect((await authed("post", `/v1/reports/${id}/delete`, ACME, mgrTok).send({})).status).toBe(200);
    const after = await authed("get", "/v1/reports", ACME, mgrTok);
    expect((after.body.items as { id: string }[]).some((r) => r.id === id)).toBe(false);
  });

  it("serves a built-in dashboard by id, but refuses to edit or delete it", async () => {
    const got = await authed("get", "/v1/reports/builtin-quality-overview", ACME, mgrTok);
    expect(got.status).toBe(200);
    expect(got.body.builtin).toBe(true);
    expect((got.body.tiles as unknown[]).length).toBeGreaterThan(0);

    expect((await authed("put", "/v1/reports/builtin-quality-overview", ACME, mgrTok).send({ name: "hijack", version: 0 })).status).toBe(403);
    expect((await authed("post", "/v1/reports/builtin-quality-overview/delete", ACME, mgrTok).send({})).status).toBe(403);
  });

  it("404s an unknown id without a 500 (non-uuid, non-builtin)", async () => {
    expect((await authed("get", "/v1/reports/not-a-real-id", ACME, mgrTok)).status).toBe(404);
  });
});

describe("RBAC + tenancy", () => {
  it("a viewer can read reports but cannot author them (A3 gap closed)", async () => {
    const list = await authed("get", "/v1/reports", ACME, viewerTok);
    expect(list.status).toBe(200); // report:view
    expect((list.body.items as { builtin: boolean }[]).some((r) => r.builtin)).toBe(true);
    const write = await authed("post", "/v1/reports", ACME, viewerTok).send({ name: "nope", tiles: [tile] });
    expect(write.status).toBe(403); // no report:manage
  });

  it("does not leak one tenant's reports into another (RLS)", async () => {
    const created = await authed("post", "/v1/reports", ACME, mgrTok).send({ name: "Acme only", tiles: [tile] });
    const id = created.body.id as string;

    const other = await authed("get", "/v1/reports", GLOBEX, globexMgrTok);
    expect((other.body.items as { id: string }[]).some((r) => r.id === id)).toBe(false);
    // Foreign id → 404, not 403 (rule 8).
    expect((await authed("get", `/v1/reports/${id}`, GLOBEX, globexMgrTok)).status).toBe(404);

    await authed("post", `/v1/reports/${id}/delete`, ACME, mgrTok).send({});
  });
});
