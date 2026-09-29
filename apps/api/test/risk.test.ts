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
 * Risk register slice (SPRINT-04 R1-R5; `/v1/risks`). Pins: create/read/edit
 * under `risk:view`/`risk:manage` with optimistic concurrency; a real
 * `RISK-YYYY-NNNN` code via `codes.ts`/`counters`; R4 AC1's create-time
 * defaults (residualScore = inherent, status active, trend flat, reviewDue
 * null); the `controls[]` full-array-replace guarded by the PARENT risk's own
 * `lockVersion` and audited as one `updated` event; the `summary` aggregate;
 * the `ids` batch-resolve filter; create idempotency; and RLS/rule-8 tenant
 * isolation (foreign id -> 404, never 403 or a leak).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const TAG = `rk${randomUUID().replace(/-/g, "").slice(0, 8)}`;

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let mgrTok = "";
let viewerTok = "";
let globexMgrTok = "";
let mgrUserId = "";

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

function authed(method: "get" | "patch" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}
const acme = (method: "get" | "patch" | "post", path: string, bearer = mgrTok) => authed(method, path, ACME, bearer);

async function cleanup(): Promise<void> {
  await control.query(`DELETE FROM risk_controls WHERE tenant_id = ANY($1)`, [[acmeId, globexId]]);
  await control.query(`DELETE FROM risks WHERE tenant_id = ANY($1) AND title LIKE $2`, [[acmeId, globexId], `${TAG}%`]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  mgrUserId = await seedMember(acmeId, `${TAG}-mgr@acme.test`, "manager");
  await seedMember(acmeId, `${TAG}-viewer@acme.test`, "viewer");
  await seedMember(globexId, `${TAG}-mgr@globex.test`, "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(ACME, `${TAG}-mgr@acme.test`);
  viewerTok = await token(ACME, `${TAG}-viewer@acme.test`);
  globexMgrTok = await token(GLOBEX, `${TAG}-mgr@globex.test`);
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE $1", [`${TAG}-%@%.test`])
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

async function newRisk(overrides: Record<string, unknown> = {}): Promise<{ id: string; body: Record<string, unknown> }> {
  const res = await acme("post", "/v1/risks").send({
    category: "cyber",
    title: `${TAG} ransomware exposure`,
    owner: mgrUserId,
    likelihood: 4,
    impact: 5,
    treatment: "mitigate",
    ...overrides,
  });
  expect(res.status).toBe(201);
  return { id: res.body.id as string, body: res.body as Record<string, unknown> };
}

describe("Risk CRUD + R4 create-time defaults", () => {
  it("creates with a real RISK-YYYY-NNNN code and R4 AC1's exact defaults", async () => {
    const { body } = await newRisk();
    expect(body["code"]).toMatch(/^RISK-\d{4}-\d{4,}$/);
    expect(body["inherentScore"]).toBe(20); // 4 x 5
    expect(body["residualScore"]).toBe(20); // defaults to inherent, not scored down yet
    expect(body["status"]).toBe("active");
    expect(body["trend"]).toBe("flat");
    expect(body["reviewDue"]).toBeNull();
    expect(body["controls"]).toEqual([]);
  });

  it("lists, sorted by residual score desc, reads one, and edits with optimistic concurrency", async () => {
    const low = await newRisk({ title: `${TAG} low`, likelihood: 1, impact: 1 });
    const high = await newRisk({ title: `${TAG} high`, likelihood: 5, impact: 5 });

    const list = await acme("get", "/v1/risks", viewerTok);
    expect(list.status).toBe(200);
    const items = list.body.items as { id: string; residualScore: number }[];
    const highIdx = items.findIndex((r) => r.id === high.id);
    const lowIdx = items.findIndex((r) => r.id === low.id);
    expect(highIdx).toBeGreaterThanOrEqual(0);
    expect(lowIdx).toBeGreaterThan(highIdx); // higher residual sorts first

    const got = await acme("get", `/v1/risks/${high.id}`, viewerTok);
    expect(got.status).toBe(200);
    expect(got.body.lockVersion).toBe(0);

    const edit = await acme("patch", `/v1/risks/${high.id}`).send({
      category: "cyber",
      title: `${TAG} high (re-scored)`,
      owner: mgrUserId,
      likelihood: 5,
      impact: 5,
      residualScore: 10,
      trend: "down",
      treatment: "mitigate",
      status: "monitoring",
      plan: "Rotate credentials quarterly",
      reviewDue: "2026-12-01",
      lockVersion: 0,
    });
    expect(edit.status).toBe(200);
    expect(edit.body.residualScore).toBe(10);
    expect(edit.body.status).toBe("monitoring");
    expect(edit.body.lockVersion).toBe(1);

    // Stale write (same version resent) -> 409.
    const stale = await acme("patch", `/v1/risks/${high.id}`).send({
      category: "cyber",
      title: "x",
      owner: mgrUserId,
      likelihood: 5,
      impact: 5,
      residualScore: 5,
      trend: "down",
      treatment: "mitigate",
      status: "monitoring",
      plan: "",
      reviewDue: null,
      lockVersion: 0,
    });
    expect(stale.status).toBe(409);
  });

  it("`ids` batch-resolves a fixed set of risks (R3's reverse-pane label lookup)", async () => {
    const a = await newRisk({ title: `${TAG} ids-a` });
    const b = await newRisk({ title: `${TAG} ids-b` });
    const res = await acme("get", `/v1/risks?ids=${a.id},${b.id},${randomUUID()}`, viewerTok);
    expect(res.status).toBe(200);
    const ids = (res.body.items as { id: string }[]).map((r) => r.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
  });

  it("idempotency-key replays the same created risk on a retry", async () => {
    const key = randomUUID();
    const body = {
      category: "process",
      title: `${TAG} idempotent`,
      owner: mgrUserId,
      likelihood: 2,
      impact: 2,
      treatment: "accept",
    };
    const first = await acme("post", "/v1/risks").set("Idempotency-Key", key).send(body);
    expect(first.status).toBe(201);
    const second = await acme("post", "/v1/risks").set("Idempotency-Key", key).send(body);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const list = await control.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM risks WHERE tenant_id = $1 AND title = $2",
      [acmeId, body.title],
    );
    expect(list.rows[0]!.n).toBe("1"); // exactly one row despite two POSTs
  });
});

describe("Risk controls (R2) — full-array replace guarded by the parent's lockVersion", () => {
  it("replaces controls in one transaction, in seq order, audited as one `updated` event on the risk", async () => {
    const { id } = await newRisk({ title: `${TAG} controls` });

    const set1 = await acme("patch", `/v1/risks/${id}`).send({
      category: "cyber",
      title: `${TAG} controls`,
      owner: mgrUserId,
      likelihood: 4,
      impact: 5,
      residualScore: 20,
      trend: "flat",
      treatment: "mitigate",
      status: "active",
      plan: "",
      reviewDue: null,
      lockVersion: 0,
      controls: [
        { kind: "preventive", description: "MFA everywhere", strength: "strong", seq: 2 },
        { kind: "detective", description: "SIEM alerting", strength: "medium", seq: 1 },
      ],
    });
    expect(set1.status).toBe(200);
    const controls = set1.body.controls as { kind: string; seq: number }[];
    expect(controls.map((c) => c.kind)).toEqual(["detective", "preventive"]); // seq order 1, 2

    const auditRows = await control.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'risk' AND entity_id = $2 AND action = 'updated'`,
      [acmeId, id],
    );
    expect(auditRows.rows[0]!.n).toBe("1"); // one event for the whole batch, not per-control

    // Stale lockVersion on a further controls[] edit -> 409, not silent corruption.
    const staleControls = await acme("patch", `/v1/risks/${id}`).send({
      category: "cyber",
      title: `${TAG} controls`,
      owner: mgrUserId,
      likelihood: 4,
      impact: 5,
      residualScore: 20,
      trend: "flat",
      treatment: "mitigate",
      status: "active",
      plan: "",
      reviewDue: null,
      lockVersion: 0, // stale — set1 already bumped it to 1
      controls: [{ kind: "corrective", description: "x", strength: "weak", seq: 1 }],
    });
    expect(staleControls.status).toBe(409);
  });
});

describe("GET /v1/risks/summary", () => {
  it("aggregates counts across ALL visible risks, honestly empty-cased at zero", async () => {
    await newRisk({ title: `${TAG} summary-high`, likelihood: 5, impact: 5, treatment: "accept" });
    const acceptedRisk = await newRisk({
      title: `${TAG} summary-accepted`,
      likelihood: 1,
      impact: 1,
      treatment: "accept",
      status: "accepted",
      residualScore: 1,
    });
    expect(acceptedRisk.body["status"]).toBe("accepted");

    const res = await acme("get", "/v1/risks/summary", viewerTok);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.accepted).toBeGreaterThanOrEqual(1);
    expect(res.body.highResidual).toBeGreaterThanOrEqual(1);
    expect(res.body.byCategory).toHaveProperty("cyber");
    expect(typeof res.body.reviewedThisQuarterPct === "number" || res.body.reviewedThisQuarterPct === null).toBe(true);
  });
});

describe("Risk RBAC + tenancy", () => {
  it("a viewer can read but not write (risk:view without risk:manage)", async () => {
    const list = await acme("get", "/v1/risks", viewerTok);
    expect(list.status).toBe(200);
    const write = await acme("post", "/v1/risks", viewerTok).send({
      category: "cyber",
      title: "no",
      owner: mgrUserId,
      likelihood: 1,
      impact: 1,
      treatment: "accept",
    });
    expect(write.status).toBe(403);
  });

  it("does not leak one tenant's risks into another, and a foreign id is 404 not 403 (rule 8)", async () => {
    const { id } = await newRisk({ title: `${TAG} cross-tenant` });

    const otherList = await authed("get", "/v1/risks", GLOBEX, globexMgrTok);
    expect(otherList.status).toBe(200);
    expect((otherList.body.items as { id: string }[]).some((r) => r.id === id)).toBe(false);

    const otherGet = await authed("get", `/v1/risks/${id}`, GLOBEX, globexMgrTok);
    expect(otherGet.status).toBe(404);

    const otherPatch = await authed("patch", `/v1/risks/${id}`, GLOBEX, globexMgrTok).send({
      category: "cyber",
      title: "x",
      owner: mgrUserId,
      likelihood: 1,
      impact: 1,
      residualScore: 1,
      trend: "flat",
      treatment: "accept",
      status: "active",
      plan: "",
      reviewDue: null,
      lockVersion: 0,
    });
    expect(otherPatch.status).toBe(404);
  });
});
