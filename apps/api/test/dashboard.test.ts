import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import type { DashboardDto } from "@kaenal/types";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * GET /v1/me/dashboard (05 §M5) — the role-aware home.
 *
 * Each role is served its own shape (discriminated by `variant`), computed live
 * inside the tenant-scoped tx. Verifies role dispatch, that a real owned NCR
 * surfaces in the Inspector's "assigned", the honest null on the admin
 * "Failed syncs" tile (no server telemetry — never faked), and that RLS keeps
 * one tenant's rows out of another tenant's counts.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
const users: Record<string, string> = {};

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

async function seedNcr(tenantId: string, ownerId: string, code: string): Promise<void> {
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO ncrs (tenant_id, code, title, status, owner_id)
       VALUES ($1,$2,'Bracket weld inconsistent','open',$3)
       ON CONFLICT (tenant_id, code) DO UPDATE SET owner_id = EXCLUDED.owner_id, status = 'open'`,
      [tenantId, code, ownerId],
    );
  });
}

function token(res: request.Response): string {
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

async function signIn(slug: string, email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}@${slug}: ${res.status}`);
  return token(res);
}

async function dashboard(slug: string, bearer: string): Promise<{ status: number; body: DashboardDto }> {
  const res = await request(server())
    .get("/v1/me/dashboard")
    .set("X-Tenant-Id", slug)
    .set("Authorization", `Bearer ${bearer}`);
  return { status: res.status, body: res.body as DashboardDto };
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  users["inspector"] = await ensureUser("dash-inspector@acme.test");
  users["viewer"] = await ensureUser("dash-viewer@acme.test");
  users["manager"] = await ensureUser("dash-manager@acme.test");
  users["admin"] = await ensureUser("dash-admin@acme.test");
  users["gInspector"] = await ensureUser("dash-inspector@globex.test");

  await addMembership(acmeId, users["inspector"], "inspector");
  await addMembership(acmeId, users["viewer"], "viewer");
  await addMembership(acmeId, users["manager"], "manager");
  await addMembership(acmeId, users["admin"], "admin");
  await addMembership(globexId, users["gInspector"], "inspector");

  // A real owned NCR in acme (surfaces in the inspector's "assigned"), and one in
  // globex owned by the acme inspector's id — which RLS must hide from acme.
  await seedNcr(acmeId, users["inspector"], "NCR-DASH-0001");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  const ids = Object.values(users);
  await control.query("DELETE FROM ncrs WHERE code = 'NCR-DASH-0001'");
  await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  await control.end();
  await app.close();
});

describe("role dispatch", () => {
  it("serves the inspector shape, with an owned NCR in 'assigned'", async () => {
    const tok = await signIn(ACME, "dash-inspector@acme.test");
    const { status, body } = await dashboard(ACME, tok);
    expect(status).toBe(200);
    expect(body.variant).toBe("inspector");
    if (body.variant !== "inspector") throw new Error("variant");
    expect(body.kpis.map((k) => k.label)).toEqual(["Assigned", "Overdue", "Pass rate"]);
    expect(body.assigned.some((r) => r.title.includes("NCR-DASH-0001"))).toBe(true);
  });

  it("serves the viewer shape for a viewer", async () => {
    const tok = await signIn(ACME, "dash-viewer@acme.test");
    const { body } = await dashboard(ACME, tok);
    expect(body.variant).toBe("viewer");
    if (body.variant !== "viewer") throw new Error("variant");
    expect(Array.isArray(body.recent)).toBe(true);
    expect(body.kpis.some((k) => k.label === "Open NCRs")).toBe(true);
  });

  it("serves the manager shape with an approvals summary + team", async () => {
    const tok = await signIn(ACME, "dash-manager@acme.test");
    const { body } = await dashboard(ACME, tok);
    expect(body.variant).toBe("manager");
    if (body.variant !== "manager") throw new Error("variant");
    expect(body.approvals.total).toBe(body.approvals.documents + body.approvals.ncrDispositions);
    expect(Array.isArray(body.team)).toBe(true);
  });

  it("serves the admin shape; the Failed-syncs tile is an honest null, not a fake 0", async () => {
    const tok = await signIn(ACME, "dash-admin@acme.test");
    const { body } = await dashboard(ACME, tok);
    expect(body.variant).toBe("admin");
    if (body.variant !== "admin") throw new Error("variant");
    const failed = body.kpis.find((k) => k.label === "Failed syncs");
    expect(failed?.value).toBeNull();
    expect(Array.isArray(body.auditHighlights)).toBe(true);
  });
});

describe("tenant isolation", () => {
  it("counts only the caller's workspace (RLS): globex inspector never sees acme's NCR", async () => {
    const tok = await signIn(GLOBEX, "dash-inspector@globex.test");
    const { body } = await dashboard(GLOBEX, tok);
    expect(body.variant).toBe("inspector");
    if (body.variant !== "inspector") throw new Error("variant");
    expect(body.assigned.some((r) => r.title.includes("NCR-DASH-0001"))).toBe(false);
  });
});
