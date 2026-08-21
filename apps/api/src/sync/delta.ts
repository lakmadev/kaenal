import type { PoolClient } from "pg";

import { ApiError } from "../errors.js";

/**
 * Delta-sync keyset cursor (05 §2.1).
 *
 * The mobile mirror pulls each entity as an `updated_at` keyset scan — "rows
 * whose (updated_at, id) is strictly after the cursor, oldest-first". `id` is a
 * uuidv7, so (updated_at, id) is a total order and the cursor never skips or
 * repeats a row. Opaque on the wire (base64url of `updatedAtISO|id`); a client
 * that synthesises a bad one gets VALIDATION_FAILED, never a silent wrong page.
 */
export interface SyncCursor {
  readonly updatedAt: string;
  readonly id: string;
}

export function encodeSyncCursor(c: SyncCursor): string {
  return Buffer.from(`${c.updatedAt}|${c.id}`, "utf8").toString("base64url");
}

export function decodeSyncCursor(raw: string): SyncCursor {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Invalid sync cursor");
  }
  const sep = decoded.lastIndexOf("|");
  const updatedAt = sep === -1 ? "" : decoded.slice(0, sep);
  const id = sep === -1 ? "" : decoded.slice(sep + 1);
  if (updatedAt === "" || id === "" || Number.isNaN(Date.parse(updatedAt))) {
    throw new ApiError("VALIDATION_FAILED", "Invalid sync cursor");
  }
  return { updatedAt, id };
}

/** The minimum a delta row must expose to be keyset-ordered and tombstone-split.
 *  `deleted_at` is optional on the entity's Row type but always selected by the
 *  scan; a loose null check below treats an absent value as "not deleted". */
interface DeltaRow {
  id: string;
  updated_at: Date;
  deleted_at?: Date | null;
}

/** Per-entity wiring: which table to scan, what columns to hydrate a changed row,
 *  and how to shape that row into its DTO. Tenant scoping is RLS (the tx already
 *  `SET LOCAL app.tenant_id`) — this SQL never adds a tenant predicate. */
export interface DeltaConfig<Row extends DeltaRow, Dto> {
  readonly table: string;
  /** Full column list for a changed (non-deleted) row, plus any name sub-selects. */
  readonly columns: string;
  readonly map: (row: Row) => Dto;
}

export interface DeltaResult<Dto> {
  changed: Dto[];
  deleted: string[];
  /** The last row seen, so the client resumes strictly after it next cycle. Null
   *  only when the pull returned nothing and the client had no prior cursor. */
  nextCursor: string | null;
  /** More changed rows are waiting right now — the client should page again. */
  hasMore: boolean;
}

/**
 * One delta page. Scans `(updated_at, id)` ascending strictly after the cursor,
 * over-fetching `limit + 1` to detect a further page. Soft-deleted rows are NOT
 * excluded: a row with `deleted_at` set becomes a tombstone (id only) so the
 * client drops it; every other row hydrates its full DTO.
 *
 * `nextCursor` always points at the LAST row returned (not only when a further
 * page exists), so a client that drains to the end still persists its position
 * and never re-pulls from zero; if nothing changed it echoes the prior cursor.
 * `hasMore` is the separate "keep paging now" signal.
 */
export async function pullDelta<Row extends DeltaRow, Dto>(
  tx: PoolClient,
  config: DeltaConfig<Row, Dto>,
  cursorRaw: string | undefined,
  limit: number,
): Promise<DeltaResult<Dto>> {
  const cursor = cursorRaw !== undefined ? decodeSyncCursor(cursorRaw) : null;

  const params: unknown[] = [];
  let where = "";
  if (cursor !== null) {
    // Strictly-after keyset: newer timestamp, or same timestamp with a higher id.
    params.push(cursor.updatedAt, cursor.id);
    where = `WHERE (updated_at, id) > ($1::timestamptz, $2::uuid)`;
  }
  params.push(limit + 1);

  const res = await tx.query<Row>(
    `SELECT ${config.columns}, deleted_at
       FROM ${config.table}
       ${where}
       ORDER BY updated_at ASC, id ASC
       LIMIT $${params.length}`,
    params,
  );

  const hasMore = res.rows.length > limit;
  const visible = hasMore ? res.rows.slice(0, limit) : res.rows;

  const changed: Dto[] = [];
  const deleted: string[] = [];
  for (const row of visible) {
    // Loose check: a real deleted_at Date → tombstone; null/undefined → changed.
    if (row.deleted_at != null) deleted.push(row.id);
    else changed.push(config.map(row));
  }

  const last = visible[visible.length - 1];
  const nextCursor =
    last !== undefined ? encodeSyncCursor({ updatedAt: last.updated_at.toISOString(), id: last.id }) : (cursorRaw ?? null);

  return { changed, deleted, nextCursor, hasMore };
}
