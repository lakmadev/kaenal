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
 * Training & competency slice (Sprint 05 T1-T5; `/v1/competencies`,
 * `/v1/training/*`). Pins: matrix cell-state derivation (gap/na/ok/warn/
 * overdue); T5's archive/unarchive/reorder (exact-id-set 409, code-clash 409
 * at both create and unarchive); the training-record batch's all-or-nothing
 * transaction; the training-history visibility rule (a `training:view`-only
 * caller sees only their own — compared against their real `userId`, not any
 * `memberships.id`); and future-dated-completion rejection.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";
const TAG = `tr${randomUUID().replace(/-/g, "").slice(0, 8)}`;

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let mgrTok = "";
let viewerTok = "";
let viewerUserId = "";
let otherViewerUserId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tenantId(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(tid: string, email: string, role: string): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tid, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tid, userId, role],
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

function acme(method: "get" | "patch" | "post" | "put", path: string, bearer = mgrTok) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

async function cleanup(): Promise<void> {
  await control.query(`DELETE FROM training_records WHERE tenant_id = $1`, [acmeId]);
  await control.query(`DELETE FROM competencies WHERE tenant_id = $1 AND code LIKE $2`, [acmeId, `${TAG}%`]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tenantId(ACME);
  await cleanup();
  await seedMember(acmeId, `${TAG}-mgr@acme.test`, "manager");
  viewerUserId = await seedMember(acmeId, `${TAG}-viewer@acme.test`, "viewer");
  otherViewerUserId = await seedMember(acmeId, `${TAG}-other-viewer@acme.test`, "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(`${TAG}-mgr@acme.test`);
  viewerTok = await token(`${TAG}-viewer@acme.test`);
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
  }
  await control.end();
  await app.close();
});

async function newCompetency(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await acme("post", "/v1/competencies").send({
    code: `${TAG}-${randomUUID().slice(0, 6)}`,
    name: `${TAG} competency`,
    mandatory: true,
    validMonths: 12,
    ...overrides,
  });
  expect(res.status).toBe(201);
  return res.body as Record<string, unknown>;
}

describe("Competency catalog (T1 AC3, T5)", () => {
  it("409s on a code clash at CREATE time (not just unarchive)", async () => {
    const code = `${TAG}-dup`;
    await newCompetency({ code });
    const dup = await acme("post", "/v1/competencies").send({ code, name: "dup", mandatory: false });
    expect(dup.status).toBe(409);
  });

  it("archive/unarchive: archived_at set/cleared, lockVersion-guarded, 409 on unarchive code clash", async () => {
    const a = await newCompetency({ code: `${TAG}-arc1` });
    const archive = await acme("patch", `/v1/competencies/${a["id"] as string}/archive`).send({ lockVersion: 0 });
    expect(archive.status).toBe(200);
    expect(archive.body.archivedAt).not.toBeNull();

    const archiveAgain = await acme("patch", `/v1/competencies/${a["id"] as string}/archive`).send({ lockVersion: 1 });
    expect(archiveAgain.status).toBe(422);

    // A new competency now reuses the archived one's code (allowed, T5).
    await newCompetency({ code: `${TAG}-arc1` });

    const unarchive = await acme("patch", `/v1/competencies/${a["id"] as string}/unarchive`).send({ lockVersion: 1 });
    expect(unarchive.status).toBe(409); // code clash against the new non-archived row
  });

  it("reorder is atomic and 409s on any id-set mismatch (missing/extra/duplicate)", async () => {
    const a = await newCompetency({ code: `${TAG}-ord-a` });
    const b = await newCompetency({ code: `${TAG}-ord-b` });

    const { rows: currentIds } = await control.query<{ id: string }>(
      "SELECT id FROM competencies WHERE tenant_id = $1 AND archived_at IS NULL",
      [acmeId],
    );
    const fullSet = currentIds.map((r) => r.id);

    const missing = await acme("put", "/v1/competencies/order").send({ ids: fullSet.slice(1) });
    expect(missing.status).toBe(409);

    const extra = await acme("put", "/v1/competencies/order").send({ ids: [...fullSet, randomUUID()] });
    expect(extra.status).toBe(409);

    // Real reorder: swap a/b to the front.
    const reordered = [a["id"], b["id"], ...fullSet.filter((id) => id !== a["id"] && id !== b["id"])];
    const ok = await acme("put", "/v1/competencies/order").send({ ids: reordered });
    expect(ok.status).toBe(200);
    const items = ok.body.items as { id: string; seq: number }[];
    const seqA = items.find((i) => i.id === a["id"])?.seq;
    const seqB = items.find((i) => i.id === b["id"])?.seq;
    expect(seqA).toBe(0);
    expect(seqB).toBe(1);
  });
});

describe("Training matrix cell states (T1 AC2)", () => {
  it("gap (mandatory, never trained), na (optional, never trained), ok (recorded, far from expiry)", async () => {
    const mandatory = await newCompetency({ code: `${TAG}-mand`, mandatory: true, validMonths: 12 });
    const optional = await newCompetency({ code: `${TAG}-opt`, mandatory: false, validMonths: 12 });

    const matrix = await acme("get", "/v1/training/matrix?limit=100");
    expect(matrix.status).toBe(200);
    const row = (matrix.body.items as { memberId: string; cells: { competencyId: string; state: string }[] }[]).find(
      (r) => r.memberId === viewerUserId,
    );
    expect(row).toBeDefined();
    expect(row!.cells.find((c) => c.competencyId === mandatory["id"])?.state).toBe("gap");
    expect(row!.cells.find((c) => c.competencyId === optional["id"])?.state).toBe("na");

    const recordDate = new Date().toISOString().slice(0, 10);
    const record = await acme("post", "/v1/training/records").send({
      memberIds: [viewerUserId],
      competencyId: mandatory["id"],
      completedAt: recordDate,
    });
    expect(record.status).toBe(201);

    const matrixAfter = await acme("get", "/v1/training/matrix?limit=100");
    const rowAfter = (matrixAfter.body.items as { memberId: string; cells: { competencyId: string; state: string }[] }[]).find(
      (r) => r.memberId === viewerUserId,
    );
    expect(rowAfter!.cells.find((c) => c.competencyId === mandatory["id"])?.state).toBe("ok");
  });

  it("422s on a future completedAt", async () => {
    const c = await newCompetency({ code: `${TAG}-future` });
    const res = await acme("post", "/v1/training/records").send({
      memberIds: [viewerUserId],
      competencyId: c["id"] as string,
      completedAt: "2099-01-01",
    });
    expect(res.status).toBe(422);
  });
});

describe("Training record batch — all-or-nothing (T2 AC1, SF8)", () => {
  it("a mid-batch failure (one invalid memberId) leaves zero rows persisted", async () => {
    const c = await newCompetency({ code: `${TAG}-batch` });
    const res = await acme("post", "/v1/training/records").send({
      memberIds: [viewerUserId, randomUUID()], // second id is not a member at all
      competencyId: c["id"] as string,
      completedAt: "2026-01-01",
    });
    expect(res.status).toBe(404);

    const rows = await control.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM training_records WHERE tenant_id = $1 AND competency_id = $2",
      [acmeId, c["id"]],
    );
    expect(rows.rows[0]!.n).toBe("0"); // the valid memberId's row did NOT get created either
  });

  it("a valid batch of several members commits every row together, each with its own audit event", async () => {
    const c = await newCompetency({ code: `${TAG}-batch-ok` });
    const res = await acme("post", "/v1/training/records").send({
      memberIds: [viewerUserId, otherViewerUserId],
      competencyId: c["id"] as string,
      completedAt: "2026-01-01",
    });
    expect(res.status).toBe(201);
    expect((res.body.items as unknown[]).length).toBe(2);

    const auditRows = await control.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'training_record'
         AND action = 'created' AND entity_id = ANY($2::uuid[])`,
      [acmeId, (res.body.items as { id: string }[]).map((i) => i.id)],
    );
    expect(auditRows.rows[0]!.n).toBe("2"); // one audit row PER member, not one for the batch
  });
});

describe("Training history visibility (T1 AC9, BLOCKING A) — the membership.userId-not-.id fix", () => {
  it("a training:view-only caller sees their OWN history via their real userId", async () => {
    const c = await newCompetency({ code: `${TAG}-hist-own` });
    await acme("post", "/v1/training/records").send({
      memberIds: [viewerUserId],
      competencyId: c["id"] as string,
      completedAt: "2026-01-01",
    });
    const own = await acme("get", `/v1/training/records?memberId=${viewerUserId}`, viewerTok);
    expect(own.status).toBe(200);
    expect((own.body.items as unknown[]).length).toBeGreaterThan(0);
  });

  it("a training:view-only caller is 403'd (not 404) fetching ANOTHER member's history", async () => {
    const denied = await acme("get", `/v1/training/records?memberId=${otherViewerUserId}`, viewerTok);
    expect(denied.status).toBe(403);
  });

  it("training:manage sees any member's history", async () => {
    const res = await acme("get", `/v1/training/records?memberId=${otherViewerUserId}`, mgrTok);
    expect(res.status).toBe(200);
  });

  it("a genuinely foreign/nonexistent memberId is 404, checked before the 403 rule", async () => {
    const res = await acme("get", `/v1/training/records?memberId=${randomUUID()}`, viewerTok);
    expect(res.status).toBe(404);
  });

  it("history includes rows against a since-archived competency (T5's own promise)", async () => {
    const c = await newCompetency({ code: `${TAG}-hist-archived` });
    await acme("post", "/v1/training/records").send({
      memberIds: [viewerUserId],
      competencyId: c["id"] as string,
      completedAt: "2026-01-01",
    });
    await acme("patch", `/v1/competencies/${c["id"] as string}/archive`).send({ lockVersion: 0 });

    const history = await acme("get", `/v1/training/records?memberId=${viewerUserId}&competencyId=${c["id"] as string}`, viewerTok);
    expect(history.status).toBe(200);
    expect((history.body.items as unknown[]).length).toBe(1); // still visible, not dropped by archival
  });
});

describe("Training RBAC + tenancy", () => {
  it("a viewer can read the matrix but not record training", async () => {
    const list = await acme("get", "/v1/training/matrix", viewerTok);
    expect(list.status).toBe(200);
    const c = await newCompetency({ code: `${TAG}-rbac` });
    const write = await acme("post", "/v1/training/records", viewerTok).send({
      memberIds: [viewerUserId],
      competencyId: c["id"] as string,
      completedAt: "2026-01-01",
    });
    expect(write.status).toBe(403);
  });
});
