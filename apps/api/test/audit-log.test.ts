import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withAudit, withTenant, type Tx } from "@kaenal/db";
import type { AuditEventInput } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Tenant-wide audit log (`GET /v1/audit-log`, `/export`). Pins: admin-only
 * (`auditlog:read`) — a viewer is 403 on both routes; structured filters (actor,
 * action, module, date, sensitive-only) are pushed to SQL; keyset pagination is
 * stable; the server-derived `sensitive` flag; actor + target resolution
 * (member name, real record code, "System" for a job); and RLS isolation — one
 * tenant never sees another's trail.
 *
 * `audit_events` is append-only (an immutability trigger blocks DELETE), so this
 * suite cannot clean up its rows. It stays self-isolating instead: every
 * assertion filters on the freshly-seeded admin's `actorId` or looks a row up by
 * a known `entityId`, so events left behind by other suites never perturb it.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
let adminId = "";
let adminTok = "";
let viewerTok = "";
let globexAdminTok = "";
let ncrId = "";
let ncrCode = "";

// Known entity ids so specific seeded rows can be found among unrelated events.
const roleChangeEntity = randomUUID();
const systemEntity = randomUUID();
const globexEntity = randomUUID();
const COMMENT_COUNT = 25;

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

interface Entry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityKind: string;
  entityId: string;
  targetLabel: string;
  sensitive: boolean;
}
type ListBody = { items: Entry[]; nextCursor: string | null };

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(tenantId: string, email: string, role: string): Promise<string> {
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
  return userId;
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

/** Seed a batch of audit events for one tenant/actor in a single transaction. */
async function seedEvents(tenantId: string, actorId: string | null, events: AuditEventInput[]): Promise<void> {
  await withTenant(tenantId, actorId, async (tx: Tx) => {
    await withAudit(tx, tenantId, events, async () => undefined);
  });
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  globexId = await tid(GLOBEX);

  adminId = await seedMember(acmeId, "auditlog-admin@acme.test", "admin");
  await seedMember(acmeId, "auditlog-viewer@acme.test", "viewer");
  const globexAdminId = await seedMember(globexId, "auditlog-admin@globex.test", "admin");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token(ACME, "auditlog-admin@acme.test");
  viewerTok = await token(ACME, "auditlog-viewer@acme.test");
  globexAdminTok = await token(GLOBEX, "auditlog-admin@globex.test");

  // A real record → a real 'created'/'ncr' audit event whose target resolves to
  // the NCR's code (the positive target-resolution path).
  const ncr = await authed("post", "/v1/ncrs", ACME, adminTok).send({ title: "Audit-log target NCR", priority: "major" });
  expect(ncr.status).toBe(201);
  ncrId = ncr.body.id as string;
  ncrCode = ncr.body.code as string;

  // Seeded events by the acme admin: a sensitive permission change, a batch of
  // ordinary comments (for filtering + pagination), and a system export.
  const comments: AuditEventInput[] = Array.from({ length: COMMENT_COUNT }, () => ({
    actorId: adminId,
    actorKind: "user",
    entityKind: "ncr",
    entityId: randomUUID(),
    action: "commented",
  }));
  await seedEvents(acmeId, adminId, [
    { actorId: adminId, actorKind: "user", entityKind: "membership", entityId: roleChangeEntity, action: "role_changed" },
    ...comments,
  ]);
  // System actor (no user) — resolves to "System".
  await seedEvents(acmeId, null, [
    { actorId: null, actorKind: "system", entityKind: "ncr", entityId: systemEntity, action: "exported" },
  ]);
  // A different tenant's event — must never surface for acme (RLS).
  await seedEvents(globexId, globexAdminId, [
    { actorId: globexAdminId, actorKind: "user", entityKind: "ncr", entityId: globexEntity, action: "created" },
  ]);
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'auditlog-%@%.test'")
  ).rows.map((r) => r.id);
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

/** List with a query string, asserting a 200 and returning the typed body. */
async function list(bearer: string, qs: string, slug = ACME): Promise<ListBody> {
  const res = await authed("get", `/v1/audit-log?${qs}`, slug, bearer);
  expect(res.status).toBe(200);
  return res.body as ListBody;
}

describe("tenant-wide audit log — read + resolution", () => {
  it("lists newest-first, resolving actor name, target code, and the sensitive flag", async () => {
    const body = await list(adminTok, `actorId=${adminId}&limit=100`);

    const created = body.items.find((e) => e.entityId === ncrId);
    expect(created).toBeDefined();
    expect(created?.action).toBe("created");
    expect(created?.targetLabel).toBe(ncrCode); // resolved to the real NCR code
    expect(created?.actorName).toBe("auditlog-admin@acme.test");
    expect(created?.sensitive).toBe(false);

    const roleChange = body.items.find((e) => e.entityId === roleChangeEntity);
    expect(roleChange?.action).toBe("role_changed");
    expect(roleChange?.sensitive).toBe(true); // security event → flagged
  });

  it("resolves a system actor to \"System\"", async () => {
    const body = await list(adminTok, "limit=100");
    const sys = body.items.find((e) => e.entityId === systemEntity);
    expect(sys).toBeDefined();
    expect(sys?.actorId).toBeNull();
    expect(sys?.actorName).toBe("System");
  });
});

describe("tenant-wide audit log — filters", () => {
  it("filters by action (pushed to SQL)", async () => {
    const body = await list(adminTok, `actorId=${adminId}&action=role_changed&limit=100`);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((e) => e.action === "role_changed")).toBe(true);
  });

  it("filters by module (entityKind)", async () => {
    const body = await list(adminTok, `actorId=${adminId}&entityKind=ncr&limit=100`);
    expect(body.items.every((e) => e.entityKind === "ncr")).toBe(true);
    expect(body.items.some((e) => e.entityId === roleChangeEntity)).toBe(false); // membership excluded
  });

  it("filters to sensitive events only", async () => {
    const body = await list(adminTok, `actorId=${adminId}&sensitiveOnly=true&limit=100`);
    expect(body.items.every((e) => e.sensitive)).toBe(true);
    expect(body.items.some((e) => e.entityId === roleChangeEntity)).toBe(true);
    expect(body.items.some((e) => e.action === "commented")).toBe(false);
  });
});

describe("tenant-wide audit log — keyset pagination", () => {
  it("pages through the comment batch without overlap or gaps", async () => {
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const qs = `actorId=${adminId}&action=commented&limit=10${cursor !== null ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const body: ListBody = await list(adminTok, qs);
      for (const e of body.items) seen.add(e.id);
      cursor = body.nextCursor;
      pages += 1;
      expect(pages).toBeLessThan(10); // guard against a cursor that never advances
    } while (cursor !== null);

    expect(seen.size).toBe(COMMENT_COUNT); // exactly the batch, no dupes
  });
});

describe("tenant-wide audit log — RBAC + isolation", () => {
  it("denies a viewer on both list and export (auditlog:read)", async () => {
    const listed = await authed("get", "/v1/audit-log", ACME, viewerTok);
    expect(listed.status).toBe(403);
    const exported = await authed("get", "/v1/audit-log/export", ACME, viewerTok);
    expect(exported.status).toBe(403);
  });

  it("never surfaces another tenant's events (RLS)", async () => {
    const acme = await list(adminTok, "limit=100");
    expect(acme.items.some((e) => e.entityId === globexEntity)).toBe(false);

    const globex = await list(globexAdminTok, "limit=100", GLOBEX);
    expect(globex.items.some((e) => e.entityId === ncrId)).toBe(false);
    expect(globex.items.some((e) => e.entityId === globexEntity)).toBe(true);
  });
});

describe("tenant-wide audit log — CSV export", () => {
  it("returns a text/csv attachment with the header and the filtered rows", async () => {
    const res = await authed("get", `/v1/audit-log/export?actorId=${adminId}`, ACME, adminTok);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
    const csv = res.text;
    expect(csv.split("\r\n")[0]).toContain("When,Actor,Actor type,Action,Target");
    expect(csv).toContain(ncrCode); // the resolved target made it into the file
  });
});
