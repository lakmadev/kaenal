// Delta-pull read source (05 §2.1).
//
// GAP (logged in progress_mobile.md): the spec's ideal read path is
// `GET /v1/sync/<table>?since=<cursor>` returning changed + tombstoned rows. The
// backend does NOT expose those endpoints yet. Until it does, this module pulls the
// existing cursor-paginated list endpoints and derives the delta client-side by
// `updatedAt` — which is correct and idempotent, but has two honest limitations:
//   1. No tombstones (a list can't report deletions) → deletes are reconciled on
//      full refresh, not incrementally.
//   2. A pull walks pages until it stops seeing newer rows, so it's O(changed),
//      not O(1) like a real `since` endpoint would be.
// The `SyncReadSource` interface is the seam: swap in a `/v1/sync/*` adapter later
// and the engine is unchanged.

import type { MirrorRow } from "./types.js";
import { advanceCursor, decodeCursor, encodeCursor, isAfter, type DeltaCursor } from "./cursor.js";

/** A batch of changed rows plus the advanced cursor to persist. */
export interface DeltaBatch {
  rows: MirrorRow[];
  cursor: string | null;
}

/** The seam the engine pulls through. One implementation today (list fallback). */
export interface SyncReadSource {
  pull(entityType: string, since: string | null): Promise<DeltaBatch>;
}

/** Minimal DTO shape every mirrored entity satisfies (03 §5–6). */
export interface Versioned {
  id: string;
  updatedAt: string;
  version: number;
}

/** Build a mirror row from any versioned DTO — generic, so new entities need no code. */
export function dtoToMirror(entityType: string, dto: Versioned): MirrorRow {
  return { entityType, id: dto.id, updatedAt: dto.updatedAt, version: dto.version, deleted: false, data: dto };
}

/**
 * One entity's list fetcher: given an opaque page cursor, return that page of DTOs
 * and the next page cursor (null on the last page). Wraps a ts-rest list call so
 * this module stays free of the client's concrete types.
 */
export type ListPuller = (pageCursor: string | null) => Promise<{ items: Versioned[]; nextCursor: string | null }>;

/**
 * Fallback read source over cursor-paginated lists. For each entity it walks pages
 * newest-first, keeping rows strictly newer than the stored delta cursor, and stops
 * as soon as a page contributes nothing new (lists are ordered by recency, so older
 * pages can't contain newer rows). Bounded by `maxPages` so a first sync can't spin.
 */
export function createListReadSource(
  pullers: Record<string, ListPuller>,
  opts: { maxPages?: number } = {},
): SyncReadSource {
  const maxPages = opts.maxPages ?? 25;
  return {
    async pull(entityType, since) {
      const puller = pullers[entityType];
      if (!puller) return { rows: [], cursor: since };
      const cur: DeltaCursor | null = decodeCursor(since);

      const rows: MirrorRow[] = [];
      let pageCursor: string | null = null;
      for (let page = 0; page < maxPages; page++) {
        const { items, nextCursor } = await puller(pageCursor);
        const fresh = items.filter((d) => isAfter(cur, { updatedAt: d.updatedAt, id: d.id }));
        for (const d of fresh) rows.push(dtoToMirror(entityType, d));
        // Nothing new on this page, or no more pages → done.
        if (fresh.length === 0 || nextCursor === null) break;
        pageCursor = nextCursor;
      }

      const advanced = advanceCursor(cur, rows);
      return { rows, cursor: advanced ? encodeCursor(advanced) : since };
    },
  };
}
