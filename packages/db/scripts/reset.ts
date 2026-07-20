/**
 * Drops and rebuilds the local schema from scratch.
 *
 * Local development only — it refuses to run against anything that doesn't
 * look like localhost, because "reset the database" is the one command whose
 * blast radius should never depend on which .env happened to be loaded.
 */
import { migratorPool } from "../src/client.js";
import { env } from "../src/env.js";

const host = new URL(env.DATABASE_URL).hostname;
if (!["localhost", "127.0.0.1", "postgres"].includes(host)) {
  console.error(`✗ Refusing to reset a non-local database (host: ${host}).`);
  process.exit(1);
}

async function main(): Promise<void> {
  const client = await migratorPool.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("DROP SCHEMA IF EXISTS control CASCADE");
    await client.query("CREATE SCHEMA public");
    console.log("✓ Schema dropped. Run `pnpm db:migrate` to rebuild.");
  } finally {
    client.release();
    await migratorPool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
