import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { FakeStorage } from "../src/files/storage.js";
import { offboardTenants } from "../src/jobs/processors/offboard-tenant.js";

/**
 * Dedicated (Model B) offboarding teardown (06 §1 `housekeeping`, 01 §3.4, 07 §5),
 * against real Postgres. A dedicated tenant's terminal step is dropping its whole
 * database, not the shared-DB row-purge.
 *
 * The trick (as in dedicated-routing.test): point the "dedicated" tenant at the
 * PRIMARY database via `localdb:kaenal`, so its own-database reads (legal hold +
 * export bundle) hit real schema and real seeded rows — while the irreversible
 * `DROP DATABASE` runs against an injected FAKE owner pool that merely records
 * the statement, so no real database is destroyed.
 *
 *  D — grace elapsed, no hold  → exported, DB "dropped" (faked), `offboarded`,
 *                                and its rows are NOT row-purged (drop-path only);
 *  E — active legal hold       → blocked, left `offboarding`, no drop;
 *  G — cloud (env:) secret ref → blocked (owner db name isn't derivable), no drop.
 */

const NOW = new Date("2026-07-23T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const past = new Date(NOW.getTime() - 40 * DAY); // grace (30d) elapsed

let control: pg.Pool;
const storage = new FakeStorage();
const dropped: string[] = [];

/** Fake owner pool: records the DROP DATABASE it is handed, destroys nothing. */
const fakePrimary = {
  connect: () =>
    Promise.resolve({
      query: (sql: string) => {
        dropped.push(sql);
        return Promise.resolve({ rows: [] });
      },
      release: () => undefined,
    }),
} as unknown as pg.Pool;

interface Tenant {
  id: string;
  slug: string;
  secretRef: string;
}
// D and E resolve their own DB to the primary (localdb:kaenal); G is a cloud ref.
const D: Tenant = { id: randomUUID(), slug: `dedoff-d-${randomUUID().slice(0, 8)}`, secretRef: "localdb:kaenal" };
const E: Tenant = { id: randomUUID(), slug: `dedoff-e-${randomUUID().slice(0, 8)}`, secretRef: "localdb:kaenal" };
const G: Tenant = { id: randomUUID(), slug: `dedoff-g-${randomUUID().slice(0, 8)}`, secretRef: "env:NOT_WIRED_DB_URL" };

async function createDedicatedOffboarding(t: Tenant): Promise<void> {
  await control.query(
    `INSERT INTO control.tenants (id, slug, name, model, database_url_secret_ref, status, offboarding_at)
     VALUES ($1, $2, $3, 'dedicated', $4, 'offboarding', $5)`,
    [t.id, t.slug, `Dedicated offboard ${t.slug}`, t.secretRef, past],
  );
}

async function seedData(t: Tenant): Promise<void> {
  await withTenant(t.id, null, async (tx) => {
    await tx.query("INSERT INTO plants (tenant_id, name, code) VALUES ($1, 'Plant', $2)", [t.id, `P-${t.slug}`]);
    await tx.query(
      `INSERT INTO ncrs (tenant_id, code, title, source, priority, status)
       VALUES ($1, $2, 'NCR', 'manual', 'major', 'open')`,
      [t.id, `NCR-${t.slug}`],
    );
  });
}

async function rowCount(tenantId: string, table: string): Promise<number> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    return rows[0]!.n;
  });
}

async function tenantStatus(id: string): Promise<{ status: string; offboarding_export_key: string | null }> {
  const { rows } = await control.query(
    "SELECT status, offboarding_export_key FROM control.tenants WHERE id = $1",
    [id],
  );
  return rows[0] as never;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  await createDedicatedOffboarding(D);
  await createDedicatedOffboarding(E);
  await createDedicatedOffboarding(G);
  await seedData(D);
  await seedData(E);
  // E is protected by an active legal hold.
  await withTenant(E.id, null, (tx) =>
    tx.query("INSERT INTO legal_holds (tenant_id, scope, reason) VALUES ($1, '{}'::jsonb, 'Litigation')", [E.id]),
  );
});

afterAll(async () => {
  // The DROP was faked, so D/E rows still live in the primary — clean them up.
  for (const t of [D, E]) {
    await withTenant(t.id, null, async (tx) => {
      await tx.query("DELETE FROM legal_holds WHERE tenant_id = $1", [t.id]);
      await tx.query("DELETE FROM ncrs WHERE tenant_id = $1", [t.id]);
      await tx.query("DELETE FROM plants WHERE tenant_id = $1", [t.id]);
    });
  }
  await control.query("DELETE FROM control.tenants WHERE id = ANY($1)", [[D.id, E.id, G.id]]);
  await control.end();
});

describe("offboardTenants — dedicated (Model B) teardown", () => {
  it("exports then drops the database, blocks held / cloud tenants, never row-purges", async () => {
    const result = await offboardTenants({
      storage,
      bucket: "test",
      now: NOW,
      baseAppUrl: process.env["DATABASE_APP_URL"],
      primaryPool: fakePrimary,
    });

    // D: exported, database dropped, offboarded.
    expect(result.offboarded).toContain(D.slug);
    const dStatus = await tenantStatus(D.id);
    expect(dStatus.status).toBe("offboarded");
    expect(dStatus.offboarding_export_key).not.toBeNull();
    const bundle = storage.read(dStatus.offboarding_export_key!);
    expect(bundle).not.toBeNull();
    expect(bundle!.byteLength).toBeGreaterThan(0);

    // The terminal step was a database DROP, not a row-purge: exactly one DROP
    // (only D reached it) and D's rows are still present (the drop was faked).
    expect(dropped).toHaveLength(1);
    expect(dropped[0]).toMatch(/^DROP DATABASE IF EXISTS "kaenal" WITH \(FORCE\)$/);
    expect(await rowCount(D.id, "plants")).toBe(1);
    expect(await rowCount(D.id, "ncrs")).toBe(1);

    // E: blocked by legal hold — no drop, data intact, still offboarding.
    expect(result.blocked).toContain(E.slug);
    expect((await tenantStatus(E.id)).status).toBe("offboarding");
    expect(await rowCount(E.id, "plants")).toBe(1);

    // G: cloud secret ref → owner db name not derivable → blocked, no drop.
    expect(result.blocked).toContain(G.slug);
    expect((await tenantStatus(G.id)).status).toBe("offboarding");
  });
});
