/**
 * Model B (dedicated Postgres per tenant, 01 §3.4) provisioning.
 *
 * Creates the tenant's own database on the primary cluster, runs the full
 * migration set against it, seeds defaults + smoke-tests isolation inside it,
 * and registers it in the primary control plane with a `localdb:` secret ref the
 * API resolver understands. The registry row is held at `provisioning_failed`
 * (so `resolveBySlug` won't route to a half-ready database — it resolves only
 * `active`) and flipped to `active` only once every step has succeeded.
 *
 * Idempotent: re-running reuses the existing database and re-applies the
 * idempotent seed + any pending migrations, so a partial failure is retryable.
 */
import pg from "pg";
import { applyMigrations } from "./migrate-runner.js";
import { dedicatedDbName, localDbSecretRef, withDatabaseName } from "./dedicated.js";
import { seedTenantDefaults, smokeTestIsolation } from "./seed.js";

const MIGRATION_LOCK = "kaenal_migrations";

export interface DedicatedProvisionOpts {
  readonly slug: string;
  readonly name: string;
  readonly region: string;
  readonly timezone: string;
  /** Primary migrator URL (owner) — the base whose database name is swapped. */
  readonly baseMigratorUrl: string;
  /** Primary app-role URL — the base for the tenant's app connection. */
  readonly baseAppUrl: string;
  /** A connection to the PRIMARY database for control-plane operations. */
  readonly primary: pg.PoolClient;
  readonly log?: (msg: string) => void;
}

export interface DedicatedProvisionResult {
  readonly tenantId: string;
  readonly dbName: string;
  readonly appUrl: string;
  readonly secretRef: string;
  readonly createdDatabase: boolean;
}

export async function provisionDedicatedTenant(
  opts: DedicatedProvisionOpts,
): Promise<DedicatedProvisionResult> {
  const { slug, name, region, timezone, baseMigratorUrl, baseAppUrl, primary } = opts;
  const log = opts.log ?? ((): void => {});

  const dbName = dedicatedDbName(slug);
  const secretRef = localDbSecretRef(dbName);

  // --- 1. Create the database (autocommit — CREATE DATABASE forbids a tx) ----
  const exists = await primary.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  const createdDatabase = exists.rowCount === 0;
  if (createdDatabase) {
    // dbName is validated identifier-safe in dedicatedDbName(); CREATE DATABASE
    // has no parameter form, so interpolation is the only option.
    await primary.query(`CREATE DATABASE "${dbName}" OWNER kaenal_migrator`);
    log(`→ Created database ${dbName}.`);
  } else {
    log(`→ Database ${dbName} already exists; reusing.`);
  }

  // --- 2. Registry row, parked not-active until fully ready -----------------
  const reg = await primary.query<{ id: string }>(
    `INSERT INTO control.tenants (slug, name, model, database_url_secret_ref, region, timezone, status)
     VALUES ($1, $2, 'dedicated', $3, $4, $5, 'provisioning_failed')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, model = 'dedicated',
       database_url_secret_ref = EXCLUDED.database_url_secret_ref,
       region = EXCLUDED.region, timezone = EXCLUDED.timezone,
       status = 'provisioning_failed', updated_at = now()
     RETURNING id`,
    [slug, name, secretRef, region, timezone],
  );
  const tenantId = reg.rows[0]?.id;
  if (tenantId === undefined) throw new Error("registry upsert returned no row");

  const migratorUrl = withDatabaseName(baseMigratorUrl, dbName);
  const appUrl = withDatabaseName(baseAppUrl, dbName);

  // --- 3. Migrate the dedicated database ------------------------------------
  const migPool = new pg.Pool({ connectionString: migratorUrl });
  try {
    const mc = await migPool.connect();
    try {
      // Serialize concurrent migrators on this database (fan-out + provisioning).
      await mc.query("SELECT pg_advisory_lock(hashtext($1))", [MIGRATION_LOCK]);
      try {
        const { applied, total } = await applyMigrations(mc, (f) => log(`  applying ${f} ...`));
        log(
          applied === 0
            ? `→ Dedicated DB up to date (${total} migrations already applied).`
            : `→ Applied ${applied} migration(s) to ${dbName}.`,
        );
      } finally {
        await mc.query("SELECT pg_advisory_unlock(hashtext($1))", [MIGRATION_LOCK]);
      }
    } finally {
      mc.release();
    }
  } finally {
    await migPool.end();
  }

  // --- 4. Seed + smoke-test inside the dedicated database -------------------
  const appPool = new pg.Pool({ connectionString: appUrl });
  try {
    await seedTenantDefaults({ tenantId, slug, timezone, pool: appPool });
    log("→ Seeded SLA config, default plant, example template, admin invite.");
    await smokeTestIsolation(tenantId, appPool);
    log("→ RLS smoke test passed (dedicated DB isolates tenants).");
  } finally {
    await appPool.end();
  }

  // --- 5. Ready → active ----------------------------------------------------
  await primary.query("UPDATE control.tenants SET status = 'active', updated_at = now() WHERE id = $1", [
    tenantId,
  ]);

  return { tenantId, dbName, appUrl, secretRef, createdDatabase };
}
