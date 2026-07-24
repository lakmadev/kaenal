/**
 * Migration runner (primary database).
 *
 * Applies `migrations/*.sql` in filename order via the shared runner in
 * `lib/migrate-runner.ts`, which dedicated-tenant provisioning and the fan-out
 * (`migrate-tenants`) reuse so every database is migrated identically.
 *
 * The Drizzle schema in src/schema mirrors these tables for typed queries; the
 * SQL is the source of truth for anything the database enforces.
 */
import { migratorPool } from "../src/client.js";
import { applyMigrations } from "./lib/migrate-runner.js";

async function main(): Promise<void> {
  const client = await migratorPool.connect();

  try {
    const { applied, total } = await applyMigrations(client, (file) =>
      process.stdout.write(`  applying ${file} ...\n`),
    );

    console.log(
      applied === 0
        ? `Database up to date (${total} migrations already applied).`
        : `Applied ${applied} migration(s).`,
    );
  } finally {
    client.release();
    await migratorPool.end();
  }
}

main().catch((err: unknown) => {
  console.error("\nMigration failed:\n", err);
  process.exit(1);
});
