import { create } from "zustand";
import type { UserPreferencesSettings } from "@kaenal/types";

/**
 * Save state of the per-user preferences (board W10-D/E/G), shared by the
 * Tweaks panel and the Preferences cards so both show the same footer status.
 * Session-only UI state; the values themselves live in the TanStack cache.
 */
export type PreferencesSaveStatus = "idle" | "saving" | "saved" | "failed";

interface PreferencesSaveState {
  status: PreferencesSaveStatus;
  /** The change that failed to save (drives the banner text and "Try again"). */
  failed: Partial<UserPreferencesSettings> | null;
  /** True after a 409 was reconciled silently ("Updated from another tab."). */
  updatedElsewhere: boolean;
  setSaving: () => void;
  setSaved: () => void;
  setFailed: (patch: Partial<UserPreferencesSettings>) => void;
  setUpdatedElsewhere: () => void;
  clearFailed: () => void;
}

export const usePreferencesSaveStore = create<PreferencesSaveState>()((set) => ({
  status: "idle",
  failed: null,
  updatedElsewhere: false,
  setSaving: () => set({ status: "saving", failed: null }),
  setSaved: () => {
    set({ status: "saved" });
    // "Saved" is shown for 2s (board W10-D), then the footer returns to its caption.
    setTimeout(() => set((s) => (s.status === "saved" ? { status: "idle", updatedElsewhere: false } : s)), 2000);
  },
  setFailed: (failed) => set({ status: "failed", failed }),
  setUpdatedElsewhere: () => set({ updatedElsewhere: true }),
  clearFailed: () => set({ status: "idle", failed: null }),
}));
