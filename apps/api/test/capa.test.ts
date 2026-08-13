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
 * CAPA slice (02 §4, 03 §3).
 *
 * The rule the spec singles out for CAPA is directionality: phases advance only
 * forward, and going back is a distinct, audited `revert` that requires a
 * reason. This suite drives a CAPA forward through its phases, proves the
 * forward-only machine rejects a skip and rejects a backward move on `advance`,
 * proves `revert` needs a reason and only moves earlier, and pins the RBAC
 * split (view vs manage) and optimistic concurrency.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";

let adminTok = "";
let mgrTok = "";
let viewerTok = "";
let mgrUserId = "";
let adminUserId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(email: string, role: string): Promise<string> {
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
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [acmeId, userId, role],
    );
  });
  return userId;
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

interface Capa {
  id: string;
  code: string;
  status: string;
  lockVersion: number;
}

async function openCapa(): Promise<Capa> {
  const res = await authed("post", "/v1/capas", adminTok).send({
    title: "CAPATEST programme",
    type: "corrective",
    priority: "major",
  });
  expect(res.status).toBe(201);
  return res.body as Capa;
}

/** Advance and return the fresh CAPA, asserting a 200. */
async function advance(capa: Capa, to: string): Promise<Capa> {
  const res = await authed("post", `/v1/capas/${capa.id}/advance`, mgrTok).send({ to, version: capa.lockVersion });
  expect(res.status).toBe(200);
  return res.body as Capa;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);

  adminUserId = await seedMember("capa-admin@acme.test", "admin");
  mgrUserId = await seedMember("capa-mgr@acme.test", "manager");
  await seedMember("capa-viewer@acme.test", "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token("capa-admin@acme.test");
  mgrTok = await token("capa-mgr@acme.test");
  viewerTok = await token("capa-viewer@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'capa-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM capa_actions WHERE description LIKE 'CAPATEST%'");
  await control.query("DELETE FROM capas WHERE title LIKE 'CAPATEST%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("CAPA phases", () => {
  it("opens at initiation and advances one phase at a time", async () => {
    let capa = await openCapa();
    expect(capa.status).toBe("initiation");
    expect(capa.code).toMatch(/^CAPA-\d{4}-\d+$/);

    capa = await advance(capa, "root_cause");
    expect(capa.status).toBe("root_cause");
    capa = await advance(capa, "action_plan");
    expect(capa.status).toBe("action_plan");
  });

  it("refuses to skip a phase (forward-only, one step)", async () => {
    const capa = await openCapa();
    const skip = await authed("post", `/v1/capas/${capa.id}/advance`, mgrTok).send({
      to: "implementation",
      version: capa.lockVersion,
    });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe("INVALID_TRANSITION");
    // The error tells the client what IS reachable.
    expect(skip.body.error.details.allowed).toEqual(["root_cause"]);
  });

  it("refuses to move backward via advance — that is what revert is for", async () => {
    let capa = await openCapa();
    capa = await advance(capa, "root_cause");
    const back = await authed("post", `/v1/capas/${capa.id}/advance`, mgrTok).send({
      to: "initiation",
      version: capa.lockVersion,
    });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("CAPA revert (the audited exception)", () => {
  it("reverts to an earlier phase with a reason, and writes an audit event", async () => {
    let capa = await openCapa();
    capa = await advance(capa, "root_cause");
    capa = await advance(capa, "action_plan");

    const reverted = await authed("post", `/v1/capas/${capa.id}/revert`, mgrTok).send({
      to: "root_cause",
      version: capa.lockVersion,
      reason: "CAPATEST root cause was wrong, reopening analysis",
    });
    expect(reverted.status).toBe(200);
    expect(reverted.body.status).toBe("root_cause");

    // The revert is recorded in the append-only audit trail with its reason.
    const { rows } = await control.query<{ reason: string | null; before: unknown; after: unknown }>(
      `SELECT reason, before, after FROM audit_events
        WHERE entity_kind = 'capa' AND entity_id = $1 AND action = 'status_changed'
        ORDER BY created_at DESC LIMIT 1`,
      [capa.id],
    );
    expect(rows[0]?.reason).toContain("root cause was wrong");
    expect(rows[0]?.after).toEqual({ status: "root_cause" });
  });

  it("rejects a revert with no reason (schema) and a forward 'revert' (machine)", async () => {
    let capa = await openCapa();
    capa = await advance(capa, "root_cause");

    const noReason = await authed("post", `/v1/capas/${capa.id}/revert`, mgrTok).send({
      to: "initiation",
      version: capa.lockVersion,
    });
    expect(noReason.status).toBe(422); // body schema requires a non-empty reason
    expect(noReason.body.error.code).toBe("VALIDATION_FAILED");

    const forward = await authed("post", `/v1/capas/${capa.id}/revert`, mgrTok).send({
      to: "action_plan",
      version: capa.lockVersion,
      reason: "CAPATEST not actually a revert",
    });
    expect(forward.status).toBe(409);
    expect(forward.body.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("CAPA actions + concurrency + RBAC", () => {
  it("adds an action and advances its status", async () => {
    const capa = await openCapa();
    const action = await authed("post", `/v1/capas/${capa.id}/actions`, mgrTok).send({
      description: "CAPATEST containment step",
      ownerId: mgrUserId,
    });
    expect(action.status).toBe(201);
    expect(action.body.status).toBe("pending");

    const done = await authed("post", `/v1/capa-actions/${action.body.id}/status`, mgrTok).send({
      status: "done",
      version: action.body.lockVersion,
    });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("done");
  });

  it("rejects a stale advance (STALE_WRITE)", async () => {
    const capa = await openCapa();
    const res = await authed("post", `/v1/capas/${capa.id}/advance`, mgrTok).send({
      to: "root_cause",
      version: capa.lockVersion + 5,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_WRITE");
  });

  it("lets a viewer read but not open or advance a CAPA", async () => {
    const capa = await openCapa();

    const read = await authed("get", `/v1/capas/${capa.id}`, viewerTok);
    expect(read.status).toBe(200);
    expect(read.body.code).toBe(capa.code);

    const create = await authed("post", "/v1/capas", viewerTok).send({
      title: "CAPATEST nope",
      type: "corrective",
      priority: "minor",
    });
    expect(create.status).toBe(403);

    const move = await authed("post", `/v1/capas/${capa.id}/advance`, viewerTok).send({
      to: "root_cause",
      version: capa.lockVersion,
    });
    expect(move.status).toBe(403);
  });

  it("returns 404 for an unknown CAPA id", async () => {
    const res = await authed("get", `/v1/capas/${randomUUID()}`, adminTok);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("CAPA assignment (P25)", () => {
  it("assigns owner + sponsor, then reassigns and unassigns — each audited", async () => {
    let capa = await openCapa();
    expect(capa.status).toBe("initiation");

    // Assign both, at any phase (assignment is orthogonal to the machine).
    const assigned = await authed("post", `/v1/capas/${capa.id}/assign`, mgrTok).send({
      version: capa.lockVersion,
      ownerId: mgrUserId,
      sponsorId: adminUserId,
    });
    expect(assigned.status).toBe(200);
    expect(assigned.body.ownerId).toBe(mgrUserId);
    expect(assigned.body.sponsorId).toBe(adminUserId);
    capa = assigned.body as Capa;

    // The change is in the append-only trail as `assigned`, with before/after ids.
    const { rows } = await control.query<{ before: { ownerId?: string | null }; after: { ownerId?: string | null } }>(
      `SELECT before, after FROM audit_events
        WHERE entity_kind = 'capa' AND entity_id = $1 AND action = 'assigned'
        ORDER BY created_at DESC LIMIT 1`,
      [capa.id],
    );
    expect(rows[0]?.before).toEqual({ ownerId: null, sponsorId: null });
    expect(rows[0]?.after).toEqual({ ownerId: mgrUserId, sponsorId: adminUserId });

    // Reassign just the owner (sponsor left untouched by omitting the key).
    const reassigned = await authed("post", `/v1/capas/${capa.id}/assign`, mgrTok).send({
      version: capa.lockVersion,
      ownerId: adminUserId,
    });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.ownerId).toBe(adminUserId);
    expect(reassigned.body.sponsorId).toBe(adminUserId); // unchanged
    capa = reassigned.body as Capa;

    // Unassign the owner with an explicit null.
    const cleared = await authed("post", `/v1/capas/${capa.id}/assign`, mgrTok).send({
      version: capa.lockVersion,
      ownerId: null,
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.ownerId).toBeNull();
    expect(cleared.body.sponsorId).toBe(adminUserId);
  });

  it("rejects a non-member assignee (no cross-tenant existence leak)", async () => {
    const capa = await openCapa();
    const res = await authed("post", `/v1/capas/${capa.id}/assign`, mgrTok).send({
      version: capa.lockVersion,
      ownerId: randomUUID(),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects an empty body (must provide owner and/or sponsor)", async () => {
    const capa = await openCapa();
    const res = await authed("post", `/v1/capas/${capa.id}/assign`, mgrTok).send({ version: capa.lockVersion });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a stale assign (STALE_WRITE) and a viewer (403)", async () => {
    const capa = await openCapa();

    const stale = await authed("post", `/v1/capas/${capa.id}/assign`, mgrTok).send({
      version: capa.lockVersion + 5,
      ownerId: mgrUserId,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_WRITE");

    const viewer = await authed("post", `/v1/capas/${capa.id}/assign`, viewerTok).send({
      version: capa.lockVersion,
      ownerId: mgrUserId,
    });
    expect(viewer.status).toBe(403);
  });
});
