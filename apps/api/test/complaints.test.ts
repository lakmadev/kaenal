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
 * Customer complaints slice (SPRINT-06 C1-C4; `/v1/complaints`). Pins: create/
 * read/edit under `complaint:view`/`complaint:manage` with optimistic
 * concurrency; a real `COM-YYYY-NNNN` code; attachment verification (tenant +
 * entity_kind='complaint' + sha256); acknowledge/close one-shot guards;
 * convert's discriminated union (create-NCR/link-existing-NCR/8D/CAPA) with
 * the real per-target capability gate (auditor: ncr:create yes, ncr:manage/
 * capa:manage no); the SELECT...FOR UPDATE convert race; always-audited
 * convert (even when status doesn't move); and RLS/rule-8 tenant isolation.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const TAG = `cm${randomUUID().replace(/-/g, "").slice(0, 8)}`;

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let mgrTok = "";
let auditorTok = "";
let viewerTok = "";
let inspectorTok = "";
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
  await control.query(`DELETE FROM complaint_attachments WHERE tenant_id = ANY($1)`, [[acmeId, globexId]]);
  await control.query(`DELETE FROM complaints WHERE tenant_id = ANY($1) AND subject LIKE $2`, [[acmeId, globexId], `${TAG}%`]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  mgrUserId = await seedMember(acmeId, `${TAG}-mgr@acme.test`, "manager");
  await seedMember(acmeId, `${TAG}-auditor@acme.test`, "auditor");
  await seedMember(acmeId, `${TAG}-viewer@acme.test`, "viewer");
  await seedMember(acmeId, `${TAG}-inspector@acme.test`, "inspector");
  await seedMember(globexId, `${TAG}-mgr@globex.test`, "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  mgrTok = await token(ACME, `${TAG}-mgr@acme.test`);
  auditorTok = await token(ACME, `${TAG}-auditor@acme.test`);
  viewerTok = await token(ACME, `${TAG}-viewer@acme.test`);
  inspectorTok = await token(ACME, `${TAG}-inspector@acme.test`);
  globexMgrTok = await token(GLOBEX, `${TAG}-mgr@globex.test`);
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE $1", [`${TAG}-%@%.test`])
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  } else {
    await control.query("SELECT $1::uuid", [randomUUID()]);
  }
  await control.end();
  await app.close();
});

async function newComplaint(overrides: Record<string, unknown> = {}): Promise<{ id: string; body: Record<string, unknown> }> {
  const res = await acme("post", "/v1/complaints").send({
    customer: `${TAG} Nordvolt AB`,
    contact: "Magnus Eriksson · Quality Manager",
    channel: "email_parsed",
    severity: "high",
    subject: `${TAG} field failure`,
    description: "Detail",
    ...overrides,
  });
  expect(res.status).toBe(201);
  return { id: res.body.id as string, body: res.body as Record<string, unknown> };
}

describe("Complaint CRUD + SLA denormalization (C1/C2)", () => {
  it("creates with a real COM-YYYY-NNNN code, denormalized SLA targets, and a computed customerColor", async () => {
    const { body } = await newComplaint({ severity: "critical" });
    expect(body["code"]).toMatch(/^COM-\d{4}-\d{4,}$/);
    expect(body["status"]).toBe("triage");
    expect(body["slaTargetHours"]).toBe(1); // critical
    expect(body["slaCloseTargetDays"]).toBe(14);
    expect(body["customerColor"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(body["acknowledgedAt"]).toBeNull();
    expect(body["ncrId"]).toBeNull();
  });

  it("rejects a create without complaint:manage (viewer)", async () => {
    const res = await acme("post", "/v1/complaints", viewerTok).send({
      customer: `${TAG} X`,
      contact: "Someone",
      channel: "phone",
      severity: "low",
      subject: `${TAG} x`,
    });
    expect(res.status).toBe(403);
  });

  it("inspector holds neither complaint:view nor complaint:manage — 403 on list", async () => {
    const res = await acme("get", "/v1/complaints", inspectorTok);
    expect(res.status).toBe(403);
  });

  it("lists, reads, and edits with optimistic concurrency; severity change re-derives SLA targets", async () => {
    const { id } = await newComplaint({ severity: "low" });

    const list = await acme("get", "/v1/complaints", viewerTok);
    expect(list.status).toBe(200);

    const got = await acme("get", `/v1/complaints/${id}`, viewerTok);
    expect(got.body.lockVersion).toBe(0);

    const edit = await acme("patch", `/v1/complaints/${id}`).send({ severity: "critical", lockVersion: 0 });
    expect(edit.status).toBe(200);
    expect(edit.body.slaTargetHours).toBe(1);
    expect(edit.body.slaCloseTargetDays).toBe(14);
    expect(edit.body.lockVersion).toBe(1);

    const stale = await acme("patch", `/v1/complaints/${id}`).send({ severity: "medium", lockVersion: 0 });
    expect(stale.status).toBe(409);
  });

  it("remains editable after closed (§0 S4 — no terminal freeze)", async () => {
    const { id } = await newComplaint();
    const closed = await acme("post", `/v1/complaints/${id}/close`).send({ lockVersion: 0 });
    expect(closed.status).toBe(200);
    const edit = await acme("patch", `/v1/complaints/${id}`).send({ subject: `${TAG} edited after close`, lockVersion: 1 });
    expect(edit.status).toBe(200);
  });

  it("cross-tenant complaint id -> 404, never 403 (rule 8)", async () => {
    const { id } = await newComplaint();
    const res = await request(server())
      .get(`/v1/complaints/${id}`)
      .set("X-Tenant-Id", GLOBEX)
      .set("Authorization", `Bearer ${globexMgrTok}`);
    expect(res.status).toBe(404);
  });

  it("attaches verified files at create (C2 AC1) and rejects a file tagged for the wrong entity_kind", async () => {
    const goodFileId = randomUUID();
    const badFileId = randomUUID();
    await withTenant(acmeId, null, (tx) =>
      tx.query(
        `INSERT INTO files (id, tenant_id, bucket, key, filename, mime, size_bytes, scan_status, sha256, entity_kind, created_by, updated_by)
         VALUES ($1,$2,'kaenal',$3,'evidence.jpg','image/jpeg',10,'clean','deadbeef','complaint',$4,$4)`,
        [goodFileId, acmeId, `complaints/${goodFileId}`, mgrUserId],
      ),
    );
    await withTenant(acmeId, null, (tx) =>
      tx.query(
        `INSERT INTO files (id, tenant_id, bucket, key, filename, mime, size_bytes, scan_status, sha256, entity_kind, created_by, updated_by)
         VALUES ($1,$2,'kaenal',$3,'wrong.jpg','image/jpeg',10,'clean','deadbeef','calibration_event',$4,$4)`,
        [badFileId, acmeId, `wrong/${badFileId}`, mgrUserId],
      ),
    );

    const good = await newComplaint({ attachmentFileIds: [goodFileId] });
    const { rows } = await control.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM complaint_attachments WHERE complaint_id = $1",
      [good.id],
    );
    expect(rows[0]!.n).toBe("1");

    const bad = await acme("post", "/v1/complaints").send({
      customer: `${TAG} bad`,
      contact: "Someone",
      channel: "phone",
      severity: "low",
      subject: `${TAG} bad attachment`,
      attachmentFileIds: [badFileId],
    });
    expect(bad.status).toBe(422);
  });
});

describe("Acknowledge / Close (C3)", () => {
  it("acknowledge sets acknowledgedAt once, 422 on a second attempt", async () => {
    const { id } = await newComplaint();
    const first = await acme("post", `/v1/complaints/${id}/acknowledge`).send({ lockVersion: 0 });
    expect(first.status).toBe(200);
    expect(first.body.acknowledgedAt).not.toBeNull();

    const second = await acme("post", `/v1/complaints/${id}/acknowledge`).send({ lockVersion: 1 });
    expect(second.status).toBe(422);
  });

  it("close sets status=closed, 422 if already closed", async () => {
    const { id } = await newComplaint();
    const first = await acme("post", `/v1/complaints/${id}/close`).send({ lockVersion: 0 });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("closed");

    const second = await acme("post", `/v1/complaints/${id}/close`).send({ lockVersion: 1 });
    expect(second.status).toBe(422);
  });
});

describe("Convert to NCR/8D/CAPA (C4) — discriminated union, real capability gate, audit", () => {
  it("converts to a new NCR, advances status to investigation, audits status_changed", async () => {
    const { id } = await newComplaint({ severity: "high" });
    const res = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: 0 });
    expect(res.status).toBe(200);
    expect(res.body.complaint.status).toBe("investigation");
    expect(res.body.complaint.ncrId).toBeTruthy();
    expect(res.body.target.kind).toBe("ncr");

    const { rows } = await control.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'complaint'
         AND entity_id = $2 AND action = 'status_changed'`,
      [acmeId, id],
    );
    expect(rows[0]!.n).toBe("1");
  });

  it("a second convert to the same target (NCR already linked) 409s", async () => {
    const { id } = await newComplaint();
    const first = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: 0 });
    expect(first.status).toBe(200);
    const second = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: first.body.complaint.lockVersion });
    expect(second.status).toBe(409);
  });

  it("converting to a second target after the first still writes a complaint audit event even when status doesn't move backward (§0 B6d)", async () => {
    const { id } = await newComplaint();
    // capa outranks ncr, so convert straight to capa first...
    const toCapa = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "capa", lockVersion: 0, type: "corrective" });
    expect(toCapa.status).toBe(200);
    expect(toCapa.body.complaint.status).toBe("capa");

    // ...then convert to NCR: status stays "capa" (never regresses), but the
    // complaint must STILL get an audit event (updated, not status_changed).
    const toNcr = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: toCapa.body.complaint.lockVersion });
    expect(toNcr.status).toBe(200);
    expect(toNcr.body.complaint.status).toBe("capa"); // unchanged, never backward
    expect(toNcr.body.complaint.ncrId).toBeTruthy();

    const { rows } = await control.query<{ action: string }>(
      `SELECT action FROM audit_events WHERE tenant_id = $1 AND entity_kind = 'complaint' AND entity_id = $2 ORDER BY created_at`,
      [acmeId, id],
    );
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("status_changed"); // the capa convert
    expect(actions.filter((a) => a === "updated" || a === "status_changed").length).toBeGreaterThanOrEqual(2);
  });

  it("links to an EXISTING NCR without creating a new one (§0 B8c)", async () => {
    const created = await acme("post", "/v1/ncrs").send({ title: `${TAG} pre-existing NCR`, priority: "major" });
    expect(created.status).toBe(201);
    const { id } = await newComplaint();
    const res = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: 0, existingNcrId: created.body.id });
    expect(res.status).toBe(200);
    expect(res.body.target.id).toBe(created.body.id);
  });

  it("linking to a cross-tenant existingNcrId -> 404, never 403 (rule 8)", async () => {
    const foreign = await request(server())
      .post("/v1/ncrs")
      .set("X-Tenant-Id", GLOBEX)
      .set("Authorization", `Bearer ${globexMgrTok}`)
      .send({ title: `${TAG} globex ncr`, priority: "minor" });
    expect(foreign.status).toBe(201);

    const { id } = await newComplaint();
    const res = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: 0, existingNcrId: foreign.body.id });
    expect(res.status).toBe(404);
  });

  it("real per-target capability gate: auditor (ncr:create only) can convert to NCR but not 8D or CAPA", async () => {
    const { id: idForNcr } = await newComplaint();
    const toNcr = await acme("post", `/v1/complaints/${idForNcr}/convert`, auditorTok).send({ target: "ncr", lockVersion: 0 });
    expect(toNcr.status).toBe(200);

    const { id: idForEightD } = await newComplaint();
    const toEightD = await acme("post", `/v1/complaints/${idForEightD}/convert`, auditorTok).send({ target: "eight_d", lockVersion: 0 });
    expect(toEightD.status).toBe(403);

    const { id: idForCapa } = await newComplaint();
    const toCapa = await acme("post", `/v1/complaints/${idForCapa}/convert`, auditorTok).send({ target: "capa", lockVersion: 0, type: "corrective" });
    expect(toCapa.status).toBe(403);
  });

  it("already-closed complaint cannot convert (422 COMPLAINT_CLOSED, §0 B6b)", async () => {
    const { id } = await newComplaint();
    const closed = await acme("post", `/v1/complaints/${id}/close`).send({ lockVersion: 0 });
    expect(closed.status).toBe(200);
    const convert = await acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: closed.body.lockVersion });
    expect(convert.status).toBe(422);
  });

  it("convert-race: two concurrent converts to the same target, exactly one wins (SELECT...FOR UPDATE serializes, §0 B6a)", async () => {
    const { id } = await newComplaint();
    const [a, b] = await Promise.all([
      acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: 0 }),
      acme("post", `/v1/complaints/${id}/convert`).send({ target: "ncr", lockVersion: 0 }),
    ]);
    const statuses = [a.status, b.status].sort();
    // One succeeds (200); the other loses the row lock race and gets a real
    // error (409 stale lockVersion, or 409 CONFLICT if it observes the link
    // already set) — never a silent double-create/lost update.
    expect(statuses[0]).toBe(200);
    expect([409]).toContain(statuses[1]);

    const { rows } = await control.query<{ n: string }>("SELECT count(*)::text AS n FROM ncrs WHERE source = 'complaint' AND source_id = $1", [id]);
    expect(rows[0]!.n).toBe("1"); // exactly one NCR was ever created
  });
});
