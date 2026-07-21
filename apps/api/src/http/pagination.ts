import { MAX_PAGE_LIMIT, type Page } from "@kaenal/types";
import { ApiError } from "../errors.js";

/**
 * Keyset (cursor) pagination (03 §5).
 *
 * Offset pagination drifts when rows are inserted between pages and scans a
 * growing prefix on every request; keyset does neither. The cursor encodes the
 * last row's sort keys — `(created_at, id)`, which is total because `id` is a
 * uuidv7 and unique — and the next page is "everything strictly before that".
 *
 * The cursor is opaque on the wire: base64url of `createdAt|id`. A client that
 * tries to synthesise one gets a VALIDATION_FAILED, never a silent wrong page.
 */

export interface Cursor {
  readonly createdAt: string;
  readonly id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  }
  const sep = decoded.lastIndexOf("|");
  const createdAt = sep === -1 ? "" : decoded.slice(0, sep);
  const id = sep === -1 ? "" : decoded.slice(sep + 1);
  if (createdAt === "" || id === "" || Number.isNaN(Date.parse(createdAt))) {
    throw new ApiError("VALIDATION_FAILED", "Invalid cursor");
  }
  return { createdAt, id };
}

export function clampLimit(limit: number): number {
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}

/**
 * A row usable as a page: it must expose the sort keys the cursor is built from.
 * pg returns `created_at` as a Date and `id` as a string.
 */
export interface PageableRow {
  readonly id: string;
  readonly created_at: Date;
}

/**
 * Turns an over-fetched result set into a page. Callers query `limit + 1` rows
 * ordered `created_at DESC, id DESC`; if the extra row is present there is a
 * next page and its cursor points at the last row actually returned.
 */
export function toPage<Row extends PageableRow, T>(
  rows: readonly Row[],
  limit: number,
  map: (row: Row) => T,
): Page<T> {
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible[visible.length - 1];
  const nextCursor =
    hasMore && last !== undefined
      ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
      : null;
  return { items: visible.map(map), nextCursor };
}

/**
 * Builds the keyset predicate + params for a cursor. Returns a SQL fragment
 * that references `$<startIndex>` and `$<startIndex+1>`, so callers can splice
 * it into a larger parameterised query without string-building the values.
 */
export function keysetPredicate(
  cursor: Cursor | null,
  startIndex: number,
): { sql: string; params: unknown[] } {
  if (cursor === null) return { sql: "", params: [] };
  return {
    sql: `AND (created_at, id) < ($${startIndex}::timestamptz, $${startIndex + 1}::uuid)`,
    params: [cursor.createdAt, cursor.id],
  };
}
