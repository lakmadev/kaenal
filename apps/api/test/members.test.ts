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
 * Members directory (`GET /v1/members`) — the id→name resolver the whole UI
 * leans on. Two things must hold: names come from `control.users` while the
 * roster is RLS-scoped (so ACME never sees GLOBEX's people), and a supplier
 * `partner` must NOT be able to enumerate the customer's internal staff (the
 * `ncr:view` gate excludes partners).
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";
// A real base32 TOTP secret. Stored ENCRYPTED (as the app requires) and used to
// generate a valid code, because a partner now proves a second factor at login.
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

async function seedUser(
  tenantId: string,
  email: string,
  name: string,
  role: string,
  opts: { supplierScope?: string; mfa?: boolean } = {},
): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash, mfa_secret)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
       mfa_secret = EXCLUDED.mfa_secret, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, name, hash, opts.mfa === true ? mfaCrypto.encrypt(MFA_SECRET) : null],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status, supplier_scope)
       VALUES ($1,$2,$3,'active',$4)
       ON CONFLICT (tenant_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, status = 'active', supplier_scope = EXCLUDED.supplier_scope`,
      [tenantId, userId, role, opts.supplierScope ?? null],
    );
  });
  return userId;
}

async function token(email: string, slug: string): Promise<string> {
  const post = (body: Record<string, unknown>) =>
    request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send(body);
  let res = await post({ email, password: PASSWORD });
  // A partner (MFA-enrolled) is asked for a code; supply one and finish sign-in.
  if (res.status === 201 && res.body?.mfaRequired === true) {
    res = await post({ email, password: PASSWORD, code: mfaTotp.generate() });
  }
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(path: string, bearer: string, slug = ACME) {
  return request(server()).get(path).set("X-Tenant-Id", slug).set("Authorization", `Bearer ${bearer}`);
}

const EMAILS = ["mem-admin@acme.test", "mem-viewer@acme.test", "mem-partner@a.test", "mem-globex@globex.test"];
let adminTok = "";
let viewerTok = "";
let partnerTok = "";
let supplierA = "";

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const acmeId = await tid(ACME);
  const globexId = await tid(GLOBEX);

  supplierA = await withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO suppliers (tenant_id, name, code, status) VALUES ($1,'FIXT-mem A','SUP-MEM-0001','active') RETURNING id`,
      [acmeId],
    );
    return rows[0]?.id ?? "";
  });

  await seedUser(acmeId, "mem-admin@acme.test", "Ada Admin", "admin");
  await seedUser(acmeId, "mem-viewer@acme.test", "Vic Viewer", "viewer");
  await seedUser(acmeId, "mem-partner@a.test", "Pat Partner", "partner", { supplierScope: supplierA, mfa: true });
  await seedUser(globexId, "mem-globex@globex.test", "Gil Globex", "admin");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token("mem-admin@acme.test", ACME);
  viewerTok = await token("mem-viewer@acme.test", ACME);
  partnerTok = await token("mem-partner@a.test", ACME);
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = ANY($1)", [EMAILS])
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.query("DELETE FROM suppliers WHERE code = 'SUP-MEM-0001'");
  await control.end();
});

interface MemberRow {
  userId: string;
  name: string;
  role: string;
}

describe("GET /v1/members", () => {
  it("resolves member ids to names from control.users for internal roles", async () => {
    const res = await authed("/v1/members?limit=100", adminTok);
    expect(res.status).toBe(200);
    const items = res.body.items as MemberRow[];
    const admin = items.find((m) => m.name === "Ada Admin");
    const viewer = items.find((m) => m.name === "Vic Viewer");
    expect(admin?.role).toBe("admin");
    expect(viewer?.role).toBe("viewer");
    // Every row carries a resolved name and a user id, never a raw membership id.
    for (const m of items) {
      expect(typeof m.userId).toBe("string");
      expect(m.name.length).toBeGreaterThan(0);
    }
  });

  it("a viewer may also read the directory (all internal roles have ncr:view)", async () => {
    const res = await authed("/v1/members?limit=100", viewerTok);
    expect(res.status).toBe(200);
  });

  it("never leaks another tenant's people (RLS-scoped roster)", async () => {
    const res = await authed("/v1/members?limit=100", adminTok);
    const items = res.body.items as MemberRow[];
    expect(items.some((m) => m.name === "Gil Globex")).toBe(false);
  });

  it("refuses a supplier partner — a partner cannot enumerate internal staff", async () => {
    const res = await authed("/v1/members?limit=100", partnerTok);
    expect(res.status).toBe(403);
  });

  it("requires authentication", async () => {
    const res = await request(server()).get("/v1/members").set("X-Tenant-Id", ACME);
    expect(res.status).toBe(401);
  });
});
