"use client";

import { useEffect, useRef } from "react";
import type { PresenceEntity, PresenceViewer } from "@kaenal/types";
import { presenceHeartbeat, presenceLeave } from "@/lib/presence";
import { presenceKey, usePresenceStore } from "@/stores/presence";

const HEARTBEAT_MS = 20_000; // < the server's 45s viewer TTL, so a viewer never lapses
const EMPTY: PresenceViewer[] = [];

/**
 * Join an entity's live presence (Phase R4) and return its current viewers
 * (including yourself). Heartbeats on mount and every 20s, re-heartbeats
 * immediately when your `editing` intent flips (so others see the soft lock at
 * once), and leaves on unmount or when the tab is hidden/closed. Viewers update
 * from both the heartbeat response and `presence` events off the realtime
 * stream. Entirely additive — a presence failure never affects the screen.
 */
export function usePresence(type: PresenceEntity, id: string, editing: boolean): PresenceViewer[] {
  const key = presenceKey(type, id);
  const viewers = usePresenceStore((s) => s.byEntity[key] ?? EMPTY);
  const setStore = usePresenceStore((s) => s.set);
  const clear = usePresenceStore((s) => s.clear);
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Join + heartbeat + leave, tied to the entity identity.
  useEffect(() => {
    let active = true;
    const beat = async (): Promise<void> => {
      const snap = await presenceHeartbeat(type, id, editingRef.current);
      if (active && snap !== null) setStore(key, snap.viewers);
    };
    void beat();
    const interval = setInterval(() => void beat(), HEARTBEAT_MS);
    const onHide = (): void => void presenceLeave(type, id);
    window.addEventListener("pagehide", onHide);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("pagehide", onHide);
      void presenceLeave(type, id);
      clear(key);
    };
  }, [type, id, key, setStore, clear]);

  // Reflect an edit-intent change immediately (don't wait for the next beat).
  useEffect(() => {
    void presenceHeartbeat(type, id, editing).then((snap) => {
      if (snap !== null) setStore(key, snap.viewers);
    });
  }, [editing, type, id, key, setStore]);

  return viewers;
}
