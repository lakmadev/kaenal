import { create } from "zustand";
import type { PresenceViewer } from "@kaenal/types";

/**
 * Live presence store (Phase R4). Holds the current viewer snapshot per entity,
 * keyed `type:id`. Fed from two sources that agree: the caller's own heartbeat
 * response (immediate) and `presence` events off the realtime stream (as others
 * join, leave, or start/stop editing). Ephemeral UI state — never persisted.
 */

export const presenceKey = (type: string, id: string): string => `${type}:${id}`;

interface PresenceStore {
  byEntity: Record<string, PresenceViewer[]>;
  set: (key: string, viewers: PresenceViewer[]) => void;
  clear: (key: string) => void;
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  byEntity: {},
  set: (key, viewers) => set((s) => ({ byEntity: { ...s.byEntity, [key]: viewers } })),
  clear: (key) =>
    set((s) => {
      if (s.byEntity[key] === undefined) return s;
      const next = { ...s.byEntity };
      delete next[key];
      return { byEntity: next };
    }),
}));
