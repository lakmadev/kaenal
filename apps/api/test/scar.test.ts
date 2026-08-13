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
 * SCAR slice (FEATURES §11.3, P10).
 *
 * Covers the vertical: create (auto code + chargeback raised into pending), the
 * forward-only 8D advance (D1→…→D8, blocked past D8) under optimistic
 * concurrency, supplier acknowledgement, the chargeback ratchet (illegal jumps
 * refused), the overdue filter, capability gating (a viewer cannot manage), a
 * cross-tenant 404 (rule 8), and the audit trail.
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
let mgrUserId = "";
let viewerUserId = "";

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
async function createScar(over: Body = {}, bearer = managerTok): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await authed("post", "/v1/scars", bearer).send({
    supplierId,
    title: "FIXT-Porosity on BHS-12 housings",
    severity: "major",
    raisedDate: "2026-04-08",
    dueDate: "2026-04-29",
    supplierResponseDue: "2026-04-22",
    affectedLots: 14,
    ...over,
  });
  return { status: res.status, body: res.body as Record<string, unknown> };
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  mgrUserId = await seedMember(acmeId, "scar-mgr@acme.test", "manager");
  viewerUserId = await seedMember(acmeId, "scar-view@acme.test", "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  managerTok = await token(ACME, "scar-mgr@acme.test");
  viewerTok = await token(ACME, "scar-view@acme.test");

  const sup = await authed("post", "/v1/suppliers", managerTok).send({ name: "FIXT-scar Supplier", riskTier: "medium" });
  supplierId = sup.body.id as string;
});

afterAll(async () => {
  await control.query("DELETE FROM scars WHERE title LIKE 'FIXT-%'");
  await control.query("DELETE FROM suppliers WHERE name LIKE 'FIXT-scar%'");
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'scar-%@acme.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("SCAR & chargebacks", () => {
  it("raises a SCAR with an auto code, D1 draft, and a pending chargeback", async () => {
    const { status, body } = await createScar({ chargebackAmount: 22_400 });
    expect(status).toBe(201);
    expect(body["code"]).toMatch(/^SCAR-\d{4}-\d{4}$/);
    expect(body["status"]).toBe("draft");
    expect(body["currentD"]).toBe(1);
    expect(body["supplierName"]).toBe("FIXT-scar Supplier");
    expect(body["daysOpen"]).toBeGreaterThanOrEqual(0);
    const chargeback = body["chargeback"] as { amount: number; currency: string; status: string };
    expect(chargeback.amount).toBe(22_400);
    expect(chargeback.currency).toBe("USD");
    expect(chargeback.status).toBe("pending");
  });

  it("fetches by id and lists with a supplier filter (viewer can read)", async () => {
    const created = await createScar({ title: "FIXT-list" });
    const id = created.body["id"] as string;

    const got = await authed("get", `/v1/scars/${id}`, viewerTok);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(id);

    const listed = await authed("get", `/v1/scars?supplierId=${supplierId}`, viewerTok);
    expect(listed.status).toBe(200);
    expect((listed.body.items as Array<{ id: string }>).some((s) => s.id === id)).toBe(true);
  });

  it("refuses a create from a viewer (scar:manage)", async () => {
    const res = await createScar({ title: "FIXT-denied" }, viewerTok);
    expect(res.status).toBe(403);
  });

  it("advances the 8D forward, opens the SCAR, and is optimistic (stale → 409)", async () => {
    const created = await createScar({ title: "FIXT-advance" });
    const id = created.body["id"] as string;

    const step2 = await authed("post", `/v1/scars/${id}/advance`, managerTok).send({ version: 0 });
    expect(step2.status).toBe(200);
    expect(step2.body.currentD).toBe(2);
    expect(step2.body.status).toBe("open"); // advancing off draft opens it
    expect(step2.body.lockVersion).toBe(1);

    const stale = await authed("post", `/v1/scars/${id}/advance`, managerTok).send({ version: 0 });
    expect(stale.status).toBe(409);
  });

  it("cannot advance past D8", async () => {
    const created = await createScar({ title: "FIXT-d8" });
    const id = created.body["id"] as string;
    let version = 0;
    for (let d = 1; d < 8; d++) {
      const res = await authed("post", `/v1/scars/${id}/advance`, managerTok).send({ version });
      expect(res.status).toBe(200);
      expect(res.body.currentD).toBe(d + 1);
      version = res.body.lockVersion as number;
    }
    const beyond = await authed("post", `/v1/scars/${id}/advance`, managerTok).send({ version });
    expect(beyond.status).toBe(422);
  });

  it("records the supplier's acknowledgement", async () => {
    const created = await createScar({ title: "FIXT-ack" });
    const id = created.body["id"] as string;
    const ack = await authed("post", `/v1/scars/${id}/acknowledge`, managerTok).send({ ackDate: "2026-04-09", version: 0 });
    expect(ack.status).toBe(200);
    expect(ack.body.supplierAcknowledged).toBe(true);
    expect(ack.body.ackDate).toBe("2026-04-09");
  });

  it("transitions the chargeback forward but refuses an illegal jump", async () => {
    const created = await createScar({ title: "FIXT-cb" });
    const id = created.body["id"] as string;

    // No chargeback yet → raise into pending.
    const pending = await authed("post", `/v1/scars/${id}/chargeback`, managerTok).send({
      status: "pending",
      amount: 12_800,
      version: 0,
    });
    expect(pending.status).toBe(200);
    expect((pending.body.chargeback as { status: string }).status).toBe("pending");

    // pending → closed is illegal (must go via debit_issued).
    const illegal = await authed("post", `/v1/scars/${id}/chargeback`, managerTok).send({
      status: "closed",
      version: pending.body.lockVersion,
    });
    expect(illegal.status).toBe(422);

    // pending → debit_issued → closed is legal.
    const debit = await authed("post", `/v1/scars/${id}/chargeback`, managerTok).send({
      status: "debit_issued",
      version: pending.body.lockVersion,
    });
    expect(debit.status).toBe(200);
    const closed = await authed("post", `/v1/scars/${id}/chargeback`, managerTok).send({
      status: "closed",
      version: debit.body.lockVersion,
    });
    expect(closed.status).toBe(200);
    expect((closed.body.chargeback as { status: string }).status).toBe("closed");
  });

  it("filters overdue SCARs by their derived due dates", async () => {
    const overdue = await createScar({
      title: "FIXT-overdue",
      status: "open",
      raisedDate: "2026-01-01",
      supplierResponseDue: "2026-01-15",
      dueDate: "2026-01-31",
    });
    expect(overdue.body["overdue"]).toBe(true);
    const overdueId = overdue.body["id"] as string;

    const listed = await authed("get", `/v1/scars?overdue=true&supplierId=${supplierId}`, managerTok);
    expect(listed.status).toBe(200);
    const ids = (listed.body.items as Array<{ id: string; overdue: boolean }>).map((s) => s.id);
    expect(ids).toContain(overdueId);
    expect((listed.body.items as Array<{ overdue: boolean }>).every((s) => s.overdue)).toBe(true);
  });

  it("returns 404 for an unknown id and for another tenant's SCAR (rule 8)", async () => {
    const unknown = await authed("get", `/v1/scars/${randomUUID()}`, managerTok);
    expect(unknown.status).toBe(404);

    const foreignSupplier = randomUUID();
    const foreignScar = randomUUID();
    await withTenant(globexId, null, async (tx) => {
      await tx.query(
        `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES ($1,$2,'FIXT-foreign','SUP-XS-0001','active')`,
        [foreignSupplier, globexId],
      );
      await tx.query(
        `INSERT INTO scars (id, tenant_id, code, supplier_id, title, severity, status)
         VALUES ($1,$2,'SCAR-XS-0001',$3,'FIXT-foreign-scar','major','open')`,
        [foreignScar, globexId, foreignSupplier],
      );
    });
    const foreign = await authed("get", `/v1/scars/${foreignScar}`, managerTok);
    expect(foreign.status).toBe(404);
    await control.query("DELETE FROM scars WHERE id = $1", [foreignScar]);
    await control.query("DELETE FROM suppliers WHERE id = $1", [foreignSupplier]);
  });

  it("writes 'created' and 'status_changed' audit events", async () => {
    const created = await createScar({ title: "FIXT-audit" });
    const id = created.body["id"] as string;
    await authed("post", `/v1/scars/${id}/advance`, managerTok).send({ version: 0 });

    const { rows } = await control.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE entity_kind = 'scar' AND entity_id = $1",
      [id],
    );
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("created");
    expect(actions).toContain("status_changed");
  });
});

describe("SCAR assignment (P25)", () => {
  it("assigns, reassigns, and clears the owner — each an `assigned` audit event", async () => {
    const created = await createScar({ title: "FIXT-assign" });
    const id = created.body["id"] as string;
    expect(created.body["owner"]).toBeNull();

    const assigned = await authed("post", `/v1/scars/${id}/assign`, managerTok).send({ version: 0, owner: mgrUserId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.owner).toBe(mgrUserId);

    const { rows } = await control.query<{ before: { owner?: string | null }; after: { owner?: string | null } }>(
      `SELECT before, after FROM audit_events
        WHERE entity_kind = 'scar' AND entity_id = $1 AND action = 'assigned'
        ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    expect(rows[0]?.before).toEqual({ owner: null });
    expect(rows[0]?.after).toEqual({ owner: mgrUserId });

    // Reassign to another active member, then unassign with an explicit null.
    const reassigned = await authed("post", `/v1/scars/${id}/assign`, managerTok)
      .send({ version: assigned.body.lockVersion, owner: viewerUserId });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.owner).toBe(viewerUserId);

    const cleared = await authed("post", `/v1/scars/${id}/assign`, managerTok)
      .send({ version: reassigned.body.lockVersion, owner: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.owner).toBeNull();
  });

  it("rejects a non-member, a stale version, and a viewer", async () => {
    const created = await createScar({ title: "FIXT-assign-guard" });
    const id = created.body["id"] as string;

    const nonMember = await authed("post", `/v1/scars/${id}/assign`, managerTok).send({ version: 0, owner: randomUUID() });
    expect(nonMember.status).toBe(422);
    expect(nonMember.body.error.code).toBe("VALIDATION_FAILED");

    const stale = await authed("post", `/v1/scars/${id}/assign`, managerTok).send({ version: 9, owner: mgrUserId });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_WRITE");

    const viewer = await authed("post", `/v1/scars/${id}/assign`, viewerTok).send({ version: 0, owner: mgrUserId });
    expect(viewer.status).toBe(403);
  });
});
