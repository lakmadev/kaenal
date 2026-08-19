import { create } from "zustand";

import type { SyncState as SyncPillState } from "@/ui";

// Live sync status surfaced by the header pill. This is a placeholder shape in M2;
// the real sync engine (M3) drives these fields from the mutation queue + delta
// pull. Kept as its own store so every screen's header can read it cheaply.
interface SyncStore {
  state: SyncPillState;
  pending: number;
  failed: number;
  lastSyncedAt: number | null;
  set: (patch: Partial<Omit<SyncStore, "set">>) => void;
}

export const useSync = create<SyncStore>((set) => ({
  state: "synced",
  pending: 0,
  failed: 0,
  lastSyncedAt: null,
  set: (patch) => set(patch),
}));
