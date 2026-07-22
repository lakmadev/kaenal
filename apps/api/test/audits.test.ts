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

function authed(method: "get" | "post", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

interface Audit {
  id: string;
  code: string;
  status: string;
  lockVersion: number;
}

async function createAudit(plantId?: string): Promise<Audit> {
  const res = await authed("post", "/v1/audits", auditorTok).send({
    title: "AUDITTEST IATF surveillance",
    type: "certification",
    standard: "IATF 16949:2016",
    ...(plantId ? { plantId } : {}),
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
  await seedMember("aud-auditor@acme.test", "auditor", []);
  await seedMember("aud-inspector@acme.test", "inspector", [plantA]);
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
  await control.query("UPDATE audit_findings SET ncr_id = NULL, capa_id = NULL WHERE description LIKE 'AUDITTEST%'");
  await control.query("DELETE FROM audit_findings WHERE description LIKE 'AUDITTEST%'");
  await control.query("DELETE FROM audits WHERE title LIKE 'AUDITTEST%'");
  await control.query("DELETE FROM capas WHERE title LIKE '%audit finding%'");
  await control.query("DELETE FROM ncrs WHERE title LIKE '%audit finding%'");
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
