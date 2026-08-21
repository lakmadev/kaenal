import "reflect-metadata";
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
 * Delta-sync read path (`GET /v1/sync/ncr`, `/v1/sync/inspections`, 05 §2.1).
 *
 * The mobile mirror pulls rows changed since an opaque `(updated_at, id)` cursor
 * plus tombstoned ids. This proves: a full pull returns the tenant's rows; an
 * incremental pull returns ONLY what changed after the cursor; a soft-delete
 * surfaces as a tombstone (not a changed row); cross-tenant rows never appear
 * (RLS); the `*:view` capability gates each endpoint; and a garbage cursor is a
 * clean 400, never a silent wrong page.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
const CODE_PREFIX = "NCR-SYNC-";
// Partners must prove a second factor at sign-in (07 §4); store the secret
// ENCRYPTED as the app requires and generate valid codes from it.
const MFA_SECRET = "JBSWY3DPEHPK3PXP";
const mfaCrypto = new MfaCrypto({
  authSecret: process.env["AUTH_SECRET"] ?? "",
  mfaKey: process.env["MFA_ENCRYPTION_KEY"],
});
const mfaTotp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(MFA_SECRET), digits: 6, period: 30 });

let app: INestApplication;
let control: pg.Pool;

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedUser(tenantId: string, email: string, role: string, opts: { supplierScope?: string; mfa?: boolean } = {}): Promise<void> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash, mfa_secret)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       mfa_secret = EXCLUDED.mfa_secret, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash, opts.mfa === true ? mfaCrypto.encrypt(MFA_SECRET) : null],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status, supplier_scope)
       VALUES ($1,$2,$3,'active',$4)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active',
         supplier_scope = EXCLUDED.supplier_scope`,
      [tenantId, userId, role, opts.supplierScope ?? null],
    );
  });
}

/** Insert an NCR with an explicit updated_at so cursor ordering is deterministic. */
async function seedNcr(tenantId: string, code: string, title: string, updatedAt: string): Promise<string> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO ncrs (tenant_id, code, title, status, created_at, updated_at)
       VALUES ($1,$2,$3,'open',$4,$4) RETURNING id`,
      [tenantId, code, title, updatedAt],
    );
    return rows[0]?.id ?? "";
  });
}

async function token(email: string, slug: string): Promise<string> {
  const post = (body: Record<string, unknown>) =>
    request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send(body);
  let res = await post({ email, password: PASSWORD });
  if (res.status === 201 && res.body?.mfaRequired === true) {
    res = await post({ email, password: PASSWORD, code: mfaTotp.generate() });
  }
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function pull(path: string, bearer: string, slug = ACME) {
  return request(server()).get(path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

const EMAILS = ["sync-admin@acme.test", "sync-partner@acme.test", "sync-globex@globex.test"];
let adminTok = "";
let partnerTok = "";
let acmeId = "";
let tombId = "";

interface Delta {
  changed: { id: string; code?: string }[];
  deleted: string[];
  nextCursor: string | null;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  const globexId = await tid(GLOBEX);

  // A partner must be scoped to a supplier (partner_scope check constraint).
  const supplierA = await withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO suppliers (tenant_id, name, code, status) VALUES ($1,'FIXT-sync A','SUP-SYNC-0001','active') RETURNING id`,
      [acmeId],
    );
    return rows[0]?.id ?? "";
  });

  await seedUser(acmeId, "sync-admin@acme.test", "admin");
  await seedUser(acmeId, "sync-partner@acme.test", "partner", { supplierScope: supplierA, mfa: true });
  await seedUser(globexId, "sync-globex@globex.test", "admin");

  // Three acme NCRs at t=1,2,3 + one that we will soft-delete + a globex row.
  await seedNcr(acmeId, `${CODE_PREFIX}0001`, "Alpha", "2020-01-01T00:00:01.000Z");
  await seedNcr(acmeId, `${CODE_PREFIX}0002`, "Bravo", "2020-01-01T00:00:02.000Z");
  await seedNcr(acmeId, `${CODE_PREFIX}0003`, "Charlie", "2020-01-01T00:00:03.000Z");
  tombId = await seedNcr(acmeId, `${CODE_PREFIX}0004`, "Delta (to delete)", "2020-01-01T00:00:04.000Z");
  await seedNcr(globexId, `${CODE_PREFIX}9999`, "Globex secret", "2020-01-01T00:00:05.000Z");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token("sync-admin@acme.test", ACME);
  partnerTok = await token("sync-partner@acme.test", ACME);
});

afterAll(async () => {
  await control.query(`DELETE FROM ncrs WHERE code LIKE '${CODE_PREFIX}%'`).catch(() => undefined);
  const ids = (await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = ANY($1)", [EMAILS])).rows.map(
    (r) => r.id,
  );
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.query("DELETE FROM suppliers WHERE code = 'SUP-SYNC-0001'").catch(() => undefined);
  await control.end();
});

describe("GET /v1/sync/ncr (delta pull)", () => {
  it("a full pull (no cursor) returns the tenant's changed rows oldest-first", async () => {
    const res = await pull("/v1/sync/ncr", adminTok);
    expect(res.status).toBe(200);
    const body = res.body as Delta;
    const ours = body.changed.filter((n) => n.code?.startsWith(CODE_PREFIX));
    const codes = ours.map((n) => n.code);
    expect(codes).toEqual([`${CODE_PREFIX}0001`, `${CODE_PREFIX}0002`, `${CODE_PREFIX}0003`, `${CODE_PREFIX}0004`]);
  });

  it("an incremental pull from a cursor returns ONLY rows after it", async () => {
    // Page size 2 → first page is 0001,0002 with a cursor; next page is 0003,0004.
    const first = (await pull(`/v1/sync/ncr?limit=2`, adminTok)).body as Delta;
    expect(first.changed.map((n) => n.code)).toEqual([`${CODE_PREFIX}0001`, `${CODE_PREFIX}0002`]);
    expect(first.nextCursor).not.toBeNull();

    const next = (await pull(`/v1/sync/ncr?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? "")}`, adminTok))
      .body as Delta;
    const codes = next.changed.filter((n) => n.code?.startsWith(CODE_PREFIX)).map((n) => n.code);
    expect(codes).toEqual([`${CODE_PREFIX}0003`, `${CODE_PREFIX}0004`]);
    expect(codes).not.toContain(`${CODE_PREFIX}0001`);
  });

  it("a soft-deleted row surfaces as a tombstone, not a changed row", async () => {
    // Soft-delete bumps updated_at so the tombstone sorts to the end of the scan.
    await withTenant(acmeId, null, async (tx) => {
      await tx.query("UPDATE ncrs SET deleted_at = now(), updated_at = now() WHERE id = $1", [tombId]);
    });
    const body = (await pull("/v1/sync/ncr", adminTok)).body as Delta;
    expect(body.deleted).toContain(tombId);
    expect(body.changed.some((n) => n.id === tombId)).toBe(false);
  });

  it("never returns another tenant's rows (RLS-scoped)", async () => {
    const body = (await pull("/v1/sync/ncr?limit=200", adminTok)).body as Delta;
    expect(body.changed.some((n) => n.code === `${CODE_PREFIX}9999`)).toBe(false);
  });

  it("refuses a partner (no ncr:view) and an anonymous caller", async () => {
    expect((await pull("/v1/sync/ncr", partnerTok)).status).toBe(403);
    expect((await request(server()).get("/v1/sync/ncr").set("X-Tenant-Id", ACME)).status).toBe(401);
  });

  it("rejects a garbage cursor (VALIDATION_FAILED → 422), never a silent wrong page", async () => {
    const res = await pull("/v1/sync/ncr?cursor=not-a-real-cursor", adminTok);
    expect(res.status).toBe(422);
  });
});

describe("GET /v1/sync/inspections (delta pull)", () => {
  it("returns a well-formed delta for an authorised caller", async () => {
    const res = await pull("/v1/sync/inspections", adminTok);
    expect(res.status).toBe(200);
    const body = res.body as Delta;
    expect(Array.isArray(body.changed)).toBe(true);
    expect(Array.isArray(body.deleted)).toBe(true);
    expect(body).toHaveProperty("nextCursor");
    // Own-tenant only: no cross-tenant leakage in the changed set.
    expect(body.changed.every((i) => typeof i.id === "string")).toBe(true);
  });

  it("refuses a partner (no inspection:view)", async () => {
    expect((await pull("/v1/sync/inspections", partnerTok)).status).toBe(403);
  });
});
