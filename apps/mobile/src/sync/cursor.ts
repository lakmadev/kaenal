// Delta-sync cursor (05 §2.1). The spec's ideal read path is
// `GET /v1/sync/<table>?since=<cursor>` where the cursor is a server `updated_at`
// + id keyset. That endpoint does not exist yet (see read-source.ts / the M3 gap
// note in progress_mobile.md), but the cursor MATH is endpoint-agnostic: it tracks
// the high-water mark of applied changes so a pull is incremental and idempotent.

export interface DeltaCursor {
  updatedAt: string; // ISO server timestamp of the newest applied row
  id: string; // tie-breaker for rows sharing a millisecond
}

/** Stable, opaque-ish string form for storage / the `since` query param. */
export function encodeCursor(c: DeltaCursor): string {
  return `${c.updatedAt}~${c.id}`;
}

export function decodeCursor(s: string | null | undefined): DeltaCursor | null {
  if (!s) return null;
  const i = s.lastIndexOf("~");
  if (i < 0) return null;
  return { updatedAt: s.slice(0, i), id: s.slice(i + 1) };
}

/** True if `row` is strictly newer than `cursor` (updatedAt, then id keyset). */
export function isAfter(cursor: DeltaCursor | null, row: { updatedAt: string; id: string }): boolean {
  if (!cursor) return true;
  if (row.updatedAt !== cursor.updatedAt) return row.updatedAt > cursor.updatedAt;
  return row.id > cursor.id;
}

/**
 * Advance a cursor to the newest of a batch of rows. Pure fold — callers pass the
 * rows they actually applied to the mirror, so the cursor never runs ahead of
 * persisted state (crash-safe: re-pull from the last durably-applied high-water mark).
 */
export function advanceCursor(
  cursor: DeltaCursor | null,
  rows: readonly { updatedAt: string; id: string }[],
): DeltaCursor | null {
  let next = cursor;
  for (const r of rows) {
    if (isAfter(next, r)) next = { updatedAt: r.updatedAt, id: r.id };
  }
  return next;
}
