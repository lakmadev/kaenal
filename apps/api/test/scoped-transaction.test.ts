import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { currentContext, currentTx } from "../src/context.js";
import { RequireCapability } from "../src/decorators.js";
import { AUTHENTICATOR } from "../src/tokens.js";
import type { Authenticator, Session } from "../src/auth/authenticator.js";

/**
 * Steps 3–5 of the lifecycle (01 §3.3).
 *
 * The lifecycle's central claim is that a handler always runs inside a
 * transaction with `app.tenant_id` already bound — i.e. under RLS. The
 * lifecycle tests cannot reach a handler at all while authentication is
 * unimplemented, so this file swaps in a stub authenticator and probes what
 * the handler actually sees.
 *
 * The stub is the ONLY thing replaced. Tenant resolution, the transaction and
 * the RBAC guard are the real ones.
 */

const ACME = "acme";
const GLOBEX = "globex";
const STUB_USER = "019f0000-0000-7000-8000-0000000000f1";
const PROBE_PLANT_CODE = "PROBE-PLANT";

let role: "admin" | "viewer" = "admin";

class StubAuthenticator implements Authenticator {
  authenticate(): Promise<Session | null> {
    return Promise.resolve({ userId: STUB_USER, membership: { role, plantIds: [] } });
  }
}

interface Probe {
  tenantSetting: string;
  userSetting: string;
  contextTenantId: string;
  inTransaction: boolean;
  visiblePlantCodes: string[];
}

@Controller("__probe")
class ProbeController {
  @Get("scope")
  async scope(): Promise<Probe> {
    const tx = currentTx();
    const ctx = currentContext();

    const settings = await tx.query<{ tenant: string; user: string; xact: string }>(
      `SELECT current_setting('app.tenant_id') AS tenant,
              current_setting('app.user_id')   AS user,
              (txid_current_if_assigned() IS NOT NULL
                 OR now() = statement_timestamp())::text AS xact`,
    );

    const plants = await tx.query<{ code: string }>("SELECT code FROM plants ORDER BY code");

    return {
      tenantSetting: settings.rows[0]?.tenant ?? "",
      userSetting: settings.rows[0]?.user ?? "",
      contextTenantId: ctx.tenantId,
      inTransaction: true,
      visiblePlantCodes: plants.rows.map((r) => r.code),
    };
  }

  @Get("admin-only")
  @RequireCapability("members:manage")
  adminOnly(): { ok: true } {
    return { ok: true };
  }
}

let app: INestApplication;
let control: pg.Pool;
let acmeId: string;

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const { rows } = await control.query<{ id: string }>(
    "SELECT id FROM control.tenants WHERE slug = $1",
    [ACME],
  );
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error(`Tenant '${ACME}' is not provisioned — run: pnpm provision-tenant --slug acme`);
  }
  acmeId = id;

  // Seed a plant this test owns, so the RLS-visibility assertion does not
  // depend on provisioning seed that a db-package test may have truncated
  // (control-identity truncates `plants`). Self-contained fixtures don't fail
  // on cross-package test ordering.
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'Probe Plant', $2)
       ON CONFLICT (tenant_id, code) DO NOTHING`,
      [acmeId, PROBE_PLANT_CODE],
    );
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [ProbeController],
  })
    .overrideProvider(AUTHENTICATOR)
    .useClass(StubAuthenticator)
    .compile();

  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await control.end();
  await app.close();
});

const server = (): Parameters<typeof request>[0] => app.getHttpServer() as never;

const probe = (slug: string): Promise<{ status: number; body: Probe }> =>
  request(server())
    .get("/__probe/scope")
    .set("X-Tenant-Id", slug)
    .then((res) => ({ status: res.status, body: res.body as Probe }));

describe("step 3 — the handler runs inside a tenant-scoped transaction", () => {
  it("binds app.tenant_id to the resolved tenant before the handler runs", async () => {
    const { status, body } = await probe(ACME);
    expect(status).toBe(200);
    expect(body.tenantSetting).toBe(acmeId);
    expect(body.contextTenantId).toBe(acmeId);
  });

  it("binds app.user_id to the authenticated user", async () => {
    const { body } = await probe(ACME);
    expect(body.userSetting).toBe(STUB_USER);
  });

  it("applies RLS to queries the handler makes", async () => {
    // Sees the plant this test seeded for acme. If the handler ran outside
    // withTenant, current_setting('app.tenant_id') would throw and this
    // request would 500 instead of returning acme's rows.
    const { body } = await probe(ACME);
    expect(body.visiblePlantCodes).toContain(PROBE_PLANT_CODE);
  });

  it("scopes two tenants' requests independently on a shared pool", async () => {
    // The leak that SET LOCAL exists to prevent: sequential requests borrowing
    // the same pooled connection must not inherit each other's tenant.
    const acme = await probe(ACME);
    const globex = await probe(GLOBEX);
    const acmeAgain = await probe(ACME);

    expect(globex.body.tenantSetting).not.toBe(acme.body.tenantSetting);
    expect(acmeAgain.body.tenantSetting).toBe(acme.body.tenantSetting);
  });

  it("keeps tenant scope correct under concurrent interleaved requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => probe(i % 2 === 0 ? ACME : GLOBEX)),
    );

    results.forEach((res, i) => {
      const expected = i % 2 === 0 ? acmeId : undefined;
      if (expected !== undefined) expect(res.body.tenantSetting).toBe(expected);
      else expect(res.body.tenantSetting).not.toBe(acmeId);
    });
  });
});

describe("step 4 — RBAC guard", () => {
  const adminOnly = (slug: string) =>
    request(server()).get("/__probe/admin-only").set("X-Tenant-Id", slug);

  it("allows a role holding the capability", async () => {
    role = "admin";
    const res = await adminOnly(ACME);
    expect(res.status).toBe(200);
  });

  it("denies a role without it, naming the capability (03 §3)", async () => {
    role = "viewer";
    const res = await adminOnly(ACME);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.details).toEqual({ required: "members:manage", role: "viewer" });
    role = "admin";
  });

  it("runs the guard after tenant resolution, so an unknown tenant still 404s", async () => {
    // Order matters: a 403 here would confirm the tenant exists.
    role = "viewer";
    const res = await adminOnly("no-such-tenant");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TENANT_NOT_FOUND");
    role = "admin";
  });
});
