import * as Y from "yjs";

/**
 * Server-authoritative collaborative-edit docs (Phase R7).
 *
 * R5 shipped a dumb relay: it broadcast opaque Yjs updates but kept no state, so
 * a client that joined mid-session missed every edit made before it arrived. R7
 * adds a per-room authoritative `Y.Doc` that accumulates the broadcast updates,
 * and a `/state` endpoint so a late joiner converges to the live document.
 *
 * The doc holds only the DELTA from the shared deterministic base (every client
 * seeds that base locally — see the web `seedUpdate`), so the server never needs
 * the entity's persisted text. Applying an update is idempotent (Yjs), so it is
 * safe to apply the same update on every API instance: each instance feeds its
 * doc from the Redis fan-out (see `RealtimeService`), keeping them consistent
 * without sticky sessions.
 */

/** Canonical room key — tenant-scoped so docs never mix across tenants. Shared
 *  by the fan-out feed and the `/state` endpoint so the two never drift. */
export function collabRoomKey(
  tenantId: string,
  type: string,
  id: string,
  field: string,
): string {
  return `${tenantId}:${type}:${id}:${field}`;
}

export class CollabService {
  private readonly docs = new Map<string, Y.Doc>();

  /** Apply a base64 Yjs update to the room's authoritative doc (creating it on
   *  first use). Called for every collab signal received off the bus, on every
   *  instance — idempotent, so double-application is harmless. */
  apply(room: string, base64Update: string): void {
    let doc = this.docs.get(room);
    if (doc === undefined) {
      doc = new Y.Doc();
      this.docs.set(room, doc);
    }
    try {
      Y.applyUpdate(doc, Buffer.from(base64Update, "base64"));
    } catch {
      /* malformed update — ignore, never throw on the fan-out path */
    }
  }

  /** The room's accumulated state as a base64 update for a late joiner, or null
   *  if no edits have been made this session. */
  state(room: string): string | null {
    const doc = this.docs.get(room);
    if (doc === undefined) return null;
    return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
  }

  /** Drop a room's doc — called when its last viewer leaves, to bound memory.
   *  (The persisted text remains the source of truth; a fresh session re-seeds.) */
  evict(room: string): void {
    const doc = this.docs.get(room);
    if (doc !== undefined) {
      doc.destroy();
      this.docs.delete(room);
    }
  }

  /** Live room count (health/metrics). */
  get roomCount(): number {
    return this.docs.size;
  }
}
