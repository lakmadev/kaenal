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
 * PPAP slice (FEATURES §11.2, P09).
 *
 * Covers the vertical: create (auto code + 18 seeded elements), element edits
 * under optimistic concurrency, the approvability guard (approve is refused
 * while any non-N/A element is unapproved, then allowed once complete),
 * capability gating (a viewer cannot manage), a cross-tenant 404 (rule 8), and
 * the audit trail.
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
let supplierId = "";

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
async function createPpap(over: Body = {}, bearer = managerTok): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await authed("post", "/v1/ppap", bearer).send({
    supplierId,
    partNumber: "FIXT-R-44",
    level: 3,
    programName: "FIXT program",
    customer: "BMW Group",
    submittedDate: "2026-04-10",
    dueDate: "2026-05-04",
    ...over,
  });
  return { status: res.status, body: res.body as Record<string, unknown> };
}

/** Approve all 18 elements in turn, threading the bumped lock version. Returns
 *  the submission's final lock version. */
async function approveAllElements(id: string, startVersion: number): Promise<number> {
  let version = startVersion;
  for (let no = 1; no <= 18; no++) {
    const res = await authed("post", `/v1/ppap/${id}/elements/${no}`, managerTok).send({ status: "approved", version });
    if (res.status !== 200) throw new Error(`element ${no}: ${res.status} ${JSON.stringify(res.body)}`);
    version = res.body.lockVersion as number;
  }
  return version;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  await seedMember(acmeId, "ppap-mgr@acme.test", "manager");
  await seedMember(acmeId, "ppap-view@acme.test", "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  managerTok = await token(ACME, "ppap-mgr@acme.test");
  viewerTok = await token(ACME, "ppap-view@acme.test");

  const sup = await authed("post", "/v1/suppliers", managerTok).send({ name: "FIXT-ppap Supplier", riskTier: "medium" });
  supplierId = sup.body.id as string;
});

afterAll(async () => {
  await control.query("DELETE FROM ppap_submissions WHERE part_number LIKE 'FIXT-%'");
  await control.query("DELETE FROM suppliers WHERE name LIKE 'FIXT-ppap%'");
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'ppap-%@acme.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("PPAP submissions", () => {
  it("creates a submission with an auto code and 18 seeded elements", async () => {
    const { status, body } = await createPpap();
    expect(status).toBe(201);
    expect(body["code"]).toMatch(/^PPAP-\d{4}-\d{4}$/);
    expect(body["status"]).toBe("pending");
    expect(body["supplierName"]).toBe("FIXT-ppap Supplier");
    expect(body["daysOpen"]).toBeGreaterThanOrEqual(0);
    const elements = body["elements"] as Array<{ id: number; status: string; name: string }>;
    expect(elements).toHaveLength(18);
    expect(elements.every((e) => e.status === "pending")).toBe(true);
    expect(elements[17]?.name).toContain("PSW");
    const completeness = body["completeness"] as { approvable: boolean };
    expect(completeness.approvable).toBe(false);
  });

  it("fetches by id and lists with a supplier filter", async () => {
    const created = await createPpap({ partNumber: "FIXT-list" });
    const id = created.body["id"] as string;

    const got = await authed("get", `/v1/ppap/${id}`, viewerTok);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(id);

    const listed = await authed("get", `/v1/ppap?supplierId=${supplierId}`, viewerTok);
    expect(listed.status).toBe(200);
    expect((listed.body.items as Array<{ id: string }>).some((p) => p.id === id)).toBe(true);
  });

  it("refuses a create from a viewer (ppap:manage)", async () => {
    const res = await createPpap({ partNumber: "FIXT-denied" }, viewerTok);
    expect(res.status).toBe(403);
  });

  it("edits an element under optimistic concurrency and rejects a stale version", async () => {
    const created = await createPpap({ partNumber: "FIXT-elem" });
    const id = created.body["id"] as string;

    const ok = await authed("post", `/v1/ppap/${id}/elements/6`, managerTok).send({
      status: "changes_requested",
      comment: "Severity on FM-3 should be 8.",
      version: 0,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.lockVersion).toBe(1);
    const el6 = (ok.body.elements as Array<{ id: number; status: string; comment: string | null }>).find((e) => e.id === 6);
    expect(el6?.status).toBe("changes_requested");
    expect(el6?.comment).toContain("FM-3");

    const stale = await authed("post", `/v1/ppap/${id}/elements/7`, managerTok).send({ status: "approved", version: 0 });
    expect(stale.status).toBe(409);
  });

  it("blocks approval while incomplete, then approves once every element is approved", async () => {
    const created = await createPpap({ partNumber: "FIXT-approve" });
    const id = created.body["id"] as string;

    const blocked = await authed("post", `/v1/ppap/${id}/decision`, managerTok).send({ decision: "approve", version: 0 });
    expect(blocked.status).toBe(422);

    const finalVersion = await approveAllElements(id, 0);
    const approved = await authed("post", `/v1/ppap/${id}/decision`, managerTok).send({ decision: "approve", version: finalVersion });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");
    expect(approved.body.approvedDate).not.toBeNull();
    expect((approved.body.completeness as { approvable: boolean }).approvable).toBe(true);
  });

  it("rejects a submission without the completeness guard", async () => {
    const created = await createPpap({ partNumber: "FIXT-reject" });
    const id = created.body["id"] as string;
    const rejected = await authed("post", `/v1/ppap/${id}/decision`, managerTok).send({
      decision: "reject",
      reason: "Supplier withdrew the part.",
      version: 0,
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("rejected");
  });

  it("returns 404 for an unknown id and for another tenant's submission (rule 8)", async () => {
    const unknown = await authed("get", `/v1/ppap/${randomUUID()}`, managerTok);
    expect(unknown.status).toBe(404);

    // A submission that exists only in globex must be invisible to an acme member.
    const foreignSupplier = randomUUID();
    const foreignPpap = randomUUID();
    await withTenant(globexId, null, async (tx) => {
      await tx.query(
        `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES ($1,$2,'FIXT-foreign','SUP-XP-0001','active')`,
        [foreignSupplier, globexId],
      );
      await tx.query(
        `INSERT INTO ppap_submissions (id, tenant_id, supplier_id, part_number, level, status)
         VALUES ($1,$2,$3,'FIXT-foreign-part',3,'pending')`,
        [foreignPpap, globexId, foreignSupplier],
      );
    });
    const foreign = await authed("get", `/v1/ppap/${foreignPpap}`, managerTok);
    expect(foreign.status).toBe(404);
    await control.query("DELETE FROM ppap_submissions WHERE id = $1", [foreignPpap]);
    await control.query("DELETE FROM suppliers WHERE id = $1", [foreignSupplier]);
  });

  it("writes 'created' and 'status_changed' audit events", async () => {
    const created = await createPpap({ partNumber: "FIXT-audit" });
    const id = created.body["id"] as string;
    await authed("post", `/v1/ppap/${id}/decision`, managerTok).send({ decision: "reject", version: 0 });

    const { rows } = await control.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE entity_kind = 'ppap_submission' AND entity_id = $1",
      [id],
    );
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("created");
    expect(actions).toContain("status_changed");
  });
});
