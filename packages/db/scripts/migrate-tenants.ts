/**
 * Model B migration fan-out CLI (02 §migrations, "Model B instances").
 *
 *   pnpm db:migrate:tenants
 *
 * `db:migrate` migrates the primary database (shared tenants + control plane);
 * this fans the same migrations out to every dedicated tenant's own database.
 * A failed tenant halts its own rollout only; the process exits non-zero if any
 * failed so CI/operators notice. See `lib/fan-out.ts` for the mechanics.
 */
import { migratorPool } from "../src/client.js";
import { env } from "../src/env.js";
import { fanOutMigrations } from "./lib/fan-out.js";

async function main(): Promise<void> {
  let report;
  try {
    report = await fanOutMigrations(migratorPool, env.DATABASE_URL, (slug, applied) => {
      process.stdout.write(
        `  ${slug} ... ${applied === "failed" ? "FAILED" : applied === 0 ? "up to date" : `applied ${applied}`}\n`,
      );
    });
  } finally {
    await migratorPool.end();
  }

  const migrated = report.results.reduce((n, r) => n + r.applied, 0);
  const ok = report.results.length;
  const failed = report.failures.length;

  if (ok + failed === 0) {
    console.log("No dedicated tenants to migrate.");
    return;
  }

  console.log(`\nDone: ${migrated} migration(s) across ${ok}/${ok + failed} tenant(s).`);
  if (failed > 0) {
    console.error(`\n✗ ${failed} tenant(s) failed:`);
    for (const f of report.failures) console.error(`  - ${f.slug}: ${String(f.error)}`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error("\nFan-out failed:\n", err);
  process.exit(1);
});
