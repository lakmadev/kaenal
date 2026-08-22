import { useEffect, useRef } from "react";
import type { PresenceEntity, PresenceViewer } from "@kaenal/types";

import { presenceHeartbeat, presenceLeave } from "@/services/presence";
import { presenceKey, usePresenceStore } from "@/stores/presence";

const HEARTBEAT_MS = 20_000; // < the server's 45s viewer TTL
const EMPTY: readonly PresenceViewer[] = [];

/**
 * Join an entity's live presence (Phase R6, mobile) and return its viewers
 * (including yourself). Heartbeats on mount + every 20s, re-heartbeats
 * immediately when `editing` flips, and leaves on unmount. Viewers update from
 * both the heartbeat response and `presence` events off the realtime stream.
 *
 * The store is driven imperatively via `getState()` (never subscribed setters in
 * effect deps) so the effects run exactly once per identity change — important
 * under the mobile build's React Compiler, which is stricter than the web.
 */
export function usePresence(type: PresenceEntity, id: string, editing: boolean): readonly PresenceViewer[] {
  const key = presenceKey(type, id);
  // Default OUTSIDE the selector: zustand v5's useSyncExternalStore requires the
  // snapshot to be reference-stable, so the selector returns the stored array or
  // undefined (both stable) and `?? EMPTY` is applied here.
  const viewers = usePresenceStore((s) => s.byEntity[key]) ?? EMPTY;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  useEffect(() => {
    let active = true;
    const beat = async (): Promise<void> => {
      const snap = await presenceHeartbeat(type, id, editingRef.current);
      if (active && snap !== null) usePresenceStore.getState().set(key, snap.viewers);
    };
    void beat();
    const interval = setInterval(() => void beat(), HEARTBEAT_MS);
    return () => {
      active = false;
      clearInterval(interval);
      void presenceLeave(type, id);
      usePresenceStore.getState().clear(key);
    };
  }, [type, id, key]);

  useEffect(() => {
    let active = true;
    void presenceHeartbeat(type, id, editing).then((snap) => {
      if (active && snap !== null) usePresenceStore.getState().set(key, snap.viewers);
    });
    return () => {
      active = false;
    };
  }, [editing, type, id, key]);

  return viewers;
}
