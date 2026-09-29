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
 * Audits slice (02 §2, 03 §3). The audit lifecycle (planned → … → closed,
 * forward-only), findings recorded against an audit, and the corrective seam:
 * an audit finding can raise an NCR or a CAPA, linking them — the same pattern
 * as inspection findings, exercised here end to end. Plus plant scoping and the
 * RBAC split (auditors manage; inspectors/viewers only view).
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let plantA = "";
let plantB = "";
let auditorTok = "";
let inspectorTok = ""; // scoped to plantA
let viewerTok = "";
let auditorId = "";
let inspectorId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

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
    await tx.query(`INSERT INTO plants (id, tenant_id, name, code, timezone) VALUES ($1,$2,$3,$4,'UTC')`, [id, acmeId, code, code]);
  });
  return id;
}

async function token(email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post" | "patch", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

interface ChecklistItem {
  id: string;
  clause: string;
  section: string;
  status: string;
  findingId: string | null;
}

interface Audit {
  id: string;
  code: string;
  status: string;
  lockVersion: number;
  checklist: ChecklistItem[];
  progress: number;
  closedAt: string | null;
  findingsSummary: { major: number; minor: number; opportunity: number };
}

async function createAudit(plantId?: string, extra: Record<string, unknown> = {}): Promise<Audit> {
  const res = await authed("post", "/v1/audits", auditorTok).send({
    title: "AUDITTEST IATF surveillance",
    type: "certification",
    standard: "IATF 16949:2016",
    ...(plantId ? { plantId } : {}),
    ...extra,
  });
  expect(res.status).toBe(201);
  return res.body as Audit;
}

async function aFinding(auditId: string): Promise<{ id: string }> {
  const res = await authed("post", `/v1/audits/${auditId}/findings`, auditorTok).send({
    kind: "major_nc",
    clause: "8.5.1",
    description: "AUDITTEST control plan not followed on line 3",
  });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  plantA = await seedPlant("AUDTESTPA");
  plantB = await seedPlant("AUDTESTPB");
  auditorId = await seedMember("aud-auditor@acme.test", "auditor", []);
  inspectorId = await seedMember("aud-inspector@acme.test", "inspector", [plantA]);
  await seedMember("aud-viewer@acme.test", "viewer", []);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  auditorTok = await token("aud-auditor@acme.test");
  inspectorTok = await token("aud-inspector@acme.test");
  viewerTok = await token("aud-viewer@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'aud-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query(
    "UPDATE audit_findings SET ncr_id = NULL, capa_id = NULL WHERE audit_id IN (SELECT id FROM audits WHERE title LIKE 'AUDITTEST%')",
  );
  await control.query("DELETE FROM audit_findings WHERE audit_id IN (SELECT id FROM audits WHERE title LIKE 'AUDITTEST%')");
  await control.query("DELETE FROM notifications WHERE kind = 'audit_assigned'");
  await control.query("DELETE FROM audits WHERE title LIKE 'AUDITTEST%'");
  // Narrowed to AUDITTEST-derived rows only — the broader '%audit finding%'
  // pattern also matched the demo seed's own audit-finding CAPA once
  // `seed-demo.ts` has run against this DB, and deleting a still-referenced
  // seeded row violated its FK.
  await control.query("DELETE FROM capas WHERE title LIKE '%AUDITTEST%'");
  await control.query("DELETE FROM ncrs WHERE title LIKE '%AUDITTEST%'");
  await control.query("DELETE FROM plants WHERE code LIKE 'AUDTESTP%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("audit lifecycle", () => {
  it("schedules an audit and advances it one phase at a time", async () => {
    let audit = await createAudit();
    expect(audit.status).toBe("planned");
    expect(audit.code).toMatch(/^AUD-\d{4}-\d+$/);

    for (const to of ["preparation", "fieldwork", "reporting", "closed"]) {
      const res = await authed("post", `/v1/audits/${audit.id}/advance`, auditorTok).send({ to, version: audit.lockVersion });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(to);
      audit = res.body as Audit;
    }
  });

  it("refuses to skip a phase", async () => {
    const audit = await createAudit();
    const skip = await authed("post", `/v1/audits/${audit.id}/advance`, auditorTok).send({ to: "fieldwork", version: audit.lockVersion });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("rejects a stale advance", async () => {
    const audit = await createAudit();
    const res = await authed("post", `/v1/audits/${audit.id}/advance`, auditorTok).send({ to: "preparation", version: audit.lockVersion + 3 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_WRITE");
    expect(res.body.error.details).toMatchObject({
      expected: audit.lockVersion + 3,
      updatedBy: { id: expect.any(String), name: expect.any(String) },
    });
    expect(new Date(res.body.error.details.updatedAt as string).toISOString()).toBe(res.body.error.details.updatedAt);
  });
});

describe("findings → NCR / CAPA", () => {
  it("records a finding and raises an NCR from it (linking)", async () => {
    const audit = await createAudit();
    const finding = await aFinding(audit.id);

    const ncr = await authed("post", `/v1/audit-findings/${finding.id}/raise-ncr`, auditorTok).send({ priority: "major" });
    expect(ncr.status).toBe(201);
    expect(ncr.body.source).toBe("audit");
    expect(ncr.body.sourceId).toBe(finding.id);

    const findings = await authed("get", `/v1/audits/${audit.id}/findings`, auditorTok);
    const linked = (findings.body.items as { id: string; ncrId: string | null }[]).find((f) => f.id === finding.id);
    expect(linked?.ncrId).toBe(ncr.body.id);

    // No second NCR from the same finding.
    const dup = await authed("post", `/v1/audit-findings/${finding.id}/raise-ncr`, auditorTok).send({ priority: "minor" });
    expect(dup.status).toBe(409);

    const { rows } = await control.query<{ before: { ncrId?: string | null }; after: { ncrId?: string | null } }>(
      `SELECT before, after FROM audit_events
        WHERE tenant_id = $1 AND entity_kind = 'audit_finding' AND entity_id = $2 AND action = 'updated'
        ORDER BY created_at DESC LIMIT 1`,
      [acmeId, finding.id],
    );
    expect(rows[0]?.before).toEqual({ ncrId: null });
    expect(rows[0]?.after).toEqual({ ncrId: ncr.body.id });
  });

  it("raises a CAPA from a finding (linking)", async () => {
    const audit = await createAudit();
    const finding = await aFinding(audit.id);

    const capa = await authed("post", `/v1/audit-findings/${finding.id}/raise-capa`, auditorTok).send({ type: "corrective", priority: "major" });
    expect(capa.status).toBe(201);
    expect(capa.body.sourceKind).toBe("audit_finding");
    expect(capa.body.sourceId).toBe(finding.id);

    const findings = await authed("get", `/v1/audits/${audit.id}/findings`, auditorTok);
    const linked = (findings.body.items as { id: string; capaId: string | null }[]).find((f) => f.id === finding.id);
    expect(linked?.capaId).toBe(capa.body.id);
  });
});

describe("RBAC + scoping", () => {
  it("lets an auditor manage but an inspector only view, and a viewer neither", async () => {
    const inspectorCreate = await authed("post", "/v1/audits", inspectorTok).send({ title: "AUDITTEST nope", type: "internal" });
    expect(inspectorCreate.status).toBe(403);

    const audit = await createAudit();
    const viewerRead = await authed("get", `/v1/audits/${audit.id}`, viewerTok);
    expect(viewerRead.status).toBe(200);
    const viewerCreate = await authed("post", "/v1/audits", viewerTok).send({ title: "AUDITTEST nope2", type: "internal" });
    expect(viewerCreate.status).toBe(403);
  });

  it("hides an out-of-scope audit from a plant-bound inspector as a 404", async () => {
    const audit = await createAudit(plantB);
    const get = await authed("get", `/v1/audits/${audit.id}`, inspectorTok);
    expect(get.status).toBe(404);
  });
});

describe("AuditType enum (S2-3 AC3)", () => {
  it("accepts the corrected 5 values and rejects the removed 'process' value", async () => {
    for (const type of ["internal", "supplier", "customer", "gap", "certification"]) {
      const res = await authed("post", "/v1/audits", auditorTok).send({ title: `AUDITTEST type ${type}`, type });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe(type);
    }
    const removed = await authed("post", "/v1/audits", auditorTok).send({ title: "AUDITTEST removed type", type: "process" });
    expect(removed.status).toBe(422);
  });
});

describe("foreign / invalid ids → 404 (S2-3 UC, rule 8)", () => {
  it("404s on a foreign plantId, leadAuditorId, team member, or auditee", async () => {
    const bogus = randomUUID();
    const badPlant = await authed("post", "/v1/audits", auditorTok).send({ title: "AUDITTEST bad plant", type: "internal", plantId: bogus });
    expect(badPlant.status).toBe(404);

    const badLead = await authed("post", "/v1/audits", auditorTok).send({ title: "AUDITTEST bad lead", type: "internal", leadAuditorId: bogus });
    expect(badLead.status).toBe(404);

    const badTeam = await authed("post", "/v1/audits", auditorTok).send({ title: "AUDITTEST bad team", type: "internal", team: [bogus] });
    expect(badTeam.status).toBe(404);

    const badAuditee = await authed("post", "/v1/audits", auditorTok).send({ title: "AUDITTEST bad auditee", type: "internal", auditeeIds: [bogus] });
    expect(badAuditee.status).toBe(404);
  });
});

describe("create: idempotency + notifications (S2-3 AC4/AC5)", () => {
  it("double-submit with the same Idempotency-Key creates exactly one audit", async () => {
    const key = `aud-idem-${randomUUID()}`;
    const first = await authed("post", "/v1/audits", auditorTok)
      .set("Idempotency-Key", key)
      .send({ title: "AUDITTEST idempotent", type: "internal" });
    expect(first.status).toBe(201);

    const second = await authed("post", "/v1/audits", auditorTok)
      .set("Idempotency-Key", key)
      .send({ title: "AUDITTEST idempotent", type: "internal" });
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);

    const { rows } = await control.query<{ count: string }>(
      "SELECT count(*) FROM audits WHERE title = 'AUDITTEST idempotent'",
    );
    expect(Number(rows[0]?.count)).toBe(1);
  });

  it("notifies the lead auditor and every team/auditee member regardless of role", async () => {
    // The inspector is BOTH an auditee and (separately) a team member here —
    // notifications must reach them either way, never suppressed by role
    // (architecture review §8 item 1 / PO resolution §8a item 1).
    const audit = await createAudit(undefined, {
      leadAuditorId: auditorId,
      team: [inspectorId],
      auditeeIds: [inspectorId],
    });
    expect(audit).toBeTruthy();

    const { rows } = await control.query<{ title: string }>(
      "SELECT title FROM notifications WHERE kind = 'audit_assigned' AND user_id = $1",
      [inspectorId],
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("audit checklist (S2-4)", () => {
  it("seeds the IATF bank on create, all pending", async () => {
    const audit = await createAudit();
    expect(audit.checklist.length).toBe(12);
    expect(audit.checklist.every((i) => i.status === "pending")).toBe(true);
    expect(audit.progress).toBe(0);
  });

  it("scores an item, auto-links a finding on the same transaction, and keeps the finding on re-score", async () => {
    const audit = await createAudit();
    const item = audit.checklist[0]!;

    const scored = await authed("patch", `/v1/audits/${audit.id}/checklist/${item.id}`, auditorTok)
      .send({ status: "major_nc", version: audit.lockVersion });
    expect(scored.status).toBe(200);
    const scoredAudit = scored.body as Audit;
    const scoredItem = scoredAudit.checklist.find((i) => i.id === item.id)!;
    expect(scoredItem.status).toBe("major_nc");
    expect(scoredItem.findingId).not.toBeNull();
    expect(scoredAudit.progress).toBeCloseTo(1 / 12, 5);
    expect(scoredAudit.findingsSummary.major).toBe(1);

    const findings = await authed("get", `/v1/audits/${audit.id}/findings`, auditorTok);
    const linked = (findings.body.items as { id: string; kind: string }[]).find((f) => f.id === scoredItem.findingId);
    expect(linked?.kind).toBe("major_nc");

    // Re-scoring back to conformant does NOT delete the finding it already spawned.
    const rescored = await authed("patch", `/v1/audits/${audit.id}/checklist/${item.id}`, auditorTok)
      .send({ status: "conformant", version: scoredAudit.lockVersion });
    expect(rescored.status).toBe(200);
    const rescoredItem = (rescored.body as Audit).checklist.find((i) => i.id === item.id)!;
    expect(rescoredItem.status).toBe("conformant");
    expect(rescoredItem.findingId).toBe(scoredItem.findingId);

    const findingsAfter = await authed("get", `/v1/audits/${audit.id}/findings`, auditorTok);
    expect((findingsAfter.body.items as unknown[]).some((f) => (f as { id: string }).id === scoredItem.findingId)).toBe(true);
  });

  it("rejects a stale checklist score with 409", async () => {
    const audit = await createAudit();
    const item = audit.checklist[0]!;
    const res = await authed("patch", `/v1/audits/${audit.id}/checklist/${item.id}`, auditorTok)
      .send({ status: "conformant", version: audit.lockVersion + 3 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_WRITE");
  });

  it("refuses to score a checklist item on a closed audit with 422", async () => {
    let audit = await createAudit();
    for (const to of ["preparation", "fieldwork", "reporting", "closed"]) {
      const res = await authed("post", `/v1/audits/${audit.id}/advance`, auditorTok).send({ to, version: audit.lockVersion });
      expect(res.status).toBe(200);
      audit = res.body as Audit;
    }
    expect(audit.closedAt).not.toBeNull();

    const item = audit.checklist[0]!;
    const res = await authed("patch", `/v1/audits/${audit.id}/checklist/${item.id}`, auditorTok)
      .send({ status: "conformant", version: audit.lockVersion });
    expect(res.status).toBe(422);
  });

  it("a view-only role cannot score (403), and a foreign audit id 404s", async () => {
    const audit = await createAudit();
    const item = audit.checklist[0]!;
    const forbidden = await authed("patch", `/v1/audits/${audit.id}/checklist/${item.id}`, viewerTok)
      .send({ status: "conformant", version: audit.lockVersion });
    expect(forbidden.status).toBe(403);

    const foreign = await authed("patch", `/v1/audits/${randomUUID()}/checklist/${item.id}`, auditorTok)
      .send({ status: "conformant", version: 0 });
    expect(foreign.status).toBe(404);
  });
});

describe("frequency + stats (S2-1)", () => {
  it("GET /v1/audits/frequency returns 6 months of per-type counts", async () => {
    await createAudit();
    const res = await authed("get", "/v1/audits/frequency", auditorTok);
    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(6);
    for (const point of res.body.points) {
      expect(typeof point.month).toBe("string");
      expect(typeof point.counts.internal).toBe("number");
    }
    const thisMonth = res.body.points[5];
    expect(thisMonth.counts.certification).toBeGreaterThanOrEqual(1);
  });

  it("GET /v1/audits/stats returns the KPI strip shape", async () => {
    await createAudit();
    const res = await authed("get", "/v1/audits/stats", auditorTok);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      active: expect.any(Number),
      plannedNext90d: expect.any(Number),
      completedYtd: expect.any(Number),
      openFindings: expect.any(Number),
    });
    expect(res.body.active).toBeGreaterThanOrEqual(1);
  });
});
