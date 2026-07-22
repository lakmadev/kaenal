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
 * Documents slice (02 §4, 03 §3).
 *
 * A controlled document: draft → pending → approved|rejected, approved →
 * archived, rejected → draft; a new version opens a fresh draft while the
 * approved version stays approved. This suite drives that end to end and pins
 * the three rules that make it "controlled": only an admin/manager reviews, an
 * author cannot approve their own document (four-eyes), and the last approved
 * version cannot be archived. Two managers are seeded so the author and the
 * approver can differ.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";

let adminTok = "";
let authorTok = ""; // manager — authors documents
let approverTok = ""; // a different manager — reviews them
let inspectorTok = "";
let viewerTok = "";

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
  code: string;
  status: string;
  version: string;
  lockVersion: number;
  ownerId: string | null;
  approverId: string | null;
}

/** author creates a draft document. */
async function draft(): Promise<Doc> {
  const res = await authed("post", "/v1/documents", authorTok).send({
    title: "DOCTEST Line 1 SOP",
    category: "sop",
  });
  expect(res.status).toBe(201);
  return res.body as Doc;
}

async function submit(doc: Doc, bearer = authorTok): Promise<Doc> {
  const res = await authed("post", `/v1/documents/${doc.id}/transition`, bearer).send({
    to: "pending",
    version: doc.lockVersion,
  });
  expect(res.status).toBe(200);
  return res.body as Doc;
}

/** create → submit → approve (by a different manager). Returns the approved doc. */
async function anApprovedDoc(): Promise<Doc> {
  let doc = await draft();
  doc = await submit(doc);
  const res = await authed("post", `/v1/documents/${doc.id}/review`, approverTok).send({
    decision: "approve",
    version: doc.lockVersion,
  });
  expect(res.status).toBe(200);
  return res.body as Doc;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);

  await seedMember("doc-admin@acme.test", "admin");
  await seedMember("doc-author@acme.test", "manager");
  await seedMember("doc-approver@acme.test", "manager");
  await seedMember("doc-inspector@acme.test", "inspector");
  await seedMember("doc-viewer@acme.test", "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  adminTok = await token("doc-admin@acme.test");
  authorTok = await token("doc-author@acme.test");
  approverTok = await token("doc-approver@acme.test");
  inspectorTok = await token("doc-inspector@acme.test");
  viewerTok = await token("doc-viewer@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'doc-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query(
    "DELETE FROM document_versions WHERE document_id IN (SELECT id FROM documents WHERE title LIKE 'DOCTEST%')",
  );
  await control.query("DELETE FROM documents WHERE title LIKE 'DOCTEST%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("document lifecycle", () => {
  it("creates a draft, submits, and is approved by a second person", async () => {
    let doc = await draft();
    expect(doc.status).toBe("draft");
    expect(doc.version).toBe("1.0");
    expect(doc.code).toMatch(/^DOC-\d{4}-\d+$/);

    doc = await submit(doc);
    expect(doc.status).toBe("pending");

    const approved = await authed("post", `/v1/documents/${doc.id}/review`, approverTok).send({
      decision: "approve",
      version: doc.lockVersion,
    });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");
    expect(approved.body.approverId).not.toBeNull();

    // The version under review is stamped approved in the history table.
    const versions = await authed("get", `/v1/documents/${doc.id}/versions`, authorTok);
    const v1 = (versions.body.items as { version: string; approvedBy: string | null }[]).find((v) => v.version === "1.0");
    expect(v1?.approvedBy).not.toBeNull();
  });

  it("rejects, then the author revises it back to draft", async () => {
    let doc = await draft();
    doc = await submit(doc);

    const rejected = await authed("post", `/v1/documents/${doc.id}/review`, approverTok).send({
      decision: "reject",
      version: doc.lockVersion,
      reason: "DOCTEST missing a revision history section",
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("rejected");
    doc = rejected.body as Doc;

    const revised = await authed("post", `/v1/documents/${doc.id}/transition`, authorTok).send({
      to: "draft",
      version: doc.lockVersion,
    });
    expect(revised.status).toBe(200);
    expect(revised.body.status).toBe("draft");
  });
});

describe("the three controlled-document rules", () => {
  it("forbids the author from approving their own document (four-eyes)", async () => {
    let doc = await draft();
    doc = await submit(doc);
    // The author holds document:approve (manager) — the capability guard passes,
    // then the machine's four-eyes rule denies it.
    const selfApprove = await authed("post", `/v1/documents/${doc.id}/review`, authorTok).send({
      decision: "approve",
      version: doc.lockVersion,
    });
    expect(selfApprove.status).toBe(403);
    expect(selfApprove.body.error.code).toBe("FORBIDDEN");
  });

  it("lets only an approver-role review (an inspector cannot)", async () => {
    let doc = await draft();
    doc = await submit(doc);
    const inspectorReview = await authed("post", `/v1/documents/${doc.id}/review`, inspectorTok).send({
      decision: "approve",
      version: doc.lockVersion,
    });
    expect(inspectorReview.status).toBe(403); // lacks document:approve
  });

  it("will not archive the only approved version, but will once another exists", async () => {
    const doc = await anApprovedDoc();

    // Only approved version → archiving would leave nothing effective.
    const early = await authed("post", `/v1/documents/${doc.id}/transition`, authorTok).send({
      to: "archived",
      version: doc.lockVersion,
    });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("CONFLICT");

    // Open + approve a second version, then the first can be superseded.
    const v2 = await authed("post", `/v1/documents/${doc.id}/versions`, authorTok).send({
      nextVersion: "2.0",
      version: doc.lockVersion,
    });
    expect(v2.status).toBe(201);
    expect(v2.body.status).toBe("draft");
    expect(v2.body.version).toBe("2.0");
    expect(v2.body.approverId).toBeNull();

    const pending2 = await submit(v2.body as Doc);
    const approved2 = await authed("post", `/v1/documents/${doc.id}/review`, approverTok).send({
      decision: "approve",
      version: pending2.lockVersion,
    });
    expect(approved2.status).toBe(200);

    const archived = await authed("post", `/v1/documents/${doc.id}/transition`, authorTok).send({
      to: "archived",
      version: approved2.body.lockVersion,
    });
    expect(archived.status).toBe(200);
    expect(archived.body.status).toBe("archived");
  });
});

describe("versioning + concurrency + RBAC", () => {
  it("opens a new version only from an approved document", async () => {
    const doc = await draft(); // still draft
    const res = await authed("post", `/v1/documents/${doc.id}/versions`, authorTok).send({
      nextVersion: "2.0",
      version: doc.lockVersion,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("keeps the old version approved in history after a new draft opens", async () => {
    const doc = await anApprovedDoc();
    await authed("post", `/v1/documents/${doc.id}/versions`, authorTok).send({
      nextVersion: "1.1",
      version: doc.lockVersion,
    });
    const versions = await authed("get", `/v1/documents/${doc.id}/versions`, authorTok);
    const items = versions.body.items as { version: string; approvedBy: string | null }[];
    expect(items.find((v) => v.version === "1.0")?.approvedBy).not.toBeNull();
    expect(items.find((v) => v.version === "1.1")?.approvedBy).toBeNull();
  });

  it("rejects a stale transition (STALE_WRITE)", async () => {
    const doc = await draft();
    const res = await authed("post", `/v1/documents/${doc.id}/transition`, authorTok).send({
      to: "pending",
      version: doc.lockVersion + 9,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE_WRITE");
  });

  it("lets a viewer read but not author a document", async () => {
    const doc = await draft();

    const read = await authed("get", `/v1/documents/${doc.id}`, viewerTok);
    expect(read.status).toBe(200);
    expect(read.body.code).toBe(doc.code);

    const create = await authed("post", "/v1/documents", viewerTok).send({ title: "DOCTEST nope", category: "form" });
    expect(create.status).toBe(403);
  });

  it("returns 404 for an unknown document id", async () => {
    const res = await authed("get", `/v1/documents/${randomUUID()}`, adminTok);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
