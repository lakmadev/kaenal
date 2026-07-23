import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * AI HTTP surface (06 §3). POST /v1/ai/drafts runs the governed gateway and
 * returns a draft or maps a refusal (no pack / budget / AI off) to the right
 * status; POST /v1/ai/summaries/accept is the audited acceptance, writing the
 * reviewed summary onto a document with optimistic concurrency.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let userId = "";
let tok = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

function authed(method: "get" | "post", path: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${tok}`);
}

async function setPack(active: boolean): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO entitlements (tenant_id, pack_id, active) VALUES ($1,'intelligence',$2)
       ON CONFLICT (tenant_id, pack_id) DO UPDATE SET active = EXCLUDED.active`,
      [acmeId, active],
    ),
  );
}
async function setAllowAi(allow: boolean): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO ai_settings (tenant_id, allow_ai) VALUES ($1,$2)
       ON CONFLICT (tenant_id) DO UPDATE SET allow_ai = EXCLUDED.allow_ai`,
      [acmeId, allow],
    ),
  );
}
async function setBudget(limit: number, used: number): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO ai_budgets (tenant_id, period, token_limit, tokens_used)
       VALUES ($1, date_trunc('month', now())::date, $2, $3)
       ON CONFLICT (tenant_id, period) DO UPDATE SET token_limit = EXCLUDED.token_limit, tokens_used = EXCLUDED.tokens_used`,
      [acmeId, limit, used],
    ),
  );
}

async function seedDocument(): Promise<string> {
  const id = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO documents (id, tenant_id, code, title, category, status, version, owner_id, created_by, updated_by)
       VALUES ($1,$2,$3,'AIHTTP doc','sop','approved','1.0',$4,$4,$4)`,
      [id, acmeId, `AIHTTP-${id.slice(0, 8)}`, userId],
    ),
  );
  return id;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [ACME]);
  acmeId = rows[0]!.id;

  const hash = await hashPassword(PASSWORD);
  const u = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ('ai-http@acme.test','AI HTTP',$1)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [hash],
  );
  userId = u.rows[0]!.id;
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,'manager','active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active'`,
      [acmeId, userId],
    ),
  );

  app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication();
  await app.init();

  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email: "ai-http@acme.test", password: PASSWORD });
  const cookies = res.headers["set-cookie"] as unknown as string[];
  tok = decodeURIComponent(cookies.find((c) => c.startsWith("kaenal_session="))?.split("=")[1]?.split(";")[0] ?? "");
});

afterAll(async () => {
  await withTenant(acmeId, null, async (tx) => {
    await tx.query("DELETE FROM ai_invocations WHERE tenant_id = $1", [acmeId]);
    await tx.query("DELETE FROM documents WHERE title = 'AIHTTP doc'");
    await tx.query("DELETE FROM ai_budgets WHERE tenant_id = $1", [acmeId]);
    await tx.query("DELETE FROM ai_settings WHERE tenant_id = $1", [acmeId]);
    await tx.query("DELETE FROM entitlements WHERE tenant_id = $1 AND pack_id = 'intelligence'", [acmeId]);
    await tx.query("DELETE FROM sessions WHERE user_id = $1", [userId]); // sign-in created one; FKs the membership
    await tx.query("DELETE FROM memberships WHERE user_id = $1", [userId]);
  });
  await control.query("DELETE FROM control.users WHERE email = 'ai-http@acme.test'");
  await app.close();
  await control.end();
});

beforeEach(async () => {
  await setPack(true);
  await setAllowAi(true);
  await setBudget(1_000_000, 0);
});

describe("POST /v1/ai/drafts", () => {
  it("returns a draft with provenance when entitled", async () => {
    const res = await authed("post", "/v1/ai/drafts").send({
      feature: "doc_summary",
      input: "Weld cell audit found guard interlock issues on line three",
      entityRefs: [{ kind: "ncr", id: randomUUID() }],
    });
    expect(res.status).toBe(200);
    expect(res.body.invocationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.value).toContain("Summary:");
    expect(res.body.confidence).toBe("medium");
    expect(res.body.sources).toHaveLength(1);
  });

  it("402 when the intelligence pack is inactive", async () => {
    await setPack(false);
    const res = await authed("post", "/v1/ai/drafts").send({ feature: "doc_summary", input: "hello" });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("ENTITLEMENT_REQUIRED");
  });

  it("402 when the budget is exhausted", async () => {
    await setBudget(100, 100);
    const res = await authed("post", "/v1/ai/drafts").send({ feature: "doc_summary", input: "hello" });
    expect(res.status).toBe(402);
  });

  it("403 when AI is disabled for the workspace", async () => {
    await setAllowAi(false);
    const res = await authed("post", "/v1/ai/drafts").send({ feature: "doc_summary", input: "hello" });
    expect(res.status).toBe(403);
  });

  it("422 on an unknown feature", async () => {
    const res = await authed("post", "/v1/ai/drafts").send({ feature: "not_a_feature", input: "hello" });
    expect(res.status).toBe(422);
  });
});

describe("POST /v1/ai/summaries/accept", () => {
  async function draftInvocation(): Promise<string> {
    const res = await authed("post", "/v1/ai/drafts").send({ feature: "doc_summary", input: "some document text to summarise" });
    return res.body.invocationId as string;
  }

  it("writes the reviewed summary + an ai_draft_accepted event, with optimistic concurrency", async () => {
    const docId = await seedDocument();
    const invocationId = await draftInvocation();

    const accept = await authed("post", "/v1/ai/summaries/accept").send({
      documentId: docId,
      value: "Reviewed: interlock issues on line 3.",
      invocationId,
      version: 0,
    });
    expect(accept.status).toBe(200);
    expect(accept.body.aiSummary).toBe("Reviewed: interlock issues on line 3.");
    expect(accept.body.lockVersion).toBe(1);

    const stored = await withTenant(acmeId, null, async (tx) => {
      const { rows } = await tx.query<{ ai_summary: string | null }>("SELECT ai_summary FROM documents WHERE id = $1", [docId]);
      return rows[0]!.ai_summary;
    });
    expect(stored).toBe("Reviewed: interlock issues on line 3.");

    const events = await withTenant(acmeId, null, async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_events WHERE entity_id = $1 AND action = 'ai_draft_accepted' AND actor_kind = 'user'",
        [docId],
      );
      return rows[0]!.n;
    });
    expect(events).toBe(1);

    // The version has advanced → the same accept again is a stale write.
    const stale = await authed("post", "/v1/ai/summaries/accept").send({
      documentId: docId,
      value: "again",
      invocationId,
      version: 0,
    });
    expect(stale.status).toBe(409);
  });

  it("404 when the invocation id is not a real succeeded draft", async () => {
    const docId = await seedDocument();
    const res = await authed("post", "/v1/ai/summaries/accept").send({
      documentId: docId,
      value: "x",
      invocationId: randomUUID(),
      version: 0,
    });
    expect(res.status).toBe(404);
  });
});
