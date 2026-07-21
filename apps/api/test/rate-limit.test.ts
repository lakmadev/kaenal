import "reflect-metadata";
// Rate limiting is off by default in the test environment (the other suites
// fire far more than 60 requests/user per minute). This suite is the one place
// it must be ON, so it opts in before the app's env is read.
process.env["RATE_LIMIT_ENABLED"] = "true";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import Redis from "ioredis";
import { AppModule } from "../src/app.module.js";
import { RateLimiter } from "../src/http/rate-limit.js";

let app: INestApplication;
let redis: Redis;

type Srv = Parameters<typeof request>[0];
const server = (): Srv => app.getHttpServer() as Srv;

beforeAll(async () => {
  redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6380");
  // Only this suite writes rl:* keys, so clearing them makes the HTTP counts
  // deterministic regardless of what the socket's resolved IP turns out to be.
  const keys = await redis.keys("rl:*");
  if (keys.length > 0) await redis.del(...keys);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app.close();
  await redis.quit();
});

describe("RateLimiter (sliding window)", () => {
  it("allows up to the limit, then denies, with a retry hint", async () => {
    const key = `test:${Math.random().toString(36).slice(2)}`;
    const limiter = new RateLimiter(redis);
    const now = Date.now();

    const v1 = await limiter.hit(key, 3, 1000, now);
    const v2 = await limiter.hit(key, 3, 1000, now);
    const v3 = await limiter.hit(key, 3, 1000, now);
    const v4 = await limiter.hit(key, 3, 1000, now);

    expect(v1.allowed).toBe(true);
    expect(v1.remaining).toBe(2);
    expect(v2.remaining).toBe(1);
    expect(v3.allowed).toBe(true);
    expect(v3.remaining).toBe(0);
    expect(v4.allowed).toBe(false);
    expect(v4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("lets requests through again once the window has slid past them", async () => {
    const key = `test:${Math.random().toString(36).slice(2)}`;
    const limiter = new RateLimiter(redis);
    const t0 = Date.now();

    await limiter.hit(key, 1, 1000, t0);
    const blocked = await limiter.hit(key, 1, 1000, t0 + 500);
    expect(blocked.allowed).toBe(false);

    // Every hit is logged — including the blocked one — so hammering while
    // blocked keeps pushing the window forward (a penalty for abuse). Once
    // BOTH prior entries have aged out (> 1s after the last one), it clears.
    const allowed = await limiter.hit(key, 1, 1000, t0 + 1600);
    expect(allowed.allowed).toBe(true);
  });
});

describe("login throttle (per-IP, 5/min)", () => {
  it("throttles the sixth credential attempt from an IP with a 429 + Retry-After", async () => {
    const attempt = () =>
      request(server())
        .post("/v1/auth/sign-in")
        .set("X-Tenant-Id", "acme")
        .send({ email: "throttle-probe@acme.test", password: "whatever-wrong-here" });

    const statuses: number[] = [];
    let retryAfter: string | undefined;
    for (let i = 0; i < 6; i++) {
      const res = await attempt();
      statuses.push(res.status);
      if (res.status === 429) retryAfter = res.headers["retry-after"];
    }

    // The first five are let through (they 401 on the bad password); the sixth
    // is rate-limited before it ever reaches the credential check.
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(retryAfter).toBeDefined();
  });
});
