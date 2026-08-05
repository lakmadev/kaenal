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
 * Findings → NCR slice (02 §4, 03 §3, §10).
 *
 * The real workflow end to end: an inspection produces a finding, an NCR is
 * raised from it (linking the finding), then the NCR is driven through its
 * lifecycle — with the corrective-action gate, four-eyes verification, SLA due
 * dates, plant scoping and optimistic concurrency all exercised against the
 * live state machine and real Postgres.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let plantA = "";
let plantB = "";

let adminTok = "";
let mgrTok = "";
let auditorTok = "";
let inspectorTok = ""; // scoped to plantA
let viewerTok = "";
let mgrUserId = "";
let adminUserId = "";

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

async function seedMember(email: string, role: string, plantIds: string[]): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, plant_ids, status) VALUES ($1,$2,$3,$4,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, plant_ids = EXCLUDED.plant_ids, status = 'active'`,
      [acmeId, userId, role, plantIds],
    );
  });
  return userId;
}

async function seedPlant(code: string): Promise<string> {
  const id = randomUUID();
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(`INSERT INTO plants (id, tenant_id, name, code, timezone) VALUES ($1,$2,$3,$4,'UTC')`, [
      id,
      acmeId,
      code,
      code,
    ]);
  });
  return id;
}

/**
 * Seed the NCR SLA ladder for acme. Self-contained on purpose: the db-package
 * suite truncates sla_configs earlier in the same `pnpm test` run, so relying on
 * the provisioned rows would make this suite order-dependent.
 */
async function seedSla(): Promise<void> {
  const bh = JSON.stringify({ days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" });
  const ladder: [string, number, number][] = [
    ["critical", 4, 24],
    ["major", 8, 72],
    ["minor", 24, 168],
  ];
  await withTenant(acmeId, null, async (tx) => {
    for (const [priority, respond, resolve] of ladder) {
      await tx.query(
        `INSERT INTO sla_configs (tenant_id, entity_kind, priority, respond_hours, resolve_hours, business_hours)
         VALUES ($1, 'ncr', $2, $3, $4, $5)
         ON CONFLICT (tenant_id, entity_kind, priority) DO NOTHING`,
        [acmeId, priority, respond, resolve, bh],
      );
    }
  });
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

interface Ncr {
  id: string;
  code: string;
  status: string;
  lockVersion: number;
  dueAt: string | null;
  slaState: string;
}

async function raiseNcr(priority = "major", plantId?: string): Promise<Ncr> {
  const res = await authed("post", "/v1/ncrs", adminTok).send({
    title: "NCRTEST manual",
    priority,
    ...(plantId !== undefined ? { plantId } : {}),
  });
  expect(res.status).toBe(201);
  return res.body as Ncr;
}

/** Creates a published template + one inspection, returns the inspection id. */
async function anInspection(): Promise<string> {
  const t = await authed("post", "/v1/inspection-templates", adminTok).send({ name: `NCRTEST ${randomUUID()}`, schema: SCHEMA });
  const tpl = t.body as { id: string; lockVersion: number };
  await authed("post", `/v1/inspection-templates/${tpl.id}/publish`, adminTok).send({ version: tpl.lockVersion });
  const ins = await authed("post", "/v1/inspections", adminTok).send({ title: "NCRTEST insp", templateId: tpl.id });
  return (ins.body as { id: string }).id;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  plantA = await seedPlant("NCRTESTPA");
  plantB = await seedPlant("NCRTESTPB");
  await seedSla();

  adminUserId = await seedMember("ncr-admin@acme.test", "admin", []);
  mgrUserId = await seedMember("ncr-mgr@acme.test", "manager", []);
  await seedMember("ncr-auditor@acme.test", "auditor", []);
  await seedMember("ncr-inspector@acme.test", "inspector", [plantA]);
  await seedMember("ncr-viewer@acme.test", "viewer", []);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token("ncr-admin@acme.test");
  mgrTok = await token("ncr-mgr@acme.test");
  auditorTok = await token("ncr-auditor@acme.test");
  inspectorTok = await token("ncr-inspector@acme.test");
  viewerTok = await token("ncr-viewer@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'ncr-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM ncr_actions WHERE description LIKE 'NCRTEST%'");
  await control.query("DELETE FROM findings WHERE description LIKE 'NCRTEST%'");
  await control.query("DELETE FROM ncrs WHERE title LIKE 'NCRTEST%'");
  await control.query("DELETE FROM inspections WHERE title LIKE 'NCRTEST%'");
  await control.query("DELETE FROM inspection_templates WHERE name LIKE 'NCRTEST%'");
  await control.query("DELETE FROM plants WHERE code LIKE 'NCRTESTP%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("findings → NCR", () => {
  it("records a finding and raises a linked NCR from it", async () => {
    const inspectionId = await anInspection();

    const finding = await authed("post", `/v1/inspections/${inspectionId}/findings`, adminTok).send({
      itemRef: "guard",
      severity: "major",
      description: "NCRTEST guard missing",
    });
    expect(finding.status).toBe(201);
    expect(finding.body.ncrId).toBeNull();

    const ncr = await authed("post", "/v1/ncrs", adminTok).send({
      title: "NCRTEST from finding",
      priority: "major",
      findingId: finding.body.id,
    });
    expect(ncr.status).toBe(201);
    expect(ncr.body.code).toMatch(/^NCR-\d{4}-\d+$/);
    expect(ncr.body.source).toBe("inspection");

    // The finding is now linked.
    const findings = await authed("get", `/v1/inspections/${inspectionId}/findings`, adminTok);
    const linked = (findings.body.items as { id: string; ncrId: string | null }[]).find((f) => f.id === finding.body.id);
    expect(linked?.ncrId).toBe(ncr.body.id);
  });

  it("refuses to link a finding that is already on another NCR", async () => {
    const inspectionId = await anInspection();
    const finding = await authed("post", `/v1/inspections/${inspectionId}/findings`, adminTok).send({
      itemRef: "guard",
      severity: "minor",
      description: "NCRTEST double link",
    });
    await authed("post", "/v1/ncrs", adminTok).send({ title: "NCRTEST first", priority: "minor", findingId: finding.body.id });
    const second = await authed("post", "/v1/ncrs", adminTok).send({ title: "NCRTEST second", priority: "minor", findingId: finding.body.id });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });
});

describe("NCR lifecycle", () => {
  it("assigns, works, resolves (after a corrective action), verifies and closes", async () => {
    let ncr = await raiseNcr("major");
    expect(ncr.status).toBe("open");
    expect(ncr.dueAt).not.toBeNull(); // SLA due date computed on creation

    const assigned = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({
      to: "assigned",
      ownerId: mgrUserId,
      version: ncr.lockVersion,
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.ownerId).toBe(mgrUserId);
    ncr = assigned.body as Ncr;

    const started = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({ to: "in_progress", version: ncr.lockVersion });
    ncr = started.body as Ncr;

    // Resolve is gated on a completed corrective action.
    const early = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({ to: "resolved", version: ncr.lockVersion });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("INVALID_TRANSITION");

    const action = await authed("post", `/v1/ncrs/${ncr.id}/actions`, mgrTok).send({
      kind: "corrective",
      description: "NCRTEST replace guard",
    });
    expect(action.status).toBe(201);
    await authed("post", `/v1/ncr-actions/${action.body.id}/status`, mgrTok).send({ status: "done", version: action.body.lockVersion });

    const resolved = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({ to: "resolved", version: ncr.lockVersion });
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe("resolved");
    ncr = resolved.body as Ncr;

    // Four-eyes: the manager who resolved it may not verify it.
    const selfVerify = await authed("post", `/v1/ncrs/${ncr.id}/verify`, mgrTok).send({ version: ncr.lockVersion });
    expect(selfVerify.status).toBe(409);
    expect(selfVerify.body.error.code).toBe("INVALID_TRANSITION");

    // A second pair of eyes (auditor holds ncr:verify) can.
    const verified = await authed("post", `/v1/ncrs/${ncr.id}/verify`, auditorTok).send({ version: ncr.lockVersion });
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe("verified");
    ncr = verified.body as Ncr;

    const closed = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({ to: "closed", version: ncr.lockVersion });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe("closed");
    expect(closed.body.closedAt).not.toBeNull();
  });

  it("rejects a stale transition (STALE_WRITE)", async () => {
    const ncr = await raiseNcr("minor");
    const res = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({
      to: "assigned",
      ownerId: mgrUserId,
      version: ncr.lockVersion + 7,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_WRITE");
  });
});

describe("RBAC + scoping", () => {
  it("forbids a viewer from raising an NCR and an inspector from managing one", async () => {
    const viewerCreate = await authed("post", "/v1/ncrs", viewerTok).send({ title: "NCRTEST nope", priority: "minor" });
    expect(viewerCreate.status).toBe(403);

    const ncr = await raiseNcr("minor");
    const inspectorManage = await authed("post", `/v1/ncrs/${ncr.id}/transition`, inspectorTok).send({
      to: "assigned",
      ownerId: mgrUserId,
      version: ncr.lockVersion,
    });
    expect(inspectorManage.status).toBe(403);
  });

  it("hides an out-of-scope NCR from a plant-scoped inspector as a 404", async () => {
    const ncr = await raiseNcr("major", plantB);
    const get = await authed("get", `/v1/ncrs/${ncr.id}`, inspectorTok);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe("NOT_FOUND");
  });
});

describe("NCR assignment (P25)", () => {
  it("assigns, reassigns, and clears the owner without moving status — each audited", async () => {
    let ncr = await raiseNcr("major");
    expect(ncr.status).toBe("open");

    // Assign the owner while still `open` — orthogonal to the lifecycle machine,
    // so status must NOT change (unlike the open→assigned transition).
    const assigned = await authed("post", `/v1/ncrs/${ncr.id}/assign`, mgrTok).send({
      version: ncr.lockVersion,
      ownerId: mgrUserId,
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.ownerId).toBe(mgrUserId);
    expect(assigned.body.status).toBe("open");
    ncr = assigned.body as Ncr;

    const { rows } = await control.query<{ before: { ownerId?: string | null }; after: { ownerId?: string | null } }>(
      `SELECT before, after FROM audit_events
        WHERE entity_kind = 'ncr' AND entity_id = $1 AND action = 'assigned'
        ORDER BY created_at DESC LIMIT 1`,
      [ncr.id],
    );
    expect(rows[0]?.before).toEqual({ ownerId: null });
    expect(rows[0]?.after).toEqual({ ownerId: mgrUserId });

    // Reassign to a different member.
    const reassigned = await authed("post", `/v1/ncrs/${ncr.id}/assign`, mgrTok).send({
      version: ncr.lockVersion,
      ownerId: adminUserId,
    });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.ownerId).toBe(adminUserId);
    ncr = reassigned.body as Ncr;

    // Unassign with an explicit null.
    const cleared = await authed("post", `/v1/ncrs/${ncr.id}/assign`, mgrTok).send({
      version: ncr.lockVersion,
      ownerId: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.ownerId).toBeNull();
  });

  it("rejects a non-member assignee (no cross-tenant existence leak)", async () => {
    const ncr = await raiseNcr("minor");
    const res = await authed("post", `/v1/ncrs/${ncr.id}/assign`, mgrTok).send({
      version: ncr.lockVersion,
      ownerId: randomUUID(),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a stale assign (STALE_WRITE) and a viewer (403)", async () => {
    const ncr = await raiseNcr("minor");

    const stale = await authed("post", `/v1/ncrs/${ncr.id}/assign`, mgrTok).send({
      version: ncr.lockVersion + 5,
      ownerId: mgrUserId,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_WRITE");

    const viewer = await authed("post", `/v1/ncrs/${ncr.id}/assign`, viewerTok).send({
      version: ncr.lockVersion,
      ownerId: mgrUserId,
    });
    expect(viewer.status).toBe(403);
  });
});
