import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { withTenant } from "@kaenal/db";
import { purgeSoftDeletedForTenant } from "../src/jobs/processors/purge-soft-deleted.js";

/**
 * Soft-delete purge (06 §1 `housekeeping`, 07 §5), driven directly against real
 * Postgres at a fixed `now`. A row soft-deleted past the 90-day window is erased
 * and earns a `purged` audit event — UNLESS a legal hold protects it, a live
 * child still references it (FK RESTRICT), or the window has not yet elapsed.
 * A tenant-wide hold blocks the whole run.
 */

const ACME = "acme";
const NOW = new Date("2026-07-23T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const oldTs = new Date(NOW.getTime() - 100 * DAY); // past the 90-day window
const recentTs = new Date(NOW.getTime() - 10 * DAY); // still recoverable

let control: pg.Pool;
let acmeId = "";
let templateId = "";
const inspectionIds: string[] = [];
const findingIds: string[] = [];
const holdIds: string[] = [];

async function tid(slug: string): Promise<string> {
  const { rows } = await control.query<{ id: string }>("SELECT id FROM control.tenants WHERE slug = $1", [slug]);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error(`${slug} not provisioned`);
  return id;
}

/** Seed a soft-deleted inspection; `deletedAt` null keeps it live. */
async function seedInspection(deletedAt: Date | null): Promise<string> {
  const id = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO inspections (id, tenant_id, code, title, template_id, template_version, status, deleted_at)
       VALUES ($1,$2,$3,'PURGETEST inspection',$4,1,'cancelled',$5)`,
      [id, acmeId, `PURGE-${id.slice(0, 8)}`, templateId, deletedAt],
    ),
  );
  inspectionIds.push(id);
  return id;
}

async function seedFinding(inspectionId: string, deletedAt: Date | null): Promise<string> {
  const id = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO findings (id, tenant_id, inspection_id, item_ref, severity, description, deleted_at)
       VALUES ($1,$2,$3,'item','minor','PURGETEST finding',$4)`,
      [id, acmeId, inspectionId, deletedAt],
    ),
  );
  findingIds.push(id);
  return id;
}

async function seedHold(scope: Record<string, unknown>): Promise<string> {
  const id = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO legal_holds (id, tenant_id, scope, reason) VALUES ($1,$2,$3,'PURGETEST hold')`,
      [id, acmeId, JSON.stringify(scope)],
    ),
  );
  holdIds.push(id);
  return id;
}

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

beforeAll(async () => {
  control = new pg.Pool({ connectionString: process.env["DATABASE_URL"] });
  acmeId = await tid(ACME);
  templateId = randomUUID();
  await withTenant(acmeId, null, (tx) =>
    tx.query(
      `INSERT INTO inspection_templates (id, tenant_id, name, version, status)
       VALUES ($1,$2,'PURGETEST template',1,'published')`,
      [templateId, acmeId],
    ),
  );
});

afterAll(async () => {
  // Purged rows are already gone; DELETE of a missing id is a harmless no-op.
  // audit_events is append-only, so the `purged` events this test wrote stay —
  // they carry per-run unique entity ids, so they never collide across runs.
  await withTenant(acmeId, null, async (tx) => {
    for (const id of findingIds) await tx.query("DELETE FROM findings WHERE id = $1", [id]);
    for (const id of inspectionIds) await tx.query("DELETE FROM inspections WHERE id = $1", [id]);
    for (const id of holdIds) await tx.query("DELETE FROM legal_holds WHERE id = $1", [id]);
    await tx.query("DELETE FROM inspection_templates WHERE id = $1", [templateId]);
  });
  await control.end();
});

describe("soft-delete purge", () => {
  // Seeded once; the first test performs the purge, later tests read its result.
  let leaf = "";
  let recent = "";
  let held = "";
  let blockedParent = "";
  let liveChild = "";
  let purgedParent = "";
  let purgedChild = "";

  it("purges eligible rows, keeping recent / held / still-referenced ones", async () => {
    leaf = await seedInspection(oldTs); // old, no children → purged
    recent = await seedInspection(recentTs); // inside the window → kept
    held = await seedInspection(oldTs); // old but under a scoped hold → kept
    await seedHold({ entityKind: "inspection", entityId: held });

    blockedParent = await seedInspection(oldTs); // old, but a LIVE child references it
    liveChild = await seedFinding(blockedParent, null); // not deleted → RESTRICT blocks the parent

    purgedParent = await seedInspection(oldTs); // old, with an old child
    purgedChild = await seedFinding(purgedParent, oldTs); // old too → child purges first, then parent

    const { purged } = await purgeSoftDeletedForTenant({ tenantId: acmeId }, { now: NOW });
    expect(purged).toBeGreaterThanOrEqual(3); // at least leaf + purgedChild + purgedParent

    // Erased, each with exactly one `purged` audit event.
    expect(await exists("inspections", leaf)).toBe(false);
    expect(await purgedAudits(leaf)).toBe(1);
    expect(await exists("inspections", purgedParent)).toBe(false);
    expect(await exists("findings", purgedChild)).toBe(false);
    expect(await purgedAudits(purgedChild)).toBe(1);

    // Kept — and none of these earned a purge event.
    expect(await exists("inspections", recent)).toBe(true);
    expect(await exists("inspections", held)).toBe(true);
    expect(await exists("inspections", blockedParent)).toBe(true); // FK RESTRICT
    expect(await exists("findings", liveChild)).toBe(true);
    expect(await purgedAudits(held)).toBe(0);
    expect(await purgedAudits(blockedParent)).toBe(0);
  });

  it("is idempotent — a re-run purges nothing new", async () => {
    // leaf/purgedParent/purgedChild are gone; recent is inside the window; held
    // is under a hold; blockedParent still has its live child. Nothing eligible.
    const { purged } = await purgeSoftDeletedForTenant({ tenantId: acmeId }, { now: NOW });
    expect(purged).toBe(0);
    expect(await exists("inspections", blockedParent)).toBe(true);
  });

  it("a tenant-wide hold blocks the entire purge", async () => {
    const wide = await seedInspection(oldTs); // eligible on its own
    await seedHold({}); // empty scope = tenant-wide

    const { purged } = await purgeSoftDeletedForTenant({ tenantId: acmeId }, { now: NOW });
    expect(purged).toBe(0);
    expect(await exists("inspections", wide)).toBe(true);
  });
});
