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

function authed(method: "get" | "post" | "put", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

let adminTok = "";
let inspectorTok = ""; // scoped to plantA
let viewerTok = "";
let adminUserId = "";
let inspectorUserId = "";

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tenantId(ACME);
  plantA = await seedPlant(acmeId, "TESTPA");
  plantB = await seedPlant(acmeId, "TESTPB");

  adminUserId = await seedMember(acmeId, "insp-admin@acme.test", "admin", []);
  inspectorUserId = await seedMember(acmeId, "insp-scoped@acme.test", "inspector", [plantA]);
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
    await control.query("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
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

  it("edits a DRAFT in place (no duplicate) and refuses to edit a published one", async () => {
    const created = await authed("post", "/v1/inspection-templates", adminTok).send({ name: "TEST Draft Edit", schema: SCHEMA });
    const { id, lockVersion } = created.body as { id: string; lockVersion: number };

    const renamed = { ...SCHEMA, sections: [{ ...SCHEMA.sections[0], title: "Renamed section" }] };
    const upd = await authed("put", `/v1/inspection-templates/${id}`, adminTok).send({
      name: "TEST Draft Edit v2",
      schema: renamed,
      version: lockVersion,
    });
    expect(upd.status).toBe(200);
    expect(upd.body.id).toBe(id); // SAME row — not a duplicate
    expect(upd.body.name).toBe("TEST Draft Edit v2");

    // Publish it, then editing the published one in place is a CONFLICT.
    const pub = await authed("post", `/v1/inspection-templates/${id}/publish`, adminTok).send({ version: upd.body.lockVersion });
    expect(pub.status).toBe(200);
    const blocked = await authed("put", `/v1/inspection-templates/${id}`, adminTok).send({
      name: "TEST Draft Edit v3",
      schema: SCHEMA,
      version: pub.body.lockVersion,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("CONFLICT");
  });

  it("versions a published template and supersedes it via archive", async () => {
    const id = await publishedTemplate("TEST Versioned");
    const src = await authed("get", `/v1/inspection-templates/${id}`, adminTok);
    expect(src.body.version).toBe(1);

    // New version (same lineage/name) → version 2, its own draft row.
    const next = await authed("post", `/v1/inspection-templates/${id}/version`, adminTok).send({ name: "TEST Versioned", schema: SCHEMA });
    expect(next.status).toBe(201);
    expect(next.body.id).not.toBe(id);
    expect(next.body.version).toBe(2);
    expect(next.body.status).toBe("draft");

    // Publish the new version, archive the old one — the old drops out of the list.
    await authed("post", `/v1/inspection-templates/${next.body.id}/publish`, adminTok).send({ version: next.body.lockVersion });
    const arch = await authed("post", `/v1/inspection-templates/${id}/archive`, adminTok).send({ version: src.body.lockVersion });
    expect(arch.status).toBe(200);
    expect(arch.body.status).toBe("archived");
    // Archive is idempotent.
    const again = await authed("post", `/v1/inspection-templates/${id}/archive`, adminTok).send({ version: arch.body.lockVersion });
    expect(again.status).toBe(200);
    expect(again.body.status).toBe("archived");
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

describe("inspector assignment (P25)", () => {
  it("assigns, reassigns, and clears the inspector without moving status — each audited", async () => {
    const templateId = await publishedTemplate("TEST Assign");
    const created = await authed("post", "/v1/inspections", adminTok).send({ title: "TEST assignable", templateId });
    expect(created.status).toBe(201);
    let ins = created.body as { id: string; status: string; inspectorId: string | null; lockVersion: number };
    expect(ins.status).toBe("scheduled");

    const assigned = await authed("post", `/v1/inspections/${ins.id}/assign`, adminTok).send({
      version: ins.lockVersion,
      inspectorId: inspectorUserId,
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.inspectorId).toBe(inspectorUserId);
    expect(assigned.body.status).toBe("scheduled"); // orthogonal to the machine
    ins = assigned.body as typeof ins;

    const { rows } = await control.query<{ before: { inspectorId?: string | null }; after: { inspectorId?: string | null } }>(
      `SELECT before, after FROM audit_events
        WHERE entity_kind = 'inspection' AND entity_id = $1 AND action = 'assigned'
        ORDER BY created_at DESC LIMIT 1`,
      [ins.id],
    );
    expect(rows[0]?.before).toEqual({ inspectorId: null });
    expect(rows[0]?.after).toEqual({ inspectorId: inspectorUserId });

    const reassigned = await authed("post", `/v1/inspections/${ins.id}/assign`, adminTok).send({
      version: ins.lockVersion,
      inspectorId: adminUserId,
    });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.inspectorId).toBe(adminUserId);
    ins = reassigned.body as typeof ins;

    const cleared = await authed("post", `/v1/inspections/${ins.id}/assign`, adminTok).send({
      version: ins.lockVersion,
      inspectorId: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.inspectorId).toBeNull();
  });

  it("rejects a non-member, a stale version, and a viewer", async () => {
    const templateId = await publishedTemplate("TEST AssignGuard");
    const created = await authed("post", "/v1/inspections", adminTok).send({ title: "TEST guard", templateId });
    const ins = created.body as { id: string; lockVersion: number };

    const nonMember = await authed("post", `/v1/inspections/${ins.id}/assign`, adminTok).send({
      version: ins.lockVersion,
      inspectorId: randomUUID(),
    });
    expect(nonMember.status).toBe(422);
    expect(nonMember.body.error.code).toBe("VALIDATION_FAILED");

    const stale = await authed("post", `/v1/inspections/${ins.id}/assign`, adminTok).send({
      version: ins.lockVersion + 5,
      inspectorId: inspectorUserId,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_WRITE");

    const viewer = await authed("post", `/v1/inspections/${ins.id}/assign`, viewerTok).send({
      version: ins.lockVersion,
      inspectorId: inspectorUserId,
    });
    expect(viewer.status).toBe(403);
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
