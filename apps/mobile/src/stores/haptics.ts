import { create } from "zustand";

import { services } from "@/services";

const KEY = "kaenal.haptics.enabled";

interface HapticsState {
  /** Whether taps play a subtle vibration. On by default; a Settings toggle flips it. */
  enabled: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setEnabled: (on: boolean) => void;
}

export const useHaptics = create<HapticsState>((set) => ({
  enabled: true,
  hydrated: false,
  hydrate: async () => {
    const saved = await services.kv.getItem(KEY);
    // Default ON — only an explicit "0" disables it.
    set({ enabled: saved !== "0", hydrated: true });
  },
  setEnabled: (on) => {
    set({ enabled: on });
    void services.kv.setItem(KEY, on ? "1" : "0");
  },
}));
