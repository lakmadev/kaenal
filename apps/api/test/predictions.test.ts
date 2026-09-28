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
 * Predictive risk read API (Sprint 03 Part B, P2). Read-only end to end: no
 * POST/PATCH route exists (the nightly job owns the data). Covers
 * `prediction:view` gating (admin/manager/auditor only — an inspector 403s),
 * the ranked/paginated list, the per-subject detail (including the "exists
 * but not yet scored" vs. "doesn't exist at all" distinction), and the
 * cross-tenant 404 (rule 8, never a 403 that confirms existence elsewhere).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let managerTok = "";
let inspectorTok = "";
let plantId = "";
let scoredAreaId = "";
let unscoredAreaId = "";
let foreignAreaId = "";

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

function authed(method: "get", path: string, bearer: string, slug = ACME) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  await seedMember(acmeId, "pred-mgr@acme.test", "manager");
  await seedMember(acmeId, "pred-insp@acme.test", "inspector");

  await withTenant(acmeId, null, async (tx) => {
    const { rows: p } = await tx.query<{ id: string }>(
      `INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'PREDAPITEST Plant', $2) RETURNING id`,
      [acmeId, `PAT-${randomUUID().slice(0, 8)}`],
    );
    plantId = p[0]!.id;

    const { rows: a1 } = await tx.query<{ id: string }>(
      `INSERT INTO areas (tenant_id, plant_id, name) VALUES ($1, $2, 'PREDAPITEST Scored Line') RETURNING id`,
      [acmeId, plantId],
    );
    scoredAreaId = a1[0]!.id;

    const { rows: a2 } = await tx.query<{ id: string }>(
      `INSERT INTO areas (tenant_id, plant_id, name) VALUES ($1, $2, 'PREDAPITEST Unscored Line') RETURNING id`,
      [acmeId, plantId],
    );
    unscoredAreaId = a2[0]!.id;

    for (const horizon of ["2026-10", "2026-Q4", "2027-H1"]) {
      await tx.query(
        `INSERT INTO risk_predictions
           (tenant_id, subject_kind, subject_id, horizon, predicted_value, confidence,
            band_low, band_high, history, reasoning, model_version, generated_at)
         VALUES ($1, 'line', $2, $3, 5, 70, 2, 8, ARRAY[1,2,2,3,4,4]::numeric[], 'test row',
                 'nc-forecast-v1-baseline', now())`,
        [acmeId, scoredAreaId, horizon],
      );
    }
  });

  await withTenant(globexId, null, async (tx) => {
    const { rows: p } = await tx.query<{ id: string }>(
      `INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'PREDAPITEST Globex Plant', $2) RETURNING id`,
      [globexId, `PAT-GX-${randomUUID().slice(0, 8)}`],
    );
    const { rows: a } = await tx.query<{ id: string }>(
      `INSERT INTO areas (tenant_id, plant_id, name) VALUES ($1, $2, 'PREDAPITEST Globex Line') RETURNING id`,
      [globexId, p[0]!.id],
    );
    foreignAreaId = a[0]!.id;
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  managerTok = await token(ACME, "pred-mgr@acme.test");
  inspectorTok = await token(ACME, "pred-insp@acme.test");
});

afterAll(async () => {
  await control.query("DELETE FROM risk_predictions WHERE subject_id = ANY($1::uuid[])", [
    [scoredAreaId, unscoredAreaId, foreignAreaId],
  ]);
  await control.query("DELETE FROM areas WHERE name LIKE 'PREDAPITEST%'");
  await control.query("DELETE FROM plants WHERE name LIKE 'PREDAPITEST%'");
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'pred-%@acme.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("GET /v1/predictions", () => {
  it("requires prediction:view — an inspector is refused", async () => {
    const res = await authed("get", "/v1/predictions", inspectorTok);
    expect(res.status).toBe(403);
  });

  it("lists predictions for a manager, filterable by subjectKind", async () => {
    const res = await authed("get", "/v1/predictions?subjectKind=line&limit=100", managerTok);
    expect(res.status).toBe(200);
    const ids = (res.body.items as { id: string; subjectKind: string }[]).map((i) => i.subjectKind);
    expect(ids.every((k) => k === "line")).toBe(true);
    const ours = (res.body.items as { subjectId: string }[]).filter((i) => i.subjectId === scoredAreaId);
    expect(ours.length).toBe(3);
  });

  it("every row carries modelVersion and generatedAt (P2 AC2 — advisory, never unattributed)", async () => {
    const res = await authed("get", "/v1/predictions?subjectKind=line&limit=100", managerTok);
    const row = (res.body.items as { subjectId: string; modelVersion: string; generatedAt: string }[]).find(
      (i) => i.subjectId === scoredAreaId,
    );
    expect(row?.modelVersion).toBe("nc-forecast-v1-baseline");
    expect(row?.generatedAt).toBeTruthy();
  });
});

describe("GET /v1/predictions/:subjectKind/:id", () => {
  it("returns a scored subject's full horizon set", async () => {
    const res = await authed("get", `/v1/predictions/line/${scoredAreaId}`, managerTok);
    expect(res.status).toBe(200);
    expect(res.body.subjectName).toBe("PREDAPITEST Scored Line");
    expect((res.body.predictions as unknown[]).length).toBe(3);
  });

  it("returns an empty predictions array (not 404) for a real subject with no rows yet", async () => {
    const res = await authed("get", `/v1/predictions/line/${unscoredAreaId}`, managerTok);
    expect(res.status).toBe(200);
    expect(res.body.predictions).toEqual([]);
  });

  it("404s for a subject id that does not exist at all", async () => {
    const res = await authed("get", `/v1/predictions/line/${randomUUID()}`, managerTok);
    expect(res.status).toBe(404);
  });

  it("404s (never 403) for a foreign-tenant subject id (rule 8)", async () => {
    const res = await authed("get", `/v1/predictions/line/${foreignAreaId}`, managerTok);
    expect(res.status).toBe(404);
  });
});
