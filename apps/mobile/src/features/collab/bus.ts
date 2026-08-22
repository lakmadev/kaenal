/**
 * In-memory collab room bus (Phase R6.2, mobile) — the native mirror of the web
 * `collab-bus`. The realtime consumer (`use-realtime-sync`) dispatches inbound
 * `collab` events here; each mounted `CollabText` subscribes to its room.
 */

type Handler = (base64Update: string) => void;

const rooms = new Map<string, Set<Handler>>();

export const collabRoom = (type: string, id: string, field: string): string => `${type}:${id}:${field}`;

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

export function dispatchCollabUpdate(room: string, base64Update: string): void {
  rooms.get(room)?.forEach((h) => h(base64Update));
}
