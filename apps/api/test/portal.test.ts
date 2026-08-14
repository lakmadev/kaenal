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
// A real base32 TOTP secret, stored ENCRYPTED (as the app requires). A partner
// now proves a second factor at login, so `token()` generates a code from it.
const MFA_SECRET = "JBSWY3DPEHPK3PXP";
const mfaCrypto = new MfaCrypto({
  authSecret: process.env["AUTH_SECRET"] ?? "",
  mfaKey: process.env["MFA_ENCRYPTION_KEY"],
});
const mfaTotp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(MFA_SECRET), digits: 6, period: 30 });

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
let adminUserId = "";

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
    [email, email, hash, opts.mfa === true ? mfaCrypto.encrypt(MFA_SECRET) : null],
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
  const post = (body: Record<string, unknown>) =>
    request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send(body);
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
  adminUserId = await seedUser(acmeId, "portal-admin@acme.test", "admin");
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
  await control.query("DELETE FROM comments WHERE entity_kind = 'scar' AND entity_id = ANY($1)", [[scarA, scarB]]);
  await control.query("DELETE FROM scars WHERE title LIKE 'FIXT-portal%'");
  await control.query("DELETE FROM ppap_submissions WHERE part_number LIKE 'FIXT-%'");
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email = ANY($1)", [emails])
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    // Evidence files reference the uploader (ON DELETE RESTRICT) — clear before users.
    await control.query("DELETE FROM files WHERE uploaded_by = ANY($1)", [ids]);
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

  it("denies a partner the internal files routes (@Internal, no capability to gate on)", async () => {
    const presign = await authed("post", "/v1/files/presign", partnerTok).send({
      filename: "x.pdf",
      mime: "application/pdf",
      sizeBytes: 10,
    });
    expect(presign.status).toBe(403);
    const get = await authed("get", `/v1/files/${randomUUID()}`, partnerTok);
    expect(get.status).toBe(403);
    // …while the partner's own portal upload path stays open (covered below).
  });

  it("denies a partner every internal capability-LESS route (@Internal)", async () => {
    // These carry no @RequireCapability (access is governed by RLS + service
    // scoping, not by role), so RBAC alone would let a partner in — @Internal is
    // what refuses them. The interceptor runs the internal check before the
    // handler, so a bare request still 403s regardless of body/query validity.
    const cases: ["get" | "post", string][] = [
      ["get", "/v1/search?q=weld"],
      ["get", "/v1/me"],
      ["get", "/v1/me/workspaces"],
      ["post", "/v1/me/switch-workspace"],
      ["get", "/v1/exports"],
      ["post", "/v1/ai/drafts"],
      ["get", `/v1/audit-events?entityKind=scar&entityId=${scarA}`],
      ["get", `/v1/comments?entityKind=scar&entityId=${scarA}`],
      ["post", "/v1/comments"],
      ["get", `/v1/entity-links?entityKind=scar&entityId=${scarA}`],
      ["post", "/v1/entity-links"],
    ];
    for (const [method, path] of cases) {
      const res = await authed(method, path, partnerTok).send({});
      expect(res.status, `${method.toUpperCase()} ${path} should be 403`).toBe(403);
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

describe("supplier portal — audited writes (P11 slice 2)", () => {
  it("lets a partner respond to their SCAR (comment + acknowledge, audited as partner)", async () => {
    const res = await authed("post", `/v1/portal/scars/${scarA}/respond`, partnerTok).send({
      note: "Containment complete — remaining lot quarantined. 8D attached.",
      acknowledge: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.supplierAcknowledged).toBe(true);

    // The note is a comment on the SCAR (internal staff see it too).
    const comments = await control.query<{ body: string; author_id: string }>(
      `SELECT body, author_id FROM comments WHERE entity_kind = 'scar' AND entity_id = $1`,
      [scarA],
    );
    expect(comments.rows.some((c) => c.body.includes("Containment complete") && c.author_id === partnerUserId)).toBe(true);

    // The write is attributed to an EXTERNAL actor in the audit trail.
    const audit = await control.query<{ actor_kind: string; action: string }>(
      `SELECT actor_kind, action FROM audit_events WHERE entity_kind = 'scar' AND entity_id = $1 AND action = 'commented'`,
      [scarA],
    );
    expect(audit.rows.some((a) => a.actor_kind === "partner")).toBe(true);
  });

  it("404s a respond to another supplier's SCAR", async () => {
    const res = await authed("post", `/v1/portal/scars/${scarB}/respond`, partnerTok).send({ note: "nope" });
    expect(res.status).toBe(404);
  });

  it("denies respond without the write capability (viewer, admin-no-scope)", async () => {
    const viewer = await authed("post", `/v1/portal/scars/${scarA}/respond`, viewerTok).send({ note: "x" });
    expect(viewer.status).toBe(403); // no portal:respond
    const admin = await authed("post", `/v1/portal/scars/${scarA}/respond`, adminTok).send({ note: "x" });
    expect(admin.status).toBe(403); // has cap (all-caps) but no supplier scope
  });

  it("lets a partner re-submit their PPAP (→ in_review, audited as partner)", async () => {
    const res = await authed("post", `/v1/portal/ppap/${ppapA}/resubmit`, partnerTok).send({
      note: "Re-submitted dimensional results per D-lab feedback.",
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_review");

    const audit = await control.query<{ actor_kind: string }>(
      `SELECT actor_kind FROM audit_events WHERE entity_kind = 'ppap_submission' AND entity_id = $1 AND action = 'status_changed'`,
      [ppapA],
    );
    expect(audit.rows.some((a) => a.actor_kind === "partner")).toBe(true);
  });

  it("refuses re-submitting a decided PPAP package", async () => {
    const decided = randomUUID();
    await withTenant(acmeId, null, async (tx) => {
      await tx.query(
        `INSERT INTO ppap_submissions (id, tenant_id, code, supplier_id, part_number, level, status)
         VALUES ($1,$2,'PPAP-FP-9999',$3,'FIXT-A-DECIDED',3,'approved')`,
        [decided, acmeId, supplierA],
      );
    });
    const res = await authed("post", `/v1/portal/ppap/${decided}/resubmit`, partnerTok).send({});
    expect(res.status).toBe(422);
  });

  it("404s a re-submit of another supplier's PPAP", async () => {
    const res = await authed("post", `/v1/portal/ppap/${ppapB}/resubmit`, partnerTok).send({});
    expect(res.status).toBe(404);
  });
});

/**
 * A completed, still-unlinked evidence upload owned by `uploadedBy`. Seeds the
 * `files` row directly rather than round-tripping through MinIO — the storage
 * PUT/stat is the internal FilesService's, exercised in files.test; here we only
 * prove the partner-scoped ATTACH links the right file to the right record.
 */
async function seedFile(uploadedBy: string, tag: string): Promise<string> {
  const id = randomUUID();
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO files
         (id, tenant_id, bucket, key, filename, mime, size_bytes, scan_status, uploaded_by, created_by, updated_by)
       VALUES ($1,$2,'test',$3,$4,'application/pdf',1024,'clean',$5,$5,$5)`,
      [id, acmeId, `fixt/${id}`, `FIXT-ev-${tag}.pdf`, uploadedBy],
    );
  });
  return id;
}

async function fileEntity(id: string): Promise<{ kind: string | null; entity: string | null }> {
  const { rows } = await control.query<{ entity_kind: string | null; entity_id: string | null }>(
    "SELECT entity_kind, entity_id FROM files WHERE id = $1",
    [id],
  );
  return { kind: rows[0]?.entity_kind ?? null, entity: rows[0]?.entity_id ?? null };
}

describe("supplier portal — evidence upload (P11)", () => {
  it("presigns a partner-scoped upload (201, no entity, audited as partner)", async () => {
    const res = await authed("post", "/v1/portal/files/presign", partnerTok).send({
      filename: "8d-evidence.pdf",
      mime: "application/pdf",
      sizeBytes: 2048,
    });
    expect(res.status).toBe(201);
    expect(res.body.fileId).toBeDefined();
    expect(typeof res.body.uploadUrl).toBe("string");

    // The upload starts UNLINKED and is audited to an external actor.
    const { kind, entity } = await fileEntity(res.body.fileId);
    expect(kind).toBeNull();
    expect(entity).toBeNull();
    const audit = await control.query<{ actor_kind: string }>(
      `SELECT actor_kind FROM audit_events WHERE entity_kind = 'file' AND entity_id = $1 AND action = 'created'`,
      [res.body.fileId],
    );
    expect(audit.rows.some((a) => a.actor_kind === "partner")).toBe(true);
  });

  it("denies presign without portal:respond (viewer) and without a scope (admin)", async () => {
    const body = { filename: "x.pdf", mime: "application/pdf", sizeBytes: 10 };
    const viewer = await authed("post", "/v1/portal/files/presign", viewerTok).send(body);
    expect(viewer.status).toBe(403);
    const admin = await authed("post", "/v1/portal/files/presign", adminTok).send(body);
    expect(admin.status).toBe(403); // has the capability, but no supplier scope
  });

  it("attaches the partner's own upload to their SCAR on respond", async () => {
    const fileId = await seedFile(partnerUserId, "scar-own");
    const res = await authed("post", `/v1/portal/scars/${scarA}/respond`, partnerTok).send({
      note: "Containment photos attached.",
      fileIds: [fileId],
    });
    expect(res.status).toBe(200);
    const { kind, entity } = await fileEntity(fileId);
    expect(kind).toBe("scar");
    expect(entity).toBe(scarA);
  });

  it("rejects attaching a file the partner did not upload, leaving it unlinked", async () => {
    const foreign = await seedFile(adminUserId, "not-mine");
    const res = await authed("post", `/v1/portal/scars/${scarA}/respond`, partnerTok).send({
      note: "Trying to attach someone else's file.",
      fileIds: [foreign],
    });
    expect(res.status).toBe(422);
    const { kind } = await fileEntity(foreign);
    expect(kind).toBeNull(); // untouched
  });

  it("does not attach to another supplier's SCAR (404, file untouched)", async () => {
    const fileId = await seedFile(partnerUserId, "foreign-scar");
    const res = await authed("post", `/v1/portal/scars/${scarB}/respond`, partnerTok).send({
      note: "nope",
      fileIds: [fileId],
    });
    expect(res.status).toBe(404);
    const { kind } = await fileEntity(fileId);
    expect(kind).toBeNull();
  });

  it("attaches evidence on a PPAP re-submit", async () => {
    const fileId = await seedFile(partnerUserId, "ppap");
    const res = await authed("post", `/v1/portal/ppap/${ppapA}/resubmit`, partnerTok).send({
      note: "Updated dimensional report attached.",
      fileIds: [fileId],
    });
    expect(res.status).toBe(200);
    const { kind, entity } = await fileEntity(fileId);
    expect(kind).toBe("ppap_submission");
    expect(entity).toBe(ppapA);
  });
});
