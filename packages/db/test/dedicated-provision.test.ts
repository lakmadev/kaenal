import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { env } from "../src/env.js";
import { withTenant } from "../src/client.js";
import { provisionDedicatedTenant } from "../scripts/lib/provision-dedicated.js";
import { fanOutMigrations } from "../scripts/lib/fan-out.js";
import { dedicatedDbName, withDatabaseName } from "../scripts/lib/dedicated.js";
import { migrationFiles } from "../scripts/lib/migrate-runner.js";

/**
 * Model B provisioning + migration fan-out (01 §3.4, 02 §migrations).
 *
 * These run against the real primary cluster and create/drop throwaway
 * databases on it (`kaenal_ded_*`), separate from the primary `kaenal` database
 * the other db suites share — so there is no cross-suite interference.
 */

const PROV = "ded-prov";
const FANOUT = "ded-fanout";
const NODB = "ded-nodb";
const ALL = [PROV, FANOUT, NODB];

let primary: pg.Pool;

async function dropDedicated(slug: string): Promise<void> {
  // DROP DATABASE forbids a transaction and needs no live connections; FORCE
  // (PG13+) terminates any stragglers. Autocommit via a raw pool query.
  await primary.query(`DROP DATABASE IF EXISTS "${dedicatedDbName(slug)}" WITH (FORCE)`);
  await primary.query("DELETE FROM control.tenants WHERE slug = $1", [slug]);
}

async function registerDedicated(slug: string): Promise<void> {
  await primary.query(
    `INSERT INTO control.tenants (slug, name, model, database_url_secret_ref, status)
     VALUES ($1, $2, 'dedicated', $3, 'active')`,
    [slug, `${slug} co`, `localdb:${dedicatedDbName(slug)}`],
  );
}

beforeAll(async () => {
  primary = new pg.Pool({ connectionString: env.DATABASE_URL });
  for (const slug of ALL) await dropDedicated(slug); // clean slate
}, 60_000);

afterAll(async () => {
  for (const slug of ALL) await dropDedicated(slug);
  await primary.end();
}, 60_000);

describe("provisionDedicatedTenant", () => {
  it("creates a database, migrates + seeds it, and registers it active", async () => {
    const client = await primary.connect();
    let result;
    try {
      result = await provisionDedicatedTenant({
        slug: PROV,
        name: "Prov Co",
        region: "eu-central-1",
        timezone: "UTC",
        baseMigratorUrl: env.DATABASE_URL,
        baseAppUrl: env.DATABASE_APP_URL,
        primary: client,
      });
    } finally {
      client.release();
    }

    expect(result.dbName).toBe(dedicatedDbName(PROV));
    expect(result.secretRef).toBe(`localdb:${dedicatedDbName(PROV)}`);
    expect(result.createdDatabase).toBe(true);

    // The database exists on the cluster.
    const db = await primary.query("SELECT 1 FROM pg_database WHERE datname = $1", [result.dbName]);
    expect(db.rowCount).toBe(1);

    // The registry row is active + dedicated + carries the secret ref.
    const reg = await primary.query<{ status: string; model: string; database_url_secret_ref: string }>(
      "SELECT status, model, database_url_secret_ref FROM control.tenants WHERE slug = $1",
      [PROV],
    );
    expect(reg.rows[0]).toMatchObject({
      status: "active",
      model: "dedicated",
      database_url_secret_ref: `localdb:${dedicatedDbName(PROV)}`,
    });

    // The dedicated database was migrated + seeded: the default plant, the SLA
    // ladder, and the admin membership are all present, under RLS.
    const appPool = new pg.Pool({
      connectionString: withDatabaseName(env.DATABASE_APP_URL, result.dbName),
    });
    try {
      const seeded = await withTenant(
        result.tenantId,
        null,
        async (tx) => {
          const plant = await tx.query("SELECT code FROM plants WHERE code = 'PLANT-1'");
          const sla = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM sla_configs");
          const admin = await tx.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM memberships WHERE role = 'admin'",
          );
          return {
            plant: plant.rowCount,
            sla: sla.rows[0]?.n ?? 0,
            admin: admin.rows[0]?.n ?? 0,
          };
        },
        appPool,
      );
      expect(seeded.plant).toBe(1);
      expect(seeded.sla).toBe(3);
      expect(seeded.admin).toBe(1);
    } finally {
      await appPool.end();
    }
  }, 60_000);
});

describe("fanOutMigrations", () => {
  it("skips up-to-date tenants, catches up a lagging one, and isolates a failure", async () => {
    // PROV was fully migrated by provisioning above. FANOUT gets an EMPTY
    // database (registered + created, but no migrations). NODB is registered
    // but has no database at all — its migration must fail without stopping the
    // others.
    await registerDedicated(FANOUT);
    await primary.query(`CREATE DATABASE "${dedicatedDbName(FANOUT)}" OWNER kaenal_migrator`);
    await registerDedicated(NODB);

    const report = await fanOutMigrations(primary, env.DATABASE_URL);

    const byslug = new Map(report.results.map((r) => [r.slug, r.applied]));
    expect(byslug.get(PROV)).toBe(0); // already migrated → no-op
    expect(byslug.get(FANOUT)).toBe(migrationFiles().length); // caught up from empty
    expect(report.failures.map((f) => f.slug)).toContain(NODB); // no DB → failed, isolated
    // The failure did not stop the others: both healthy tenants are in results.
    expect(byslug.has(PROV)).toBe(true);
    expect(byslug.has(FANOUT)).toBe(true);
  }, 120_000);
});
