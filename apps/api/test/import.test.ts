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
 * Bulk-import pipeline (`/v1/import`, tables 0033). Pins: create-run validates +
 * dry-runs but writes NOTHING; commit writes idempotently by natural key (a
 * second run of the same codes updates, never duplicates); the whole surface is
 * `import:run` (a viewer 403s); optimistic + state guards on commit; and one
 * tenant's import never touches another's rows (RLS).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const MAP = { code: "Code", name: "Name", status: "Status" };

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

function authed(method: "get" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

async function supplierCount(tenantId: string): Promise<number> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ n: string }>("SELECT count(*)::text AS n FROM suppliers WHERE code LIKE 'IMP-%'");
    return Number(rows[0]?.n ?? 0);
  });
}

async function supplierName(tenantId: string, code: string): Promise<string | undefined> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ name: string }>("SELECT name FROM suppliers WHERE code = $1", [code]);
    return rows[0]?.name;
  });
}

async function cleanupSuppliers(): Promise<void> {
  for (const t of [acmeId, globexId]) {
    await withTenant(t, null, async (tx) => {
      await tx.query("DELETE FROM suppliers WHERE code LIKE 'IMP-%'");
    });
  }
}

async function cleanupImports(): Promise<void> {
  await control.query("DELETE FROM import_runs WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  await control.query("DELETE FROM import_profiles WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanupImports();
  await cleanupSuppliers();
  await seedMember(acmeId, "imp-admin@acme.test", "admin");
  await seedMember(acmeId, "imp-viewer@acme.test", "viewer");
  await seedMember(globexId, "imp-admin@globex.test", "admin");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token(ACME, "imp-admin@acme.test");
  viewerTok = await token(ACME, "imp-viewer@acme.test");
  globexAdminTok = await token(GLOBEX, "imp-admin@globex.test");
});

afterAll(async () => {
  await cleanupImports();
  await cleanupSuppliers();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'imp-%@%.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

const RUN_ROWS = [
  { Code: "IMP-S1", Name: "One", Status: "active" }, // create
  { Code: "IMP-S2", Name: "Two" }, // create
  { Code: "IMP-S3", Name: "" }, // error — missing required name
];

async function createRun(tok: string, rows: unknown[]): Promise<{ id: string; body: Record<string, unknown> }> {
  const res = await authed("post", "/v1/import/runs", ACME, tok).send({
    targetEntity: "suppliers",
    mapping: MAP,
    rows,
  });
  expect(res.status).toBe(201);
  return { id: res.body.id as string, body: res.body as Record<string, unknown> };
}

describe("targets + validate/dry-run", () => {
  it("exposes the suppliers target schema", async () => {
    const res = await authed("get", "/v1/import/targets", ACME, adminTok);
    expect(res.status).toBe(200);
    const target = (res.body.items as { id: string; fields: { key: string; naturalKey: boolean }[] }[]).find((t) => t.id === "suppliers");
    expect(target?.fields.some((f) => f.key === "code" && f.naturalKey)).toBe(true);
  });

  it("validates + dry-runs without writing anything", async () => {
    expect(await supplierCount(acmeId)).toBe(0);
    const { body } = await createRun(adminTok, RUN_ROWS);
    expect(body.status).toBe("validated");
    expect(body.counts).toMatchObject({ total: 3, valid: 2, errors: 1, created: 2 });
    // Dry run wrote nothing.
    expect(await supplierCount(acmeId)).toBe(0);
  });

  it("rejects a mapping that omits the natural key (422)", async () => {
    const res = await authed("post", "/v1/import/runs", ACME, adminTok).send({
      targetEntity: "suppliers",
      mapping: { name: "Name" },
      rows: [{ Name: "x" }],
    });
    expect(res.status).toBe(422);
  });
});

describe("commit — idempotent by natural key", () => {
  it("commits the valid rows, then a re-import updates instead of duplicating", async () => {
    // Run 1 → commit: two suppliers created.
    const run1 = await createRun(adminTok, RUN_ROWS);
    const commit1 = await authed("post", `/v1/import/runs/${run1.id}/commit`, ACME, adminTok).send({ version: 0 });
    expect(commit1.status).toBe(200);
    expect(commit1.body.status).toBe("completed");
    expect(commit1.body.counts).toMatchObject({ created: 2 });
    expect(await supplierCount(acmeId)).toBe(2);

    // Run 2 with the same codes → all updates, no new rows.
    const run2 = await createRun(adminTok, [
      { Code: "IMP-S1", Name: "One v2", Status: "probation" },
      { Code: "IMP-S2", Name: "Two" },
    ]);
    expect(run2.body.counts).toMatchObject({ created: 0, updated: 2 });
    const commit2 = await authed("post", `/v1/import/runs/${run2.id}/commit`, ACME, adminTok).send({ version: 0 });
    expect(commit2.status).toBe(200);
    expect(await supplierCount(acmeId)).toBe(2); // still two — idempotent
    expect(await supplierName(acmeId, "IMP-S1")).toBe("One v2"); // updated in place
  });

  it("is optimistic and state-guarded", async () => {
    const run = await createRun(adminTok, [{ Code: "IMP-S9", Name: "Nine" }]);
    // Wrong version → 409.
    expect((await authed("post", `/v1/import/runs/${run.id}/commit`, ACME, adminTok).send({ version: 5 })).status).toBe(409);
    // Correct version → completes.
    expect((await authed("post", `/v1/import/runs/${run.id}/commit`, ACME, adminTok).send({ version: 0 })).status).toBe(200);
    // Re-commit a completed run → 422 (only a validated run commits).
    expect((await authed("post", `/v1/import/runs/${run.id}/commit`, ACME, adminTok).send({ version: 1 })).status).toBe(422);
  });
});

describe("RBAC + tenancy", () => {
  it("requires import:run — a viewer is 403 on read and write", async () => {
    expect((await authed("get", "/v1/import/targets", ACME, viewerTok)).status).toBe(403);
    expect(
      (await authed("post", "/v1/import/runs", ACME, viewerTok).send({ targetEntity: "suppliers", mapping: MAP, rows: [] })).status,
    ).toBe(403);
  });

  it("does not leak one tenant's runs or rows into another (RLS)", async () => {
    const run = await createRun(adminTok, [{ Code: "IMP-S1", Name: "One" }]);
    // Globex cannot see acme's run.
    expect((await authed("get", `/v1/import/runs/${run.id}`, GLOBEX, globexAdminTok)).status).toBe(404);
    // Acme's committed suppliers never appear in globex.
    expect(await supplierCount(globexId)).toBe(0);
  });
});
