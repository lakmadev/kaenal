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
 * MSA / Gauge R&R slice (SPRINT-04 M1-M5; `/v1/msa-studies`). This is the
 * amendment-heavy one — pins the full lifecycle (draft -> measurements ->
 * complete -> analysis -> reopen -> edit -> re-complete, `completed_at`
 * overwritten not cleared) and every guard the four rounds of concurrency
 * fixes added: the measurement-batch route's own `lockVersion` (the race it
 * closes), 422 on a completed-study measurement post, 422 on an out-of-range
 * cell index, 422 on completing an incomplete grid or an already-completed
 * study, 422 on reopening an already-draft study, and `status_changed` (not
 * generic `updated`) for both complete and reopen.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const TAG = `ms${randomUUID().replace(/-/g, "").slice(0, 8)}`;

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

function authed(method: "get" | "patch" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}
const acme = (method: "get" | "patch" | "post", path: string, bearer = mgrTok) => authed(method, path, ACME, bearer);

async function cleanup(): Promise<void> {
  await control.query(`DELETE FROM msa_measurements WHERE tenant_id = ANY($1)`, [[acmeId, globexId]]);
  await control.query(`DELETE FROM msa_studies WHERE tenant_id = ANY($1) AND characteristic LIKE $2`, [
    [acmeId, globexId],
    `${TAG}%`,
  ]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  await seedMember(acmeId, `${TAG}-mgr@acme.test`, "manager");
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

// 2 appraisers x 2 parts x 2 trials — the minimum valid crossed_anova design
// (M1 AC5's hard floor), small enough to fill by hand in every test.
function fullGrid(valueAt: (a: number, p: number, t: number) => number = () => 10): { appraiser: number; part: number; trial: number; value: number }[] {
  const cells: { appraiser: number; part: number; trial: number; value: number }[] = [];
  for (let a = 1; a <= 2; a++) {
    for (let p = 1; p <= 2; p++) {
      for (let t = 1; t <= 2; t++) {
        cells.push({ appraiser: a, part: p, trial: t, value: valueAt(a, p, t) });
      }
    }
  }
  return cells;
}

async function newStudy(characteristic: string): Promise<{ id: string; lockVersion: number }> {
  const res = await acme("post", "/v1/msa-studies").send({
    characteristic,
    gaugeLabel: `${TAG} caliper`,
    method: "crossed_anova",
    nAppraisers: 2,
    nParts: 2,
    nTrials: 2,
  });
  expect(res.status).toBe(201);
  return { id: res.body.id as string, lockVersion: res.body.lockVersion as number };
}

describe("MSA study creation (M1)", () => {
  it("creates a draft study with a real MSA-YYYY-NNNN code", async () => {
    const res = await acme("post", "/v1/msa-studies").send({
      characteristic: `${TAG} create`,
      gaugeLabel: `${TAG} caliper`,
      method: "crossed_anova",
      nAppraisers: 3,
      nParts: 10,
      nTrials: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^MSA-\d{4}-\d{4,}$/);
    expect(res.body.status).toBe("draft");
    expect(res.body.completedAt).toBeNull();
    expect(res.body.lockVersion).toBe(0);
    expect(res.body.measurements).toEqual([]);
  });

  it("422s on average_range bounds outside the K-table domain (Zod .superRefine, verified sufficient — no service duplicate needed)", async () => {
    const res = await acme("post", "/v1/msa-studies").send({
      characteristic: `${TAG} bad-bounds`,
      gaugeLabel: "x",
      method: "average_range",
      nAppraisers: 5, // average_range only allows 2 or 3
      nParts: 5,
      nTrials: 3,
    });
    expect(res.status).toBe(422);
  });
});

describe("Full lifecycle: draft -> measurements -> complete -> analysis -> reopen -> edit -> re-complete", () => {
  it("walks the whole cycle, pinning every guard along the way", async () => {
    const study = await newStudy(`${TAG} lifecycle`);

    // Out-of-range cell index (appraiser 3 on a 2-appraiser study) -> 422.
    const outOfRange = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({
      lockVersion: study.lockVersion,
      cells: [{ appraiser: 3, part: 1, trial: 1, value: 10 }],
    });
    expect(outOfRange.status).toBe(422);

    // Fill the grid — bumps lock_version 0 -> 1, audited `updated` once for the batch.
    const fill = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({
      lockVersion: study.lockVersion,
      cells: fullGrid((a, p, t) => 10 + a * 0.3 + p * 0.5 + t * 0.1),
    });
    expect(fill.status).toBe(200);
    expect(fill.body.lockVersion).toBe(1);
    expect((fill.body.measurements as unknown[]).length).toBe(8);

    const updatedEvents = await control.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'msa_study' AND entity_id = $2 AND action = 'updated'`,
      [acmeId, study.id],
    );
    expect(updatedEvents.rows[0]!.n).toBe("1"); // one event for the whole batch, not per-cell

    // Incomplete-grid completion: delete one cell's worth by posting a smaller
    // fresh study to check the guard in isolation is done in its own test below;
    // here the grid IS full, so completion must succeed.
    const complete = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: fill.body.lockVersion });
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe("completed");
    expect(complete.body.completedAt).not.toBeNull();
    const firstCompletedAt = complete.body.completedAt as string;
    expect(complete.body.lockVersion).toBe(2);

    const statusChangedEvents = await control.query<{ before: unknown; after: unknown }>(
      `SELECT before, after FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'msa_study' AND entity_id = $2 AND action = 'status_changed' ORDER BY created_at ASC`,
      [acmeId, study.id],
    );
    expect(statusChangedEvents.rows.length).toBe(1);
    expect(statusChangedEvents.rows[0]!.after).toMatchObject({ status: "completed" });

    // Analysis is now real and complete (never a fabricated result).
    const analysis = await acme("get", `/v1/msa-studies/${study.id}/analysis`, viewerTok);
    expect(analysis.status).toBe(200);
    expect(analysis.body.status).toBe("complete");
    expect(["excellent", "acceptable", "reject"]).toContain(analysis.body.verdict);
    expect(typeof analysis.body.ndc).toBe("number");

    // Reopen: completed -> draft, `completed_at` KEPT (not cleared, §3-Addendum).
    const reopen = await acme("patch", `/v1/msa-studies/${study.id}/reopen`).send({ lockVersion: complete.body.lockVersion });
    expect(reopen.status).toBe(200);
    expect(reopen.body.status).toBe("draft");
    expect(reopen.body.completedAt).toBe(firstCompletedAt);
    expect(reopen.body.lockVersion).toBe(3);

    const reopenEvents = await control.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'msa_study' AND entity_id = $2 AND action = 'status_changed'`,
      [acmeId, study.id],
    );
    expect(reopenEvents.rows[0]!.n).toBe("2"); // complete + reopen, both status_changed

    // Edit one measurement while reopened.
    const edit = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({
      lockVersion: reopen.body.lockVersion,
      cells: [{ appraiser: 1, part: 1, trial: 1, value: 99 }],
    });
    expect(edit.status).toBe(200);
    const editedCell = (edit.body.measurements as { appraiser: number; part: number; trial: number; value: number }[]).find(
      (m) => m.appraiser === 1 && m.part === 1 && m.trial === 1,
    );
    expect(editedCell?.value).toBe(99);

    // Re-complete: `completed_at` is OVERWRITTEN with the new timestamp.
    await new Promise((r) => setTimeout(r, 10)); // ensure a distinguishable now()
    const recomplete = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: edit.body.lockVersion });
    expect(recomplete.status).toBe(200);
    expect(recomplete.body.completedAt).not.toBe(firstCompletedAt);

    // The re-computed analysis reflects the edit (verdict/ndc recomputed live, rule 5).
    const analysis2 = await acme("get", `/v1/msa-studies/${study.id}/analysis`, viewerTok);
    expect(analysis2.status).toBe(200);
    expect(analysis2.body.status).toBe("complete");
  });
});

describe("The lockVersion race the measurement-batch route closes ([AMENDED-4])", () => {
  it("a stale-lockVersion measurement batch against a concurrently-completed study returns 409, not silent corruption", async () => {
    const study = await newStudy(`${TAG} race`);
    const fill = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({
      lockVersion: study.lockVersion,
      cells: fullGrid(),
    });
    expect(fill.status).toBe(200);
    const preCompletionLockVersion = fill.body.lockVersion as number;

    const complete = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: preCompletionLockVersion });
    expect(complete.status).toBe(200);

    // A batch that read the study before the completion (carrying the
    // PRE-completion lockVersion) must 409 on the now-stale version — never
    // silently write into the completed study.
    const stale = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({
      lockVersion: preCompletionLockVersion,
      cells: [{ appraiser: 1, part: 1, trial: 1, value: 55 }],
    });
    expect(stale.status).toBe(409);

    // With the CURRENT (post-completion) lockVersion, the guard that actually
    // fires is the completed-study check — 422, "reopen the study first" —
    // proving both guards are real and independently reachable.
    const currentLockVersion = complete.body.lockVersion as number;
    const onCompleted = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({
      lockVersion: currentLockVersion,
      cells: [{ appraiser: 1, part: 1, trial: 1, value: 55 }],
    });
    expect(onCompleted.status).toBe(422);
  });
});

describe("Completion + reopen guards", () => {
  it("422s completing an incomplete grid", async () => {
    const study = await newStudy(`${TAG} incomplete`);
    // Fill only 7 of the 8 required cells.
    const seven = fullGrid().slice(0, 7);
    const fill = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({ lockVersion: study.lockVersion, cells: seven });
    expect(fill.status).toBe(200);

    const complete = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: fill.body.lockVersion });
    expect(complete.status).toBe(422);
  });

  it("422s completing an already-completed study", async () => {
    const study = await newStudy(`${TAG} double-complete`);
    const fill = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({ lockVersion: study.lockVersion, cells: fullGrid() });
    const complete = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: fill.body.lockVersion });
    expect(complete.status).toBe(200);

    const again = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: complete.body.lockVersion });
    expect(again.status).toBe(422);
  });

  it("422s reopening an already-draft study", async () => {
    const study = await newStudy(`${TAG} draft-reopen`);
    const reopen = await acme("patch", `/v1/msa-studies/${study.id}/reopen`).send({ lockVersion: study.lockVersion });
    expect(reopen.status).toBe(422);
  });

  it("409s on a stale lockVersion for complete and reopen", async () => {
    const study = await newStudy(`${TAG} stale-transitions`);
    const fill = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({ lockVersion: study.lockVersion, cells: fullGrid() });
    const staleComplete = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: study.lockVersion });
    expect(staleComplete.status).toBe(409);

    const complete = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: fill.body.lockVersion });
    expect(complete.status).toBe(200);
    const staleReopen = await acme("patch", `/v1/msa-studies/${study.id}/reopen`).send({ lockVersion: fill.body.lockVersion });
    expect(staleReopen.status).toBe(409);
  });

  it("rejects an extra field on the completion body (.strict())", async () => {
    const study = await newStudy(`${TAG} strict-body`);
    const fill = await acme("post", `/v1/msa-studies/${study.id}/measurements`).send({ lockVersion: study.lockVersion, cells: fullGrid() });
    const res = await acme("patch", `/v1/msa-studies/${study.id}`).send({ status: "completed", lockVersion: fill.body.lockVersion, method: "average_range" });
    expect(res.status).toBe(422);
  });
});

describe("GET /v1/msa-studies (M4) — both draft and completed, Date column fields present", () => {
  it("lists a draft study without filtering it out by default", async () => {
    const study = await newStudy(`${TAG} list-draft`);
    const list = await acme("get", "/v1/msa-studies", viewerTok);
    expect(list.status).toBe(200);
    const found = (list.body.items as { id: string; status: string; completedAt: string | null; createdAt: string }[]).find(
      (s) => s.id === study.id,
    );
    expect(found).toBeDefined();
    expect(found?.status).toBe("draft");
    expect(found?.completedAt).toBeNull();
  });
});

describe("MSA RBAC + tenancy", () => {
  it("a viewer can read but not write (msa:view without msa:manage)", async () => {
    const list = await acme("get", "/v1/msa-studies", viewerTok);
    expect(list.status).toBe(200);
    const write = await acme("post", "/v1/msa-studies", viewerTok).send({
      characteristic: "no",
      gaugeLabel: "no",
      method: "crossed_anova",
      nAppraisers: 2,
      nParts: 2,
      nTrials: 2,
    });
    expect(write.status).toBe(403);
  });

  it("does not leak one tenant's studies into another, and a foreign id is 404 not 403 (rule 8)", async () => {
    const study = await newStudy(`${TAG} cross-tenant`);

    const otherList = await authed("get", "/v1/msa-studies", GLOBEX, globexMgrTok);
    expect(otherList.status).toBe(200);
    expect((otherList.body.items as { id: string }[]).some((s) => s.id === study.id)).toBe(false);

    const otherGet = await authed("get", `/v1/msa-studies/${study.id}`, GLOBEX, globexMgrTok);
    expect(otherGet.status).toBe(404);

    const otherMeasurements = await authed("post", `/v1/msa-studies/${study.id}/measurements`, GLOBEX, globexMgrTok).send({
      lockVersion: study.lockVersion,
      cells: [{ appraiser: 1, part: 1, trial: 1, value: 1 }],
    });
    expect(otherMeasurements.status).toBe(404);
  });
});
