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
 * Collaboration slice (FEATURES §9, §329): comments, the per-record access log
 * (a projection of audit_events), and cross-module related-record links. All
 * three are generic over EntityKind; this suite drives them against documents
 * (author + a second member so authorship rules bite) and pins: parent
 * visibility (404 for a record not in the tenant), author-only comment delete,
 * the access log surfacing 'created'/'commented' without leaking payloads, and
 * link create/list-from-both-ends/dedupe/self-link/delete.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";

let authorTok = ""; // manager — authors documents + comments
let otherTok = ""; // a different member

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

async function seedMember(email: string, role: string): Promise<string> {
  const hash = await hashPassword(PASSWORD);
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, failed_login_attempts = 0, locked_until = NULL
     RETURNING id`,
    [email, email, hash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(acmeId, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [acmeId, userId, role],
    );
  });
  return userId;
}

async function token(email: string): Promise<string> {
  const res = await request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", ACME).send({ email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign-in ${email}: ${res.status}`);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const session = cookies.find((c) => c.startsWith("kaenal_session="));
  return decodeURIComponent(session?.split("=")[1]?.split(";")[0] ?? "");
}

function authed(method: "get" | "post", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

interface Doc {
  id: string;
  lockVersion: number;
}

async function draft(bearer = authorTok): Promise<Doc> {
  const res = await authed("post", "/v1/documents", bearer).send({ title: "COLLABTEST SOP", category: "sop" });
  expect(res.status).toBe(201);
  return res.body as Doc;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);

  await seedMember("collab-author@acme.test", "manager");
  await seedMember("collab-other@acme.test", "manager");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  authorTok = await token("collab-author@acme.test");
  otherTok = await token("collab-other@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'collab-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM entity_links WHERE created_by = ANY($1)", [ids.length > 0 ? ids : [randomUUID()]]);
  await control.query("DELETE FROM comments WHERE author_id = ANY($1)", [ids.length > 0 ? ids : [randomUUID()]]);
  await control.query("DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE title LIKE 'COLLABTEST%')");
  await control.query("DELETE FROM documents WHERE title LIKE 'COLLABTEST%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("comments", () => {
  it("posts, lists, and lets only the author delete", async () => {
    const doc = await draft();

    const posted = await authed("post", "/v1/comments", authorTok).send({
      entityKind: "document",
      entityId: doc.id,
      body: "COLLABTEST first review pass looks good",
    });
    expect(posted.status).toBe(201);
    expect(posted.body.body).toContain("first review pass");
    // The author's display name is resolved server-side (thread reads without a round-trip).
    expect(typeof posted.body.authorName).toBe("string");
    expect(posted.body.authorName).not.toBe("");
    const commentId = posted.body.id as string;

    // A second member can read the thread…
    const list = await authed("get", `/v1/comments?entityKind=document&entityId=${doc.id}`, otherTok);
    expect(list.status).toBe(200);
    const listed = (list.body.items as { id: string; authorName: string | null }[]).find((c) => c.id === commentId);
    expect(listed).toBeDefined();
    expect(listed?.authorName).not.toBe("");

    // …but cannot delete someone else's comment.
    const foreignDelete = await authed("post", `/v1/comments/${commentId}/delete`, otherTok).send({});
    expect(foreignDelete.status).toBe(403);

    const ownDelete = await authed("post", `/v1/comments/${commentId}/delete`, authorTok).send({});
    expect(ownDelete.status).toBe(200);

    const after = await authed("get", `/v1/comments?entityKind=document&entityId=${doc.id}`, authorTok);
    expect((after.body.items as { id: string }[]).some((c) => c.id === commentId)).toBe(false);
  });

  it("404s a comment on a record not in the tenant", async () => {
    const res = await authed("post", "/v1/comments", authorTok).send({
      entityKind: "document",
      entityId: randomUUID(),
      body: "COLLABTEST orphan",
    });
    expect(res.status).toBe(404);
  });
});

describe("access log", () => {
  it("surfaces created + commented without leaking payloads", async () => {
    const doc = await draft();
    await authed("post", "/v1/comments", authorTok).send({
      entityKind: "document",
      entityId: doc.id,
      body: "COLLABTEST audited comment",
    });

    const log = await authed("get", `/v1/audit-events?entityKind=document&entityId=${doc.id}`, authorTok);
    expect(log.status).toBe(200);
    const actions = (log.body.items as { action: string }[]).map((e) => e.action);
    expect(actions).toContain("created");
    expect(actions).toContain("commented");
    // Projection must not carry the changed-field payloads.
    for (const e of log.body.items as Record<string, unknown>[]) {
      expect(e).not.toHaveProperty("before");
      expect(e).not.toHaveProperty("after");
    }
  });
});

describe("entity links", () => {
  it("links two records and reads them from either end; dedupes, blocks self-link, deletes", async () => {
    const a = await draft();
    const b = await draft();

    const linked = await authed("post", "/v1/entity-links", authorTok).send({
      fromKind: "document",
      fromId: a.id,
      toKind: "document",
      toId: b.id,
      relation: "reference",
    });
    expect(linked.status).toBe(201);
    const linkId = linked.body.id as string;

    // Visible from the 'from' side…
    const fromA = await authed("get", `/v1/entity-links?entityKind=document&entityId=${a.id}`, authorTok);
    expect((fromA.body.items as { id: string }[]).some((l) => l.id === linkId)).toBe(true);
    // …and from the 'to' side (edges are read in both directions).
    const fromB = await authed("get", `/v1/entity-links?entityKind=document&entityId=${b.id}`, authorTok);
    expect((fromB.body.items as { id: string }[]).some((l) => l.id === linkId)).toBe(true);

    // Duplicate live link → 409.
    const dup = await authed("post", "/v1/entity-links", authorTok).send({
      fromKind: "document",
      fromId: a.id,
      toKind: "document",
      toId: b.id,
      relation: "reference",
    });
    expect(dup.status).toBe(409);

    // Self-link → 422.
    const self = await authed("post", "/v1/entity-links", authorTok).send({
      fromKind: "document",
      fromId: a.id,
      toKind: "document",
      toId: a.id,
    });
    expect(self.status).toBe(422);

    // Link to a record not in the tenant → 404.
    const ghost = await authed("post", "/v1/entity-links", authorTok).send({
      fromKind: "document",
      fromId: a.id,
      toKind: "ncr",
      toId: randomUUID(),
    });
    expect(ghost.status).toBe(404);

    const removed = await authed("post", `/v1/entity-links/${linkId}/delete`, authorTok).send({});
    expect(removed.status).toBe(200);
    const afterDelete = await authed("get", `/v1/entity-links?entityKind=document&entityId=${a.id}`, authorTok);
    expect((afterDelete.body.items as { id: string }[]).some((l) => l.id === linkId)).toBe(false);
  });
});
