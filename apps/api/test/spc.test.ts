import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * SPC analytics (`/v1/spc`, table 0034). Pins: ingest needs `measurement:manage`
 * (an auditor — who has `spc:view` but not manage — 403s on ingest, 200s on the
 * chart); the computed chart returns X̄/R limits + capability + WE violations for
 * a drifting series; and one tenant never sees another's measurements (RLS).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const CHAR = "SPC Test Penetration";
const PART = "SPC-TEST-PART";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let managerTok = "";
let auditorTok = "";
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

function authed(method: "get" | "post", path: string, slug: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

/** 20 subgroups of 5, drifting up after subgroup 15 → guarantees a WE-1 point. */
function driftingPoints(): { value: number; subgroup: number }[] {
  const pts: { value: number; subgroup: number }[] = [];
  for (let i = 0; i < 20; i++) {
    const base = i > 15 ? 6.0 + (i - 15) * 0.4 : 6.0;
    for (let j = 0; j < 5; j++) pts.push({ value: base + (j - 2) * 0.05, subgroup: i });
  }
  return pts;
}

async function cleanup(): Promise<void> {
  for (const t of [acmeId, globexId]) {
    await withTenant(t, null, async (tx) => {
      await tx.query("DELETE FROM measurements WHERE part = $1", [PART]);
    });
  }
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);
  await cleanup();
  await seedMember(acmeId, "spc-mgr@acme.test", "manager");
  await seedMember(acmeId, "spc-auditor@acme.test", "auditor");
  await seedMember(globexId, "spc-mgr@globex.test", "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  managerTok = await token(ACME, "spc-mgr@acme.test");
  auditorTok = await token(ACME, "spc-auditor@acme.test");
  globexMgrTok = await token(GLOBEX, "spc-mgr@globex.test");
});

afterAll(async () => {
  await cleanup();
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'spc-%@%.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

function ingest(tok: string, slug: string) {
  return authed("post", "/v1/spc/measurements", slug, tok).send({
    part: PART,
    characteristic: CHAR,
    unit: "mm",
    usl: 7.0,
    lsl: 5.0,
    source: "manual",
    points: driftingPoints(),
  });
}

describe("ingest RBAC", () => {
  it("an auditor has spc:view but not measurement:manage — 403 on ingest", async () => {
    expect((await ingest(auditorTok, ACME)).status).toBe(403);
  });

  it("a manager can ingest", async () => {
    const res = await ingest(managerTok, ACME);
    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(100);
  });
});

describe("computed chart", () => {
  it("lists the characteristic and computes limits + capability + a WE violation", async () => {
    const list = await authed("get", "/v1/spc/characteristics", ACME, auditorTok);
    expect(list.status).toBe(200);
    expect((list.body.items as { characteristic: string }[]).some((c) => c.characteristic === CHAR)).toBe(true);

    const chart = await authed("get", "/v1/spc/chart", ACME, auditorTok).query({ part: PART, characteristic: CHAR });
    expect(chart.status).toBe(200);
    expect(chart.body.subgroupSize).toBe(5);
    expect(chart.body.points).toHaveLength(20);
    expect(chart.body.uclX).toBeGreaterThan(chart.body.centerLine);
    expect(chart.body.capability.cp).not.toBeNull();
    // The drift past subgroup 15 pushes points beyond +3σ → a WE-1 violation.
    expect((chart.body.violations as { rule: string }[]).some((v) => v.rule === "WE-1")).toBe(true);
  });

  it("404s a characteristic with no data", async () => {
    const res = await authed("get", "/v1/spc/chart", ACME, auditorTok).query({ part: "nope", characteristic: "nope" });
    expect(res.status).toBe(404);
  });
});

describe("tenancy", () => {
  it("does not leak one tenant's measurements into another (RLS)", async () => {
    const other = await authed("get", "/v1/spc/chart", GLOBEX, globexMgrTok).query({ part: PART, characteristic: CHAR });
    expect(other.status).toBe(404); // globex has no such measurements
    const list = await authed("get", "/v1/spc/characteristics", GLOBEX, globexMgrTok);
    expect((list.body.items as { characteristic: string }[]).some((c) => c.characteristic === CHAR)).toBe(false);
  });
});
