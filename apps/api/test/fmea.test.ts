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
 * FMEA workbench slice (`/v1/fmeas`, tables 0030). Pins: FMEA + failure-mode CRUD
 * under fmea:manage with optimistic concurrency; derived RPN + Action Priority
 * (S×O×D via `@kaenal/core`) that re-score on a rating edit; fmea:view lets a
 * viewer read but not write; deleting an FMEA cascades to its items; and no
 * tenant sees another's FMEAs (RLS).
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
  await control.query("DELETE FROM fmea_items WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
  await control.query("DELETE FROM fmeas WHERE tenant_id = ANY($1)", [[acmeId, globexId]]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  await seedMember(acmeId, "fmea-mgr@acme.test", "manager");
  await seedMember(acmeId, "fmea-viewer@acme.test", "viewer");
  await seedMember(globexId, "fmea-mgr@globex.test", "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(ACME, "fmea-mgr@acme.test");
  viewerTok = await token(ACME, "fmea-viewer@acme.test");
  globexMgrTok = await token(GLOBEX, "fmea-mgr@globex.test");
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'fmea-%@%.test'")
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

async function newFmea(): Promise<string> {
  const res = await authed("post", "/v1/fmeas", ACME, mgrTok).send({
    type: "pfmea",
    partCode: "VBR-3041",
    partName: "Volvo wheel hub bearing assembly",
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe("FMEA CRUD", () => {
  it("creates, lists with item count, updates (optimistic), and deletes (cascades items)", async () => {
    const id = await newFmea();
    const listed = await authed("get", "/v1/fmeas", ACME, viewerTok);
    expect((listed.body.items as { id: string }[]).some((f) => f.id === id)).toBe(true);

    // Add an item so itemCount reflects it.
    const item = await authed("post", `/v1/fmeas/${id}/items`, ACME, mgrTok).send({
      failureMode: "Insufficient penetration",
      severity: 9,
      occurrence: 4,
      detection: 3,
    });
    expect(item.status).toBe(201);
    const got = await authed("get", `/v1/fmeas/${id}`, ACME, mgrTok);
    expect(got.body.itemCount).toBe(1);

    // Optimistic header edit.
    const upd = await authed("put", `/v1/fmeas/${id}`, ACME, mgrTok).send({
      type: "pfmea",
      partCode: "VBR-3041",
      partName: "Volvo wheel hub bearing assembly (Rev 2)",
      revision: 2,
      version: 0,
    });
    expect(upd.status).toBe(200);
    expect(upd.body.revision).toBe(2);
    expect(upd.body.lockVersion).toBe(1);

    const stale = await authed("put", `/v1/fmeas/${id}`, ACME, mgrTok).send({
      type: "pfmea",
      partCode: "VBR-3041",
      partName: "x",
      revision: 3,
      version: 0,
    });
    expect(stale.status).toBe(409);

    // Delete cascades: the item disappears with the FMEA.
    expect((await authed("post", `/v1/fmeas/${id}/delete`, ACME, mgrTok).send({})).status).toBe(200);
    const after = await authed("get", "/v1/fmeas", ACME, mgrTok);
    expect((after.body.items as { id: string }[]).some((f) => f.id === id)).toBe(false);
    const items = await authed("get", `/v1/fmeas/${id}/items`, ACME, mgrTok);
    expect(items.status).toBe(404); // FMEA is gone
  });
});

describe("failure-mode scoring", () => {
  it("derives RPN and Action Priority, and re-scores when a rating changes", async () => {
    const id = await newFmea();
    const created = await authed("post", `/v1/fmeas/${id}/items`, ACME, mgrTok).send({
      processFunction: "Weld bracket to chassis",
      failureMode: "Insufficient penetration",
      effect: "Joint fails in field",
      severity: 9,
      occurrence: 4,
      detection: 3,
    });
    expect(created.status).toBe(201);
    expect(created.body.seq).toBe(1);
    expect(created.body.rpn).toBe(108); // 9 × 4 × 3
    expect(created.body.actionPriority).toBe("H"); // sev 9, occ ≥ 2

    // Drop occurrence to 1 → no longer auto-High, but still Medium (sev 9).
    const itemId = created.body.id as string;
    const upd = await authed("put", `/v1/fmeas/${id}/items/${itemId}`, ACME, mgrTok).send({
      processFunction: "Weld bracket to chassis",
      failureMode: "Insufficient penetration",
      effect: "Joint fails in field",
      severity: 9,
      occurrence: 1,
      detection: 3,
      version: 0,
    });
    expect(upd.status).toBe(200);
    expect(upd.body.rpn).toBe(27);
    expect(upd.body.actionPriority).toBe("M");
    expect(upd.body.lockVersion).toBe(1);

    // Stale item write → 409.
    const stale = await authed("put", `/v1/fmeas/${id}/items/${itemId}`, ACME, mgrTok).send({
      failureMode: "x",
      severity: 1,
      occurrence: 1,
      detection: 1,
      version: 0,
    });
    expect(stale.status).toBe(409);

    // Second item then delete the first → ordering + soft delete.
    await authed("post", `/v1/fmeas/${id}/items`, ACME, mgrTok).send({ failureMode: "Porosity", severity: 8, occurrence: 3, detection: 4 });
    expect((await authed("post", `/v1/fmeas/${id}/items/${itemId}/delete`, ACME, mgrTok).send({})).status).toBe(200);
    const list = await authed("get", `/v1/fmeas/${id}/items`, ACME, mgrTok);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].failureMode).toBe("Porosity");

    await authed("post", `/v1/fmeas/${id}/delete`, ACME, mgrTok).send({});
  });

  it("rejects an out-of-range rating with 422", async () => {
    const id = await newFmea();
    const bad = await authed("post", `/v1/fmeas/${id}/items`, ACME, mgrTok).send({ failureMode: "x", severity: 11 });
    expect(bad.status).toBe(422);
    await authed("post", `/v1/fmeas/${id}/delete`, ACME, mgrTok).send({});
  });
});

describe("FMEA RBAC + tenancy", () => {
  it("a viewer can read but not write (fmea:view without fmea:manage)", async () => {
    const list = await authed("get", "/v1/fmeas", ACME, viewerTok);
    expect(list.status).toBe(200);
    const write = await authed("post", "/v1/fmeas", ACME, viewerTok).send({ partCode: "NO", partName: "no" });
    expect(write.status).toBe(403);
  });

  it("does not leak one tenant's FMEAs into another, and rejects cross-tenant item access (RLS)", async () => {
    const id = await newFmea();
    const other = await authed("get", "/v1/fmeas", GLOBEX, globexMgrTok);
    expect(other.status).toBe(200);
    expect((other.body.items as { id: string }[]).some((f) => f.id === id)).toBe(false);

    // Globex cannot see acme's FMEA by id (foreign id → 404, not 403).
    expect((await authed("get", `/v1/fmeas/${id}`, GLOBEX, globexMgrTok)).status).toBe(404);
    expect((await authed("post", `/v1/fmeas/${id}/items`, GLOBEX, globexMgrTok).send({ failureMode: "x" })).status).toBe(404);

    await authed("post", `/v1/fmeas/${id}/delete`, ACME, mgrTok).send({});
  });
});
