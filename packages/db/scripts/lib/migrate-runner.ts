/**
 * The migration runner, extracted so the primary `migrate` CLI, dedicated-tenant
 * provisioning, and the fan-out all apply migrations identically: same file
 * order, same `_migrations` bookkeeping, same one-transaction-per-file atomicity.
 *
 * We run hand-written SQL rather than drizzle-kit's generated migrations because
 * the security-critical DDL here — FORCE ROW LEVEL SECURITY, policies, role
 * grants, append-only triggers — has no representation in the Drizzle schema DSL
 * and would be silently dropped from a generated diff.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";

const MIGRATIONS_DIR = new URL("../../migrations", import.meta.url).pathname;

export interface MigrationOutcome {
  readonly applied: number;
  readonly total: number;
}

/** Lists migration filenames in apply order. */
export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Applies every pending migration on `client`, in order, each in its own
 * transaction. Idempotent: files already in `_migrations` are skipped, so
 * re-running is a no-op. `onApply` reports progress (the CLI prints it).
 */
export async function applyMigrations(
  client: pg.PoolClient,
  onApply?: (file: string) => void,
): Promise<MigrationOutcome> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename    text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await client.query<{ filename: string }>("SELECT filename FROM _migrations")).rows.map(
      (r) => r.filename,
    ),
  );

  const files = migrationFiles();
  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    onApply?.(file);

    // Each migration is atomic: a failure half-way leaves no partial schema.
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      ran++;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  return { applied: ran, total: files.length };
}
