import { afterEach, describe, expect, it } from "vitest";
import { EnvSecretResolver, type SecretResolver } from "../src/tenant/secret-resolver.js";
import { TenantPoolManager } from "../src/tenant/pool-manager.js";

/**
 * Model B connection routing (01 §3.1 / §3.3). These are pure unit tests: a
 * fake resolver hands back a well-formed URL, and `pg.Pool` opens no socket
 * until a query runs, so the LRU behaviour is exercised without a second
 * physical database. The end-to-end "a dedicated request reaches a database"
 * proof lives in `dedicated-routing.test.ts`.
 */

class FakeResolver implements SecretResolver {
  readonly calls: string[] = [];
  resolve(ref: string): Promise<string> {
    this.calls.push(ref);
    return Promise.resolve(`postgres://u:p@localhost:5433/db_${ref.replace(/\W/g, "_")}`);
  }
}

const refFor = (t: string): string => `env:DED_${t}`;

describe("EnvSecretResolver", () => {
  it("resolves an env: ref to the variable's value", async () => {
    const resolver = new EnvSecretResolver({ MY_DB: "postgres://host/db" });
    await expect(resolver.resolve("env:MY_DB")).resolves.toBe("postgres://host/db");
  });

  it("rejects an unknown scheme without falling through", async () => {
    const resolver = new EnvSecretResolver({});
    await expect(resolver.resolve("s3://bucket/key")).rejects.toThrow(/Unsupported/);
  });

  it("rejects a ref whose variable is unset", async () => {
    const resolver = new EnvSecretResolver({});
    await expect(resolver.resolve("env:MISSING")).rejects.toThrow(/not set/);
  });

  it("resolves a localdb: ref by swapping the database name in DATABASE_APP_URL", async () => {
    const resolver = new EnvSecretResolver({
      DATABASE_APP_URL: "postgres://kaenal_app:pw@localhost:5433/kaenal",
    });
    await expect(resolver.resolve("localdb:kaenal_ded_bosch")).resolves.toBe(
      "postgres://kaenal_app:pw@localhost:5433/kaenal_ded_bosch",
    );
  });

  it("rejects a localdb: ref when DATABASE_APP_URL is absent", async () => {
    const resolver = new EnvSecretResolver({});
    await expect(resolver.resolve("localdb:kaenal_ded_bosch")).rejects.toThrow(/DATABASE_APP_URL/);
  });
});

describe("TenantPoolManager", () => {
  let mgr: TenantPoolManager | undefined;
  afterEach(async () => {
    await mgr?.closeAll();
    mgr = undefined;
  });

  it("creates one pool per tenant and caches it", async () => {
    const resolver = new FakeResolver();
    mgr = new TenantPoolManager(resolver, 20);

    const a = await mgr.poolFor("t1", refFor("t1"));
    const b = await mgr.poolFor("t1", refFor("t1"));

    expect(a).toBe(b); // same instance
    expect(resolver.calls).toEqual([refFor("t1")]); // resolved exactly once
    expect(mgr.size).toBe(1);
  });

  it("evicts the least-recently-used pool past the cap", async () => {
    const resolver = new FakeResolver();
    const count = (t: string): number => resolver.calls.filter((r) => r === refFor(t)).length;
    mgr = new TenantPoolManager(resolver, 2);

    await mgr.poolFor("t1", refFor("t1"));
    await mgr.poolFor("t2", refFor("t2"));
    await mgr.poolFor("t3", refFor("t3")); // pushes past cap → t1 (oldest) evicted
    expect(mgr.size).toBe(2);

    // Probe the survivors first: neither re-resolves (still cached). Probing an
    // evicted tenant would itself evict a survivor, so t1 is checked last.
    await mgr.poolFor("t2", refFor("t2"));
    await mgr.poolFor("t3", refFor("t3"));
    expect(count("t1")).toBe(1); // resolved once, then evicted — never re-requested yet
    expect(count("t2")).toBe(1);
    expect(count("t3")).toBe(1);

    await mgr.poolFor("t1", refFor("t1")); // evicted → a fresh resolve proves it was dropped
    expect(count("t1")).toBe(2);
  });

  it("counts a cache hit as recent use (LRU, not FIFO)", async () => {
    const resolver = new FakeResolver();
    const count = (t: string): number => resolver.calls.filter((r) => r === refFor(t)).length;
    mgr = new TenantPoolManager(resolver, 2);

    await mgr.poolFor("t1", refFor("t1"));
    await mgr.poolFor("t2", refFor("t2"));
    await mgr.poolFor("t1", refFor("t1")); // touch t1 → t2 becomes the LRU
    await mgr.poolFor("t3", refFor("t3")); // evicts t2, NOT t1

    await mgr.poolFor("t1", refFor("t1")); // t1 survived the touch → still cached
    expect(count("t1")).toBe(1);
    await mgr.poolFor("t2", refFor("t2")); // t2 was evicted → re-resolves
    expect(count("t2")).toBe(2);
  });

  it("does not cache a failed open, so the next request retries", async () => {
    let attempt = 0;
    const flaky: SecretResolver = {
      resolve: (ref: string): Promise<string> => {
        attempt += 1;
        if (attempt === 1) return Promise.reject(new Error("secret unavailable"));
        return Promise.resolve(`postgres://u:p@localhost:5433/db_${ref.replace(/\W/g, "_")}`);
      },
    };
    mgr = new TenantPoolManager(flaky, 20);

    await expect(mgr.poolFor("t1", refFor("t1"))).rejects.toThrow(/unavailable/);
    expect(mgr.size).toBe(0); // nothing stuck in the cache

    await expect(mgr.poolFor("t1", refFor("t1"))).resolves.toBeDefined();
    expect(mgr.size).toBe(1);
  });
});
