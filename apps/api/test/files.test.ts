import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { MAX_FILE_BYTES } from "@kaenal/core";
import { AppModule } from "../src/app.module.js";
import { FakeStorage } from "../src/files/storage.js";
import { STORAGE } from "../src/tokens.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Files slice (03 §7, 07 §3).
 *
 * The three-step upload (presign → upload → complete) and, above all, the AV
 * scan download gate: a file that is not `clean` is downloadable only by its
 * uploader while pending, and by no one once `infected`. Storage is bound to a
 * `FakeStorage` so none of this needs a live bucket. The AV scanner is a Phase-2
 * job, so the suite simulates its verdict by setting `scan_status` directly.
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
const fake = new FakeStorage();

let uploaderTok = "";
let otherTok = "";
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

interface Presigned {
  fileId: string;
  uploadUrl: string;
  expiresIn: number;
}

async function presign(bearer = uploaderTok, over: Record<string, unknown> = {}): Promise<Presigned> {
  const res = await authed("post", "/v1/files/presign", bearer).send({
    filename: "evidence.pdf",
    mime: "application/pdf",
    sizeBytes: 2048,
    ...over,
  });
  expect(res.status).toBe(201);
  return res.body as Presigned;
}

async function keyOf(fileId: string): Promise<string> {
  const { rows } = await control.query<{ key: string }>("SELECT key FROM files WHERE id = $1", [fileId]);
  return rows[0]?.key ?? "";
}

async function setScan(fileId: string, status: string): Promise<void> {
  await control.query("UPDATE files SET scan_status = $2 WHERE id = $1", [fileId, status]);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);

  await seedMember("file-uploader@acme.test", "manager");
  await seedMember("file-other@acme.test", "inspector");
  await seedMember("file-viewer@acme.test", "viewer");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(STORAGE)
    .useValue(fake)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();

  uploaderTok = await token("file-uploader@acme.test");
  otherTok = await token("file-other@acme.test");
  viewerTok = await token("file-viewer@acme.test");
});

afterAll(async () => {
  const ids = (
    await control.query<{ id: string }>("SELECT id FROM control.users WHERE email LIKE 'file-%@acme.test'")
  ).rows.map((r) => r.id);
  await control.query("DELETE FROM files WHERE filename LIKE 'evidence%' OR filename LIKE 'FILETEST%'");
  if (ids.length > 0) {
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

describe("upload flow", () => {
  it("presigns, completes, and records the hash", async () => {
    const p = await presign();
    expect(p.uploadUrl).toContain("fake-storage.local");
    expect(p.expiresIn).toBeGreaterThan(0);

    const done = await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    expect(done.status).toBe(200);
    expect(done.body.sha256).not.toBeNull();
    expect(done.body.scanStatus).toBe("pending"); // AV scan hasn't run yet

    const meta = await authed("get", `/v1/files/${p.fileId}`, uploaderTok);
    expect(meta.status).toBe(200);
    expect(meta.body.mime).toBe("application/pdf");
  });

  it("rejects a disallowed mime and an oversized declared size at presign", async () => {
    const svg = await authed("post", "/v1/files/presign", uploaderTok).send({
      filename: "x.svg",
      mime: "image/svg+xml",
      sizeBytes: 100,
    });
    expect(svg.status).toBe(422);

    const big = await authed("post", "/v1/files/presign", uploaderTok).send({
      filename: "big.pdf",
      mime: "application/pdf",
      sizeBytes: MAX_FILE_BYTES + 1,
    });
    expect(big.status).toBe(422);
  });

  it("refuses to complete when no object was uploaded", async () => {
    const p = await presign();
    fake.remove(await keyOf(p.fileId)); // client never actually uploaded
    const done = await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    expect(done.status).toBe(422);
  });

  it("re-checks the real object size against the cap on complete", async () => {
    const p = await presign();
    fake.setSize(await keyOf(p.fileId), MAX_FILE_BYTES + 1); // uploaded more than declared
    const done = await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    expect(done.status).toBe(422);
  });

  it("lets only the uploader complete, and only once", async () => {
    const p = await presign(uploaderTok);
    const byOther = await authed("post", `/v1/files/${p.fileId}/complete`, otherTok).send({});
    expect(byOther.status).toBe(403);

    const first = await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    expect(first.status).toBe(200);
    const second = await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    expect(second.status).toBe(409);
  });

  it("lets any authenticated member (even a viewer) presign — files have no capability gate", async () => {
    const p = await presign(viewerTok);
    expect(p.fileId).toBeTruthy();
  });
});

describe("the AV scan download gate (07 §3)", () => {
  it("lets the uploader download a pending file but hides it from others", async () => {
    const p = await presign(uploaderTok);
    await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});

    const mine = await authed("get", `/v1/files/${p.fileId}/download`, uploaderTok);
    expect(mine.status).toBe(200);
    expect(mine.body.scanPending).toBe(true);
    expect(mine.body.url).toContain("fake-storage.local");

    const theirs = await authed("get", `/v1/files/${p.fileId}/download`, otherTok);
    expect(theirs.status).toBe(403);
  });

  it("lets anyone download once the scan is clean, and audits it", async () => {
    const p = await presign(uploaderTok);
    await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    await setScan(p.fileId, "clean");

    const dl = await authed("get", `/v1/files/${p.fileId}/download`, otherTok);
    expect(dl.status).toBe(200);
    expect(dl.body.scanPending).toBe(false);

    const { rows } = await control.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM audit_events WHERE entity_kind = 'file' AND entity_id = $1 AND action = 'file_downloaded'",
      [p.fileId],
    );
    expect(Number(rows[0]?.n)).toBeGreaterThanOrEqual(1);
  });

  it("presents inline for preview and attachment by default", async () => {
    const p = await presign(uploaderTok);
    await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    await setScan(p.fileId, "clean");

    // The document Preview asks for an inline URL (renders in the iframe);
    // the Download button gets the default attachment (forces a download).
    const inline = await authed("get", `/v1/files/${p.fileId}/download?disposition=inline`, uploaderTok);
    expect(inline.status).toBe(200);
    expect(inline.body.url).toContain("disposition=inline");

    const attach = await authed("get", `/v1/files/${p.fileId}/download`, uploaderTok);
    expect(attach.status).toBe(200);
    expect(attach.body.url).toContain("disposition=attachment");
  });

  it("blocks everyone — including the uploader — from an infected file", async () => {
    const p = await presign(uploaderTok);
    await authed("post", `/v1/files/${p.fileId}/complete`, uploaderTok).send({});
    await setScan(p.fileId, "infected");

    const owner = await authed("get", `/v1/files/${p.fileId}/download`, uploaderTok);
    expect(owner.status).toBe(403);
    const other = await authed("get", `/v1/files/${p.fileId}/download`, otherTok);
    expect(other.status).toBe(403);
  });

  it("returns 404 for an unknown file id", async () => {
    const res = await authed("get", `/v1/files/${randomUUID()}`, uploaderTok);
    expect(res.status).toBe(404);
  });
});
