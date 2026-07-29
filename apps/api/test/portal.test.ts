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
 * Supplier portal isolation suite (FEATURES §17, P11) — THE risk surface.
 *
 * This is the one place external users touch tenant data, so the tests are
 * adversarial: a `partner` scoped to supplier A must see ONLY A's SCAR/PPAP
 * (B's records are 404, never 403), must be denied every internal endpoint by
 * RBAC, and the portal projections must not leak internal identifiers. Plus:
 * an admin (capability but no supplier scope) is refused, an internal viewer
 * (no portal capability) is refused, and a partner without MFA cannot sign in.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";
const MFA_SECRET = "JBSWY3DPEHPK3PXP"; // presence is what the gate checks

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let partnerTok = "";
let adminTok = "";
let viewerTok = "";
let supplierA = "";
let supplierB = "";
let scarA = "";
let scarB = "";
let ppapA = "";
let ppapB = "";
let partnerUserId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

/** Seed a control user + a membership. `partnerScope` set ⇒ a partner membership;
 *  `mfa` controls whether the account has MFA configured. */
async function seedUser(
  tenantId: string,
  email: string,
  role: string,
  opts: { partnerScope?: string; mfa?: boolean } = {},
): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash, mfa_secret)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
       mfa_secret = EXCLUDED.mfa_secret, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash, opts.mfa === true ? MFA_SECRET : null],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tenantId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status, supplier_scope)
       VALUES ($1,$2,$3,'active',$4)
       ON CONFLICT (tenant_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, status = 'active', supplier_scope = EXCLUDED.supplier_scope`,
      [tenantId, userId, role, opts.partnerScope ?? null],
    );
  });
  return userId;
}

async function token(email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);

  // Two suppliers, each with a SCAR and a PPAP.
  supplierA = randomUUID();
  supplierB = randomUUID();
  scarA = randomUUID();
  scarB = randomUUID();
  ppapA = randomUUID();
  ppapB = randomUUID();
  await withTenant(acmeId, null, async (tx) => {
    for (const [sid, tag] of [
      [supplierA, "A"],
      [supplierB, "B"],
    ] as const) {
      await tx.query(
        `INSERT INTO suppliers (id, tenant_id, name, code, status) VALUES ($1,$2,$3,$4,'active')`,
        [sid, acmeId, `FIXT-portal ${tag}`, `SUP-FP-000${tag === "A" ? 1 : 2}`],
      );
    }
    await tx.query(
      `INSERT INTO scars (id, tenant_id, code, supplier_id, title, severity, status)
       VALUES ($1,$2,'SCAR-FP-0001',$3,'FIXT-portal A scar','major','open'),
              ($4,$2,'SCAR-FP-0002',$5,'FIXT-portal B scar','critical','open')`,
      [scarA, acmeId, supplierA, scarB, supplierB],
    );
    await tx.query(
      `INSERT INTO ppap_submissions (id, tenant_id, code, supplier_id, part_number, level, status)
       VALUES ($1,$2,'PPAP-FP-0001',$3,'FIXT-A-PART',3,'pending'),
              ($4,$2,'PPAP-FP-0002',$5,'FIXT-B-PART',3,'pending')`,
      [ppapA, acmeId, supplierA, ppapB, supplierB],
    );
  });

  partnerUserId = await seedUser(acmeId, "portal-partner@a.test", "partner", { partnerScope: supplierA, mfa: true });
  await seedUser(acmeId, "portal-admin@acme.test", "admin");
  await seedUser(acmeId, "portal-viewer@acme.test", "viewer");
  // A partner with NO MFA configured — must be refused at sign-in.
  await seedUser(acmeId, "portal-nomfa@a.test", "partner", { partnerScope: supplierA, mfa: false });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  partnerTok = await token("portal-partner@a.test");
  adminTok = await token("portal-admin@acme.test");
  viewerTok = await token("portal-viewer@acme.test");
});

afterAll(async () => {
  const emails = [
    "portal-partner@a.test",
    "portal-admin@acme.test",
    "portal-viewer@acme.test",
    "portal-nomfa@a.test",
  ];
  await control.query("DELETE FROM scars WHERE title LIKE 'FIXT-portal%'");
  await control.query("DELETE FROM ppap_submissions WHERE part_number LIKE 'FIXT-%-PART'");
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = ANY($1)", [emails])
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.query("DELETE FROM suppliers WHERE name LIKE 'FIXT-portal%'");
  await control.end();
  await app.close();
});

describe("supplier portal — the partner's own records", () => {
  it("returns the partner's supplier identity", async () => {
    const res = await authed("get", "/v1/portal/me", partnerTok);
    expect(res.status).toBe(200);
    expect(res.body.supplierId).toBe(supplierA);
    expect(res.body.supplierName).toBe("FIXT-portal A");
  });

  it("lists ONLY the partner's own SCARs", async () => {
    const res = await authed("get", "/v1/portal/scars", partnerTok);
    expect(res.status).toBe(200);
    const ids = (res.body.items as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toContain(scarA);
    expect(ids).not.toContain(scarB);
  });

  it("lists ONLY the partner's own PPAP", async () => {
    const res = await authed("get", "/v1/portal/ppap", partnerTok);
    expect(res.status).toBe(200);
    const ids = (res.body.items as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(ppapA);
    expect(ids).not.toContain(ppapB);
  });

  it("does not leak internal fields in the portal projection", async () => {
    const res = await authed("get", `/v1/portal/scars/${scarA}`, partnerTok);
    expect(res.status).toBe(200);
    // Internal identifiers must never cross the boundary.
    expect(res.body).not.toHaveProperty("ownerId");
    expect(res.body).not.toHaveProperty("owner");
    expect(res.body).not.toHaveProperty("ncrId");
    expect(res.body).not.toHaveProperty("supplierId");
    const ppap = await authed("get", `/v1/portal/ppap/${ppapA}`, partnerTok);
    expect(ppap.body).not.toHaveProperty("aiPrediction");
    expect(ppap.body).not.toHaveProperty("owner");
  });
});

describe("supplier portal — isolation (rule 8, one boundary out)", () => {
  it("404s another supplier's SCAR, never 403", async () => {
    const res = await authed("get", `/v1/portal/scars/${scarB}`, partnerTok);
    expect(res.status).toBe(404);
  });

  it("404s another supplier's PPAP", async () => {
    const res = await authed("get", `/v1/portal/ppap/${ppapB}`, partnerTok);
    expect(res.status).toBe(404);
  });

  it("denies a partner every internal endpoint (no internal capability)", async () => {
    for (const path of ["/v1/ncrs", "/v1/suppliers", "/v1/scars", "/v1/ppap"]) {
      const res = await authed("get", path, partnerTok);
      expect(res.status, `${path} should be forbidden`).toBe(403);
    }
  });

  it("denies an internal viewer the portal (no portal capability)", async () => {
    const res = await authed("get", "/v1/portal/scars", viewerTok);
    expect(res.status).toBe(403);
  });

  it("denies an admin the portal — capability yes, but no supplier scope", async () => {
    const res = await authed("get", "/v1/portal/scars", adminTok);
    expect(res.status).toBe(403);
  });
});

describe("supplier portal — external auth policy (P11)", () => {
  it("refuses sign-in for a partner without MFA configured", async () => {
    const res = await request(server())
      .post("/v1/auth/sign-in")
      .set("X-Tenant-Id", ACME)
      .send({ email: "portal-nomfa@a.test", password: PASSWORD });
    expect(res.status).toBe(403);
    expect(String(res.body.error?.message ?? res.body.message ?? "")).toMatch(/multi-factor/i);
  });

  it("issues a short-lived session for a partner (< 3h)", async () => {
    const { rows } = await control.query<{ expires_at: Date }>(
      `SELECT expires_at FROM sessions WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [partnerUserId],
    );
    const expiresAt = rows[0]?.expires_at;
    expect(expiresAt).toBeDefined();
    if (expiresAt === undefined) return;
    const hoursOut = (expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursOut).toBeGreaterThan(0);
    expect(hoursOut).toBeLessThan(3); // 2h partner TTL, not the 12h staff TTL
  });
});
