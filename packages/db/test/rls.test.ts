/**
 * Tenancy / RLS suite — 08 §1.1. The highest-priority test in the codebase.
 *
 * Runs against real Postgres, as the real `kaenal_app` role (not the owner),
 * because the thing under test IS the database's enforcement. Mocking any part
 * of this would test nothing.
 *
 * Tables are enumerated dynamically from pg_catalog rather than listed here, so
 * a table added later is automatically in scope. A table with no fixture fails
 * the suite instead of being silently skipped — see `every tenant table has a
 * fixture` below.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appPool, closePools, migratorPool, withTenant, type Tx } from "../src/client.js";
import { isTenantTable } from "../src/tenant-tables.js";
import { seedTenant, truncateAllTenantTables } from "./fixtures.js";

const TENANT_A = "019f0000-0000-7000-8000-00000000000a";
const TENANT_B = "019f0000-0000-7000-8000-00000000000b";

/** One row id per table, per tenant — the probe targets, filled in beforeAll. */
const rowIds = new Map<string, { a: string; b: string }>();

/**
 * Append-only tables are exempt from the generic "0 rows affected" write
 * probes, because they fail earlier and harder: the app role holds no
 * UPDATE/DELETE privilege at all, so the statement is rejected before RLS is
 * ever consulted. Asserting "0 rows affected" would actually be a WEAKER claim
 * than what holds here. The stronger guarantee is asserted directly in the
 * "audit trail immutability" block below, and cross-tenant read isolation is
 * still probed generically like every other table.
 */
const APPEND_ONLY_TABLES = new Set(["audit_events"]);
const mutableTables = (): string[] => tenantTables.filter((t) => !APPEND_ONLY_TABLES.has(t));

async function listTenantTables(tx: Tx): Promise<string[]> {
  const { rows } = await tx.query<{ schemaname: string; tablename: string }>(`
    SELECT n.nspname AS schemaname, c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
    ORDER BY c.relname
  `);
  return rows.filter((r) => isTenantTable(r.schemaname, r.tablename)).map((r) => r.tablename);
}

/**
 * Discovered at module load, not in beforeAll: `it.each` needs its cases at
 * collection time, and generating one named test per table is what makes a
 * failure point at the offending table instead of at a loop.
 */
const tenantTables: string[] = await (async () => {
  const client = await migratorPool.connect();
  try {
    return await listTenantTables(client);
  } finally {
    client.release();
  }
})();

/**
 * Fetches a probe target, throwing if the table has no fixture row.
 *
 * Deliberately throws rather than skipping: a probe that quietly does nothing
 * because its fixture is missing is indistinguishable from a passing probe,
 * which is exactly how an unprotected table would slip through.
 */
function requireRowId(table: string, tenant: "a" | "b"): string {
  const ids = rowIds.get(table);
  if (!ids) {
    throw new Error(
      `No fixture row for '${table}' — add it to seedTenant() in test/fixtures.ts. ` +
        `Cross-tenant probes cannot run against this table.`,
    );
  }
  return ids[tenant];
}

beforeAll(async () => {
  const client = await migratorPool.connect();
  try {
    await truncateAllTenantTables(client, tenantTables);
  } finally {
    client.release();
  }

  // Seed both tenants with identical data shapes, each inside its own scope.
  await withTenant(TENANT_A, null, (tx) => seedTenant(tx, TENANT_A, "alpha"));
  await withTenant(TENANT_B, null, (tx) => seedTenant(tx, TENANT_B, "beta"));

  // Capture one row id per table per tenant for the cross-tenant probes.
  for (const table of tenantTables) {
    const a = await withTenant(TENANT_A, null, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(`SELECT id FROM ${table} LIMIT 1`);
      return rows[0]?.id;
    });
    const b = await withTenant(TENANT_B, null, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(`SELECT id FROM ${table} LIMIT 1`);
      return rows[0]?.id;
    });
    if (a && b) rowIds.set(table, { a, b });
  }
}, 60_000);

afterAll(async () => {
  const client = await migratorPool.connect();
  try {
    await truncateAllTenantTables(client, tenantTables);
  } finally {
    client.release();
    await closePools();
  }
});

describe("tenancy coverage", () => {
  it("discovers the tenant tables", () => {
    expect(tenantTables.length).toBeGreaterThan(20);
  });

  // The guard that keeps this suite honest as the schema grows: a new table
  // with no fixture would otherwise pass every probe below vacuously.
  it("every tenant table has a fixture row in both tenants", () => {
    const unseeded = tenantTables.filter((t) => !rowIds.has(t));
    expect(
      unseeded,
      `These tables have no fixture row, so the cross-tenant probes below never ran ` +
        `against them. Add them to test/fixtures.ts seedTenant().`,
    ).toEqual([]);
  });
});

describe("RLS: read isolation", () => {
  it.each(tenantTables)(
    "%s — tenant A sees only its own rows",
    async (table: string) => {
      const [aCount, aForeign] = await withTenant(TENANT_A, null, async (tx) => {
        const total = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
        const foreign = await tx.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${table} WHERE tenant_id <> $1`,
          [TENANT_A],
        );
        return [total.rows[0]?.n ?? 0, foreign.rows[0]?.n ?? 0];
      });

      expect(aCount, `${table}: tenant A should see its seeded rows`).toBeGreaterThan(0);
      expect(aForeign, `${table}: tenant A saw rows belonging to another tenant`).toBe(0);
    },
  );

  it.each(tenantTables)(
    "%s — tenant A cannot fetch tenant B's row by id",
    async (table: string) => {
      const bRowId = requireRowId(table, "b");
      const found = await withTenant(TENANT_A, null, async (tx) => {
        const { rows } = await tx.query(`SELECT id FROM ${table} WHERE id = $1`, [bRowId]);
        return rows.length;
      });
      expect(found, `${table}: B's row was readable by A via direct id lookup`).toBe(0);
    },
  );
});

describe("RLS: write isolation (WITH CHECK)", () => {
  it.each(tenantTables)(
    "%s — tenant A cannot insert a row stamped with tenant B",
    async (table: string) => {
      const aRowId = requireRowId(table, "a");
      // Clone A's own row, overriding tenant_id to B. Building the column list
      // from the catalog keeps this generic: it exercises the real table shape
      // rather than a hand-written stub that could drift from it.
      const columns = await withTenant(TENANT_A, null, async (tx) => {
        const { rows } = await tx.query<{ column_name: string }>(
          // Skip generated columns (e.g. search_vector): they cannot be written
          // explicitly, and cloning into them would throw a non-RLS error that
          // masks whether the WITH CHECK policy actually fired.
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1 AND column_name <> 'id'
             AND is_generated = 'NEVER'
           ORDER BY ordinal_position`,
          [table],
        );
        return rows.map((r) => r.column_name);
      });

      const selectList = columns
        .map((c) => (c === "tenant_id" ? `$2::uuid AS tenant_id` : `"${c}"`))
        .join(", ");
      const insertList = columns.map((c) => `"${c}"`).join(", ");

      await expect(
        withTenant(TENANT_A, null, async (tx) => {
          await tx.query(
            `INSERT INTO ${table} (${insertList})
             SELECT ${selectList} FROM ${table} WHERE id = $1`,
            [aRowId, TENANT_B],
          );
        }),
        `${table}: WITH CHECK did not block writing a row into another tenant`,
      ).rejects.toThrow(/row-level security|violates row-level/i);
    },
  );

  it.each(mutableTables())(
    "%s — tenant A's UPDATE of tenant B's row affects 0 rows",
    async (table: string) => {
      const bRowId = requireRowId(table, "b");
      const affected = await withTenant(TENANT_A, null, async (tx) => {
        // A no-op SET: the point is whether the row is reachable at all.
        const res = await tx.query(`UPDATE ${table} SET tenant_id = tenant_id WHERE id = $1`, [
          bRowId,
        ]);
        return res.rowCount ?? 0;
      });
      expect(affected, `${table}: A was able to update B's row`).toBe(0);
    },
  );

  it.each(mutableTables())(
    "%s — tenant A's DELETE of tenant B's row affects 0 rows",
    async (table: string) => {
      const bRowId = requireRowId(table, "b");
      const affected = await withTenant(TENANT_A, null, async (tx) => {
        const res = await tx.query(`DELETE FROM ${table} WHERE id = $1`, [bRowId]);
        return res.rowCount ?? 0;
      });
      expect(affected, `${table}: A was able to delete B's row`).toBe(0);
    },
  );
});

describe("RLS: unscoped access fails loudly", () => {
  // The single most important negative test. If app.tenant_id is unset the
  // query must ERROR — a policy written with current_setting(..., true) would
  // instead return zero rows, which looks like "no data" and hides the bug
  // until someone writes an UPSERT against it (02 §1).
  it.each(tenantTables)(
    "%s — SELECT with no app.tenant_id throws rather than returning rows",
    async (table: string) => {
      const client = await appPool.connect();
      try {
        await client.query("BEGIN");
        await expect(
          client.query(`SELECT count(*) FROM ${table}`),
          `${table}: an unscoped query did not throw`,
        ).rejects.toThrow(/unrecognized configuration parameter|invalid input syntax/i);
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    },
  );

  it("SET LOCAL does not leak the tenant scope onto the next transaction", async () => {
    // Simulates a pooler handing the same physical connection to two requests.
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
      const scoped = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM ncrs");
      expect(scoped.rows[0]?.n).toBeGreaterThan(0);
      await client.query("COMMIT");

      // Next transaction on the SAME connection must have no tenant scope.
      await client.query("BEGIN");
      await expect(
        client.query("SELECT count(*) FROM ncrs"),
        "tenant scope leaked across transactions on a pooled connection",
      ).rejects.toThrow();
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});

describe("audit trail immutability (02 §3, 07 §1)", () => {
  it("the app role cannot UPDATE its own tenant's audit events", async () => {
    const ids = rowIds.get("audit_events");
    expect(ids).toBeDefined();

    await expect(
      withTenant(TENANT_A, null, async (tx) => {
        await tx.query(`UPDATE audit_events SET action = 'tampered' WHERE id = $1`, [ids?.a]);
      }),
      "audit_events accepted an UPDATE",
    ).rejects.toThrow(/append-only|permission denied/i);
  });

  it("the app role cannot DELETE its own tenant's audit events", async () => {
    const ids = rowIds.get("audit_events");

    await expect(
      withTenant(TENANT_A, null, async (tx) => {
        await tx.query(`DELETE FROM audit_events WHERE id = $1`, [ids?.a]);
      }),
      "audit_events accepted a DELETE",
    ).rejects.toThrow(/append-only|permission denied/i);
  });

  it("support-actor events require a reason", async () => {
    await expect(
      withTenant(TENANT_A, null, async (tx) => {
        await tx.query(
          `INSERT INTO audit_events (tenant_id, actor_kind, entity_kind, entity_id, action)
           VALUES ($1, 'support', 'ncr', $2, 'updated')`,
          [TENANT_A, rowIds.get("ncrs")?.a],
        );
      }),
      "a support-role audit event was accepted without a reason",
    ).rejects.toThrow(/audit_events_support_reason_ck/i);
  });
});

describe("template immutability (02 §7)", () => {
  it("rejects editing the schema of a published template", async () => {
    await expect(
      withTenant(TENANT_A, null, async (tx) => {
        await tx.query(
          `UPDATE inspection_templates SET schema = '{"sections":[{"id":"x"}]}'::jsonb
           WHERE id = $1`,
          [rowIds.get("inspection_templates")?.a],
        );
      }),
      "a published template's schema was mutable",
    ).rejects.toThrow(/published template/i);
  });
});
