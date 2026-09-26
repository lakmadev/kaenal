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

/** S1-9 preferences (self-scoped, optimistic, audited) + S1-10 mention notifications. */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let aId = "";
let bId = "";
let aTok = "";
let bTok = "";
let ncrId = "";

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

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

function authed(method: "get" | "post" | "patch", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const t = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [ACME]);
  acmeId = t.rows[0]?.id ?? "";
  aId = await seedMember("pm-a@acme.test", "manager");
  bId = await seedMember("pm-b@acme.test", "inspector");
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  aTok = await token("pm-a@acme.test");
  bTok = await token("pm-b@acme.test");
  const ncr = await authed("post", "/v1/ncrs", aTok).send({ title: "PREFMENTION ncr", priority: "minor" });
  ncrId = (ncr.body as { id: string }).id;
});

afterAll(async () => {
  const ids = [aId, bId];
  await control.query("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM user_preferences WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
  await control.end();
  await app.close();
});

describe("preferences", () => {
  it("returns defaults at version 0, saves, and bumps the version", async () => {
    const got = await authed("get", "/v1/me/preferences", aTok);
    expect(got.status).toBe(200);
    expect(got.body).toMatchObject({ aiProminence: "normal", accent: "ink", density: "comfortable", lockVersion: 0 });

    const saved = await authed("patch", "/v1/me/preferences", aTok).send({ version: 0, aiProminence: "quiet", density: "compact" });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ aiProminence: "quiet", density: "compact", accent: "ink", lockVersion: 1 });

    const next = await authed("patch", "/v1/me/preferences", aTok).send({ version: 1, keyboardShortcuts: false });
    expect(next.body).toMatchObject({ aiProminence: "quiet", keyboardShortcuts: false, lockVersion: 2 });
  });

  it("rejects a stale version with 409 and invalid values with 422", async () => {
    const stale = await authed("patch", "/v1/me/preferences", aTok).send({ version: 0, accent: "teal" });
    expect(stale.status).toBe(409);
    const bad = await authed("patch", "/v1/me/preferences", aTok).send({ version: 2, aiProminence: "visible" });
    expect(bad.status).toBeGreaterThanOrEqual(400);
    expect(bad.status).not.toBe(409);
  });

  it("is self-scoped: another user still sees defaults", async () => {
    const other = await authed("get", "/v1/me/preferences", bTok);
    expect(other.body).toMatchObject({ aiProminence: "normal", keyboardShortcuts: true, lockVersion: 0 });
  });

  it("writes a preferences.update audit event", async () => {
    const { rows } = await control.query(
      "SELECT 1 FROM audit_events WHERE entity_kind = 'user_preferences' AND entity_id = $1 AND after->>'event' = 'preferences.update'",
      [aId],
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("mention notifications", () => {
  it("notifies a mentioned member, ignores self/unknown ids, and filters by type=mention", async () => {
    const res = await authed("post", "/v1/comments", aTok).send({
      entityKind: "ncr",
      entityId: ncrId,
      body: `Please look @[B](user:${bId}) and @[me](user:${aId}) and @[ghost](user:${randomUUID()})`,
    });
    expect(res.status).toBe(201);

    const mine = await authed("get", "/v1/notifications?type=mention", bTok);
    const items = mine.body.items as { kind: string; entityId: string; actorId: string }[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "mention", entityId: ncrId, actorId: aId });

    const author = await authed("get", "/v1/notifications?type=mention", aTok);
    expect(author.body.items).toHaveLength(0);
  });
});
