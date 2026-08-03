import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { withTenant } from "@kaenal/db";
import type { FormSchema } from "@kaenal/types";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Inspections vertical slice (03 §1, §5–6; 02 §4; 08 §1.2).
 *
 * Real stack: author + publish a template, schedule an inspection (server-minted
 * code), start it, submit responses that are validated and scored server-side,
 * complete it. Plus the cross-cutting guarantees the slice is supposed to prove:
 * cursor pagination, idempotent create, optimistic concurrency, plant scoping
 * (404 not 403), and RBAC.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let plantA = "";
let plantB = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

const SCHEMA: FormSchema = {
  sections: [
    {
      id: "s1",
      title: "Safety",
      weight: 1,
      items: [
        { id: "guard", type: "pass_fail", label: "Guard fitted", required: true, weight: 1, naAllowed: false },
        { id: "notes", type: "textarea", label: "Notes", required: false, weight: 1, naAllowed: false },
      ],
    },
  ],
};

async function tenantId(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>(
    "SELECT id FROM control.tenants WHERE slug = $1",
    [slug],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(
  tid: string,
  email: string,
  role: string,
  plantIds: string[],
): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tid, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (tenant_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, plant_ids = EXCLUDED.plant_ids, status = 'active'`,
      [tid, userId, role, plantIds],
    );
  });
  return userId;
}

async function seedPlant(tid: string, code: string): Promise<string> {
  const id = randomUUID();
  await withTenant(tid, null, async (tx) => {
    await tx.query(
      `INSERT INTO plants (id, tenant_id, name, code, timezone) VALUES ($1, $2, $3, $4, 'UTC')`,
      [id, tid, code, code],
    );
  });
  return id;
}

/** Signs in and returns a bearer token (avoids the CSRF dance for mutations). */
async function token(email: string): Promise<string> {
  const res = await request(server())
    .post("/v1/auth/sign-in")
    .set("X-Tenant-Id", ACME)
    .send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

let adminTok = "";
let inspectorTok = ""; // scoped to plantA
let viewerTok = "";

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tenantId(ACME);
  plantA = await seedPlant(acmeId, "TESTPA");
  plantB = await seedPlant(acmeId, "TESTPB");

  await seedMember(acmeId, "insp-admin@acme.test", "admin", []);
  await seedMember(acmeId, "insp-scoped@acme.test", "inspector", [plantA]);
  await seedMember(acmeId, "insp-viewer@acme.test", "viewer", []);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token("insp-admin@acme.test");
  inspectorTok = await token("insp-scoped@acme.test");
  viewerTok = await token("insp-viewer@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>(
      "SELECT id FROM control.users WHERE email LIKE '%@acme.test' AND email LIKE 'insp-%'",
    )
  ).rows.map((r) => r.id);
  // Completing an inspection can spawn findings that FK to it — clear them
  // before the inspections they reference, or the delete violates the FK.
  await control.query(
    "DELETE FROM findings WHERE inspection_id IN (SELECT id FROM inspections WHERE title LIKE 'TEST %' OR code LIKE 'INS-%')",
  );
  await control.query("DELETE FROM inspections WHERE title LIKE 'TEST %' OR code LIKE 'INS-%'");
  await control.query("DELETE FROM inspection_templates WHERE name LIKE 'TEST %'");
  await control.query("DELETE FROM plants WHERE code LIKE 'TESTP%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

/** Creates a published template, returns its id. */
async function publishedTemplate(name: string): Promise<string> {
  const created = await authed("post", "/v1/inspection-templates", adminTok).send({ name, schema: SCHEMA });
  expect(created.status).toBe(201);
  const { id, lockVersion } = created.body as { id: string; lockVersion: number };
  const published = await authed("post", `/v1/inspection-templates/${id}/publish`, adminTok).send({
    version: lockVersion,
  });
  expect(published.status).toBe(200);
  expect(published.body.status).toBe("published");
  return id;
}

describe("templates", () => {
  it("creates a draft, then publishes it (optimistic concurrency)", async () => {
    const id = await publishedTemplate("TEST Weld Line");
    expect(id).toBeDefined();
  });

  it("rejects a stale publish with STALE_WRITE", async () => {
    const created = await authed("post", "/v1/inspection-templates", adminTok).send({
      name: "TEST Stale",
      schema: SCHEMA,
    });
    const { id } = created.body;
    const stale = await authed("post", `/v1/inspection-templates/${id}/publish`, adminTok).send({
      version: 999,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_WRITE");
  });

  it("forbids a non-manager from authoring templates (RBAC)", async () => {
    const res = await authed("post", "/v1/inspection-templates", viewerTok).send({
      name: "TEST Nope",
      schema: SCHEMA,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("inspection lifecycle", () => {
  it("schedule → start → complete, scored server-side", async () => {
    const templateId = await publishedTemplate("TEST Lifecycle");

    const created = await authed("post", "/v1/inspections", adminTok).send({
      title: "TEST full run",
      templateId,
      plantId: plantA,
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toMatch(/^INS-\d{4}-\d+$/);
    expect(created.body.status).toBe("scheduled");
    const { id } = created.body;

    const started = await authed("post", `/v1/inspections/${id}/start`, adminTok).send({
      version: created.body.lockVersion,
    });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("in_progress");

    const completed = await authed("post", `/v1/inspections/${id}/complete`, adminTok).send({
      responses: { guard: "pass" },
      version: started.body.lockVersion,
    });
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe("completed");
    expect(completed.body.score).toBe(100);
  });

  it("refuses to complete with invalid responses (server is authoritative)", async () => {
    const templateId = await publishedTemplate("TEST Invalid");
    const created = await authed("post", "/v1/inspections", adminTok).send({ title: "TEST inv", templateId });
    const started = await authed("post", `/v1/inspections/${created.body.id}/start`, adminTok).send({
      version: created.body.lockVersion,
    });
    // 'guard' is required and missing.
    const res = await authed("post", `/v1/inspections/${created.body.id}/complete`, adminTok).send({
      responses: { notes: "looks fine" },
      version: started.body.lockVersion,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an inspection built on a draft template (409)", async () => {
    const draft = await authed("post", "/v1/inspection-templates", adminTok).send({
      name: "TEST Draft",
      schema: SCHEMA,
    });
    const res = await authed("post", "/v1/inspections", adminTok).send({
      title: "TEST from draft",
      templateId: draft.body.id,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("rejects a start with a stale version (STALE_WRITE)", async () => {
    const templateId = await publishedTemplate("TEST Concurrency");
    const created = await authed("post", "/v1/inspections", adminTok).send({ title: "TEST cc", templateId });
    const res = await authed("post", `/v1/inspections/${created.body.id}/start`, adminTok).send({
      version: created.body.lockVersion + 5,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_WRITE");
  });
});

describe("idempotent create", () => {
  it("returns the same inspection for a repeated Idempotency-Key", async () => {
    const templateId = await publishedTemplate("TEST Idem");
    const key = randomUUID();
    const first = await authed("post", "/v1/inspections", adminTok)
      .set("Idempotency-Key", key)
      .send({ title: "TEST idem", templateId });
    const second = await authed("post", "/v1/inspections", adminTok)
      .set("Idempotency-Key", key)
      .send({ title: "TEST idem", templateId });
    expect(first.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.code).toBe(first.body.code);
  });
});

describe("cursor pagination", () => {
  it("walks pages via nextCursor without overlap", async () => {
    const templateId = await publishedTemplate("TEST Paging");
    for (let i = 0; i < 3; i++) {
      await authed("post", "/v1/inspections", adminTok).send({ title: `TEST page ${i}`, templateId });
    }
    const p1 = await authed("get", "/v1/inspections?limit=2", adminTok);
    expect(p1.status).toBe(200);
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.nextCursor).not.toBeNull();

    const p2 = await authed("get", `/v1/inspections?limit=2&cursor=${encodeURIComponent(p1.body.nextCursor)}`, adminTok);
    expect(p2.status).toBe(200);
    const ids1 = new Set((p1.body.items as { id: string }[]).map((r) => r.id));
    for (const row of p2.body.items as { id: string }[]) expect(ids1.has(row.id)).toBe(false);
  });
});

describe("plant scoping (rule 8, one level down)", () => {
  it("hides an out-of-scope inspection as a 404, and filters it from the list", async () => {
    const templateId = await publishedTemplate("TEST Scope");
    const inB = await authed("post", "/v1/inspections", adminTok).send({
      title: "TEST in plant B",
      templateId,
      plantId: plantB,
    });
    expect(inB.status).toBe(201);

    // The inspector is scoped to plant A only.
    const get = await authed("get", `/v1/inspections/${inB.body.id}`, inspectorTok);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe("NOT_FOUND");

    const list = await authed("get", "/v1/inspections?limit=100", inspectorTok);
    const ids = (list.body.items as { id: string }[]).map((r) => r.id);
    expect(ids).not.toContain(inB.body.id);
  });

  it("forbids a viewer from scheduling an inspection (RBAC)", async () => {
    const templateId = await publishedTemplate("TEST ViewerCreate");
    const res = await authed("post", "/v1/inspections", viewerTok).send({ title: "TEST nope", templateId });
    expect(res.status).toBe(403);
  });
});

describe("openapi", () => {
  it("serves a generated OpenAPI document", async () => {
    const res = await request(server()).get("/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.paths["/v1/inspections"]).toBeDefined();
    expect(res.body.paths["/v1/inspection-templates/{id}/publish"]).toBeDefined();
  });
});
