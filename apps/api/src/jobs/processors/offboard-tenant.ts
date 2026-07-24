import { zipSync } from "fflate";
import { withTenant, withoutTenant, type Tx } from "@kaenal/db";
import { isOffboardPurgeEligible } from "@kaenal/core";
import type { Storage } from "../../files/storage.js";

/**
 * Tenant offboarding purge (06 §1 `housekeeping`, 01 §3.4, 07 §5). A GLOBAL
 * nightly job (like the partition roll): find tenants whose 30-day grace has
 * elapsed and, for each, take the mandated export bundle, then permanently purge
 * the tenant's data. Ordered and gated:
 *
 *  1. **Legal hold wins.** Any active hold blocks the entire purge (07 §5) — the
 *     tenant is left `offboarding` for a later run.
 *  2. **Export before delete.** The full data export (JSON per table, incl. the
 *     audit trail) is produced to object storage first; its key is recorded so a
 *     resumed run never re-exports.
 *  3. **Purge, minus the audit trail.** Every tenant table is emptied in FK-safe
 *     order (batched `DELETE`), run as the tenant's own RLS scope so it can only
 *     ever touch this tenant's rows. `audit_events` is deliberately RETAINED —
 *     it is append-only by construction (the app role cannot delete it), and
 *     erasing the immutable compliance trail warrants its own careful step (see
 *     PROGRESS Known issues); the bundle has already captured it.
 *
 * Idempotent + resumable: a crash mid-purge leaves the tenant `offboarding` with
 * its export key set, and the next run skips the export and re-runs the (already
 * idempotent) deletes before flipping to `offboarded`.
 */

const DELETE_BATCH = 10_000;
const FK_VIOLATION = "23503";

export interface OffboardResult {
  /** Slugs fully purged and marked `offboarded` this run. */
  readonly offboarded: string[];
  /** Slugs eligible but skipped because a legal hold is active. */
  readonly blocked: string[];
}

interface Candidate {
  id: string;
  slug: string;
  model: string;
  offboarding_at: Date | null;
  offboarding_export_key: string | null;
}

export async function offboardTenants(deps: {
  storage: Storage;
  bucket: string;
  now?: Date;
}): Promise<OffboardResult> {
  const now = deps.now ?? new Date();
  const offboarded: string[] = [];
  const blocked: string[] = [];

  const candidates = await withoutTenant(async (tx) => {
    const { rows } = await tx.query<Candidate>(
      `SELECT id, slug, model, offboarding_at, offboarding_export_key
         FROM control.tenants WHERE status = 'offboarding'`,
    );
    return rows;
  });

  for (const c of candidates) {
    if (!isOffboardPurgeEligible({ status: "offboarding", offboardingAt: c.offboarding_at }, now)) {
      continue; // grace not yet elapsed
    }

    // Dedicated (Model B) teardown is a database drop, not a row-purge — and it
    // is not built yet. Skip these so this shared-DB row-purge never runs with a
    // dedicated tenant's id (which would touch the wrong database / nothing).
    if (c.model === "dedicated") {
      blocked.push(c.slug);
      continue;
    }

    // 1. An active legal hold blocks the whole purge (07 §5).
    const held = await withTenant(c.id, null, async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM legal_holds WHERE released_at IS NULL",
      );
      return rows[0]!.n > 0;
    });
    if (held) {
      blocked.push(c.slug);
      continue;
    }

    // 2. Export bundle, once, before any deletion.
    if (c.offboarding_export_key === null) {
      const key = await produceExportBundle(c.id, c.slug, deps);
      await withoutTenant((tx) =>
        tx.query(
          "UPDATE control.tenants SET offboarding_export_key = $2, updated_at = now() WHERE id = $1",
          [c.id, key],
        ),
      );
    }

    // 3. Purge every tenant table (retaining the immutable audit trail).
    await purgeTenantData(c.id);

    // 4. Terminal state.
    await withoutTenant((tx) =>
      tx.query(
        "UPDATE control.tenants SET status = 'offboarded', offboarded_at = now(), updated_at = now() WHERE id = $1",
        [c.id],
      ),
    );
    offboarded.push(c.slug);
  }

  return { offboarded, blocked };
}

/**
 * Tenant-owned table names (those with a `tenant_id` column), excluding partition
 * children. `audit_events` is included in the export but not the purge.
 */
async function tenantTableNames(tx: Tx, opts: { includeAuditEvents: boolean }): Promise<string[]> {
  const { rows } = await tx.query<{ name: string }>(
    `SELECT c.relname AS name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
      WHERE c.relkind IN ('r','p') AND NOT c.relispartition AND n.nspname = 'public'
      ORDER BY c.relname`,
  );
  const names = rows.map((r) => r.name);
  return opts.includeAuditEvents ? names : names.filter((n) => n !== "audit_events");
}

/** Full data export: one JSON document per tenant table, zipped and uploaded. */
async function produceExportBundle(
  tenantId: string,
  slug: string,
  deps: { storage: Storage; bucket: string },
): Promise<string> {
  const files: Record<string, Uint8Array> = {};
  await withTenant(tenantId, null, async (tx) => {
    for (const table of await tenantTableNames(tx, { includeAuditEvents: true })) {
      // RLS scopes each read to this tenant; json_agg turns the rows into one
      // document. `table` is a catalog-derived identifier, never user input.
      const { rows } = await tx.query<{ data: unknown }>(
        `SELECT coalesce(json_agg(x), '[]'::json) AS data FROM ${table} x`,
      );
      files[`${table}.json`] = new Uint8Array(Buffer.from(JSON.stringify(rows[0]!.data), "utf8"));
    }
  });
  const body = Buffer.from(zipSync(files));
  const key = `offboarding/${slug}/${Date.now()}-export.zip`;
  await deps.storage.put(key, body, "application/zip");
  return key;
}

/**
 * Empty every tenant table for `tenantId`, in FK-safe order. Runs as the tenant's
 * RLS scope, so each `DELETE` can only reach this tenant's rows. FK RESTRICT
 * (02 §7) is honoured by a savepoint-per-table multi-pass: a table still
 * referenced by an unpurged child is skipped and retried on the next pass, so a
 * whole DAG drains without hand-maintaining a delete order.
 */
async function purgeTenantData(tenantId: string): Promise<void> {
  await withTenant(tenantId, null, async (tx) => {
    const remaining = new Set(await tenantTableNames(tx, { includeAuditEvents: false }));
    const maxPasses = remaining.size + 1;

    for (let pass = 0; pass < maxPasses && remaining.size > 0; pass += 1) {
      let progress = false;
      for (const table of [...remaining]) {
        await tx.query("SAVEPOINT purge_tbl");
        try {
          let deleted = 0;
          do {
            const res = await tx.query(
              `DELETE FROM ${table} WHERE ctid IN (SELECT ctid FROM ${table} LIMIT ${DELETE_BATCH})`,
            );
            deleted = res.rowCount ?? 0;
          } while (deleted > 0);
          await tx.query("RELEASE SAVEPOINT purge_tbl");
          remaining.delete(table);
          progress = true;
        } catch (err) {
          await tx.query("ROLLBACK TO SAVEPOINT purge_tbl");
          await tx.query("RELEASE SAVEPOINT purge_tbl");
          if (!isForeignKeyViolation(err)) throw err;
          // still referenced by a not-yet-purged child → retry next pass
        }
      }
      if (!progress) {
        throw new Error(
          `offboarding purge stalled for tenant ${tenantId}; undeletable: ${[...remaining].join(", ")}`,
        );
      }
    }
  });
}

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === FK_VIOLATION
  );
}
