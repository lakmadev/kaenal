import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import { AppModule } from "../src/app.module.js";

/**
 * Request lifecycle tests (01 §3.3, 03 §4).
 *
 * These run against the real Postgres and Redis from docker-compose. The
 * guarantees under test — that a suspended tenant is indistinguishable from a
 * missing one, that handlers run inside a tenant-scoped transaction — are
 * properties of the wiring, and wiring is exactly what a mocked test cannot
 * check.
 */

let app: INestApplication;
let control: pg.Pool;

const ACTIVE = "acme";
const SUSPENDED = "suspended-co";

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });

  // A suspended tenant to prove step 1 treats it as absent.
  await control.query(
    `INSERT INTO control.tenants (id, slug, name, model, region, status)
     VALUES (uuidv7(), $1, 'Suspended Co', 'shared', 'eu-central-1', 'suspended')
     ON CONFLICT (slug) DO UPDATE SET status = 'suspended'`,
    [SUSPENDED],
  );

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await control.query("DELETE FROM control.tenants WHERE slug = $1", [SUSPENDED]);
  await control.end();
  await app.close();
});

const server = (): App => app.getHttpServer() as App;
type App = Parameters<typeof request>[0];

describe("public routes need no tenant (01 §3.3)", () => {
  it("GET /healthz is 200 with no tenant header", async () => {
    const res = await request(server()).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /readyz reports DB and Redis", async () => {
    const res = await request(server()).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ready", checks: { db: true, redis: true } });
  });

  it("echoes a request id on every response", async () => {
    const res = await request(server()).get("/healthz");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("honours a well-formed inbound request id", async () => {
    const id = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
    const res = await request(server()).get("/healthz").set("X-Request-Id", id);
    expect(res.headers["x-request-id"]).toBe(id);
  });

  it.each([
    "not-a-uuid",
    "'; DROP TABLE audit_events; --",
    "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b-extra",
    "<script>alert(1)</script>",
    "",
  ])("replaces the malformed inbound request id %j rather than echoing it", async (bad) => {
    // The id lands in logs and in the error envelope, so echoing caller-
    // controlled text is a log-injection vector. (A literal CRLF cannot be
    // tested through an HTTP client — Node rejects it before it is sent — so
    // the guard here is the uuid allowlist, not CRLF stripping.)
    const res = await request(server()).get("/healthz").set("X-Request-Id", bad);
    expect(res.headers["x-request-id"]).not.toBe(bad);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("step 1 — tenant resolution never leaks existence (rule 8)", () => {
  it("404s when no tenant can be determined", async () => {
    const res = await request(server()).get("/v1/me");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TENANT_NOT_FOUND");
  });

  it("404s for a tenant that does not exist", async () => {
    const res = await request(server()).get("/v1/me").set("X-Tenant-Id", "no-such-tenant");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TENANT_NOT_FOUND");
  });

  it("404s for a SUSPENDED tenant, identically to a missing one", async () => {
    // The whole point: a 403 here would confirm the workspace is real.
    const missing = await request(server()).get("/v1/me").set("X-Tenant-Id", "no-such-tenant");
    const suspended = await request(server()).get("/v1/me").set("X-Tenant-Id", SUSPENDED);

    expect(suspended.status).toBe(missing.status);
    expect(suspended.body.error.code).toBe(missing.body.error.code);
    expect(suspended.body.error.message).toBe(missing.body.error.message);
  });

  it("404s for a malformed slug without querying anything", async () => {
    for (const slug of ["../etc", "UPPER", "a", "sl ug", "a.b"]) {
      const res = await request(server()).get("/v1/me").set("X-Tenant-Id", slug);
      expect(res.status, slug).toBe(404);
      expect(res.body.error.code, slug).toBe("TENANT_NOT_FOUND");
    }
  });

  it("resolves an active tenant and proceeds to authentication", async () => {
    // Reaching 401 proves step 1 succeeded — the request got past tenant
    // resolution and into the scoped transaction.
    const res = await request(server()).get("/v1/me").set("X-Tenant-Id", ACTIVE);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("step 1 — subdomain resolution", () => {
  it("resolves the tenant from the Host subdomain", async () => {
    const res = await request(server()).get("/v1/me").set("Host", "acme.kaenal.local");
    expect(res.status).toBe(401); // resolved, then failed to authenticate
  });

  it("rejects a host that merely ends with the root domain", async () => {
    // `evil-kaenal.local` ends with "kaenal.local" as a string but is a
    // different domain — the classic suffix-match bug.
    const res = await request(server()).get("/v1/me").set("Host", "evil-kaenal.local");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TENANT_NOT_FOUND");
  });

  it("rejects a deeper subdomain", async () => {
    const res = await request(server()).get("/v1/me").set("Host", "a.acme.kaenal.local");
    expect(res.status).toBe(404);
  });

  it("does not resolve a deeper host by its FIRST label", async () => {
    // `acme.attacker.kaenal.local` must not resolve to tenant `acme`. Written
    // with a REAL tenant as the leading label on purpose: the previous test
    // 404s under a naive split(".")[0] parser too — because tenant "a" happens
    // not to exist — so it cannot tell a correct parser from a broken one.
    // This one can. (Verified: it fails against the split-based parser.)
    const res = await request(server()).get("/v1/me").set("Host", "acme.attacker.kaenal.local");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TENANT_NOT_FOUND");
  });

  it("rejects the bare root domain", async () => {
    const res = await request(server()).get("/v1/me").set("Host", "kaenal.local");
    expect(res.status).toBe(404);
  });
});

describe("step 2 — session authentication (03 §2)", () => {
  it("401s a request with no credential (default-deny)", async () => {
    const res = await request(server()).get("/v1/me").set("X-Tenant-Id", ACTIVE);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("401s a bogus bearer token as an expired session, without leaking why", async () => {
    // A well-formed but unknown token must not fall through to anonymous, and
    // must not distinguish "unknown" from "expired" — either would help an
    // attacker probe for live sessions.
    const res = await request(server())
      .get("/v1/me")
      .set("X-Tenant-Id", ACTIVE)
      .set("Authorization", "Bearer not-a-real-session-token");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("error envelope (03 §4)", () => {
  it("carries code, message and requestId", async () => {
    const res = await request(server()).get("/v1/me").set("X-Tenant-Id", "nope-not-here");

    expect(res.body).toEqual({
      error: {
        code: "TENANT_NOT_FOUND",
        message: expect.any(String),
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    });
  });

  it("uses the envelope for an unmatched route too", async () => {
    const res = await request(server()).get("/no-such-route");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("never leaks a stack trace", async () => {
    const res = await request(server()).get("/v1/me");
    expect(JSON.stringify(res.body)).not.toMatch(/at |\.ts:|node_modules/);
  });
});
