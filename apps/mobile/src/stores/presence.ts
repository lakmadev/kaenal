import { create } from "zustand";
import type { PresenceViewer } from "@kaenal/types";

/**
 * Live presence store (Phase R6, mobile) — mirrors the web store. Viewer
 * snapshot per entity, keyed `type:id`, fed by the heartbeat response and by
 * `presence` events off the realtime stream. Ephemeral UI state.
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
