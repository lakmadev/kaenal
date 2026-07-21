import { z } from "zod";
import { ErrorCode } from "./enums.js";

/**
 * Shared HTTP contract primitives (03 §4–6).
 *
 * These live in `packages/types` because all three edges must agree on them:
 * the API produces them, the OpenAPI doc is generated from them, and the typed
 * client consumes them. A list shape or an error envelope that drifts between
 * server and client is exactly the class of bug a contract-first stack exists
 * to remove.
 */

// --- Error envelope (03 §4) -------------------------------------------------

export const ErrorBody = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBody>;

// --- Cursor pagination (03 §5) ----------------------------------------------

/**
 * List query. `cursor` is opaque — the server encodes whatever it needs to
 * resume (the last row's sort keys) and the client must treat it as a token,
 * never parse it. `limit` is clamped server-side too; the schema bound here is
 * a courtesy to the caller, not the enforcement.
 */
export const PageQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuery>;

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/**
 * A page of `T`. `nextCursor` is null on the last page — the client stops when
 * it sees null, never by comparing `items.length` to `limit` (a full last page
 * is indistinguishable from a non-last one that way).
 */
export const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

// --- Optimistic concurrency (03 §6) -----------------------------------------

/**
 * Every mutable resource carries a `version` — a monotonic counter bumped on
 * each write. A client sends the version it last saw; the server rejects the
 * write with `STALE_WRITE` if the row has moved on since. This is the wire
 * form of the `updated_at` compare-and-set the services perform.
 */
export const VersionedBody = z.object({
  version: z.number().int().nonnegative(),
});
export type VersionedBody = z.infer<typeof VersionedBody>;
