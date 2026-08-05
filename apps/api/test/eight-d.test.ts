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
 * 8D slice (02 §4, 03 §10). Two things to prove: the step-gating ladder
 * (in-order completion, with D3 allowed parallel to D2) and the 8D↔NCR seam —
 * an 8D opened from an NCR blocks that NCR from closing until the 8D is
 * completed or cancelled.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let adminTok = "";
let mgrTok = "";
let auditorTok = "";
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

interface EightD {
  id: string;
  code: string;
  status: string;
  lockVersion: number;
  currentStep: number;
  steps: Record<string, { status: string }>;
}

async function createEightD(ncrId?: string): Promise<EightD> {
  const res = await authed("post", "/v1/eight-ds", mgrTok).send({ title: "EIGHTDTEST case", ...(ncrId ? { ncrId } : {}) });
  expect(res.status).toBe(201);
  return res.body as EightD;
}

async function completeStep(ed: EightD, n: number): Promise<EightD> {
  const res = await authed("post", `/v1/eight-ds/${ed.id}/steps/${n}`, mgrTok).send({
    status: "complete",
    version: ed.lockVersion,
  });
  expect(res.status).toBe(200);
  return res.body as EightD;
}

/** Drive a fresh NCR all the way to `verified`, ready to close. */
async function ncrToVerified(): Promise<{ id: string; lockVersion: number }> {
  let ncr = (await authed("post", "/v1/ncrs", adminTok).send({ title: "EIGHTDTEST ncr", priority: "major" })).body as {
    id: string;
    lockVersion: number;
  };
  const step = async (bearer: string, body: Record<string, unknown>): Promise<void> => {
    const res = await authed("post", `/v1/ncrs/${ncr.id}/transition`, bearer).send({ ...body, version: ncr.lockVersion });
    expect(res.status).toBe(200);
    ncr = res.body as typeof ncr;
  };
  await step(mgrTok, { to: "assigned", ownerId: mgrUserId });
  await step(mgrTok, { to: "in_progress" });
  const action = await authed("post", `/v1/ncrs/${ncr.id}/actions`, mgrTok).send({ kind: "corrective", description: "EIGHTDTEST fix" });
  await authed("post", `/v1/ncr-actions/${action.body.id}/status`, mgrTok).send({ status: "done", version: action.body.lockVersion });
  await step(mgrTok, { to: "resolved" });
  const verified = await authed("post", `/v1/ncrs/${ncr.id}/verify`, auditorTok).send({ version: ncr.lockVersion });
  expect(verified.status).toBe(200);
  return { id: ncr.id, lockVersion: verified.body.lockVersion as number };
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  adminUserId = await seedMember("8d-admin@acme.test", "admin");
  mgrUserId = await seedMember("8d-mgr@acme.test", "manager");
  await seedMember("8d-auditor@acme.test", "auditor");
  await seedMember("8d-viewer@acme.test", "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  adminTok = await token("8d-admin@acme.test");
  mgrTok = await token("8d-mgr@acme.test");
  auditorTok = await token("8d-auditor@acme.test");
  viewerTok = await token("8d-viewer@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE '8d-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query("UPDATE ncrs SET eight_d_id = NULL WHERE title LIKE 'EIGHTDTEST%'");
  await control.query("DELETE FROM eight_ds WHERE title LIKE 'EIGHTDTEST%'");
  await control.query("DELETE FROM ncr_actions WHERE description LIKE 'EIGHTDTEST%'");
  await control.query("DELETE FROM ncrs WHERE title LIKE 'EIGHTDTEST%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("step gating", () => {
  it("opens at D1 and enforces prerequisites, with D3 allowed parallel to D2", async () => {
    let ed = await createEightD();
    expect(ed.status).toBe("active");
    expect(ed.code).toMatch(/^8D-\d{4}-\d+$/);

    // D2 before D1 → blocked.
    const early = await authed("post", `/v1/eight-ds/${ed.id}/steps/2`, mgrTok).send({ status: "complete", version: ed.lockVersion });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("INVALID_TRANSITION");

    ed = await completeStep(ed, 1);

    // D2 in progress (not complete)…
    const d2 = await authed("post", `/v1/eight-ds/${ed.id}/steps/2`, mgrTok).send({ status: "in_progress", version: ed.lockVersion });
    ed = d2.body as EightD;
    // …yet D3 may still be completed (the parallel exception).
    ed = await completeStep(ed, 3);
    expect(ed.steps["d3"]?.status).toBe("complete");

    // D4 still needs D2 done.
    const d4blocked = await authed("post", `/v1/eight-ds/${ed.id}/steps/4`, mgrTok).send({ status: "complete", version: ed.lockVersion });
    expect(d4blocked.status).toBe(409);
  });

  it("completes all disciplines then the 8D, and refuses to complete early", async () => {
    let ed = await createEightD();
    for (const n of [1, 2, 3, 4, 5, 6, 7]) ed = await completeStep(ed, n);

    // 7/8 done — completing the 8D is refused.
    const early = await authed("post", `/v1/eight-ds/${ed.id}/transition`, mgrTok).send({ to: "completed", version: ed.lockVersion });
    expect(early.status).toBe(409);

    ed = await completeStep(ed, 8);
    const done = await authed("post", `/v1/eight-ds/${ed.id}/transition`, mgrTok).send({ to: "completed", version: ed.lockVersion });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("completed");
  });
});

describe("8D ↔ NCR", () => {
  it("blocks the linked NCR from closing until the 8D is resolved", async () => {
    const ncr = await ncrToVerified();
    const ed = await createEightD(ncr.id);
    expect(ed.status).toBe("active");

    // Linking the 8D bumped the NCR's lock_version, so refetch the current one.
    const version = (await authed("get", `/v1/ncrs/${ncr.id}`, mgrTok)).body.lockVersion as number;

    // The NCR is verified and would otherwise close — but the open 8D blocks it.
    const blocked = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({ to: "closed", version });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("CONFLICT");
    expect(blocked.body.error.details.blockedBy).toBe(ed.id);

    // Cancelling the 8D releases the block.
    const cancelled = await authed("post", `/v1/eight-ds/${ed.id}/transition`, mgrTok).send({ to: "cancelled", version: ed.lockVersion });
    expect(cancelled.status).toBe(200);

    const closed = await authed("post", `/v1/ncrs/${ncr.id}/transition`, mgrTok).send({ to: "closed", version });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe("closed");
  });

  it("refuses to open a second 8D on the same NCR", async () => {
    const ncr = await ncrToVerified();
    await createEightD(ncr.id);
    const second = await authed("post", "/v1/eight-ds", mgrTok).send({ title: "EIGHTDTEST dup", ncrId: ncr.id });
    expect(second.status).toBe(409);
  });
});

describe("RBAC + concurrency", () => {
  it("lets a viewer read but not run an 8D", async () => {
    const ed = await createEightD();
    const read = await authed("get", `/v1/eight-ds/${ed.id}`, viewerTok);
    expect(read.status).toBe(200);

    const create = await authed("post", "/v1/eight-ds", viewerTok).send({ title: "EIGHTDTEST nope" });
    expect(create.status).toBe(403);

    const step = await authed("post", `/v1/eight-ds/${ed.id}/steps/1`, viewerTok).send({ status: "complete", version: ed.lockVersion });
    expect(step.status).toBe(403);
  });

  it("rejects a stale step update", async () => {
    const ed = await createEightD();
    const res = await authed("post", `/v1/eight-ds/${ed.id}/steps/1`, mgrTok).send({ status: "complete", version: ed.lockVersion + 5 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_WRITE");
  });
});

interface Team {
  teamLeadId: string | null;
  championId: string | null;
  status: string;
  currentStep: number;
  lockVersion: number;
}

describe("8D assignment (P25)", () => {
  it("assigns lead + champion, then reassigns one and unassigns — each audited", async () => {
    const ed = await createEightD();

    // Assign both. Assignment is orthogonal to the step machine — currentStep
    // and status stay put.
    const assigned = await authed("post", `/v1/eight-ds/${ed.id}/assign`, mgrTok).send({
      version: ed.lockVersion,
      teamLeadId: mgrUserId,
      championId: adminUserId,
    });
    expect(assigned.status).toBe(200);
    const a = assigned.body as Team;
    expect(a.teamLeadId).toBe(mgrUserId);
    expect(a.championId).toBe(adminUserId);
    expect(a.status).toBe("active");
    expect(a.currentStep).toBe(ed.currentStep);

    const { rows } = await control.query<{ before: unknown; after: unknown }>(
      `SELECT before, after FROM audit_events
        WHERE entity_kind = 'eight_d' AND entity_id = $1 AND action = 'assigned'
        ORDER BY created_at DESC LIMIT 1`,
      [ed.id],
    );
    expect(rows[0]?.before).toEqual({ teamLeadId: null, championId: null });
    expect(rows[0]?.after).toEqual({ teamLeadId: mgrUserId, championId: adminUserId });

    // Reassign only the champion (team lead untouched by omitting the key).
    const reassigned = await authed("post", `/v1/eight-ds/${ed.id}/assign`, mgrTok).send({
      version: a.lockVersion,
      championId: mgrUserId,
    });
    expect(reassigned.status).toBe(200);
    const r = reassigned.body as Team;
    expect(r.championId).toBe(mgrUserId);
    expect(r.teamLeadId).toBe(mgrUserId); // unchanged

    // Unassign the team lead with an explicit null.
    const cleared = await authed("post", `/v1/eight-ds/${ed.id}/assign`, mgrTok).send({
      version: r.lockVersion,
      teamLeadId: null,
    });
    expect(cleared.status).toBe(200);
    expect((cleared.body as Team).teamLeadId).toBeNull();
  });

  it("rejects a non-member, an empty body, a stale version, and a viewer", async () => {
    const ed = await createEightD();

    const nonMember = await authed("post", `/v1/eight-ds/${ed.id}/assign`, mgrTok).send({
      version: ed.lockVersion,
      teamLeadId: randomUUID(),
    });
    expect(nonMember.status).toBe(422);
    expect(nonMember.body.error.code).toBe("VALIDATION_FAILED");

    const empty = await authed("post", `/v1/eight-ds/${ed.id}/assign`, mgrTok).send({ version: ed.lockVersion });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe("VALIDATION_FAILED");

    const stale = await authed("post", `/v1/eight-ds/${ed.id}/assign`, mgrTok).send({
      version: ed.lockVersion + 5,
      teamLeadId: mgrUserId,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_WRITE");

    const viewer = await authed("post", `/v1/eight-ds/${ed.id}/assign`, viewerTok).send({
      version: ed.lockVersion,
      teamLeadId: mgrUserId,
    });
    expect(viewer.status).toBe(403);
  });

  it("refuses to re-form the team of a cancelled 8D", async () => {
    const ed = await createEightD();
    const cancelled = await authed("post", `/v1/eight-ds/${ed.id}/transition`, mgrTok).send({
      to: "cancelled",
      version: ed.lockVersion,
    });
    expect(cancelled.status).toBe(200);

    const res = await authed("post", `/v1/eight-ds/${ed.id}/assign`, mgrTok).send({
      version: cancelled.body.lockVersion,
      teamLeadId: mgrUserId,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });
});
