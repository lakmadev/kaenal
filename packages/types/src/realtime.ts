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
  // Phase R4 — live presence / edit-intent on an entity (carries `viewers`, not
  // a cache-invalidation pointer). Delivered only to the entity's current viewers.
  "presence",
]);
export type RealtimeTopic = z.infer<typeof RealtimeTopic>;

export const RealtimeAction = z.enum(["created", "updated", "deleted"]);
export type RealtimeAction = z.infer<typeof RealtimeAction>;

/** One person present on an entity (Phase R4). Just an id + intent — the client
 *  resolves the display name from the members directory, so no PII on the wire. */
export const PresenceViewer = z.object({
  userId: z.string(),
  /** True while this person has the edit form open — the soft-lock signal others
   *  see so they don't collide into an optimistic-concurrency 409. */
  editing: z.boolean(),
});
export type PresenceViewer = z.infer<typeof PresenceViewer>;

/** The wire payload delivered to a client over SSE. Intentionally minimal — no
 *  tenant id (implicit in the authenticated stream), no row data. A `presence`
 *  event additionally carries `entityType` + the full `viewers` snapshot. */
export const RealtimeEvent = z.object({
  topic: RealtimeTopic,
  action: RealtimeAction,
  /** The affected entity's kind (present on `presence` events). */
  entityType: z.string().optional(),
  /** The affected entity, when the producer knows it. */
  entityId: z.string().optional(),
  /** Full presence snapshot for the entity (present on `presence` events). */
  viewers: z.array(PresenceViewer).optional(),
  /** ISO-8601 emit time, so a client can debounce/de-dup. */
  at: z.string(),
});
export type RealtimeEvent = z.infer<typeof RealtimeEvent>;

/** Entity kinds that support live presence (Phase R4). The URL `:type` segment
 *  is validated against this, and each maps to the view capability a member must
 *  hold to join (8D rides NCR view rights, matching the rest of the app). */
export const PresenceEntity = z.enum([
  "ncr",
  "inspection",
  "capa",
  "eightd",
  "supplier",
  "ppap",
  "scar",
  "document",
  "fmea",
]);
export type PresenceEntity = z.infer<typeof PresenceEntity>;

/** Body for a presence heartbeat — whether the caller currently has the edit
 *  form open. */
export const PresenceHeartbeatBody = z.object({
  editing: z.boolean().default(false),
});
export type PresenceHeartbeatBody = z.infer<typeof PresenceHeartbeatBody>;

/** What a heartbeat/leave returns: the current viewer snapshot for the entity. */
export const PresenceSnapshot = z.object({
  entityType: PresenceEntity,
  entityId: z.string(),
  viewers: z.array(PresenceViewer),
});
export type PresenceSnapshot = z.infer<typeof PresenceSnapshot>;
