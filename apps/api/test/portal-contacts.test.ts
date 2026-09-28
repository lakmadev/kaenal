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
import { MfaCrypto } from "../src/auth/mfa-crypto.js";

/**
 * Supplier portal contacts management (P11): list / resend / revoke.
 * Proves scoping (partners of THIS supplier only), status derivation, resend
 * invalidating the old link, revoke killing sessions + blocking sign-in,
 * 404-not-403 for foreign ids, RBAC, and audit rows.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const MFA_SECRET = "JBSWY3DPEHPK3PXP";
const mfaCrypto = new MfaCrypto({
  authSecret: process.env["AUTH_SECRET"] ?? "",
  mfaKey: process.env["MFA_ENCRYPTION_KEY"],
});
const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(MFA_SECRET), digits: 6, period: 30 });

const ADMIN = "pc-admin@acme.test";
const VIEWER = "pc-viewer@acme.test";
const STAFF = "pc-staff@acme.test";
const ACTIVE = "pc-active@pc-supplier.test";
const PENDING = "pc-pending@pc-supplier.test";
const INVITEE = "pc-invitee@pc-supplier.test";
const OTHER_SUPPLIER_PARTNER = "pc-other@pc-other.test";
const EMAILS = [ADMIN, VIEWER, STAFF, ACTIVE, PENDING, INVITEE, OTHER_SUPPLIER_PARTNER];

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let supplierA = "";
let supplierB = "";
let foreignSupplier = "";
let adminTok = "";
let viewerTok = "";
const ids: Record<string, string> = {};

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedUser(
  email: string,
  role: string,
  opts: { supplier?: string; mfa?: boolean } = {},
): Promise<string> {
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash, mfa_secret, last_login_at)
     VALUES ($1::text, $1::text, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, mfa_secret = EXCLUDED.mfa_secret,
       failed_login_attempts = 0, locked_until = NULL RETURNING id`,
    [email, await hashPassword(PASSWORD), opts.mfa === true ? mfaCrypto.encrypt(MFA_SECRET) : null, opts.mfa === true ? new Date() : null],
  );
  const id = rows[0]?.id ?? "";
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status, supplier_scope) VALUES ($1,$2,$3,'active',$4)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active', supplier_scope = EXCLUDED.supplier_scope`,
      [acmeId, id, role, opts.supplier ?? null],
    );
  });
  return id;
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

const list = (supplierId: string, tok = adminTok, qs = "") =>
  authed("get", `/v1/suppliers/${supplierId}/portal-contacts${qs}`, tok);
const act = (supplierId: string, contactId: string, verb: "resend" | "revoke", tok = adminTok) =>
  authed("post", `/v1/suppliers/${supplierId}/portal-contacts/${contactId}/${verb}`, tok);

interface Contact {
  id: string;
  email: string;
  status: string;
  mfaEnrolled: boolean;
  expiresAt: string | null;
  lastSignInAt: string | null;
}

async function cleanup(): Promise<void> {
  const users = (await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = ANY($1)", [EMAILS])).rows.map(
    (r) => r.id,
  );
  await control.query("DELETE FROM invitations WHERE email = ANY($1)", [EMAILS]);
  if (users.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [users]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [users]);
    await control.query("DELETE FROM control.mfa_recovery_codes WHERE user_id = ANY($1)", [users]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [users]);
  }
  await control.query("DELETE FROM suppliers WHERE name LIKE 'FIXT-pcontacts%'");
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  const globexId = await tid(GLOBEX);
  await cleanup();

  supplierA = randomUUID();
  supplierB = randomUUID();
  foreignSupplier = randomUUID();
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES
         ($1,$3,'FIXT-pcontacts A','SUP-PC-0001','active'), ($2,$3,'FIXT-pcontacts B','SUP-PC-0002','active')`,
      [supplierA, supplierB, acmeId],
    );
  });
  await withTenant(globexId, null, async (tx) => {
    await tx.query(
      `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES ($1,$2,'FIXT-pcontacts G','SUP-PC-0003','active')`,
      [foreignSupplier, globexId],
    );
  });

  ids["admin"] = await seedUser(ADMIN, "admin");
  await seedUser(VIEWER, "viewer");
  ids["staff"] = await seedUser(STAFF, "inspector");
  ids["active"] = await seedUser(ACTIVE, "partner", { supplier: supplierA, mfa: true });
  ids["pending"] = await seedUser(PENDING, "partner", { supplier: supplierA, mfa: false });
  await seedUser(OTHER_SUPPLIER_PARTNER, "partner", { supplier: supplierB, mfa: true });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  adminTok = String((await signIn(ADMIN)).body.sessionToken);
  viewerTok = String((await signIn(VIEWER)).body.sessionToken);
});

afterAll(async () => {
  await cleanup();
  await control.end();
  await app.close();
});

describe("portal contacts", () => {
  let inviteeToken = "";
  let inviteeId = "";

  it("lists only this supplier's partner contacts, with derived status", async () => {
    const inv = await authed("post", `/v1/suppliers/${supplierA}/portal-invite`, adminTok).send({ email: INVITEE });
    expect(inv.status).toBe(201);
    inviteeToken = String(inv.body.token);

    const res = await list(supplierA);
    expect(res.status).toBe(200);
    const items = res.body.items as Contact[];
    const by = (e: string) => items.find((c) => c.email === e);
    expect(by(ACTIVE)).toMatchObject({ status: "active", mfaEnrolled: true });
    expect(by(ACTIVE)?.lastSignInAt).not.toBeNull();
    expect(by(PENDING)).toMatchObject({ status: "enrolment_pending", mfaEnrolled: false });
    expect(by(INVITEE)).toMatchObject({ status: "invited", mfaEnrolled: false });
    expect(by(INVITEE)?.expiresAt).not.toBeNull();
    inviteeId = by(INVITEE)?.id ?? "";
    // Never internal members, never another supplier's contacts.
    for (const e of [ADMIN, STAFF, VIEWER, OTHER_SUPPLIER_PARTNER]) expect(by(e)).toBeUndefined();
  });

  it("is cursor-paginated", async () => {
    const first = await list(supplierA, adminTok, "?limit=2");
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await list(supplierA, adminTok, `?limit=2&cursor=${String(first.body.nextCursor)}`);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });

  it("denies without supplier:manage; foreign/unknown supplier or contact is 404 (never 403)", async () => {
    expect((await list(supplierA, viewerTok)).status).toBe(403);
    expect((await list(foreignSupplier)).status).toBe(404);
    expect((await list(randomUUID())).status).toBe(404);
    expect((await act(foreignSupplier, inviteeId, "revoke")).status).toBe(404);
    expect((await act(supplierA, randomUUID(), "resend")).status).toBe(404);
    // An internal member's id is never a contact.
    expect((await act(supplierA, ids["staff"] ?? "", "revoke")).status).toBe(404);
    // A partner of ANOTHER supplier is not this supplier's contact.
    const other = ((await list(supplierB)).body.items as Contact[])[0]?.id ?? "";
    expect((await act(supplierA, other, "revoke")).status).toBe(404);
  });

  it("resend re-issues the link (old token dead) and is refused for an active contact", async () => {
    const res = await act(supplierA, inviteeId, "resend");
    expect(res.status).toBe(201);
    const fresh = String(res.body.token);
    expect(fresh).not.toBe(inviteeToken);
    const old = await request(server())
      .post("/v1/auth/accept-invite")
      .set("X-Tenant-Id", ACME)
      .send({ token: inviteeToken, name: "X", password: PASSWORD });
    expect(old.status).toBeGreaterThanOrEqual(400);
    inviteeToken = fresh;
    expect((await act(supplierA, ids["active"] ?? "", "resend")).status).toBe(409);
    // An enrolment_pending contact can be re-invited.
    expect((await act(supplierA, ids["pending"] ?? "", "resend")).status).toBe(201);
  });

  it("revoking a pending invite kills its link", async () => {
    const id = ((await list(supplierA)).body.items as Contact[]).find((c) => c.email === INVITEE)?.id ?? "";
    const res = await act(supplierA, id, "revoke");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("revoked");
    const accepted = await request(server())
      .post("/v1/auth/accept-invite")
      .set("X-Tenant-Id", ACME)
      .send({ token: inviteeToken, name: "X", password: PASSWORD });
    expect(accepted.status).toBeGreaterThanOrEqual(400);
  });

  it("revoke ends sessions immediately, blocks sign-in, is idempotent and audited once", async () => {
    const signed = await signIn(ACTIVE, totp.generate());
    expect(signed.status).toBe(201);
    const tok = String(signed.body.sessionToken);
    expect((await authed("get", "/v1/portal/me", tok)).status).toBe(200);

    const res = await act(supplierA, ids["active"] ?? "", "revoke");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("revoked");

    expect((await authed("get", "/v1/portal/me", tok)).status).toBe(401); // session dead now
    const live = await control.query("SELECT 1 FROM sessions WHERE user_id = $1 AND revoked_at IS NULL", [ids["active"]]);
    expect(live.rowCount).toBe(0);
    expect((await signIn(ACTIVE, totp.generate())).status).toBe(401);

    expect((await act(supplierA, ids["active"] ?? "", "revoke")).status).toBe(200); // idempotent
    const audit = await withTenant(acmeId, null, (tx) =>
      tx.query(
        `SELECT 1 FROM audit_events WHERE entity_kind = 'membership' AND entity_id = $1
            AND action = 'updated' AND after->>'revoked' = 'true'`,
        [ids["active"]],
      ),
    );
    expect(audit.rowCount).toBe(1);
    const items = (await list(supplierA)).body.items as Contact[];
    expect(items.find((c) => c.email === ACTIVE)?.status).toBe("revoked");
  });
});
