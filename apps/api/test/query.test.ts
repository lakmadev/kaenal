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
 * Query engine slice (`/v1/query*`, Part B2). Pins the security boundary: the
 * compiler only emits whitelisted identifiers + bound parameters (an off-list
 * column or a malicious filter value is a 422 / a no-op, never SQL); reads are
 * gated on the source's `*:view` capability; and every statement is RLS-scoped
 * so one tenant never sees another's rows regardless of role.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let adminTok = "";
let viewerTok = "";
let globexAdminTok = "";

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

async function seedNcr(tenantId: string, actorId: string, code: string, status: string, priority: string): Promise<void> {
  await withTenant(tenantId, actorId, async (tx) => {
    await tx.query(
      `INSERT INTO ncrs (id, tenant_id, code, title, status, priority, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [randomUUID(), tenantId, code, `NCR ${code}`, status, priority, actorId],
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

function authed(method: "get" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

async function cleanup(): Promise<void> {
  await control.query("DELETE FROM ncrs WHERE tenant_id = ANY($1) AND code LIKE 'QTEST-%'", [[acmeId, globexId]]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  const acmeAdmin = await seedMember(acmeId, "query-admin@acme.test", "admin");
  await seedMember(acmeId, "query-viewer@acme.test", "viewer");
  const globexAdmin = await seedMember(globexId, "query-admin@globex.test", "admin");

  await seedNcr(acmeId, acmeAdmin, "QTEST-A1", "open", "critical");
  await seedNcr(acmeId, acmeAdmin, "QTEST-A2", "open", "major");
  await seedNcr(acmeId, acmeAdmin, "QTEST-A3", "closed", "minor");
  await seedNcr(globexId, globexAdmin, "QTEST-G1", "open", "major");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token(ACME, "query-admin@acme.test");
  viewerTok = await token(ACME, "query-viewer@acme.test");
  globexAdminTok = await token(GLOBEX, "query-admin@globex.test");
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'query-%@%.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

// Only the rows this suite seeded (other suites may leave acme NCRs behind).
function seeded(rows: { code: string }[]): { code: string }[] {
  return rows.filter((r) => typeof r.code === "string" && r.code.startsWith("QTEST-"));
}

describe("rows / metric / series", () => {
  it("returns projected rows with a filtered total", async () => {
    const res = await authed("post", "/v1/query", ACME, adminTok).send({
      sourceId: "ncr",
      columns: ["code", "status", "priority"],
      filters: [{ field: "code", op: "contains", value: "QTEST-" }],
      sort: { field: "code", dir: "asc" },
    });
    expect(res.status).toBe(200);
    expect((res.body.fields as { key: string }[]).map((f) => f.key)).toEqual(["code", "status", "priority"]);
    const rows = res.body.rows as { code: string; status: string }[];
    expect(rows.map((r) => r.code)).toEqual(["QTEST-A1", "QTEST-A2", "QTEST-A3"]);
    expect(res.body.total).toBe(3);
  });

  it("counts as a scalar metric", async () => {
    const res = await authed("post", "/v1/query/metric", ACME, adminTok).send({
      sourceId: "ncr",
      agg: "count",
      filters: [{ field: "code", op: "contains", value: "QTEST-" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.value).toBe(3);
  });

  it("groups into a series by dimension", async () => {
    const res = await authed("post", "/v1/query/series", ACME, adminTok).send({
      sourceId: "ncr",
      dimension: "status",
      filters: [{ field: "code", op: "contains", value: "QTEST-" }],
    });
    expect(res.status).toBe(200);
    const points = res.body.points as { label: string; value: number }[];
    const open = points.find((p) => p.label === "open");
    expect(open?.value).toBe(2); // A1, A2
    expect(points.find((p) => p.label === "closed")?.value).toBe(1);
  });

  it("exposes the queryable sources for the caller's role", async () => {
    const res = await authed("get", "/v1/query/sources", ACME, adminTok);
    expect(res.status).toBe(200);
    const ids = (res.body.items as { id: string }[]).map((s) => s.id).sort();
    expect(ids).toEqual(["audit", "capa", "eightd", "finding", "inspection", "ncr", "supplier"]);
    // The DB column is never exposed to the client.
    const ncr = (res.body.items as { id: string; fields: object[] }[]).find((s) => s.id === "ncr");
    expect(ncr?.fields.every((f) => !("column" in f))).toBe(true);
  });
});

describe("the injection boundary", () => {
  it("422s an off-whitelist column, source, and non-numeric measure", async () => {
    expect((await authed("post", "/v1/query", ACME, adminTok).send({ sourceId: "ncr", columns: ["password"] })).status).toBe(422);
    expect((await authed("post", "/v1/query", ACME, adminTok).send({ sourceId: "control.users" })).status).toBe(422);
    expect((await authed("post", "/v1/query/metric", ACME, adminTok).send({ sourceId: "ncr", agg: "sum", measure: "status" })).status).toBe(422);
  });

  it("treats a malicious filter value as a literal, not SQL — the table survives", async () => {
    const res = await authed("post", "/v1/query", ACME, adminTok).send({
      sourceId: "ncr",
      filters: [{ field: "title", op: "contains", value: "'; DROP TABLE ncrs; --" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(0);
    // The table is intact: a normal query still works afterwards.
    const after = await authed("post", "/v1/query/metric", ACME, adminTok).send({
      sourceId: "ncr",
      filters: [{ field: "code", op: "contains", value: "QTEST-" }],
    });
    expect(after.body.value).toBe(3);
  });
});

describe("RBAC + tenancy", () => {
  it("a viewer may query a source it can view", async () => {
    const res = await authed("post", "/v1/query/metric", ACME, viewerTok).send({
      sourceId: "ncr",
      filters: [{ field: "code", op: "contains", value: "QTEST-" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.value).toBe(3);
  });

  it("requires authentication", async () => {
    const res = await request(server()).post("/v1/query").set("X-Tenant-Id", ACME).send({ sourceId: "ncr" });
    expect(res.status).toBe(401);
  });

  it("never returns another tenant's rows (RLS), regardless of role", async () => {
    const res = await authed("post", "/v1/query", GLOBEX, globexAdminTok).send({
      sourceId: "ncr",
      columns: ["code"],
      filters: [{ field: "code", op: "contains", value: "QTEST-" }],
    });
    expect(res.status).toBe(200);
    const codes = seeded(res.body.rows as { code: string }[]).map((r) => r.code);
    expect(codes).toEqual(["QTEST-G1"]); // globex's row only; no QTEST-A*
  });
});
