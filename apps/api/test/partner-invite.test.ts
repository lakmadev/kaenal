import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import * as OTPAuth from "otpauth";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Supplier-portal partner invite + first-login MFA enrolment (P11).
 *
 * Proves: the invite is scoped to one supplier (foreign/unknown => 404), accept
 * creates a `partner` membership carrying that scope, the partner's first sign-in
 * yields an ENROLMENT-ONLY session that reaches nothing but the MFA enrol routes,
 * a verified TOTP activation upgrades it, and later sign-ins demand the code.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const PARTNER_EMAIL = "pi-contact@pi-supplier.test";
const EXPIRED_EMAIL = "pi-expired@pi-supplier.test";
const ADMIN_EMAIL = "pi-admin@acme.test";
const VIEWER_EMAIL = "pi-viewer@acme.test";
const STAFF_EMAIL = "pi-staff@acme.test";
const EMAILS = [PARTNER_EMAIL, EXPIRED_EMAIL, ADMIN_EMAIL, VIEWER_EMAIL, STAFF_EMAIL];

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let supplierA = "";
let foreignSupplier = "";
let adminTok = "";
let viewerTok = "";
let partnerId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedUser(email: string, role: string): Promise<void> {
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1::text,$1::text,$2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       failed_login_attempts = 0, locked_until = NULL RETURNING id`,
    [email, await hashPassword(PASSWORD)],
  );
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [acmeId, rows[0]?.id, role],
    );
  });
}

async function signIn(email: string, code?: string) {
  return request(server())
    .post("/v1/auth/sign-in")
    .set("X-Tenant-Id", ACME)
    .set("X-Auth-Mode", "bearer")
    .send({ email, password: PASSWORD, ...(code === undefined ? {} : { code }) });
}

const authed = (method: "get" | "post", path: string, tok: string) =>
  request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${tok}`);

const invite = (supplierId: string, email: string, tok = adminTok) =>
  authed("post", `/v1/suppliers/${supplierId}/portal-invite`, tok).send({ email });

const accept = (token: string) =>
  request(server())
    .post("/v1/auth/accept-invite")
    .set("X-Tenant-Id", ACME)
    .send({ token, name: "Pat Contact", password: PASSWORD });

async function cleanup(): Promise<void> {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = ANY($1)", [EMAILS])
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM invitations WHERE email = ANY($1)", [EMAILS]);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.mfa_recovery_codes WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.query("DELETE FROM suppliers WHERE name LIKE 'FIXT-pinvite%'");
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  const globexId = await tid(GLOBEX);
  await cleanup();

  supplierA = randomUUID();
  foreignSupplier = randomUUID();
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES ($1,$2,'FIXT-pinvite A','SUP-PI-0001','active')`,
      [supplierA, acmeId],
    );
  });
  await withTenant(globexId, null, async (tx) => {
    await tx.query(
      `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES ($1,$2,'FIXT-pinvite G','SUP-PI-0002','active')`,
      [foreignSupplier, globexId],
    );
  });

  await seedUser(ADMIN_EMAIL, "admin");
  await seedUser(VIEWER_EMAIL, "viewer");
  await seedUser(STAFF_EMAIL, "inspector");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = String((await signIn(ADMIN_EMAIL)).body.sessionToken);
  viewerTok = String((await signIn(VIEWER_EMAIL)).body.sessionToken);
});

afterAll(async () => {
  await cleanup();
  await control.end();
  await app.close();
});

describe("partner invite", () => {
  let token1 = "";

  it("is denied without supplier:manage", async () => {
    expect((await invite(supplierA, PARTNER_EMAIL, viewerTok)).status).toBe(403);
  });

  it("returns 404 for a foreign-tenant supplier and for an unknown one", async () => {
    expect((await invite(foreignSupplier, PARTNER_EMAIL)).status).toBe(404);
    expect((await invite(randomUUID(), PARTNER_EMAIL)).status).toBe(404);
  });

  it("refuses an address that is already an internal member (409)", async () => {
    expect((await invite(supplierA, STAFF_EMAIL)).status).toBe(409);
  });

  it("mints a partner invitation scoped to the supplier and audits it", async () => {
    const res = await invite(supplierA, PARTNER_EMAIL);
    expect(res.status).toBe(201);
    token1 = String(res.body.token);
    expect(token1).not.toBe("");
    const { rows } = await control.query<{ role: string; supplier_scope: string }>(
      "SELECT role, supplier_scope FROM invitations WHERE email = $1 AND revoked_at IS NULL",
      [PARTNER_EMAIL],
    );
    expect(rows).toEqual([{ role: "partner", supplier_scope: supplierA }]);
    const audit = await withTenant(acmeId, null, (tx) =>
      tx.query(
        `SELECT 1 FROM audit_events WHERE entity_kind = 'invitation' AND action = 'created'
            AND after->>'supplierId' = $1`,
        [supplierA],
      ),
    );
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  it("re-inviting is safe: the old link dies, the new one works, a spent one cannot replay", async () => {
    const again = await invite(supplierA, PARTNER_EMAIL);
    expect(again.status).toBe(201);
    expect((await accept(token1)).status).toBeGreaterThanOrEqual(400); // superseded
    const acc = await accept(String(again.body.token));
    expect(acc.status).toBe(201);
    const { rows } = await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = $1", [PARTNER_EMAIL]);
    partnerId = rows[0]?.id ?? "";
    const m = await withTenant(acmeId, null, (tx) =>
      tx.query<{ role: string; supplier_scope: string }>(
        "SELECT role, supplier_scope FROM memberships WHERE user_id = $1",
        [partnerId],
      ),
    );
    expect(m.rows).toEqual([{ role: "partner", supplier_scope: supplierA }]);
    expect((await accept(String(again.body.token))).status).toBeGreaterThanOrEqual(400);
  });

  it("rejects an expired invitation", async () => {
    const res = await invite(supplierA, EXPIRED_EMAIL);
    expect(res.status).toBe(201);
    await control.query("UPDATE invitations SET expires_at = now() - interval '1 hour' WHERE email = $1", [
      EXPIRED_EMAIL,
    ]);
    expect((await accept(String(res.body.token))).status).toBeGreaterThanOrEqual(400);
  });
});

describe("first-login MFA enrolment", () => {
  let enrolTok = "";
  let totp: OTPAuth.TOTP;

  it("issues an enrolment-only session (<= 15 min) on first sign-in", async () => {
    const res = await signIn(PARTNER_EMAIL);
    expect(res.status).toBe(201);
    expect(res.body.enrolmentRequired).toBe(true);
    enrolTok = String(res.body.sessionToken);
    const { rows } = await control.query<{ scope: string; ttl: number }>(
      `SELECT scope, extract(epoch FROM (expires_at - now()))::int AS ttl
         FROM sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [partnerId],
    );
    expect(rows[0]?.scope).toBe("mfa_enrol");
    expect(rows[0]?.ttl).toBeLessThanOrEqual(15 * 60);
  });

  it("cannot reach the portal or any other route with the enrolment token", async () => {
    for (const path of ["/v1/portal/me", "/v1/portal/scars", "/v1/me", "/v1/suppliers", "/v1/auth/sessions"]) {
      expect((await authed("get", path, enrolTok)).status).toBe(403);
    }
    expect((await authed("post", "/v1/auth/mfa/disable", enrolTok).send({ code: "000000" })).status).toBe(403);
  });

  it("can start enrolment; a wrong code does not activate or upgrade", async () => {
    expect((await authed("get", "/v1/auth/mfa", enrolTok)).status).toBe(200);
    const enroll = await authed("post", "/v1/auth/mfa/enroll", enrolTok).send({});
    expect(enroll.status).toBe(201);
    totp = OTPAuth.URI.parse(String(enroll.body.otpauthUri)) as OTPAuth.TOTP;
    const bad = await authed("post", "/v1/auth/mfa/activate", enrolTok).send({ code: "000000" });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect((await authed("get", "/v1/portal/me", enrolTok)).status).toBe(403);
  });

  it("a verified code activates MFA, returns recovery codes and upgrades the session", async () => {
    const res = await authed("post", "/v1/auth/mfa/activate", enrolTok).send({ code: totp.generate() });
    expect(res.status).toBe(201);
    expect((res.body.recoveryCodes as string[]).length).toBeGreaterThan(0);
    expect(res.body.sessionUpgraded).toBe(true);
    const portal = await authed("get", "/v1/portal/me", enrolTok);
    expect(portal.status).toBe(200);
    expect(portal.body.supplierId).toBe(supplierA);
  });

  it("subsequent sign-ins demand the code and yield a full session", async () => {
    const first = await signIn(PARTNER_EMAIL);
    expect(first.body).toEqual({ mfaRequired: true });
    const second = await signIn(PARTNER_EMAIL, totp.generate());
    expect(second.status).toBe(201);
    expect(second.body.enrolmentRequired).toBeUndefined();
    expect((await authed("get", "/v1/portal/scars", String(second.body.sessionToken))).status).toBe(200);
  });
});
