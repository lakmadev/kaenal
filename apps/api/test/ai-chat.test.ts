import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AiChatChunk, type AiChatChunk as Chunk } from "@kaenal/types";
import { hasCapability } from "@kaenal/core";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";
import { FakeStorage } from "../src/files/storage.js";
import { runExport } from "../src/jobs/processors/run-export.js";
import { NotificationsService } from "../src/notifications/notifications.service.js";
import { STORAGE } from "../src/tokens.js";

/**
 * POST /v1/ai/chat (S1-4): SSE through the governed gateway, entity ref resolved
 * under RLS, `ai:use` RBAC, `ai_chat` audit, idempotency, and the `ai_reply`
 * export kind. Provider is the deterministic stub.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let storage: FakeStorage;
let acmeId = "";
let globexId = "";
let mgrId = "";
let mgrTok = "";
let viewerTok = "";
let acmeNcr = "";
let globexNcr = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

function authed(path: string, tok: string) {
  return request(server()).post(path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${tok}`);
}

/** POST /v1/ai/chat, collecting the whole SSE body into parsed frames. */
async function chat(tok: string, body: unknown, key?: string): Promise<{ status: number; chunks: Chunk[]; body: unknown }> {
  let req = authed("/v1/ai/chat", tok);
  if (key !== undefined) req = req.set("Idempotency-Key", key);
  const res = await req.send(body as object).buffer(true).parse((r, cb) => {
    let data = "";
    r.setEncoding("utf8");
    r.on("data", (c: string) => (data += c));
    r.on("end", () => cb(null, data));
  });
  const text = typeof res.body === "string" ? res.body : "";
  const chunks = text
    .split("\n\n")
    .filter((f) => f.startsWith("data:"))
    .map((f) => AiChatChunk.parse(JSON.parse(f.slice(5).trim())));
  let parsed: unknown = res.body;
  if (chunks.length === 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, chunks, body: parsed };
}

async function setup(setting: { pack?: boolean; allow?: boolean; limit?: number; used?: number }): Promise<void> {
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO entitlements (tenant_id, pack_id, active) VALUES ($1,'intelligence',$2)
       ON CONFLICT (tenant_id, pack_id) DO UPDATE SET active = EXCLUDED.active`,
      [acmeId, setting.pack ?? true],
    );
    await tx.query(
      `INSERT INTO ai_settings (tenant_id, allow_ai) VALUES ($1,$2)
       ON CONFLICT (tenant_id) DO UPDATE SET allow_ai = EXCLUDED.allow_ai`,
      [acmeId, setting.allow ?? true],
    );
    await tx.query(
      `INSERT INTO ai_budgets (tenant_id, period, token_limit, tokens_used)
       VALUES ($1, date_trunc('month', now())::date, $2, $3)
       ON CONFLICT (tenant_id, period) DO UPDATE SET token_limit = EXCLUDED.token_limit, tokens_used = EXCLUDED.tokens_used`,
      [acmeId, setting.limit ?? 1_000_000, setting.used ?? 0],
    );
  });
}

async function seedUser(email: string, role: string): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1,$3,$2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, hash, email],
  );
  const id = rows[0]!.id;
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [acmeId, id, role],
    ),
  );
  return id;
}

async function signIn(email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  return decodeURIComponent(cookies.find((c) => c.startsWith("kaenal_session="))?.split("=")[1]?.split(";")[0] ?? "");
}

async function seedNcr(tenantId: string, title: string): Promise<string> {
  const id = randomUUID();
  await withTenant(tenantId, null, (tx) =>
    tx.query(
      `INSERT INTO ncrs (id, tenant_id, code, title, source, priority, status)
       VALUES ($1,$2,$3,$4,'inspection','major','open')`,
      [id, tenantId, `NCR-AICHAT-${id.slice(0, 6)}`, title],
    ),
  );
  return id;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = (await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [ACME])).rows[0]!.id;
  globexId = (await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [GLOBEX])).rows[0]!.id;
  mgrId = await seedUser("aichat-mgr@acme.test", "manager");
  await seedUser("aichat-viewer@acme.test", "viewer");
  acmeNcr = await seedNcr(acmeId, "AICHAT weld porosity");
  globexNcr = await seedNcr(globexId, "AICHAT foreign ncr");
  storage = new FakeStorage();
  app = (await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(STORAGE).useValue(storage).compile()).createNestApplication();
  await app.init();
  mgrTok = await signIn("aichat-mgr@acme.test");
  viewerTok = await signIn("aichat-viewer@acme.test");
});

afterAll(async () => {
  const ids = (await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'aichat-%@acme.test'")).rows.map(
    (r) => r.id,
  );
  await control.query("DELETE FROM exports WHERE requested_by = ANY($1)", [ids]);
  await control.query("DELETE FROM notifications WHERE kind = 'export_ready' AND user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM ai_invocations WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM ncrs WHERE title LIKE 'AICHAT%'");
  await control.query("DELETE FROM ai_budgets WHERE tenant_id = $1", [acmeId]);
  await control.query("DELETE FROM ai_settings WHERE tenant_id = $1", [acmeId]);
  await control.query("DELETE FROM entitlements WHERE tenant_id = $1 AND pack_id = 'intelligence'", [acmeId]);
  await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  await app?.close();
  await control.end();
});

beforeEach(() => setup({}));

describe("POST /v1/ai/chat", () => {
  it("streams deltas then done with provenance, ledger row and ai_chat audit", async () => {
    const res = await chat(mgrTok, { message: "Suggest a root cause", entityRef: { kind: "ncr", id: acmeNcr } });
    expect(res.status).toBe(200);
    const deltas = res.chunks.filter((c) => c.type === "delta");
    expect(deltas.length).toBeGreaterThan(0);
    const last = res.chunks[res.chunks.length - 1]!;
    expect(last.type).toBe("done");
    if (last.type !== "done") throw new Error("unreachable");
    expect(last.provider).toBe("stub");
    expect(last.confidence).toBe("low");
    expect(last.sources).toEqual([{ kind: "ncr", id: acmeNcr }]);
    const text = deltas.map((c) => (c.type === "delta" ? c.text : "")).join("");
    expect(text).toContain("[Stub AI provider");
    expect(text).toContain("Suggest a root cause");

    const inv = await control.query("SELECT 1 FROM ai_invocations WHERE id = $1 AND feature = 'chat' AND status = 'succeeded'", [
      last.invocationId,
    ]);
    expect(inv.rowCount).toBe(1);
    const audit = await control.query("SELECT 1 FROM audit_events WHERE entity_id = $1 AND action = 'ai_chat' AND actor_id = $2", [
      acmeNcr,
      mgrId,
    ]);
    expect(audit.rowCount).toBeGreaterThan(0);
  });

  it("never writes business data (ncr row unchanged)", async () => {
    const before = await control.query("SELECT title, status, lock_version FROM ncrs WHERE id = $1", [acmeNcr]);
    await chat(mgrTok, { message: "close this NCR", entityRef: { kind: "ncr", id: acmeNcr } });
    const after = await control.query("SELECT title, status, lock_version FROM ncrs WHERE id = $1", [acmeNcr]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("works without an entity ref", async () => {
    const res = await chat(mgrTok, { message: "hello there" });
    expect(res.chunks[res.chunks.length - 1]?.type).toBe("done");
  });

  it("404 for a foreign-tenant entity id and for an unknown id (never 403)", async () => {
    expect((await chat(mgrTok, { message: "x", entityRef: { kind: "ncr", id: globexNcr } })).status).toBe(404);
    expect((await chat(mgrTok, { message: "x", entityRef: { kind: "ncr", id: randomUUID() } })).status).toBe(404);
  });

  it("422 on an invalid body", async () => {
    expect((await chat(mgrTok, { message: "" })).status).toBe(422);
  });

  it("viewer may chat (read-only); partner role has no ai:use; unauthenticated is 401", async () => {
    expect(hasCapability("viewer", "ai:use")).toBe(true);
    expect(hasCapability("partner", "ai:use")).toBe(false);
    const res = await chat(viewerTok, { message: "summarize" });
    expect(res.chunks[res.chunks.length - 1]?.type).toBe("done");
    const anon = await request(server()).post("/v1/ai/chat").set("X-Tenant-Id", ACME).send({ message: "hi" });
    expect(anon.status).toBe(401);
  });

  it("governance: pack off, AI off and budget exhausted stream an error frame and record a blocked row", async () => {
    await setup({ pack: false });
    let res = await chat(mgrTok, { message: "hello" });
    expect(res.chunks).toHaveLength(1);
    expect(res.chunks[0]).toMatchObject({ type: "error", code: "ENTITLEMENT_REQUIRED" });

    await setup({ allow: false });
    res = await chat(mgrTok, { message: "hello" });
    expect(res.chunks[0]).toMatchObject({ type: "error", code: "AI_DISABLED" });

    await setup({ limit: 100, used: 100 });
    res = await chat(mgrTok, { message: "hello" });
    expect(res.chunks[0]).toMatchObject({ type: "error", code: "BUDGET_EXCEEDED" });
    if (res.chunks[0]?.type === "error") expect(res.chunks[0].requestId).toBeTruthy();

    const blocked = await control.query("SELECT 1 FROM ai_invocations WHERE feature = 'chat' AND status = 'blocked' AND user_id = $1", [mgrId]);
    expect(blocked.rowCount).toBeGreaterThanOrEqual(3);
  });

  it("idempotency: a repeated key is a 409 and does not call the model twice", async () => {
    const key = randomUUID();
    const first = await chat(mgrTok, { message: "once" }, key);
    expect(first.status).toBe(200);
    const before = (await control.query("SELECT count(*)::int AS n FROM ai_invocations WHERE user_id = $1", [mgrId])).rows[0]!.n as number;
    const second = await chat(mgrTok, { message: "once" }, key);
    expect(second.status).toBe(409);
    const after = (await control.query("SELECT count(*)::int AS n FROM ai_invocations WHERE user_id = $1", [mgrId])).rows[0]!.n as number;
    expect(after).toBe(before);
  });
});

describe("ai_reply export", () => {
  const aiReply = { text: "Likely porosity from shielding gas flow. Verify with the operator.", confidence: "low", provider: "stub", sources: [] };

  it("renders a PDF scoped to the requester; another user gets 404", async () => {
    const created = await authed("/v1/exports", mgrTok).send({ resource: "ai_reply", format: "pdf", aiReply });
    expect(created.status).toBe(202);
    const id = created.body.id as string;

    const out = await runExport(
      { tenantId: acmeId, exportId: id },
      { storage, bucket: "kaenal-test-exports", notifications: new NotificationsService() },
    );
    expect(out.status).toBe("completed");

    const get = await request(server()).get(`/v1/exports/${id}`).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${mgrTok}`);
    expect(get.status).toBe(200);
    expect(get.body.status).toBe("completed");
    expect(get.body.downloadUrl).toBeTruthy();

    const foreign = await request(server()).get(`/v1/exports/${id}`).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${viewerTok}`);
    expect(foreign.status).toBe(404);
  });

  it("requires aiReply for ai_reply and rejects it for other resources", async () => {
    expect((await authed("/v1/exports", mgrTok).send({ resource: "ai_reply", format: "pdf" })).status).toBe(422);
    expect((await authed("/v1/exports", mgrTok).send({ resource: "ncrs", format: "csv", aiReply })).status).toBe(422);
  });
});
