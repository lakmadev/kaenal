/**
 * In-memory collab room bus (Phase R5). The single realtime stream (`useRealtime`)
 * dispatches inbound `collab` events here; each mounted collaborative field
 * subscribes to its own room and applies the update to its local Yjs doc. Keeps
 * the SSE consumer decoupled from any particular editor instance.
 */

type Handler = (base64Update: string) => void;

const rooms = new Map<string, Set<Handler>>();

export const collabRoom = (type: string, id: string, field: string): string => `${type}:${id}:${field}`;

/** Subscribe a field to its room; returns an unsubscribe. */
export function onCollabUpdate(room: string, handler: Handler): () => void {
  let set = rooms.get(room);
  if (set === undefined) {
    set = new Set();
    rooms.set(room, set);
  }
  set.add(handler);
  return () => {
    const s = rooms.get(room);
    if (s === undefined) return;
    s.delete(handler);
    if (s.size === 0) rooms.delete(room);
  };
}

/** Deliver an inbound update to every subscriber of the room. */
export function dispatchCollabUpdate(room: string, base64Update: string): void {
  rooms.get(room)?.forEach((h) => h(base64Update));
}
