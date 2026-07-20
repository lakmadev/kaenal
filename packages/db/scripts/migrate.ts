/**
 * Migration runner.
 *
 * Applies `migrations/*.sql` in filename order, each in its own transaction,
 * recording applied files in `_migrations`. Re-running is a no-op.
 *
 * We run hand-written SQL rather than drizzle-kit's generated migrations
 * because the security-critical DDL here — FORCE ROW LEVEL SECURITY, policies,
 * role grants, append-only triggers — has no representation in the Drizzle
 * schema DSL and would be silently dropped from a generated diff. The Drizzle
 * schema in src/schema mirrors these tables for typed queries; the SQL is the
 * source of truth for anything the database enforces.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { migratorPool } from "../src/client.js";

const MIGRATIONS_DIR = new URL("../migrations", import.meta.url).pathname;

async function main(): Promise<void> {
  const client = await migratorPool.connect();

  try {
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

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`  applying ${file} ... `);

      // Each migration is atomic: a failure half-way leaves no partial schema.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        process.stdout.write("ok\n");
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        process.stdout.write("FAILED\n");
        throw err;
      }
    }

    console.log(
      ran === 0
        ? `Database up to date (${files.length} migrations already applied).`
        : `Applied ${ran} migration(s).`,
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
