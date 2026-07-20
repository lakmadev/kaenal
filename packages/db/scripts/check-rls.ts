/**
 * CI schema lint (02 §6).
 *
 * Enumerates every table in the data plane from pg_catalog and asserts each one
 * carries the full isolation contract. This is deliberately independent of the
 * migration that creates the tables: the migration builds isolation from a list,
 * this verifies the result from the catalog. A table that slips past one net
 * still has to get past the other.
 *
 * Exit code 1 fails the build.
 */
import { migratorPool } from "../src/client.js";
import { isTenantTable, NON_TENANT_TABLES } from "../src/tenant-tables.js";

interface TableRow {
  schemaname: string;
  tablename: string;
  rowsecurity: boolean;
  forcerowsecurity: boolean;
}

async function main(): Promise<void> {
  const client = await migratorPool.connect();
  const failures: string[] = [];

  try {
    const { rows: tables } = await client.query<TableRow>(`
      SELECT n.nspname AS schemaname,
             c.relname AS tablename,
             c.relrowsecurity  AS rowsecurity,
             c.relforcerowsecurity AS forcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog','information_schema')
      ORDER BY n.nspname, c.relname
    `);

    const inScope = tables.filter((t) => isTenantTable(t.schemaname, t.tablename));

    if (inScope.length === 0) {
      throw new Error("No tenant tables found — has the database been migrated?");
    }

    for (const t of inScope) {
      const qualified = `${t.schemaname}.${t.tablename}`;

      // 1. tenant_id column present and NOT NULL.
      const { rows: cols } = await client.query<{ attnotnull: boolean }>(
        `SELECT a.attnotnull
         FROM pg_attribute a
         WHERE a.attrelid = $1::regclass AND a.attname = 'tenant_id' AND NOT a.attisdropped`,
        [qualified],
      );
      if (cols.length === 0) {
        failures.push(`${qualified}: missing tenant_id column`);
        continue; // everything else is meaningless without it
      }
      if (!cols[0]?.attnotnull) {
        failures.push(`${qualified}: tenant_id is nullable (must be NOT NULL)`);
      }

      // 2. RLS enabled AND forced. Enabled alone is not enough — the table
      //    owner bypasses a merely-enabled policy.
      if (!t.rowsecurity) failures.push(`${qualified}: row security not ENABLED`);
      if (!t.forcerowsecurity) failures.push(`${qualified}: row security not FORCED`);

      // 3. A tenant_isolation policy covering both read and write.
      const { rows: policies } = await client.query<{
        polname: string;
        qual: string | null;
        with_check: string | null;
      }>(
        `SELECT pol.polname,
                pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
                pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
         FROM pg_policy pol
         WHERE pol.polrelid = $1::regclass AND pol.polname = 'tenant_isolation'`,
        [qualified],
      );

      const policy = policies[0];
      if (!policy) {
        failures.push(`${qualified}: no tenant_isolation policy`);
      } else {
        if (!policy.qual?.includes("app.tenant_id")) {
          failures.push(`${qualified}: tenant_isolation USING does not filter on app.tenant_id`);
        }
        // Without WITH CHECK, a tenant can read only its own rows but still
        // write rows stamped with someone else's tenant_id.
        if (!policy.with_check?.includes("app.tenant_id")) {
          failures.push(`${qualified}: tenant_isolation missing WITH CHECK on app.tenant_id`);
        }
        // current_setting(x, true) returns NULL when unset, which silently
        // filters to zero rows instead of failing loudly (02 §1).
        if (policy.qual?.includes("true)")) {
          failures.push(
            `${qualified}: policy uses the missing_ok form of current_setting — ` +
              `an unscoped query must throw, not return nothing`,
          );
        }
      }

      // 4. At least one index whose FIRST column is tenant_id. An index that
      //    merely mentions tenant_id later in the column list can't be used to
      //    seek, and the planner falls back to scanning every tenant's rows.
      const { rows: idx } = await client.query<{ indexname: string }>(
        `SELECT i.relname AS indexname
         FROM pg_index x
         JOIN pg_class i ON i.oid = x.indexrelid
         JOIN pg_attribute a
           ON a.attrelid = x.indrelid AND a.attnum = x.indkey[0]
         WHERE x.indrelid = $1::regclass AND a.attname = 'tenant_id'`,
        [qualified],
      );
      if (idx.length === 0) {
        failures.push(`${qualified}: no index leading with tenant_id`);
      }
    }

    console.log(
      `Checked ${inScope.length} tenant tables ` +
        `(${NON_TENANT_TABLES.size} excluded by policy, control schema exempt).`,
    );

    if (failures.length > 0) {
      console.error(`\n✗ RLS schema lint failed — ${failures.length} problem(s):\n`);
      for (const f of failures) console.error(`  • ${f}`);
      console.error("\nEvery tenant-owned table needs: tenant_id NOT NULL, RLS enabled + forced,");
      console.error("a tenant_isolation policy with USING + WITH CHECK, and a tenant_id-led index.");
      process.exit(1);
    }

    console.log("✓ RLS schema lint passed.");
  } finally {
    client.release();
    await migratorPool.end();
  }
}

main().catch((err: unknown) => {
  console.error("RLS schema lint errored:\n", err);
  process.exit(1);
});
