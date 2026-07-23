import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { FakeStorage } from "../src/files/storage.js";
import { cleanupOrphanedUploadsForTenant } from "../src/jobs/processors/cleanup-orphaned-uploads.js";

/**
 * Orphaned-upload cleanup (06 §1 `files`, 03 §7). A never-completed `pending`
 * upload (no `sha256`) older than 24h is garbage-collected — row + object — while
 * a recent pending upload and a completed (sha256 set) one are left alone.
 */

const NOW = new Date("2026-07-23T00:00:00Z");
const HOUR = 60 * 60 * 1000;
const stale = new Date(NOW.getTime() - 30 * HOUR); // past the 24h grace
const fresh = new Date(NOW.getTime() - 1 * HOUR); // within grace

const storage = new FakeStorage();
let control: pg.Pool;
let acmeId = "";

const orphan = { id: randomUUID(), key: `cleanup/${randomUUID()}.bin` };
const recent = { id: randomUUID(), key: `cleanup/${randomUUID()}.bin` };
const completed = { id: randomUUID(), key: `cleanup/${randomUUID()}.bin` };

/** Seed a file row with an explicit created_at / sha256, and register its object. */
async function seedFile(
  f: { id: string; key: string },
  opts: { createdAt: Date; sha256: string | null },
): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO files (id, tenant_id, bucket, key, filename, mime, size_bytes, scan_status, sha256, created_at)
       VALUES ($1,$2,'kaenal',$3,'u.bin','application/octet-stream',10,'pending',$4,$5)`,
      [f.id, acmeId, f.key, opts.sha256, opts.createdAt],
    ),
  );
  await storage.presignPut(f.key, "application/octet-stream");
}

async function exists(id: string): Promise<boolean> {
  return withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query("SELECT 1 FROM files WHERE id = $1", [id]);
    return rows.length > 0;
  });
}

async function purgedAudits(id: string): Promise<number> {
  return withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_events WHERE action = 'purged' AND entity_id = $1",
      [id],
    );
    return rows[0]!.n;
  });
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = 'acme'");
  acmeId = rows[0]!.id;

  await seedFile(orphan, { createdAt: stale, sha256: null }); // never completed, old → collected
  await seedFile(recent, { createdAt: fresh, sha256: null }); // never completed, recent → kept
  await seedFile(completed, { createdAt: stale, sha256: "abc123" }); // completed, awaiting scan → kept
});

afterAll(async () => {
  await withTenant(acmeId, null, (tx) => tx.query("DELETE FROM files WHERE id = ANY($1)", [[recent.id, completed.id]]));
  await control.end();
});

describe("cleanupOrphanedUploads", () => {
  it("collects stale never-completed uploads + their objects, keeps the rest", async () => {
    const { cleaned } = await cleanupOrphanedUploadsForTenant({ tenantId: acmeId }, { storage, now: NOW });
    expect(cleaned).toBeGreaterThanOrEqual(1);

    // The orphan is gone, its object deleted, and a `purged` event closes the trail.
    expect(await exists(orphan.id)).toBe(false);
    expect(storage.has(orphan.key)).toBe(false);
    expect(await purgedAudits(orphan.id)).toBe(1);

    // A recent pending upload is within grace → kept.
    expect(await exists(recent.id)).toBe(true);
    expect(storage.has(recent.key)).toBe(true);

    // A completed (sha256 set) upload awaiting scan is NOT an orphan → kept.
    expect(await exists(completed.id)).toBe(true);
    expect(storage.has(completed.key)).toBe(true);
  });

  it("is idempotent — a re-run collects nothing new", async () => {
    const { cleaned } = await cleanupOrphanedUploadsForTenant({ tenantId: acmeId }, { storage, now: NOW });
    expect(cleaned).toBe(0);
  });
});
