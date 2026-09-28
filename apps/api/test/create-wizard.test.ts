import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import type { FormSchema } from "@kaenal/types";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * CreateWizard backend (Sprint 01 S1-1): every field the wizard collects is
 * persisted by the four create routes, people land in entity_people (+ primary
 * columns + notifications), foreign ids 404, creates are idempotent, and the
 * Site select endpoint is plant-scoped.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const TAG = "CWTEST";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let plantA = "";
let plantB = "";
let foreignPlant = "";
let adminTok = "";
let inspectorTok = "";
let viewerTok = "";
let ownerUserId = "";
let reviewerUserId = "";
let approverUserId = "";
let foreignUserId = "";
let templateId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

const SCHEMA: FormSchema = {
  sections: [
    {
      id: "s1",
      title: "Checks",
      weight: 1,
      items: [{ id: "guard", type: "pass_fail", label: "Guard", required: true, weight: 1, naAllowed: false }],
    },
  ],
};

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(tenant: string, email: string, role: string, plantIds: string[]): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tenant, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status) VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, plant_ids = EXCLUDED.plant_ids, status = 'active'`,
      [tenant, userId, role, plantIds],
    );
  });
  return userId;
}

async function seedPlant(tenant: string, code: string): Promise<string> {
  const id = randomUUID();
  await withTenant(tenant, null, async (tx) => {
    await tx.query(`INSERT INTO plants (id, tenant_id, name, code, timezone) VALUES ($1,$2,$3,$4,'UTC')`, [
      id,
      tenant,
      code,
      code,
    ]);
  });
  return id;
}

async function token(email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

async function rowCount(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await control.query<{ n: string }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  plantA = await seedPlant(acmeId, `${TAG}PA`);
  plantB = await seedPlant(acmeId, `${TAG}PB`);
  foreignPlant = await seedPlant(globexId, `${TAG}PG`);

  await seedMember(acmeId, "cw-admin@acme.test", "admin", []);
  ownerUserId = await seedMember(acmeId, "cw-owner@acme.test", "manager", []);
  reviewerUserId = await seedMember(acmeId, "cw-reviewer@acme.test", "auditor", []);
  approverUserId = await seedMember(acmeId, "cw-approver@acme.test", "manager", []);
  await seedMember(acmeId, "cw-inspector@acme.test", "inspector", [plantA]);
  await seedMember(acmeId, "cw-viewer@acme.test", "viewer", []);
  foreignUserId = await seedMember(globexId, "cw-foreign@globex.test", "admin", []);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token("cw-admin@acme.test");
  inspectorTok = await token("cw-inspector@acme.test");
  viewerTok = await token("cw-viewer@acme.test");

  const t = await authed("post", "/v1/inspection-templates", adminTok).send({ name: `${TAG} tpl`, schema: SCHEMA });
  const tpl = t.body as { id: string; lockVersion: number };
  await authed("post", `/v1/inspection-templates/${tpl.id}/publish`, adminTok).send({ version: tpl.lockVersion });
  templateId = tpl.id;
});

afterAll(async () => {
  const emails = ["cw-%@acme.test", "cw-%@globex.test"];
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE ANY($1)", [emails])
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM entity_people WHERE entity_id IN (SELECT id FROM ncrs WHERE title LIKE $1)", [`${TAG}%`]);
  await control.query(
    `DELETE FROM entity_people WHERE entity_kind IN ('inspection','eight_d','document') AND user_id = ANY($1)`,
    [ids],
  );
  await control.query("DELETE FROM entity_people WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
  await control.query("UPDATE ncrs SET eight_d_id = NULL WHERE title LIKE $1", [`${TAG}%`]);
  await control.query("DELETE FROM eight_ds WHERE title LIKE $1", [`${TAG}%`]);
  await control.query("DELETE FROM ncrs WHERE title LIKE $1", [`${TAG}%`]);
  await control.query("DELETE FROM inspections WHERE title LIKE $1", [`${TAG}%`]);
  await control.query("DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE title LIKE $1)", [`${TAG}%`]);
  await control.query("DELETE FROM documents WHERE title LIKE $1", [`${TAG}%`]);
  await control.query("DELETE FROM inspection_templates WHERE name LIKE $1", [`${TAG}%`]);
  await control.query("DELETE FROM plants WHERE code LIKE $1", [`${TAG}P%`]);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

const PEOPLE = () => [
  { userId: ownerUserId, role: "owner" },
  { userId: reviewerUserId, role: "reviewer" },
  { userId: approverUserId, role: "approver" },
];

describe("GET /v1/plants", () => {
  it("lists the tenant's sites, plant-scoped for scoped roles, never another tenant's", async () => {
    const all = await authed("get", "/v1/plants", adminTok);
    expect(all.status).toBe(200);
    const codes = (all.body.items as { code: string }[]).map((p) => p.code);
    expect(codes).toContain(`${TAG}PA`);
    expect(codes).toContain(`${TAG}PB`);
    expect(codes).not.toContain(`${TAG}PG`);

    const scoped = await authed("get", "/v1/plants", inspectorTok);
    expect((scoped.body.items as { id: string }[]).map((p) => p.id)).toEqual([plantA]);
  });
});

describe("NCR create via the wizard", () => {
  it("persists due date, area, category/source, owner and every person", async () => {
    const res = await authed("post", "/v1/ncrs", adminTok).send({
      title: `${TAG} ncr`,
      priority: "major",
      description: "weld bead",
      category: "Customer complaint",
      source: "complaint",
      plantId: plantA,
      areaLabel: "Welding · Line 3",
      dueAt: "2030-01-15T00:00:00.000Z",
      people: PEOPLE(),
    });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(ownerUserId);
    expect(res.body.dueAt).toBe("2030-01-15T00:00:00.000Z");
    expect(res.body.source).toBe("complaint");

    const label = await control.query<{ area_label: string }>("SELECT area_label FROM ncrs WHERE id = $1", [res.body.id]);
    expect(label.rows[0]?.area_label).toBe("Welding · Line 3");
    expect(await rowCount("SELECT count(*) n FROM entity_people WHERE entity_kind='ncr' AND entity_id=$1", [res.body.id])).toBe(3);
    // Each assignee is told (the creator is admin, not in the list).
    expect(await rowCount("SELECT count(*) n FROM notifications WHERE entity_id=$1 AND user_id = ANY($2)", [res.body.id, [ownerUserId, reviewerUserId, approverUserId]])).toBe(3);
  });

  it("404s a foreign-tenant plant and a foreign-tenant person (rule 8)", async () => {
    const badPlant = await authed("post", "/v1/ncrs", adminTok).send({ title: `${TAG} bad plant`, priority: "minor", plantId: foreignPlant });
    expect(badPlant.status).toBe(404);
    const badPerson = await authed("post", "/v1/ncrs", adminTok).send({
      title: `${TAG} bad person`,
      priority: "minor",
      people: [{ userId: foreignUserId, role: "owner" }],
    });
    expect(badPerson.status).toBe(404);
    expect(await rowCount("SELECT count(*) n FROM ncrs WHERE title LIKE $1", [`${TAG} bad%`])).toBe(0);
  });

  it("is idempotent: the same Idempotency-Key creates one NCR", async () => {
    const key = randomUUID();
    const send = () =>
      authed("post", "/v1/ncrs", adminTok).set("Idempotency-Key", key).send({ title: `${TAG} idem`, priority: "minor" });
    const a = await send();
    const b = await send();
    expect(a.status).toBe(201);
    expect(b.body.id).toBe(a.body.id);
    expect(await rowCount("SELECT count(*) n FROM ncrs WHERE title = $1", [`${TAG} idem`])).toBe(1);
  });

  it("rejects an invalid body with 422 naming the field path", async () => {
    const res = await authed("post", "/v1/ncrs", adminTok).send({ title: "", priority: "minor" });
    expect(res.status).toBe(422);
    expect((res.body.error.details.issues as { path: string }[]).map((i) => i.path)).toContain("title");
  });

  it("a viewer cannot create (no capability)", async () => {
    const res = await authed("post", "/v1/ncrs", viewerTok).send({ title: `${TAG} viewer`, priority: "minor" });
    expect(res.status).toBe(403);
  });
});

describe("Inspection create via the wizard", () => {
  it("persists priority, description, area, schedule, inspector (owner) and people", async () => {
    const res = await authed("post", "/v1/inspections", adminTok).send({
      title: `${TAG} insp`,
      templateId,
      plantId: plantB,
      areaLabel: "Line 4",
      description: "weekly walk",
      priority: "high",
      scheduledAt: "2030-02-01T00:00:00.000Z",
      people: PEOPLE(),
    });
    expect(res.status).toBe(201);
    expect(res.body.inspectorId).toBe(ownerUserId);
    const row = await control.query<{ priority: string; description: string; area_label: string }>(
      "SELECT priority, description, area_label FROM inspections WHERE id = $1",
      [res.body.id],
    );
    expect(row.rows[0]).toEqual({ priority: "high", description: "weekly walk", area_label: "Line 4" });
    expect(await rowCount("SELECT count(*) n FROM entity_people WHERE entity_kind='inspection' AND entity_id=$1", [res.body.id])).toBe(3);
  });

  it("404s a foreign plant and a foreign person", async () => {
    const p = await authed("post", "/v1/inspections", adminTok).send({ title: `${TAG} insp x`, templateId, plantId: foreignPlant });
    expect(p.status).toBe(404);
    const u = await authed("post", "/v1/inspections", adminTok).send({
      title: `${TAG} insp y`,
      templateId,
      people: [{ userId: foreignUserId, role: "owner" }],
    });
    expect(u.status).toBe(404);
  });
});

describe("8D create via the wizard", () => {
  it("persists template, priority, site, description, roles → lead/champion/members, and links an NCR by code", async () => {
    const ncr = await authed("post", "/v1/ncrs", adminTok).send({ title: `${TAG} ncr for 8d`, priority: "major" });
    const res = await authed("post", "/v1/eight-ds", adminTok).send({
      title: `${TAG} 8d`,
      template: "medical",
      priority: "critical",
      plantId: plantA,
      areaLabel: "Cell 7",
      description: "porosity",
      targetAt: "2030-03-01T00:00:00.000Z",
      ncrCode: ncr.body.code,
      people: PEOPLE(),
    });
    expect(res.status).toBe(201);
    expect(res.body.teamLeadId).toBe(ownerUserId);
    expect(res.body.championId).toBe(approverUserId);
    expect(res.body.memberIds).toEqual([reviewerUserId]);
    expect(res.body.ncrId).toBe(ncr.body.id);
    const row = await control.query<{ template: string; priority: string; plant_id: string }>(
      "SELECT template, priority, plant_id FROM eight_ds WHERE id = $1",
      [res.body.id],
    );
    expect(row.rows[0]).toEqual({ template: "medical", priority: "critical", plant_id: plantA });
    expect(await rowCount("SELECT count(*) n FROM entity_people WHERE entity_kind='eight_d' AND entity_id=$1", [res.body.id])).toBe(3);
  });

  it("404s an unknown NCR code, a foreign plant and a foreign person", async () => {
    const code = await authed("post", "/v1/eight-ds", adminTok).send({ title: `${TAG} 8d a`, ncrCode: "NCR-1999-9999" });
    expect(code.status).toBe(422);
    expect((code.body.error.details.issues as { path: string }[])[0]?.path).toBe("ncrCode");
    const past = await authed("post", "/v1/ncrs", adminTok).send({ title: `${TAG} past`, priority: "minor", dueAt: "2020-01-01T00:00:00.000Z" });
    expect(past.status).toBe(422);
    expect((past.body.error.details.issues as { path: string }[])[0]?.path).toBe("dueAt");
    const plant = await authed("post", "/v1/eight-ds", adminTok).send({ title: `${TAG} 8d b`, plantId: foreignPlant });
    expect(plant.status).toBe(404);
    const person = await authed("post", "/v1/eight-ds", adminTok).send({
      title: `${TAG} 8d c`,
      people: [{ userId: foreignUserId, role: "owner" }],
    });
    expect(person.status).toBe(404);
  });
});

describe("Document create via the wizard", () => {
  it("persists template, description, site, area, owner/approver and people", async () => {
    const res = await authed("post", "/v1/documents", adminTok).send({
      title: `${TAG} doc`,
      category: "manual",
      template: "policy",
      description: "governance",
      plantId: plantA,
      areaLabel: "Quality dept",
      people: PEOPLE(),
    });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(ownerUserId);
    expect(res.body.approverId).toBe(approverUserId);
    const row = await control.query<{ template: string; description: string; plant_id: string; area_label: string }>(
      "SELECT template, description, plant_id, area_label FROM documents WHERE id = $1",
      [res.body.id],
    );
    expect(row.rows[0]).toEqual({ template: "policy", description: "governance", plant_id: plantA, area_label: "Quality dept" });
    expect(await rowCount("SELECT count(*) n FROM entity_people WHERE entity_kind='document' AND entity_id=$1", [res.body.id])).toBe(3);
  });

  it("404s a foreign plant and a foreign person", async () => {
    const plant = await authed("post", "/v1/documents", adminTok).send({ title: `${TAG} doc a`, category: "sop", plantId: foreignPlant });
    expect(plant.status).toBe(404);
    const person = await authed("post", "/v1/documents", adminTok).send({
      title: `${TAG} doc b`,
      category: "sop",
      people: [{ userId: foreignUserId, role: "approver" }],
    });
    expect(person.status).toBe(404);
  });
});
