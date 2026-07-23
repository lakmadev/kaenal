import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { rollAuditPartitions } from "../src/jobs/processors/audit-partition-roll.js";

/**
 * Audit-events partition roll (06 §1 `housekeeping`, 07 §1), driven against real
 * Postgres. Two duties: provision upcoming monthly partitions, and detect a
 * shrink in any partition's row count (a delete on an append-only table = a
 * tampering signal). Runs as the owner — DDL + cross-partition counting.
 *
 * A dedicated far-past partition (`audit_events_2019_01`, which no other suite
 * writes) isolates the count assertions from the shared current-month partition.
 */

const PAST = "audit_events_2019_01";
let owner: pg.Pool;
let acmeId = "";

async function partitionExists(name: string): Promise<boolean> {
  const { rows } = await owner.query<{ exists: boolean }>("SELECT to_regclass($1) IS NOT NULL AS exists", [name]);
  return rows[0]!.exists;
}

async function statsFor(name: string): Promise<{ row_count: number; tamper_seen_at: Date | null } | null> {
  const { rows } = await owner.query<{ row_count: string; tamper_seen_at: Date | null }>(
    "SELECT row_count, tamper_seen_at FROM control.audit_partition_stats WHERE partition_name = $1",
    [name],
  );
  const r = rows[0];
  return r === undefined ? null : { row_count: Number(r.row_count), tamper_seen_at: r.tamper_seen_at };
}

beforeAll(async () => {
  owner = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const { rows } = await owner.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = 'acme'");
  acmeId = rows[0]!.id;

  // A past partition + 3 rows inserted directly into the child (owner, no RLS on
  // the child; created_at must fall inside the child's range).
  await owner.query(`CREATE TABLE IF NOT EXISTS ${PAST} PARTITION OF audit_events FOR VALUES FROM ('2019-01-01') TO ('2019-02-01')`);
  for (let i = 0; i < 3; i += 1) {
    await owner.query(
      `INSERT INTO ${PAST} (tenant_id, actor_id, actor_kind, entity_kind, entity_id, action, created_at)
       VALUES ($1, NULL, 'system', 'ncr', $2, 'created', '2019-01-15T00:00:00Z')`,
      [acmeId, randomUUID()],
    );
  }
});

afterAll(async () => {
  await owner.query("DELETE FROM control.audit_partition_stats WHERE partition_name IN ($1,'audit_events_2026_09','audit_events_2026_10')", [PAST]);
  await owner.query(`DROP TABLE IF EXISTS ${PAST}`);
  await owner.query("DROP TABLE IF EXISTS audit_events_2026_09");
  await owner.query("DROP TABLE IF EXISTS audit_events_2026_10");
  await owner.end();
});

describe("audit partition roll", () => {
  it("provisions the current + next month partitions that don't exist yet", async () => {
    // Drive `now` into September 2026 → neither Sept nor Oct exists yet.
    const { created } = await rollAuditPartitions({ now: new Date("2026-09-10T00:00:00Z") });
    expect(created).toContain("audit_events_2026_09");
    expect(created).toContain("audit_events_2026_10");
    expect(await partitionExists("audit_events_2026_09")).toBe(true);
    expect(await partitionExists("audit_events_2026_10")).toBe(true);

    // Idempotent: a second run creates nothing new.
    const again = await rollAuditPartitions({ now: new Date("2026-09-10T00:00:00Z") });
    expect(again.created).not.toContain("audit_events_2026_09");
  });

  it("records a baseline count for each partition, then flags a shrink", async () => {
    // First check records the true count (3) for the past partition.
    const first = await rollAuditPartitions({ now: new Date("2026-07-23T00:00:00Z") });
    expect(first.tampered).not.toContain(PAST);
    expect((await statsFor(PAST))?.row_count).toBe(3);

    // Simulate having previously seen more rows than are there now.
    await owner.query("UPDATE control.audit_partition_stats SET row_count = 10 WHERE partition_name = $1", [PAST]);

    const second = await rollAuditPartitions({ now: new Date("2026-07-23T00:00:00Z") });
    expect(second.tampered).toContain(PAST);

    const stats = await statsFor(PAST);
    expect(stats?.tamper_seen_at).not.toBeNull(); // the signal is recorded
    expect(stats?.row_count).toBe(10); // high-water is not lowered, so the shrink stays visible
  });
});
