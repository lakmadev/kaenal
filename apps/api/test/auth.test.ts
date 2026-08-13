import "reflect-metadata";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { MAX_FAILED_ATTEMPTS } from "@kaenal/core";
import { AppModule } from "../src/app.module.js";

/**
 * Auth end-to-end (03 §2, 07 §7).
 *
 * The whole real stack: invitation → accept → sign-in → authenticated request
 * → sign-out, plus lockout, four-eyes-adjacent membership scoping, and the
 * uniform failure envelope. Runs against real Postgres and Redis because the
 * guarantees under test — sessions surviving RLS, lockout counters surviving a
 * rolled-back request, cross-tenant sign-in returning the same error as a bad
 * password — are all properties of the wiring.
 */

const ACME = "acme";
const GLOBEX = "globex";
const PASSWORD = "correct-horse-battery-staple";

let app: INestApplication;
let control: pg.Pool;
let acmeId = "";
let globexId = "";
/**
 * The users THIS suite seeds, tracked by id so teardown removes exactly them.
 * A domain-wide `%@acme.test` sweep would also delete the provisioned demo
 * admin (`admin@acme.test`) — and its sessions — which is why local demo
 * sign-in kept dying between test runs. Delete only what we created.
 */
const seededUserIds: string[] = [];

type App = Parameters<typeof request>[0];
const server = (): App => app.getHttpServer() as App;

async function tenantId(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>(
    "SELECT id FROM control.tenants WHERE slug = $1",
    [slug],
  );
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

/** Directly creates an accepted invitation's end state: person + membership. */
async function seedMember(
  tid: string,
  email: string,
  role: string,
  passwordHash: string | null,
): Promise<string> {
  const { rows } = await control.query<{ id: string }>(
    `INSERT INTO control.users (email, name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [email, email, passwordHash],
  );
  const userId = rows[0]?.id ?? "";
  await withTenant(tid, null, async (tx) => {
    await tx.query(
      `INSERT INTO memberships (tenant_id, user_id, role, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [tid, userId, role],
    );
  });
  if (userId !== "" && !seededUserIds.includes(userId)) seededUserIds.push(userId);
  return userId;
}

async function resetCredentials(email: string): Promise<void> {
  await control.query(
    "UPDATE control.users SET failed_login_attempts = 0, locked_until = NULL WHERE email = $1",
    [email],
  );
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tenantId(ACME);
  globexId = await tenantId(GLOBEX);

  // A hash the tests can sign in against. Produced by the real hasher so the
  // verify path is exercised, not stubbed.
  const { hashPassword } = await import("../src/auth/passwords.js");
  const hash = await hashPassword(PASSWORD);

  await seedMember(acmeId, "ada@acme.test", "admin", hash);
  await seedMember(acmeId, "grace@acme.test", "inspector", hash);
  await seedMember(globexId, "hopper@globex.test", "manager", hash);
  // A person who is a member of globex but NOT acme, to prove cross-tenant
  // sign-in is refused indistinguishably from a bad password (07 §7 + rule 8).
  await seedMember(globexId, "katherine@globex.test", "manager", hash);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  // Memberships reference control.users with ON DELETE RESTRICT, and sessions
  // reference memberships — so tear down inside-out. Delete ONLY the users this
  // suite seeded (tracked by id) plus the ones the invitation-flow tests mint
  // (`@invite.test`). A domain-wide `%@acme.test` sweep used to live here and
  // would also delete the provisioned demo admin `admin@acme.test` — wiping its
  // sessions and membership on every run (and, since Phase F, tripping the
  // `fmeas_created_by_member_fk` on its demo FMEAs). Deleting only our own
  // fixtures leaves the demo seed — and the developer's local data — intact.
  const invited = await control.query<{ id: string }>(
    `SELECT id FROM control.users WHERE email LIKE '%@invite.test'`,
  );
  const ids = [...new Set([...seededUserIds, ...invited.rows.map((r) => r.id)])];
  if (ids.length > 0) {
    // sessions and memberships are RLS-forced, so clear them as the owner
    // rather than per-tenant. audit_events is append-only and left as-is.
    await control.query("DELETE FROM sessions WHERE user_id = ANY($1)", [ids]);
    // invitations.invited_by references memberships, so clear invitations
    // before the memberships they point at.
    await control.query("DELETE FROM invitations WHERE invited_by = ANY($1) OR email LIKE '%@invite.test'", [ids]);
    await control.query("DELETE FROM memberships WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.password_resets WHERE user_id = ANY($1)", [ids]);
    await control.query("DELETE FROM control.users WHERE id = ANY($1)", [ids]);
  }
  await control.end();
  await app.close();
});

const signIn = (slug: string, email: string, password: string) =>
  request(server()).post("/v1/auth/sign-in").set("X-Tenant-Id", slug).send({ email, password });

function errorSansRequestId(body: { error: Record<string, unknown> }): Record<string, unknown> {
  const { requestId: _drop, ...rest } = body.error;
  return rest;
}

/** Signs in and returns the cookie header plus the CSRF token, for mutations. */
async function authedSession(email: string): Promise<{ cookie: string; csrf: string }> {
  await resetCredentials(email);
  const res = await signIn(ACME, email, PASSWORD);
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  const csrf = decodeURIComponent(
    cookies.find((c) => c.startsWith("kaenal_csrf="))?.split("=")[1]?.split(";")[0] ?? "",
  );
  return { cookie, csrf };
}

describe("sign-in", () => {
  beforeEach(async () => {
    await resetCredentials("ada@acme.test");
  });

  it("issues an httpOnly session cookie on valid credentials", async () => {
    const res = await signIn(ACME, "ada@acme.test", PASSWORD);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: "admin" });

    const cookies = res.headers["set-cookie"] as unknown as string[];
    const session = cookies.find((c) => c.startsWith("kaenal_session="));
    expect(session).toBeDefined();
    expect(session).toMatch(/HttpOnly/i);
    expect(cookies.some((c) => c.startsWith("kaenal_csrf="))).toBe(true);
  });

  it("rejects a wrong password with UNAUTHENTICATED", async () => {
    const res = await signIn(ACME, "ada@acme.test", "wrong-password-here");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("gives the SAME response for an unknown email as for a wrong password", async () => {
    // A different code or message would turn the login form into an account
    // enumeration oracle. requestId differs per request by design, so compare
    // everything else.
    const wrong = await signIn(ACME, "ada@acme.test", "wrong-password-here");
    const unknown = await signIn(ACME, "nobody@acme.test", PASSWORD);
    expect(unknown.status).toBe(wrong.status);
    expect(errorSansRequestId(unknown.body)).toEqual(errorSansRequestId(wrong.body));
  });

  it("refuses a valid credential for a tenant the user does not belong to (07 §7, rule 8)", async () => {
    // katherine is a real globex member with the real password, but not an
    // acme member. Signing in at acme must look exactly like a bad password —
    // never 'you exist elsewhere'.
    const foreign = await signIn(ACME, "katherine@globex.test", PASSWORD);
    const wrong = await signIn(ACME, "ada@acme.test", "wrong-password-here");
    expect(foreign.status).toBe(401);
    expect(errorSansRequestId(foreign.body)).toEqual(errorSansRequestId(wrong.body));

    // ...and the same person signs in fine at their own tenant.
    const home = await signIn(GLOBEX, "katherine@globex.test", PASSWORD);
    expect(home.status).toBe(201);
  });
});

describe("account lockout (03 §2: 10 failures → 15 min)", () => {
  beforeEach(async () => {
    await resetCredentials("grace@acme.test");
  });

  it("locks the account after the threshold and rejects the correct password while locked", async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await signIn(ACME, "grace@acme.test", "nope-nope-nope");
    }
    // Now the correct password is refused too — and with the same envelope, so
    // the lock is not observable to the attacker.
    const locked = await signIn(ACME, "grace@acme.test", PASSWORD);
    expect(locked.status).toBe(401);
    expect(locked.body.error.code).toBe("UNAUTHENTICATED");

    const { rows } = await control.query<{ locked_until: Date | null }>(
      "SELECT locked_until FROM control.users WHERE email = 'grace@acme.test'",
    );
    expect(rows[0]?.locked_until).not.toBeNull();
  });

  it("records failed sign-ins in the audit trail even though the request is rejected", async () => {
    // The event must survive the rejection that produced it — failed logins are
    // the first thing a security review asks for.
    const before = await auditCount(acmeId, "sign_in_failed");
    await signIn(ACME, "grace@acme.test", "still-wrong-here");
    const after = await auditCount(acmeId, "sign_in_failed");
    expect(after).toBeGreaterThan(before);
  });
});

async function auditCount(tid: string, action: string): Promise<number> {
  return withTenant(tid, null, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_events WHERE action = $1",
      [action],
    );
    return rows[0]?.n ?? 0;
  });
}

describe("authenticated requests and sign-out", () => {
  async function sessionCookie(): Promise<string> {
    await resetCredentials("ada@acme.test");
    const res = await signIn(ACME, "ada@acme.test", PASSWORD);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    return cookies.map((c) => c.split(";")[0]).join("; ");
  }

  it("GET /v1/me returns the caller's role and capabilities once signed in", async () => {
    const cookie = await sessionCookie();
    const res = await request(server()).get("/v1/me").set("X-Tenant-Id", ACME).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
    expect(res.body.capabilities).toContain("members:manage");
  });

  it("a bearer token works the same as the cookie (mobile)", async () => {
    await resetCredentials("ada@acme.test");
    const signed = await signIn(ACME, "ada@acme.test", PASSWORD);
    const token = (signed.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("kaenal_session="))
      ?.split("=")[1]
      ?.split(";")[0];
    expect(token).toBeTruthy();

    const res = await request(server())
      .get("/v1/me")
      .set("X-Tenant-Id", ACME)
      .set("Authorization", `Bearer ${decodeURIComponent(token ?? "")}`);
    expect(res.status).toBe(200);
  });

  it("sign-out revokes the session so the cookie stops working", async () => {
    // Sign-out is a cookie-auth mutation, so it needs the CSRF header like any
    // other — an attacker forcing a sign-out is still a cross-site write.
    const { cookie, csrf } = await authedSession("ada@acme.test");

    const out = await request(server())
      .post("/v1/auth/sign-out")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf);
    expect(out.status).toBe(201);

    const after = await request(server()).get("/v1/me").set("X-Tenant-Id", ACME).set("Cookie", cookie);
    expect(after.status).toBe(401);
  });
});

describe("CSRF on cookie-authenticated mutations (03 §2)", () => {
  it("rejects a cookie-auth POST without the matching CSRF header", async () => {
    const { cookie } = await authedSession("ada@acme.test");

    // A state-changing POST authenticated by cookie, but with no CSRF header:
    // the double-submit check must fail.
    const res = await request(server())
      .post("/v1/auth/invite")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", cookie)
      .send({ email: "x@invite.test", role: "viewer" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("accepts the same POST when the CSRF header matches the cookie", async () => {
    const { cookie, csrf } = await authedSession("ada@acme.test");

    const res = await request(server())
      .post("/v1/auth/invite")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf)
      .send({ email: "invitee@invite.test", role: "inspector" });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("invitee@invite.test");
    // Outside production the one-time token is returned so the flow is testable.
    expect(res.body.token).toBeTruthy();
  });

  it("does NOT let a stale session cookie block sign-in (the @AllowAnonymous recovery path)", async () => {
    await resetCredentials("ada@acme.test");

    // The real-world trap: a `kaenal_session` cookie is still in the browser jar
    // but the row behind it is gone (revoked, test churn, db reset). CSRF is a
    // POST-on-cookie check, so if it ran *before* the session was resolved the
    // sign-in POST would 403 on the missing CSRF header — locking the user out
    // of the one page that recovers the situation. It must resolve to "expired"
    // and fall through to anonymous instead, so the credential still signs in.
    const res = await request(server())
      .post("/v1/auth/sign-in")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", "kaenal_session=this-session-no-longer-exists")
      .send({ email: "ada@acme.test", password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: "admin" });
  });

  it("lets a signed-in user sign in again without a CSRF token (stale-but-VALID session)", async () => {
    await resetCredentials("ada@acme.test");

    // The most common real trap: the user never signed out, so a genuinely
    // VALID `kaenal_session` is still in the jar, but its paired readable
    // `kaenal_csrf` cookie is gone (evicted, cleared, or the FE can't read it) —
    // so the sign-in POST carries no CSRF header. Sign-in is @AllowAnonymous and
    // acts only on the body credentials, so it must NOT demand CSRF from that
    // leftover session; otherwise it 403s and the form mislabels it as a bad
    // password. Send the valid session cookie WITHOUT an X-CSRF-Token header.
    const { cookie } = await authedSession("ada@acme.test");
    const sessionOnly = cookie
      .split(/;\s*/)
      .find((c) => c.startsWith("kaenal_session="));
    expect(sessionOnly).toBeDefined();

    const res = await request(server())
      .post("/v1/auth/sign-in")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", sessionOnly!)
      .send({ email: "ada@acme.test", password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: "admin" });
  });
});

describe("invitation → accept → sign-in (07 §7)", () => {
  it("lets an admin invite, the invitee accept, and then sign in", async () => {
    const { cookie, csrf } = await authedSession("ada@acme.test");

    const invite = await request(server())
      .post("/v1/auth/invite")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf)
      .send({ email: "newhire@invite.test", role: "inspector" });
    expect(invite.status).toBe(201);
    const token = invite.body.token as string;

    const accept = await request(server())
      .post("/v1/auth/accept-invite")
      .set("X-Tenant-Id", ACME)
      .send({ token, name: "New Hire", password: PASSWORD });
    expect(accept.status).toBe(201);

    const login = await signIn(ACME, "newhire@invite.test", PASSWORD);
    expect(login.status).toBe(201);
    expect(login.body.role).toBe("inspector");
  });

  it("refuses a reused invitation token", async () => {
    const { cookie, csrf } = await authedSession("ada@acme.test");

    const invite = await request(server())
      .post("/v1/auth/invite")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf)
      .send({ email: "second@invite.test", role: "viewer" });
    const token = invite.body.token as string;

    const first = await request(server())
      .post("/v1/auth/accept-invite")
      .set("X-Tenant-Id", ACME)
      .send({ token, name: "Second", password: PASSWORD });
    expect(first.status).toBe(201);

    const replay = await request(server())
      .post("/v1/auth/accept-invite")
      .set("X-Tenant-Id", ACME)
      .send({ token, name: "Second Again", password: PASSWORD });
    expect(replay.status).toBe(404);
  });

  it("weak password is rejected at accept time", async () => {
    const { cookie, csrf } = await authedSession("ada@acme.test");

    const invite = await request(server())
      .post("/v1/auth/invite")
      .set("X-Tenant-Id", ACME)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrf)
      .send({ email: "weak@invite.test", role: "viewer" });
    const token = invite.body.token as string;

    const accept = await request(server())
      .post("/v1/auth/accept-invite")
      .set("X-Tenant-Id", ACME)
      .send({ token, name: "Weak", password: "short" });
    expect(accept.status).toBe(422);
    expect(accept.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("password reset (03 §2)", () => {
  it("always answers ok, whether or not the address is known", async () => {
    const known = await request(server())
      .post("/v1/auth/forgot-password")
      .set("X-Tenant-Id", ACME)
      .send({ email: "ada@acme.test" });
    const unknown = await request(server())
      .post("/v1/auth/forgot-password")
      .set("X-Tenant-Id", ACME)
      .send({ email: "ghost@acme.test" });

    expect(known.status).toBe(201);
    expect(unknown.status).toBe(201);
    expect(unknown.body).toEqual({ ok: true }); // no token for an unknown address
  });

  it("completes a reset and invalidates every existing session", async () => {
    await resetCredentials("ada@acme.test");
    // An active session that must die when the password is reset.
    const signed = await signIn(ACME, "ada@acme.test", PASSWORD);
    const cookie = (signed.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0])
      .join("; ");

    const forgot = await request(server())
      .post("/v1/auth/forgot-password")
      .set("X-Tenant-Id", ACME)
      .send({ email: "ada@acme.test" });
    const token = forgot.body.token as string;
    expect(token).toBeTruthy();

    const newPassword = "totally-different-passphrase-9";
    const reset = await request(server())
      .post("/v1/auth/reset-password")
      .set("X-Tenant-Id", ACME)
      .send({ token, password: newPassword });
    expect(reset.status).toBe(201);

    // Old session revoked...
    const stale = await request(server()).get("/v1/me").set("X-Tenant-Id", ACME).set("Cookie", cookie);
    expect(stale.status).toBe(401);

    // ...old password dead, new password works.
    expect((await signIn(ACME, "ada@acme.test", PASSWORD)).status).toBe(401);
    await resetCredentials("ada@acme.test"); // the failed attempt above bumped the counter
    expect((await signIn(ACME, "ada@acme.test", newPassword)).status).toBe(201);

    // Restore the shared fixture password for any later run.
    const { hashPassword } = await import("../src/auth/passwords.js");
    await control.query("UPDATE control.users SET password_hash = $2 WHERE email = $1", [
      "ada@acme.test",
      await hashPassword(PASSWORD),
    ]);
  });
});
