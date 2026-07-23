import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { FakeStorage } from "../src/files/storage.js";
import { offboardTenants } from "../src/jobs/processors/offboard-tenant.js";

/**
 * Tenant offboarding purge (06 §1 `housekeeping`, 01 §3.4, 07 §5), against real
 * Postgres. One job run over three throwaway tenants exercises every path:
 *  A — grace elapsed, no hold → exported + purged + `offboarded`;
 *  B — active legal hold → blocked, left `offboarding`;
 *  C — grace not yet elapsed → skipped.
 * The audit trail is retained (append-only), so it survives A's purge.
 *
 * Dedicated tenants are used so the destructive purge never touches acme/globex.
 */

const NOW = new Date("2026-07-23T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const past = new Date(NOW.getTime() - 40 * DAY); // grace (30d) elapsed
const recent = new Date(NOW.getTime() - 5 * DAY); // grace not elapsed

let control: pg.Pool;
const storage = new FakeStorage();

interface Tenant { id: string; slug: string; }
const A: Tenant = { id: randomUUID(), slug: `offb-a-${randomUUID().slice(0, 8)}` };
const B: Tenant = { id: randomUUID(), slug: `offb-b-${randomUUID().slice(0, 8)}` };
const C: Tenant = { id: randomUUID(), slug: `offb-c-${randomUUID().slice(0, 8)}` };

async function createOffboardingTenant(t: Tenant, offboardingAt: Date): Promise<void> {
  await control.query(
    `INSERT INTO control.tenants (id, slug, name, model, status, offboarding_at)
     VALUES ($1, $2, $3, 'shared', 'offboarding', $4)`,
    [t.id, t.slug, `Offboard test ${t.slug}`, offboardingAt],
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
    await tx.query(
      `INSERT INTO audit_events (tenant_id, actor_kind, entity_kind, entity_id, action)
       VALUES ($1, 'system', 'ncr', $2, 'created')`,
      [t.id, randomUUID()],
    );
  });
}

async function rowCount(tenantId: string, table: string): Promise<number> {
  return withTenant(tenantId, null, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
    return rows[0]!.n;
  });
}

async function tenantStatus(id: string): Promise<{ status: string; offboarded_at: Date | null; offboarding_export_key: string | null }> {
  const { rows } = await control.query("SELECT status, offboarded_at, offboarding_export_key FROM control.tenants WHERE id = $1", [id]);
  return rows[0] as never;
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  await createOffboardingTenant(A, past);
  await createOffboardingTenant(B, past);
  await createOffboardingTenant(C, recent);
  await seedData(A);
  await seedData(B);
  await seedData(C);
  // B is protected by an active legal hold.
  await withTenant(B.id, null, (tx) =>
    tx.query("INSERT INTO legal_holds (tenant_id, scope, reason) VALUES ($1, '{}'::jsonb, 'Litigation')", [B.id]),
  );
});

afterAll(async () => {
  // A is already purged; empty B and C, then drop the registry rows. audit_events
  // is append-only (can't be deleted here) — the few test rows are inert.
  for (const t of [B, C]) {
    await withTenant(t.id, null, async (tx) => {
      await tx.query("DELETE FROM legal_holds WHERE tenant_id = $1", [t.id]);
      await tx.query("DELETE FROM ncrs WHERE tenant_id = $1", [t.id]);
      await tx.query("DELETE FROM plants WHERE tenant_id = $1", [t.id]);
    });
  }
  await control.query("DELETE FROM control.tenants WHERE id = ANY($1)", [[A.id, B.id, C.id]]);
  await control.end();
});

describe("offboardTenants", () => {
  it("exports + purges eligible tenants, blocks held ones, and skips those still in grace", async () => {
    const result = await offboardTenants({ storage, bucket: "test", now: NOW });

    // A: fully offboarded.
    expect(result.offboarded).toContain(A.slug);
    expect(await rowCount(A.id, "plants")).toBe(0);
    expect(await rowCount(A.id, "ncrs")).toBe(0);
    // The audit trail is retained through the purge.
    expect(await rowCount(A.id, "audit_events")).toBeGreaterThanOrEqual(1);

    const aStatus = await tenantStatus(A.id);
    expect(aStatus.status).toBe("offboarded");
    expect(aStatus.offboarded_at).not.toBeNull();
    // The export bundle was produced before the purge and its key recorded.
    expect(aStatus.offboarding_export_key).not.toBeNull();
    const bundle = storage.read(aStatus.offboarding_export_key!);
    expect(bundle).not.toBeNull();
    expect(bundle!.byteLength).toBeGreaterThan(0);

    // B: blocked by a legal hold, data intact, still offboarding.
    expect(result.blocked).toContain(B.slug);
    expect(await rowCount(B.id, "plants")).toBe(1);
    expect((await tenantStatus(B.id)).status).toBe("offboarding");

    // C: grace not elapsed → untouched.
    expect(result.offboarded).not.toContain(C.slug);
    expect(result.blocked).not.toContain(C.slug);
    expect(await rowCount(C.id, "plants")).toBe(1);
    expect((await tenantStatus(C.id)).status).toBe("offboarding");
  });
});
