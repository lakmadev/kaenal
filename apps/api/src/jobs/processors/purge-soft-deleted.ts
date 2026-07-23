import { withTenant, withAudit, type Tx } from "@kaenal/db";
import {
  purgeCutoff,
  hasTenantWideHold,
  isBlockedByHolds,
  type LegalHoldScope,
} from "@kaenal/core";
import type { Storage } from "../../files/storage.js";
import type { PurgeSoftDeletedJob } from "../job-types.js";

/**
 * Soft-delete purge (06 §1 `housekeeping`, 07 §5). For one tenant, permanently
 * delete rows soft-deleted longer ago than the retention window — unless a legal
 * hold protects them. The permanent delete is compliance-distinct from the soft
 * delete, so each purged row writes a `purged` audit event (system actor); the
 * trail outlives the row it describes.
 *
 * Invariants:
 *  - **Legal holds win.** A tenant-wide hold aborts the whole run; a scoped hold
 *    protects the rows it covers. When in doubt the data is kept, never erased.
 *  - **FK integrity is never violated.** Every intra-tenant FK is `ON DELETE
 *    RESTRICT` (02 §7), so a record still referenced by a live (or not-yet-
 *    purged) child cannot be deleted. Each delete runs in its own SAVEPOINT, so
 *    a RESTRICT block skips just that row — it purges on a later run once the
 *    reference clears — instead of aborting the batch. Children are tried before
 *    parents to drain a graph in as few nightly runs as possible.
 *  - **Dependents follow their parent.** A few child tables have no independent
 *    soft-delete lifecycle (e.g. `document_versions` has no `deleted_at`): they
 *    exist only under a parent and are deleted in the same SAVEPOINT when the
 *    parent is purged (see {@link DEPENDENT_CASCADES}).
 *  - **Objects follow their row.** When a `files` row is purged, its object-store
 *    object is deleted too — AFTER the DB transaction commits, so a rolled-back
 *    purge never orphans a live row from its bytes; a failed object delete only
 *    leaves a harmless orphan for the storage cleanup job.
 *
 * Idempotent: a re-run finds nothing left past the cutoff (or nothing newly
 * eligible) and purges zero.
 */

/** Postgres SQLSTATE for a foreign-key violation — a row still referenced. */
const FK_VIOLATION = "23503";

/**
 * Soft-deletable business-record tables, children before parents, each paired
 * with its singular audit `entityKind`. `files` is last: it is referenced by
 * inspections, documents, document_versions and signatures, so it can only purge
 * once those references are gone (RESTRICT skips it until then).
 *
 * Deliberately excluded: access/identity (`memberships`, `notification_prefs`,
 * `sessions` — DSAR/offboarding lifecycle, 07 §5) and `exports` (generated
 * artifacts). A file still referenced by a `signature` (retained evidence) never
 * becomes purgeable, which is correct.
 */
const PURGE_ORDER: readonly { readonly table: string; readonly entityKind: string }[] = [
  { table: "ncr_actions", entityKind: "ncr_action" },
  { table: "capa_actions", entityKind: "capa_action" },
  { table: "audit_findings", entityKind: "audit_finding" },
  { table: "ppap_submissions", entityKind: "ppap_submission" },
  { table: "scars", entityKind: "scar" },
  { table: "findings", entityKind: "finding" },
  { table: "eight_ds", entityKind: "eight_d" },
  { table: "comments", entityKind: "comment" },
  { table: "documents", entityKind: "document" },
  { table: "inspections", entityKind: "inspection" },
  { table: "ncrs", entityKind: "ncr" },
  { table: "capas", entityKind: "capa" },
  { table: "audits", entityKind: "audit" },
  { table: "suppliers", entityKind: "supplier" },
  { table: "inspection_templates", entityKind: "inspection_template" },
  { table: "areas", entityKind: "area" },
  { table: "plants", entityKind: "plant" },
  { table: "files", entityKind: "file" },
];

/**
 * Child rows with no independent soft-delete lifecycle, deleted in the same
 * SAVEPOINT as the parent they belong to. `document_versions` has no `deleted_at`
 * of its own — it is collateral of its `documents` parent.
 */
const DEPENDENT_CASCADES: Record<
  string,
  readonly { readonly table: string; readonly entityKind: string; readonly fk: string }[]
> = {
  documents: [{ table: "document_versions", entityKind: "document_version", fk: "document_id" }],
};

export async function purgeSoftDeletedForTenant(
  payload: PurgeSoftDeletedJob,
  deps: { storage: Storage; now?: Date; retentionDays?: number },
): Promise<{ purged: number }> {
  const now = deps.now ?? new Date();
  const cutoff = purgeCutoff(now, deps.retentionDays);

  const { purged, purgedObjectKeys } = await withTenant(payload.tenantId, null, async (tx) => {
    // Active holds for this tenant. RLS already scopes the read to the tenant;
    // released holds no longer protect anything.
    const { rows: holdRows } = await tx.query<{ scope: LegalHoldScope }>(
      "SELECT scope FROM legal_holds WHERE released_at IS NULL",
    );
    const scopes = holdRows.map((r) => r.scope);

    // A tenant-wide hold protects everything — nothing is purgeable at all.
    if (hasTenantWideHold(scopes)) return { purged: 0, purgedObjectKeys: [] as string[] };

    let purged = 0;
    const purgedObjectKeys: string[] = [];

    for (const { table, entityKind } of PURGE_ORDER) {
      // For files, also read the object key so its bytes can be deleted after commit.
      const columns = table === "files" ? "id, key" : "id";
      const { rows } = await tx.query<{ id: string; key?: string }>(
        // `table`/`columns` are from the fixed PURGE_ORDER list, never user input.
        `SELECT ${columns} FROM ${table}
          WHERE deleted_at IS NOT NULL AND deleted_at < $1
          ORDER BY deleted_at`,
        [cutoff],
      );

      for (const row of rows) {
        if (isBlockedByHolds(scopes, { entityKind, entityId: row.id })) continue;
        if (await purgeRow(tx, payload.tenantId, table, entityKind, row.id)) {
          purged += 1;
          if (table === "files" && row.key !== undefined) purgedObjectKeys.push(row.key);
        }
      }
    }

    return { purged, purgedObjectKeys };
  });

  // Objects are deleted only after the DB commit — a rolled-back purge must
  // never leave a live row pointing at deleted bytes. A failed object delete is
  // logged and left as an orphan for the storage-cleanup job (never fatal).
  for (const key of purgedObjectKeys) {
    try {
      await deps.storage.delete(key);
    } catch (err) {
      console.error(`purge: failed to delete object '${key}' (orphaned, will be cleaned up later):`, err);
    }
  }

  return { purged };
}

/**
 * Delete one row inside a SAVEPOINT — first its dependent cascade children, then
 * the row itself — writing a `purged` audit event for each. Returns true if
 * purged, false if a still-live reference (FK RESTRICT) blocked it, in which
 * case the SAVEPOINT rolls the whole thing back and the row waits for a later run.
 */
async function purgeRow(
  tx: Tx,
  tenantId: string,
  table: string,
  entityKind: string,
  id: string,
): Promise<boolean> {
  await tx.query("SAVEPOINT purge_row");
  try {
    for (const dep of DEPENDENT_CASCADES[table] ?? []) {
      const { rows } = await tx.query<{ id: string }>(
        `SELECT id FROM ${dep.table} WHERE ${dep.fk} = $1`,
        [id],
      );
      for (const child of rows) {
        await withAudit(
          tx,
          tenantId,
          { actorId: null, actorKind: "system", entityKind: dep.entityKind, entityId: child.id, action: "purged" },
          (t) => t.query(`DELETE FROM ${dep.table} WHERE id = $1`, [child.id]),
        );
      }
    }

    await withAudit(
      tx,
      tenantId,
      { actorId: null, actorKind: "system", entityKind, entityId: id, action: "purged" },
      (t) => t.query(`DELETE FROM ${table} WHERE id = $1`, [id]),
    );
    await tx.query("RELEASE SAVEPOINT purge_row");
    return true;
  } catch (err) {
    await tx.query("ROLLBACK TO SAVEPOINT purge_row");
    await tx.query("RELEASE SAVEPOINT purge_row");
    if (isForeignKeyViolation(err)) return false; // still referenced → purge later
    throw err;
  }
}

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === FK_VIOLATION
  );
}
