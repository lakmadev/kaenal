/**
 * Model B migration fan-out core (02 §migrations, "Model B instances"), factored
 * out of the CLI so it is unit-testable. Applies pending migrations to every
 * dedicated tenant's database, one at a time, under a per-database advisory lock.
 * A failed tenant halts its own rollout only — its error is collected and the
 * others still run.
 */
import pg from "pg";
import { applyMigrations } from "./migrate-runner.js";
import { dedicatedDbName, withDatabaseName } from "./dedicated.js";

const MIGRATION_LOCK = "kaenal_migrations";

export interface FanOutReport {
  readonly results: { slug: string; applied: number }[];
  readonly failures: { slug: string; error: unknown }[];
}

/** Applies pending migrations to one dedicated database; returns how many ran. */
export async function migrateDedicatedDb(
  slug: string,
  baseMigratorUrl: string,
  onApply?: (file: string) => void,
): Promise<number> {
  const url = withDatabaseName(baseMigratorUrl, dedicatedDbName(slug));
  const pool = new pg.Pool({ connectionString: url });
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [MIGRATION_LOCK]);
      try {
        const { applied } = await applyMigrations(client, onApply);
        return applied;
      } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [MIGRATION_LOCK]);
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

/**
 * Fans out to every dedicated tenant in the registry (skipping offboarded ones,
 * whose database may be gone). Never throws for a per-tenant failure — those go
 * in `failures`; only a registry-query failure propagates.
 */
export async function fanOutMigrations(
  primary: pg.Pool,
  baseMigratorUrl: string,
  onTenant?: (slug: string, applied: number | "failed") => void,
): Promise<FanOutReport> {
  const { rows } = await primary.query<{ slug: string }>(
    `SELECT slug FROM control.tenants
      WHERE model = 'dedicated' AND status <> 'offboarded'
      ORDER BY slug`,
  );

  const results: { slug: string; applied: number }[] = [];
  const failures: { slug: string; error: unknown }[] = [];

  for (const { slug } of rows) {
    try {
      const applied = await migrateDedicatedDb(slug, baseMigratorUrl);
      results.push({ slug, applied });
      onTenant?.(slug, applied);
    } catch (error) {
      failures.push({ slug, error });
      onTenant?.(slug, "failed");
    }
  }

  return { results, failures };
}
