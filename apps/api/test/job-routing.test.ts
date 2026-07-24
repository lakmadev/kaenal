import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type pg from "pg";
import { RegistryDbRouter } from "../src/tenant/db-router.js";
import { TenantPoolManager } from "../src/tenant/pool-manager.js";
import type { SecretResolver } from "../src/tenant/secret-resolver.js";

/**
 * Model B job-path routing (01 §3.1). Background jobs and the AI gateway only
 * have a tenant id, so they route through `RegistryDbRouter` (tenantId → pool),
 * and every per-tenant processor forwards the resolved pool to `withTenant`.
 * These are unit tests: no real database — `pg.Pool` opens no socket until a
 * query runs, and the DB-hitting path is already covered by dedicated-routing.
 */

const fakeResolver: SecretResolver = {
  resolve: (ref) => Promise.resolve(`postgres://u:p@localhost:5433/db_${ref.replace(/\W/g, "_")}`),
};

interface Row {
  model: string;
  database_url_secret_ref: string | null;
}

/** A stand-in control pool that answers the router's one registry query. */
function fakeControl(rowFor: (id: string) => Row | undefined, counter?: { n: number }): pg.Pool {
  return {
    query: (_sql: string, params: unknown[]) => {
      if (counter !== undefined) counter.n += 1;
      const row = rowFor(params[0] as string);
      return Promise.resolve({ rows: row === undefined ? [] : [row] });
    },
  } as unknown as pg.Pool;
}

describe("RegistryDbRouter", () => {
  let pools: TenantPoolManager | undefined;
  afterEach(async () => {
    await pools?.closeAll();
    pools = undefined;
  });

  it("returns undefined for a shared tenant (uses the default pool)", async () => {
    pools = new TenantPoolManager(fakeResolver);
    const router = new RegistryDbRouter(
      fakeControl(() => ({ model: "shared", database_url_secret_ref: null })),
      pools,
    );
    await expect(router.poolFor("t-shared")).resolves.toBeUndefined();
  });

  it("returns the dedicated tenant's own pool from the manager", async () => {
    pools = new TenantPoolManager(fakeResolver);
    const router = new RegistryDbRouter(
      fakeControl(() => ({ model: "dedicated", database_url_secret_ref: "localdb:kaenal_ded_x" })),
      pools,
    );
    const routed = await router.poolFor("t-ded");
    expect(routed).toBeDefined();
    // Same instance the pool manager hands out for that id/ref — i.e. the router
    // delegated to the manager rather than opening its own pool.
    expect(routed).toBe(await pools.poolFor("t-ded", "localdb:kaenal_ded_x"));
  });

  it("fails loud for a dedicated tenant with no secret (no fall-through)", async () => {
    pools = new TenantPoolManager(fakeResolver);
    const router = new RegistryDbRouter(
      fakeControl(() => ({ model: "dedicated", database_url_secret_ref: null })),
      pools,
    );
    await expect(router.poolFor("t-broken")).rejects.toThrow(/missing its connection secret/);
  });

  it("treats an unknown tenant id as shared", async () => {
    pools = new TenantPoolManager(fakeResolver);
    const router = new RegistryDbRouter(fakeControl(() => undefined), pools);
    await expect(router.poolFor("nope")).resolves.toBeUndefined();
  });

  it("caches the registry lookup within the TTL", async () => {
    const counter = { n: 0 };
    pools = new TenantPoolManager(fakeResolver);
    const router = new RegistryDbRouter(
      fakeControl(() => ({ model: "dedicated", database_url_secret_ref: "localdb:kaenal_ded_x" }), counter),
      pools,
    );
    await router.poolFor("t-ded");
    await router.poolFor("t-ded");
    expect(counter.n).toBe(1); // second call served from cache
  });
});

// The processor forwards deps.pool to withTenant. Mock @kaenal/db so withTenant
// is a spy that records its pool argument without touching a database.
const withTenantSpy = vi.fn();
vi.mock("@kaenal/db", () => ({
  withTenant: (tenantId: string, _userId: unknown, _fn: unknown, pool: unknown) => {
    withTenantSpy(tenantId, pool);
    return Promise.resolve(undefined);
  },
  withAudit: () => Promise.resolve(undefined),
  withoutTenant: (fn: (tx: unknown) => unknown) => Promise.resolve(fn({})),
}));

describe("per-tenant processors forward the routed pool", () => {
  beforeEach(() => withTenantSpy.mockClear());

  it("materializeScheduleForTenant passes deps.pool to withTenant", async () => {
    const { materializeScheduleForTenant } = await import(
      "../src/jobs/processors/materialize-schedule.js"
    );
    const sentinel = { marker: "dedicated-pool" } as unknown as pg.Pool;
    const inspections = {} as unknown as import("../src/inspections/inspections.service.js").InspectionsService;

    await materializeScheduleForTenant({ tenantId: "t-ded" }, { inspections, pool: sentinel });

    expect(withTenantSpy).toHaveBeenCalledWith("t-ded", sentinel);
  });

  it("passes undefined through for a shared tenant", async () => {
    const { materializeScheduleForTenant } = await import(
      "../src/jobs/processors/materialize-schedule.js"
    );
    const inspections = {} as unknown as import("../src/inspections/inspections.service.js").InspectionsService;

    await materializeScheduleForTenant({ tenantId: "t-shared" }, { inspections });

    expect(withTenantSpy).toHaveBeenCalledWith("t-shared", undefined);
  });
});
