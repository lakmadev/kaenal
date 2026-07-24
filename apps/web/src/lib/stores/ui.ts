import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Lightweight client-only UI state (04 §1 — Zustand for UI state, TanStack Query
 * for server state). Nothing here is domain data; it's chrome preferences. The
 * sidebar collapsed state is persisted (04 §3 — "collapsed 72px, persisted").
 */
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  /** Mobile off-canvas drawer (below 860px). Not persisted — session-only. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
    }),
    {
      name: "kaenal-ui",
      // Only the durable preference is persisted; transient drawer state is not.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
