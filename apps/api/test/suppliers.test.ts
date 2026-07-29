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
 * Suppliers slice (FEATURES §11.1, P08).
 *
 * Covers the vertical: create (auto code + computed score), get/list with
 * filters, the scorecard ranking, optimistic concurrency, capability gating
 * (a viewer cannot manage), a cross-tenant 404 (rule 8), and the audit event.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let managerTok = "";
let viewerTok = "";

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

function authed(method: "get" | "post", path: string, bearer: string, slug = ACME) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

interface Body {
  [k: string]: unknown;
}
async function createSupplier(over: Body = {}, bearer = managerTok): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await authed("post", "/v1/suppliers", bearer).send({
    name: "Precision Stamping GmbH",
    category: "Stamping & forming",
    country: "Germany",
    tier: 2,
    riskTier: "medium",
    scorecard: { ppm: 142, ppmTarget: 50, otd: 96.4, otdTarget: 98, oqe: 82, oqeTarget: 85, scarHours: 38, scarTarget: 48 },
    ...over,
  });
  return { status: res.status, body: res.body as Record<string, unknown> };
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  await seedMember(acmeId, "sup-mgr@acme.test", "manager");
  await seedMember(acmeId, "sup-view@acme.test", "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  managerTok = await token(ACME, "sup-mgr@acme.test");
  viewerTok = await token(ACME, "sup-view@acme.test");
});

afterAll(async () => {
  await control.query("DELETE FROM suppliers WHERE name LIKE 'FIXT-%' OR name = 'Precision Stamping GmbH' OR name = 'Bharat Forge Test' OR name = 'Ningbo Test'");
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'sup-%@acme.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("suppliers CRUD", () => {
  it("creates a supplier with an auto-generated code and a computed score", async () => {
    const { status, body } = await createSupplier();
    expect(status).toBe(201);
    expect(body["code"]).toMatch(/^SUP-\d{4}-\d{4}$/);
    expect(body["name"]).toBe("Precision Stamping GmbH");
    expect(body["lockVersion"]).toBe(0);
    // PPM ~2.8× target drags the score below A; still a real number.
    expect(typeof body["score"]).toBe("number");
    expect(body["grade"]).toMatch(/^[A-D]$/);
  });

  it("fetches a supplier by id and lists it with a category filter", async () => {
    const created = await createSupplier({ name: "FIXT-list", category: "Injection moulding" });
    const id = created.body["id"] as string;

    const got = await authed("get", `/v1/suppliers/${id}`, viewerTok);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(id);

    const listed = await authed("get", "/v1/suppliers?category=Injection%20moulding", viewerTok);
    expect(listed.status).toBe(200);
    expect((listed.body.items as Array<{ id: string }>).some((s) => s.id === id)).toBe(true);
  });

  it("filters by flag", async () => {
    const created = await createSupplier({ name: "FIXT-flagged", flags: ["ppm-breach", "cert-expiring"] });
    const id = created.body["id"] as string;
    const listed = await authed("get", "/v1/suppliers?flag=ppm-breach", viewerTok);
    expect((listed.body.items as Array<{ id: string }>).some((s) => s.id === id)).toBe(true);
  });

  it("refuses a create from a viewer (supplier:manage)", async () => {
    const res = await createSupplier({ name: "FIXT-denied" }, viewerTok);
    expect(res.status).toBe(403);
  });

  it("updates under optimistic concurrency and rejects a stale version", async () => {
    const created = await createSupplier({ name: "FIXT-update" });
    const id = created.body["id"] as string;

    const ok = await authed("post", `/v1/suppliers/${id}`, managerTok).send({ version: 0, riskTier: "high", city: "Frankfurt" });
    expect(ok.status).toBe(200);
    expect(ok.body.riskTier).toBe("high");
    expect(ok.body.city).toBe("Frankfurt");
    expect(ok.body.lockVersion).toBe(1);

    const stale = await authed("post", `/v1/suppliers/${id}`, managerTok).send({ version: 0, riskTier: "low" });
    expect(stale.status).toBe(409);
  });

  it("ranks suppliers by weighted score on the scorecard endpoint", async () => {
    await createSupplier({
      name: "Bharat Forge Test",
      scorecard: { ppm: 28, ppmTarget: 50, otd: 99.1, otdTarget: 98, oqe: 96, oqeTarget: 90, scarHours: 12, scarTarget: 48 },
    });
    await createSupplier({
      name: "Ningbo Test",
      scorecard: { ppm: 482, ppmTarget: 100, otd: 89.2, otdTarget: 95, oqe: 58, oqeTarget: 80, scarHours: 96, scarTarget: 48 },
    });

    const res = await authed("get", "/v1/supplier-scorecard", managerTok);
    expect(res.status).toBe(200);
    const items = res.body.items as Array<{ name: string; score: number }>;
    const bharat = items.findIndex((s) => s.name === "Bharat Forge Test");
    const ningbo = items.findIndex((s) => s.name === "Ningbo Test");
    expect(bharat).toBeGreaterThanOrEqual(0);
    expect(ningbo).toBeGreaterThanOrEqual(0);
    expect(bharat).toBeLessThan(ningbo); // the strong supplier ranks ahead
  });

  it("returns 404 for an unknown id and for another tenant's supplier (rule 8)", async () => {
    const unknown = await authed("get", `/v1/suppliers/${randomUUID()}`, managerTok);
    expect(unknown.status).toBe(404);

    // A supplier that exists only in globex must be invisible to an acme member.
    const foreignId = randomUUID();
    await withTenant(globexId, null, async (tx) => {
      await tx.query(
        `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES ($1,$2,'FIXT-foreign','SUP-X-0001','active')`,
        [foreignId, globexId],
      );
    });
    const foreign = await authed("get", `/v1/suppliers/${foreignId}`, managerTok);
    expect(foreign.status).toBe(404);
    await control.query("DELETE FROM suppliers WHERE id = $1", [foreignId]);
  });

  it("writes a 'created' audit event", async () => {
    const created = await createSupplier({ name: "FIXT-audit" });
    const id = created.body["id"] as string;
    const { rows } = await control.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM audit_events WHERE entity_kind = 'supplier' AND entity_id = $1 AND action = 'created'",
      [id],
    );
    expect(Number(rows[0]?.n)).toBeGreaterThanOrEqual(1);
  });
});
