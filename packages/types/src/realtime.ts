import { z } from "zod";

/**
 * Realtime signal bus (Phase R1).
 *
 * The bus is a *cache-invalidation* channel, not a data channel: a signal
 * carries only a POINTER — "something of this topic changed" — never the row
 * itself. The client reacts by refetching through the normal RLS-scoped,
 * audited API, so tenant isolation, optimistic concurrency and the audit trail
 * all stay authoritative. This keeps the socket cheap and, crucially, means the
 * realtime layer can never leak data that bypasses RLS.
 */

/** Query-key namespaces a stream can be told to refresh. Grows as R2 wires more
 *  producers; the web consumer maps each to the TanStack keys it invalidates. */
export const RealtimeTopic = z.enum([
  "notifications",
  "ncr",
  "capa",
  "eightd",
  "inspection",
  "finding",
  "audit",
  "supplier",
  "ppap",
  "scar",
  "document",
  "fmea",
]);
export type RealtimeTopic = z.infer<typeof RealtimeTopic>;

export const RealtimeAction = z.enum(["created", "updated", "deleted"]);
export type RealtimeAction = z.infer<typeof RealtimeAction>;

/** The wire payload delivered to a client over SSE. Intentionally minimal — no
 *  tenant id (implicit in the authenticated stream), no row data. */
export const RealtimeEvent = z.object({
  topic: RealtimeTopic,
  action: RealtimeAction,
  /** The affected entity, when the producer knows it. */
  entityId: z.string().optional(),
  /** ISO-8601 emit time, so a client can debounce/de-dup. */
  at: z.string(),
});
export type RealtimeEvent = z.infer<typeof RealtimeEvent>;
