import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { AppModule } from "../src/app.module.js";
import { NotificationsService } from "../src/notifications/notifications.service.js";
import { hashPassword } from "../src/auth/passwords.js";

/**
 * Notifications slice (02 §2, 06).
 *
 * The consumer API — list / unread-count / mark-read / mark-all / channel prefs
 * — all scoped to the current user, plus the `notify` write primitive the
 * producing side (an NCR assignment, an SLA job) will call. Rows are seeded via
 * `notify` itself, so its dedupe (a retried job must not double-notify) is
 * exercised too. Everything is per-user: one member never sees or mutates
 * another's notifications (a foreign id is a 404, not a 403).
 */

const ACME = "acme";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let userAId = "";
let userBId = "";
let aTok = "";
let bTok = "";
const notifications = new NotificationsService();

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

function authed(method: "get" | "post" | "put", path: string, bearer: string) {
  return request(server())[method](path).set("X-Tenant-Id", ACME).set("Authorization", `Bearer ${bearer}`);
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  userAId = await seedMember("notif-a@acme.test", "manager");
  userBId = await seedMember("notif-b@acme.test", "inspector");

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
  aTok = await token("notif-a@acme.test");
  bTok = await token("notif-b@acme.test");

  // Seed via notify() itself — the two ncr_assigned calls share a dedupeKey, so
  // A ends up with exactly THREE rows, proving the retry was a no-op.
  const ncrId = randomUUID();
  await withTenant(acmeId, null, async (tx) => {
    await notifications.notify(tx, acmeId, {
      userId: userAId, kind: "ncr_assigned", title: "NOTIFTEST NCR assigned", entityKind: "ncr", entityId: ncrId, dedupeKey: "NOTIFTEST-dedupe-1",
    });
    await notifications.notify(tx, acmeId, {
      userId: userAId, kind: "ncr_assigned", title: "NOTIFTEST NCR assigned (retry)", entityKind: "ncr", entityId: ncrId, dedupeKey: "NOTIFTEST-dedupe-1",
    });
    await notifications.notify(tx, acmeId, { userId: userAId, kind: "document_approved", title: "NOTIFTEST doc approved" });
    await notifications.notify(tx, acmeId, { userId: userAId, kind: "capa_due", title: "NOTIFTEST capa due" });
    await notifications.notify(tx, acmeId, { userId: userBId, kind: "ncr_assigned", title: "NOTIFTEST for B" });
  });
});

afterAll(async () => {
  const ids = [userAId, userBId];
  await control.query("DELETE FROM notifications WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM notification_prefs WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
  await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  await control.end();
  await app.close();
});

describe("listing + dedupe + isolation", () => {
  it("lists only the current user's notifications", async () => {
    const res = await authed("get", "/v1/notifications", aTok);
    expect(res.status).toBe(200);
    const items = res.body.items as { title: string; readAt: string | null }[];
    expect(items.length).toBe(3); // four notify() calls, one deduped away
    for (const n of items) expect(n.title).toContain("NOTIFTEST");
    expect(items.every((n) => n.readAt === null)).toBe(true);
  });

  it("counts unread for the bell badge", async () => {
    const res = await authed("get", "/v1/notifications/unread-count", aTok);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it("keeps one user's notifications invisible to another", async () => {
    const res = await authed("get", "/v1/notifications", bTok);
    const items = res.body.items as { title: string }[];
    expect(items.length).toBe(1);
    expect(items[0]?.title).toBe("NOTIFTEST for B");
  });
});

describe("read state", () => {
  it("marks one read (idempotently) and 404s a foreign notification", async () => {
    const list = await authed("get", "/v1/notifications", aTok);
    const first = (list.body.items as { id: string }[])[0]!;

    const read = await authed("post", `/v1/notifications/${first.id}/read`, aTok).send({});
    expect(read.status).toBe(200);
    expect(read.body.readAt).not.toBeNull();

    // Idempotent — reading again is fine.
    const again = await authed("post", `/v1/notifications/${first.id}/read`, aTok).send({});
    expect(again.status).toBe(200);

    // Another user cannot touch A's notification — 404, not 403 (rule 8).
    const foreign = await authed("post", `/v1/notifications/${first.id}/read`, bTok).send({});
    expect(foreign.status).toBe(404);

    const count = await authed("get", "/v1/notifications/unread-count", aTok);
    expect(count.body.count).toBe(2);
  });

  it("marks all remaining read", async () => {
    const all = await authed("post", "/v1/notifications/read-all", aTok).send({});
    expect(all.status).toBe(200);
    expect(all.body.count).toBe(2);

    const count = await authed("get", "/v1/notifications/unread-count", aTok);
    expect(count.body.count).toBe(0);

    const unread = await authed("get", "/v1/notifications?unread=true", aTok);
    expect((unread.body.items as unknown[]).length).toBe(0);
  });
});

describe("star, dismiss, and filters", () => {
  let starId = "";
  beforeAll(async () => {
    await withTenant(acmeId, null, async (tx) => {
      const n = await notifications.notify(tx, acmeId, {
        userId: userAId,
        actorId: userBId,
        kind: "ncr_assigned",
        title: "NOTIFTEST star me",
        entityKind: "ncr",
        entityId: randomUUID(),
      });
      starId = n?.id ?? "";
    });
  });

  it("carries the actor through to the DTO", async () => {
    const list = await authed("get", "/v1/notifications", aTok);
    const seeded = (list.body.items as { id: string; actorId: string | null; starred: boolean }[]).find(
      (n) => n.id === starId,
    );
    expect(seeded?.actorId).toBe(userBId);
    expect(seeded?.starred).toBe(false);
  });

  it("stars, filters by starred, and un-stars", async () => {
    const star = await authed("post", `/v1/notifications/${starId}/star`, aTok).send({ starred: true });
    expect(star.status).toBe(200);
    expect(star.body.starred).toBe(true);

    // Another user cannot star A's notification — 404, not 403 (rule 8).
    const foreign = await authed("post", `/v1/notifications/${starId}/star`, bTok).send({ starred: true });
    expect(foreign.status).toBe(404);

    const starred = await authed("get", "/v1/notifications?starred=true", aTok);
    const ids = (starred.body.items as { id: string }[]).map((n) => n.id);
    expect(ids).toContain(starId);
    expect(ids.every((id) => id === starId)).toBe(true);

    const un = await authed("post", `/v1/notifications/${starId}/star`, aTok).send({ starred: false });
    expect(un.body.starred).toBe(false);
  });

  it("filters by entityKind", async () => {
    const res = await authed("get", "/v1/notifications?entityKind=ncr", aTok);
    const items = res.body.items as { entityKind: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((n) => n.entityKind === "ncr")).toBe(true);
  });

  it("dismisses (soft-delete), hiding it from the list, and is 404-safe + idempotent", async () => {
    const before = (await authed("get", "/v1/notifications", aTok)).body.items as unknown[];

    // B cannot dismiss A's row — it touches nothing, no existence leak.
    const foreign = await authed("post", `/v1/notifications/${starId}/dismiss`, bTok).send({});
    expect(foreign.body.count).toBe(0);

    const dismiss = await authed("post", `/v1/notifications/${starId}/dismiss`, aTok).send({});
    expect(dismiss.status).toBe(200);
    expect(dismiss.body.count).toBe(1);

    const after = await authed("get", "/v1/notifications", aTok);
    const afterIds = (after.body.items as { id: string }[]).map((n) => n.id);
    expect(afterIds).not.toContain(starId);
    expect(afterIds.length).toBe(before.length - 1);

    // A second dismiss is a no-op.
    const again = await authed("post", `/v1/notifications/${starId}/dismiss`, aTok).send({});
    expect(again.body.count).toBe(0);
  });
});

describe("channel preferences", () => {
  it("starts empty and round-trips the matrix", async () => {
    const initial = await authed("get", "/v1/notification-prefs", bTok);
    expect(initial.status).toBe(200);
    expect(initial.body.matrix).toEqual({});

    const matrix = {
      ncr_assigned: { inapp: true, email: true, push: false, sms: false },
      capa_due: { inapp: true, email: false, push: false, sms: false },
    };
    const put = await authed("put", "/v1/notification-prefs", bTok).send({ matrix });
    expect(put.status).toBe(200);
    expect(put.body.matrix).toEqual(matrix);

    const get = await authed("get", "/v1/notification-prefs", bTok);
    expect(get.body.matrix).toEqual(matrix);
  });
});
