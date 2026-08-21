// Delta-pull read source (05 §2.1).
//
// Two implementations behind one `SyncReadSource` seam:
//   • `createDeltaReadSource` — the real path. Each entity pulls its own
//     `GET /v1/sync/<entity>?cursor=` delta endpoint: an O(delta) `updated_at`
//     keyset scan that reports changed rows AND tombstones, so deletions
//     reconcile incrementally. ncr + inspection use this.
//   • `createListReadSource` — the fallback for any entity that doesn't yet have
//     a delta endpoint. It walks the cursor-paginated list and derives the delta
//     client-side by `updatedAt`; correct and idempotent, but O(changed) and
//     blind to deletions (they reconcile only on a full refresh).

import type { MirrorRow } from "./types.js";
import { advanceCursor, decodeCursor, encodeCursor, isAfter, type DeltaCursor } from "./cursor.js";

/** A batch of changed rows plus the advanced cursor to persist. */
export interface DeltaBatch {
  rows: MirrorRow[];
  cursor: string | null;
}

/** One page of the server's `/v1/sync/<entity>` delta response. */
export interface DeltaPage {
  changed: Versioned[];
  deleted: string[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Calls one entity's delta endpoint for the page strictly after `cursor`. */
export type DeltaFetcher = (cursor: string | null) => Promise<DeltaPage>;

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

/**
 * The real read source (05 §2.1): pulls each entity through its `/v1/sync/<entity>`
 * delta endpoint — an O(delta) `updated_at` keyset scan that also reports tombstones,
 * so deletions reconcile incrementally instead of only on a full refresh. An entity
 * with a registered `DeltaFetcher` uses it; anything else falls back to the list
 * source, so the two can coexist while entities migrate. Pages within one pull until
 * the server clears `hasMore` (bounded by `maxPages`), persisting the server's opaque
 * cursor — which always marks the last row seen, so the next pull resumes after it.
 */
export function createDeltaReadSource(
  fetchers: Record<string, DeltaFetcher>,
  fallback: SyncReadSource,
  opts: { maxPages?: number } = {},
): SyncReadSource {
  const maxPages = opts.maxPages ?? 25;
  return {
    async pull(entityType, since) {
      const fetch = fetchers[entityType];
      if (!fetch) return fallback.pull(entityType, since);

      const rows: MirrorRow[] = [];
      let cursor = since;
      for (let page = 0; page < maxPages; page++) {
        const res = await fetch(cursor);
        for (const d of res.changed) rows.push(dtoToMirror(entityType, d));
        // Tombstone: ids only — the reader drops the mirror row on `deleted`.
        for (const id of res.deleted) {
          rows.push({ entityType, id, updatedAt: new Date().toISOString(), version: 0, deleted: true, data: null });
        }
        cursor = res.nextCursor ?? cursor;
        if (!res.hasMore) break;
      }
      return { rows, cursor };
    },
  };
}
