import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { FakeStorage } from "../src/files/storage.js";
import { purgeSoftDeletedForTenant } from "../src/jobs/processors/purge-soft-deleted.js";

/**
 * Documents/files soft-delete purge (06 §1 `housekeeping`). The tricky corner of
 * the purge: `document_versions` has no `deleted_at` (it is collateral of its
 * `documents` parent and is cascade-deleted), and `files` own an object-store
 * object that must be deleted with the row — but only after the DB commits, and
 * only once no live row references the file (FK RESTRICT).
 */

const NOW = new Date("2026-07-23T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const oldTs = new Date(NOW.getTime() - 100 * DAY); // past the 90-day window

const storage = new FakeStorage();
let control: pg.Pool;
let acmeId = "";

// Purge target: an old document + its version, both pointing at an old file.
const fileA = randomUUID();
const fileAKey = `purgetest/${fileA}.pdf`;
const docA = randomUUID();
const versionA = randomUUID();
// Retained: an old file still referenced by a LIVE document.
const fileB = randomUUID();
const fileBKey = `purgetest/${fileB}.pdf`;
const docB = randomUUID();

async function exists(table: string, id: string): Promise<boolean> {
  return withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    return rows.length > 0;
  });
}

async function purgedAudits(entityId: string): Promise<number> {
  return withTenant(acmeId, null, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_events WHERE action = 'purged' AND entity_id = $1",
      [entityId],
    );
    return rows[0]!.n;
  });
}

async function seedFile(id: string, key: string, deletedAt: Date | null): Promise<void> {
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO files (id, tenant_id, bucket, key, filename, mime, size_bytes, scan_status, deleted_at)
       VALUES ($1,$2,'kaenal',$3,'doc.pdf','application/pdf',1024,'clean',$4)`,
      [id, acmeId, key, deletedAt],
    ),
  );
  await storage.presignPut(key, "application/pdf"); // register the object as present
}

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = 'acme'");
  acmeId = rows[0]!.id;

  await seedFile(fileA, fileAKey, oldTs);
  await seedFile(fileB, fileBKey, oldTs);

  await withTenant(acmeId, null, async (tx) => {
    // docA: old, references fileA — will purge (cascading its version).
    await tx.query(
      `INSERT INTO documents (id, tenant_id, code, title, category, status, version, file_id, deleted_at)
       VALUES ($1,$2,$3,'DFTEST docA','sop','approved','1.0',$4,$5)`,
      [docA, acmeId, `DFTEST-A-${docA.slice(0, 8)}`, fileA, oldTs],
    );
    await tx.query(
      `INSERT INTO document_versions (id, tenant_id, document_id, version, file_id)
       VALUES ($1,$2,$3,'1.0',$4)`,
      [versionA, acmeId, docA, fileA],
    );
    // docB: LIVE (not deleted), references fileB — keeps fileB un-purgeable.
    await tx.query(
      `INSERT INTO documents (id, tenant_id, code, title, category, status, version, file_id)
       VALUES ($1,$2,$3,'DFTEST docB','sop','approved','1.0',$4)`,
      [docB, acmeId, `DFTEST-B-${docB.slice(0, 8)}`, fileB],
    );
  });
});

afterAll(async () => {
  await withTenant(acmeId, null, async (tx) => {
    await tx.query("DELETE FROM document_versions WHERE id = $1", [versionA]);
    await tx.query("DELETE FROM documents WHERE id = ANY($1)", [[docA, docB]]);
    await tx.query("DELETE FROM files WHERE id = ANY($1)", [[fileA, fileB]]);
  });
  await control.end();
});

describe("documents/files purge", () => {
  it("cascades document_versions, purges the file + its object, and keeps referenced files", async () => {
    const { purged } = await purgeSoftDeletedForTenant({ tenantId: acmeId }, { storage, now: NOW });
    // `purged` counts top-level rows (docA + fileA); the cascaded version is
    // deleted too but not counted — its deletion is asserted directly below.
    expect(purged).toBeGreaterThanOrEqual(2);

    // docA and its dependent version are gone, each with a purge event.
    expect(await exists("documents", docA)).toBe(false);
    expect(await exists("document_versions", versionA)).toBe(false);
    expect(await purgedAudits(docA)).toBe(1);
    expect(await purgedAudits(versionA)).toBe(1);

    // fileA purged once its references cleared, and its object deleted post-commit.
    expect(await exists("files", fileA)).toBe(false);
    expect(await purgedAudits(fileA)).toBe(1);
    expect(storage.has(fileAKey)).toBe(false);

    // fileB is still referenced by the live docB → RESTRICT-skipped, object retained.
    expect(await exists("files", fileB)).toBe(true);
    expect(await exists("documents", docB)).toBe(true);
    expect(storage.has(fileBKey)).toBe(true);
  });
});
