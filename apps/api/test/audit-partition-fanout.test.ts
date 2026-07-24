import { beforeEach, describe, expect, it, vi } from "vitest";
import type pg from "pg";
import {
  fanOutAuditPartitionRoll,
  rollAuditPartitions,
} from "../src/jobs/processors/audit-partition-roll.js";

/**
 * Model B partition-roll fan-out (06 §1 `housekeeping`, 01 §3.1). The roll does
 * owner DDL + cross-tenant counts, so each dedicated database must be rolled on
 * its OWN owner connection — the primary run only sees the shared tenants. These
 * are unit tests: `@kaenal/db` is mocked so `withoutTenant` is a spy recording
 * which owner pool it ran on, and pools are opened through an injected factory so
 * no socket is opened. The real DDL path is covered by the housekeeping suite.
 */

const withoutTenantSpy = vi.fn();
vi.mock("@kaenal/db", () => ({
  withoutTenant: (_fn: unknown, pool: unknown) => {
    withoutTenantSpy(pool);
    return Promise.resolve(false); // benign: created stays empty, nothing throws
  },
}));

/** A stand-in control pool that answers the fan-out's one registry query. */
function fakeControl(rows: { slug: string; database_url_secret_ref: string | null }[]): pg.Pool {
  return { query: () => Promise.resolve({ rows }) } as unknown as pg.Pool;
}

describe("rollAuditPartitions owner-pool routing", () => {
  beforeEach(() => withoutTenantSpy.mockClear());

  it("routes every owner query to the given pool (a dedicated database)", async () => {
    const sentinel = { marker: "dedicated-owner" } as unknown as pg.Pool;
    await rollAuditPartitions({ pool: sentinel });
    expect(withoutTenantSpy).toHaveBeenCalled();
    for (const call of withoutTenantSpy.mock.calls) expect(call[0]).toBe(sentinel);
  });

  it("uses the default owner pool (undefined) when none is given (the primary)", async () => {
    await rollAuditPartitions();
    expect(withoutTenantSpy).toHaveBeenCalled();
    for (const call of withoutTenantSpy.mock.calls) expect(call[0]).toBeUndefined();
  });
});

describe("fanOutAuditPartitionRoll", () => {
  const BASE = "postgres://m:p@localhost:5433/kaenal";
  beforeEach(() => withoutTenantSpy.mockClear());

  it("opens one owner pool per localdb tenant, with the database name swapped in", async () => {
    const opened: string[] = [];
    const ended: string[] = [];
    const openPool = (cs: string): pg.Pool => {
      opened.push(cs);
      return { end: () => (ended.push(cs), Promise.resolve()) } as unknown as pg.Pool;
    };

    const report = await fanOutAuditPartitionRoll(
      fakeControl([
        { slug: "acme", database_url_secret_ref: "localdb:kaenal_ded_acme" },
        { slug: "globex", database_url_secret_ref: "localdb:kaenal_ded_globex" },
      ]),
      BASE,
      { openPool },
    );

    expect(report.failures).toEqual([]);
    expect(report.results.map((r) => r.slug)).toEqual(["acme", "globex"]);
    expect(opened).toEqual([
      "postgres://m:p@localhost:5433/kaenal_ded_acme",
      "postgres://m:p@localhost:5433/kaenal_ded_globex",
    ]);
    // Every opened pool is closed after its roll — no leaked connections.
    expect(ended).toEqual(opened);
    // And each roll actually ran against an opened owner pool (not the default).
    for (const call of withoutTenantSpy.mock.calls) expect(call[0]).toBeDefined();
  });

  it("isolates a per-tenant failure and still rolls the others", async () => {
    const opened: string[] = [];
    const openPool = (cs: string): pg.Pool => {
      opened.push(cs);
      return { end: () => Promise.resolve() } as unknown as pg.Pool;
    };

    const report = await fanOutAuditPartitionRoll(
      fakeControl([
        // A cloud (env:) tenant exposes no owner database name here → failure.
        { slug: "cloudy", database_url_secret_ref: "env:CLOUDY_DB_URL" },
        { slug: "local", database_url_secret_ref: "localdb:kaenal_ded_local" },
      ]),
      BASE,
      { openPool },
    );

    expect(report.failures.map((f) => f.slug)).toEqual(["cloudy"]);
    expect((report.failures[0]!.error as Error).message).toMatch(/localdb/);
    expect(report.results.map((r) => r.slug)).toEqual(["local"]);
    // The failing tenant never opened a pool; the healthy one did.
    expect(opened).toEqual(["postgres://m:p@localhost:5433/kaenal_ded_local"]);
  });
});
