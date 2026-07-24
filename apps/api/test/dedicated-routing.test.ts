import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import Redis from "ioredis";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Model B routing end-to-end (01 §3.1 / §3.3 step 3). Before this slice a
 * `dedicated` tenant hit a hard "not implemented" 500 in the interceptor. Now:
 *
 *  - a dedicated tenant with a resolvable connection secret serves a normal
 *    authenticated request (its data lives in the database the secret points to,
 *    reached through the per-tenant pool, still under RLS);
 *  - a dedicated tenant whose secret is unresolvable fails the request rather
 *    than silently falling through to the shared pool — proving the dedicated
 *    branch is genuinely taken and gated on the secret.
 *
 * No second physical database is available in CI, so the "good" tenant's secret
 * points at the same app-role URL the shared pool uses. That still exercises the
 * distinct code path (registry → secret resolve → TenantPoolManager → withTenant
 * with a dedicated pool); the missing-secret case is what proves it isn't the
 * shared pool in disguise.
 */

const GOOD = "dedico";
const BAD = "dedibad";
const PASSWORD = "correct-horse-battery-staple";

// Fixed ids, not DB-generated. The registry caches slug→id in Redis for 60s;
// if afterAll deletes the row and a warm-Redis rerun re-inserts with a fresh
// uuid, sign-in would resolve the stale cached id while the membership is seeded
// under the new one. Stable ids keep the cache consistent across reruns.
const GOOD_ID = "d0d0d0d0-0000-4000-8000-0000000000d1";
const BAD_ID = "d0d0d0d0-0000-4000-8000-0000000000b2";

let app: INestApplication;
let control: pg.Pool;
const goodId = GOOD_ID;
let userId = "";
let tok = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

beforeAll(async () => {
  // The "good" dedicated tenant's secret resolves to the shared app-role URL
  // (no second DB in CI). Set before the app reads any request.
  process.env["DEDICATED_TEST_DB_URL"] = process.env["DATABASE_APP_URL"];

  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });

  // Clean slate: drop any leftover rows (so the fixed ids below are authoritative,
  // not overwritten-but-keeping-a-stale-id) and bust the registry's Redis cache
  // for these slugs (60s TTL, shared across the run).
  await control.query("DELETE FROM control.tenants WHERE slug = ANY($1)", [[GOOD, BAD]]);
  const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6380");
  await redis.del(`tenant:slug:${GOOD}`, `tenant:slug:${BAD}`);
  await redis.quit();

  await control.query(
    `INSERT INTO control.tenants (id, slug, name, model, database_url_secret_ref, status)
     VALUES ($1, $2, 'Dedicated Co', 'dedicated', 'env:DEDICATED_TEST_DB_URL', 'active')`,
    [GOOD_ID, GOOD],
  );

  // A dedicated tenant whose secret env var is deliberately never set.
  await control.query(
    `INSERT INTO control.tenants (id, slug, name, model, database_url_secret_ref, status)
     VALUES ($1, $2, 'Broken Dedicated', 'dedicated', 'env:DEDICATED_MISSING_SECRET', 'active')`,
    [BAD_ID, BAD],
  );

  const hash = await hashPassword(PASSWORD);
  const u = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ('dedico@acme.test','Dedico',$1)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [hash],
  );
  userId = u.rows[0]!.id;
  await withTenant(goodId, null, (tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'manager','active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active'`,
      [goodId, userId],
    ),
  );

  app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
  await app.init();

  const res = await request(server())
    .post("/v1/auth/sign-in")
    .set("X-Tenant-Id", GOOD)
    .send({ email: "dedico@acme.test", password: PASSWORD });
  const cookies = res.headers["set-cookie"] as unknown as string[];
  tok = decodeURIComponent(
    cookies.find((c) => c.startsWith("kaenal_session="))?.split("=")[1]?.split(";")[0] ?? "",
  );
});

afterAll(async () => {
  await withTenant(goodId, null, async (tx) => {
    await tx.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await tx.query("DELETE FROM memberships WHERE user_id = $1", [userId]);
  });
  await control.query("DELETE FROM control.users WHERE email = 'dedico@acme.test'");
  await control.query("DELETE FROM control.tenants WHERE slug = ANY($1)", [[GOOD, BAD]]);
  await app.close();
  await control.end();
  delete process.env["DEDICATED_TEST_DB_URL"];
});

describe("Model B (dedicated) request routing", () => {
  it("signs in and serves an authenticated request through the per-tenant pool", () => {
    expect(tok).not.toBe("");
    return request(server())
      .get("/v1/me")
      .set("X-Tenant-Id", GOOD)
      .set("Authorization", `Bearer ${tok}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.role).toBe("manager");
      });
  });

  it("fails the request when the dedicated secret cannot be resolved (no fall-through to shared)", () => {
    // Reaches the pool-resolution step before auth even runs; a missing secret
    // is an internal error, not a 404/401.
    return request(server())
      .post("/v1/auth/sign-in")
      .set("X-Tenant-Id", BAD)
      .send({ email: "dedico@acme.test", password: PASSWORD })
      .expect(500);
  });
});
